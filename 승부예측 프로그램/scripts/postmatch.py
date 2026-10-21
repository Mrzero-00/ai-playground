#!/usr/bin/env python3
"""경기 후 사실 수집 (사용자 지시 2026-10-18 — 데이터 개선 ⑤)
왜: '선수 A 결장'을 요인으로 넣었는데 실제로 A가 빠졌는지, 진 팀이 내용도 나빴는지(운 vs 분석)를 확인하지 않았다.
    이게 없으면 맞는 요인을 버리거나 틀린 요인을 유지하게 된다.
무엇(축구, 결과 나온 경기):
  - ESPN summary: 실제 선발 XI·교체 투입, 슈팅·유효슈팅·점유율·퇴장(boxscore), 전반 점수(header linescores)
  - Understat(5대 리그): 경기 xG (getLeagueData dates)
  - 근거기록의 '결장' 요인(선수 이름이 있는 것) → 실제 명단에 있었는지 대조 → data/결장검증.csv
저장: data/경기후_<회차>.json · data/경기후.csv(한 행=한 경기) · data/결장검증.csv
사용: python3 scripts/postmatch.py --round 123
"""
import argparse, csv, datetime as dt, json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
import match_inputs as M  # noqa: E402

REC = os.path.join(ROOT, "전체경기기록.csv")
EVI = os.path.join(ROOT, "data", "근거기록.csv")
OUT_CSV = os.path.join(ROOT, "data", "경기후.csv")
ABS_CSV = os.path.join(ROOT, "data", "결장검증.csv")
COLS = ["회차", "번호", "경기", "점수", "전반점수", "홈xG", "원정xG", "xG출처", "홈슈팅", "원정슈팅", "홈유효", "원정유효", "홈점유", "원정점유", "홈퇴장", "원정퇴장", "event", "수집"]
ACOLS = ["회차", "번호", "경기", "팀", "선수", "요인상태", "실제", "근거", "수집"]
LEAGUE_US = {"잉글랜드 프리미어리그": "EPL", "스페인 라리가": "La_liga", "독일 분데스리가": "Bundesliga", "이탈리아 세리에A": "Serie_A", "프랑스 리그1": "Ligue_1"}


def plain(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()


def summary(eid):
    return M.cached(os.path.join(M.SB_DIR, f"sum_{eid}_post.json"), f"https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event={eid}", 24 * 30)


def stat(team, name):
    for s in team.get("statistics", []):
        if s.get("name") == name:
            return s.get("displayValue")
    return ""


def us_xg(lg, home_eng, away_eng, day):
    d = M.us_league(lg) or {}
    for g in d.get("dates", []):
        if not g.get("isResult"):
            continue
        if g.get("datetime", "")[:10] not in day:
            continue
        if M.matcher(home_eng)(g["h"]["title"]) and M.matcher(away_eng)(g["a"]["title"]):
            return float(g["xG"]["h"]), float(g["xG"]["a"])
    return None


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--round", required=True)
    ap.add_argument("--refresh", action="store_true", help="이미 기록된 결장검증 행을 지우고 다시 대조(매칭 규칙을 고친 뒤 소급 적용)")
    a = ap.parse_args()
    rnd = str(a.round)
    names = json.load(open(os.path.join(ROOT, "data", "team_names.json"), encoding="utf-8"))
    inp = json.load(open(os.path.join(ROOT, "data", f"입력_{rnd}.json"), encoding="utf-8")) if os.path.exists(os.path.join(ROOT, "data", f"입력_{rnd}.json")) else {}
    rows = [r for r in csv.DictReader(open(REC, encoding="utf-8-sig")) if r["회차"] == rnd and r["종목"] == "축구" and re.fullmatch(r"\d+:\d+", r.get("점수") or "")]
    jp = os.path.join(ROOT, "data", f"경기후_{rnd}.json")
    store = json.load(open(jp, encoding="utf-8")) if os.path.exists(jp) else {}
    now = dt.datetime.now(M.KST).strftime("%Y-%m-%d %H:%M")
    for r in rows:
        if r["번호"] in store:
            continue
        eid = (inp.get(r["번호"]) or {}).get("event")
        if not eid:
            ko = M.kickoff(r["시각"], dt.datetime.now(M.KST))
            eh = str(names.get(r["홈"]) or r["홈"]); ea = str(names.get(r["원정"]) or r["원정"])
            eid = M.find_event(ko, eh, ea) if ko else None
        g = {"경기": f"{r['홈']} - {r['원정']}", "점수": r["점수"], "event": eid, "수집": now, "홈": {}, "원정": {}}
        if eid:
            j = summary(eid) or {}
            # 전반 점수 — header.competitions[0].competitors[].linescores[0] (ESPN 축구는 전·후반 2칸)
            try:
                hc = ((j.get("header") or {}).get("competitions") or [{}])[0]
                ht = {}
                for c in hc.get("competitors", []):
                    ls = c.get("linescores") or []
                    if ls:
                        ht["홈" if c.get("homeAway") == "home" else "원정"] = str(ls[0].get("displayValue", "")).strip()
                if ht.get("홈", "").isdigit() and ht.get("원정", "").isdigit():
                    g["전반점수"] = f"{ht['홈']}:{ht['원정']}"
            except (KeyError, IndexError, TypeError):
                pass
            teams = (j.get("boxscore") or {}).get("teams", [])
            for t in teams:
                side = "홈" if t.get("homeAway") == "home" else "원정"
                g[side].update({"팀": t["team"]["displayName"], "슈팅": stat(t, "totalShots"), "유효": stat(t, "shotsOnTarget"),
                                "점유": stat(t, "possessionPct"), "퇴장": stat(t, "redCards")})
            for ro in j.get("rosters", []):
                side = "홈" if ro.get("homeAway") == "home" else "원정"
                g[side]["선발"] = [p["athlete"]["displayName"] for p in ro.get("roster", []) if p.get("starter")]
                g[side]["교체투입"] = [p["athlete"]["displayName"] for p in ro.get("roster", []) if not p.get("starter") and p.get("subbedIn")]
                g[side]["명단"] = [p["athlete"]["displayName"] for p in ro.get("roster", [])]
        lg = LEAGUE_US.get(r["리그"])
        if lg:
            eh = str(names.get(r["홈"]) or r["홈"]); ea = str(names.get(r["원정"]) or r["원정"])
            ko = M.kickoff(r["시각"], dt.datetime.now(M.KST))
            days = {(ko - dt.timedelta(days=1)).strftime("%Y-%m-%d"), ko.strftime("%Y-%m-%d")} if ko else set()
            x = us_xg(lg, eh, ea, days)
            if x:
                g["홈"]["xG"], g["원정"]["xG"] = x; g["xG출처"] = f"Understat {lg}"
        store[r["번호"]] = g
    json.dump(store, open(jp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # 한 행 CSV
    old = list(csv.DictReader(open(OUT_CSV, encoding="utf-8-sig"))) if os.path.exists(OUT_CSV) else []
    idx = {(x["회차"], x["번호"]): x for x in old}
    for no, g in store.items():
        row = {"회차": rnd, "번호": no, "경기": g["경기"], "점수": g["점수"], "전반점수": g.get("전반점수", ""), "홈xG": g["홈"].get("xG", ""), "원정xG": g["원정"].get("xG", ""),
                    "xG출처": g.get("xG출처", ""), "홈슈팅": g["홈"].get("슈팅", ""), "원정슈팅": g["원정"].get("슈팅", ""), "홈유효": g["홈"].get("유효", ""),
                    "원정유효": g["원정"].get("유효", ""), "홈점유": g["홈"].get("점유", ""), "원정점유": g["원정"].get("점유", ""),
                    "홈퇴장": g["홈"].get("퇴장", ""), "원정퇴장": g["원정"].get("퇴장", ""), "event": g.get("event") or "", "수집": g["수집"]}
        prev = idx.get((rnd, no))
        if prev is None:
            old.append(row); idx[(rnd, no)] = row
        else:
            # 기존 행은 빈 칸만 채운다(열 추가 뒤 재수집해도 과거 값을 지우지 않음)
            for k, v in row.items():
                if v not in ("", None) and not (prev.get(k) or "").strip():
                    prev[k] = v
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(old)
    # 결장 검증 — 라틴 문자 이름만 대조(한글 표기는 '미확인')
    ab = list(csv.DictReader(open(ABS_CSV, encoding="utf-8-sig"))) if os.path.exists(ABS_CSV) else []
    if a.refresh:
        ab = [x for x in ab if x["회차"] != rnd]
    seen = {(x["회차"], x["번호"], x["선수"]) for x in ab}
    if os.path.exists(EVI):
        for e in csv.DictReader(open(EVI, encoding="utf-8-sig")):
            if e["회차"] != rnd or e["구분"] != "요인" or e["유형"] != "결장" or not e["선수"] or e["번호"] not in store:
                continue
            if (rnd, e["번호"], e["선수"]) in seen:
                continue
            g = store[e["번호"]]; side = "홈" if e["팀"] == "홈" else "원정"
            roster = g.get(side, {}).get("명단") or []
            starters = g.get(side, {}).get("선발") or []
            parts = [plain(re.sub(r"[\(（].*?[\)）]", "", p)).strip() for p in re.split(r"[·,/]| 외", e["선수"]) if p.strip()]   # 괄호(한자·설명) 제거 (2026-10-19 우한 Sauer(绍尔) 오류)
            parts = [p for p in parts if p]
            if not roster:
                real = "미확인(명단 없음)"
            elif not all(re.search(r"[a-z]", p) for p in parts):
                real = "미확인(한글 이름)"
            else:
                # 2026-10-21 수정: 성(姓)만 대조하면 동성이인을 '출전'으로 오판한다.
                # 124회 PSG-바르샤에서 결장이 맞은 Eric Garcia 가 로스터의 Joan Garcia 와 매칭돼
                # '출전(선발)'로 기록됐고, 그 탓에 맞는 결장 요인이 '틀린 요인'으로 학습될 뻔했다.
                # → 이름의 유의미한 토큰(3자 이상)이 **전부** 들어맞는 로스터 이름만 매칭으로 센다.
                def toks(p):
                    ts = [t for t in p.split() if len(t) >= 3]
                    return ts or ([p.split()[-1]] if p.split() else [])

                def tmatch(t, n):
                    # 부분 문자열 매칭은 azon ⊂ Sazonov 같은 오탐을 낸다 → 토큰 단위 일치(또는 5자 이상 접두)
                    nt = plain(n).split()
                    return any(t == x or (len(t) >= 5 and x.startswith(t)) for x in nt)

                def hit_in(p, names):
                    ts = toks(p)
                    return bool(ts) and any(all(tmatch(t, n) for t in ts) for n in names)

                hits = [p for p in parts if hit_in(p, roster)]
                st = [p for p in parts if hit_in(p, starters)]
                weak = [p for p in parts if not any(len(t) >= 3 for t in toks(p))]
                real = "출전(선발)" if st else "명단 포함(벤치)" if hits else ("미확인(이름 매칭 실패)" if weak else "결장 맞음")
            ab.append({"회차": rnd, "번호": e["번호"], "경기": e["경기"], "팀": e["팀"], "선수": e["선수"], "요인상태": e["상태"], "실제": real,
                       "근거": "ESPN 명단", "수집": now})
    with open(ABS_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=ACOLS); w.writeheader(); w.writerows(ab)
    from collections import Counter
    c = Counter(x["실제"] for x in ab if x["회차"] == rnd)
    print(f"{rnd}회 경기 후: {len(store)}경기 → {jp} · data/경기후.csv · 결장 검증 {dict(c)}")


if __name__ == "__main__":
    main()
