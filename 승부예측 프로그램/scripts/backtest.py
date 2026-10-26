#!/usr/bin/env python3
"""
분석 기법 백테스트: football-data.co.uk 자료(5대 리그, 2019-20 ~ 2025-26)로
각 기법의 승/무/패 확률을 실제 결과와 비교해 순위를 매기고, 기법을 섞은 앙상블도 평가한다.

데이터 준비 (한 번만):
  mkdir -p data && cd data
  for s in 1920 2021 2122 2223 2324 2425 2526; do for l in E0 SP1 D1 I1 F1; do
    curl -sS -L -A "Mozilla/5.0" -o ${l}_${s}.csv https://www.football-data.co.uk/mmz4281/$s/$l.csv; done; done

사용법:
  python3 scripts/backtest.py [--data data] [--test 2425,2526] [--out 회차별분석/백테스트.md]

평가 지표
- RPS (낮을수록 좋음): 승-무-패 순서를 반영하는 표준 지표
- 로그손실, Brier
- 단일 적중률: 가장 높은 확률을 찍었을 때 맞는 비율
- 14경기 회차 시뮬레이션: 같은 주말 경기 14개를 한 회차로 묶어 단일 마킹 적중 수와
  combo_optimizer 방식(100조합)의 전체 적중률을 비교
"""
import argparse, glob, math, os, sys
from collections import defaultdict

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.stats import poisson

sys.path.insert(0, os.path.dirname(__file__))
from devig import shin, power, mult  # noqa: E402

OUT = ["H", "D", "A"]


# ---------------------------------------------------------------- 데이터
def load(data_dir):
    frames = []
    for f in sorted(glob.glob(os.path.join(data_dir, "*.csv"))):
        d = pd.read_csv(f, encoding="utf-8-sig")
        d["season"] = os.path.basename(f).split("_")[1][:4]
        frames.append(d)
    d = pd.concat(frames, ignore_index=True)
    d["Date"] = pd.to_datetime(d["Date"], dayfirst=True)
    d = d.dropna(subset=["FTHG", "FTAG", "FTR"]).sort_values(["Date", "Div"]).reset_index(drop=True)
    d["y"] = d["FTR"].map({"H": 0, "D": 1, "A": 2})
    return d


def devig_cols(d, cols, method="shin"):
    """배당 3열 → 확률 (n,3). 배당이 없으면 NaN."""
    out = np.full((len(d), 3), np.nan)
    for i, row in enumerate(d[cols].to_numpy()):
        if np.isnan(row).any() or (row <= 1).any():
            continue
        q = [1 / o for o in row]
        if method == "shin":
            out[i] = shin(q)[0]
        elif method == "power":
            out[i] = power(q)
        else:
            out[i] = mult(q)
    return out


# ---------------------------------------------------------------- 지표
def rps(p, y):
    c = np.cumsum(p, axis=1)
    o = np.cumsum(np.eye(3)[y], axis=1)
    return ((c - o) ** 2).sum(axis=1)[:, :2].sum(axis=1) / 2 if False else (((c - o) ** 2)[:, :2].sum(axis=1) / 2)


def metrics(p, y):
    p = np.clip(p, 1e-6, 1)
    p = p / p.sum(axis=1, keepdims=True)
    o = np.eye(3)[y]
    return {
        "RPS": float(rps(p, y).mean()),
        "로그손실": float(-np.log(p[np.arange(len(y)), y]).mean()),
        "Brier": float(((p - o) ** 2).sum(axis=1).mean()),
        "단일적중": float((p.argmax(axis=1) == y).mean()),
        "n": int(len(y)),
    }


# ---------------------------------------------------------------- 1) Dixon-Coles (시간 가중, 득점 기반)
def dc_tau(x, y, lam, mu, rho):
    t = np.ones_like(lam)
    t = np.where((x == 0) & (y == 0), 1 - lam * mu * rho, t)
    t = np.where((x == 0) & (y == 1), 1 + lam * rho, t)
    t = np.where((x == 1) & (y == 0), 1 + mu * rho, t)
    t = np.where((x == 1) & (y == 1), 1 - rho, t)
    return np.maximum(t, 1e-9)


def dc_fit(hist, teams, xi, rho, x0=None, reg=0.5):
    idx = {t: i for i, t in enumerate(teams)}
    n = len(teams)
    hi = hist["HomeTeam"].map(idx).to_numpy()
    ai = hist["AwayTeam"].map(idx).to_numpy()
    hg = hist["FTHG"].to_numpy(float)
    ag = hist["FTAG"].to_numpy(float)
    w = np.exp(-xi * hist["days_ago"].to_numpy(float))

    def nll(th):
        a, dfc, h = th[:n], th[n:2 * n], th[2 * n]
        lam = np.exp(a[hi] + dfc[ai] + h)
        mu = np.exp(a[ai] + dfc[hi])
        ll = (poisson.logpmf(hg, lam) + poisson.logpmf(ag, mu) + np.log(dc_tau(hg, ag, lam, mu, rho))) * w
        # 표본이 적은 팀(승격팀)은 리그 평균(0) 쪽으로 당긴다
        return -ll.sum() + reg * (a @ a + dfc @ dfc) + 1e4 * a.sum() ** 2
    if x0 is None:
        x0 = np.zeros(2 * n + 1); x0[-1] = 0.25
    r = minimize(nll, x0, method="L-BFGS-B", options={"maxiter": 200})
    return r.x


def dc_predict(th, teams, home, away, rho, nmax=10):
    idx = {t: i for i, t in enumerate(teams)}
    n = len(teams)
    a, dfc, h = th[:n], th[n:2 * n], th[2 * n]
    lam = math.exp(a[idx[home]] + dfc[idx[away]] + h)
    mu = math.exp(a[idx[away]] + dfc[idx[home]])
    x = np.arange(nmax)
    ph, pa = poisson.pmf(x, lam), poisson.pmf(x, mu)
    m = np.outer(ph, pa)
    X, Y = np.meshgrid(x, x, indexing="ij")
    m = m * dc_tau(X, Y, np.full_like(m, lam), np.full_like(m, mu), rho)
    m /= m.sum()
    return np.array([np.tril(m, -1).sum(), np.trace(m), np.triu(m, 1).sum()]), lam, mu


def run_dc(d, xi=0.00325, rho=-0.13, refit_days=10, label="DC"):
    """리그별로 refit_days마다 과거 자료로 다시 적합해 다음 경기들을 예측한다."""
    pred = np.full((len(d), 3), np.nan)
    lam_arr = np.full(len(d), np.nan)
    for div, g in d.groupby("Div"):
        g = g.sort_values("Date")
        dates = g["Date"].to_numpy()
        th, teams = None, None
        next_fit = None
        for i, (ridx, row) in enumerate(g.iterrows()):
            date = row["Date"]
            if next_fit is None or date >= next_fit:
                hist = g[g["Date"] < date]
                if len(hist) < 150:
                    next_fit = date + pd.Timedelta(days=refit_days)
                    continue
                hist = hist.assign(days_ago=(date - hist["Date"]).dt.days)
                new_teams = sorted(set(hist["HomeTeam"]) | set(hist["AwayTeam"]) | set(g.loc[g["Date"] >= date, "HomeTeam"].head(40)) | set(g.loc[g["Date"] >= date, "AwayTeam"].head(40)))
                x0 = None
                if th is not None:
                    old = {t: (th[k], th[len(teams) + k]) for k, t in enumerate(teams)}
                    x0 = np.zeros(2 * len(new_teams) + 1); x0[-1] = th[-1]
                    for k, t in enumerate(new_teams):
                        if t in old:
                            x0[k], x0[len(new_teams) + k] = old[t]
                teams = new_teams
                th = dc_fit(hist, teams, xi, rho, x0)
                next_fit = date + pd.Timedelta(days=refit_days)
            if th is None or row["HomeTeam"] not in teams or row["AwayTeam"] not in teams:
                continue
            p, lam, mu = dc_predict(th, teams, row["HomeTeam"], row["AwayTeam"], rho)
            pred[ridx] = p
            lam_arr[ridx] = lam + mu
    return pred, lam_arr


# ---------------------------------------------------------------- 2) Elo, 3) pi-rating → 순서형 로짓
def run_elo(d, k=20, ha=60, margin=True):
    r = defaultdict(lambda: 1500.0)
    diff = np.full(len(d), np.nan)
    for i, row in d.iterrows():
        h, a = row["HomeTeam"], row["AwayTeam"]
        dr = r[h] + ha - r[a]
        diff[i] = dr
        e = 1 / (1 + 10 ** (-dr / 400))
        s = {"H": 1, "D": 0.5, "A": 0}[row["FTR"]]
        gd = abs(row["FTHG"] - row["FTAG"])
        mult_ = math.log(gd + 1) + 1 if margin else 1
        delta = k * mult_ * (s - e)
        r[h] += delta; r[a] -= delta
    return diff


def run_pi(d, lam=0.07, gamma=0.7, c=3.0):  # lam 0.035→0.07: EPL 2019-26 RPS 0.2068→0.2047 (scripts/tune.py)
    rh, ra = defaultdict(float), defaultdict(float)  # 홈 레이팅, 원정 레이팅
    diff = np.full(len(d), np.nan)
    for i, row in d.iterrows():
        h, a = row["HomeTeam"], row["AwayTeam"]
        pred = rh[h] - ra[a]
        diff[i] = pred
        obs = row["FTHG"] - row["FTAG"]
        e = abs(obs - pred)
        psi = c * math.log10(1 + e)
        sgn = 1 if obs > pred else -1
        dh = psi * sgn * lam
        rh[h] += dh; ra[h] += dh * gamma
        ra[a] -= dh; rh[a] -= dh * gamma
    return diff


def ordinal_fit(x, y):
    """레이팅 차이 → 승/무/패 확률. 절단점 2개 + 기울기를 MLE로 추정."""
    def probs(th, x):
        s, c1, c2 = th[0], th[1], th[1] + math.exp(th[2])
        pa = 1 / (1 + np.exp((x - c1) * s))          # 원정승: 낮은 쪽
        pha = 1 / (1 + np.exp((x - c2) * s))         # 원정승+무
        return np.stack([1 - pha, pha - pa, pa], axis=1)

    mu, sd = x.mean(), x.std() + 1e-9
    xs = (x - mu) / sd

    def nll(th):
        p = np.clip(probs(th, xs), 1e-9, 1)
        return -np.log(p[np.arange(len(y)), y]).sum()
    r = minimize(nll, [1.0, -0.5, 0.0], method="Nelder-Mead", options={"maxiter": 4000})
    return lambda xx: probs(r.x, (xx - mu) / sd)


# ---------------------------------------------------------------- 4) 최근 폼 (단순 승점 기반)
def run_form(d, n=5):
    hist = defaultdict(list)
    feat = np.full(len(d), np.nan)
    for i, row in d.iterrows():
        h, a = row["HomeTeam"], row["AwayTeam"]
        fh, fa = hist[h][-n:], hist[a][-n:]
        if len(fh) >= 3 and len(fa) >= 3:
            feat[i] = np.mean(fh) - np.mean(fa)
        ph = {"H": (3, 0), "D": (1, 1), "A": (0, 3)}[row["FTR"]]
        hist[h].append(ph[0]); hist[a].append(ph[1])
    return feat


# ---------------------------------------------------------------- 블렌딩 / 앙상블
def blend(pm, pk, w, mode):
    if mode == "log":
        f = pm ** w * pk ** (1 - w)
    else:
        f = w * pm + (1 - w) * pk
    return f / f.sum(axis=1, keepdims=True)


def stack_fit(P_list, y):
    """여러 기법의 로그 확률을 특징으로 하는 다항 로지스틱 회귀 (스태킹)."""
    from sklearn.linear_model import LogisticRegression
    feat = lambda Ps: np.hstack([np.log(np.clip(np.nan_to_num(p, nan=1 / 3), 1e-6, 1)) for p in Ps])
    m = LogisticRegression(C=1.0, max_iter=2000)
    m.fit(feat(P_list), y)
    return lambda Ps: m.predict_proba(feat(Ps)), m


# ---------------------------------------------------------------- 회차 시뮬레이션
def greedy_levels(p, max_c=100, th2=1.4, th3=1.25):
    rank = np.argsort(-p, axis=1)
    cum = np.take_along_axis(p, rank, axis=1).cumsum(axis=1)
    levels = [1] * len(p)
    while True:
        best = None
        for i in range(len(p)):
            k = levels[i]
            if k == 3:
                continue
            mult_ = cum[i, k] / cum[i, k - 1]
            cost = (k + 1) / k
            if mult_ < (th2 if k == 1 else th3) or math.prod(levels) * cost > max_c:
                continue
            eff = math.log(mult_) / math.log(cost)
            if best is None or eff > best[0]:
                best = (eff, i)
        if best is None:
            return levels, rank
        levels[best[1]] += 1


def dp_levels(p, max_c=100):
    rank = np.argsort(-p, axis=1)
    cum = np.take_along_axis(p, rank, axis=1).cumsum(axis=1)
    states = {1: (1.0, ())}
    for i in range(len(p)):
        nxt = {}
        for c, (pr, lv) in states.items():
            for k in (1, 2, 3):
                if c * k > max_c:
                    break
                q = pr * cum[i, k - 1]
                if q > nxt.get(c * k, (0,))[0]:
                    nxt[c * k] = (q, lv + (k,))
        states = nxt
    return list(max(states.values())[1]), rank


def simulate_rounds(d, preds, n_games=14, seed=0, per_week=20):
    """같은 주말(금~월) 경기 중 14개를 무작위로 뽑아 회차로 만든다 (주말마다 per_week번)."""
    rng = np.random.default_rng(seed)
    d = d.copy()
    d["wk"] = (d["Date"] - pd.Timedelta(days=4)).dt.to_period("W")
    rounds = []
    for _, g in d.groupby("wk"):
        idx = g.index.to_numpy()
        if len(idx) < n_games:
            continue
        for _ in range(per_week):
            rounds.append(rng.choice(idx, n_games, replace=False))
    res = {}
    for name, p in preds.items():
        single_hits, box_full, box13, dp_full = [], [], [], []
        for idx in rounds:
            pp, y = p[idx], d.loc[idx, "y"].to_numpy()
            single_hits.append((pp.argmax(axis=1) == y).sum())
            lv, rank = greedy_levels(pp)
            miss = sum(0 if y[i] in rank[i, :lv[i]] else 1 for i in range(n_games))
            box_full.append(miss == 0); box13.append(miss <= 1)
            lv, rank = dp_levels(pp)
            dp_full.append(all(y[i] in rank[i, :lv[i]] for i in range(n_games)))
        res[name] = {
            "회차": len(rounds),
            "단일 평균적중": float(np.mean(single_hits)),
            "단일 14/14": float(np.mean(np.array(single_hits) == 14)),
            "단일 13+": float(np.mean(np.array(single_hits) >= 13)),
            "효율조합 14/14": float(np.mean(box_full)),
            "효율조합 13+": float(np.mean(box13)),
            "100조합 14/14": float(np.mean(dp_full)),
        }
    return res


def md(df, index=False, fmt="{:.4f}"):
    cols = ([df.index.name or ""] if index else []) + list(df.columns)
    lines = ["| " + " | ".join(str(c) for c in cols) + " |", "|" + "---|" * len(cols)]
    for i, row in df.iterrows():
        vals = ([str(i)] if index else []) + [fmt.format(v) if isinstance(v, float) else str(v) for v in row]
        lines.append("| " + " | ".join(vals) + " |")
    return "\n".join(lines)


# ---------------------------------------------------------------- 메인
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "..", "data"))
    ap.add_argument("--test", default="2425,2526", help="평가 시즌 (스태킹은 그 이전 두 시즌으로 학습)")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    test_seasons = a.test.split(",")
    seasons = sorted(set(pd.Series([os.path.basename(f).split("_")[1][:4] for f in glob.glob(os.path.join(a.data, "*.csv"))])))
    stack_seasons = [s for s in seasons if s < test_seasons[0]][1:]  # 첫 시즌은 모델 워밍업

    d = load(a.data)
    print(f"경기 {len(d)}  시즌 {seasons}  평가 {test_seasons}  스태킹 학습 {stack_seasons}")

    # 시장
    P = {}
    P["시장 마감 (Shin)"] = devig_cols(d, ["PSCH", "PSCD", "PSCA"], "shin")
    P["시장 마감 (power)"] = devig_cols(d, ["PSCH", "PSCD", "PSCA"], "power")
    P["시장 마감 (단순 나눔)"] = devig_cols(d, ["PSCH", "PSCD", "PSCA"], "mult")
    P["시장 오픈 (Shin)"] = devig_cols(d, ["PSH", "PSD", "PSA"], "shin")
    P["시장 평균배당 (Shin)"] = devig_cols(d, ["AvgCH", "AvgCD", "AvgCA"], "shin") if "AvgCH" in d else devig_cols(d, ["AvgH", "AvgD", "AvgA"], "shin")

    # 모델
    cache = os.path.join(a.data, "dc_cache.npz")
    if os.path.exists(cache) and np.load(cache)["n"] == len(d):
        z = np.load(cache)
        P["Dixon-Coles (rho -0.13)"], lam_sum, P["포아송 (rho 0)"] = z["dc"], z["lam"], z["pois"]
    else:
        print("Dixon-Coles 적합 중 (몇 분 걸림) …", flush=True)
        P["Dixon-Coles (rho -0.13)"], lam_sum = run_dc(d, rho=-0.13)
        print("포아송(rho 0) 적합 중 …", flush=True)
        P["포아송 (rho 0)"], _ = run_dc(d, rho=0.0)
        np.savez(cache, dc=P["Dixon-Coles (rho -0.13)"], lam=lam_sum, pois=P["포아송 (rho 0)"], n=len(d))

    is_train = d["season"].isin(stack_seasons).to_numpy()
    is_test = d["season"].isin(test_seasons).to_numpy()
    y = d["y"].to_numpy()

    elo = run_elo(d)
    pi = run_pi(d)
    form = run_form(d)
    fit_mask = d["season"].isin([s for s in seasons if s < test_seasons[0]]).to_numpy()
    for name, x in [("Elo (득점차 가중)", elo), ("pi-rating", pi), ("최근 5경기 승점", form)]:
        ok = ~np.isnan(x)
        f = ordinal_fit(x[ok & fit_mask], y[ok & fit_mask])
        p = np.full((len(d), 3), np.nan); p[ok] = f(x[ok])
        P[name] = p
    base = np.full((len(d), 3), np.nan)
    for div, g in d.groupby("Div"):
        m = (d["Div"] == div).to_numpy() & fit_mask
        base[(d["Div"] == div).to_numpy()] = np.bincount(y[m], minlength=3) / m.sum()
    P["리그 평균 비율 (기준선)"] = base

    # 블렌딩
    pm, pk = P["시장 마감 (Shin)"], P["Dixon-Coles (rho -0.13)"]
    for w in (0.5, 0.7, 0.85, 0.95):
        for mode in ("linear", "log"):
            P[f"시장{int(w*100)}+DC {'로그' if mode == 'log' else '선형'}"] = blend(pm, pk, w, mode)

    # 실전 상황: 경기 하루 전에는 마감 배당이 없다 → 오픈 배당 + 모델 조합도 평가
    po = P["시장 오픈 (Shin)"]
    for w in (0.7, 0.85, 0.95):
        P[f"오픈{int(w*100)}+DC 선형"] = blend(po, pk, w, "linear")

    # 무승부 체크리스트 규칙 (분석방법론 1-3): 조건 3개 이상이면 무 +3%p
    pu = d["P<2.5"].to_numpy(float) if "P<2.5" in d else np.full(len(d), np.nan)
    cond = (
        (lam_sum < 2.2).astype(int)
        + ((d["PSCH"] > 2.2) & (d["PSCA"] > 2.2)).to_numpy().astype(int)
        + ((d["PSCD"] >= 3.0) & (d["PSCD"] <= 3.5)).to_numpy().astype(int)
        + (pu < 1.8).astype(int)
    )
    rule = pm.copy()
    hit3 = cond >= 3
    rule[hit3, 1] += 0.03
    rule[hit3] /= rule[hit3].sum(axis=1, keepdims=True)
    P["시장 마감 + 무승부 규칙(+3%p)"] = rule

    # 스태킹 앙상블
    comps = ["시장 마감 (Shin)", "Dixon-Coles (rho -0.13)", "Elo (득점차 가중)", "pi-rating"]
    ok = np.all([~np.isnan(P[c]).any(axis=1) for c in comps], axis=0)
    f, model = stack_fit([P[c][ok & is_train] for c in comps], y[ok & is_train])
    p = np.full((len(d), 3), np.nan); p[ok] = f([P[c][ok] for c in comps])
    P["스태킹 (시장+DC+Elo+pi)"] = p
    comps3 = ["시장 마감 (Shin)", "Dixon-Coles (rho -0.13)"]
    ok3 = np.all([~np.isnan(P[c]).any(axis=1) for c in comps3], axis=0)
    f3, _ = stack_fit([P[c][ok3 & is_train] for c in comps3], y[ok3 & is_train])
    p = np.full((len(d), 3), np.nan); p[ok3] = f3([P[c][ok3] for c in comps3])
    P["스태킹 (시장+DC)"] = p
    comps4 = ["시장 오픈 (Shin)", "Dixon-Coles (rho -0.13)", "Elo (득점차 가중)", "pi-rating"]
    ok4 = np.all([~np.isnan(P[c]).any(axis=1) for c in comps4], axis=0)
    f4, _ = stack_fit([P[c][ok4 & is_train] for c in comps4], y[ok4 & is_train])
    p = np.full((len(d), 3), np.nan); p[ok4] = f4([P[c][ok4] for c in comps4])
    P["스태킹 (오픈+DC+Elo+pi)"] = p
    comps2 = ["Dixon-Coles (rho -0.13)", "Elo (득점차 가중)", "pi-rating", "최근 5경기 승점"]
    ok2 = np.all([~np.isnan(P[c]).any(axis=1) for c in comps2], axis=0)
    f2, _ = stack_fit([P[c][ok2 & is_train] for c in comps2], y[ok2 & is_train])
    p = np.full((len(d), 3), np.nan); p[ok2] = f2([P[c][ok2] for c in comps2])
    P["스태킹 (시장 제외: DC+Elo+pi+폼)"] = p

    # 공통 평가 집합: 모든 기법이 값을 가진 평가 시즌 경기
    common = is_test & np.all([~np.isnan(P[k]).any(axis=1) for k in P], axis=0)
    rows = []
    ref = rps(np.clip(pm[common], 1e-6, 1) / np.clip(pm[common], 1e-6, 1).sum(axis=1, keepdims=True), y[common])
    for k, p in P.items():
        m = metrics(p[common], y[common]); m["기법"] = k
        pp = np.clip(p[common], 1e-6, 1); pp /= pp.sum(axis=1, keepdims=True)
        diff = rps(pp, y[common]) - ref
        m["시장대비"] = float(diff.mean())
        m["z"] = float(diff.mean() / (diff.std(ddof=1) / math.sqrt(len(diff)) + 1e-12))
        rows.append(m)
    tab = pd.DataFrame(rows).sort_values("RPS")[["기법", "RPS", "로그손실", "Brier", "단일적중", "시장대비", "z", "n"]]

    # 회차 시뮬레이션
    sim = simulate_rounds(d[common], {k: P[k] for k in P})
    simtab = pd.DataFrame(sim).T.sort_values("단일 평균적중", ascending=False)

    # 마감 vs 오픈 승자 비율, 정배당-역배당 편향, 무승부 규칙 검증
    fl = []
    pmk = pm[common]; yy = y[common]
    for lo, hi in [(0, .2), (.2, .3), (.3, .4), (.4, .5), (.5, .6), (.6, .7), (.7, 1.01)]:
        m = (pmk >= lo) & (pmk < hi)
        fl.append((f"{lo:.0%}~{hi:.0%}", float(pmk[m].mean()), float(np.eye(3)[yy][m].mean()), int(m.sum())))
    dr = []
    for c_ in range(5):
        m = common & (cond == c_)
        if m.sum():
            dr.append((c_, int(m.sum()), float(pm[m, 1].mean()), float((y[m] == 1).mean())))

    lines = ["# 백테스트 결과", "",
             f"자료: football-data.co.uk 5대 리그, 시즌 {', '.join(seasons)}. 평가 시즌 {', '.join(test_seasons)} ({int(common.sum())}경기). 스태킹 학습 시즌 {', '.join(stack_seasons)}.",
             "", "## 기법별 순위 (RPS 낮을수록 좋음)", "",
             "시장대비 = 평균 RPS 차이(음수면 시장 마감 Shin보다 좋음), z = 짝지은 t값(|z|<2면 우연 범위)", "", md(tab), "",
             "## 14경기 회차 시뮬레이션 (같은 주말 경기 14개 무작위 × 주말당 20회, 조합 상한 100)", "",
             md(simtab, index=True, fmt="{:.3f}"), "",
             "## 시장 확률 구간별 실제 발생률 (정배당-역배당 편향 확인)", "", "| 구간 | 시장 평균 | 실제 | 표본 |", "|---|---|---|---|",
             *[f"| {a_} | {b:.1%} | {c:.1%} | {n} |" for a_, b, c, n in fl], "",
             "## 무승부 체크리스트 조건 수별 실제 무승부율", "", "| 조건 수 | 표본 | 시장 무 확률 | 실제 무승부율 |", "|---|---|---|---|",
             *[f"| {c_} | {n} | {mp:.1%} | {ar:.1%} |" for c_, n, mp, ar in dr], "",
             "## 스태킹 계수 (로그확률 → 승/무/패)", "",
             "특징 순서: " + ", ".join(f"{c}(H,D,A)" for c in comps), "", "```", np.array2string(model.coef_, precision=2, suppress_small=True), "```"]
    text = "\n".join(lines)
    print(text)
    if a.out:
        open(a.out, "w", encoding="utf-8").write(text + "\n")
        print(f"\n→ {a.out} 저장")


if __name__ == "__main__":
    main()
