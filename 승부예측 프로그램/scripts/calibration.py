#!/usr/bin/env python3
"""
누적 예측기록.csv로 확률 보정 상태를 점검한다.
- 구간별(0~10%, 10~20% …)로 예측 확률과 실제 발생률 비교
- 결과별(승/무/패) 평균 예측 확률과 실제 비율 비교
- Brier 점수 (낮을수록 좋음, 무작위 1/3 예측은 약 0.667)
- RPS (낮을수록 좋음, 승-무-패 순서를 반영. 상위 리그 시장 확률은 보통 0.19~0.21)
- 로그 손실 (낮을수록 좋음, 무작위는 1.099)
- m_win/m_draw/m_lose(시장 확률)가 기록된 경기는 시장과 직접 비교한다.
  시장보다 나쁘면 시장 가중치를 올리고, 표본이 쌓여도 계속 나쁘면 모델 보정을 줄인다.

사용법: python3 calibration.py [../예측기록.csv]
"""
import csv, math, sys
from collections import defaultdict

path = sys.argv[1] if len(sys.argv) > 1 else __file__.rsplit("/", 2)[0] + "/예측기록.csv"
rows = [r for r in csv.DictReader(open(path, encoding="utf-8")) if (r.get("result") or "").strip()]
if not rows:
    print("결과가 입력된 경기가 없습니다.")
    sys.exit()

OUT = ["승", "무", "패"]
MINE = ["p_win", "p_draw", "p_lose"]
MKT = ["m_win", "m_draw", "m_lose"]


def probs(r, cols):
    try:
        ps = [float(r[c]) for c in cols]
    except (KeyError, TypeError, ValueError):
        return None
    s = sum(ps)
    return [p / s for p in ps] if s > 0 else None


def scores(ps, res):
    hit = [1 if o == res else 0 for o in OUT]
    brier = sum((p - h) ** 2 for p, h in zip(ps, hit))
    c1, c2 = ps[0] - hit[0], ps[0] + ps[1] - hit[0] - hit[1]
    rps = (c1 ** 2 + c2 ** 2) / 2
    ll = -math.log(max(ps[hit.index(1)], 1e-9))
    return brier, rps, ll


def avg(pairs):
    n = len(pairs)
    return [sum(x[i] for x in pairs) / n for i in range(3)]


bins = defaultdict(lambda: [0, 0.0, 0])  # n, 예측합, 발생수
by_out = {o: [0.0, 0] for o in OUT}
mine, both = [], []
for r in rows:
    res = r["result"].strip()
    ps = probs(r, MINE)
    if ps is None or res not in OUT:
        continue
    sc = scores(ps, res)
    mine.append(sc)
    for o, p in zip(OUT, ps):
        hit = 1 if res == o else 0
        b = min(int(p * 10), 9)
        bins[b][0] += 1; bins[b][1] += p; bins[b][2] += hit
        by_out[o][0] += p; by_out[o][1] += hit
    ms = probs(r, MKT)
    if ms:
        both.append((sc, scores(ms, res)))

n = len(mine)
b, rps, ll = avg(mine)
print(f"경기 수: {n}  /  Brier {b:.3f}  RPS {rps:.3f}  로그손실 {ll:.3f}\n")
print("구간        예측평균  실제발생  표본")
for k in sorted(bins):
    c, ps, h = bins[k]
    print(f"{k*10:>3}~{k*10+10:<3}%   {ps/c*100:6.1f}%  {h/c*100:6.1f}%  {c:4d}")
print("\n결과별     예측평균  실제비율")
for o, (ps, h) in by_out.items():
    print(f"{o}         {ps/n*100:6.1f}%  {h/n*100:6.1f}%")

if both:
    a, m = avg([x[0] for x in both]), avg([x[1] for x in both])
    print(f"\n시장 비교 ({len(both)}경기)   Brier    RPS   로그손실")
    print(f"내 예측              {a[0]:.3f}  {a[1]:.3f}  {a[2]:.3f}")
    print(f"시장(마진 제거)      {m[0]:.3f}  {m[1]:.3f}  {m[2]:.3f}")
    d = a[1] - m[1]
    verdict = "시장보다 좋음" if d < 0 else "시장보다 나쁨 → 시장 가중치를 올린다"
    print(f"RPS 차이 {d:+.4f} ({verdict}). 100경기 미만이면 우연일 수 있다.")
else:
    print("\n시장 확률(m_win, m_draw, m_lose)이 기록된 경기가 없어 시장 비교는 생략한다.")
