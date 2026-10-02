#!/usr/bin/env python3
"""
'가장 잘 맞히는 확률' 찾기: 확률을 만드는 방식별로 실제 적중을 비교한다 (EPL, tune.py 자료).

비교하는 방식 (학습 2012-13~2018-19 / 평가 2019-20~2024-25, Pinnacle 마감이 다 있는 시즌)
  A  Pinnacle 마감 (Shin)                     ← 현재 odds_scan 기준
  B  Pinnacle 오픈 (Shin)                     ← 하루 전 스캔 상황
  C  시장 평균 마감 (Shin)
  D  A·C 평균 (합의)
  E  A 재보정: log(A) → 다항 로지스틱 (정배당-역배당 편향 보정)
  F  A + Elo + pi-rating 스태킹 (전문가 모델 결합)

지표
- RPS·로그손실 (확률 전체의 정확도)
- 일반 승무패 1순위 적중률
- 베트맨형 '최고 확률 선택지'(일반 승/무/패 + 약팀 지지않음) 적중률
- 자신 있는 순 상위 10/20/30% 경기만 골랐을 때 적중률 (선별 곡선)

사용법: python3 scripts/source_compare.py
"""
import datetime as dt, math, os, sys

import numpy as np
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, os.path.dirname(__file__))
from devig import shin  # noqa: E402
import backtest as bt  # noqa: E402
from tune import load_epl  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")


def devig3(d, cols):
    q = 1 / d[cols].to_numpy(float)
    out = np.full(q.shape, np.nan)
    ok = ~np.isnan(q).any(axis=1)
    out[ok] = np.array([shin(list(x))[0] for x in q[ok]])
    return out


def logit_feats(*ps):
    return np.hstack([np.log(np.clip(p, 1e-6, 1)) for p in ps])


def best_option(p):
    """베트맨형 선택지: 일반 홈/무/원정 + 약팀 지지않음(정수핸디 패). (확률, 적중 판정 함수 인덱스)"""
    ph, pd_, pa = p
    dog_nl = (pa + pd_) if ph >= pa else (ph + pd_)
    opts = [(ph, 0), (pd_, 1), (pa, 2), (dog_nl, 3 if ph >= pa else 4)]
    return max(opts)


def hit(kind, y):
    return {0: y == 0, 1: y == 1, 2: y == 2, 3: y != 0, 4: y != 2}[kind]


def main():
    d = load_epl()
    tr = (d["season"] < "2019-20").to_numpy()
    te = ((d["season"] >= "2019-20") & (d["season"] <= "2024-25")).to_numpy()
    y = d["y"].to_numpy()
    P = {}
    P["A Pinnacle 마감"] = devig3(d, ["pinnacle_1x2_home_close", "pinnacle_1x2_draw_close", "pinnacle_1x2_away_close"])
    P["B Pinnacle 오픈"] = devig3(d, ["pinnacle_1x2_home", "pinnacle_1x2_draw", "pinnacle_1x2_away"])
    P["C 시장평균 마감"] = devig3(d, ["market_avg_1x2_home_close", "market_avg_1x2_draw_close", "market_avg_1x2_away_close"])
    D = (P["A Pinnacle 마감"] + P["C 시장평균 마감"]) / 2
    P["D A·C 평균"] = D / D.sum(axis=1, keepdims=True)

    A = P["A Pinnacle 마감"]
    okA = ~np.isnan(A).any(axis=1)
    m = LogisticRegression(C=10.0, max_iter=3000).fit(logit_feats(A[tr & okA]), y[tr & okA])
    E = np.full(A.shape, np.nan); E[okA] = m.predict_proba(logit_feats(A[okA]))
    P["E A 재보정"] = E

    elo = bt.run_elo(d, k=20, ha=60)
    pi = bt.run_pi(d, lam=0.07, gamma=0.7, c=3.0)
    X = lambda idx: np.column_stack([np.log(np.clip(A[idx], 1e-6, 1)), elo[idx] / 400, pi[idx]])
    m2 = LogisticRegression(C=1.0, max_iter=3000).fit(X(tr & okA), y[tr & okA])
    F = np.full(A.shape, np.nan); F[okA] = m2.predict_proba(X(okA))
    P["F A+Elo+pi 스태킹"] = F

    common = te & np.all([~np.isnan(p).any(axis=1) for p in P.values()], axis=0)
    yy = y[common]
    L = ["# 확률 방식별 적중 비교 (EPL)", "",
         f"작성 {dt.date.today()} · `scripts/source_compare.py` · 학습 2012-13~2018-19, 평가 2019-20~2024-25 공통 {common.sum()}경기", "",
         "| 방식 | RPS | 로그손실 | 승무패 1순위 적중 | 최고확률 선택지 적중 (평균 예상) | 상위10% | 상위20% | 상위30% |",
         "|---|---|---|---|---|---|---|---|"]
    ref = None
    for name, p in P.items():
        pp = np.clip(p[common], 1e-6, 1); pp /= pp.sum(axis=1, keepdims=True)
        r = bt.rps(pp, yy)
        ll = -np.log(pp[np.arange(len(yy)), yy])
        top1 = (pp.argmax(axis=1) == yy).mean()
        bo = [best_option(x) for x in pp]
        bp = np.array([b[0] for b in bo]); bh = np.array([hit(b[1], t) for b, t in zip(bo, yy)], float)
        order = np.argsort(-bp)
        tops = [bh[order[: int(len(order) * f)]].mean() for f in (0.1, 0.2, 0.3)]
        if ref is None:
            ref = r
        z = (r - ref).mean() / ((r - ref).std(ddof=1) / math.sqrt(len(r)) + 1e-12)
        L.append(f"| {name} | {r.mean():.4f}{'' if name.startswith('A') else f' (z {z:+.1f})'} | {ll.mean():.4f} | {top1:.1%} | "
                 f"{bh.mean():.1%} ({bp.mean():.1%}) | {tops[0]:.1%} | {tops[1]:.1%} | {tops[2]:.1%} |")
    L += ["", "z = A(Pinnacle 마감) 대비 RPS 차이의 짝지은 t값. 음수면 A보다 좋음, |z|<2면 우연 범위.", "",
          "재보정(E) 계수 — 대각선이 1에 가깝고 나머지가 0에 가까우면 시장 확률이 이미 잘 보정된 것:", "", "```",
          np.array2string(m.coef_, precision=3), "```"]
    text = "\n".join(L)
    out = os.path.join(ROOT, "회차별분석", f"확률방식비교_{dt.date.today()}.md")
    open(out, "w", encoding="utf-8").write(text + "\n")
    print(text)
    print("저장:", out)


if __name__ == "__main__":
    main()
