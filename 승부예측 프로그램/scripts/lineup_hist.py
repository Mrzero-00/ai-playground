#!/usr/bin/env python3
"""5대 리그 과거 선발 명단 — ESPN 경기 요약에서 받아 data/lineups/<code>.json 에 쌓는다 (2026-11-17).

왜: 기준선은 팀 레이팅 하나로 계산하고 '오늘 누가 뛰는가'를 모른다. 결장·로테이션을 분석가가 감으로
%p 환산한 것은 잡음으로 판정됐다(요인 0/8). 선발 명단이 팀 레이팅 위에 정보를 더하는지 큰 표본으로 재려면
과거 선발이 필요하다. 채점은 `baseline_lab.py --lineup`.

    python3 scripts/lineup_hist.py fetch [--from 201908] [--to 202605] [--leagues eng.1,esp.1]
    python3 scripts/lineup_hist.py stat

형식: {"players": {id: 이름}, "events": {eid: {"t": ISO, "h": 팀, "a": 팀, "hg": n, "ag": n,
       "H": [[선수id, 선발 1/0, 골, 도움], ...], "A": [...]}}}   (뛴 선수만)
"""
import argparse, json, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "data", "lineups")
CODES = ("eng.1", "esp.1", "ger.1", "ita.1", "fra.1")


def curl(url, n=3):
    for i in range(n):
        t = subprocess.run(["curl", "-sS", "--compressed", "-m", "40", url], capture_output=True, text=True).stdout
        try:
            return json.loads(t)
        except ValueError:
            time.sleep(2 * (i + 1))
    return None


def path(code):
    return os.path.join(DIR, f"{code}.json")


def load(code):
    try:
        return json.load(open(path(code), encoding="utf-8"))
    except (OSError, ValueError):
        return {"players": {}, "events": {}}


def months(a, b):
    y, m = int(a[:4]), int(a[4:])
    while f"{y}{m:02d}" <= b:
        yield f"{y}{m:02d}"
        m += 1
        if m > 12:
            y, m = y + 1, 1


def one(eid):
    j = curl(f"https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event={eid}")
    if not j:
        return eid, None, {}
    try:
        comp = j["header"]["competitions"][0]
        if not comp["status"]["type"].get("completed"):
            return eid, None, {}
        ev = {"t": comp["date"]}
        for c in comp["competitors"]:
            k = "h" if c["homeAway"] == "home" else "a"
            ev[k] = c["team"]["displayName"]; ev[k + "g"] = int(c["score"])
    except (KeyError, ValueError, TypeError, IndexError):
        return eid, None, {}
    names = {}
    for r in j.get("rosters", []):
        rows = []
        for p in r.get("roster", []):
            if not (p.get("starter") or p.get("subbedIn")):
                continue
            pid = str(p["athlete"]["id"]); names[pid] = p["athlete"].get("displayName", "")
            st = {s["name"]: s.get("value") for s in p.get("stats", [])}
            rows.append([pid, 1 if p.get("starter") else 0, int(st.get("totalGoals") or 0), int(st.get("goalAssists") or 0)])
        ev["H" if r.get("homeAway") == "home" else "A"] = rows
    return eid, ev, names


def fetch(a):
    os.makedirs(DIR, exist_ok=True)
    for code in (a.leagues.split(",") if a.leagues else CODES):
        db = load(code)
        ids = []
        for ym in months(a.frm, a.to):
            j = curl(f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard?dates={ym}&limit=400") or {}
            ids += [e["id"] for e in j.get("events", []) if e.get("status", {}).get("type", {}).get("completed")]
        todo = [e for e in dict.fromkeys(ids) if e not in db["events"]]
        print(f"{code}: 경기 {len(ids)} · 새로 받을 것 {len(todo)}", flush=True)
        done = 0
        with ThreadPoolExecutor(8) as ex:
            for eid, ev, names in ex.map(one, todo):
                if ev:
                    db["events"][eid] = ev; db["players"].update(names)
                done += 1
                if done % 500 == 0:
                    json.dump(db, open(path(code), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
                    print(f"  {done}/{len(todo)}", flush=True)
        json.dump(db, open(path(code), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def stat(a):
    for code in CODES:
        db = load(code); ev = db["events"].values()
        ok = sum(1 for e in ev if len([p for p in e.get("H", []) if p[1]]) == 11 and len([p for p in e.get("A", []) if p[1]]) == 11)
        ts = sorted(e["t"][:10] for e in ev)
        print(f"{code}: 경기 {len(db['events'])} · 양 팀 선발 11명 {ok} · 선수 {len(db['players'])} · {ts[0] if ts else ''}~{ts[-1] if ts else ''}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=("fetch", "stat"))
    ap.add_argument("--from", dest="frm", default="201908")
    ap.add_argument("--to", default="202605")
    ap.add_argument("--leagues", default="")
    a = ap.parse_args()
    sys.exit({"fetch": fetch, "stat": stat}[a.cmd](a))
