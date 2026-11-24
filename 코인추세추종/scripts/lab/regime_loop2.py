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


ITERS = {0: base, 1: iter1, 2: iter2, 3: iter3}


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
    best = max(((n, r["균형 정확도"], i) for i, v in store["iters"].items() for n, r in v["확인"].items()), key=lambda t: t[1])
    print(f"지금까지 확인 최고: {best[2]}회차 {best[0]} {best[1] * 100:.1f}%")


if __name__ == "__main__":
    main()
