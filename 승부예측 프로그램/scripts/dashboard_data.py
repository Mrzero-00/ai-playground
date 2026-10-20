#!/usr/bin/env python3
"""대시보드용 JSON 내보내기 (사용자 요청 2026-10-19, 10/19 2차 개편: 조합 카드+총계+성공률만, 추천 이유·회고 텍스트, 팀은 상태 텍스트)
읽기: 추천기록.csv · 전체경기기록.csv · data/근거/*.json · data/수집/*.json · data/과정채점.csv · 회차별분석/경기별_내용회고_*.md · 팀노트/*.md · data/teamdb/* · data/team_names.json
쓰기: ../betman-dashboard/data/summary.json · recommendations.json · teams/<league>.json
사용: python3 scripts/dashboard_data.py [--out <dir>]
"""
import argparse, csv, datetime as dt, glob, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
DEFAULT_OUT = os.path.join(os.path.dirname(ROOT), "betman-dashboard", "data")
import teamdb as tdb

LG_KO = {"EPL": "프리미어리그", "La_liga": "라리가", "Serie_A": "세리에A", "Bundesliga": "분데스리가", "Ligue_1": "리그1"}


def rows(path):
    p = os.path.join(ROOT, path)
    return list(csv.DictReader(open(p, encoding="utf-8-sig"))) if os.path.exists(p) else []


def fnum(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- 추천 이유 (근거 JSON → 요약, 없으면 핵심근거)
def evidence_summary(rnd, no):
    fs = glob.glob(os.path.join(ROOT, "data", "근거", f"{rnd}_{no}_*.json"))
    if not fs:
        return None
    try:
        d = json.load(open(sorted(fs)[-1], encoding="utf-8"))
        d = d[0] if isinstance(d, list) else d
    except Exception:
        return None
    b = d.get("기준선") or {}
    parts = []
    if b:
        parts.append(f"기준선 {b.get('승')}/{b.get('무')}/{b.get('패')}")
    fac = []
    for f in (d.get("요인") or [])[:5]:
        eff = f.get("영향")
        s = f"{f.get('유형')}:{f.get('선수') or f.get('내용', '')[:18]}"
        if eff is not None:
            s += f"({eff:+})"
        fac.append(s)
    if fac:
        parts.append("요인 " + ", ".join(fac))
    fin = d.get("최종") or d.get("최종확률") or {}
    if isinstance(fin, dict) and fin:
        parts.append(f"최종 {fin.get('승')}/{fin.get('무')}/{fin.get('패')}")
    return " → ".join(parts) if parts else None


def review_text(rnd, no):
    """경기별 내용 회고 md 에서 ④ 4분면·⑥ 배울 점 줄을 뽑는다."""
    for f in glob.glob(os.path.join(ROOT, "회차별분석", f"경기별_내용회고_{rnd}*.md")):
        txt = open(f, encoding="utf-8").read()
        m = re.search(rf"^## {no}\b[^\n]*\n(.*?)(?=^## |\Z)", txt, re.S | re.M)
        if m:
            body = m.group(1)
            q = re.search(r"^④\s*(.+)$", body, re.M); l = re.search(r"^⑥\s*(.+)$", body, re.M); c = re.search(r"^②\s*(.+)$", body, re.M)
            out = {}
            if c: out["내용"] = c.group(1).strip()[:220]
            if q: out["판정"] = q.group(1).strip()[:160]
            if l: out["배울점"] = l.group(1).strip()[:160]
            return out
    # 심층회고 표(| 번호 | 경기 | 선택 | 내 | 결과 | 분류 | 근거 |)에서 분류·근거
    for f in glob.glob(os.path.join(ROOT, "회차별분석", "*심층회고*.md")):
        for line in open(f, encoding="utf-8"):
            if line.startswith(f"| {no} |"):
                cells = [c.strip() for c in line.strip().strip("|").split("|")]
                if len(cells) >= 7:
                    return {"판정": cells[5][:160], "내용": cells[6][:220]}
    return None


def build(out):
    os.makedirs(os.path.join(out, "teams"), exist_ok=True)
    rec = rows("추천기록.csv"); games = rows("전체경기기록.csv"); proc = rows("data/과정채점.csv")
    sched = rows("구매일정.csv"); plan = rows("분석일정.csv"); buy = rows("구매기록.csv")
    try:
        closes = json.load(open(os.path.join(ROOT, "data", "마감시각.json"), encoding="utf-8"))   # "회차-번호" → "YYYY-MM-DD HH:MM"
    except Exception:
        closes = {}
    sched_close = {}
    for x in sched:
        legs_key = frozenset(l.split(":")[0] for l in (x.get("다리") or "").split(",") if l)
        sched_close[(x["회차"], x["조합"])] = x.get("마감", ""); sched_close[(x["회차"], legs_key)] = x.get("마감", "")
    gmap = {(g["회차"], g["번호"]): g for g in games}
    pmap = {(p["회차"], p["번호"]): p for p in proc}
    recs = [r for r in rec if r.get("구분") in ("추천", "도파민")]
    combos = collections.defaultdict(list)
    for r in recs:
        kind = r.get("구분") or "추천"
        key = (r["회차"], (r.get("조합") or "(단일)") + (f" · {r['번호']}" if kind == "도파민" else ""), kind)   # 도파민은 단식 전용이라 다리별 분리 (2026-10-20)
        combos[key].append(r)
    now = dt.datetime.now()
    combo_rows = []
    for (rnd, title, kind), legs in combos.items():
        scored = all(l.get("적중") in ("0", "1") for l in legs)
        last_time = max(l.get("시각", "") for l in legs)
        # 마지막 경기 킥오프가 지났으면 더 이상 '진행 중'이 아니다(채점 대기). 하루 지나도 미채점이면 stale.
        started = bool(last_time) and last_time[:16] <= now.strftime("%Y-%m-%d %H:%M")
        stale = (not scored) and bool(last_time) and last_time[:16] < (now - dt.timedelta(days=1)).strftime("%Y-%m-%d %H:%M")
        hit = all(l.get("적중") == "1" for l in legs) if scored else None
        odds = 1.0
        for l in legs:
            o = fnum(l.get("배당")); odds *= o if o else 1
        leg_out = []
        for l in legs:
            g = gmap.get((rnd, l["번호"]), {})
            why = evidence_summary(rnd, l["번호"]) or (g.get("핵심근거") or l.get("이유") or "")[:220]
            risk = (g.get("뉴스위험") or "")[:120]
            pr = pmap.get((rnd, l["번호"]))
            rv = review_text(rnd, l["번호"]) if l.get("적중") in ("0", "1") else None
            leg_out.append({"no": l["번호"], "game": l["경기"], "pick": l["선택"], "type": l.get("게임", ""), "odds": fnum(l.get("배당")), "prob": fnum(l.get("확률")),
                            "time": l.get("시각", ""), "result": l.get("결과", "") or (f"{g.get('결과', '')} {g.get('점수', '')}".strip()), "hit": l.get("적중", ""),
                            "why": why, "risk": risk,
                            "review": ({"quad": pr["4분면"], "content": pr["내용근거"], "pred": f"{pr['예측']} {pr['확률']}%"} if pr else {}) | (rv or {})})
        prob = None
        if all(x["prob"] is not None for x in leg_out):
            prob = 1.0
            for x in leg_out: prob *= x["prob"] / 100
        close = sched_close.get((rnd, title)) or sched_close.get((rnd, frozenset(l["번호"] for l in legs))) or ""
        if not close:
            cs = [closes.get(f"{rnd}-{l['번호']}") for l in legs if closes.get(f"{rnd}-{l['번호']}")]
            if cs:
                close = min(cs)
            elif last_time:
                try:
                    close = (dt.datetime.strptime(min(l.get("시각", "") for l in legs)[:16], "%Y-%m-%d %H:%M") - dt.timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M")
                except ValueError:
                    close = ""
        combo_rows.append({"round": rnd, "title": title, "track": kind, "close": close, "legs": leg_out, "odds": round(odds, 2), "prob": prob, "scored": scored, "stale": stale, "started": started, "hit": hit,
                           "bought": any(fnum(l.get("구매")) for l in legs), "time": min(l.get("시각", "") for l in legs), "n": len(legs)})
    combo_rows.sort(key=lambda c: (c["round"], c["time"]), reverse=True)
    current = [c for c in combo_rows if not c["scored"] and not c["stale"] and not c["started"]]
    past = [c for c in combo_rows if c["scored"] or c["stale"] or c["started"]]
    core = [c for c in combo_rows if c.get("track") != "도파민"]
    fun = [c for c in combo_rows if c.get("track") == "도파민"]
    sc = [c for c in core if c["scored"] and c["n"] >= 2]
    scf = [c for c in fun if c["scored"] and c["n"] >= 2]
    combo_rate = (sum(1 for c in sc if c["hit"]) / len(sc)) if sc else None
    fun_rate = (sum(1 for c in scf if c["hit"]) / len(scf)) if scf else None
    legs_scored = [r for r in recs if r.get("적중") in ("0", "1")]
    leg_rate = (sum(int(r["적중"]) for r in legs_scored) / len(legs_scored)) if legs_scored else None
    by_round = collections.OrderedDict()
    for c in sorted(sc, key=lambda c: c["round"]):
        d = by_round.setdefault(c["round"], {"n": 0, "hit": 0}); d["n"] += 1; d["hit"] += 1 if c["hit"] else 0
    # 과정 점수
    clean = [p for p in proc if p.get("퇴장") in ("0", "", None)]
    proc_score = (sum(int(p["내용적중"]) for p in clean) / len(clean)) if clean else None
    quad = collections.Counter(p["4분면"] for p in proc)
    # ---- 팀 상태 텍스트
    names = json.load(open(tdb_names := os.path.join(ROOT, "data", "team_names.json"), encoding="utf-8"))
    notes = {os.path.splitext(f)[0]: os.path.join(ROOT, "팀노트", f) for f in os.listdir(os.path.join(ROOT, "팀노트")) if f.endswith(".md")}
    collected = collections.defaultdict(list)   # 영문 norm → [(날짜, 선수, 사유, 상태)]
    for f in glob.glob(os.path.join(ROOT, "data", "수집", "*.json")):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        base = os.path.basename(f)
        m = re.search(r"_\d+_(.+?)-(.+?)(?:_[^_]*)?\.json$", base)
        if not m:
            continue
        home_ko, away_ko = m.group(1), m.group(2)
        for item in d.get("새결장") or []:
            ko = home_ko if item.get("팀") == "홈" else away_ko
            collected[ko].append((item.get("날짜", ""), item.get("선수", ""), item.get("포지션", ""), item.get("사유", ""), item.get("상태", "")))
    KEY_MOOD = ("경질", "위기", "사기", "분위기", "압박", "연승", "연패", "무승", "발언", "기자회견", "불만", "항의", "교체설", "신임", "감독")
    KEY_INJ = ("결장", "부상", "징계", "복귀", "수술", "햄스트링", "무릎", "의심", "아웃")

    def team_text(title, ko_names):
        """팀노트·수집 JSON·teamdb 로 '부상·결장 / 컨디션·폼 / 분위기·심리 / 일정' 텍스트."""
        inj, mood, sched, memo = [], [], [], []
        recent_cut = (now - dt.timedelta(days=21)).strftime("%Y-%m-%d")
        for ko in ko_names:
            for (d_, pl, pos, why, st) in sorted(collected.get(ko, []), key=lambda x: x[0], reverse=True)[:8]:
                if d_ and d_ < recent_cut:
                    continue
                inj.append(f"{pl}({pos}) — {why}; {st[:60]}" + (f" [{d_[5:]}]" if d_ else ""))
            p = notes.get(ko)
            if not p:
                continue
            txt = open(p, encoding="utf-8").read()
            m = re.search(r"<!-- INPUTS:START -->(.*?)<!-- INPUTS:END -->", txt, re.S)
            if m:
                for line in m.group(1).splitlines():
                    if line.startswith("- ") and "휴식" in line:
                        sched.append(line[2:].split(" · xG")[0][:140])
            body = re.sub(r"<!-- FACTS:START -->.*?<!-- FACTS:END -->", "", txt, flags=re.S)
            body = re.sub(r"<!-- INPUTS:START -->.*?<!-- INPUTS:END -->", "", body, flags=re.S)
            for line in body.splitlines():
                if not line.startswith("- "):
                    continue
                dm = re.match(r"- (2026-\d\d-\d\d)", line)
                if dm and dm.group(1) < recent_cut:
                    continue
                s = line[2:].strip()
                if any(k in s for k in KEY_MOOD):
                    mood.append(s[:200])
                elif any(k in s for k in KEY_INJ):
                    inj.append(s[:200])
                else:
                    memo.append(s[:160])
        return {"injuries": inj[:6], "mood": mood[:4], "schedule": sched[:2], "memo": memo[:3]}

    def form_text(t, td, code):
        hist = t.get("history", []); n = len(hist)
        if not n:
            return "", None
        xg = sum(float(h["xG"]) for h in hist) / n; xga = sum(float(h["xGA"]) for h in hist) / n
        l5 = hist[-5:]; l5xg = sum(float(h["xG"]) for h in l5) / len(l5); l5xga = sum(float(h["xGA"]) for h in l5) / len(l5)
        pts = sum(int(h["pts"]) for h in hist); xpts = sum(float(h["xpts"]) for h in hist)
        res = "".join(h["result"].upper() for h in hist[-6:])
        luck = "결과가 내용보다 좋음(운 좋은 편)" if pts - xpts > 2 else "내용보다 결과가 나쁨(운 나쁜 편)" if xpts - pts > 2 else "결과와 내용이 비슷함"
        trend = "공격 상승" if l5xg > xg + 0.2 else "공격 하락" if l5xg < xg - 0.2 else "공격 유지"
        dtrend = "수비 개선" if l5xga < xga - 0.2 else "수비 악화" if l5xga > xga + 0.2 else "수비 유지"
        players = td.get("players") or []
        tot = sum(float(p["xG"]) + float(p["xA"]) for p in players) or 1
        top = sorted(players, key=lambda p: -(float(p["xG"]) + float(p["xA"])))[:2]
        dep = ", ".join(f"{p['player_name']}({(float(p['xG']) + float(p['xA'])) / tot * 100:.0f}%)" for p in top)
        s = (f"최근 6경기 {res}. 시즌 경기당 xG {xg:.2f}·xGA {xga:.2f}, 최근 5경기 {l5xg:.2f}·{l5xga:.2f}로 {trend}·{dtrend}. "
             f"승점 {pts} vs 기대 승점 {xpts:.1f} → {luck}." + (f" 공격 의존도: {dep}." if dep else ""))
        return s, {"pts": pts, "xpts": round(xpts, 1), "xg": round(xg, 2), "xga": round(xga, 2), "res": res}

    leagues = []
    for lg, code in tdb.LEAGUES.items():
        d = tdb.jload(os.path.join(tdb.DB, "understat", f"{lg}_{tdb.SEASON}.json"), {})
        teams = []
        for tid, t in (d.get("teams") or {}).items():
            td = tdb.jload(os.path.join(tdb.DB, "understat", f"team_{tid}.json"), {})
            form, nums = form_text(t, td, code)
            tn = tdb.norm(t["title"])
            ko_names = [k for k, v in names.items() if k in notes and any(tdb.norm(str(x)) == tn or tdb.norm(str(x)) in tn or tn in tdb.norm(str(x)) for x in (v if isinstance(v, list) else [v])) and k != "_설명"]
            tx = team_text(t["title"], ko_names)
            fm = (td.get("statistics") or {}).get("formation") or {}
            fsum = sum(float(v.get("time", 0)) for v in fm.values()) or 1
            fmain = sorted(fm.items(), key=lambda kv: -float(kv[1].get("time", 0)))[:2]
            ftxt = ", ".join(f"{k} {float(v.get('time', 0)) / fsum * 100:.0f}%" for k, v in fmain)
            ms = tdb.espn_matches(t["title"], code)
            last = ms[-1] if ms else None
            lastxi = ""
            if last:
                xi = (last[3].get("rosters", {}).get(last[1], {}) or {})
                lastxi = f"직전 경기({last[0][:10]}) {xi.get('formation', '')} 선발 {len(xi.get('starters', []))}명" if xi.get("starters") else ""
            teams.append({"id": tid, "name": t["title"], "ko": ko_names[0] if ko_names else "", "nums": nums, "form": form, "formation": ftxt, "lastxi": lastxi, **tx})
        teams.sort(key=lambda x: -(x["nums"] or {}).get("pts", 0))
        leagues.append({"name": lg, "ko": LG_KO.get(lg, lg), "code": code, "teams": len(teams)})
        json.dump({"league": lg, "ko": LG_KO.get(lg, lg), "updated": dt.date.today().isoformat(), "teams": teams}, open(os.path.join(out, "teams", f"{lg}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    # ---- 분석 기록(블록 단위) — 추천이 없어도 무엇을 분석했고 왜 뺐는지 남긴다 (사용자 요청 2026-10-19)
    ex_by_game = collections.defaultdict(list)
    for r in rec:
        if r.get("구분") == "추천제외":
            ex_by_game[(r["회차"], r["번호"])].append(f"{r['선택']}: {r.get('이유', '')}"[:160])
    combo_by_block = collections.defaultdict(list)
    for c in combo_rows:
        combo_by_block[(c["round"], c.get("close", ""))].append(c)
    history = []
    for b in plan:
        if not b.get("블록") or b["회차"].startswith("승무패"):
            continue
        rnd = b["회차"]; c1, c2 = b.get("첫마감", ""), b.get("끝마감", "") or b.get("첫마감", "")
        gs = []
        for g in games:
            if g["회차"] != rnd:
                continue
            cl = closes.get(f"{rnd}-{g['번호']}")
            if cl:
                inblock = c1 <= cl <= c2
            else:   # 마감 미수집: 베트맨 규칙으로 추정 — 킥오프 10분 전, 단 00~05시 킥오프는 전날 23:00
                try:
                    ko = dt.datetime.strptime(f"{c1[:4]}-{g['시각']}", "%Y-%m-%d %H:%M")
                    est = (ko - dt.timedelta(days=1)).replace(hour=23, minute=0) if ko.hour < 5 else ko - dt.timedelta(minutes=10)
                    inblock = dt.datetime.strptime(c1, "%Y-%m-%d %H:%M") - dt.timedelta(minutes=15) <= est <= dt.datetime.strptime(c2, "%Y-%m-%d %H:%M")
                except (ValueError, TypeError):
                    inblock = False
            if not inblock:
                continue
            pu = {k: fnum(g.get(f"순수_{k}")) for k in ("승", "무", "패")}
            mk = {k: fnum(g.get(f"시장_{k}")) for k in ("승", "무", "패")}
            ptop = max(pu, key=lambda k: pu[k] or 0) if any(pu.values()) else ""
            mtop = max(mk, key=lambda k: mk[k] or 0) if any(mk.values()) else ""
            res = g.get("결과", "")
            gs.append({"no": g["번호"], "game": f"{g['홈']} - {g['원정']}", "league": g.get("리그", ""), "time": g.get("시각", ""),
                       "mine": f"{ptop} {pu[ptop]:.0f}" if ptop else "", "market": f"{mtop} {mk[mtop]:.0f}" if mtop else "",
                       "agree": bool(ptop and mtop and ptop == mtop), "result": (res + " " + (g.get("점수") or "")).strip(),
                       "hit": ("1" if ptop == res else "0") if (ptop and res in ("승", "무", "패")) else "",
                       "why": (g.get("핵심근거") or "")[:260], "skip": "; ".join(ex_by_game.get((rnd, g["번호"]), []))[:260] or (g.get("비고") or "")[:200],
                       "grade": g.get("정합성", "")})
        cs = combo_by_block.get((rnd, c1), []) + [c for c in combo_rows if c["round"] == rnd and c.get("close") and c1 <= c["close"] <= c2 and c not in combo_by_block.get((rnd, c1), [])]
        seen_t = set(); cs = [c for c in cs if not (c["title"] in seen_t or seen_t.add(c["title"]))]
        analyzed = [g for g in gs if g["mine"]]
        hits = sum(1 for g in analyzed if g["hit"] == "1"); done = sum(1 for g in analyzed if g["hit"] in ("0", "1"))
        history.append({"round": rnd, "block": b["블록"], "at": b.get("분석시각", ""), "close": c1, "state": b.get("상태", ""),
                        "memo": (b.get("메모") or "")[:300], "sports": b.get("종목", ""), "n": len(gs), "analyzed": len(analyzed),
                        "hits": hits, "done": done, "combos": [{"title": c["title"], "n": c["n"], "odds": c["odds"], "hit": c["hit"], "scored": c["scored"]} for c in cs],
                        "games": sorted(gs, key=lambda g: g["time"])})
    history.sort(key=lambda h: (h["close"] or h["at"]), reverse=True)
    history = history[:70]

    # ---- 승무패(토토) 카드: 구매기록(마킹) + 분석일정(마감) + 전체경기기록(경기·결과)
    toto = []
    plan_close = {x["회차"]: x.get("끝마감") or x.get("첫마감") or "" for x in plan if x["회차"].startswith("승무패")}
    toto_rounds = sorted({r["회차"] for r in games if r["회차"].startswith("승무패")}, key=lambda x: int(re.sub(r"\D", "", x) or 0))
    for tr in toto_rounds:
        gs = sorted([g for g in games if g["회차"] == tr], key=lambda g: int(g["번호"]) if g["번호"].isdigit() else 0)
        marks = [b for b in buy if b["round"] == tr]
        mark = marks[-1] if marks else None
        mk = {}
        if mark:
            for tok in (mark.get("legs") or "").split():
                m = re.match(r"(\d+)(.+)", tok)
                if m:
                    mk[m.group(1)] = m.group(2)
        legs = []
        hits = 0; done = 0
        for g in gs:
            pu = {k: fnum(g.get(f"순수_{k}")) or 0 for k in ("승", "무", "패")}; top = max(pu, key=pu.get) if sum(pu.values()) else ""
            pick = mk.get(g["번호"]) or top
            res = g.get("결과", "")
            hit = None
            if res in ("승", "무", "패") and pick:
                hit = res in pick.split("/"); done += 1; hits += 1 if hit else 0
            legs.append({"no": g["번호"], "game": f"{g['홈']} - {g['원정']}", "time": g.get("시각", ""), "pick": pick, "prob": round(pu[top]) if top else None,
                         "result": (res + (" " + g["점수"] if g.get("점수") else "")).strip(), "hit": "" if hit is None else ("1" if hit else "0"), "why": (g.get("핵심근거") or "")[:200]})
        close = plan_close.get(tr, "")
        toto.append({"round": tr, "title": (mark["ticket"] if mark else "마킹") + (f" · {mark['stake']}원" if mark and fnum(mark.get("stake")) else ""), "close": close,
                     "legs": legs, "n": len(legs), "done": done, "hits": hits, "scored": done == len(legs) and len(legs) > 0, "result": (mark or {}).get("result", ""),
                     "current": bool(close) and close >= now.strftime("%Y-%m-%d %H:%M")})
    toto.sort(key=lambda t: t["round"], reverse=True)
    # ---- 회고 문서 목록·본문 (사용자 요청 2026-10-19)
    import glob as _g
    retros = []
    for f in sorted(_g.glob(os.path.join(ROOT, "회차별분석", "*.md")), key=os.path.getmtime, reverse=True):
        base = os.path.basename(f)
        if not any(k in base for k in ("회고", "심층회고", "내용회고")):
            continue
        try:
            txt = open(f, encoding="utf-8").read()
        except Exception:
            continue
        title = next((l.lstrip("# ").strip() for l in txt.splitlines() if l.startswith("#")), base[:-3])
        summ = ""
        for l in txt.splitlines():
            if l.startswith("요약") or l.startswith("> 요약"):
                summ = l.lstrip("> ").strip()[:400]; break
        kind = "심층 회고" if "심층회고" in base else "경기별 내용 회고" if "내용회고" in base else "회차 회고"
        mt = dt.datetime.fromtimestamp(os.path.getmtime(f))
        retros.append({"file": base, "title": title[:120], "kind": kind, "date": mt.strftime("%Y-%m-%d %H:%M"),
                       "summary": summ, "body": txt[:60000], "chars": len(txt)})
        if len(retros) >= 40:
            break
    json.dump(retros, open(os.path.join(out, "retros.json"), "w", encoding="utf-8"), ensure_ascii=False)

    summary = {"updated": now.strftime("%Y-%m-%d %H:%M"), "mode": "가상 추천 중(실투자 없음)",
               "combos_total": len(core), "combos_scored": len(sc), "combos_hit": sum(1 for c in sc if c["hit"]), "combo_rate": combo_rate,
               "fun_total": len(fun), "fun_scored": len(scf), "fun_hit": sum(1 for c in scf if c["hit"]), "fun_rate": fun_rate,
               "legs_scored": len(legs_scored), "leg_rate": leg_rate, "by_round": by_round,
               "process_score": proc_score, "process_n": len(clean), "quad": dict(quad), "leagues": leagues,
               "retros": len(retros)}
    json.dump(summary, open(os.path.join(out, "summary.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"current": current, "past": past[:150], "toto": toto}, open(os.path.join(out, "recommendations.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(history, open(os.path.join(out, "history.json"), "w", encoding="utf-8"), ensure_ascii=False)
    for stale in ("tickets.json", "process.json"):
        p = os.path.join(out, stale)
        if os.path.exists(p): os.remove(p)
    print(f"→ {out}: 회고 {len(retros)}건, 분석 기록 {len(history)}블록(경기 {sum(h['n'] for h in history)}), 조합 {len(combo_rows)}(진행 {len(current)}, 채점 {len(sc)}, 성공률 {combo_rate and round(combo_rate*100)}%), 다리 {leg_rate and round(leg_rate*100)}% n={len(legs_scored)}, 팀 {sum(l['teams'] for l in leagues)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--out", default=DEFAULT_OUT)
    build(ap.parse_args().out)
