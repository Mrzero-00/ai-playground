"""판단 시간 창 (RESEARCH.md '판단 시간 창'). 거래는 하루 한 번 그대로, 판단에 쓰는 가격만 바꾼다:
V0 09:00 가격 하나(지금) · V1 10:00 가격 하나 · V2 08~10시 다섯 가격의 평균 · V3 다섯 시각 다수결. 업비트 30분봉.
사용법: python3 scripts/lab/window.py   → data/lab/window.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C

SYMS, END, SEED = ["BTC", "ETH"], "2026-11-22", 1_000_000
TIMES = ["08:00", "08:30", "09:00", "09:30", "10:00"]
MAS = (20, 50, 100, 200)
COSTS = {"0.10%": 0.001, "0.25%": 0.0025}
STARTS = {"2020~": "2020-01-01", "2023~": "2023-01-01"}
NAMES = {"V0": "09:00 가격 하나 (지금 방식)", "V1": "10:00 가격 하나 (시각만 옮김)", "V2": "08~10시 다섯 가격 평균으로 판단", "V3": "08~10시 다섯 시각 다수결로 판단"}


def points(sym):
    """날짜(한국 시각) × 시각 가격표. 시각 T 의 가격 = T 에 끝나는 30분봉 종가(거래가 없던 봉은 직전 값)."""
    c = pd.read_csv(C.ML / f"upbit30m_{sym}.csv", parse_dates=["time"], index_col="time").close.astype(float)
    c = c.reindex(pd.date_range(c.index[0], c.index[-1], freq="30min")).ffill()
    c.index = c.index + pd.Timedelta(minutes=30)
    cols = {}
    for t in TIMES:
        s = c[c.index.strftime("%H:%M") == t]
        s.index = s.index.normalize()
        cols[t] = s
    p = pd.DataFrame(cols).dropna()
    return p[p.index <= END]


def weight(p):
    return sum((p > p.rolling(n).mean()).astype(float) for n in MAS) / len(MAS)


def variants(pts):
    """규칙마다 (비중, 체결 가격)."""
    vote = sum(sum((pts[t] > pts[t].rolling(n).mean()).astype(int) for t in TIMES).ge(3).astype(float) for n in MAS) / len(MAS)
    return {"V0": (weight(pts["09:00"]), pts["09:00"]), "V1": (weight(pts["10:00"]), pts["10:00"]),
            "V2": (weight(pts.mean(axis=1)), pts["10:00"]), "V3": (vote, pts["10:00"])}


def stats(r):
    eq = (1 + r).cumprod()
    return {"잔고": float(SEED * eq.iloc[-1]), "연": float(eq.iloc[-1] ** (365 / len(r)) - 1), "샤프": float(r.mean() / r.std() * np.sqrt(365)), "MDD": float((eq / eq.cummax() - 1).min())}


def main():
    P = {s: points(s) for s in SYMS}
    V = {s: variants(p) for s, p in P.items()}
    out = {"made": datetime.now().isoformat(timespec="seconds"), "names": NAMES, "rows": {}, "window": [str(P["BTC"].index[0].date()), END]}
    for k in NAMES:
        row = {}
        for sn, start in STARTS.items():
            row[sn] = {}
            for cn, cost in COSTS.items():
                parts, orders = [], 0
                for s in SYMS:
                    w, px = V[s][k]
                    r = (w.shift() * px.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
                    m = r.index >= start
                    parts.append(r[m])
                    orders += int((w.diff().abs() > 0)[m].sum())
                port = pd.concat(parts, axis=1).fillna(0.0).mean(axis=1)
                row[sn][cn] = {**stats(port), "주문": orders, "연 주문": orders / (len(port) / 365)}
            diff = [float((V[s][k][0] != V[s]["V0"][0])[V[s][k][0].index >= start].mean()) for s in SYMS]
            row[sn]["V0 와 다른 날"] = float(np.mean(diff))
        out["rows"][k] = row
    for k in ("V2", "V3"):
        r, v0, v1 = out["rows"][k], out["rows"]["V0"], out["rows"]["V1"]
        crit = {"샤프 > V0 (두 구간)": all(r[sn]["0.10%"]["샤프"] > v0[sn]["0.10%"]["샤프"] for sn in STARTS),
                "MDD 나쁘지 않음": all(r[sn]["0.10%"]["MDD"] >= v0[sn]["0.10%"]["MDD"] for sn in STARTS),
                "0.25% 에서도": all(r[sn]["0.25%"]["샤프"] > v0[sn]["0.25%"]["샤프"] for sn in STARTS),
                "샤프 > V1": all(r[sn]["0.10%"]["샤프"] > v1[sn]["0.10%"]["샤프"] for sn in STARTS)}
        r["판정"], r["통과"] = crit, all(crit.values())
    (C.OUT / "window.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for sn in STARTS:
        print(f"== {sn} {END} 까지 · 100만원 · 편도 0.10% (0.25%)")
        for k, nm in NAMES.items():
            a, h = out["rows"][k][sn]["0.10%"], out["rows"][k][sn]["0.25%"]
            print(f"   {k} {nm:26s} 잔고 {a['잔고'] / 1e4:6,.0f}만 ({h['잔고'] / 1e4:6,.0f}만) 샤프 {a['샤프']:.2f} ({h['샤프']:.2f}) MDD {a['MDD'] * 100:4.0f}% 연 주문 {a['연 주문']:4.0f}회 · V0 와 다른 날 {out['rows'][k][sn]['V0 와 다른 날'] * 100:.0f}%")
    for k in ("V2", "V3"):
        print(k, "판정", out["rows"][k]["판정"], "→", "통과" if out["rows"][k]["통과"] else "기각")


if __name__ == "__main__":
    main()
