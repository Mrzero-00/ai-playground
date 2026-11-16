"""하루 한 번 거래 vs 더 자주 확인하기. 4시간봉으로 비교한다.
사전 고정한 방식:
  A 일 1회        09:00 종가로 앙상블(SMA 20·50·100·200일) 비중을 정하고 하루 유지
  B 4시간마다     같은 기간(×6봉)의 앙상블을 4시간마다 다시 계산
  C 일 1회+손절5%  A 에 더해, 4시간 종가가 그날 09:00 종가보다 5% 넘게 빠지면 다음 09:00 까지 현금
  D 일 1회+손절10% 위와 같고 기준만 10%
  E 4시간 빠른판   SMA 20·50·100·200 '봉'(= 3.3~33일). 더 빠른 다른 전략
편도 비용 0.10%. 사용법: python3 scripts/intraday.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

D4 = Path(__file__).resolve().parent.parent / "data" / "4h"
COST = 0.001
BARS = 365 * 6


def load(m):
    df = pd.read_csv(D4 / f"{m}.csv", parse_dates=["time"], index_col="time")
    full = pd.date_range(df.index[0], df.index[-1], freq="4h")
    return df.reindex(full).ffill()


def ens(close, lens):
    return sum((close > close.rolling(n).mean()).astype(float) for n in lens) / len(lens)


def daily_pos(df):
    # 05:00 시작 봉이 09:00 에 닫힌다 → 그 종가가 일봉 종가
    dc = df.close[df.index.hour == 5]
    sig = ens(dc, [20, 50, 100, 200])
    return sig.reindex(df.index).ffill().fillna(0.0), dc.reindex(df.index).ffill()


def with_stop(df, x):
    pos, ref = daily_pos(df)
    p, r, c = pos.values.copy(), ref.values, df.close.values
    stopped = False
    for i in range(len(p)):
        if df.index[i].hour == 5:  # 새 일봉 신호가 나오는 봉 → 손절 해제
            stopped = False
        elif p[i] > 0 and c[i] < r[i] * (1 - x):
            stopped = True
        if stopped:
            p[i] = 0.0
    return pd.Series(p, index=df.index)


STRATS = {
    "A 일 1회": lambda d: daily_pos(d)[0],
    "B 4시간마다(같은 기간)": lambda d: ens(d.close, [120, 300, 600, 1200]),
    "C 일 1회+손절5%": lambda d: with_stop(d, 0.05),
    "D 일 1회+손절10%": lambda d: with_stop(d, 0.10),
    "E 4시간 빠른판": lambda d: ens(d.close, [20, 50, 100, 200]),
}


def rets(df, pos):
    pos = pos.shift(1).fillna(0.0)
    turn = pos.diff().abs().fillna(0.0)
    return pos * df.close.pct_change().fillna(0.0) - turn * COST, turn


def stats(r, turn):
    eq = (1 + r).cumprod()
    yrs = len(r) / BARS
    vol = r.std() * np.sqrt(BARS)
    return (eq.iloc[-1] ** (1 / yrs) - 1, r.mean() * BARS / vol, (eq / eq.cummax() - 1).min(), turn.sum() / yrs / 2,
            r.resample("D").sum().min())


if __name__ == "__main__":
    data = {m: load(m) for m in ["KRW-BTC", "KRW-ETH"]}
    res = {}
    for name, f in STRATS.items():
        rs, ts = zip(*(rets(d, f(d)) for d in data.values()))
        res[name] = (pd.concat(rs, axis=1).mean(axis=1), pd.concat(ts, axis=1).mean(axis=1))
    hold = pd.concat([d.close.pct_change() for d in data.values()], axis=1).mean(axis=1)
    res["보유"] = (hold, hold * 0)
    for label, start in [("전체 2018.6~", "2018-06-01"), ("표본 외 2023~", "2023-01-01")]:
        print(f"\n[{label}] BTC+ETH 50:50, 편도 0.10%")
        print(f"  {'방식':18s} {'연복리':>6s} {'샤프':>5s} {'MDD':>5s} {'연거래':>6s} {'최악의 하루':>8s}")
        for n, (r, t) in res.items():
            c, s, m, tr, worst = stats(r.loc[start:], t.loc[start:])
            print(f"  {n:18s} {c*100:+5.0f}% {s:5.2f} {m*100:4.0f}% {tr:5.0f}회 {worst*100:+7.1f}%")
