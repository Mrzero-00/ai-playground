#!/usr/bin/env python3
"""분석이 끝난 뒤 '내가 쓴 숫자'를 실측 규칙으로 검문한다 — 점검표 되풀이 항목의 코드화.

왜: 점검표(`분석전_점검표.md`)는 분석가가 읽는 글이라 지키는지 아무도 재지 않았다.
    125회 회고에서 같은 항목이 10회·5회·2회씩 되풀이된 것이 확인돼(result_log.py report),
    횟수 2+ 항목을 **숫자로 검문하는 코드**로 옮긴다(사용자 지시 2026-10-22: 되풀이 항목은 규칙이나
    스크립트로 고정한다 / 문서만 쌓고 코드를 안 고치면 같은 실수가 반복된다).

검문 항목 — 전부 전체경기기록 채점분 전수 측정에서 나온 것이다.

  G1 방향 미형성(margin)  1·2순위 차 < 10%p
      실측(n=593, 순수 1순위): 차 0~3%p 33.3% · 3~6%p 32.7% · 6~10%p 47.2% · 10~20%p 50.0% · 20%p+ 65.5%
      **확률의 절대값은 비단조라 못 쓰지만 1·2순위 차는 단조다.** 이쪽이 진짜 확신 지표다.
      깊이=기준선 × 차<10%p 는 29건 17.2% — 사실상 동전 던지기도 아니다.
      조치: 확신도를 '기권'으로 적는다. 확률·방향 기록은 그대로 남긴다(표본을 버리지 않는다).
      ※ 추천(pick_table.leg_type)에는 적용하지 않는다 — 코어 통과 다리 중 차 3~8%p 6다리가 83.3%라
        같은 문턱이 아니다. 이건 1X2 '방향 기록'의 확신 표시다.

  G2 농구 시즌초 과신      종목=농구 & |내−시장| >= 5%p
      실측: 농구 1X2 다리에서 내 42.3% vs 시장 53.8%(n=26, 124~125회). 해부 5회 되풀이.
      조치: 시장 확률을 기준선으로 쓴다(자체 마진 기준선 금지).

  G3 소표본 리그 과소평가   내 1순위 ≠ 시장 1순위 & 내−시장 >= +15%p
      실측(축구): 갈림 +15%p↑ 15건 내 26.7% vs 시장 60.0%. 갈림 전체 95건 내 29.5% vs 시장 44.2%.
      조치: **시장 숫자를 베끼지 않는다**(사용자 지시). 대신 갈린 근거가 '확인된 사실'(공식 결장·
      발표 라인업·팩트시트 사실)인지 되묻고, 아니면 기준선·시장 합의 쪽으로 되돌린다.

  G4 시장 대조 없는 극단    시장 확률 없음 & 내 1순위 >= 70%
      실측: 125회 9702 스포르팅-LASK(내 78.3 → 2:3 패) · 9857 유벤투스-렌(내 65.3 → 2:2). 해부 2회.
      조치: 깊이=기준선으로 적고 결장·폼 가산으로 기준선을 더 벌리지 않는다.

  G5 '의심' 결장으로 만든 갈림  뉴스위험에 '의심'/'추정' & 내−시장 >= +8%p
      실측(lineup_grade): '확정' 451건 91% 적중 · '의심' 168건 55% · '추정' 17건 53%.
      조치: 의심·추정 결장은 확률 보정에 쓰지 않는다(방향을 바꾸는 근거로는 더더욱).

  G6 깊이 미표기            순수 확률은 있는데 깊이 칸이 비었다
      왜: 깊이는 **학습 분리 스위치**다. 깊이=기준선 행은 calibrate(보정 계수)·hit_model 학습에서
      빠지고 보정 계수 적용도 받지 않는다. 칸이 비면 모델 자동 채움이 분석 행으로 둔갑해
      조용히 학습에 섞인다 — 125회 UECL·UEL 18경기가 그렇게 섞였고(10/22 23:00 블록),
      그 탓에 보정이 순수 61.8 → 75.3 처럼 부풀어 시장 57.8 대비 +17.5%p 과신이 됐다.
      조치(--fix): 뉴스위험·핵심근거에 '기준선' 표식이 있으면 깊이=기준선, 아니면 사람이 정한다.

사용법
    python3 scripts/analysis_guard.py --round 125          # 검문만
    python3 scripts/analysis_guard.py --round 125 --fix    # G1 확신도·G4 깊이를 자동 교정
    python3 scripts/analysis_guard.py --measure            # 위 숫자를 현재 데이터로 재측정
"""
import argparse, collections, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import round_log as rl

SIDES = ("승", "무", "패")
MARGIN_MIN = 10.0     # G1
HOOP_GAP = 5.0        # G2
SMALL_GAP = 15.0      # G3
NOMKT_P = 70.0        # G4
SUSP_GAP = 8.0        # G5


def tri(r, pre):
    v = {}
    for k in SIDES:
        x = r.get(f"{pre}_{k}")
        if x in (None, ""):
            return None
        try:
            v[k] = float(x)
        except ValueError:
            return None
    return v if sum(v.values()) > 0 else None


def margin(v):
    s = sorted(v.values(), reverse=True)
    return s[0] - s[1]


def check(r):
    """한 행의 위반 목록 → [(코드, 설명, 자동교정 가능)]"""
    out = []
    p = tri(r, "순수")
    if not p:
        return out
    pt = max(p, key=p.get)
    mar = margin(p)
    m = tri(r, "시장")
    mt = max(m, key=m.get) if m else None
    gap = p[pt] - m[pt] if m else None

    if mar < MARGIN_MIN:
        out.append(("G1", f"방향 미형성 — 1·2순위 차 {mar:.1f}%p < {MARGIN_MIN:.0f} (실측 이 구간 33~47%)", True))
    if r.get("종목") == "농구" and gap is not None and abs(gap) >= HOOP_GAP:
        out.append(("G2", f"농구 시즌초 과신 — 내 {p[pt]:.1f} vs 시장 {m[pt]:.1f} ({gap:+.1f}%p)·시장을 기준선으로", False))
    if mt and pt != mt and gap is not None and gap >= SMALL_GAP:
        out.append(("G3", f"소표본 과소평가 의심 — 내 {pt} {p[pt]:.1f} vs 시장 {mt} {m[mt]:.1f} (갈림 +{gap:.1f}%p, 실측 27%)", False))
    if not m and p[pt] >= NOMKT_P:
        out.append(("G4", f"시장 대조 없는 극단 — 시장 확률 없음인데 내 {pt} {p[pt]:.1f}%", True))
    nw = (r.get("뉴스위험") or "")
    if gap is not None and gap >= SUSP_GAP and ("의심" in nw or "추정" in nw):
        out.append(("G5", f"'의심/추정' 결장으로 만든 과신 (+{gap:.1f}%p) — 의심 55%·추정 53% 적중", False))
    if not (r.get("깊이") or "").strip() and _depth_era(r):
        auto = _looks_baseline(r)
        tail = " (기준선 표식 있음 → 자동 교정)" if auto else " (심층/가벼움/기준선 중 하나를 적어야 한다)"
        out.append(("G6", f"깊이 미표기 — 학습 분리 스위치가 비었다{tail}", auto))
    return out


DEPTH_SINCE = 124      # 깊이 칸은 2026-10-19(124회)부터 쓴다 — 그 전 행의 빈칸은 교정 대상이 아니다


def _depth_era(r):
    try:
        return int(str(r.get("회차") or "").strip()) >= DEPTH_SINCE
    except ValueError:
        return False      # 승무패NN 등 비숫자 회차는 제외


def _looks_baseline(r):
    """모델 자동 채움(기준선)인지 글자로 판별 — baseline_fill·euro_baseline·soccer_baseline 이 남기는 표식."""
    blob = " ".join(str(r.get(k) or "") for k in ("뉴스위험", "핵심근거", "비고", "보정메모"))
    return ("기준선 전용" in blob) or ("기준선만" in blob) or ("기준선 자동" in blob) or ("깊이=기준선" in blob)


def cmd_round(a):
    rows = rl.load()
    tgt = [r for r in rows if not a.round or r["회차"] == str(a.round)]
    hits = collections.Counter()
    fixed = 0
    print(f"# 분석 검문 — {a.round or '전체'} ({len(tgt)}경기)\n")
    for r in tgt:
        vs = check(r)
        if not vs:
            continue
        print(f"[{r['회차']} {r['번호']}] {r['홈']} vs {r['원정']} ({r['리그']})")
        for code, msg, auto in vs:
            hits[code] += 1
            print(f"   {code} {msg}")
            if a.fix and auto:
                if code == "G1" and r.get("확신도") != "기권":
                    r["확신도"] = "기권"; fixed += 1
                    print("      → 확신도=기권 으로 교정")
                if code in ("G4", "G6") and r.get("깊이") != "기준선":
                    r["깊이"] = "기준선"; fixed += 1
                    print("      → 깊이=기준선 으로 교정")
    if a.fix and fixed:
        rl.save(rows)
    print()
    if not hits:
        print("위반 없음")
    for k in sorted(hits):
        print(f"  {k} {hits[k]}건")
    if a.fix:
        print(f"\n자동 교정 {fixed}건")


def cmd_measure(_a):
    """규칙이 선 근거를 현재 데이터로 다시 잰다 — 숫자가 무너지면 규칙을 내린다."""
    rows = [r for r in rl.load() if (r.get("결과") or "").strip() in SIDES]
    print(f"# 검문 규칙 재측정 — 채점 {len(rows)}경기\n")

    b = collections.defaultdict(lambda: [0, 0])
    for r in rows:
        p = tri(r, "순수")
        if not p:
            continue
        mar = margin(p); pt = max(p, key=p.get)
        lab = "0~3" if mar < 3 else "3~6" if mar < 6 else "6~10" if mar < 10 else "10~20" if mar < 20 else "20+"
        x = b[lab]; x[0] += 1; x[1] += (pt == r["결과"])
    print("## G1 — 1·2순위 차별 방향 적중 (단조여야 규칙이 선다)")
    for k in ["0~3", "3~6", "6~10", "10~20", "20+"]:
        v = b[k]
        if v[0]:
            print(f"  차 {k:6s} n={v[0]:4d}  적중 {100*v[1]/v[0]:5.1f}%")

    print("\n## G2 — 농구: 내 1순위 vs 시장 1순위")
    n = ph = mh = 0
    for r in rows:
        if r.get("종목") != "농구":
            continue
        p, m = tri(r, "순수"), tri(r, "시장")
        if not p or not m:
            continue
        n += 1
        ph += (max(p, key=p.get) == r["결과"]); mh += (max(m, key=m.get) == r["결과"])
    if n:
        print(f"  n={n}  내 {100*ph/n:.1f}%  시장 {100*mh/n:.1f}%")

    print("\n## G3 — 내 1순위 ≠ 시장 1순위(갈림)")
    g = collections.defaultdict(lambda: [0, 0, 0])
    for r in rows:
        p, m = tri(r, "순수"), tri(r, "시장")
        if not p or not m:
            continue
        pt, mt = max(p, key=p.get), max(m, key=m.get)
        if pt == mt:
            continue
        gap = p[pt] - m[pt]
        lab = "+15↑" if gap >= 15 else "+8~15" if gap >= 8 else "+2~8" if gap >= 2 else "<+2"
        x = g[lab]; x[0] += 1; x[1] += (pt == r["결과"]); x[2] += (mt == r["결과"])
    for k in ["+15↑", "+8~15", "+2~8", "<+2"]:
        v = g[k]
        if v[0]:
            print(f"  갈림 {k:6s} n={v[0]:4d}  내 {100*v[1]/v[0]:5.1f}%  시장 {100*v[2]/v[0]:5.1f}%")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round")
    ap.add_argument("--fix", action="store_true")
    ap.add_argument("--measure", action="store_true")
    a = ap.parse_args()
    (cmd_measure if a.measure else cmd_round)(a)


if __name__ == "__main__":
    main()
