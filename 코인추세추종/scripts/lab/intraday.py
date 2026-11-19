"""2단계 6차(참고용): 시간대 효과 (RESEARCH.md 6차 등록). 바이낸스 무기한 1시간봉, 봉인 구간은 읽지 않는다."""
import itertools

import numpy as np
import pandas as pd

from common import SYMBOLS, combine, day_codes, days, perp, positions, to_daily

NAME = "시간대 효과"
SOURCES = ["Quantpedia, Are There Seasonal Intraday or Overnight Anomalies in Bitcoin? — 21:00 UTC 에 사서 23:00 에 판다", "Quantpedia — 금요일이 가장 좋다"]
GRID = dict(tf=["1h"], h=[20, 21, 22, 23], L=[1, 2, 3], day=["매일", "금요일만"])
DEFAULT = dict(tf="1h", h=21, L=2, day="매일")
UNITS = [{"name": "선물 롱만", "bench": "F0", "where": None}]
CHUNK = None


def default(unit):
    return DEFAULT


def tasks():
    return GRID["h"]


def signal(index, h, L, day):
    """봉 t 종가에 다음 봉(t+1)을 들지 정한다: 다음 봉이 h 시부터 L 시간 창 안이면 1."""
    nxt = index + pd.Timedelta(hours=1)
    off = (nxt.hour - h) % 24  # 창 시작에서 몇 시간 지났나
    ok = off < L
    if day == "금요일만":
        ok &= (nxt - pd.to_timedelta(off, unit="h")).dayofweek == 4
    return pd.Series(ok.astype(float), index=index)


def task(h):
    n = len(days())
    data = [perp(s, "1h") for s in SYMBOLS]
    cfgs, G, T, N = [], [], [], []
    for L, day in itertools.product(GRID["L"], GRID["day"]):
        g, t, c = combine([to_daily(day_codes(d.index), n, *positions(d, signal(d.index, h, L, day))) for d in data])
        cfgs.append(dict(tf="1h", h=h, L=L, day=day))
        G.append(g), T.append(t), N.append(c)
    return cfgs, np.array(G), np.array(T), np.array(N)
