#!/usr/bin/env python3
"""요인 보정의 가치 측정 — '기준선에서 손대는 것이 이득인가' (2026-10-21 심층회고에서 신설)

왜: 분석가는 기준선(pi-rating)에서 출발해 결장·휴식·폼·기준선불신 같은 요인으로 확률을 움직인다.
    그런데 **그 움직임이 결과를 더 맞혔는지 한 번도 직접 재지 않았다.** 124회에서 로마(-6.3%p 결장 보정
    → 4:0 압승)·맨시티(-4.1%p → 5:1)·포르투(+5.1%p 상대 결장 → 0:1 패)가 모두 보정과 반대로 끝났다.
    기준선 대비 적중률(58% vs 45%)은 '분석 전체'의 가치지, '요인 보정'의 가치가 아니다 — 심층 분석은
    기준선 자체도 더 좋은 입력(xG·λ)으로 다시 만들기 때문이다. 이 스크립트가 둘을 분리한다.

무엇: data/근거기록.csv 의 '요약' 행에서 (기준선 1X2, 최종 1X2)을 꺼내 결과와 대조한다.
    - 1순위 적중: 기준선 vs 최종
    - RPS: 기준선 vs 최종 (낮을수록 좋음)
    - 요인 유형별: 그 유형이 쓰인 경기에서 보정이 결과 쪽으로 갔는가(Δ결과확률 > 0)
    - 요인 크기별: |순 보정|이 클수록 나아지는가

    - --drop <유형>: 그 요인을 안 썼다면 어땠을지(기준선 + 나머지 요인 합) 재계산해 비교 — 절제(ablation)

사용: python3 scripts/factor_value.py [--round 124] [--min-n 8] [--drop 휴식]
"""
import argparse, csv, json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVI = os.path.join(ROOT, "data", "근거기록.csv")
SEL = ("승", "무", "패")


def rps(p, res):
    """순서형 RPS (승-무-패). p = {'승':%, ...}"""
    v = [p.get(k, 0) / 100 for k in SEL]
    o = [1.0 if k == res else 0.0 for k in SEL]
    c = cs = 0.0
    tot = 0.0
    for i in range(len(SEL) - 1):
        c += v[i]; cs += o[i]; tot += (c - cs) ** 2
    return tot / (len(SEL) - 1)


def jload(s):
    try:
        d = json.loads(s)
        return d if isinstance(d, dict) and all(k in d for k in SEL) else None
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round"); ap.add_argument("--min-n", type=int, default=8)
    ap.add_argument("--drop", help="이 요인 유형을 뺐을 때와 비교(절제 실험)")
    a = ap.parse_args()
    rows = list(csv.DictReader(open(EVI, encoding="utf-8-sig")))
    # 경기별 요인 유형 모으기
    fac = collections.defaultdict(list)
    for r in rows:
        if r["구분"] == "요인" and r.get("유형"):
            fac[(r["회차"], r["번호"])].append(r)
    games = []
    for r in rows:
        if r["구분"] != "요약":
            continue
        if a.round and r["회차"] != str(a.round):
            continue
        res = (r.get("결과") or "").strip()
        if res not in SEL:
            continue
        b, f = jload(r.get("기준선", "")), jload(r.get("최종", ""))
        if not b or not f:
            continue
        games.append(dict(rd=r["회차"], no=r["번호"], game=r["경기"], res=res, base=b, fin=f,
                          facs=fac.get((r["회차"], r["번호"]), []),
                          dres=f.get(res, 0) - b.get(res, 0)))
    if not games:
        print("요약 행에 기준선·최종·결과가 모두 있는 경기가 없다."); return

    def top(p):
        return max(SEL, key=lambda k: p.get(k, 0))

    if a.drop:
        # 절제: 최종에서 그 유형 요인의 영향(%p, 홈승 기준 부호)을 되돌린다.
        # 영향은 '승' 쪽 %p 이므로 되돌린 분을 무·패에 원래 비율대로 나눠 넣는다.
        use = []
        for g in games:
            d = sum(float(x.get("영향") or 0) for x in g["facs"] if x.get("유형") == a.drop)
            if d == 0:
                continue
            f = dict(g["fin"])
            rest = f.get("무", 0) + f.get("패", 0)
            if rest <= 0:
                continue
            w = max(0.0, min(100.0, f.get("승", 0) - d))
            scale = (100.0 - w) / rest
            abl = {"승": w, "무": f.get("무", 0) * scale, "패": f.get("패", 0) * scale}
            use.append((g, abl))
        if not use:
            print(f"'{a.drop}' 요인이 쓰인(영향≠0) 경기가 없다."); return
        m = len(use)
        fh2 = sum(1 for g, _ in use if top(g["fin"]) == g["res"])
        ah = sum(1 for g, ab in use if top(ab) == g["res"])
        fr2 = sum(rps(g["fin"], g["res"]) for g, _ in use) / m
        ar = sum(rps(ab, g["res"]) for g, ab in use) / m
        bh2 = sum(1 for g, _ in use if top(g["base"]) == g["res"])
        br2 = sum(rps(g["base"], g["res"]) for g, _ in use) / m
        print(f"# 절제 실험 — '{a.drop}' 요인을 쓴 경기 {m}개" + (f" ({a.round}회)" if a.round else ""))
        print(f"  기준선        1순위 {bh2}/{m} ({bh2/m*100:.1f}%)  RPS {br2:.4f}")
        print(f"  실제(요인 포함) 1순위 {fh2}/{m} ({fh2/m*100:.1f}%)  RPS {fr2:.4f}")
        print(f"  '{a.drop}' 뺐다면  1순위 {ah}/{m} ({ah/m*100:.1f}%)  RPS {ar:.4f}")
        print(f"  → 1순위 {(fh2-ah)/m*100:+.1f}%p · RPS {fr2-ar:+.4f}  "
              f"({'요인이 도움' if (fr2 < ar and fh2 >= ah) else '요인이 해로움' if (fr2 > ar or fh2 < ah) else '차이 없음'})")
        byrd = collections.defaultdict(lambda: [0, 0, 0])
        for g, ab in use:
            c = byrd[g["rd"]]; c[0] += 1; c[1] += top(g["fin"]) == g["res"]; c[2] += top(ab) == g["res"]
        print("  회차별 (포함 → 제외):")
        for k in sorted(byrd):
            c = byrd[k]
            print(f"    {k}: {c[1]}/{c[0]} → {c[2]}/{c[0]}")
        return

    n = len(games)
    bh = sum(1 for g in games if top(g["base"]) == g["res"])
    fh = sum(1 for g in games if top(g["fin"]) == g["res"])
    br = sum(rps(g["base"], g["res"]) for g in games) / n
    fr = sum(rps(g["fin"], g["res"]) for g in games) / n
    better = sum(1 for g in games if g["dres"] > 0.05)
    worse = sum(1 for g in games if g["dres"] < -0.05)
    print(f"# 요인 보정의 가치 — 근거JSON 경기 {n}개" + (f" ({a.round}회)" if a.round else ""))
    print(f"\n## 1순위 적중   기준선 {bh}/{n} ({bh/n*100:.1f}%)  →  최종 {fh}/{n} ({fh/n*100:.1f}%)   차 {(fh-bh)/n*100:+.1f}%p")
    print(f"## RPS         기준선 {br:.4f}  →  최종 {fr:.4f}   차 {fr-br:+.4f} ({'최종이 낫다' if fr < br else '기준선이 낫다'})")
    print(f"## 보정 방향    결과 쪽으로 {better}  ·  결과 반대로 {worse}  ·  거의 안 움직임 {n-better-worse}")
    print(f"   실제 결과 확률 평균 변화 {sum(g['dres'] for g in games)/n:+.2f}%p")
    print(f"\n## 뒤집힌 경기(기준선 1순위 ≠ 최종 1순위)")
    flip = [g for g in games if top(g["base"]) != top(g["fin"])]
    if flip:
        ok = sum(1 for g in flip if top(g["fin"]) == g["res"])
        bk = sum(1 for g in flip if top(g["base"]) == g["res"])
        print(f"   {len(flip)}경기 — 최종이 맞음 {ok} · 기준선이 맞음 {bk} · 둘 다 틀림 {len(flip)-ok-bk}")
    else:
        print("   없음")
    print(f"\n## 요인 유형별 (그 유형이 쓰인 경기, n≥{a.min_n})")
    byt = collections.defaultdict(list)
    for g in games:
        for t in {x["유형"] for x in g["facs"]}:
            byt[t].append(g)
    print(f"| 요인 | 경기 | 기준선 1순위 | 최종 1순위 | 기준선 RPS | 최종 RPS | 결과확률 Δ |")
    print("|---|---|---|---|---|---|---|")
    for t in sorted(byt, key=lambda t: -len(byt[t])):
        s = byt[t]
        if len(s) < a.min_n:
            continue
        m = len(s)
        print(f"| {t} | {m} | {sum(1 for g in s if top(g['base'])==g['res'])/m*100:.0f}% "
              f"| {sum(1 for g in s if top(g['fin'])==g['res'])/m*100:.0f}% "
              f"| {sum(rps(g['base'],g['res']) for g in s)/m:.4f} "
              f"| {sum(rps(g['fin'],g['res']) for g in s)/m:.4f} "
              f"| {sum(g['dres'] for g in s)/m:+.2f}%p |")
    print(f"\n## 보정 크기별 (|최종−기준선| 최대 이동폭)")
    def mv(g):
        return max(abs(g["fin"].get(k, 0) - g["base"].get(k, 0)) for k in SEL)
    for lo, hi in [(0, 3), (3, 6), (6, 10), (10, 100)]:
        s = [g for g in games if lo <= mv(g) < hi]
        if not s:
            continue
        m = len(s)
        print(f"  {lo}~{hi}%p  n={m:3d}  기준선 1순위 {sum(1 for g in s if top(g['base'])==g['res'])/m*100:4.0f}%"
              f"  →  최종 {sum(1 for g in s if top(g['fin'])==g['res'])/m*100:4.0f}%"
              f"   RPS {sum(rps(g['base'],g['res']) for g in s)/m:.4f} → {sum(rps(g['fin'],g['res']) for g in s)/m:.4f}")


if __name__ == "__main__":
    main()
