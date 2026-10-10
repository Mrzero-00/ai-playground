#!/usr/bin/env python3
"""구매 직전 최종 점검 (사용자 요청 2026-10-10): 조합 추천 때 기록한 구매일정.csv 의 점검시각(판매 마감 30분 전)에
다시 스캔해서 다리마다 변화를 보고, 바뀐 게 있으면 교체안을, 없으면 '그대로 구매'를 알린다.

판정 (다리별)
- 베트맨 배당이 추천 때보다 +0.08 이상 오름 → ⚠ 불리해진 신호(120회 정관장 1.36→1.59, 외국인 당일 결장)
- 시장 확률이 3%p 이상 떨어짐, 또는 60% 미만 → ⚠
- data/exclude.json 에 들어간 경기 → ✗ 제외
- 경고 다리가 있으면: 같은 시간대(조합 결과 예상 ±3시간)·마감 전·배당 1.3+·확률 60%+ 중 확률 순 교체 후보 3개
※ 라인업·결장 뉴스 확인(검색)은 Claude 세션이 이 결과를 보고 이어서 한다. 이 스크립트는 숫자 점검과 알림만.

사용
  python3 scripts/final_check.py --round 120 --combo "② 10/10 오후 (23:00)"   # 한 조합
  python3 scripts/final_check.py --due            # 점검시각이 지났고 마감 전인 '대기' 조합 전부 (autoscan.py 가 호출)
  --no-scan   재스캔 생략(방금 스캔했을 때)   --notify  macOS 알림 띄우기
결과: 회차별분석/최종점검_<회차>_<날짜>.md 에 덧붙이고, 구매일정.csv 상태를 '점검완료'로 바꾼다.
"""
import argparse
import csv
import datetime as dt
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import pick_table as pt  # noqa: E402

PICKS = os.path.join(ROOT, "추천기록.csv")
EXCL = os.path.join(ROOT, "data", "exclude.json")
ODDS_UP, PROB_DROP, PROB_MIN, ODDS_MIN = 0.08, 3.0, 60.0, 1.3


def now_kst():
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).replace(tzinfo=None)


def rescan(rnd):
    subprocess.run([sys.executable, os.path.join(HERE, "odds_scan.py"), "--round", str(rnd), "--log", "--min-odds", "1"],
                   capture_output=True, text=True)


def excluded(rnd, game):
    try:
        d = json.load(open(EXCL, encoding="utf-8")).get(str(rnd), {})
    except (OSError, ValueError):
        return None
    home, _, away = game.partition(" vs ")
    return d.get(f"{home}-{away}")


def check(rnd, sched, by_no):
    rec = {(r["회차"], r["번호"], r["선택"]): r for r in csv.DictReader(open(PICKS, encoding="utf-8"))} if os.path.exists(PICKS) else {}
    picks = [tuple(x.split(":")) for x in sched["다리"].split(",")]
    legs, bad = [], []
    for no, pk in picks:
        opts = by_no.get(no) or []
        cur = next((o for o in opts if o["선택"] == pk), None)
        r0 = rec.get((str(rnd), no, pk), {})
        if not cur:
            legs.append((no, pk, "✗ 스캔기록에 없음(판매 중지?)")); bad.append(no); continue
        o0, p0 = float(r0.get("배당") or cur["베트맨"]), float(r0.get("확률") or cur["공정확률"] or 0)
        o1, p1 = float(cur["베트맨"]), float(cur["공정확률"] or 0)
        notes = []
        if o1 - o0 >= ODDS_UP:
            notes.append(f"배당 {o0:.2f}→{o1:.2f} 상승")
        if p1 and p0 - p1 >= PROB_DROP:
            notes.append(f"시장 {p0:.1f}→{p1:.1f}%")
        if p1 and p1 < PROB_MIN:
            notes.append(f"확률 {p1:.1f}% < 60")
        ex = excluded(rnd, cur["경기"])
        if ex:
            notes.append(f"제외 목록: {ex}")
        if notes:
            bad.append(no)
        legs.append((no, pk, ("⚠ " + ", ".join(notes)) if notes else f"✓ 유지 (배당 {o0:.2f}→{o1:.2f}, 시장 {p0:.1f}→{p1:.1f}%)"))
    return picks, legs, bad


def alternatives(rnd, sched, by_no, used):
    end = dt.datetime.strptime(sched["결과예상"], "%Y-%m-%d %H:%M")
    cl = pt.closes()
    now = now_kst()
    cands = []
    for no, opts in by_no.items():
        if no in used:
            continue
        c = cl.get(f"{rnd}-{no}")
        if not c or dt.datetime.strptime(c, "%Y-%m-%d %H:%M") <= now:
            continue
        k = dt.datetime.strptime(opts[0]["시각"], "%Y-%m-%d %H:%M")
        e = k + dt.timedelta(minutes=pt.DURATION.get(opts[0]["종목"], 120))
        if abs((e - end).total_seconds()) > pt.END_SPREAD_MAX * 60 or excluded(rnd, opts[0]["경기"]):
            continue
        for o in opts:
            try:
                p, od = float(o["공정확률"]), float(o["베트맨"])
            except ValueError:
                continue
            if p >= PROB_MIN and od >= ODDS_MIN:
                cands.append((p, no, o["선택"]))
    best = {}
    for p, no, pk in sorted(cands, reverse=True):
        best.setdefault(no, (no, pk))  # 경기당 1개
    return list(best.values())[:3]


def run(rnd, sched, notify):
    by_no = pt.load(rnd)
    picks, legs, bad = check(rnd, sched, by_no)
    L = [f"## {sched['조합']} — 최종 점검 {now_kst():%m/%d %H:%M} (판매 마감 {sched['마감'][5:]})", ""]
    L.append(pt.table(by_no, "", picks))
    L += [""] + [f"- {no}:{pk} {msg}" for no, pk, msg in legs]
    if bad:
        alt = alternatives(rnd, sched, by_no, {n for n, _ in picks})
        keep = [(n, p) for n, p in picks if n not in bad]
        L += ["", f"**변경 권장** — 경고 다리 {len(bad)}개. 교체 후보(같은 시간대·60%+·1.3+):"]
        for no, pk in alt:
            L.append(pt.table(by_no, f"교체안: 유지 다리 + {no}:{pk}", keep + [(no, pk)]))
        if not alt:
            L.append("- 교체 후보 없음 → 경고 다리를 빼고 남은 다리만, 또는 이번 조합 건너뛰기")
        verdict = f"변경 권장 ({len(bad)}개 다리 경고)"
    else:
        verdict = "변경 없음 — 그대로 구매"
    L += ["", f"**판정: {verdict}**", "", "※ 라인업·결장 뉴스 확인은 Claude 세션에서 이어서(이 점검은 숫자 기준)."]
    text = "\n".join(L)
    out = os.path.join(ROOT, "회차별분석", f"최종점검_{rnd}_{now_kst():%Y-%m-%d}.md")
    with open(out, "a", encoding="utf-8") as f:
        f.write(text + "\n\n")
    if notify:
        msg = f"{sched['조합']}: {verdict}. 마감 {sched['마감'][11:]}"
        subprocess.run(["osascript", "-e", f'display notification "{msg}" with title "프로토 {rnd}회 구매 점검" sound name "Glass"'],
                       capture_output=True)
    return text, verdict


def set_state(rows, key, state, memo):
    for r in rows:
        if (r["회차"], r["조합"]) == key:
            r["상태"], r["메모"] = state, memo
    w = csv.DictWriter(open(pt.SCHED, "w", encoding="utf-8", newline=""), fieldnames=pt.SCHED_COLS)
    w.writeheader(); w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", type=int)
    ap.add_argument("--combo")
    ap.add_argument("--due", action="store_true")
    ap.add_argument("--no-scan", action="store_true")
    ap.add_argument("--notify", action="store_true")
    a = ap.parse_args()
    if not os.path.exists(pt.SCHED):
        print("구매일정.csv 없음 (pick_table.py --save 로 추천을 저장하면 생긴다)"); return
    rows = list(csv.DictReader(open(pt.SCHED, encoding="utf-8")))
    now = now_kst()
    if a.due:
        todo = [r for r in rows if r["상태"] == "대기"
                and dt.datetime.strptime(r["점검시각"], "%Y-%m-%d %H:%M") <= now < dt.datetime.strptime(r["마감"], "%Y-%m-%d %H:%M")]
    else:
        todo = [r for r in rows if (not a.round or r["회차"] == str(a.round)) and (not a.combo or r["조합"] == a.combo)]
    if not todo:
        print("점검할 조합 없음"); return
    scanned = set()
    for r in todo:
        if not a.no_scan and r["회차"] not in scanned:
            rescan(r["회차"]); scanned.add(r["회차"])
        text, verdict = run(r["회차"], r, a.notify)
        print(text + "\n")
        if a.due:
            set_state(rows, (r["회차"], r["조합"]), "점검완료", f"{now:%m/%d %H:%M} {verdict}")


if __name__ == "__main__":
    main()
