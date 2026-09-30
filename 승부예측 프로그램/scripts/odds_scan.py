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

팀 이름 매칭
- 킥오프 시각(±3분)과 종목이 같은 Pinnacle 경기를 후보로 잡고, data/team_names.json(한글→영문)으로 확인한다.
- 후보가 하나뿐이면 이름이 없어도 매칭하되 '시간만 일치'로 표시한다. 매칭 실패 경기는 --all로 보고
  data/team_names.json에 이름을 추가하면 다음부터 잡힌다.

주의
- 승무패(3-way)·승패(2-way)만 비교한다. 핸디캡·언더오버는 v1에서 제외.
- 축구 '승패'형은 무승부 시 적중특례(배당 1.0). Pinnacle 2-way(무 환불)와 같은 조건이다.
- 기대값 1.0 이상이어도 표본이 적으면 우연일 수 있다. 예측기록.csv에 남겨 CLV(마감 배당 대비)로 검증한다.
"""
import argparse, csv, datetime as dt, json, os, re, subprocess, sys, time

sys.path.insert(0, os.path.dirname(__file__))
from devig import shin  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
NAMES_PATH = os.path.join(ROOT, "data", "team_names.json")
UA = "Mozilla/5.0"
PIN_KEY = "CmX2KcMrXuFmNg6YFbmTxE0y9CIrOi0R"  # Pinnacle 공개 게스트 키 (사이트 프론트엔드가 쓰는 값)
SPORTS = {"SC": 29, "BS": 3, "BK": 4, "VL": 34, "IH": 19}  # 베트맨 itemCode → Pinnacle sport id
KST = dt.timezone(dt.timedelta(hours=9))


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
    games = []
    for r in rounds:
        body = json.dumps({"gmId": "G101", "gmTs": r["gmTs"], "gameYear": r["gmOsidTsYear"], **sbm})
        d = curl("https://www.betman.co.kr/buyPsblGame/gameInfoInq.do", hdr, body, cookie)
        cs = d["compSchedules"]
        for row in cs["datas"]:
            g = dict(zip(cs["keys"], row))
            bt = g.get("betTypNm") or ""
            if g["itemCode"] not in SPORTS or not g.get("winAllot") or g["homeName"] == "미정":
                continue
            if bt not in ("승무패", "일반 승패", "승패"):
                continue
            if g.get("handi") or g.get("winHandi") or g.get("loseHandi"):
                continue  # 핸디캡 붙은 승무패는 비교 대상 아님
            if "전반" in (g.get("betNm") or "") or "후반" in (g.get("betNm") or ""):
                continue  # 전반전 승무패 등은 경기 전체 배당과 비교하면 안 됨
            games.append({
                "회차": r["gmOsidTs"], "번호": g["matchSeq"], "종목": g["itemCode"], "리그": g["leagueName"],
                "시각": dt.datetime.fromtimestamp(g["gameDate"] / 1000, dt.timezone.utc),
                "홈": g["homeName"], "원정": g["awayName"], "유형": bt, "betNm": g.get("betNm"),
                "배당": [g["winAllot"], g["drawAllot"] if bt == "승무패" else None, g["loseAllot"]],
            })
    return rounds, games


# ---------------------------------------------------------------- Pinnacle
def american_to_decimal(p):
    return 1 + p / 100 if p > 0 else 1 + 100 / abs(p)


def pinnacle(sport_id):
    hdr = [f"X-API-Key: {PIN_KEY}", "Accept: application/json"]
    mt = curl(f"https://guest.api.arcadia.pinnacle.com/0.1/sports/{sport_id}/matchups?withSpecials=false", hdr)
    mk = curl(f"https://guest.api.arcadia.pinnacle.com/0.1/sports/{sport_id}/markets/straight?primaryOnly=true", hdr)
    prices = {}
    for m in mk:
        if m.get("type") == "moneyline" and m.get("period") == 0 and m.get("status") == "open":
            prices[m["matchupId"]] = {p["designation"]: american_to_decimal(p["price"]) for p in m["prices"]}
    out = []
    for t in mt:
        if t.get("type") != "matchup" or t.get("parentId") or t["id"] not in prices:
            continue
        home = next((p["name"] for p in t["participants"] if p.get("alignment") == "home"), t["participants"][0]["name"])
        away = next((p["name"] for p in t["participants"] if p.get("alignment") == "away"), t["participants"][-1]["name"])
        out.append({"id": t["id"], "리그": t["league"]["name"], "홈": home, "원정": away,
                    "시각": dt.datetime.fromisoformat(t["startTime"].replace("Z", "+00:00")), "배당": prices[t["id"]]})
    return out


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
    rounds, games = betman(cookie)
    if not games:
        print("베트맨에 배당이 나온 프로토 경기가 없습니다.")
        return
    print("판매 중 회차: " + ", ".join(f"{r['gmOsidTs']}회(마감 {dt.datetime.fromtimestamp(r['saleEndDate']/1000, KST):%m-%d %H:%M})" for r in rounds))
    pins = {}
    for code, sid in SPORTS.items():
        if any(g["종목"] == code for g in games):
            pins[code] = pinnacle(sid)
    names = load_names()
    rows = []
    for g, p, how, ncand in match(games, pins, names):
        base = {"회차": g["회차"], "번호": g["번호"], "시각": g["시각"].astimezone(KST).strftime("%m-%d %H:%M"), "리그": g["리그"],
                "경기": f"{g['홈']} vs {g['원정']}", "유형": g["유형"], "매칭": how}
        if not p:
            if a.all:
                rows.append({**base, "선택": "", "베트맨": "", "Pinnacle": "", "공정확률": "", "기대값": "", "후보": ncand})
            continue
        three = g["유형"] == "승무패"
        f = fair(p["배당"], three)
        if not f:
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
            rows.append({**base, "Pinnacle경기": f"{p['홈']} vs {p['원정']}", "선택": lab, "베트맨": o,
                         "Pinnacle": round(p["배당"][key], 2), "공정확률": round(probs[key] * 100, 1),
                         "기대값": round(ev, 3), "Pin마진%": round(margin, 1)})
    rows.sort(key=lambda r: -(r["기대값"] if r["기대값"] != "" else -1))
    if not rows:
        print("표시할 경기가 없습니다.")
        return
    cols = ["회차", "번호", "시각", "리그", "경기", "선택", "베트맨", "Pinnacle", "공정확률", "기대값", "매칭"]
    w = {c: max(len(c), *(len(str(r.get(c, ""))) for r in rows)) for c in cols}
    print(" | ".join(c.ljust(w[c]) for c in cols))
    for r in rows:
        flag = " ★ +EV" if r["기대값"] != "" and r["기대값"] >= 1.0 else ("  근접" if r["기대값"] != "" and r["기대값"] >= 0.95 else "")
        print(" | ".join(str(r.get(c, "")).ljust(w[c]) for c in cols) + flag)
    n_plus = sum(1 for r in rows if r["기대값"] != "" and r["기대값"] >= 1.0)
    print(f"\n비교 {len(rows)}건 / 기대값 1.0 이상 {n_plus}건. 매칭 실패는 --all 로 확인하고 data/team_names.json 에 이름을 추가한다.")
    if a.save:
        out = os.path.join(ROOT, "회차별분석", f"배당스캔_{dt.datetime.now(KST):%Y-%m-%d_%H%M}.csv")
        with open(out, "w", encoding="utf-8", newline="") as fh:
            wr = csv.DictWriter(fh, fieldnames=sorted({k for r in rows for k in r}))
            wr.writeheader(); wr.writerows(rows)
        print("저장:", out)


if __name__ == "__main__":
    main()
