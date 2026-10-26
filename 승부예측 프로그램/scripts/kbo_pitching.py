#!/usr/bin/env python3
"""
KBO 선발·불펜 기준선: KBO 공식 홈페이지(www.koreabaseball.com)로 경기 전 야구 기준선을 자동으로 만든다.
mlb_pitching.py 의 KBO판이다(같은 공식·같은 표 모양).

원리
- 기준선 홈 승% = 50 + 홈 1.2 + (원정FIP−홈FIP)×8.5 + (홈−원정 팀 득실차/(경기수+30))×4.2, 25~75% 제한.
- 선발: FIP = (13×HR + 3×(BB+HBP) − 2×K) / IP + 상수. 상수는 KBO 팀 투수 합계(리그 ERA·HR·BB·HBP·K·IP)로
  매번 계산한다(2026 정규시즌 ≈ 3.57). 실패하면 아래 기본값을 쓴다.
  시즌 FIP는 40이닝만큼 '사전값'으로 당긴다. 사전값 = 리그 평균 + (전 시즌 FIP − 전 시즌 리그 평균)×IP/(IP+50)
  (전 시즌 KBO 기록이 없으면 리그 평균). 전 시즌 기록은 Total.aspx(연도별 통산)에서 가져온다.
- 팀 전력: 올 시즌 득실차를 (경기수+30)으로 나눠 0쪽으로 당긴 값(팀 타자·투수 기록 페이지의 R).
- 불펜 가용성: 최근 3일 구원 투수 투구 수를 모아 연투·전날 30구 이상·마무리 3일 중 2회 이상을 '경고'만 한다.
  확률 보정 계수는 0(백테스트에서 효과 없음, 아래).
- 결과는 '기준선'이다. 시장(Pinnacle) 확률과 비교·혼합하는 출발점이지 최종 확률이 아니다.

상수 근거 (scripts/kbo_backtest.py, 2026-10-10 적합)
- 자료: KBO 정규시즌 2023(사전값용)·2024·2025·2026(10/9까지) 박스스코어 2,872경기, 무승부 제외.
  선발 FIP·불펜·득실차는 모두 경기 전날까지의 누적값(look-ahead 없음). 박스스코어 '4사구' = BB+HBP.
- 로지스틱 회귀: 학습 2024–25(1,408경기) → 검증 2026(695경기).
  학습 계수: 절편 +0.040(홈 +1.0%p), FIP차 +0.331±0.063/1.00, 득실차 +0.133±0.064/1점,
  불펜 3일 투구 수 차 −0.03±0.08/100구(0과 구별 안 됨 → 0). 회귀 이닝은 학습 셋에서 고름(사전값형 40, 리그평균형 60).
- 검증 2026 로그손실(낮을수록 좋음): 동전 0.6931, 홈만 0.6926, 옛 휴리스틱(+3, ×6, 불펜 ×0.04, 40IP) 0.6827,
  새 선형식 0.6738 (Brier 0.2449→0.2406, 적중 55.1%→56.3%). 옛 대비 −0.0089, 부트스트랩 95% [−0.017, −0.000].
- 실전 상수는 2024–26 전체(2,103경기) 재적합값: 홈 +1.2%p, FIP 1.00당 8.6%p, 득실차 1점당 4.2%p.
  옛 값과 비교: 홈 어드밴티지는 과대(KBO 홈 승률 51~52%), 선발 FIP 기울기는 과소, 불펜 피로 보정은 근거 없음.

데이터 (KBO 공식, 로그인 불필요)
- 경기 목록·예고 선발: POST /ws/Main.asmx/GetKboGameList (leId=1, srId=0,1,3,4,5,7, date=YYYYMMDD)
  → G_ID, G_TM, SR_ID, AWAY_ID/AWAY_NM, HOME_ID/HOME_NM, T_PIT_P_ID/NM(원정 선발), B_PIT_P_ID/NM(홈 선발),
    GAME_STATE_SC(1 예정·2 진행·3 종료), CANCEL_SC_ID/NM(0 정상), T_SCORE_CN/B_SCORE_CN
- 박스스코어: POST /ws/Schedule.asmx/GetBoxScoreScroll (leId, srId, seasonId, gameId)
  → arrPitcher[0]=원정, [1]=홈. 열: 선수명·등판(선발/이닝)·결과·승·패·세(누적)·이닝·타자·투구수 …
- 선발 시즌 기록: /Record/Player/PitcherDetail/Basic.aspx?playerId= (ERA·IP·HR·BB·SO·WHIP·NP, 최근 경기 홈/방문)
  + Total.aspx?playerId= (연도별 IP·HR·BB·HBP·SO → 전 시즌 FIP 사전값)
  + Daily.aspx?playerId= (경기별 구분(선발)·IP·HBP·자책 → HBP 합계, 최근 3선발)
- 리그 합계(FIP 상수)·팀 실점: /Record/Team/Pitcher/Basic1.aspx, 팀 득점: /Record/Team/Hitter/Basic1.aspx

사용법
  python3 scripts/kbo_pitching.py                       # 오늘·내일(KST) 경기
  python3 scripts/kbo_pitching.py --date 2026-10-10     # 날짜 지정 (여러 번 지정 가능)
  python3 scripts/kbo_pitching.py --detail              # 선발 시즌 기록·최근 3선발(투구 수)·구원 투수별 투구 수
  python3 scripts/kbo_pitching.py --csv data/kbo_기준선.csv   # CSV 저장 (팀명은 베트맨 표기 'LG 트윈스' 등)
  python3 scripts/kbo_backtest.py fetch && python3 scripts/kbo_backtest.py fit   # 상수 재적합·검증

주의
- 박스스코어에는 선수 ID가 없어 구원 투수는 팀 안에서 이름으로 묶는다(동명이인은 합쳐질 수 있음).
- 선발 시즌 기록은 정규시즌 기준(KBO 개인 페이지 기본값), 최근 3선발도 정규시즌만.
- 선발 미발표면 '미발표'로 표시하고 선발 항을 빼며 확신도 '낮음'. 오프너·불펜데이는 반영하지 못한다.
- 마무리 = 최근 3일 등판한 구원 중 박스스코어 누적 세이브가 가장 많은(8개 이상) 투수. 3일 안에 안 던진 마무리는 미확인.
- 상대 타선·구장·날씨·라인업은 반영하지 않는다(야구.md 체크리스트로 따로 확인).
- 팀 득실차·리그 합계는 '현재' 시즌 누적 페이지라 --date 로 과거 날짜를 넣으면 그 뒤 경기까지 섞인다(백테스트는 kbo_backtest.py).
- 계수 하나하나의 표준오차가 크다(표본 2천 경기). 기준선은 시장과 섞는 출발점이고, 시즌마다 kbo_backtest.py fit 으로 다시 확인한다.
"""
import argparse
import csv
import html
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone

# ── 기준선 상수 (근거·튜닝 시 여기만 고친다) ─────────────────────────────
FIP_CONST_DEFAULT = 3.60    # 리그 합계를 못 가져올 때 FIP 상수 (2026 KBO 정규시즌 실측 3.57)
LEAGUE_FIP_DEFAULT = 4.65   # 리그 합계를 못 가져올 때 리그 평균 FIP(=리그 ERA, 2026 4.67)
# 아래 4개는 kbo_backtest.py fit 적합값(2026-10-10, 2024–26 2,103경기). 옛 값은 괄호.
FIP_REGRESS_IP = 40.0       # 이 이닝만큼 사전값을 섞는다: (FIP×IP + 사전값×40)/(IP+40)  (옛: 리그 평균 쪽 40)
PRIOR_IP = 50.0             # 사전값 = 리그 + (전 시즌 FIP − 전 시즌 리그)×IP/(IP+50)
PCT_PER_FIP = 8.5           # FIP 1.00 차이 ≈ 8.5%p  (옛 6.0, 적합 8.3~8.6)
HOME_FIELD = 1.2            # 홈 어드밴티지 +1.2%p  (옛 3.0; 2024 51.1%·2025 51.3%·2026 51.8% 홈 승률)
PCT_PER_RD = 4.2            # 팀 득실차/(경기수+30) 1점 차 ≈ 4.2%p  (새 항, 적합 3.3~4.2)
RD_SHRINK_G = 30            # 득실차를 0쪽으로 당기는 가상 경기 수
BULLPEN_PCT_PER_PITCH = 0.0   # 3일 불펜 투구 수 차 보정 (옛 0.04/구; 적합 −0.0002±0.0002 → 0, 경고만 남긴다)
BULLPEN_CAP = 3.0           # 불펜 보정 상한 ±3%p
# 시즌별 KBO 리그 FIP 상수·리그 평균(ERA) — 박스스코어 합계로 계산(kbo_backtest.py). 전 시즌 FIP 계산용.
LEAGUE_HIST = {2023: (3.40, 4.15), 2024: (3.75, 4.94), 2025: (3.44, 4.32), 2026: (3.59, 4.69)}
CLAMP_LO, CLAMP_HI = 25.0, 75.0  # 기준선 승률 범위
HEAVY_PITCHES = 30          # 전날 이 투구 수 이상이면 경고
CLOSER_MIN_SAVES = 8        # 누적 세이브가 이 이상인 팀 내 최다 세이브 구원 투수 = 마무리
BULLPEN_DAYS = 3            # 불펜 집계 기간(경기 전날부터 거꾸로 N일)
# ────────────────────────────────────────────────────────────────────

BASE = "https://www.koreabaseball.com"
KST = timezone(timedelta(hours=9))
SR_IDS = "0,1,3,4,5,7"     # 정규·시범·준PO·WC·PO·KS
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TEAM_BET = {"LG": "LG 트윈스", "KIA": "KIA 타이거즈", "SSG": "SSG 랜더스", "삼성": "삼성 라이온즈",
            "NC": "NC 다이노스", "롯데": "롯데 자이언츠", "한화": "한화 이글스", "KT": "KT 위즈",
            "두산": "두산 베어스", "키움": "키움 히어로즈"}
TEAM_CODE = {"LG": "LG", "KIA": "HT", "SSG": "SK", "삼성": "SS", "NC": "NC", "롯데": "LT",
             "한화": "HH", "KT": "KT", "두산": "OB", "키움": "WO"}


class NetError(Exception):
    pass


_cache = {}
_cookie = None


def _session():
    """세션 쿠키 확보(일정 페이지 1회 방문)."""
    global _cookie
    if _cookie is None:
        fd, _cookie = tempfile.mkstemp(prefix="kbo_ck_")
        os.close(fd)
        subprocess.run(["curl", "-sS", "-m", "20", "-A", UA, "-c", _cookie, "-o", "/dev/null",
                        BASE + "/Schedule/Schedule.aspx"], capture_output=True, timeout=40)
    return _cookie


def fetch(path, data=None, as_json=False):
    url = BASE + path
    key = (url, data)
    if key in _cache:
        return _cache[key]
    ck = _session()
    cmd = ["curl", "-sS", "-m", "30", "--retry", "2", "-A", UA, "-b", ck, "-c", ck,
           "-e", BASE + "/Schedule/Schedule.aspx"]
    if data is not None:
        cmd += ["-H", "X-Requested-With: XMLHttpRequest", "--data", data]
    cmd.append(url)
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    except (subprocess.TimeoutExpired, OSError) as e:
        raise NetError(f"{url}: {e}")
    if r.returncode != 0:
        raise NetError(f"{url}: {r.stderr.strip()}")
    out = r.stdout
    if as_json:
        try:
            out = json.loads(out)
        except json.JSONDecodeError:
            raise NetError(f"{url}: JSON 아님 ({r.stdout[:80]!r})")
    _cache[key] = out
    return out


def tables(page):
    """HTML 안의 <table>을 [[셀 텍스트, ...], ...] 목록으로."""
    out = []
    for m in re.finditer(r"<table[^>]*>(.*?)</table>", page, re.S):
        rows = []
        for r in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.S):
            cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
                     for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]
            if cells:
                rows.append(cells)
        out.append(rows)
    return out


def ip_to_float(ip):
    """'146 1/3' → 146.333, '2/3' → 0.667."""
    ip = (ip or "").strip()
    if not ip or ip == "-":
        return 0.0
    tot = 0.0
    for part in ip.split():
        if "/" in part:
            n, d = part.split("/")
            tot += int(n) / int(d)
        else:
            tot += float(part)
    return tot


def num(x, default=0):
    try:
        return int(str(x).replace(",", ""))
    except ValueError:
        return default


def table_by_header(tbls, first):
    for t in tbls:
        if t and t[0] and t[0][0] == first:
            return t
    return None


# ── 리그 합계 → FIP 상수 ──
_league = None
_team_ra = {}   # 팀명 -> (경기수, 실점)  — league() 가 같은 페이지에서 채운다
_team_rd = None


def league():
    global _league
    if _league is None:
        _league = {"const": FIP_CONST_DEFAULT, "fip": LEAGUE_FIP_DEFAULT, "src": "기본값"}
        try:
            t = table_by_header(tables(fetch("/Record/Team/Pitcher/Basic1.aspx")), "순위")
            hd = t[0]
            tot = next(r for r in t if r[0] == "합계")
            tot = dict(zip(hd[1:], tot))   # 합계 행은 '순위' 칸이 없다 → 한 칸 당겨 맞춘다
            for r in t[1:]:
                if r[0] != "합계" and len(r) == len(hd):
                    g = dict(zip(hd, r))
                    _team_ra[g["팀명"]] = (num(g["G"]), num(g["R"]))
            ip = ip_to_float(tot["IP"])
            era = float(tot["ERA"])
            raw = (13 * num(tot["HR"]) + 3 * (num(tot["BB"]) + num(tot["HBP"])) - 2 * num(tot["SO"])) / ip
            if ip > 500:
                _league = {"const": era - raw, "fip": era, "src": f"KBO 합계 {ip:.0f}이닝"}
        except (NetError, StopIteration, KeyError, ValueError, ZeroDivisionError, TypeError) as e:
            print(f"[경고] 리그 합계 실패, 기본 FIP 상수 사용: {e}", file=sys.stderr)
    return _league


def team_rd():
    """팀명 → 득실차/(경기수+RD_SHRINK_G). 실패하면 빈 dict(득실차 항 0)."""
    global _team_rd
    if _team_rd is None:
        _team_rd = {}
        league()
        try:
            t = table_by_header(tables(fetch("/Record/Team/Hitter/Basic1.aspx")), "순위")
            hd = t[0]
            for r in t[1:]:
                if len(r) != len(hd):
                    continue
                g = dict(zip(hd, r))
                if g["팀명"] in _team_ra:
                    gp, ra = _team_ra[g["팀명"]]
                    _team_rd[g["팀명"]] = (num(g["R"]) - ra) / (gp + RD_SHRINK_G)
        except (NetError, KeyError, TypeError) as e:
            print(f"[경고] 팀 득실차 실패, 득실차 항 0: {e}", file=sys.stderr)
    return _team_rd


# ── 투수 기록 ──
def pitcher_season(pid):
    tb = tables(fetch(f"/Record/Player/PitcherDetail/Basic.aspx?playerId={pid}"))
    t1 = table_by_header(tb, "팀명")
    t2 = table_by_header(tb, "SAC")
    if not t1 or len(t1) < 2 or not t2 or len(t2) < 2:
        return None, {}
    a = dict(zip(t1[0], t1[1]))
    b = dict(zip(t2[0], t2[1]))
    # 최근 경기 표: 일자 → 홈/방문 (최근 3선발 박스스코어 찾기용)
    venue = {}
    t3 = table_by_header(tb, "일자")
    for r in (t3 or [])[1:]:
        if len(r) >= 3 and re.match(r"\d\d\.\d\d$", r[0]):
            venue[r[0]] = (r[1], r[2])
    ip = ip_to_float(a.get("IP"))
    hr, bb, k = num(a.get("HR")), num(b.get("BB")), num(b.get("SO"))
    out = {"ip": ip, "era": a.get("ERA"), "whip": b.get("WHIP"), "k": k, "bb": bb, "hr": hr,
           "hbp": None, "np": num(a.get("NP")), "saves": num(a.get("SV")), "team": a.get("팀명")}
    return out, venue


def pitcher_daily(pid):
    """Daily.aspx: 정규시즌 경기별 기록 [{md, opp, start, ip, er, hbp}]."""
    games = []
    for t in tables(fetch(f"/Record/Player/PitcherDetail/Daily.aspx?playerId={pid}")):
        if not t or len(t[0]) < 15 or t[0][1] != "상대":
            continue
        hd = t[0]
        for r in t[1:]:
            if len(r) != len(hd) or not re.match(r"\d\d\.\d\d$", r[0]):
                continue
            g = dict(zip(hd, r))
            games.append({"md": r[0], "opp": g["상대"], "start": g["구분"] == "선발",
                          "ip": g["IP"], "er": g["ER"], "hbp": num(g["HBP"])})
    return games


def pitcher_prev(pid, season):
    """Total.aspx 연도별 통산에서 전 시즌 FIP·IP. 기록 없으면 None."""
    prev = season - 1
    if prev not in LEAGUE_HIST:
        return None
    t = table_by_header(tables(fetch(f"/Record/Player/PitcherDetail/Total.aspx?playerId={pid}")), "연도")
    hr = bb = k = 0
    ip = 0.0
    for r in (t or [])[1:]:
        if len(r) == len(t[0]) and r[0] == str(prev):   # 한 시즌 여러 팀이면 행이 여럿 → 합산
            g = dict(zip(t[0], r))
            hr, bb, k = hr + num(g["HR"]), bb + num(g["BB"]) + num(g["HBP"]), k + num(g["SO"])
            ip += ip_to_float(g["IP"])
    if ip <= 0:
        return None
    const, lg = LEAGUE_HIST[prev]
    return {"fip": (13 * hr + 3 * bb - 2 * k) / ip + const, "ip": ip, "lg": lg}


def fip_prior(prev):
    """사전값 = 올 시즌 리그 평균 + 전 시즌 리그 대비 FIP 차이(PRIOR_IP 회귀)."""
    lg = league()["fip"]
    if not prev:
        return lg
    return lg + (prev["fip"] - prev["lg"]) * prev["ip"] / (prev["ip"] + PRIOR_IP)


def finish_fip(st, lg):
    ip = st["ip"]
    if ip > 0 and st["hbp"] is not None:
        st["fip"] = (13 * st["hr"] + 3 * (st["bb"] + st["hbp"]) - 2 * st["k"]) / ip + lg["const"]
    else:
        st["fip"] = None
    st["k9"] = st["k"] * 9 / ip if ip else None
    st["bb9"] = st["bb"] * 9 / ip if ip else None
    st["hr9"] = st["hr"] * 9 / ip if ip else None


def regressed_fip(st, prior=None):
    prior = league()["fip"] if prior is None else prior
    if not st or st.get("fip") is None:
        return prior
    return (st["fip"] * st["ip"] + prior * FIP_REGRESS_IP) / (st["ip"] + FIP_REGRESS_IP)


def start_pitches(name, team, md, venue_opp, season):
    """최근 선발 경기 박스스코어에서 투구 수 찾기 (홈/방문을 알 때만)."""
    if not venue_opp:
        return None
    ha, opp = venue_opp
    me, op = TEAM_CODE.get(team), TEAM_CODE.get(opp)
    if not me or not op or ha not in ("홈", "방문"):
        return None
    away, home = (op, me) if ha == "홈" else (me, op)
    for hdr in "012":
        gid = f"{season}{md.replace('.', '')}{away}{home}{hdr}"
        try:
            box = boxscore(gid, 0, season)
        except NetError:
            return None
        if not box:
            continue
        for p in box[0 if ha == "방문" else 1]:
            if p["name"] == name and p["start"]:
                return p["np"]
    return None


def last_starts(daily, before_md, n=3):
    rows = [g for g in daily if g["start"] and g["md"] < before_md]
    return rows[-n:]


# ── 박스스코어 ──
def boxscore(gid, sr_id, season):
    """[원정 투수 목록, 홈 투수 목록], 투수 = {name, start, np, sv}. 경기 없으면 None."""
    d = fetch("/ws/Schedule.asmx/GetBoxScoreScroll",
              f"leId=1&srId={sr_id}&seasonId={season}&gameId={gid}", as_json=True)
    arr = d.get("arrPitcher") or []
    if len(arr) < 2:
        return None
    sides = []
    for side in arr[:2]:
        t = json.loads(side["table"])
        hd = [c["Text"] for c in t["headers"][0]["row"]]
        ps = []
        for r in t.get("rows", []):
            g = dict(zip(hd, [c["Text"] for c in r["row"]]))
            ps.append({"name": g.get("선수명", "").strip(), "start": g.get("등판") == "선발",
                       "np": num(g.get("투구수")), "sv": num(g.get("세"))})
        sides.append(ps)
    if not any(sides):
        return None
    return sides


# ── 경기 목록 ──
def game_list(d):
    r = fetch("/ws/Main.asmx/GetKboGameList", f"leId=1&srId={SR_IDS}&date={d:%Y%m%d}", as_json=True)
    return r.get("game") or []


def is_final(g):
    return str(g.get("GAME_STATE_SC")) == "3" and str(g.get("CANCEL_SC_ID", "0")) == "0"


# ── 불펜 피로 ──
def bullpen_summary(team_id, gd, finals, exclude=()):
    """gd 전 BULLPEN_DAYS일 동안 구원 투수별 투구 수와 경고."""
    window = {(gd - timedelta(days=i)).isoformat() for i in range(1, BULLPEN_DAYS + 1)}
    use, saves = {}, {}
    for g in finals:
        day = f"{g['G_DT'][:4]}-{g['G_DT'][4:6]}-{g['G_DT'][6:]}"
        if day not in window:
            continue
        side = 1 if g["HOME_ID"] == team_id else 0 if g["AWAY_ID"] == team_id else None
        if side is None:
            continue
        box = boxscore(g["G_ID"], g["SR_ID"], g["SEASON_ID"])
        if not box:
            raise NetError(f"{g['G_ID']} 박스스코어 없음")
        for p in box[side]:
            if p["start"] or p["name"] in exclude:   # 선발·오늘 선발(전 경기 구원 등판)은 뺀다
                continue
            dd = use.setdefault(p["name"], {})
            dd[day] = dd.get(day, 0) + p["np"]
            saves[p["name"]] = max(saves.get(p["name"], 0), p["sv"])
    d1, d2 = (gd - timedelta(days=1)).isoformat(), (gd - timedelta(days=2)).isoformat()
    cands = [(sv, n) for n, sv in saves.items() if sv >= CLOSER_MIN_SAVES]
    closer = max(cands)[1] if cands else None
    total = sum(sum(v.values()) for v in use.values())
    flags, relievers = [], []
    for name, days in use.items():
        why = []
        if d1 in days and d2 in days:
            why.append("연투")
        if days.get(d1, 0) >= HEAVY_PITCHES:
            why.append(f"전날 {days[d1]}구")
        if name == closer and len(days) >= 2:
            why.append("마무리 3일 중 2회+")
        relievers.append({"name": name, "days": days, "closer": name == closer, "why": why})
        if why:
            flags.append(f"{name}({'·'.join(why)})")
    relievers.sort(key=lambda r: -sum(r["days"].values()))
    return {"total": total, "flags": flags, "relievers": relievers, "ok": True, "closer": closer}


# ── 기준선 ──
def baseline(home_fip, away_fip, home_bp, away_bp, home_rd=None, away_rd=None):
    p = 50.0 + HOME_FIELD
    if home_fip is not None and away_fip is not None:
        p += (away_fip - home_fip) * PCT_PER_FIP
    bp = (away_bp - home_bp) * BULLPEN_PCT_PER_PITCH
    p += max(-BULLPEN_CAP, min(BULLPEN_CAP, bp))
    if home_rd is not None and away_rd is not None:
        p += (home_rd - away_rd) * PCT_PER_RD
    return max(CLAMP_LO, min(CLAMP_HI, p))


def fmt(x, nd=2):
    return "-" if x is None else f"{x:.{nd}f}"


STATE_KR = {"2": "진행중", "3": "종료"}
TYPE_KR = {0: "정규", 1: "시범", 3: "준PO", 4: "WC", 5: "PO", 7: "KS"}


def starter(pid, name, team, gd, want_np):
    lg = league()
    try:
        st, venue = pitcher_season(pid)
        daily = pitcher_daily(pid)
    except NetError as e:
        print(f"[경고] 선발 기록 실패 {name}: {e}", file=sys.stderr)
        st, venue, daily = None, {}, []
    try:
        prev = pitcher_prev(pid, gd.year)
    except NetError as e:
        print(f"[경고] 전 시즌 기록 실패 {name}: {e}", file=sys.stderr)
        prev = None
    last = []
    if st:
        if daily:
            st["hbp"] = sum(g["hbp"] for g in daily)
        finish_fip(st, lg)
        for g in last_starts(daily, f"{gd:%m.%d}"):
            npc = None
            if want_np:
                try:
                    npc = start_pitches(name, st.get("team") or team, g["md"], venue.get(g["md"]), gd.year)
                except NetError:
                    npc = None
            last.append({"date": g["md"], "opp": g["opp"], "ip": g["ip"], "er": g["er"], "pitches": npc})
    return {"name": name, "id": pid, "season": st, "last": last, "prev": prev,
            "fip_reg": regressed_fip(st, fip_prior(prev))}


def analyze(target_dates, want_np=False):
    lo = min(target_dates) - timedelta(days=BULLPEN_DAYS)
    hi = max(target_dates)
    games, d = [], lo
    while d <= hi:
        games += game_list(d)
        d += timedelta(days=1)
    finals = [g for g in games if is_final(g)]
    targets = []
    for g in games:
        gd = datetime.strptime(g["G_DT"], "%Y%m%d").date()
        if gd in target_dates:
            hh, mm = (g.get("G_TM") or "00:00").split(":")
            targets.append((datetime(gd.year, gd.month, gd.day, int(hh), int(mm), tzinfo=KST), g))
    targets.sort(key=lambda x: x[0])

    out = []
    for t, g in targets:
        gd = t.date()
        cancel = str(g.get("CANCEL_SC_ID", "0")) != "0"
        row = {"time": t, "gid": g["G_ID"], "type": g.get("SR_ID"), "stadium": g.get("S_NM", ""),
               "status": (g.get("CANCEL_SC_NM") or "취소") if cancel else STATE_KR.get(str(g.get("GAME_STATE_SC")), ""),
               "score": f"{g.get('T_SCORE_CN')}:{g.get('B_SCORE_CN')}" if is_final(g) else ""}
        for side, pre in (("home", "B"), ("away", "T")):
            team = g[f"{'HOME' if side == 'home' else 'AWAY'}_NM"]
            tid = g[f"{'HOME' if side == 'home' else 'AWAY'}_ID"]
            pid, pname = g.get(f"{pre}_PIT_P_ID"), (g.get(f"{pre}_PIT_P_NM") or "").strip()
            info = {"team": team, "team_id": tid, "sp": None, "rd": team_rd().get(team)}
            if pid and pname:
                info["sp"] = starter(pid, pname, team, gd, want_np)
            try:
                info["bp"] = bullpen_summary(tid, gd, finals, exclude=(pname,) if pname else ())
            except (NetError, KeyError, ValueError) as e:
                print(f"[경고] 불펜 집계 실패 {team}: {e}", file=sys.stderr)
                info["bp"] = {"total": 0, "flags": ["집계 실패"], "relievers": [], "closer": None, "ok": False}
            row[side] = info
        hs, as_ = row["home"]["sp"], row["away"]["sp"]
        row["low_conf"] = not (hs and as_)
        bp_ok = row["home"]["bp"]["ok"] and row["away"]["bp"]["ok"]   # 한쪽이라도 실패면 불펜 항 0
        row["p_home"] = baseline(hs["fip_reg"] if hs else None, as_["fip_reg"] if as_ else None,
                                 row["home"]["bp"]["total"] if bp_ok else 0,
                                 row["away"]["bp"]["total"] if bp_ok else 0,
                                 row["home"]["rd"], row["away"]["rd"])
        out.append(row)
    return out


def sp_label(sp):
    if not sp:
        return "미발표"
    return f"{sp['name']} {sp['fip_reg']:.2f}"


def print_table(rows):
    lg = league()
    print("| 경기 | 시각(KST) | 선발 매치업 FIP | 불펜 피로 | 기준선 홈 승% |")
    print("|---|---|---|---|---|")
    for r in rows:
        h, a = r["home"], r["away"]
        tag = TYPE_KR.get(r["type"], str(r["type"]))
        st = r["status"] + (f" {r['score']}" if r["score"] else "")
        game = f"{a['team']} @ {h['team']} ({tag}{', ' + st if st else ''})"
        match = f"원정 {sp_label(a['sp'])} vs 홈 {sp_label(h['sp'])}"
        bp = (f"원정 {a['bp']['total']}구{(' ⚠' + ', '.join(a['bp']['flags'])) if a['bp']['flags'] else ''}"
              f" / 홈 {h['bp']['total']}구{(' ⚠' + ', '.join(h['bp']['flags'])) if h['bp']['flags'] else ''}")
        p = f"{r['p_home']:.1f}%" + (" (확신도 낮음)" if r["low_conf"] else "")
        print(f"| {game} | {r['time']:%m/%d %H:%M} | {match} | {bp} | {p} |")
    print()
    rd = team_rd()
    rds = ", ".join(f"{t} {v:+.2f}" for t, v in sorted(rd.items(), key=lambda x: -x[1])) or "실패(0)"
    print(f"기준선 = 50 + 홈 {HOME_FIELD:+.1f}%p + (원정FIP−홈FIP)×{PCT_PER_FIP:g}%p"
          f" + (홈−원정 득실차/(경기+{RD_SHRINK_G}))×{PCT_PER_RD:g}%p"
          + (f" + 불펜(원정−홈 3일 투구 수)×{BULLPEN_PCT_PER_PITCH}%p(±{BULLPEN_CAP:.0f})" if BULLPEN_PCT_PER_PITCH else "")
          + f", {CLAMP_LO:.0f}~{CLAMP_HI:.0f}% 제한 (kbo_backtest.py 적합값). FIP 상수 {lg['const']:.2f}({lg['src']}),"
          f" {FIP_REGRESS_IP:.0f}이닝 사전값(전 시즌 FIP, 없으면 리그 {lg['fip']:.2f}) 회귀. 불펜은 경고만."
          f" 팀 득실차 지수: {rds}. 시장 확률과 비교하는 출발점일 뿐이다.")


def print_detail(rows):
    for r in rows:
        print(f"\n### {r['away']['team']} @ {r['home']['team']} — {r['time']:%m/%d %H:%M} KST"
              f" ({TYPE_KR.get(r['type'], r['type'])}, {r['stadium']}, {r['gid']})")
        for side, lab in (("away", "원정"), ("home", "홈")):
            info = r[side]
            sp = info["sp"]
            if not sp:
                print(f"- {lab} 선발: 미발표")
            else:
                s = sp["season"] or {}
                print(f"- {lab} 선발 {sp['name']}: ERA {s.get('era', '-')} WHIP {s.get('whip', '-')}"
                      f" IP {fmt(s.get('ip'), 1)} K {s.get('k', '-')} BB {s.get('bb', '-')}"
                      f" HBP {s.get('hbp', '-')} HR {s.get('hr', '-')}"
                      f" (K/9 {fmt(s.get('k9'), 1)} BB/9 {fmt(s.get('bb9'), 1)} HR/9 {fmt(s.get('hr9'), 2)})"
                      f" FIP {fmt(s.get('fip'))} (회귀 {sp['fip_reg']:.2f})")
                pv = sp.get("prev")
                if pv:
                    print(f"    · 전 시즌 FIP {pv['fip']:.2f} ({pv['ip']:.0f}이닝, 리그 {pv['lg']:.2f}) → 사전값 {fip_prior(pv):.2f}")
                for x in sp["last"]:
                    pc = f" {x['pitches']}구" if x["pitches"] else ""
                    print(f"    · {x['date']} vs {x['opp']} {x['ip']}이닝 {x['er']}자책{pc}")
            bp = info["bp"]
            print(f"- {lab} 팀 득실차 지수 {fmt(info['rd'])} (득실차/(경기+{RD_SHRINK_G}))")
            print(f"- {lab} 불펜 3일 {bp['total']}구, 마무리 {bp['closer'] or '미확인'}"
                  f", 등판 불가 가능: {', '.join(bp['flags']) or '없음'}")
            for rv in bp["relievers"]:
                days = " ".join(f"{d[5:]}:{n}" for d, n in sorted(rv["days"].items()))
                print(f"    · {rv['name']}{' (마무리)' if rv['closer'] else ''} {days}")


def bet(team):
    return TEAM_BET.get(team, team)


def write_csv(rows, path):
    cols = ["홈", "원정", "시각", "홈선발", "원정선발", "홈FIP", "원정FIP", "홈불펜3일투구",
            "원정불펜3일투구", "불펜경고", "기준선_승", "기준선_패", "홈득실차지수", "원정득실차지수"]
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            h, a = r["home"], r["away"]
            warn = "; ".join([f"원정 {x}" for x in a["bp"]["flags"]] + [f"홈 {x}" for x in h["bp"]["flags"]])
            if r["low_conf"]:
                warn = ("선발 미발표(확신도 낮음); " + warn).rstrip("; ")
            w.writerow([bet(h["team"]), bet(a["team"]), f"{r['time']:%Y-%m-%d %H:%M}",
                        h["sp"]["name"] if h["sp"] else "미발표", a["sp"]["name"] if a["sp"] else "미발표",
                        f"{h['sp']['fip_reg']:.2f}" if h["sp"] else "", f"{a['sp']['fip_reg']:.2f}" if a["sp"] else "",
                        h["bp"]["total"], a["bp"]["total"], warn,
                        f"{r['p_home']:.1f}", f"{100 - r['p_home']:.1f}",
                        fmt(h["rd"]), fmt(a["rd"])])


def main():
    ap = argparse.ArgumentParser(description="KBO 선발·불펜 기준선 (KBO 공식 홈페이지)")
    ap.add_argument("--date", action="append", help="KST 날짜 YYYY-MM-DD (기본: 오늘·내일)")
    ap.add_argument("--csv", help="CSV 저장 경로")
    ap.add_argument("--detail", action="store_true", help="선발 상세·최근 3선발 투구 수·구원 투수별 투구 수 출력")
    a = ap.parse_args()
    if a.date:
        try:
            dates = {date.fromisoformat(x) for x in a.date}
        except ValueError:
            sys.exit("날짜 형식은 YYYY-MM-DD")
    else:
        today = datetime.now(KST).date()
        dates = {today, today + timedelta(days=1)}
    try:
        rows = analyze(dates, want_np=a.detail)
    except NetError as e:
        sys.exit(f"KBO 홈페이지 접속 실패: {e}")
    finally:
        if _cookie and os.path.exists(_cookie):
            os.remove(_cookie)
    span = ", ".join(str(d) for d in sorted(dates))
    print(f"## KBO 선발·불펜 기준선 (KST {span})\n")
    if not rows:
        print("해당 날짜 경기 없음.")
        return
    print_table(rows)
    if a.detail:
        print_detail(rows)
    if a.csv:
        write_csv(rows, a.csv)
        print(f"\nCSV 저장: {a.csv}")


if __name__ == "__main__":
    main()
