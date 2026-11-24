"""살 때만 빠르게 — 확인 간격 (RESEARCH.md '살 때만 빠르게'). 09:00 에는 지금 방식대로, 그 사이에는 확인 시각마다 늘리기만.
간격 12시간·4시간·2시간·1시간·30분. 업비트 30분봉, 수익은 30분 격자.
사용법: python3 scripts/lab/fastbuy.py   → data/lab/fastbuy.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C

SYMS, END, SEED = ["BTC", "ETH"], "2026-11-22", 1_000_000
MAS = (20, 50, 100, 200)
COSTS = {"0.10%": 0.001, "0.25%": 0.0025}
STARTS = {"2020~": "2020-01-01", "2023~": "2023-01-01"}
STEPS = {"09:00 에만 (지금 방식)": None, "12시간": 720, "4시간": 240, "2시간": 120, "1시간": 60, "30분": 30}


def grid(sym):
    c = pd.read_csv(C.ML / f"upbit30m_{sym}.csv", parse_dates=["time"], index_col="time").close.astype(float)
    c = c.reindex(pd.date_range(c.index[0], c.index[-1], freq="30min")).ffill()
    c.index = c.index + pd.Timedelta(minutes=30)
    return c[c.index <= pd.Timestamp(END) + pd.Timedelta(hours=33)]


def weight(g, step):
    """30분 격자의 비중. step 분마다(09:00 기준) 늘리기만, 09:00 에는 일 단위 판단으로 맞춘다."""
    mins = (g.index.hour * 60 + g.index.minute - 540) % 1440
    nine = mins == 0
    d = g[nine]
    wd = (sum((d > d.rolling(n).mean()).astype(float) for n in MAS) / len(MAS)).reindex(g.index).to_numpy()
    if step is None:
        return pd.Series(wd, index=g.index).ffill().fillna(0.0)
    s = g[mins % step == 0]
    per = 1440 // step
    ws = (sum((s > s.rolling(n * per).mean()).astype(float) for n in MAS) / len(MAS)).reindex(g.index).to_numpy()
    out, x = np.zeros(len(g)), 0.0
    for i in range(len(g)):
        if nine[i]:
            x = wd[i]
        elif not np.isnan(ws[i]):
            x = max(x, ws[i])
        out[i] = x
    return pd.Series(out, index=g.index)


def main():
    G = {s: grid(s) for s in SYMS}
    out = {"made": datetime.now().isoformat(timespec="seconds"), "rows": {}}
    for name, step in STEPS.items():
        W = {s: weight(g, step) for s, g in G.items()}
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
        out["rows"][name] = row
    base = out["rows"]["09:00 에만 (지금 방식)"]
    for name, r in out["rows"].items():
        if r is base:
            continue
        crit = {"샤프 > 지금 (두 구간)": all(r[sn]["0.10%"]["샤프"] > base[sn]["0.10%"]["샤프"] for sn in STARTS),
                "MDD 나쁘지 않음": all(r[sn]["0.10%"]["MDD"] >= base[sn]["0.10%"]["MDD"] for sn in STARTS),
                "0.25% 에서도": all(r[sn]["0.25%"]["샤프"] > base[sn]["0.25%"]["샤프"] for sn in STARTS)}
        r["판정"], r["통과"] = crit, all(crit.values())
    (C.OUT / "fastbuy.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for sn in STARTS:
        print(f"== {sn} {END} 까지 · 100만원 · 편도 0.10% (0.25%)")
        for name, r in out["rows"].items():
            a, h = r[sn]["0.10%"], r[sn]["0.25%"]
            print(f"   {name:22s} 잔고 {a['잔고'] / 1e4:6,.0f}만 ({h['잔고'] / 1e4:6,.0f}만) 샤프 {a['샤프']:.2f} ({h['샤프']:.2f}) MDD {a['MDD'] * 100:4.0f}% 연 주문 {a['연 주문']:4.0f}회 {'통과' if r.get('통과') else ('기각' if '통과' in r else '')}")


if __name__ == "__main__":
    main()
