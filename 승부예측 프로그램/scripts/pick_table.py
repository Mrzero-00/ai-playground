#!/usr/bin/env python3
"""추천 선택지를 베트맨 화면처럼 표로 보여 준다 (사용자 요청 2026-10-09).

한 줄 = 베트맨 게임 번호 하나. 승/무/패(또는 언더/오버, 승/1점차/패) 칸에 배당을 적고 추천한 칸에만 ✅.
배당·확률은 data/스캔기록.csv(odds_scan.py --log)의 가장 최근 값을 쓴다. 먼저 스캔을 --log로 돌려 둔다.

사용:
  python3 scripts/pick_table.py --round 120 "10/9 오후 2경기=7052:패,7005:승" "10/10 오후=7345:패,7339:패"
  - 조합마다 "제목=번호:선택,번호:선택" 하나. 제목은 생략 가능("7052:패,7005:승").
  - 선택: 승/무/패, 언더/오버, 1점차 (베트맨 칸 이름 그대로)
"""
import argparse
import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, "data", "스캔기록.csv")
SPORT = {"SC": "축구", "BS": "야구", "BK": "농구", "VL": "배구"}


def load(rnd):
    rows = {}
    for r in csv.DictReader(open(LOG, encoding="utf-8")):
        if r["회차"] != str(rnd):
            continue
        key = (r["번호"], r["선택"])
        if key not in rows or r["scan_time"] >= rows[key]["scan_time"]:
            rows[key] = r
    by_no = {}
    for (no, _), r in rows.items():
        by_no.setdefault(no, []).append(r)
    return by_no


def kind(r):
    """베트맨 화면의 게임 종류 이름 + 기준점 배지"""
    sp = SPORT.get(r["종목"], r["종목"])
    t, g = r["유형"], r["구분"]
    half = "전반 " if g.startswith("전반") else ""
    if "언더오버" in t:
        return f"{sp} {half}언더오버 `U/O {float(g.split()[-1]):.1f}`"
    if "핸디캡" in t:
        v = float(g.replace("전반 ", "").replace("H", ""))
        return f"{sp} {half}핸디캡 `H {v:+.1f}`"  # 베트맨 화면 표기 (예: H -1.0)
    if t == "승N패":
        return f"{sp} 승1패"
    return f"{sp} {half}{'승무패' if t == '승무패' else '승패'}"


def cells(opts, pick):
    names = {o["선택"] for o in opts}
    if names & {"언더", "오버"}:
        order = ["언더", "오버", None]
    elif "1점차" in names:
        order = ["승", "1점차", "패"]
    else:
        order = ["승", "무", "패"]
    by = {o["선택"]: o for o in opts}
    out = []
    for n in order:
        if n is None or n not in by:
            out.append("")
            continue
        txt = f"{n} {float(by[n]['베트맨']):.2f}"
        out.append(f"✅ **{txt}**" if n == pick else txt)
    return out


def table(by_no, title, picks):
    lines = []
    if title:
        lines.append(f"**{title}**\n")
    lines.append("| 번호 | 경기 | 게임 | 승 | 무 | 패 | 확률 |")
    lines.append("|---|---|---|---|---|---|---|")
    odds, prob = 1.0, 1.0
    for no, pick in picks:
        opts = by_no.get(no)
        if not opts:
            lines.append(f"| {no} | (스캔기록에 없음 — odds_scan.py --round … --log 먼저) | | | | | |")
            continue
        sel = next((o for o in opts if o["선택"] == pick), None)
        r = opts[0]
        c = cells(opts, pick)
        p = float(sel["공정확률"]) if sel and sel["공정확률"] else None
        if sel:
            odds *= float(sel["베트맨"])
        prob = prob * p / 100 if (p is not None and prob is not None) else None
        when = r["시각"][5:16]
        lines.append(f"| {no} | {r['경기']} ({when}) | {kind(r)} | {c[0]} | {c[1]} | {c[2]} | {f'{p:.1f}%' if p is not None else '-'} |")
    if len(picks) > 1:
        lines.append(f"\n합계 배당 **{odds:.2f}배** · 적중 확률 **{prob * 100:.1f}%**" if prob is not None else f"\n합계 배당 **{odds:.2f}배**")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="추천 선택지를 베트맨 화면 형태 표로")
    ap.add_argument("--round", type=int, required=True)
    ap.add_argument("combos", nargs="+", help='"제목=번호:선택,번호:선택"')
    a = ap.parse_args()
    by_no = load(a.round)
    for c in a.combos:
        title, _, body = c.rpartition("=")
        picks = [tuple(x.strip().split(":")) for x in body.split(",") if x.strip()]
        print(table(by_no, title, picks) + "\n")


if __name__ == "__main__":
    main()
