"""1단계: 삼각수렴 격자 (RESEARCH.md, 정의는 TRIANGLE.md). 바이낸스 무기한, 봉인 구간은 읽지 않는다."""
import itertools

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

from common import SYMBOLS, combine, day_codes, days, perp, to_daily

NAME = "삼각수렴"
SOURCES = ["Bulkowski thepatternsite.com (대칭·상승·하락 삼각형, 상승·하락 쐐기)", "StockCharts ChartSchool 대칭 삼각형", "TRIANGLE.md"]
SIG = dict(tf=["1d", "4h", "1h"], K=[2, 3, 5], W=[20, 40, 60, 90], shrink=[0.4, 0.6, 0.8], flat=[0.1, 0.2])
TRADE = dict(target=[0.5, 1.0, 2.0], filt=["없음", "방향", "거래량", "꼭지", "엄격"], entry=["돌파", "되돌림", "실패"], side=["양쪽", "롱만", "숏만"])
DEFAULT = dict(tf="1d", K=3, W=40, shrink=0.6, flat=0.1, target=1.0, filt="없음", entry="돌파", side="양쪽")
UNITS = [{"name": "선물", "bench": "F0", "where": None}]
CHUNK = "tf"  # 결과를 봉 단위로 나눠 저장
APEX = (0.25, 0.5)  # 꼭지 거르기: 돌파 때 폭 ÷ 시작 폭 (밑변~꼭지의 1/2 ~ 3/4 지점)
RETEST, VOL_N = 10, 30  # 되돌림을 기다리는 봉 수 / 돌파 거래량을 견줄 평균 봉 수
EXPECT = {"상승 삼각형": 1, "하락 쐐기": 1, "하락 삼각형": -1, "상승 쐐기": -1}  # 대칭은 앞선 추세 방향


def default(unit):
    return DEFAULT


def tasks():
    return list(itertools.product(*SIG.values()))


def pivots(hi, lo, K):
    """앞뒤 K 봉보다 고가가 높은 봉 / 저가가 낮은 봉."""
    n = len(hi)
    ph, pl = np.zeros(n, bool), np.zeros(n, bool)
    wh, wl = sliding_window_view(hi, 2 * K + 1), sliding_window_view(lo, 2 * K + 1)
    ph[K:n - K] = wh[:, K] > np.maximum(wh[:, :K].max(1), wh[:, K + 1:].max(1))
    pl[K:n - K] = wl[:, K] < np.minimum(wl[:, :K].min(1), wl[:, K + 1:].min(1))
    return ph, pl


def find(hi, lo, cl, vol, ph, pl, t, W, K, shrink, flat):
    """봉 t 에서 삼각수렴 돌파를 찾는다(봉 t 까지의 정보만). 없으면 None."""
    s = t - W + 1
    x = np.arange(s, t - K + 1)
    xh, xl = x[ph[s:t - K + 1]], x[pl[s:t - K + 1]]
    if len(xh) < 2 or len(xl) < 2:
        return None
    au, bu = np.polyfit(xh, hi[xh], 1)
    al, bl = np.polyfit(xl, lo[xl], 1)
    s0 = min(xh[0], xl[0])  # 패턴 시작 = 가장 이른 꼭짓점
    H, now = (au - al) * s0 + bu - bl, (au - al) * t + bu - bl
    if H <= 0 or now <= 0 or now > shrink * H:
        return None
    up, dn = au * t + bu, al * t + bl
    if dn <= cl[t] <= up:
        return None
    j = np.arange(s0, t)
    if (cl[s0:t] > au * j + bu).any() or (cl[s0:t] < al * j + bl).any():  # 이미 돌파한 모양
        return None
    mu, ml = au * (t - s0) / H, al * (t - s0) / H  # 패턴 동안 선이 움직인 양 ÷ 시작 폭
    if mu < -flat and ml > flat:
        shape = "대칭 삼각형"
    elif abs(mu) <= flat and ml > flat:
        shape = "상승 삼각형"
    elif mu < -flat and abs(ml) <= flat:
        shape = "하락 삼각형"
    elif mu > flat and ml > flat:
        shape = "상승 쐐기"
    elif mu < -flat and ml < -flat:
        shape = "하락 쐐기"
    else:
        return None
    side = 1 if cl[t] > up else -1
    expect = EXPECT.get(shape) or (int(np.sign(cl[s0] - cl[s0 - W])) if s0 >= W else 0)
    vol_ok = t >= VOL_N and t - s0 >= 3 and np.polyfit(j, vol[s0:t], 1)[0] < 0 and vol[t] > vol[t - VOL_N:t].mean()
    return {"side": side, "H": H, "brk": up if side > 0 else dn, "stop": dn if side > 0 else up, "t": t,
            "방향": side == expect, "거래량": bool(vol_ok), "꼭지": APEX[0] <= now / H <= APEX[1], "touch3": max(len(xh), len(xl)) >= 3}


def signals(d, K, W, shrink, flat):
    hi, lo, cl, vol = (d[c].to_numpy(float) for c in ["high", "low", "close", "volume"])
    ph, pl = pivots(hi, lo, K)
    return [find(hi, lo, cl, vol, ph, pl, t, W, K, shrink, flat) if t >= W + K else None for t in range(len(d))]


def passes(filt, g):
    if filt == "없음":
        return True
    if filt == "엄격":
        return g["방향"] and g["거래량"] and g["꼭지"] and g["touch3"]
    return g[filt]


def leave(p, o, h, l, c, late):
    """보유 중인 포지션이 이 봉에서 정리되는가. (가격, 사유) 또는 None. 한 봉에서 둘 다 닿으면 손절로 친다."""
    side, stop, target = p["side"], p["stop"], p["target"]
    if (o - stop) * side <= 0:
        return o, "손절"
    if (o - target) * side >= 0:
        return o, "익절"
    if (l <= stop) if side > 0 else (h >= stop):
        return stop, "손절"
    if (h >= target) if side > 0 else (l <= target):
        return target, "익절"
    return (c, "시간") if late else None


def simulate(d, sigs, W, target, filt, entry, side):
    """비용 전. → 봉별 (수익, 회전, 거래 수). 수익 = 포지션 × 가격 변화 − 포지션 × 펀딩(봉 끝까지 들고 있을 때)."""
    op, hi, lo, cl, fund = (d[c].to_numpy(float) for c in ["open", "high", "low", "close", "fund"])
    n = len(d)
    r, turn, cnt = np.zeros(n), np.zeros(n), np.zeros(n)
    want = {"양쪽": 0, "롱만": 1, "숏만": -1}[side]
    pos = wait = None

    def enter(t, s, px, H, stop):
        """봉 t 안에서 px 에 진입. 그 봉의 남은 움직임까지 수익에 넣는다."""
        r[t] = s * (cl[t] / px - 1) - s * fund[t]
        turn[t] += 1
        cnt[t] += 1
        return {"side": s, "target": px + s * target * H, "stop": stop, "t0": t}

    for t in range(n):
        if pos is not None:
            out = leave(pos, op[t], hi[t], lo[t], cl[t], t - pos["t0"] >= W)
            r[t] = pos["side"] * ((out[0] if out else cl[t]) / cl[t - 1] - 1) - (0 if out else pos["side"] * fund[t])
            if out:
                turn[t] += 1
                pos = None
            continue  # 정리한 다음 봉부터 다시 찾는다
        if wait is not None and entry == "되돌림":
            g, s = wait, wait["side"]
            if (lo[t] <= g["brk"]) if s > 0 else (hi[t] >= g["brk"]):
                px = min(op[t], g["brk"]) if s > 0 else max(op[t], g["brk"])
                pos, wait = enter(t, s, px, g["H"], g["stop"]), None
                if (lo[t] <= g["stop"]) if s > 0 else (hi[t] >= g["stop"]):  # 들어간 봉에서 손절선까지 갔다
                    r[t] = s * (g["stop"] / px - 1)
                    turn[t] += 1
                    pos = None
            elif (cl[t] - g["stop"]) * s <= 0 or t - g["t"] >= RETEST:
                wait = None
            continue
        if wait is not None and entry == "실패":  # 처음 돌파를 가상 거래로 지켜본다
            out = leave(wait, op[t], hi[t], lo[t], cl[t], t - wait["t0"] >= W)
            if out:
                g, wait = wait, None
                if out[1] == "손절" and (want == 0 or want == -g["side"]):  # 반대쪽 선을 뚫었다 → 그 가격에 반대로
                    pos = enter(t, -g["side"], out[0], g["H"], g["brk"])
                    if (cl[t] - pos["stop"]) * pos["side"] <= 0:  # 같은 봉 종가가 처음 돌파선 밖으로 되돌아갔다
                        r[t] = pos["side"] * (cl[t] / out[0] - 1)
                        turn[t] += 1
                        pos = None
            continue
        g = sigs[t]
        if g is None or not passes(filt, g):
            continue
        if entry == "실패":
            wait = {"side": g["side"], "target": cl[t] + g["side"] * g["H"], "stop": g["stop"], "t0": t, "H": g["H"], "brk": g["brk"]}
        elif want and g["side"] != want:
            continue
        elif entry == "되돌림":
            wait = g
        else:
            pos = {"side": g["side"], "target": cl[t] + g["side"] * target * g["H"], "stop": g["stop"], "t0": t}
            turn[t] += 1
            cnt[t] += 1
    return r, turn, cnt


def task(arg):
    """봉·K·W·수렴·수평 하나 → 매매 규칙 135칸 × 두 마켓. → (설정 목록, G, T, N) 일별."""
    tf, K, W, shrink, flat = arg
    n = len(days())
    per = []
    for sym in SYMBOLS:
        d = perp(sym, tf)
        per.append((d, signals(d, K, W, shrink, flat), day_codes(d.index)))
    cfgs, G, T, N = [], [], [], []
    for target, filt, entry, side in itertools.product(*TRADE.values()):
        g, t, c = combine([to_daily(code, n, *simulate(d, sigs, W, target, filt, entry, side)) for d, sigs, code in per])
        cfgs.append(dict(tf=tf, K=K, W=W, shrink=shrink, flat=flat, target=target, filt=filt, entry=entry, side=side))
        G.append(g), T.append(t), N.append(c)
    return cfgs, np.array(G), np.array(T), np.array(N)
