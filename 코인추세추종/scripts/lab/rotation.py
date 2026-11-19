"""2단계 6차(참고용): BTC↔ETH 상대 모멘텀·듀얼 모멘텀 (RESEARCH.md 6차 등록). 일봉, 봉인 구간은 읽지 않는다.
두 마켓을 반씩 굴리는 틀이라, 자금 전부를 한쪽에 두면 그 마켓 포지션이 2 다.
"""
import itertools

import numpy as np
import pandas as pd

from common import SYMBOLS, combine, day_codes, days, perp, positions, to_daily, upbit

NAME = "BTC↔ETH 상대 모멘텀"
SOURCES = ["Liu·Tsyvinski·Wu (2022, Journal of Finance) Common Risk Factors in Cryptocurrency — 모멘텀 1~4주",
           "Gary Antonacci, Dual Momentum Investing (2014) — 12개월 상대 + 절대 모멘텀"]
MODES = ["선물 롱숏", "선물 롱만", "현물 롱만"]
GRID = dict(tf=["1d"], mode=MODES, L=[7, 14, 21, 28, 56, 91, 182, 365], filt=["없음", "절대"])
DEFAULT = dict(tf="1d", mode="선물 롱숏", L=21, filt="없음")
UNITS = [{"name": m, "bench": "현물봇" if m == "현물 롱만" else "F0", "where": (lambda c, m=m: c["mode"] == m)} for m in MODES]
CHUNK = None


def default(unit):
    return {**DEFAULT, "mode": unit["name"]}


def tasks():
    return ["perp", "spot"]


def targets(closes, L, filt, mode):
    """마켓별 목표 포지션. closes = {sym: 종가}, 같은 날짜 인덱스."""
    ret = pd.DataFrame({s: c / c.shift(L) - 1 for s, c in closes.items()})
    ok = ret.notna().all(axis=1)
    win = ret.fillna(-np.inf).idxmax(axis=1).where(ok)
    best = ret.max(axis=1)
    on = ok & ((best > 0) if filt == "절대" else True)
    out = {}
    for s in closes:
        w = (win == s) & on
        lose = (win != s) & on
        out[s] = (w.astype(float) - lose.astype(float)) if mode == "선물 롱숏" else 2.0 * w.astype(float)
    return out


def task(market):
    n = len(days())
    data = {s: (perp(s, "1d") if market == "perp" else upbit(s)) for s in SYMBOLS}
    idx = data[SYMBOLS[0]].index.intersection(data[SYMBOLS[1]].index)
    closes = {s: d.close.reindex(idx) for s, d in data.items()}
    modes = ["선물 롱숏", "선물 롱만"] if market == "perp" else ["현물 롱만"]
    cfgs, G, T, N = [], [], [], []
    for L, filt, mode in itertools.product(GRID["L"], GRID["filt"], modes):
        tg = targets(closes, L, filt, mode)
        per = [to_daily(day_codes(d.index), n, *positions(d, tg[s].reindex(d.index).fillna(0.0), funding=market == "perp")) for s, d in data.items()]
        g, t, c = combine(per)
        cfgs.append(dict(tf="1d", mode=mode, L=L, filt=filt))
        G.append(g), T.append(t), N.append(c)
    return cfgs, np.array(G), np.array(T), np.array(N)
