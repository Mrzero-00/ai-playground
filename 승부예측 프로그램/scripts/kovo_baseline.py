#!/usr/bin/env python3
"""배구 기준선 — 세트 득실률 → 세트 승률 p → 경기 승률 (3선승).

`종목별분석/배구.md` 1-1 절의 공식을 그대로 구현한다. 2026-11-10 신설 —
배구는 추천 허용 리그인데(사용자 결정 2026-10-19) 기준선 도구가 없어
**분석 자체를 못 하고 있었다**. 그래서 채점된 배구가 12경기뿐이다.

공식 (배구.md 1-1)
------------------
    s = R / (1 + R)                                  팀 세트 승률
    odds = (s홈/(1-s홈)) / (s원정/(1-s원정))            오즈비로 섞는다
    p = odds / (1 + odds)                            맞대결 세트 승률
    P = p^3 (1 + 3q + 6q^2),  q = 1-p                3선승 경기 승률
    3-0 = p^3 · 3-1 = 3p^3 q · 3-2 = 6p^3 q^2        세트 스코어 분포

★ 표본 수축 (이 도구가 더한 것)
-------------------------------
R 을 관측 세트 수로 추정하는데, 시즌 초 3경기(약 11세트)면 s 의 표준오차가
0.15 에 달한다. 그대로 쓰면 NBA CLI 경로와 똑같은 과신이 된다
(2026-11-10 에 그 버그를 고쳤다). 그래서 s 를 0.5 쪽으로 수축한다:

    SE^2 = 0.25 / 관측세트수
    신뢰도 = PRIOR_SD^2 / (PRIOR_SD^2 + SE^2)
    s' = 0.5 + 신뢰도 x (s - 0.5)

PRIOR_SD 는 팀 간 세트 승률의 참 산포다. V-리그 팀 세트 득실률이 대략
0.75~1.35 범위(s 0.43~0.57)라는 관찰에서 **0.045 로 가정**했다.
이 값은 아직 실측하지 않았다 — 한 시즌 전체 세트 기록이 쌓이면
`home_edge.py` 처럼 분산성분으로 재추정해야 한다. 그때까지는 가정값이다.

홈 이점
-------
배구.md 1-3: **KOVO컵은 중립 구장이라 홈 이점 0**. 우리 기록으로 재면
V리그 정규 홈 승률 61.5%(n=13) vs KOVO컵 47.8%(n=23) 로 문서와 일치한다.
다만 n=13 은 2SE ±27p 라 V리그 홈 이점을 수치로 못 박을 수 없다.
→ `--home-edge` 로 세트 승률에 더할 값을 직접 주고, 기본값은 **0** 이다
  (측정되지 않은 것을 기본으로 넣지 않는다).

쓰는 법
-------
    python3 scripts/kovo_baseline.py --home-r 1.055 --away-r 0.924 --sets 11
    python3 scripts/kovo_baseline.py --home-sets 5 --home-lost 3 --away-sets 4 --away-lost 5
    python3 scripts/kovo_baseline.py --home-r 1.3 --away-r 0.8 --sets 40 --total 190
"""
import argparse
import math

PRIOR_SD = 0.045        # 팀 간 세트 승률 참 산포 — 가정값, 실측 필요
# 배구.md 1-2 세트 수별 총점 범위 (25점제 3~4세트 + 15점제 5세트)
TOTAL_RANGE = {3: (130, 150), 4: (170, 200), 5: (200, 230)}


def shrink_s(s, sets):
    """세트 승률을 0.5 쪽으로 수축. sets 가 작으면 거의 0.5 로 간다."""
    if not sets or sets <= 0:
        return s, 0.0
    se2 = 0.25 / sets
    rel = PRIOR_SD ** 2 / (PRIOR_SD ** 2 + se2)
    return 0.5 + rel * (s - 0.5), rel


def match_prob(p):
    """3선승 경기 승률과 세트 스코어 분포."""
    q = 1.0 - p
    d30 = p ** 3
    d31 = 3 * p ** 3 * q
    d32 = 6 * p ** 3 * q * q
    return (d30 + d31 + d32), (d30, d31, d32)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--home-r", type=float, help="홈 세트 득실률 (획득/허용)")
    ap.add_argument("--away-r", type=float, help="원정 세트 득실률")
    ap.add_argument("--home-sets", type=int, help="홈 획득 세트")
    ap.add_argument("--home-lost", type=int, help="홈 허용 세트")
    ap.add_argument("--away-sets", type=int, help="원정 획득 세트")
    ap.add_argument("--away-lost", type=int, help="원정 허용 세트")
    ap.add_argument("--sets", type=int, default=0,
                    help="두 팀 중 적은 쪽의 관측 세트 수. 수축에 쓴다. "
                         "0 이면 수축하지 않는다(권장하지 않음)")
    ap.add_argument("--home-edge", type=float, default=0.0,
                    help="홈 세트 승률에 더할 값. 기본 0 — V리그 홈 이점은 "
                         "아직 n=13 으로 측정 불가(2SE ±27p). KOVO컵은 중립이라 0")
    ap.add_argument("--total", type=float, help="언더오버 기준 총점")
    ap.add_argument("--no-shrink", action="store_true", help="수축 끄기(비교용)")
    a = ap.parse_args()

    # R 구하기
    def ratio(r, got, lost, side):
        if r is not None:
            return r
        if got is not None and lost is not None and lost > 0:
            return got / lost
        raise SystemExit(f"{side} 세트 득실률이 없다 — --{side}-r 또는 --{side}-sets/--{side}-lost")

    Rh = ratio(a.home_r, a.home_sets, a.home_lost, "home")
    Ra = ratio(a.away_r, a.away_sets, a.away_lost, "away")

    sh_raw = Rh / (1 + Rh)
    sa_raw = Ra / (1 + Ra)
    if a.no_shrink or not a.sets:
        sh, sa, rel = sh_raw, sa_raw, 1.0
    else:
        sh, rel = shrink_s(sh_raw, a.sets)
        sa, _ = shrink_s(sa_raw, a.sets)
    sh = min(0.95, max(0.05, sh + a.home_edge))

    oh = sh / (1 - sh)
    oa = sa / (1 - sa)
    p = (oh / oa) / (1 + oh / oa)
    q = 1 - p

    print(f"세트 득실률  홈 {Rh:.3f}  원정 {Ra:.3f}")
    print(f"팀 세트 승률 홈 {sh_raw:.3f}  원정 {sa_raw:.3f}" + ("" if rel >= 1 else
          f"  →  수축 후 홈 {sh:.3f} 원정 {sa:.3f}  (관측 {a.sets}세트, 신뢰도 {rel:.3f})"))
    if rel < 1 and a.sets:
        print(f"  ※ 신뢰도 {rel:.3f} — 관측 편차의 {rel*100:.0f}% 만 쓴다. "
              f"{a.sets}세트는 표준오차 {math.sqrt(0.25/a.sets):.3f} 로 "
              + ("매우 크다" if a.sets < 20 else "크다" if a.sets < 60 else "감당 가능"))
    if a.home_edge:
        print(f"  홈 이점 {a.home_edge:+.3f} 적용 (기본 0 — 측정 안 됨)")

    P, (d30, d31, d32) = match_prob(p)
    print(f"\n맞대결 세트 승률 p = {p:.3f}")
    print(f"경기 승률:  홈 {P*100:.1f}%  원정 {(1-P)*100:.1f}%")
    print(f"세트 스코어: 3-0 {d30*100:.1f}%  3-1 {d31*100:.1f}%  3-2 {d32*100:.1f}%  "
          f"| 2-3 {6*q**3*p*p*100:.1f}%  1-3 {3*q**3*p*100:.1f}%  0-3 {q**3*100:.1f}%")
    print(f"세트핸디캡 홈 -1.5 충족(3-0+3-1): {(d30+d31)*100:.1f}%")
    print(f"세트핸디캡 홈 +1.5 충족(패해도 2세트 이상 또는 승): {(P + 6*q**3*p*p)*100:.1f}%")

    n3 = d30 + q ** 3
    n4 = d31 + 3 * q ** 3 * p
    n5 = d32 + 6 * q ** 3 * p * p
    print(f"세트 수 분포: 3세트 {n3*100:.1f}%  4세트 {n4*100:.1f}%  5세트 {n5*100:.1f}%")

    if a.total is not None:
        lo = hi = 0.0
        for n, w in ((3, n3), (4, n4), (5, n5)):
            r0, r1 = TOTAL_RANGE[n]
            if a.total >= r1:
                lo += w; hi += w              # 범위 전체가 기준 아래 → 확실히 언더
            elif a.total > r0:
                f = (a.total - r0) / (r1 - r0)
                lo += w * f; hi += w * f      # 범위 안 — 균등 가정
        print(f"\nU/O {a.total}: 언더 {lo*100:.1f}%  오버 {(1-lo)*100:.1f}%")
        print(f"  ※ 배구.md 1-2 의 세트 수별 총점 범위(3세트 130~150·4세트 170~200·5세트 200~230)에"
              f"\n    세트 수 분포를 걸어 균등 가정으로 낸 값이다. 팀별 세트당 평균 득점이 없으면"
              f"\n    확신도를 '하' 로 적는다(배구.md 1-2).")


if __name__ == "__main__":
    main()
