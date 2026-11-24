"""장 판별 루프 (RESEARCH.md '장 판별 루프 등록'). 회차마다 판별기를 바꾸거나 더해 2상태(λ 30%) 균형 정확도를 잰다.
BTC·ETH 만, 기간으로 나눈다: 찾기 ~2021, 확인 2022 ~ 2024-06, 시험 2024-07 ~ 는 --test 로 한 번만 연다.
사용법: python3 scripts/lab/regime_loop.py <회차>          → data/lab/regime_loop.json 에 그 회차를 쌓는다
        python3 scripts/lab/regime_loop.py --test <판별기 이름>
"""
import json
import sys
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from indicators import sma
from regime import DEV, WARM, acc_stats, adx, classifiers, label3, lam_label, lam_realtime, load, near_change

# 2회차 뒤 사용자 요청: BTC·ETH 만, 기간으로 나눈다
SPANS = {"찾기": ("2018-01-01", "2021-12-31"), "확인": ("2022-01-01", "2024-06-30"), "시험": ("2024-07-01", "2026-11-22")}
OUT = C.OUT / "regime_loop.json"


def hold(raw, start=0):
    """+1·−1·0(동률) 줄에서 0 이면 어제 상태를 그대로 둔다."""
    out, st = np.zeros(len(raw), int), start
    for i, v in enumerate(raw):
        if v != 0:
            st = v
        out[i] = st
    return out


def confirm(raw, k):
    """다수결 결과가 지금 상태와 반대로 k 일 이어져야 바꾼다."""
    out, st, run = np.zeros(len(raw), int), 0, 0
    for i, v in enumerate(raw):
        if st == 0 and v != 0:
            st = v
        elif v != 0 and v != st:
            run += 1
            if run >= k:
                st, run = v, 0
        else:
            run = 0
        out[i] = st
    return out


def iter1(d, base):
    votes = np.sign(sum(np.asarray(base[n][1]) for n in ("앙상블 비중", "ADX 14", "초피니스 14", "실시간 λ 20%")))
    return {"투표 4 (동률 유지)": (None, hold(votes, 1)), "투표 4 + 3일 확인": (None, confirm(votes, 3))}


def stage_switch(x, ma, thr):
    """상승 → 하락: 고점 대비 −thr 이고 종가 < ma. 하락 → 상승: 저점 대비 +thr 이고 종가 > ma. thr 는 숫자나 날마다 다른 배열."""
    n = len(x)
    thr = np.broadcast_to(np.asarray(thr, float), (n,))
    out, st, hi, lo = np.zeros(n, int), 0, x[0], x[0]
    for i in range(n):
        hi, lo = max(hi, x[i]), min(lo, x[i])
        t = thr[i]
        if np.isnan(t) or np.isnan(ma[i]):
            out[i] = st
            continue
        if st >= 0 and x[i] <= hi * (1 - t) and x[i] < ma[i]:
            st, lo = -1, x[i]
        elif st <= 0 and x[i] >= lo * (1 + t) and x[i] > ma[i]:
            st, hi = 1, x[i]
        out[i] = st
    return out


def iter2(d, base):
    x, m50 = d.close.to_numpy(), sma(d.close, 50).to_numpy()
    vol = (d.close.pct_change().rolling(30).std() * np.sqrt(30) * 2).to_numpy()
    out = {f"낙폭 {t:.0%} + 50일선": (None, stage_switch(x, m50, t)) for t in (0.10, 0.15, 0.20)}
    out["변동성 2σ + 50일선"] = (None, stage_switch(x, m50, vol))
    return out


def weinstein(d, weeks):
    """주봉(일요일 마감) 종가 vs weeks 주 SMA 와 그 기울기. 위·오름 = 1, 아래·내림 = −1, 나머지 유지. 그 주가 끝난 다음 날부터."""
    w = d.close.resample("W-SUN").last()
    m = w.rolling(weeks).mean()
    raw = np.where((w > m) & (m > m.shift()), 1, np.where((w < m) & (m < m.shift()), -1, 0))
    st = pd.Series(hold(raw, 0), index=w.index + pd.Timedelta(days=1))
    return st.reindex(d.index, method="ffill").fillna(0).astype(int).to_numpy()


def iter3(d, base):
    return {"와인스타인 30주선": (None, weinstein(d, 30)), "와인스타인 10주선": (None, weinstein(d, 10))}


def iter4(d, base):
    c = d.close
    def vote(ns):
        return hold(np.sign(sum(np.sign(c / c.shift(n) - 1).fillna(0) for n in ns)).astype(int).to_numpy(), 0)
    return {"모멘텀 합의 21·63·126·252": (None, vote((21, 63, 126, 252))), "모멘텀 합의 63·126·252": (None, vote((63, 126, 252)))}


_PAIR = {}


def pair_states():
    """BTC·ETH 의 앙상블(> 0.5)·실시간 λ 20% 판별을 같은 날짜로 맞춘다."""
    if not _PAIR:
        frames = {}
        for s in DEV:
            d = load(s)
            b = classifiers(d)
            frames[s] = pd.DataFrame({"앙상블": b["앙상블 비중"][1], "λ20": b["실시간 λ 20%"][1]}, index=d.index)
        _PAIR.update(frames)
    return _PAIR


def iter5(d, base):
    ps = pair_states()
    btc = ps["BTC"].reindex(d.index).fillna(0)
    out = {"BTC 기준 앙상블": (None, btc["앙상블"].astype(int).to_numpy()), "BTC 기준 실시간 λ 20%": (None, btc["λ20"].astype(int).to_numpy())}
    both = pd.concat([ps["BTC"], ps["ETH"]], axis=1, keys=["B", "E"]).reindex(d.index).fillna(0)
    for k in ("앙상블", "λ20"):
        agree = np.where(both["B"][k] == both["E"][k], both["B"][k], 0).astype(int)
        out[f"두 코인 동시 {'앙상블' if k == '앙상블' else '실시간 λ 20%'}"] = (None, hold(agree, 0))
    return out


def dow(d, k):
    """다우 구조: 상승 중 직전 스윙 저점을 종가가 깨면 하락, 하락 중 직전 스윙 고점을 넘으면 상승. 고점·저점이 함께 높아지면(낮아지면) 상승(하락)으로 시작."""
    lo, hi, c = d.low.to_numpy(), d.high.to_numpy(), d.close.to_numpy()
    n = len(c)
    out, st, sl, sh = np.zeros(n, int), 0, [], []
    for t in range(n):
        j = t - k
        if j - k >= 0:
            if lo[j] == lo[j - k:j + k + 1].min():
                sl.append(lo[j])
            if hi[j] == hi[j - k:j + k + 1].max():
                sh.append(hi[j])
        if st == 0 and len(sl) >= 2 and len(sh) >= 2:
            if sl[-1] > sl[-2] and sh[-1] > sh[-2]:
                st = 1
            elif sl[-1] < sl[-2] and sh[-1] < sh[-2]:
                st = -1
        elif st == 1 and sl and c[t] < sl[-1]:
            st = -1
        elif st == -1 and sh and c[t] > sh[-1]:
            st = 1
        out[t] = st
    return out


def iter6(d, base):
    return {"다우 구조 10일 스윙": (None, dow(d, 5)), "다우 구조 20일 스윙": (None, dow(d, 10))}


def speed_vote(d, base):
    m3 = iter4(d, base)["모멘텀 합의 63·126·252"][1]
    v = np.sign(np.asarray(base["200일선"][1]) + weinstein(d, 30) + np.asarray(base["실시간 λ 20%"][1]) + np.asarray(m3))
    return hold(v.astype(int), 0)


def iter7(d, base):
    return {"속도 투표 4": (None, speed_vote(d, base))}


def iter8(d, base):
    ma = (d.close / sma(d.close, 200)).to_numpy()
    out = {}
    for b in (0.05, 0.10):
        raw = np.where(ma > 1 + b, 1, np.where(ma < 1 - b, -1, 0))
        raw = np.where(np.isnan(ma), 0, raw)
        out[f"200일선 띠 ±{b:.0%}"] = (None, hold(raw.astype(int), 0))
    return out


def iter9(d, base):
    slow, fast = weinstein(d, 30), np.asarray(base["실시간 λ 20%"][1])
    c, m50 = d.close.to_numpy(), sma(d.close, 50).to_numpy()
    out, st = np.zeros(len(c), int), 0
    for i in range(len(c)):
        if i and slow[i] != slow[i - 1] and slow[i] != 0:
            st = slow[i]  # 30주선이 바뀌면 따른다
        if fast[i] != 0 and fast[i] != st and ((fast[i] == -1 and c[i] < m50[i]) or (fast[i] == 1 and c[i] > m50[i])):
            st = fast[i]  # 빠른 예외
        if st == 0:
            st = slow[i]
        out[i] = st
    return {"30주선 닻 + λ 20% 예외": (None, out)}


_VOTE = {}


def iter10(d, base):
    if not _VOTE:
        for s in DEV:
            dd = load(s)
            _VOTE[s] = pd.Series(speed_vote(dd, classifiers(dd)), index=dd.index)
    both = pd.concat([_VOTE["BTC"], _VOTE["ETH"]], axis=1).reindex(d.index).fillna(0).to_numpy()
    agree = np.where(both[:, 0] == both[:, 1], both[:, 0], 0).astype(int)
    return {"속도 투표 4 + 두 코인 동시": (None, hold(agree, 0))}


ITERS = {1: iter1, 2: iter2, 3: iter3, 4: iter4, 5: iter5, 6: iter6, 7: iter7, 8: iter8, 9: iter9, 10: iter10}


def evaluate(names_fn, span):
    """BTC·ETH 의 span 기간 날짜를 모아 2상태 λ 30% 지표, 3상태가 있으면 3상태 균형 정확도. 판별기·라벨은 전 기간으로 계산하고 날짜만 고른다."""
    pool2, pool3 = {}, {}
    for s in DEV:
        d = load(s)
        x = d.close.to_numpy()
        lab = lam_label(x, 0.3)
        near = near_change(lab)
        l3, ok3 = label3(d.close)
        inside = np.asarray((d.index >= SPANS[span][0]) & (d.index <= SPANS[span][1])) & (np.arange(len(x)) >= WARM)
        ok3 = ok3 & inside
        ok = inside
        for name, (p3, p2) in names_fn(d).items():
            pool2.setdefault(name, []).append((np.asarray(p2)[ok], lab[ok], near[ok]))
            if p3 is not None:
                pool3.setdefault(name, []).append((np.asarray(p3)[ok3], l3[ok3]))
    out = {}
    for name, parts in pool2.items():
        p, l, nr = (np.concatenate([q[i] for q in parts]) for i in range(3))
        r = acc_stats(p, l, nr, (1, -1))
        if name in pool3:
            p3, l3 = (np.concatenate([q[i] for q in pool3[name]]) for i in range(2))
            r["3상태 균형"] = acc_stats(p3, l3, np.zeros(len(l3), bool), (1, 0, -1))["균형 정확도"]
        out[name] = r
    return out


def fn_for(k):
    def f(d):
        base = classifiers(d)
        res = {}
        for i in range(1, k + 1):
            res.update(ITERS[i](d, base))
        if k == 0:
            res = base
        return res
    return f


def main():
    store = json.loads(OUT.read_text()) if OUT.exists() else {"iters": {}, "test": None}
    if sys.argv[1] == "--test":
        name = " ".join(sys.argv[2:])
        k = next(int(i) for i, v in store["iters"].items() if name in v["확인"])
        def only(d):
            return {name: fn_for(k)(d)[name]}
        r = evaluate(only, "시험")[name]
        store["test"] = {"판별기": name, "회차": k, "열린 때": datetime.now().isoformat(timespec="seconds"), **r}
        OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
        print(f"시험 묶음 {name}: 균형 {r['균형 정확도'] * 100:.1f}% 정확도 {r['정확도'] * 100:.1f}% 전환 뒤 30일 {r['전환 뒤 30일'] * 100:.0f}%")
        return
    k = int(sys.argv[1])
    def new_only(d):
        base = classifiers(d)
        return ITERS[k](d, base) if k else base
    res = {"찾기": evaluate(new_only, "찾기"), "확인": evaluate(new_only, "확인"), "made": datetime.now().isoformat(timespec="seconds")}
    store["iters"][str(k)] = res
    OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
    for g in ("찾기", "확인"):
        print(f"== {k}회차 {g}")
        for name, r in res[g].items():
            extra = f" | 3상태 균형 {r['3상태 균형'] * 100:.0f}%" if "3상태 균형" in r else ""
            print(f"   {name:24s} 균형 {r['균형 정확도'] * 100:5.1f}% 정확도 {r['정확도'] * 100:4.0f}% 상승 {r['상태별'][1] * 100:3.0f}% 하락 {r['상태별'][-1] * 100:3.0f}% 전환 뒤 30일 {r['전환 뒤 30일'] * 100:3.0f}%{extra}")
    best = max(((name, r["균형 정확도"]) for i, v in store["iters"].items() for name, r in v["확인"].items()), key=lambda t: t[1])
    print(f"지금까지 확인 묶음 최고: {best[0]} {best[1] * 100:.1f}%")


if __name__ == "__main__":
    main()
