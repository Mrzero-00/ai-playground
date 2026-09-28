#!/usr/bin/env python3
"""
누적 예측기록.csv로 확률 보정 상태를 점검한다.
- 구간별(0~10%, 10~20% …)로 예측 확률과 실제 발생률 비교
- 결과별(승/무/패) 평균 예측 확률과 실제 비율 비교
- Brier 점수 (낮을수록 좋음, 무작위 1/3 예측은 약 0.667)

사용법: python3 calibration.py [../예측기록.csv]
"""
import csv, sys
from collections import defaultdict

path = sys.argv[1] if len(sys.argv) > 1 else __file__.rsplit("/", 2)[0] + "/예측기록.csv"
rows = [r for r in csv.DictReader(open(path, encoding="utf-8")) if r.get("result")]
if not rows:
    print("결과가 입력된 경기가 없습니다.")
    sys.exit()

OUT = {"승": "p_win", "무": "p_draw", "패": "p_lose"}
bins = defaultdict(lambda: [0, 0.0, 0])  # n, 예측합, 발생수
by_out = {o: [0.0, 0] for o in OUT}
brier = 0.0
for r in rows:
    ps = {o: float(r[c]) for o, c in OUT.items()}
    s = sum(ps.values())
    for o in ps:
        p = ps[o] / s
        hit = 1 if r["result"].strip() == o else 0
        b = min(int(p * 10), 9)
        bins[b][0] += 1; bins[b][1] += p; bins[b][2] += hit
        by_out[o][0] += p; by_out[o][1] += hit
        brier += (p - hit) ** 2

n = len(rows)
print(f"경기 수: {n}  /  Brier 점수: {brier/n:.3f}\n")
print("구간        예측평균  실제발생  표본")
for b in sorted(bins):
    c, ps, h = bins[b]
    print(f"{b*10:>3}~{b*10+10:<3}%   {ps/c*100:6.1f}%  {h/c*100:6.1f}%  {c:4d}")
print("\n결과별     예측평균  실제비율")
for o, (ps, h) in by_out.items():
    print(f"{o}         {ps/n*100:6.1f}%  {h/n*100:6.1f}%")
