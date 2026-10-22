#!/usr/bin/env python3
"""5대 리그 팀·경기·선수 기록 누적 DB (사용자 제안 2026-10-19: "검색만으로는 세분화된 기록을 볼 수 없다 — 팀별 기록을 계속 수집하자")
무엇
  Understat(EPL·La_liga·Bundesliga·Serie_A·Ligue_1): 팀별 경기 xG/xGA/npxGD/ppda/deep, 경기 목록(xG·예측), 선수 시즌 기록(출전·분·골·xG·xA·슈팅·키패스·포지션),
    팀 통계(상황별·포메이션별·경기상황별 xG).  ESPN(eng.1·esp.1·ita.1·ger.1·fra.1): 완료 경기 요약 — 실제 선발 XI·포메이션·교체·슈팅·유효·점유·퇴장·득점 이벤트.
저장  data/teamdb/understat/<리그>_<시즌>.json · data/teamdb/understat/team_<id>.json · data/teamdb/espn/<code>.json(event id별) · data/teamdb/standings_<code>.json
사용
  python3 scripts/teamdb.py update [--league EPL] [--refresh]        # 매일 08시 정기 작업에서(증분: 완료 경기는 한 번만 받음)
  python3 scripts/teamdb.py profile "Arsenal" [--absent "Saka,Odegaard"] [--md]   # 팀 카드(순위·xG 흐름·최근 6경기·핵심 선수 xG 비중·결장 영향·포메이션)
  python3 scripts/teamdb.py card <홈 영문> <원정 영문>                 # 경기 카드 두 팀 + 맞대결
  다른 스크립트: from teamdb import profile_md
"""
import argparse, csv, datetime as dt, json, os, re, subprocess, sys, time, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
DB = os.path.join(ROOT, "data", "teamdb")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
SEASON = "2026"
LEAGUES = {"EPL": "eng.1", "La_liga": "esp.1", "Serie_A": "ita.1", "Bundesliga": "ger.1", "Ligue_1": "fra.1"}
# Understat 이 다루지 않는 리그 — ESPN 만으로 쌓는다(사용자 지시 2026-10-22, 개선안 3번).
# 측정 근거: 내 방향 정확도가 시장에 가장 많이 뒤지는 곳이 바로 이 세 리그였다.
#   잉글랜드 챔피언십 n=37 내 45.9% vs 시장 54.1%(-8.1p) · J1 n=42 47.6% vs 52.4%(-4.8p)
#   MLS n=44 43.2% vs 45.5%(-2.3p) — 셋이 123경기로 전체의 1/4인데 전부 시장 아래.
#   공통점은 팀 기록이 없다는 것이다. xG 는 없지만 결과·슈팅·선발은 ESPN 으로 쌓을 수 있다.
ESPN_ONLY = {"Championship": "eng.2", "J1": "jpn.1", "MLS": "usa.1"}
MONTHS = ["202608", "202609", "202610", "202611", "202612", "202701", "202702", "202703", "202704", "202705"]
_last = [0.0]


def curl(url, ref=None, gap=0.0):
    wait = gap - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    cmd = ["curl", "-s", "--compressed", "-m", "30", "-A", UA]
    if ref:
        cmd += ["-H", "X-Requested-With: XMLHttpRequest", "-H", f"Referer: {ref}"]
    out = subprocess.run(cmd + [url], capture_output=True, text=True).stdout
    _last[0] = time.time()
    try:
        return json.loads(out)
    except ValueError:
        return None


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def jload(p, default=None):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return default


def jsave(p, d):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False)


def fresh(p, hours):
    return os.path.exists(p) and (time.time() - os.path.getmtime(p)) < hours * 3600


# ---------------------------------------------------------------- Understat
def us_update(lg, refresh=False):
    p = os.path.join(DB, "understat", f"{lg}_{SEASON}.json")
    if refresh or not fresh(p, 12):
        d = curl(f"https://understat.com/getLeagueData/{lg}/{SEASON}", f"https://understat.com/league/{lg}/{SEASON}", gap=1.0)
        if d and d.get("teams"):
            jsave(p, d)
    d = jload(p, {})
    n = 0
    for tid, t in (d.get("teams") or {}).items():
        tp = os.path.join(DB, "understat", f"team_{tid}.json")
        if refresh or not fresh(tp, 24):
            slug = t["title"].replace(" ", "_")
            td = curl(f"https://understat.com/getTeamData/{slug}/{SEASON}", f"https://understat.com/team/{slug}/{SEASON}", gap=1.2)
            if td and td.get("players") is not None:
                td["title"] = t["title"]; td["league"] = lg; jsave(tp, td); n += 1
    return len(d.get("teams") or {}), n


# ---------------------------------------------------------------- ESPN
def espn_month(code, ym):
    return (curl(f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard?dates={ym}&limit=400") or {}).get("events", [])


def compact(summary):
    j = summary
    out = {}
    try:
        comp = j["header"]["competitions"][0]
        out["date"] = comp.get("date"); out["status"] = comp["status"]["type"]["name"]
        for c in comp["competitors"]:
            out[c["homeAway"]] = {"team": c["team"]["displayName"], "id": c["team"].get("id"), "score": c.get("score")}
    except Exception:
        return None
    ros = {}
    for r in j.get("rosters", []):
        side = r.get("homeAway")
        ros[side] = {"formation": r.get("formation"),
                     "starters": [{"n": p["athlete"]["displayName"], "pos": (p.get("position") or {}).get("abbreviation"), "j": p.get("jersey")} for p in r.get("roster", []) if p.get("starter")],
                     "subs_used": [p["athlete"]["displayName"] for p in r.get("roster", []) if not p.get("starter") and p.get("subbedIn")]}
    out["rosters"] = ros
    st = {}
    for t in (j.get("boxscore") or {}).get("teams", []):
        s = {x["name"]: x.get("displayValue") for x in t.get("statistics", [])}
        st[t.get("homeAway") or t["team"]["displayName"]] = {k: s.get(k) for k in ("totalShots", "shotsOnTarget", "possessionPct", "wonCorners", "foulsCommitted", "yellowCards", "redCards", "saves")}
    out["stats"] = st
    out["goals"] = [{"min": k.get("clock", {}).get("displayValue"), "team": (k.get("team") or {}).get("displayName"), "text": (k.get("text") or "")[:90]} for k in j.get("keyEvents", []) if k.get("scoringPlay")]
    out["reds"] = [{"min": k.get("clock", {}).get("displayValue"), "team": (k.get("team") or {}).get("displayName")} for k in j.get("keyEvents", []) if "Red Card" in (k.get("type", {}) or {}).get("text", "")]
    return out


def espn_update(code, refresh=False):
    p = os.path.join(DB, "espn", f"{code}.json")
    db = jload(p, {})
    today = dt.date.today().strftime("%Y%m")
    added = 0
    for ym in MONTHS:
        if ym > today:
            break
        for e in espn_month(code, ym):
            c = e["competitions"][0]
            if not c["status"]["type"].get("completed"):
                continue
            eid = e["id"]
            if eid in db and db[eid].get("rosters") and not refresh:
                continue
            s = curl(f"https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event={eid}")
            if not s:
                continue
            rec = compact(s)
            if rec:
                db[eid] = rec; added += 1
    jsave(p, db)
    sp = os.path.join(DB, f"standings_{code}.json")
    if refresh or not fresh(sp, 12):
        d = curl(f"https://site.api.espn.com/apis/v2/sports/soccer/{code}/standings")
        if d:
            jsave(sp, d)
    return len(db), added


# ---------------------------------------------------------------- 야구(MLB)·농구(NBA) — ESPN, K리그 — 공식 JSON(soccer_baseline)
SPORTS = {"mlb": ("baseball", "mlb"), "nba": ("basketball", "nba")}


def compact_sport(sport, j):
    out = {}
    try:
        comp = j["header"]["competitions"][0]
        out["date"] = comp.get("date"); out["status"] = comp["status"]["type"]["name"]
        for c in comp["competitors"]:
            out[c["homeAway"]] = {"team": c["team"]["displayName"], "id": c["team"].get("id"), "score": c.get("score"),
                                  "linescores": [x.get("displayValue") or x.get("value") for x in c.get("linescores", [])]}
    except Exception:
        return None
    box = (j.get("boxscore") or {})
    stats = {}
    for t in box.get("teams", []):
        stats[t.get("homeAway") or t["team"]["displayName"]] = {x.get("name") or x.get("label"): x.get("displayValue") for x in t.get("statistics", [])}
    out["stats"] = stats
    if sport == "baseball":
        pit = {}
        for t in box.get("players", []):
            side = t.get("homeAway") or t["team"]["displayName"]; lst = []
            for grp in t.get("statistics", []):
                if "pitch" not in (grp.get("type") or grp.get("name") or "").lower():
                    continue
                keys = grp.get("keys") or grp.get("names") or []
                for ath in grp.get("athletes", []):
                    rec = dict(zip(keys, ath.get("stats", [])))
                    rec["name"] = ath.get("athlete", {}).get("displayName"); rec["starter"] = ath.get("starter", False)
                    lst.append(rec)
            pit[side] = lst
        out["pitchers"] = pit
    else:
        lead = {}
        for t in box.get("players", []):
            side = t.get("homeAway") or t["team"]["displayName"]; lst = []
            for grp in t.get("statistics", []):
                keys = grp.get("keys") or grp.get("names") or []
                for ath in grp.get("athletes", []):
                    rec = dict(zip(keys, ath.get("stats", [])))
                    rec["name"] = ath.get("athlete", {}).get("displayName"); rec["starter"] = ath.get("starter", False)
                    lst.append(rec)
            lead[side] = lst[:8]
        out["players"] = lead
    return out


def sport_update(key, refresh=False, months=None):
    sport, code = SPORTS[key]
    p = os.path.join(DB, key, f"{code}.json"); db = jload(p, {})
    today = dt.date.today(); added = 0
    months = months or [(today - dt.timedelta(days=30 * i)).strftime("%Y%m") for i in range(2, -1, -1)]
    for ym in months:
        d = curl(f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{code}/scoreboard?dates={ym}&limit=400") or {}
        for e in d.get("events", []):
            c = e["competitions"][0]
            if not c["status"]["type"].get("completed"):
                continue
            eid = e["id"]
            if eid in db and not refresh:
                continue
            j = curl(f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{code}/summary?event={eid}")
            rec = compact_sport(sport, j) if j else None
            if rec:
                rec["probables"] = {x["homeAway"]: [pp.get("athlete", {}).get("displayName") for pp in x.get("probables", [])] for x in c.get("competitors", [])}
                db[eid] = rec; added += 1
    jsave(p, db)
    sp = os.path.join(DB, key, f"standings_{code}.json")
    if refresh or not fresh(sp, 12):
        d = curl(f"https://site.api.espn.com/apis/v2/sports/{sport}/{code}/standings")
        if d:
            jsave(sp, d)
    return len(db), added


def kleague_update(refresh=False):
    import soccer_baseline as sb
    out = {}
    for lg in ("kor.1", "kor.2"):
        p = os.path.join(DB, "kleague", f"{lg}_{dt.date.today().year}.json")
        if refresh or not fresh(p, 12):
            games, _ = sb.fetch_kleague(lg, dt.date.today().year)
            if games:
                jsave(p, games)
        out[lg] = len(jload(p, []))
    return out


def cmd_update(a):
    for lg, code in LEAGUES.items():
        if a.league and a.league not in (lg, code):
            continue
        nt, np_ = us_update(lg, a.refresh)
        ne, na = espn_update(code, a.refresh)
        print(f"{lg}/{code}: Understat 팀 {nt}(팀 상세 갱신 {np_}) · ESPN 완료 경기 {ne}(신규 {na})")
    for lg, code in ESPN_ONLY.items():
        if a.league and a.league not in (lg, code):
            continue
        try:
            ne, na = espn_update(code, a.refresh)
            print(f"{lg}/{code}: ESPN 전용 — 완료 경기 {ne}(신규 {na}, xG 없음)")
        except Exception as e:
            print(f"{lg} 수집 실패:", e)
    if not a.league:
        try:
            print("K리그:", kleague_update(a.refresh))
        except Exception as e:
            print("K리그 수집 실패:", e)
        for key in SPORTS:
            try:
                n, na = sport_update(key, a.refresh); print(f"{key.upper()}: 완료 경기 {n}(신규 {na})")
            except Exception as e:
                print(f"{key} 수집 실패:", e)


# ---------------------------------------------------------------- 조회
def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(fc|cf|sc|afc|club|cd|ud|sd|ac|as|ss|us|rc|rcd|ogc|sl|vfb|vfl|tsg|fsv|sv|ssc)\b", " ", s)
    return re.sub(r"[^a-z0-9 ]", " ", s).strip()


_NAMES = None


def en_name(name):
    """베트맨 한글 팀명 → 영문명 (data/team_names.json). 매핑 없으면 원문."""
    global _NAMES
    if _NAMES is None:
        _NAMES = jload(os.path.join(os.path.dirname(DB), "team_names.json"), {})
        if not _NAMES:
            _NAMES = jload(os.path.join(DB, "..", "team_names.json"), {})
    if name in _NAMES:
        return _NAMES[name]
    first = name.split()[0] if name.split() else name
    return _NAMES.get(first, name)


def find_team(name):
    """Understat 팀 → (리그, 팀 dict, 팀 상세 dict)"""
    n = norm(en_name(name)); best = None
    if not n:  # 한글 등 매핑 실패 — 아무 팀이나 부분일치로 잡히는 것을 막는다
        return None
    for lg in LEAGUES:
        d = jload(os.path.join(DB, "understat", f"{lg}_{SEASON}.json"), {})
        for tid, t in (d.get("teams") or {}).items():
            tn = norm(t["title"]); sc = 0
            if tn == n:
                sc = 3
            elif n in tn or tn in n:
                sc = 2
            elif set(n.split()) & set(tn.split()):
                sc = 1
            if sc and (best is None or sc > best[0]):
                best = (sc, lg, tid, t, d)
    if not best:
        return None
    _, lg, tid, t, d = best
    return lg, t, jload(os.path.join(DB, "understat", f"team_{tid}.json"), {}), d


def espn_matches(team_title, code):
    db = jload(os.path.join(DB, "espn", f"{code}.json"), {})
    n = norm(team_title); out = []
    for eid, m in db.items():
        for side in ("home", "away"):
            t = m.get(side, {}).get("team", "")
            tn = norm(t)
            if tn == n or n in tn or tn in n or (len(n.split()) and n.split()[0] in tn.split() and len(n.split()[0]) > 4):
                out.append((m["date"], side, eid, m))
    return sorted(out, key=lambda x: x[0])


def profile_md(name, absent=None):
    f = find_team(name)
    if not f:
        return f"- {name}: teamdb 에 없음(5대 리그 밖이거나 이름 불일치)"
    lg, t, td, league = f
    code = LEAGUES[lg]
    hist = t.get("history", [])
    L = [f"### {t['title']} ({lg}) — teamdb {dt.date.today()}"]
    # 순위
    st = jload(os.path.join(DB, f"standings_{code}.json"), {})
    for g in (st.get("children") or [{"standings": st.get("standings", {})}]):
        for e in (g.get("standings") or {}).get("entries", []):
            if norm(e["team"]["displayName"]) == norm(t["title"]) or norm(t["title"]) in norm(e["team"]["displayName"]):
                s = {x["name"]: x.get("displayValue") for x in e["stats"]}
                L.append(f"- 순위 {s.get('rank')}위 {s.get('gamesPlayed')}경기 {s.get('wins')}승{s.get('ties')}무{s.get('losses')}패 GD{s.get('pointDifferential')} 승점{s.get('points')}")
    if hist:
        n = len(hist); xg = sum(float(h["xG"]) for h in hist) / n; xga = sum(float(h["xGA"]) for h in hist) / n
        last5 = hist[-5:]; l5 = (sum(float(h["xG"]) for h in last5) / len(last5), sum(float(h["xGA"]) for h in last5) / len(last5))
        home = [h for h in hist if h["h_a"] == "h"]; away = [h for h in hist if h["h_a"] == "a"]
        hd = (sum(float(h["npxGD"]) for h in home) / len(home)) if home else None; ad = (sum(float(h["npxGD"]) for h in away) / len(away)) if away else None
        ppda = sum(float(h["ppda"]["att"]) / max(1, float(h["ppda"]["def"])) for h in last5) / len(last5)
        xpts = sum(float(h["xpts"]) for h in hist); pts = sum(int(h["pts"]) for h in hist)
        L.append(f"- 시즌 {n}경기 xG {xg:.2f}/xGA {xga:.2f} (npxGD {xg - xga:+.2f}) · 최근5 {l5[0]:.2f}/{l5[1]:.2f} · 홈 npxGD {hd if hd is None else round(hd, 2)} / 원정 {ad if ad is None else round(ad, 2)} · xPts {xpts:.1f} vs 승점 {pts} ({'운 좋음' if pts - xpts > 2 else '운 나쁨' if xpts - pts > 2 else '적정'}) · 최근5 PPDA {ppda:.1f}")
        rows = []
        for h in hist[-6:]:
            rows.append(f"{h['date'][5:10]} {'홈' if h['h_a'] == 'h' else '원정'} {h['scored']}-{h['missed']} {h['result'].upper()} xG {float(h['xG']):.2f}:{float(h['xGA']):.2f}")
        L.append("- 최근 6경기(Understat): " + " / ".join(rows))
    # 선수
    players = td.get("players") or []
    if players:
        tot_xg = sum(float(p["xG"]) for p in players) or 1; tot_xa = sum(float(p["xA"]) for p in players) or 1
        tot_min = max(float(p["time"]) for p in players) * 11 if players else 1
        top = sorted(players, key=lambda p: -(float(p["xG"]) + float(p["xA"])))[:6]
        L.append("- 핵심 선수(xG+xA 비중): " + ", ".join(f"{p['player_name']}({p['position']}) {float(p['xG']):.1f}xG+{float(p['xA']):.1f}xA={((float(p['xG']) + float(p['xA'])) / (tot_xg + tot_xa)) * 100:.0f}% {int(float(p['time']) / max(1, int(p['games'])))}분/경기" for p in top))
        if absent:
            miss = []
            for a in absent:
                an = norm(a); hit = [p for p in players if an and (an in norm(p["player_name"]) or norm(p["player_name"]).split()[-1] == an.split()[-1])]
                for p in hit[:1]:
                    miss.append((p["player_name"], (float(p["xG"]) + float(p["xA"])) / (tot_xg + tot_xa) * 100, float(p["time"]) / tot_min * 11 * 100))
            if miss:
                L.append("- **결장 영향**: " + ", ".join(f"{m[0]} 공격 기여 {m[1]:.0f}%·출전 {m[2]:.0f}%" for m in miss) + f" → 공격 기여 합 {sum(m[1] for m in miss):.0f}%")
    # 포메이션(Understat statistics.formation)
    fm = (td.get("statistics") or {}).get("formation") or {}
    if fm:
        fs = sorted(fm.items(), key=lambda kv: -float(kv[1].get("time", 0)))[:3]
        L.append("- 포메이션(시간 비중): " + ", ".join(f"{k} {float(v.get('time', 0)) / max(1, sum(float(x.get('time', 0)) for x in fm.values())) * 100:.0f}% (xG {float(v.get('xG', 0)):.1f}/xGA {float(v.get('against', {}).get('xG', 0)) if isinstance(v.get('against'), dict) else 0:.1f})" for k, v in fs))
    # ESPN 최근 경기 선발·슈팅
    ms = espn_matches(t["title"], code)
    if ms:
        last = ms[-3:]
        parts = []
        prev_xi = None; changes = []
        for d, side, eid, m in ms[-6:]:
            xi = {p["n"] for p in m.get("rosters", {}).get(side, {}).get("starters", [])}
            if prev_xi and xi:
                changes.append(len(prev_xi - xi))
            if xi:
                prev_xi = xi
        for d, side, eid, m in last:
            opp = m["away" if side == "home" else "home"]; me = m[side]
            s = m.get("stats", {}).get(side, {}); so = m.get("stats", {}).get("away" if side == "home" else "home", {})
            parts.append(f"{d[5:10]} {'홈' if side == 'home' else '원정'} vs {opp['team']} {me.get('score')}-{opp.get('score')} 슈팅 {s.get('totalShots')}({s.get('shotsOnTarget')}):{so.get('totalShots')}({so.get('shotsOnTarget')}) {m.get('rosters', {}).get(side, {}).get('formation', '')}")
        L.append("- 최근 3경기(ESPN): " + " / ".join(parts) + (f" · 선발 교체 수(경기당) {sum(changes) / len(changes):.1f}" if changes else ""))
        xi = ms[-1][3].get("rosters", {}).get(ms[-1][1], {})
        if xi.get("starters"):
            L.append(f"- 직전 선발 {xi.get('formation', '')}: " + ", ".join(p["n"] for p in xi["starters"]))
        # 상대 포메이션별 성적(백3 vs 백4, 세부 포메이션)
        byf = {}
        for d, side, eid, m in ms:
            opp = "away" if side == "home" else "home"
            f = (m.get("rosters", {}).get(opp, {}) or {}).get("formation") or "?"
            back = "백3" if f.startswith(("3", "5")) else "백4" if f.startswith("4") else "?"
            try:
                gf, ga = int(m[side]["score"]), int(m[opp]["score"])
            except (TypeError, ValueError):
                continue
            s_ = m.get("stats", {}).get(side, {}); so = m.get("stats", {}).get(opp, {})
            for k in (back, f):
                r = byf.setdefault(k, {"n": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "sot": 0, "sota": 0})
                r["n"] += 1; r["gf"] += gf; r["ga"] += ga
                r["w" if gf > ga else "d" if gf == ga else "l"] += 1
                r["sot"] += num(s_.get("shotsOnTarget")) or 0; r["sota"] += num(so.get("shotsOnTarget")) or 0
        parts = [f"vs {k}: {v['w']}승{v['d']}무{v['l']}패 {v['gf']}-{v['ga']} (유효 {v['sot']:.0f}:{v['sota']:.0f})" for k, v in sorted(byf.items(), key=lambda kv: -kv[1]["n"]) if v["n"] >= 2]
        if parts:
            L.append("- 상대 포메이션별: " + " / ".join(parts[:6]))
    return "\n".join(L)


def h2h_md(home, away):
    fh, fa = find_team(home), find_team(away)
    if not fh or not fa:
        return ""
    lg = fh[0]; d = fh[3]; th, ta = fh[1]["title"], fa[1]["title"]
    out = []
    for m in d.get("dates") or []:
        if {m["h"]["title"], m["a"]["title"]} == {th, ta} and m.get("isResult"):
            out.append(f"{m['datetime'][:10]} {m['h']['title']} {m['goals']['h']}-{m['goals']['a']} {m['a']['title']} (xG {float(m['xG']['h']):.2f}:{float(m['xG']['a']):.2f})")
    return ("- 이번 시즌 맞대결: " + " / ".join(out)) if out else ""


def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("update"); s.add_argument("--league"); s.add_argument("--refresh", action="store_true")
    s = sub.add_parser("profile"); s.add_argument("team"); s.add_argument("--absent")
    s = sub.add_parser("card"); s.add_argument("home"); s.add_argument("away"); s.add_argument("--absent-home"); s.add_argument("--absent-away")
    a = ap.parse_args()
    if a.cmd == "update":
        cmd_update(a)
    elif a.cmd == "profile":
        print(profile_md(a.team, a.absent.split(",") if a.absent else None))
    else:
        print(profile_md(a.home, a.absent_home.split(",") if a.absent_home else None)); print(); print(profile_md(a.away, a.absent_away.split(",") if a.absent_away else None)); print(); print(h2h_md(a.home, a.away))


if __name__ == "__main__":
    main()
