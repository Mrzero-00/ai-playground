"""상승장 레버리지 롱 (RESEARCH.md '상승장 레버리지 롱'). 상승장을 정하는 방식 A 앙상블 비중 · B 상승장만 · C 상승장 롱 + 하락장 1배 숏
× 레버리지 1·2·3·5배. 바이낸스 USDT 무기한·실제 펀딩, 날마다 같은 배수로 맞추고(그 거래 비용 포함), 격리 마진 청산.
코인마다 따로(반반으로 시작해 서로 맞추지 않는다), 원/달러를 곱해 원화로 본다.
사용법: python3 scripts/lab/levlong.py   → data/lab/levlong.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
import regime_futures as R
from indicators import sma
from regime3 import hyst, ztrail

END, SEED = R.END, 1_000_000
LEVS = (1, 2, 3, 5)
FAMS = {"A": "앙상블 비중 × L", "B": "상승장만 L배 롱", "C": "상승장 L배 롱 + 하락장 1배 숏"}
STARTS = ("2020-01-01", "2023-01-01", "2026-01-01")
COSTS = {"0.10%": 0.001, "0.25%": 0.0025}
PERIODS = {"2020~2021": ("2020-01-01", "2021-12-31"), "2022~2026": ("2022-01-01", END)}
MM = 0.005  # 유지 증거금(명목 대비)
C0 = "C0 업비트 현물 봇 (기준)"


def fx():
    f = pd.read_csv(C.ML / "usdkrw.csv", parse_dates=["date"], index_col="date").krw.astype(float)
    return f.reindex(pd.date_range("2019-01-01", END)).ffill()


def load():
    out = {}
    for s in R.SYMS:
        d = R.load(s)
        sp = pd.read_csv(C.ML / f"spot_{s}.csv", parse_dates=["date"], index_col="date")[["high", "low", "close"]].astype(float).reindex(d.index)
        d["s_high"], d["s_low"], d["s_close"] = sp.high, sp.low, sp.close
        g = np.sign(hyst(ztrail(d.close, 30))).astype(float)
        d["up"], d["down"] = np.maximum(g, 0), np.minimum(g, 0)
        out[s] = d
    return out


def exposure(d, fam, L):
    if fam == "A":
        return d.ens.fillna(0.0) * L
    if fam == "B":
        return d.up * L
    return d.up * L + d.down


def sleeve(d, x, start, cost, basis):
    """코인 하나의 USDT 평가액 곡선(시작 1)과 청산 날짜들. x = 날마다 노출(평가액 대비)."""
    x = x.copy()
    x[x.index < pd.Timestamp(start) - pd.Timedelta(days=1)] = 0.0  # 그 전 포지션 없음: 시작 전날 종가 신호로 들어간다
    xs = x.shift().fillna(0.0)
    ret = d.close.pct_change().fillna(0.0)
    r = xs * ret - xs * d.fund - cost * x.diff().abs().shift().fillna(0.0) - cost * (xs * (xs - 1)).abs() * ret.abs()
    hi, lo, pc = (d.high, d.low, d.close.shift()) if basis == "가" else (d.s_high, d.s_low, d.s_close.shift())
    loss = np.where(xs > 0, xs * (1 - lo / pc), np.where(xs < 0, -xs * (hi / pc - 1), 0.0))
    liq = pd.Series(loss >= 1 - MM * xs.abs(), index=d.index) & (xs != 0)
    r[liq] = -1.0
    r = r[r.index >= start]
    eq = (1 + r).cumprod()
    first = liq[(liq.index >= start) & liq]
    return eq, ([str(first.index[0].date())] if len(first) else []), float((xs * d.fund)[d.index >= start].sum())


def krw(curves, start, F):
    """코인마다 50만원(원화)으로 시작해 USDT 로 굴리고 원/달러를 곱해 더한다."""
    f0 = F.asof(pd.Timestamp(start) - pd.Timedelta(days=1))
    return sum(SEED / len(curves) * eq * F.reindex(eq.index).ffill() / f0 for eq in curves)


def spot_bot(start, cost):
    curves = []
    for s in R.SYMS:
        c = pd.read_csv(C.ROOT / "data" / f"KRW-{s}.csv", parse_dates=["date"], index_col="date").close.astype(float)
        c = c[c.index <= END]
        w = sum((c > sma(c, n)).astype(float) for n in (20, 50, 100, 200)) / 4
        w[w.index < pd.Timestamp(start) - pd.Timedelta(days=1)] = 0.0
        r = (w.shift() * c.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
        curves.append(SEED / len(R.SYMS) * (1 + r[r.index >= start]).cumprod())
    return sum(curves)


def stats(eq):
    r = eq.pct_change().iloc[1:].fillna(0.0)  # 평가액이 0 이 된 뒤(0 ÷ 0)는 수익 0
    return {"잔고": float(eq.iloc[-1]), "샤프": float(r.mean() / r.std() * np.sqrt(365)) if r.std() > 0 else 0.0, "MDD": float((eq / eq.cummax() - 1).min())}


def main():
    D, F = load(), fx()
    out = {"made": datetime.now().isoformat(timespec="seconds"), "levs": LEVS, "fams": FAMS, "rows": {}}
    base = {}
    for st in STARTS:
        for cn, cost in COSTS.items():
            eq = spot_bot(st, cost)
            base[(st, cn)] = eq
            row = out["rows"].setdefault(C0, {"묶음": "현물"})
            row.setdefault(st, {})[cn] = stats(eq)
    b0 = base[("2020-01-01", "0.10%")]
    out["rows"][C0]["해"] = {str(y): float(b0[b0.index.year == y].iloc[-1] / (b0[b0.index.year < y].iloc[-1] if y > 2020 else SEED) - 1) for y in range(2020, 2027)}
    out["rows"][C0]["기간"] = {pn: stats(b0[(b0.index >= a) & (b0.index <= b)]) for pn, (a, b) in PERIODS.items()}

    for fam in FAMS:
        for L in LEVS:
            name = f"{fam} {FAMS[fam].replace('L', str(L))}"
            row = out["rows"].setdefault(name, {"묶음": "선물", "틀": fam, "배수": L})
            for st in STARTS:
                for cn, cost in COSTS.items():
                    for basis in ("가", "나"):
                        res = [sleeve(d, exposure(d, fam, L), st, cost, basis) for d in D.values()]
                        eq = krw([q for q, _, _ in res], st, F)
                        sm = stats(eq)
                        sm["청산"] = {s: liq for s, (_, liq, _) in zip(D, res) if liq}
                        row.setdefault(st, {}).setdefault(cn, {})[basis] = sm
                        if st == "2020-01-01" and cn == "0.10%" and basis == "가":
                            ends = {y: float(eq[eq.index.year == y].iloc[-1]) for y in range(2020, 2027)}
                            row["해"] = {str(y): (ends[y] / (ends[y - 1] if y > 2020 else SEED) - 1) if (ends.get(y - 1) or y == 2020) else None for y in ends}  # 청산으로 0 이 된 뒤는 None
                            row["기간"] = {pn: stats(eq[(eq.index >= a) & (eq.index <= b)]) for pn, (a, b) in PERIODS.items()}
                            yrs = (eq.index[-1] - eq.index[0]).days / 365
                            row["펀딩"] = float(np.mean([fund for _, _, fund in res]) / yrs)
                        if st == "2020-01-01" and cn == "0.25%" and basis == "가":
                            row["기간 0.25%"] = {pn: stats(eq[(eq.index >= a) & (eq.index <= b)]) for pn, (a, b) in PERIODS.items()}
    c0p = {pn: stats(base[("2020-01-01", "0.25%")][(base[("2020-01-01", "0.25%")].index >= a) & (base[("2020-01-01", "0.25%")].index <= b)]) for pn, (a, b) in PERIODS.items()}
    for name, r in out["rows"].items():
        if r.get("배수", 1) == 1:
            continue
        cb = out["rows"][C0]["기간"]
        crit = {"샤프 > C0 (두 기간)": all(r["기간"][pn]["샤프"] > cb[pn]["샤프"] for pn in PERIODS),
                "MDD 5%p 이내": all(r["기간"][pn]["MDD"] >= cb[pn]["MDD"] - 0.05 for pn in PERIODS),
                "0.25% 에서도": all(r["기간 0.25%"][pn]["샤프"] > c0p[pn]["샤프"] for pn in PERIODS),
                "청산 0회 (가)": not r["2020-01-01"]["0.10%"]["가"]["청산"]}
        r["판정"], r["통과"] = crit, all(crit.values())
    (C.OUT / "levlong.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))

    print(f"== 2020-01-01 시작 → {END} · 100만원 · 0.10% · 청산 기준 (가) 선물 가격 / (나) 현물 가격 — 잔고 · 샤프 · MDD · 청산(코인: 날짜) · 0.25% 잔고 · 연 펀딩")
    c = out["rows"][C0]["2020-01-01"]
    print(f"   {C0:34s} {c['0.10%']['잔고'] / 1e4:8,.0f}만 · {c['0.10%']['샤프']:.2f} · {c['0.10%']['MDD'] * 100:5.1f}%  | 0.25% {c['0.25%']['잔고'] / 1e4:,.0f}만")
    for name, r in out["rows"].items():
        if name == C0:
            continue
        a, b, h = r["2020-01-01"]["0.10%"]["가"], r["2020-01-01"]["0.10%"]["나"], r["2020-01-01"]["0.25%"]["가"]
        print(f"   {name:34s} (가) {a['잔고'] / 1e4:8,.0f}만 · {a['샤프']:.2f} · {a['MDD'] * 100:5.1f}% · {a['청산'] or '청산 없음'}"
              f" | (나) {b['잔고'] / 1e4:8,.0f}만 · {b['청산'] or '청산 없음'} | 0.25% {h['잔고'] / 1e4:,.0f}만 | 펀딩 {r['펀딩'] * 100:4.1f}% {'통과' if r.get('통과') else ('기각' if '통과' in r else '')}")
    for st in STARTS[1:]:
        print(f"== {st} 시작 → {END} · 잔고 0.10% (가) / (나)")
        for name, r in out["rows"].items():
            if name == C0:
                print(f"   {name:34s} {r[st]['0.10%']['잔고'] / 1e4:7.1f}만")
            else:
                a, b = r[st]["0.10%"]["가"], r[st]["0.10%"]["나"]
                print(f"   {name:34s} {a['잔고'] / 1e4:7.1f}만 / {b['잔고'] / 1e4:7.1f}만 {a['청산'] or ''}")
    print("== 해마다 수익 (2020 시작, 0.10%, 청산 기준 (가))")
    for name, r in out["rows"].items():
        print(f"   {name:34s} " + " ".join("   청산 뒤" if v is None else f"{v * 100:+8.0f}%" for v in r["해"].values()))


if __name__ == "__main__":
    main()
