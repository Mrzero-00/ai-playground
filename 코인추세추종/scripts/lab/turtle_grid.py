"""터틀식 손절 — 값 바꿔 보기 (RESEARCH.md '터틀식 손절 — 값 바꿔 보기'). 가격 ≤ 평균 매수가 − k × ATR(n일)이면 전부 판다.
배수 k 1~4 × ATR 기간 10·20·40일 × 다시 사는 규칙 R1·R2, 그리고 2배·20일에서 확인 간격 30분·1시간·4시간.
가장 좋은 값을 고르려는 것이 아니라 2배·20일의 이웃이 받쳐 주는지 본다.
사용법: python3 scripts/lab/turtle_grid.py   → data/lab/turtle_grid.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from fastbuy import COSTS, END, SEED, STARTS, SYMS
from stoploss import BASE, REENTRY, measure, prep, simulate

KS, NS = (1, 1.5, 2, 2.5, 3, 4), (10, 20, 40)
STEPS = {"1시간": 60, "4시간": 240}  # 2배·20일에서만. 나머지는 30분
FRESH = "2026-01-01"  # 덧붙임: 이날 100만원을 새로 넣었다면 (사용자 요청, 판정 아님)
NEAR = [(k, n) for k in (1.5, 2, 2.5) for n in NS if (k, n) != (2, 20)]  # 2배·20일의 이웃 8칸


def key(k, n, re, step="30분"):
    return f"{k:g}배 · ATR {n}일 · {re}" + ("" if step == "30분" else f" · {step}마다")


def fresh(G, args, day=FRESH):
    """덧붙임(판정 아님): day 09:00 에 100만원을 새로 넣고 봇을 켰을 때의 마지막 잔고. 그 앞의 포지션은 없다고 본다."""
    t0, out = pd.Timestamp(day) + pd.Timedelta(hours=9), {}
    W = {s: simulate(G[s], *args, start=int(np.searchsorted(G[s]["g"].index, t0)))[0] for s in SYMS}
    for cn, cost in COSTS.items():
        parts = []
        for s in SYMS:
            g, w = G[s]["g"], W[s]
            r = (w.shift() * g.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
            parts.append(r[r.index > t0])
        out[cn] = float(SEED * (1 + pd.concat(parts, axis=1).fillna(0.0).mean(axis=1)).prod())
    out["끝 비중"] = {s: float(W[s].iloc[-1]) for s in SYMS}
    return out


def main():
    G = {s: prep(s) for s in SYMS}
    out = {"made": datetime.now().isoformat(timespec="seconds"), "rows": {}}
    out["rows"][BASE] = measure(G, {s: simulate(G[s]) for s in SYMS})
    out["rows"][BASE][FRESH] = fresh(G, ())
    t0 = pd.Timestamp(FRESH) + pd.Timedelta(hours=9)
    out["보유 " + FRESH] = float(SEED * np.mean([G[s]["g"].iloc[-1] / G[s]["g"][t0] for s in SYMS]))
    for re in REENTRY:
        for n in NS:
            for k in KS:
                row = measure(G, {s: simulate(G[s], "C1", k, f"atr{n}", re) for s in SYMS})
                row.update({"배수": k, "기간": n, "다시": re, "간격": "30분"})
                row[FRESH] = fresh(G, ("C1", k, f"atr{n}", re))
                out["rows"][key(k, n, re)] = row
        for sn, step in STEPS.items():
            row = measure(G, {s: simulate(G[s], "C1", 2, "atr20", re, step) for s in SYMS})
            row.update({"배수": 2, "기간": 20, "다시": re, "간격": sn})
            row[FRESH] = fresh(G, ("C1", 2, "atr20", re, step))
            out["rows"][key(2, 20, re, sn)] = row
    base = out["rows"][BASE]
    for name, r in out["rows"].items():
        if name == BASE:
            continue
        crit = {"샤프 > 지금 봇 (두 구간)": all(r[sn]["0.10%"]["샤프"] > base[sn]["0.10%"]["샤프"] for sn in STARTS),
                "MDD 나쁘지 않음": all(r[sn]["0.10%"]["MDD"] >= base[sn]["0.10%"]["MDD"] for sn in STARTS),
                "0.25% 에서도": all(r[sn]["0.25%"]["샤프"] > base[sn]["0.25%"]["샤프"] for sn in STARTS)}
        r["판정"], r["통과"] = crit, all(crit.values())
    out["이웃"] = {re: {"통과": sum(out["rows"][key(k, n, re)]["통과"] for k, n in NEAR), "칸": len(NEAR)} for re in REENTRY}
    out["전체"] = {re: {"통과": sum(r["통과"] for r in out["rows"].values() if r.get("다시") == re and r["간격"] == "30분"), "칸": len(KS) * len(NS)} for re in REENTRY}
    (C.OUT / "turtle_grid.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))

    def line(name, r):
        a, h, b, bh = r["2020~"]["0.10%"], r["2020~"]["0.25%"], r["2023~"]["0.10%"], r["2023~"]["0.25%"]
        d = r["진단"]
        return (f"   {name:30s} 잔고 {a['잔고'] / 1e4:6,.0f}만 ({h['잔고'] / 1e4:6,.0f}만) 샤프 {a['샤프']:.2f} ({h['샤프']:.2f}) MDD {a['MDD'] * 100:5.1f}% 주문 {a['연 주문']:3.0f}"
                f" | {b['잔고'] / 1e4:4,.0f}만 ({bh['잔고'] / 1e4:4,.0f}만) {b['샤프']:.2f} ({bh['샤프']:.2f}) {b['MDD'] * 100:5.1f}%"
                f" | 최악 {r['폭락']['하루 최악'] * 100:5.1f}% 손절 {d['손절']:3d}회 | {FRESH[:4]}~ {r[FRESH]['0.10%'] / 1e4:6.1f}만 ({r[FRESH]['0.25%'] / 1e4:6.1f}만) {'통과' if r.get('통과') else ('기각' if '통과' in r else '')}")

    print(f"== {END} 까지 · 100만원 · 2020~ 잔고 0.10% (0.25%) · 샤프 · MDD · 연 주문 | 2023~ 잔고 · 샤프 · MDD | 하루 최악 · 손절 횟수(2020~) | {FRESH} 에 새로 넣었다면")
    for name, r in out["rows"].items():
        print(line(name, r))
    print(f"{FRESH} 09:00 에 100만원을 BTC·ETH 반반으로 사서 들고만 있었다면: {out['보유 ' + FRESH] / 1e4:.1f}만원 · 끝 비중(지금 봇) {out['rows'][BASE][FRESH]['끝 비중']}")
    for re in REENTRY:
        print(f"{re}: 2배·20일의 이웃 8칸 중 통과 {out['이웃'][re]['통과']}칸 · 30분 18칸 중 통과 {out['전체'][re]['통과']}칸")


if __name__ == "__main__":
    main()
