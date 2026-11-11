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
import sys

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
    # 리그 평균 축도 정규시즌만으로 잰다 — 팀 레이팅과 같은 자를 써야 ORtg+DRtg−LgRtg 가 성립한다
    # (2026-10-31 프리시즌 제외와 같은 이유. team_ratings 머리말 참조).
    strict = 2 in [g.get("seasontype") for g in db.values()]
    for g in db.values():
        if g.get("status") != "STATUS_FINAL":
            continue
        st_ = g.get("seasontype")
        if strict and st_ is not None and st_ != 2:
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


def _poss(x):
    fga = int(x["fieldGoalsMade-fieldGoalsAttempted"].split("-")[1])
    fta = int(x["freeThrowsMade-freeThrowsAttempted"].split("-")[1])
    return fga + 0.44 * fta - int(x["offensiveRebounds"]) + int(x.get("totalTurnovers") or x["turnovers"])


def team_ratings(as_of=None, path=None):
    """teamdb/nba 박스스코어로 팀별 ORtg·DRtg·페이스를 잰다 → {팀영문명: {o,d,pace,g}}.

    as_of('YYYY-MM-DD' 또는 date/datetime)를 주면 **그 날짜 전에 끝난 경기만** 쓴다.
    기준선에 그 경기 자신이나 이후 결과가 섞이면 채점이 분석력이 아니라 누수를 재게 된다
    (predict_engine 의 시간순 원칙과 같다)."""
    path = path or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "teamdb", "nba", "nba.json")
    try:
        db = json.load(open(path, encoding="utf-8"))
    except Exception:
        return {}
    if as_of is not None and not isinstance(as_of, str):
        as_of = as_of.strftime("%Y-%m-%d")
    agg = {}
    # ── 프리시즌 제외 (2026-10-31, 129회 10/31 08:30 블록에서 발견) ──────────────────
    # teamdb/nba 는 ESPN scoreboard 를 월 단위로 긁어 와서 **프리시즌 경기가 그대로 섞여 있었다**
    # (2026-27 시즌: 10/03~10/17 프리시즌, 10/20 개막). 팀당 3~6경기가 프리시즌이라 레이팅이 통째로 흔들린다.
    # 측정(블록 14개 팀, basketball-reference 2027 팀 페이지를 참값으로):
    #     순레이팅(ORtg−DRtg) 평균절대오차  혼합 5.18점(최대 11.8)  →  정규시즌만 1.51점(최대 2.6)
    # 농구.md 1-1항이 "프리시즌을 섞으면 주전 출전시간이 달라 더 나빠진다"고 이미 적어 뒀는데
    # 자동 기준선 경로에서는 지켜지지 않고 있었다. seasontype==2(정규시즌)만 쓴다.
    # seasontype 이 없는 옛 기록은 버리지 않고 쓰되, 하나라도 2가 보이면 그 종목은 엄격 모드로 전환한다.
    vals = [g.get("seasontype") for g in db.values()]
    strict = 2 in vals
    for g in db.values():
        if g.get("status") != "STATUS_FINAL":
            continue
        st_ = g.get("seasontype")
        if strict and st_ is not None and st_ != 2:
            continue
        # 2026-11-11: date 는 ESPN 의 UTC 시각이고 as_of 는 KST 경기일이다. 앞 10자만 비교하면
        # UTC 19~23시 개막 경기(= KST 다음 날 04~08시)가 하루 앞 날짜로 읽혀 **그 경기 자신이**
        # 레이팅에 들어갔다(채점된 NBA 94행 중 42행). KST 날짜로 바꿔서 비교한다.
        raw = g.get("date") or ""
        day = raw[:10]
        try:
            import datetime as _dt
            day = (_dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
                   .astimezone(_dt.timezone(_dt.timedelta(hours=9))).date().isoformat())
        except ValueError:
            pass
        if as_of and (not day or day >= as_of):
            continue
        st = g.get("stats") or {}
        if "home" not in st or "away" not in st:
            continue
        try:
            ph, pa = _poss(st["home"]), _poss(st["away"])
            sh, sa = int(g["home"]["score"]), int(g["away"]["score"])
            th, ta = g["home"]["team"], g["away"]["team"]
        except Exception:
            continue
        if ph <= 0 or pa <= 0 or not th or not ta:
            continue
        for team, own_pts, own_poss, opp_pts, opp_poss in (
                (th, sh, ph, sa, pa), (ta, sa, pa, sh, ph)):
            x = agg.setdefault(team, [0.0, 0.0, 0.0, 0.0, 0])
            x[0] += own_pts; x[1] += own_poss; x[2] += opp_pts; x[3] += opp_poss; x[4] += 1
    out = {}
    for team, (op, opo, dp, dpo, n) in agg.items():
        if opo <= 0 or dpo <= 0:
            continue
        out[team] = {"o": op / opo * 100, "d": dp / dpo * 100,
                     "pace": (opo + dpo) / (2 * n), "g": n}
    return out


def auto_baseline(home_en, away_en, as_of=None, min_games=3, ratings=None):
    """팀 영문명만으로 기준선을 낸다(보정 0·뉴스 미반영). 자료가 모자라면 None.

    왜 필요한가: 분석하지 않은 농구 경기는 방향이 통째로 비어 채점에서 빠졌다
    (128회 채점 45경기 중 9경기). 축구는 soccer_baseline 이 이 자리를 메우고 있었다."""
    r = ratings if ratings is not None else team_ratings(as_of)
    h, a = r.get(home_en), r.get(away_en)
    if not h or not a:
        return None
    games = min(h["g"], a["g"])
    if games < min_games:
        return None
    lg = sum(v["o"] * v["g"] for v in r.values()) / sum(v["g"] for v in r.values())
    pace = (h["pace"] + a["pace"]) / 2.0
    pts_h = pace * (h["o"] + a["d"] - lg) / 100.0 + HOME_EDGE
    pts_a = pace * (a["o"] + h["d"] - lg) / 100.0 - HOME_EDGE
    # SD_MARGIN(11.5)은 '레이팅을 정확히 안다'는 전제의 경기별 마진 산포다. 여기 레이팅은 이번 시즌
    # n경기로 직접 추정한 값이고 뉴스·결장도 보지 않으므로 두 가지가 더 얹힌다:
    #   ① 추정오차  2·SD²/n  (양 팀 각각 SD/√n)
    #   ② 모형오차  AUTO_MODEL_SD²  (뉴스 미반영·페이스/ORtg 분해 오차 — n이 늘어도 안 준다)
    # ②는 실측값이다 — 소급 66경기에서 '말한 평균 74.0% vs 실제 65.2%'(−8.9p) 였고,
    # 아래 식이 −0.8p 로 맞춘다. 방향은 수축·SD에 불변이라 이 변경은 확률의 정직함만 고친다.
    sd = math.sqrt(SD_MARGIN ** 2 + AUTO_MODEL_SD ** 2 + 2 * SD_MARGIN ** 2 / games)
    p_home = ncdf((pts_h - pts_a) / sd) * 100.0
    return {"p_home": p_home, "pts_h": pts_h, "pts_a": pts_a,
            "games": games, "pace": pace, "lg_rtg": lg, "sd": sd}


_m_rtg, _m_pace = measure_league()
LG_RTG = _m_rtg if _m_rtg else LG_RTG_FALLBACK
LG_PACE = _m_pace
HOME_EDGE = HOME_EDGE_FALLBACK
SD_MARGIN = 11.5
SD_TOTAL = 17.5
# 모형오차 — 뉴스를 보지 않고 이번 시즌 n경기로 레이팅을 직접 추정하는 데서 오는,
# 표본이 늘어도 줄지 않는 오차. 2026-11-10 NBA 87경기 재측정으로 18.0 → 20.0
# (격차 −1.0p → +0.1p, Brier 0.2185 → 0.2179). 이전 값 18.0 은 66경기 측정.
#
# ★ 2026-11-10: CLI 경로에도 적용한다 (133회에서 드러난 구조적 과신의 원인).
# 원래 주석은 "분석가가 직전시즌 레이팅·결장 보정을 직접 넣는 CLI 경로에는 적용하지 않는다"였다.
# 그런데 실제 운영은 그 전제와 다르다 — 2026-10-26 구조 전환으로 **보정 0 이 기본값**이 되었고,
# 분석가는 이번 시즌 레이팅을 그대로 넣는다. 즉 auto_baseline 과 같은 상황인데 SD 만 절반이었다.
# 그 결과 133회에서 기준선이 시장을 크게 넘었다 — 댈러스 84.1%(시장 62.0%) · 휴스턴 77.2%(60.5%) ·
# 샌안토니오 88.2%(77.0%) · 닉스 96.9%. 농구 141경기 실측으로 내-시장 +15%p 이상 구간의
# 실제 적중이 35.0%(n=20, 내 말 68.4%)여서 그 구간 다리를 전부 버려야 했다.
# 레이팅에 없는 정보를 분석가가 실제로 더한 경우에만 --exact-ratings 로 끈다.
# 재측정: python3 scripts/nba_baseline.py --calib   (표본 120경기마다)
# 2026-11-11: 위 20.0 은 누수 섞인 표본으로 고른 값이었다(as_of 의 UTC/KST 혼동으로 94행 중 42행에
# 자기 경기가 레이팅에 들어감 → 실제보다 잘 맞는 것처럼 보여 SD 가 작게 나왔다). 누수를 걷어낸
# 89경기 재측정: SD 20 격차 −1.4p(Brier 0.2246) → SD 22 격차 −0.4p(0.2240) → SD 24 +0.5p(0.2236).
AUTO_MODEL_SD = 22.0


def cli_sd(games, exact=False):
    """CLI 경로의 마진 SD. exact=True 면 '레이팅을 정확히 안다' 전제(옛 동작)."""
    if exact:
        return SD_MARGIN
    g = max(1, games)
    return math.sqrt(SD_MARGIN ** 2 + AUTO_MODEL_SD ** 2 + 2 * SD_MARGIN ** 2 / g)


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


def calib() -> None:
    """auto_baseline 의 확률이 실제와 맞는지 재측정하고 AUTO_MODEL_SD 후보를 보여 준다.
    방향 적중률은 SD 에 불변이므로 여기서 고치는 것은 '내가 말한 확률의 정직함'뿐이다."""
    import csv as _csv, re as _re
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rows = list(_csv.DictReader(open(os.path.join(root, "전체경기기록.csv"), encoding="utf-8")))
    cache, data = {}, []
    for r in rows:
        if r.get("종목") != "농구" or r.get("리그") != "NBA" or r.get("결과") not in ("승", "패"):
            continue
        m = _re.match(r"(\d{2})-(\d{2})", r.get("시각") or "")
        if not m:
            continue
        d = f"2026-{m.group(1)}-{m.group(2)}"
        if d not in cache:
            cache[d] = team_ratings(d)
        rt = cache[d]
        import teamdb as _T
        h, a = rt.get(_T.en_name(r["홈"])), rt.get(_T.en_name(r["원정"]))
        if not h or not a or min(h["g"], a["g"]) < 3:
            continue
        g = min(h["g"], a["g"])
        lg = sum(v["o"] * v["g"] for v in rt.values()) / sum(v["g"] for v in rt.values())
        pace = (h["pace"] + a["pace"]) / 2.0
        mg = (pace * (h["o"] + a["d"] - lg) / 100.0 + HOME_EDGE) - (pace * (a["o"] + h["d"] - lg) / 100.0 - HOME_EDGE)
        data.append((mg, g, r["결과"] == "승"))
    if not data:
        print("대조할 경기가 없다."); return
    hit = sum(1 for mg, g, w in data if (mg >= 0) == w) / len(data) * 100
    print(f"NBA auto_baseline 소급 {len(data)}경기 · 방향 적중 {hit:.1f}% (SD 에 불변)")
    print(f"현행 AUTO_MODEL_SD = {AUTO_MODEL_SD}")
    best = None
    for E in range(6, 31, 2):
        ps = [ncdf(mg / math.sqrt(SD_MARGIN ** 2 + E ** 2 + 2 * SD_MARGIN ** 2 / g)) * 100 for mg, g, _ in data]
        said = sum(max(p, 100 - p) for p in ps) / len(ps)
        br = sum(((p / 100) - (1 if w else 0)) ** 2 for p, (_, _, w) in zip(ps, data)) / len(ps)
        gap = hit - said
        mark = ""
        if best is None or abs(gap) < abs(best[1]):
            best = (E, gap); mark = ""
        print(f"  모형SD {E:2d} → 말한평균 {said:5.1f}%  격차 {gap:+5.1f}p  Brier {br:.4f}")
    print(f"→ 격차가 가장 작은 값: AUTO_MODEL_SD = {best[0]} ({best[1]:+.1f}p)")


def main() -> None:
    if "--calib" in sys.argv:
        return calib()
    ap = argparse.ArgumentParser()
    ap.add_argument("--home-ortg", type=float, required=True)
    ap.add_argument("--home-drtg", type=float, required=True)
    ap.add_argument("--home-pace", type=float, required=True)
    ap.add_argument("--away-ortg", type=float, required=True)
    ap.add_argument("--away-drtg", type=float, required=True)
    ap.add_argument("--away-pace", type=float, required=True)
    ap.add_argument("--games", type=int, default=0, help="두 팀 중 적은 쪽의 이번 시즌 경기 수")
    ap.add_argument("--adj-home", type=float, default=0.0, help="홈 순 레이팅 보정 %%p (상한 ±3)")
    ap.add_argument("--adj-away", type=float, default=0.0, help="원정 순 레이팅 보정 %%p (상한 ±3)")
    ap.add_argument("--spread", type=float, default=None, help="홈 기준 소수핸디캡 (예: -1.5)")
    ap.add_argument("--total", type=float, default=None, help="언더오버 기준선")
    ap.add_argument("--exact-ratings", action="store_true",
                    help="레이팅에 없는 정보(직전시즌 보정·결장 반영)를 직접 넣은 경우에만. "
                         "모형오차를 빼고 SD_MARGIN 만 쓴다 — 2026-11-10 이전의 옛 동작")
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
    if a.exact_ratings:
        print(f"수축: 표본 {a.games}경기 → 승패 ×{0.80 if a.games<=2 else (0.90 if a.games<=9 else 1.0):.2f}, "
              f"라인 ×{0.75 if a.games<=2 else (0.90 if a.games<=9 else 1.0):.2f}  (농구.md 5항)")

    sd = cli_sd(a.games, a.exact_ratings)
    # ★ 2026-11-11: 표본 수축(농구.md 5항)은 --exact-ratings 일 때만 건다.
    # 5항의 근거는 "직전 시즌 효율은 (이번 시즌 로스터에 대한) 추정치일 뿐"이다.
    # 이번 시즌 레이팅을 넣는 기본 경로에서는 그 불확실성이 cli_sd 의 추정오차
    # 2·SD_MARGIN²/n 으로 이미 모형화돼 있다. 둘을 같이 걸면 이중 계산이다.
    if a.exact_ratings:
        p_home = ncdf(margin / sd) * 100.0
        p_home_s = shrink(p_home, a.games, "wl")
        print(f"승/패:  홈 {p_home_s:.1f}%  원정 {100-p_home_s:.1f}%   (수축 전 {p_home:.1f})")
    else:
        print(f"마진 SD {sd:.1f} = 경기산포 {SD_MARGIN} + 모형오차 {AUTO_MODEL_SD} + 추정오차(n={a.games})"
              f"   [--exact-ratings 로 끄면 {SD_MARGIN} + 수축]")
        p_home = p_home_s = ncdf(margin / sd) * 100.0
        print(f"승/패:  홈 {p_home_s:.1f}%  원정 {100-p_home_s:.1f}%")

    if a.spread is not None:
        # 홈 H{spread} 승 = 홈 마진 + spread > 0
        p = ncdf((margin + a.spread) / sd) * 100.0
        ps = shrink(p, a.games, "line") if a.exact_ratings else p
        print(f"핸디캡 H{a.spread:+.1f}:  홈 {ps:.1f}%  원정 {100-ps:.1f}%   (수축 전 {p:.1f})")

    if a.total is not None:
        p_over = (1.0 - ncdf((a.total - total) / SD_TOTAL)) * 100.0
        ps = shrink(p_over, a.games, "line") if a.exact_ratings else p_over
        print(f"U/O {a.total}:  오버 {ps:.1f}%  언더 {100-ps:.1f}%   (수축 전 오버 {p_over:.1f})")


if __name__ == "__main__":
    main()
