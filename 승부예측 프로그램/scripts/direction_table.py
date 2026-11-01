#!/usr/bin/env python3
"""경기별 방향 표 — 내 분석이 정한 승무패를 왼쪽에, 시장이 본 승무패를 오른쪽에.

사용자 지시 2026-11-02:
  "경기당 추천은 네 분석만을 통해 승무패를 정해 주고, 옆에는 시장에서 바라본 승무패를 적어줘.
   이런 식으로 모든 경기에 대해서 승무패를 분석하고, 회고하고 스킬을 조정해 나가."

규칙 — **방향은 왼쪽(내 분석)이 정한다.** 시장 열은 눈금일 뿐 판단에 쓰지 않는다.
추천 여부와 무관하게 **모든 경기**를 적는다(표본을 버리지 않는다).
깊이가 기준선·시장복사·미분석이면 '분석 없음'으로 표시한다 — 분석한 척하지 않는다.

    python3 scripts/direction_table.py --round 130
    python3 scripts/direction_table.py --round 승무패65
    python3 scripts/direction_table.py --round 130 --md      # 보고서용 마크다운
"""
import argparse, csv, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SIDES = ("승", "무", "패")
NO_ANALYSIS = ("기준선", "시장복사", "미분석")


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
    return v if sum(v.values()) > 0 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", required=True)
    ap.add_argument("--md", action="store_true", help="마크다운 표로")
    a = ap.parse_args()
    p = os.path.join(ROOT, "전체경기기록.csv")
    rs = [r for r in csv.DictReader(open(p, encoding="utf-8-sig")) if r["회차"] == str(a.round)]
    if not rs:
        print(f"{a.round}회 경기가 없다", file=sys.stderr); return 1
    rs.sort(key=lambda r: (r.get("시각", ""), int(r["번호"]) if str(r["번호"]).isdigit() else 0))

    rows = []
    agree = both = done = hit = 0
    for r in rs:
        dep = (r.get("깊이") or "").strip()
        mine = probs(r, "보정") or probs(r, "순수")
        mk = probs(r, "시장")
        no = dep in NO_ANALYSIS or not mine
        mtop = max(mine, key=mine.get) if mine else ""
        ktop = max(mk, key=mk.get) if mk else ""
        res = (r.get("결과") or "").strip()
        if mtop and ktop:
            both += 1; agree += (mtop == ktop)
        if mtop and res in SIDES:
            done += 1; hit += (mtop == res)
        rows.append({
            "번호": r["번호"],
            "경기": f"{r.get('홈','')} vs {r.get('원정','')}",
            "시각": (r.get("시각") or "")[:11],
            "종목": r.get("종목", ""),
            "내방향": "—" if no else mtop,
            "내확률": "" if no else f"{mine['승']:.0f}/{mine['무']:.0f}/{mine['패']:.0f}",
            "시장방향": ktop or "—",
            "시장확률": f"{mk['승']:.0f}/{mk['무']:.0f}/{mk['패']:.0f}" if mk else "",
            "일치": "—" if (no or not ktop) else ("일치" if mtop == ktop else "갈림"),
            "깊이": "분석 없음" if no else (dep or "가벼움"),
            "결과": res, "적중": "" if not (mtop and res in SIDES) else ("O" if mtop == res else "X"),
        })

    hdr = ["번호", "경기", "시각", "내 방향", "내 확률(승/무/패)", "시장 방향", "시장 확률", "시장과", "깊이", "결과", "적중"]
    keys = ["번호", "경기", "시각", "내방향", "내확률", "시장방향", "시장확률", "일치", "깊이", "결과", "적중"]
    if a.md:
        print(f"### {a.round}회 경기별 방향 — **방향은 내 분석이 정한다. 시장은 참고.**\n")
        print("| " + " | ".join(hdr) + " |")
        print("|" + "---|" * len(hdr))
        for x in rows:
            print("| " + " | ".join(str(x[k]) for k in keys) + " |")
    else:
        w = [4, 32, 11, 6, 14, 8, 12, 6, 9, 5, 4]
        print(f"{a.round}회 — 방향은 내 분석이 정한다. 시장 열은 눈금일 뿐 판단에 쓰지 않는다.\n")
        print("  " + " ".join(h[:ww].ljust(ww) for h, ww in zip(hdr, w)))
        print("  " + " ".join("-" * ww for ww in w))
        for x in rows:
            print("  " + " ".join(str(x[k])[:ww].ljust(ww) for k, ww in zip(keys, w)))
    n_an = sum(1 for x in rows if x["내방향"] != "—")
    print(f"\n경기 {len(rows)} · 분석 {n_an} · 분석 없음 {len(rows)-n_an}")
    if both:
        print(f"시장과 같은 방향 {agree}/{both} ({agree/both*100:.0f}%) · 갈림 {both-agree}건")
    if done:
        print(f"채점 {done}경기 · 내 분석 적중 {hit} ({hit/done*100:.1f}%)")
        sp = [x for x in rows if x["일치"] == "갈림" and x["적중"]]
        sa = [x for x in rows if x["일치"] == "일치" and x["적중"]]
        if sa:
            print(f"  시장과 일치한 {len(sa)}경기 적중 {sum(1 for x in sa if x['적중']=='O')/len(sa)*100:.0f}%")
        if sp:
            print(f"  시장과 갈린 {len(sp)}경기 적중 {sum(1 for x in sp if x['적중']=='O')/len(sp)*100:.0f}%"
                  "  ← 분석력이 드러나는 곳")
    return 0


if __name__ == "__main__":
    sys.exit(main())
