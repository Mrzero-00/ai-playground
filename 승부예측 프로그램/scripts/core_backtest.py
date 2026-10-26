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
  python3 scripts/core_backtest.py --picks         # 실제 추천기록 다리(핸디캡·언더오버 포함)로 재측정

--picks (2026-10-22 심층회고 2단계 추가)
  왜: 코어 규칙의 근거 숫자(66다리 72.7%·회수 116%)는 전부 **1X2 다리**로 잰 것인데,
      124·125회에 실제로 추천한 코어 다리는 전부 **정수 핸디캡(H-1.0)** 이었다.
      핸디캡·언더오버의 '시장 확률'은 스캔기록에서 근거=역산모델 — Pinnacle 1X2 를 득점 모델로
      변환한 값이라 독립 시장이 아니다. 즉 "측정한 것"과 "사는 것"이 달랐다.
  무엇: 추천기록.csv 의 채점된 다리(내 확률·배당 기록됨)에 스캔기록 공정확률을 붙여
      시장 유형별(1X2 / 핸디캡 / 언더오버)·근거별(직접 / 역산모델) 적중과 회수를 따로 낸다.
"""
import argparse, csv, itertools, os, random, re, sys, collections

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
                            ty=leg_type(p, mkt[k], k, top, od[k], pure[k], own_top,
                                        own_margin=(lambda v: v[0] - v[1])(sorted((x for x in pure.values() if x is not None), reverse=True))
                                        if sum(x is not None for x in pure.values()) >= 2 else None)))
    return dedupe(out)


def dedupe(legs):
    """같은 경기가 두 회차에 걸쳐 팔리면 다리가 두 번 세어진다 — 2026-10-21 125회 심층회고에서 발견.

    왜: 베트맨은 회차 경계에 걸친 경기를 다음 회차에도 올린다(119·120의 SSG-삼성, 124·125의 오카야마-미토 등).
        `round_log.py init` 이 회차마다 행을 만들기 때문에 전체경기기록에 같은 경기가 두 행 있고,
        코어 71다리 중 5다리(7%)가 그 중복이었다. 넷이 적중이라 정확도·표본이 같이 부풀었다.
        코어 규칙을 정하는 스크립트라 '30다리마다 재측정' 의 n 이 틀리면 안 된다.
    무엇: (시각, 경기, 선택) 이 같으면 **늦은 회차**(마감에 가까운 배당·최신 분석) 하나만 남긴다.
    """
    keep = {}
    for x in legs:
        k = (x["time"], x["game"], x["sel"])
        prev = keep.get(k)
        if prev is None or str(x["rd"]) > str(prev["rd"]):
            keep[k] = x
    return list(keep.values())


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


PICK = os.path.join(ROOT, "추천기록.csv")
SCAN = os.path.join(ROOT, "data", "스캔기록.csv")


def norm_line(line, half=False):
    """추천기록 '게임' 칸의 라인 표기(`H -1.0`·`U/O 2.5`)를 스캔기록 구분 표기(H-1·U/O 2.5)로 맞춘다.
    맞추지 않으면 핸디캡 다리가 전부 '일반' 으로 떨어져 1X2 시장 확률과 비교된다(잘못된 숫자)."""
    t = (line or "일반").strip()
    m = re.match(r"^H\s*([+-]?\d+(?:\.\d+)?)$", t)
    if m:
        v = float(m.group(1))
        t = "H%+g" % v            # -1.0 → H-1 · -2.5 → H-2.5
    else:
        m = re.match(r"^U/O\s*([\d.]+)$", t)
        if m:
            t = "U/O %g" % float(m.group(1))
    return ("전반 " + t) if half else t


def pick_legs(only=None):
    """실제 추천기록 다리 — 1X2 밖(핸디캡·언더오버·전반)까지 포함해 코어 판정을 다시 먹인다."""
    scan = {}
    for r in csv.DictReader(open(SCAN, encoding="utf-8-sig")):
        key = (r["회차"], r["번호"], (r.get("구분") or "일반").strip())
        scan.setdefault(key, {})[r["선택"]] = (num(r.get("공정확률")), (r.get("근거") or "").strip())
    out, miss = [], []
    for r in csv.DictReader(open(PICK, encoding="utf-8-sig")):
        if r.get("적중") not in ("0", "1"):
            continue
        if only and r["회차"] != only:
            continue
        p, od = num(r.get("확률")), num(r.get("배당"))
        if p is None or od is None:
            continue
        game = r.get("게임") or ""
        raw_line = game.split("`")[1].strip() if "`" in game else "일반"
        half = "전반" in game
        line = norm_line(raw_line, half)
        opts = scan.get((r["회차"], r["번호"], line)) or {}
        mk, src = opts.get(r["선택"], (None, ""))
        if mk is None:
            miss.append(f'{r["회차"]}/{r["번호"]} {game} [{line}]')
            continue
        top = max(opts, key=lambda k: opts[k][0] or -1)
        market = ("전반 " if half else "") + ("핸디캡" if "H" in line else "언더오버" if "U/O" in line else "1X2")
        out.append(dict(rd=r["회차"], no=r["번호"], game=r.get("경기", ""), lg=r.get("리그", ""), sport=r.get("종목", ""),
                        sel=r["선택"], p=p, raw=p, mk=mk, od=od, hit=int(r["적중"]), time=r.get("시각", ""),
                        depth=r.get("구분", ""), market=market, src=src or "직접",
                        ty=leg_type(p, mk, r["선택"], top, od, p, None)))
    if miss:
        print(f"※ 시장 확률 매칭 실패 {len(miss)}다리 — " + ", ".join(miss[:6]) + (" …" if len(miss) > 6 else ""))
    return out


def picks_report(only=None):
    rows = pick_legs(only)
    print(f"# 실제 추천기록 다리 재측정 — {len(rows)}다리 (핸디캡·언더오버 포함)")
    print("\n## 시장 유형별 (전체 — 추천·추천제외·도파민 모두)")
    by = collections.defaultdict(list)
    for x in rows:
        by[x["market"]].append(x)
    for k in sorted(by, key=lambda k: -len(by[k])):
        print(f"  {k:12s} {summary(by[k])}")
    print("\n## 시장 확률 근거별")
    by = collections.defaultdict(list)
    for x in rows:
        by[x["src"]].append(x)
    for k in sorted(by, key=lambda k: -len(by[k])):
        print(f"  {k:12s} {summary(by[k])}")
    core = [x for x in rows if x["ty"].startswith("B")]
    print(f"\n## 코어 판정 통과 다리  {summary(core)}")
    by = collections.defaultdict(list)
    for x in core:
        by[x["market"]].append(x)
    for k in sorted(by, key=lambda k: -len(by[k])):
        print(f"  {k:12s} {summary(by[k])}")
    print("\n## 코어 판정 통과 — 시장 확률 근거별 (역산모델 = 독립 시장이 아님)")
    by = collections.defaultdict(list)
    for x in core:
        by[x["src"]].append(x)
    for k in sorted(by, key=lambda k: -len(by[k])):
        print(f"  {k:12s} {summary(by[k])}")
    print("\n## 실제로 '추천'으로 올린 다리만 (구분=추천)")
    rec = [x for x in rows if x["depth"] == "추천"]
    print(f"  전체        {summary(rec)}")
    by = collections.defaultdict(list)
    for x in rec:
        by[x["market"]].append(x)
    for k in sorted(by, key=lambda k: -len(by[k])):
        print(f"  {k:12s} {summary(by[k])}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--holdout"); ap.add_argument("--only")
    ap.add_argument("--picks", action="store_true", help="실제 추천기록 다리(핸디캡·언더오버 포함)로 재측정")
    a = ap.parse_args()
    if a.picks:
        picks_report(a.only)
        return
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
