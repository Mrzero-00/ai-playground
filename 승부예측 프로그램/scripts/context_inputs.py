#!/usr/bin/env python3
"""심판·날씨 수집 (사용자 지시 2026-10-22, 개선안 5번).

왜 — 둘 다 무승부와 총득점에 직접 걸리는데 지금은 어쩌다 한 경기 근거에만 적혀 있다.
열로 고정해 쌓아야 '이 심판은 무가 많다' 같은 것을 나중에 잴 수 있다.

  심판 — ESPN 경기 요약의 officials. 과거 심판별 무 비율·카드 성향은 teamdb ESPN 캐시로 집계한다.
  날씨 — Open-Meteo 무료 예보 API(키 불필요). 좌표는 ESPN venue, 없으면 홈팀 구장(venue_env/Wikidata).
         강수확률·풍속이 높으면 총득점이 내려가고 무가 올라간다는 것이 통설이라 검증 대상으로 둔다.

  ★ 2026-10-23 — 심판과 날씨는 쓸 수 있는 시점이 다르다.
    ESPN 캐시에는 **끝난 경기만** 있다. 그래서 '판매 중 회차'에 돌리면 아무것도 안 채워졌고
    (126회 133경기 → 0건), 누적으로 심판 0/960 · 날씨 8/960 이었다 — 사실상 죽은 기능이었다.
      · 날씨: 홈팀 구장 좌표로 돌아가게 고쳐서 **경기 전에도** 채워진다. 분석에 쓰는 값이다.
      · 심판: ESPN 요약에만 있어 **끝난 뒤에만** 채워진다. 사전 입력이 아니라 refstats(심판별 무 비율)
        를 쌓기 위한 사후 열이다. 그러므로 회고 때 **직전 회차**에 돌린다(판매 중 회차가 아니라).

    python3 scripts/context_inputs.py fill --round 125      # 해당 회차 경기에 심판·날씨 채우기
    python3 scripts/context_inputs.py refstats               # 심판별 무 비율(캐시 집계)
"""
import argparse, collections, csv, datetime as dt, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, HERE)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/129.0 Safari/537.36"


def curl(url, timeout=25):
    try:
        out = subprocess.run(["curl", "-s", "--compressed", "-m", str(timeout), "-A", UA, url],
                             capture_output=True, text=True, timeout=timeout + 5).stdout
        return json.loads(out) if out.strip().startswith(("{", "[")) else None
    except Exception:
        return None


def summary(event_id):
    return curl(f"https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event={event_id}")


def referee_of(s):
    for o in ((s or {}).get("gameInfo") or {}).get("officials", []) or []:
        pos = ((o.get("position") or {}).get("displayName") or "").lower()
        if "referee" in pos and "assistant" not in pos and "video" not in pos:
            return o.get("displayName") or ""
    offs = ((s or {}).get("gameInfo") or {}).get("officials", []) or []
    return (offs[0].get("displayName") or "") if offs else ""


_GEO = {}


def geocode(name):
    """경기장·도시 이름 → 좌표 (Open-Meteo 지오코딩, 키 불필요)."""
    if not name:
        return None, None
    if name in _GEO:
        return _GEO[name]
    q = name.replace(" ", "+")
    j = curl(f"https://geocoding-api.open-meteo.com/v1/search?name={q}&count=1&language=en&format=json")
    r = ((j or {}).get("results") or [None])[0]
    out = (float(r["latitude"]), float(r["longitude"])) if r else (None, None)
    _GEO[name] = out
    return out


def venue_latlon(s):
    """ESPN 이 좌표를 주면 그걸 쓰고, 없으면 경기장·도시 이름으로 지오코딩한다."""
    v = ((s or {}).get("gameInfo") or {}).get("venue") or {}
    a = v.get("address") or {}
    lat, lon = v.get("latitude") or v.get("lat"), v.get("longitude") or v.get("lon")
    if lat and lon:
        try:
            return float(lat), float(lon)
        except (TypeError, ValueError):
            pass
    for nm in (v.get("fullName"), a.get("city"), a.get("summary")):
        if nm:
            la, lo = geocode(nm)
            if la is not None:
                return la, lo
    return None, None


def weather(lat, lon, when):
    """킥오프 시각 전후의 강수확률·풍속·기온."""
    if lat is None:
        return ""
    d = when.date().isoformat()
    u = (f"https://api.open-meteo.com/v1/forecast?latitude={lat:.3f}&longitude={lon:.3f}"
         f"&hourly=precipitation_probability,windspeed_10m,temperature_2m"
         f"&start_date={d}&end_date={d}&timezone=UTC")
    j = curl(u)
    h = (j or {}).get("hourly") or {}
    times = h.get("time") or []
    if not times:
        return ""
    tgt = when.strftime("%Y-%m-%dT%H:00")
    i = min(range(len(times)), key=lambda k: abs((times[k] > tgt) - 0.5) if times[k] == tgt else
            abs(dt.datetime.fromisoformat(times[k]).timestamp() - when.timestamp()))
    def g(key):
        v = h.get(key) or []
        return v[i] if i < len(v) else None
    pr, wd, tp = g("precipitation_probability"), g("windspeed_10m"), g("temperature_2m")
    bits = []
    if pr is not None: bits.append(f"강수{pr}%")
    if wd is not None: bits.append(f"바람{wd}km/h")
    if tp is not None: bits.append(f"{tp}℃")
    return "·".join(bits)


def cmd_refstats(a):
    import teamdb as T
    cnt = collections.defaultdict(lambda: [0, 0])
    for code in list(T.LEAGUES.values()) + list(getattr(T, "ESPN_ONLY", {}).values()):
        db = T.jload(os.path.join(T.DB, "espn", f"{code}.json"), {})
        for eid, e in db.items():
            ref = (e.get("referee") or "").strip()
            hs, as_ = (e.get("home") or {}).get("score"), (e.get("away") or {}).get("score")
            if not ref or hs in (None, "") or as_ in (None, ""):
                continue
            c = cnt[ref]; c[0] += 1; c[1] += (str(hs) == str(as_))
    rs = [(r, n, d) for r, (n, d) in cnt.items() if n >= 8]
    if not rs:
        print("심판 정보가 캐시에 없다. teamdb 가 받은 요약에 referee 가 비어 있다면,")
        print("context_inputs.py fill 이 경기마다 ESPN 요약에서 심판을 직접 받아 기록에 채운다.")
        return 0
    print(f"심판 {len(rs)}명 (8경기 이상)\n| 심판 | 경기 | 무 비율 |\n|---|---:|---:|")
    for r, n, d in sorted(rs, key=lambda x: -x[2] / x[1])[:20]:
        print(f"| {r} | {n} | {d/n*100:.0f}% |")
    return 0


def cmd_fill(a):
    import round_log as R
    import lineup_grade as L
    import teamdb as T
    rows = R.load()
    tgt = [r for r in rows if r["회차"] == str(a.round)]
    if a.no:
        tgt = [r for r in tgt if r["번호"] in set(a.no.split(","))]
    done = 0
    vcache = None
    try:
        import venue_env as V
        vcache = V.load_venues()
    except Exception:
        pass
    for r in tgt:
        if r.get("심판") and r.get("날씨") and not a.refresh:
            continue
        if (r.get("종목") or "") != "축구":
            continue
        eid = L.find_event(T.en_name(r["홈"]), T.en_name(r["원정"]), (r.get("시각") or "")[:10])
        s = summary(eid) if eid else None
        if s:
            ref = referee_of(s)
            if a.refresh:
                r["심판"] = ref        # 못 찾으면 빈칸으로 — 옛 오매칭 값을 남기지 않는다
            elif ref and not r.get("심판"):
                r["심판"] = ref
        lat, lon = venue_latlon(s) if s else (None, None)
        if lat is None:
            # 2026-10-23: ESPN 캐시는 **끝난 경기만** 들고 있어서, 아직 안 치른 경기는 eid 가 없고
            # 그래서 날씨도 못 채웠다 — 126회 133경기에 0건, 누적 심판 0/960·날씨 8/960 이었다.
            # 날씨는 경기를 치르기 전에 알아야 쓸모가 있으니 홈팀 구장 좌표로 돌아간다
            # (venue_env 가 Wikidata 에서 받아 data/venues.json 에 캐시해 둔 것 — match_inputs 가 쓰는 길과 같다).
            # 심판은 ESPN 요약에만 있어 **끝난 뒤에야** 채워진다 — refstats(심판별 무 비율)용 사후 열이다.
            try:
                import venue_env as V
                v = V.team_venue(r["홈"], T.en_name(r["홈"]), r.get("종목") or "축구", cache=vcache)
                if v and v.get("lat") is not None:
                    lat, lon = v["lat"], v["lon"]
            except Exception:
                pass
        if a.refresh and lat is None:
            r["날씨"] = ""
        if lat is not None and (not r.get("날씨") or a.refresh):
            try:
                mm, dd = (r["시각"][:5]).split("-")
                yy = dt.date.today().year
                hh = int((r["시각"][6:8] or "12"))
                when = dt.datetime(yy, int(mm), int(dd), hh)
                w = weather(lat, lon, when)
                if w:
                    r["날씨"] = w
            except Exception:
                pass
        if r.get("심판") or r.get("날씨"):
            done += 1
            print(f"  {r['번호']} {r['홈']}-{r['원정']}: 심판 {r.get('심판') or '-'} · 날씨 {r.get('날씨') or '-'}")
    R.save(rows)
    if vcache is not None:
        try:
            import venue_env as V
            V.save_venues(vcache)
        except Exception:
            pass
    print(f"{a.round}회 — 심판·날씨 채운 경기 {done}건")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("fill"); p.add_argument("--round", required=True)
    p.add_argument("--no"); p.add_argument("--refresh", action="store_true"); p.set_defaults(f=cmd_fill)
    s.add_parser("refstats").set_defaults(f=cmd_refstats)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
