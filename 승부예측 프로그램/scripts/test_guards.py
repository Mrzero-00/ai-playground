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

    g = {"hg": 2, "ag": 0, "hs": 10.0, "hst": 4.0}
    check("eff_goals: 슈팅이 있으면 골과 반씩", abs(sb.eff_goals(g, "h") - (0.5 * 2 + 0.5 * (0.30 * 4 + 0.03 * 6))) < 1e-9)
    check("eff_goals: 슈팅이 없으면 골 그대로", sb.eff_goals(g, "a") == 0)

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

    import intl_baseline as ib
    b1, b2 = ib.baseline("잉글랜드", "크로아티아", date="2026-01-01"), ib.baseline("잉글랜드", "크로아티아", date="2020-01-01")
    check("intl: 날짜 cutoff 가 레이팅을 바꾼다(사후 누수 없음)", b1 and b2 and b1["n_h"] > b2["n_h"])
    check("intl: 승무패 4자 약칭도 찾는다", ib.name("카자흐스") == "Kazakhstan" and ib.name("없는팀") is None)
    p = ib.probs(0.0)
    check("intl: 확률 합 1 · 동률이면 대칭", abs(sum(p) - 1) < 1e-9 and abs(p[0] - p[2]) < 1e-9)

    check("intl: 중립 판정 — 제3국만 중립", ib._neutral("Hungary", "Israel") and not ib._neutral("Congo", "DR Congo")
          and not ib._neutral("England", "Wales") and not ib._neutral("", "Germany"))
    gh, ga = ib.goals(0.0)
    check("intl: 득점식 — Elo 동률이면 양쪽 기대 득점이 같다", abs(gh - ga) < 0.01 and ib.goals(300)[0] > ib.goals(300)[1])

    # 2026-11-17: 다리판단을 글머리로만 읽는다 — "가능 — 제외 기준 (a)~(d) 해당 없음" 을 제외로 읽은 적이 있다
    import leg_flags as lf
    check("leg_flags: '가능 — 제외 기준 …' 은 가능", lf.parse("가능 — 제외 기준 (a)~(d) 해당 없음")[:2] == ("가능", ""))
    check("leg_flags: 제외 사유는 첫 문장에서만", lf.parse("제외권고 — (e) 감독이 로테이션 예고. 다만 (a)(d) 는 해당 없음")[:2] == ("제외", "e"))
    check("leg_flags: 판정 없는 글은 버린다", lf.parse("확신 낮음") is None and lf.parse("") is None)

    import matchkey
    check("matchkey: 승무패 4자 약칭 = 프로토 전체 이름",
          matchkey.key({"시각": "2026-11-17 04:45", "홈": "보스니아", "원정": "루마니아"})
          == matchkey.key({"시각": "11-17 04:45", "홈": "보스니아 헤르체고비나", "원정": "루마니아"}))
    check("matchkey: 4자보다 짧은 약칭도 같은 경기",
          matchkey.key({"시각": "2026-11-13 23:30", "홈": "사우디", "원정": "한국"})
          == matchkey.key({"시각": "11-13 23:30", "홈": "사우디아라비아", "원정": "한국"}))
    check("matchkey: 같은 팀이라도 시각이 다르면 다른 경기",
          matchkey.key({"시각": "11-17 04:45", "홈": "독일", "원정": "네덜란드"}) != matchkey.key({"시각": "11-14 04:45", "홈": "독일", "원정": "네덜란드"}))

    import toto_marks as tm
    check("toto_marks: 복수 마킹 읽기", tm.parse("1:승, 5:승/무,13:패/승") == {"1": ["승"], "5": ["승", "무"], "13": ["패", "승"]})

    print(f"\n{'전부 통과' if not FAIL else f'실패 {len(FAIL)}건: ' + ', '.join(FAIL)}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
