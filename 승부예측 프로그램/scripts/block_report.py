#!/usr/bin/env python3
"""블록 전체 경기 분석표 (사용자 지시 2026-10-10: 추천 여부와 상관없이 모든 경기를 분석·기록 — 분석 스킬 향상용)

블록의 모든 경기(배당 1.3 미만·확률 60% 미만 포함)를 한 표로: 기준선(축구 soccer_baseline) | 순수 | 시장 | 최종 |
경기당 최고 선택지(스캔기록) | 핵심근거 | 뉴스위험 | 추천/제외. → 회차별분석/블록분석_<회차>_<MMDD-HHMM>.md

사용
  python3 scripts/block_report.py <회차> "<블록>"        # 예: 120 "10/10 17:35"
뉴스·라인업 확인과 순수 확률 작성은 Claude(조사 에이전트)가 하고, 이 스크립트는 기록된 값을 모아 표로 만든다.
"""
import csv
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import round_watch as rw  # noqa: E402

REC = os.path.join(ROOT, "전체경기기록.csv")
SCAN = os.path.join(ROOT, "data", "스캔기록.csv")
PICKS = os.path.join(ROOT, "추천기록.csv")


def tri(r, pre):
    v = [r.get(f"{pre}_{k}", "") for k in "승무패"]
    if not any(v):
        return "-"
    return "/".join(f"{float(x):.0f}" if x else "-" for x in v)


def baseline(g):
    if g["종목"] != "축구":
        return "-"
    out = subprocess.run([sys.executable, os.path.join(HERE, "soccer_baseline.py"), "--league", g["리그"], "--home", g["홈"], "--away", g["원정"]],
                         capture_output=True, text=True).stdout
    for ln in out.splitlines():
        if "기준선 승/무/패" in ln:
            return "/".join(x.strip().split()[0].split(".")[0] for x in ln.split(":")[1].split("/"))
    return "-"


def best_option(rnd, no_home):
    best = None
    if not os.path.exists(SCAN):
        return "-"
    for r in csv.DictReader(open(SCAN, encoding="utf-8")):
        if r["회차"] != str(rnd) or not r["경기"].startswith(no_home + " vs"):
            continue
        try:
            p = float(r["공정확률"])
        except ValueError:
            continue
        if best is None or p > best[0]:
            best = (p, f"{r['구분']} {r['선택']} {p:.0f}% @{r['베트맨']}")
    return best[1] if best else "-"


def main():
    rnd, block = int(sys.argv[1]), sys.argv[2]
    gs = rw.assign_blocks([g for g in rw.games_of(rnd)]).get(block, [])
    if not gs:  # 이미 마감된 블록도 기록할 수 있게 마감 필터 없이 다시 찾는다
        gs = []
    rec = {(r["홈"], r["원정"]): r for r in csv.DictReader(open(REC, encoding="utf-8")) if r["회차"] == str(rnd)}
    picks = {}
    if os.path.exists(PICKS):
        for p in csv.DictReader(open(PICKS, encoding="utf-8")):
            if p["회차"] == str(rnd):
                picks.setdefault(p["경기"], []).append(f"{p['구분']} {p['선택']}" + (f"({p['이유']})" if p.get("이유") else ""))
    L = [f"# {rnd}회 블록 {block} — 전체 경기 분석 ({len(gs)}경기)", "",
         "추천 여부와 상관없이 블록의 모든 경기를 기록한다(회고·학습용). 확률은 승/무/패 %.", "",
         "| 번호 | 시각 | 리그 | 경기 | 기준선 | 순수(확신도) | 시장 | 최종 | 최고 선택지 | 핵심근거 | 뉴스위험 | 추천/제외 |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for g in sorted(gs, key=lambda g: g["시각"]):
        r = rec.get((g["홈"], g["원정"]), {})
        key = f"{g['홈']} vs {g['원정']}"
        L.append(f"| {g['번호']} | {g['시각']:%m-%d %H:%M} | {g['리그']} | {key} | {baseline(g)} | {tri(r, '순수')}({r.get('확신도', '')}) | "
                 f"{tri(r, '시장')} | {tri(r, '보정')} | {best_option(rnd, g['홈'])} | {(r.get('핵심근거') or '')[:60]} | "
                 f"{(r.get('뉴스위험') or '')[:40]} | {'; '.join(picks.get(key, [])) or ('제외' if r.get('제외') else '-')} |")
    out = os.path.join(ROOT, "회차별분석", f"블록분석_{rnd}_{block.replace('/', '').replace(':', '').replace(' ', '-')}.md")
    open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L))
    print("저장:", out)


if __name__ == "__main__":
    main()
