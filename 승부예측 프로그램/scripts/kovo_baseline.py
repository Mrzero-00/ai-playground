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

# 팀 간 세트 승률의 **참** 산포 — 2026-11-11 실측.
# V-리그 정규리그 최종 순위표의 세트 득실률(SR)로 분산성분을 냈다.
# 남자부 5시즌 35팀시즌 · 여자부 4시즌 28팀시즌, 팀당 36경기 ≈ 140세트
# (표본오차분산 0.25/140 = 0.00179 을 관측분산에서 뺀 값):
#     남자  관측 0.01089 - 오차 0.00179 = 참 0.00910 → SD 0.095
#     여자  관측 0.01380 - 오차 0.00179 = 참 0.01202 → SD 0.110
#     합계                                          → SD 0.102
# 이전 가정값 0.045 는 **2.3배 작았다**(V리그 세트 득실률 범위를 0.75~1.35 로
# 좁게 잡은 탓. 실제로는 2024-25 현대캐피탈 2.743, 2025-26 삼성화재 0.388 처럼
# 훨씬 넓다). 그 결과 시즌 초 확률이 과하게 50% 로 끌려갔다.
# '팀당 140세트'는 36경기 x 3.9 가정인데 결과가 여기 둔감하다 — 3.3~4.4 범위 전체에서
# 남자 0.093~0.097 · 합계 0.100~0.103 이다. 그래서 **획득/허용 세트 절대값은 필요 없다**
# (KOVO 공식·Daum 은 JS 렌더라 WebFetch 로 못 읽는데, 굳이 브라우저 자동화를 쓸 이유가 없다).
# 재추정: 시즌이 끝날 때마다 최종 순위표 SR 을 넣어 다시 돌린다.
PRIOR_SD_M = 0.095      # 남자부
PRIOR_SD_W = 0.110      # 여자부
PRIOR_SD = 0.102        # 성별 미지정 기본값(합계)

# ★ 시즌 간 지속성 — 2026-11-11 실측.
# 직전 시즌 세트 승률 s 가 다음 시즌 s 를 얼마나 예측하는가.
# V-리그 남자 5시즌 + 여자 4시즌의 **연속 팀-시즌 49쌍**:
#     r = +0.477 (SE 0.147, z = +3.24) → 유의
#     회귀계수 b = r·(sy/sx) = 0.471
# 즉 직전 시즌 s 를 그대로 쓰면 안 되고 0.5 쪽으로 53% 되돌려야 한다.
#     사전분포 중심 = 0.5 + 0.471 × (직전시즌 s − 0.5)
# 시즌 초에는 이 중심으로 수축하는 것이 0.5 로 수축하는 것보다 낫다
# (농구.md 5항 '시즌 초에는 직전 시즌 레이팅을 쓴다'와 같은 구조).
# 직전 시즌 SR 을 모르면 중심이 0.5 가 되고, 그때는 그냥 표본만 쓰는 셈이다.
SEASON_CARRY = 0.471
# 배구.md 1-2 세트 수별 총점 범위 (25점제 3~4세트 + 15점제 5세트)
TOTAL_RANGE = {3: (130, 150), 4: (170, 200), 5: (200, 230)}


def shrink_s(s, sets, prior_sd=PRIOR_SD):
    """세트 승률을 0.5 쪽으로 수축. sets 가 작으면 거의 0.5 로 간다."""
    if not sets or sets <= 0:
        return s, 0.0
    se2 = 0.25 / sets
    rel = prior_sd ** 2 / (prior_sd ** 2 + se2)
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
    ap.add_argument("--women", action="store_true", help="여자부 (PRIOR_SD 0.110, 기본 남자부 0.095)")
    ap.add_argument("--prior-sd", type=float, help="PRIOR_SD 직접 지정(민감도 확인용)")
    ap.add_argument("--home-prev", type=float,
                    help="홈팀 **직전 시즌** 세트 득실률. 시즌 초에 특히 중요하다 — "
                         "주면 0.5 대신 이 값에서 수축한다(실측 지속성 r=+0.477)")
    ap.add_argument("--away-prev", type=float, help="원정팀 직전 시즌 세트 득실률")
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
    psd = a.prior_sd if a.prior_sd else (PRIOR_SD_W if a.women else PRIOR_SD_M)

    def center(prev):
        """사전분포 중심 — 직전 시즌이 있으면 그것을 0.5 쪽으로 되돌린 값."""
        if prev is None:
            return 0.5
        return 0.5 + SEASON_CARRY * (prev / (1 + prev) - 0.5)

    ch, ca = center(a.home_prev), center(a.away_prev)
    # 2026-11-11: 세트 수를 --home-sets/--home-lost 로 줬는데 --sets 를 빠뜨리면 수축이 조용히 꺼졌다
    # (6-1 vs 2-6 → 경기 승률 99.6%). 준 세트 수에서 적은 쪽을 스스로 센다.
    if not a.sets and None not in (a.home_sets, a.home_lost, a.away_sets, a.away_lost):
        a.sets = min(a.home_sets + a.home_lost, a.away_sets + a.away_lost)
        print(f"(--sets 생략 — 입력한 세트 수에서 {a.sets} 로 잡아 수축한다)")
    if a.no_shrink or not a.sets:
        sh, sa, rel = sh_raw, sa_raw, 1.0
    else:
        se2 = 0.25 / a.sets
        rel = psd ** 2 / (psd ** 2 + se2)
        sh = ch + rel * (sh_raw - ch)
        sa = ca + rel * (sa_raw - ca)
    if a.home_prev is not None or a.away_prev is not None:
        print(f"직전 시즌 중심  홈 {ch:.3f}  원정 {ca:.3f}  "
              f"(지속성 {SEASON_CARRY} 적용 — 직전 시즌을 0.5 쪽으로 53% 되돌린 값)")
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
