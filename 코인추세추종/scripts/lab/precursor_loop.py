"""장 직전 양상 찾기 루프 (RESEARCH.md '장 직전 양상 찾기 루프'). 회차마다 가설 하나를 '그날 알 수 있는 것으로 켜지는 규칙' 으로 만들어,
켜진 날의 뒤 30일 장 비율을 평소와 견준다(찾는 기간 2020 ~ 2025 · 검증 기간 2018 ~ 2019 · 2026 ~).
사용법: cd scripts/lab && python3 precursor_loop.py <회차>   → data/lab/precursor_loop.json
"""
import json
import sys
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
import precursor as P1
import precursor2 as P2

OUT = C.OUT / "precursor_loop.json"
UP, DOWN = ("대상승", "상승"), ("하락", "대하락")
CODE = {n: g for g, n in P1.TYPES.items()}


def context():
    """지표 34개의 백분위(그날까지), 업비트 종가, 뒤 30일 장(변동성 기준 · 가격 변화율 기준)."""
    days = pd.date_range("2017-09-25", "2026-11-25")
    macro = P1.macro_series(days)
    raw, closes = {}, {}
    for s in P1.SYMS:
        closes[s], raw[s] = P1.raw_features(s, days, macro)
    names = {**P1.NAMES, **P2.NEW}
    ctx = {"days": days, "closes": closes, "names": names, "raw": {}, "pct": {}, "fv": {}, "fa": {}}
    for s in P1.SYMS:
        X = {**raw[s], **P2.new_raw(s, days, raw[s], closes[s], closes)}
        ctx["raw"][s] = X
        ctx["pct"][s] = {k: (X[k] if k in P2.RAW else P1.expanding_pct(X[k])) for k in names}
        ctx["fv"][s], ctx["fa"][s] = P1.forward_grade(closes[s]), P2.forward_abs(closes[s])
    return ctx


def period_mask(idx, pn):
    d = idx.strftime("%Y-%m-%d")
    if pn == "찾기":
        return (d >= P1.FIND[0]) & (d <= P1.FIND[1])
    return np.any([(d >= a) & (d <= b) for a, b in P1.HOLD], axis=0)


def test_rule(ctx, on, labels="fv"):
    """on[코인] = 규칙이 켜진 날(bool Series). 기간마다 켜진 날 수와, 장마다 (켜진 날에서 뒤 30일이 그 장인 비율, 평소 비율, 배수)."""
    res = {}
    for pn in ("찾기", "검증"):
        hit, base = [], []
        for s in P1.SYMS:
            fg = ctx[labels][s]
            ok = fg.notna() & (fg.index >= "2018-01-01") & period_mask(fg.index, pn)
            o = on[s].reindex(fg.index).fillna(False).astype(bool)
            hit.append(fg[ok & o].to_numpy())
            base.append(fg[ok].to_numpy())
        h, b = np.concatenate(hit), np.concatenate(base)
        r = {"켜진 날": int(len(h))}
        for name, g in CODE.items():
            p, q = (float(np.mean(h == g)) if len(h) else None), float(np.mean(b == g))
            r[name] = {"켜졌을 때": p, "평소": q, "배수": (p / q if p is not None and q > 0 else None)}
        res[pn] = r
    return res


def success(res):
    """성공 조건: 한 장이 두 기간 모두 1.5배 넘게, 켜진 날 두 기간 모두 100일 이상, 반대 방향 장은 두 기간 모두 1.2배 미만."""
    if any(res[pn]["켜진 날"] < 100 for pn in res):
        return []
    won = []
    for ty in UP + DOWN:
        other = DOWN if ty in UP else UP
        if all((res[pn][ty]["배수"] or 0) > 1.5 for pn in res) and all((res[pn][o]["배수"] or 0) < 1.2 for pn in res for o in other):
            won.append(ty)
    return won


def show(name, res):
    def fmt(pn):
        r = res[pn]
        return f"{pn} {r['켜진 날']}일: " + " · ".join(f"{ty} ×{r[ty]['배수']:.2f}" if r[ty]["배수"] is not None else f"{ty} -" for ty in CODE)
    w = success(res)
    print(f"   {name:40s} {fmt('찾기')} | {fmt('검증')}" + (f"  ★ 성공: {', '.join(w)}" if w else ""))
    return w


ROUNDS = {}  # 회차 → 함수(ctx) → {규칙 이름: test_rule 결과}


def run(k):
    ctx = context()
    rules = ROUNDS[k](ctx)
    store = json.loads(OUT.read_text()) if OUT.exists() else {"rounds": {}}
    print(f"== {k}회차 — 규칙이 켜진 날에서 뒤 30일 장이 나온 배수(켜졌을 때 ÷ 평소), 찾는 기간 | 검증 기간")
    won = {}
    for name, res in rules.items():
        w = show(name, res)
        if w:
            won[name] = w
    store["rounds"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "rules": rules, "성공": won}
    OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
    print("성공한 규칙:", won or "없음")


if __name__ == "__main__":
    run(int(sys.argv[1]))
