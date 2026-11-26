"""2026년에 시작했다면 — 현물 대 선물 (RESEARCH.md '2026년에 시작했다면'). 이미 정해 둔 방식들을 2026-01-01 09:00 KST 에
100만원으로 새로 시작한 것으로 다시 잰다(그 전 포지션 없음). 판정 없이 사실만 적는다.
사용법: python3 scripts/lab/start2026.py   → data/lab/start2026.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
import regime_futures as R
import stoploss as S
from indicators import sma
from regime3 import hyst, ztrail

T0, END, SEED = "2026-01-01", "2026-11-22", 1_000_000
SIG = pd.Timestamp(T0) - pd.Timedelta(days=1)  # 첫 포지션을 정하는 봉(2025-12-31 종가 = 2026-01-01 09:00)
COSTS = {"0.10%": 0.001, "0.25%": 0.0025}
SPOT_BIN = {"0.10%": 0.0015, "0.25%": 0.003}  # 바이낸스 현물: 수수료 0.10% + 슬리피지 (hybrid.py 와 같다)
LIQ = 0.995  # F3: 그날 최악 가격으로 손실이 자본의 이만큼이면 청산 (FUTURES.md)


def fresh(pos, index):
    """SIG 앞의 포지션을 0 으로: 2026-01-01 09:00 에 처음 켠 봇."""
    p = pd.Series(np.asarray(pos, float), index=index)
    p[p.index < SIG] = 0.0
    return p


def ens(c):
    return sum((c > sma(c, n)).astype(float) for n in (20, 50, 100, 200)) / 4


def cut(r):
    return r[(r.index >= T0) & (r.index <= END)]


def fxr():
    fx = pd.read_csv(C.ML / "usdkrw.csv", parse_dates=["date"], index_col="date").krw.astype(float)
    return fx.reindex(pd.date_range("2025-01-01", END)).ffill().pct_change().fillna(0.0)


def to_krw(r, f):
    """계좌 전체가 USDT: 날마다 원/달러 변화를 곱한다."""
    return (1 + r) * (1 + f.reindex(r.index).fillna(0.0)) - 1


def liquidate(d, p, r):
    """F3: 그날 최악 가격으로 손실이 자본의 99.5% 면 그 코인 몫 전부 잃고 그 뒤 0."""
    q, prev = p.shift(), d.close.shift()
    worst = np.where(q > 0, q * (d.low / prev - 1), q * (d.high / prev - 1))
    liq = pd.Series(worst <= -LIQ, index=d.index) & (q != 0)
    r = r.copy()
    r[liq] = -1.0
    if liq.any():
        r[r.index > liq.idxmax()] = 0.0
    return r, int(cut(liq).sum())


def summarize(r, changes, extra=None):
    eq = SEED * (1 + r).cumprod()
    out = {"잔고": float(eq.iloc[-1]), "MDD": float((eq / eq.cummax() - 1).min()), "변경": int(changes),
           "달마다": {f"{t:%m}": float(v) for t, v in eq.groupby(eq.index.to_period("M")).last().to_timestamp().items()}}
    out.update(extra or {})
    return out


def main():
    f = fxr()
    rows = {}  # 이름 → {"묶음", 비용 → 요약}

    def put(name, group, by_cost):
        rows[name] = {"묶음": group, **by_cost}

    # 현물 S1: 지금 실전 봇 (30분 격자, 09:00 평가)
    G = {s: S.prep(s) for s in R.SYMS}
    t0 = pd.Timestamp(T0) + pd.Timedelta(hours=9)
    W = {s: S.simulate(G[s], "C1", 2, "atr20", "R2", start=int(np.searchsorted(G[s]["g"].index, t0)))[0] for s in R.SYMS}
    by = {}
    for cn, cost in COSTS.items():
        parts, ch = [], 0
        for s in R.SYMS:
            g, w = G[s]["g"], W[s]
            r = (w.shift() * g.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
            parts.append(r[r.index > t0])
            ch += int((w.diff().abs() > 0)[w.index >= t0].sum())
        r30 = pd.concat(parts, axis=1).fillna(0.0).mean(axis=1)
        eq = (1 + r30).cumprod()
        eq = eq[(eq.index.hour == 9) & (eq.index.minute == 0)]
        eq.index = eq.index.normalize() - pd.Timedelta(days=1)  # 09:00 평가 = 전날 일봉 마감
        by[cn] = summarize(eq.pct_change().fillna(eq.iloc[0] - 1), ch)
    put("S1 지금 실전 봇 (09시 + 4시간 매수 + 터틀 손절)", "현물", by)

    # 현물 S0 · 보유 (업비트 일봉)
    up = {s: pd.read_csv(C.ROOT / "data" / f"KRW-{s}.csv", parse_dates=["date"], index_col="date").close.astype(float) for s in R.SYMS}
    by, wsp = {}, {}
    for cn, cost in COSTS.items():
        parts, ch = [], 0
        for s, c in up.items():
            w = wsp[s] = fresh(ens(c), c.index)
            parts.append(cut((w.shift() * c.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)))
            ch += int((w.diff().abs() > 0)[w.index >= SIG].sum())
        by[cn] = summarize(pd.concat(parts, axis=1).fillna(0.0).mean(axis=1), ch)
    put("S0 예전 방식 (09시 하루 한 번)", "현물", by)
    hold = pd.concat([cut(c.pct_change()).add(1).cumprod() for c in up.values()], axis=1).mean(axis=1)
    hr = hold.pct_change().fillna(hold.iloc[0] - 1)
    put("업비트 현물 그냥 보유", "현물", {cn: summarize(hr, 2) for cn in COSTS})

    # 선물 (바이낸스 USDT 무기한, 원화 환산)
    D = {s: R.load(s) for s in R.SYMS}
    plans = {}
    for s, d in D.items():
        e = ens(d.close)
        g = hyst(ztrail(d.close, 30))
        sg = np.sign(g).astype(float)
        i0 = int(np.searchsorted(d.index, SIG))
        plans.setdefault("F0 롱만 (앙상블 비중)", {})[s] = e
        plans.setdefault("F1 대칭", {})[s] = 2 * e - 1
        plans.setdefault("F2 롱 + 전부 아래면 숏", {})[s] = e.where(e > 0, -1.0)
        plans.setdefault("F3 2배 롱", {})[s] = 2 * e
        plans.setdefault("T1 방향만 (상승 롱 · 횡보 0 · 하락 숏)", {})[s] = sg
        plans.setdefault("T2 롱만 (상승장만)", {})[s] = np.maximum(sg, 0)
        plans.setdefault("T3 숏만 (하락장만)", {})[s] = np.minimum(sg, 0)
        plans.setdefault("T4 T1 + 횡보장 박스권", {})[s] = R.box(d, g, start=i0)
        plans.setdefault("T5 정도 반영", {})[s] = g / 2
        plans.setdefault("선물 롱 보유", {})[s] = np.ones(len(d))
    for name, per in plans.items():
        by = {}
        for cn, cost in COSTS.items():
            parts, ch, liqs = [], 0, 0
            for s, d in D.items():
                p = fresh(per[s], d.index)
                r = R.daily(d, p.to_numpy(), cost)
                if name.startswith("F3"):
                    r, n = liquidate(d, p, r)
                    liqs += n
                parts.append(cut(r))
                ch += int((p.diff().abs() > 0)[p.index >= SIG].sum())
            by[cn] = summarize(to_krw(pd.concat(parts, axis=1).fillna(0.0).mean(axis=1), f), ch, {"청산": liqs} if name.startswith("F3") else None)
        put(name, "선물", by)
    for name, take in (("T6 T1 + 손절 2N", False), ("T7 T1 + 손절 2N · 익절 4N", True)):
        by = {}
        for cn, cost in COSTS.items():
            parts, ch = [], 0
            for s, d in D.items():
                g = hyst(ztrail(d.close, 30)).astype(float)
                g[d.index < SIG] = 0  # 그 전에는 상태가 없던 것으로: 첫날 상태 방향으로 들어간다
                r, pos = R.stops(d, g, cost, take)
                parts.append(cut(r))
                ch += int((pd.Series(pos, index=d.index).diff().abs() > 0)[d.index >= SIG].sum())
            by[cn] = summarize(to_krw(pd.concat(parts, axis=1).fillna(0.0).mean(axis=1), f), ch)
        put(name, "선물", by)

    # 조합: C1 업비트 현물 봇 + 쉬는 돈 숏(이론값) · B1 바이낸스 현물 봇 + 쉬는 돈 숏
    bsp = {s: pd.read_csv(C.ML / f"spot_{s}.csv", parse_dates=["date"], index_col="date").close.astype(float) for s in R.SYMS}
    for name, spot, spot_cost, usdt in (("C1 업비트 현물 봇 + 쉬는 돈으로 선물 숏 (이론값)", up, None, False),
                                        ("B1 바이낸스 현물 봇 + 쉬는 돈으로 선물 숏", bsp, SPOT_BIN, True)):
        by = {}
        for cn, cost in COSTS.items():
            parts, ch = [], 0
            for s, d in D.items():
                c = spot[s][spot[s].index <= END]
                w = fresh(ens(c), c.index)
                sc = spot_cost[cn] if spot_cost else cost
                leg = (w.shift() * c.pct_change() - sc * w.diff().abs().shift()).fillna(0.0)
                sh = fresh(np.minimum(np.sign(hyst(ztrail(d.close, 30))), 0), d.index)
                pos = sh * (1 - w.reindex(d.index).ffill().fillna(0.0))
                short = R.daily(d, pos.to_numpy(), cost)
                if not usdt:
                    short = short + pos.abs().shift().fillna(0.0) * f.reindex(d.index).fillna(0.0)  # 숏 증거금(USDT)의 환율 변화
                parts.append(cut(leg.add(short, fill_value=0.0)))
                ch += int((w.diff().abs() > 0)[w.index >= SIG].sum() + (pos.diff().abs() > 0)[pos.index >= SIG].sum())
            r = pd.concat(parts, axis=1).fillna(0.0).mean(axis=1)
            by[cn] = summarize(to_krw(r, f) if usdt else r, ch)
        put(name, "조합", by)

    out = {"made": datetime.now().isoformat(timespec="seconds"), "기간": [T0, END], "rows": rows,
           "원달러": [float(pd.read_csv(C.ML / "usdkrw.csv", parse_dates=["date"], index_col="date").krw.asof(pd.Timestamp(x))) for x in ("2025-12-31", END)]}
    (C.OUT / "start2026.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"== {T0} 09:00 에 100만원으로 시작 → {END} · 잔고 0.10% (0.25%) · MDD · 포지션 바꾼 횟수 · 원/달러 {out['원달러'][0]:,.1f} → {out['원달러'][1]:,.1f}")
    for name, r in sorted(rows.items(), key=lambda kv: -kv[1]["0.10%"]["잔고"]):
        a, h = r["0.10%"], r["0.25%"]
        print(f"   [{r['묶음']}] {name:38s} {a['잔고'] / 1e4:6.1f}만 ({h['잔고'] / 1e4:6.1f}만) MDD {a['MDD'] * 100:6.1f}% 변경 {a['변경']:3d}" + (f" 청산 {a['청산']}" if "청산" in a else ""))
    keys = ["S1 지금 실전 봇 (09시 + 4시간 매수 + 터틀 손절)", "업비트 현물 그냥 보유", "F0 롱만 (앙상블 비중)", "T1 방향만 (상승 롱 · 횡보 0 · 하락 숏)", "T3 숏만 (하락장만)", "C1 업비트 현물 봇 + 쉬는 돈으로 선물 숏 (이론값)"]
    print("== 달마다 말 잔고(만원, 0.10%)")
    print("   " + " " * 40 + " ".join(f"{m:>6s}" for m in rows[keys[0]]["0.10%"]["달마다"]))
    for k in keys:
        print(f"   {k[:38]:40s}" + " ".join(f"{v / 1e4:6.1f}" for v in rows[k]["0.10%"]["달마다"].values()))


if __name__ == "__main__":
    main()
