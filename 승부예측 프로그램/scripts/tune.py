#!/usr/bin/env python3
"""
상수 점검(튜닝) 백테스트: EPL 2012-13 ~ 2025-26 (배당·아시안핸디캡 포함)으로
1) 고확률 선택(조합에 쓰는 60%+)이 실제로 그만큼 맞는지, 마진 제거 방식별로
2) Elo·pi-rating·Dixon-Coles 상수를 바꿔 가며 RPS 비교
3) 시장 배당(승무패+언더오버)으로 기대득점을 역산한 포아송 모델이 핸디캡 확률을 맞히는지
를 확인한다. 결과는 회차별분석/상수점검_YYYY-MM-DD.md 로 저장.

자료 (football-data.co.uk 는 국내 통신사가 차단 → GitHub 미러 사용):
  curl -L -o data/epl_odds.csv    https://raw.githubusercontent.com/AnishKhetani/premier-league-data/HEAD/data/processed/results_with_odds.csv
  curl -L -o data/epl_results.csv https://raw.githubusercontent.com/AnishKhetani/premier-league-data/HEAD/data/processed/results.csv

사용법:
  python3 scripts/tune.py               # 전부 (DC 격자는 몇 분)
  python3 scripts/tune.py --skip-dc     # DC 격자 생략
"""
import argparse, datetime as dt, math, os, sys

import numpy as np
import pandas as pd
from scipy.optimize import minimize

sys.path.insert(0, os.path.dirname(__file__))
from devig import shin, power, mult  # noqa: E402
import backtest as bt  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
DATA = os.path.join(ROOT, "data")


# ---------------------------------------------------------------- 자료
def load_epl():
    o = pd.read_csv(os.path.join(DATA, "epl_odds.csv"), low_memory=False)
    r = pd.read_csv(os.path.join(DATA, "epl_results.csv"))
    d = r[["match_id", "fthg", "ftag", "ftr"]].merge(o, on="match_id")
    d = d[d["season"] >= "2012-13"].dropna(subset=["fthg", "ftag", "ftr"]).copy()
    d["Date"] = pd.to_datetime(d["date"])
    d = d.sort_values("Date").reset_index(drop=True)
    d = d.rename(columns={"home_team": "HomeTeam", "away_team": "AwayTeam", "fthg": "FTHG", "ftag": "FTAG", "ftr": "FTR"})
    d["Div"] = "E0"
    d["y"] = d["FTR"].map({"H": 0, "D": 1, "A": 2})
    # 마감 배당: Pinnacle, 없으면(2025-26 후반) 시장 평균
    for k, side in (("H", "home"), ("D", "draw"), ("A", "away")):
        d[f"C{k}"] = d[f"pinnacle_1x2_{side}_close"].fillna(d[f"market_avg_1x2_{side}_close"])
    d["CO"] = d["pinnacle_over25_close"].fillna(d["market_avg_over25_close"])
    d["CU"] = d["pinnacle_under25_close"].fillna(d["market_avg_under25_close"])
    d["AHL"] = d["ah_line_close"]
    d["AHH"] = d["pinnacle_ah_home_close"].fillna(d["market_avg_ah_home_close"])
    d["AHA"] = d["pinnacle_ah_away_close"].fillna(d["market_avg_ah_away_close"])
    return d


def rps_mean(p, y):
    p = np.clip(p, 1e-6, 1); p = p / p.sum(axis=1, keepdims=True)
    return float(bt.rps(p, y).mean())


# ---------------------------------------------------------------- 1) 고확률 선택 보정
def favorite_check(d):
    rows, sel = [], []
    q = 1 / d[["CH", "CD", "CA"]].to_numpy(float)
    ok = ~np.isnan(q).any(axis=1)
    out = {}
    for name, fn in (("Shin", lambda x: shin(list(x))[0]), ("power", lambda x: power(list(x))), ("단순 나눔", lambda x: mult(list(x)))):
        p = np.full(q.shape, np.nan)
        p[ok] = np.array([fn(x) for x in q[ok]])
        out[name] = p
    y = d["y"].to_numpy()
    onehot = np.eye(3)[y]
    for name, p in out.items():
        m = ok
        ll = float(-np.log(np.clip(p[m][np.arange(m.sum()), y[m]], 1e-9, 1)).mean())
        rows.append((name, ll, rps_mean(p[m], y[m])))
    # 승·패 선택(무 제외)에서 공정확률 구간별 실제 적중률 — 조합에 넣는 '유력한 쪽'
    bins = [(.5, .6), (.6, .7), (.7, .8), (.8, .9), (.9, 1.01)]
    for name, p in out.items():
        for lo, hi in bins:
            pv, av = [], []
            for k in (0, 2):
                m = ok & (p[:, k] >= lo) & (p[:, k] < hi)
                pv.append(p[m, k]); av.append(onehot[m, k])
            pv, av = np.concatenate(pv), np.concatenate(av)
            if len(pv):
                se = math.sqrt(pv.mean() * (1 - pv.mean()) / len(pv))
                sel.append((name, f"{lo:.0%}~{min(hi, 1):.0%}", len(pv), pv.mean(), av.mean(), (av.mean() - pv.mean()) / se))
    return rows, sel


# ---------------------------------------------------------------- 2) 상수 격자
def ordinal_rps(x, y, fit_mask, test_mask):
    ok = ~np.isnan(x)
    f = bt.ordinal_fit(x[ok & fit_mask], y[ok & fit_mask])
    m = ok & test_mask
    return rps_mean(f(x[m]), y[m]), int(m.sum())


def grid_elo_pi(d, fit_mask, test_mask):
    y = d["y"].to_numpy()
    res = []
    for k in (10, 15, 20, 30, 40):
        for ha in (40, 60, 80, 100):
            for margin in (True, False):
                r, n = ordinal_rps(bt.run_elo(d, k=k, ha=ha, margin=margin), y, fit_mask, test_mask)
                res.append(("Elo", f"k={k} ha={ha} 득점차={'O' if margin else 'X'}", r, n))
    for lam in (0.02, 0.035, 0.05, 0.07, 0.1, 0.15):
        for gamma in (0.5, 0.7, 0.9):
            for c in (2.0, 3.0):
                r, n = ordinal_rps(bt.run_pi(d, lam=lam, gamma=gamma, c=c), y, fit_mask, test_mask)
                res.append(("pi", f"lam={lam} gamma={gamma} c={c}", r, n))
    return res


def grid_dc(d, test_mask):
    y = d["y"].to_numpy()
    res = []
    for xi in (0.0019, 0.00325, 0.0065):
        for rho in (0.0, -0.06, -0.13):
            p, _ = bt.run_dc(d, xi=xi, rho=rho, refit_days=14)
            m = test_mask & ~np.isnan(p).any(axis=1)
            res.append(("DC", f"xi={xi} rho={rho}", rps_mean(p[m], y[m]), int(m.sum())))
            print("  DC", xi, rho, res[-1][2], flush=True)
    return res


# ---------------------------------------------------------------- 3) 시장 역산 포아송 → 핸디캡
def score_matrix(lh, la, rho=-0.06, n=11):
    x = np.arange(n)
    from scipy.stats import poisson
    m = np.outer(poisson.pmf(x, lh), poisson.pmf(x, la))
    X, Y = np.meshgrid(x, x, indexing="ij")
    m = m * bt.dc_tau(X, Y, np.full_like(m, lh), np.full_like(m, la), rho)
    return m / m.sum(), X - Y


def implied_lambdas(ph, pd_, pa, pover, rho=-0.06):
    """승무패 + 2.5 오버 확률에 맞는 (홈 기대득점, 원정 기대득점)."""
    def loss(v):
        lh, la = np.exp(v)
        m, diff = score_matrix(lh, la, rho)
        tot = np.add.outer(np.arange(11), np.arange(11))
        p = [m[diff > 0].sum(), m[diff == 0].sum(), m[diff < 0].sum(), m[tot >= 3].sum()]
        t = [ph, pd_, pa, pover]
        return sum((a - b) ** 2 for a, b in zip(p, t))
    r = minimize(loss, [math.log(1.4), math.log(1.1)], method="Nelder-Mead", options={"xatol": 1e-4, "fatol": 1e-9})
    return np.exp(r.x)


def handicap_check(d, rho=-0.06):
    """반 라인(x.5) 아시안핸디캡 마감에서: 역산 포아송의 '홈 커버' 확률 vs 시장 AH 확률 vs 실제.
    추가로 유럽식 핸디 -1(2골 차 이상 승)의 역산 확률이 실제와 맞는지 본다."""
    m = d["AHL"].notna() & d["AHH"].notna() & d["CO"].notna() & d["CH"].notna()
    m &= (d["AHL"] * 2) % 2 == 1  # x.5 라인만 (적특 없음)
    rows = []
    for _, r in d[m].iterrows():
        ph, pd_, pa = shin([1 / r.CH, 1 / r.CD, 1 / r.CA])[0]
        po, _ = shin([1 / r.CO, 1 / r.CU])[0]
        lh, la = implied_lambdas(ph, pd_, pa, po, rho)
        mat, diff = score_matrix(lh, la, rho)
        L = r.AHL  # 홈 기준 라인
        p_model = mat[diff + L > 0].sum()
        p_mkt = shin([1 / r.AHH, 1 / r.AHA])[0][0]
        gd = r.FTHG - r.FTAG
        fav_home = ph >= pa
        p_e1 = mat[diff >= 2].sum() if fav_home else mat[diff <= -2].sum()  # 유력팀 2골 차 이상 승
        rows.append((p_model, p_mkt, float(gd + L > 0), p_e1, float(gd >= 2 if fav_home else gd <= -2), max(ph, pa)))
    a = np.array(rows)
    brier = lambda p, o: float(((p - o) ** 2).mean())
    out = {"n": len(a), "모델 Brier": brier(a[:, 0], a[:, 2]), "시장 AH Brier": brier(a[:, 1], a[:, 2]),
           "모델 평균": a[:, 0].mean(), "시장 평균": a[:, 1].mean(), "실제": a[:, 2].mean(),
           "모델-시장 평균 절대차": float(np.abs(a[:, 0] - a[:, 1]).mean())}
    e1 = []
    for lo, hi in ((.3, .45), (.45, .6), (.6, .75), (.75, 1)):
        mm = (a[:, 3] >= lo) & (a[:, 3] < hi)
        if mm.sum():
            e1.append((f"{lo:.0%}~{hi:.0%}", int(mm.sum()), a[mm, 3].mean(), a[mm, 4].mean()))
    return out, e1


# ---------------------------------------------------------------- 메인
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-dc", action="store_true")
    a = ap.parse_args()
    d = load_epl()
    seasons = sorted(d["season"].unique())
    fit_mask = (d["season"] < "2019-20").to_numpy()
    test_mask = (d["season"] >= "2019-20").to_numpy()
    print(f"EPL {len(d)}경기, 시즌 {seasons[0]}~{seasons[-1]}. 상수 학습 ~2018-19, 평가 2019-20~ ({test_mask.sum()}경기)")

    L = ["# 상수 점검 백테스트 (EPL)", "", f"작성 {dt.date.today()} · `scripts/tune.py` · 자료 EPL {seasons[0]}~{seasons[-1]} {len(d)}경기 (football-data.co.uk 미러)", ""]

    print("1) 고확률 선택 보정 …", flush=True)
    dv, sel = favorite_check(d)
    L += ["## 1. 마진 제거 방식과 고확률 선택의 실제 적중률", "", "| 방식 | 로그손실 | RPS |", "|---|---|---|",
          *[f"| {n} | {ll:.4f} | {r:.4f} |" for n, ll, r in dv], "",
          "승·패 선택(무 제외)을 공정확률 구간으로 나눠 실제 적중률과 비교. z = (실제-예상)/표준오차, |z|<2면 우연 범위.", "",
          "| 방식 | 구간 | 표본 | 예상 | 실제 | z |", "|---|---|---|---|---|---|",
          *[f"| {n} | {b} | {k} | {p:.1%} | {o:.1%} | {z:+.2f} |" for n, b, k, p, o, z in sel], ""]

    print("2) Elo·pi 격자 …", flush=True)
    g = grid_elo_pi(d, fit_mask, test_mask)
    if not a.skip_dc:
        print("   DC 격자 (몇 분) …", flush=True)
        g += grid_dc(d, test_mask)
    mkt = rps_mean(np.array([shin([1 / x for x in r])[0] for r in d.loc[test_mask, ["CH", "CD", "CA"]].to_numpy()]), d.loc[test_mask, "y"].to_numpy())
    gt = pd.DataFrame(g, columns=["모델", "상수", "RPS", "n"]).sort_values(["모델", "RPS"])
    L += ["## 2. 모델 상수 격자 (평가 2019-20~, RPS 낮을수록 좋음)", "", f"기준: 시장 마감(Shin) RPS {mkt:.4f}", ""]
    for mdl, gg in gt.groupby("모델"):
        cur = {"Elo": "k=20 ha=60 득점차=O", "pi": "lam=0.07 gamma=0.7 c=3.0", "DC": "xi=0.00325 rho=-0.13"}[mdl]
        L += [f"### {mdl} (현재 기본값: {cur})", "", "| 상수 | RPS | 시장 대비 |", "|---|---|---|",
              *[f"| {r.상수}{' ← 현재' if r.상수 == cur else ''} | {r.RPS:.4f} | {r.RPS - mkt:+.4f} |" for r in gg.head(6).itertuples()],
              *([f"| {cur} ← 현재 | {gg[gg.상수 == cur].RPS.iloc[0]:.4f} | {gg[gg.상수 == cur].RPS.iloc[0] - mkt:+.4f} |"] if cur not in list(gg.head(6).상수) and (gg.상수 == cur).any() else []), ""]

    print("3) 핸디캡 역산 모델 …", flush=True)
    for rho in (0.0, -0.06, -0.13):
        h, e1 = handicap_check(d[test_mask].reset_index(drop=True), rho)
        L += [f"## 3. 시장 역산 포아송 → 아시안핸디캡 x.5 라인 (rho={rho})", "",
              f"- 표본 {h['n']}경기 · 모델 Brier {h['모델 Brier']:.4f} vs 시장 AH Brier {h['시장 AH Brier']:.4f}",
              f"- 평균 확률: 모델 {h['모델 평균']:.1%} / 시장 {h['시장 평균']:.1%} / 실제 {h['실제']:.1%} · 모델-시장 평균 절대차 {h['모델-시장 평균 절대차']:.1%}p", "",
              "유력팀 '2골 차 이상 승'(유럽식 핸디 -1 승) 역산 확률 vs 실제:", "", "| 구간 | 표본 | 예상 | 실제 |", "|---|---|---|---|",
              *[f"| {b} | {n} | {p:.1%} | {o:.1%} |" for b, n, p, o in e1], ""]
    text = "\n".join(L)
    out = os.path.join(ROOT, "회차별분석", f"상수점검_{dt.date.today()}.md")
    open(out, "w", encoding="utf-8").write(text + "\n")
    print(text)
    print("저장:", out)


if __name__ == "__main__":
    main()
