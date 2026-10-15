#!/usr/bin/env python3
"""경기 입력 수집 — xG · 휴식일 · 확정/직전 라인업 (2026-10-15, 사용자 지시 "입력 추가도 해줘")
왜: 보정 계수로 확률을 펴도 추천 다리 적중률이 68%에서 평평했다. 85%로 가려면 분석에 들어가는 입력 자체가 늘어야 한다.
    회고에서 가장 잘 맞힌 전문가가 ②결장(라인업)이었고, 규칙에 '휴식일·xG'가 체크리스트로만 있고 숫자로 수집되지 않았다.
무엇:
  1) xG — Understat(getLeagueData JSON, EPL·La_liga·Bundesliga·Serie_A·Ligue_1): 시즌·최근5 경기당 xG/xGA, npxGD, 홈/원정 분리.
     컵(UEL·UECL·UCL) 팀도 소속 리그 데이터로 찾는다. 그 외 리그는 '-'. 캐시 data/understat/<리그>_<시즌>.json (12시간).
  2) 휴식일 — ESPN 리그별 월간 스코어보드(47개 대회) + 전체 일별(soccer/all) 합집합에서 팀의 직전 공식전 → 킥오프까지 일수, 최근 7일 경기 수.
     캐시 data/espn_sb/ (이번 달 6시간, 지난 달 30일). ESPN에 없는 리그 팀은 컵 경기만 잡혀 '?' 표시.
  3) 라인업 — ESPN summary?event= 의 rosters(starter). 발표 전이면 '미발표(킥오프 n시간 전)'로 두고, 직전 경기 선발 XI(포메이션)를 대신 적는다.
     발표됐으면 직전 XI 대비 교체 인원·빠진 선수. (대부분 킥오프 60~75분 전 발표 — 베트맨 마감이 그보다 이르면 못 본다.)
저장: data/입력_<회차>.json (번호별, 병합) · 회차별분석/입력_<회차>.md (표) · 팀노트 <!-- INPUTS:START/END --> 블록(조사 에이전트가 읽음).
사용:
  python3 scripts/match_inputs.py --round 122                      # 회차 축구 전 경기(결과 없는 것)
  python3 scripts/match_inputs.py --round 122 --date 10-16          # 시각이 10-16 인 경기만
  python3 scripts/match_inputs.py --round 122 --numbers 8475,8481   # 번호 지정
  --refresh  캐시 무시
"""
import argparse, csv, datetime as dt, json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
import team_facts as tf
from soccer_baseline import kickoff, KST

REC = os.path.join(ROOT, "전체경기기록.csv")
NOTES = os.path.join(ROOT, "팀노트")
US_DIR = os.path.join(ROOT, "data", "understat")
SB_DIR = os.path.join(ROOT, "data", "espn_sb")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
US_LEAGUES = ["EPL", "La_liga", "Bundesliga", "Serie_A", "Ligue_1"]
US_SEASON = "2026"
STOP = ("fc", "cf", "sc", "afc", "club", "united", "city", "de", "the", "real", "ac", "as", "sk", "fk", "nk", "kaa", "rsc", "tsg", "1899", "sl", "gnk", "ofk")


def curl(url, timeout=25, hdr=()):
    cmd = ["curl", "-sS", "--compressed", "-m", str(timeout), "-A", UA]
    for h in hdr:
        cmd += ["-H", h]
    return subprocess.run(cmd + [url], capture_output=True, text=True).stdout


def cached(path, url, max_age_h, refresh=False, hdr=()):
    if not refresh and os.path.exists(path) and (time.time() - os.path.getmtime(path)) < max_age_h * 3600:
        try:
            return json.load(open(path, encoding="utf-8"))
        except ValueError:
            pass
    txt = curl(url, hdr=hdr)
    try:
        d = json.loads(txt)
    except ValueError:
        return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else None
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    return d


# ------------------------------------------------------------ 이름 매칭
import unicodedata
ALIAS = {"saint": "st", "sankt": "st", "st.": "st", "athletic": "athletic", "atletico": "atletico"}


ESPN_ALIAS = {"Los Angeles FC": "LAFC", "Athletic Bilbao": "Athletic Club", "Ferencvarosi TC": "Ferencvaros", "F.C. Copenhagen": "FC Copenhagen", "FC Nordsjaelland": "Nordsjaelland",
              "CS Universitatea Craiova": "Universitatea Craiova", "FC Kairat": "Kairat Almaty"}


def norm(s):
    s = ESPN_ALIAS.get(s, s)
    s = s.replace("æ", "ae").replace("Æ", "Ae").replace("ø", "o").replace("Ø", "O").replace("ß", "ss").replace("ð", "d").replace("đ", "d").replace("ł", "l")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[.\-/&]+", " ", s)
    s = " ".join(ALIAS.get(t, t) for t in s.split())
    s = re.sub(r"\b(fc|cf|sc|afc|club|ksv|kv|sv|bk|if|ff|sk|fk|nk|gnk|hnk|kf|ofk|sl|tsg|kaa|rsc|cd|ud|sd|fsv|vfb|vfl|tsv|spvgg|ks|mks|as|ac|aik|aif|cska|1999)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def toks(s):
    return [t for t in norm(s).split() if len(t) > 2 and t not in STOP]


def score(eng, name):
    e, n = norm(eng), norm(name)
    if not e or not n:
        return 0
    if e == n or e in n or n in e:
        return 10 + len(e.split())
    tk = toks(eng)
    return sum(1 for t in tk if t in n.split())


def matcher(eng):
    """참/거짓: 정규화 포함 관계 → 참(단, ESPN 쪽 짧은 이름이 내 이름에 포함되는 경우는 두 단어 이상일 때만 — 'Colorado'(NCAA) ≠ 'Colorado Rapids').
    아니면 비(非)관용어 토큰(길이>2)이 3개 이상이면 하나 빼고 전부, 2개면 전부,
    1개면 그 토큰 + 'united/city' 같은 관용어까지 전부 있어야 참(맨유≠맨시티, 레알≠소시에다드)."""
    e = norm(eng); tk = toks(eng); allt = [t for t in e.split() if len(t) > 2]
    def ok(name):
        n = norm(name)
        if not n or not e:
            return False
        if e == n or e in n or (n in e and len(n.split()) >= 2):
            return True
        words = n.split()
        if len(tk) >= 3:
            return sum(1 for t in tk if t in words) >= len(tk) - 1
        if len(tk) == 2:
            return all(t in words for t in tk)
        if len(tk) == 1:
            return all(t in words for t in allt)
        return False
    return ok


# ------------------------------------------------------------ ESPN 스코어보드 (리그별 월간 + 전체 일별 합집합)
# 'soccer/all' 일별은 선별된 경기만 담고(NCAA·친선 위주, UECL 누락), 리그별 월간은 빠짐없다(2026-10-15 확인). 둘을 합친다.
# ESPN에 없는 리그(체코·폴란드·헝가리·불가리아·키프로스·이스라엘·핀란드·크로아티아·세르비아·슬로베니아·K리그·J2)는 컵 경기만 잡힌다 → 휴식일 '?' 표시.
CODES = ["eng.1", "eng.2", "esp.1", "esp.2", "ita.1", "ita.2", "ger.1", "ger.2", "fra.1", "fra.2", "ned.1", "por.1", "bel.1", "sco.1", "tur.1", "gre.1",
         "aut.1", "swe.1", "den.1", "nor.1", "rus.1", "usa.1", "mex.1", "aus.1", "chn.1", "jpn.1", "ksa.1", "arg.1", "bra.1", "ind.1",
         "uefa.champions", "uefa.europa", "uefa.europa.conf", "eng.fa", "eng.league_cup", "esp.copa_del_rey", "ger.dfb_pokal", "ita.coppa_italia",
         "fra.coupe_de_france", "ned.cup", "por.taca.portugal", "afc.champions", "afc.cup", "conmebol.libertadores", "conmebol.sudamericana",
         "concacaf.champions_cup", "usa.open"]
_POOL = None


def sb_month(code, ym, refresh=False):
    cur = ym >= dt.date.today().strftime("%Y%m")
    d = cached(os.path.join(SB_DIR, f"{code}_{ym}.json"), f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard?dates={ym}&limit=400",
               6 if cur else 24 * 30, refresh)
    return (d or {}).get("events", [])


def sb_day(ds, refresh=False):
    today = dt.date.today().strftime("%Y%m%d")
    d = cached(os.path.join(SB_DIR, f"all_{ds}.json"), f"https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates={ds}&limit=1000",
               1 if ds >= today else 24 * 30, refresh)
    return (d or {}).get("events", [])


def comp_name(e, code=""):
    s = (e.get("season") or {}).get("slug", "")
    s = re.sub(r"^20\d\d(-\d\d)?-", "", s).replace("-", " ")
    return s if s and s not in ("league phase", "group stage", "regular season", "qualifying round") else (code or s)


SKIP_COMP = ("ncaa", "women", "womens", "w ", "friendly", "u19", "u20", "u21", "u23", "youth")


def pool(refresh=False):
    """회차 실행당 한 번: 지난달+이번달 리그별 월간 + 최근 22일 전체 일별 → {event_id: (event, 대회명)}"""
    global _POOL
    if _POOL is not None and not refresh:
        return _POOL
    today = dt.date.today(); prev = (today.replace(day=1) - dt.timedelta(days=1))
    P = {}
    for code in CODES:
        for ym in (f"{prev:%Y%m}", f"{today:%Y%m}"):
            for e in sb_month(code, ym, refresh):
                P.setdefault(e["id"], (e, comp_name(e, code)))
    for i in range(-1, 36):
        ds = (today - dt.timedelta(days=i)).strftime("%Y%m%d")
        for e in sb_day(ds, refresh):
            cn = comp_name(e)
            if any(k in cn for k in SKIP_COMP) or (e.get("season") or {}).get("slug", "").find("women") >= 0:
                continue
            P.setdefault(e["id"], (e, cn))
    _POOL = P
    return P


def sides(e):
    c = e["competitions"][0]
    h = next(x for x in c["competitors"] if x["homeAway"] == "home"); a = next(x for x in c["competitors"] if x["homeAway"] == "away")
    return c, h, a


def strict_matcher(eng):
    e = norm(eng); tk = toks(eng)
    def ok(name):
        n = norm(name)
        return bool(e and n) and (e == n or e in n or (len(tk) >= 2 and all(t in n.split() for t in tk)))
    return ok


YOUTH = re.compile(r"\b(u1\d|u2\d|ii|b|reserves?|women|w|youth|academy|amateur)\b")


def _score(mine, theirs):
    """'팀 득점-상대 득점 승/무/패' — 원정 경기 스코어가 상대 기준으로 읽히던 오류 방지(2026-10-15 AZ 0-2 패 → '2-0')."""
    try:
        x, y = int(mine), int(theirs)
    except (TypeError, ValueError):
        return f"{mine}-{theirs}"
    return f"{x}-{y} {'승' if x > y else '무' if x == y else '패'}"


def team_events(eng, before_utc, days=35, refresh=False, prefer=None):
    """팀이 뛴 완료 경기(모든 대회), 최근순 [(date_utc, 대회, event_id, 홈/원정, 상대, 스코어)].
    prefer = 경기의 리그 코드(usa.1 등): 그 대회는 보통 매칭, 다른 대회는 엄격 매칭(샌호세 볼리비아·갤럭시 남아공 오매칭 방지)."""
    ok_pref, ok_strict = matcher(eng), strict_matcher(eng)
    out = []
    lo = (before_utc - dt.timedelta(days=days)) if before_utc else None
    for eid, (e, comp) in pool(refresh).items():
        c, h, a = sides(e)
        if not c["status"]["type"].get("completed"):
            continue
        t = dt.datetime.fromisoformat(e["date"].replace("Z", "+00:00"))
        if before_utc and (t >= before_utc or t < lo):
            continue
        ok = ok_pref if (prefer and comp == prefer) or comp.startswith(("uefa", "afc", "conmebol", "concacaf")) else ok_strict
        if YOUTH.search(norm(h["team"]["displayName"])) or YOUTH.search(norm(a["team"]["displayName"])) or "trophy" in comp or "u21" in comp:
            continue   # EFL 트로피 U21·B팀·여자팀 경기 제외 (2026-10-15 풀럼 U21 오매칭)
        if ok(h["team"]["displayName"]):
            out.append((t, comp, eid, "홈", a["team"]["displayName"], _score(h.get("score"), a.get("score"))))
        elif ok(a["team"]["displayName"]):
            out.append((t, comp, eid, "원정", h["team"]["displayName"], _score(a.get("score"), h.get("score"))))
    return sorted(out, key=lambda x: x[0], reverse=True)


def find_event(ko_utc, home_eng, away_eng, refresh=False):
    okh, oka = matcher(home_eng), matcher(away_eng)
    for eid, (e, comp) in pool(refresh).items():
        t = dt.datetime.fromisoformat(e["date"].replace("Z", "+00:00"))
        if abs((t - ko_utc).total_seconds()) > 36 * 3600:
            continue
        c, h, a = sides(e)
        if okh(h["team"]["displayName"]) and oka(a["team"]["displayName"]):
            return eid
    return None


def lineup(event_id, refresh=False):
    """{displayName: {"formation", "starters":[...], "subs":[...]}} — 선발 없으면 {}"""
    j = cached(os.path.join(SB_DIR, f"sum_{event_id}.json"), f"https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event={event_id}", 0.25, refresh)
    out = {}
    for r in (j or {}).get("rosters", []):
        st = [p["athlete"]["displayName"] for p in r.get("roster", []) if p.get("starter")]
        if len(st) >= 11:
            out[r["team"]["displayName"]] = {"formation": r.get("formation", ""), "starters": st,
                                             "subs": [p["athlete"]["displayName"] for p in r.get("roster", []) if not p.get("starter")]}
    return out


def pick_side(lu, eng):
    ok = matcher(eng)
    for name, v in lu.items():
        if ok(name):
            return v
    return None


# ------------------------------------------------------------ Understat xG
def us_league(lg, refresh=False):
    return cached(os.path.join(US_DIR, f"{lg}_{US_SEASON}.json"), f"https://understat.com/getLeagueData/{lg}/{US_SEASON}", 12, refresh,
                  hdr=("X-Requested-With: XMLHttpRequest", f"Referer: https://understat.com/league/{lg}/{US_SEASON}"))


_US = {}
def us_team(eng, refresh=False):
    """모든 상위 5리그에서 제목 매칭 → (리그, history) 또는 None"""
    best = None
    for lg in US_LEAGUES:
        if lg not in _US:
            d = us_league(lg, refresh) or {}
            _US[lg] = (d.get("teams") or {})
        e = norm(eng)
        for t in _US[lg].values():
            n = norm(t["title"]); s = score(eng, t["title"])
            loose = bool(e and n) and (e in n or n in e) and min(len(e), len(n)) >= 4
            if s and (matcher(eng)(t["title"]) or loose) and (best is None or s > best[0]):
                best = (s, lg, t)
    return (best[1], best[2]) if best else None


def xg_summary(hist, before_utc=None, n=5):
    rows = [h for h in hist if not before_utc or dt.datetime.strptime(h["date"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=dt.timezone.utc) < before_utc]
    if not rows:
        return None
    def avg(rs, k):
        return sum(float(r[k]) for r in rs) / len(rs)
    last = rows[-n:]
    home = [r for r in rows if r["h_a"] == "h"]; away = [r for r in rows if r["h_a"] == "a"]
    return {"n": len(rows), "xg": round(avg(rows, "xG"), 2), "xga": round(avg(rows, "xGA"), 2), "npxgd": round(avg(rows, "npxGD"), 2),
            "l5_xg": round(avg(last, "xG"), 2), "l5_xga": round(avg(last, "xGA"), 2), "l5_npxgd": round(avg(last, "npxGD"), 2),
            "home_xgd": round(avg(home, "npxGD"), 2) if home else None, "away_xgd": round(avg(away, "npxGD"), 2) if away else None,
            "xpts": round(sum(float(r["xpts"]) for r in rows), 1), "pts": sum(int(r["pts"]) for r in rows)}


# ------------------------------------------------------------ 경기별 수집
def game_inputs(r, names, now, refresh=False):
    code = tf.ESPN.get(r["리그"])
    h, a = r["홈"], r["원정"]
    eh = str(names.get(h) or names.get(h.split()[0]) or h); ea = str(names.get(a) or names.get(a.split()[0]) or a)
    ko = kickoff(r["시각"], now)
    out = {"번호": r["번호"], "경기": f"{h} - {a}", "리그": r["리그"], "시각": r["시각"], "수집": now.strftime("%m-%d %H:%M"), "홈": {}, "원정": {}}
    for side, team, eng in (("홈", h, eh), ("원정", a, ea)):
        d = out[side]; d["팀"] = team; d["eng"] = eng
        ev = team_events(eng, ko, refresh=refresh, prefer=code) if ko else []
        if ev:
            last = ev[0]
            d["직전"] = f"{last[0].astimezone(KST):%m-%d} {last[3]} vs {last[4]} {last[5]} [{last[1]}]"
            d["휴식일"] = round((ko - last[0]).total_seconds() / 86400, 1) if ko else None
            if d["휴식일"] is not None and d["휴식일"] > 12:
                d["휴식일주의"] = "ESPN에 없는 리그일 수 있음(21일 내 경기 없음) — 실제 휴식일은 더 짧을 수 있음"
            d["최근7일경기"] = sum(1 for x in ev if (ko - x[0]).days < 7)
            d["직전event"] = last[2]
        else:
            d["휴식일"] = None; d["직전"] = "-"; d["최근7일경기"] = None
            d["휴식일주의"] = "35일 내 경기 없음 — ESPN 미제공 리그(체코·폴란드·헝가리·불가리아·키프로스·이스라엘·핀란드·크로아티아·세르비아·동남아 등)이면 에이전트가 직접 확인"
        u = us_team(eng, refresh)
        if u:
            d["xg"] = xg_summary(u[1]["history"], ko)
            d["xg_src"] = f"Understat {u[0]} {u[1]['title']}"
        else:
            d["xg"] = None
    # 라인업
    out["라인업"] = "-"
    if ko:
        eid = find_event(ko, eh, ea, refresh)
        out["event"] = eid
        hrs = (ko - now.astimezone(dt.timezone.utc)).total_seconds() / 3600
        lu = lineup(eid, refresh) if eid else {}
        if lu:
            out["라인업"] = "발표"
            for side, eng in (("홈", eh), ("원정", ea)):
                v = pick_side(lu, eng)
                if v:
                    out[side]["선발"] = v["starters"]; out[side]["포메이션"] = v["formation"]
        else:
            out["라인업"] = f"미발표(킥오프 {hrs:.1f}h 전)" if hrs > 0 else "미발표"
        # 직전 선발 XI (교체 인원 계산용)
        for side, eng in (("홈", eh), ("원정", ea)):
            d = out[side]; pe = d.get("직전event")
            if pe:
                plu = lineup(pe, refresh)
                v = pick_side(plu, eng)
                if v:
                    d["직전선발"] = v["starters"]; d["직전포메이션"] = v["formation"]
                    if d.get("선발"):
                        missing = [p for p in v["starters"] if p not in d["선발"]]
                        d["교체"] = len(missing); d["빠진"] = missing
    return out


def fmt_xg(x):
    if not x:
        return "-"
    s = f"시즌{x['n']}경기 xG{x['xg']}/xGA{x['xga']} npxGD{x['npxgd']:+} · 최근5 {x['l5_xg']}/{x['l5_xga']} ({x['l5_npxgd']:+})"
    if x.get("home_xgd") is not None or x.get("away_xgd") is not None:
        s += f" · 홈{x['home_xgd'] if x['home_xgd'] is not None else '-'}/원정{x['away_xgd'] if x['away_xgd'] is not None else '-'}"
    s += f" · xPts{x['xpts']} vs 승점{x['pts']}"
    return s


def fmt_side(d):
    rest = f"휴식 {d['휴식일']}일" + ("?(국내리그 ESPN 미제공 — 직접 확인)" if d.get("휴식일주의") else "") + (f"(7일 {d['최근7일경기']}경기)" if d.get("최근7일경기") else "") if d.get("휴식일") is not None else "휴식 ?(ESPN 미제공 리그 — 직접 확인)"
    xi = ""
    if d.get("선발"):
        xi = f" · 선발 {d.get('포메이션', '')} " + ", ".join(d["선발"]) + (f" · 직전 대비 교체 {d['교체']}명({', '.join(d['빠진'])})" if d.get("교체") is not None else "")
    elif d.get("직전선발"):
        xi = f" · 직전 선발 {d.get('직전포메이션', '')} " + ", ".join(d["직전선발"])
    return f"{rest} · 직전 {d.get('직전', '-')} · xG {fmt_xg(d.get('xg'))}{xi}"


def write_note(team, line, today):
    path = os.path.join(NOTES, f"{team}.md")
    block = f"<!-- INPUTS:START -->\n## 입력(자동 수집 {today}) — xG·휴식일·라인업은 이 숫자를 쓴다\n- {line}\n<!-- INPUTS:END -->\n"
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else f"# {team}\n\n"
    if "<!-- INPUTS:START -->" in old:
        new = re.sub(r"<!-- INPUTS:START -->.*?<!-- INPUTS:END -->\n?", block, old, flags=re.S)
    elif "<!-- FACTS:END -->" in old:
        new = old.replace("<!-- FACTS:END -->\n", "<!-- FACTS:END -->\n" + block, 1)
    else:
        head, _, rest = old.partition("\n")
        new = head + "\n\n" + block + "\n" + rest.lstrip("\n")
    open(path, "w", encoding="utf-8").write(new)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", required=True); ap.add_argument("--date"); ap.add_argument("--numbers")
    ap.add_argument("--refresh", action="store_true"); ap.add_argument("--all", action="store_true", help="결과 있는 경기도")
    ap.add_argument("--no-notes", action="store_true")
    a = ap.parse_args()
    names = json.load(open(tf.NAMES, encoding="utf-8"))
    now = dt.datetime.now(KST)
    nums = set(a.numbers.split(",")) if a.numbers else None
    rows = [r for r in csv.DictReader(open(REC, encoding="utf-8-sig")) if r["회차"] == str(a.round) and r["종목"] == "축구"
            and (a.all or r.get("결과", "") in ("", "예정")) and (not a.date or r["시각"].startswith(a.date)) and (not nums or r["번호"] in nums)]
    if not rows:
        sys.exit("대상 경기 없음")
    jp = os.path.join(ROOT, "data", f"입력_{a.round}.json")
    store = json.load(open(jp, encoding="utf-8")) if os.path.exists(jp) else {}
    today = now.date().isoformat()
    L = [f"# {a.round}회 경기 입력 — xG·휴식일·라인업 (수집 {now:%m-%d %H:%M})", "",
         "xG = Understat(상위 5리그 소속 팀만, 경기당 평균). 휴식일 = 직전 공식전(모든 대회)부터 킥오프까지. 라인업 = ESPN 공식 선발(발표 전이면 직전 경기 XI).", "",
         "| 번호 | 시각 | 경기 | 홈 | 원정 | 라인업 |", "|---|---|---|---|---|---|"]
    for r in rows:
        try:
            g = game_inputs(r, names, now, a.refresh)
        except Exception as e:
            print(f"  ✗ {r['번호']} {r['홈']}-{r['원정']}: {e}", file=sys.stderr); continue
        store[g["번호"]] = g
        L.append(f"| {g['번호']} | {g['시각']} | {g['경기']} | {fmt_side(g['홈'])} | {fmt_side(g['원정'])} | {g['라인업']} |")
        print(f"  {g['번호']} {g['경기']}: 휴식 {g['홈'].get('휴식일')}/{g['원정'].get('휴식일')} · xG {'○' if g['홈'].get('xg') else '-'}/{'○' if g['원정'].get('xg') else '-'} · 라인업 {g['라인업']}")
        if not a.no_notes:
            for side in ("홈", "원정"):
                write_note(g[side]["팀"], f"{g['시각']} vs {g['원정' if side == '홈' else '홈']['팀']}: {fmt_side(g[side])}", today)
    json.dump(store, open(jp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    mp = os.path.join(ROOT, "회차별분석", f"입력_{a.round}.md")
    open(mp, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(f"→ {jp}\n→ {mp}")


if __name__ == "__main__":
    main()
