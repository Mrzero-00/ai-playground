"""업비트 일봉 추세추종 백테스트.
신호는 t일 종가(09:00 KST)로 정하고 t+1일 수익에 적용한다. 거래할 때마다 편도 비용을 뗀다.
전략 목록은 결과를 보기 전에 고정했다. 대표값은 고르지 않은 앙상블(SMA 4개 평균)이다.
사용법: python3 scripts/backtest.py [편도비용%]
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"
COST = float(sys.argv[1]) / 100 if len(sys.argv) > 1 else 0.001  # 수수료 0.05% + 슬리피지 0.05%
SPLIT = "2023-01-01"  # 이전 = 표본 내, 이후 = 표본 외 검증


def load(market):
    df = pd.read_csv(DATA / f"{market}.csv", parse_dates=["date"], index_col="date")
    return df.asfreq("D").ffill()  # 빠진 날은 전날 값으로


def sma(df, n):
    return (df.close > df.close.rolling(n).mean()).astype(float)


def donchian(df, entry, exit_):
    up = df.close > df.high.rolling(entry).max().shift(1)
    dn = df.close < df.low.rolling(exit_).min().shift(1)
    pos = pd.Series(np.nan, index=df.index)
    pos[up], pos[dn] = 1.0, 0.0
    return pos.ffill().fillna(0.0)


def tsmom(df, n):
    return (df.close.pct_change(n) > 0).astype(float)


STRATS = {
    "보유(B&H)": lambda d: pd.Series(1.0, index=d.index),
    "SMA20": lambda d: sma(d, 20),
    "SMA50": lambda d: sma(d, 50),
    "SMA100": lambda d: sma(d, 100),
    "SMA200": lambda d: sma(d, 200),
    "돈치안20/10": lambda d: donchian(d, 20, 10),
    "돈치안55/20": lambda d: donchian(d, 55, 20),
    "모멘텀30일": lambda d: tsmom(d, 30),
    "모멘텀90일": lambda d: tsmom(d, 90),
    "앙상블(SMA4)": lambda d: (sma(d, 20) + sma(d, 50) + sma(d, 100) + sma(d, 200)) / 4,
}


def returns(df, pos):
    pos = pos.shift(1).fillna(0.0)  # 어제 종가 신호로 오늘 수익을 받는다
    turnover = pos.diff().abs().fillna(pos.abs())
    return pos * df.close.pct_change().fillna(0.0) - turnover * COST, pos, turnover


def stats(r, pos=None, turnover=None):
    r = r.dropna()
    eq = (1 + r).cumprod()
    years = len(r) / 365
    cagr = eq.iloc[-1] ** (1 / years) - 1
    vol = r.std() * np.sqrt(365)
    out = {
        "연복리": cagr,
        "변동성": vol,
        "샤프": r.mean() * 365 / vol if vol else np.nan,
        "MDD": (eq / eq.cummax() - 1).min(),
    }
    if pos is not None:
        out["보유비중"] = pos.loc[r.index].mean()
        out["연거래"] = turnover.loc[r.index].sum() / years / 2
    return out


def fmt(rows):
    t = pd.DataFrame(rows).T
    for c in ["연복리", "변동성", "MDD", "보유비중"]:
        if c in t:
            t[c] = (t[c] * 100).map("{:+.1f}%".format if c in ("연복리", "MDD") else "{:.0f}%".format)
    t["샤프"] = t["샤프"].map("{:.2f}".format)
    if "연거래" in t:
        t["연거래"] = t["연거래"].map("{:.1f}회".format)
    return t.to_string()


def run(markets, start=None):
    """markets 를 균등 비중으로 섞은 포트폴리오의 전략별 일간 수익."""
    data = {m: load(m) for m in markets}
    if start:
        data = {m: d[d.index >= start] for m, d in data.items()}
    res = {}
    for name, f in STRATS.items():
        parts = []
        for m, d in data.items():
            # 지표는 전체 이력으로 계산해야 시작 시점에 워밍업이 없다
            full = load(m)
            r, p, t = returns(full, f(full))
            parts.append((r.loc[d.index], p.loc[d.index], t.loc[d.index]))
        r = pd.concat([x[0] for x in parts], axis=1).mean(axis=1)
        p = pd.concat([x[1] for x in parts], axis=1).mean(axis=1)
        t = pd.concat([x[2] for x in parts], axis=1).mean(axis=1)
        res[name] = (r, p, t)
    return res


def report(title, markets, start):
    res = run(markets, start)
    print(f"\n### {title} (편도 비용 {COST*100:.2f}%)")
    for label, sl in [("전체", slice(None)), ("표본 내 ~2022", slice(None, "2022-12-31")), ("표본 외 2023~", slice(SPLIT, None))]:
        rows = {n: stats(r.loc[sl], p, t) for n, (r, p, t) in res.items()}
        print(f"\n[{label}]")
        print(fmt(rows))
    yearly = pd.DataFrame({n: (1 + r).groupby(r.index.year).prod() - 1 for n, (r, _, _) in res.items()})
    print("\n[연도별 수익]")
    print((yearly[["보유(B&H)", "SMA50", "SMA200", "돈치안20/10", "앙상블(SMA4)"]] * 100).round(0).astype(int).astype(str).add("%").to_string())


if __name__ == "__main__":
    # 첫 200일은 지표 워밍업이라 뺀다
    report("BTC 단독", ["KRW-BTC"], "2018-04-13")
    report("ETH 단독", ["KRW-ETH"], "2018-04-13")
    report("BTC+ETH 50:50", ["KRW-BTC", "KRW-ETH"], "2018-04-13")
