"""여러 코인으로 확대한 추세추종 백테스트.
사전 고정한 규칙:
  - 매월 말, 상장 200일 이상 코인 중 최근 30일 평균 거래대금 상위 N개를 다음 달 투자 대상으로 정한다 (N = 5, 10, 20).
    현재 거래대금으로 고르면 미래를 아는 셈이라 그때그때 과거 정보로만 고른다.
  - N개에 균등 배분, 코인마다 앙상블(SMA 20·50·100·200) 비중을 적용한다.
  - 비교: BTC+ETH 앙상블, 같은 대상을 그냥 보유.
한계: 상장폐지된 코인은 API 에 없어 빠져 있다(생존자 편향). 특히 '그냥 보유' 쪽이 실제보다 좋게 나온다.
사용법: python3 scripts/multicoin.py [편도비용%]
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"
COST = float(sys.argv[1]) / 100 if len(sys.argv) > 1 else 0.001
START = "2018-06-01"


STABLE = {"KRW-USDT", "KRW-USDC", "KRW-USDS", "KRW-USD1", "KRW-USDE", "KRW-USDG", "KRW-RLUSD", "KRW-PYUSD", "KRW-EURC"}  # 원화 환율만 따라가서 추세 대상이 아니다


def panel():
    close, value = {}, {}
    for f in DATA.glob("KRW-*.csv"):
        if f.stem in STABLE:
            continue
        df = pd.read_csv(f, parse_dates=["date"], index_col="date").asfreq("D").ffill()
        close[f.stem], value[f.stem] = df.close, df.value
    return pd.DataFrame(close), pd.DataFrame(value)


def ensemble(close):
    return sum((close > close.rolling(n).mean()).astype(float) for n in (20, 50, 100, 200)) / 4


def universe(close, value, n):
    """날짜별 투자 대상 마스크. 월말에 정해 다음 달 내내 유지."""
    age = close.notna().cumsum()
    liq = value.rolling(30).mean().where(age >= 200)
    month_end = liq.groupby(liq.index.to_period("M")).tail(1)
    picks = month_end.rank(axis=1, ascending=False) <= n
    picks.index = picks.index + pd.Timedelta(days=1)  # 다음 날부터 적용
    return picks.reindex(close.index).ffill().fillna(0).astype(bool)


def simulate(close, weight):
    w = weight.shift(1).fillna(0.0)  # 어제 정한 비중으로 오늘 수익
    r = (w * close.pct_change().fillna(0.0)).sum(axis=1)
    turn = w.diff().abs().sum(axis=1)
    return r - turn * COST, turn


def stats(r, turn):
    eq = (1 + r).cumprod()
    yrs = len(r) / 365
    vol = r.std() * np.sqrt(365)
    return f"{(eq.iloc[-1] ** (1/yrs) - 1)*100:+5.0f}%  샤프 {r.mean()*365/vol:4.2f}  MDD {(eq/eq.cummax()-1).min()*100:4.0f}%  회전 {turn.sum()/yrs/2:4.1f}배/년"


if __name__ == "__main__":
    close, value = panel()
    print(f"코인 {close.shape[1]}개, 편도 비용 {COST*100:.2f}%")
    sig = ensemble(close)
    runs = {}
    be = close.columns.isin(["KRW-BTC", "KRW-ETH"])
    m = pd.DataFrame(False, index=close.index, columns=close.columns)
    m.loc[:, be] = True
    runs["BTC+ETH 앙상블"] = simulate(close, sig.where(m, 0) / 2)
    runs["BTC+ETH 보유"] = simulate(close, m.astype(float) / 2)
    for n in (5, 10, 20):
        u = universe(close, value, n)
        runs[f"상위{n} 앙상블"] = simulate(close, sig.where(u, 0) / n)
        runs[f"상위{n} 보유"] = simulate(close, u.astype(float) / n)
    for label, start in [("전체 2018.6~", START), ("표본 외 2023~", "2023-01-01")]:
        print(f"\n[{label}]")
        for k, (r, t) in runs.items():
            print(f"  {k:14s} 연복리 {stats(r.loc[start:], t.loc[start:])}")
    print("\n[연도별 수익]")
    yr = pd.DataFrame({k: (1 + r.loc[START:]).groupby(r.loc[START:].index.year).prod() - 1 for k, (r, _) in runs.items() if "앙상블" in k})
    print((yr * 100).round(0).astype(int).astype(str).add("%").to_string())
