"""김치 프리미엄 헤지 매매 (RESEARCH.md '김치 프리미엄 헤지 매매'). 프리미엄이 낮을 때 업비트 현물 매수 + 바이낸스 선물 같은 금액 숏, 높아지면 정리.
총자금의 절반은 업비트 원화, 절반은 바이낸스 USDT 증거금. 신호는 t 종가, 포지션은 t+1 부터.
사용법: python3 scripts/lab/kimchi_hedge.py   → data/lab/kimchi_hedge.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
import regime_futures as R

START, END, SEED = R.START, R.END, 1_000_000
PERIODS, YEARS = R.PERIODS, R.YEARS
COSTS = {"0.10%": 0.001, "0.25%": 0.0025}
NAMES = {"K0": "항상 헤지 보유 (캐리 기준선)", "K1": "π ≤ 0% 진입 · ≥ 3% 정리", "K2": "π ≤ 0% 진입 · ≥ 5% 정리", "K3": "지난 365일 하위 20% 진입 · 상위 20% 정리"}


def data(sym, fx):
    up = pd.read_csv(C.ROOT / "data" / f"KRW-{sym}.csv", parse_dates=["date"], index_col="date").close.astype(float)
    sp = pd.read_csv(C.ML / f"spot_{sym}.csv", parse_dates=["date"], index_col="date").close.astype(float)
    d = R.load(sym)
    idx = up.index.intersection(sp.index)
    idx = idx[idx <= END]
    f = fx.reindex(idx, method="ffill")
    prem = up[idx] / (sp[idx] * f) - 1
    return dict(prem=prem, up=up[idx].pct_change(), fut=d.close.pct_change().reindex(idx), fund=d.fund.reindex(idx).fillna(0.0), fxr=f.pct_change().fillna(0.0), fclose=d.close.reindex(idx).ffill(),
                upc=up[idx], fxl=f)


def state(prem, rule):
    """프리미엄 → 보유(1)·쉼(0)."""
    p = prem.to_numpy()
    if rule == "K0":
        return np.ones(len(p))
    if rule == "K3":
        lo, hi = prem.rolling(365).quantile(0.2).to_numpy(), prem.rolling(365).quantile(0.8).to_numpy()
    else:
        lo, hi = np.zeros(len(p)), np.full(len(p), 0.03 if rule == "K1" else 0.05)
    out, h = np.zeros(len(p)), 0
    for i in range(len(p)):
        if np.isnan(lo[i]) or np.isnan(p[i]):
            out[i] = h
            continue
        if h == 0 and p[i] <= lo[i]:
            h = 1
        elif h == 1 and p[i] >= hi[i]:
            h = 0
        out[i] = h
    return out


def simulate(D, h, cost):
    """수량 고정: 들어갈 때 총자금을 절반씩 나눠 원화 전부로 현물을 사고 같은 수량을 숏, 나올 때 둘 다 정리.
    돌려주는 것: 날마다 (원화 평가액, 환율을 뺀 수익, 펀딩 수익) — START 에 평가액 1 로 시작."""
    idx = D["prem"].index
    m = np.where(idx >= START)[0]
    P, F, X, fund = D["upc"].to_numpy(), D["fclose"].to_numpy(), D["fxl"].to_numpy(), D["fund"].to_numpy()
    krw, usd, q = 0.5, 0.5 / X[m[0]], 0.0                  # 업비트 원화 · 바이낸스 USDT · 코인 수량 (평가액 1 = 시작 자금)
    eq_prev, E, pure, fpl = 1.0, [], [], []
    for i in m:
        fx_exp = usd + q * P[i - 1] / X[i - 1]               # 전날의 달러 노출: USDT 잔고 + 헤지한 현물의 달러 값
        f_pl = 0.0
        if q:
            f_pl = q * F[i] * fund[i]                        # 펀딩(숏이 받는다)
            usd += -q * (F[i] - F[i - 1]) + f_pl             # 숏 손익(USDT)
        eq = krw + q * P[i] + usd * X[i]
        pure.append((eq - eq_prev - fx_exp * (X[i] - X[i - 1])) / eq_prev)
        fpl.append(f_pl * X[i] / eq_prev)
        if h[i] == 1 and q == 0:                             # 들어간다: 절반씩 다시 나누고 원화 전부로 현물, 같은 수량 숏
            krw, usd = 0.5 * eq, 0.5 * eq / X[i]
            q = krw * (1 - cost) / P[i]
            krw = 0.0
            usd -= cost * q * F[i]
        elif h[i] == 0 and q > 0:                            # 나온다
            krw = q * P[i] * (1 - cost)
            usd -= cost * q * F[i]
            q = 0.0
        eq = krw + q * P[i] + usd * X[i]
        E.append(eq)
        eq_prev = eq
    return pd.Series(E, index=idx[m]), pd.Series(pure, index=idx[m]), pd.Series(fpl, index=idx[m])


def stats(r):
    eq = (1 + r).cumprod()
    sd = r.std()
    return {"연": float(eq.iloc[-1] ** (365 / len(r)) - 1), "샤프": float(r.mean() / sd * np.sqrt(365)) if sd > 0 else 0.0, "MDD": float((eq / eq.cummax() - 1).min()), "잔고": float(SEED * eq.iloc[-1])}


def main():
    fx = pd.read_csv(C.ML / "usdkrw.csv", parse_dates=["date"], index_col="date").krw.astype(float)
    DD = {s: data(s, fx) for s in R.SYMS}
    out = {"made": datetime.now().isoformat(timespec="seconds"), "window": [START, END], "names": NAMES, "rows": {}}
    mean = lambda parts: R.cut(pd.concat(parts, axis=1).fillna(0.0).mean(axis=1), START, END)
    for k in NAMES:
        row = {}
        for cn, cost in COSTS.items():
            T, P, F, hold, trips, runup = [], [], [], [], 0, 0.0
            for s, D in DD.items():
                h = state(D["prem"], k)
                e, p, f = simulate(D, h, cost)
                T.append(e); P.append(p); F.append(f)
                m = D["prem"].index >= START
                hs = pd.Series(h, index=D["prem"].index)
                hold.append(float(hs[m].mean()))
                trips += int(((hs.diff() == 1) & m).sum())
                fc, entry = D["fclose"].to_numpy(), None
                for i in np.where(m)[0]:
                    if h[i] == 1 and (i == 0 or h[i - 1] == 0):
                        entry = fc[i]
                    if h[i] == 1 and entry:
                        runup = max(runup, fc[i] / entry - 1)
                    if h[i] == 0:
                        entry = None
            eq = pd.concat(T, axis=1).mean(axis=1)                 # 코인 몫 반반(따로 굴린다)
            t = eq.pct_change().fillna(eq.iloc[0] - 1)
            wgt = pd.concat(T, axis=1).shift().fillna(1.0)         # 전날 평가액으로 가중
            p = (pd.concat(P, axis=1) * wgt).sum(axis=1) / wgt.sum(axis=1)
            f = (pd.concat(F, axis=1) * wgt).sum(axis=1) / wgt.sum(axis=1)
            row[cn] = {"원화": stats(t), "환율 뺀": stats(p), "기간": {pn: stats(R.cut(p, a, b)) for pn, (a, b) in PERIODS.items()},
                       "해": {y: float((1 + R.cut(t, f"{y}-01-01", f"{y}-12-31")).prod() - 1) for y in YEARS},
                       "해 환율 뺀": {y: float((1 + R.cut(p, f"{y}-01-01", f"{y}-12-31")).prod() - 1) for y in YEARS},
                       "펀딩 연": float(f.sum() / (len(f) / 365))}
        row.update(보유=float(np.mean(hold)), 왕복=trips, 최대상승=float(runup))
        b, hd = row["0.10%"], row["0.25%"]
        row["판정"] = {"두 기간 +": all(b["기간"][pn]["연"] > 0 and hd["기간"][pn]["연"] > 0 for pn in PERIODS), "샤프 > 1": b["환율 뺀"]["샤프"] > 1}
        row["통과"] = all(row["판정"].values())
        out["rows"][k] = row
    fxonly = mean([0.5 * D["fxr"] for D in DD.values()])
    out["환율만"] = {"잔고": float(SEED * (1 + fxonly).prod()), "해": {y: float((1 + R.cut(fxonly, f"{y}-01-01", f"{y}-12-31")).prod() - 1) for y in YEARS}}
    p = DD["BTC"]["prem"]
    p = p[p.index >= START]
    out["프리미엄"] = {"dates": [str(d.date()) for d in p.index[::3]], "values": [float(v) for v in p.to_numpy()[::3]]}
    (C.OUT / "kimchi_hedge.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"100만원 {START} → {END} · 총자금의 절반씩 두 거래소 · 편도 0.10% (0.25%)")
    print(f"   기준: 절반을 USDT 로 그냥 보유(환율만) 잔고 {out['환율만']['잔고'] / 1e4:,.0f}만")
    for k, nm in NAMES.items():
        r = out["rows"][k]
        a, h = r["0.10%"], r["0.25%"]
        per = " | ".join(f"{pn} {a['기간'][pn]['연'] * 100:+.1f}% ({h['기간'][pn]['연'] * 100:+.1f}%)" for pn in PERIODS)
        print(f"   {k} {nm:28s} 원화 잔고 {a['원화']['잔고'] / 1e4:5,.0f}만 ({h['원화']['잔고'] / 1e4:5,.0f}만) | 환율 뺀 연 {a['환율 뺀']['연'] * 100:+5.1f}% ({h['환율 뺀']['연'] * 100:+5.1f}%) 샤프 {a['환율 뺀']['샤프']:.2f} MDD {a['환율 뺀']['MDD'] * 100:.1f}%"
              f" | {per} | 펀딩 연 {a['펀딩 연'] * 100:+.1f}% 보유 {r['보유'] * 100:.0f}% 왕복 {r['왕복']} 선물 최대 상승 {r['최대상승'] * 100:+.0f}% {'통과' if r['통과'] else '-'}")
    print("해마다 환율 뺀 수익:", " ".join(YEARS))
    for k in NAMES:
        print(f"   {k}", " ".join(f"{out['rows'][k]['0.10%']['해 환율 뺀'][y] * 100:+5.1f}%" for y in YEARS))
    print("해마다 원화 기준 수익:")
    for k in NAMES:
        print(f"   {k}", " ".join(f"{out['rows'][k]['0.10%']['해'][y] * 100:+5.1f}%" for y in YEARS))
    print("   환율만", " ".join(f"{out['환율만']['해'][y] * 100:+5.1f}%" for y in YEARS))


if __name__ == "__main__":
    main()
