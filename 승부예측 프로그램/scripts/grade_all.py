#!/usr/bin/env python3
"""모든 추천·예측 자동 채점 (사용자 지시 2026-10-18 — 데이터 개선 ③)
왜: 123회 추천기록 38건 중 15건만 채점됐다(핸디캡·언더오버·승N패 등은 비어 있음). 채점에 구멍이 있으면
    '내 추천 적중률' 같은 학습 지표가 틀린다.
무엇: 전체경기기록.csv 점수(홈:원정)와 스캔기록.csv 구분(H-1.0·U/O 2.5 등)으로 선택지마다 적중을 계산해
  - 추천기록.csv 의 결과·적중 빈칸을 채우고
  - data/예측스냅샷.csv 의 결과·점수를 채운다.
  축구 일반(승무패)·정수/소수 핸디캡·언더오버·전반 제외(전반 점수 없음), 야구 승패(무승부 없음)·승N패 제외.
사용: python3 scripts/grade_all.py [--round 123]
"""
import argparse, csv, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(ROOT, "전체경기기록.csv")
PICK = os.path.join(ROOT, "추천기록.csv")
SCAN = os.path.join(ROOT, "data", "스캔기록.csv")
SNAP = os.path.join(ROOT, "data", "예측스냅샷.csv")


def outcome(gub, sel, h, a):
    """선택지 적중 여부(True/False) 또는 판정 불가(None)."""
    gub = (gub or "일반").strip()
    if gub.startswith("전반") or sel in ("1점차",):
        return None
    if gub in ("일반", "", "승N패"):
        if sel not in ("승", "무", "패"):
            return None
        o = "승" if h > a else "무" if h == a else "패"
        return sel == o
    m = re.match(r"H\s*([+-]?[\d.]+)", gub)
    if m:
        d = h + float(m.group(1)) - a
        o = "승" if d > 0 else "무" if d == 0 else "패"
        return sel == o
    m = re.search(r"U/O\s*([\d.]+)", gub)
    if m:
        t, L = h + a, float(m.group(1))
        if sel == "언더":
            return t < L
        if sel == "오버":
            return t > L
    return None


def read(p, enc="utf-8-sig"):
    raw = open(p, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    rows = list(csv.DictReader(open(p, encoding="utf-8-sig")))
    return rows, (list(rows[0].keys()) if rows else []), bom


def write(p, rows, cols, bom):
    with open(p, "w", encoding="utf-8-sig" if bom else "utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader(); w.writerows(rows)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--round"); a = ap.parse_args()
    score = {}
    for r in csv.DictReader(open(REC, encoding="utf-8-sig")):
        if re.fullmatch(r"\d+:\d+", r.get("점수") or ""):
            h, aw = map(int, r["점수"].split(":"))
            score[(r["회차"], f"{r['홈']} vs {r['원정']}")] = (h, aw)
            score[(r["회차"], r["번호"])] = (h, aw)
    gub = {}
    for r in csv.DictReader(open(SCAN, encoding="utf-8-sig")):
        gub[(r["회차"], r["번호"])] = r["구분"]
    # 추천기록
    rows, cols, bom = read(PICK); n = m = 0
    for r in rows:
        if a.round and r["회차"] != str(a.round):
            continue
        if r.get("적중") in ("0", "1"):
            continue
        s = score.get((r["회차"], r["경기"]))
        if not s:
            continue
        g = gub.get((r["회차"], r["번호"])) or (r["게임"].split("`")[1] if "`" in r.get("게임", "") else "일반")
        if "전반" in r.get("게임", ""):
            g = "전반 " + g
        ok = outcome(g, r["선택"], *s)
        if ok is None:
            m += 1; continue
        r["결과"] = f"{s[0]}:{s[1]}"; r["적중"] = "1" if ok else "0"; n += 1
    write(PICK, rows, cols, bom)
    print(f"추천기록: {n}건 채점 (판정 불가 {m}건 — 전반·1점차 등)")
    # 예측스냅샷
    if os.path.exists(SNAP):
        rows, cols, bom = read(SNAP); k = 0
        for r in rows:
            if r.get("점수"):
                continue
            s = score.get((r["회차"], r["번호"]))
            if s:
                r["점수"] = f"{s[0]}:{s[1]}"; r["결과"] = "승" if s[0] > s[1] else "무" if s[0] == s[1] else "패"; k += 1
        write(SNAP, rows, cols, bom)
        print(f"예측스냅샷: {k}건 결과 채움")


if __name__ == "__main__":
    main()
