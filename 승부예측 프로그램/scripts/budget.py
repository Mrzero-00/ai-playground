#!/usr/bin/env python3
"""회차 예산 배분 — 프로토 1회차 최대 10만원, 전부 사용 (사용자 지시 2026-10-13)

  python3 scripts/budget.py <회차> ["제목=적중확률:다리수" ...] [--last]
  예) python3 scripts/budget.py 121 "①2다리=45.5:2" "②2다리=38.2:2" "③3다리=28.0:3"

- 쓴 금액 = 구매기록.csv 의 '프로토<회차>' stake 합 (금액 미기재 티켓은 경고).
- 남은 블록 = 분석일정.csv 에서 이 회차 '대기' 블록 수 + 지금 블록 1.
  블록 예산 = 남은 금액 / 남은 블록 수 (마지막 블록·--last 면 남은 금액 전부).
- 블록 안 배분: 가중치 = 적중확률 × (2다리 1.0 / 3다리 0.5 / 4다리+ 0.25) — 확률 높은 2다리에 많이.
  1천원 단위로 내림, 남는 돈은 1순위 조합에. 조합당 최소 5천원(안 되면 하위 조합 제외).
- 적중 여부와 상관없이 다음 블록 금액을 올리지 않는다(손실 만회 금지).
"""
import csv
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUDGET = 100_000
MIN_STAKE = 5_000


def spent(rnd):
    tot, unknown = 0, []
    for r in csv.DictReader(open(os.path.join(ROOT, "구매기록.csv"), encoding="utf-8")):
        if r["round"] != f"프로토{rnd}":
            continue
        if r.get("result") in ("예정", "미구매"):  # 구매 예정(미구매) 티켓은 사용액에 넣지 않는다 (2026-10-13)
            continue
        try:
            tot += int(float(r["stake"]))
        except ValueError:
            unknown.append(r["ticket"])
    return tot, unknown


def blocks_left(rnd):
    p = os.path.join(ROOT, "분석일정.csv")
    return sum(1 for r in csv.DictReader(open(p, encoding="utf-8")) if r["회차"] == str(rnd) and r["상태"] == "대기")


def allocate(amount, combos):
    w = {t: p / 100 * (1.0 if n <= 2 else 0.5 if n == 3 else 0.25) for t, (p, n) in combos.items()}
    while w:
        s = sum(w.values())
        out = {t: int(amount * v / s // 1000 * 1000) for t, v in w.items()}
        low = [t for t, v in out.items() if v < MIN_STAKE]
        if not low:
            top = max(w, key=w.get)
            out[top] += amount - sum(out.values())
            return out
        del w[min(low, key=lambda t: w[t])]
    return {}


def main():
    a = [x for x in sys.argv[1:] if x != "--last"]
    rnd, last = a[0], "--last" in sys.argv
    combos = {}
    for c in a[1:]:
        t, v = c.split("=", 1)
        p, n = v.split(":")
        combos[t] = (float(p), int(n))
    used, unknown = spent(rnd)
    left = BUDGET - used
    nb = 1 if last else blocks_left(rnd) or 1
    block = left if nb == 1 else left // nb // 1000 * 1000
    print(f"💰 {rnd}회 예산 10만원 · 사용 {used:,}원 · 남음 {left:,}원 · 남은 블록 {nb}개 → 이번 블록 {block:,}원")
    if unknown:
        print(f"  ⚠ 금액 미기재 티켓 {','.join(unknown)} — 사용자에게 금액 확인 후 구매기록.csv stake 채우기")
    if combos and block >= MIN_STAKE:
        for t, v in allocate(block, combos).items():
            print(f"  {t}: {v:,}원")


if __name__ == "__main__":
    main()
