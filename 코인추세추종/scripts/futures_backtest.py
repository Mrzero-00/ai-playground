"""바이낸스 무기한 선물 실제 가격·펀딩비 백테스트 (사전 등록: FUTURES.md).
먼저 python3 scripts/fetch_ml.py 로 data/ml/perp_*.csv, funding_*.csv 를 받는다.
사용법: python3 scripts/futures_backtest.py [편도비용%]
"""
import sys

import numpy as np
import pandas as pd

from backtest import DATA
from ml import funding

COST = float(sys.argv[1]) / 100 if len(sys.argv) > 1 else 0.001
SYMBOLS = ["BTC", "ETH"]
SPLIT = "2023-01-01"
LIQ = 0.995  # 자본 대비 손실이 이만큼이면 청산
SMAS = [20, 50, 100, 200]

VARIANTS = {
    "F0 롱만": lambda e: e,
    "F1 대칭": lambda e: 2 * e - 1,
    "F2 롱+전부 아래면 숏": lambda e: e.where(e > 0, -1.0),
    "F3 2배 롱": lambda e: 2 * e,
}


def perp(sym):
    df = pd.read_csv(DATA / "ml" / f"perp_{sym}.csv", parse_dates=["date"], index_col="date").asfreq("D").ffill()
    return df


def ensemble(close):
    return sum((close > close.rolling(n).mean()).astype(float) for n in SMAS) / len(SMAS)


def returns(sym, f):
    d = perp(sym)
    fund = funding(sym, d.index).fillna(0.0)
    e = ensemble(d.close)
    e[d.close.rolling(200).mean().isna()] = np.nan  # 200일 워밍업 전은 쓰지 않는다
    pos = f(e).where(e.notna()).shift(1)  # 워밍업 구간(NaN)이 숏으로 바뀌지 않게
    prev = d.close.shift(1)
    r = pos * (d.close / prev - 1) - pos.diff().abs() * COST - pos * fund
    # 그날 최악 가격으로 손실이 자본을 다 먹으면 청산 → 그 뒤 0
    worst = np.where(pos > 0, pos * (d.low / prev - 1), pos * (d.high / prev - 1))
    liq = pd.Series(worst <= -LIQ, index=d.index) & pos.notna()
    r[liq] = -1.0
    if liq.any():
        r[r.index > liq.idxmax()] = 0.0
    return r.dropna(), pos, liq.sum(), fund


def stats(r):
    eq = (1 + r).cumprod()
    vol = r.std() * np.sqrt(365)
    return {"연복리": f"{(eq.iloc[-1] ** (365 / len(r)) - 1) * 100:+.1f}%", "샤프": round(r.mean() * 365 / vol, 2),
            "MDD": f"{(eq / eq.cummax() - 1).min() * 100:.1f}%"}


def main():
    res = {}
    for name, f in VARIANTS.items():
        parts = [returns(s, f) for s in SYMBOLS]
        r = pd.concat([p[0] for p in parts], axis=1).dropna().mean(axis=1)
        fund_paid = sum((p[1] * p[3]).loc[SPLIT:].sum() for p in parts) / len(parts) / (len(r.loc[SPLIT:]) / 365)
        res[name] = (r, sum(p[2] for p in parts), fund_paid)
    print(f"바이낸스 무기한, 편도 비용 {COST*100:.2f}%, USDT 기준")
    for label, sl in [("전체", slice(None)), ("표본 외 2023~", slice(SPLIT, None))]:
        t = pd.DataFrame({n: stats(r.loc[sl]) for n, (r, _, _) in res.items()}).T
        print(f"\n[{label}] {res['F0 롱만'][0].loc[sl].index[0].date()} ~ {res['F0 롱만'][0].index[-1].date()}")
        print(t.to_string())
    print("\n[연도별 수익]")
    y = pd.DataFrame({n: (1 + r).groupby(r.index.year).prod() - 1 for n, (r, _, _) in res.items()})
    print((y * 100).round(0).astype(int).astype(str).add("%").to_string())
    print("\n청산 횟수 / 표본 외 연간 펀딩 부담(자본 대비, +면 냈다):")
    for n, (_, liq, fp) in res.items():
        print(f"  {n}: {liq}회 / {fp*100:+.2f}%")


if __name__ == "__main__":
    main()
