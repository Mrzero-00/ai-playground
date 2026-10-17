#!/usr/bin/env python3
"""경기 환경 입력 — 원정 이동거리 · 고도 차 · 킥오프 날씨 (2026-10-17, 사용자 지시 "앞으로 모든 경기에 추가해줘 — 거리, 고도, 날씨")
왜: 국내 원정 거리·고지대(멕시코·볼리비아·콜로라도 등)·비/강풍은 분석 체크리스트에만 있고 숫자로 수집되지 않았다(사간-오미야 900km 누락).
무엇:
  1) 구장 좌표 — Wikidata: 팀 검색(한국어 → 영문) → 홈구장(P115) → 좌표(P625). 캐시 data/venues.json (팀별 영구, 수동 수정 가능).
  2) 고도 — Open-Meteo elevation API(구장 좌표).
  3) 이동거리 — 원정팀 홈구장 → 경기 구장 대원거리(km). 고도 차 = 경기 구장 − 원정팀 홈구장(m).
  4) 날씨 — Open-Meteo forecast(킥오프 시각 1시간 단위): 기온·강수량·강수확률·풍속. 16일 이후 경기는 없음.
해석(분석가용 기준, 근거기록 '이동'·'고도'·'날씨' 유형으로 쌓아 30건+ 뒤 크기 조정):
  - 기준선의 리그 홈 이점에 '평균 이동'이 이미 들어 있다 → 리그 평균보다 크게 먼 원정(대략 800km+)·해외 원정 직후만 요인으로, ±1%p 이내.
  - 고도 차 +1,000m 이상(예: 멕시코시티 2,240m·키토·라파스·덴버)은 원정팀 체력 저하 요인 — 크기는 [관찰]로 시작.
  - 강수 2mm/h+·풍속 30km/h+는 득점 λ 하향 근거(언더오버), 야구는 우천 취소·지연 위험 표시.
사용:
  python3 scripts/venue_env.py --round 123 --date 10-17          # 그 날 전 종목 경기 → data/환경_123.json · 회차별분석/환경_123.md
  python3 scripts/venue_env.py --team "사간 도스"                   # 구장 조회 확인
  match_inputs.py 가 축구 경기마다 자동 호출해 INPUTS 줄에 붙인다.
  구장이 틀리면 data/venues.json 의 그 팀 항목을 고치고 "src":"수동" 으로 둔다(덮어쓰지 않음).
"""
import argparse, csv, datetime as dt, json, math, os, subprocess, sys, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VEN = os.path.join(ROOT, "data", "venues.json")
WX_DIR = os.path.join(ROOT, "data", "weather")
REC = os.path.join(ROOT, "전체경기기록.csv")
NAMES = os.path.join(ROOT, "data", "team_names.json")
UA = "Mozilla/5.0 (Macintosh) sports-research/1.0 (personal analysis; contact via github Mrzero-00)"
KST = dt.timezone(dt.timedelta(hours=9))
SPORT_HINT = {"축구": ("football", "soccer"), "야구": ("baseball",), "농구": ("basketball",), "배구": ("volleyball",)}


def curl_json(url, timeout=25, tries=4):
    """Wikidata 는 빠른 연속 요청을 잠깐 거절한다(2026-10-17 실측: 101팀 일괄 조회 중 빈 응답) — 간격·재시도."""
    for k in range(tries):
        if "wikidata" in url:
            time.sleep(0.4 + k * 1.5)
        out = subprocess.run(["curl", "-sS", "--compressed", "-m", str(timeout), "-A", UA, url], capture_output=True, text=True).stdout
        try:
            d = json.loads(out)
            if "wbsearchentities" in url and not d.get("search") and k < 1:
                continue        # 빈 검색은 한 번 더 확인
            return d
        except ValueError:
            continue
    return None


def load_venues():
    try:
        return json.load(open(VEN, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_venues(v):
    os.makedirs(os.path.dirname(VEN), exist_ok=True)
    json.dump(v, open(VEN, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)


# ------------------------------------------------------------ Wikidata
def wd_search(q, lang):
    u = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbsearchentities", "search": q, "language": lang, "uselang": lang, "format": "json", "limit": 7, "type": "item"})
    return (curl_json(u) or {}).get("search", [])


def wd_entity(qid):
    u = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    d = curl_json(u) or {}
    return (d.get("entities") or {}).get(qid) or {}


def claim_ids(ent, prop):
    out = []
    for c in (ent.get("claims") or {}).get(prop, []):
        v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value")
        if isinstance(v, dict) and v.get("id"):
            rank = c.get("rank", "normal")
            ended = any(q for q in (c.get("qualifiers") or {}).get("P582", []))   # 종료 시점 있는 옛 구장은 뒤로
            out.append((0 if rank == "preferred" else 1 if not ended else 2, v["id"]))
    return [i for _, i in sorted(out)]


def coord(ent):
    for c in (ent.get("claims") or {}).get("P625", []):
        v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value")
        if isinstance(v, dict) and "latitude" in v:
            return round(v["latitude"], 4), round(v["longitude"], 4)
    return None


def label(ent, langs=("ko", "en", "ja")):
    for l in langs:
        x = (ent.get("labels") or {}).get(l)
        if x:
            return x["value"]
    return ""


def find_team(ko, eng, sport):
    hints = SPORT_HINT.get(sport, ("football", "soccer"))
    cands = []
    for q, lang in ((ko, "ko"), (eng, "en")):
        if not q:
            continue
        for s in wd_search(q, lang):
            desc = (s.get("description") or "").lower()
            score = (2 if any(h in desc for h in hints) else 0) + (1 if "club" in desc or "team" in desc or "구단" in desc or "팀" in desc else 0)
            if any(w in desc for w in ("season", "시즌", "women", "여자", "reserve", "youth", "u-2", "u2")):
                score -= 3
            cands.append((score, s["id"]))
        if cands and max(cands)[0] >= 2:
            break
    for _, qid in sorted(cands, key=lambda x: -x[0]):
        ent = wd_entity(qid)
        for vid in claim_ids(ent, "P115"):           # 홈구장
            ven = wd_entity(vid)
            c = coord(ven)
            if c:
                return {"team_qid": qid, "venue": label(ven), "venue_qid": vid, "lat": c[0], "lon": c[1]}
        c = coord(ent)                                  # 구장 정보 없으면 구단 좌표(연고지)라도
        if c:
            return {"team_qid": qid, "venue": label(ent) + "(구단 좌표 — 구장 미확인)", "venue_qid": "", "lat": c[0], "lon": c[1]}
    return None


def elevation(lat, lon):
    d = curl_json(f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}") or {}
    e = d.get("elevation")
    return round(e[0]) if e else None


def team_venue(ko, eng="", sport="축구", cache=None, refresh=False):
    cache = load_venues() if cache is None else cache
    v = cache.get(ko)
    if v and v.get("src") == "수동":
        return v
    if v and not refresh and (v.get("venue") or v.get("checked") == dt.date.today().isoformat()):
        return v                                         # 못찾음은 하루 뒤 다시 시도
    f = find_team(ko, eng, sport)
    if not f:
        cache[ko] = {"venue": None, "src": "못찾음", "checked": dt.date.today().isoformat(), "eng": eng}
        return cache[ko]
    f["elev"] = elevation(f["lat"], f["lon"])
    f["src"] = f"Wikidata {f['team_qid']}→{f['venue_qid'] or '구단'} · Open-Meteo 고도"
    f["checked"] = dt.date.today().isoformat()
    cache[ko] = f
    return f


# ------------------------------------------------------------ 계산
def km(a, b):
    R = 6371.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp, dl = p2 - p1, math.radians(b["lon"] - a["lon"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(h)))


def weather(lat, lon, ko_kst):
    """킥오프 시각(KST datetime) 날씨. 과거 7일~앞 15일만."""
    today = dt.datetime.now(KST).date()
    if not (-7 <= (ko_kst.date() - today).days <= 15):
        return None
    day = ko_kst.date().isoformat()
    path = os.path.join(WX_DIR, f"{lat}_{lon}_{day}.json")
    d = None
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 3 * 3600:
        try:
            d = json.load(open(path, encoding="utf-8"))
        except ValueError:
            d = None
    if d is None:
        u = ("https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode({
            "latitude": lat, "longitude": lon, "timezone": "Asia/Seoul", "start_date": day, "end_date": day,
            "hourly": "temperature_2m,precipitation,precipitation_probability,wind_speed_10m,relative_humidity_2m"}))
        if (ko_kst.date() - today).days < 0:
            u += "&past_days=7"
        d = curl_json(u)
        if not d or "hourly" not in d:
            return None
        os.makedirs(WX_DIR, exist_ok=True)
        json.dump(d, open(path, "w", encoding="utf-8"))
    H = d["hourly"]; key = ko_kst.strftime("%Y-%m-%dT%H:00")
    if key not in H["time"]:
        return None
    i = H["time"].index(key)
    # 경기 2시간(킥오프~+2h) 중 최대 강수·풍속
    js = [j for j in range(i, min(i + 3, len(H["time"])))]
    def g(k, j):
        return (H.get(k) or [None] * len(H["time"]))[j]
    return {"기온": g("temperature_2m", i), "습도": g("relative_humidity_2m", i),
            "강수mm": round(sum((g("precipitation", j) or 0) for j in js), 1),
            "강수확률": max((g("precipitation_probability", j) or 0) for j in js),
            "풍속": max((g("wind_speed_10m", j) or 0) for j in js), "출처": "Open-Meteo forecast " + dt.datetime.now(KST).strftime("%m-%d %H:%M")}


def flags(env):
    f = []
    if env.get("이동km") is not None and env["이동km"] >= 800:
        f.append(f"장거리 원정 {env['이동km']}km")
    if env.get("고도차") is not None and env["고도차"] >= 1000:
        f.append(f"고지대 +{env['고도차']}m")
    w = env.get("날씨") or {}
    if w.get("강수mm", 0) >= 2 or w.get("강수확률", 0) >= 70:
        f.append(f"비 {w.get('강수mm')}mm({w.get('강수확률')}%)")
    if w.get("풍속", 0) >= 30:
        f.append(f"강풍 {w['풍속']}km/h")
    if w.get("기온") is not None and (w["기온"] >= 30 or w["기온"] <= 0):
        f.append(f"기온 {w['기온']}℃")
    return f


def match_env(home_ko, away_ko, ko_kst, home_eng="", away_eng="", sport="축구", cache=None, refresh=False):
    cache = load_venues() if cache is None else cache
    hv = team_venue(home_ko, home_eng, sport, cache, refresh)
    av = team_venue(away_ko, away_eng, sport, cache, refresh)
    env = {"구장": hv.get("venue"), "구장고도": hv.get("elev"), "원정홈": av.get("venue"), "원정홈고도": av.get("elev"),
           "이동km": None, "고도차": None, "날씨": None, "출처": [hv.get("src"), av.get("src")]}
    if hv.get("lat") is not None and av.get("lat") is not None:
        env["이동km"] = km(av, hv)
        if hv.get("elev") is not None and av.get("elev") is not None:
            env["고도차"] = hv["elev"] - av["elev"]
    if hv.get("lat") is not None and ko_kst:
        env["날씨"] = weather(hv["lat"], hv["lon"], ko_kst)
    env["주의"] = flags(env)
    return env


def fmt_env(env):
    if not env:
        return "환경 -"
    w = env.get("날씨") or {}
    ws = f"{w.get('기온')}℃ 강수{w.get('강수mm')}mm({w.get('강수확률')}%) 바람{w.get('풍속')}km/h" if w else "날씨 -"
    mv = f"이동 {env['이동km']}km" if env.get("이동km") is not None else "이동 ?(구장 미확인)"
    al = f"고도 {env.get('구장고도')}m(차 {env['고도차']:+}m)" if env.get("고도차") is not None else f"고도 {env.get('구장고도') or '?'}m"
    s = f"구장 {env.get('구장') or '?'} · {mv} · {al} · {ws}"
    if env.get("주의"):
        s += " · ⚠ " + ", ".join(env["주의"])
    return s


# ------------------------------------------------------------ 회차 전체
def kickoff_kst(r, now):
    try:
        m, rest = r["시각"].split("-", 1)
        d, hm = rest.split(" ")
        h, mi = hm.split(":")
        y = now.year if int(m) >= now.month - 6 else now.year + 1
        return dt.datetime(y, int(m), int(d), int(h), int(mi), tzinfo=KST)
    except (ValueError, KeyError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round"); ap.add_argument("--date"); ap.add_argument("--numbers")
    ap.add_argument("--team"); ap.add_argument("--sport", default="축구")
    ap.add_argument("--refresh", action="store_true", help="구장 캐시 다시 조회(수동 항목은 유지)")
    ap.add_argument("--all", action="store_true", help="결과 있는 경기도")
    ap.add_argument("--retry-missing", action="store_true", help="못찾음 팀만 다시 조회")
    a = ap.parse_args()
    cache = load_venues()
    if a.retry_missing:
        for k, v in list(cache.items()):
            if not v.get("venue") and v.get("src") != "수동":
                cache.pop(k); r = team_venue(k, v.get("eng", ""), "축구", cache)
                print(f"  {k}: {r.get('venue') or '못찾음'}"); save_venues(cache)
        if not a.round:
            return
    if a.team:
        print(json.dumps(team_venue(a.team, "", a.sport, cache, a.refresh), ensure_ascii=False, indent=1)); save_venues(cache); return
    if not a.round:
        sys.exit("--round 또는 --team")
    names = json.load(open(NAMES, encoding="utf-8")) if os.path.exists(NAMES) else {}
    now = dt.datetime.now(KST)
    nums = set(a.numbers.split(",")) if a.numbers else None
    rows = [r for r in csv.DictReader(open(REC, encoding="utf-8-sig")) if r["회차"] == str(a.round)
            and (a.all or r.get("결과", "") in ("", "예정")) and (not a.date or r["시각"].startswith(a.date)) and (not nums or r["번호"] in nums)]
    jp = os.path.join(ROOT, "data", f"환경_{a.round}.json")
    store = json.load(open(jp, encoding="utf-8")) if os.path.exists(jp) else {}
    L = [f"# {a.round}회 경기 환경 — 이동거리·고도·날씨 (수집 {now:%m-%d %H:%M})", "",
         "구장 = Wikidata 홈구장 좌표, 고도·날씨 = Open-Meteo. 이동 = 원정팀 홈구장→경기 구장 직선거리. ⚠ = 800km+·고도차 1,000m+·비 2mm/70%+·바람 30km/h+·기온 30℃+/0℃−.", "",
         "| 번호 | 시각 | 종목 | 경기 | 환경 |", "|---|---|---|---|---|"]
    for r in rows:
        ko = kickoff_kst(r, now)
        eh = str(names.get(r["홈"]) or ""); ea = str(names.get(r["원정"]) or "")
        try:
            env = match_env(r["홈"], r["원정"], ko, eh, ea, r["종목"], cache)
        except Exception as e:
            print(f"  ✗ {r['번호']} {r['홈']}-{r['원정']}: {e}", file=sys.stderr); continue
        env["수집"] = now.strftime("%m-%d %H:%M")
        store[r["번호"]] = {"경기": f"{r['홈']} - {r['원정']}", "시각": r["시각"], "종목": r["종목"], **env}
        L.append(f"| {r['번호']} | {r['시각']} | {r['종목']} | {r['홈']} - {r['원정']} | {fmt_env(env)} |")
        print(f"  {r['번호']} {r['홈']}-{r['원정']}: {fmt_env(env)}")
        save_venues(cache)
    os.makedirs(os.path.dirname(jp), exist_ok=True)
    json.dump(store, open(jp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    mp = os.path.join(ROOT, "회차별분석", f"환경_{a.round}.md")
    open(mp, "w", encoding="utf-8").write("\n".join(L) + "\n")
    miss = sorted(k for k, v in cache.items() if not v.get("venue"))
    print(f"→ {jp}\n→ {mp}" + (f"\n구장 못찾음 {len(miss)}팀(data/venues.json 수동 입력): {', '.join(miss[:15])}" if miss else ""))


if __name__ == "__main__":
    main()
