#!/usr/bin/env python3
"""유럽 통합 pi-rating 기준선 (2026-10-20 신설 — 승무패62가 UCL 14경기라 리그별 기준선이 안 먹힌다)

soccer_baseline.py 의 pi-rating 은 리그 1개 안에서만 돌아 리그 간 비교가 안 된다.
여기서는 UCL 참가국 1부 리그 + UEFA 3개 대회(챔스·유로파·컨퍼런스) 결과를 **하나의 풀**로 모아
pi-rating 을 돌린다. 유럽 대항전 경기가 리그 사이를 잇는 다리 역할을 해서 리그 간 강도가 자동 보정된다.

  python3 scripts/euro_baseline.py --round 승무패62
  python3 scripts/euro_baseline.py --home "Liverpool" --away "Villarreal"
  python3 scripts/euro_baseline.py --calib        # 보류 검증 (UCL 경기 RPS)
"""
import argparse
import datetime as dt
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import soccer_baseline as sb  # noqa: E402

# UCL/UEL 참가국 1부 + 대항전. 코드는 ESPN.
# cze.1 / ukr.1 은 ESPN 미제공(2026-10-20 확인, events 0) → 체코·우크라이나 팀은 대항전 경기만으로 레이팅이 선다.
DOMESTIC = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1", "ned.1", "por.1", "tur.1",
            "bel.1", "aut.1", "nor.1", "sui.1", "sco.1", "gre.1", "den.1"]
UEFA = ["uefa.champions", "uefa.europa", "uefa.europa.conf"]


def pool(refresh=False, quiet=False):
    games, seen = [], set()
    for code in DOMESTIC + UEFA:
        try:
            gs = sb.load_results(code, refresh=refresh, quiet=quiet)
        except Exception as e:                       # noqa: BLE001
            print(f"  [경고] {code}: {e}", file=sys.stderr)
            continue
        if not gs:
            print(f"  [경고] {code}: 경기 0", file=sys.stderr)
            continue
        n = 0
        for g in gs:
            k = (g["date"][:10], g["home"], g["away"])
            if k in seen:
                continue
            seen.add(k)
            g = dict(g)
            g["lg"] = code
            games.append(g)
            n += 1
        if not quiet:
            print(f"  {code}: {n}경기", file=sys.stderr)
    games.sort(key=lambda g: g["t"])
    return games


LAM = 8.0   # 리그 오프셋 능선 규제. 2026-10-20 보류검증으로 선택(0.5~16 사이 거의 평평, 8이 최저 RPS).


def league_of(used):
    """팀 → 주 소속 리그(국내 리그 경기에서). 대항전 경기는 소속 판정에 쓰지 않는다."""
    m = {}
    for g in used:
        if g["lg"].startswith("uefa"):
            continue
        m[g["home"]] = g["lg"]
        m.setdefault(g["away"], g["lg"])
    return m


def fit_offsets(uefa_games, par, home_lg, lam=LAM):
    """리그 강도 오프셋(골차 단위). 대항전 경기의 잔차 = 관측 골차 − 모델 골차 를
    (홈 리그 더미 − 원정 리그 더미)로 능선 회귀. 평균 0으로 중심화.
    이유(2026-10-20 측정): 통합 pi-rating 만으로는 약체 리그 지배팀이 과대평가된다 —
    보류검증에서 '5대 리그 홈 vs 그 외 원정' 예측 홈승 47% / 실제 73%(+26%p).
    오프셋을 넣으면 RPS 0.2208→0.2061, 1순위 적중 54.0%→58.8%(78주 454경기)."""
    lgs = sorted({home_lg[g["home"]] for g in uefa_games if g["home"] in home_lg} |
                 {home_lg[g["away"]] for g in uefa_games if g["away"] in home_lg})
    idx = {l: i for i, l in enumerate(lgs)}
    k = len(lgs)
    if k < 2:
        return {}
    A = [[0.0] * k for _ in range(k)]
    B = [0.0] * k
    for g in uefa_games:
        hl, al = home_lg.get(g["home"]), home_lg.get(g["away"])
        if not hl or not al or hl == al or "pred" not in g:
            continue
        r = (g["hg"] - g["ag"]) - (par["a"] + par["b"] * g["pred"])
        for i, s in ((idx[hl], 1.0), (idx[al], -1.0)):
            for j, s2 in ((idx[hl], 1.0), (idx[al], -1.0)):
                A[i][j] += s * s2
            B[i] += s * r
    for i in range(k):
        A[i][i] += lam
    M = [A[i][:] + [B[i]] for i in range(k)]
    for c in range(k):                                  # 가우스-조던
        p = max(range(c, k), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        if abs(M[c][c]) < 1e-9:
            continue
        for r in range(k):
            if r == c:
                continue
            f = M[r][c] / M[c][c]
            for j in range(c, k + 1):
                M[r][j] -= f * M[c][j]
    off = {l: (M[idx[l]][k] / M[idx[l]][idx[l]] if abs(M[idx[l]][idx[l]]) > 1e-9 else 0.0) for l in lgs}
    m = sum(off.values()) / len(off)
    return {l: v - m for l, v in off.items()}


def state(cutoff=None, refresh=False, quiet=False, _c={}):
    key = (cutoff, refresh)
    if key in _c:
        return _c[key]
    games = pool(refresh, quiet)
    rh, ra, used = sb.run_pi(games, cutoff)
    # 파라미터는 **UCL 경기만**으로 적합 — 대항전의 홈 이점·총득점이 리그와 다르다.
    ucl = [g for g in used if g["lg"] == "uefa.champions" and "pred" in g]
    par = sb.fit_league(ucl) if len(ucl) >= 120 else sb.fit_league(used)
    par["fit_on"] = "uefa.champions" if len(ucl) >= 120 else "pool"
    par["fit_n"] = len(ucl)
    home_lg = league_of(used)
    off = fit_offsets([g for g in used if g["lg"].startswith("uefa") and "pred" in g], par, home_lg)
    _c[key] = (rh, ra, used, par, home_lg, off)
    return _c[key]


def predict_pair(home, away, cutoff=None, quiet=True):
    rh, ra, used, par, home_lg, off = state(cutoff, quiet=quiet)
    if home not in rh or away not in ra:
        return None, par
    hl, al = home_lg.get(home), home_lg.get(away)
    # 한쪽 리그를 몰라도(= 그 팀은 대항전 경기만으로 레이팅이 섰다 → 이미 유럽 기준) 아는 쪽 오프셋은 적용한다.
    adj = (off.get(hl, 0.0) - off.get(al, 0.0)) / par["b"]
    pred = rh[home] - ra[away] + adj
    out = sb.predict(par, pred)
    out["pred"] = pred
    out["pi차"] = rh[home] - ra[away]
    out["리그보정"] = adj
    out["홈리그"], out["원정리그"] = hl, al
    return out, par


def teams_recent(days=420):
    rh, ra, used, par, home_lg, off = state(quiet=True)
    ref = used[-1]["t"]
    s = set()
    for g in used:
        if (ref - g["t"]).days <= days:
            s.add(g["home"]); s.add(g["away"])
    return sorted(s)


def cmd_round(rnd):
    import csv
    rows = [r for r in csv.DictReader(open(sb.RECORD_PATH, encoding="utf-8-sig"))
            if r["회차"] == str(rnd) and r["종목"] == "축구"]
    if not rows:
        sys.exit(f"{rnd} 축구 경기 없음")
    names = sb.load_names()
    teams = teams_recent()
    rh, ra, used, par, home_lg, off = state(quiet=True)
    print("리그 강도 오프셋(골차): " + ", ".join(f"{l} {v:+.2f}" for l, v in sorted(off.items(), key=lambda x: -x[1])))
    print(f"풀 {len(used)}경기 · 파라미터 적합 {par['fit_on']}({par['fit_n']}경기) "
          f"홈이점 {par['home_adv']:+.2f} 평균득점 {par['avg_total']:.2f} 홈승 {par['home_w']*100:.1f} 무 {par['draw']*100:.1f}\n")
    print(f"{'번호':>3} {'경기':<42} {'기준선(승-무-패)':>18} {'xG':>11}  pi차")
    out = []
    for r in rows:
        h = sb.match_team(r["홈"], teams, names)
        a = sb.match_team(r["원정"], teams, names)
        if not h or not a:
            print(f"{r['번호']:>3} {r['홈']} - {r['원정']:<20} ✗ 매칭실패 (홈 {h} / 원정 {a})")
            out.append({"번호": r["번호"], "홈": r["홈"], "원정": r["원정"], "b": None})
            continue
        b, _ = predict_pair(h, a)
        g = f"{r['홈']} - {r['원정']}"
        pi, lo = b["pi차"], b["리그보정"]
        print(f"{r['번호']:>3} {g[:42]:<42} {b['승']*100:5.1f}{b['무']*100:6.1f}{b['패']*100:6.1f}   "
              f"{b['xg_h']:.2f}:{b['xg_a']:.2f}  {b['pred']:+.2f}(pi{pi:+.2f}{lo:+.2f})  [{h} / {a}]")
        out.append({"번호": r["번호"], "홈": r["홈"], "원정": r["원정"], "eng": (h, a), "b": b})
    return out


def cmd_calib(weeks=16):
    """최근 N주 UCL/UEL 경기를 보류 검증 — 그 경기 2시간 전까지의 자료로만 예측."""
    games = pool(quiet=True)
    end = games[-1]["t"]
    lo = end - dt.timedelta(weeks=weeks)
    tgt = [g for g in games if g["t"] >= lo and g["lg"] in ("uefa.champions", "uefa.europa")]
    rps_m = brier = n = hit = 0.0
    for g in tgt:
        cut = g["t"] - dt.timedelta(hours=2)
        rh, ra, used, par = sb.run_pi([x for x in games if x["t"] < cut]), None, None, None
        rh, ra, used = rh
        ucl = [x for x in used if x.get("lg") == "uefa.champions" and "pred" in x]
        par = sb.fit_league(ucl) if len(ucl) >= 120 else sb.fit_league(used)
        if g["home"] not in rh or g["away"] not in ra or par is None:
            continue
        p = sb.predict(par, rh[g["home"]] - ra[g["away"]])
        pv = (p["승"], p["무"], p["패"])
        y = 0 if g["hg"] > g["ag"] else (1 if g["hg"] == g["ag"] else 2)
        rps_m += sb.rps(pv, y); brier += sb.brier(pv, y); n += 1
        hit += 1 if pv.index(max(pv)) == y else 0
    print(f"UCL/UEL 최근 {weeks}주 {int(n)}경기 — RPS {rps_m/n:.4f} · Brier {brier/n:.4f} · 1순위 적중 {hit/n*100:.1f}%")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--round"); ap.add_argument("--home"); ap.add_argument("--away")
    ap.add_argument("--calib", action="store_true"); ap.add_argument("--weeks", type=int, default=16)
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    if a.refresh:
        pool(refresh=True)
    if a.calib:
        cmd_calib(a.weeks)
    elif a.round:
        cmd_round(a.round)
    elif a.home and a.away:
        b, par = predict_pair(a.home, a.away, quiet=False)
        print(b)
    else:
        ap.print_help()
