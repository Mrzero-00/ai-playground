#!/usr/bin/env python3
"""
'80% 선별' 규칙 백테스트 (EPL 2012-13 ~ 2025-26, 자료는 tune.py 와 같다).

질문: 경기마다 베트맨에 있는 형태의 선택지 중 공정확률이 가장 높은 것을 고르고,
     그 확률이 기준(예: 80%) 이상인 경기만 산다면 실제 적중률은 몇 %인가? 몇 경기 중 몇 경기가 해당되는가?

선택지 (베트맨 상품과 같은 정의)
- 일반 승무패: 홈승 / 무 / 원정승                       → Pinnacle 마감 승무패 (Shin)
- 정수핸디캡 '지지 않음'(H-1 패 = 상대 +1, 더블찬스): 홈승+무 / 원정승+무
- 정수핸디캡 '2골 차 이상 승'(H-1 승): 승무패+언더오버로 기대득점 역산 (2019-20~, 언더오버 마감 있을 때)
- 아시안핸디캡 x.5 마감 라인 양쪽                        → 시장 핸디캡 배당 (2019-20~)

사용법: python3 scripts/sure_backtest.py [--from 2012-13]
"""
import argparse, datetime as dt, math, os, sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from devig import shin  # noqa: E402
from tune import load_epl, implied_lambdas, score_matrix  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")


def options(r):
    """(이름, 공정확률, 적중여부) 목록."""
    gd = r.FTHG - r.FTAG
    out = []
    if np.isnan([r.CH, r.CD, r.CA]).any():
        return out
    ph, pd_, pa = shin([1 / r.CH, 1 / r.CD, 1 / r.CA])[0]
    out += [("일반 승(유력팀)" if ph >= pa else "일반 승(약팀)", ph, gd > 0), ("일반 무", pd_, gd == 0),
            ("일반 승(유력팀)" if pa > ph else "일반 승(약팀)", pa, gd < 0)]
    # 베트맨 정수핸디캡은 유력팀에 -1: 핸디승 = 유력팀 2골 차+, 핸디무 = 유력팀 1골 차, 핸디패 = 약팀 지지 않음
    fav_home = ph >= pa
    s_ = 1 if fav_home else -1
    out += [("정수핸디 약팀 지지않음", (pa if fav_home else ph) + pd_, s_ * gd <= 0)]
    if not np.isnan([r.CO, r.CU]).any():
        po, pu = shin([1 / r.CO, 1 / r.CU])[0]
        tot = r.FTHG + r.FTAG
        out += [("언더오버2.5 오버", po, tot >= 3), ("언더오버2.5 언더", pu, tot <= 2)]
        lh, la = implied_lambdas(ph, pd_, pa, po, -0.06)
        m, diff = score_matrix(lh, la, -0.06)
        out += [("정수핸디 유력팀 2골차승", m[s_ * diff >= 2].sum(), s_ * gd >= 2),
                ("정수핸디 유력팀 1골차승", m[s_ * diff == 1].sum(), s_ * gd == 1)]
    if not np.isnan([r.AHL, r.AHH, r.AHA]).any() and (r.AHL * 2) % 2 == 1:
        p1, p2 = shin([1 / r.AHH, 1 / r.AHA])[0]
        fav_side_home = r.AHL < 0
        out += [("소수핸디 유력팀" if fav_side_home else "소수핸디 약팀", p1, gd + r.AHL > 0),
                ("소수핸디 약팀" if fav_side_home else "소수핸디 유력팀", p2, gd + r.AHL < 0)]
    return out


SCOPES = [("일반 승무패만", ("일반",)), ("+ 정수핸디캡", ("일반", "정수핸디")),
          ("+ 소수핸디캡", ("일반", "정수핸디", "소수핸디")), ("+ 언더오버2.5 (전체)", ("일반", "정수핸디", "소수핸디", "언더오버"))]


def scope_rows(d):
    rows, per = [], {k: [] for k, _ in SCOPES}
    for _, r in d.iterrows():
        op = options(r)
        if not op or len(op) < 9:  # 언더오버·핸디캡 마감이 모두 있는 경기만 (공통 표본)
            continue
        for name, pref in SCOPES:
            sub = [o for o in op if o[0].startswith(pref)]
            per[name].append(max(sub, key=lambda x: x[1]))
    for name, _ in SCOPES:
        a = np.array([(p, h) for _, p, h in per[name]], float)
        o = np.argsort(-a[:, 0])
        top = lambda f: a[o[: max(1, int(len(o) * f))], 1].mean()
        rows.append(f"| {name} | {len(a)} | {a[:, 0].mean():.1%} | **{a[:, 1].mean():.1%}** | {top(.1):.1%} | {top(.2):.1%} | {top(.3):.1%} | {top(.5):.1%} |")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="since", default="2012-13")
    a = ap.parse_args()
    d = load_epl()
    d = d[d["season"] >= a.since].reset_index(drop=True)
    best, allopt = [], []
    for _, r in d.iterrows():
        op = options(r)
        if not op:
            continue
        allopt += op
        best.append(max(op, key=lambda x: x[1]))
    n = len(best)
    L = ["# 80% 선별 규칙 백테스트 (EPL)", "",
         f"작성 {dt.date.today()} · `scripts/sure_backtest.py` · {d['season'].min()}~{d['season'].max()} {n}경기",
         "경기마다 베트맨형 선택지 중 확률 최고 1개를 고르고, 그 확률이 기준 이상인 경기만 산다고 가정.", "",
         "## 0. 선택지 범위별 '경기당 최고 확률 선택지' 적중률 (모든 경기에 1개씩)", "",
         "| 선택지 범위 | 경기 | 평균 예상 | 실제 적중 | 상위10% | 상위20% | 상위30% | 상위50% |", "|---|---|---|---|---|---|---|---|",
         *scope_rows(d), "",
         "## 1. 기준별 적중률·해당 경기 비율 (전체 선택지)", "",
         "| 기준 | 해당 경기 | 비율 | 평균 예상 | 실제 적중 | 95% 하한 |", "|---|---|---|---|---|---|"]
    for t in (0.70, 0.75, 0.80, 0.85, 0.90):
        s = [(p, h) for _, p, h in best if p >= t]
        if not s:
            continue
        p = np.array([x[0] for x in s]); h = np.array([x[1] for x in s], float)
        lo = h.mean() - 1.96 * math.sqrt(h.mean() * (1 - h.mean()) / len(h))
        L.append(f"| {t:.0%} | {len(s)} | {len(s)/n:.1%} | {p.mean():.1%} | **{h.mean():.1%}** | {lo:.1%} |")
    L += ["", "## 2. 선택지 종류별 보정 (예상 80% 이상 구간)", "",
          "| 선택지 | 표본 | 평균 예상 | 실제 | z |", "|---|---|---|---|---|"]
    kinds = sorted({k for k, _, _ in allopt})
    for k in kinds:
        s = [(p, h) for kk, p, h in allopt if kk == k and p >= 0.8]
        if len(s) < 20:
            continue
        p = np.array([x[0] for x in s]); h = np.array([x[1] for x in s], float)
        z = (h.mean() - p.mean()) / math.sqrt(p.mean() * (1 - p.mean()) / len(h))
        L.append(f"| {k} | {len(s)} | {p.mean():.1%} | {h.mean():.1%} | {z:+.2f} |")
    L += ["", "## 3. 선택된 선택지 구성 (기준 80%)", "", "| 선택지 | 횟수 | 실제 적중 |", "|---|---|---|"]
    for k in kinds:
        s = [h for kk, p, h in best if kk == k and p >= 0.8]
        if s:
            L.append(f"| {k} | {len(s)} | {np.mean(s):.1%} |")
    L += ["", "## 4. 시즌별 (기준 80%)", "", "| 시즌 | 해당 | 실제 적중 |", "|---|---|---|"]
    seasons = d["season"].tolist()
    i = 0
    per = {}
    for (_, r) in d.iterrows():
        op = options(r)
        if not op:
            continue
        k, p, h = max(op, key=lambda x: x[1])
        if p >= 0.8:
            per.setdefault(r.season, []).append(h)
    for s, hs in sorted(per.items()):
        L.append(f"| {s} | {len(hs)} | {np.mean(hs):.1%} |")
    text = "\n".join(L)
    out = os.path.join(ROOT, "회차별분석", f"80선별_백테스트_{dt.date.today()}.md")
    open(out, "w", encoding="utf-8").write(text + "\n")
    print(text)
    print("저장:", out)


if __name__ == "__main__":
    main()
