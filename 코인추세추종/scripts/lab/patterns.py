"""2단계 3차: 차트 패턴 — 쌍봉·쌍바닥, 머리어깨·역머리어깨 (RESEARCH.md 2단계 3차 등록). 바이낸스 무기한.
꼭짓점·매매 규칙은 삼각수렴(triangle_grid)과 같은 틀: 넥라인 종가 돌파에 진입, 목표 = 패턴 높이 × 배수, 손절 = 패턴 반대쪽 꼭대기, W 봉 시간 종료.
"""
import itertools

import numpy as np

from common import SYMBOLS, combine, day_codes, days, perp, to_daily
from triangle_grid import leave, pivots

NAME = "차트 패턴 (쌍봉·머리어깨)"
SOURCES = ["Bulkowski thepatternsite.com — 쌍봉·쌍바닥(Eve & Eve 등), 머리어깨·역머리어깨", "Edwards & Magee, Technical Analysis of Stock Trends — 넥라인 돌파·높이만큼 목표"]
SIG = dict(tf=["1d", "4h", "1h"], K=[3, 5], W=[30, 60, 120], tol=[0.02, 0.04])
TRADE = dict(target=[0.5, 1.0], pattern=["쌍봉·쌍바닥", "머리어깨", "둘 다"], side=["양쪽", "롱만", "숏만"])
GRID = {**SIG, **TRADE}
DEFAULT = dict(tf="1d", K=3, W=60, tol=0.04, target=1.0, pattern="둘 다", side="양쪽")
UNITS = [{"name": "선물", "bench": "F0", "where": None}]
CHUNK = "tf"


def default(unit):
    return DEFAULT


def tasks():
    return list(itertools.product(*SIG.values()))


def double(hi, lo, cl, xh, xl, t, tol, top):
    """쌍봉(top) / 쌍바닥. 마지막 두 꼭대기가 tol 안으로 같고, 사이 골이 넥라인. 봉 t 종가가 넥라인을 처음 뚫으면 신호."""
    xs, v, w = (xh, hi, lo) if top else (xl, lo, hi)
    if len(xs) < 2:
        return None
    a, b = xs[-2], xs[-1]
    p1, p2 = v[a], v[b]
    if abs(p1 - p2) / max(abs(p1), abs(p2)) > tol:
        return None
    neck = w[a:b + 1].min() if top else w[a:b + 1].max()
    peak = max(p1, p2) if top else min(p1, p2)
    height = abs(peak - neck)
    if height < 2 * tol * abs(neck):  # 골이 너무 얕으면 패턴이 아니다
        return None
    seg = cl[b + 1:t]
    if top:
        if (seg > peak).any() or (seg < neck).any() or cl[t] >= neck:
            return None
        return {"side": -1, "H": height, "stop": peak, "kind": "쌍봉·쌍바닥"}
    if (seg < peak).any() or (seg > neck).any() or cl[t] <= neck:
        return None
    return {"side": 1, "H": height, "stop": peak, "kind": "쌍봉·쌍바닥"}


def hs(hi, lo, cl, xh, xl, t, tol, top):
    """머리어깨(top) / 역머리어깨. 마지막 세 꼭대기: 가운데가 양쪽보다 tol 넘게 높고, 양 어깨는 tol 안으로 같다.
    넥라인 = 두 골을 잇는 직선. 봉 t 종가가 넥라인을 처음 뚫으면 신호. 손절 = 오른쪽 어깨."""
    xs, v, w = (xh, hi, lo) if top else (xl, lo, hi)
    if len(xs) < 3:
        return None
    l, h, r = xs[-3], xs[-2], xs[-1]
    sgn = 1 if top else -1
    if (v[h] <= max(v[l], v[r]) * (1 + tol)) if top else (v[h] >= min(v[l], v[r]) * (1 - tol)):  # 머리가 어깨보다 tol 넘게 튀어나와야 한다
        return None
    if abs(v[l] - v[r]) / abs(v[h]) > tol:
        return None
    t1 = l + (np.argmin(w[l:h + 1]) if top else np.argmax(w[l:h + 1]))
    t2 = h + (np.argmin(w[h:r + 1]) if top else np.argmax(w[h:r + 1]))
    if t2 == t1:
        return None
    slope = (w[t2] - w[t1]) / (t2 - t1)
    neck = lambda i: w[t1] + slope * (i - t1)
    j = np.arange(r + 1, t)
    seg = cl[r + 1:t]
    if (seg * sgn < neck(j) * sgn).any() or (seg * sgn > v[r] * sgn).any():  # 이미 뚫었거나 어깨 위로 갔다
        return None
    if (cl[t] - neck(t)) * sgn >= 0:
        return None
    return {"side": -sgn, "H": abs(v[h] - neck(h)), "stop": v[r], "kind": "머리어깨"}


def signals(d, K, W, tol):
    hi, lo, cl = (d[c].to_numpy(float) for c in ["high", "low", "close"])
    ph, pl = pivots(hi, lo, K)
    out = []
    for t in range(len(d)):
        if t < W + K:
            out.append([])
            continue
        x = np.arange(t - W + 1, t - K + 1)
        xh, xl = x[ph[t - W + 1:t - K + 1]], x[pl[t - W + 1:t - K + 1]]
        found = [g for g in (double(hi, lo, cl, xh, xl, t, tol, True), double(hi, lo, cl, xh, xl, t, tol, False),
                             hs(hi, lo, cl, xh, xl, t, tol, True), hs(hi, lo, cl, xh, xl, t, tol, False)) if g]
        out.append(found)
    return out


def simulate(d, sigs, W, target, pattern, side):
    op, hi, lo, cl, fund = (d[c].to_numpy(float) for c in ["open", "high", "low", "close", "fund"])
    n = len(d)
    r, turn, cnt = np.zeros(n), np.zeros(n), np.zeros(n)
    want = {"양쪽": 0, "롱만": 1, "숏만": -1}[side]
    pos = None
    for t in range(n):
        if pos is not None:
            out = leave(pos, op[t], hi[t], lo[t], cl[t], t - pos["t0"] >= W)
            r[t] = pos["side"] * ((out[0] if out else cl[t]) / cl[t - 1] - 1) - (0 if out else pos["side"] * fund[t])
            if out:
                turn[t] += 1
                pos = None
            continue
        for g in sigs[t]:
            if (pattern == "둘 다" or g["kind"] == pattern) and (not want or g["side"] == want):
                pos = {"side": g["side"], "target": cl[t] + g["side"] * target * g["H"], "stop": g["stop"], "t0": t}
                turn[t] += 1
                cnt[t] += 1
                break
    return r, turn, cnt


def task(arg):
    tf, K, W, tol = arg
    n = len(days())
    per = []
    for sym in SYMBOLS:
        d = perp(sym, tf)
        per.append((d, signals(d, K, W, tol), day_codes(d.index)))
    cfgs, G, T, N = [], [], [], []
    for target, pattern, side in itertools.product(*TRADE.values()):
        g, t, c = combine([to_daily(code, n, *simulate(d, sigs, W, target, pattern, side)) for d, sigs, code in per])
        cfgs.append(dict(tf=tf, K=K, W=W, tol=tol, target=target, pattern=pattern, side=side))
        G.append(g), T.append(t), N.append(c)
    return cfgs, np.array(G), np.array(T), np.array(N)
