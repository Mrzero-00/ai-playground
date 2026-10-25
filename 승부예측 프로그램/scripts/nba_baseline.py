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
import json
import math
import os

# LG_RTG 는 '넣는 ORtg/DRtg 와 같은 축'이어야 한다 — 이 상수가 축과 어긋나면 **총득점만** 통째로 밀린다
# (마진 식에서는 LG_RTG 가 소거되므로 승패·핸디캡에는 영향이 없다).
# 2026-10-25(126회 08:30 블록) 발견: 문서·상수의 115.0 / 페이스 99.0 은 이번 시즌 축이 아니다.
#   teamdb/nba 박스스코어 실측(포제션 = FGA + 0.44·FTA − OREB + TOV):
#     전체 81경기 리그 ORtg 108.2 · 페이스 106.0 · 총득점 229.3
#     정규시즌 12경기 리그 ORtg 109.0 · 페이스 105.6 · 총득점 230.1
#   우리 장부에서도 같은 방향이 찍혀 있었다 — NBA 예상 총득점 230.1 vs 실제 220.8 (n=19, **+9.4 과대**).
# 그래서 상수를 박아 두지 않고 **박스스코어에서 재서 쓴다**. 자료가 없으면 FALLBACK 을 쓴다.
LG_RTG_FALLBACK = 108.5
HOME_EDGE_FALLBACK = 1.4


def measure_league(path=None):
    """teamdb/nba 박스스코어에서 리그 평균 ORtg·페이스를 잰다. 실패하면 (None, None)."""
    path = path or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "teamdb", "nba", "nba.json")
    try:
        db = json.load(open(path, encoding="utf-8"))
    except Exception:
        return None, None
    rt, pc = [], []
    for g in db.values():
        if g.get("status") != "STATUS_FINAL":
            continue
        st = g.get("stats") or {}
        if "home" not in st or "away" not in st:
            continue
        try:
            def poss(x):
                fga = int(x["fieldGoalsMade-fieldGoalsAttempted"].split("-")[1])
                fta = int(x["freeThrowsMade-freeThrowsAttempted"].split("-")[1])
                return fga + 0.44 * fta - int(x["offensiveRebounds"]) + int(x.get("totalTurnovers") or x["turnovers"])
            p = (poss(st["home"]) + poss(st["away"])) / 2
            pts = int(g["home"]["score"]) + int(g["away"]["score"])
        except Exception:
            continue
        if p <= 0:
            continue
        rt.append(pts / (2 * p) * 100)
        pc.append(p)
    if len(rt) < 10:
        return None, None
    return sum(rt) / len(rt), sum(pc) / len(pc)


_m_rtg, _m_pace = measure_league()
LG_RTG = _m_rtg if _m_rtg else LG_RTG_FALLBACK
LG_PACE = _m_pace
HOME_EDGE = HOME_EDGE_FALLBACK
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
    ap.add_argument("--lg-rtg", type=float, default=None,
                    help="리그 평균 ORtg — 넣는 ORtg/DRtg 와 같은 축이어야 한다. "
                         "직전 시즌 basketball-reference 레이팅을 쓸 때는 그 시즌 리그 평균(예: 2025-26 = 115.8)을 넣는다. "
                         "생략하면 teamdb 박스스코어 실측값을 쓴다(이번 시즌 축).")
    a = ap.parse_args()
    global LG_RTG
    if a.lg_rtg is not None:
        LG_RTG = a.lg_rtg

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
