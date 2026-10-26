#!/usr/bin/env python3
"""
축구 경기 승/무/패 확률 모델: 포아송 + Dixon-Coles 저득점 보정 (+ 시장 확률 블렌딩)

1) 기대득점(λ)을 직접 넣기
   python3 match_model.py --lam 1.55 1.10
2) xG 지표로 λ 추정 (평균회귀 포함)
   python3 match_model.py --xg 홈xG득 홈xGA 원정xG득 원정xGA --games 8 --league 2.8
   - 값은 '경기당' 수치. 기본은 시즌 전체(홈+원정 합산) 수치를 넣는다.
   - 홈팀의 홈경기·원정팀의 원정경기 수치를 넣었다면 반드시 --split 을 붙인다.
     (그 수치에 이미 홈 이점이 들어 있어서, 붙이지 않으면 홈 이점을 두 번 곱하게 된다)
   - --games: 표본 경기 수. 적을수록 리그 평균 쪽으로 강하게 당김 (k=8 경기).
   - --ha: 홈 이점 배수(기본 1.12 ≈ 홈/원정 득점비 1.25의 제곱근. 코로나 이후 홈 승률 약 42~44%)
3) 시장 확률과 섞기
   ... --market 45 28 27 --w 0.7      # 최종 = 0.7*시장 + 0.3*모델
   ... --blend log                    # 로그(기하) 결합: 시장^w * 모델^(1-w) 후 정규화 (Benter 방식)

근거: Dixon & Coles(1997) rho ≈ -0.13 → 0-0, 1-1 확률을 올리고 1-0, 0-1을 낮춰 무승부 과소평가를 보정.
"""
import argparse, math


def pois(k, lam):
    return math.exp(-lam) * lam ** k / math.factorial(k)


def tau(i, j, lh, la, rho):
    if i == 0 and j == 0: return 1 - lh * la * rho
    if i == 0 and j == 1: return 1 + lh * rho
    if i == 1 and j == 0: return 1 + la * rho
    if i == 1 and j == 1: return 1 - rho
    return 1.0


def wdl(lh, la, rho=-0.13, n=11):
    w = d = l = 0.0
    scores = []
    for i in range(n):
        for j in range(n):
            p = pois(i, lh) * pois(j, la) * tau(i, j, lh, la, rho)
            scores.append((p, f"{i}-{j}"))
            if i > j: w += p
            elif i == j: d += p
            else: l += p
    s = w + d + l
    return [w / s, d / s, l / s], sorted(scores, reverse=True)[:5]


def shrink(x, avg, n, k=8):
    return (n * x + k * avg) / (n + k)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lam", nargs=2, type=float)
    ap.add_argument("--xg", nargs=4, type=float)
    ap.add_argument("--games", type=int, default=10)
    ap.add_argument("--league", type=float, default=2.75, help="리그 경기당 총 득점")
    ap.add_argument("--ha", type=float, default=1.12)
    ap.add_argument("--rho", type=float, default=-0.13)
    ap.add_argument("--market", nargs=3, type=float)
    ap.add_argument("--w", type=float, default=0.7, help="시장 확률 가중치")
    ap.add_argument("--split", action="store_true", help="xG가 홈/원정 분리 수치일 때 (홈 이점 중복 적용 방지)")
    ap.add_argument("--blend", choices=["linear", "log"], default="linear")
    a = ap.parse_args()

    if a.lam:
        lh, la = a.lam
    elif a.xg:
        m = a.league / 2
        hf, ha_, af, aa = (shrink(v, m, a.games) for v in a.xg)
        ha = 1.0 if a.split else a.ha
        lh = hf / m * aa / m * m * ha
        la = af / m * ha_ / m * m / ha
    else:
        ap.error("--lam 또는 --xg 필요")

    p, top = wdl(lh, la, a.rho)
    print(f"기대득점 홈 {lh:.2f} : 원정 {la:.2f}  (합 {lh + la:.2f})")
    print("모델      " + "  ".join(f"{o} {v * 100:5.1f}%" for o, v in zip("승무패", p)))
    print("유력 스코어: " + ", ".join(f"{s} {q * 100:.1f}%" for q, s in top))
    if a.market:
        mk = [x / sum(a.market) for x in a.market]
        if a.blend == "log":
            f = [x ** a.w * y ** (1 - a.w) for x, y in zip(mk, p)]
            f = [x / sum(f) for x in f]
        else:
            f = [a.w * x + (1 - a.w) * y for x, y in zip(mk, p)]
        print("시장      " + "  ".join(f"{o} {v * 100:5.1f}%" for o, v in zip("승무패", mk)))
        print(f"최종(w={a.w}) " + "  ".join(f"{o} {v * 100:5.1f}%" for o, v in zip("승무패", f)))
        gap = max(abs(x - y) for x, y in zip(mk, p))
        if gap > 0.08:
            print(f"⚠ 모델과 시장 차이 {gap * 100:.0f}%p — 시장이 모르는 근거(발표 직후 라인업 등)가 없으면 시장 쪽을 믿는다.")


if __name__ == "__main__":
    main()
