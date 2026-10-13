#!/usr/bin/env python3
"""배팅 성공률 — 추천기록.csv 의 '추천' 다리(배당 1.2+) 중 채점된 것의 적중률. 목표 85% (사용자 지시 2026-10-13).
전체 1순위 적중률(순수 vs 시장)과 별개로, "무엇을 베팅할지 고르는 것"까지 포함한 성적표.
박빙·예측 불가 경기는 추천하지 않고 기록·회고만 한다 → 그런 경기는 이 지표에 안 들어간다.
사용: python3 scripts/bet_hit.py [--round 121] [--min-prob 70]
"""
import csv, os, sys, argparse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = 85.0

def load():
    rows = list(csv.DictReader(open(os.path.join(ROOT, "추천기록.csv"), encoding="utf-8")))
    out = []
    for r in rows:
        if r["구분"] != "추천" or r["적중"] not in ("0", "1"):
            continue
        try:
            odds = float(r["배당"]); p = float(r["확률"])
        except ValueError:
            continue
        if odds < 1.2:
            continue
        out.append({**r, "odds": odds, "p": p, "hit": int(r["적중"]), "bought": bool(r["구매"] and r["구매"] != "미구매")})
    return out

def line(name, rs):
    n = len(rs)
    if not n:
        return f"| {name} | 0 | - | - | - |"
    h = sum(r["hit"] for r in rs); ao = sum(r["odds"] for r in rs) / n; roi = sum((r["odds"] - 1) if r["hit"] else -1 for r in rs) / n * 100
    return f"| {name} | {n} | {h} ({h/n*100:.0f}%) | {ao:.2f} | {roi:+.0f}% |"

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--round"); ap.add_argument("--min-prob", type=float, default=0); a = ap.parse_args()
    rs = load()
    if a.round: rs = [r for r in rs if r["회차"] == a.round]
    if a.min_prob: rs = [r for r in rs if r["p"] >= a.min_prob]
    n = len(rs); h = sum(r["hit"] for r in rs)
    print(f"## 배팅 성공률 (추천 다리·배당 1.2+·채점 완료) — 목표 {TARGET:.0f}%")
    print(f"**현재 {h}/{n} = {h/n*100:.1f}%** (목표까지 {TARGET - h/n*100:+.1f}%p)" if n else "채점된 추천 없음")
    hdr = "| 구분 | 다리 | 적중 | 평균 배당 | 단식 ROI |\n|---|---|---|---|---|"
    print(hdr)
    for rnd in sorted({r["회차"] for r in rs}): print(line(f"{rnd}회", [r for r in rs if r["회차"] == rnd]))
    print(line("구매한 다리", [r for r in rs if r["bought"]])); print(line("미구매 추천", [r for r in rs if not r["bought"]]))
    print(hdr)
    for s in sorted({r["종목"] for r in rs}): print(line(s, [r for r in rs if r["종목"] == s]))
    print(hdr)
    for lo, hi in ((60, 65), (65, 70), (70, 100)): print(line(f"확률 {lo}~{hi}", [r for r in rs if lo <= r["p"] < hi]))
    for lo, hi in ((1.2, 1.35), (1.35, 1.5), (1.5, 9)): print(line(f"배당 {lo}~{hi}", [r for r in rs if lo <= r["odds"] < hi]))
    print("\n기준 상향 시뮬레이션(추천 당시 확률 기준):")
    for t in (60, 65, 70, 75):
        sub = [r for r in rs if r["p"] >= t]; k = len(sub)
        print(f"- 확률 {t}%+ 만 추천했다면: {sum(r['hit'] for r in sub)}/{k} = {sum(r['hit'] for r in sub)/k*100:.0f}%" if k else f"- 확률 {t}%+: 없음")

if __name__ == "__main__":
    main()
