#!/usr/bin/env python3
"""기준선 자동 채움 — 분석하지 않은 경기에도 방향(승/무/패)을 남긴다 (사용자 지시 2026-10-19)
왜: 단일 경기 방향 정확도 100%가 목표인데, 결과가 나온 581경기 중 176경기(30%)는 내 확률이 없어 채점에서 빠졌다.
    추천하지 않더라도 방향을 정해 기록해야 표본이 쌓이고, 어디서 틀리는지 보인다.
무엇: 순수 확률이 비어 있는 경기에 기준선을 넣고 `깊이=기준선`으로 표시한다.
    - 축구: `soccer_baseline` pi-rating (지원 리그 25개).
    - 농구 NBA: `nba_baseline.auto_baseline` — teamdb 박스스코어 포제션 레이팅, **경기 전날까지의 경기만**
      (2026-10-29 128회 회고에서 추가. 그 전까지 농구는 기준선이 없어 미분석 경기가 방향 없이 버려졌다 —
       128회 채점 45경기 중 9경기, 누적 농구 23경기. 소급 66경기 실측 방향 65% = 내 심층 분석 66%·시장 71%).
    - 그 외 종목·리그는 그대로 둔다.
    - 이미 사람·에이전트가 분석한 경기(깊이 심층/가벼움)는 건드리지 않는다.
    - **학습 분리**: 깊이=기준선 행은 `calibrate.py`(보정 계수)·`hit_model.py` 학습에서 제외한다. 채점·방향 정확도 집계에는 쓴다.
사용: python3 scripts/baseline_fill.py [--round 124] [--all] [--dry]
"""
import argparse, csv, datetime as dt, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
import round_log as rl
import soccer_baseline as sb
import nba_baseline as nb
import teamdb as T

NBA_LEAGUES = {"NBA"}      # teamdb/nba 박스스코어가 있는 리그만. KBL 은 아직 원천이 없다.

# 자동 기준선 꼬리표 — --refresh 가 '내가 채운 행'을 되찾는 열쇠다.
AUTO_TAGS = ("pi-rating 기준선 자동", "NBA 포제션 레이팅 기준선 자동", "시장 사전확률 기준선 자동")


def market_prior(r):
    """시장 공정확률을 사전확률로 돌려준다. 없으면 None.

    왜 (2026-10-29, 128회 심층회고 — 실측):
        깊이=기준선 축구 행 중 시장 확률이 같이 있는 128경기에서
          pi-rating 1순위 43.8%  vs  시장 1순위 53.1%  (−9.3%p)
        불일치쌍은 **기준선만 맞음 0건 / 시장만 맞음 12건** — McNemar chi2 10.08 (p<0.01).
        즉 pi 기준선이 시장을 이긴 경기가 **한 건도 없다**. 완전 열위라 표본 흔들림이 아니다.
        1·2순위 차 10%p 미만(기권 구간) 27경기에서는 4/27(14.8%) vs 11/27(40.7%) 로 격차가 더 크다.
        이것은 2026-10-26 구조 전환('사전확률은 가장 정확한 것 = 시장에서 출발한다')이
        **분석 경기에만 적용되고 자동 채움 계층에는 적용되지 않은 채 남아 있던 구멍**이다.
    무엇을 어디에 쓰나:
        순수_*  ← pi-rating 그대로 둔다. 그건 '기법 원장'이고 지우지 않는다(2026-10-26 사용자 지시).
        보정_*  ← 시장 사전확률. 보정은 '내가 실제로 쓸 최종 확률'이고,
                  분석하지 않은 경기에서 우리가 실제로 따르는 것은 시장이다.
    """
    try:
        w, d, l = float(r.get("시장_승") or 0), float(r.get("시장_무") or 0), float(r.get("시장_패") or 0)
    except ValueError:
        return None
    t = w + d + l
    if t < 90 or t > 110:          # 비거나 깨진 값
        return None
    return {"승": round(w * 100 / t, 1), "무": round(d * 100 / t, 1), "패": round(l * 100 / t, 1)}


def apply_market_prior(r):
    """기준선 행에 시장 사전확률을 보정_* 로 적는다. 적었으면 True."""
    mk = market_prior(r)
    if not mk:
        return False
    r["보정_승"], r["보정_무"], r["보정_패"] = mk["승"], mk["무"], mk["패"]
    memo = "시장 사전확률 기준선 자동 — 분석하지 않은 경기의 최종 확률은 시장에서 출발한다(2026-10-29 실측 pi 43.8% vs 시장 53.1%, 불일치 0:12)"
    prev = (r.get("보정메모") or "").strip()
    # anchor 가 찍은 옛 메모는 '대체됨'으로 한 번만 남기고, 재실행해도 계속 길어지지 않게 한다.
    if prev and "시장 사전확률 기준선 자동" not in prev:
        memo = f"{memo} [대체: {prev}]"
    elif prev:
        memo = prev
    r["보정메모"] = memo
    if r.get("결과") in ("승", "무", "패"):
        pk = rl.argmax(r, "보정")
        r["보정적중"] = int(pk == r["결과"]) if pk else ""
    return True


def _match_date(r):
    """전체경기기록 '시각'('MM-DD HH:MM')을 'YYYY-MM-DD' 로. 연도는 회차 기록에 없어 경기일 기준 연도를 추정한다."""
    t = (r.get("시각") or "").strip()
    if len(t) >= 5 and t[2] == "-":
        today = dt.date.today()
        mm, dd = int(t[:2]), int(t[3:5])
        y = today.year
        # 12월 경기를 1월에 채울 때 연도가 한 해 밀리는 것만 막는다.
        if mm - today.month > 6:
            y -= 1
        elif today.month - mm > 6:
            y += 1
        try:
            return dt.date(y, mm, dd).strftime("%Y-%m-%d")
        except ValueError:
            return None
    return None


def fill_basketball(rows, a):
    """농구(NBA) 기준선. 축구와 같은 규칙 — 깊이=기준선, 1·2순위 차 10%p 미만은 확신도 '기권'."""
    cache = {}
    n = skip_lg = no_data = 0
    auto_tag = "포제션 레이팅 기준선 자동"
    for r in rows:
        if r["종목"] != "농구" or (a.round and r["회차"] != str(a.round)):
            continue
        # --refresh: 전에 이 스크립트가 채운 행은 다시 계산한다(계수를 고친 뒤 소급 적용용).
        if r.get("순수_승"):
            # 사람·에이전트가 분석한 행(심층·가벼움)은 --refresh 라도 절대 덮지 않는다.
            # pure 가 깊이만 올리고 핵심근거를 비워 두면 꼬리표가 남아 있을 수 있다.
            if r.get("깊이") in ("심층", "가벼움"):
                continue
            if not (getattr(a, "refresh", False) and auto_tag in (r.get("핵심근거") or "")):
                continue
            r["순수_승"] = r["순수_무"] = r["순수_패"] = ""
            r["예상점수"] = ""
            keep = [x.strip() for x in (r.get("핵심근거") or "").split(" / ") if auto_tag not in x]
            r["핵심근거"] = " / ".join(keep)
        if not a.all and r.get("결과") not in ("승", "무", "패", "", "예정"):
            continue
        if r["리그"] not in NBA_LEAGUES:
            skip_lg += 1; continue
        d = _match_date(r)
        if not d:
            no_data += 1; continue
        if d not in cache:
            cache[d] = nb.team_ratings(d)      # 경기일 '전'까지만 — 미래 누수 금지
        b = nb.auto_baseline(T.en_name(r["홈"]), T.en_name(r["원정"]), d, ratings=cache[d])
        if not b:
            no_data += 1; continue
        ph = round(b["p_home"], 1)
        r["순수_승"], r["순수_무"], r["순수_패"] = ph, 0.0, round(100 - ph, 1)
        r["확신도"] = "기권" if abs(2 * ph - 100) < 10 else (r.get("확신도") or "낮음")
        r["깊이"] = "기준선"
        r["예상점수"] = r.get("예상점수") or f"{b['pts_h']:.0f}:{b['pts_a']:.0f}"
        # 꼬리표는 '있으면 둔다'가 아니라 **항상 붙인다** — 붙어 있어야 --refresh 가 이 행을 다시 찾는다.
        # (128회 1172 는 블록 메모가 이미 있어 꼬리표가 안 붙었고, 계수를 고친 뒤 혼자 옛 값으로 남았다.)
        tag = f"NBA 포제션 레이팅 기준선 자동({dt.date.today()}, 직전 {b['games']}경기) — 뉴스·결장 반영 없음, 방향 기록용"
        prev = (r.get("핵심근거") or "").strip()
        r["핵심근거"] = tag if not prev else f"{prev} / {tag}"
        if r.get("결과") in ("승", "무", "패"):
            pk = rl.argmax(r, "순수"); r["순수적중"] = int(pk == r["결과"]) if pk else ""
        n += 1
    return n, skip_lg, no_data


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--round"); ap.add_argument("--all", action="store_true"); ap.add_argument("--dry", action="store_true")
    ap.add_argument("--refresh", action="store_true", help="이 스크립트가 전에 채운 기준선 행을 다시 계산한다")
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
    bn, bskip, bnod = fill_basketball(rows, a)
    # 기준선 행의 최종 확률(보정)은 **시장 사전확률**로 둔다 — 종목·리그·채움 시점과 무관하게 한 군데서.
    # 08시 정기 채움은 배당이 뜨기 전에 돌 때가 많아, 나중에 시장이 들어온 행을 여기서 따라잡는다.
    # 깊이=기준선 행의 보정메모는 전부 `round_log anchor` 가 기계로 찍은 것이다
    # ("순수·기준선(보정 미적용)" / "순수50+기준선50(...)"). 사람·에이전트가 쓴 글이 아니므로 덮는다.
    # (처음에는 '메모가 있으면 건너뛴다'로 뒀다가 128회 기준선 19행이 전부 걸러져 버렸다 — anchor 가
    #  항상 메모를 남기기 때문이다. 기준선 행에 사람 글이 올 일은 없다 — 사람이 손대면 깊이가 올라간다.)
    mp = 0
    for r in rows:
        if r.get("깊이") != "기준선":
            continue
        if apply_market_prior(r):
            mp += 1
    if not a.dry:
        rl.save(rows)
    print(f"기준선 채움 축구 {n}경기 (미지원 리그 건너뜀 {skip_lg})"
          f" · 농구 {bn}경기 (미지원 리그 {bskip} · 자료부족 {bnod})"
          f" · 시장 사전확률 적용 {mp}행{' [dry]' if a.dry else ''}")
    baseline_prior_compare(rows)
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
    abstain_split(rows)
    depth_compare(rows)


MARGIN_MIN = 10.0   # analysis_guard G1 과 같은 문턱


def abstain_split(rows):
    """방향이 '형성된' 경기와 '기권(G1)' 경기를 갈라서 적중률을 낸다 (2026-10-31, 129회 심층회고).

    왜: analysis_guard G1 이 1·2순위 차 10%p 미만 행에 확신도='기권'을 찍어 주는데,
        그 표시를 **쓰는 지표가 하나도 없었다**. 그래서 '방향을 고르지 않은 경기'가 방향
        적중률 분모에 그대로 들어가 있었고, 점검표 1위 항목(10회)이 계속 되풀이됐다.
        129회에만 G1 39건이 쌓였고 그중 1308(0.3%p차)·1330(1.3%p차)은 둘 다 1순위가
        아닌 쪽으로 끝났으며, 1296·1385·1381 세 적중은 전부 '운'으로 판정됐다.
    실측(2026-10-31, 깊이=기준선 제외 400경기): G1 127경기 44.9% · 형성 273경기 60.1%.
        섞으면 55.2% 다 — 분석력이 아니라 '그 회차에 호각 경기가 몇 개였나'를 재게 된다.
    G1 구간을 숨기려는 게 아니다. 따로 찍어 두고 그 줄이 올라가는지를 본다
        (추천에서 빼는 식으로 덮지 않는다 — 사용자 지시 2026-10-22)."""
    split = {}
    for r in rows:
        if r.get("결과") not in ("승", "무", "패"):
            continue
        if (r.get("깊이") or "") in ("기준선", ""):
            continue
        pre = "보정" if r.get("보정_승") else "순수"
        t = {k: float(r[f"{pre}_{k}"]) for k in ("승", "무", "패")
             if (r.get(f"{pre}_{k}") or "").strip()}
        if len(t) < 2:
            continue
        v = sorted(t.values(), reverse=True)
        key = "기권(G1, 차<10%p)" if v[0] - v[1] < MARGIN_MIN else "방향형성(차>=10%p)"
        x = split.setdefault(key, [0, 0]); x[0] += 1; x[1] += 1 if max(t, key=t.get) == r["결과"] else 0
    if not split:
        return
    print("\n분석 행 — 방향 형성 여부별 (analysis_guard G1 문턱 10%p, 기준선 행 제외):")
    tot = [0, 0]
    for k in sorted(split):
        t, h = split[k]
        print(f"  {k:22s} {h}/{t} ({h / t * 100:.1f}%)")
        tot[0] += t; tot[1] += h
    print(f"  {'섞어서 세면':22s} {tot[1]}/{tot[0]} ({tot[1] / tot[0] * 100:.1f}%)")
    print("  → 보고의 '분석한 전 경기 1순위 적중률'은 **방향형성 줄**로 말한다."
          " 기권 줄은 고칠 대상으로 따로 둔다(숨기지 않는다).")


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


def baseline_prior_compare(rows):
    """기준선 행에서 pi-rating 과 시장 사전확률 중 어느 쪽이 방향을 더 맞혔나 — 바꾼 뒤 효과를 매번 다시 잰다.

    되돌리는 조건: 시장이 pi 보다 낫지 않게 되면(불일치쌍에서 pi 쪽이 더 많아지면) 이 계층을 pi 로 되돌린다.
    """
    pi_h = mk_h = n = pi_only = mk_only = 0
    for r in rows:
        if r.get("깊이") != "기준선" or r.get("결과") not in ("승", "무", "패"):
            continue
        pk, mk = rl.argmax(r, "순수"), rl.argmax(r, "보정")
        if not pk or not mk:
            continue
        n += 1
        a_ok, b_ok = pk == r["결과"], mk == r["결과"]
        pi_h += a_ok; mk_h += b_ok
        pi_only += a_ok and not b_ok
        mk_only += b_ok and not a_ok
    if not n:
        return
    print(f"\n기준선 계층 — pi-rating vs 시장 사전확률 (채점 {n}경기):")
    print(f"  pi-rating  {pi_h}/{n} ({pi_h / n * 100:.1f}%)")
    print(f"  시장 사전확률 {mk_h}/{n} ({mk_h / n * 100:.1f}%)   차 {(mk_h - pi_h) / n * 100:+.1f}%p")
    print(f"  불일치쌍: pi 만 맞음 {pi_only} / 시장만 맞음 {mk_only}", end="")
    d = pi_only + mk_only
    if d:
        print(f"  (McNemar chi2 {((abs(pi_only - mk_only) - 1) ** 2) / d:.2f}, 3.84=p .05)")
    else:
        print()
    if pi_only > mk_only:
        print("  ⚠ pi 가 앞선다 — 2026-10-29 변경을 되돌릴 것(보정 채움 중단).")


if __name__ == "__main__":
    main()
