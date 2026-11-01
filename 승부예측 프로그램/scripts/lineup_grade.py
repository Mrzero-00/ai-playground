#!/usr/bin/env python3
"""예상 선발·결장 주장이 맞았는지 채점한다 (사용자 지시 2026-10-22, 개선안 2번).

왜 — 선발 명단은 모으고 있는데 **내 예상이 맞았는지는 한 번도 재지 않았다.**
선발을 잘못 가정해서 방향이 틀린 것은 전형적인 '경기 전에 확인할 수 있었던 실패'인데,
측정이 없으니 점검표에 올릴 근거도 없었다.

두 가지를 잰다.
 1) 결장 주장 정확도 — `data/결장검증.csv`(postmatch.py 가 쌓는다)를 집계한다.
    '확정'이라고 적은 결장이 실제로 결장했는가. 상태별로 나눈다.
 2) 예상 XI 적중 — `data/수집/*.json` 의 `라인업.<홈|원정>.예상XI` 에 적은 이름들이
    실제 선발 11명에 몇 명 들어갔는가(ESPN rosters). 그리고 **XI 를 많이 틀린 경기에서
    방향도 더 틀렸는지**를 본다. 이게 핵심 연결 고리다.

    python3 scripts/lineup_grade.py absence     # 결장 주장 정확도
    python3 scripts/lineup_grade.py xi          # 예상 XI 적중 + 방향 정확도 연결
    python3 scripts/lineup_grade.py report      # 둘 다
"""
import argparse, collections, csv, glob, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def rows(p):
    f = os.path.join(ROOT, p)
    return list(csv.DictReader(open(f, encoding="utf-8-sig"))) if os.path.exists(f) else []


def norm_name(s):
    s = re.sub(r"\([^)]*\)", " ", str(s or ""))
    s = re.sub(r"[^A-Za-zÀ-ÿÀ-ɏ\s'-]", " ", s)
    return " ".join(s.lower().split())


def surname(s):
    t = [x for x in norm_name(s).split() if len(x) >= 3]
    return t[-1] if t else ""


def cmd_absence(a):
    rs = rows("data/결장검증.csv")
    if not rs:
        print("data/결장검증.csv 없음 — postmatch.py 를 먼저 돌린다")
        return 1
    d = collections.defaultdict(lambda: collections.Counter())
    for r in rs:
        d[(r.get("요인상태") or "?").strip()][(r.get("실제") or "?").strip()] += 1
    print(f"결장 주장 {len(rs)}건\n")
    print("| 내가 적은 상태 | 건수 | 결장 맞음 | 실제 출전 | 확인 실패 |")
    print("|---|---:|---:|---:|---:|")
    for st in sorted(d, key=lambda k: -sum(d[k].values())):
        c = d[st]; n = sum(c.values())
        ok = c.get("결장 맞음", 0)
        played = sum(v for k, v in c.items() if "출전" in k or "선발" in k)
        unk = n - ok - played
        print(f"| {st} | {n} | {ok} ({ok/n*100:.0f}%) | {played} | {unk} |")
    print("\n'확정'이라고 적었는데 실제로 뛴 건 분석이 틀린 것이다 — 점검표 후보.")
    bad = [r for r in rs if (r.get("요인상태") or "").strip() == "확정"
           and "출전" in (r.get("실제") or "")]
    for r in bad[:12]:
        print(f"   {r['회차']}회 {r['경기']} — {r['선수']} ({r.get('실제')})")
    if len(bad) > 12:
        print(f"   … 외 {len(bad)-12}건")
    return 0


_IDX = None


def espn_index():
    """teamdb ESPN 캐시를 (날짜, 팀성씨집합) 으로 색인 — 수집 JSON 에 event_id 가 없어도 찾는다."""
    global _IDX
    if _IDX is not None:
        return _IDX
    import teamdb as T
    _IDX = []
    for code in list(T.LEAGUES.values()) + list(getattr(T, "ESPN_ONLY", {}).values()):
        db = T.jload(os.path.join(T.DB, "espn", f"{code}.json"), {})
        for eid, e in db.items():
            date = (e.get("date") or "")[:10]
            hn = {w for w in norm_name((e.get("home") or {}).get("team") or "").split() if len(w) >= 3}
            an = {w for w in norm_name((e.get("away") or {}).get("team") or "").split() if len(w) >= 3}
            if hn and an:
                _IDX.append((date, hn, an, code, eid))
    return _IDX
    import teamdb as T
    _IDX = []
    for code in list(T.LEAGUES.values()) + list(getattr(T, "ESPN_ONLY", {}).values()):
        db = T.jload(os.path.join(T.DB, "espn", f"{code}.json"), {})
        for eid, e in db.items():
            date = (e.get("date") or "")[:10]
            names = set()
            for side in ("home", "away"):
                t = (e.get(side) or {}).get("team") or ""
                names |= {w for w in norm_name(t).split() if len(w) >= 3}
            if names:
                _IDX.append((date, names, code, eid))
    return _IDX
    import teamdb as T
    _IDX = []
    for code in list(T.LEAGUES.values()) + list(getattr(T, "ESPN_ONLY", {}).values()):
        db = T.jload(os.path.join(T.DB, "espn", f"{code}.json"), {})
        for eid, e in db.items():
            date = (e.get("date") or "")[:10]
            comp = ((e.get("competitions") or [{}])[0]) if e.get("competitions") else {}
            names = set()
            for c in (comp.get("competitors") or []):
                t = (c.get("team") or {})
                for k in ("displayName", "name", "shortDisplayName"):
                    if t.get(k):
                        names |= {w for w in norm_name(t[k]).split() if len(w) >= 3}
            if not names and e.get("name"):
                names = {w for w in norm_name(e["name"]).split() if len(w) >= 3}
            _IDX.append((date, names, code, eid))
    return _IDX


def _tokens(x):
    """en_name 은 별칭 리스트를 줄 수 있다(['Koln','Cologne'])."""
    if isinstance(x, (list, tuple, set)):
        out = set()
        for v in x:
            out |= {w for w in norm_name(v).split() if len(w) >= 3}
        return out
    return {w for w in norm_name(x).split() if len(w) >= 3}


def _md(s):
    """'2026-10-17' · '10-17 04:0' 둘 다 (월, 일) 로. 연도는 기록에 없을 때가 많아 월·일만 쓴다."""
    s = str(s or "")
    m = re.match(r"\s*(\d{4})-(\d{1,2})-(\d{1,2})", s)      # ISO 먼저 — 안 그러면 '2026-08'을 26월 8일로 읽는다
    if m:
        return (int(m.group(2)), int(m.group(3)))
    m = re.match(r"\s*(\d{1,2})-(\d{1,2})", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if 1 <= a <= 12 and 1 <= b <= 31:
            return (a, b)
    return None


def _near(d1, d2):
    """월·일 기준 ±1일. 해 넘김(12-31 ↔ 01-01)도 본다."""
    if not d1 or not d2:
        return True       # 날짜를 모르면 이름만으로 판단한다
    import datetime as dt
    try:
        x = dt.date(2000, *d1).toordinal(); y = dt.date(2000, *d2).toordinal()
    except ValueError:
        return True
    return abs(x - y) <= 1 or abs(abs(x - y) - 366) <= 1


def find_event(home, away, date):
    """홈은 홈끼리·원정은 원정끼리 맞고, 날짜도 ±1일이어야 한다.
    예전에는 두 팀 토큰을 합쳐 비교해서 'FC Tokyo vs Kashiwa' 가 'Tokyo Verdy vs Kashiwa' 로
    잘못 붙었다(날짜도 두 달 차이). 둘 다 막는다."""
    want_h, want_a = _tokens(home), _tokens(away)
    if not (want_h and want_a):
        return None
    tgt = _md(date)
    if not tgt:
        return None                      # 날짜를 모르면 붙이지 않는다 — 오매칭이 더 나쁘다
    best = None
    for d, hn, an, code, eid in espn_index():
        if not _near(_md(d), tgt):
            continue
        if not (want_h & hn) or not (want_a & an):
            continue
        sc = len(want_h & hn) + len(want_a & an)
        if best is None or sc > best[0]:
            best = (sc, eid)
    return best[1] if best else None


def actual_xi(event_id):
    """teamdb ESPN 캐시의 실제 선발 성씨 집합 — {"홈": {...}, "원정": {...}}"""
    import teamdb as T
    for code in list(T.LEAGUES.values()) + list(getattr(T, "ESPN_ONLY", {}).values()):
        db = T.jload(os.path.join(T.DB, "espn", f"{code}.json"), {})
        e = db.get(str(event_id))
        if not e:
            continue
        rost = e.get("rosters") or {}
        out = {}
        for side, key in (("홈", "home"), ("원정", "away")):
            out[side] = {surname(p.get("n")) for p in ((rost.get(key) or {}).get("starters") or [])
                         if surname(p.get("n"))}
        if out["홈"] or out["원정"]:
            return out
    return None


def cmd_xi(a):
    import teamdb as T
    games = {(g["회차"], g["번호"]): g for g in rows("전체경기기록.csv")}
    recs = []
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "수집", "*.json"))):
        base = os.path.basename(f)[:-5]
        parts = base.split("_", 2)
        if len(parts) < 3:
            continue
        rnd, no = parts[0], parts[1]
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        if isinstance(d, list):
            d = d[0] if d else {}
        lu = (d.get("라인업") or {})
        if not lu:
            continue
        eid = d.get("event_id") or d.get("eventId") or (d.get("ESPN") or {}).get("event")
        g = games.get((rnd, no))
        if not eid and g:
            import teamdb as T
            eid = find_event(T.en_name(g.get("홈", "")), T.en_name(g.get("원정", "")),
                             (g.get("시각") or "")[:10])
        xi = actual_xi(eid) if eid else None
        got = {}
        for side in ("홈", "원정"):
            pred = (lu.get(side) or {}).get("예상XI") or ""
            if isinstance(pred, (list, tuple)):      # 수집가가 배열로 적는 경우가 있다
                pred = "; ".join(str(x) for x in pred)
            elif isinstance(pred, dict):
                pred = "; ".join(str(v) for v in pred.values())
            elif not isinstance(pred, str):
                pred = str(pred)
            names = {surname(x) for x in re.split(r"[;,/]", re.sub(r"^[^:]*:", "", pred)) if surname(x)}
            got[side] = names
        recs.append({"회차": rnd, "번호": no, "예상": got, "실제": xi, "g": g,
                     "발표": (lu.get("홈") or {}).get("발표여부", "")})
    have = [r for r in recs if r["실제"]]
    print(f"예상 XI 가 적힌 경기 {len(recs)}건 · 실제 선발까지 대조 가능 {len(have)}건")
    if not have:
        print("\n대조 가능한 경기가 없다. 원인: 수집 JSON 에 ESPN event_id 가 없어 실제 선발을 못 붙인다.")
        print("→ 조치: 수집 단계에서 event_id 를 함께 남기면 다음 회차부터 이 표가 채워진다.")
        print("   (match_inputs.py 가 이미 event_id 로 라인업을 받으므로 그 값을 수집 JSON 에 적으면 된다)")
        return 0
    tot = collections.Counter()
    for r in have:
        for side in ("홈", "원정"):
            p, act = r["예상"][side], r["실제"].get(side) or set()
            if not p or not act:
                continue
            tot["쌍"] += 1
            tot["맞음"] += len(p & act)
            tot["예상수"] += len(p)
    if tot["쌍"]:
        print(f"\n예상 이름 {tot['예상수']}개 중 실제 선발이던 것 {tot['맞음']}개 "
              f"({tot['맞음']/max(1,tot['예상수'])*100:.0f}%), 팀-경기 {tot['쌍']}쌍")

    # 핵심: XI 를 많이 틀린 경기에서 방향도 더 틀렸는가
    def mytop(g):
        for pre in ("보정", "순수"):
            v = {}
            ok = True
            for k in ("승", "무", "패"):
                x = (g or {}).get(f"{pre}_{k}")
                if x in (None, ""):
                    ok = False; break
                try:
                    v[k] = float(x)
                except ValueError:
                    ok = False; break
            if ok and v:
                return max(v, key=v.get)
        return None

    band = collections.defaultdict(lambda: [0, 0])
    for r in have:
        g = r["g"]
        if not g or g.get("결과") not in ("승", "무", "패"):
            continue
        t = mytop(g)
        if not t:
            continue
        pred = sum(len(r["예상"][sd]) for sd in ("홈", "원정"))
        hit = sum(len(r["예상"][sd] & (r["실제"].get(sd) or set())) for sd in ("홈", "원정"))
        if pred < 8:
            continue
        rate = hit / pred
        key = "XI 90%+" if rate >= .9 else "XI 75~90%" if rate >= .75 else "XI 60~75%" if rate >= .6 else "XI 60% 미만"
        b = band[key]; b[0] += 1; b[1] += (t == g["결과"])
    if band:
        print("\n-- 예상 XI 적중도별 방향 정확도")
        print("| 예상 XI 적중 | 경기 | 방향 적중 |")
        print("|---|---:|---:|")
        for k in ("XI 90%+", "XI 75~90%", "XI 60~75%", "XI 60% 미만"):
            if k not in band:
                continue
            n, h = band[k]
            print(f"| {k} | {n} | {h/n*100:.0f}% |")
        print("\n선발을 잘못 가정한 경기에서 방향도 더 틀린다면, 그건 '경기 전에 확인할 수 있었던 실패'다.")
    return 0


def cmd_report(a):
    cmd_absence(a); print(); cmd_xi(a)
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    s.add_parser("absence").set_defaults(f=cmd_absence)
    s.add_parser("xi").set_defaults(f=cmd_xi)
    s.add_parser("report").set_defaults(f=cmd_report)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
