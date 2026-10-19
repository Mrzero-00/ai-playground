#!/usr/bin/env python3
"""기준선 자동 채움 — 분석하지 않은 경기에도 방향(승/무/패)을 남긴다 (사용자 지시 2026-10-19)
왜: 단일 경기 방향 정확도 100%가 목표인데, 결과가 나온 581경기 중 176경기(30%)는 내 확률이 없어 채점에서 빠졌다.
    추천하지 않더라도 방향을 정해 기록해야 표본이 쌓이고, 어디서 틀리는지 보인다.
무엇: 순수 확률이 비어 있는 축구 경기에 `soccer_baseline` pi-rating 기준선을 넣고 `깊이=기준선`으로 표시한다.
    - 기준선 지원 리그(25개)만. 그 외는 그대로 둔다.
    - 이미 사람·에이전트가 분석한 경기(깊이 심층/가벼움)는 건드리지 않는다.
    - **학습 분리**: 깊이=기준선 행은 `calibrate.py`(보정 계수)·`hit_model.py` 학습에서 제외한다. 채점·방향 정확도 집계에는 쓴다.
사용: python3 scripts/baseline_fill.py [--round 124] [--all] [--dry]
"""
import argparse, csv, datetime as dt, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
import round_log as rl
import soccer_baseline as sb


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--round"); ap.add_argument("--all", action="store_true"); ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    rows = rl.load()
    names = sb.load_names(); cache = {}
    now = dt.datetime.now(sb.KST)
    n = skip_lg = 0
    for r in rows:
        if r["종목"] != "축구" or r.get("순수_승") or (a.round and r["회차"] != str(a.round)):
            continue
        if not a.all and r.get("결과") not in ("승", "무", "패", "", "예정"):
            continue
        if r["리그"] not in sb.KO_LEAGUE:
            skip_lg += 1; continue
        try:
            b = sb.row_baseline(r, names, cache, now)
        except Exception:
            b = None
        if not b:
            continue
        r["순수_승"], r["순수_무"], r["순수_패"] = round(b["승"] * 100, 1), round(b["무"] * 100, 1), round(b["패"] * 100, 1)
        r["확신도"] = r.get("확신도") or "낮음"
        r["깊이"] = "기준선"
        r["핵심근거"] = (r.get("핵심근거") or "") or f"pi-rating 기준선 자동({dt.date.today()}) — 뉴스·결장 반영 없음, 방향 기록용"
        if r.get("결과") in ("승", "무", "패"):
            pk = rl.argmax(r, "순수"); r["순수적중"] = int(pk == r["결과"]) if pk else ""
        n += 1
    if not a.dry:
        rl.save(rows)
    print(f"기준선 채움 {n}경기 (기준선 미지원 리그 건너뜀 {skip_lg}){' [dry]' if a.dry else ''}")
    # 깊이별 방향 정확도
    acc = {}
    for r in rows:
        if r.get("결과") not in ("승", "무", "패") or not r.get("순수_승"):
            continue
        d = r.get("깊이") or "분석"
        pk = rl.argmax(r, "순수")
        if not pk:
            continue
        x = acc.setdefault((r["종목"], d), [0, 0]); x[0] += 1; x[1] += 1 if pk == r["결과"] else 0
    print("종목·깊이별 방향 정확도:")
    for k in sorted(acc):
        t, h = acc[k]
        print(f"  {k[0]} {k[1]}: {h}/{t} ({h / t * 100:.0f}%)")


if __name__ == "__main__":
    main()
