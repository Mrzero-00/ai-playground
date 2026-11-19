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
