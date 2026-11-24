"""장 판별 루프 (RESEARCH.md '장 판별 루프 등록'). 회차마다 판별기를 바꾸거나 더해 2상태(λ 30%) 균형 정확도를 잰다.
찾기 BTC·ETH, 확인 다른 코인 10개를 보고, 시험 코인 12개는 --test 로 한 번만 연다.
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
from regime import DEV, VAL, WARM, acc_stats, adx, classifiers, label3, lam_label, lam_realtime, load, near_change

TEST = ["ATOM", "ALGO", "VET", "NEO", "ZEC", "DASH", "BAT", "AVAX", "DOT", "UNI", "FIL", "XTZ"]
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


ITERS = {1: iter1}


def evaluate(names_fn, syms):
    """판별기마다 묶음 전체 날짜를 모아 2상태 λ 30% 지표, 3상태가 있으면 3상태 균형 정확도."""
    pool2, pool3 = {}, {}
    for s in syms:
        d = load(s)
        x = d.close.to_numpy()
        lab = lam_label(x, 0.3)
        near = near_change(lab)
        l3, ok3 = label3(d.close)
        ok3 = ok3 & (np.arange(len(x)) >= WARM)
        ok = np.arange(len(x)) >= WARM
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
        r = evaluate(only, TEST)[name]
        store["test"] = {"판별기": name, "회차": k, "열린 때": datetime.now().isoformat(timespec="seconds"), **r}
        OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
        print(f"시험 묶음 {name}: 균형 {r['균형 정확도'] * 100:.1f}% 정확도 {r['정확도'] * 100:.1f}% 전환 뒤 30일 {r['전환 뒤 30일'] * 100:.0f}%")
        return
    k = int(sys.argv[1])
    def new_only(d):
        base = classifiers(d)
        return ITERS[k](d, base) if k else base
    res = {"찾기": evaluate(new_only, DEV), "확인": evaluate(new_only, VAL), "made": datetime.now().isoformat(timespec="seconds")}
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
