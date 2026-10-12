#!/usr/bin/env python3
"""블록 한눈 요약 + 심층 2차·앙상블 대상 자동 표시 (토큰 절약, 2026-10-12)

블록 분석 때 여러 번 grep·스캔 출력을 읽는 대신 이 한 번으로 경기당 한 줄을 본다.
  python3 scripts/block_brief.py <회차> "<블록>"
한 줄 = 번호 | 마감 | 리그 | 경기 | 순수 | 시장 | 최종 | 최고 선택지 | 시장흐름 | 팀노트 | 대상 표시
대상 표시 (블록분석_절차.md B-2):
  [후보]  최고 선택지 확률 60%+·배당 1.2+  → 2차 반론 + 앙상블
  [갈림]  순수·시장 최대 차 8%p+            → 2차 반론
  [박빙]  최종(없으면 시장) 1·2순위 차 3%p 미만 → 2차 반론 + 앙상블 (승무패 복수 후보)
  [흐름⚠] 시장이 순수 반대로 2%p+ 이동      → 2차 반론
  [순수없음] 아직 1차 분석 전
대상 표시가 없는 경기는 1차만 한다(정확도 손실 없이 2차 토큰 절약).
"""
import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import round_watch as rw  # noqa: E402
import market_move as mm  # noqa: E402

REC = os.path.join(ROOT, "전체경기기록.csv")
SCAN = os.path.join(ROOT, "data", "스캔기록.csv")
NOTES = os.path.join(ROOT, "팀노트")
OUT = ("승", "무", "패")


def tri(r, pre):
    try:
        return [float(r[f"{pre}_{k}"]) for k in OUT]
    except (ValueError, KeyError, TypeError):
        return None


def best_options(rnd):
    best = {}
    if os.path.exists(SCAN):
        for r in csv.DictReader(open(SCAN, encoding="utf-8")):
            if r["회차"] != str(rnd):
                continue
            try:
                p, o = float(r["공정확률"]), float(r["베트맨"])
            except ValueError:
                continue
            home = r["경기"].split(" vs ")[0]
            if o >= 1.3 and (home not in best or p > best[home][0]):
                best[home] = (p, o, f"{r['번호']}:{r['선택']} {r['구분']} {p:.0f}%@{o}")
    return best


def note_date(team):
    p = os.path.join(NOTES, f"{team}.md")
    if not os.path.exists(p):
        return "-"
    import datetime as dt
    return dt.datetime.fromtimestamp(os.path.getmtime(p)).strftime("%m/%d")


def main():
    rnd, block = int(sys.argv[1]), sys.argv[2]
    gs = rw.assign_blocks(rw.games_of(rnd)).get(block, [])
    rec = {(r["홈"], r["원정"]): r for r in csv.DictReader(open(REC, encoding="utf-8")) if r["회차"] == str(rnd)}
    best, hs = best_options(rnd), mm.history(rnd)
    n2 = ne = 0
    for g in sorted(gs, key=lambda g: g["마감"]):
        r = rec.get((g["홈"], g["원정"]), {})
        pu, mk, fi = tri(r, "순수"), tri(r, "시장"), tri(r, "보정")
        f = lambda v: "/".join(f"{x:.0f}" for x in v) if v else "-"
        flags = []
        b = best.get(g["홈"])
        if b and b[0] >= 60:
            # 농구는 조합 다리 금지 (사용자 지시 2026-10-12, 분석규칙.md) — 분석·기록만
            flags.append("농구보류" if g.get("종목") == "농구" else "후보")
        if pu and mk and max(abs(x - y) for x, y in zip(pu, mk)) >= 8:
            flags.append("갈림")
        ref = fi or mk
        if ref and len(ref) == 3 and ref[1] > 0:  # 무가 있는 3-way만 박빙 판정
            s = sorted(ref, reverse=True)
            if s[0] - s[1] < 3:
                flags.append("박빙")
        fl = "-"
        if str(g["번호"]) in hs:
            fl = " ".join(mm.move(str(g["번호"]), hs[str(g["번호"])], dict(zip(OUT, pu)) if pu else None).split("\t")[3:]).strip()
            if "⚠" in fl:
                flags.append("흐름⚠")
        if not pu:
            flags.append("순수없음")
        if any(x in flags for x in ("후보", "갈림", "박빙", "흐름⚠")):
            n2 += 1
        if any(x in flags for x in ("후보", "박빙")):
            ne += 1
        print(f"{g['번호']}\t{g['마감']:%m-%d %H:%M}\t{g['리그']}\t{g['홈']}-{g['원정']}\t순수 {f(pu)}\t시장 {f(mk)}\t최종 {f(fi)}\t"
              f"{b[2] if b else '-'}\t흐름 {fl}\t노트 {note_date(g['홈'])}/{note_date(g['원정'])}\t{' '.join('[' + x + ']' for x in flags)}")
    print(f"— {len(gs)}경기: 2차 반론 대상 {n2} · 앙상블 대상 {ne}")


if __name__ == "__main__":
    main()
