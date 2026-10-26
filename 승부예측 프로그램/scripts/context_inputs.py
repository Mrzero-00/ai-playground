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


# ------------------------------------------------------------ 휴식·공백 일수 열 (2026-10-24 126회 회고에서 신설)
# 왜: 점검표 항목 "대항전·컵 뒤 8일 이상 공백은 '휴식 상한 0' 규칙의 측정 범위 밖"이 2회 되풀이됐는데
#     (126회 132 전북 9.8일·164 서울 9.9일, 둘 다 못 이김) **효과를 잴 수가 없었다.**
#     상한 0 규칙이 영향을 0 으로 만들어 근거기록에 숫자가 안 남고, 휴식일은 팀노트 INPUTS 블록에만
#     있다가 다음 회차에 덮어쓰인다. 실측 가능한 공백 행이 전체 4건뿐이었다(맞1 틀3).
#     그래서 '확률을 바꾸는' 규칙이 아니라 '기록을 남기는' 열을 먼저 만든다 — 30건 모이면 효과를 재고,
#     그때 피로(중3일 이하)와 공백(8일 이상)을 가를지 정한다. 지금은 영향 0 을 유지한다.
def cmd_rest(a):
    import round_log as R
    rows = R.load()
    jp = os.path.join(ROOT, "data", f"입력_{a.round}.json")
    if not os.path.exists(jp):
        print(f"{jp} 가 없다. 먼저 `python3 scripts/match_inputs.py --round {a.round} --date MM-DD` 를 돌린다."); return
    inp = json.load(open(jp, encoding="utf-8"))
    n = 0
    for r in rows:
        if r["회차"] != str(a.round):
            continue
        g = inp.get(r["번호"])
        if not g:
            continue
        for side, col in (("홈", "홈휴식"), ("원정", "원정휴식")):
            v = (g.get(side) or {}).get("휴식일")
            if v is not None and (not (r.get(col) or "").strip() or a.refresh):
                r[col] = str(v); n += 1
    R.save(rows)
    print(f"휴식일 {n}칸 채움 (회차 {a.round})")


def cmd_restcheck(a):
    """긴 공백(8일+) 팀이 실제로 못했는가 — 효과를 재는 쪽. 30건 넘으면 규칙화를 검토한다."""
    import round_log as R
    import collections, math
    rows = [r for r in R.load() if (r.get("결과") or "").strip() in ("승", "무", "패")]
    buck = collections.defaultdict(lambda: [0, 0])   # [경기, 그 팀이 이긴 수]
    for r in rows:
        for side, col, win in (("홈", "홈휴식", "승"), ("원정", "원정휴식", "패")):
            try:
                d = float(r.get(col) or "")
            except ValueError:
                continue
            k = "0~3일(피로)" if d <= 3 else "4~7일(정상)" if d <= 7 else "8~11일(공백)" if d <= 11 else "12일+(긴 공백)"
            b = buck[k]; b[0] += 1; b[1] += (r["결과"] == win)
    if not buck:
        print("휴식일 열이 빈칸이다. `context_inputs.py rest --round N` 으로 먼저 채운다."); return
    base_n = sum(v[0] for v in buck.values()); base_w = sum(v[1] for v in buck.values())
    p0 = base_w / base_n
    print(f"휴식일별 해당 팀 승률 (전체 {base_w}/{base_n} = {p0*100:.1f}%)")
    print("| 휴식일 | 팀-경기 | 승 | 승률 | z |")
    print("|---|---:|---:|---:|---:|")
    for k in ("0~3일(피로)", "4~7일(정상)", "8~11일(공백)", "12일+(긴 공백)"):
        if k not in buck:
            continue
        n, w = buck[k]
        z = (w / n - p0) / math.sqrt(p0 * (1 - p0) / n)
        print(f"| {k} | {n} | {w} | {w/n*100:.1f}% | {z:+.1f}{' **유의**' if abs(z) >= 2 else ''} |")
    print("\n→ 8일+ 구간이 30팀-경기를 넘고 |z|>=2 면 '공백'을 피로와 분리해 요인으로 되살린다. 그 전까지 영향 0 유지.")


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("fill"); p.add_argument("--round", required=True)
    p.add_argument("--no"); p.add_argument("--refresh", action="store_true"); p.set_defaults(f=cmd_fill)
    s.add_parser("refstats").set_defaults(f=cmd_refstats)
    p = s.add_parser("rest"); p.add_argument("--round", required=True)
    p.add_argument("--refresh", action="store_true"); p.set_defaults(f=cmd_rest)
    s.add_parser("restcheck").set_defaults(f=cmd_restcheck)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
