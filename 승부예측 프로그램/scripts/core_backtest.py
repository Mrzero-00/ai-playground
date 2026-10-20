#!/usr/bin/env python3
"""코어 추천 규칙 백테스트 (2026-10-21 추가 — 심층회고 2단계 '코드로 막는다')

왜: 추천 기준(배당 밴드·gap·B++ 등)을 회차마다 말로만 재확인했다. 기준을 바꾸려면
    같은 방식으로 다시 재는 스크립트가 있어야 하는데 없었다 — 그래서 '30다리마다 재측정'이
    실제로는 수동 계산이었다. 이 스크립트가 그 재측정을 한 줄로 만든다.

무엇: 전체경기기록.csv 의 채점된 경기에서 승무패(1X2) 다리를 복원해
      pick_table.leg_type() 판정을 그대로 먹이고 유형별 적중·단식 회수·2폴더 회수를 낸다.
      내 확률 = 보정_*(pick_table 의 p), gap 판정 원본 = 순수_*(raw) — pick_table 과 동일.
      ※ 핸디캡·언더오버 다리는 경기별 확률이 기록에 남지 않아 제외(1X2 전용). 밴드 비교용.

사용:
  python3 scripts/core_backtest.py                 # 유형별·배당 구간별
  python3 scripts/core_backtest.py --holdout 124   # 이 회차를 빼고 측정(규칙 후보 검증용)
  python3 scripts/core_backtest.py --only 124      # 이 회차만
"""
import argparse, csv, itertools, os, random, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
from pick_table import leg_type  # noqa: E402

REC = os.path.join(ROOT, "전체경기기록.csv")
SEL = ("승", "무", "패")


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def legs(holdout=None, only=None):
    out = []
    for r in csv.DictReader(open(REC, encoding="utf-8-sig")):
        res = (r.get("결과") or "").strip()
        if res not in SEL:
            continue
        rd = r["회차"]
        if holdout and rd == holdout:
            continue
        if only and rd != only:
            continue
        pure = {k: num(r.get(f"순수_{k}")) for k in SEL}
        cal = {k: num(r.get(f"보정_{k}")) for k in SEL}
        mkt = {k: num(r.get(f"시장_{k}")) for k in SEL}
        od = {k: num(r.get(f"베트맨_{k}")) for k in SEL}
        if pure["승"] is None or mkt["승"] is None:
            continue
        top = max((k for k in SEL if mkt[k] is not None), key=lambda k: mkt[k], default=None)
        own_top = max((k for k in SEL if cal.get(k) is not None), key=lambda k: cal[k], default=None) \
            or max((k for k in SEL if pure.get(k) is not None), key=lambda k: pure[k], default=None)
        for k in SEL:
            if od[k] is None or mkt[k] is None:
                continue
            p = cal[k] if cal[k] is not None else pure[k]
            if p is None:
                continue
            out.append(dict(rd=rd, no=r["번호"], game=f"{r['홈']}-{r['원정']}", lg=r.get("리그", ""),
                            sport=r.get("종목", ""), sel=k, p=p, raw=pure[k], mk=mkt[k], od=od[k],
                            hit=1 if res == k else 0, time=r.get("시각", ""), depth=r.get("깊이", ""),
                            ty=leg_type(p, mkt[k], k, top, od[k], pure[k], own_top)))
    return out


def summary(rows):
    n = len(rows)
    if not n:
        return "n=0"
    h = sum(x["hit"] for x in rows)
    ret = sum(x["od"] for x in rows if x["hit"]) / n
    return f"n={n:4d} 적중 {h:3d} ({h/n*100:4.1f}%) 평균배당 {sum(x['od'] for x in rows)/n:.2f} 단식회수 {ret*100:5.1f}%"


def pairs(rows, trials=4000, seed=7):
    """같은 회차·같은 시각대(±3시간)에서 2폴더를 무작위로 묶어 조합 적중·회수를 추정."""
    rnd = random.Random(seed)
    byblock = collections.defaultdict(list)
    for x in rows:
        byblock[(x["rd"], x["time"][:5])].append(x)
    pool = [v for v in byblock.values() if len(v) >= 2]
    if not pool:
        return "2폴더 표본 없음"
    ok = tot = 0
    ret = 0.0
    for _ in range(trials):
        blk = rnd.choice(pool)
        a, b = rnd.sample(blk, 2)
        if a["no"] == b["no"]:
            continue
        tot += 1
        if a["hit"] and b["hit"]:
            ok += 1
            ret += a["od"] * b["od"]
    if not tot:
        return "2폴더 표본 없음"
    return f"2폴더 {ok}/{tot} ({ok/tot*100:4.1f}%) 평균합계배당 … 회수 {ret/tot*100:5.1f}%"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--holdout"); ap.add_argument("--only")
    a = ap.parse_args()
    rows = legs(a.holdout, a.only)
    print(f"# 코어 규칙 백테스트 — 1X2 다리 {len(rows)}개"
          + (f" (제외 {a.holdout}회)" if a.holdout else "") + (f" ({a.only}회만)" if a.only else ""))
    print("\n## leg_type 유형별")
    by = collections.defaultdict(list)
    for x in rows:
        by[x["ty"].split("(")[0].strip()].append(x)
    for k in sorted(by, key=lambda k: -len(by[k])):
        print(f"  {k:34s} {summary(by[k])}")
    core = [x for x in rows if x["ty"].startswith("B")]
    print(f"\n## 코어 통과 전체  {summary(core)}")
    print(f"   {pairs(core)}")
    print("\n## 코어 통과 — 배당 구간")
    bands = [(1.30, 1.45), (1.45, 1.60), (1.60, 1.80), (1.80, 2.00), (2.00, 2.20)]
    for lo, hi in bands:
        s = [x for x in core if lo <= x["od"] < hi]
        print(f"  {lo:.2f}~{hi:.2f}  {summary(s)}")
    print("\n## 코어 통과 — gap(순수−시장) 구간")
    for lo, hi, lab in [(-99, -10, "≤−10"), (-10, -5, "−10~−5"), (-5, -3, "−5~−3"), (-3, 0, "−3~0"), (0, 2, "0~+2")]:
        s = [x for x in core if lo <= (x["raw"] - x["mk"]) < hi]
        print(f"  {lab:8s} {summary(s)}")
    print("\n## 코어 통과 — 시장 확률 구간")
    for lo, hi in [(40, 50), (50, 55), (55, 60), (60, 65), (65, 75), (75, 100)]:
        s = [x for x in core if lo <= x["mk"] < hi]
        print(f"  시장 {lo}~{hi}%  {summary(s)}")
    print("\n## 리그별(코어 통과, n≥10)")
    bl = collections.defaultdict(list)
    for x in core:
        bl[x["lg"]].append(x)
    for k in sorted(bl, key=lambda k: -len(bl[k])):
        if len(bl[k]) >= 10:
            print(f"  {k:28s} {summary(bl[k])}")


if __name__ == "__main__":
    main()
