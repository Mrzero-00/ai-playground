#!/usr/bin/env python3
"""
독자 분석(순수 분석) 성장 관리 — 사용자 목표(2026-10-08): 최종적으로 시장이 아니라 '나만의 분석'으로 수익을 낸다.

원리
- 경기마다 배당을 보기 전에 낸 '순수 확률'(전체경기기록.csv 순수_*)과 시장 확률(시장_*)을 결과와 비교해,
  종목·리그·확신도 구간별로 순수 분석이 시장보다 나은지(RPS) 누적 판정한다.
- 구간별 최적 혼합 비중 w(최종 = (1-w)·시장 + w·순수)를 결과로 찾고, 표본이 적으면 0.10(백테스트 기본값) 쪽으로 줄인다:
    w_권장 = 0.10 + (w_최적 - 0.10) × n / (n + 150)      (n = 그 구간 비교 경기 수, 0.05~0.90로 제한)
  → 순수 분석이 실제로 이기는 구간만 비중이 커지고, 지는 구간은 0.05까지 내려간다.
- '흡수': 시장과 순수가 10%p 이상 갈린 경기는 결과와 함께 목록으로 남긴다. 시장이 맞았다면 시장이 알던 정보(결장·라인업·
  일정·전술 등)를 찾아 `독자분석_로드맵.md`의 변수 목록에 추가한다. 순수가 맞았다면 그 근거를 강화한다.
- 수익 판정: 순수 확률 × 베트맨 배당 ≥ 1.05 이고, 그 구간에서 순수 RPS < 시장 RPS (n ≥ 100)일 때만 '독자 분석 구매 후보'.

사용법
  python3 scripts/own_model.py report          # 구간별 성적·권장 비중·흡수 목록 → 회차별분석/독자분석_현황_YYYY-MM-DD.md, data/own_weights.json
  (round_log.py adjust 가 data/own_weights.json 의 구간 비중을 자동으로 쓴다. 파일이 없으면 0.10)
"""
import csv, datetime as dt, json, os

ROOT = os.path.join(os.path.dirname(__file__), "..")
REC = os.path.join(ROOT, "전체경기기록.csv")
WPATH = os.path.join(ROOT, "data", "own_weights.json")
BASE_W, K = 0.10, 150


def probs(r, pre):
    try:
        v = [float(r.get(f"{pre}_{k}") or 0) for k in "승무패"]
    except ValueError:
        return None
    s = sum(v)
    return [x / s for x in v] if s > 0 else None


def rps(p, res):
    o = [0, 0, 0]; o["승무패".index(res)] = 1
    return ((p[0] - o[0]) ** 2 + (p[0] + p[1] - o[0] - o[1]) ** 2) / 2


def league_group(r):
    lg = r.get("리그", "")
    for k in ("KBO", "NPB", "MLB", "KBL", "프리미어", "라리가", "J1", "J2", "K리그", "천황배", "FA컵", "슈퍼리그", "네이션스", "친선", "박신자"):
        if k in lg:
            return k
    return lg or "기타"


def segments(r):
    yield ("전체", "전체")
    yield ("종목", r.get("종목", ""))
    yield ("리그", f"{r.get('종목', '')}·{league_group(r)}")
    if r.get("확신도"):
        yield ("확신도", r["확신도"])


def evaluate(rows):
    seg = {}
    for r in rows:
        if r.get("결과") not in ("승", "무", "패"):
            continue
        pu, mk = probs(r, "순수"), probs(r, "시장")
        if not pu or not mk:
            continue
        for key in segments(r):
            seg.setdefault(key, []).append((pu, mk, r["결과"]))
    out = {}
    for key, xs in seg.items():
        n = len(xs)
        rp = sum(rps(p, y) for p, _, y in xs) / n
        rm = sum(rps(m, y) for _, m, y in xs) / n
        best = min((sum(rps([(1 - w) * a + w * b for a, b in zip(m, p)], y) for p, m, y in xs) / n, w)
                   for w in [i / 20 for i in range(21)])
        w_opt = best[1]
        w_rec = max(0.05, min(0.90, BASE_W + (w_opt - BASE_W) * n / (n + K)))
        hp = sum(int(max(range(3), key=lambda i: p[i]) == "승무패".index(y)) for p, _, y in xs)
        hm = sum(int(max(range(3), key=lambda i: m[i]) == "승무패".index(y)) for _, m, y in xs)
        out[key] = {"n": n, "순수RPS": rp, "시장RPS": rm, "혼합최적RPS": best[0], "w최적": w_opt, "w권장": round(w_rec, 3),
                    "순수적중": hp, "시장적중": hm}
    return out


def absorb_list(rows):
    lst = []
    for r in rows:
        pu, mk = probs(r, "순수"), probs(r, "시장")
        if not pu or not mk:
            continue
        gap = max(abs(a - b) for a, b in zip(pu, mk)) * 100
        if gap < 10:
            continue
        res = r.get("결과") if r.get("결과") in ("승", "무", "패") else ""
        who = ""
        if res:
            i = "승무패".index(res)
            who = "순수" if pu[i] > mk[i] else "시장"
        lst.append((r["회차"], r["시각"], r["종목"], f"{r['홈']}-{r['원정']}", "/".join(f"{x*100:.0f}" for x in pu),
                    "/".join(f"{x*100:.0f}" for x in mk), round(gap), res, who, (r.get("핵심근거") or "")[:40]))
    return lst


# ---------------------------------------------------------------- 가상 배팅 (독자 분석으로만 샀다면)
SWITCH = {"고확신_기준": 0.70, "고확신_n": 100, "고확신_적중": 0.80, "ROI": 1.0, "RPS_n": 200}


def paper_bets(rows):
    """경기마다 순수 확률 1순위를 1단위 샀다고 가정. 베트맨 배당이 있으면 회수까지 계산(없으면 적중만)."""
    out = []
    for r in rows:
        if r.get("결과") not in ("승", "무", "패"):
            continue
        pu = probs(r, "순수")
        if not pu:
            continue
        i = max(range(3), key=lambda k: pu[k])
        pick = "승무패"[i]
        try:
            odds = float(r.get(f"베트맨_{pick}") or 0)
        except ValueError:
            odds = 0
        mk = probs(r, "시장")
        mpick = "승무패"[max(range(3), key=lambda k: mk[k])] if mk else ""
        out.append({"회차": r["회차"], "종목": r.get("종목", ""), "경기": f"{r['홈']}-{r['원정']}", "픽": pick, "확률": pu[i],
                    "배당": odds, "적중": int(pick == r["결과"]), "시장픽": mpick, "시장적중": int(mpick == r["결과"]) if mpick else None})
    return out


def paper_section(rows, ev):
    pb = paper_bets(rows)
    L = ["", "## 가상 배팅 — 독자 분석 1순위를 경기마다 1단위 샀다면 (구매 여부 무관, 누적)", ""]
    if not pb:
        return L + ["아직 결과가 나온 경기가 없다."]
    L += ["| 내 확률 구간 | 픽 수 | 적중률 | 배당 있는 픽 | 회수율(ROI) | 같은 경기 시장 1순위 적중률 |", "|---|---|---|---|---|---|"]
    for lo, hi in ((0, .5), (.5, .6), (.6, .7), (.7, .8), (.8, 1.01), (0, 1.01)):
        xs = [x for x in pb if lo <= x["확률"] < hi]
        if not xs:
            continue
        od = [x for x in xs if x["배당"] > 1]
        roi = (sum(x["배당"] * x["적중"] for x in od) / len(od)) if od else None
        mk = [x for x in xs if x["시장적중"] is not None]
        name = "전체" if (lo, hi) == (0, 1.01) else f"{lo:.0%}~{min(hi, 1):.0%}"
        L.append(f"| {name} | {len(xs)} | {sum(x['적중'] for x in xs) / len(xs):.1%} | {len(od)} | "
                 f"{(f'{roi:.2f}' if roi is not None else '-')} | {(f'{sum(x["시장적중"] for x in mk) / len(mk):.1%}' if mk else '-')} |")
    hi = [x for x in pb if x["확률"] >= SWITCH["고확신_기준"]]
    hi_od = [x for x in hi if x["배당"] > 1]
    hit = sum(x["적중"] for x in hi) / len(hi) if hi else 0
    roi = sum(x["배당"] * x["적중"] for x in hi_od) / len(hi_od) if hi_od else 0
    allr = ev.get(("전체", "전체"), {})
    c1 = len(hi) >= SWITCH["고확신_n"] and hit >= SWITCH["고확신_적중"]
    c2 = len(hi_od) >= SWITCH["고확신_n"] and roi >= SWITCH["ROI"]
    c3 = allr.get("n", 0) >= SWITCH["RPS_n"] and allr.get("순수RPS", 9) < allr.get("시장RPS", 0)
    L += ["", "## 독자 분석 단독 운영 전환 조건 (사용자 기준 80% + 수익·정확도)", "",
          "| 조건 | 기준 | 현재 | 충족 |", "|---|---|---|---|",
          f"| 1. 고확신 픽(내 확률 70%+) 적중률 | {SWITCH['고확신_n']}건 이상에서 80% 이상 | {len(hi)}건, {hit:.1%} | {'O' if c1 else 'X'} |",
          f"| 2. 그 픽을 베트맨 배당으로 샀을 때 회수율 | {SWITCH['고확신_n']}건 이상에서 1.00 이상 | {len(hi_od)}건, {roi:.2f} | {'O' if c2 else 'X'} |",
          f"| 3. 같은 경기 시장보다 정확(RPS) | {SWITCH['RPS_n']}경기 이상에서 순수 < 시장 | {allr.get('n', 0)}경기, 순수 {allr.get('순수RPS', 0):.3f} vs 시장 {allr.get('시장RPS', 0):.3f} | {'O' if c3 else 'X'} |",
          "", f"**전환 판정: {'세 조건 모두 충족 — 독자 분석 단독 운영 가능' if (c1 and c2 and c3) else '아직 아님 (시장 기준 유지, 독자 분석 비중은 구간별 자동 조정)'}**"]
    return L


def cmd_report():
    rows = list(csv.DictReader(open(REC, encoding="utf-8")))
    ev = evaluate(rows)
    weights = {f"{k[0]}:{k[1]}": v["w권장"] for k, v in ev.items() if k[0] in ("전체", "종목", "리그")}
    os.makedirs(os.path.dirname(WPATH), exist_ok=True)
    json.dump({"_설명": "독자 분석 혼합 비중(최종=(1-w)시장+w순수). scripts/own_model.py report 가 갱신", "갱신": str(dt.date.today()), **weights},
              open(WPATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    L = [f"# 독자 분석 현황 ({dt.date.today()})", "",
         "순수 분석(배당 보기 전 확률) vs 시장. RPS 낮을수록 좋음. w = 최종 확률에서 순수 분석 비중. 표본 적으면 0.10 쪽으로 줄인 값이 '권장'.", "",
         "| 구간 | n | 순수 RPS | 시장 RPS | 순수가 나음? | 순수 1순위 적중 | 시장 1순위 적중 | w 최적 | **w 권장** |", "|---|---|---|---|---|---|---|---|---|"]
    order = sorted(ev.items(), key=lambda kv: (["전체", "종목", "리그", "확신도"].index(kv[0][0]), -kv[1]["n"]))
    for (typ, name), v in order:
        better = "예" if v["순수RPS"] < v["시장RPS"] else "아니오"
        L.append(f"| {typ}:{name} | {v['n']} | {v['순수RPS']:.3f} | {v['시장RPS']:.3f} | {better} | {v['순수적중']}/{v['n']} | {v['시장적중']}/{v['n']} | {v['w최적']:.2f} | **{v['w권장']:.2f}** |")
    ab = absorb_list(rows)
    L += ["", "## 흡수 목록 — 순수와 시장이 10%p 이상 갈린 경기", "",
          "결과가 나온 경기: '시장'이 맞았으면 시장이 알던 정보를 찾아 `독자분석_로드맵.md` 변수 목록에 추가, '순수'가 맞았으면 그 근거를 강화.", "",
          "| 회차 | 시각 | 종목 | 경기 | 순수 | 시장 | 차이 | 결과 | 더 가까웠던 쪽 | 순수 근거 |", "|---|---|---|---|---|---|---|---|---|---|"]
    for x in ab:
        L.append("| " + " | ".join(str(c) for c in x) + " |")
    n_s = sum(1 for x in ab if x[8] == "순수"); n_m = sum(1 for x in ab if x[8] == "시장")
    L += ["", f"갈린 경기 중 결과 확정 {n_s + n_m}경기: 순수 쪽이 가까움 {n_s}, 시장 쪽 {n_m}.", "",
          "## 독자 분석 구매 자격", "",
          "- 구간 n ≥ 100 이고 순수 RPS < 시장 RPS 인 구간에서만, 순수 확률 × 베트맨 배당 ≥ 1.05 를 '독자 분석 구매 후보'로 낸다.",
          "- 자격 구간: " + (", ".join(f"{t}:{nm}" for (t, nm), v in ev.items() if v["n"] >= 100 and v["순수RPS"] < v["시장RPS"]) or "아직 없음")]
    L += paper_section(rows, ev)
    out = os.path.join(ROOT, "회차별분석", f"독자분석_현황_{dt.date.today()}.md")
    open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L[:14]))
    print("저장:", out, "/", WPATH)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2 or sys.argv[1] != "report":
        print(__doc__); sys.exit(1)
    cmd_report()
