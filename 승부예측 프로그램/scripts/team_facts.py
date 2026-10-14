#!/usr/bin/env python3
"""팀 팩트시트 자동 수집 — 조사 에이전트의 기억(2025년 지식)에 의존하지 않도록, 분석 전에 날짜가 분명한 1차 자료로
감독·여름 이적·현재 순위·최근 5경기를 팀노트에 박아 넣는다 (2026-10-14, 로드리 "부상 결장" 오판 재발 방지).

출처: 영문 위키피디아 "<YYYY–YY> <Team> season"(없으면 팀 문서) 인포박스·이적 절, ESPN 공개 API(순위·최근 결과).
결과: 팀노트/<베트맨 팀명>.md 안의 <!-- FACTS:START --> ~ <!-- FACTS:END --> 블록을 교체하고,
      회차별분석/팩트시트_<회차>.md 에 표로 저장한다. 블록 분석·추천 전에 반드시 돌리고, 에이전트는 이 블록을 먼저 읽는다.

사용:
  python3 scripts/team_facts.py --round 122                 # 회차의 축구 팀 전부(결과 없는 경기만)
  python3 scripts/team_facts.py --teams "맨체스터 시티,파리 생제르맹"
  python3 scripts/team_facts.py --round 122 --stale 7       # 7일 안에 팩트시트가 없는 팀만
  python3 scripts/team_facts.py --round 122 --check         # 수집 없이 팩트시트 누락/오래된 팀만 나열(블록 점검용)
"""
import argparse, csv, datetime as dt, json, os, re, subprocess, sys, time, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTES = os.path.join(ROOT, "팀노트")
NAMES = os.path.join(ROOT, "data", "team_names.json")
REC = os.path.join(ROOT, "전체경기기록.csv")
UA = "team_facts/1.0 (betman analysis; contact: admin@marcspon.com)"
WIKI_GAP = 1.5  # 위키 API 요청 제한(초당 1회 이하) 준수
SEASON = "2026–27"  # 유럽·아시아 가을-봄 시즌. 단일 연도 리그(MLS·K리그·J리그·브라질)는 2026
SINGLE_YEAR = ("미국 메이저리그사커", "K리그", "일본", "J리그", "중국 슈퍼리그", "코파", "브라질", "노르웨이", "스웨덴", "핀란드")
ESPN = {"잉글랜드 프리미어리그": "eng.1", "잉글랜드 챔피언십": "eng.2", "스페인 라리가": "esp.1", "이탈리아 세리에A": "ita.1",
        "독일 분데스리가": "ger.1", "프랑스 리그1": "fra.1", "네덜란드 에레디비시": "ned.1", "포르투갈 프리메이라리가": "por.1",
        "UEFA 챔피언스리그": "uefa.champions", "UEFA 유로파리그": "uefa.europa", "UEFA 컨퍼런스리그": "uefa.europa.conf",
        "미국 메이저리그사커": "usa.1", "호주 A리그": "aus.1", "중국 슈퍼리그": "chn.1", "일본 J1리그": "jpn.1",
        "스코틀랜드 프리미어십": "sco.1", "벨기에 프로리그": "bel.1", "터키 쉬페르리그": "tur.1", "그리스 수페르리가": "gre.1",
        "코파 리베르타도레스": "conmebol.libertadores", "AFC 챔피언스리그 엘리트": "afc.champions"}


BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"


def curl(url, timeout=25, ua=None):
    r = subprocess.run(["curl", "-sS", "--compressed", "-m", str(timeout), "-A", ua or (UA if "wikipedia.org" in url else BROWSER_UA), url], capture_output=True, text=True)
    return r.stdout


_last_wiki = [0.0]
def wiki_json(params):
    params = {**params, "format": "json"}
    for attempt in range(3):
        wait = WIKI_GAP - (time.time() - _last_wiki[0])
        if wait > 0:
            time.sleep(wait)
        out = curl("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params))
        _last_wiki[0] = time.time()
        try:
            return json.loads(out)
        except json.JSONDecodeError:
            if "too many requests" in out.lower():
                time.sleep(5 * (attempt + 1)); continue
            return {}
    return {}


def page_exists(title):
    d = wiki_json({"action": "query", "titles": title, "redirects": 1})
    pages = (d.get("query") or {}).get("pages", {})
    for pid, pg in pages.items():
        if pid != "-1":
            return pg.get("title")
    return None


def find_season_page(eng, single_year):
    """위키 전문 검색(list=search)으로 '<시즌> <클럽> season' 문서를 찾는다. 없으면 클럽 문서."""
    seasons = ["2026"] if single_year else [SEASON, SEASON.replace("–", "-")]
    pat = re.compile(r"^(2026(–|-)27|2026) .+ season$")
    for sv in seasons:
        d = wiki_json({"action": "query", "list": "search", "srsearch": f'intitle:"{sv}" intitle:season {eng}', "srlimit": 5, "srnamespace": 0})
        for hit in (d.get("query") or {}).get("search", []):
            t = hit["title"]
            if pat.match(t) and any(tok.lower() in t.lower() for tok in re.split(r"[\s\-/]+", eng) if len(tok) > 2):
                return t, "season"
    d = wiki_json({"action": "query", "list": "search", "srsearch": f"{eng} football club", "srlimit": 5, "srnamespace": 0})
    bad = re.compile(r"season|stadium|academy|women|reserves|ownership|supporters|rivalry|records|players|managers|history|\(disambiguation\)", re.I)
    for hit in (d.get("query") or {}).get("search", []):
        t = hit["title"]
        if not bad.search(t) and any(tok.lower() in t.lower() for tok in re.split(r"[\s\-/]+", eng) if len(tok) > 2):
            return t, "club"
    return None, None


def wikitext(title):
    d = wiki_json({"action": "parse", "page": title, "prop": "wikitext", "redirects": 1})
    return (d.get("parse") or {}).get("wikitext", {}).get("*", "") if d else ""


def strip_links(s):
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip(" |'")


def infobox(wt, key):
    m = re.search(r"^\|\s*" + key + r"\s*=\s*(.+)$", wt, re.M)
    return strip_links(m.group(1)) if m else ""


def section(wt, names):
    for n in names:
        m = re.search(r"^==+\s*" + n + r"\s*==+\s*$(.*?)(?=^==[^=]|\Z)", wt, re.M | re.S | re.I)
        if m:
            return m.group(1)
    return ""


def transfer_lines(sec, limit=8):
    out = []
    for row in sec.split("\n|-"):
        if "[[" not in row:
            continue
        cells = [strip_links(c) for c in re.split(r"\n\|\|?|\|\|", row) if c.strip()]
        cells = [c for c in cells if c and not re.fullmatch(r"[\d\s\-–/]+", c)]
        if len(cells) >= 2:
            out.append(" · ".join(cells[:5])[:110])
        if len(out) >= limit:
            break
    return out


LEAGUE_TO_ESPN = {"Premier League": "eng.1", "EFL Championship": "eng.2", "Championship": "eng.2", "La Liga": "esp.1", "Serie A": "ita.1",
                  "Bundesliga": "ger.1", "Ligue 1": "fra.1", "Eredivisie": "ned.1", "Primeira Liga": "por.1", "Scottish Premiership": "sco.1",
                  "Belgian Pro League": "bel.1", "Süper Lig": "tur.1", "Super League Greece": "gre.1", "Eliteserien": "nor.1", "Allsvenskan": "swe.1",
                  "Austrian Bundesliga": "aut.1", "Swiss Super League": "sui.1", "Czech First League": "cze.1", "Ekstraklasa": "pol.1",
                  "Danish Superliga": "den.1", "Major League Soccer": "usa.1", "J1 League": "jpn.1", "A-League": "aus.1", "Chinese Super League": "chn.1",
                  "Série A": "bra.1", "Primera División": "arg.1", "Russian Premier League": "rus.1", "Ukrainian Premier League": "ukr.1"}


def espn(code, eng):
    """순위 + 최근 5경기. 팀명은 ESPN displayName과 토큰 일치로 찾는다."""
    toks = [t for t in re.split(r"[\s\-/]+", eng.lower()) if len(t) > 2 and t not in ("fc", "cf", "sc", "afc", "club", "united", "city", "de", "the", "real")]
    def score(name):
        n = name.lower(); e = re.sub(r"\b(fc|cf|sc|afc|club)\b", "", eng.lower()).strip()
        base = sum(1 for t in toks if t in n) if toks else int(eng.lower() in n)
        return base + (10 if (e and (e in n or n in e)) else 0)
    def match(name):
        return score(name) >= max(1, len(toks) - (1 if len(toks) >= 3 else 0))
    pos = ""
    try:
        d = json.loads(curl(f"https://site.api.espn.com/apis/v2/sports/soccer/{code}/standings"))
        groups = d.get("children") or [{"standings": d.get("standings", {})}]
        best = None
        for g in groups:
            for e in (g.get("standings") or {}).get("entries", []):
                sc = score(e["team"]["displayName"])
                if sc and (best is None or sc > best[0]):
                    best = (sc, e)
        if best and match(best[1]["team"]["displayName"]):
            e = best[1]; st = {s["name"]: s.get("displayValue") for s in e["stats"]}
            pos = f"{st.get('rank')}위 {st.get('gamesPlayed')}경기 {st.get('wins')}승{st.get('ties')}무{st.get('losses')}패 GD{st.get('pointDifferential')} 승점{st.get('points')} ({e['team']['displayName']})"
    except Exception:
        pass
    recent = []
    try:
        today = dt.date.today(); prev = (today.replace(day=1) - dt.timedelta(days=1))
        events = []
        for ym in (f"{prev:%Y%m}", f"{today:%Y%m}"):
            d = json.loads(curl(f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard?dates={ym}&limit=300"))
            events += d.get("events", [])
        for e in events:
            c = e["competitions"][0]
            if not c["status"]["type"].get("completed"):
                continue
            h = [x for x in c["competitors"] if x["homeAway"] == "home"][0]; a = [x for x in c["competitors"] if x["homeAway"] == "away"][0]
            if match(h["team"]["displayName"]) or match(a["team"]["displayName"]):
                recent.append(f"{e['date'][:10]} {h['team']['displayName']} {h.get('score')}-{a.get('score')} {a['team']['displayName']}")
    except Exception:
        pass
    return pos, recent[-5:]


def facts_for(team, eng, league):
    single = any(k in (league or "") for k in SINGLE_YEAR)
    title, kind = find_season_page(eng, single)
    out = {"팀": team, "영문": eng, "리그": league, "위키": title or "", "종류": kind or "", "감독": "", "이적": [], "순위": "", "최근": [], "순위(ESPN)": "", "최근(ESPN)": []}
    wt = ""
    if title:
        wt = wikitext(title)
        out["감독"] = infobox(wt, "manager") or infobox(wt, "mgr") or infobox(wt, "head coach") or infobox(wt, "head_coach")
        if kind == "season":
            out["순위"] = infobox(wt, "league result") or infobox(wt, "league")
            sec = section(wt, ["Transfers", "Transfers and loans", "Transfer", "Summer transfer window"])
            ins = section(sec, ["In", "Transfers in", "Arrivals"]) if sec else ""
            outs = section(sec, ["Out", "Transfers out", "Departures"]) if sec else ""
            out["이적"] = [("IN " + x) for x in transfer_lines(ins or sec)] + [("OUT " + x) for x in transfer_lines(outs)]
    out["국내리그"] = ""
    if title and kind == "season":
        out["국내리그"] = infobox(wt, "league")
    dom = next((v for k, v in LEAGUE_TO_ESPN.items() if k.lower() in out["국내리그"].lower()), None)
    code = dom or next((v for k, v in ESPN.items() if k in (league or "")), None)
    if code:
        out["순위(ESPN)"], out["최근(ESPN)"] = espn(code, eng)
    if dom and dom != next((v for k, v in ESPN.items() if k in (league or "")), None) and (league or ""):
        comp = next((v for k, v in ESPN.items() if k in league), None)
        if comp:
            _, rc = espn(comp, eng); out["최근(ESPN)"] = (out["최근(ESPN)"] + rc)[-6:]
    return out


def write_note(team, f):
    path = os.path.join(NOTES, f"{team}.md")
    today = dt.date.today().isoformat()
    lines = [f"<!-- FACTS:START -->", f"## 팩트시트 (자동 수집 {today}) — 조사 전 반드시 읽고, 아래 사실과 다른 뉴스 요약은 '미확인'으로 둔다",
             f"- 출처: 위키 '{f['위키']}'({f['종류'] or '없음'}), ESPN {'있음' if f['순위(ESPN)'] or f['최근(ESPN)'] else '없음'}",
             f"- 감독: {f['감독'] or '미확인'}",
             f"- 리그 순위: {f['순위(ESPN)'] or f['순위'] or '미확인'}"]
    if f["이적"]:
        lines.append("- 2026 여름 이적(위키 이적 표, 앞 8줄씩): " + " / ".join(f["이적"][:12]))
    if f["최근(ESPN)"]:
        lines.append("- 최근 경기(ESPN, 최대 28일): " + " / ".join(f["최근(ESPN)"]))
    lines.append("<!-- FACTS:END -->")
    block = "\n".join(lines) + "\n"
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else f"# {team}\n\n"
    if "<!-- FACTS:START -->" in old:
        new = re.sub(r"<!-- FACTS:START -->.*?<!-- FACTS:END -->\n?", block, old, flags=re.S)
    else:
        head, _, rest = old.partition("\n")
        new = head + "\n\n" + block + "\n" + rest.lstrip("\n")
    open(path, "w", encoding="utf-8").write(new)


def facts_age(team):
    path = os.path.join(NOTES, f"{team}.md")
    if not os.path.exists(path):
        return None
    m = re.search(r"팩트시트 \(자동 수집 (\d{4}-\d{2}-\d{2})\)", open(path, encoding="utf-8").read())
    return (dt.date.today() - dt.date.fromisoformat(m.group(1))).days if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round"); ap.add_argument("--teams"); ap.add_argument("--stale", type=int, default=0)
    ap.add_argument("--check", action="store_true"); ap.add_argument("--sport", default="축구")
    a = ap.parse_args()
    names = json.load(open(NAMES, encoding="utf-8"))
    targets = []  # (team, league)
    if a.teams:
        for t in a.teams.split(","):
            targets.append((t.strip(), ""))
    if a.round:
        seen = set()
        for r in csv.DictReader(open(REC, encoding="utf-8")):
            if r["회차"] == str(a.round) and r["종목"] == a.sport and not r["결과"] and r["제외"] != "제외":
                for t in (r["홈"], r["원정"]):
                    if t not in seen:
                        seen.add(t); targets.append((t, r["리그"]))
    if a.check or a.stale:
        rows = []
        for t, lg in targets:
            age = facts_age(t)
            if age is None or (a.stale and age > a.stale) or a.check and (age is None or age > 7):
                rows.append((t, lg, "없음" if age is None else f"{age}일 전"))
        if a.check:
            print(f"팩트시트 누락·7일 초과 {len(rows)}팀:")
            for t, lg, s in rows: print(f"  {t} ({lg}) — {s}")
            return
        targets = [(t, lg) for t, lg, s in rows]
    out = []
    for t, lg in targets:
        eng = names.get(t) or names.get(t.split()[0] if t.split() else t)
        if not eng:
            out.append({"팀": t, "영문": "", "리그": lg, "위키": "", "감독": "", "순위(ESPN)": "", "순위": "", "이적": [], "최근(ESPN)": []})
            print(f"  ✗ {t}: team_names.json에 영문명 없음 — 추가 필요"); continue
        f = facts_for(t, eng, lg); write_note(t, f); out.append(f)
        print(f"  ✓ {t} ← {f['위키'] or '위키 없음'} | 감독 {f['감독'] or '-'} | 순위 {f['순위(ESPN)'] or f['순위'] or '-'} | 이적 {len(f['이적'])}줄 | 최근 {len(f['최근(ESPN)'])}경기")
    if a.round:
        p = os.path.join(ROOT, "회차별분석", f"팩트시트_{a.round}.md")
        with open(p, "w", encoding="utf-8") as fp:
            fp.write(f"# {a.round}회 팀 팩트시트 (자동 수집 {dt.date.today()})\n\n| 팀 | 리그 | 위키 문서 | 감독 | 순위 | 이적(IN/OUT 줄) | 최근 경기 |\n|---|---|---|---|---|---|---|\n")
            for f in out:
                fp.write(f"| {f['팀']} | {f['리그']} | {f['위키'] or '-'} | {f['감독'] or '-'} | {f['순위(ESPN)'] or f['순위'] or '-'} | {len(f['이적'])} | {' / '.join(f['최근(ESPN)'][-3:]) or '-'} |\n")
        print(f"저장: {p}")


if __name__ == "__main__":
    main()
