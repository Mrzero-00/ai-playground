#!/usr/bin/env python3
"""
KBO 기준선 백테스트: kbo_pitching.py 의 상수(홈·FIP 기울기·불펜·FIP 회귀 이닝)를 과거 정규시즌 전 경기로 적합·검증한다.

단계
  python3 scripts/kbo_backtest.py fetch [--seasons 2023 2024 2025 2026]  # 경기 목록·박스스코어 캐시 (이어받기 가능)
  python3 scripts/kbo_backtest.py fit [--train 2024 2025 --test 2026]    # 특징 → 로지스틱 적합 → 시간 분할 검증
  (2023은 워밍업: 2024 시즌 초반 사전값(전 시즌 FIP·득실차)용으로만 쓰고 적합에서 뺀다)

데이터 (data/kbo_history/, gitignore)
- games_<시즌>.json : 날짜별 GetKboGameList 응답(정규시즌 SR_ID=0만 사용)
- box/<G_ID>.json   : GetBoxScoreScroll 의 투수 표(원정·홈), 열 = 선수명·등판·이닝·투구수·홈런·4사구·삼진·자책 …

특징 (모두 경기 전날까지의 자료만 사용, look-ahead 없음)
- 선발 FIP: 박스스코어를 날짜순으로 누적한 그 시즌 (팀, 이름)별 HR·4사구·K·IP.
  박스스코어에는 BB와 HBP가 '4사구' 한 칸으로 합쳐져 있지만 FIP 공식에서 둘 다 ×3이라 그대로 쓰면 된다.
  FIP 상수·리그 평균은 그 시즌 전날까지 리그 합계(500이닝 미만이면 전 시즌 값). R 이닝만큼 리그 평균으로 회귀.
- 불펜: 경기 전 3일(달력) 동안 팀 구원 투수 투구 수 합 (오늘 선발이 구원 등판한 몫은 제외 — 실전 도구와 같게).
- 팀 전력: 시즌 전날까지 경기당 득실차, (득실차)/(경기수+K)로 0쪽 회귀.
- 무승부 경기는 적합·평가에서 뺀다(야구 승패형 무승부는 적중특례).
"""
import argparse
import json
import math
import os
import random
import subprocess
import sys
import time
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kbo_pitching as kp  # noqa: E402

HIST = os.path.join(kp.ROOT, "data", "kbo_history")
BOX = os.path.join(HIST, "box")
DELAY = 0.25
PRIOR_IP = int(kp.PRIOR_IP)   # 전 시즌 FIP를 사전값으로 쓸 때 리그 평균으로 섞는 이닝
SEASON_SPAN = {2023: (date(2023, 3, 28), date(2023, 10, 17)),
               2024: (date(2024, 3, 20), date(2024, 10, 2)),
               2025: (date(2025, 3, 20), date(2025, 10, 5)),
               2026: (date(2026, 3, 20), None)}  # None = 어제까지


# ── 수집 ──────────────────────────────────────────────────────────────
def _games_path(season):
    return os.path.join(HIST, f"games_{season}.json")


def load_games(season):
    p = _games_path(season)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, path)


def parse_box(d):
    """GetBoxScoreScroll 응답 → [원정 투수 행들, 홈 투수 행들] (행 = 헤더→값 dict)."""
    arr = d.get("arrPitcher") or []
    if len(arr) < 2:
        return None
    sides = []
    for side in arr[:2]:
        t = json.loads(side["table"])
        hd = [c["Text"] for c in t["headers"][0]["row"]]
        sides.append([dict(zip(hd, [c["Text"] for c in r["row"]])) for r in t.get("rows", [])])
    return sides if any(sides) else None


def fetch_season(season, today):
    os.makedirs(BOX, exist_ok=True)
    lo, hi = SEASON_SPAN[season]
    hi = hi or (today - timedelta(days=1))
    games = load_games(season)
    d, n_req = lo, 0
    while d <= hi:
        key = d.strftime("%Y%m%d")
        if key not in games:
            try:
                games[key] = kp.game_list(d)
            except kp.NetError as e:
                print(f"[경고] 목록 실패 {key}: {e}", file=sys.stderr)
                d += timedelta(days=1)
                continue
            n_req += 1
            time.sleep(DELAY)
            if n_req % 20 == 0:
                save_json(_games_path(season), games)
        d += timedelta(days=1)
    save_json(_games_path(season), games)
    finals = [g for day in sorted(games) for g in games[day] if g.get("SR_ID") == 0 and kp.is_final(g)]
    todo = [g for g in finals if not os.path.exists(os.path.join(BOX, g["G_ID"] + ".json"))]
    print(f"{season}: 날짜 {len(games)}일, 정규시즌 종료 경기 {len(finals)}, 박스스코어 남은 것 {len(todo)}", flush=True)
    for i, g in enumerate(todo, 1):
        try:
            raw = kp.fetch("/ws/Schedule.asmx/GetBoxScoreScroll",
                           f"leId=1&srId={g['SR_ID']}&seasonId={g['SEASON_ID']}&gameId={g['G_ID']}", as_json=True)
            kp._cache.clear()
            box = parse_box(raw)
        except (kp.NetError, KeyError, ValueError) as e:
            print(f"[경고] 박스 실패 {g['G_ID']}: {e}", file=sys.stderr)
            time.sleep(2)
            continue
        if box is None:
            print(f"[경고] 박스 비어 있음 {g['G_ID']}", file=sys.stderr)
        else:
            save_json(os.path.join(BOX, g["G_ID"] + ".json"), box)
        if i % 100 == 0:
            print(f"  {season} 박스 {i}/{len(todo)}", flush=True)
        time.sleep(DELAY)


# ── 특징 만들기 ───────────────────────────────────────────────────────
def season_games(season):
    games = load_games(season)
    out = []
    for day in sorted(games):
        for g in games[day]:
            if g.get("SR_ID") != 0 or not kp.is_final(g):
                continue
            p = os.path.join(BOX, g["G_ID"] + ".json")
            if not os.path.exists(p):
                continue
            with open(p, encoding="utf-8") as f:
                g = dict(g, box=json.load(f))
            out.append(g)
    out.sort(key=lambda g: (g["G_DT"], g["G_ID"]))
    return out


def ival(x):
    try:
        return int(str(x).replace(",", "").strip())
    except ValueError:
        return 0


def build_rows(seasons, regress_ips=(0, 10, 20, 40, 60, 80, 120, 200, 300, 500, 1000), rd_k=10):
    """경기마다 전날까지 자료로 만든 특징 행. 선발 FIP는 회귀 이닝 후보마다 계산해 둔다."""
    rows = []
    prev_lg = {"const": kp.FIP_CONST_DEFAULT, "fip": kp.LEAGUE_FIP_DEFAULT}
    prev_team_rd = {}
    prev_pit = {}           # name -> 전 시즌 FIP·IP (팀 이동이 잦아 이름으로만)
    for season in seasons:
        gs = season_games(season)
        pit = {}            # (team, name) -> [hr, bbhbp, k, ip]
        lg = [0, 0, 0, 0.0, 0]  # hr, bbhbp, k, ip, er
        team = {}           # team_id -> [g, rs, ra]
        relief = {}         # (team_id, date) -> [(name, np)]
        by_day = {}
        for g in gs:
            by_day.setdefault(g["G_DT"], []).append(g)
        for day in sorted(by_day):
            gd = date(int(day[:4]), int(day[4:6]), int(day[6:]))
            if lg[3] >= 500:
                raw = (13 * lg[0] + 3 * lg[1] - 2 * lg[2]) / lg[3]
                era = lg[4] * 9 / lg[3]
                L = {"const": era - raw, "fip": era}
            else:
                L = prev_lg
            todays = by_day[day]
            for g in todays:
                hs, as_ = ival(g["B_SCORE_CN"]), ival(g["T_SCORE_CN"])
                feat = {"season": season, "date": gd.isoformat(), "gid": g["G_ID"],
                        "home": g["HOME_ID"], "away": g["AWAY_ID"], "hs": hs, "as": as_}
                for side, idx, tid in (("h", 1, g["HOME_ID"]), ("a", 0, g["AWAY_ID"])):
                    st = next((r for r in g["box"][idx] if r.get("등판") == "선발"), None)
                    name = (st or {}).get("선수명", "").strip()
                    s = pit.get((tid, name))
                    feat[f"{side}_sp"] = name
                    feat[f"{side}_sp_ip"] = s[3] if s else 0.0
                    for R in regress_ips:
                        if s and s[3] > 0:
                            f = (13 * s[0] + 3 * s[1] - 2 * s[2]) / s[3] + L["const"]
                            fr = (f * s[3] + L["fip"] * R) / (s[3] + R) if (s[3] + R) > 0 else L["fip"]
                        else:
                            fr = L["fip"]
                        feat[f"{side}_fip{R}"] = fr
                        # 변형: 전 시즌 FIP(50이닝 회귀)를 사전값으로 회귀
                        # 전 시즌 FIP는 그 시즌 리그 평균 대비 차이로 옮겨 온다(득점 환경 변화 보정).
                        pv = prev_pit.get(name)
                        prior = L["fip"] + ((pv[0] - pv[2]) * pv[1] / (pv[1] + PRIOR_IP) if pv else 0.0)
                        if s and s[3] > 0:
                            fr = (f * s[3] + prior * R) / (s[3] + R) if (s[3] + R) > 0 else prior
                        else:
                            fr = prior
                        feat[f"{side}_fipP{R}"] = fr
                    # 불펜 3일
                    tot = 0
                    for i in range(1, kp.BULLPEN_DAYS + 1):
                        for nm, npc in relief.get((tid, (gd - timedelta(days=i)).isoformat()), []):
                            if nm != name:
                                tot += npc
                    feat[f"{side}_bp"] = tot
                    t = team.get(tid, [0, 0, 0])
                    feat[f"{side}_g"] = t[0]
                    feat[f"{side}_rdpg"] = (t[1] - t[2]) / (t[0] + rd_k)
                    feat[f"{side}_prev_rdpg"] = prev_team_rd.get(tid, 0.0)
                    # 휴식: 전날 경기 여부
                    feat[f"{side}_played_yday"] = int(
                        (tid, (gd - timedelta(days=1)).isoformat()) in relief)
                rows.append(feat)
            # 오늘 경기 반영 (다음 날부터 보이도록)
            for g in todays:
                hs, as_ = ival(g["B_SCORE_CN"]), ival(g["T_SCORE_CN"])
                for idx, tid, rs, ra in ((1, g["HOME_ID"], hs, as_), (0, g["AWAY_ID"], as_, hs)):
                    t = team.setdefault(tid, [0, 0, 0])
                    t[0] += 1
                    t[1] += rs
                    t[2] += ra
                    lst = relief.setdefault((tid, gd.isoformat()), [])
                    for r in g["box"][idx]:
                        name = r.get("선수명", "").strip()
                        ip = kp.ip_to_float(r.get("이닝"))
                        hr, bb, k, er = ival(r.get("홈런")), ival(r.get("4사구")), ival(r.get("삼진")), ival(r.get("자책"))
                        s = pit.setdefault((tid, name), [0, 0, 0, 0.0])
                        s[0] += hr
                        s[1] += bb
                        s[2] += k
                        s[3] += ip
                        lg[0] += hr
                        lg[1] += bb
                        lg[2] += k
                        lg[3] += ip
                        lg[4] += er
                        if r.get("등판") != "선발":
                            lst.append((name, ival(r.get("투구수"))))
        if lg[3] > 0:
            raw = (13 * lg[0] + 3 * lg[1] - 2 * lg[2]) / lg[3]
            era = lg[4] * 9 / lg[3]
            prev_lg = {"const": era - raw, "fip": era}
            print(f"{season}: 경기 {len(gs)}, 리그 ERA {era:.2f}, FIP 상수 {era - raw:.2f}, IP {lg[3]:.0f}")
        prev_pit = {}
        for (tid, name), s in pit.items():
            if s[3] > 0:
                f = (13 * s[0] + 3 * s[1] - 2 * s[2]) / s[3] + prev_lg["const"]
                if name not in prev_pit or s[3] > prev_pit[name][1]:
                    prev_pit[name] = (f, s[3], prev_lg["fip"])
        prev_team_rd = {tid: (t[1] - t[2]) / t[0] for tid, t in team.items() if t[0]}
    return rows


# ── 로지스틱 회귀 (뉴턴법) ─────────────────────────────────────────────
def solve(A, b):
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        for r in range(n):
            if r != c and M[c][c] != 0:
                f = M[r][c] / M[c][c]
                for j in range(c, n + 1):
                    M[r][j] -= f * M[c][j]
    return [M[i][n] / M[i][i] for i in range(n)]


def sigmoid(z):
    return 1 / (1 + math.exp(-max(-35, min(35, z))))


def logit_fit(X, y, l2=1e-3, iters=50):
    """X: 행마다 [1, x1, ...]. 절편 제외 L2 소량."""
    k = len(X[0])
    w = [0.0] * k
    for _ in range(iters):
        g = [0.0] * k
        H = [[0.0] * k for _ in range(k)]
        for x, t in zip(X, y):
            p = sigmoid(sum(a * b for a, b in zip(w, x)))
            e = p - t
            v = p * (1 - p)
            for i in range(k):
                g[i] += e * x[i]
                xi = v * x[i]
                for j in range(k):
                    H[i][j] += xi * x[j]
        for i in range(1, k):
            g[i] += l2 * len(X) * w[i]
            H[i][i] += l2 * len(X)
        step = solve(H, g)
        w = [a - s for a, s in zip(w, step)]
        if max(abs(s) for s in step) < 1e-9:
            break
    # 표준오차 (헤시안 역행렬 대각)
    se = []
    for i in range(k):
        e = [0.0] * k
        e[i] = 1.0
        se.append(math.sqrt(max(solve(H, e)[i], 0)))
    return w, se


def metrics(ps, y):
    n = len(y)
    ll = -sum(t * math.log(max(p, 1e-12)) + (1 - t) * math.log(max(1 - p, 1e-12)) for p, t in zip(ps, y)) / n
    br = sum((p - t) ** 2 for p, t in zip(ps, y)) / n
    acc = sum((p >= 0.5) == (t == 1) for p, t in zip(ps, y)) / n
    return {"n": n, "logloss": ll, "brier": br, "acc": acc}


def calib(ps, y, edges=(0, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 1.01)):
    out = []
    for lo, hi in zip(edges, edges[1:]):
        b = [(p, t) for p, t in zip(ps, y) if lo <= p < hi]
        if b:
            out.append((lo, hi, len(b), sum(p for p, _ in b) / len(b), sum(t for _, t in b) / len(b)))
    return out


def heuristic(r, R=40):
    """현재(적합 전) kbo_pitching.baseline 상수 그대로."""
    p = 50 + 3.0 + (r[f"a_fip{R}"] - r[f"h_fip{R}"]) * 6.0
    p += max(-3.0, min(3.0, (r["a_bp"] - r["h_bp"]) * 0.04))
    return max(25.0, min(75.0, p)) / 100


def design(r, spec, R):
    x = [1.0]
    for f in spec:
        if f == "fip":
            x.append(r[f"a_fip{R}"] - r[f"h_fip{R}"])
        elif f == "fipP":
            x.append(r[f"a_fipP{R}"] - r[f"h_fipP{R}"])
        elif f == "bp":
            x.append((r["a_bp"] - r["h_bp"]) / 100)
        elif f == "rd":
            x.append(r["h_rdpg"] - r["a_rdpg"])
        elif f == "rd30":
            # 실전 도구와 같은 꼴: 올 시즌 득실차/(경기수+30), 전 시즌 없음
            def shr(s):
                g = r[f"{s}_g"]
                return (r[f"{s}_rdpg"] * (g + 10) / g) * g / (g + 30) if g else 0.0
            x.append(shr("h") - shr("a"))
        elif f == "rdprev":
            # 시즌 초반엔 전 시즌 득실차를 섞는다: 경기수 g 가 쌓일수록 올해 값 비중↑
            def blend(s):
                g = r[f"{s}_g"]
                cur = r[f"{s}_rdpg"] * (g + 10) / g if g else 0.0
                return (cur * g + r[f"{s}_prev_rdpg"] * 0.5 * 30) / (g + 30)
            x.append(blend("h") - blend("a"))
        elif f == "yday":
            x.append(r["a_played_yday"] - r["h_played_yday"])
    return x


def to_linear(w, spec):
    """로지스틱 계수 → 선형 %p 상수 (p≈0.5 기울기 β/4). bp는 1구당, 나머지는 특징 1단위당."""
    lin = {"home": (sigmoid(w[0]) - 0.5) * 100}
    for n, b in zip(spec, w[1:]):
        lin[n] = b / 4 * 100 / (100 if n == "bp" else 1)
    return lin


def linear_pred(r, lin, spec, R, bp_cap=3.0):
    """kbo_pitching.baseline 과 같은 모양(선형 %p 합, 불펜 ±상한, 25~75% 제한)."""
    x = design(r, spec, R)[1:]
    p = 50 + lin["home"]
    for n, v in zip(spec, x):
        if n == "bp":
            p += max(-bp_cap, min(bp_cap, v * 100 * lin[n]))
        else:
            p += v * lin[n]
    return max(25.0, min(75.0, p)) / 100


def predict(w, X):
    return [sigmoid(sum(p * q for p, q in zip(w, x))) for x in X]


def fit_cmd(a):
    rows = build_rows(sorted(set(a.warmup + a.train + a.test)))
    rows = [r for r in rows if r["hs"] != r["as"]]
    for r in rows:
        r["y"] = 1 if r["hs"] > r["as"] else 0
    tr = [r for r in rows if r["season"] in a.train]
    te = [r for r in rows if r["season"] in a.test]
    ytr, yte = [r["y"] for r in tr], [r["y"] for r in te]
    print(f"\n표본: 학습 {len(tr)}경기 {a.train}, 검증 {len(te)}경기 {a.test} (무승부 제외, 워밍업 {a.warmup}는 사전값용)")
    print(f"홈 승률: 학습 {sum(ytr) / len(ytr):.3f}, 검증 {sum(yte) / len(yte):.3f}")

    def show(name, ps, y=yte):
        m = metrics(ps, y)
        print(f"  {name:<40} logloss {m['logloss']:.4f}  Brier {m['brier']:.4f}  적중 {m['acc']:.3f}")
        return ps

    # 1) 회귀 이닝 R: 학습 셋 로그손실
    print("\n[FIP 회귀 이닝 R — 학습 셋, 절편+FIP차 로지스틱]")
    bestR = {}
    for fk in ("fip", "fipP"):
        best = (9, None)
        for R in (0, 10, 20, 40, 60, 80, 120, 200, 300, 500, 1000):
            X = [design(r, [fk], R) for r in tr]
            w, _ = logit_fit(X, ytr)
            ll = metrics(predict(w, X), ytr)["logloss"]
            print(f"  {fk:<5} R={R:<4} logloss {ll:.4f}  β {w[1]:.3f}")
            best = min(best, (ll, R))
        bestR[fk] = best[1]
    print(f"  → 시즌 FIP만 R={bestR['fip']}, 전 시즌 사전값 R={bestR['fipP']}")
    R = bestR["fip"]
    RP = bestR["fipP"]

    # 2) 모델 비교
    specs = [(["fip"], R), (["fip", "bp"], R), (["fip", "bp", "rdprev"], R),
             (["fip", "bp", "rdprev", "yday"], R), (["fip", "rd30"], R), (["fipP", "bp"], RP),
             (["fipP", "bp", "rdprev"], RP), (["fipP", "rd30"], RP), (["fipP", "bp", "rd30"], RP)]
    print("\n[적합 계수 (학습)]  bp 단위 = 원정−홈 3일 불펜 100구, rdprev = 홈−원정 경기당 득실차(전 시즌 섞음)")
    fitted = {}
    for spec, RR in specs:
        key = "+".join(spec)
        w, se = logit_fit([design(r, spec, RR) for r in tr], ytr)
        fitted[key] = (w, se, RR, predict(w, [design(r, spec, RR) for r in te]))
        print(f"  {key:<22} (R={RR}) " + ", ".join(f"{n} {b:+.3f}±{s:.3f}" for n, b, s in zip(["절편"] + spec, w, se)))

    print("\n[검증 시즌 성능]")
    base = sum(ytr) / len(ytr)
    preds = {}
    preds["동전"] = show("50%", [0.5] * len(te))
    preds["홈만"] = show(f"홈만 ({base:.3f}=학습 홈 승률)", [base] * len(te))
    preds["휴리스틱"] = show("현재 휴리스틱 (+3, ×6, ×0.04±3, 40IP)", [heuristic(r) for r in te])
    for key, (w, se, RR, ps) in fitted.items():
        preds[key] = show(f"로지스틱 {key}", ps)

    # 3) 현재 공식 모양으로 옮긴 선형 상수
    cands = ("fip+bp", "fip+bp+rdprev", "fip+rd30", "fipP+rd30", "fipP+bp+rd30")
    print("\n[선형 %p 환산 → kbo_pitching.baseline 모양으로 검증]  (fip/fipP=FIP 1.00당, bp=1구당, rd=경기당 득실차 1점당)")
    for key in cands:
        w, se, RR, _ = fitted[key]
        spec = key.split("+")
        lin = to_linear(w, spec)
        print(f"  {key}: " + ", ".join(f"{k} {v:+.4f}%p" for k, v in lin.items()))
        preds["선형 " + key] = show(f"선형 {key} (25~75%)", [linear_pred(r, lin, spec, RR) for r in te])

    live = {"home": kp.HOME_FIELD, "fipP": kp.PCT_PER_FIP, "bp": kp.BULLPEN_PCT_PER_PITCH, "rd30": kp.PCT_PER_RD}
    preds["실전"] = show("kbo_pitching.py 현재 상수 (검증 시즌 포함 재적합이라 참고용)",
                         [linear_pred(r, live, ["fipP", "bp", "rd30"], int(kp.FIP_REGRESS_IP)) for r in te])

    print("\n[보정 표 — 검증 시즌 (예상 vs 실제 홈 승률)]")
    for name in ("휴리스틱", "선형 fip+bp", "선형 fip+rd30", "선형 fipP+rd30"):
        print(f"  {name}")
        for lo, hi, n, mp, my in calib(preds[name], yte):
            print(f"    {lo:.2f}~{min(hi, 1):.2f}: n={n:<4} 예상 {mp:.3f} 실제 {my:.3f}")

    print("\n[휴리스틱 대비 검증 로그손실 차, 부트스트랩 2000회 95% 구간 (음수 = 더 좋음)]")
    hp = preds["휴리스틱"]
    rng = random.Random(7)

    def nll(p, t):
        return -(t * math.log(p) + (1 - t) * math.log(1 - p))
    for key in ["홈만"] + ["선형 " + c for c in cands]:
        mp = preds[key]
        d0 = [nll(mp[i], yte[i]) - nll(hp[i], yte[i]) for i in range(len(te))]
        diffs = sorted(sum(d0[rng.randrange(len(te))] for _ in te) / len(te) for _ in range(2000))
        print(f"  {key:<22} 평균 {sum(d0) / len(d0):+.4f}, 95% [{diffs[50]:+.4f}, {diffs[1949]:+.4f}]")

    print("\n[학습+검증 전체 재적합 (실전 상수 후보)]")
    allr = tr + te
    yall = [r["y"] for r in allr]
    for key in cands:
        spec = key.split("+")
        RR = fitted[key][2]
        w, se = logit_fit([design(r, spec, RR) for r in allr], yall)
        print(f"  {key} (n={len(allr)}, R={RR}): " + ", ".join(f"{n} {b:+.3f}±{s:.3f}" for n, b, s in
                                                      zip(["절편"] + spec, w, se))
              + "  → " + ", ".join(f"{k} {v:+.4f}%p" for k, v in to_linear(w, spec).items()))


def main():
    ap = argparse.ArgumentParser(description="KBO 기준선 상수 백테스트")
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch")
    f.add_argument("--seasons", type=int, nargs="+", default=[2023, 2024, 2025, 2026])
    t = sub.add_parser("fit")
    t.add_argument("--warmup", type=int, nargs="*", default=[2023], help="사전값(전 시즌 FIP·득실차)용, 적합 제외")
    t.add_argument("--train", type=int, nargs="+", default=[2024, 2025])
    t.add_argument("--test", type=int, nargs="+", default=[2026])
    a = ap.parse_args()
    if a.cmd == "fetch":
        today = date.today()
        try:
            for s in a.seasons:
                fetch_season(s, today)
        finally:
            if kp._cookie and os.path.exists(kp._cookie):
                os.remove(kp._cookie)
    else:
        fit_cmd(a)


if __name__ == "__main__":
    main()
