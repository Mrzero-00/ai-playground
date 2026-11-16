"""ML 실험 (사전 등록: ML.md). 워크포워드로 2023~ 표본 외 예측을 만들고 앙상블과 비교한다.
먼저 python3 scripts/fetch_ml.py 로 데이터를 받는다.
사용법: python3 scripts/ml.py
"""
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from backtest import DATA, load, sma

warnings.filterwarnings("ignore")
ML = DATA / "ml"
MARKETS = {"KRW-BTC": "BTC", "KRW-ETH": "ETH"}
H = 5  # 정답 지평(일)
OOS = "2023-01-01"
COSTS = [0.001, 0.0025]
MODELS = {
    "L": lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=1000)),
    "G": lambda: HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=200, min_samples_leaf=50, random_state=0),
}
RULES = {
    "A 거르기": lambda ens, up: ens * up,
    "B 단독": lambda ens, up: up,
    "C 반반": lambda ens, up: (ens + up) / 2,
}


def binance(kind, sym, idx):
    df = pd.read_csv(ML / f"{kind}_{sym}.csv", parse_dates=["date"], index_col="date")
    return df.reindex(idx)


def funding(sym, idx):
    f = pd.read_csv(ML / f"funding_{sym}.csv", parse_dates=["time"])
    # D+1 00:00 UTC 펀딩까지 D 에 붙인다 → 1초 빼고 날짜를 자른다
    f["date"] = (f.time - pd.Timedelta(seconds=1)).dt.tz_localize(None).dt.normalize()
    return f.groupby("date").rate.sum().reindex(idx)


def features():
    up = {m: load(m) for m in MARKETS}
    fx = pd.read_csv(ML / "usdkrw.csv", parse_dates=["date"], index_col="date").krw
    frames = []
    for m, sym in MARKETS.items():
        d = up[m]
        idx = d.index
        c = d.close
        f = pd.DataFrame(index=idx)
        for n in (1, 5, 20, 60):
            f[f"r{n}"] = c.pct_change(n)
        f["vol20"] = c.pct_change().rolling(20).std()
        for n in (20, 50, 100, 200):
            f[f"d_sma{n}"] = c / c.rolling(n).mean() - 1
        f["ens"] = (sma(d, 20) + sma(d, 50) + sma(d, 100) + sma(d, 200)) / 4
        lv = np.log(d.value)
        f["vz20"] = (lv - lv.rolling(20).mean()) / lv.rolling(20).std()

        spot, perp = binance("spot", sym, idx), binance("perp", sym, idx)
        fund = funding(sym, idx)
        f["fund1"] = fund
        f["fund7"] = fund.rolling(7).mean()
        f["basis"] = perp.close / spot.close - 1
        taker = perp.taker_buy_quote / perp.quote_volume
        f["taker1"] = taker
        f["taker7"] = taker.rolling(7).mean()
        f["kimp"] = c / (spot.close * fx.reindex(idx).ffill()) - 1
        f["kimp_ch7"] = f.kimp - f.kimp.shift(7)

        other = up[[x for x in MARKETS if x != m][0]].close.reindex(idx)
        f["o_r5"], f["o_r20"] = other.pct_change(5), other.pct_change(20)
        f["is_eth"] = float(sym == "ETH")

        f["y"] = (c.shift(-H) / c - 1 > 0).astype(float).where(c.shift(-H).notna())
        f["market"] = m
        frames.append(f)
    return pd.concat(frames)


def walk_forward(df, model):
    cols = [c for c in df.columns if c not in ("y", "market")]
    df = df.dropna(subset=cols)
    out = []
    for start in pd.date_range(OOS, df.index.max(), freq="MS"):
        cut = start - pd.Timedelta(days=H)  # 이 날까지는 정답이 다 보였다
        train = df[(df.index <= cut) & df.y.notna()]
        test = df[(df.index >= start) & (df.index < start + pd.offsets.MonthBegin(1))]
        if test.empty:
            continue
        clf = MODELS[model]()
        clf.fit(train[cols], train.y)
        out.append(pd.DataFrame({"market": test.market, "p": clf.predict_proba(test[cols])[:, 1], "y": test.y}, index=test.index))
    return pd.concat(out), df.index.min()


def portfolio(pos_by_market, cost):
    """backtest.py 와 같은 방식: 어제 종가 신호로 오늘 수익, 마켓 균등 평균."""
    rs = []
    for m, pos in pos_by_market.items():
        d = load(m)
        p = pos.reindex(d.index).shift(1)
        turnover = p.diff().abs()
        rs.append((p * d.close.pct_change() - turnover * cost).loc[OOS:])
    return pd.concat(rs, axis=1).mean(axis=1).dropna()


def stats(r):
    eq = (1 + r).cumprod()
    vol = r.std() * np.sqrt(365)
    return {"연복리": eq.iloc[-1] ** (365 / len(r)) - 1, "샤프": r.mean() * 365 / vol, "MDD": (eq / eq.cummax() - 1).min()}


def save_daily(pos_sets, cost=COSTS[0]):
    """마켓별 일간 수익을 data/ml/oos_daily.csv 로 남긴다. 리포트가 시작일을 바꿔 가며 평가액을 그린다."""
    out = {}
    for m in MARKETS:
        d = load(m)
        ret = d.close.pct_change()
        out[f"보유_{m}"] = ret.loc[OOS:]
        for name, pos in pos_sets.items():
            p = pos[m].reindex(d.index).shift(1)
            out[f"{name}_{m}"] = (p * ret - p.diff().abs() * cost).loc[OOS:]
    pd.DataFrame(out).dropna().to_csv(ML / "oos_daily.csv", index_label="date")


def main():
    df = features()
    ens = {m: df[df.market == m].ens for m in MARKETS}
    rows, preds = {}, {}
    for model in MODELS:
        pr, first = walk_forward(df, model)
        preds[model] = pr
        auc = roc_auc_score(pr.y.dropna(), pr.p[pr.y.notna()])
        print(f"모델 {model}: 학습 시작 {first.date()}, 표본 외 AUC {auc:.3f}, 오른다 예측 비율 {(pr.p > 0.5).mean():.0%} (실제 {pr.y.mean():.0%})")

    variants = {"앙상블 (현행)": {m: ens[m].loc[OOS:] for m in MARKETS}}
    for model, pr in preds.items():
        for rule, f in RULES.items():
            variants[f"{model}-{rule}"] = {m: f(ens[m].loc[OOS:], (pr[pr.market == m].p > 0.5).astype(float).reindex(ens[m].loc[OOS:].index)) for m in MARKETS}

    for name, pos in variants.items():
        r = portfolio(pos, COSTS[0])
        s = stats(r)
        rows[name] = {
            "연복리": f"{s['연복리']*100:+.1f}%", "샤프": round(s["샤프"], 2), "MDD": f"{s['MDD']*100:.1f}%",
            "샤프@0.25%": round(stats(portfolio(pos, COSTS[1]))["샤프"], 2),
            "샤프 23-24": round(stats(r.loc[:"2024-12-31"])["샤프"], 2),
            "샤프 25-26": round(stats(r.loc["2025-01-01":])["샤프"], 2),
            "평균비중": f"{pd.concat(pos.values()).mean():.0%}",
            "_s": s, "_r": r,
        }

    base = rows["앙상블 (현행)"]
    for name, x in rows.items():
        if name == "앙상블 (현행)":
            x["채택"] = "기준"
            continue
        ok = [
            x["_s"]["샤프"] >= base["_s"]["샤프"] + 0.10,
            x["_s"]["연복리"] >= base["_s"]["연복리"] and x["_s"]["MDD"] >= base["_s"]["MDD"] - 0.05,
            x["샤프@0.25%"] > base["샤프@0.25%"],
            x["샤프 23-24"] >= base["샤프 23-24"] and x["샤프 25-26"] >= base["샤프 25-26"],
        ]
        x["채택"] = "통과" if all(ok) else "기각 (" + ",".join(str(i + 1) for i, v in enumerate(ok) if not v) + ")"
    save_daily({"앙상블": variants["앙상블 (현행)"], "L-A": variants["L-A 거르기"]})
    t = pd.DataFrame({k: {c: v for c, v in x.items() if not c.startswith("_")} for k, x in rows.items()}).T
    print(f"\n표본 외 {OOS} ~ {base['_r'].index[-1].date()}, 편도 비용 0.10% (샤프@0.25% 만 0.25%)")
    print(t.to_string())


if __name__ == "__main__":
    main()
