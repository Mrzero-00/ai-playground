"""2단계 9차(참고용): BTC·ETH 페어 트레이딩 (RESEARCH.md 9차 등록). 바이낸스 무기한 일봉, 봉인 구간은 읽지 않는다.
스프레드 = ln ETH − β ln BTC 의 z 점수로 열고, z 가 0 을 지나면 닫는다. 두 마켓 ±1(달러 중립).
"""
import itertools

import numpy as np
import pandas as pd

from common import SYMBOLS, combine, day_codes, days, perp, positions, to_daily
from indicators import machine

NAME = "BTC·ETH 페어 트레이딩"
SOURCES = ["Gatev·Goetzmann·Rouwenhorst (2006, Review of Financial Studies) Pairs Trading — 2σ 에 열고 수렴에 닫는다",
           "Engle·Granger (1987) 공적분 — OLS 헤지 비율",
           "Fil·Kristoufek (2020, IEEE Access) Pairs Trading in Cryptocurrency Markets — 일 단위 평균회귀는 약하다"]
GRID = dict(tf=["1d"], mode=["선물 롱숏"], W=[30, 90, 180, 365], th=[1.0, 1.5, 2.0], beta=["1", "OLS"])
DEFAULT = dict(tf="1d", mode="선물 롱숏", W=365, th=2.0, beta="OLS")
UNITS = [{"name": "선물 롱숏", "bench": "F0", "where": (lambda c: c["mode"] == "선물 롱숏")}]
CHUNK = None


def default(unit):
    return dict(DEFAULT)


def tasks():
    return ["perp"]


def zscore(le, lb, W, beta):
    """지난 W 일로 β 와 스프레드 평균·표준편차를 잡는다 (t 일 종가까지)."""
    me, mb = le.rolling(W).mean(), lb.rolling(W).mean()
    ve, vb, cv = le.rolling(W).var(), lb.rolling(W).var(), le.rolling(W).cov(lb)
    b = 1.0 if beta == "1" else cv / vb
    sd = np.sqrt((ve - 2 * b * cv + b * b * vb).clip(lower=0))
    return (le - b * lb - (me - b * mb)) / sd.where(sd > 0)


def task(market):
    n = len(days())
    data = {s: perp(s, "1d") for s in SYMBOLS}
    btc, eth = SYMBOLS if SYMBOLS[0] == "BTC" else SYMBOLS[::-1]
    idx = data[btc].index.intersection(data[eth].index)
    lb, le = np.log(data[btc].close.reindex(idx)), np.log(data[eth].close.reindex(idx))
    cfgs, G, T, N = [], [], [], []
    for W, th, beta in itertools.product(GRID["W"], GRID["th"], GRID["beta"]):
        z = zscore(le, lb, W, beta).to_numpy()
        with np.errstate(invalid="ignore"):
            spread = machine(len(z), z < -th, z > th, z >= 0, z <= 0)  # +1 = ETH 롱·BTC 숏
        tg = {eth: spread, btc: -spread}
        per = [to_daily(day_codes(d.index), n, *positions(d, pd.Series(tg[s], index=idx).reindex(d.index).fillna(0.0))) for s, d in data.items()]
        g, t, c = combine(per)
        cfgs.append(dict(tf="1d", mode="선물 롱숏", W=W, th=th, beta=beta))
        G.append(g), T.append(t), N.append(c)
    return cfgs, np.array(G), np.array(T), np.array(N)
