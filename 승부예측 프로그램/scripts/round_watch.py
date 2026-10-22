#!/usr/bin/env python3
"""회차 감시·마감 블록 분석 일정 (사용자 요청 2026-10-10)

운영 방식
- 하루 한 번(08시, 베트맨 새 회차 오픈 시각 — 2026-10-12. 이전엔 00·12시) `check`: 베트맨 판매 중 회차 중 아직 `전체경기기록.csv`에 없는 새 회차가 있으면
  등록(round_log init)하고, 경기들을 **판매 마감 시각(베트맨 endDate) 기준 블록**으로 묶어 `분석일정.csv`에 쓴다.
  새 회차가 없으면 아무것도 하지 않는다(토큰 절약).
- 블록 = **판매 마감이 가까운 경기 묶음**: 가장 이른 마감부터 WINDOW(60분) 안에 마감되는 경기를 한 블록으로,
  그다음 경기부터 다시 새 블록(사용자 요청 2026-10-10: 오전/오후처럼 넓게 묶으면 앞뒤 경기 시간차가 커서 의미 없음).
  블록 이름 = 첫 마감 'MM/DD HH:MM'. 새벽(00~06시) 마감 경기는 하루치를 한 블록으로 묶어 00시에 분석.
- 분석 시각 = 블록의 가장 이른 마감 − 70분(선발·라인업 발표 직후). 단 **새벽 블록은 그날 00시**에 분석한다.
  → 분석은 마감 직전에 한 번만 한다(이중 분석 없음). 분석 직후 추천 = 그 자체가 구매 직전 점검.
- Claude 쪽: 08시 정기 작업이 `check` 후 `due`/`plan`을 보고, 블록 분석 시각마다 일회성 예약 작업을 건다.
  블록 분석이 끝나면 `done`으로 상태를 바꾸고 커밋·푸시(main, main:pacu).

사용
  python3 scripts/round_watch.py check            # 새 회차 등록 + 블록 일정 작성 (없으면 '새 회차 없음')
  python3 scripts/round_watch.py plan             # 대기 중 블록과 분석 시각
  python3 scripts/round_watch.py due              # 분석 시각이 지난 대기 블록 (지금 분석할 것)
  python3 scripts/round_watch.py games <회차> <블록>   # 그 블록 경기 목록 (번호·시각·마감·리그·대진)
  python3 scripts/round_watch.py done <회차> <블록> [메모]
  python3 scripts/round_watch.py unreserve        # '예약됨' 표시 지우기(다른 PC·새 세션에서 루프를 다시 켤 때 — 예약은 세션 한정)
  python3 scripts/round_watch.py add <회차>        # 이미 등록된 회차의 남은 블록을 일정에 추가(진행 중 회차를 루프로 넘길 때)
  python3 scripts/round_watch.py toto             # 축구토토 승무패(G011) 새 회차 → 마감 시각 읽어 분석일정에 '분석'(즉시)·'최종점검'(마감 60분 전) 추가 (사용자 요청 2026-10-12)
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
TOTO_LEAD_MIN = 120  # 승무패: 마감 2시간 전에 한 번 (14경기 심층 30~40분 + 구매 여유, 2026-10-12)
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
    """메모에 콤마가 따옴표 없이 들어간 행(다른 PC가 수기로 쓴 경우)도 살려 읽는다.

    2026-10-22: 그런 행 하나가 DictReader 에서 None 키로 들어와 save_plan 의 DictWriter 가
    예외를 냈고, 이미 열어 둔 파일이 잘린 채 남아 분석일정 뒤 4블록이 통째로 사라졌다.
    읽을 때 넘치는 칸을 메모로 되붙이고, 쓸 때는 임시 파일에 다 쓴 뒤 바꿔 끼운다.
    """
    if not os.path.exists(PLAN):
        return []
    rd = csv.DictReader(open(PLAN, encoding="utf-8-sig"), restkey="_넘침")
    rows = []
    for r in rd:
        over = r.pop("_넘침", None)
        if over:
            r[COLS[-1]] = ",".join([r.get(COLS[-1]) or ""] + [x or "" for x in over])
        rows.append({c: r.get(c, "") for c in COLS})
    return rows


def save_plan(rows):
    tmp = PLAN + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows([{c: r.get(c, "") for c in COLS} for r in rows])
    os.replace(tmp, PLAN)   # 원자적 교체 — 중간에 죽어도 원본이 남는다


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
    known = {r["회차"] for r in csv.DictReader(open(rl.PATH, encoding="utf-8-sig"))} if os.path.exists(rl.PATH) else set()
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


def cmd_toto():
    """승무패 판매 회차 확인. 전체경기기록.csv에 '승무패<회차>'가 없으면 새 회차로 보고(분석은 Claude가 심층 분석 절차로)."""
    ck = os.path.join(ROOT, "data", ".betman_cookie")
    page = "https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId=G011"
    hdr = ["Content-Type: application/json; charset=UTF-8", "Accept: application/json", "X-Requested-With: XMLHttpRequest",
           "Origin: https://www.betman.co.kr", f"Referer: {page}"]
    subprocess.run(["curl", "-sS", "-m", "30", "-A", o.UA, "-c", ck, "-o", "/dev/null", page])
    lst = o.curl("https://www.betman.co.kr/buyPsblGame/inqCacheBuyAbleGameInfoList.do", hdr,
                 '{"_sbmInfo":{"_sbmInfo":{"debugMode":"false"}}}', ck)
    known = {r["회차"] for r in csv.DictReader(open(rl.PATH, encoding="utf-8-sig"))} if os.path.exists(rl.PATH) else set()
    found = [g for g in lst.get("totoGames", []) if g.get("gmId") == "G011"]
    for g in found:   # 이월금·판매액 기록 (사용자 지시 2026-10-16: 이월금액도 함께 확인)
        log_pool(g)
    new = [g for g in found if f"승무패{g['gmOsidTs']}" not in known]
    if not new:
        print("승무패 새 회차 없음" + (f" (판매 중 {', '.join(str(g['gmOsidTs']) for g in found)}회 분석됨)" if found else ""))
    for g in new:
        print(f"승무패 {g['gmOsidTs']}회 판매 중 — 미분석 (gmTs {g.get('gmTs')}, 연도 {g.get('gmOsidTsYear')})")
        toto_plan(g, hdr, ck)


POOL = os.path.join(ROOT, "data", "승무패_이월판매.csv")


def log_pool(g):
    """승무패 회차의 이월금(forwardAmount)·이월 횟수(forwardCnt)·판매액(totalSellAmount)을 data/승무패_이월판매.csv에 남기고 한 줄 보고.
    1등 예상 = (판매액 × 50% 환급) × 50% + 이월금. 이월이 있으면 1등 상금이 커져 마킹 판단(단일 정배 vs 이변 복수)에 참고한다."""
    fwd, cnt, sell = int(g.get("forwardAmount") or 0), int(g.get("forwardCnt") or 0), int(g.get("totalSellAmount") or 0)
    first = sell * 0.5 * 0.5 + fwd
    now = dt.datetime.now(o.KST).strftime("%Y-%m-%d %H:%M")
    new = not os.path.exists(POOL)
    with open(POOL, "a", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        if new:
            w.writerow(["확인시각", "회차", "이월금", "이월횟수", "판매액", "1등예상(현재판매액기준)"])
        w.writerow([now, f"승무패{g.get('gmOsidTs')}", fwd, cnt, sell, int(first)])
    combos = combos_for(fwd)
    print(f"  승무패 {g.get('gmOsidTs')}회 이월금 {fwd:,}원(이월 {cnt}회) · 판매액 {sell:,}원 · 1등 예상 약 {first / 1e8:.2f}억원(현재 기준)"
          + (" ★ 이월 있음" if fwd else "") + f" → 권장 조합 수 {combos}")


# 이월금에 따른 조합 수 (사용자 지시 2026-10-16: "이월금액이 많이 쌓이면 4조합 → 8조합 이렇게 늘려가려고").
# 기준값 사용자 확정 2026-10-16 ("좋아 그 기준으로 해줘"). 바꾸면 여기만 고친다. (이월금 하한, 조합 수)
CARRY_STEPS = [(0, 4), (100_000_000, 8), (300_000_000, 16)]


def combos_for(fwd):
    return max(c for lo, c in CARRY_STEPS if fwd >= lo)


def toto_plan(g, hdr, ck):
    """승무패 회차의 마감 시각(saleEndDate)을 읽어 분석일정.csv에 한 줄을 넣는다 (사용자 지시 2026-10-12: 두 번 분석하면 토큰 낭비 —
    **마감 2시간 전에 한 번만** 2단계 심층 분석 + 마킹 — 14경기 심층이 30~40분 걸리고 구매 여유가 필요). 같은 회차 줄이 이미 있으면 건너뛴다."""
    import json as _json
    d = o.curl("https://www.betman.co.kr/buyPsblGame/gameInfoInq.do", hdr,
               _json.dumps({"gmId": "G011", "gmTs": g.get("gmTs"), "gameYear": g.get("gmOsidTsYear"),
                            "_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}), ck)
    cl = d.get("currentLottery") or {}
    end = cl.get("saleEndDate")
    sched = d.get("schedulesList") or []
    if not end:
        print("  ⚠ 마감 시각(saleEndDate) 없음 — 분석일정에 추가 못함"); return
    end_dt = dt.datetime.fromtimestamp(end / 1000, o.KST)
    kicks = [dt.datetime.fromtimestamp(x["gameDate"] / 1000, o.KST) for x in sched if x.get("gameDate")]
    rnd = f"승무패{g['gmOsidTs']}"
    rows = load_plan()
    if any(r["회차"] == rnd for r in rows):
        print(f"  분석일정에 {rnd} 이미 있음"); return
    fmt = "%Y-%m-%d %H:%M"
    first = min(kicks).strftime(fmt) if kicks else ""
    last = max(kicks).strftime(fmt) if kicks else ""
    at = end_dt - dt.timedelta(minutes=TOTO_LEAD_MIN)  # 승무패 14경기 2단계 심층은 30~40분 걸리므로 2시간 전(2026-10-12 실측)
    rows.append({"회차": rnd, "블록": f"마감 {end_dt:%m/%d %H:%M}", "첫마감": end_dt.strftime(fmt), "끝마감": end_dt.strftime(fmt),
                 "분석시각": at.strftime(fmt), "경기수": len(sched) or 14, "종목": "축구", "상태": "대기",
                 "메모": f"승무패 14경기 2단계 심층(1차→갈림·박빙·후보 반론→앙상블) 한 번만, 마감 2시간 전. 경기 {first}~{last}. 투표율·Pinnacle 마감값으로 마킹(1·4·--gap 3)"})
    save_plan(rows)
    print(f"  {rnd}: 마감 {end_dt:%m/%d %H:%M}, 경기 {first}~{last} → 분석일정에 분석 {at:%m/%d %H:%M} 한 줄 추가")


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
    elif a[0] == "toto":
        cmd_toto()
    elif a[0] == "done":
        cmd_done(a[1], a[2], " ".join(a[3:]))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
