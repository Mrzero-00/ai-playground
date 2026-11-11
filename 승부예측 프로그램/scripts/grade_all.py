#!/usr/bin/env python3
"""모든 추천·예측 자동 채점 (사용자 지시 2026-10-18 — 데이터 개선 ③)
왜: 123회 추천기록 38건 중 15건만 채점됐다(핸디캡·언더오버·승N패 등은 비어 있음). 채점에 구멍이 있으면
    '내 추천 적중률' 같은 학습 지표가 틀린다.
무엇: 전체경기기록.csv 점수(홈:원정)와 스캔기록.csv 구분(H-1.0·U/O 2.5 등)으로 선택지마다 적중을 계산해
  - 추천기록.csv 의 결과·적중 빈칸을 채우고
  - data/예측스냅샷.csv 의 결과·점수를 채운다.
  축구 일반(승무패)·정수/소수 핸디캡·언더오버, 야구 승패(무승부 없음)·승N패 제외.
  전반 선택지는 data/경기후.csv 의 전반점수(postmatch.py 가 ESPN header linescores 에서 수집)로 채점한다
  — 2026-10-22 심층회고 2단계: 전반 다리 9건이 영구 미채점이라 도파민 트랙 표본이 버려지고 있었다.
사용: python3 scripts/grade_all.py [--round 123]
"""
import argparse, csv, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(ROOT, "전체경기기록.csv")
PICK = os.path.join(ROOT, "추천기록.csv")
SCAN = os.path.join(ROOT, "data", "스캔기록.csv")
SNAP = os.path.join(ROOT, "data", "예측스냅샷.csv")
POST = os.path.join(ROOT, "data", "경기후.csv")


def outcome(gub, sel, h, a):
    """선택지 적중 여부(True/False) 또는 판정 불가(None)."""
    gub = (gub or "일반").strip()
    if sel in ("1점차",):
        return None
    while gub.startswith("전반"):
        # 호출부에서 전반 점수를 h·a 로 넘긴다. 없으면 h 가 None 이라 판정 불가.
        # 스캔기록 구분이 이미 "전반 H-1" 처럼 접두어를 갖고 있어 중복 접두어를 모두 벗긴다.
        if h is None or a is None:
            return None
        gub = gub[2:].strip() or "일반"
    if gub in ("일반", "", "승N패"):
        if sel not in ("승", "무", "패"):
            return None
        o = "승" if h > a else "무" if h == a else "패"
        return sel == o
    m = re.match(r"H\s*([+-]?[\d.]+)", gub)
    if m:
        d = h + float(m.group(1)) - a
        o = "승" if d > 0 else "무" if d == 0 else "패"
        return sel == o
    m = re.search(r"U/O\s*([\d.]+)", gub)
    if m:
        t, L = h + a, float(m.group(1))
        if sel == "언더":
            return t < L
        if sel == "오버":
            return t > L
    return None


def read(p, enc="utf-8-sig"):
    raw = open(p, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    rows = list(csv.DictReader(open(p, encoding="utf-8-sig")))
    return rows, (list(rows[0].keys()) if rows else []), bom


def write(p, rows, cols, bom):
    with open(p, "w", encoding="utf-8-sig" if bom else "utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader(); w.writerows(rows)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--round")
    ap.add_argument("--verify", action="store_true", help="이미 채점된 행도 다시 계산해 불일치를 보고(고치지는 않음)")
    ap.add_argument("--combos", action="store_true", help="채점하지 않고 조합 단위 성적표만 본다")
    a = ap.parse_args()
    if a.combos:
        return combo_report()
    score = {}
    for r in csv.DictReader(open(REC, encoding="utf-8-sig")):
        if re.fullmatch(r"\d+:\d+", r.get("점수") or ""):
            h, aw = map(int, r["점수"].split(":"))
            score[(r["회차"], f"{r['홈']} vs {r['원정']}")] = (h, aw)
            score[(r["회차"], r["번호"])] = (h, aw)
    gub = {}
    for r in csv.DictReader(open(SCAN, encoding="utf-8-sig")):
        gub[(r["회차"], r["번호"])] = r["구분"]
    half = {}   # 전반 점수 (회차, 번호) / (회차, 경기)
    if os.path.exists(POST):
        for r in csv.DictReader(open(POST, encoding="utf-8-sig")):
            if re.fullmatch(r"\d+:\d+", (r.get("전반점수") or "").strip()):
                h, aw = map(int, r["전반점수"].split(":"))
                half[(r["회차"], r["번호"])] = (h, aw)
                half[(r["회차"], (r.get("경기") or "").replace(" - ", " vs "))] = (h, aw)
    # 추천기록
    rows, cols, bom = read(PICK); n = m = 0; bad = []
    for r in rows:
        if a.round and r["회차"] != str(a.round):
            continue
        already = r.get("적중") in ("0", "1")
        if already and not a.verify:
            continue
        s = score.get((r["회차"], r["경기"]))
        if not s:
            continue
        # 추천기록 '게임' 칸의 라인(`H -1.0`·`U/O 2.5`)이 추천 시점의 기준점이다.
        # 스캔기록 구분은 베트맨이 나중에 라인을 바꾸면 덮어써지므로(120/7502 H-1→H+1) 뒤로 둔다.
        g = (r["게임"].split("`")[1] if "`" in r.get("게임", "") else "") or gub.get((r["회차"], r["번호"])) or "일반"
        half_leg = "전반" in r.get("게임", "") or g.strip().startswith("전반")
        if half_leg:
            g = g if g.strip().startswith("전반") else "전반 " + g
            s = half.get((r["회차"], r["번호"])) or half.get((r["회차"], r["경기"])) or (None, None)
        ok = outcome(g, r["선택"], *s)
        if ok is None:
            if not already:
                m += 1
            continue
        if already:
            # 재계산 검증 — 채점 로직 결함(예: 전반 다리 접두어 중복)을 조용히 넘기지 않는다
            if r["적중"] != ("1" if ok else "0"):
                bad.append(f'{r["회차"]}/{r["번호"]} {r["게임"]} {r["선택"]}: 기록 {r["적중"]} ≠ 재계산 {"1" if ok else "0"}')
            continue
        r["결과"] = (f"전반 {s[0]}:{s[1]}" if half_leg else f"{s[0]}:{s[1]}"); r["적중"] = "1" if ok else "0"; n += 1
    if not a.verify:
        write(PICK, rows, cols, bom)
    print(f"추천기록: {n}건 채점 (판정 불가 {m}건 — 전반·1점차 등)")
    if a.verify:
        print(f"재계산 검증: 불일치 {len(bad)}건" + ("" if not bad else "\n  - " + "\n  - ".join(bad)))
    # 예측스냅샷
    if os.path.exists(SNAP):
        rows, cols, bom = read(SNAP); k = 0
        for r in rows:
            if r.get("점수"):
                continue
            s = score.get((r["회차"], r["번호"]))
            if s:
                r["점수"] = f"{s[0]}:{s[1]}"; r["결과"] = "승" if s[0] > s[1] else "무" if s[0] == s[1] else "패"; k += 1
        write(SNAP, rows, cols, bom)
        print(f"예측스냅샷: {k}건 결과 채움")
    if not a.verify:
        combo_report()


def combo_report():
    """조합 단위 성적 — 목표(조합 성공률·합계 1.8+)를 재는 유일한 표.
    다리 적중률만 보면 조합이 깨진 것을 못 본다. 한 다리가 여러 조합에 들어가면 조합 칸이 ' | ' 로 이어져 있다.
    2026-11-11 이전에는 뒤 조합이 앞 조합 이름을 덮어써서 다리가 빠진 조합이 있다 — 1다리로 남은 것은 '불완전'으로 뺀다."""
    import collections, math
    rows, _, _ = read(PICK)
    cb = collections.defaultdict(list)
    for r in rows:
        if r.get("구분") != "추천" or not r.get("조합"):
            continue
        for name in r["조합"].split("|"):
            cb[(r["회차"], name.strip())].append(r)
    done, pend, broken = [], 0, 0
    for (rnd, name), legs in cb.items():
        if len(legs) < 2:
            broken += 1; continue
        if any(l.get("적중") not in ("0", "1") for l in legs):
            pend += 1; continue
        try:
            tot = math.prod(float(l["배당"]) for l in legs)
        except ValueError:
            continue
        done.append((rnd, name, len(legs), tot, all(l["적중"] == "1" for l in legs),
                     sum(l["적중"] == "1" for l in legs)))
    print(f"\n== 조합 단위 (채점 완료 {len(done)} · 대기 {pend} · 다리가 빠져 못 재는 조합 {broken})")
    print(f"{'회차':<6}{'조합':<34}{'폴더':>3}{'합계배당':>8}{'다리':>6}  결과")
    for rnd, name, k, tot, ok, h in sorted(done, key=lambda x: (len(x[0]), x[0])):
        print(f"{rnd:<6}{name[:32]:<34}{k:>3}{tot:>8.2f}{h:>4}/{k}  {'적중' if ok else '낙첨'}"
              + ("" if tot >= 1.8 else "  ⚠ 합계 1.8 미만"))

    def summ(lab, sub):
        if not sub:
            return
        n = len(sub); h = sum(1 for x in sub if x[4]); ret = sum(x[3] for x in sub if x[4]) / n
        print(f"{lab:<22} {n:>3}조합  성공 {h}/{n} = {h/n*100:5.1f}% ±{200*math.sqrt(max(h/n*(1-h/n),1e-9)/n):4.1f}"
              f"  평균 합계배당 {sum(x[3] for x in sub)/n:.2f}  회수율 {ret*100:6.1f}%")
    print()
    summ("전체", done)
    summ("2폴더", [x for x in done if x[2] == 2])
    summ("3폴더 이상", [x for x in done if x[2] >= 3])
    summ("합계 1.8 이상만", [x for x in done if x[3] >= 1.8])
    legs = [r for r in rows if r.get("구분") == "추천" and r.get("적중") in ("0", "1")]
    if legs:
        h = sum(r["적중"] == "1" for r in legs)
        print(f"{'추천 다리':<22} {len(legs):>3}다리  적중 {h}/{len(legs)} = {h/len(legs)*100:5.1f}%")


if __name__ == "__main__":
    main()
