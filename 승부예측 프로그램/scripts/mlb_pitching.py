#!/usr/bin/env python3
"""
MLB 선발·불펜 기준선: 무료 MLB Stats API(statsapi.mlb.com)로 경기 전 야구 기준선을 자동으로 만든다.

원리
- 선발 매치업이 출발점(종목별분석/야구.md 1. 기준선). 양 선발의 시즌 FIP 차이를 승률로 바꾼다.
  FIP = (13×HR + 3×(BB+HBP) − 2×K) / IP + 3.10. 이닝이 적은 투수는 리그 평균 쪽으로 당긴다(아래 상수).
- 불펜 가용성(순수 강점 변수 [중간]): 최근 3일 팀 경기 박스스코어에서 구원 투수 투구 수를 모아
  연투·전날 30구 이상·마무리 3일 중 2회 이상 등판을 경고하고, 3일 불펜 투구 수 차이로 소폭 보정한다.
- 결과는 '기준선'이다. 시장(Pinnacle) 확률과 비교·혼합하는 출발점이지 최종 확률이 아니다.

사용법
  python3 scripts/mlb_pitching.py                       # 오늘·내일(KST) 경기
  python3 scripts/mlb_pitching.py --date 2026-10-10     # KST 날짜 지정 (여러 번 지정 가능)
  python3 scripts/mlb_pitching.py --detail              # 선발 시즌 기록·최근 3경기·구원 투수별 투구 수까지 출력
  python3 scripts/mlb_pitching.py --csv data/mlb_기준선.csv   # CSV 저장

주의
- KST 오전 경기는 미국 전날 저녁 경기다. KST 날짜 기준으로 경기 시작 시각을 변환해 거른다.
- 선발 시즌 기록은 정규시즌(R) 기준, 최근 3경기는 포스트시즌 포함.
- 선발 미발표면 '미발표'로 표시하고 선발 항을 빼며 확신도 '낮음'. 불펜데이·오프너는 반영하지 못한다.
- 상대 타선·구장·날씨·라인업은 반영하지 않는다(야구.md 체크리스트로 따로 확인).
"""
import argparse
import csv
import json
import os
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone

# ── 기준선 상수 (근거·튜닝 시 여기만 고친다) ─────────────────────────────
FIP_CONST = 3.10            # FIP 상수 (리그 ERA 맞춤값, 대략 3.1)
LEAGUE_FIP = 4.10           # 리그 평균 FIP (소표본 회귀 목표)
FIP_REGRESS_IP = 40.0       # 이 이닝만큼 리그 평균을 섞는다: (FIP×IP + 4.10×40)/(IP+40)
PCT_PER_FIP = 6.0           # FIP 1.00 차이 ≈ 6%p (선발이 약 5.5이닝 담당하는 몫)
HOME_FIELD = 4.0            # 홈 어드밴티지 +4%p
BULLPEN_PCT_PER_PITCH = 0.04  # 3일 불펜 투구 수 차이 1구당 %p (75구 차이 = 3%p)
BULLPEN_CAP = 3.0           # 불펜 보정 상한 ±3%p
CLAMP_LO, CLAMP_HI = 25.0, 75.0  # 기준선 승률 범위
HEAVY_PITCHES = 30          # 전날 이 투구 수 이상이면 경고
CLOSER_MIN_SAVES = 8        # 정규시즌 세이브가 이 이상인 팀 내 최다 세이브 구원 투수 = 마무리
BULLPEN_DAYS = 3            # 불펜 집계 기간(경기 전날부터 거꾸로 N일)
# ────────────────────────────────────────────────────────────────────

API = "https://statsapi.mlb.com/api/v1"
KST = timezone(timedelta(hours=9))
GAME_TYPES = "R,F,D,L,W"   # 정규시즌 + 와일드카드·디비전·챔피언십·월드시리즈
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NetError(Exception):
    pass


_cache = {}


def get(path):
    url = path if path.startswith("http") else API + path
    if url in _cache:
        return _cache[url]
    try:
        r = subprocess.run(["curl", "-sS", "-g", "-m", "30", "--retry", "2", url],
                           capture_output=True, text=True, timeout=90)
    except (subprocess.TimeoutExpired, OSError) as e:
        raise NetError(f"{url}: {e}")
    if r.returncode != 0:
        raise NetError(f"{url}: {r.stderr.strip()}")
    try:
        d = json.loads(r.stdout)
    except json.JSONDecodeError:
        raise NetError(f"{url}: JSON 아님 ({r.stdout[:80]!r})")
    _cache[url] = d
    return d


def ip_to_float(ip):
    """'186.1' → 186.333 (소수점 아래는 아웃 수)."""
    if ip in (None, ""):
        return 0.0
    whole, _, frac = str(ip).partition(".")
    return int(whole or 0) + int(frac or 0) / 3


# ── 팀명(한글) ──
def load_kor_names():
    try:
        with open(os.path.join(ROOT, "data", "team_names.json"), encoding="utf-8") as f:
            m = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}
    return {k: v for k, v in m.items() if not k.startswith("_")}


KOR = load_kor_names()


def kor(name):
    best = None
    for k, v in KOR.items():
        if isinstance(v, str) and v and name.endswith(v) and " " in k:   # 별칭(Braves 등)으로 끝나는 정식 표기만 (Atlanta→축구팀 오매칭 방지)
            if best is None or len(v) > len(best[1]):
                best = (k, v)
    return best[0] if best else name


# ── 투수 기록 ──
def pitcher_season(pid, season):
    d = get(f"/people/{pid}/stats?stats=season&group=pitching&season={season}")
    sp = (d.get("stats") or [{}])[0].get("splits") or []
    if not sp:
        return None
    s = sp[0]["stat"]
    ip = ip_to_float(s.get("inningsPitched"))
    k, bb, hbp, hr = (s.get("strikeOuts", 0), s.get("baseOnBalls", 0),
                      s.get("hitByPitch", 0), s.get("homeRuns", 0))
    out = {"ip": ip, "era": s.get("era"), "whip": s.get("whip"),
           "k9": s.get("strikeoutsPer9Inn"), "bb9": s.get("walksPer9Inn"),
           "hr9": s.get("homeRunsPer9"), "saves": s.get("saves", 0)}
    out["fip"] = (13 * hr + 3 * (bb + hbp) - 2 * k) / ip + FIP_CONST if ip > 0 else None
    return out


def regressed_fip(st):
    if not st or st.get("fip") is None:
        return LEAGUE_FIP
    return (st["fip"] * st["ip"] + LEAGUE_FIP * FIP_REGRESS_IP) / (st["ip"] + FIP_REGRESS_IP)


def last_starts(pid, season, before, n=3):
    d = get(f"/people/{pid}/stats?stats=gameLog&group=pitching&season={season}&gameType={GAME_TYPES}")
    sp = (d.get("stats") or [{}])[0].get("splits") or []
    rows = [x for x in sp if x["stat"].get("gamesStarted") and x.get("date", "") < before]
    rows.sort(key=lambda x: x["date"])
    return [{"date": x["date"], "ip": x["stat"].get("inningsPitched"),
             "er": x["stat"].get("earnedRuns"), "pitches": x["stat"].get("numberOfPitches")}
            for x in rows[-n:]]


def season_saves(pids, season):
    if not pids:
        return {}
    ids = ",".join(str(p) for p in sorted(pids))
    d = get(f"/people?personIds={ids}&hydrate=stats(group=[pitching],type=[season],season={season})")
    out = {}
    for p in d.get("people", []):
        sv = 0
        for st in p.get("stats", []):
            for sp in st.get("splits", []):
                sv = max(sv, sp.get("stat", {}).get("saves", 0) or 0)
        out[p["id"]] = sv
    return out


# ── 불펜 피로 ──
def bullpen_usage(team_id, game_date, finals, exclude=()):
    """game_date(미국 공식 날짜) 전 BULLPEN_DAYS일 동안 구원 투수별 {pid: {date: pitches}}."""
    gd = date.fromisoformat(game_date)
    window = {(gd - timedelta(days=i)).isoformat() for i in range(1, BULLPEN_DAYS + 1)}
    use, names = {}, {}
    for g in finals:
        if g["officialDate"] not in window:
            continue
        side = "home" if g["teams"]["home"]["team"]["id"] == team_id else \
               "away" if g["teams"]["away"]["team"]["id"] == team_id else None
        if not side:
            continue
        box = get(f"/game/{g['gamePk']}/boxscore")["teams"][side]
        for pid in box.get("pitchers", []):
            p = box["players"].get(f"ID{pid}", {})
            s = p.get("stats", {}).get("pitching", {})
            if s.get("gamesStarted") or pid in exclude:   # 오늘 선발(전 경기 구원 등판)은 불펜에서 뺀다
                continue
            n = s.get("numberOfPitches") or s.get("pitchesThrown") or 0
            names[pid] = p.get("person", {}).get("fullName", str(pid))
            day = use.setdefault(pid, {})
            day[g["officialDate"]] = day.get(g["officialDate"], 0) + n
    return use, names


def bullpen_summary(team_id, game_date, finals, season, exclude=()):
    use, names = bullpen_usage(team_id, game_date, finals, exclude)
    gd = date.fromisoformat(game_date)
    d1, d2 = (gd - timedelta(days=1)).isoformat(), (gd - timedelta(days=2)).isoformat()
    saves = season_saves(set(use), season)
    closer = None
    cands = [(saves.get(p, 0), p) for p in use if saves.get(p, 0) >= CLOSER_MIN_SAVES]
    if cands:
        closer = max(cands)[1]
    total = sum(sum(v.values()) for v in use.values())
    flags, relievers = [], []
    for pid, days in use.items():
        why = []
        if d1 in days and d2 in days:
            why.append("연투")
        if days.get(d1, 0) >= HEAVY_PITCHES:
            why.append(f"전날 {days[d1]}구")
        if pid == closer and len(days) >= 2:
            why.append("마무리 3일 중 2회+")
        last = names[pid].split()[-1]
        relievers.append({"name": names[pid], "days": days, "closer": pid == closer, "why": why})
        if why:
            flags.append(f"{last}({'·'.join(why)})")
    relievers.sort(key=lambda r: -sum(r["days"].values()))
    return {"total": total, "flags": flags, "relievers": relievers, "ok": True,
            "closer": names.get(closer) if closer else None}


# ── 기준선 ──
def baseline(home_fip, away_fip, home_bp, away_bp):
    p = 50.0 + HOME_FIELD
    if home_fip is not None and away_fip is not None:
        p += (away_fip - home_fip) * PCT_PER_FIP
    bp = (away_bp - home_bp) * BULLPEN_PCT_PER_PITCH
    p += max(-BULLPEN_CAP, min(BULLPEN_CAP, bp))
    return max(CLAMP_LO, min(CLAMP_HI, p))


def fmt(x, nd=2):
    return "-" if x is None else f"{x:.{nd}f}"


STATUS_KR = {"Final": "종료", "Game Over": "종료", "In Progress": "진행중", "Postponed": "연기",
             "Suspended": "중단", "Delayed": "지연", "Warmup": "몸풀기"}
TYPE_KR = {"R": "정규", "F": "WC", "D": "DS", "L": "CS", "W": "WS"}


def analyze(target_dates):
    lo = min(target_dates) - timedelta(days=BULLPEN_DAYS + 1)
    hi = max(target_dates)
    sched = get(f"/schedule?sportId=1&gameType={GAME_TYPES}&startDate={lo}&endDate={hi}"
                f"&hydrate=probablePitcher")
    games = [g for d in sched.get("dates", []) for g in d.get("games", [])]
    finals = [g for g in games if g["status"].get("abstractGameState") == "Final"
              and g["status"].get("detailedState") not in ("Postponed", "Cancelled")]
    targets = []
    for g in games:
        t = datetime.fromisoformat(g["gameDate"].replace("Z", "+00:00")).astimezone(KST)
        if t.date() in target_dates:
            targets.append((t, g))
    targets.sort(key=lambda x: x[0])

    out = []
    for t, g in targets:
        season = g.get("season") or str(t.year)
        row = {"time": t, "pk": g["gamePk"], "type": g.get("gameType"),
               "series": g.get("seriesDescription", ""), "sgn": g.get("seriesGameNumber"),
               "status": g["status"].get("detailedState", "")}
        for side in ("home", "away"):
            tm = g["teams"][side]
            pp = tm.get("probablePitcher")
            info = {"team": tm["team"]["name"], "team_id": tm["team"]["id"], "sp": None}
            if pp:
                try:
                    st = pitcher_season(pp["id"], season)
                    ls = last_starts(pp["id"], season, g["officialDate"])
                except NetError as e:
                    print(f"[경고] 선발 기록 실패 {pp.get('fullName')}: {e}", file=sys.stderr)
                    st, ls = None, []
                info["sp"] = {"name": pp.get("fullName", "?"), "season": st, "last": ls,
                              "fip_reg": regressed_fip(st)}
            try:
                info["bp"] = bullpen_summary(tm["team"]["id"], g["officialDate"], finals, season,
                                             exclude=(pp["id"],) if pp else ())
            except NetError as e:
                print(f"[경고] 불펜 집계 실패 {tm['team']['name']}: {e}", file=sys.stderr)
                info["bp"] = {"total": 0, "flags": ["집계 실패"], "relievers": [], "closer": None, "ok": False}
            row[side] = info
        hs, as_ = row["home"]["sp"], row["away"]["sp"]
        row["low_conf"] = not (hs and as_)
        bp_ok = row["home"]["bp"]["ok"] and row["away"]["bp"]["ok"]   # 한쪽이라도 실패면 불펜 항 0
        row["p_home"] = baseline(hs["fip_reg"] if hs else None, as_["fip_reg"] if as_ else None,
                                 row["home"]["bp"]["total"] if bp_ok else 0,
                                 row["away"]["bp"]["total"] if bp_ok else 0)
        out.append(row)
    return out


def sp_label(sp):
    if not sp:
        return "미발표"
    return f"{sp['name'].split()[-1]} {sp['fip_reg']:.2f}"


def print_table(rows):
    print("| 경기 | 시각(KST) | 선발 매치업 FIP | 불펜 피로 | 기준선 홈 승% |")
    print("|---|---|---|---|---|")
    for r in rows:
        h, a = r["home"], r["away"]
        tag = TYPE_KR.get(r["type"], r["type"])
        if r["sgn"] and r["type"] != "R":
            tag += f" {r['sgn']}차전"
        st = STATUS_KR.get(r["status"], "")
        game = f"{kor(a['team'])} @ {kor(h['team'])} ({tag}{', ' + st if st else ''})"
        match = f"원정 {sp_label(a['sp'])} vs 홈 {sp_label(h['sp'])}"
        bp = (f"원정 {a['bp']['total']}구{(' ⚠' + ', '.join(a['bp']['flags'])) if a['bp']['flags'] else ''}"
              f" / 홈 {h['bp']['total']}구{(' ⚠' + ', '.join(h['bp']['flags'])) if h['bp']['flags'] else ''}")
        p = f"{r['p_home']:.1f}%" + (" (확신도 낮음)" if r["low_conf"] else "")
        print(f"| {game} | {r['time']:%m/%d %H:%M} | {match} | {bp} | {p} |")
    print()
    print(f"기준선 = 50 + 홈 {HOME_FIELD:+.0f}%p + (원정FIP−홈FIP)×{PCT_PER_FIP:.0f}%p"
          f" + 불펜(원정−홈 3일 투구 수)×{BULLPEN_PCT_PER_PITCH}%p(±{BULLPEN_CAP:.0f}),"
          f" {CLAMP_LO:.0f}~{CLAMP_HI:.0f}% 제한. FIP는 {FIP_REGRESS_IP:.0f}이닝 리그평균({LEAGUE_FIP}) 회귀값."
          " 시장 확률과 비교하는 출발점일 뿐이다.")


def print_detail(rows):
    for r in rows:
        print(f"\n### {kor(r['away']['team'])} @ {kor(r['home']['team'])} — {r['time']:%m/%d %H:%M} KST"
              f" ({r['series']} {r['sgn'] or ''})")
        for side, lab in (("away", "원정"), ("home", "홈")):
            info = r[side]
            sp = info["sp"]
            if not sp:
                print(f"- {lab} 선발: 미발표")
            else:
                s = sp["season"] or {}
                print(f"- {lab} 선발 {sp['name']}: ERA {s.get('era', '-')} WHIP {s.get('whip', '-')}"
                      f" IP {fmt(s.get('ip'), 1)} K/9 {s.get('k9', '-')} BB/9 {s.get('bb9', '-')}"
                      f" HR/9 {s.get('hr9', '-')} FIP {fmt(s.get('fip'))} (회귀 {sp['fip_reg']:.2f})")
                for x in sp["last"]:
                    print(f"    · {x['date']} {x['ip']}이닝 {x['er']}자책 {x['pitches']}구")
            bp = info["bp"]
            print(f"- {lab} 불펜 3일 {bp['total']}구, 마무리 {bp['closer'] or '미확인'}"
                  f", 등판 불가 가능: {', '.join(bp['flags']) or '없음'}")
            for rv in bp["relievers"]:
                days = " ".join(f"{d[5:]}:{n}" for d, n in sorted(rv["days"].items()))
                print(f"    · {rv['name']}{' (마무리)' if rv['closer'] else ''} {days}")


def write_csv(rows, path):
    cols = ["홈", "원정", "시각", "홈선발", "원정선발", "홈FIP", "원정FIP", "홈불펜3일투구",
            "원정불펜3일투구", "불펜경고", "기준선_승", "기준선_패"]
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            h, a = r["home"], r["away"]
            warn = "; ".join([f"원정 {x}" for x in a["bp"]["flags"]] + [f"홈 {x}" for x in h["bp"]["flags"]])
            if r["low_conf"]:
                warn = ("선발 미발표(확신도 낮음); " + warn).rstrip("; ")
            w.writerow([kor(h["team"]), kor(a["team"]), f"{r['time']:%Y-%m-%d %H:%M}",
                        h["sp"]["name"] if h["sp"] else "미발표", a["sp"]["name"] if a["sp"] else "미발표",
                        f"{h['sp']['fip_reg']:.2f}" if h["sp"] else "", f"{a['sp']['fip_reg']:.2f}" if a["sp"] else "",
                        h["bp"]["total"], a["bp"]["total"], warn,
                        f"{r['p_home']:.1f}", f"{100 - r['p_home']:.1f}"])


def main():
    ap = argparse.ArgumentParser(description="MLB 선발·불펜 기준선 (MLB Stats API)")
    ap.add_argument("--date", action="append", help="KST 날짜 YYYY-MM-DD (기본: 오늘·내일)")
    ap.add_argument("--csv", help="CSV 저장 경로")
    ap.add_argument("--detail", action="store_true", help="선발 상세·구원 투수별 투구 수 출력")
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
        rows = analyze(dates)
    except NetError as e:
        sys.exit(f"MLB Stats API 접속 실패: {e}")
    span = ", ".join(str(d) for d in sorted(dates))
    print(f"## MLB 선발·불펜 기준선 (KST {span})\n")
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
