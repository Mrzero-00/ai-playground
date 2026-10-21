#!/usr/bin/env python3
"""NBA 기준선 — 종목별분석/농구.md 'NBA 기준선' 절(2026-10-20 신설)을 그대로 구현.

그동안 분석가가 매번 손으로 계산해 산술 오류·수축 누락이 났다(124회 9534 페이스 대체,
125회 9742 ±3 해석 차이). 공식을 코드로 고정한다.  (신설 2026-10-22, 125회 08:30 블록)

공식
  페이스추정 = (Pace_홈 + Pace_원정) / 2
  득점_홈   = 페이스추정 × (ORtg_홈 + DRtg_원정 − 115.0) / 100 + 1.4
  득점_원정 = 페이스추정 × (ORtg_원정 + DRtg_홈 − 115.0) / 100 − 1.4
  점수차 ~ N(득점_홈 − 득점_원정, 11.5)   → 승/패·소수핸디캡
  총득점 ~ N(득점_홈 + 득점_원정, 17.5)   → 언더오버
수축(표본): 개막 0~2경기 승패 ×0.80 / 핸디캡·U-O ×0.75, 3~9경기 ×0.90, 10+ 없음.
로스터 보정은 --adj-home / --adj-away 로 **순 레이팅 %p**를 준다(상한 ±3, 농구.md 5항).

사용:
  python3 scripts/nba_baseline.py --home-ortg 115.1 --home-drtg 113.2 --home-pace 99.2 \
      --away-ortg 117.0 --away-drtg 110.5 --away-pace 98.1 \
      --games 0 --spread -1.5 --total 241.5 [--adj-home 1.0] [--adj-away -2.0]
"""
import argparse
import math

LG_RTG = 115.0
HOME_EDGE = 1.4
SD_MARGIN = 11.5
SD_TOTAL = 17.5


def ncdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def shrink(p: float, games: int, kind: str) -> float:
    """농구.md 5항 표본 수축. kind: 'wl' | 'line'"""
    if games <= 2:
        k = 0.80 if kind == "wl" else 0.75
    elif games <= 9:
        k = 0.90
    else:
        k = 1.0
    return (p - 50.0) * k + 50.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--home-ortg", type=float, required=True)
    ap.add_argument("--home-drtg", type=float, required=True)
    ap.add_argument("--home-pace", type=float, required=True)
    ap.add_argument("--away-ortg", type=float, required=True)
    ap.add_argument("--away-drtg", type=float, required=True)
    ap.add_argument("--away-pace", type=float, required=True)
    ap.add_argument("--games", type=int, default=0, help="두 팀 중 적은 쪽의 이번 시즌 경기 수")
    ap.add_argument("--adj-home", type=float, default=0.0, help="홈 순 레이팅 보정 %p (상한 ±3)")
    ap.add_argument("--adj-away", type=float, default=0.0, help="원정 순 레이팅 보정 %p (상한 ±3)")
    ap.add_argument("--spread", type=float, default=None, help="홈 기준 소수핸디캡 (예: -1.5)")
    ap.add_argument("--total", type=float, default=None, help="언더오버 기준선")
    a = ap.parse_args()

    for name, v in (("--adj-home", a.adj_home), ("--adj-away", a.adj_away)):
        if abs(v) > 3.0 + 1e-9:
            raise SystemExit(f"{name}={v}: 농구.md 5항 상한(순 ±3)을 넘는다. 추측 금지.")

    pace = (a.home_pace + a.away_pace) / 2.0
    # 순 보정은 공격에 절반, 수비에 절반(농구.md 5항 'ORtg ±1.5 / DRtg ∓1.5 = 순 ±3')
    h_o, h_d = a.home_ortg + a.adj_home / 2.0, a.home_drtg - a.adj_home / 2.0
    a_o, a_d = a.away_ortg + a.adj_away / 2.0, a.away_drtg - a.adj_away / 2.0

    pts_h = pace * (h_o + a_d - LG_RTG) / 100.0 + HOME_EDGE
    pts_a = pace * (a_o + h_d - LG_RTG) / 100.0 - HOME_EDGE
    margin = pts_h - pts_a
    total = pts_h + pts_a

    print(f"페이스추정 {pace:.1f}  예상 {pts_h:.1f} : {pts_a:.1f}  (마진 {margin:+.1f} · 총득점 {total:.1f})")
    print(f"수축: 표본 {a.games}경기 → 승패 ×{0.80 if a.games<=2 else (0.90 if a.games<=9 else 1.0):.2f}, "
          f"라인 ×{0.75 if a.games<=2 else (0.90 if a.games<=9 else 1.0):.2f}")

    p_home = ncdf(margin / SD_MARGIN) * 100.0
    p_home_s = shrink(p_home, a.games, "wl")
    print(f"승/패:  홈 {p_home_s:.1f}%  원정 {100-p_home_s:.1f}%   (수축 전 {p_home:.1f})")

    if a.spread is not None:
        # 홈 H{spread} 승 = 홈 마진 + spread > 0
        p = ncdf((margin + a.spread) / SD_MARGIN) * 100.0
        ps = shrink(p, a.games, "line")
        print(f"핸디캡 H{a.spread:+.1f}:  홈 {ps:.1f}%  원정 {100-ps:.1f}%   (수축 전 {p:.1f})")

    if a.total is not None:
        p_over = (1.0 - ncdf((a.total - total) / SD_TOTAL)) * 100.0
        ps = shrink(p_over, a.games, "line")
        print(f"U/O {a.total}:  오버 {ps:.1f}%  언더 {100-ps:.1f}%   (수축 전 오버 {p_over:.1f})")


if __name__ == "__main__":
    main()
