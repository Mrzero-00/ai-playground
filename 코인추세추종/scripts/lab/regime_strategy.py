"""장별 매매 전략 1차 (RESEARCH.md '장별 매매 전략 1차 등록'). 장 판별은 잠정 채택 판별법(루프 2 25회차).
BTC·ETH 반반, Coin Metrics 일별 종가, 종가로만 체결·손절. 세 기간을 따로 잰다.
사용법: python3 scripts/lab/regime_strategy.py   → data/lab/regime_strategy.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from indicators import rsi, sma
from regime import WARM
from regime_loop2 import SYMS, chain, ens, iter25, load

PERIODS = {"2011~2017": ("2010-01-01", "2017-12-31"), "2018~2021": ("2018-01-01", "2021-12-31"), "2022~2026": ("2022-01-01", "2026-11-22")}
COSTS = {"0.10%": 0.001, "0.25%": 0.0025}
NAMES = {"S1": "장만 따르기", "S2": "상승장 앙상블", "S3": "상승장 보유 + 과열이면 절반", "S4": "상승장 보유 + 하락장 반등 단타",
         "S5": "상승장 롱 · 하락장 숏 (참고)", "S6": "상승장 롱 · 하락장 반 숏 (참고)", "봇": "현물 봇 (기준)", "보유": "그냥 보유"}


def regime(c):
    return iter25(c)["반감기 달력(+12 ~ +30개월)으로 문턱 당김"]


def rebound(c, reg):
    """하락장에서만: RSI(2) < 10 진입, 종가 > 5일선 청산, 종가 ≤ 진입가 × 0.95 손절."""
    x, r2, m5 = c.to_numpy(), rsi(c, 2).to_numpy(), sma(c, 5).to_numpy()
    pos, entry, out = 0, 0.0, np.zeros(len(x))
    for i in range(len(x)):
        if reg[i] != -1:
            pos = 0
        elif pos:
            if x[i] > m5[i] or x[i] <= entry * 0.95:
                pos = 0
        elif r2[i] < 10:
            pos, entry = 1, x[i]
        out[i] = pos
    return out


def positions(c, sym):
    reg = regime(c)
    up = (reg == 1).astype(float)
    w = ens(c).to_numpy()
    ch = chain(sym)
    mv = ch.CapMVRVCur.reindex(c.index).ffill().to_numpy()
    mm = (c / sma(c, 200)).to_numpy()
    with np.errstate(invalid="ignore"):
        hot = (mv >= 3.5) | (mm >= 2.4)
    return {"S1": up, "S2": up * w, "S3": up * np.where(hot, 0.5, 1.0), "S4": np.where(reg == 1, 1.0, rebound(c, reg)),
            "S5": np.where(reg == 1, 1.0, np.where(reg == -1, -1.0, 0.0)), "S6": np.where(reg == 1, 1.0, np.where(reg == -1, -0.5, 0.0)),
            "봇": w, "보유": np.ones(len(c))}


def daily(c, pos, cost):
    p = pd.Series(pos, index=c.index)
    return (p.shift() * c.pct_change() - cost * p.diff().abs().shift().fillna(0)).fillna(0)


def stats(ret):
    if len(ret) < 60:
        return None
    eq = (1 + ret).cumprod()
    sd = ret.std()
    return {"샤프": float(ret.mean() / sd * np.sqrt(365)) if sd > 0 else 0.0, "연복리": float(eq.iloc[-1] ** (365 / len(ret)) - 1), "MDD": float((eq / eq.cummax() - 1).min())}


def main():
    rets = {cn: {k: {} for k in NAMES} for cn in COSTS}
    trades = {k: {p: 0 for p in PERIODS} for k in NAMES}
    exposure = {k: {p: [] for p in PERIODS} for k in NAMES}
    for s in SYMS:
        c = load(s).close
        ok = np.arange(len(c)) >= WARM
        pos = positions(c, s)
        for k, p in pos.items():
            for cn, cost in COSTS.items():
                rets[cn][k][s] = daily(c, p, cost)[ok]
            changes = pd.Series(p, index=c.index).diff().abs().gt(0)
            for pn, (a, b) in PERIODS.items():
                m = ok & np.asarray((c.index >= a) & (c.index <= b))
                trades[k][pn] += int(changes[m].sum())
                if m.any():
                    exposure[k][pn].append(float(np.abs(np.asarray(p)[m]).mean()))
    out = {"made": datetime.now().isoformat(timespec="seconds"), "names": NAMES, "periods": {}}
    for pn, (a, b) in PERIODS.items():
        out["periods"][pn] = {}
        for k in NAMES:
            row = {}
            for cn in COSTS:
                parts = [r[(r.index >= a) & (r.index <= b)] for r in rets[cn][k].values()]
                parts = [q for q in parts if len(q)]
                port = pd.concat(parts, axis=1).fillna(0).mean(axis=1) if len(parts) > 1 else parts[0]  # 있는 코인끼리 반반
                row[cn] = stats(port)
            row["거래"] = trades[k][pn]
            row["보유 비중"] = float(np.mean(exposure[k][pn])) if exposure[k][pn] else None
            out["periods"][pn][k] = row
    verdict = {}
    for k in ("S1", "S2", "S3", "S4", "S5", "S6"):
        ok_all = True
        for pn in PERIODS:
            r, b = out["periods"][pn][k], out["periods"][pn]["봇"]
            ok_all &= r["0.10%"]["샤프"] > b["0.10%"]["샤프"] and r["0.10%"]["MDD"] >= b["0.10%"]["MDD"] - 0.05 and r["0.25%"]["샤프"] > b["0.25%"]["샤프"]
        ok_all &= sum(trades[k].values()) >= 30
        verdict[k] = bool(ok_all)
    out["판정"] = verdict
    (C.OUT / "regime_strategy.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for pn in PERIODS:
        print(f"== {pn} (편도 0.10%, 0.25% 샤프)")
        for k, nm in NAMES.items():
            r = out["periods"][pn][k]
            a, h = r["0.10%"], r["0.25%"]
            print(f"   {k:3s} {nm:24s} 연 {a['연복리'] * 100:+6.0f}% 샤프 {a['샤프']:5.2f} MDD {a['MDD'] * 100:5.0f}% | 0.25% {h['샤프']:5.2f} | 거래 {r['거래']:4d} 보유 {r['보유 비중'] * 100:3.0f}%")
    print("판정(세 기간 모두 현물 봇보다 나음):", {k: ("통과" if v else "-") for k, v in verdict.items()})


if __name__ == "__main__":
    main()
