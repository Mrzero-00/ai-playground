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


ITERS = {0: base, 1: iter1, 2: iter2, 3: iter3, 4: iter4, 5: iter5, 6: iter6, 7: iter7, 8: iter8, 9: iter9, 10: iter10}


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
    store["iters"][str(k)] = res
    OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
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
