#!/usr/bin/env python3
"""회차 감시·마감 블록 분석 일정 (사용자 요청 2026-10-10)

운영 방식
- 하루 두 번(00시·12시) `check`: 베트맨 판매 중 회차 중 아직 `전체경기기록.csv`에 없는 새 회차가 있으면
  등록(round_log init)하고, 경기들을 **판매 마감 시각(베트맨 endDate) 기준 블록**으로 묶어 `분석일정.csv`에 쓴다.
  새 회차가 없으면 아무것도 하지 않는다(토큰 절약).
- 블록 = **판매 마감이 가까운 경기 묶음**: 가장 이른 마감부터 WINDOW(60분) 안에 마감되는 경기를 한 블록으로,
  그다음 경기부터 다시 새 블록(사용자 요청 2026-10-10: 오전/오후처럼 넓게 묶으면 앞뒤 경기 시간차가 커서 의미 없음).
  블록 이름 = 첫 마감 'MM/DD HH:MM'. 새벽(00~06시) 마감 경기는 하루치를 한 블록으로 묶어 00시에 분석.
- 분석 시각 = 블록의 가장 이른 마감 − 70분(선발·라인업 발표 직후). 단 **새벽 블록은 그날 00시**에 분석한다.
  → 분석은 마감 직전에 한 번만 한다(이중 분석 없음). 분석 직후 추천 = 그 자체가 구매 직전 점검.
- Claude 쪽: 00/12시 정기 작업이 `check` 후 `due`/`plan`을 보고, 블록 분석 시각마다 일회성 예약 작업을 건다.
  블록 분석이 끝나면 `done`으로 상태를 바꾸고 커밋·푸시(main, main:pacu).

사용
  python3 scripts/round_watch.py check            # 새 회차 등록 + 블록 일정 작성 (없으면 '새 회차 없음')
  python3 scripts/round_watch.py plan             # 대기 중 블록과 분석 시각
  python3 scripts/round_watch.py due              # 분석 시각이 지난 대기 블록 (지금 분석할 것)
  python3 scripts/round_watch.py games <회차> <블록>   # 그 블록 경기 목록 (번호·시각·마감·리그·대진)
  python3 scripts/round_watch.py done <회차> <블록> [메모]
  python3 scripts/round_watch.py unreserve        # '예약됨' 표시 지우기(다른 PC·새 세션에서 루프를 다시 켤 때 — 예약은 세션 한정)
  python3 scripts/round_watch.py add <회차>        # 이미 등록된 회차의 남은 블록을 일정에 추가(진행 중 회차를 루프로 넘길 때)
"""
import csv
import datetime as dt
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import odds_scan as o  # noqa: E402
import round_log as rl  # noqa: E402

PLAN = os.path.join(ROOT, "분석일정.csv")
COLS = ["회차", "블록", "첫마감", "끝마감", "분석시각", "경기수", "종목", "상태", "메모"]
LEAD_MIN = 70
WINDOW = 60  # 블록 첫 마감 ~ 마지막 마감 최대 간격(분) — 사용자: 최대한 동일 시간대끼리
MIN_GAMES, MERGE_SPAN = 3, 90  # 3경기 미만 블록은 합쳐도 간격 90분 이내인 이웃 블록과 합친다(조합을 못 만드는 블록 방지)


def kst(ms):
    return dt.datetime.fromtimestamp(ms / 1000, o.KST).replace(tzinfo=None)


def now():
    return dt.datetime.now(o.KST).replace(tzinfo=None)


def is_dawn(t):
    return t.hour < 6


def assign_blocks(gs):
    """마감 순으로 훑으며 WINDOW 안에 마감되는 경기를 한 블록으로. 반환 {블록이름: [경기]}"""
    out, start, name = {}, None, None
    for g in sorted(gs, key=lambda g: g["마감"]):
        c = g["마감"]
        if is_dawn(c):
            key = f"{c:%m/%d} 새벽"
        else:
            if start is None or (c - start).total_seconds() / 60 > WINDOW or is_dawn(start):
                start, name = c, f"{c:%m/%d %H:%M}"
            key = name
        out.setdefault(key, []).append(g)
    return merge_small(out)


def merge_small(blocks):
    order = sorted(blocks.items(), key=lambda kv: min(g["마감"] for g in kv[1]))
    changed = True
    while changed:
        changed = False
        for i, (name, gs) in enumerate(order):
            if len(gs) >= MIN_GAMES or name.endswith("새벽"):
                continue
            best = None
            for j in (i - 1, i + 1):
                if 0 <= j < len(order) and not order[j][0].endswith("새벽"):
                    allg = gs + order[j][1]
                    span = (max(g["마감"] for g in allg) - min(g["마감"] for g in allg)).total_seconds() / 60
                    if span <= MERGE_SPAN and (best is None or span < best[0]):
                        best = (span, j)
            if best:
                j = best[1]
                a, b = sorted((i, j))
                merged = order[a][1] + order[b][1]
                order[a] = (f"{min(g['마감'] for g in merged):%m/%d %H:%M}", merged)
                del order[b]
                changed = True
                break
    return dict(order)


def sale_rounds():
    rounds, _, _ = o.betman(os.path.join(ROOT, "data", ".betman_cookie"))
    return [int(r["gmOsidTs"]) for r in rounds]


def games_of(rnd):
    """경기 단위(대표 시장) + 마감. 대진 미정 제외."""
    out = []
    for g in rl.main_markets(rl.fetch_round(rnd)):
        close = kst(g.get("endDate") or g["gameDate"])
        out.append({"번호": g["matchSeq"], "시각": kst(g["gameDate"]), "마감": close, "종목": rl.SPORT.get(g["itemCode"], ""),
                    "리그": g["leagueName"], "홈": g["homeName"], "원정": g["awayName"]})
    return out


def load_plan():
    return list(csv.DictReader(open(PLAN, encoding="utf-8"))) if os.path.exists(PLAN) else []


def save_plan(rows):
    w = csv.DictWriter(open(PLAN, "w", encoding="utf-8", newline=""), fieldnames=COLS)
    w.writeheader(); w.writerows(rows)


def build_blocks(rnd):
    blocks = assign_blocks([g for g in games_of(rnd) if g["마감"] > now()])
    rows = []
    for name, gs in sorted(blocks.items(), key=lambda kv: min(g["마감"] for g in kv[1])):
        first = min(g["마감"] for g in gs)
        if is_dawn(first):
            at = first.replace(hour=0, minute=0)
        else:
            at = first - dt.timedelta(minutes=LEAD_MIN)
        at = max(at, now())
        sp = {}
        for g in gs:
            sp[g["종목"]] = sp.get(g["종목"], 0) + 1
        rows.append({"회차": rnd, "블록": name, "첫마감": f"{first:%Y-%m-%d %H:%M}",
                     "끝마감": f"{max(g['마감'] for g in gs):%Y-%m-%d %H:%M}", "분석시각": f"{at:%Y-%m-%d %H:%M}",
                     "경기수": len(gs), "종목": " ".join(f"{k}{v}" for k, v in sp.items()), "상태": "대기", "메모": ""})
    return rows


def cmd_check():
    known = {r["회차"] for r in csv.DictReader(open(rl.PATH, encoding="utf-8"))} if os.path.exists(rl.PATH) else set()
    planned = {r["회차"] for r in load_plan()}
    new = [r for r in sale_rounds() if str(r) not in known and str(r) not in planned]
    if not new:
        print("새 회차 없음")
        return
    plan = load_plan()
    for rnd in new:
        subprocess.run([sys.executable, os.path.join(HERE, "round_log.py"), "init", str(rnd)])
        rows = build_blocks(rnd)
        plan += rows
        print(f"{rnd}회 등록 — 블록 {len(rows)}개")
        for r in rows:
            print(f"  {r['블록']}: {r['경기수']}경기({r['종목']}) 마감 {r['첫마감'][5:]}~{r['끝마감'][11:]} → 분석 {r['분석시각'][5:]}")
    save_plan(plan)


def cmd_plan(due_only=False):
    rows = [r for r in load_plan() if r["상태"] == "대기"]
    if due_only:
        rows = [r for r in rows if dt.datetime.strptime(r["분석시각"], "%Y-%m-%d %H:%M") <= now()]
    if not rows:
        print("없음")
    for r in rows:
        print(f"{r['회차']}\t{r['블록']}\t분석 {r['분석시각']}\t마감 {r['첫마감']}~{r['끝마감'][11:]}\t{r['경기수']}경기 {r['종목']}")


def cmd_games(rnd, block):
    for g in assign_blocks(games_of(rnd)).get(block, []):
        if True:
            print(f"{g['번호']}\t{g['시각']:%m-%d %H:%M}\t마감 {g['마감']:%m-%d %H:%M}\t{g['종목']}\t{g['리그']}\t{g['홈']} vs {g['원정']}")


def cmd_done(rnd, block, memo=""):
    rows = load_plan()
    for r in rows:
        if r["회차"] == str(rnd) and r["블록"] == block:
            r["상태"], r["메모"] = "분석완료", memo or f"{now():%m/%d %H:%M}"
    save_plan(rows)
    print("완료 처리")


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__); return
    if a[0] == "check":
        cmd_check()
    elif a[0] == "plan":
        cmd_plan()
    elif a[0] == "due":
        cmd_plan(due_only=True)
    elif a[0] == "games":
        cmd_games(int(a[1]), a[2])
    elif a[0] == "unreserve":
        rows = load_plan()
        for r in rows:
            if r["상태"] == "대기" and r["메모"] == "예약됨":
                r["메모"] = ""
        save_plan(rows)
        print("예약 표시 초기화")
    elif a[0] == "add":
        plan = [r for r in load_plan() if r["회차"] != a[1] or r["상태"] != "대기"]
        have = {(r["회차"], r["블록"]) for r in plan}
        rows = [r for r in build_blocks(int(a[1])) if (str(r["회차"]), r["블록"]) not in have]
        save_plan(plan + rows)
        for r in rows:
            print(f"  {r['블록']}: {r['경기수']}경기({r['종목']}) 마감 {r['첫마감'][5:]}~{r['끝마감'][11:]} → 분석 {r['분석시각'][5:]}")
    elif a[0] == "done":
        cmd_done(a[1], a[2], " ".join(a[3:]))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
