#!/usr/bin/env python3
"""
축구토토 매치 스캔: 한 경기의 (전반 스코어, 최종 스코어) 칸별 모델 확률 × 베트맨 예상 배당 → 기대값.

게임 규칙 (sportstoto.co.kr/soccer_match.php)
- 대상 1경기의 전반 득점(홈/원정)과 최종 득점(홈/원정, 연장 포함·승부차기 제외)을 모두 맞혀야 적중. 득점은 0~4, 5+ 6구간.
- 풀 배당: 총 발매액의 50%를 적중자끼리 나눈다. 단위 100원.

모델
- Pinnacle 최종 승무패 + 언더오버(여러 라인) → 최종 기대득점 λ홈/λ원정 역산 (Dixon-Coles, rho -0.13)
- Pinnacle 전반 승무패 + 전반 언더오버 → 전반 기대득점 역산. 후반 = 최종 − 전반.
- P(전반=(a,b), 최종=(c,d)) = P전반(a,b) × P후반(c-a, d-b). 두 반 득점은 독립으로 가정.

배당 (풀 배당이라 대중 점유율이 곧 배당이다)
- 기대값 = 0.5(환급률) × 모델 확률 / 대중 점유율. 대중 점유율이 모델 확률의 절반 미만인 칸만 1.0을 넘는다.
- 대중 점유율(전반, 최종) = 최종칸 투표 비율 × 전반칸 투표 비율. 단 전반은 최종 스코어와 모순되지 않는 칸(전반 ≤ 최종)으로 제한해 다시 정규화한다.
  (최종 0-0을 찍은 사람은 전반도 0-0일 수밖에 없다. 독립 가정으로 계산하면 배당이 수십 배 부풀려진다 — 2026-10-01 수정)
- 표를 하나도 안 산 칸은 점유율을 '표 1장'으로 깔아 배당 상한을 둔다. 예상 배당 = 0.5 / 대중 점유율.
- 베트맨 화면의 '예상 배당'(최종칸만 반영)은 참고용으로 같이 적는다.

사용법
  python3 scripts/match_scan.py            # 판매 중인 매치 회차 전부
  python3 scripts/match_scan.py --top 20   # 상위 20칸
  python3 scripts/match_scan.py --save     # 회차별분석/매치스캔_YYYY-MM-DD_HHMM.csv

주의
- 풀 배당은 마감까지 투표가 바뀌면 같이 바뀐다. 마감 직전에 다시 돌린다.
- 환급률 50% 상품이라 평균 기대값은 0.5다. 1.0을 넘는 칸은 대중이 비워 둔 칸이지 확률이 높은 칸이 아니다. 적중률은 칸당 1~10%.
"""
import argparse, csv, datetime as dt, json, math, os, subprocess, sys

sys.path.insert(0, os.path.dirname(__file__))
import odds_scan as o  # noqa: E402
from match_model import pois, tau  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
KST = o.KST
N = 6  # 0~4, 5+
RHO = -0.13


# ---------------------------------------------------------------- 베트맨
def betman(cookie):
    url = "https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId=G009"
    subprocess.run(["curl", "-sS", "-m", "30", "-A", o.UA, "-c", cookie, "-o", "/dev/null", url])
    hdr = ["Content-Type: application/json; charset=UTF-8", "Accept: application/json",
           "X-Requested-With: XMLHttpRequest", "Origin: https://www.betman.co.kr", f"Referer: {url}"]
    sbm = {"_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}
    lst = o.curl("https://www.betman.co.kr/buyPsblGame/inqCacheBuyAbleGameInfoList.do", hdr, json.dumps(sbm), cookie)
    out = []
    for g in lst.get("totoGames", []):
        if g["gmId"] != "G009":
            continue
        body = json.dumps({"gmId": "G009", "gmTs": g["gmTs"], "gameYear": g["gmOsidTsYear"], **sbm})
        d = o.curl("https://www.betman.co.kr/buyPsblGame/gameInfoInq.do", hdr, body, cookie)
        sch = d["schedulesList"]
        sch = [dict(zip(sch["keys"], r)) for r in sch["datas"]] if isinstance(sch, dict) else sch
        s = sch[0]
        ht = [[a["voteCount"] for a in h["awayVoteStatusList"]] for h in d["voteStatusPlay1"]["homeVoteStatusList"]]
        ft = [[a["voteCount"] for a in h["awayVoteStatusList"]] for h in d["voteStatusPlay2"]["homeVoteStatusList"]]
        allot = [[a["allot"] for a in h["awayVoteStatusList"]] for h in d["voteStatusPlay2"]["homeVoteStatusList"]]
        out.append({
            "회차": g["gmOsidTs"], "마감": dt.datetime.fromtimestamp(g["saleEndDate"] / 1000, KST),
            "판매액": g["totalSellAmount"], "홈": s["homeName"], "원정": s["awayName"], "리그": s["leagueName"],
            "시각": dt.datetime.fromtimestamp(s["gameDate"] / 1000, dt.timezone.utc),
            "ht_votes": ht, "ft_votes": ft, "allot": allot, "pool": d["maxMinAllot"]["maxAllot"],
        })
    return out


# ---------------------------------------------------------------- Pinnacle
def pin_markets(game, names):
    hdr = [f"X-API-Key: {o.PIN_KEY}", "Accept: application/json"]
    mt = o.curl("https://guest.api.arcadia.pinnacle.com/0.1/sports/29/matchups?withSpecials=false", hdr)
    cands = []
    for t in mt:
        if t.get("type") != "matchup" or t.get("parentId"):
            continue
        st = dt.datetime.fromisoformat(t["startTime"].replace("Z", "+00:00"))
        if abs((st - game["시각"]).total_seconds()) > 1200:
            continue
        home = next((p["name"] for p in t["participants"] if p.get("alignment") == "home"), t["participants"][0]["name"])
        away = next((p["name"] for p in t["participants"] if p.get("alignment") == "away"), t["participants"][-1]["name"])
        h, a = o.name_hit(names, o.clean_ko(game["홈"]), home), o.name_hit(names, o.clean_ko(game["원정"]), away)
        if h and a:
            cands.append((t["id"], home, away))
    if len(cands) != 1:
        return None
    mid, home, away = cands[0]
    mk = o.curl(f"https://guest.api.arcadia.pinnacle.com/0.1/matchups/{mid}/markets/related/straight", hdr)
    res = {"name": f"{home} vs {away}", 0: {"ml": None, "tot": []}, 1: {"ml": None, "tot": []}}
    for m in mk:
        if m.get("matchupId") != mid or m.get("status") != "open" or m.get("period") not in (0, 1):
            continue
        pr = {p["designation"]: o.american_to_decimal(p["price"]) for p in m["prices"]}
        if m["type"] == "moneyline" and all(k in pr for k in ("home", "draw", "away")):
            res[m["period"]]["ml"] = pr
        elif m["type"] == "total" and "over" in pr and "under" in pr:
            line = m["prices"][0].get("points")
            q = [1 / pr["over"], 1 / pr["under"]]
            res[m["period"]]["tot"].append((line, q[0] / sum(q)))
    return res


# ---------------------------------------------------------------- 모델
def score_matrix(lh, la, n=12, rho=RHO):
    m = [[pois(i, lh) * pois(j, la) * tau(i, j, lh, la, rho) for j in range(n)] for i in range(n)]
    s = sum(map(sum, m))
    return [[v / s for v in row] for row in m]


def summarize(m):
    w = sum(m[i][j] for i in range(len(m)) for j in range(len(m)) if i > j)
    d = sum(m[i][i] for i in range(len(m)))
    return w, d, 1 - w - d


def p_over(m, line):
    return sum(m[i][j] for i in range(len(m)) for j in range(len(m)) if i + j > line)


def fit(ml, tots, lo=0.1, hi=4.0, step=0.05):
    """승무패(Shin) + 언더오버 라인들에 가장 잘 맞는 (λ홈, λ원정)."""
    pr, _ = o.shin([1 / ml["home"], 1 / ml["draw"], 1 / ml["away"]])
    best = None
    k = int((hi - lo) / step) + 1
    for i in range(k):
        for j in range(k):
            lh, la = lo + i * step, lo + j * step
            m = score_matrix(lh, la)
            w, d, l = summarize(m)
            e = (w - pr[0]) ** 2 + (l - pr[2]) ** 2 + sum((p_over(m, ln) - po) ** 2 for ln, po in tots) / max(1, len(tots))
            if best is None or e < best[0]:
                best = (e, lh, la)
    return best[1], best[2], pr


def bucket(m):
    """12x12 → 6x6 (5+ 합산)."""
    b = [[0.0] * N for _ in range(N)]
    for i in range(len(m)):
        for j in range(len(m)):
            b[min(i, 5)][min(j, 5)] += m[i][j]
    return b


def joint(lh1, la1, lh2, la2):
    """P(전반=(a,b), 최종=(c,d)) 6x6x6x6."""
    m1 = score_matrix(lh1, la1)
    m2 = score_matrix(lh2, la2, rho=0.0)  # 후반은 보정 없이
    J = {}
    for a in range(12):
        for b in range(12):
            p1 = m1[a][b]
            if p1 < 1e-9:
                continue
            for x in range(12):
                for y in range(12):
                    p = p1 * m2[x][y]
                    if p < 1e-9:
                        continue
                    key = (min(a, 5), min(b, 5), min(a + x, 5), min(b + y, 5))
                    J[key] = J.get(key, 0.0) + p
    return J


# ---------------------------------------------------------------- 메인
def scan(a):
    cookie = os.path.join(ROOT, "data", ".betman_cookie")
    games = betman(cookie)
    if not games:
        print("판매 중인 축구토토 매치 회차가 없습니다.")
        return
    names = o.load_names()
    rows_all = []
    for g in games:
        print(f"\n### 축구토토 매치 {g['회차']}회  {g['홈']} vs {g['원정']} ({g['리그']})  "
              f"경기 {g['시각'].astimezone(KST):%m-%d %H:%M}  마감 {g['마감']:%m-%d %H:%M}  판매액 {g['판매액']:,}원")
        pm = pin_markets(g, names)
        if not pm or not pm[0]["ml"]:
            print("  Pinnacle 매칭 실패. data/team_names.json 확인.")
            continue
        lh, la, pr = fit(pm[0]["ml"], pm[0]["tot"])
        if pm[1]["ml"]:
            lh1, la1, pr1 = fit(pm[1]["ml"], pm[1]["tot"], hi=2.5)
        else:
            lh1, la1, pr1 = lh * 0.45, la * 0.45, None
        lh2, la2 = max(lh - lh1, 0.05), max(la - la1, 0.05)
        print(f"  Pinnacle {pm['name']}: 최종 승무패(Shin) {pr[0]*100:.1f}/{pr[1]*100:.1f}/{pr[2]*100:.1f}, "
              f"λ최종 {lh:.2f}/{la:.2f}, λ전반 {lh1:.2f}/{la1:.2f}, λ후반 {lh2:.2f}/{la2:.2f}")
        J = joint(lh1, la1, lh2, la2)
        ht_tot = sum(map(sum, g["ht_votes"])) or 1
        ft_tot = sum(map(sum, g["ft_votes"])) or 1
        ht_share = [[v / ht_tot for v in row] for row in g["ht_votes"]]
        ft_share = [[v / ft_tot for v in row] for row in g["ft_votes"]]
        floor_share = 1.0 / ft_tot  # 표 1장
        # 최종 스코어별: 모순 없는 전반칸(전반 ≤ 최종, 5+는 상한 없음)으로 전반 점유율 정규화
        cond = {}
        for c_ in range(N):
            for d_ in range(N):
                ok = [(a_, b_) for a_ in range(N) for b_ in range(N)
                      if (c_ == 5 or a_ <= c_) and (d_ == 5 or b_ <= d_)]
                tot = sum(ht_share[a_][b_] for a_, b_ in ok)
                cond[(c_, d_)] = {k: (ht_share[k[0]][k[1]] / tot if tot > 0 else 1 / len(ok)) for k in ok}
        # 모델도 같은 조건부로 (전반 후보 추천용)
        ft_model = {}
        for (a_, b_, c_, d_), p in J.items():
            ft_model[(c_, d_)] = ft_model.get((c_, d_), 0.0) + p
        rows = []
        for (a_, b_, c_, d_), p in J.items():
            if (a_, b_) not in cond[(c_, d_)]:
                continue  # 모델상 불가능한 조합은 없지만 안전장치
            pub = max(ft_share[c_][d_] * cond[(c_, d_)][(a_, b_)], floor_share)
            odds = 0.5 / pub
            rows.append({"회차": g["회차"], "경기": f"{g['홈']} vs {g['원정']}", "전반": f"{a_}-{b_}", "최종": f"{c_}-{d_}",
                         "모델확률%": round(p * 100, 2), "대중점유%": round(pub * 100, 2),
                         "모델_전반|최종%": round(p / ft_model[(c_, d_)] * 100, 1), "대중_전반|최종%": round(cond[(c_, d_)][(a_, b_)] * 100, 1),
                         "예상배당": round(odds, 1), "베트맨표시": round(g["allot"][c_][d_], 1),
                         "기대값_추정": round(p * odds, 3)})
        rows.sort(key=lambda r: -r["기대값_추정"])
        rows_all += rows
        # 최종 스코어 6x6 요약 + 최종칸 기대값
        print("\n  최종 스코어: 모델 확률% / 대중 투표% / 기대값(0.5×모델/대중)   (행=홈 득점, 열=원정 득점)")
        print("        " + "".join(f"{(j if j < 5 else '5+'):>17}" for j in range(N)))
        for i in range(N):
            cells = ""
            for j in range(N):
                pm_, pu_ = ft_model[(i, j)], max(ft_share[i][j], floor_share)
                cells += f"{pm_*100:5.1f}/{ft_share[i][j]*100:5.1f}/{0.5*pm_/pu_:4.1f}  "
            print(f"  {(i if i < 5 else '5+'):>3}  {cells}")
        cols = ["전반", "최종", "모델확률%", "대중점유%", "모델_전반|최종%", "대중_전반|최종%", "예상배당", "베트맨표시", "기대값_추정"]
        print(f"\n  칸별 상위 {a.top} (기대값 순, 모델확률 0.5% 이상만)")
        print("  " + " | ".join(f"{c:>10}" for c in cols))
        for r in [r for r in rows if r["모델확률%"] >= 0.5][:a.top]:
            print("  " + " | ".join(f"{str(r[c]):>10}" for c in cols))
        print(f"\n  확률 상위 10칸")
        for r in sorted(rows, key=lambda r: -r["모델확률%"])[:10]:
            print("  " + " | ".join(f"{str(r[c]):>10}" for c in cols))
        # 묶음 추천: 최종칸 기대값 1.0 이상인 스코어를 전반 후보로 덮기
        print("\n  묶음 안: 최종 스코어 하나를 전반 후보 여러 칸으로 덮을 때 (전반 확률 누적 80%까지)")
        packs = []
        for (c_, d_), pm_ in sorted(ft_model.items(), key=lambda kv: -kv[1]):
            pu_ = max(ft_share[c_][d_], floor_share)
            ev_ft = 0.5 * pm_ / pu_
            if ev_ft < 1.0 or pm_ < 0.01:
                continue
            hts = sorted([r for r in rows if r["최종"] == f"{c_}-{d_}"], key=lambda r: -r["모델확률%"])
            cum, chosen = 0.0, []
            for r in hts:
                chosen.append(r); cum += r["모델확률%"] / 100
                if cum >= pm_ * 0.8:
                    break
            cost = len(chosen) * 100
            ev_pack = sum(r["기대값_추정"] for r in chosen) / len(chosen)
            packs.append((ev_pack, c_, d_, pm_, pu_, ev_ft, chosen, cum, cost))
            print(f"  최종 {c_}-{d_}: 모델 {pm_*100:.1f}% vs 대중 {pu_*100:.1f}% (최종칸 기대값 {ev_ft:.2f}) → 전반 {len(chosen)}칸 "
                  f"[{', '.join(r['전반'] for r in chosen)}] 적중확률 {cum*100:.1f}%, 비용 {cost}원, 묶음 평균 기대값 {ev_pack:.2f}")
        n_plus = sum(1 for r in rows if r["기대값_추정"] >= 1.0 and r["모델확률%"] >= 0.5)
        print(f"\n  칸 {len(rows)}개 중 모델확률 0.5% 이상이면서 기대값 1.0 이상 {n_plus}개. 평균 기대값은 환급률대로 0.5다.")
    if a.save and rows_all:
        out = os.path.join(ROOT, "회차별분석", f"매치스캔_{dt.datetime.now(KST):%Y-%m-%d_%H%M}.csv")
        with open(out, "w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows_all[0].keys()))
            w.writeheader(); w.writerows(rows_all)
        print("저장:", out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--save", action="store_true")
    scan(ap.parse_args())


if __name__ == "__main__":
    main()
