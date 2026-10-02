#!/usr/bin/env python3
"""
배당 스캔: 베트맨 프로토 승부식 배당을 Pinnacle(해외 최저 마진) 공정 확률과 비교해
기대값(베트맨 배당 × 공정 확률)이 1 이상인 경기를 찾는다.

원리
- Pinnacle 배당에서 마진을 빼면(Shin) 실제 확률에 가장 가까운 값이 나온다 (백테스트: RPS 0.1936, 시장이 천장).
- 베트맨은 환급률 약 88%로 배당을 짜게 주지만, 결장·라인업 뉴스 뒤에 배당을 늦게 고친다.
- 그래서 대부분 기대값 0.85~0.90이고, 가끔 베트맨이 늦은 경기만 1.0을 넘는다. 그 경기만 산다.

사용법
  python3 scripts/odds_scan.py                 # 판매 중인 프로토 회차 전부
  python3 scripts/odds_scan.py --min-ev 0.95   # 0.95 이상만 표시
  python3 scripts/odds_scan.py --all           # 매칭 실패 경기까지 전부 표시
  python3 scripts/odds_scan.py --save          # 회차별분석/배당스캔_YYYY-MM-DD_HHMM.csv 저장
  python3 scripts/odds_scan.py --loop 10       # 10분마다 다시 스캔해 기대값 1.0 이상만 출력 (Ctrl+C로 종료)
  python3 scripts/odds_scan.py --no-draw --prob             # 야구·배구·농구만, 경기당 유력한 쪽을 이길 확률 순으로
  python3 scripts/odds_scan.py --sports 배구 --prob --min-prob 60   # 종목 지정 + 확률 60% 이상만
  python3 scripts/odds_scan.py --round 118 --prob           # 회차 지정 (판매 중인 회차 중에서)
  python3 scripts/odds_scan.py --no-draw --combo 3          # 3경기 조합, 적중 확률 순
  python3 scripts/odds_scan.py --target 3 --min-prob 65     # 합계 배당 3배 이상 조합 중 적중 확률 최고
  python3 scripts/odds_scan.py --no-handi ...                # 핸디캡 제외 (기본은 포함)
  - 배당 1.3 미만 선택지는 기본으로 뺀다(--min-odds 1.3). 전부 보려면 --min-odds 1
  - 핸디캡: 야구·축구 소수핸디캡(±x.5), 배구 세트핸디캡은 Pinnacle 같은 라인(기본+대체)과 비교.
    축구 정수핸디캡(3-way)은 Pinnacle (라인-0.5) 홈 / (라인+0.5) 원정으로 핸디승·핸디패를, 나머지를 핸디무로 계산.
    Pinnacle에 해당 라인이 없으면 --all 에 'Pinnacle 라인 없음'으로 나온다.
  - 이미 시작한 경기는 기본으로 숨긴다(--started로 표시). 배당 미발표·대진 미정 경기는 위쪽에 리그별로 따로 센다.

팀 이름 매칭
- 킥오프 시각(±3분)과 종목이 같은 Pinnacle 경기를 후보로 잡고, data/team_names.json(한글→영문)으로 확인한다.
- 후보가 하나뿐이면 이름이 없어도 매칭하되 '시간만 일치'로 표시한다. 매칭 실패 경기는 --all로 보고
  data/team_names.json에 이름을 추가하면 다음부터 잡힌다.

주의
- 승무패·승패·핸디캡을 비교한다. 언더오버·홀짝·승N패는 제외.
- 축구 '승패'형은 무승부 시 적중특례(배당 1.0). Pinnacle 2-way(무 환불)와 같은 조건이다.
- 기대값 1.0 이상이어도 표본이 적으면 우연일 수 있다. 예측기록.csv에 남겨 CLV(마감 배당 대비)로 검증한다.
"""
import argparse, csv, datetime as dt, json, math, os, re, subprocess, sys, time

sys.path.insert(0, os.path.dirname(__file__))
from devig import shin  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
NAMES_PATH = os.path.join(ROOT, "data", "team_names.json")
UA = "Mozilla/5.0"
PIN_KEY = "CmX2KcMrXuFmNg6YFbmTxE0y9CIrOi0R"  # Pinnacle 공개 게스트 키 (사이트 프론트엔드가 쓰는 값)
SPORTS = {"SC": 29, "BS": 3, "BK": 4, "VL": 34, "IH": 19}  # 베트맨 itemCode → Pinnacle sport id
KST = dt.timezone(dt.timedelta(hours=9))
SPORT_KO = {"SC": "축구", "BS": "야구", "BK": "농구", "VL": "배구", "IH": "하키"}


def curl(url, headers=(), data=None, cookie=None):
    cmd = ["curl", "-sS", "-m", "40", "-A", UA]
    for h in headers:
        cmd += ["-H", h]
    if cookie:
        cmd += ["-b", cookie, "-c", cookie]
    if data is not None:
        cmd += ["-X", "POST", "-d", data]
    cmd.append(url)
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        raise SystemExit(f"JSON 아님: {url}\n{out[:300]}")


# ---------------------------------------------------------------- 베트맨
def betman(cookie):
    hdr = ["Content-Type: application/json; charset=UTF-8", "Accept: application/json",
           "X-Requested-With: XMLHttpRequest", "Origin: https://www.betman.co.kr",
           "Referer: https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId=G101"]
    subprocess.run(["curl", "-sS", "-m", "30", "-A", UA, "-c", cookie, "-o", "/dev/null",
                    "https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId=G101"])
    sbm = {"_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}
    lst = curl("https://www.betman.co.kr/buyPsblGame/inqCacheBuyAbleGameInfoList.do", hdr, json.dumps(sbm), cookie)
    rounds = [g for g in lst.get("protoGames", []) if g["gmId"] == "G101"]
    games, pending = [], []
    for r in rounds:
        body = json.dumps({"gmId": "G101", "gmTs": r["gmTs"], "gameYear": r["gmOsidTsYear"], **sbm})
        d = curl("https://www.betman.co.kr/buyPsblGame/gameInfoInq.do", hdr, body, cookie)
        cs = d["compSchedules"]
        for row in cs["datas"]:
            g = dict(zip(cs["keys"], row))
            bt = g.get("betTypNm") or ""
            if g["itemCode"] not in SPORTS:
                continue
            is_handi = "핸디캡" in bt  # 일반 소수핸디캡(±x.5) / 일반 정수핸디캡(축구 3-way) / 일반 세트핸디캡(배구)
            is_ou = bt == "일반 언더오버"  # 베트맨: 승 칸 = 언더, 패 칸 = 오버, winHandi = 기준점
            if bt not in ("승무패", "일반 승패", "승패") and not is_handi and not is_ou:
                continue
            if not is_handi and not is_ou and (g.get("winHandi") or g.get("loseHandi")):
                continue  # 핸디캡 붙은 승무패는 비교 대상 아님 ('handi'는 유형 코드라 보지 않는다: 일반 승패=21)
            if "전반" in (g.get("betNm") or "") or "후반" in (g.get("betNm") or ""):
                continue  # 전반전 승무패 등은 경기 전체 배당과 비교하면 안 됨
            if (is_handi or is_ou) and (not g.get("winAllot") or g["homeName"] == "미정" or g.get("winHandi") is None):
                continue  # 미발표 목록은 일반 승패/승무패 기준으로만 센다
            if not g.get("winAllot") or g["homeName"] == "미정":
                pending.append({"회차": r["gmOsidTs"], "종목": g["itemCode"], "리그": g["leagueName"], "홈": g["homeName"],
                                "원정": g["awayName"], "유형": bt,
                                "시각": dt.datetime.fromtimestamp(g["gameDate"] / 1000, dt.timezone.utc)})
                continue  # 배당 미발표(0.0) 또는 대진 미정
            games.append({
                "회차": r["gmOsidTs"], "번호": g["matchSeq"], "종목": g["itemCode"], "리그": g["leagueName"],
                "시각": dt.datetime.fromtimestamp(g["gameDate"] / 1000, dt.timezone.utc),
                "홈": g["homeName"], "원정": g["awayName"], "유형": bt, "betNm": g.get("betNm"),
                "라인": g["winHandi"] if is_handi else None,  # 홈팀 기준 핸디캡 (예: -1.5 = 홈이 2점 이상 이겨야 적중)
                "OU": g["winHandi"] if is_ou else None,  # 언더오버 기준점
                "단식": g.get("sgl") == "1",  # 한 경기 구매 가능 표시로 보이는 값 (베트맨 화면에서 확인 필요)  # 홈팀 기준 핸디캡 (예: -1.5 = 홈이 2점 이상 이겨야 적중)
                "배당": [g["winAllot"], g["drawAllot"] if (bt == "승무패" or (is_handi and g.get("drawAllot"))) else None,
                         g["loseAllot"]],
            })
    return rounds, games, pending


# ---------------------------------------------------------------- Pinnacle
def american_to_decimal(p):
    return 1 + p / 100 if p > 0 else 1 + 100 / abs(p)


def pinnacle(sport_id):
    hdr = [f"X-API-Key: {PIN_KEY}", "Accept: application/json"]
    mt = curl(f"https://guest.api.arcadia.pinnacle.com/0.1/sports/{sport_id}/matchups?withSpecials=false", hdr)
    mk = curl(f"https://guest.api.arcadia.pinnacle.com/0.1/sports/{sport_id}/markets/straight?primaryOnly=false", hdr)
    prices, spreads, totals = {}, {}, {}
    for m in mk:
        if m.get("period") != 0 or m.get("status") != "open":
            continue
        if m.get("type") == "moneyline" and not m.get("isAlternate"):
            prices[m["matchupId"]] = {p["designation"]: american_to_decimal(p["price"]) for p in m["prices"]}
        elif m.get("type") == "total":  # 기본 + 대체 언더오버 (언더오버 비교와 핸디캡 역산 모델용)
            pr = {p["designation"]: p for p in m["prices"]}
            if "over" in pr and "under" in pr:
                pts = float(pr["over"]["points"])
                t = totals.setdefault(m["matchupId"], {"lines": {}, "main": None})
                t["lines"][lkey(pts)] = {"over": american_to_decimal(pr["over"]["price"]), "under": american_to_decimal(pr["under"]["price"])}
                if not m.get("isAlternate"):
                    t["main"] = lkey(pts)
        elif m.get("type") == "spread":  # 기본 + 대체 라인, 홈팀 points 기준으로 저장
            pr = {p["designation"]: p for p in m["prices"]}
            if "home" in pr and "away" in pr:
                spreads.setdefault(m["matchupId"], {})[lkey(pr["home"]["points"])] = {
                    "home": american_to_decimal(pr["home"]["price"]), "away": american_to_decimal(pr["away"]["price"])}
    out = []
    for t in mt:
        if t.get("type") != "matchup" or t.get("parentId") or t["id"] not in prices:
            continue
        home = next((p["name"] for p in t["participants"] if p.get("alignment") == "home"), t["participants"][0]["name"])
        away = next((p["name"] for p in t["participants"] if p.get("alignment") == "away"), t["participants"][-1]["name"])
        out.append({"id": t["id"], "리그": t["league"]["name"], "홈": home, "원정": away,
                    "시각": dt.datetime.fromisoformat(t["startTime"].replace("Z", "+00:00")), "배당": prices[t["id"]],
                    "핸디": spreads.get(t["id"], {}), "합계": totals.get(t["id"])})
    return out


def lkey(x):
    return round(float(x) * 4) / 4


def fair_handi(spreads, line, three_way, ml=None):
    """베트맨 핸디캡(홈 기준 line)의 공정 확률.
    - x.5 라인: Pinnacle 같은 라인의 2-way 배당을 마진 제거.
    - 정수 라인 3-way(축구 정수핸디캡): 핸디승 = Pinnacle (line-0.5) 홈 / 핸디패 = (line+0.5) 원정 / 핸디무 = 나머지.
    """
    def two(pair):
        p, _ = shin([1 / pair["home"], 1 / pair["away"]])
        return p[0], p[1], (1 / pair["home"] + 1 / pair["away"] - 1) * 100
    if three_way:
        # ±0.5 라인은 승무패로 환산된다. Pinnacle에 해당 라인이 없으면 승무패 공정확률로 채운다.
        ml3 = fair(ml, True) if ml and "draw" in ml else None
        def side(L, k):
            pair = spreads.get(lkey(L))
            if pair:
                ph, pa, m = two(pair)
                return (ph if k == "home" else pa), m
            if ml3 and L in (-0.5, 0.5):
                q = ml3[0]  # -0.5: 홈=홈승, 원정=무+원정승 / +0.5: 홈=홈승+무, 원정=원정승
                v = {(-0.5, "home"): q["home"], (-0.5, "away"): q["draw"] + q["away"],
                     (0.5, "home"): q["home"] + q["draw"], (0.5, "away"): q["away"]}[(L, k)]
                return v, ml3[1]
            return None, None
        pw, m1 = side(line - 0.5, "home")
        pl, m2 = side(line + 0.5, "away")
        if pw is None or pl is None:
            return None
        if pw + pl >= 1:
            return None
        return {"home": pw, "draw": 1 - pw - pl, "away": pl}, (m1 + m2) / 2
    if lkey(line) % 1 == 0:
        return None  # 정수 라인 2-way는 적특(환불) 규칙이 달라 비교하지 않는다
    pair = spreads.get(lkey(line))
    if not pair:
        return None
    ph, pa, m = two(pair)
    return {"home": ph, "away": pa}, m


def fair(prices, three_way):
    keys = ["home", "draw", "away"] if "draw" in prices else ["home", "away"]
    if any(k not in prices for k in keys):
        return None
    q = [1 / prices[k] for k in keys]
    p, _ = shin(q)
    probs = dict(zip(keys, p))
    if three_way and "draw" not in probs:
        return None
    if not three_way and "draw" in probs:  # 베트맨 승패형: 무승부는 적특(환불) → 조건부 확률
        s2 = probs["home"] + probs["away"]
        probs = {"home": probs["home"] / s2, "away": probs["away"] / s2}
    return probs, (sum(q) - 1) * 100


def score_probs(lh, la, rho=-0.06, n=11):
    """Dixon-Coles 보정 포아송 점수 분포 {(홈골, 원정골): 확률}."""
    ph = [math.exp(-lh) * lh ** k / math.factorial(k) for k in range(n)]
    pa = [math.exp(-la) * la ** k / math.factorial(k) for k in range(n)]
    tau = {(0, 0): 1 - lh * la * rho, (0, 1): 1 + lh * rho, (1, 0): 1 + la * rho, (1, 1): 1 - rho}
    m = {(i, j): ph[i] * pa[j] * tau.get((i, j), 1.0) for i in range(n) for j in range(n)}
    s = sum(m.values())
    return {k: v / s for k, v in m.items()}


def implied_goals(p3, p_over, line):
    """승무패 공정확률 + 언더오버(line) 오버 확률에 맞는 (홈 기대득점, 원정 기대득점).
    0.1~7골 전 범위를 거친 격자로 훑고 좁혀 간다. 맞춤 오차가 크면(입력과 확률이 1%p 넘게 어긋나면) None."""
    def loss(lh, la):
        m = score_probs(lh, la, n=15)
        w = sum(v for (i, j), v in m.items() if i > j)
        d = sum(v for (i, j), v in m.items() if i == j)
        o = sum(v for (i, j), v in m.items() if i + j > line)
        return (w - p3["home"]) ** 2 + (d - p3["draw"]) ** 2 + (o - p_over) ** 2
    grid = [0.1 + 0.3 * k for k in range(23)]  # 0.1 ~ 6.7
    best = min(((x, y) for x in grid for y in grid), key=lambda v: loss(*v))
    step = 0.15
    for _ in range(8):
        c = [(max(0.02, best[0] + dx * step), max(0.02, best[1] + dy * step)) for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2)]
        best = min(c, key=lambda v: loss(*v))
        step /= 2.5
    return best if loss(*best) < 3e-4 else None


def model_goals(p):
    """승무패 + 언더오버(기본 라인에 가장 가까운 x.5 라인)로 역산한 (홈, 원정) 기대득점과 승무패 공정확률."""
    if "draw" not in p["배당"] or not p.get("합계"):
        return None
    f3 = fair(p["배당"], True)
    t = p["합계"]
    halves = [L for L in t["lines"] if (L * 2) % 2 == 1]
    if not f3 or not halves:
        return None
    if max(f3[0]["home"], f3[0]["away"]) >= 0.9:
        return None  # 극단적 전력 차: 점수 꼬리 외삽이라 검증 안 됨(EPL 90%+ 경기 19개뿐) → 모델 값 내지 않음
    pt = min(halves, key=lambda L: abs(L - (t["main"] if t["main"] is not None else 2.5)))
    q = t["lines"][pt]
    p_over = shin([1 / q["over"], 1 / q["under"]])[0][0]
    lg = implied_goals(f3[0], p_over, pt)
    return (lg, f3) if lg else None


def fair_ou(p, line, soccer):
    """베트맨 언더오버(line)의 공정확률 {'home': 언더, 'away': 오버}. Pinnacle 같은 라인 → 없으면 축구는 역산 모델."""
    if (line * 2) % 2 != 1:
        return None  # 정수 기준점은 적특(환불) 규칙을 확인하지 않아 비교하지 않는다
    t = p.get("합계")
    if t and lkey(line) in t["lines"]:
        q = t["lines"][lkey(line)]
        pu, po = shin([1 / q["under"], 1 / q["over"]])[0]
        return {"home": pu, "away": po}, (1 / q["under"] + 1 / q["over"] - 1) * 100, False
    if soccer and (line * 2) % 2 == 1:
        lg = model_goals(p)
        if lg:
            (lh, la), f3 = lg
            m = score_probs(lh, la, n=15)
            pu = sum(v for (i, j), v in m.items() if i + j < line)
            return {"home": pu, "away": 1 - pu}, f3[1], True
    return None


def fair_handi_model(p, line, three_way):
    """Pinnacle에 해당 핸디캡 라인이 없을 때: 승무패 + 기본 언더오버로 기대득점을 역산해 점수 분포에서 계산.
    검증(scripts/tune.py, EPL 660경기): x.5 핸디캡 Brier 0.2510 = 시장 핸디캡 배당 0.2511, 평균 차 0.8%p."""
    lg = model_goals(p)
    if not lg:
        return None
    (lh, la), f3 = lg
    m = score_probs(lh, la, n=15)
    win = sum(v for (i, j), v in m.items() if i - j + line > 0)
    push = sum(v for (i, j), v in m.items() if i - j + line == 0)
    if three_way:
        return {"home": win, "draw": push, "away": 1 - win - push}, f3[1]
    if push > 1e-9:
        return None
    return {"home": win, "away": 1 - win}, f3[1]


# ---------------------------------------------------------------- 매칭
def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def load_names():
    if os.path.exists(NAMES_PATH):
        return json.load(open(NAMES_PATH, encoding="utf-8"))
    return {}


def name_hit(names, ko, en):
    """한글 팀명이 사전에 있으면 영문명과 비교. 사전에 없으면 None(판단 불가)."""
    ko_key = ko.strip()
    cands = names.get(ko_key) or names.get(ko_key.split(" ")[0])
    if not cands:
        return None
    if isinstance(cands, str):
        cands = [cands]
    e = norm(en)
    return any(norm(c) in e or e in norm(c) for c in cands)


def clean_ko(s):
    return re.sub(r"_(남자|여자)$", "", s).replace("공화국", "").strip()


def match(games, pins, names, tol=180, tol_named=1200):
    res = []
    for g in games:
        pool = pins[g["종목"]]
        wide = [p for p in pool if abs((p["시각"] - g["시각"]).total_seconds()) <= tol_named]
        near = [p for p in wide if abs((p["시각"] - g["시각"]).total_seconds()) <= tol]
        pick, how = None, "매칭 실패"
        exact = []
        for p in wide:
            h, a = name_hit(names, clean_ko(g["홈"]), p["홈"]), name_hit(names, clean_ko(g["원정"]), p["원정"])
            if h and a:
                exact.append(p)
        if len(exact) == 1:
            pick, how = exact[0], "이름 일치"
        elif len(exact) > 1:
            how = f"후보 {len(exact)}개"
        elif len(near) == 1:
            p = near[0]
            h, a = name_hit(names, clean_ko(g["홈"]), p["홈"]), name_hit(names, clean_ko(g["원정"]), p["원정"])
            if h is False or a is False:
                how = "시간 일치·이름 불일치"
            elif h or a:
                pick, how = p, "한 팀+시간"
            else:
                pick, how = p, "시간만 일치"
        res.append((g, pick, how, len(near)))
    return res


# ---------------------------------------------------------------- 메인
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-ev", type=float, default=0.0)
    ap.add_argument("--all", action="store_true", help="매칭 실패 경기도 표시")
    ap.add_argument("--save", action="store_true")
    ap.add_argument("--loop", type=int, default=0, help="N분마다 반복 스캔, +EV만 출력")
    ap.add_argument("--sports", default="", help="종목 필터: 야구,배구,농구,축구 (또는 BS,VL,BK,SC)")
    ap.add_argument("--no-draw", action="store_true", help="무승부 없는 종목만 = --sports 야구,배구,농구")
    ap.add_argument("--round", default="", help="회차 필터, 예: 117 또는 117,118")
    ap.add_argument("--prob", action="store_true", help="이길 확률 보기: 경기당 확률 높은 쪽 한 줄, 확률 순 정렬")
    ap.add_argument("--min-prob", type=float, default=0.0, help="공정확률(%%) 이 값 이상만 표시, 예: 60")
    ap.add_argument("--started", action="store_true", help="이미 시작한 경기도 표시 (기본은 숨김)")
    ap.add_argument("--no-handi", action="store_true", help="핸디캡·언더오버 제외 (일반 승패·승무패만)")
    ap.add_argument("--sure", type=float, default=0.0,
                    help="선별 모드: 경기마다 확률 최고 선택지 1개, 이 값(%%) 이상만 추천. 예: --sure 80 (EPL 백테스트 실제 86.6%%)")
    ap.add_argument("--combo", type=int, default=0, help="N경기 조합 중 적중 확률 높은 순 (--prob 자동)")
    ap.add_argument("--target", type=float, default=0.0, help="합계 배당 이 값 이상인 조합 중 적중 확률 높은 순 (2~5경기)")
    ap.add_argument("--stake", type=int, default=10000, help="조합 계산 금액(원)")
    ap.add_argument("--min-odds", type=float, default=1.3,
                    help="베트맨 배당이 이 값 미만인 선택지는 추천·조합에서 뺀다 (기본 1.3, 사용자 결정 2026-10-02). 끄려면 --min-odds 1")
    ap.add_argument("--best", action="store_true", help="경기마다 가장 확률 높은 선택지(일반·핸디캡·언더오버 전체)를 확률 순으로")
    a = ap.parse_args()
    if a.best and not a.sure:
        a.sure = 0.001
    if a.combo or a.target:
        a.prob = True
    alias ={"야구": "BS", "배구": "VL", "농구": "BK", "축구": "SC", "하키": "IH"}
    a.sports = {alias.get(s.strip(), s.strip().upper()) for s in a.sports.split(",") if s.strip()}
    if a.no_draw:
        a.sports |= {"BS", "VL", "BK"}
    a.round = {int(x) for x in a.round.split(",") if x.strip()}
    if a.loop:
        a.min_ev = max(a.min_ev, 1.0)
        while True:
            print(f"\n[{dt.datetime.now(KST):%m-%d %H:%M}] 스캔")
            try:
                scan(a)
            except SystemExit as e:
                print("오류:", e)
            time.sleep(a.loop * 60)
    scan(a)


def scan(a):

    cookie = os.path.join(ROOT, "data", ".betman_cookie")
    os.makedirs(os.path.dirname(cookie), exist_ok=True)
    rounds, games, pending = betman(cookie)
    now = dt.datetime.now(dt.timezone.utc)

    def keep(g):
        return ((not a.sports or g["종목"] in a.sports) and (not a.round or g["회차"] in a.round)
                and (a.started or g["시각"] > now))
    games, pending = [g for g in games if keep(g)], [g for g in pending if keep(g)]
    print("판매 중 회차: " + ", ".join(f"{r['gmOsidTs']}회(마감 {dt.datetime.fromtimestamp(r['saleEndDate']/1000, KST):%m-%d %H:%M})" for r in rounds))
    if pending:
        cnt = {}
        for g in pending:
            k = (g["종목"], g["리그"])
            cnt.setdefault(k, []).append(g)
        print("배당 미발표·대진 미정 (배당이 뜨면 다시 스캔):")
        for (code, lg), gs in sorted(cnt.items(), key=lambda x: min(g["시각"] for g in x[1])):
            first = min(g["시각"] for g in gs).astimezone(KST)
            named = [f"{g['홈']}-{g['원정']}" for g in gs if g["홈"] != "미정"]
            print(f"  {SPORT_KO.get(code, code)} {lg}: {len(gs)}경기 (첫 경기 {first:%m-%d %H:%M})"
                  + (f" — {', '.join(dict.fromkeys(named))}" if named else ""))
    if not games:
        print("배당이 나온 경기가 없습니다.")
        return
    pins = {}
    for code, sid in SPORTS.items():
        if any(g["종목"] == code for g in games):
            pins[code] = pinnacle(sid)
    names = load_names()
    rows = []
    if a.no_handi:
        games = [g for g in games if g["라인"] is None and g["OU"] is None]
    for g, p, how, ncand in match(games, pins, names):
        line, ou = g["라인"], g["OU"]
        base = {"회차": g["회차"], "번호": g["번호"], "시각": g["시각"].astimezone(KST).strftime("%m-%d %H:%M"), "리그": g["리그"],
                "경기": f"{g['홈']} vs {g['원정']}", "유형": g["유형"], "매칭": how, "라인": line,
                "구분": f"U/O {ou:g}" if ou is not None else ("일반" if line is None else f"H{line:+g}"), "단식": g["단식"], "OU": ou}
        if not p:
            if a.all:
                rows.append({**base, "선택": "", "베트맨": "", "Pinnacle": "", "공정확률": "", "기대값": "", "후보": ncand})
            continue
        three = g["배당"][1] is not None
        if ou is not None:
            fo = fair_ou(p, ou, g["종목"] == "SC")
            f = (fo[0], fo[1]) if fo else None
            if fo and fo[2]:
                base["매칭"] = how + "·역산모델"
        else:
            f = fair(p["배당"], three) if line is None else fair_handi(p["핸디"], line, three, p["배당"])
        if not f and ou is None and line is not None and g["종목"] == "SC":
            f = fair_handi_model(p, line, three)
            if f:
                base["매칭"] = how + "·역산모델"
        if not f:
            if a.all and (line is not None or ou is not None):
                rows.append({**base, "선택": "", "베트맨": "", "Pinnacle": "", "공정확률": "", "기대값": "", "매칭": "Pinnacle 라인 없음"})
            continue
        probs, margin = f
        labels = [("승", "home"), ("무", "draw"), ("패", "away")] if three else [("승", "home"), ("패", "away")]
        bo = g["배당"] if three else [g["배당"][0], g["배당"][2]]
        for (lab, key), o in zip(labels, bo):
            if not o:
                continue
            ev = o * probs[key]
            if ev < a.min_ev:
                continue
            if probs[key] * 100 < a.min_prob or o < a.min_odds:
                continue
            rows.append({**base, "종목": SPORT_KO.get(g["종목"], g["종목"]), "Pinnacle경기": f"{p['홈']} vs {p['원정']}",
                         "선택": lab, "베트맨": o,
                         "Pinnacle": round(p["배당"][key], 2) if line is None and ou is None else "",
                         "공정확률": round(probs[key] * 100, 1), "기대값": round(ev, 3), "Pin마진%": round(margin, 1)})
    all_rows = list(rows)  # 조합(--target)은 모든 선택지를 후보로 쓴다
    if a.sure:
        return sure_view(all_rows, a)
    if a.prob:  # 경기당 확률 높은 쪽 한 줄만 (매칭 실패 행은 그대로)
        best = {}
        for r in rows:
            k = (r["회차"], r["번호"])
            if r["공정확률"] == "" or k not in best or r["공정확률"] > best[k]["공정확률"]:
                best[k] = r
        rows = sorted(best.values(), key=lambda r: -(r["공정확률"] if r["공정확률"] != "" else -1))
    else:
        rows.sort(key=lambda r: -(r["기대값"] if r["기대값"] != "" else -1))
    if not rows:
        print("표시할 경기가 없습니다.")
        return
    for r in rows:
        r["픽"] = leg_name(r) if r["선택"] else ""
        if r.get("OU") not in (None, "") and r["선택"] in ("승", "패"):
            r["선택"] = "언더" if r["선택"] == "승" else "오버"
    cols = ["회차", "번호", "시각", "리그", "경기", "구분", "선택", "베트맨", "Pinnacle", "공정확률", "기대값", "매칭"]
    if a.prob:
        cols = ["회차", "번호", "시각", "종목", "리그", "경기", "픽", "공정확률", "베트맨", "기대값", "매칭"]
    w = {c: max(len(c), *(len(str(r.get(c, ""))) for r in rows)) for c in cols}
    print(" | ".join(c.ljust(w[c]) for c in cols))
    for r in rows:
        flag = " ★ +EV" if r["기대값"] != "" and r["기대값"] >= 1.0 else ("  근접" if r["기대값"] != "" and r["기대값"] >= 0.95 else "")
        print(" | ".join(str(r.get(c, "")).ljust(w[c]) for c in cols) + flag)
    n_plus = sum(1 for r in rows if r["기대값"] != "" and r["기대값"] >= 1.0)
    print(f"\n비교 {len(rows)}건 / 기대값 1.0 이상 {n_plus}건. 매칭 실패는 --all 로 확인하고 data/team_names.json 에 이름을 추가한다.")
    if a.combo or a.target:
        combos(all_rows if a.target else rows, a)
    if a.save:
        out = os.path.join(ROOT, "회차별분석", f"배당스캔_{dt.datetime.now(KST):%Y-%m-%d_%H%M}.csv")
        with open(out, "w", encoding="utf-8", newline="") as fh:
            wr = csv.DictWriter(fh, fieldnames=sorted({k for r in rows for k in r}))
            wr.writeheader(); wr.writerows(rows)
        print("저장:", out)


def sure_view(rows, a):
    """경기마다 (일반·핸디캡 전체에서) 공정확률이 가장 높은 선택지 1개. 기준 이상이면 추천.
    근거: scripts/sure_backtest.py — EPL 5,320경기에서 기준 80% → 해당 44.6%, 실제 적중 86.6% (14시즌 모두 82.9% 이상)."""
    best = {}
    for r in rows:
        if r["공정확률"] == "":
            continue
        k = (r["회차"], r["경기"], r["시각"])
        if k not in best or r["공정확률"] > best[k]["공정확률"]:
            best[k] = r
    picks = sorted(best.values(), key=lambda r: -r["공정확률"])
    ok = [r for r in picks if r["공정확률"] >= a.sure]
    title = "경기당 최고 확률 선택지" + (f", 기준 {a.sure:.0f}%" if a.sure >= 1 else "")
    print(f"\n[{title}] {len(ok)} / {len(picks)}경기 · 평균 {sum(r['공정확률'] for r in picks)/max(len(picks),1):.1f}%")
    print("※ 정수핸디캡 'H-1 패'·'H+1 승'은 해당 팀이 '지지 않으면'(이기거나 비기면) 적중. EPL 백테스트로 확률 보정 확인(축구). 야구·배구·농구는 미검증.")
    for i, r in enumerate(picks, 1):
        mark = "✔" if a.sure >= 1 and r["공정확률"] >= a.sure else " "
        model = "*" if "역산모델" in r["매칭"] else ""
        print(f"{mark} {r['시각']} {r.get('종목', ''):2} {r['경기']:<28} → {leg_name(r)}{model:<1} {r['공정확률']:5.1f}% · 배당 {r['베트맨']}")
    if ok:
        from math import prod
        print(f"\n{'기준 이상 ' if a.sure >= 1 else ''}{len(ok)}경기 평균 확률 {sum(r['공정확률'] for r in ok)/len(ok):.1f}% — 단식 기준. "
              f"조합하면 확률이 곱해진다 (예: 상위 2개 {prod(r['공정확률']/100 for r in ok[:2])*100:.1f}%, 3개 {prod(r['공정확률']/100 for r in ok[:3])*100:.1f}%).")


def leg_name(r):
    """'인도_남자 vs 한국_남자' + 패 → '한국 승' / 핸디캡이면 '한국 -1.5' (이기는 쪽 이름으로 표기)"""
    home, away = (re.sub(r"_(남자|여자)$", "", t) for t in r["경기"].split(" vs "))
    if r.get("OU") is not None and r.get("OU") != "":
        return f"{home}-{away} {'언더' if r['선택'] in ('승', '언더') else '오버'} {r['OU']:g}"  # 표 출력 뒤엔 선택이 언더/오버로 바뀌어 있다
    line = r.get("라인")
    if line is None or line == "":
        return {"승": f"{home} 승", "패": f"{away} 승", "무": f"{home}-{away} 무"}[r["선택"]]
    if "정수" in (r.get("유형") or "") and line != 0:  # 3-way 정수핸디캡은 베트맨 화면 표기 그대로 (예: 한국 H-2 패)
        k = int(abs(line))
        if line < 0:  # 홈이 -k
            meaning = {"승": f"{home} {k + 1}골차 이상 승", "무": f"{home} 정확히 {k}골차 승",
                       "패": f"{away} 지지않음" if k == 1 else f"{home} {k - 1}골차 이하 승 또는 무·패"}[r["선택"]]
        else:  # 홈이 +k
            meaning = {"승": f"{home} 지지않음" if k == 1 else f"{home} 승·무 또는 {k - 1}골차 이하 패",
                       "무": f"{away} 정확히 {k}골차 승", "패": f"{away} {k + 1}골차 이상 승"}[r["선택"]]
        return f"{home} H{line:+g} {r['선택']}[{meaning}]"
    return {"승": f"{home} {line:+g}", "패": f"{away} {-line:+g}", "무": f"{home} {line:+g} 핸디무"}[r["선택"]]


def combos(rows, a, pool_size=40, max_legs=5, top=10):
    """적중 확률이 가장 높은 조합을 찾는다.
    - 적중 확률 = 각 경기 공정확률의 곱 (경기끼리 독립 가정)
    - 합계 배당 = 베트맨 배당의 곱, 소수 둘째 자리 아래 절사 (베트맨 방식)
    - --combo N: 경기당 유력한 쪽만 후보, N경기 조합을 적중 확률 순으로
    - --target X: 합계 배당 X 이상 중 적중 확률 상위. 적중 확률 = (각 선택 기대값의 곱) ÷ 합계 배당 이므로
      같은 목표 배당이면 기대값 높은 선택을 적게 묶을수록 잘 맞는다 → 후보를 기대값 순으로 뽑는다.
      '단식' 표시(sgl=1) 경기는 1경기 선택도 후보로 본다.
    """
    from itertools import combinations
    from math import floor, prod
    cand = [r for r in rows if r["공정확률"] != ""]
    cand = sorted(cand, key=lambda r: -r["기대값"])[:pool_size] if a.target else cand[:pool_size]
    game = lambda r: (r["회차"], r["경기"], r["시각"])  # 같은 경기의 일반·핸디캡은 한 조합에 같이 못 넣는다
    sizes = [a.combo] if a.combo else range(1, max_legs + 1)
    out = []
    for n in sizes:
        for c in combinations(cand, n):
            if n == 1 and not c[0].get("단식"):
                continue
            if len({game(r) for r in c}) < n:
                continue
            odds = floor(prod(r["베트맨"] for r in c) * 100) / 100
            if a.target and odds < a.target:
                continue
            hit = prod(r["공정확률"] / 100 for r in c)
            out.append((hit, odds, c))
    if not out:
        print("\n조건에 맞는 조합이 없습니다 (후보 경기 수나 목표 배당을 확인).")
        return
    out.sort(key=lambda x: (-x[0], -x[1]))
    title = f"{a.combo}경기 조합" if a.combo else f"합계 배당 {a.target} 이상 조합"
    print(f"\n[{title} — 적중 확률 순, {a.stake:,}원 기준]")
    for i, (hit, odds, c) in enumerate(out[:top], 1):
        legs = " + ".join(f"{leg_name(r)}{'*' if '역산모델' in r['매칭'] else ''}({r['공정확률']:.0f}%·{r['베트맨']})" for r in c)
        tag = " (한 경기 구매 — 베트맨에서 가능 여부 확인)" if len(c) == 1 else ""
        print(f"{i:>2}. 적중 {hit*100:5.1f}% | 배당 {odds:>6.2f} | 적중 시 {round(a.stake*odds):>9,}원 | 기대값 {hit*odds:.3f} | {legs}{tag}")
    print("※ 기대값 = 적중 확률 × 합계 배당. 경기 수가 늘수록 (경기당 약 0.88)^N 으로 떨어진다. 경기끼리 독립으로 가정.\n"
          "※ * 표시 = Pinnacle에 그 핸디캡 라인이 없어 승무패·언더오버로 기대득점을 역산해 계산한 확률.")


if __name__ == "__main__":
    main()
