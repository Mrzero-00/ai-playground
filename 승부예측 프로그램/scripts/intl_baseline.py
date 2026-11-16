#!/usr/bin/env python3
"""국가대표 경기 자체 기준선 — 결과만 쓰는 Elo → 승/무/패.

왜 (2026-11-12):
  A매치 주간에는 회차의 축구가 전부 국가대표 경기인데 자체 기준선이 없었다(soccer_baseline 은 리그,
  euro_baseline 은 유럽 클럽 대항전). 기준선이 없으면 확률을 만들지 않으므로 134회·승무패68 의
  축구 전 경기가 빈칸이 된다. 시장을 복사하지 않고 방향을 내려면 자체 모델이 필요하다.

무엇:
  data/intl/results.csv (martj42/international_results, 1872~) 를 시간 순으로 훑는 World Football Elo.
  K 는 대회 무게(친선 20 · 네이션스리그·예선 40 · 대륙 본선 50 · 월드컵 60) × 골차 배수, 홈 이점 HOME 점.
  승/무/패는 Elo 차 → 순서형 로지스틱(B, C). B·C·HOME 은 2006~2019 로 맞추고 2020~ 로 시험했다.

  python3 scripts/intl_baseline.py --backtest
  python3 scripts/intl_baseline.py card 잉글랜드 크로아티아 [--neutral] [--date 2026-11-13]
  python3 scripts/intl_baseline.py round 134          # 회차의 국가대표 경기 전부
  python3 scripts/intl_baseline.py --update           # 결과 자료 다시 받기
  python3 scripts/intl_baseline.py --sync             # 원자료가 아직 모르는 최근 결과를 전체경기기록에서 extra.csv 로

한계: 선수단·결장·동기(친선 로테이션)를 모른다. 친선전은 시험 구간 적중률이 대회 경기보다 낮다(--backtest).
"""
import argparse, csv, json, math, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "data", "intl", "results.csv")
EXTRA = os.path.join(ROOT, "data", "intl", "extra.csv")
NAMES = os.path.join(ROOT, "data", "intl", "names.json")
LOG = os.path.join(ROOT, "전체경기기록.csv")
URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"

HOME = 125.0     # 홈 이점(Elo 점) — fit() 로 맞춘 값
B = 0.00500      # 순서형 로지스틱 기울기
C = 0.650        # 무 폭
CLUB_LEAGUES = ("유로파", "컨퍼런스", "챔피언스", "리베르타", "수다메리카", "클럽")
START = 1500.0
YEAR = "2026"    # 전체경기기록의 'MM-DD HH:MM' 시각에 붙일 해 (sync 전용)
INTL_LEAGUES = ("국제친선", "네이션스리그", "월드컵", "아시안컵", "유로", "코파", "A매치", "골드컵", "네이션스컵")


def kfac(t):
    t = t.lower()
    if "friendly" in t:
        return 20
    if "fifa world cup" == t:
        return 60
    if "qualification" in t or "nations league" in t:
        return 40
    if any(x in t for x in ("uefa euro", "copa am", "african cup", "asian cup", "gold cup", "confederations")):
        return 50
    return 30


def gmult(d):
    d = abs(d)
    return 1.0 if d <= 1 else 1.5 if d == 2 else 1.75 + (d - 3) / 8.0


def probs(dr, b=None, c=None):
    """Elo 차(홈 − 원정, 홈 이점 포함) → (승, 무, 패)"""
    b = B if b is None else b; c = C if c is None else c
    sig = lambda x: 1 / (1 + math.exp(-x))
    pa = sig(-c - b * dr)
    ph = 1 - sig(c - b * dr)
    return ph, 1 - ph - pa, pa


GOAL = (0.151, 0.705, 0.149, -0.763)   # 기대 득점: 홈 λ = exp(a + b·dr/400), 원정 λ = exp(c + d·dr/400) — 2006~2019 포아송 적합


def goals(dr):
    """Elo 차(홈 이점 포함) → (홈 기대 득점, 원정 기대 득점). 2026-11-17.
    시험 2020~ 6,579경기 평균 오차: 총득점 1.41골 · 득실차 1.32골(평균만 쓰면 1.44 · 1.66).
    우리 국가대표 53경기에서 분석가 어림(1.42 · 1.47)과 사실상 같다(1.38 · 1.45) — 더 맞히려는 것이 아니라
    예상점수를 사람 어림이 아닌 재현 가능한 값으로 두려는 것이다."""
    a, b, c, d = GOAL
    return math.exp(a + b * dr / 400), math.exp(c + d * dr / 400)


_G = []


def games():
    if _G:
        return _G
    out = []
    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    last = max(r["date"] for r in rows)
    if os.path.exists(EXTRA):      # 원자료가 아직 싣지 않은 최근 결과(수집가가 채운다). 원자료 마지막 날짜 뒤만 쓴다
        rows += [r for r in csv.DictReader(open(EXTRA, encoding="utf-8")) if r["date"] > last]
    for r in rows:
        try:
            out.append((r["date"], r["home_team"], r["away_team"], int(r["home_score"]), int(r["away_score"]),
                        r["tournament"], r["neutral"].upper() == "TRUE"))
        except ValueError:
            continue
    out.sort(key=lambda g: g[0])
    _G.extend(out)
    return _G


def walk(G, home=None, until=None):
    """시간 순으로 훑으며 (경기, 경기 전 Elo 차, 팀별 경기 수) 를 낸다."""
    home = HOME if home is None else home
    R, N, rows = {}, {}, []
    for g in G:
        d, h, a, hg, ag, t, neu = g
        if until and d >= until:
            break
        rh, ra = R.get(h, START), R.get(a, START)
        dr = rh - ra + (0 if neu else home)
        rows.append((g, dr, min(N.get(h, 0), N.get(a, 0))))
        we = 1 / (1 + 10 ** (-dr / 400))
        w = 1.0 if hg > ag else 0.5 if hg == ag else 0.0
        delta = kfac(t) * gmult(hg - ag) * (w - we)
        R[h], R[a] = rh + delta, ra - delta
        N[h], N[a] = N.get(h, 0) + 1, N.get(a, 0) + 1
    return rows, R, N


def _res(g):
    return 0 if g[3] > g[4] else 1 if g[3] == g[4] else 2


def fit():
    G = games()
    best = None
    for home in (100, 125, 150, 175):
        rows = [(g, dr) for g, dr, n in walk(G, home)[0] if "2006" <= g[0] < "2020" and n >= 30]
        for b in (0.0040, 0.0044, 0.0046, 0.0048, 0.0050, 0.0052):
            for c in (0.50, 0.55, 0.60, 0.65, 0.70):
                ll = sum(math.log(max(probs(dr, b, c)[_res(g)], 1e-9)) for g, dr in rows) / len(rows)
                if best is None or ll > best[0]:
                    best = (ll, home, b, c, len(rows))
    print(f"학습(2006~2019, 두 팀 다 30경기+) {best[4]}경기: HOME={best[1]} B={best[2]} C={best[3]} 로그우도 {best[0]:.4f}")
    return 0


def backtest():
    G = games()
    rows = [(g, dr) for g, dr, n in walk(G)[0] if g[0] >= "2020" and n >= 30]

    def line(lab, sub):
        n = len(sub)
        if n < 30:
            return
        hit = said = 0.0
        for g, dr in sub:
            p = probs(dr)
            k = max(range(3), key=lambda i: p[i])
            hit += k == _res(g); said += p[k]
        se = math.sqrt(hit / n * (1 - hit / n) / n)
        print(f"{lab:<28}{n:>6}  적중 {hit/n*100:5.1f}% ±{2*se*100:4.1f}  내 말 {said/n*100:5.1f}%  잔차 {(hit-said)/n*100:+5.1f}p")
    print("국가대표 Elo 기준선 — 시험 구간 2020~ (상수는 2006~2019 로 맞춤)\n")
    line("전체", rows)
    line("  친선", [x for x in rows if "friendly" in x[0][5].lower()])
    line("  대회(친선 제외)", [x for x in rows if "friendly" not in x[0][5].lower()])
    line("  UEFA 네이션스리그", [x for x in rows if x[0][5] == "UEFA Nations League"])
    print()
    for lo, hi in ((0, 45), (45, 55), (55, 60), (60, 70), (70, 80), (80, 101)):
        line(f"  1순위 {lo}~{hi}%", [x for x in rows if lo <= max(probs(x[1])) * 100 < hi])
    print()
    for lo, hi in ((60, 70), (70, 80), (80, 101)):
        line(f"  친선 1순위 {lo}~{hi}%", [x for x in rows if "friendly" in x[0][5].lower() and lo <= max(probs(x[1])) * 100 < hi])
        line(f"  대회 1순위 {lo}~{hi}%", [x for x in rows if "friendly" not in x[0][5].lower() and lo <= max(probs(x[1])) * 100 < hi])
    d = [x for x in rows if (lambda p: p[1] >= max(p[0], p[2]) - 0.08)(probs(x[1]))]
    print(f"\n무 확률이 1순위와 8p 안: {len(d)}경기 실제 무 {sum(_res(g)==1 for g,_ in d)/max(len(d),1)*100:.1f}%"
          f" (전체 무 {sum(_res(g)==1 for g,_ in rows)/len(rows)*100:.1f}%)")
    return 0


TOUR = (("네이션스리그", "Nations League"), ("월드컵", "FIFA World Cup qualification"), ("친선", "Friendly"))


def sync():
    """원자료(results.csv)가 끝난 뒤의 A매치 결과를 전체경기기록에서 extra.csv 로 옮긴다 (2026-11-16).

    원자료가 10-06 에서 멈춰 Elo 가 직전 A매치 주간 결과를 모른 채 다음 경기를 냈다(134·승무패68 회고).
    이미 있는 줄은 건드리지 않는다 — 중립 여부를 손으로 고친 값이 남아야 한다.
    새 줄의 중립은 비고·핵심근거에 '중립'이 있을 때만 TRUE, 날짜는 한국 시각 기준이다.
    """
    src = list(csv.DictReader(open(SRC, encoding="utf-8")))
    last = max(r["date"] for r in src)
    # 원자료는 현지 날짜, 우리 기록은 한국 시각이라 경계의 같은 경기가 하루 뒤 날짜로 또 들어온다
    tail = {(r["home_team"], r["away_team"], r["home_score"], r["away_score"]) for r in src if r["date"] >= last[:8] + "01"}
    head = ["date", "home_team", "away_team", "home_score", "away_score", "tournament", "city", "country", "neutral"]
    old = list(csv.DictReader(open(EXTRA, encoding="utf-8"))) if os.path.exists(EXTRA) else []
    have = {(r["date"], r["home_team"], r["away_team"]) for r in old}
    new, skip = [], set()
    for g in csv.DictReader(open(LOG, encoding="utf-8-sig")):
        if not is_intl(g) or ":" not in (g.get("점수") or ""):
            continue
        d = g["시각"][:10] if g["시각"][:2] == "20" else f"{YEAR}-{g['시각'][:5]}"
        h, a = name(g["홈"]), name(g["원정"])
        if d <= last:
            continue
        if not h or not a:
            skip.add(g["홈"] if not h else g["원정"]); continue
        if (d, h, a) in have:
            continue
        hs, as_ = [x.strip() for x in g["점수"].split(":")[:2]]
        if d <= last[:8] + f"{int(last[8:]) + 1:02d}" and (h, a, hs, as_) in tail:
            continue
        have.add((d, h, a))
        t = next((en for ko, en in TOUR if ko in g["리그"]), "Friendly")
        if "네이션스리그" in g["리그"]:
            t = g["리그"].split()[0] + " Nations League"
        note = (g.get("비고") or "") + (g.get("핵심근거") or "")
        neu = any(k in note for k in ("중립 구장", "중립 개최", "중립 기준선", "--neutral"))
        new.append(dict(zip(head, [d, h, a, hs, as_, t, "", "", "TRUE" if neu else "FALSE"])))
    rows = sorted(old + new, key=lambda r: r["date"])
    with open(EXTRA, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=head); w.writeheader(); w.writerows(rows)
    print(f"extra.csv: 새로 {len(new)}경기 · 누적 {len(rows)}경기 (원자료 마지막 {last})")
    if skip:
        print("팀명 매핑 없음 — names.json 에 추가:", ", ".join(sorted(skip)))
    return 0


ESPN_LEAGUES = {   # ESPN 대회 코드 → 원자료의 tournament 이름(kfac 가 읽는다)
    "fifa.friendly": "Friendly", "uefa.nations": "UEFA Nations League",
    "concacaf.nations.league": "CONCACAF Nations League", "caf.nations_qual": "African Cup of Nations qualification",
    "caf.nations": "African Cup of Nations", "afc.asian.cup": "AFC Asian Cup", "afc.cupq": "AFC Asian Cup qualification",
    "conmebol.america": "Copa América", "uefa.euro": "UEFA Euro", "uefa.euroq": "UEFA Euro qualification",
    "concacaf.gold": "Gold Cup", "fifa.world": "FIFA World Cup",
    "fifa.worldq.afc": "FIFA World Cup qualification", "fifa.worldq.caf": "FIFA World Cup qualification",
    "fifa.worldq.conmebol": "FIFA World Cup qualification", "fifa.worldq.concacaf": "FIFA World Cup qualification",
    "fifa.worldq.uefa": "FIFA World Cup qualification", "fifa.worldq.ofc": "FIFA World Cup qualification",
}
ESPN_ALIAS = {"Türkiye": "Turkey", "Czechia": "Czech Republic", "Congo DR": "DR Congo",
              "Bosnia-Herzegovina": "Bosnia and Herzegovina", "Kyrgyz Republic": "Kyrgyzstan", "USA": "United States",
              "Korea Republic": "South Korea", "Korea DPR": "North Korea", "Cape Verde Islands": "Cape Verde",
              "Curacao": "Curaçao", "Côte d'Ivoire": "Ivory Coast", "The Gambia": "Gambia", "Macau": "Macau",
              "Chinese Taipei": "Taiwan", "Timor-Leste": "Timor-Leste", "Eswatini": "Eswatini", "Swaziland": "Eswatini",
              "Brunei Darussalam": "Brunei", "IR Iran": "Iran", "China PR": "China", "Comoros Islands": "Comoros",
              "St Kitts and Nevis": "Saint Kitts and Nevis"}


def _espn_name(n, known):
    n = ESPN_ALIAS.get(n, n)
    if n not in known and n.startswith("St. "):
        n = "Saint " + n[4:]
    return n if n in known else None


def espn_sync():
    """원자료가 끝난 뒤의 A매치 결과를 ESPN 점수판에서 extra.csv 로 채운다 (2026-11-17).

    --sync 는 베트맨에 팔린 경기만 옮긴다 — 팔리지 않은 A매치(아프리카·북중미 하위 조 등)는 Elo 에 안 들어가
    상대 팀 레이팅이 한 달 묵었다. ESPN 은 날짜가 UTC, 원자료는 현지 날짜, 우리 기록은 한국 시각이라
    같은 팀 쌍이 ±2일 안에 이미 있으면 같은 경기로 보고 넣지 않는다(손으로 고친 중립 값이 남는다).
    중립은 경기장 나라가 홈팀 나라와 다를 때 TRUE. Elo 에 없는 팀명은 건너뛰고 끝에 알린다.
    """
    import datetime as dt, subprocess
    src = list(csv.DictReader(open(SRC, encoding="utf-8")))
    last = max(r["date"] for r in src)
    known = {r["home_team"] for r in src} | {r["away_team"] for r in src}
    head = ["date", "home_team", "away_team", "home_score", "away_score", "tournament", "city", "country", "neutral"]
    old = list(csv.DictReader(open(EXTRA, encoding="utf-8"))) if os.path.exists(EXTRA) else []
    day = dt.date.fromisoformat
    near = [(day(r["date"]), frozenset((r["home_team"], r["away_team"])))
            for r in old + [r for r in src if r["date"] >= last[:8] + "01"]]
    months, d = [], day(last[:8] + "01")
    while d <= dt.date.today():
        months.append(d.strftime("%Y%m")); d = (d.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    new, skip, fail = [], set(), []
    for code, tour in ESPN_LEAGUES.items():
        for ym in months:
            out = subprocess.run(["curl", "-s", "--compressed", "-m", "30",
                                  f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard?dates={ym}&limit=400"],
                                 capture_output=True).stdout
            try:
                events = json.loads(out).get("events", [])
            except ValueError:
                fail.append(f"{code} {ym}"); continue
            for e in events:
                c = e["competitions"][0]
                if not e["status"]["type"].get("completed") or e["date"][:10] <= last:
                    continue
                side = {t["homeAway"]: t for t in c["competitors"]}
                if "home" not in side or "away" not in side:
                    continue
                h, a = (_espn_name(side[k]["team"]["displayName"], known) for k in ("home", "away"))
                if not h or not a:
                    skip.update(side[k]["team"]["displayName"] for k, v in (("home", h), ("away", a)) if not v); continue
                dd, pair = day(e["date"][:10]), frozenset((h, a))
                if any(p == pair and abs((dd - x).days) <= 2 for x, p in near):
                    continue
                near.append((dd, pair))
                adr = (c.get("venue") or {}).get("address") or {}
                vc = ESPN_ALIAS.get(adr.get("country", ""), adr.get("country", ""))
                neu = _neutral(vc, h)
                new.append(dict(zip(head, [e["date"][:10], h, a, side["home"]["score"], side["away"]["score"], tour,
                                           adr.get("city", ""), vc, "TRUE" if neu else "FALSE"])))
    rows = sorted(old + new, key=lambda r: r["date"])
    with open(EXTRA, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=head); w.writeheader(); w.writerows(rows)
    _G.clear()
    print(f"extra.csv(ESPN): 새로 {len(new)}경기 · 누적 {len(rows)}경기 (원자료 마지막 {last}, 조회 {len(ESPN_LEAGUES)}개 대회 × {len(months)}달)")
    if new:
        print("  중립으로 넣은 경기: " + (", ".join(f"{r['home_team']}-{r['away_team']}({r['country']})" for r in new if r["neutral"] == "TRUE") or "없음"))
    if skip:
        print("  Elo 에 없는 이름(건너뜀 — ESPN_ALIAS 에 추가):", ", ".join(sorted(skip)))
    if fail:
        print("  조회 실패:", ", ".join(fail))
    return 0


VENUES = os.path.join(ROOT, "data", "intl", "venues.json")
_UK = {"England", "Scotland", "Wales", "Northern Ireland"}


def _neutral(vc, h):
    """경기장 나라 vc 가 홈팀 h 의 나라가 아닌가. 'Congo'↔'DR Congo' 처럼 서로 포함되면 같은 나라로 본다."""
    return bool(vc) and vc != h and vc not in h and h not in vc and not (vc in _UK | {"United Kingdom"} and h in _UK)


def espn_venues(months, refresh=False):
    """ESPN 점수판의 (홈, 원정, 날짜) → 경기장. 예정 경기도 나온다. data/intl/venues.json 에 달 단위로 쌓는다.
    {"YYYYMM": {"Home|Away|YYYY-MM-DD": {"city","country","neutral"}}}"""
    import subprocess
    cache = json.load(open(VENUES, encoding="utf-8")) if os.path.exists(VENUES) else {}
    known = {g[1] for g in games()} | {g[2] for g in games()}
    for ym in months:
        if ym in cache and not refresh:
            continue
        got = {}
        for code in ESPN_LEAGUES:
            out = subprocess.run(["curl", "-s", "--compressed", "-m", "30",
                                  f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard?dates={ym}&limit=400"],
                                 capture_output=True).stdout
            try:
                events = json.loads(out).get("events", [])
            except ValueError:
                continue
            for e in events:
                c = e["competitions"][0]
                side = {t["homeAway"]: t for t in c["competitors"]}
                if "home" not in side or "away" not in side:
                    continue
                h, a = (_espn_name(side[k]["team"]["displayName"], known) for k in ("home", "away"))
                adr = (c.get("venue") or {}).get("address") or {}
                vc = ESPN_ALIAS.get(adr.get("country", ""), adr.get("country", ""))
                if h and a:      # 경기장 나라가 비어도 event id 는 남긴다(postmatch 가 쓴다)
                    got[f"{h}|{a}|{e['date'][:10]}"] = {"city": adr.get("city", ""), "country": vc, "neutral": _neutral(vc, h),
                                                        "id": e.get("id", "")}
        if got:
            cache[ym] = got
    json.dump(cache, open(VENUES, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    return cache


def venue(home_ko, away_ko, kst, refresh=False, want_id=False):
    """한글 팀명·한국 시각('YYYY-MM-DD' 또는 'MM-DD HH:MM') → {"city","country","neutral"} 또는 None.
    ESPN 날짜는 UTC 라 한국 날짜와 그 전날을 본다."""
    import datetime as dt
    h, a = name(home_ko), name(away_ko)
    t = (kst or "").strip()
    d = t[:10] if t[:2] == "20" else f"{YEAR}-{t[:5]}"
    try:
        d0 = dt.date.fromisoformat(d)
    except ValueError:
        return None
    if not h or not a:
        return None
    days = [d0, d0 - dt.timedelta(days=1)]
    try:
        cache = espn_venues(sorted({x.strftime("%Y%m") for x in days}), refresh)
    except Exception:
        return None
    for x in days:
        v = (cache.get(x.strftime("%Y%m")) or {}).get(f"{h}|{a}|{x.isoformat()}")
        if v:
            return v if v.get("country") or want_id else None
    return None


def name(ko):
    m = json.load(open(NAMES, encoding="utf-8")) if os.path.exists(NAMES) else {}
    ko = ko.strip()
    if ko in m:
        return m[ko]
    c = [v for k, v in m.items() if k.startswith(ko) or ko.startswith(k)]   # 승무패는 팀명을 4자로 자른다
    return c[0] if len(set(c)) == 1 else None


def baseline(home, away, neutral=False, date=None):
    """한글 팀명 → {'승','무','패'(0~1), 'elo_h','elo_a','n_h','n_a','last'} 또는 None"""
    h, a = name(home), name(away)
    if not h or not a:
        return None
    _, R, N = walk(games(), until=date)
    if h not in R or a not in R:
        return None
    p = probs(R[h] - R[a] + (0 if neutral else HOME))
    return {"승": p[0], "무": p[1], "패": p[2], "elo_h": R[h], "elo_a": R[a], "n_h": N[h], "n_a": N[a], "en": (h, a)}


def recent(team, k=8, until=None):
    out = [g for g in games() if team in (g[1], g[2]) and (not until or g[0] < until)][-k:]
    return [f"{g[0]} {g[1]} {g[3]}-{g[4]} {g[2]} ({g[5]}{' 중립' if g[6] else ''})" for g in out]


def card(home, away, neutral, date):
    b = baseline(home, away, neutral, date)
    if not b:
        print(f"기준선 없음 — 팀명 매핑 실패({home}→{name(home)}, {away}→{name(away)}). data/intl/names.json 에 추가한다.")
        return 1
    h, a = b["en"]
    print(f"{home}({h}) Elo {b['elo_h']:.0f} · {b['n_h']}경기  vs  {away}({a}) Elo {b['elo_a']:.0f} · {b['n_a']}경기"
          f"  {'중립' if neutral else f'홈 이점 +{HOME:.0f}'}")
    print(f"기준선: 승 {b['승']*100:.1f} / 무 {b['무']*100:.1f} / 패 {b['패']*100:.1f}")
    for t in (h, a):
        print(f"\n{t} 최근 8경기"); print("\n".join("  " + x for x in recent(t, until=date)))
    return 0


def is_intl(g):
    lg = g.get("리그") or ""      # '유로'는 UEFA 유로파리그(클럽)에도 걸린다
    return g.get("종목") == "축구" and any(k in lg for k in INTL_LEAGUES) and not any(k in lg for k in CLUB_LEAGUES)


def round_(rnd):
    cache = {}
    for g in csv.DictReader(open(LOG, encoding="utf-8-sig")):
        if g["회차"] != rnd or not is_intl(g) or g.get("결과"):
            continue
        b = baseline(g["홈"], g["원정"])
        if not b:
            print(f"{g['번호']:>5} {g['홈']} vs {g['원정']}: 기준선 없음(팀명 {name(g['홈'])}/{name(g['원정'])})"); continue
        print(f"{g['번호']:>5} {g['시각'][-11:]} {g['홈']} vs {g['원정']}: {b['승']*100:.1f}/{b['무']*100:.1f}/{b['패']*100:.1f}"
              f"  Elo {b['elo_h']:.0f}-{b['elo_a']:.0f}  | 시장 {g.get('시장_승','')}/{g.get('시장_무','')}/{g.get('시장_패','')}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?"); ap.add_argument("args", nargs="*")
    ap.add_argument("--backtest", action="store_true"); ap.add_argument("--fit", action="store_true")
    ap.add_argument("--update", action="store_true"); ap.add_argument("--neutral", action="store_true")
    ap.add_argument("--sync", action="store_true")
    ap.add_argument("--espn", action="store_true", help="베트맨에 안 팔린 A매치 결과까지 ESPN 에서 채운다")
    ap.add_argument("--date")
    a = ap.parse_args()
    if a.update:
        urllib.request.urlretrieve(URL, SRC); print("받음:", SRC); return 0
    if a.sync:
        return sync()
    if a.espn:
        return espn_sync()
    if a.fit:
        return fit()
    if a.backtest:
        return backtest()
    if a.cmd == "card" and len(a.args) == 2:
        return card(a.args[0], a.args[1], a.neutral, a.date)
    if a.cmd == "round" and a.args:
        return round_(a.args[0])
    ap.print_help(); return 1


if __name__ == "__main__":
    sys.exit(main())
