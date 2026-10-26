#!/usr/bin/env python3
"""자동 루프 상태 판정 — 회고가 필요한지, 분석할 블록이 있는지 (사용자 지시 2026-10-19 루프 순서 고정)
출력(한 줄씩): NEW=<새로 채점된 경기 수>  RETRO=<1|0>  ROUNDS=<회고 대상 회차,…>  DONE=<결과 완결 회차,…>
판정: 직전 기록(data/.loop_state.json) 이후 새로 채점된 경기가 8개 이상이거나, 결과가 100% 나온 회차가 새로 생기면 RETRO=1.
사용: python3 scripts/loop_state.py [--commit]   (--commit 이면 현재 상태를 기록해 다음 비교 기준으로 삼는다)
"""
import csv, json, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(ROOT, "전체경기기록.csv")
ST = os.path.join(ROOT, "data", ".loop_state.json")
THRESH = 8

rows = list(csv.DictReader(open(REC, encoding="utf-8-sig"))) if os.path.exists(REC) else []
scored = {f"{r['회차']}-{r['번호']}" for r in rows if r.get("결과") in ("승", "무", "패")}
byr = collections.defaultdict(lambda: [0, 0])
for r in rows:
    if r.get("회차", "").startswith("승무패") or r.get("종목"):
        b = byr[r["회차"]]; b[0] += 1
        if r.get("결과") in ("승", "무", "패"):
            b[1] += 1
done = [k for k, (t, s) in byr.items() if t >= 5 and t == s]
prev = {}
try:
    prev = json.load(open(ST, encoding="utf-8"))
except Exception:
    pass
pscored = set(prev.get("scored", []))
pdone = set(prev.get("done", []))
new = scored - pscored
new_done = [d for d in done if d not in pdone]
rounds = sorted({k.split("-")[0] for k in new})
retro = 1 if (len(new) >= THRESH or new_done) else 0
print(f"NEW={len(new)}")
print(f"RETRO={retro}")
print(f"ROUNDS={','.join(rounds)}")
print(f"DONE={','.join(new_done)}")
if "--commit" in sys.argv:
    json.dump({"scored": sorted(scored), "done": sorted(done)}, open(ST, "w", encoding="utf-8"))
