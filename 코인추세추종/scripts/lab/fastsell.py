"""팔 때도 빠르게 — 줄이는 확인 간격 (RESEARCH.md '팔 때도 빠르게'). 지금 봇(09:00 맞춤 + 4시간마다 늘리기만)에
줄이는 확인을 더하고 그 간격을 12시간·4시간·2시간·1시간·30분으로 바꾼다. 업비트 30분봉, 수익은 30분 격자.
사용법: python3 scripts/lab/fastsell.py   → data/lab/fastsell.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from fastbuy import COSTS, END, MAS, SEED, STARTS, SYMS, grid

BUY = 240  # 늘리는 확인: 4시간마다 (지금 봇)
OLD, BASE = "09:00 에만 (예전 방식)", "줄이는 확인 없음 (지금 봇)"
STEPS = {OLD: None, BASE: 0, "12시간": 720, "4시간": 240, "2시간": 120, "1시간": 60, "30분": 30}


def weight(g, sell):
    """30분 격자의 비중. 09:00 에는 일 단위 판단으로 맞추고, 그 사이 4시간마다 늘리기만, sell 분마다 줄이기만(0 이면 없음, None 이면 09:00 에만)."""
    mins = (g.index.hour * 60 + g.index.minute - 540) % 1440
    nine = mins == 0
    d = g[nine]
    wd = (sum((d > d.rolling(n).mean()).astype(float) for n in MAS) / len(MAS)).reindex(g.index).to_numpy()
    if sell is None:
        return pd.Series(wd, index=g.index).ffill().fillna(0.0)

    def sig(step):
        s, per = g[mins % step == 0], 1440 // step
        return (sum((s > s.rolling(n * per).mean()).astype(float) for n in MAS) / len(MAS)).reindex(g.index).to_numpy()

    up, dn = sig(BUY), sig(sell) if sell else np.full(len(g), np.nan)
    out, x = np.zeros(len(g)), 0.0
    for i in range(len(g)):
        if nine[i]:
            x = wd[i]
        elif not np.isnan(dn[i]) and dn[i] < x:  # 줄이는 확인이 먼저, 줄였으면 그 시각에는 늘리지 않는다
            x = dn[i]
        elif not np.isnan(up[i]) and up[i] > x:
            x = up[i]
        out[i] = x
    return pd.Series(out, index=g.index)


def rebuys(g, w, start):
    """진단(판정 아님): 장중에 줄인 뒤 다음에 늘릴 때의 가격이 판 가격보다 높았나. (횟수, 더 비싸게 다시 산 비율, 가격 차 중앙값, 다시 살 때까지 시간 중앙값)"""
    dw = w.diff().to_numpy()
    px, t = g.to_numpy(), g.index
    nine = (t.hour == 9) & (t.minute == 0)
    ups = np.flatnonzero(dw > 0)
    gaps, hours = [], []
    for i in np.flatnonzero((dw < 0) & ~nine & (t > pd.Timestamp(start) + pd.Timedelta(hours=9))):
        j = ups[np.searchsorted(ups, i, side="right")] if np.searchsorted(ups, i, side="right") < len(ups) else None
        if j is not None:
            gaps.append(px[j] / px[i] - 1)
            hours.append((t[j] - t[i]).total_seconds() / 3600)
    if not gaps:
        return {"장중 매도": 0}
    return {"장중 매도": len(gaps), "더 비싸게 다시 삼": float(np.mean(np.array(gaps) > 0)), "가격 차 중앙값": float(np.median(gaps)), "다시 살 때까지 시간 중앙값": float(np.median(hours))}


def main():
    G = {s: grid(s) for s in SYMS}
    out = {"made": datetime.now().isoformat(timespec="seconds"), "rows": {}}
    for name, sell in STEPS.items():
        W = {s: weight(g, sell) for s, g in G.items()}
        row = {}
        for sn, start in STARTS.items():
            row[sn] = {}
            for cn, cost in COSTS.items():
                parts, orders = [], 0
                for s in SYMS:
                    g, w = G[s], W[s]
                    r = (w.shift() * g.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
                    m = r.index > pd.Timestamp(start) + pd.Timedelta(hours=9)
                    parts.append(r[m])
                    orders += int((w.diff().abs() > 0)[m].sum())
                eq = (1 + pd.concat(parts, axis=1).fillna(0.0).mean(axis=1)).cumprod()
                d = eq[(eq.index.hour == 9) & (eq.index.minute == 0)]
                rd = d.pct_change().dropna()
                row[sn][cn] = {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(rd.mean() / rd.std() * np.sqrt(365)), "MDD": float((d / d.cummax() - 1).min()),
                               "연 주문": orders / ((eq.index[-1] - eq.index[0]).days / 365)}
        if sell:
            row["진단"] = {s: rebuys(G[s], W[s], STARTS["2020~"]) for s in SYMS}
        out["rows"][name] = row
    base = out["rows"][BASE]
    for name, r in out["rows"].items():
        if name in (OLD, BASE):
            continue
        crit = {"샤프 > 지금 봇 (두 구간)": all(r[sn]["0.10%"]["샤프"] > base[sn]["0.10%"]["샤프"] for sn in STARTS),
                "MDD 나쁘지 않음": all(r[sn]["0.10%"]["MDD"] >= base[sn]["0.10%"]["MDD"] for sn in STARTS),
                "0.25% 에서도": all(r[sn]["0.25%"]["샤프"] > base[sn]["0.25%"]["샤프"] for sn in STARTS)}
        r["판정"], r["통과"] = crit, all(crit.values())
    (C.OUT / "fastsell.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for sn in STARTS:
        print(f"== {sn} {END} 까지 · 100만원 · 편도 0.10% (0.25%)")
        for name, r in out["rows"].items():
            a, h = r[sn]["0.10%"], r[sn]["0.25%"]
            print(f"   {name:22s} 잔고 {a['잔고'] / 1e4:6,.0f}만 ({h['잔고'] / 1e4:6,.0f}만) 샤프 {a['샤프']:.2f} ({h['샤프']:.2f}) MDD {a['MDD'] * 100:5.1f}% 연 주문 {a['연 주문']:4.0f}회 {'통과' if r.get('통과') else ('기각' if '통과' in r else '')}")
    print("== 진단(2020~, 판정 아님): 장중에 줄인 뒤 다음에 늘릴 때 — 횟수 · 판 가격보다 비싸게 다시 산 비율 · 가격 차 중앙값 · 다시 살 때까지 시간 중앙값")
    for name, r in out["rows"].items():
        if "진단" in r:
            print(f"   {name:6s} " + " | ".join(f"{s} {v['장중 매도']}회 · {v['더 비싸게 다시 삼'] * 100:.0f}% · {v['가격 차 중앙값'] * 100:+.2f}% · {v['다시 살 때까지 시간 중앙값']:.0f}시간" for s, v in r["진단"].items()))


if __name__ == "__main__":
    main()
