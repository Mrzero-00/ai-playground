#!/usr/bin/env python3
"""배당 흐름 신호 — 첫 수집(오픈) 대비 최신 Pinnacle 공정확률이 어느 쪽으로 움직였나 (사용자 승인 2026-10-12, 심층 분석 3번)

왜: 시장이 내 순수 분석 쪽으로 움직이면 같은 정보를 시장도 받아들였다는 뜻(확신 ↑),
반대로 움직이면 내가 모르는 정보가 있다는 신호(다시 조사). 결과를 기다리지 않는 근거다.

자료: data/배당이력.csv (autoscan 30분, 킥오프 75분 전부터 5분) — 구분 '일반' 승/무/패 = 대표 시장
사용
  python3 scripts/market_move.py <회차> [번호 ...]     # 번호 생략 시 그 회차 순수 확률이 있는 전체 경기
출력: 번호 | 경기 | 오픈 → 최신 (승/무/패) | 가장 크게 움직인 쪽 | 순수 1순위와 같은 방향인지
"""
import csv
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HIST = os.path.join(ROOT, "data", "배당이력.csv")
REC = os.path.join(ROOT, "전체경기기록.csv")
OUT = ("승", "무", "패")
MIN_MOVE = 2.0  # %p — 이보다 작으면 '정체'


def history(rnd):
    snap = defaultdict(lambda: defaultdict(dict))
    name = {}
    for r in csv.DictReader(open(HIST, encoding="utf-8")):
        if r["회차"] != str(rnd) or r.get("구분") != "일반" or r.get("선택") not in OUT:
            continue
        try:
            snap[r["번호"]][r["scan_time"]][r["선택"]] = float(r["공정확률"])
        except ValueError:
            continue
        name[r["번호"]] = r["경기"]
    out = {}
    for no, times in snap.items():
        seq = [(t, d) for t, d in sorted(times.items()) if "승" in d and "패" in d]
        if seq:
            out[no] = (name[no], seq[0], seq[-1], len(seq))
    return out


def move(no, h, pure=None):
    nm, (t0, o), (t1, c), n = h
    d = {k: c.get(k, 0) - o.get(k, 0) for k in OUT}
    big = max(OUT, key=lambda k: abs(d[k]))
    tri = lambda x: "/".join(f"{x.get(k, 0):.0f}" for k in OUT)
    if abs(d[big]) < MIN_MOVE:
        sig = "정체"
    else:
        up = max(OUT, key=lambda k: d[k])
        sig = f"{up} {d[up]:+.1f}"
    agree = ""
    if pure and sig != "정체":
        top = max(OUT, key=lambda k: pure[k] - o.get(k, 0))  # 순수가 오픈보다 가장 높게 본 쪽
        agree = "순수 쪽 ✓" if top == up else "순수 반대 ⚠ 재조사"
    return f"{no}\t{nm}\t{tri(o)} → {tri(c)} ({t0[5:]}→{t1[5:]}, {n}회)\t{sig}\t{agree}"


def main():
    rnd = sys.argv[1]
    nos = sys.argv[2:]
    pure = {}
    if os.path.exists(REC):
        for r in csv.DictReader(open(REC, encoding="utf-8")):
            if r["회차"] == rnd and r.get("순수_승"):
                try:
                    pure[r["번호"]] = {k: float(r[f"순수_{k}"]) for k in OUT}
                except ValueError:
                    pass
    hs = history(rnd)
    for no in nos or sorted(pure, key=int):
        if no in hs:
            print(move(no, hs[no], pure.get(no)))


if __name__ == "__main__":
    main()
