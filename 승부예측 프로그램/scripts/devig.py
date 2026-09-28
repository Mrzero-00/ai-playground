#!/usr/bin/env python3
"""
배당률 → 마진을 제거한 '공정 확률' 계산 (승/무/패 3-way 또는 2-way).
시장 확률은 매우 잘 보정돼 있다 (Betfair 5만여 경기, 예측-실제 상관 r=0.995).
가능하면 마진이 낮은 Pinnacle 배당을 쓰고, 경기 직전(마감) 배당일수록 정확하다.

방법
- multiplicative : 1/배당을 합계로 나눔 (단순, 정배당 편향 미반영)
- power          : (1/배당)^k 합이 1이 되도록 k를 찾음 (정배당-역배당 편향 반영)
- shin           : 정보 비대칭 모델. 3-way 축구에 가장 많이 권장됨 (기본 추천)

사용법: python3 devig.py 2.10 3.40 3.60      # 홈승 무 원정승 배당
"""
import sys


def mult(q):
    s = sum(q)
    return [x / s for x in q]


def power(q):
    lo, hi = 0.5, 3.0
    for _ in range(100):
        k = (lo + hi) / 2
        s = sum(x ** k for x in q)
        lo, hi = (k, hi) if s > 1 else (lo, k)
    return [x ** k for x in q]


def shin(q):
    B = sum(q)

    def probs(z):
        return [((z * z + 4 * (1 - z) * x * x / B) ** 0.5 - z) / (2 * (1 - z)) for x in q]

    lo, hi = 0.0, 0.5
    for _ in range(100):
        z = (lo + hi) / 2
        lo, hi = (z, hi) if sum(probs(z)) > 1 else (lo, z)
    return probs(z), z


def main():
    odds = [float(x) for x in sys.argv[1:]]
    if len(odds) not in (2, 3):
        sys.exit(__doc__)
    q = [1 / o for o in odds]
    labels = ["승", "무", "패"] if len(odds) == 3 else ["승", "패"]
    print(f"마진(overround): {(sum(q) - 1) * 100:.2f}%")
    sp, z = shin(q)
    for name, p in [("multiplicative", mult(q)), ("power", power(q)), (f"shin (z={z:.3f})", sp)]:
        print(f"{name:<18} " + "  ".join(f"{l} {v * 100:5.1f}%" for l, v in zip(labels, p)))


if __name__ == "__main__":
    main()
