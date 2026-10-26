#!/usr/bin/env python3
"""분석가용 선택지 목록(배당·확률 없음) — 10/18 분석가가 스캔기록에서 선택지를 찾다 배당 열을 본 일(가림 위반) 방지.
사용: python3 scripts/blind_options.py --round 123   → data/선택지_123.json {"홈 vs 원정": ["번호 유형 구분 선택", ...]}
분석가 프롬프트에는 이 파일만 준다(스캔기록.csv 금지)."""
import argparse, csv, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument("--round", required=True); a = ap.parse_args()
out = {}
for r in csv.DictReader(open(os.path.join(ROOT, "data", "스캔기록.csv"), encoding="utf-8-sig")):
    if r["회차"] == str(a.round):
        x = f"{r['번호']} {r['유형']} {r['구분']} {r['선택']}"
        out.setdefault(r["경기"], [])
        if x not in out[r["경기"]]:
            out[r["경기"]].append(x)
p = os.path.join(ROOT, "data", f"선택지_{a.round}.json")
json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(out)}경기 → {p}")
