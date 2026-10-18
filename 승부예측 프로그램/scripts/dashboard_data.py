#!/usr/bin/env python3
"""대시보드용 JSON 내보내기 (사용자 요청 2026-10-19: 추천 조합 + 리그별→팀별 분석 정보 웹 대시보드, Vercel 배포)
읽기: 추천기록.csv · 구매기록.csv · 구매일정.csv · 전체경기기록.csv · data/과정채점.csv · data/teamdb/* · 분석규칙.md(최우선 규칙)
쓰기: ../betman-dashboard/data/*.json  (summary.json · recommendations.json · tickets.json · teams/<league>.json · process.json · rules.json)
사용: python3 scripts/dashboard_data.py [--out <dir>]
"""
import argparse, csv, datetime as dt, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
DEFAULT_OUT = os.path.join(os.path.dirname(ROOT), "betman-dashboard", "data")
import teamdb as tdb


def rows(path):
    p = os.path.join(ROOT, path)
    return list(csv.DictReader(open(p, encoding="utf-8-sig"))) if os.path.exists(p) else []


def fnum(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def build(out):
    os.makedirs(os.path.join(out, "teams"), exist_ok=True)
    rec = rows("추천기록.csv"); buy = rows("구매기록.csv"); sched = rows("구매일정.csv"); games = rows("전체경기기록.csv"); proc = rows("data/과정채점.csv")
    # ---- 추천(다리) + 조합 단위
    recs = [r for r in rec if r.get("구분") == "추천"]
    by_round = collections.defaultdict(lambda: {"legs": 0, "hit": 0, "pending": 0})
    combos = collections.defaultdict(list)
    for r in recs:
        k = r["회차"]; by_round[k]["legs"] += 1
        if r.get("적중") in ("0", "1"):
            by_round[k]["hit"] += int(r["적중"])
        else:
            by_round[k]["pending"] += 1
        combos[(r["회차"], r.get("조합") or "(단일)")].append(r)
    combo_rows = []
    for (rnd, title), legs in combos.items():
        scored = all(l.get("적중") in ("0", "1") for l in legs)
        hit = all(l.get("적중") == "1" for l in legs) if scored else None
        odds = 1.0
        for l in legs:
            o = fnum(l.get("배당")); odds *= o if o else 1
        last_time = max(l.get("시각", "") for l in legs)
        if not scored and last_time and last_time[:16] < (dt.datetime.now() - dt.timedelta(days=1)).strftime("%Y-%m-%d %H:%M"):
            scored = True; hit = None   # 결과 미채점 옛 조합은 '진행'으로 두지 않는다
        combo_rows.append({"round": rnd, "title": title, "legs": [{"no": l["번호"], "game": l["경기"], "pick": l["선택"], "type": l.get("게임", ""), "odds": fnum(l.get("배당")), "prob": fnum(l.get("확률")), "time": l.get("시각", ""), "result": l.get("결과", ""), "hit": l.get("적중", "")} for l in legs],
                           "odds": round(odds, 2), "scored": scored, "hit": hit, "bought": any(fnum(l.get("구매")) for l in legs), "time": min(l.get("시각", "") for l in legs)})
    combo_rows.sort(key=lambda c: (c["round"], c["time"]), reverse=True)
    sc = [c for c in combo_rows if c["scored"] and len(c["legs"]) >= 2]
    combo_rate = (sum(1 for c in sc if c["hit"]) / len(sc)) if sc else None
    legs_scored = [r for r in recs if r.get("적중") in ("0", "1")]
    leg_rate = (sum(int(r["적중"]) for r in legs_scored) / len(legs_scored)) if legs_scored else None
    # ---- 티켓
    tickets = [{"date": b["date"], "round": b["round"], "ticket": b["ticket"], "legs": b["legs"], "n": b["n"], "odds": b["odds"], "stake": fnum(b["stake"]), "hit_prob": b.get("hit_prob"), "legs_hit": b.get("legs_hit"), "result": b.get("result"), "payout": fnum(b.get("payout")), "note": b.get("note", "")[:200]} for b in buy]
    stake = sum(t["stake"] or 0 for t in tickets if t["stake"]); payout = sum(t["payout"] or 0 for t in tickets if t["payout"])
    # ---- 예정(구매일정 대기)
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    upcoming = [{"round": s["회차"], "combo": s["조합"], "legs": s["다리"], "close": s["마감"], "check": s["점검시각"], "status": s["상태"], "memo": s.get("메모", "")[:160]}
                for s in sched if s.get("상태") not in ("완료", "낙첨", "적중", "점검완료") and (s.get("마감") or "") >= now]
    # ---- 과정 채점
    quad = collections.Counter(p["4분면"] for p in proc)
    proc_by_round = collections.defaultdict(collections.Counter)
    for p in proc:
        proc_by_round[p["회차"]][p["4분면"]] += 1
    # ---- 팀 DB (리그별)
    leagues = {}
    for lg, code in tdb.LEAGUES.items():
        d = tdb.jload(os.path.join(tdb.DB, "understat", f"{lg}_{tdb.SEASON}.json"), {})
        teams = []
        for tid, t in (d.get("teams") or {}).items():
            hist = t.get("history", []); n = len(hist)
            if not n:
                continue
            xg = sum(float(h["xG"]) for h in hist) / n; xga = sum(float(h["xGA"]) for h in hist) / n
            pts = sum(int(h["pts"]) for h in hist); xpts = sum(float(h["xpts"]) for h in hist)
            td = tdb.jload(os.path.join(tdb.DB, "understat", f"team_{tid}.json"), {})
            players = sorted(td.get("players") or [], key=lambda p: -(float(p["xG"]) + float(p["xA"])))[:8]
            tot = sum(float(p["xG"]) + float(p["xA"]) for p in (td.get("players") or [])) or 1
            fm = (td.get("statistics") or {}).get("formation") or {}
            fsum = sum(float(v.get("time", 0)) for v in fm.values()) or 1
            ms = tdb.espn_matches(t["title"], code)
            recent = []
            for dte, side, eid, m in ms[-8:]:
                opp = m["away" if side == "home" else "home"]; me = m[side]
                s_ = m.get("stats", {}).get(side, {}); so = m.get("stats", {}).get("away" if side == "home" else "home", {})
                recent.append({"date": dte[:10], "home": side == "home", "opp": opp["team"], "gf": me.get("score"), "ga": opp.get("score"), "sot": s_.get("shotsOnTarget"), "sota": so.get("shotsOnTarget"), "shots": s_.get("totalShots"), "shotsa": so.get("totalShots"), "formation": (m.get("rosters", {}).get(side, {}) or {}).get("formation"), "opp_formation": (m.get("rosters", {}).get("away" if side == "home" else "home", {}) or {}).get("formation")})
            teams.append({"id": tid, "name": t["title"], "games": n, "pts": pts, "xpts": round(xpts, 1), "xg": round(xg, 2), "xga": round(xga, 2), "npxgd": round(xg - xga, 2),
                          "history": [{"date": h["date"][:10], "ha": h["h_a"], "gf": h["scored"], "ga": h["missed"], "xg": round(float(h["xG"]), 2), "xga": round(float(h["xGA"]), 2), "res": h["result"]} for h in hist],
                          "players": [{"name": p["player_name"], "pos": p["position"], "games": p["games"], "min": p["time"], "goals": p["goals"], "xg": round(float(p["xG"]), 2), "xa": round(float(p["xA"]), 2), "share": round((float(p["xG"]) + float(p["xA"])) / tot * 100)} for p in players],
                          "formations": sorted([{"f": k, "share": round(float(v.get("time", 0)) / fsum * 100), "xg": round(float(v.get("xG", 0)), 1), "xga": round(float((v.get("against") or {}).get("xG", 0)) if isinstance(v.get("against"), dict) else 0, 1)} for k, v in fm.items()], key=lambda x: -x["share"])[:4],
                          "recent": recent})
        teams.sort(key=lambda x: -x["pts"])
        leagues[lg] = {"code": code, "teams": teams}
        json.dump({"league": lg, "code": code, "updated": dt.date.today().isoformat(), "teams": teams}, open(os.path.join(out, "teams", f"{lg}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    # ---- 규칙(최우선만)
    rules = []
    for line in open(os.path.join(ROOT, "분석규칙.md"), encoding="utf-8"):
        if line.startswith("- [최우선"):
            rules.append(re.sub(r"\*\*", "", line.strip("- \n"))[:300])
    summary = {"updated": dt.datetime.now().strftime("%Y-%m-%d %H:%M"), "mode": "가상 추천(실투자 중단, 조합 성공률 80% 근처에서 재개)",
               "leg_rate": leg_rate, "legs_scored": len(legs_scored), "combo_rate": combo_rate, "combos_scored": len(sc),
               "by_round": {k: v for k, v in sorted(by_round.items())}, "stake": stake, "payout": payout,
               "process": {"total": len(proc), "quad": dict(quad), "by_round": {k: dict(v) for k, v in proc_by_round.items()}},
               "leagues": [{"name": lg, "code": c["code"], "teams": len(c["teams"])} for lg, c in leagues.items()], "rules": rules[-8:]}
    json.dump(summary, open(os.path.join(out, "summary.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"combos": combo_rows[:120], "upcoming": upcoming}, open(os.path.join(out, "recommendations.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(tickets, open(os.path.join(out, "tickets.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump([{k: p[k] for k in ("회차", "번호", "경기", "예측", "확률", "결과", "점수", "결과적중", "지배", "내용근거", "내용적중", "4분면", "요인검증", "정합성")} for p in proc], open(os.path.join(out, "process.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"→ {out}: summary(다리 {leg_rate and round(leg_rate*100)}% n={len(legs_scored)}, 조합 {combo_rate and round(combo_rate*100)}% n={len(sc)}), 조합 {len(combo_rows)}, 티켓 {len(tickets)}, 팀 {sum(len(c['teams']) for c in leagues.values())}, 과정 {len(proc)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--out", default=DEFAULT_OUT)
    build(ap.parse_args().out)
