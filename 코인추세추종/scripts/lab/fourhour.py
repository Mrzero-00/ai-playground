"""4시간마다 확인 (RESEARCH.md '4시간마다 확인'). 업비트 30분봉에서 01·05·09·13·17·21시(한국 시각) 가격.
W0 09:00 에만(지금) · W1 4시간마다 같은 기간 · W2 4시간 빠른판 · W3 줄일 때만 4시간마다 · W4 늘릴 때만 4시간마다.
사용법: python3 scripts/lab/fourhour.py   → data/lab/fourhour.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C

SYMS, END, SEED = ["BTC", "ETH"], "2026-11-22", 1_000_000
HOURS = [1, 5, 9, 13, 17, 21]
MAS = (20, 50, 100, 200)
COSTS = {"0.10%": 0.001, "0.25%": 0.0025}
STARTS = {"2020~": "2020-01-01", "2023~": "2023-01-01"}
NAMES = {"W0": "09:00 에만 (지금 방식)", "W1": "4시간마다, 같은 기간(20~200일)", "W2": "4시간 빠른판 (4시간 가격 20~200개)",
         "W3": "줄일 때만 4시간마다", "W4": "늘릴 때만 4시간마다"}


def grid(sym):
    c = pd.read_csv(C.ML / f"upbit30m_{sym}.csv", parse_dates=["time"], index_col="time").close.astype(float)
    c = c.reindex(pd.date_range(c.index[0], c.index[-1], freq="30min")).ffill()
    c.index = c.index + pd.Timedelta(minutes=30)  # 봉이 끝나는 시각
    g = c[(c.index.minute == 0) & c.index.hour.isin(HOURS)]
    return g[g.index <= pd.Timestamp(END) + pd.Timedelta(hours=33)]  # END 다음 날 09:00 까지


def weights(g):
    w1 = sum((g > g.rolling(6 * n).mean()).astype(float) for n in MAS) / len(MAS)
    w2 = sum((g > g.rolling(n).mean()).astype(float) for n in MAS) / len(MAS)
    d = g[g.index.hour == 9]
    wd = (sum((d > d.rolling(n).mean()).astype(float) for n in MAS) / len(MAS)).reindex(g.index)
    w0 = wd.ffill().fillna(0.0)
    nine, a, b = (g.index.hour == 9), w1.to_numpy(), wd.to_numpy()
    w3, w4, x3, x4 = np.zeros(len(g)), np.zeros(len(g)), 0.0, 0.0
    for i in range(len(g)):
        if nine[i]:
            x3 = x4 = b[i]
        else:
            x3, x4 = min(x3, a[i]), max(x4, a[i])
        w3[i], w4[i] = x3, x4
    return {"W0": w0, "W1": w1, "W2": w2, "W3": pd.Series(w3, index=g.index), "W4": pd.Series(w4, index=g.index)}


def stats(eq):
    d = eq[eq.index.hour == 9]
    r = d.pct_change().dropna()
    return {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(r.mean() / r.std() * np.sqrt(365)), "MDD": float((d / d.cummax() - 1).min())}


def main():
    G = {s: grid(s) for s in SYMS}
    W = {s: weights(g) for s, g in G.items()}
    out = {"made": datetime.now().isoformat(timespec="seconds"), "names": NAMES, "rows": {}}
    for k in NAMES:
        row = {}
        for sn, start in STARTS.items():
            row[sn] = {}
            for cn, cost in COSTS.items():
                parts, orders = [], 0
                for s in SYMS:
                    g, w = G[s], W[s][k]
                    r = (w.shift() * g.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
                    m = r.index > pd.Timestamp(start) + pd.Timedelta(hours=9)  # 시작일 09:00 뒤부터
                    parts.append(r[m])
                    orders += int((w.diff().abs() > 0)[m].sum())
                port = pd.concat(parts, axis=1).fillna(0.0).mean(axis=1)
                eq = (1 + port).cumprod()
                row[sn][cn] = {**stats(eq), "연 주문": orders / ((eq.index[-1] - eq.index[0]).days / 365)}
        out["rows"][k] = row
    for k in ("W1", "W2", "W3", "W4"):
        r, b = out["rows"][k], out["rows"]["W0"]
        crit = {"샤프 > W0 (두 구간)": all(r[sn]["0.10%"]["샤프"] > b[sn]["0.10%"]["샤프"] for sn in STARTS),
                "MDD 나쁘지 않음": all(r[sn]["0.10%"]["MDD"] >= b[sn]["0.10%"]["MDD"] for sn in STARTS),
                "0.25% 에서도": all(r[sn]["0.25%"]["샤프"] > b[sn]["0.25%"]["샤프"] for sn in STARTS)}
        r["판정"], r["통과"] = crit, all(crit.values())
    (C.OUT / "fourhour.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for sn in STARTS:
        print(f"== {sn} {END} 까지 · 100만원 · 편도 0.10% (0.25%)")
        for k, nm in NAMES.items():
            a, h = out["rows"][k][sn]["0.10%"], out["rows"][k][sn]["0.25%"]
            print(f"   {k} {nm:28s} 잔고 {a['잔고'] / 1e4:6,.0f}만 ({h['잔고'] / 1e4:6,.0f}만) 샤프 {a['샤프']:.2f} ({h['샤프']:.2f}) MDD {a['MDD'] * 100:4.0f}% 연 주문 {a['연 주문']:4.0f}회")
    for k in ("W1", "W2", "W3", "W4"):
        print(k, "판정", out["rows"][k]["판정"], "→", "통과" if out["rows"][k]["통과"] else "기각")


if __name__ == "__main__":
    main()
