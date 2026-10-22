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
        # 1·2순위 차가 10%p 미만이면 기준선이 **방향을 형성하지 못한** 것이다 (2026-10-23 125회 회고).
        # 실측: 깊이=기준선 × 차<10%p 29건 17.2% · 차 20%p+ 57.9%. 확률의 절대값은 비단조라 못 쓰지만
        # 1·2순위 차는 단조다(전체 n=593: 0~3%p 33% / 3~6%p 33% / 6~10%p 47% / 10~20%p 50% / 20%p+ 66%).
        # 확률·방향은 그대로 남기고(표본을 버리지 않는다) 확신도만 '기권'으로 적어 집계에서 가린다.
        s = sorted((b["승"], b["무"], b["패"]), reverse=True)
        r["확신도"] = "기권" if (s[0] - s[1]) * 100 < 10 else (r.get("확신도") or "낮음")
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
    depth_compare(rows)


# 지정 리그(추천 다리를 뽑는 범위) — CLAUDE.md 2026-10-19 리그 제한
BIG_SOCCER = ("프리미어", "라리가", "세리에A", "분데스리가", "리그1", "K리그",
              "챔피언스리그", "유로파", "컨퍼런스리그")


def tier(r):
    return "지정" if any(k in r.get("리그", "") for k in BIG_SOCCER) else "비지정"


def depth_compare(rows):
    """'분석 vs 기준선' 비교에서 교란(리그 구성·회차)을 통제한다 — 2026-10-21 125회 심층회고.

    왜: `종목·깊이별` 원표는 축구 분석 58% vs 기준선 42%로 보이지만, 기준선 행은 **아무도 고르지
        않은 경기**(J1·J2·MLS·챔피언십이 109개 중 65개)에만 채워지고 분석 행은 큰 리그에 몰려 있다.
        둘은 같은 경기 집합이 아니라서 차이의 대부분이 리그 구성에서 온다. 지정 리그로 좁히면
        분석 62.9%(129/205) vs 기준선 60.6%(20/33) = +2.3%p 뿐이다(원표는 +16%p로 보였다).
        이 수치가 '분석을 계속할 이유'의 근거라서, 통제한 값을 같이 찍지 않으면 과대평가된다.
    """
    soc = [r for r in rows if r.get("종목") == "축구" and r.get("결과") in ("승", "무", "패") and r.get("순수_승")]
    cells = {}
    for r in soc:
        pk = rl.argmax(r, "순수")
        if not pk:
            continue
        d = "기준선" if r.get("깊이") == "기준선" else "분석"
        for key in ((tier(r), d), ("전체", d), (r["회차"], tier(r), d)):
            x = cells.setdefault(key, [0, 0]); x[0] += 1; x[1] += 1 if pk == r["결과"] else 0

    def line(key, label):
        v = cells.get(key)
        return f"{label} {v[1]}/{v[0]} ({v[1] / v[0] * 100:.1f}%)" if v and v[0] else f"{label} -"

    def gap(t):
        a, b = cells.get((t, "분석")), cells.get((t, "기준선"))
        if not a or not b or not a[0] or not b[0]:
            return None
        return a[1] / a[0] * 100 - b[1] / b[0] * 100

    print("\n축구 분석 vs 기준선 — 리그권 통제 (기준선은 '아무도 안 고른 경기'라 리그 구성이 다르다):")
    for t in ("전체", "지정", "비지정"):
        g = gap(t)
        print(f"  {t:<4} {line((t, '분석'), '분석'):<22} {line((t, '기준선'), '기준선'):<22}"
              f" 차 {f'{g:+.1f}%p' if g is not None else '-'}")

    # 같은 회차 안에서만 비교 (회차마다 경기 풀이 다른 교란 제거)
    rounds = sorted({k[0] for k in cells if len(k) == 3})
    tot = {t: [0, 0, 0, 0] for t in ("지정", "비지정")}   # 분석(n,hit), 기준선(n,hit)
    for rd in rounds:
        for t in ("지정", "비지정"):
            a, b = cells.get((rd, t, "분석")), cells.get((rd, t, "기준선"))
            if not a or not b:
                continue   # 그 회차에 한쪽만 있으면 비교 불가
            tot[t][0] += a[0]; tot[t][1] += a[1]; tot[t][2] += b[0]; tot[t][3] += b[1]
    print("  같은 회차에 둘 다 있는 경기만:")
    for t in ("지정", "비지정"):
        an, ah, bn, bh = tot[t]
        if not an or not bn:
            print(f"    {t:<4} 비교 가능한 회차 없음")
            continue
        print(f"    {t:<4} 분석 {ah}/{an} ({ah / an * 100:.1f}%)   기준선 {bh}/{bn} ({bh / bn * 100:.1f}%)"
              f"   차 {ah / an * 100 - bh / bn * 100:+.1f}%p")
    g_all, g_big = gap("전체"), gap("지정")
    if g_all is not None and g_big is not None and g_all - g_big > 5:
        print(f"  ⚠ 원표의 차({g_all:+.1f}%p)는 리그 구성 때문에 부풀어 있다 — 추천 범위(지정 리그)에서는 {g_big:+.1f}%p.")


if __name__ == "__main__":
    main()
