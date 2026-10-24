#!/usr/bin/env python3
"""
회차 전체 경기 기록·회고 (2026-10-07, 사용자 지시: 구매 여부와 상관없이 회차의 모든 경기를 분석·기록하고 회고한다)

파일: 전체경기기록.csv (git에 올린다 — 다른 PC에서 이어 쓰기)
  한 행 = 한 경기(일반 승무패/승패 기준). 순수 분석 확률(배당 미참조) · 시장 확률(Pinnacle 마진 제거) · 결과를 나란히 남겨
  회차가 끝나면 '순수 분석이 맞았나 / 시장이 맞았나 / 어느 종목·리그·변수에서 누가 나았나'를 본다.

사용법
  python3 scripts/round_log.py init 119              # 베트맨 119회 대진을 행으로 등록 (이미 있는 경기는 건너뜀)
  python3 scripts/round_log.py pure 119 <파일.csv>   # 순수 분석 결과 일괄 입력 (열: 홈,원정,순수_승,순수_무,순수_패,확신도,핵심근거,뉴스위험,제외)
  python3 scripts/round_log.py market 119            # 판매 중이면 Pinnacle 공정확률·베트맨 배당을 채움 (킥오프 가까울수록 다시 돌린다)
  python3 scripts/round_log.py market-from-scanlog 118  # 판매가 끝난 회차에 스캔기록(킥오프 직전 일반 시장)으로 시장 확률 보충
  python3 scripts/round_log.py anchor 119   # 최종(보정) 확률 = 축구 순수50+기준선50 → 보정 계수(calibrate.py). pure 뒤 자동 실행. 시장 미사용 (2026-10-15)
  python3 scripts/round_log.py adjust 119 [--news ...]  # (구) 시장90+순수10 혼합 — 추천에는 쓰지 않음, 회고 비교용
  python3 scripts/round_log.py results 119           # 베트맨 공식 결과로 결과·점수·적중 채점
  python3 scripts/round_log.py review 119            # 전체 회고 보고서 → 회차별분석/YYYY-MM-DD_프로토119_전체회고.md

판정
- 순수적중/시장적중 = 각자 가장 높은 확률을 준 결과가 실제와 같으면 1.
- RPS(낮을수록 좋음)로 순수 분석 vs 시장을 같은 경기 집합에서 비교한다. 순수 분석이 시장을 이기는 영역(종목·리그·확신도)을 찾는 게 목적.
"""
import argparse, csv, datetime as dt, io, json, math, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(__file__))
import odds_scan as o  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
PATH = os.path.join(ROOT, "전체경기기록.csv")
COLS = ["회차", "번호", "시각", "종목", "리그", "홈", "원정",
        "순수_승", "순수_무", "순수_패", "확신도", "핵심근거", "뉴스위험", "제외", "변수",
        "시장_승", "시장_무", "시장_패", "베트맨_승", "베트맨_무", "베트맨_패", "시장시각",
        "보정_승", "보정_무", "보정_패", "보정메모",
        "추천", "구매", "결과", "점수", "순수적중", "시장적중", "보정적중", "비고",
        "적중예상도", "정합성", "깊이", "예상점수", "심판", "날씨", "홈휴식", "원정휴식"]   # 깊이 = 심층 / 가벼움 / 기준선(모델 자동, 분석 없음) — 2026-10-19  # 정합성 = integrity.py 등급 A/B/C (2026-10-16 사용자 지시, C는 학습 제외)
        # 아래 주석은 적중예상도 설명:  # 2026-10-15: hit_model.py — 순수 1순위가 맞을 확률(로지스틱). 추천 문턱 60%
SPORT = {"SC": "축구", "BS": "야구", "BK": "농구", "VL": "배구", "IH": "하키"}
KST = o.KST


def load():
    if not os.path.exists(PATH):
        return []
    return list(csv.DictReader(open(PATH, encoding="utf-8-sig")))


def save(rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=COLS, lineterminator="\n")
    w.writeheader()
    for r in rows:
        w.writerow({c: r.get(c, "") for c in COLS})
    open(PATH, "w", encoding="utf-8").write(buf.getvalue())


def fetch_round(rnd, year=None):
    """베트맨 회차 전체 행 (판매 전·후 모두 조회 가능)."""
    year = year or dt.datetime.now(KST).year
    cookie = os.path.join(ROOT, "data", ".betman_cookie")
    url = "https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId=G101"
    subprocess.run(["curl", "-sS", "-m", "30", "-A", o.UA, "-c", cookie, "-o", "/dev/null", url])
    hdr = ["Content-Type: application/json; charset=UTF-8", "Accept: application/json",
           "X-Requested-With: XMLHttpRequest", "Origin: https://www.betman.co.kr", f"Referer: {url}"]
    sbm = {"_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}
    gm_ts = int(f"{str(year)[2:]}{int(rnd):04d}")
    d = o.curl("https://www.betman.co.kr/buyPsblGame/gameInfoInq.do", hdr,
               json.dumps({"gmId": "G101", "gmTs": gm_ts, "gameYear": year, **sbm}), cookie)
    cs = d.get("compSchedules") or {"keys": [], "datas": []}
    return [dict(zip(cs["keys"], r)) for r in cs["datas"]]


def main_markets(raw):
    """경기당 대표 시장 1개: 축구 승무패 / 그 외 일반 승패 (핸디캡·전반 제외)."""
    out = {}
    for g in raw:
        bt, bn = g.get("betTypNm") or "", g.get("betNm") or ""
        if g.get("itemCode") not in SPORT or g.get("homeName") == "미정":
            continue
        if bt not in ("승무패", "일반 승패", "승패") or "전반" in bn or "후반" in bn:
            continue
        if g.get("winHandi") or g.get("loseHandi"):
            continue
        key = (g["gameDate"], g["homeName"], g["awayName"])
        if key in out and out[key].get("betTypNm") == "승무패":
            continue
        out[key] = g
    return sorted(out.values(), key=lambda g: g["gameDate"])


def cmd_init(a):
    rows = load()
    have = {(r["회차"], r["홈"], r["원정"], r["시각"]) for r in rows}
    n = 0
    for g in main_markets(fetch_round(a.round)):
        t = dt.datetime.fromtimestamp(g["gameDate"] / 1000, KST).strftime("%m-%d %H:%M")
        k = (str(a.round), g["homeName"], g["awayName"], t)
        if k in have:
            continue
        rows.append({"회차": str(a.round), "번호": g["matchSeq"], "시각": t, "종목": SPORT[g["itemCode"]],
                     "리그": g["leagueName"], "홈": g["homeName"], "원정": g["awayName"]})
        n += 1
    save(rows)
    print(f"{a.round}회: {n}경기 추가 (총 {sum(1 for r in rows if r['회차'] == str(a.round))}경기)")


# 입력 CSV 칸 검증 (2026-10-24 126회 회고에서 신설)
# 왜: 17:40 블록 입력에서 뉴스위험을 작은따옴표로 감싸(쉼표 포함) CSV 가 칸을 쪼갰고,
#     '변수' 텍스트가 그대로 '깊이' 칸에 들어갔는데 pure 는 아무 말 없이 저장했다.
#     깊이가 망가지면 그 행이 학습·대조군 집계에서 통째로 잘못 분류된다 — 조용히 틀리는 게 가장 나쁘다.
_DEPTH_OK = ("심층", "가벼움", "기준선")
_SCORE_RE = re.compile(r"^\s*\d+(\.\d+)?\s*[:：]\s*\d+(\.\d+)?")


def _bad_value(col, v):
    """칸 값이 그 칸의 형식이 아니면 사유 문자열, 괜찮으면 None."""
    v = (v or "").strip()
    if col == "깊이" and v not in _DEPTH_OK:
        return f"깊이는 {'/'.join(_DEPTH_OK)} 중 하나여야 한다 (받은 값: {v[:40]!r})"
    if col == "예상점수" and not _SCORE_RE.match(v):
        return f"예상점수는 '홈:원정' 형식이어야 한다 (받은 값: {v[:40]!r})"
    if col in ("순수_승", "순수_무", "순수_패"):
        try:
            float(v)
        except ValueError:
            return f"{col} 는 숫자여야 한다 (받은 값: {v[:40]!r})"
    return None


def cmd_pure(a):
    rows = load()
    src = list(csv.DictReader(open(a.file, encoding="utf-8-sig")))
    n = 0
    warn = []
    for s in src:
        for r in rows:
            if r["회차"] == str(a.round) and r["홈"] == s["홈"] and r["원정"] == s["원정"]:
                # 깊이·예상점수 추가 2026-10-24: pure 가 이 둘을 안 채워 baseline_fill 의 '기준선' 표기가 남고
                # 심층 분석 행이 통째로 학습에서 빠지는 사고가 있었다(126회 15:00 블록, 4경기 수동 교정)
                for c in ("순수_승", "순수_무", "순수_패", "확신도", "핵심근거", "뉴스위험", "제외", "변수", "깊이", "예상점수"):  # 변수 = 태그 "선발우위:+2; 불펜연투:-1" (+는 홈 유리, 종목별분석/변수태그.md)
                    if s.get(c, "") == "":
                        continue
                    bad = _bad_value(c, s[c])
                    if bad:
                        warn.append(f"  [{r['번호']}] {r['홈']}-{r['원정']} '{c}' 칸 값이 이상하다 → 쓰지 않음: {bad}")
                        continue
                    r[c] = s[c]
                n += 1
    save(rows)
    print(f"순수 분석 {n}행 반영")
    if warn:
        print("⚠ 입력 CSV 칸 오류 — 해당 칸은 저장하지 않았다(쉼표가 든 칸은 큰따옴표로 감싼다):")
        print("\n".join(warn))
    if n and not getattr(a, "no_anchor", False):
        a.quiet = True
        cmd_anchor(a)   # 순수가 들어오면 바로 최종(보정) 확률까지 (2026-10-15)


def cmd_market(a):
    rows = load()
    raw = fetch_round(a.round)
    mk = {(g["homeName"], g["awayName"]): g for g in main_markets(raw)}
    games = []
    for (h, w), g in mk.items():
        if not g.get("winAllot"):
            continue
        three = (g.get("betTypNm") == "승무패")
        games.append({"종목": g["itemCode"], "시각": dt.datetime.fromtimestamp(g["gameDate"] / 1000, dt.timezone.utc),
                      "홈": h, "원정": w, "유형": g.get("betTypNm"), "three": three, "번호": str(g.get("matchSeq") or ""),
                      "배당": [g["winAllot"], g["drawAllot"] if three else None, g["loseAllot"]]})
    pins = {c: o.pinnacle(s) for c, s in o.SPORTS.items() if any(x["종목"] == c for x in games)}
    names = o.load_names()
    now = dt.datetime.now(KST).strftime("%m-%d %H:%M")
    n = 0
    for g, p, how, _ in o.match(games, pins, names):
        for r in rows:
            if r["회차"] != str(a.round) or r["홈"] != g["홈"] or r["원정"] != g["원정"]:
                continue
            if r.get("결과") or (r.get("번호") and g.get("번호") and str(r["번호"]) != g["번호"]):
                continue  # 끝난 경기·다른 번호(같은 대진이 회차에 두 번: MLB G3/G4)는 덮어쓰지 않는다 — 2026-10-08
            r["베트맨_승"], r["베트맨_무"], r["베트맨_패"] = g["배당"][0], g["배당"][1] or "", g["배당"][2]
            if p:
                f = o.fair(p["배당"], g["three"])
                if f:
                    pr = f[0]
                    r["시장_승"] = round(pr["home"] * 100, 1)
                    r["시장_무"] = round(pr.get("draw", 0) * 100, 1) if g["three"] else 0
                    r["시장_패"] = round(pr["away"] * 100, 1)
                    r["시장시각"] = now
                    n += 1
    save(rows)
    print(f"{a.round}회: 시장 확률 {n}경기 갱신 ({now})")


def cmd_market_from_scanlog(a):
    """판매가 끝난 회차: data/스캔기록.csv(일반 시장, 킥오프 직전 스캔)에서 시장 확률·베트맨 배당을 채운다.
    판매 중에 market을 못 돌렸을 때 보충용 (2026-10-07).
    --force: 이미 값이 있어도 **더 늦은 스캔**이면 덮어쓴다 (2026-10-22 추가).
      이유: 블록 분석은 마감 70분 전에 도는데 기존 동작은 '빈 칸만' 채워서 전날 스캔값이 그대로 남았다.
      125회 9750(브루클린-샬럿)은 전날 16:28 홈 53.1%/1.52 → 당일 08:00 46.9%/1.85 로 뒤집혔는데
      갈림/과신 판정이 옛 숫자로 이뤄질 뻔했다."""
    rows = load()
    path = os.path.join(ROOT, "data", "스캔기록.csv")
    if not os.path.exists(path):
        print("스캔기록.csv 없음"); return
    scan = [x for x in csv.DictReader(open(path, encoding="utf-8-sig")) if x["회차"] == str(a.round) and x["구분"] == "일반"]
    by = {}
    for x in scan:
        by.setdefault(x["경기"], {})[x["선택"]] = x
    n = 0
    for r in rows:
        if r["회차"] != str(a.round):
            continue
        if r.get("시장_승") and not getattr(a, "force", False):
            continue
        g = by.get(f"{r['홈']} vs {r['원정']}")
        if not g or "승" not in g or "패" not in g:
            continue
        if r.get("시장_승") and r.get("시장시각", "").split(" (")[0] >= g["승"]["scan_time"]:
            continue   # 기존 값이 더 최신이면 두고 간다
        r["시장_승"], r["시장_패"] = g["승"]["공정확률"], g["패"]["공정확률"]
        r["시장_무"] = g["무"]["공정확률"] if "무" in g else 0
        r["베트맨_승"], r["베트맨_패"] = g["승"]["베트맨"], g["패"]["베트맨"]
        r["베트맨_무"] = g["무"]["베트맨"] if "무" in g else ""
        r["시장시각"] = g["승"]["scan_time"] + " (스캔기록)"
        n += 1
    save(rows)
    print(f"{a.round}회: 스캔기록에서 시장 확률 {n}경기 보충")


def own_weight(r):
    """독자 분석 비중: data/own_weights.json (scripts/own_model.py report)의 리그 → 종목 → 전체 순으로, 없으면 0.10."""
    path = os.path.join(ROOT, "data", "own_weights.json")
    try:
        w = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        return 0.10
    import own_model
    for key in (f"리그:{r.get('종목', '')}·{own_model.league_group(r)}", f"종목:{r.get('종목', '')}", "전체:전체"):
        if key in w:
            return float(w[key])
    return 0.10


def cmd_anchor(a):
    """최종 확률(보정_*) = 내 분석만으로 만든 숫자 (2026-10-15, calibrate.py·soccer_baseline.py).
    축구: 순수 50 + pi-rating 기준선 50 → 보정 계수(온도·홈·무 편향) 적용.  기준선 없으면 순수만 보정.
    그 외 종목: 순수에 보정 계수(채택된 종목만, 아니면 그대로).
    근거(114경기 역검증): 순수 RPS 0.208 / 기준선 0.204 / 순수 보정 0.193 / 혼합 후 보정 0.192 / 시장 0.194.
    시장 확률은 쓰지 않는다(사용자 지시 2026-10-13). 옛 adjust(시장90+순수10)는 대체됨."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import calibrate
    rows = load()
    params = calibrate.load_params()
    cache, names, sb = {}, None, None
    n = nb = 0
    for r in rows:
        if r["회차"] != str(a.round):
            continue
        pu = probs(r, "순수")
        if not pu:
            if r.get("보정메모", "").startswith("순수 없음"):   # 옛 adjust 가 시장을 넣어 둔 행 — 최종에 시장 금지
                r["보정_승"] = r["보정_무"] = r["보정_패"] = r["보정메모"] = r["보정적중"] = ""
            continue
        memo = "순수"
        if r["종목"] == "축구":
            if sb is None:
                import soccer_baseline as sb
                names = sb.load_names()
            try:
                b = sb.row_baseline(r, names, cache)
            except Exception:
                b = None
            if b:
                pu = [0.5 * x + 0.5 * y for x, y in zip(pu, (b["승"], b["무"], b["패"]))]
                memo = f"순수50+기준선50({b['승']*100:.0f}/{b['무']*100:.0f}/{b['패']*100:.0f})"
                nb += 1
        # 2026-10-23 125회 회고 — 깊이=기준선 행에는 보정 계수를 적용하지 않는다.
        # 왜: 보정은 `calibrate.py` 가 **분석 행으로만** 학습한다(기준선 행은 fit 에서 제외).
        #     그런데 적용은 전 행에 하고 있었다. 기준선 행은 뉴스·결장이 안 들어간 평평한 모델
        #     출력이라 T=1.27 로 날을 세우면 없는 확신이 생긴다.
        # 실측(축구 기준선 135경기, 50/50 혼합 후):
        #     보정 미적용  1순위 46.7% · RPS 0.2057 · 말한평균 50.7%
        #     보정 적용    1순위 48.1% · RPS 0.2118 · 말한평균 57.0%   ← RPS +0.0061 악화, 과신 +8.9%p
        #     방향별로도 기준선은 이미 정합이다(승 말 42.0/실제 39.3, z=-0.7) — 홈 편향 b_h=+0.193 을
        #     더할 이유가 없다. 1순위 -1.4%p 는 n=135 잡음이고, 기준선 행은 추천 다리가 아니라 돈과 무관하다.
        # 분석 행에서는 보정이 계속 이득이다(1순위 54.6→56.3% · RPS 0.2094→0.2052, n=465) — 그대로 둔다.
        is_base = r.get("깊이") == "기준선"
        g = params.get(r["종목"], {})
        if is_base:
            f = list(pu)
            memo += "·기준선(보정 미적용)"
        else:
            f = calibrate.apply(pu, r["종목"], params)
            if g.get("adopted"):
                memo += f"→보정T{g['T']:.2f}"
        r["보정_승"], r["보정_무"], r["보정_패"] = round(f[0] * 100, 1), round(f[1] * 100, 1), round(f[2] * 100, 1)
        r["보정메모"] = memo
        if r.get("결과") in ("승", "무", "패"):
            pk = argmax(r, "보정"); r["보정적중"] = int(pk == r["결과"]) if pk else ""
        # 2026-10-23 125회 회고 — 검문(analysis_guard)을 확률 확정 직후에 자동으로 돌린다.
        # 점검표가 글로만 있던 탓에 같은 항목이 10회·5회 되풀이됐다(result_log.py report).
        try:
            import hit_model
            _, hp = hit_model.predict_row(r)
            r["적중예상도"] = hp if hp is not None else ""
        except Exception:
            pass
        n += 1
        if not getattr(a, "quiet", False):
            print(f"  {r['시각']} {r['홈']}-{r['원정']}: 순수 {r['순수_승']}/{r['순수_무']}/{r['순수_패']} → 최종 {r['보정_승']}/{r['보정_무']}/{r['보정_패']} ({memo}) · 적중예상도 {r.get('적중예상도','')}")
    save(rows)
    print(f"{a.round}회: 최종(보정) 확률 {n}경기 (기준선 혼합 {nb}) · 적중예상도 계산")
    # ── 검문 자동 실행 (2026-10-23, 125회 회고) ──────────────────────────────
    # 되풀이된 점검표 항목(방향 미형성 10회·농구 시즌초 5회·소표본 과소평가 2회 등)을
    # 글이 아니라 숫자로 막는다. 확률이 확정된 직후가 유일하게 검문할 수 있는 시점이다.
    try:
        import analysis_guard
        print()
        analysis_guard.cmd_round(argparse.Namespace(round=str(a.round), fix=True))
    except Exception as e:
        print(f"(검문 건너뜀: {e})")


def cmd_adjust(a):
    """보정 확률 = 시장 (1-w) + 순수 분석 w. w는 독자 분석 실적에 따라 구간별로 자동 조정(own_model.py, 기본 0.10).
    --news '홈,원정,승조정%%p,메모' 로 시장에 아직 반영 안 된 정보만 최대 ±5%p 추가 조정(무·패에 비례 배분).
    순수가 없으면 보정 = 시장. 사용자 요청(2026-10-07): 추천표에 시장 확률과 분석 적용 확률을 나란히 보여 준다."""
    rows = load()
    news = {}
    for item in (a.news or []):
        h, w, d, memo = (item.split(",", 3) + [""])[:4]
        news[(h.strip(), w.strip())] = (max(-5.0, min(5.0, float(d))), memo.strip())
    n = 0
    for r in rows:
        if r["회차"] != str(a.round) or not r.get("시장_승"):
            continue
        m = probs(r, "시장"); pu = probs(r, "순수")
        if not m:
            continue
        if pu:
            w = own_weight(r)
            f = [(1 - w) * x + w * y for x, y in zip(m, pu)]; memo = f"시장{round((1 - w) * 100)}+순수{round(w * 100)}"
        else:
            f = list(m); memo = "순수 없음=시장"
        d, nm = news.get((r["홈"], r["원정"]), (0.0, ""))
        if d:
            rest = f[1] + f[2]
            f[0] = min(0.99, max(0.01, f[0] + d / 100))
            scale = (1 - f[0]) / rest if rest > 0 else 0
            f[1], f[2] = f[1] * scale, f[2] * scale
            memo += f"; 뉴스 {d:+.0f}%p({nm})"
        r["보정_승"], r["보정_무"], r["보정_패"] = round(f[0] * 100, 1), round(f[1] * 100, 1), round(f[2] * 100, 1)
        r["보정메모"] = memo
        if r.get("결과") in ("승", "무", "패"):
            pk = argmax(r, "보정"); r["보정적중"] = int(pk == r["결과"]) if pk else ""
        n += 1
    save(rows)
    print(f"{a.round}회: 보정 확률 {n}경기 계산")
    warn = []
    for r in rows:
        pu, m = probs(r, "순수"), probs(r, "시장")
        if r["회차"] == str(a.round) and pu and m and not r.get("결과"):
            gap = max(abs(x - y) for x, y in zip(pu, m)) * 100
            if gap >= 8:
                warn.append(f"  ⚠ {r['홈']}-{r['원정']}: 순수와 시장 {gap:.0f}%p 차이 — 확인된 미반영 사실(확정 결장·라인업)이 없으면 시장 쪽으로 (분석규칙 8%p, 119회 DB·화이트삭스 실패)")
    if warn and not a.quiet:
        print("8%p 이상 차이 경기:"); print("\n".join(warn))
    if a.quiet:  # 토큰 절약(2026-10-12): 경기별 표는 block_brief.py가 보여 준다
        return
    for r in rows:
        if r["회차"] == str(a.round) and r.get("보정_승"):
            print(f"  {r['시각']} {r['홈']}-{r['원정']}: 순수 {r['순수_승'] or '-'}/{r['순수_무'] or '-'}/{r['순수_패'] or '-'} | 시장 {r['시장_승']}/{r['시장_무']}/{r['시장_패']} | 보정 {r['보정_승']}/{r['보정_무']}/{r['보정_패']} ({r['보정메모']})")


def argmax(r, pre):
    try:
        v = [float(r[f"{pre}_승"] or 0), float(r[f"{pre}_무"] or 0), float(r[f"{pre}_패"] or 0)]
    except ValueError:
        return None
    if sum(v) <= 0:
        return None
    return "승무패"[v.index(max(v))]


def cmd_results(a):
    rows = load()
    raw = fetch_round(a.round)
    res, res_no = {}, {}
    for g in main_markets(raw):
        res[(g["homeName"], g["awayName"])] = (g.get("gameResult"), g.get("mchScore"), g.get("protoStatus"))
        res_no[str(g.get("matchSeq"))] = res[(g["homeName"], g["awayName"])]  # 같은 대진 2경기(MLB G3/G4)는 번호로 — 2026-10-08
    code = {"0": "승", "1": "무", "2": "패", "4": "적특"}
    n = 0
    for r in rows:
        if r["회차"] != str(a.round):
            continue
        if r.get("결과") in ("승", "무", "패"):  # 결과 뒤에 확률이 채워졌을 수 있으니 적중만 다시 계산 (2026-10-09)
            for pre, col in (("순수", "순수적중"), ("시장", "시장적중"), ("보정", "보정적중")):
                pk = argmax(r, pre)
                r[col] = "" if pk is None else int(pk == r["결과"])
            continue
        if r.get("결과"):
            continue
        x = res_no.get(str(r.get("번호"))) if r.get("번호") else res.get((r["홈"], r["원정"]))
        if not x or x[2] != "4" or x[0] in (None, ""):
            continue
        r["결과"], r["점수"] = code.get(x[0], x[0]), x[1] or ""
        for pre, col in (("순수", "순수적중"), ("시장", "시장적중"), ("보정", "보정적중")):
            pk = argmax(r, pre)
            r[col] = "" if pk is None or r["결과"] == "적특" else int(pk == r["결과"])
        n += 1
    save(rows)
    print(f"{a.round}회: 결과 {n}경기 채점")


def rps(p, res):
    idx = "승무패".index(res)
    o_ = [0, 0, 0]; o_[idx] = 1
    c1, c2 = p[0], p[0] + p[1]
    return ((c1 - o_[0]) ** 2 + (c2 - o_[0] - o_[1]) ** 2) / 2


def probs(r, pre):
    try:
        v = [float(r[f"{pre}_승"] or 0), float(r[f"{pre}_무"] or 0), float(r[f"{pre}_패"] or 0)]
    except ValueError:
        return None
    s = sum(v)
    return [x / s for x in v] if s > 0 else None


def cmd_review(a):
    rows = [r for r in load() if r["회차"] == str(a.round)]
    done = [r for r in rows if r.get("결과") in ("승", "무", "패")]
    L = [f"# 프로토 {a.round}회 전체 경기 회고", "",
         f"작성 {dt.date.today()} · `scripts/round_log.py review` · 등록 {len(rows)}경기 / 결과 {len(done)}경기", ""]

    def block(title, rs):
        both = [r for r in rs if probs(r, "순수") and probs(r, "시장")]
        pu = [r for r in rs if r.get("순수적중") != ""]
        mk = [r for r in rs if r.get("시장적중") != ""]
        bj = [r for r in rs if r.get("보정적중") not in ("", None)]
        line = f"| {title} | {len(rs)} | "
        line += (f"{sum(int(r['순수적중']) for r in pu)}/{len(pu)} | " if pu else "- | ")
        line += (f"{sum(int(r['시장적중']) for r in mk)}/{len(mk)} | " if mk else "- | ")
        line += (f"{sum(int(r['보정적중']) for r in bj)}/{len(bj)} | " if bj else "- | ")
        if both:
            rp = sum(rps(probs(r, "순수"), r["결과"]) for r in both) / len(both)
            rm = sum(rps(probs(r, "시장"), r["결과"]) for r in both) / len(both)
            bb = [r for r in both if probs(r, "보정")]
            rb = sum(rps(probs(r, "보정"), r["결과"]) for r in bb) / len(bb) if bb else None
            line += f"{rp:.3f} | {rm:.3f} | {rb:.3f} | {len(both)} |" if rb is not None else f"{rp:.3f} | {rm:.3f} | - | {len(both)} |"
        else:
            line += "- | - | - | 0 |"
        return line

    L += ["## 1. 순수 분석 vs 시장 vs 보정(시장90+순수10+뉴스) — 1순위 적중, RPS 낮을수록 좋음", "",
          "| 구분 | 경기 | 순수 적중 | 시장 적중 | 보정 적중 | 순수 RPS | 시장 RPS | 보정 RPS | 비교 표본 |", "|---|---|---|---|---|---|---|---|---|",
          block("전체", done)]
    for sp in sorted({r["종목"] for r in done}):
        L.append(block(sp, [r for r in done if r["종목"] == sp]))
    for cf in ("높음", "중간", "낮음"):
        rs = [r for r in done if r.get("확신도") == cf]
        if rs:
            L.append(block(f"확신도 {cf}", rs))
    ex = [r for r in done if r.get("제외")]
    if ex:
        L.append(block("뉴스 위험 제외", ex))
    L += ["", "## 2. 순수 분석과 시장이 갈린 경기 (1순위가 다름)", "",
          "| 시각 | 경기 | 순수 | 시장 | 결과 | 누가 맞음 | 핵심근거 |", "|---|---|---|---|---|---|---|"]
    for r in done:
        ap, am = argmax(r, "순수"), argmax(r, "시장")
        if ap and am and ap != am:
            who = "순수" if ap == r["결과"] else "시장" if am == r["결과"] else "둘 다 틀림"
            L.append(f"| {r['시각']} | {r['홈']}-{r['원정']} | {ap} | {am} | {r['결과']} {r['점수']} | {who} | {r.get('핵심근거', '')[:40]} |")
    L += ["", "## 3. 틀린 경기 전체 (원인 분류를 채운다: 정보 누락 / 가중치 오판 / 무승부 과소평가 / 순수 이변)", "",
          "| 시각 | 종목 | 경기 | 순수 | 시장 | 결과 | 뉴스위험 | 원인 |", "|---|---|---|---|---|---|---|---|"]
    for r in done:
        if r.get("순수적중") == "0" or r.get("시장적중") == "0":
            L.append(f"| {r['시각']} | {r['종목']} | {r['홈']}-{r['원정']} | {argmax(r, '순수') or '-'} | {argmax(r, '시장') or '-'} | {r['결과']} {r['점수']} | {r.get('뉴스위험', '')[:30]} | |")
    pend = [r for r in rows if r not in done]
    L += ["", f"## 4. 결과 미확정 {len(pend)}경기", "", ", ".join(f"{r['홈']}-{r['원정']}" for r in pend) or "없음", "",
          "## 5. 분석 스킬 개선 (회고 후 작성)", "", "- 반복 패턴(2~3회 이상)만 `분석규칙.md`에 반영. 근거 회차·신뢰도 표시.", ""]
    out = os.path.join(ROOT, "회차별분석", f"{dt.date.today()}_프로토{a.round}_전체회고.md")
    open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L[:20]))
    print("저장:", out)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for c in ("init", "market", "results", "review"):
        s = sub.add_parser(c); s.add_argument("round", type=int)
    s = sub.add_parser("adjust"); s.add_argument("round", type=int); s.add_argument("--news", action="append", help="'홈,원정,승조정%%p,메모' (최대 ±5)"); s.add_argument("--quiet", action="store_true", help="계산만, 경기별 출력 생략")
    s = sub.add_parser("pure"); s.add_argument("round", type=int); s.add_argument("file"); s.add_argument("--no-anchor", action="store_true")
    s = sub.add_parser("anchor"); s.add_argument("round", type=int); s.add_argument("--quiet", action="store_true")
    s = sub.add_parser("market-from-scanlog"); s.add_argument("round", type=int)
    s.add_argument("--force", action="store_true", help="이미 값이 있어도 더 늦은 스캔이면 덮어쓴다")
    a = ap.parse_args()
    {"init": cmd_init, "pure": cmd_pure, "market": cmd_market, "results": cmd_results, "review": cmd_review, "adjust": cmd_adjust,
     "market-from-scanlog": cmd_market_from_scanlog, "anchor": cmd_anchor}[a.cmd](a)


if __name__ == "__main__":
    main()
