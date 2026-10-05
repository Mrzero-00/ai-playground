#!/usr/bin/env python3
"""
배당 스캔: 베트맨 프로토 승부식 배당(승무패·승패·핸디캡·언더오버·승N패·전반)을 Pinnacle(해외 최저 마진) 공정 확률과
비교해 기대값(베트맨 배당 × 공정 확률)이 1 이상인 선택지를 찾는다.

원리
- Pinnacle 배당에서 마진을 빼면(Shin) 실제 확률에 가장 가까운 값이 나온다 (백테스트: RPS 0.1936, 시장이 천장).
- 베트맨은 환급률 약 88%로 배당을 짜게 주지만, 결장·라인업 뉴스 뒤에 배당을 늦게 고친다.
- 그래서 대부분 기대값 0.85~0.90이고, 가끔 베트맨이 늦은 선택지만 1.0을 넘는다. 그것만 산다.
- 핸디캡·언더오버는 베트맨이 라인을 직접 정하는 영역이라 승무패보다 가격 오류 여지가 크다 (2026-10-01 추가).

비교 방법 (근거 열)
- 직접: Pinnacle에 같은 기간·같은 라인의 마켓이 있을 때. 2-way는 Shin 마진 제거. 가장 신뢰.
- 파생: 정수 핸디캡 3-way(승/무/패)와 승N패처럼 Pinnacle에 없는 상품은 반점 스프레드에서 조립한다.
    핸디 h(홈 기준)일 때  승 = P(점수차 > -h) = 홈 (h-0.5) 커버,  패 = 1 - P(점수차 > -h-1) = 1 - 홈 (h+0.5) 커버,  무 = 나머지
    승N패(야구)            승 = 홈 -1.5 커버, 패 = 1 - 홈 +1.5 커버, 1점차 = 나머지
- 모델: 축구에서 필요한 스프레드가 없을 때만 Dixon-Coles(승무패+언더오버로 λ 역산)로 계산. 신뢰 가장 낮음.

사용법
  python3 scripts/odds_scan.py                 # 판매 중인 프로토 회차 전부
  python3 scripts/odds_scan.py --min-ev 0.95   # 0.95 이상만 표시
  python3 scripts/odds_scan.py --types 핸디캡,언더오버   # 유형 필터 (승무패, 승패, 핸디캡, 언더오버, 승N패)
  python3 scripts/odds_scan.py --all           # 매칭 실패 경기까지 전부 표시
  python3 scripts/odds_scan.py --save          # 회차별분석/배당스캔_YYYY-MM-DD_HHMM.csv 저장
  python3 scripts/odds_scan.py --loop 10       # 10분마다 다시 스캔해 기대값 1.0 이상만 출력 (Ctrl+C로 종료)
  python3 scripts/odds_scan.py --lambda --min-ev 9  # 경기별 기대 득점·실점 + 핸디캡/언더오버 확률 사다리만 보기

팀 이름 매칭
- 킥오프 시각(±3분)과 종목이 같은 Pinnacle 경기를 후보로 잡고, data/team_names.json(한글→영문)으로 확인한다.
- 후보가 하나뿐이면 이름이 없어도 매칭하되 '시간만 일치'로 표시한다. 매칭 실패 경기는 --all로 보고
  data/team_names.json에 이름을 추가하면 다음부터 잡힌다.

주의
- 홀짝·더블찬스·첫득점팀 등 Pinnacle에 대응 마켓이 없는 유형은 제외. 베트맨 배당이 1.0/1.0인 경기는 미확정이라 제외.
- 축구 '승패'형과 야구 승패는 무승부 시 적중특례(배당 1.0). Pinnacle 2-way(무 환불)와 같은 조건이다.
- 전반: 축구 전반전 = Pinnacle period 1, 야구 전반(1~5회) = Pinnacle period 1(1st 5 innings). 배구는 전반 없음.
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
TYPES = ("승무패", "승패", "핸디캡", "언더오버", "승N패")


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
def classify(g):
    """베트맨 행 → (유형, 기간, 라인, 선택지 목록[(라벨, 배당)]) 또는 None."""
    bt, bn = g.get("betTypNm") or "", g.get("betNm") or ""
    period = 1 if "전반" in bn else 0
    w, d, l = g.get("winAllot") or 0, g.get("drawAllot") or 0, g.get("loseAllot") or 0
    if not w or not l or (w == 1.0 and l == 1.0):
        return None
    if bt == "승무패":
        if not d:
            return None
        return "승무패", period, None, [("승", w), ("무", d), ("패", l)]
    if bt in ("일반 승패", "승패"):
        return "승패", period, None, [("승", w), ("패", l)]
    if bt == "일반 정수핸디캡":
        h = g.get("winHandi")
        if h is None or not d:
            return None
        return "핸디캡", period, float(h), [("승", w), ("무", d), ("패", l)]
    if bt in ("일반 소수핸디캡", "일반 세트핸디캡"):
        h = g.get("winHandi")
        if h is None:
            return None
        return "핸디캡", period, float(h), [("승", w), ("패", l)]
    if bt == "일반 언더오버":
        ln = g.get("winHandi")
        if ln is None:
            return None
        return "언더오버", period, float(ln), [("언더", w), ("오버", l)]
    if bt == "승N패":
        return "승N패", period, None, [("승", w), ("1점차", d), ("패", l)]
    return None


def betman(cookie):
    url = "https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId=G101"
    hdr = ["Content-Type: application/json; charset=UTF-8", "Accept: application/json",
           "X-Requested-With: XMLHttpRequest", "Origin: https://www.betman.co.kr", f"Referer: {url}"]
    subprocess.run(["curl", "-sS", "-m", "30", "-A", UA, "-c", cookie, "-o", "/dev/null", url])
    sbm = {"_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}
    lst = curl("https://www.betman.co.kr/buyPsblGame/inqCacheBuyAbleGameInfoList.do", hdr, json.dumps(sbm), cookie)
    rounds = [g for g in lst.get("protoGames", []) if g["gmId"] == "G101"]
    bets = []
    for r in rounds:
        body = json.dumps({"gmId": "G101", "gmTs": r["gmTs"], "gameYear": r["gmOsidTsYear"], **sbm})
        d = curl("https://www.betman.co.kr/buyPsblGame/gameInfoInq.do", hdr, body, cookie)
        cs = d["compSchedules"]
        for row in cs["datas"]:
            g = dict(zip(cs["keys"], row))
            if g["itemCode"] not in SPORTS or g["homeName"] == "미정":
                continue
            c = classify(g)
            if not c:
                continue
            typ, period, line, opts = c
            if period == 1 and g["itemCode"] == "VL":
                continue
            bets.append({
                "회차": r["gmOsidTs"], "번호": g["matchSeq"], "종목": g["itemCode"], "리그": g["leagueName"],
                "시각": dt.datetime.fromtimestamp(g["gameDate"] / 1000, dt.timezone.utc),
                "홈": g["homeName"], "원정": g["awayName"], "유형": typ, "기간": period, "라인": line, "선택지": opts,
                "gameKey": g.get("gameKey"),
            })
    return rounds, bets


# ---------------------------------------------------------------- Pinnacle
def american_to_decimal(p):
    return 1 + p / 100 if p > 0 else 1 + 100 / abs(p)


def _hdr():
    return [f"X-API-Key: {PIN_KEY}", "Accept: application/json"]


def pinnacle(sport_id):
    """종목 전체 경기 목록 + 메인 머니라인 (매칭용)."""
    mt = curl(f"https://guest.api.arcadia.pinnacle.com/0.1/sports/{sport_id}/matchups?withSpecials=false", _hdr())
    mk = curl(f"https://guest.api.arcadia.pinnacle.com/0.1/sports/{sport_id}/markets/straight?primaryOnly=true", _hdr())
    has = {m["matchupId"] for m in mk if m.get("period") == 0 and m.get("status") == "open"}
    prices = {}
    for m in mk:
        if m.get("type") == "moneyline" and m.get("period") == 0 and m.get("status") == "open":
            prices[m["matchupId"]] = {p["designation"]: american_to_decimal(p["price"]) for p in m["prices"]}
    out = []
    for t in mt:
        if t.get("type") != "matchup" or t.get("parentId") or t["id"] not in has:
            continue
        home = next((p["name"] for p in t["participants"] if p.get("alignment") == "home"), t["participants"][0]["name"])
        away = next((p["name"] for p in t["participants"] if p.get("alignment") == "away"), t["participants"][-1]["name"])
        out.append({"id": t["id"], "리그": t["league"]["name"], "홈": home, "원정": away,
                    "시각": dt.datetime.fromisoformat(t["startTime"].replace("Z", "+00:00")), "배당": prices.get(t["id"], {})})
    return out


_MK_CACHE = {}


def markets(matchup_id):
    """경기 하나의 전체 마켓(모든 라인, period 0·1).
    반환: {(period,'ml'): {home,draw?,away}, (period,'spread'): {홈포인트: {home,away}}, (period,'total'): {라인: {over,under}}}"""
    if matchup_id in _MK_CACHE:
        return _MK_CACHE[matchup_id]
    mk = curl(f"https://guest.api.arcadia.pinnacle.com/0.1/matchups/{matchup_id}/markets/related/straight", _hdr())
    res = {}
    for m in mk:
        if m.get("matchupId") != matchup_id or m.get("status") != "open" or m.get("period") not in (0, 1):
            continue
        pr = {p["designation"]: american_to_decimal(p["price"]) for p in m["prices"]}
        if m["type"] == "moneyline" and "home" in pr and "away" in pr:
            res[(m["period"], "ml")] = pr
        elif m["type"] == "spread" and "home" in pr and "away" in pr:
            pts = next((p.get("points") for p in m["prices"] if p["designation"] == "home"), None)
            if pts is not None:
                res.setdefault((m["period"], "spread"), {})[float(pts)] = pr
        elif m["type"] == "total" and "over" in pr and "under" in pr:
            pts = m["prices"][0].get("points")
            if pts is not None:
                res.setdefault((m["period"], "total"), {})[float(pts)] = pr
    _MK_CACHE[matchup_id] = res
    return res


def fair2(a, b):
    p, _ = shin([1 / a, 1 / b])
    return p[0], p[1]


def fair3(pr):
    p, _ = shin([1 / pr["home"], 1 / pr["draw"], 1 / pr["away"]])
    return p


def cover(mk, period, s):
    """P(홈 점수차 + s > 0) : 홈 포인트 s(반점) 스프레드에서. 없으면 None."""
    sp = mk.get((period, "spread"), {})
    if s in sp:
        return fair2(sp[s]["home"], sp[s]["away"])[0]
    return None


# ---------------------------------------------------------------- 모델 (축구 폴백)
def _pois(k, lam):
    return math.exp(-lam) * lam ** k / math.factorial(k)


def _tau(i, j, lh, la, rho=-0.13):
    if i == 0 and j == 0: return 1 - lh * la * rho
    if i == 0 and j == 1: return 1 + lh * rho
    if i == 1 and j == 0: return 1 + la * rho
    if i == 1 and j == 1: return 1 - rho
    return 1.0


def _matrix(lh, la, n=10):
    m = [[_pois(i, lh) * _pois(j, la) * _tau(i, j, lh, la) for j in range(n)] for i in range(n)]
    s = sum(map(sum, m))
    return [[v / s for v in row] for row in m]


_FIT_CACHE = {}


def fit_soccer(mk, period, key):
    """승무패 + 언더오버 라인들에 맞는 (λ홈, λ원정). 데이터 없으면 None."""
    if (key, period) in _FIT_CACHE:
        return _FIT_CACHE[(key, period)]
    ml = mk.get((period, "ml"))
    tots = mk.get((period, "total"), {})
    if not ml or "draw" not in ml:
        _FIT_CACHE[(key, period)] = None
        return None
    pr = fair3(ml)
    tl = [(ln, fair2(v["over"], v["under"])[0]) for ln, v in tots.items()]
    best = None
    hi = 3.0 if period == 0 else 1.8
    steps = int(hi / 0.05)
    for i in range(1, steps + 1):
        for j in range(1, steps + 1):
            lh, la = i * 0.05, j * 0.05
            m = _matrix(lh, la)
            w = sum(m[a][b] for a in range(10) for b in range(10) if a > b)
            l = sum(m[a][b] for a in range(10) for b in range(10) if a < b)
            e = (w - pr[0]) ** 2 + (l - pr[2]) ** 2
            if tl:
                e += sum((sum(m[a][b] for a in range(10) for b in range(10) if a + b > ln) - po) ** 2 for ln, po in tl) / len(tl)
            if best is None or e < best[0]:
                best = (e, _matrix(lh, la))
    _FIT_CACHE[(key, period)] = best[1]
    return best[1]


def margin_probs(m, h):
    """점수 행렬 → 핸디 h 적용 승/무/패."""
    w = d = l = 0.0
    for a in range(len(m)):
        for b in range(len(m)):
            x = a - b + h
            if x > 0: w += m[a][b]
            elif x == 0: d += m[a][b]
            else: l += m[a][b]
    return [w, d, l]


def fit_generic(mk, period, key, hi):
    """2-way 머니라인(또는 스프레드 0) + 토탈 라인으로 (λ홈, λ원정) 역산. 야구·배구는 포아송 근사(실제 분포는 더 퍼져 있음)."""
    if (key, period, "g") in _FIT_CACHE:
        return _FIT_CACHE[(key, period, "g")]
    ml = mk.get((period, "ml"))
    sp = mk.get((period, "spread"), {})
    tots = mk.get((period, "total"), {})
    if ml and "draw" not in ml:
        ph = fair2(ml["home"], ml["away"])[0]
    elif 0.0 in sp:
        ph = fair2(sp[0.0]["home"], sp[0.0]["away"])[0]
    else:
        _FIT_CACHE[(key, period, "g")] = None
        return None
    tl = [(ln, fair2(v["over"], v["under"])[0]) for ln, v in tots.items()]
    if not tl:
        _FIT_CACHE[(key, period, "g")] = None
        return None
    best = None
    step = hi / 40
    n = 16 if hi > 6 else 12
    for i in range(1, 41):
        for j in range(1, 41):
            lh, la = i * step, j * step
            m = [[_pois(a, lh) * _pois(b, la) for b in range(n)] for a in range(n)]
            w = sum(m[a][b] for a in range(n) for b in range(n) if a > b)
            l = sum(m[a][b] for a in range(n) for b in range(n) if a < b)
            e = (w / (w + l) - ph) ** 2 + sum((sum(m[a][b] for a in range(n) for b in range(n) if a + b > ln) - po) ** 2 for ln, po in tl) / len(tl)
            if best is None or e < best[0]:
                best = (e, lh, la, m)
    _FIT_CACHE[(key, period, "g")] = (best[1], best[2], best[3])
    return _FIT_CACHE[(key, period, "g")]


def lambda_of(m):
    n = len(m)
    return sum(a * m[a][b] for a in range(n) for b in range(n)), sum(b * m[a][b] for a in range(n) for b in range(n))


def ladder(bet_game, mk, key):
    """경기 하나의 기대 득점·실점과 핸디캡/언더오버 확률 사다리 문자열."""
    out = []
    for period in (0, 1):
        if bet_game["종목"] == "SC":
            m = fit_soccer(mk, period, key)
            tag = "DC"
        else:
            r = fit_generic(mk, period, key, 12.0 if bet_game["종목"] == "BS" else 6.0)
            m = r[2] if r else None
            tag = "포아송 근사"
        if not m:
            continue
        lh, la = lambda_of(m)
        n = len(m)
        tot = lh + la
        hs = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5] if bet_game["종목"] == "SC" else [-2.5, -1.5, 1.5, 2.5]
        hand = "  ".join(f"홈{h:+.1f} {sum(m[a][b] for a in range(n) for b in range(n) if a - b + h > 0) * 100:.0f}%" for h in hs)
        lines = [round(tot) - 1.5, round(tot) - 0.5, round(tot) + 0.5, round(tot) + 1.5] if bet_game["종목"] != "SC" else [1.5, 2.5, 3.5]
        over = "  ".join(f"오버{ln} {sum(m[a][b] for a in range(n) for b in range(n) if a + b > ln) * 100:.0f}%" for ln in lines if ln > 0)
        w = sum(m[a][b] for a in range(n) for b in range(n) if a > b)
        d = sum(m[a][a] for a in range(n))
        out.append(f"    [{'전반' if period else '전체'} {tag}] 기대득점 홈 {lh:.2f} / 원정 {la:.2f} (합 {tot:.2f})  승 {w*100:.0f}% 무 {d*100:.0f}% 패 {(1-w-d)*100:.0f}%\n"
                   f"      핸디캡: {hand}\n      언더오버: {over}")
    return "\n".join(out)


# ---------------------------------------------------------------- 평가
def evaluate(bet, mk, key):
    """베트맨 선택지별 공정 확률. 반환 (확률 리스트, 근거) 또는 None."""
    p, typ, line = bet["기간"], bet["유형"], bet["라인"]
    if typ == "승무패":
        ml = mk.get((p, "ml"))
        if ml and "draw" in ml:
            return fair3(ml), "직접"
        # 야구 전반 승무패 등: 반점 스프레드로 조립 (승 = 홈 -0.5 커버, 패 = 1 - 홈 +0.5 커버)
        w, lo = cover(mk, p, -0.5), cover(mk, p, 0.5)
        if w is not None and lo is not None:
            return [w, max(0.0, lo - w), 1 - lo], "파생"
        return None
    if typ == "승패":
        ml = mk.get((p, "ml"))
        if ml:
            if "draw" in ml:  # 축구 승패형: 무 환불 → 조건부
                pr = fair3(ml)
                s2 = pr[0] + pr[2]
                return [pr[0] / s2, pr[2] / s2], "직접"
            return list(fair2(ml["home"], ml["away"])), "직접"
        sp = mk.get((p, "spread"), {})
        if 0.0 in sp:  # 스프레드 0 = 무 환불 승패
            return list(fair2(sp[0.0]["home"], sp[0.0]["away"])), "직접"
        return None
    if typ == "언더오버":
        tt = mk.get((p, "total"), {})
        if line in tt:
            o, u = fair2(tt[line]["over"], tt[line]["under"])
            return [u, o], "직접"
        if bet["종목"] == "SC":
            m = fit_soccer(mk, p, key)
            if m:
                over = sum(m[a][b] for a in range(10) for b in range(10) if a + b > line)
                return [1 - over, over], "모델"
        return None
    if typ == "핸디캡":
        if len(bet["선택지"]) == 2:  # 반점 핸디캡 2-way
            c = cover(mk, p, line)
            if c is not None:
                return [c, 1 - c], "직접"
            if bet["종목"] == "SC":
                m = fit_soccer(mk, p, key)
                if m:
                    w, d, l = margin_probs(m, line)
                    return [w, l], "모델"
            return None
        # 정수 핸디캡 3-way
        w, lo = cover(mk, p, line - 0.5), cover(mk, p, line + 0.5)
        if w is not None and lo is not None:
            return [w, max(0.0, lo - w), 1 - lo], "파생"
        if bet["종목"] == "SC":
            m = fit_soccer(mk, p, key)
            if m:
                return margin_probs(m, line), "모델"
        return None
    if typ == "승N패":
        w, lo = cover(mk, p, -1.5), cover(mk, p, 1.5)
        if w is not None and lo is not None:
            return [w, max(0.0, lo - w), 1 - lo], "파생"
        return None
    return None


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
    if not cands and len(ko_key) >= 3:  # 베트맨이 팀명을 잘라서 보여줄 때(예: '베네수엘', '우크라이') 접두 일치로 찾는다
        pref = [v for k, v in names.items() if not k.startswith("_") and (k.startswith(ko_key) or ko_key.startswith(k))]
        cands = [c for v in pref for c in (v if isinstance(v, list) else [v])] or None
    if not cands:
        return None
    if isinstance(cands, str):
        cands = [cands]
    e = norm(en)
    return any(norm(c) in e or e in norm(c) for c in cands)


def clean_ko(s):
    return re.sub(r"_(남자|여자)$", "", s).replace("공화국", "").strip()


def match_one(g, pool, names, tol=180, tol_named=1200):
    wide = [p for p in pool if abs((p["시각"] - g["시각"]).total_seconds()) <= tol_named]
    near = [p for p in wide if abs((p["시각"] - g["시각"]).total_seconds()) <= tol]
    exact = []
    for p in wide:
        h, a = name_hit(names, clean_ko(g["홈"]), p["홈"]), name_hit(names, clean_ko(g["원정"]), p["원정"])
        if h and a:
            exact.append(p)
    if len(exact) == 1:
        return exact[0], "이름 일치", len(near)
    if len(exact) > 1:
        return None, f"후보 {len(exact)}개", len(near)
    if len(near) == 1:
        p = near[0]
        h, a = name_hit(names, clean_ko(g["홈"]), p["홈"]), name_hit(names, clean_ko(g["원정"]), p["원정"])
        if h is False or a is False:
            return None, "시간 일치·이름 불일치", len(near)
        return p, ("한 팀+시간" if (h or a) else "시간만 일치"), len(near)
    return None, "매칭 실패", len(near)


# ---------------------------------------------------------------- 메인
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-ev", type=float, default=0.0)
    ap.add_argument("--all", action="store_true", help="매칭 실패 경기도 표시")
    ap.add_argument("--save", action="store_true")
    ap.add_argument("--types", default="", help="쉼표 구분 유형 필터: " + ",".join(TYPES))
    ap.add_argument("--loop", type=int, default=0, help="N분마다 반복 스캔, +EV만 출력")
    ap.add_argument("--lambda", dest="lam", action="store_true", help="경기별 기대 득점·실점과 핸디캡/언더오버 확률 사다리 출력")
    a = ap.parse_args()
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
    rounds, bets = betman(cookie)
    want = [t.strip() for t in a.types.split(",") if t.strip()]
    if want:
        bets = [b for b in bets if b["유형"] in want]
    now = dt.datetime.now(dt.timezone.utc)
    bets = [b for b in bets if b["시각"] > now]
    if not bets:
        print("베트맨에 배당이 나온 프로토 경기가 없습니다.")
        return
    print("판매 중 회차: " + ", ".join(f"{r['gmOsidTs']}회(마감 {dt.datetime.fromtimestamp(r['saleEndDate']/1000, KST):%m-%d %H:%M})" for r in rounds))
    pins = {code: pinnacle(sid) for code, sid in SPORTS.items() if any(b["종목"] == code for b in bets)}
    names = load_names()
    # 경기 단위로 한 번만 매칭
    matched = {}
    for b in bets:
        key = (b["회차"], b["종목"], b["gameKey"], b["시각"])
        if key not in matched:
            matched[key] = match_one(b, pins[b["종목"]], names)
    rows = []
    for b in bets:
        key = (b["회차"], b["종목"], b["gameKey"], b["시각"])
        p, how, ncand = matched[key]
        base = {"회차": b["회차"], "번호": b["번호"], "시각": b["시각"].astimezone(KST).strftime("%m-%d %H:%M"), "리그": b["리그"],
                "경기": f"{b['홈']} vs {b['원정']}", "유형": ("전반 " if b["기간"] == 1 else "") + b["유형"],
                "라인": "" if b["라인"] is None else b["라인"], "매칭": how}
        if not p:
            if a.all:
                rows.append({**base, "선택": "", "베트맨": "", "공정확률": "", "기대값": "", "근거": "", "후보": ncand})
            continue
        ev_ = evaluate(b, markets(p["id"]), p["id"])
        if not ev_:
            if a.all:
                rows.append({**base, "선택": "", "베트맨": "", "공정확률": "", "기대값": "", "근거": "Pinnacle 마켓 없음", "Pinnacle경기": f"{p['홈']} vs {p['원정']}"})
            continue
        probs, src = ev_
        for (lab, odds), q in zip(b["선택지"], probs):
            ev = odds * q
            if ev < a.min_ev:
                continue
            rows.append({**base, "Pinnacle경기": f"{p['홈']} vs {p['원정']}", "선택": lab, "베트맨": odds,
                         "공정확률": round(q * 100, 1), "기대값": round(ev, 3), "근거": src})
    if a.lam:
        print("\n=== 경기별 기대 득점·실점 (Pinnacle 라인에서 역산) ===")
        seen = set()
        for b in bets:
            key = (b["회차"], b["종목"], b["gameKey"], b["시각"])
            p, how, _ = matched[key]
            if not p or key in seen:
                continue
            seen.add(key)
            lad = ladder(b, markets(p["id"]), p["id"])
            if lad:
                print(f"\n  {b['시각'].astimezone(KST):%m-%d %H:%M} {b['리그']} | {b['홈']} vs {b['원정']}")
                print(lad)
        print()
    rows.sort(key=lambda r: -(r["기대값"] if r["기대값"] != "" else -1))
    if not rows:
        print("표시할 경기가 없습니다.")
        return
    cols = ["회차", "번호", "시각", "리그", "경기", "유형", "라인", "선택", "베트맨", "공정확률", "기대값", "근거", "매칭"]
    w = {c: max(len(c), *(len(str(r.get(c, ""))) for r in rows)) for c in cols}
    print(" | ".join(c.ljust(w[c]) for c in cols))
    for r in rows:
        flag = " ★ +EV" if r["기대값"] != "" and r["기대값"] >= 1.0 else ("  근접" if r["기대값"] != "" and r["기대값"] >= 0.95 else "")
        print(" | ".join(str(r.get(c, "")).ljust(w[c]) for c in cols) + flag)
    n_cmp = sum(1 for r in rows if r["기대값"] != "")
    n_plus = sum(1 for r in rows if r["기대값"] != "" and r["기대값"] >= 1.0)
    by_src = {}
    for r in rows:
        if r["기대값"] != "":
            by_src[r["근거"]] = by_src.get(r["근거"], 0) + 1
    print(f"\n비교 {n_cmp}건 (근거: {by_src}) / 기대값 1.0 이상 {n_plus}건. 매칭 실패는 --all 로 확인하고 data/team_names.json 에 이름을 추가한다.")
    if a.save:
        out = os.path.join(ROOT, "회차별분석", f"배당스캔_{dt.datetime.now(KST):%Y-%m-%d_%H%M}.csv")
        with open(out, "w", encoding="utf-8", newline="") as fh:
            wr = csv.DictWriter(fh, fieldnames=sorted({k for r in rows for k in r}))
            wr.writeheader(); wr.writerows(rows)
        print("저장:", out)


if __name__ == "__main__":
    main()
