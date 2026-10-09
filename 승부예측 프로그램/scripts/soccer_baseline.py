#!/usr/bin/env python3
"""
축구 숫자 기준선 (pi-rating → 기대 득실차 → 포아송 승/무/패)

왜: 120회에 정성 조사만으로 낸 '순수' 확률이 너무 평평했다(시장 최다 ≥60% 경기 30개에서
시장 평균 69.0%, 순수 52.9%). 조사 전에 리그별 숫자 기준선을 먼저 고정하고, 뉴스는 그 위에서만 보정한다.

데이터
- ESPN 공개 JSON(키 없음): https://site.api.espn.com/apis/site/v2/sports/soccer/{리그}/scoreboard?dates=YYYY&limit=1000
  (날짜 범위 'YYYYMMDD-YYYYMMDD' 는 400 에러. 연 단위 'YYYY' 와 하루 'YYYYMMDD' 만 된다. 2026-10-09 확인)
- 올해 + 지난 2개 연도(달력 기준)를 받는다 → 직전 시즌 전체 + 그 앞 시즌 일부가 레이팅 예열(burn-in)이 된다.
- 캐시: data/soccer_results/<리그>.json (git 제외). 지난 연도는 한 번 받으면 재사용, 올해는 12시간 지나면 다시 받는다.
  --refresh 로 전부 다시 받는다.
- 완료 경기만 쓴다: STATUS_FULL_TIME, STATUS_FINAL_PEN(승부차기 = 90분 무승부로 처리).
  STATUS_FINAL_AET(연장 득점 포함)는 버린다.
- ESPN에 없는 리그(2026-10-09 확인): K리그1(kor.1), K리그2(kor.2), J2리그(jpn.2) → 기준선 없음.

레이팅: pi-rating (Constantinou & Fenton 2013), scripts/backtest.py run_pi 와 같은 식·상수
- 팀마다 홈 레이팅 R_H, 원정 레이팅 R_A (단위 = 골). 예측 득실차 pred = R_H(홈팀) − R_A(원정팀).
- 결과 득실차 obs 와의 오차 e = |obs − pred|, ψ = C·log10(1+e), 부호 = obs > pred 이면 +.
- 홈팀: R_H += ψ·λ, R_A += ψ·λ·γ / 원정팀: R_A −= ψ·λ, R_H −= ψ·λ·γ
- λ(LAMBDA)=0.07 (EPL 2019-26 백테스트 RPS 최적, scripts/tune.py), γ(GAMMA)=0.7, C=3.0
- 시즌 경계에서 초기화하지 않는다(지난 시즌이 그대로 이어진다).
- 자료 시작 후 NEW_TEAM_AFTER_DAYS(200일) 뒤에 처음 나온 팀(승격팀)은 0이 아니라 그 리그 현역 팀 레이팅의
  하위 NEW_TEAM_Q(20%) 분위값에서 시작한다. (backtest.py 와 다른 유일한 부분. 승격팀 = 약팀이라는 사전 정보)

레이팅 → 기대 득점 → 확률 (리그마다 데이터로 추정, --round/--calib 에서는 경기 전 데이터만 사용)
- 예열 BURN_IN_DAYS(240일)이 지난 경기만 회귀에 쓴다.
- 기대 득실차: GD = a + b·pred (최소제곱). a ≈ 레이팅이 같을 때의 홈 이점(골).
- 기대 총득점: T = t0 + t1·|GD̂| (최소제곱, 전력 차가 클수록 골이 많은 경향)
- 홈 기대득점 λh = (T + GD̂)/2, 원정 λa = (T − GD̂)/2 (최소 0.15)
- 득점 분포: 독립 포아송에 Dixon-Coles 저득점 보정 ρ(RHO)=−0.13 (backtest.py run_dc 와 같은 값)
- 출력: 승/무/패, 핸디캡 홈 −1 (승=2골 차 이상 홈승, 무=정확히 1골 차 홈승, 패=그 외),
  언더/오버 2.5
- 리그 평균 총득점·홈 이점(홈 득점 − 원정 득점 평균)을 함께 출력한다.

사용법
  python3 scripts/soccer_baseline.py --league eng.1 --home Arsenal --away Leeds
  python3 scripts/soccer_baseline.py --league "잉글랜드 프리미어리그" --home 아스널 --away "리즈 유나이티드"
  python3 scripts/soccer_baseline.py --round 120 [--csv out.csv]   # 전체경기기록.csv 회차 전체 비교
  python3 scripts/soccer_baseline.py --calib [--weeks 10]           # 리그별 최근 N주 보류 검증(Brier/RPS)
  python3 scripts/soccer_baseline.py --calib --until 2026-06-01     # 지난 시즌 마지막 N주로 검증
  python3 scripts/soccer_baseline.py --leagues                      # 리그별 평균 득점·홈 이점·회귀 계수
  --refresh : 캐시 무시하고 다시 받기

한계
- 결과(득점)만 쓴다. 부상·로테이션·동기·감독 교체·이적 시장은 반영하지 않는다 → 뉴스 보정 몫.
- 승격팀·시즌 초는 표본이 적어 기준선이 덜 믿을 만하다.
- 리그 간(컵·대륙 대회) 비교는 못 한다. 리그 경기 전용.
"""
import argparse, csv, datetime as dt, difflib, json, math, os, re, subprocess, sys, time
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CACHE_DIR = os.path.join(ROOT, "data", "soccer_results")
NAMES_PATH = os.path.join(ROOT, "data", "team_names.json")
RECORD_PATH = os.path.join(ROOT, "전체경기기록.csv")
UA = "Mozilla/5.0"
KST = dt.timezone(dt.timedelta(hours=9))

# ---- 상수 (backtest.py run_pi / run_dc 와 맞춤)
LAMBDA, GAMMA, C_PSI = 0.07, 0.7, 3.0
RHO = -0.13
BURN_IN_DAYS = 240
NEW_TEAM_AFTER_DAYS = 200
NEW_TEAM_Q = 0.20
MIN_LAMBDA = 0.15
MAX_GOALS = 10
YEARS_BACK = 2           # 올해 + 지난 2개 연도
CURRENT_TTL_H = 12       # 올해 캐시 유효 시간

LEAGUES = {  # ESPN 코드 → 이름
    "eng.1": "잉글랜드 프리미어리그", "eng.2": "잉글랜드 챔피언십", "ger.1": "독일 분데스리가",
    "esp.1": "스페인 라리가", "ita.1": "이탈리아 세리에A", "fra.1": "프랑스 리그1",
    "ned.1": "네덜란드 에레디비시", "usa.1": "미국 메이저리그사커", "jpn.1": "일본 J1리그",
    "chn.1": "중국 슈퍼리그", "aus.1": "호주 A리그",
    "kor.1": "K리그1", "kor.2": "K리그2", "jpn.2": "일본 J2리그",
}
UNSUPPORTED = {"kor.1", "kor.2", "jpn.2"}  # ESPN 미제공 (2026-10-09 확인: 400 Failed to get events endpoint)
KO_LEAGUE = {v: k for k, v in LEAGUES.items()}
KO_LEAGUE.update({"EPL": "eng.1", "프리미어리그": "eng.1", "라리가": "esp.1", "분데스리가": "ger.1",
                  "세리에A": "ita.1", "리그1": "fra.1", "에레디비시": "ned.1", "MLS": "usa.1",
                  "J1리그": "jpn.1", "J2리그": "jpn.2", "A리그": "aus.1"})
DONE = {"STATUS_FULL_TIME", "STATUS_FINAL_PEN"}


# ---------------------------------------------------------------- 데이터
def curl_json(url):
    for attempt in range(3):
        r = subprocess.run(["curl", "-sS", "--compressed", "-m", "60", "-A", UA, url], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            try:
                return json.loads(r.stdout)
            except json.JSONDecodeError:
                pass
        time.sleep(1.5 * (attempt + 1))
    return None


def fetch_year(league, year):
    d = curl_json(f"https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard?dates={year}&limit=1000")
    if d is None or "events" not in d:
        return None
    out = []
    for e in d["events"]:
        st = e["status"]["type"]["name"]
        if st not in DONE:
            continue
        comp = e["competitions"][0]
        t = {c["homeAway"]: c for c in comp["competitors"]}
        if "home" not in t or "away" not in t:
            continue
        try:
            hg, ag = int(t["home"]["score"]), int(t["away"]["score"])
        except (TypeError, ValueError):
            continue
        out.append({"date": e["date"], "home": t["home"]["team"]["displayName"], "away": t["away"]["team"]["displayName"],
                    "hg": hg, "ag": ag, "status": st, "neutral": bool(comp.get("neutralSite")),
                    "season": (e.get("season") or {}).get("slug", "")})
    return out


def load_results(league, refresh=False, quiet=False):
    """리그 완료 경기 목록(시간순). 캐시 사용."""
    if league in UNSUPPORTED:
        return []
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{league}.json")
    cache = {"years": {}, "fetched": {}}
    if os.path.exists(path) and not refresh:
        cache = json.load(open(path, encoding="utf-8"))
    this_year = dt.datetime.now(KST).year
    changed = False
    for y in range(this_year - YEARS_BACK, this_year + 1):
        ys = str(y)
        age_h = (time.time() - cache["fetched"].get(ys, 0)) / 3600
        stale = ys not in cache["years"] or (y == this_year and age_h > CURRENT_TTL_H)
        if stale:
            if not quiet:
                print(f"  ESPN 받는 중: {league} {y}", file=sys.stderr)
            rows = fetch_year(league, y)
            if rows is None:
                print(f"  [경고] {league} {y} 받기 실패", file=sys.stderr)
                continue
            cache["years"][ys], cache["fetched"][ys] = rows, time.time()
            changed = True
    if changed:
        json.dump(cache, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    games, seen = [], set()
    for ys in sorted(cache["years"]):
        for g in cache["years"][ys]:
            k = (g["date"], g["home"], g["away"])
            if "All-Star" in g["home"] or "All-Star" in g["away"]:  # MLS 올스타전 등 친선
                continue
            if k not in seen:
                seen.add(k)
                games.append(g)
    games.sort(key=lambda g: g["date"])
    for g in games:
        g["t"] = parse_iso(g["date"])
    return games


def parse_iso(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


# ---------------------------------------------------------------- pi-rating
def run_pi(games, cutoff=None):
    """games 를 시간순으로 처리. 각 경기의 경기 전 pred 를 g['pred'] 에 기록. cutoff 이후 경기는 처리하지 않는다.
    반환: (rh, ra, 처리한 경기 목록)"""
    rh, ra = {}, {}
    start = games[0]["t"] if games else None
    used = []
    for g in games:
        if cutoff is not None and g["t"] >= cutoff:
            break
        h, a = g["home"], g["away"]
        for tm in (h, a):
            if tm not in rh:
                if (g["t"] - start).days > NEW_TEAM_AFTER_DAYS and len(rh) >= 6:
                    # 승격팀: 현역 팀 레이팅 하위 분위에서 시작
                    act = active_teams(used[-400:])
                    rh[tm] = quantile([rh[x] for x in act if x in rh], NEW_TEAM_Q)
                    ra[tm] = quantile([ra[x] for x in act if x in ra], NEW_TEAM_Q)  # R_A 도 높을수록 강팀
                else:
                    rh[tm], ra[tm] = 0.0, 0.0
        pred = rh[h] - ra[a]
        g["pred"] = pred
        obs = g["hg"] - g["ag"]
        e = abs(obs - pred)
        psi = C_PSI * math.log10(1 + e)
        dh = psi * (1 if obs > pred else -1) * LAMBDA
        rh[h] += dh; ra[h] += dh * GAMMA
        ra[a] -= dh; rh[a] -= dh * GAMMA
        used.append(g)
    return rh, ra, used


def active_teams(recent):
    s = set()
    for g in recent:
        s.add(g["home"]); s.add(g["away"])
    return s


def quantile(xs, q):
    if not xs:
        return 0.0
    xs = sorted(xs)
    i = q * (len(xs) - 1)
    lo = int(math.floor(i)); hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (i - lo)


# ---------------------------------------------------------------- 회귀 / 포아송
def ols(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    b = sxy / sxx if sxx > 1e-12 else 0.0
    return my - b * mx, b


def fit_league(used):
    """경기 전 pred 가 기록된 경기들로 리그 파라미터 추정."""
    if not used:
        return None
    start = used[0]["t"]
    fit = [g for g in used if (g["t"] - start).days >= BURN_IN_DAYS and not g.get("neutral")]
    if len(fit) < 80:
        fit = [g for g in used if not g.get("neutral")][len(used) // 3:]
    if len(fit) < 30:
        return None
    xs = [g["pred"] for g in fit]
    gd = [g["hg"] - g["ag"] for g in fit]
    a, b = ols(xs, gd)
    gdh = [a + b * x for x in xs]
    tot = [g["hg"] + g["ag"] for g in fit]
    t0, t1 = ols([abs(v) for v in gdh], tot)
    n = len(fit)
    res = {"n": n, "a": a, "b": b, "t0": t0, "t1": t1,
           "avg_total": sum(tot) / n, "home_adv": sum(gd) / n,
           "home_w": sum(1 for v in gd if v > 0) / n, "draw": sum(1 for v in gd if v == 0) / n,
           "away_w": sum(1 for v in gd if v < 0) / n,
           "from": fit[0]["t"].date().isoformat(), "to": fit[-1]["t"].date().isoformat()}
    return res


def pois(k, lam):
    return math.exp(-lam) * lam ** k / math.factorial(k)


def score_matrix(lh, la, rho=RHO):
    m = [[pois(i, lh) * pois(j, la) for j in range(MAX_GOALS + 1)] for i in range(MAX_GOALS + 1)]
    m[0][0] *= 1 - lh * la * rho
    m[0][1] *= 1 + lh * rho
    m[1][0] *= 1 + la * rho
    m[1][1] *= 1 - rho
    s = sum(map(sum, m))
    return [[v / s for v in row] for row in m]


def predict(par, pred):
    gd = par["a"] + par["b"] * pred
    tot = max(par["t0"] + par["t1"] * abs(gd), 1.2)
    lh, la = max((tot + gd) / 2, MIN_LAMBDA), max((tot - gd) / 2, MIN_LAMBDA)
    m = score_matrix(lh, la)
    ph = pd = pa = h1w = h1d = over = 0.0
    for i in range(MAX_GOALS + 1):
        for j in range(MAX_GOALS + 1):
            p = m[i][j]
            if i > j: ph += p
            elif i == j: pd += p
            else: pa += p
            if i - j >= 2: h1w += p
            elif i - j == 1: h1d += p
            if i + j >= 3: over += p
    return {"승": ph, "무": pd, "패": pa, "xg_h": lh, "xg_a": la, "gd": gd,
            "h1_승": h1w, "h1_무": h1d, "h1_패": 1 - h1w - h1d, "오버2.5": over, "언더2.5": 1 - over}


# ---------------------------------------------------------------- 팀명 매칭
def norm(s):
    s = s.lower()
    s = s.replace("é", "e").replace("ö", "o").replace("ü", "u").replace("á", "a").replace("í", "i").replace("ó", "o").replace("ñ", "n")
    return re.sub(r"[^a-z0-9 ]", " ", s)


STOP = {"fc", "cf", "afc", "sc", "ac", "fk", "sv", "club", "de", "the", "1", "cd", "ca", "rcd", "ssc", "as", "ud", "sd"}


def toks(s):
    return [t for t in norm(s).split() if t not in STOP]


def load_names():
    if os.path.exists(NAMES_PATH):
        return json.load(open(NAMES_PATH, encoding="utf-8"))
    return {}


def hints_for(names, ko):
    ko = ko.strip()
    v = names.get(ko) or names.get(ko.split(" ")[0])
    if not v and len(ko) >= 3:
        pref = [x for k, x in names.items() if not k.startswith("_") and (k.startswith(ko) or ko.startswith(k)) and len(k) >= 2]
        v = [c for x in pref for c in (x if isinstance(x, list) else [x])]
    if not v:
        return []
    return v if isinstance(v, list) else [v]


def match_team(query, teams, names):
    """query(한글 또는 영문) → ESPN 팀명. 실패 시 None."""
    cands = hints_for(names, query) if re.search(r"[가-힣]", query) else [query]
    if not cands:
        return None
    best, best_s = None, 0.0
    for c in cands:
        cn = " ".join(norm(c).split()); ct = set(toks(c))
        for t in teams:
            tn = " ".join(norm(t).split()); tt = set(toks(t))
            if cn == tn:
                s = 3.0
            elif re.search(r"(^| )" + re.escape(cn) + r"( |$)", tn):
                s = 2.0 + len(cn) / 100
            elif ct and ct <= tt:
                s = 1.8 + len(ct) / 100
            elif len(cn.replace(" ", "")) >= 4 and cn.replace(" ", "") in tn.replace(" ", ""):
                s = 1.5
            else:
                s = difflib.SequenceMatcher(None, cn, tn).ratio()
                if s < 0.72:
                    continue
            if s > best_s:
                best, best_s = t, s
    return best


# ---------------------------------------------------------------- 공통: 경기 하나 예측
class League:
    def __init__(self, code, refresh=False):
        self.code = code
        self.games = load_results(code, refresh=refresh)

    def teams(self, before=None, recent_days=400):
        ref = before or (self.games[-1]["t"] if self.games else None)
        s = set()
        for g in self.games:
            if ref and (ref - g["t"]).days <= recent_days and g["t"] <= ref + dt.timedelta(days=1):
                s.add(g["home"]); s.add(g["away"])
        return sorted(s) or sorted({g["home"] for g in self.games} | {g["away"] for g in self.games})

    def state(self, cutoff=None):
        rh, ra, used = run_pi(self.games, cutoff)
        return rh, ra, used, fit_league(used)


def baseline(lg, home, away, cutoff=None, _cache={}):
    key = (lg.code, cutoff)
    if key not in _cache:
        _cache[key] = lg.state(cutoff)
    rh, ra, used, par = _cache[key]
    if par is None or home not in rh or away not in ra:
        return None, par
    pred = rh[home] - ra[away]
    out = predict(par, pred)
    out["pred"] = pred
    return out, par


# ---------------------------------------------------------------- 평가 지표
def rps(p, y):  # p=(H,D,A), y=0/1/2
    o = [0, 0, 0]; o[y] = 1
    c1 = p[0] - o[0]; c2 = p[0] + p[1] - o[0] - o[1]
    return (c1 * c1 + c2 * c2) / 2


def brier(p, y):
    return sum((p[i] - (1 if i == y else 0)) ** 2 for i in range(3))


def outcome(g):
    d = g["hg"] - g["ag"]
    return 0 if d > 0 else (1 if d == 0 else 2)


# ---------------------------------------------------------------- 모드
def cmd_single(args, names):
    code = KO_LEAGUE.get(args.league, args.league)
    if code not in LEAGUES:
        sys.exit(f"알 수 없는 리그: {args.league} (가능: {', '.join(LEAGUES)})")
    if code in UNSUPPORTED:
        sys.exit(f"{code} ({LEAGUES[code]}) 는 ESPN 데이터가 없어 기준선을 낼 수 없다.")
    lg = League(code, args.refresh)
    teams = lg.teams()
    h, a = match_team(args.home, teams, names), match_team(args.away, teams, names)
    if not h or not a:
        sys.exit(f"팀 매칭 실패: home={args.home}->{h}, away={args.away}->{a}\n가능한 팀: {', '.join(teams)}")
    out, par = baseline(lg, h, a)
    print(f"[{code} {LEAGUES[code]}] {h} (홈) vs {a} (원정)   자료 {len(lg.games)}경기, 마지막 {lg.games[-1]['t'].date()}")
    print(f"  리그: 평균 총득점 {par['avg_total']:.2f}, 홈 이점 {par['home_adv']:+.2f}골 "
          f"(승/무/패 실제 {par['home_w']*100:.0f}/{par['draw']*100:.0f}/{par['away_w']*100:.0f}%), "
          f"GD = {par['a']:+.2f} + {par['b']:.2f}·pred")
    print(f"  pi 득실차(pred) {out['pred']:+.2f} → 기대 득실차 {out['gd']:+.2f}, 기대 득점 {out['xg_h']:.2f} : {out['xg_a']:.2f}")
    print(f"  기준선 승/무/패: {out['승']*100:.1f} / {out['무']*100:.1f} / {out['패']*100:.1f} %")
    print(f"  핸디캡 홈 −1 (승/무/패): {out['h1_승']*100:.1f} / {out['h1_무']*100:.1f} / {out['h1_패']*100:.1f} %")
    print(f"  언더/오버 2.5: {out['언더2.5']*100:.1f} / {out['오버2.5']*100:.1f} %")


def cmd_leagues(args):
    print(f"{'리그':<8}{'이름':<16}{'경기':>6}{'평균득점':>8}{'홈이점':>8}{'홈승':>6}{'무':>6}{'원정승':>7}{'a':>7}{'b':>6}  기간")
    for code in LEAGUES:
        if code in UNSUPPORTED:
            print(f"{code:<8}{LEAGUES[code]:<16}  ESPN 미제공")
            continue
        lg = League(code, args.refresh)
        _, _, _, par = lg.state()
        if not par:
            print(f"{code:<8}{LEAGUES[code]:<16}  자료 부족 ({len(lg.games)})")
            continue
        print(f"{code:<8}{LEAGUES[code]:<16}{par['n']:>6}{par['avg_total']:>8.2f}{par['home_adv']:>+8.2f}"
              f"{par['home_w']*100:>6.1f}{par['draw']*100:>6.1f}{par['away_w']*100:>7.1f}{par['a']:>+7.2f}{par['b']:>6.2f}  {par['from']}~{par['to']}")


def cmd_calib(args):
    print(f"리그별 보류 검증{' (' + args.until + ' 이전 자료만)' if args.until else ''}: 마지막 {args.weeks}주 경기를 보류, 그 전 데이터로 회귀 추정, pi 는 경기 전 값으로 예측")
    print(f"비교 기준 '빈도' = 학습 구간 리그 승/무/패 빈도를 모든 경기에 똑같이 준 것\n")
    print(f"{'리그':<7}{'n':>5}{'RPS':>8}{'빈도RPS':>9}{'Brier':>8}{'빈도Br':>8}{'logloss':>9}{'적중':>7}{'예측무':>7}{'실제무':>7}{'예측홈':>7}{'실제홈':>7}")
    tot = defaultdict(float)
    for code in LEAGUES:
        if code in UNSUPPORTED:
            print(f"{code:<7}  ESPN 미제공")
            continue
        lg = League(code, args.refresh)
        if not lg.games:
            continue
        until = dt.datetime.fromisoformat(args.until).replace(tzinfo=dt.timezone.utc) if args.until else None
        rh, ra, used = run_pi(lg.games, until)   # 경기마다 경기 전 pred 기록
        if not used:
            continue
        last = used[-1]["t"]
        cut = last - dt.timedelta(weeks=args.weeks)
        train = [g for g in used if g["t"] < cut]
        test = [g for g in used if g["t"] >= cut and not g.get("neutral")]
        par = fit_league(train)
        if not par or not test:
            print(f"{code:<7}  자료 부족")
            continue
        base = (par["home_w"], par["draw"], par["away_w"])
        s = defaultdict(float)
        for g in test:
            o = predict(par, g["pred"]); p = (o["승"], o["무"], o["패"]); y = outcome(g)
            s["rps"] += rps(p, y); s["brs"] += rps(base, y)
            s["br"] += brier(p, y); s["brb"] += brier(base, y)
            s["ll"] += -math.log(max(p[y], 1e-9))
            s["acc"] += 1 if max(range(3), key=lambda i: p[i]) == y else 0
            s["pd"] += p[1]; s["ad"] += 1 if y == 1 else 0
            s["ph"] += p[0]; s["ah"] += 1 if y == 0 else 0
        n = len(test)
        print(f"{code:<7}{n:>5}{s['rps']/n:>8.4f}{s['brs']/n:>9.4f}{s['br']/n:>8.4f}{s['brb']/n:>8.4f}{s['ll']/n:>9.4f}"
              f"{s['acc']/n*100:>6.1f}%{s['pd']/n*100:>6.1f}%{s['ad']/n*100:>6.1f}%{s['ph']/n*100:>6.1f}%{s['ah']/n*100:>6.1f}%")
        for k, v in s.items():
            tot[k] += v
        tot["n"] += n
    n = tot["n"]
    if n:
        print(f"{'전체':<7}{int(n):>5}{tot['rps']/n:>8.4f}{tot['brs']/n:>9.4f}{tot['br']/n:>8.4f}{tot['brb']/n:>8.4f}{tot['ll']/n:>9.4f}"
              f"{tot['acc']/n*100:>6.1f}%{tot['pd']/n*100:>6.1f}%{tot['ad']/n*100:>6.1f}%{tot['ph']/n*100:>6.1f}%{tot['ah']/n*100:>6.1f}%")
    print("\n참고: EPL 시장(Pinnacle) RPS 는 대략 0.19~0.20, backtest.py pi-rating 은 0.2047(EPL 2019-26).")


def fnum(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def kickoff(s, now):
    m = re.match(r"(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{2})", s or "")
    if not m:
        return None
    mo, d, hh, mm = map(int, m.groups())
    y = now.year if mo <= now.month + 1 else now.year - 1
    return dt.datetime(y, mo, d, hh, mm, tzinfo=KST).astimezone(dt.timezone.utc)


def cmd_round(args, names):
    rows = [r for r in csv.DictReader(open(RECORD_PATH, encoding="utf-8-sig"))
            if r["회차"] == str(args.round) and r["종목"] == "축구"]
    if not rows:
        sys.exit(f"{args.round}회 축구 경기가 전체경기기록.csv 에 없다.")
    now = dt.datetime.now(KST)
    leagues, unmatched, skipped = {}, [], defaultdict(int)
    out_rows = []
    print(f"{args.round}회 축구 {len(rows)}경기 — 기준선(pi-rating) / 순수 / 시장 (승-무-패 %)\n")
    print(f"{'번호':>5} {'리그':<12} {'경기':<34} {'기준선':>15} {'순수':>12} {'시장':>15}  xG")
    for r in rows:
        code = KO_LEAGUE.get(r["리그"])
        if not code or code in UNSUPPORTED:
            skipped[r["리그"] + ("(ESPN 미제공)" if code else "(리그 미지원)")] += 1
            continue
        if code not in leagues:
            leagues[code] = League(code, args.refresh)
        lg = leagues[code]
        ko = kickoff(r["시각"], now)
        cutoff = ko - dt.timedelta(hours=2) if ko else None
        teams = lg.teams(before=cutoff)
        h, a = match_team(r["홈"], teams, names), match_team(r["원정"], teams, names)
        if not h:
            unmatched.append((r["리그"], r["홈"]))
        if not a:
            unmatched.append((r["리그"], r["원정"]))
        b = None
        if h and a:
            b, _ = baseline(lg, h, a, cutoff)
        pure = [fnum(r[k]) for k in ("순수_승", "순수_무", "순수_패")]
        mkt = [fnum(r[k]) for k in ("시장_승", "시장_무", "시장_패")]
        game = f"{r['홈']} - {r['원정']}"
        bs = f"{b['승']*100:4.0f}{b['무']*100:4.0f}{b['패']*100:4.0f}" if b else "      -       "
        ps = "".join(f"{v:4.0f}" if v is not None else "   -" for v in pure)
        ms = "".join(f"{v:5.1f}" if v is not None else "    -" for v in mkt)
        xg = f"{b['xg_h']:.2f}:{b['xg_a']:.2f}" if b else ""
        print(f"{r['번호']:>5} {r['리그'][:12]:<12} {game[:34]:<34} {bs:>15} {ps:>12} {ms:>15}  {xg}")
        out_rows.append({"r": r, "b": b, "pure": pure, "mkt": mkt, "h": h, "a": a, "code": code})

    # ---- 요약: 시장 최다 쪽(승/패 중 큰 쪽, 3-way 최다) 기준
    def summ(sel, label):
        pts = [x for x in sel if x["b"] and None not in x["mkt"] and None not in x["pure"]]
        if not pts:
            print(f"  {label}: 비교 가능 경기 없음"); return
        db = dp = sb = sp = mb = mp = mm = 0.0
        for x in pts:
            m = x["mkt"]; i = max(range(3), key=lambda k: m[k])
            bv = [x["b"]["승"] * 100, x["b"]["무"] * 100, x["b"]["패"] * 100]
            db += abs(bv[i] - m[i]); dp += abs(x["pure"][i] - m[i])
            sb += bv[i] - m[i]; sp += x["pure"][i] - m[i]
            mb += bv[i]; mp += x["pure"][i]; mm += m[i]
        n = len(pts)
        print(f"  {label} n={n}: 시장 최다쪽 평균 시장 {mm/n:.1f} / 기준선 {mb/n:.1f} / 순수 {mp/n:.1f}"
              f"  | 평균 |차| 기준선 {db/n:.1f}%p vs 순수 {dp/n:.1f}%p  (부호 평균 기준선 {sb/n:+.1f}, 순수 {sp/n:+.1f})")

    def mae3(sel):
        pts = [x for x in sel if x["b"] and None not in x["mkt"] and None not in x["pure"]]
        if not pts:
            return
        eb = sum(abs(x["b"][k] * 100 - x["mkt"][i]) for x in pts for i, k in enumerate(("승", "무", "패"))) / (3 * len(pts))
        ep = sum(abs(x["pure"][i] - x["mkt"][i]) for x in pts for i in range(3)) / (3 * len(pts))
        print(f"  승/무/패 3칸 평균 |차| (n={len(pts)}): 기준선 {eb:.1f}%p vs 순수 {ep:.1f}%p")

    print("\n요약 (시장 대비)")
    summ(out_rows, "전체")
    summ([x for x in out_rows if None not in x["mkt"] and max(x["mkt"]) >= 60], "시장 최다 ≥60%")
    mae3(out_rows)
    by = defaultdict(list)
    for x in out_rows:
        by[x["code"]].append(x)
    print("  리그별 (시장 최다쪽 평균 |차| 기준선 vs 순수):")
    for code, xs in by.items():
        pts = [x for x in xs if x["b"] and None not in x["mkt"] and None not in x["pure"]]
        if not pts:
            continue
        db = sum(abs([x["b"]["승"], x["b"]["무"], x["b"]["패"]][i] * 100 - x["mkt"][i]) for x in pts
                 for i in [max(range(3), key=lambda k: x["mkt"][k])]) / len(pts)
        dp = sum(abs(x["pure"][i] - x["mkt"][i]) for x in pts for i in [max(range(3), key=lambda k: x["mkt"][k])]) / len(pts)
        print(f"    {code:<6} {LEAGUES[code]:<14} n={len(pts):>2}  기준선 {db:5.1f}  순수 {dp:5.1f}")

    # 결과가 있으면 RPS 비교
    res_map = {"승": 0, "무": 1, "패": 2}
    done = [x for x in out_rows if x["r"].get("결과") in res_map and x["b"] and None not in x["mkt"] and None not in x["pure"]]
    if done:
        rb = sum(rps((x["b"]["승"], x["b"]["무"], x["b"]["패"]), res_map[x["r"]["결과"]]) for x in done) / len(done)
        rp = sum(rps(tuple(v / sum(x["pure"]) for v in x["pure"]), res_map[x["r"]["결과"]]) for x in done) / len(done)
        rm = sum(rps(tuple(v / sum(x["mkt"]) for v in x["mkt"]), res_map[x["r"]["결과"]]) for x in done) / len(done)
        print(f"\n결과 나온 {len(done)}경기 RPS(낮을수록 좋음): 기준선 {rb:.4f} / 순수 {rp:.4f} / 시장 {rm:.4f}")

    if skipped:
        print("\n기준선 없음(리그): " + ", ".join(f"{k} {v}" for k, v in skipped.items()))
    if unmatched:
        print("팀명 매칭 실패 (data/team_names.json 에 한글→영문 추가): " + ", ".join(f"{l}:{t}" for l, t in unmatched))

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["회차", "번호", "리그", "홈", "원정", "ESPN홈", "ESPN원정", "기준_승", "기준_무", "기준_패",
                        "기대득점_홈", "기대득점_원정", "핸디-1_승", "핸디-1_무", "핸디-1_패", "언더2.5", "오버2.5",
                        "순수_승", "순수_무", "순수_패", "시장_승", "시장_무", "시장_패"])
            for x in out_rows:
                r, b = x["r"], x["b"]
                bv = [f"{b[k]*100:.1f}" for k in ("승", "무", "패")] + [f"{b['xg_h']:.2f}", f"{b['xg_a']:.2f}"] + \
                     [f"{b[k]*100:.1f}" for k in ("h1_승", "h1_무", "h1_패", "언더2.5", "오버2.5")] if b else [""] * 10
                w.writerow([r["회차"], r["번호"], r["리그"], r["홈"], r["원정"], x["h"] or "", x["a"] or ""] + bv +
                           [r["순수_승"], r["순수_무"], r["순수_패"], r["시장_승"], r["시장_무"], r["시장_패"]])
        print(f"\n저장: {args.csv}")


def main():
    ap = argparse.ArgumentParser(description="축구 pi-rating 기준선 (ESPN 결과)")
    ap.add_argument("--league"); ap.add_argument("--home"); ap.add_argument("--away")
    ap.add_argument("--round", type=int)
    ap.add_argument("--csv")
    ap.add_argument("--calib", action="store_true")
    ap.add_argument("--weeks", type=int, default=10)
    ap.add_argument("--until", help="--calib: 이 날짜(YYYY-MM-DD) 이전 자료로만 검증 (예: 2026-06-01 = 지난 시즌 막판)")
    ap.add_argument("--leagues", action="store_true", help="리그별 평균 득점·홈 이점 표")
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    names = load_names()
    if args.calib:
        cmd_calib(args)
    elif args.leagues:
        cmd_leagues(args)
    elif args.round:
        cmd_round(args, names)
    elif args.league and args.home and args.away:
        cmd_single(args, names)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
