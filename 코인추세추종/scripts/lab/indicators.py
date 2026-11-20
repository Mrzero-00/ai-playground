"""2단계: 지표 방법들 (RESEARCH.md 2단계 등록). 신호는 봉 t 종가로 정하고 t+1 봉부터 들고 간다.
모드: 선물 롱숏(신호 그대로), 선물 롱만(음수는 0), 현물 롱만(업비트 일봉, 음수는 0). 파라미터는 봉 수.
"""
import itertools

import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view

from common import SYMBOLS, combine, day_codes, days, perp, positions, to_daily, upbit


def sma(x, n):
    return x.rolling(n).mean()


def ema(x, n):
    return x.ewm(span=n, adjust=False).mean()


def wilder(x, n):
    return x.ewm(alpha=1 / n, adjust=False).mean()


def true_range(d):
    c1 = d.close.shift(1)
    return pd.concat([d.high - d.low, (d.high - c1).abs(), (d.low - c1).abs()], axis=1).max(axis=1)


def rsi(c, n):
    dl = c.diff()
    g, l = wilder(dl.clip(lower=0), n), wilder((-dl).clip(lower=0), n)
    out = 100 - 100 / (1 + g / l.replace(0, np.nan))
    return out.mask((l == 0) & (g > 0), 100.0)  # 내린 적이 없으면 100


def machine(n, enter_long, enter_short, exit_long, exit_short):
    """상태 기계: 진입·청산 조건(불리언 배열)으로 -1/0/1 포지션."""
    out, pos = np.zeros(n), 0
    for i in range(n):
        if pos == 1 and exit_long[i]:
            pos = 0
        elif pos == -1 and exit_short[i]:
            pos = 0
        if pos <= 0 and enter_long[i]:
            pos = 1
        elif pos >= 0 and enter_short[i]:
            pos = -1
        out[i] = pos
    return out


# ---------- 방법별 신호 (-1 ~ 1) ----------

def s_tsmom(d, p):
    return np.sign(d.close / d.close.shift(p["L"]) - 1)


def s_macross(d, p):
    f, s = map(int, p["pair"].split("/"))
    ma = sma if p["kind"] == "SMA" else ema
    fast = d.close if f == 1 else ma(d.close, f)
    return np.sign(fast - ma(d.close, s)).where(d.close.rolling(s).count() >= s)


def s_donchian(d, p):
    N, M = map(int, p["nm"].split("/"))
    c = d.close.to_numpy()
    hh, ll = d.high.rolling(N).max().shift(1).to_numpy(), d.low.rolling(N).min().shift(1).to_numpy()
    xl, xh = d.low.rolling(M).min().shift(1).to_numpy(), d.high.rolling(M).max().shift(1).to_numpy()
    with np.errstate(invalid="ignore"):
        return pd.Series(machine(len(c), c > hh, c < ll, c < xl, c > xh), index=d.index)


def s_macd(d, p):
    f, s, k = map(int, p["fsk"].split("/"))
    m = ema(d.close, f) - ema(d.close, s)
    return np.sign(m - ema(m, k) if p["rule"] == "신호선" else m)


def s_rsi(d, p):
    r = rsi(d.close, p["n"])
    if p["rule"] == "모멘텀":
        return np.sign(r - 50)
    lo, hi = map(int, p["band"].split("/"))
    ma = sma(d.close, 200)
    ok_l = (d.close > ma) if p["filter"] == "200선" else pd.Series(True, index=d.index)
    ok_s = (d.close < ma) if p["filter"] == "200선" else pd.Series(True, index=d.index)
    rv = r.to_numpy()
    with np.errstate(invalid="ignore"):
        return pd.Series(machine(len(rv), (rv < lo) & ok_l.to_numpy(), (rv > hi) & ok_s.to_numpy(), rv > 50, rv < 50), index=d.index)


def s_bollinger(d, p):
    mid, sd = sma(d.close, p["n"]), d.close.rolling(p["n"]).std()
    up, dn, c = (mid + p["k"] * sd).to_numpy(), (mid - p["k"] * sd).to_numpy(), d.close.to_numpy()
    m = mid.to_numpy()
    with np.errstate(invalid="ignore"):
        if p["rule"] == "평균회귀":
            out = machine(len(c), c < dn, c > up, c >= m, c <= m)
        else:
            out = machine(len(c), c > up, c < dn, c < m, c > m)
    return pd.Series(out, index=d.index)


def s_supertrend(d, p):
    a = wilder(true_range(d), p["atr"]).to_numpy()
    hl2, c = ((d.high + d.low) / 2).to_numpy(), d.close.to_numpy()
    ub, lb = hl2 + p["mult"] * a, hl2 - p["mult"] * a
    fu, fl, out, dirn = ub.copy(), lb.copy(), np.zeros(len(c)), 0
    for i in range(1, len(c)):
        fu[i] = ub[i] if (ub[i] < fu[i - 1] or c[i - 1] > fu[i - 1]) else fu[i - 1]
        fl[i] = lb[i] if (lb[i] > fl[i - 1] or c[i - 1] < fl[i - 1]) else fl[i - 1]
        if c[i] > fu[i - 1]:
            dirn = 1
        elif c[i] < fl[i - 1]:
            dirn = -1
        out[i] = dirn if i >= p["atr"] else 0
    return pd.Series(out, index=d.index)


def s_ichimoku(d, p):
    t, k, b, disp = map(int, p["set"].split("/"))
    mid = lambda n: (d.high.rolling(n).max() + d.low.rolling(n).min()) / 2
    tenkan, kijun = mid(t), mid(k)
    a, bb = ((tenkan + kijun) / 2).shift(disp), mid(b).shift(disp)  # 지금 봉 위의 구름 = disp 봉 전에 그린 선
    cloud = np.where(d.close > np.maximum(a, bb), 1, np.where(d.close < np.minimum(a, bb), -1, 0))
    tk = np.sign(tenkan - kijun).fillna(0).to_numpy()
    out = {"구름": cloud, "전환기준": tk, "둘 다": np.where(cloud == tk, cloud, 0)}[p["rule"]]
    return pd.Series(out, index=d.index).where(bb.notna(), 0)


def s_psar(d, p):
    hi, lo = d.high.to_numpy(), d.low.to_numpy()
    out = np.zeros(len(hi))
    up, sar, ep, af = True, lo[0], hi[0], p["step"]
    for i in range(2, len(hi)):
        sar = sar + af * (ep - sar)
        if up:
            sar = min(sar, lo[i - 1], lo[i - 2])
            if lo[i] < sar:
                up, sar, ep, af = False, ep, lo[i], p["step"]
            elif hi[i] > ep:
                ep, af = hi[i], min(af + p["step"], p["max"])
        else:
            sar = max(sar, hi[i - 1], hi[i - 2])
            if hi[i] > sar:
                up, sar, ep, af = True, ep, hi[i], p["step"]
            elif lo[i] < ep:
                ep, af = lo[i], min(af + p["step"], p["max"])
        out[i] = 1 if up else -1
    return pd.Series(out, index=d.index)


def s_adx(d, p):
    n = p["n"]
    upm, dnm = d.high.diff(), -d.low.diff()
    pdm = upm.where((upm > dnm) & (upm > 0), 0.0)
    ndm = dnm.where((dnm > upm) & (dnm > 0), 0.0)
    a = wilder(true_range(d), n)
    pdi, ndi = 100 * wilder(pdm, n) / a, 100 * wilder(ndm, n) / a
    adx = wilder(100 * (pdi - ndi).abs() / (pdi + ndi).replace(0, np.nan), n)
    return np.sign(pdi - ndi).where(adx > p["thr"], 0.0).where(d.close.rolling(2 * n).count() >= 2 * n, 0.0)


def s_reversal(d, p):
    r = d.close / d.close.shift(p["L"]) - 1
    s = -np.sign(r)
    if p["q"]:
        s = s.where(r.abs() > p["q"] * d.close.pct_change().rolling(60).std() * np.sqrt(p["L"]), 0.0)  # q 표준편차보다 크게 움직였을 때만
    return s


# ---------- 4차 (봉인 해제 뒤 추가 — 참고용) ----------

def warm(s, n):
    """처음 n 봉은 0 (지표가 아직 다 차지 않았다)."""
    s = s.copy()
    s.iloc[:n] = 0.0
    return s


def s_keltner(d, p):
    mid = ema(d.close, p["n"])
    a = wilder(true_range(d), p["atr"])
    up, dn, m, c = (mid + p["mult"] * a).to_numpy(), (mid - p["mult"] * a).to_numpy(), mid.to_numpy(), d.close.to_numpy()
    if p["rule"] == "돌파":
        out = machine(len(c), c > up, c < dn, c < m, c > m)
    else:
        out = machine(len(c), c < dn, c > up, c >= m, c <= m)
    return warm(pd.Series(out, index=d.index), max(p["n"], p["atr"]))


def s_stoch(d, p):
    ll, hh = d.low.rolling(p["n"]).min(), d.high.rolling(p["n"]).max()
    k = sma(100 * (d.close - ll) / (hh - ll).replace(0, np.nan), 3)  # 느린 %K
    dd = sma(k, 3)
    if p["rule"] == "교차":
        return np.sign(k - dd)
    lo, hi = map(int, p["band"].split("/"))
    kv = k.to_numpy()
    with np.errstate(invalid="ignore"):
        return pd.Series(machine(len(kv), kv < lo, kv > hi, kv > 50, kv < 50), index=d.index)


def s_aroon(d, p):
    n = p["n"]
    since = lambda x, f: np.r_[np.full(n, np.nan), f(sliding_window_view(x, n + 1)[:, ::-1], axis=1)]  # 가장 최근 최고(최저)가 뒤 지난 봉
    up = 100 * (n - since(d.high.to_numpy(), np.argmax)) / n
    dn = 100 * (n - since(d.low.to_numpy(), np.argmin)) / n
    with np.errstate(invalid="ignore"):
        if p["rule"] == "교차":
            out = np.sign(up - dn)
        else:
            out = np.where((up >= 70) & (dn <= 30), 1, np.where((dn >= 70) & (up <= 30), -1, 0))
    return pd.Series(out, index=d.index)


def s_kama(d, p):
    n, c = p["er"], d.close.to_numpy()
    er = (d.close.diff(n).abs() / d.close.diff().abs().rolling(n).sum()).to_numpy()
    fast, slow = 2 / (2 + 1), 2 / (p["slow"] + 1)
    sc = (np.nan_to_num(er) * (fast - slow) + slow) ** 2
    k = np.full(len(c), np.nan)
    if len(c) > n:
        k[n] = c[n]
        for i in range(n + 1, len(c)):
            k[i] = k[i - 1] + sc[i] * (c[i] - k[i - 1])
    k = pd.Series(k, index=d.index)
    out = np.sign(d.close - k) if p["rule"] == "종가교차" else np.sign(k.diff())
    return out.fillna(0.0)


def s_heikin(d, p):
    hc = ((d.open + d.high + d.low + d.close) / 4).to_numpy()
    ho = np.empty(len(hc))
    ho[0] = (d.open.iloc[0] + d.close.iloc[0]) / 2
    for i in range(1, len(hc)):
        ho[i] = (ho[i - 1] + hc[i - 1]) / 2
    color, m = np.sign(hc - ho), p["m"]
    out, pos = np.zeros(len(hc)), 0.0
    for i in range(m - 1, len(hc)):
        w = color[i - m + 1:i + 1]
        if w[0] != 0 and (w == w[0]).all():
            pos = w[0]
        out[i] = pos
    return pd.Series(out, index=d.index)


# ---------- 5차 (봉인 해제 뒤 추가 — 참고용) ----------

def volume(d):
    """바이낸스는 거래량, 업비트 일봉은 수량이 없어 거래대금 ÷ 종가."""
    return d.volume if "volume" in d else d.value / d.close


def wma(x, n):
    v, w = np.asarray(x, float), np.arange(1, n + 1, dtype=float)
    out = np.full(len(v), np.nan)
    if len(v) >= n:
        out[n - 1:] = sliding_window_view(v, n) @ w / w.sum()
    return pd.Series(out, index=x.index)


def s_cci(d, p):
    n, tp = p["n"], ((d.high + d.low + d.close) / 3)
    w = sliding_window_view(tp.to_numpy(), n)
    mad = np.r_[np.full(n - 1, np.nan), np.abs(w - w.mean(1, keepdims=True)).mean(1)]
    cci = ((tp - sma(tp, n)) / (0.015 * mad)).to_numpy()
    with np.errstate(invalid="ignore"):
        if p["rule"] == "0선":
            out = np.sign(np.nan_to_num(cci))
        elif p["rule"] == "돌파":
            out = machine(len(cci), cci > 100, cci < -100, cci < 100, cci > -100)
        else:
            out = machine(len(cci), cci < -100, cci > 100, cci > 0, cci < 0)
    return pd.Series(out, index=d.index)


def s_hull(d, p):
    n = p["n"]
    h = wma(2 * wma(d.close, n // 2) - wma(d.close, n), int(round(np.sqrt(n))))
    return (np.sign(h.diff()) if p["rule"] == "기울기" else np.sign(d.close - h)).where(h.notna(), 0.0)


def s_trix(d, p):
    n = p["n"]
    t = ema(ema(ema(d.close, n), n), n).pct_change()
    out = np.sign(t) if p["rule"] == "0선" else np.sign(t - ema(t, 9))
    return warm(out.fillna(0.0), 3 * n)


def s_obv(d, p):
    obv = (np.sign(d.close.diff()).fillna(0.0) * volume(d)).cumsum()
    return np.sign(obv - sma(obv, p["n"])).where(obv.rolling(p["n"]).count() >= p["n"], 0.0)


def s_cmf(d, p):
    rng = (d.high - d.low).replace(0, np.nan)
    v = volume(d)
    cmf = ((((d.close - d.low) - (d.high - d.close)) / rng).fillna(0.0) * v).rolling(p["n"]).sum() / v.rolling(p["n"]).sum()
    th = p["th"]
    return pd.Series(np.where(cmf > th, 1.0, np.where(cmf < -th, -1.0, 0.0)), index=d.index)


def s_mfi(d, p):
    n, tp = p["n"], (d.high + d.low + d.close) / 3
    mf, dtp = tp * volume(d), tp.diff()
    pos, neg = mf.where(dtp > 0, 0.0).rolling(n).sum(), mf.where(dtp < 0, 0.0).rolling(n).sum()
    mfi = (100 - 100 / (1 + pos / neg.replace(0, np.nan))).mask((neg == 0) & (pos > 0), 100.0)
    if p["rule"] == "모멘텀":
        return np.sign(mfi - 50)
    lo, hi = map(int, p["band"].split("/"))
    m = mfi.to_numpy()
    with np.errstate(invalid="ignore"):
        return pd.Series(machine(len(m), m < lo, m > hi, m > 50, m < 50), index=d.index)


def linreg_end(x, n):
    """n 봉 선형회귀 직선의 마지막 봉 값 (Pine linreg(x, n, 0))."""
    v = x.to_numpy(float)
    out = np.full(len(v), np.nan)
    if len(v) >= n:
        w = sliding_window_view(v, n)
        t = np.arange(n) - (n - 1) / 2
        out[n - 1:] = w.mean(axis=1) + (w @ t) / (t @ t) * (n - 1) / 2
    return pd.Series(out, index=x.index)


def s_squeeze(d, p):
    """TTM 스퀴즈: 볼린저(n, 2)가 켈트너(SMA n ± 배수 × TR 평균) 안이었다가 풀린 첫 봉에 모멘텀 방향으로 든다."""
    n = p["n"]
    mid, sd = sma(d.close, n), d.close.rolling(n).std()
    w = p["mult"] * sma(true_range(d), n)
    on = ((mid + 2 * sd < mid + w) & (mid - 2 * sd > mid - w)).to_numpy()
    mom = linreg_end(d.close - ((d.high.rolling(n).max() + d.low.rolling(n).min()) / 2 + mid) / 2, n).to_numpy()
    out, pos, held = np.zeros(len(mom)), 0, 0
    for i in range(2, len(mom)):
        if not np.isfinite(mom[i - 2]):
            continue
        up, dn = mom[i] > mom[i - 1], mom[i] < mom[i - 1]
        if pos != 0:
            held += 1
            if p["exit"] == "2봉약화":
                stop = (dn and mom[i - 1] < mom[i - 2]) if pos == 1 else (up and mom[i - 1] > mom[i - 2])
            elif p["exit"] == "0선":
                stop = mom[i] * pos <= 0
            else:
                stop = held >= 10
            if stop:
                pos = 0
        if on[i - 1] and not on[i]:
            if mom[i] > 0 and up:
                pos, held = 1, 0
            elif mom[i] < 0 and dn:
                pos, held = -1, 0
        out[i] = pos
    return pd.Series(out, index=d.index)


def s_vortex(d, p):
    """보텍스: VI± = VM± 의 n 봉 합 ÷ TR 의 n 봉 합. 교차는 VI+ − VI− 의 부호, 차이는 ±0.1 밖에서만."""
    n, tr = p["n"], true_range(d).rolling(p["n"]).sum()
    x = ((d.high - d.low.shift(1)).abs().rolling(n).sum() - (d.low - d.high.shift(1)).abs().rolling(n).sum()) / tr
    if p["rule"] == "교차":
        return np.sign(x).fillna(0.0)
    return pd.Series(np.where(x > 0.1, 1.0, np.where(x < -0.1, -1.0, 0.0)), index=d.index)


def s_alligator(d, p):
    """앨리게이터: 중간가 SMMA 턱 13·이빨 8·입술 5 를 8·5·3 봉 앞으로 민다(봉 t 에 t − 밀기 값). 배율은 기간·밀기 모두에."""
    k, med = p["scale"], (d.high + d.low) / 2
    jaw, teeth, lips = (wilder(med, n * k).shift(s * k) for n, s in ((13, 8), (8, 5), (5, 3)))
    if p["rule"] == "정렬":
        out = np.where((lips > teeth) & (teeth > jaw), 1.0, np.where((lips < teeth) & (teeth < jaw), -1.0, 0.0))
    else:
        out = np.where((lips if p["rule"] == "입술·턱" else d.close) > jaw, 1.0, -1.0)
    return warm(pd.Series(out, index=d.index), (3 * 13 + 8) * k)


def s_elder(d, p):
    """엘더 임펄스: EMA 와 MACD 히스토그램이 둘 다 오르면 +1, 둘 다 내리면 −1. 엇갈리면 0(셋값) 또는 앞 방향(유지)."""
    f, sl, k = map(int, p["macd"].split("/"))
    m = ema(d.close, f) - ema(d.close, sl)
    e, h = ema(d.close, p["ema"]).diff(), (m - ema(m, k)).diff()
    out = pd.Series(np.where((e > 0) & (h > 0), 1.0, np.where((e < 0) & (h < 0), -1.0, np.nan)), index=d.index)
    return warm(out.fillna(0.0) if p["blue"] == "셋값" else out.ffill().fillna(0.0), 3 * sl)


def s_chandelier(d, p):
    """샹들리에 청산(everget 식): 손절은 유리한 쪽으로만 움직이고, 종가가 전 봉의 반대 손절을 넘으면 방향을 바꾼다."""
    n, a = p["n"], p["k"] * wilder(true_range(d), p["n"])
    ls, ss = (d.high.rolling(n).max() - a).to_numpy(), (d.low.rolling(n).min() + a).to_numpy()
    c, out, side = d.close.to_numpy(), np.zeros(len(d)), 0
    for i in range(n, len(c)):
        if c[i - 1] > ls[i - 1]:
            ls[i] = max(ls[i], ls[i - 1])
        if c[i - 1] < ss[i - 1]:
            ss[i] = min(ss[i], ss[i - 1])
        side = 1 if c[i] > ss[i - 1] else -1 if c[i] < ls[i - 1] else side
        out[i] = side
    return pd.Series(out, index=d.index)


def s_kalman(d, p):
    """국소 선형 추세(수준 잡음 0, 기울기 잡음 ÷ 관측 잡음 = q)를 로그 종가에 앞방향으로만 거른다."""
    y, q = np.log(d.close.to_numpy(float)), p["q"]
    F, Q = np.array([[1.0, 1.0], [0.0, 1.0]]), np.array([[0.0, 0.0], [0.0, q]])
    x, P = np.array([y[0], 0.0]), np.eye(2)
    lv, sl = np.zeros(len(y)), np.zeros(len(y))
    for t in range(len(y)):
        if t:
            x, P = F @ x, F @ P @ F.T + Q
        K = P[:, 0] / (P[0, 0] + 1.0)
        x, P = x + K * (y[t] - x[0]), P - np.outer(K, P[0])
        lv[t], sl[t] = x
    out = np.sign(sl) if p["rule"] == "기울기" else np.where(y > lv, 1.0, -1.0)
    return warm(pd.Series(out, index=d.index), 100)


def s_tdseq(d, p):
    """TD 시퀀셜 단순형: 셋업 9(종가 vs 4봉 전 종가), 카운트다운 13(종가 vs 2봉 전 저·고가). 매수 완성 +1, 매도 −1."""
    c, lo, hi = d.close.to_numpy(), d.low.to_numpy(), d.high.to_numpy()
    trig, bs, ss, bc, sc = np.zeros(len(c)), 0, 0, -1, -1  # bc·sc: 카운트다운 센 수, -1 은 안 세는 중
    for i in range(4, len(c)):
        bs, ss = (bs + 1 if c[i] < c[i - 4] else 0), (ss + 1 if c[i] > c[i - 4] else 0)
        setup = 1 if bs == 9 else -1 if ss == 9 else 0
        if setup == 1:
            bc, sc = max(bc, 0), -1
        elif setup == -1:
            sc, bc = max(sc, 0), -1
        if bc >= 0 and c[i] <= lo[i - 2]:
            bc += 1
        if sc >= 0 and c[i] >= hi[i - 2]:
            sc += 1
        if p["signal"] == "셋업9":
            trig[i] = setup
        elif bc == 13 or sc == 13:
            trig[i] = 1 if bc == 13 else -1
            bc, sc = (-1, sc) if bc == 13 else (bc, -1)
    if p["dir"] == "추세":
        trig = -trig
    if p["hold"] == "반대신호":
        return pd.Series(trig, index=d.index).replace(0.0, np.nan).ffill().fillna(0.0)
    out, pos, left = np.zeros(len(trig)), 0.0, 0
    for i, t in enumerate(trig):
        if t:
            pos, left = t, p["hold"]
        out[i] = pos if left > 0 else 0.0
        left = max(left - 1, 0)
    return pd.Series(out, index=d.index)


def gauss(x, per, poles=4):
    """에일러스 N 극 가우시안 필터 = 같은 α 의 1극 필터를 N 번 (Gaussian Channel [DW])."""
    beta = (1 - np.cos(2 * np.pi / per)) / (2 ** (1 / poles) - 1)
    a = -beta + np.sqrt(beta ** 2 + 2 * beta)
    for _ in range(poles):
        x = x.ewm(alpha=a, adjust=False).mean()
    return x


def s_gausschan(d, p):
    """가우시안 채널: 필터 ± 필터한 TR × 배수. 상단돌파는 위 띠 아래에서, 필터까지는 필터 반대편에서 청산."""
    P, c = p["P"], d.close
    f = gauss((d.high + d.low + d.close) / 3, P)
    if p["rule"] == "기울기":
        return warm(np.sign(f.diff()).fillna(0.0), 2 * P)
    w = gauss(true_range(d).fillna(d.high - d.low), P) * p["mult"]
    up, dn = (f.diff() > 0).to_numpy(), (f.diff() < 0).to_numpy()
    hb, lb = (c > f + w).to_numpy(), (c < f - w).to_numpy()
    ex_l, ex_s = (~hb, ~lb) if p["rule"] == "상단돌파" else ((c < f).to_numpy(), (c > f).to_numpy())
    return warm(pd.Series(machine(len(c), up & hb, dn & lb, ex_l, ex_s), index=d.index), 2 * P)


def s_clenow(d, p):
    """로그 종가를 n 봉 시간에 회귀: R² ≥ r 이면 기울기 부호, 아니면 0."""
    n, y = p["n"], np.log(d.close.to_numpy(float))
    out = np.zeros(len(y))
    w = sliding_window_view(y, n)
    t = np.arange(n) - (n - 1) / 2
    b = (w @ t) / (t @ t)
    sst = ((w - w.mean(axis=1, keepdims=True)) ** 2).sum(axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        r2 = np.where(sst > 0, b ** 2 * (t @ t) / sst, 0.0)
    out[n - 1:] = np.where(r2 >= p["r"], np.sign(b), 0.0)
    return pd.Series(out, index=d.index)


def s_stc(d, p):
    """샤프 추세 주기: MACD 에 주기 봉 스토캐스틱 + 0.5 평활을 두 번. 문턱은 25 상향·75 하향 교차, 50선은 50 위아래."""
    f, s = map(int, p["fs"].split("/"))
    n = p["cycle"]

    def cycle(x):
        lo = pd.Series(x).rolling(n).min().to_numpy()
        rg = pd.Series(x).rolling(n).max().to_numpy() - lo
        out, k, sm = np.full(len(x), np.nan), np.nan, np.nan
        for i in range(len(x)):
            if rg[i] > 0:  # 폭이 0 이거나 아직 없으면 앞 값
                k = (x[i] - lo[i]) / rg[i] * 100
            if not np.isnan(k):
                sm = k if np.isnan(sm) else sm + 0.5 * (k - sm)
            out[i] = sm
        return out

    stc = cycle(cycle((ema(d.close, f) - ema(d.close, s)).to_numpy()))
    prev, no = np.r_[np.nan, stc[:-1]], np.zeros(len(stc), bool)
    with np.errstate(invalid="ignore"):
        out = np.where(stc > 50, 1.0, -1.0) if p["rule"] == "50선" else machine(len(stc), (prev <= 25) & (stc > 25), (prev >= 75) & (stc < 75), no, no)
    return warm(pd.Series(out, index=d.index), 3 * s)


def s_fisher(d, p):
    """에일러스 피셔 변환(2002): 중간가를 n 봉 폭으로 −1~1 에 맞춰 0.33·0.67 평활, 0.5 ln((1+v)/(1−v)) + 0.5 × 전 값."""
    n, mid = p["n"], (d.high + d.low) / 2
    hi, lo, x = mid.rolling(n).max().to_numpy(), mid.rolling(n).min().to_numpy(), mid.to_numpy()
    F, v, f = np.zeros(len(x)), 0.0, 0.0
    for i in range(len(x)):
        if hi[i] - lo[i] > 0:
            v = 0.33 * 2 * ((x[i] - lo[i]) / (hi[i] - lo[i]) - 0.5) + 0.67 * v
            v = 0.999 if v > 0.99 else -0.999 if v < -0.99 else v
            f = 0.5 * np.log((1 + v) / (1 - v)) + 0.5 * f
        F[i] = f
    out = np.where(F > np.r_[0.0, F[:-1]], 1.0, -1.0) if p["rule"] == "교차" else np.where(F > 0, 1.0, -1.0)
    return warm(pd.Series(out, index=d.index), 2 * n)


def s_coppock(d, p):
    """코폭 곡선: WMA(ROC(14s) + ROC(11s), 10s). 0선은 부호, 바닥반등은 0 아래에서 꺾여 오르면 롱·0 위에서 꺾여 내리면 숏, 기울기는 오르내림."""
    s, c = p["scale"], d.close
    cc = wma((c / c.shift(14 * s) - 1) + (c / c.shift(11 * s) - 1), 10 * s).to_numpy()
    c1, c2, no = np.r_[np.nan, cc[:-1]], np.r_[np.nan, np.nan, cc[:-2]], np.zeros(len(cc), bool)
    with np.errstate(invalid="ignore"):
        if p["rule"] == "0선":
            out = np.where(cc > 0, 1.0, -1.0)
        elif p["rule"] == "기울기":
            out = np.where(cc > c1, 1.0, -1.0)
        else:
            out = machine(len(cc), (cc < 0) & (cc > c1) & (c1 <= c2), (cc > 0) & (cc < c1) & (c1 >= c2), no, no)
    return warm(pd.Series(out, index=d.index), 24 * s)


def s_chop(d, p):
    """초피니스 지수(Dreiss): 100 log10(n 봉 TR 합 ÷ (최고 − 최저)) ÷ log10(n). 문턱 아래(추세장)면 n 봉 수익 부호, 아니면 0(추세만) 또는 앞 포지션(유지)."""
    n = p["n"]
    rg = (d.high.rolling(n).max() - d.low.rolling(n).min()).replace(0, np.nan)
    chop = (100 * np.log10(true_range(d).rolling(n).sum() / rg) / np.log10(n)).to_numpy()
    mom = np.sign(d.close / d.close.shift(n) - 1).to_numpy()
    with np.errstate(invalid="ignore"):
        out = pd.Series(np.where(chop < p["th"], mom, np.nan if p["rule"] == "유지" else 0.0), index=d.index)
    return warm((out.ffill() if p["rule"] == "유지" else out).fillna(0.0), n)


def s_renko(d, p):
    """렌코: 로그 종가로 벽돌을 쌓는다. 같은 방향 1 벽돌이면 더하고, 마지막 벽돌 끝에서 반대로 '반전' 벽돌이면 방향을 바꾼다. 신호 = 마지막 벽돌 방향.
    벽돌 크기는 ln(1 + p) 또는 k × ATR(14) ÷ 종가 — 마지막 벽돌을 그린 봉 값으로 고정."""
    x, r = np.log(d.close.to_numpy(float)), p["rev"]
    if p["size"].endswith("%"):
        bs = np.full(len(x), np.log(1 + float(p["size"][:-1]) / 100))
    else:
        bs = (float(p["size"].split("×")[1]) * wilder(true_range(d), 14) / d.close).to_numpy()
    out, ref, b, dr = np.zeros(len(x)), x[14], bs[14], 0
    for i in range(15, len(x)):
        new = True
        if dr >= 0 and x[i] >= ref + b:
            ref, dr = ref + np.floor((x[i] - ref) / b) * b, 1
        elif dr <= 0 and x[i] <= ref - b:
            ref, dr = ref - np.floor((ref - x[i]) / b) * b, -1
        elif dr == 1 and x[i] <= ref - r * b:
            ref, dr = ref - (r - 1) * b - np.floor((ref - (r - 1) * b - x[i]) / b) * b, -1
        elif dr == -1 and x[i] >= ref + r * b:
            ref, dr = ref + (r - 1) * b + np.floor((x[i] - ref - (r - 1) * b) / b) * b, 1
        else:
            new = False
        if new:
            b = bs[i]
        out[i] = dr
    return pd.Series(out, index=d.index)


def s_mama(d, p):
    """에일러스 MAMA(2001): 호모다인 판별기로 잰 위상 변화율로 α 를 빠름~느림 한계 사이에서 바꾼다. FAMA 는 α/2.
    교차는 MAMA > FAMA 면 +1, 종가는 종가 > MAMA 면 +1 (아니면 −1)."""
    fast, slow = map(float, p["limits"].split("/"))
    pr = ((d.high + d.low) / 2).to_numpy(float)
    n = len(pr)
    sm, det, I1, Q1, I2, Q2, Re, Im, per, ph = (np.zeros(n) for _ in range(10))
    mama, fama = pr.copy(), pr.copy()

    def hil(a, i):
        return 0.0962 * a[i] + 0.5769 * a[i - 2] - 0.5769 * a[i - 4] - 0.0962 * a[i - 6]

    for i in range(6, n):
        sm[i] = (4 * pr[i] + 3 * pr[i - 1] + 2 * pr[i - 2] + pr[i - 3]) / 10
        adj = 0.075 * per[i - 1] + 0.54
        det[i] = hil(sm, i) * adj
        Q1[i], I1[i] = hil(det, i) * adj, det[i - 3]
        jI, jQ = hil(I1, i) * adj, hil(Q1, i) * adj
        I2[i] = 0.2 * (I1[i] - jQ) + 0.8 * I2[i - 1]
        Q2[i] = 0.2 * (Q1[i] + jI) + 0.8 * Q2[i - 1]
        Re[i] = 0.2 * (I2[i] * I2[i - 1] + Q2[i] * Q2[i - 1]) + 0.8 * Re[i - 1]
        Im[i] = 0.2 * (I2[i] * Q2[i - 1] - Q2[i] * I2[i - 1]) + 0.8 * Im[i - 1]
        P = 360 / np.degrees(np.arctan(Im[i] / Re[i])) if Im[i] != 0 and Re[i] != 0 else per[i - 1]
        P = min(max(min(max(P, 0.67 * per[i - 1]), 1.5 * per[i - 1]), 6.0), 50.0)
        per[i] = 0.2 * P + 0.8 * per[i - 1]
        ph[i] = np.degrees(np.arctan(Q1[i] / I1[i])) if I1[i] != 0 else ph[i - 1]
        a = max(fast / max(ph[i - 1] - ph[i], 1.0), slow)
        mama[i] = a * pr[i] + (1 - a) * mama[i - 1]
        fama[i] = 0.5 * a * mama[i] + (1 - 0.5 * a) * fama[i - 1]
    out = np.where(mama > fama, 1.0, -1.0) if p["rule"] == "교차" else np.where(d.close.to_numpy() > mama, 1.0, -1.0)
    return warm(pd.Series(out, index=d.index), 50)


KST = {"일": ((10, 15, 20, 30), (10, 10, 10, 15)), "주": ((10, 13, 15, 20), (10, 13, 15, 20)), "월": ((9, 12, 18, 24), (6, 6, 6, 9))}


def s_kst(d, p):
    """프링 KST: ROC 네 개를 각각 단순평균으로 다듬어 1·2·3·4 가중합, 신호선 9 SMA. 묶음 봉 수(신호선 포함)에 배율 일 1·주 7·월 30."""
    (rocs, sms), m, c = KST[p["set"]], {"일": 1, "주": 7, "월": 30}[p["set"]], d.close
    k = sum((i + 1) * sma(c / c.shift(r * m) - 1, s * m) for i, (r, s) in enumerate(zip(rocs, sms)))
    x = k - sma(k, 9 * m) if p["rule"] == "신호선" else k
    return pd.Series(np.where(x > 0, 1.0, -1.0), index=d.index).where(x.notna(), 0.0)


def s_klinger(d, p):
    """클링거 거래량 오실레이터: KO = EMA(VF, 빠름) − EMA(VF, 느림), 신호선 EMA. 원식 VF = 거래량 × |2 dm/cm − 1| × 추세, 단순 VF = 거래량 × hlc3 방향."""
    f, sl, g = map(int, p["speed"].split("/"))
    v, hlc = volume(d).to_numpy(float), (d.high + d.low + d.close).diff().to_numpy()
    with np.errstate(invalid="ignore", divide="ignore"):
        if p["vf"] == "단순":
            vf = v * np.where(hlc >= 0, 1.0, -1.0)
        else:
            t, dm = np.where(hlc > 0, 1.0, -1.0), (d.high - d.low).to_numpy(float)
            cm = dm.copy()
            for i in range(1, len(dm)):
                cm[i] = cm[i - 1] + dm[i] if t[i] == t[i - 1] else dm[i - 1] + dm[i]
            vf = v * np.abs(2 * np.where(cm > 0, dm / cm, 0.0) - 1) * t
    vf = pd.Series(vf, index=d.index)
    ko = ema(vf, f) - ema(vf, sl)
    x = ko - ema(ko, g) if p["rule"] == "신호선" else ko
    return warm(pd.Series(np.where(x > 0, 1.0, -1.0), index=d.index), sl)


def s_frama(d, p):
    """에일러스 FRAMA(2005): 프랙탈 차원 D = (log(N1+N2) − log N3)/log 2, α = exp(−4.6(D−1)) 를 0.01~1 로. 종가는 종가 > FRAMA, 기울기는 FRAMA 상승이면 +1."""
    n, h = p["N"], p["N"] // 2
    hi, lo, pr = d.high, d.low, ((d.high + d.low) / 2).to_numpy(float)
    n1 = ((hi.rolling(h).max() - lo.rolling(h).min()) / h).to_numpy()
    n2 = ((hi.shift(h).rolling(h).max() - lo.shift(h).rolling(h).min()) / h).to_numpy()
    n3 = ((hi.rolling(n).max() - lo.rolling(n).min()) / n).to_numpy()
    f, dim = pr.copy(), 0.0  # 처음 N 봉은 가격 그대로 (원문)
    for i in range(n, len(pr)):
        if n1[i] > 0 and n2[i] > 0 and n3[i] > 0:
            dim = (np.log(n1[i] + n2[i]) - np.log(n3[i])) / np.log(2)
        a = min(max(np.exp(-4.6 * (dim - 1)), 0.01), 1.0)
        f[i] = a * pr[i] + (1 - a) * f[i - 1]
    out = np.where(d.close.to_numpy() > f, 1.0, -1.0) if p["rule"] == "종가" else np.where(f > np.r_[np.inf, f[:-1]], 1.0, -1.0)
    return warm(pd.Series(out, index=d.index), n)


def s_vidya(d, p):
    """챈드 VIDYA(1995): VIDYA = α|CMO| × 종가 + (1 − α|CMO|) × VIDYA₋₁, α = 2/(EMA+1), CMO = (상승 합 − 하락 합)/(상승 합 + 하락 합)."""
    c, n, e = d.close, p["cmo"], p["ema"]
    dl = c.diff()
    up, dn = dl.clip(lower=0).rolling(n).sum(), (-dl).clip(lower=0).rolling(n).sum()
    k = (2 / (e + 1) * ((up - dn) / (up + dn)).abs()).fillna(0.0).to_numpy()
    x = c.to_numpy(float)
    v = x.copy()
    for i in range(1, len(x)):
        v[i] = k[i] * x[i] + (1 - k[i]) * v[i - 1]
    out = np.where(x > v, 1.0, -1.0) if p["rule"] == "종가" else np.where(v > np.r_[np.inf, v[:-1]], 1.0, -1.0)
    return warm(pd.Series(out, index=d.index), max(n, e))


def s_qqe(d, p):
    """QQE: F = EMA5(RSI n), DAR = EMA_w(EMA_w(|ΔF|)) × 배수, w = 2n − 1. 롱 밴드 F − DAR 는 위로만, 숏 밴드 F + DAR 는 아래로만.
    F 가 앞 숏 밴드 위로 가면 상승, 앞 롱 밴드 아래로 가면 하락. 같은쪽은 F 가 50 의 같은 쪽일 때만."""
    n, w = p["n"], 2 * p["n"] - 1
    f = ema(rsi(d.close, n), 5)
    dar, F = (ema(ema(f.diff().abs(), w), w) * p["m"]).to_numpy(), f.to_numpy()
    lb, sb, tr = np.full(len(F), np.nan), np.full(len(F), np.nan), np.zeros(len(F))
    for i in range(1, len(F)):
        tr[i] = tr[i - 1]
        if np.isnan(F[i]) or np.isnan(dar[i]):
            continue
        lo, hi = F[i] - dar[i], F[i] + dar[i]
        lb[i] = max(lb[i - 1], lo) if F[i - 1] > lb[i - 1] and F[i] > lb[i - 1] else lo
        sb[i] = min(sb[i - 1], hi) if F[i - 1] < sb[i - 1] and F[i] < sb[i - 1] else hi
        if F[i] > sb[i - 1]:
            tr[i] = 1.0
        elif F[i] < lb[i - 1]:
            tr[i] = -1.0
    if p["rule"] == "같은쪽":
        tr = np.where((tr > 0) & (F > 50) | (tr < 0) & (F < 50), tr, 0.0)
    return warm(pd.Series(tr, index=d.index), 3 * w)


def s_force(d, p):
    """엘더 포스 인덱스: FI = (종가 − 전 종가) × 거래량. 0선은 EMA(FI, n) 부호.
    눌림목은 종가 22 EMA 가 오르는 동안 FI(2) 가 음수(음전)이거나 음수 다음 다시 양수(재양전)면 롱, 22 EMA 가 내리면 청산. 숏은 거꾸로."""
    c = d.close
    fi = c.diff() * volume(d)
    if p["rule"] == "0선":
        x = ema(fi, p["n"])
        return warm(pd.Series(np.where(x > 0, 1.0, -1.0), index=d.index), p["n"])
    t = ema(c, 22)
    up, dn = (t > t.shift()).to_numpy(), (t < t.shift()).to_numpy()
    f2 = ema(fi, 2).to_numpy()
    neg, pos = f2 < 0, f2 > 0
    if p["entry"] == "음전":
        el, es = neg, pos
    else:
        el, es = pos & np.r_[False, neg[:-1]], neg & np.r_[False, pos[:-1]]
    return warm(pd.Series(machine(len(c), up & el, dn & es, dn, up), index=d.index), 22)


def s_wavetrend(d, p):
    """LazyBear 웨이브트렌드: ci = (ap − EMA(ap, n1)) ÷ (0.015 × EMA(|ap − esa|, n1)), WT1 = EMA(ci, n2), WT2 = WT1 의 4 봉 SMA.
    과열은 −lv 아래에서 WT1 이 WT2 를 위로 넘으면 롱, +lv 위에서 아래로 넘으면 숏, 반대 신호까지 유지."""
    n1, n2 = p["n1"], p["n2"]
    ap = (d.high + d.low + d.close) / 3
    esa = ema(ap, n1)
    w1 = ema((ap - esa) / (0.015 * ema((ap - esa).abs(), n1)).replace(0, np.nan), n2)
    a, b = w1.to_numpy(), sma(w1, 4).to_numpy()
    if p["rule"] == "교차":
        out = np.where(a > b, 1.0, -1.0)
    elif p["rule"] == "0선":
        out = np.where(a > 0, 1.0, -1.0)
    else:
        lv = {"과열60": 60, "과열53": 53}[p["rule"]]
        with np.errstate(invalid="ignore"):
            up = (a > b) & np.r_[False, a[:-1] <= b[:-1]]
            dn = (a < b) & np.r_[False, a[:-1] >= b[:-1]]
            el, es = up & (a < -lv), dn & (a > lv)
        out = machine(len(a), el, es, es, el)
    return warm(pd.Series(out, index=d.index), n1 + n2)


def swma(x):
    """1·2·2·1 대칭 가중 평균 (에일러스)."""
    return (x + 2 * x.shift(1) + 2 * x.shift(2) + x.shift(3)) / 6


def s_rvi(d, p):
    """에일러스 RVI(2002): (종 − 시) 대칭 평균의 n 봉 합 ÷ (고 − 저) 대칭 평균의 n 봉 합, 신호선은 RVI 의 대칭 평균."""
    n = p["n"]
    r = swma(d.close - d.open).rolling(n).sum() / swma(d.high - d.low).rolling(n).sum().replace(0, np.nan)
    x = r - swma(r) if p["rule"] == "신호선" else r
    return warm(pd.Series(np.where(x > 0, 1.0, -1.0), index=d.index), n + 6)


def s_vpci(d, p):
    """도마이어 VPCI(2007) = (VWMA_L − SMA_L) × (VWMA_S ÷ SMA_S) × (거래량 SMA_S ÷ SMA_L). MACD확인은 MACD 히스토그램과 VPCI 부호가 같을 때만."""
    s, l = map(int, p["sl"].split("/"))
    c, v = d.close, volume(d)

    def vw(n):
        return (c * v).rolling(n).sum() / v.rolling(n).sum()

    x = (vw(l) - sma(c, l)) * (vw(s) / sma(c, s)) * (sma(v, s) / sma(v, l))
    if p["rule"] == "0선":
        out = np.where(x > 0, 1.0, -1.0)
    elif p["rule"] == "신호선":
        out = np.where(x > sma(x, s), 1.0, -1.0)
    else:
        m = ema(c, 12) - ema(c, 26)
        h = m - ema(m, 9)
        out = np.where((h > 0) & (x > 0), 1.0, np.where((h < 0) & (x < 0), -1.0, 0.0))
    return warm(pd.Series(out, index=d.index), max(l, 35))


def s_nvi(d, p):
    """포스백 NVI: 거래량이 전 봉보다 줄어든 봉만 수익률을 쌓는다(시작 1000). 부호·롱만은 NVI 대 m EMA, 빠른선은 NVI 9 EMA 대 m EMA."""
    v, r = volume(d), d.close.pct_change().fillna(0.0)
    nvi = 1000 * (1 + r.where(v < v.shift(), 0.0)).cumprod()
    a = ema(nvi, 9) if p["rule"] == "빠른선" else nvi
    out = np.where(a > ema(nvi, p["m"]), 1.0, 0.0 if p["rule"] == "롱만" else -1.0)
    return warm(pd.Series(out, index=d.index), p["m"])


def s_connors(d, p):
    """코너스 RSI(2): 종가 > SMA(t) 이고 RSI(2) < lo 면 롱, 종가 > SMA(5) 면 청산. 숏은 거꾸로. 추세이탈은 SMA(t) 반대편 종가에도 청산."""
    c, t, lo = d.close, sma(d.close, p["t"]), p["lo"]
    r, m5 = rsi(c, 2), sma(c, 5)
    el, es = ((c > t) & (r < lo)).to_numpy(), ((c < t) & (r > 100 - lo)).to_numpy()
    xl, xs = (c > m5).to_numpy(), (c < m5).to_numpy()
    if p["exit"] == "5일선+추세이탈":
        xl, xs = xl | (c < t).to_numpy(), xs | (c > t).to_numpy()
    return warm(pd.Series(machine(len(c), el, es, xl, xs), index=d.index), p["t"])


def s_uo(d, p):
    """윌리엄스 얼티밋 오실레이터: BP = 종가 − min(저가, 전 종가), TR = max(고가, 전 종가) − min(저가, 전 종가), UO = 100 (4 A₁ + 2 A₂ + A₃)/7."""
    n = list(map(int, p["len"].split("/")))
    pc = d.close.shift()
    tl, th = pd.concat([d.low, pc], axis=1).min(axis=1), pd.concat([d.high, pc], axis=1).max(axis=1)
    bp, tr = d.close - tl, (th - tl).replace(0, np.nan)
    a = [bp.rolling(k).sum() / tr.rolling(k).sum() for k in n]
    u = (100 * (4 * a[0] + 2 * a[1] + a[2]) / 7).to_numpy()
    with np.errstate(invalid="ignore"):
        out = np.where(u > 50, 1.0, -1.0) if p["rule"] == "50선" else machine(len(u), u < 30, u > 70, u > 50, u < 50)
    return warm(pd.Series(out, index=d.index), n[2])


def grid(**kw):
    return [dict(zip(kw, v)) for v in itertools.product(*kw.values())]


FAMILIES = {
    "tsmom": dict(name="시계열 모멘텀", fn=s_tsmom, params=grid(L=[7, 14, 28, 56, 91, 182, 365]), default=dict(L=7),
                  sources=["Moskowitz·Ooi·Pedersen (2012) Time series momentum", "Liu·Tsyvinski (2021, RFS) Risks and Returns of Cryptocurrency — 1주 수익이 다음 1~4주를 예측"]),
    "macross": dict(name="이동평균 교차", fn=s_macross, default=dict(pair="50/200", kind="SMA"),
                    params=grid(pair=["1/10", "1/20", "1/50", "1/100", "1/200", "5/20", "5/50", "5/100", "10/50", "10/100", "20/50", "20/100", "20/200", "50/100", "50/200"], kind=["SMA", "EMA"]),
                    sources=["Detzel 외 (2021, Financial Management) Learning and predictability via technical analysis: bitcoin — 5~100일 이동평균", "골든·데드 크로스 50/200"]),
    "donchian": dict(name="돈치안 채널 (터틀)", fn=s_donchian, default=dict(nm="20/10"),
                     params=grid(nm=["10/5", "20/5", "20/10", "55/10", "55/20", "100/20", "100/50"]),
                     sources=["Curtis Faith, Way of the Turtle — System 1 20/10, System 2 55/20"]),
    "macd": dict(name="MACD", fn=s_macd, default=dict(fsk="12/26/9", rule="신호선"),
                 params=grid(fsk=["12/26/9", "8/17/9", "5/35/5", "19/39/9", "24/52/9"], rule=["신호선", "0선"]),
                 sources=["Gerald Appel (1979) 12/26/9"]),
    "rsi": dict(name="RSI", fn=s_rsi, default=dict(n=14, rule="평균회귀", band="30/70", filter="없음"),
                params=grid(n=[2, 7, 14, 21], rule=["모멘텀"], band=["-"], filter=["-"]) + grid(n=[2, 7, 14, 21], rule=["평균회귀"], band=["10/90", "20/80", "30/70"], filter=["없음", "200선"]),
                sources=["J. Welles Wilder (1978) RSI 14, 70/30", "Connors·Alvarez (2008) Short Term Trading Strategies That Work — RSI(2) + 200일선"]),
    "bollinger": dict(name="볼린저 밴드", fn=s_bollinger, default=dict(n=20, k=2.0, rule="평균회귀"),
                      params=grid(n=[10, 20, 50], k=[1.5, 2.0, 2.5], rule=["평균회귀", "돌파"]), sources=["John Bollinger, Bollinger on Bollinger Bands — 20, 2"]),
    "supertrend": dict(name="슈퍼트렌드", fn=s_supertrend, default=dict(atr=10, mult=3.0),
                       params=grid(atr=[7, 10, 14, 20], mult=[1.5, 2.0, 3.0, 4.0]), sources=["Olivier Seban 슈퍼트렌드, 흔한 기본값 ATR 10 · 배수 3 (TradingView 등)"]),
    "ichimoku": dict(name="일목균형표", fn=s_ichimoku, default=dict(set="20/60/120/30", rule="구름"),
                     params=grid(set=["9/26/52/26", "20/60/120/30", "10/30/60/30"], rule=["구름", "전환기준", "둘 다"]),
                     sources=["호소다 고이치 9/26/52/26", "코인용 20/60/120/30 (24시간 시장, TradingView 글들)"]),
    "psar": dict(name="파라볼릭 SAR", fn=s_psar, default=dict(step=0.02, max=0.2),
                 params=grid(step=[0.01, 0.02, 0.03], max=[0.1, 0.2, 0.3]), sources=["J. Welles Wilder (1978) 가속 0.02 · 최대 0.2"]),
    "reversal": dict(name="단기 반전", fn=s_reversal, default=dict(L=1, q=0),
                     params=grid(L=[1, 2, 3, 5, 7], q=[0, 1, 2]), sources=["Jegadeesh (1990) 단기 반전", "코인 일·주 단위 반전 (Liu·Tsyvinski 2021 은 반대로 모멘텀을 보고)"]),
    "adx": dict(name="ADX·DMI", fn=s_adx, default=dict(n=14, thr=25),
                params=grid(n=[7, 14, 21], thr=[15, 20, 25, 30]), sources=["J. Welles Wilder (1978) 14, 추세 기준 25"]),
    "keltner": dict(name="켈트너 채널", fn=s_keltner, default=dict(n=20, atr=10, mult=2.0, rule="돌파"),
                    params=grid(n=[10, 20, 50], atr=[10, 20], mult=[1.5, 2.0, 2.5], rule=["돌파", "평균회귀"]),
                    sources=["Linda Raschke 현대식 켈트너 채널 (가운데 EMA, 폭 ATR)", "StockCharts ChartSchool 기본 20·2.0·10"]),
    "stoch": dict(name="스토캐스틱", fn=s_stoch, default=dict(n=14, rule="교차", band="-"),
                  params=grid(n=[5, 14, 21], rule=["교차"], band=["-"]) + grid(n=[5, 14, 21], rule=["평균회귀"], band=["20/80", "25/75"]),
                  sources=["George Lane 스토캐스틱 14·3·3, 과매수 80·과매도 20 (StockCharts ChartSchool)"]),
    "aroon": dict(name="아룬", fn=s_aroon, default=dict(n=25, rule="교차"),
                  params=grid(n=[14, 25, 50], rule=["교차", "강한"]), sources=["Tushar Chande (1995, Technical Analysis of Stocks & Commodities) 25"]),
    "kama": dict(name="카우프만 적응 이동평균 (KAMA)", fn=s_kama, default=dict(er=10, slow=30, rule="종가교차"),
                 params=grid(er=[5, 10, 20], slow=[20, 30, 50], rule=["종가교차", "기울기"]),
                 sources=["Perry Kaufman, Smarter Trading (1995) — KAMA(10, 2, 30) (StockCharts ChartSchool)"]),
    "heikin": dict(name="하이킨아시", fn=s_heikin, default=dict(m=1),
                   params=grid(m=[1, 2, 3]), sources=["Dan Valcu (2004, Technical Analysis of Stocks & Commodities) Using the Heikin-Ashi Technique"]),
    "cci": dict(name="CCI", fn=s_cci, default=dict(n=20, rule="돌파"), params=grid(n=[14, 20, 40], rule=["돌파", "0선", "평균회귀"]),
                sources=["Donald Lambert (1980, Commodities) Commodity Channel Index — 20, ±100", "StockCharts ChartSchool CCI"]),
    "hull": dict(name="헐 이동평균", fn=s_hull, default=dict(n=20, rule="기울기"), params=grid(n=[9, 16, 20, 55, 100], rule=["기울기", "종가교차"]),
                 sources=["Alan Hull (2005) — 기울기로 방향을 본다", "TA-Lib 기본 20, Capital.com 16"]),
    "trix": dict(name="TRIX", fn=s_trix, default=dict(n=15, rule="신호선"), params=grid(n=[9, 12, 15, 18, 30], rule=["0선", "신호선"]),
                 sources=["Jack Hutson (1983, TASC) Good TRIX — 15, 신호선 9 (StockCharts ChartSchool)"]),
    "obv": dict(name="OBV", fn=s_obv, default=dict(n=20), params=grid(n=[10, 20, 50, 100]),
                sources=["Joseph Granville (1963) On-Balance Volume", "누적 지표에 이동평균 기준선 (TradingView)"]),
    "cmf": dict(name="차이킨 머니 플로", fn=s_cmf, default=dict(n=21, th=0.0), params=grid(n=[10, 21, 50], th=[0.0, 0.05, 0.1]),
                sources=["Marc Chaikin, Chaikin Money Flow — Fidelity 21일, 0선 위 강세"]),
    "mfi": dict(name="머니 플로 지수", fn=s_mfi, default=dict(n=14, rule="평균회귀", band="20/80"),
                params=grid(n=[7, 14, 21], rule=["모멘텀"], band=["-"]) + grid(n=[7, 14, 21], rule=["평균회귀"], band=["20/80", "10/90"]),
                sources=["Gene Quong·Avrum Soudack (1989, TASC) Money Flow Index — 14, 80/20"]),
    "squeeze": dict(name="TTM 스퀴즈", fn=s_squeeze, default=dict(n=20, mult=1.5, exit="2봉약화"),
                    params=grid(n=[10, 20, 30], mult=[1.0, 1.5, 2.0], exit=["2봉약화", "0선", "10봉"]),
                    sources=["John Carter, Mastering the Trade (2005) — TTM Squeeze, 두 봉 색이 바뀌면 청산", "StockCharts ChartSchool TTM Squeeze — 기본 (20, 2.0, 20, 1.5, 20), 8~10봉 간다"]),
    "vortex": dict(name="보텍스 지표", fn=s_vortex, default=dict(n=14, rule="교차"), params=grid(n=[7, 14, 21, 34, 55], rule=["교차", "차이"]),
                   sources=["Botes·Siepman (2010, Technical Analysis of Stocks & Commodities 28:1) The Vortex Indicator — 예시 14, 피보나치 기간 권장, 교차에 들고 반대 교차에 정리"]),
    "alligator": dict(name="앨리게이터", fn=s_alligator, default=dict(scale=1, rule="정렬"), params=grid(scale=[1, 2, 3], rule=["정렬", "입술·턱", "종가·턱"]),
                      sources=["Bill Williams, Trading Chaos (1995) — 중간가 SMMA 13·8·5 를 8·5·3 봉 앞으로, 얽히면 쉬고 벌어지면 든다", "StockCharts ChartSchool Alligator"]),
    "elder": dict(name="엘더 임펄스", fn=s_elder, default=dict(ema=13, macd="12/26/9", blue="셋값"),
                  params=grid(ema=[13, 26], macd=["12/26/9", "24/52/18"], blue=["셋값", "유지"]),
                  sources=["Alexander Elder, Come Into My Trading Room (2002) — EMA 13 기울기 + MACD 히스토그램 기울기", "StockCharts ChartSchool Elder Impulse System — 녹색·빨강·파랑, 조심해 들고 빨리 나간다"]),
    "chandelier": dict(name="샹들리에 청산", fn=s_chandelier, default=dict(n=22, k=3.0), params=grid(n=[10, 22, 50], k=[2.0, 3.0, 4.0]),
                       sources=["Chuck LeBeau (System Traders Club), Alexander Elder, Come Into My Trading Room (2002) — 22봉, ATR 3배", "TradingView Chandelier Exit (everget) — 방향 뒤집기, 한쪽으로만 움직이는 손절"]),
    "kalman": dict(name="칼만 필터 추세", fn=s_kalman, default=dict(q=1e-4, rule="기울기"), params=grid(q=[1e-3, 1e-4, 1e-5, 1e-6], rule=["기울기", "가격대비"]),
                   sources=["Kalman (1960); Harvey (1989) Forecasting, Structural Time Series Models and the Kalman Filter — 국소 선형 추세", "Benhamou (2018, arXiv 1808.03297) Trend without hiccups: a Kalman filter approach"]),
    "tdseq": dict(name="TD 시퀀셜", fn=s_tdseq, default=dict(signal="셋업9", dir="역추세", hold="반대신호"),
                  params=grid(signal=["셋업9", "카운트다운13"], dir=["역추세", "추세"], hold=[4, 9, "반대신호"]),
                  sources=["Tom DeMark, The New Science of Technical Analysis (1994) — 셋업 9(4봉 전 종가), 카운트다운 13(2봉 전 저·고가)", "LuxAlgo·NexusFi TD Sequential 정리 — 지친 추세의 반전 신호"]),
    "gausschan": dict(name="가우시안 채널", fn=s_gausschan, default=dict(P=144, rule="상단돌파", mult=1.414),
                      params=grid(P=[89, 144, 233], rule=["상단돌파", "필터까지"], mult=[1.414, 2.0]) + grid(P=[89, 144, 233], rule=["기울기"], mult=["-"]),
                      sources=["John Ehlers, Gaussian and Other Low Lag Filters (MESA) — N 극 가우시안 필터", "Donovan Wall, Gaussian Channel [DW] (TradingView) — hlc3, 극 4·기간 144·배수 1.414", "SM-021 Gaussian Channel Strategy (TradingView) — 필터 상승 + 위 띠 위면 롱, 위 띠 아래면 청산"]),
    "clenow": dict(name="클레나우 회귀 모멘텀", fn=s_clenow, default=dict(n=90, r=0.0), params=grid(n=[30, 60, 90, 120], r=[0.0, 0.3, 0.5, 0.7]),
                   sources=["Andreas Clenow, Stocks on the Move (2015) — 로그 가격 90일 회귀 기울기 × R²", "quant-investing.com — Clenow 모멘텀 정리", "반론: Chris Chow (2018) How (Not) to Invest: Clenow Momentum — 5일 뒤 수익과 상관 없음"]),
    "stc": dict(name="샤프 추세 주기 (STC)", fn=s_stc, default=dict(fs="23/50", cycle=10, rule="문턱"),
                params=grid(fs=["23/50", "12/26", "46/100"], cycle=[10, 20], rule=["문턱", "50선"]),
                sources=["Doug Schaff (1999) Schaff Trend Cycle — EMA 23·50 MACD 에 10봉 스토캐스틱 두 번, 0.5 평활", "LuxAlgo·Barchart·NexusFi — 25 상향 돌파 상승, 75 하향 돌파 하락, 0·100 에 붙으면 추세 지속"]),
    "fisher": dict(name="피셔 변환", fn=s_fisher, default=dict(n=10, rule="교차"), params=grid(n=[10, 20, 50, 100], rule=["교차", "0선"]),
                   sources=["John Ehlers (2002-11, Technical Analysis of Stocks & Commodities) Using the Fisher Transform — 10봉, 0.33·0.67 평활, 신호선 = 전 봉", "MotiveWave·TC2000 Fisher Transform — 신호선 교차가 추세 전환"]),
    "coppock": dict(name="코폭 곡선", fn=s_coppock, default=dict(scale=30, rule="바닥반등"), params=grid(scale=[1, 7, 30], rule=["0선", "바닥반등", "기울기"]),
                    sources=["Edwin Coppock (Barron's, 1962) — 월봉 ROC 14 + ROC 11 의 10봉 가중평균, 0 아래에서 고개를 들면 매수", "TA-Lib COPPOCK·StockCharts ChartSchool Coppock Curve — 0선 교차를 매수·매도로 쓰기도, 일봉 (20,10,10)", "MotiveWave Coppock Curve — 일봉 294·231·210(월봉 × 21)"]),
    "chop": dict(name="초피니스 지수", fn=s_chop, default=dict(n=14, th=38.2, rule="추세만"), params=grid(n=[14, 28, 56], th=[38.2, 50, 61.8], rule=["추세만", "유지"]),
                 sources=["E.W. \"Bill\" Dreiss, Choppiness Index — 100 log10(Σ TR ÷ 범위) ÷ log10(n), 기본 14", "LuxAlgo·Barchart·TradingView Choppiness Index — 38.2 아래 추세장, 61.8 위 횡보장, 방향은 없다"]),
    "renko": dict(name="렌코", fn=s_renko, default=dict(size="ATR×1", rev=2), params=grid(size=["2%", "4%", "8%", "ATR×1", "ATR×2", "ATR×3"], rev=[1, 2]),
                  sources=["Steve Nison, Beyond Candlesticks (1994) — 렌가(벽돌) 차트", "LuxAlgo·NexusFi·CrossTrade Renko — 벽돌 크기 고정폭 또는 ATR(14), 방향 전환은 2 벽돌"]),
    "mama": dict(name="MESA 적응 이동평균 (MAMA)", fn=s_mama, default=dict(limits="0.5/0.05", rule="교차"),
                 params=grid(limits=["0.5/0.05", "0.5/0.01", "0.25/0.025", "0.1/0.01"], rule=["교차", "종가"]),
                 sources=["John Ehlers (2001-09, Technical Analysis of Stocks & Commodities) MAMA — The Mother of Adaptive Moving Averages — 빠름 0.5·느림 0.05, FAMA = α/2, 교차가 신호", "TA-Lib MAMA·LuxAlgo MAMA/FAMA 정리"]),
    "kst": dict(name="노우 슈어 싱 (KST)", fn=s_kst, default=dict(set="일", rule="신호선"), params=grid(set=["일", "주", "월"], rule=["신호선", "0선"]),
                sources=["Martin J. Pring, Know Sure Thing — ROC 네 개 평균의 1·2·3·4 가중합, 신호선 9", "StockCharts ChartSchool Pring's KST — 일봉 10·15·20·30/10·10·10·15, 주봉 10·13·15·20/10·13·15·20, 월봉 9·12·18·24/6·6·6·9, 신호선 교차가 가장 믿을 만하다"]),
    "klinger": dict(name="클링거 거래량 오실레이터", fn=s_klinger, default=dict(vf="원식", speed="34/55/13", rule="신호선"),
                    params=grid(vf=["원식", "단순"], speed=["34/55/13", "13/21/8"], rule=["신호선", "0선"]),
                    sources=["Stephen J. Klinger (1997, Technical Analysis of Stocks & Commodities) — KO = EMA34(VF) − EMA55(VF), 신호선 EMA13", "TradingView 도움말 Klinger Oscillator — 신호선 교차·0선", "LuxAlgo Klinger Volume Oscillator — abs(2 dm/cm − 1)", "TradingView 내장 스크립트 — hlc3 방향 × 거래량 단순형, 단타용 13·21·8"]),
    "frama": dict(name="프랙탈 적응 이동평균 (FRAMA)", fn=s_frama, default=dict(N=16, rule="종가"), params=grid(N=[16, 32, 64, 128], rule=["종가", "기울기"]),
                  sources=["John Ehlers (2005-10, Technical Analysis of Stocks & Commodities) FRAMA — Fractal Adaptive Moving Average — D = (log(N1+N2) − log N3)/log 2, α = exp(−4.6(D−1)) 0.01~1, N 16"]),
    "vidya": dict(name="VIDYA (가변 지수 동적 평균)", fn=s_vidya, default=dict(cmo=9, ema=20, rule="종가"), params=grid(cmo=[9, 20], ema=[12, 20, 50, 100], rule=["종가", "기울기"]),
                  sources=["Tushar Chande (1992, Technical Analysis of Stocks & Commodities; 1995-10 CMO 판) VIDYA — α|CMO| 로 EMA 속도를 바꾼다", "MetaTrader 5 도움말 VIDYA — CMO = (UpSum − DnSum)/(UpSum + DnSum)", "TradingView 공개 스크립트 VIDYA (Chande) — CMO 9"]),
    "qqe": dict(name="QQE (정량·정성 추정)", fn=s_qqe, default=dict(n=14, m=4.236, rule="추세선"), params=grid(n=[14, 20], m=[2.618, 4.236], rule=["추세선", "같은쪽"]),
                sources=["LuxAlgo QQE 정리 — F = EMA5(RSI14), DAR = EMA_w(EMA_w(|ΔF|)) × 4.236, w = 2n − 1, 추세선 교차·50선 같은 쪽", "빠른 선 배수 2.618 변형", "TradingView 공개 스크립트 — RSI 20 예"]),
    "force": dict(name="포스 인덱스", fn=s_force, default=dict(rule="0선", n=13, entry="-"),
                  params=grid(rule=["0선"], n=[2, 13, 50, 100], entry=["-"]) + grid(rule=["눌림목"], n=["-"], entry=["음전", "재양전"]),
                  sources=["Alexander Elder, Trading for a Living (1993) — Force Index = (종가 − 전 종가) × 거래량, 13 EMA", "StockCharts ChartSchool Force Index — 0선, 100 봉 중장기 추세, 22일 EMA 가 오를 때 2일 FI 음수는 눌림목 매수"]),
    "wavetrend": dict(name="웨이브트렌드", fn=s_wavetrend, default=dict(n1=10, n2=21, rule="교차"), params=grid(n1=[10, 20], n2=[21, 42], rule=["교차", "0선", "과열60", "과열53"]),
                      sources=["LazyBear, WaveTrend Oscillator (TradingView) — 채널 10·평균 21, WT2 = WT1 의 4 SMA, ±60·±53", "Medium·ProRealCode·LuxAlgo 정리 — −60 아래 교차 매수, +60 위 교차 매도"]),
    "rvi": dict(name="상대 활력 지수 (RVI)", fn=s_rvi, default=dict(n=10, rule="신호선"), params=grid(n=[5, 10, 20, 40], rule=["신호선", "0선"]),
                sources=["John Ehlers (2002-01, Technical Analysis of Stocks & Commodities) Relative Vigor Index — (종 − 시) ÷ (고 − 저), 1·2·2·1 대칭 가중, n 10, 신호선 교차", "MetaTrader·TradingView RVGI 같은 식"]),
    "vpci": dict(name="거래량-가격 확인 지표 (VPCI)", fn=s_vpci, default=dict(sl="5/20", rule="0선"), params=grid(sl=["5/20", "10/50"], rule=["0선", "신호선", "MACD확인"]),
                 sources=["Buff Dormeier (2007-07, Technical Analysis of Stocks & Commodities) Volume Price Confirmation Indicator — VPC × VPR × VM, MACD 교차 확인", "MetaStock Traders' Tips 10·50, 커뮤니티 5·20 (LuxAlgo 정리)"]),
    "nvi": dict(name="음의 거래량 지수 (NVI)", fn=s_nvi, default=dict(m=255, rule="부호"), params=grid(m=[100, 255], rule=["부호", "롱만", "빠른선"]),
                sources=["Norman Fosback, Stock Market Logic (1976) — NVI 가 255일 EMA 위면 강세장 확률 96%, 아래면 약세장 53%", "StockCharts ChartSchool NVI — 휩소가 많아 9 EMA 와 255 EMA 교차"]),
    "connors": dict(name="코너스 RSI(2)", fn=s_connors, default=dict(lo=10, t=200, exit="5일선"),
                    params=grid(lo=[5, 10], t=[100, 200], exit=["5일선", "5일선+추세이탈"]),
                    sources=["Larry Connors·Cesar Alvarez, Short Term Trading Strategies That Work (2008) — 200일선 위 RSI(2) < 10 매수, 5일선 위 청산", "StockCharts ChartSchool RSI(2) — 숏은 거꾸로, 엄격한 5"]),
    "uo": dict(name="얼티밋 오실레이터", fn=s_uo, default=dict(len="7/14/28", rule="평균회귀"), params=grid(len=["7/14/28", "4/8/16", "14/28/56"], rule=["평균회귀", "50선"]),
               sources=["Larry Williams (1976, 1985 Technical Analysis of Stocks & Commodities) Ultimate Oscillator — 7·14·28, 가중 4·2·1, 70·30", "LuxAlgo·Capital.com·Barchart 정리 — 4·8·16, 14·28·56 설정"]),
}
MODES = ["선물 롱숏", "선물 롱만", "현물 롱만"]


class Family:
    """run.py 가 쓰는 단계 모양으로 감싼다."""
    CHUNK = "tf"

    def __init__(self, key):
        f = FAMILIES[key]
        self.key, self.NAME, self.SOURCES, self.DEFAULT = key, f["name"], f["sources"], dict(tf="1d", mode="선물 롱숏", **f["default"])
        keys = list(f["params"][0])
        self.GRID = {"tf": ["1d", "4h"], "mode": MODES, **{k: list(dict.fromkeys(p[k] for p in f["params"])) for k in keys}}
        self.UNITS = [{"name": m, "bench": "현물봇" if m == "현물 롱만" else "F0", "where": (lambda c, m=m: c["mode"] == m)} for m in MODES]

    def default(self, unit):
        return {**self.DEFAULT, "mode": unit["name"]}

    def tasks(self):
        return [(self.key, "1d", "perp"), (self.key, "4h", "perp"), (self.key, "1d", "spot")]



def task(arg):
    key, tf, market = arg
    f, n = FAMILIES[key], len(days())
    data = [(perp(s, tf) if market == "perp" else upbit(s)) for s in SYMBOLS]
    modes = ["선물 롱숏", "선물 롱만"] if market == "perp" else ["현물 롱만"]
    cfgs, G, T, N = [], [], [], []
    for p in f["params"]:
        sig = [f["fn"](d, p).fillna(0.0).clip(-1, 1) for d in data]
        for mode in modes:
            per = [to_daily(day_codes(d.index), n, *positions(d, s if mode == "선물 롱숏" else s.clip(lower=0), funding=market == "perp")) for d, s in zip(data, sig)]
            g, t, c = combine(per)
            cfgs.append(dict(tf=tf, mode=mode, **p))
            G.append(g), T.append(t), N.append(c)
    return cfgs, np.array(G), np.array(T), np.array(N)
