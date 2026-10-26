#!/usr/bin/env python3
"""data/스캔기록.csv 머지 충돌 해소 — (회차,번호,선택) 키로 합집합, 늦은 scan_time 우선, result/hit/비고는 채워진 쪽 유지.

사용: python3 scripts/merge_scanlog.py [경로]
충돌 마커(<<<<<<< ======= >>>>>>>)가 여러 번 나와도 모두 처리한다. 행을 버리지 않는다(덮어쓰기 금지 규칙).
"""
import csv, io, os, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "data", "스캔기록.csv")


def key(r):
    return (str(r["회차"]), str(r["번호"]), r["선택"])


def main():
    lines = open(PATH, encoding="utf-8").read().split("\n")
    header = None
    chunks, cur = [], []
    for ln in lines:
        if ln.startswith("<<<<<<<") or ln == "=======" or ln.startswith(">>>>>>>"):
            chunks.append(cur); cur = []
            continue
        if header is None and ln.startswith("scan_time,"):
            header = ln
            continue
        if ln.strip():
            cur.append(ln)
    chunks.append(cur)
    if header is None:
        sys.exit("헤더(scan_time,...)를 찾지 못했다")
    fields = next(csv.reader(io.StringIO(header)))
    merged = {}
    total = 0
    for ch in chunks:
        if not ch:
            continue
        for r in csv.DictReader(io.StringIO(header + "\n" + "\n".join(ch))):
            total += 1
            k = key(r)
            prev = merged.get(k)
            if prev is None:
                merged[k] = r
                continue
            win = r if r["scan_time"] >= prev["scan_time"] else prev
            lose = prev if win is r else r
            for c in ("result", "hit", "비고"):
                if not win.get(c) and lose.get(c):
                    win[c] = lose[c]
            merged[k] = win
    out = sorted(merged.values(), key=lambda r: (int(r["회차"]), int(r["번호"]), r["선택"]))
    with open(PATH, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader(); w.writerows(out)
    print(f"입력 {total}행 → 고유 {len(out)}행 (결과 채워진 행 {sum(1 for r in out if r['result'])})")


if __name__ == "__main__":
    main()
