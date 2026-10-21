#!/usr/bin/env python3
"""내가 말한 확률이 실제로 그만큼 나오는지 재는 보고서.

사용자 지시(2026-10-22): "60~64%라고 썼으면 왜 60~64%가 안 나오는지 검토하고
분석한 숫자대로 되게끔 고쳐야 한다." 즉 어긋나는 구간을 추천에서 빼는 게 아니라,
어긋남 자체를 결함으로 보고 분석 기법을 고치는 것이 목적이다.

구간 하나가 어긋났다고 전부 결함은 아니다. 표본이 작으면 그냥 흔들린다.
그래서 모든 격차에 z 값을 붙이고 |z| >= 2 인 것만 '유의'로 표시한다.
유의한 편향만 회고에서 원인을 찾고 기법을 고친다.

    python3 scripts/calib_report.py              # 전체
    python3 scripts/calib_report.py --round 124  # 그 회차만
    python3 scripts/calib_report.py --save       # 회차별분석/확률정합_<날짜>.md 로 저장
"""
import argparse, collections, csv, datetime as dt, math, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SIDES = ("승", "무", "패")
Z_SIG = 2.0


def load(rnd=None):
    p = os.path.join(ROOT, "전체경기기록.csv")
    rs = [r for r in csv.DictReader(open(p, encoding="utf-8-sig")) if r.get("결과") in SIDES]
    if rnd:
        rs = [r for r in rs if r.get("회차") == str(rnd)]
    return rs


def probs(r, pre):
    v = {}
    for k in SIDES:
        x = r.get(f"{pre}_{k}")
        if x in (None, ""):
            return None
        try:
            v[k] = float(x)
        except ValueError:
            return None
    return v


def z_of(said, got, n):
    """said·got 는 0~100. 이항 표준오차 기준 z."""
    p = said / 100.0
    if n <= 0 or p <= 0 or p >= 1:
        return 0.0
    return (got / 100.0 - p) / math.sqrt(p * (1 - p) / n)


def mark(z):
    return "**유의**" if abs(z) >= Z_SIG else ""


def line(label, n, said, got):
    z = z_of(said, got, n)
    return f"| {label} | {n} | {said:.1f}% | {got:.1f}% | {got - said:+.1f}p | {z:+.1f} | {mark(z)} |", abs(z) >= Z_SIG


def section_sides(rows, pre, out, issues):
    xs = [(probs(r, pre), r) for r in rows]
    xs = [(p, r) for p, r in xs if p]
    if not xs:
        return
    out.append(f"\n### {pre} — 방향별 확률 (n={len(xs)})")
    out.append("| 방향 | 경기 | 내가 말한 평균 | 실제 | 격차 | z | |")
    out.append("|---|---:|---:|---:|---:|---:|---|")
    for s in SIDES:
        said = sum(p[s] for p, _ in xs) / len(xs)
        got = sum(1 for _, r in xs if r["결과"] == s) / len(xs) * 100
        t, sig = line(s, len(xs), said, got)
        out.append(t)
        if sig:
            issues.append(f"{pre} 전체: '{s}' 확률을 {said - got:+.1f}p 어긋나게 본다(n={len(xs)})")


def section_curve(rows, pre, out, issues):
    xs = []
    for r in rows:
        p = probs(r, pre)
        if not p:
            continue
        t = max(p, key=p.get)
        xs.append((p[t], t == (r["결과"]), t, r))
    if not xs:
        return
    said = sum(x[0] for x in xs) / len(xs)
    got = sum(1 for x in xs if x[1]) / len(xs) * 100
    out.append(f"\n### {pre} — 1순위 신뢰도 곡선 (n={len(xs)}, 전체 내 말 {said:.1f}% / 실제 {got:.1f}%)")
    out.append("| 내 확률 구간 | 경기 | 내가 말한 평균 | 실제 | 격차 | z | |")
    out.append("|---|---:|---:|---:|---:|---:|---|")
    for lo, hi in [(0, 45), (45, 50), (50, 55), (55, 60), (60, 65), (65, 70), (70, 80), (80, 101)]:
        b = [x for x in xs if lo <= x[0] < hi]
        if not b:
            continue
        s = sum(x[0] for x in b) / len(b)
        g = sum(1 for x in b if x[1]) / len(b) * 100
        t, sig = line(f"{lo}~{hi}", len(b), s, g)
        out.append(t)
        if sig:
            issues.append(f"{pre} {lo}~{hi}% 구간: 내 말 {s:.1f}% vs 실제 {g:.1f}% ({g - s:+.1f}p, n={len(b)})")
    out.append("")
    out.append("> 1순위로 고른 방향별")
    out.append("")
    out.append("| 고른 방향 | 경기 | 내가 말한 평균 | 실제 | 격차 | z | |")
    out.append("|---|---:|---:|---:|---:|---:|---|")
    d = collections.defaultdict(lambda: [0, 0, 0.0])
    for p, hit, t, r in xs:
        d[t][0] += 1; d[t][1] += hit; d[t][2] += p
    for k in SIDES:
        if not d[k][0]:
            continue
        n, h, s = d[k]
        t, sig = line(f"{k} 선택", n, s / n, h / n * 100)
        out.append(t)
        if sig:
            issues.append(f"{pre} '{k}'을 1순위로 고를 때: 내 말 {s / n:.1f}% vs 실제 {h / n * 100:.1f}% (n={n})")


def section_split(rows, pre, key, label, out, issues, minn=12):
    xs = []
    for r in rows:
        p = probs(r, pre)
        if not p:
            continue
        t = max(p, key=p.get)
        xs.append((key(r), p[t], t == r["결과"]))
    d = collections.defaultdict(lambda: [0, 0, 0.0])
    for k, pv, hit in xs:
        if not k:
            continue
        d[k][0] += 1; d[k][1] += hit; d[k][2] += pv
    rowsout = []
    for k in sorted(d, key=lambda k: -d[k][0]):
        n, h, s = d[k]
        if n < minn:
            continue
        t, sig = line(str(k), n, s / n, h / n * 100)
        rowsout.append(t)
        if sig:
            issues.append(f"{pre} {label} '{k}': 내 말 {s / n:.1f}% vs 실제 {h / n * 100:.1f}% (n={n})")
    if rowsout:
        out.append(f"\n### {pre} — {label}별 (n>={minn})")
        out.append("| 구분 | 경기 | 내가 말한 평균 | 실제 | 격차 | z | |")
        out.append("|---|---:|---:|---:|---:|---:|---|")
        out += rowsout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round")
    ap.add_argument("--save", action="store_true")
    a = ap.parse_args()
    rows = load(a.round)
    if not rows:
        print("채점된 경기가 없다"); return 1
    out, issues = [], []
    title = f"# 확률 정합 보고 — {dt.date.today()}" + (f" (회차 {a.round})" if a.round else " (전체)")
    out.append(title)
    out.append(f"\n채점 {len(rows)}경기. 목표는 **내가 쓴 숫자대로 나오게 하는 것**이다. "
               f"격차가 커도 |z| < {Z_SIG:.0f} 면 표본 흔들림이라 쫓지 않는다. 유의한 것만 고친다.")
    for pre in ("순수", "보정", "시장"):
        section_sides(rows, pre, out, issues if pre != "시장" else [])
        section_curve(rows, pre, out, issues if pre != "시장" else [])
    for pre in ("순수", "보정"):
        section_split(rows, pre, lambda r: r.get("종목"), "종목", out, issues)
        section_split(rows, pre, lambda r: r.get("리그"), "리그", out, issues, minn=15)
        section_split(rows, pre, lambda r: r.get("깊이") or "(표시없음)", "분석 깊이", out, issues)
    out.append("\n## 고쳐야 할 것 (유의한 편향만)")
    if issues:
        out += [f"{i + 1}. {s}" for i, s in enumerate(issues)]
        out.append("\n각 항목은 회고에서 **원인**을 적고, 기법·입력·가중치 중 무엇을 고쳤는지 남긴다. "
                   "보정 계층으로 덮는 것은 임시 조치이고, 순수 분석의 편향이 남아 있으면 해결이 아니다.")
    else:
        out.append("없음 — 유의한 편향이 보이지 않는다(표본이 더 쌓이면 다시 본다).")
    txt = "\n".join(out)
    print(txt)
    if a.save:
        p = os.path.join(ROOT, "회차별분석", f"확률정합_{dt.date.today()}{'_' + a.round if a.round else ''}.md")
        open(p, "w", encoding="utf-8").write(txt + "\n")
        print(f"\n→ 저장 {p}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
