#!/usr/bin/env python3
"""과거 회차를 **현재 스킬 기준**으로 다시 돌려 방향 적중률을 재다.

스킬이 바뀔 때마다 "그래서 지금 로직이면 과거를 몇 % 맞혔나"를 같은 방식으로 답하기 위한 도구다.
세 가지를 나란히 찍는다.

  현재 기준선  predict_engine 이 전 경기 연대기에서 시간 순으로 낸 자체 모델 방향
               (dixon_coles → poisson → pi 순으로 있는 것). **재현 가능한 부분**.
  그때 내 분석  그 회차에 실제로 기록된 순수_승/무/패 의 1순위. 사람·opus 개입이 들어간 값이라
               지금 다시 만들 수 없다. 그래서 '기준선 → 내 분석' 개선폭만 가져다 쓴다.
  시장         눈금. 목표가 아니다.

  현재 스킬 추정치 = 기준선 적중률 + (측정된 개입 개선폭)
  개입 개선폭은 깊이=심층 구간에서만 센다. 기준선·시장복사·미분석은 분석이 아니다.

  python3 scripts/replay.py 승무패          # 승무패 전 회차
  python3 scripts/replay.py --md            # 보고용 마크다운
"""
import csv, os, sys, math, argparse, collections

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LOG = os.path.join(ROOT, "전체경기기록.csv")
PRED = os.path.join(ROOT, "data", "기법별예측.csv")
LAB = ("승", "무", "패")
NO_ANALYSIS = ("기준선", "시장복사", "미분석", "")
BASE_ORDER = ("dixon_coles", "poisson", "pi")


def top(r, pre):
    """r 의 <pre>_승/무/패 중 1순위. 값이 없거나 전부 0이면 None."""
    try:
        v = {k: float(r.get(f"{pre}_{k}") or 0) for k in LAB}
    except ValueError:
        return None
    return max(v, key=v.get) if sum(v.values()) > 0 else None


def load(prefix=None):
    games = [r for r in csv.DictReader(open(LOG, encoding="utf-8-sig")) if r["결과"] in LAB]
    if prefix:
        games = [r for r in games if r["회차"].startswith(prefix)]
    pred = collections.defaultdict(dict)
    if os.path.exists(PRED):
        for r in csv.DictReader(open(PRED, encoding="utf-8-sig")):
            pred[(r["회차"], r["번호"])][r["기법"]] = r
    return games, pred


_REAL = None


def baseline(pred, g):
    # 2026-11-11: predict_engine 의 dixon_coles 는 우리 경기에 대해 거의 학습되지 않은 모델이었다
    # (한글 팀명이 영문 연대기와 안 이어짐). 실제 기준선 재현값이 있으면 그것을 쓴다.
    global _REAL
    if _REAL is None:
        try:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            import baseline_replay
            _REAL = baseline_replay.load()
        except Exception:
            _REAL = {}
    b = _REAL.get((g["회차"], g["번호"]))
    if b:
        return b["1순위"]
    e = pred.get((g["회차"], g["번호"]), {})
    for k in BASE_ORDER:
        if k in e:
            return e[k]["1순위"]
    return None


def tally(games, pred):
    """(기준선 적중, 기준선 n, 내분석 적중, n, 시장 적중, n, 공통 비교)"""
    b = bn = o = on = m = mn = 0
    cb = co = cn = 0
    for g in games:
        bs, os_, ms = baseline(pred, g), top(g, "순수"), top(g, "시장")
        if bs:
            bn += 1; b += bs == g["결과"]
        if os_:
            on += 1; o += os_ == g["결과"]
        if ms:
            mn += 1; m += ms == g["결과"]
        if bs and os_:
            cn += 1; cb += bs == g["결과"]; co += os_ == g["결과"]
    return dict(b=b, bn=bn, o=o, on=on, m=m, mn=mn, cb=cb, co=co, cn=cn)


def se(h, n):
    if not n:
        return 0.0
    p = h / n
    return 100 * math.sqrt(max(p * (1 - p), 1e-9) / n)


def pct(h, n, nd=1):
    return f"{h/n*100:.{nd}f}% ({h}/{n})" if n else "—"


def cmd(a):
    games, pred = load(a.prefix)
    if not games:
        print("해당 회차가 없다 — predict_engine.py run 을 먼저 돌렸는지 확인한다", file=sys.stderr)
        return 1
    rounds = sorted({g["회차"] for g in games},
                    key=lambda x: (0, int(x[3:])) if x.startswith("승무패") and x[3:].isdigit()
                    else (1, x))
    bar = "|" if a.md else "|"
    rows = []
    for rnd in rounds:
        gs = [g for g in games if g["회차"] == rnd]
        t = tally(gs, pred)
        dep = collections.Counter(g["깊이"] or "빈칸" for g in gs)
        rows.append((rnd, len(gs), t, dep))

    if a.md:
        print(f"### 과거 회차 재현 — 현재 스킬 기준선\n")
        print(f"| 회차 | 경기 | 현재 기준선 | 그때 내 분석 | 시장 | 그때 깊이 |")
        print(f"|---|---:|---:|---:|---:|---|")
        for rnd, n, t, dep in rows:
            d = " ".join(f"{k}{v}" for k, v in dep.items())
            print(f"| {rnd} | {n} | {pct(t['b'],t['bn'],0)} | {pct(t['o'],t['on'],0)} | {pct(t['m'],t['mn'],0)} | {d} |")
    else:
        print(f"{'회차':<10}{'경기':>4} | {'현재 기준선':>15} | {'그때 내 분석':>15} | {'시장':>14} | 그때 깊이")
        for rnd, n, t, dep in rows:
            d = " ".join(f"{k}{v}" for k, v in dep.items())
            print(f"{rnd:<10}{n:>4} | {pct(t['b'],t['bn'],0):>15} | {pct(t['o'],t['on'],0):>15} | {pct(t['m'],t['mn'],0):>14} | {d}")
        print("-" * 96)

    A = tally(games, pred)
    deep = [g for g in games if g["깊이"] not in NO_ANALYSIS]
    D = tally(deep, pred)
    lift = (D["co"] - D["cb"]) / D["cn"] * 100 if D["cn"] else 0.0
    lse = se(D["co"], D["cn"]) + se(D["cb"], D["cn"])
    base = A["b"] / A["bn"] * 100 if A["bn"] else 0.0

    nl = "\n" if a.md else ""
    print(f"{nl}**합계 {len(games)}경기** — 현재 기준선 {pct(A['b'],A['bn'])} · "
          f"그때 내 분석 {pct(A['o'],A['on'])} · 시장 {pct(A['m'],A['mn'])}")
    print(f"{nl}**개입 개선폭** (깊이=심층/가벼움 {D['cn']}경기만) — "
          f"기준선 {pct(D['cb'],D['cn'])} → 내 분석 {pct(D['co'],D['cn'])} = **{lift:+.1f}p** (2SE ±{lse:.1f}p)")
    verdict = "잡음" if abs(lift) < lse else ("개선" if lift > 0 else "악화")
    print(f"{nl}**현재 스킬 추정 적중률 = {base:.1f}% + {lift:+.1f}p = {base+lift:.1f}%** "
          f"— 개입 효과 판정 **{verdict}**, 목표 100% 까지 {100-(base+lift):.1f}p")

    fix = brk = both_miss = 0
    for g in deep:
        bs, os_ = baseline(pred, g), top(g, "순수")
        if not (bs and os_):
            continue
        bok, ook = bs == g["결과"], os_ == g["결과"]
        fix += (not bok) and ook
        brk += bok and (not ook)
        both_miss += (not bok) and (not ook)
    print(f"{nl}기준선 오답을 바로잡음 {fix}건 · 기준선 정답을 망침 {brk}건 · 둘 다 틀림 {both_miss}건")
    if fix <= brk:
        print(f"{nl}> 바로잡은 수가 망친 수를 넘지 못한다. 개입이 방향을 더 맞히지 못하고 있다는 뜻이다.")
    return 0


def main():
    p = argparse.ArgumentParser(description="과거 회차를 현재 스킬 기준으로 재현")
    p.add_argument("prefix", nargs="?", default=None, help="회차 접두어 (예: 승무패). 생략하면 전부")
    p.add_argument("--md", action="store_true", help="마크다운으로 출력")
    a = p.parse_args()
    return cmd(a)


if __name__ == "__main__":
    sys.exit(main())
