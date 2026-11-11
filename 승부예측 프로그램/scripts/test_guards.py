#!/usr/bin/env python3
"""조용히 틀린 값을 내던 결함의 회귀 시험 (2026-11-11 감사에서 고친 것들).

이 스크립트들은 실패해도 숫자를 계속 내기 때문에 회고에서 사람이 우연히 발견해 왔다.
고칠 때마다 여기에 한 줄을 더한다. 네트워크를 쓰지 않는다.

    python3 scripts/test_guards.py
"""
import datetime as dt, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
FAIL = []


def check(name, cond, got=None):
    print(("  ok  " if cond else "  FAIL") + f" {name}" + ("" if cond else f"  → {got}"))
    if not cond:
        FAIL.append(name)


def main():
    import soccer_baseline as sb
    kst = sb.KST
    # 12월에 본 1월 경기는 내년이다 (전에는 작년으로 읽어 1년 묵은 레이팅을 썼다)
    k = sb.kickoff("01-02 21:00", dt.datetime(2026, 12, 30, tzinfo=kst))
    check("kickoff: 12월에 본 1월 경기 = 다음 해", k and k.year == 2027, k)
    k = sb.kickoff("12-28 21:00", dt.datetime(2027, 1, 3, tzinfo=kst))
    check("kickoff: 1월에 본 12월 경기 = 지난 해", k and k.year == 2026, k)
    # 연도가 적힌 시각도 읽는다 (전에는 None → cutoff 없음 → 결과를 본 기준선)
    k = sb.kickoff("2026-11-05 05:00", dt.datetime(2026, 11, 11, tzinfo=kst))
    check("kickoff: 'YYYY-MM-DD HH:MM' 형식", k is not None and k.astimezone(kst).day == 5, k)

    import match_inputs as mi
    for eng, lg in (("Queens Park Rangers", "잉글랜드 챔피언십"), ("Inter Miami CF", "미국 메이저리그사커"),
                    ("Port FC", "AFC 챔피언스리그2")):
        u = mi.us_team(eng, league=lg)
        check(f"us_team: {eng} 는 5대 리그 밖 — 남의 팀 xG 를 주지 않는다", u is None, u and u[1].get("title"))
    u = mi.us_team("Liverpool", league="잉글랜드 프리미어리그")
    check("us_team: 5대 리그 팀은 그대로 찾는다", bool(u) and u[1].get("title") == "Liverpool", u)

    out = subprocess.run([sys.executable, os.path.join(HERE, "kovo_baseline.py"), "--home-sets", "6", "--home-lost", "1",
                          "--away-sets", "2", "--away-lost", "6"], capture_output=True, text=True).stdout
    import re
    m = re.search(r"경기 승률:\s*홈\s*([\d.]+)%", out)
    check("kovo: --sets 를 빼도 수축한다 (전에는 99.6%)", bool(m) and float(m.group(1)) < 90, m and m.group(1))

    import prior
    check("prior._day: 연도 없는 시각", prior._day({"시각": "11-05 05:00"}) == "2026-11-05")
    check("prior._day: 1월은 2027", prior._day({"시각": "01-05 05:00"}) == "2027-01-05")

    import safe_picks as sp
    g = {"mp": 66.0, "od": {"승": 1.40, "무": 4.2, "패": 7.0}, "my": {"승": 60.0, "무": 26.0, "패": 14.0},
         "mt": "승", "bt": "승"}
    check("safe_picks: 무 26% 는 옛 문턱에서 탈락", not sp.passes(g, sp.DEF) and "무" in sp.why_fail(g, sp.DEF))
    check("safe_picks: 무 문턱을 끄면 후보", sp.passes(g, dict(sp.DEF, draw=101.0)))

    import nba_baseline as nb
    check("nba: AUTO_MODEL_SD 는 누수 제거 후 값", nb.AUTO_MODEL_SD >= 22.0, nb.AUTO_MODEL_SD)

    print(f"\n{'전부 통과' if not FAIL else f'실패 {len(FAIL)}건: ' + ', '.join(FAIL)}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
