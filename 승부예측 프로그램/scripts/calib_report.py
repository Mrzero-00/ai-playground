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
import argparse, collections, csv, datetime as dt, math, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SIDES = ("승", "무", "패")
Z_SIG = 2.0


def dedupe(rs):
    """같은 경기가 두 회차에 걸쳐 팔리면 두 번 세어진다 — 2026-10-22 125회 심층회고에서 발견.

    왜: 베트맨은 회차 경계에 걸친 경기를 다음 회차에도 올리고 `round_log.py init` 이 회차마다 행을 만든다.
        채점 662행 중 48행(7%)이 그 중복이었다. 정합을 재는 스크립트에서 n 이 틀리면 |z| 가 통째로 틀린다.
        core_backtest.dedupe 와 같은 이유·같은 규칙이다.
    무엇: (종목, 홈, 원정, 시각) 이 같으면 **늦은 회차** 하나만 남긴다(최신 분석·마감에 가까운 배당).
    """
    keep = {}
    for r in rs:
        k = (r.get("종목"), r.get("홈"), r.get("원정"), (r.get("시각") or "")[:5])
        prev = keep.get(k)
        if prev is None or str(r.get("회차")) > str(prev.get("회차")):
            keep[k] = r
    return list(keep.values())


def load(rnd=None):
    p = os.path.join(ROOT, "전체경기기록.csv")
    rs = [r for r in csv.DictReader(open(p, encoding="utf-8-sig")) if r.get("결과") in SIDES]
    if rnd:
        rs = [r for r in rs if r.get("회차") == str(rnd)]
    return dedupe(rs)


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


def inversions(bands, minn=15, drop=5.0):
    """이웃한 확신 구간의 실제 적중이 뒤집혔는지 — 2026-10-22 125회 심층회고에서 추가.

    왜: 보정 55~60% 가 실제 73.5%, 60~65% 가 실제 47.7% 였다. 구간별 |z| 만 보면 '한쪽은 과신, 한쪽은 과소'로
        따로 읽히지만, 둘을 나란히 두면 **더 확신한 쪽이 덜 맞는** 순서 붕괴다. 단조롭지 않은 확률은
        온도(T)나 어떤 단조 보정으로도 고칠 수 없다 — 순서를 만드는 입력 자체가 틀린 것이다.
        (실제 원인: 그 구간에 내−시장 과신 경기가 몰려 있었다. 과신 +2%p 이상 100경기 43% vs 그 외 225경기 65%.)
    무엇: 양쪽 다 n>=minn 이고 실제 적중이 drop %p 이상 거꾸로면 보고한다.
    """
    out = []
    b = [x for x in bands if x[2] >= minn]
    for (lo1, hi1, n1, s1, g1), (lo2, hi2, n2, s2, g2) in zip(b, b[1:]):
        if g1 - g2 >= drop:
            out.append((lo1, hi1, g1, lo2, hi2, g2, g2 - g1))
    return out


def section_curve(rows, pre, out, issues):
    bands = []
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
        bands.append((lo, hi, len(b), s, g))
        if sig:
            issues.append(f"{pre} {lo}~{hi}% 구간: 내 말 {s:.1f}% vs 실제 {g:.1f}% ({g - s:+.1f}p, n={len(b)})")
    out.append("")
    inv = inversions(bands)
    if inv:
        out.append("> **뒤집힌 이웃 구간** — 확신을 더 준 구간이 오히려 덜 맞았다. 순서가 깨진 것이라 온도·보정으로는 못 고치고 입력을 고쳐야 한다.")
        out.append("")
        for lo1, hi1, g1, lo2, hi2, g2, d in inv:
            out.append(f"> - {lo1}~{hi1}% 실제 {g1:.1f}%  →  {lo2}~{hi2}% 실제 {g2:.1f}%  ({d:+.1f}p 역전)")
            issues.append(f"{pre} 이웃 구간 역전: {lo1}~{hi1}%({g1:.1f}%) > {lo2}~{hi2}%({g2:.1f}%) — 확률 순서가 깨짐")
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


def section_score(rows, out, issues):
    """예상점수 정합 (사용자 제안 2026-10-22).
    방향은 경기당 1비트뿐이라 '왜 틀렸는지'를 못 알려준다. 점수를 적어 두면 오차가 둘로 갈린다.
      · 총득점 오차 = 경기 템포·수비를 잘못 본 것
      · 득실차 오차 = 두 팀 전력 차를 잘못 본 것
    둘은 고치는 방법이 다르다. 핸디캡·언더오버 다리는 애초에 이 두 숫자 위에 서 있다."""
    xs = []
    for r in rows:
        ps, act = (r.get("예상점수") or "").strip(), (r.get("점수") or "").strip()
        m1 = re.match(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*[:：]\s*([0-9]+(?:\.[0-9]+)?)", ps)
        m2 = re.match(r"^\s*(\d+)\s*[:：]\s*(\d+)", act)
        if not (m1 and m2):
            continue
        ph, pa = float(m1.group(1)), float(m1.group(2))
        ah, aa = int(m2.group(1)), int(m2.group(2))
        xs.append((r.get("종목") or "?", ph, pa, ah, aa))
    if not xs:
        out.append("\n### 예상점수 — 기록된 경기가 없다")
        out.append("\n분석할 때 `예상점수` 열에 '홈:원정'(기대 득점도 좋다)을 남기면 다음 회고부터 잴 수 있다.")
        return
    out.append(f"\n### 예상점수 정합 (n={len(xs)})")
    out.append("| 종목 | 경기 | 총득점 평균오차 | 득실차 평균오차 | 승패 방향 일치 | 정확히 맞음 |")
    out.append("|---|---:|---:|---:|---:|---:|")
    g = collections.defaultdict(list)
    for sp, ph, pa, ah, aa in xs:
        g[sp].append((ph, pa, ah, aa))
    g["(전체)"] = [(ph, pa, ah, aa) for _, ph, pa, ah, aa in xs]
    for sp in sorted(g, key=lambda k: (k == "(전체)", -len(g[k]))):
        b = g[sp]
        tot = sum(abs((ph + pa) - (ah + aa)) for ph, pa, ah, aa in b) / len(b)
        mar = sum(abs((ph - pa) - (ah - aa)) for ph, pa, ah, aa in b) / len(b)
        sgn = sum(1 for ph, pa, ah, aa in b
                  if (ph > pa) == (ah > aa) or (abs(ph - pa) < 0.25 and ah == aa)) / len(b) * 100
        exact = sum(1 for ph, pa, ah, aa in b if round(ph) == ah and round(pa) == aa) / len(b) * 100
        out.append(f"| {sp} | {len(b)} | {tot:.2f} | {mar:.2f} | {sgn:.0f}% | {exact:.0f}% |")
    out.append("")
    out.append("> 정확히 맞음은 참고만 한다(원래 10% 안팎). 고칠 것은 **총득점 오차**(템포·수비를 잘못 봄)와 "
               "**득실차 오차**(전력 차를 잘못 봄)이고, 둘은 고치는 방법이 다르다. "
               "핸디캡·언더오버 다리는 이 두 숫자 위에 서 있으므로 여기가 1X2보다 직접적인 지표다.")
    b = g["(전체)"]
    mar = sum(abs((ph - pa) - (ah - aa)) for ph, pa, ah, aa in b) / len(b)
    tot = sum(abs((ph + pa) - (ah + aa)) for ph, pa, ah, aa in b) / len(b)
    if len(b) >= 30 and mar > tot:
        issues.append(f"예상점수: 득실차 오차({mar:.2f})가 총득점 오차({tot:.2f})보다 크다 — 전력 차 판정이 템포 판정보다 나쁘다(n={len(b)})")


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
    section_score(rows, out, issues)
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
