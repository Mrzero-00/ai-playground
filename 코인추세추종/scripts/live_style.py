"""백테스트 공식과 실전 봇의 거래 방식 차이를 같은 데이터로 잰다.
백테스트(backtest.py)는 매일 목표 비중을 비용 없이 다시 맞추고 두 마켓을 매일 50:50 으로 평균한다.
실전 봇(live.py)은 목표 비중이 바뀐 날에만 거래하고 마켓별 주머니를 따로 굴린다.
사용법: python3 scripts/live_style.py
"""
import numpy as np
import pandas as pd

from backtest import load, returns, sma

COST, MARKETS = 0.001, ["KRW-BTC", "KRW-ETH"]

def st(eq):
    r = eq.pct_change().dropna()
    return f"연복리 {(eq.iloc[-1]/eq.iloc[0])**(365/len(r))-1:+.1%}  샤프 {r.mean()*365/(r.std()*np.sqrt(365)):.2f}  MDD {(eq/eq.cummax()-1).min():.1%}"

def live_style(d, e, start):
    cash, qty, prev, out = 0.5, 0.0, None, {}
    for t, c in d.close.loc[start:].items():
        tgt = e.loc[t]
        if tgt != prev:  # 목표가 바뀐 날 종가에만 거래
            diff = (cash + qty * c) * tgt - qty * c
            qty += diff / c
            cash -= diff + abs(diff) * COST
            prev = tgt
        out[t] = cash + qty * c
    return pd.Series(out)

for start in ["2023-01-01", "2020-01-01"]:  # 표본 외, 전체
    bt, lv, turn_bt, n_tr = [], [], 0, 0
    for m in MARKETS:
        d = load(m)
        e = (sma(d, 20) + sma(d, 50) + sma(d, 100) + sma(d, 200)) / 4
        r, pos, to = returns(d, e)
        bt.append(r.loc[start:])
        lv.append(live_style(d, e, pd.Timestamp(start) - pd.Timedelta(days=1)))
        n_tr += int((e.loc[start:].diff().abs() > 0).sum())
    eq_bt = (1 + pd.concat(bt, axis=1).mean(axis=1)).cumprod()
    eq_lv = sum(lv).loc[start:]
    print(f"[{start} ~ {eq_bt.index[-1].date()}]  신호 변경 {n_tr}회")
    print("  백테스트 공식 :", st(eq_bt))
    print("  실전 봇 방식  :", st(eq_lv))
