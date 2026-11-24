"""장 판별 루프 2 (RESEARCH.md '장 판별 루프 2 등록'). BTC·ETH, Coin Metrics 일별 종가 2010~, 종가만 쓰는 판별기.
찾기 2018~2021, 확인 2022 ~ 2026-11, 새 시험 2017년 이전(--test 로 한 번만).
사용법: python3 scripts/lab/regime_loop2.py <회차>   → data/lab/regime_loop2.json
        python3 scripts/lab/regime_loop2.py --test <판별기 이름>
"""
import json
import sys
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from indicators import sma
from others import s_hmm
from regime import WARM, acc_stats, lam_label, lam_realtime, near_change
from regime_loop import hold

SYMS = ["BTC", "ETH"]
SPANS = {"찾기": ("2018-01-01", "2021-12-31"), "확인": ("2022-01-01", "2026-11-22"), "시험": ("2010-01-01", "2017-12-31")}
OUT = C.OUT / "regime_loop2.json"


def load(sym):
    d = pd.read_csv(C.ML / f"cmprice_{sym}.csv", parse_dates=["date"], index_col="date").astype(float)
    return d[d.index <= "2026-11-22"]


def ens(c):
    return sum((c > sma(c, n)).astype(float) for n in (20, 50, 100, 200)) / 4


def on_bars(c, days, fn):
    """days 일 봉 종가로 fn(종가) → 상태, 봉이 끝난 다음 날부터 일봉에 펼친다."""
    b = c.resample(f"{days}D", origin="start").last().dropna()
    st = pd.Series(np.asarray(fn(b)), index=b.index + pd.Timedelta(days=days))
    return st.reindex(c.index, method="ffill").fillna(0).astype(int).to_numpy()


def weinstein(c, weeks):
    w = c.resample("W-SUN").last()
    m = w.rolling(weeks).mean()
    raw = np.where((w > m) & (m > m.shift()), 1, np.where((w < m) & (m < m.shift()), -1, 0))
    st = pd.Series(hold(raw, 0), index=w.index + pd.Timedelta(days=1))
    return st.reindex(c.index, method="ffill").fillna(0).astype(int).to_numpy()


def base(c):
    def vote(ns):
        return hold(np.sign(sum(np.sign(c / c.shift(n) - 1).fillna(0) for n in ns)).astype(int).to_numpy(), 0)
    x = c.to_numpy()
    return {"지난 60일 수익": np.where(c / c.shift(60) > 1, 1, -1), "200일선": np.where(c > sma(c, 200), 1, -1),
            "앙상블 비중": np.where(ens(c) > 0.5, 1, -1), "실시간 λ 20%": lam_realtime(x, 0.2), "실시간 λ 30%": lam_realtime(x, 0.3),
            "와인스타인 30주선": weinstein(c, 30), "모멘텀 합의 63·126·252": vote((63, 126, 252))}


def iter1(c):
    out = {}
    for days, nm in ((3, "3일봉"), (7, "주봉")):
        out[f"{nm} 실시간 λ 20%"] = on_bars(c, days, lambda b: lam_realtime(b.to_numpy(), 0.2))
        out[f"{nm} 앙상블 비중"] = on_bars(c, days, lambda b: np.where(ens(b) > 0.5, 1, -1))
    return out


def regression(c, n, r2min=0.5):
    y = np.log(c.to_numpy())
    t = np.arange(n) - (n - 1) / 2
    out, st = np.zeros(len(y), int), 0
    for i in range(n - 1, len(y)):
        w = y[i - n + 1:i + 1]
        b = (t @ (w - w.mean())) / (t @ t)
        resid = w - w.mean() - b * t
        r2 = 1 - (resid @ resid) / ((w - w.mean()) @ (w - w.mean())) if w.var() > 0 else 0
        if r2 >= r2min:
            st = 1 if b > 0 else -1
        out[i] = st
    return out


def iter2(c):
    return {f"회귀 {n}일 (R² ≥ 0.5)": regression(c, n) for n in (90, 180)}


def iter3(c):
    d = pd.DataFrame({"close": c})
    return {f"마르코프 2상태 {w}일": s_hmm(d, {"W": w, "K": 2}, None).astype(int).to_numpy() for w in (365, 730)}


DOWN_T, UP_T = 1 - 0.7 ** 0.5, 1.3 ** 0.5 - 1  # 16.3%, 14.0% — 정답 λ 30% 에서 계산


def bayes_rw(x, lam=0.3, dn=DOWN_T, up=UP_T):
    """맥락은 실시간 λ 확인으로, 맥락 안에서는 기준 극값과의 거리로. 상승 맥락: 낙폭 < dn 이면 상승. 하락 맥락: 반등 ≥ up 이면 상승."""
    n = len(x)
    out, ctx, hi, lo = np.zeros(n, int), 0, x[0], x[0]
    for i in range(n):
        hi, lo = max(hi, x[i]), min(lo, x[i])
        if ctx >= 0 and x[i] <= hi * (1 - lam):
            ctx, lo = -1, x[i]
        elif ctx <= 0 and x[i] >= lo * (1 + lam):
            ctx, hi = 1, x[i]
        if ctx == 1:
            out[i] = 1 if x[i] > hi * (1 - dn) else -1
        elif ctx == -1:
            out[i] = 1 if x[i] >= lo * (1 + up) else -1
    return out


def iter4(c):
    return {"정답에서 계산한 문턱 (−16.3% / +14.0%)": bayes_rw(c.to_numpy())}


def random_walk_check(n_paths=200, n=2000, vol=0.04, seed=0):
    """예측할 거리가 없을 때(표류 0 무작위 걸음) 같은 규칙의 균형 정확도."""
    rng = np.random.default_rng(seed)
    p_all, l_all = [], []
    for _ in range(n_paths):
        x = np.exp(np.cumsum(rng.normal(0, vol, n)))
        lab = lam_label(x, 0.3)
        p = bayes_rw(x)
        p_all.append(p[WARM:]); l_all.append(lab[WARM:])
    p, l = np.concatenate(p_all), np.concatenate(l_all)
    return acc_stats(p, l, np.zeros(len(l), bool), (1, -1))["균형 정확도"]


L_DN, L_UP = np.log(1 / 0.7), np.log(1.3)


def p_upper_first(u, l, mu, var):
    """표류 mu·분산 var 브라운 운동이 위 u 거리에 아래 l 거리보다 먼저 닿을 확률. mu ≈ 0 이면 l/(u+l)."""
    k = 2 * mu / var if var > 0 else 0.0
    if abs(k * (u + l)) < 1e-8:
        return l / (u + l)
    return (1 - np.exp(-k * l)) / (1 - np.exp(-k * (u + l)))


def context_prob(x, mu=None, var=None):
    """날마다 '정답이 상승일' 확률. 맥락은 실시간 λ 30%. 상승 맥락: 고점 M 을 M×0.7 보다 먼저 다시 넘을 확률. 하락 맥락: 저점 m 을 다시 깨기보다 m×1.3 에 먼저 닿을 확률."""
    n = len(x)
    pr, ctx, hi, lo = np.full(n, np.nan), 0, x[0], x[0]
    for i in range(n):
        hi, lo = max(hi, x[i]), min(lo, x[i])
        if ctx >= 0 and x[i] <= hi * (1 - 0.3):
            ctx, lo = -1, x[i]
        elif ctx <= 0 and x[i] >= lo * (1 + 0.3):
            ctx, hi = 1, x[i]
        m, v = (0.0, 1.0) if mu is None else (mu[i], var[i])
        if np.isnan(m) or np.isnan(v):
            m, v = 0.0, 1.0
        if ctx == 1:
            a = np.log(hi / x[i])
            pr[i] = p_upper_first(a, max(L_DN - a, 1e-9), m, v)
        elif ctx == -1:
            a = np.log(x[i] / lo)
            pr[i] = p_upper_first(max(L_UP - a, 1e-9), a, m, v)
    return pr


def iter5(c):
    r = np.log(c).diff()
    out = {}
    for w in (365, 90):
        pr = context_prob(c.to_numpy(), r.rolling(w).mean().to_numpy(), r.rolling(365).var().to_numpy())
        out[f"표류 넣은 확률 (표류 {w}일)"] = np.where(np.isnan(pr), 0, np.where(pr > 0.5, 1, -1))
    return out


def iter6(c):
    pr = context_prob(c.to_numpy())
    e = np.where(ens(c) > 0.5, 1, -1)
    out = np.where(np.isnan(pr), 0, np.where(pr > 0.6, 1, np.where(pr < 0.4, -1, e)))
    return {"위치 + 애매하면 앙상블": out}


_P7 = {}


def iter7(c):
    if not _P7:
        for s in SYMS:
            cc = load(s).close
            _P7[s] = pd.DataFrame({"st": bayes_rw(cc.to_numpy()), "p": context_prob(cc.to_numpy())}, index=cc.index)
    own = pd.DataFrame({"st": bayes_rw(c.to_numpy()), "p": context_prob(c.to_numpy())}, index=c.index)
    btc = _P7["BTC"].reindex(c.index)
    is_btc = own["st"].equals(_P7["BTC"].reindex(c.index)["st"]) and len(c) == len(_P7["BTC"])
    lead = own["st"] if is_btc else np.where(btc["st"].notna() & (btc["st"] != own["st"]), btc["st"].fillna(0), own["st"])
    pm = (own["p"] + btc["p"].fillna(own["p"])) / 2
    return {"BTC 주도 (엇갈리면 BTC)": np.asarray(lead, int), "두 코인 확률 평균": np.where(pm.isna(), 0, np.where(pm > 0.5, 1, -1))}


def drift_prob(c, w=365):
    r = np.log(c).diff()
    return context_prob(c.to_numpy(), r.rolling(w).mean().to_numpy(), r.rolling(365).var().to_numpy())


def iter8(c):
    pr, e = drift_prob(c), np.where(ens(c) > 0.5, 1, -1)
    return {"표류 + 애매하면 앙상블": np.where(np.isnan(pr), 0, np.where(pr > 0.6, 1, np.where(pr < 0.4, -1, e)))}


def iter9(c):
    pr = context_prob(c.to_numpy())
    r = np.log(c).diff()
    dn = np.sqrt((r.clip(upper=0) ** 2).rolling(60).mean())
    up = np.sqrt((r.clip(lower=0) ** 2).rolling(60).mean())
    v = np.where(dn < up, 1, -1)
    return {"위치 + 애매하면 변동성 비율": np.where(np.isnan(pr), 0, np.where(pr > 0.6, 1, np.where(pr < 0.4, -1, v)))}


def iter10(c):
    p1, p2, w = context_prob(c.to_numpy()), drift_prob(c), ens(c).to_numpy()
    pm = (p1 + p2 + w) / 3
    return {"확률 평균 (위치·표류·앙상블)": np.where(np.isnan(pm), 0, np.where(pm > 0.5, 1, -1))}


HALVINGS = pd.to_datetime(["2008-11-28", "2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20"])  # 2008 은 첫 반감기 4년 전 가상


def halving_calendar(idx, top=15, bottom=27):
    """마지막 반감기 + top 개월 ~ + bottom 개월은 하락(−1), 나머지 상승(1)."""
    out = np.ones(len(idx), int)
    for h in HALVINGS:
        a, b = h + pd.DateOffset(months=top), h + pd.DateOffset(months=bottom)
        out[np.asarray((idx >= a) & (idx < b))] = -1
    return out


def iter11(c):
    return {"반감기 달력 (+15개월 ~ +27개월 하락)": halving_calendar(c.index)}


def iter12(c):
    pr, cal = drift_prob(c), halving_calendar(c.index)
    pm = (pr + (cal == 1)) / 2
    return {"위치 + 애매하면 반감기 달력": np.where(np.isnan(pr), 0, np.where(pr > 0.6, 1, np.where(pr < 0.4, -1, cal))),
            "위치·달력 확률 평균": np.where(np.isnan(pm), 0, np.where(pm > 0.5, 1, -1))}


_CHAIN = {}


def chain(sym):
    if sym not in _CHAIN:
        d = pd.read_csv(C.ML / f"cmchain_{sym}.csv", parse_dates=["date"], index_col="date")
        d.index = d.index + pd.Timedelta(days=1)  # D 날짜 값은 D+1 부터 (하루 늦게)
        _CHAIN[sym] = d
    return _CHAIN[sym]


def which(c):
    """종가 줄이 어느 코인인지 (첫 날짜로)."""
    return "BTC" if c.index[0].year == 2010 else "ETH"


def ambiguous(c, other):
    pr = drift_prob(c)
    return np.where(np.isnan(pr), 0, np.where(pr > 0.6, 1, np.where(pr < 0.4, -1, other)))


def iter13(c):
    mv = chain(which(c)).CapMVRVCur.reindex(c.index).ffill().to_numpy()
    e = np.where(ens(c) > 0.5, 1, -1)
    other = np.where(mv >= 3.5, -1, np.where(mv <= 1, 1, e))
    return {"위치 + 애매하면 MVRV": ambiguous(c, other)}


def hash_recovery(idx):
    """해시 리본 회복 뒤 가격 10 > 20 평균인 첫날 (BTC 해시레이트·BTC 가격)."""
    hr = chain("BTC").HashRate.reindex(idx).ffill()
    px = load("BTC").close.reindex(idx).ffill()
    cap = (hr.rolling(30).mean() < hr.rolling(60).mean()).to_numpy()
    mom = (sma(px, 10) > sma(px, 20)).to_numpy()
    sig, was, armed = np.zeros(len(idx), bool), False, False
    for i in range(len(idx)):
        if cap[i]:
            was, armed = True, False
        elif was:
            was, armed = False, True
        if armed and mom[i]:
            sig[i], armed = True, False
    return sig


def iter14(c):
    base8 = iter8(c)["표류 + 애매하면 앙상블"].copy()
    x = c.to_numpy()
    sig = hash_recovery(c.index)
    recent = pd.Series(sig, index=c.index).rolling(30, min_periods=1).max().astype(bool).to_numpy()
    ctx, hi, lo = 0, x[0], x[0]
    for i in range(len(x)):
        hi, lo = max(hi, x[i]), min(lo, x[i])
        if ctx >= 0 and x[i] <= hi * 0.7:
            ctx, lo = -1, x[i]
        elif ctx <= 0 and x[i] >= lo * 1.3:
            ctx, hi = 1, x[i]
        if ctx == -1 and recent[i]:
            base8[i] = 1
    return {"8회차 + 하락 맥락 해시 리본 회복": base8}


def iter15(c):
    a = chain(which(c)).AdrActCnt.reindex(c.index).ffill()
    other = np.where(a.rolling(30).mean() > a.rolling(365).mean(), 1, -1)
    return {"위치 + 애매하면 활성 주소 추세": ambiguous(c, other)}


ITERS = {0: base, 1: iter1, 2: iter2, 3: iter3, 4: iter4, 5: iter5, 6: iter6, 7: iter7, 8: iter8, 9: iter9, 10: iter10, 11: iter11, 12: iter12,
         13: iter13, 14: iter14, 15: iter15}


def iter16(c):
    mm = (c / sma(c, 200)).to_numpy()
    e = np.where(ens(c) > 0.5, 1, -1)
    with np.errstate(invalid="ignore"):
        other = np.where(mm >= 2.4, -1, np.where(mm <= 0.8, 1, e))
    return {"위치 + 애매하면 메이어 배수": ambiguous(c, other)}


ITERS[16] = iter16


def contexts(x):
    """실시간 λ 30% 맥락과 그 맥락 기준 극값(상승 맥락은 저점, 하락 맥락은 고점)의 날짜 인덱스."""
    n = len(x)
    ctx, ref = np.zeros(n, int), np.zeros(n, int)
    c, hi, lo, hi_i, lo_i, r = 0, x[0], x[0], 0, 0, 0
    for i in range(n):
        if x[i] > hi:
            hi, hi_i = x[i], i
        if x[i] < lo:
            lo, lo_i = x[i], i
        if c >= 0 and x[i] <= hi * 0.7:
            c, r, lo, lo_i = -1, hi_i, x[i], i
        elif c <= 0 and x[i] >= lo * 1.3:
            c, r, hi, hi_i = 1, lo_i, x[i], i
        ctx[i], ref[i] = c, r
    return ctx, ref


def iter17(c):
    ctx, ref = contexts(c.to_numpy())
    age = np.arange(len(c)) - ref
    e = np.where(ens(c) > 0.5, 1, -1)
    other = np.where((ctx == 1) & (age > 1060), -1, np.where((ctx == -1) & (age > 365), 1, e))
    return {"위치 + 애매하면 장 나이": ambiguous(c, other)}


def iter18(c):
    ch = chain(which(c))
    mv = ch.CapMVRVCur.reindex(c.index).ffill().to_numpy()
    mm = (c / sma(c, 200)).to_numpy()
    a = ch.AdrActCnt.reindex(c.index).ffill()
    with np.errstate(invalid="ignore"):
        v = (np.where(mv >= 3.5, -1, np.where(mv <= 1, 1, 0)) + np.where(mm >= 2.4, -1, np.where(mm <= 0.8, 1, 0))
             + np.where(a.rolling(30).mean() > a.rolling(365).mean(), 1, -1) + np.where(ens(c) > 0.5, 1, -1))
    e = np.where(ens(c) > 0.5, 1, -1)
    return {"위치 + 애매하면 온체인·과열 합의": ambiguous(c, np.where(v > 0, 1, np.where(v < 0, -1, e)))}


def iter19(c):
    nq = pd.read_csv(C.ML / "macro.csv", parse_dates=["date"], index_col="date")["나스닥"].dropna()
    up = (nq > nq.rolling(200).mean()).astype(float).where(nq.rolling(200).mean().notna())
    up.index = up.index + pd.Timedelta(days=1)
    up = up.reindex(up.index.union(c.index)).ffill().reindex(c.index)
    other = np.where(up.to_numpy() == 1, 1, -1)
    return {"위치 + 애매하면 나스닥 200일선": ambiguous(c, other)}


ITERS.update({17: iter17, 18: iter18, 19: iter19})

DN_HOT, UP_COLD = 1 - 0.7 ** 0.25, 1.3 ** 0.25 - 1  # 8.5%, 6.8% — '마지막 극값일 확률' 25% 문턱


def shifted(c, hot=None, cold=None):
    """4회차 규칙에서 hot 인 날은 하락 문턱을 8.5% 로, cold 인 날은 반등 문턱을 6.8% 로 당긴다. 나머지는 16.3% / 14.0%."""
    x = c.to_numpy()
    n = len(x)
    hot = np.zeros(n, bool) if hot is None else np.asarray(hot, bool)
    cold = np.zeros(n, bool) if cold is None else np.asarray(cold, bool)
    out, ctx, hi, lo = np.zeros(n, int), 0, x[0], x[0]
    for i in range(n):
        hi, lo = max(hi, x[i]), min(lo, x[i])
        if ctx >= 0 and x[i] <= hi * 0.7:
            ctx, lo = -1, x[i]
        elif ctx <= 0 and x[i] >= lo * 1.3:
            ctx, hi = 1, x[i]
        if ctx == 1:
            out[i] = 1 if x[i] > hi * (1 - (DN_HOT if hot[i] else DOWN_T)) else -1
        elif ctx == -1:
            out[i] = 1 if x[i] >= lo * (1 + (UP_COLD if cold[i] else UP_T)) else -1
    return out


def heat(c):
    mv = chain(which(c)).CapMVRVCur.reindex(c.index).ffill().to_numpy()
    mm = (c / sma(c, 200)).to_numpy()
    with np.errstate(invalid="ignore"):
        return (mv >= 3.5) | (mm >= 2.4), (mv <= 1) | (mm <= 0.8)


def iter20(c):
    hot, _ = heat(c)
    return {"과열이면 하락 문턱 8.5%": shifted(c, hot=hot)}


def iter21(c):
    _, cold = heat(c)
    return {"저평가면 반등 문턱 6.8%": shifted(c, cold=cold)}


def iter22(c):
    hot, cold = heat(c)
    return {"과열·저평가 문턱 둘 다": shifted(c, hot=hot, cold=cold)}


def iter23(c):
    cal = halving_calendar(c.index)
    return {"반감기 달력으로 문턱 당김": shifted(c, hot=cal == -1, cold=cal == 1)}


ITERS.update({20: iter20, 21: iter21, 22: iter22, 23: iter23})


def iter24(c):
    cal = halving_calendar(c.index)
    hot, cold = heat(c)
    return {"달력 + 과열로 문턱 당김": shifted(c, hot=(cal == -1) | hot, cold=(cal == 1) | cold)}


def iter25(c):
    cal = halving_calendar(c.index, top=12, bottom=30)
    return {"반감기 달력(+12 ~ +30개월)으로 문턱 당김": shifted(c, hot=cal == -1, cold=cal == 1)}


ITERS.update({24: iter24, 25: iter25})


def iter26(c):
    cal = halving_calendar(c.index)
    mu = np.where(cal == -1, np.log(0.2) / 365, np.log(10) / 1060)
    var = np.log(c).diff().rolling(365).var().to_numpy()
    pr = context_prob(c.to_numpy(), mu, var)
    return {"반감기 달력 표류 확률": np.where(np.isnan(pr), 0, np.where(pr > 0.5, 1, -1))}


ITERS[26] = iter26


def evaluate(fn, span):
    pool = {}
    for s in SYMS:
        d = load(s)
        c = d.close
        lab = lam_label(c.to_numpy(), 0.3)
        near = near_change(lab)
        inside = np.asarray((d.index >= SPANS[span][0]) & (d.index <= SPANS[span][1])) & (np.arange(len(c)) >= WARM)
        for name, p in fn(c).items():
            pool.setdefault(name, []).append((np.asarray(p)[inside], lab[inside], near[inside]))
    out = {}
    for name, parts in pool.items():
        p, l, nr = (np.concatenate([q[i] for q in parts]) for i in range(3))
        out[name] = acc_stats(p, l, nr, (1, -1))
    return out


def main():
    store = json.loads(OUT.read_text()) if OUT.exists() else {"iters": {}, "test": None}
    if sys.argv[1] == "--test":
        name = " ".join(sys.argv[2:])
        k = next(int(i) for i, v in store["iters"].items() if name in v["확인"])
        r = evaluate(lambda c: {name: ITERS[k](c)[name]}, "시험")[name]
        store["test"] = {"판별기": name, "회차": k, "열린 때": datetime.now().isoformat(timespec="seconds"), **r}
        OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
        print(f"새 시험 기간 {name}: 균형 {r['균형 정확도'] * 100:.1f}% 정확도 {r['정확도'] * 100:.1f}% 전환 뒤 30일 {r['전환 뒤 30일'] * 100:.0f}%")
        return
    k = int(sys.argv[1])
    res = {"찾기": evaluate(ITERS[k], "찾기"), "확인": evaluate(ITERS[k], "확인"), "made": datetime.now().isoformat(timespec="seconds")}
    if k >= 11:  # 연장: 세 기간 모두 80% 가 성공 조건
        res["2011~2017"] = evaluate(ITERS[k], "시험")
    store["iters"][str(k)] = res
    OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
    if k >= 11:
        print(f"== {k}회차  (2011~2017 / 찾기 2018~2021 / 확인 2022~2026 균형 정확도)")
        for name in res["확인"]:
            v = [res[g][name]["균형 정확도"] for g in ("2011~2017", "찾기", "확인")]
            print(f"   {name:28s} {v[0] * 100:5.1f}% / {v[1] * 100:5.1f}% / {v[2] * 100:5.1f}%  {'★ 세 기간 모두 80% 이상' if min(v) >= 0.8 else ''}")
    else:
        print(f"== {k}회차  (찾기 / 확인 균형 정확도, 확인의 전환 뒤 30일)")
        for name in res["확인"]:
            a, b = res["찾기"][name], res["확인"][name]
            print(f"   {name:24s} {a['균형 정확도'] * 100:5.1f}% / {b['균형 정확도'] * 100:5.1f}%  상승 {b['상태별'][1] * 100:3.0f}% 하락 {b['상태별'][-1] * 100:3.0f}% 전환 뒤 30일 {b['전환 뒤 30일'] * 100:3.0f}%")
    if k == 4:
        rw = random_walk_check()
        store["iters"]["4"]["무작위 걸음"] = rw
        OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
        print(f"   (참고) 같은 규칙, 무작위 걸음 경로 200개: 균형 {rw * 100:.1f}%")
    best = max(((n, r["균형 정확도"], i) for i, v in store["iters"].items() for n, r in v["확인"].items()), key=lambda t: t[1])
    print(f"지금까지 확인 최고: {best[2]}회차 {best[0]} {best[1] * 100:.1f}%")


if __name__ == "__main__":
    main()
