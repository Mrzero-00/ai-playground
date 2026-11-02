#!/usr/bin/env python3
"""구단 좌표·구단 간 거리 — 홈 이점을 리그 상수가 아니라 **경기별 이동 거리**로 본다.

사용자 가설 2026-11-03:
  "홈 이점은 관중도 있지만 위치도 있을 것 같다. 이동하냐 안 하냐의 차이인 거지.
   중요한 건 구단 간의 거리 정보를 아는 것 아닐까."

맞는 지적이다. 홈 이점은 관중·익숙함·이동 셋이 섞여 있는데 **이동만 경기마다 다르다.**
같은 리그라도 원정 300km 와 1,500km+시차는 다르고, 유럽대항전은 노르웨이↔터키까지 간다.
그런데 우리 기준선은 홈 이점을 **리그 단위 상수**로 넣고 있고(euro_baseline par['home_adv']),
시장도 리그 평균을 쓸 가능성이 크다. 그렇다면 거리는 **가격에 안 들어간 정보**다.

좌표는 ESPN 경기 요약의 경기장(gameInfo.venue)을 Open-Meteo 지오코딩으로 옮겨 캐시한다.
  data/teamdb/venues.json   팀 → {lat, lon, venue, city, source}

    python3 scripts/geo.py build              # 캐시 채우기(있는 것은 건너뜀)
    python3 scripts/geo.py build --league eng.1
    python3 scripts/geo.py dist --home Arsenal --away "Bayern Munich"
    python3 scripts/geo.py report             # 채워진 정도
"""
import argparse, json, math, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, HERE)
CACHE = os.path.join(ROOT, "data", "teamdb", "venues.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/129.0 Safari/537.36"
_last = [0.0]


def curl(url, timeout=25, gap=0.35):
    w = gap - (time.time() - _last[0])
    if w > 0:
        time.sleep(w)
    _last[0] = time.time()
    try:
        out = subprocess.run(["curl", "-s", "--compressed", "-m", str(timeout), "-A", UA, url],
                             capture_output=True, text=True, timeout=timeout + 5).stdout
        return json.loads(out) if out.strip().startswith(("{", "[")) else None
    except Exception:
        return None


def load():
    if os.path.exists(CACHE):
        try:
            return json.load(open(CACHE, encoding="utf-8"))
        except Exception:
            pass
    return {}


def save(d):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(d, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)


# 나라를 안 주면 동명 도시가 잡힌다 — 2026-11-03 첫 수집에서 Liverpool 이 캐나다,
# Aston Villa 가 시카고로 찍혀 리버풀↔맨시티가 4,536km 로 나왔다(실제 50km).
CC = {"England": "GB", "Scotland": "GB", "Wales": "GB", "Spain": "ES", "Italy": "IT",
      "Germany": "DE", "France": "FR", "Japan": "JP", "USA": "US", "United States": "US",
      "Canada": "CA", "Netherlands": "NL", "Portugal": "PT", "Belgium": "BE", "Turkey": "TR",
      "Austria": "AT", "Switzerland": "CH", "Norway": "NO", "Denmark": "DK", "Greece": "GR",
      "Korea": "KR", "South Korea": "KR"}


def geocode(name, country=None):
    """이름 → 좌표. 나라를 주면 그 나라 안에서만 고른다(동명 도시 방지)."""
    if not name:
        return None, None
    q = str(name).replace(" ", "+")
    cc = CC.get((country or "").strip())
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={q}&count=10&language=en&format=json"
    j = curl(url)
    rs = (j or {}).get("results") or []
    if cc:
        hit = [r for r in rs if r.get("country_code") == cc]
        rs = hit or []          # 나라를 알면 다른 나라 결과는 버린다 — 틀린 좌표보다 빈칸이 낫다
    r = rs[0] if rs else None
    return (float(r["latitude"]), float(r["longitude"])) if r else (None, None)


def haversine(a, b):
    """두 좌표 사이 대권 거리(km)."""
    if not (a and b) or None in a or None in b:
        return None
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(h)))


def cmd_build(a):
    import teamdb as T
    d = load()
    codes = list(T.LEAGUES.values()) + list(getattr(T, "ESPN_ONLY", {}).values())
    if a.league:
        codes = [c for c in codes if c == a.league]
    added = skipped = failed = 0
    for code in codes:
        db = T.jload(os.path.join(T.DB, "espn", f"{code}.json"), {})
        # 팀 → 그 팀이 홈이었던 경기 하나
        home_evt = {}
        for eid, e in db.items():
            h = (e.get("home") or {}).get("team")
            if h and h not in home_evt:
                home_evt[h] = eid
        print(f"{code}: 홈 경기가 있는 팀 {len(home_evt)}")
        for team, eid in home_evt.items():
            if team in d and d[team].get("lat") is not None:
                skipped += 1
                continue
            s = curl(f"https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event={eid}")
            v = ((s or {}).get("gameInfo") or {}).get("venue") or {}
            addr = v.get("address") or {}
            lat = lon = None
            ctry = addr.get("country") or ""
            for nm in (addr.get("city"), v.get("fullName")):
                if nm:
                    lat, lon = geocode(nm, ctry)
                    if lat is not None:
                        break
            if lat is None:
                failed += 1
                print(f"   ✗ {team}")
                continue
            d[team] = {"lat": lat, "lon": lon, "venue": v.get("fullName", ""),
                       "city": addr.get("city", ""), "country": addr.get("country", ""),
                       "source": f"espn:{code}"}
            added += 1
        save(d)
    print(f"\n좌표 추가 {added} · 이미 있음 {skipped} · 실패 {failed} · 캐시 {len(d)}팀")
    print(f"→ {CACHE}")
    return 0


def coords(team, d=None):
    d = d if d is not None else load()
    v = d.get(team)
    if v and v.get("lat") is not None:
        return (v["lat"], v["lon"])
    return None


def cmd_dist(a):
    d = load()
    h, w = coords(a.home, d), coords(a.away, d)
    if not h:
        print(f"'{a.home}' 좌표 없음", file=sys.stderr); return 1
    if not w:
        print(f"'{a.away}' 좌표 없음", file=sys.stderr); return 1
    km = haversine(h, w)
    print(f"{a.home} ({d[a.home].get('city','')}) ↔ {a.away} ({d[a.away].get('city','')})  {km:.0f} km")
    return 0


def cmd_report(a):
    d = load()
    ok = sum(1 for v in d.values() if v.get("lat") is not None)
    print(f"캐시 {len(d)}팀 · 좌표 있음 {ok}")
    by = {}
    for t, v in d.items():
        by.setdefault(v.get("source", "?"), []).append(t)
    for s in sorted(by, key=lambda k: -len(by[k])):
        print(f"  {s:<16} {len(by[s])}팀")
    return 0


def cmd_check(a):
    """같은 리그 팀끼리의 거리로 좌표가 말이 되는지 본다. 리그 안에서 2,000km 가 넘으면 의심."""
    d = load()
    by = {}
    for t, v in d.items():
        by.setdefault(v.get("source", "?"), []).append(t)
    bad = 0
    for src, ts in sorted(by.items()):
        if len(ts) < 4 or src.endswith("usa.1"):      # MLS 는 실제로 대륙 횡단이라 제외
            continue
        pairs = []
        for i in range(len(ts)):
            for j in range(i + 1, len(ts)):
                km = haversine(coords(ts[i], d), coords(ts[j], d))
                if km is not None:
                    pairs.append((km, ts[i], ts[j]))
        if not pairs:
            continue
        pairs.sort(reverse=True)
        mx = pairs[0]
        flag = " ← 의심" if mx[0] > 2000 else ""
        print(f"  {src:<16} 팀 {len(ts):2d}  최대거리 {mx[0]:6.0f}km ({mx[1]} ↔ {mx[2]}){flag}")
        if flag:
            bad += 1
    print(f"\n의심 리그 {bad}개")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("build"); p.add_argument("--league"); p.set_defaults(f=cmd_build)
    p = s.add_parser("dist"); p.add_argument("--home", required=True); p.add_argument("--away", required=True)
    p.set_defaults(f=cmd_dist)
    s.add_parser("report").set_defaults(f=cmd_report)
    s.add_parser("check").set_defaults(f=cmd_check)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
