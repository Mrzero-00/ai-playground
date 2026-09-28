#!/usr/bin/env python3
"""
마킹 구성 최적화: 최대 N조합(기본 100) 안에서 효율 규칙에 따라 단일/복수/전체를 정한다.

입력 JSON 예시 (확률은 % 또는 0~1 모두 가능):
[
  {"name": "1경기 맨시티 vs 아스날", "승": 45, "무": 30, "패": 25},
  {"name": "2경기 리버풀 vs 첼시",   "승": 62, "무": 24, "패": 14,
   "투표": {"승": 80, "무": 12, "패": 8}}
]
"투표"(선택): 베트맨 등에 공개되는 대중 투표율(%). 넣으면 결과별 '가치 = 모델확률/투표율'을 보여준다.
가치 1.0 미만 = 대중이 과하게 몰림(맞혀도 당첨금 분산), 1.2 이상 = 저평가된 선택.

사용법:
  python3 combo_optimizer.py 입력.json [--max 100] [--double 1.4] [--triple 1.25]
"""
import argparse, itertools, json, math, sys

OUT = ["승", "무", "패"]


def load(path):
    games = json.load(open(path, encoding="utf-8"))
    for g in games:
        ps = [float(g[o]) for o in OUT]
        s = sum(ps)
        g["p"] = {o: p / s for o, p in zip(OUT, ps)}
        g["rank"] = sorted(OUT, key=lambda o: -g["p"][o])
    return games


def hit_prob(games, levels):
    return math.prod(sum(g["p"][o] for o in g["rank"][:k]) for g, k in zip(games, levels))


def greedy(games, max_c, th2, th3):
    levels = [1] * len(games)
    log = []
    while True:
        best = None
        for i, g in enumerate(games):
            k = levels[i]
            if k == 3:
                continue
            cur = sum(g["p"][o] for o in g["rank"][:k])
            new = sum(g["p"][o] for o in g["rank"][:k + 1])
            mult = new / cur
            cost = (k + 1) / k  # 조합 증가 배수
            th = th2 if k == 1 else th3
            if mult < th or math.prod(levels) * cost > max_c:
                continue
            eff = math.log(mult) / math.log(cost)  # 조합 증가 대비 확률 증가 효율
            if best is None or eff > best[0]:
                best = (eff, i, mult)
        if best is None:
            return levels, log
        _, i, mult = best
        levels[i] += 1
        log.append(f"{games[i]['name']} → {levels[i]}개 선택 (적중확률 x{mult:.2f}, 조합 {math.prod(levels)})")


def exhaustive(games, max_c):
    best = (0, None)
    for lv in itertools.product([1, 2, 3], repeat=len(games)):
        if math.prod(lv) <= max_c:
            p = hit_prob(games, lv)
            if p > best[0]:
                best = (p, lv)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--max", type=int, default=100)
    ap.add_argument("--double", type=float, default=1.4)
    ap.add_argument("--triple", type=float, default=1.25)
    a = ap.parse_args()
    games = load(a.input)

    levels, log = greedy(games, a.max, a.double, a.triple)
    print("=== 추천 마킹 (효율 규칙) ===")
    for g, k in zip(games, levels):
        probs = " ".join(f"{o} {g['p'][o]*100:.0f}%" for o in OUT)
        print(f"{g['name']:<28} : {'/'.join(sorted(g['rank'][:k], key=OUT.index)):<8} ({probs})")
    vg = [g for g in games if "투표" in g]
    if vg:
        print("\n=== 인기도 대비 가치 (모델확률/투표율) ===")
        for g in vg:
            v = g["투표"]; s = sum(v.values())
            print(f"{g['name']:<28} : " + "  ".join(f"{o} {g['p'][o] / (v[o] / s):.2f}" for o in OUT if v.get(o)))
    print(f"\n총 {math.prod(levels)}조합 / 예상 전체 적중 확률 {hit_prob(games, levels)*100:.2f}%")
    print("\n확장 과정:")
    for l in log:
        print("  -", l)

    p, lv = exhaustive(games, a.max)
    print(f"\n[참고] {a.max}조합을 꽉 채울 때 최대 적중 확률: {p*100:.2f}% ({math.prod(lv)}조합)")


if __name__ == "__main__":
    sys.exit(main())
