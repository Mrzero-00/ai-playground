"""단타 글 전략 시험 (RESEARCH.md '단타 글 전략 등록'). 바이낸스 현물 1분봉 → 봉 10가지, 규칙 ①~④, 100칸.
신호는 봉 종가에 내고 그 종가에 체결, 손절·익절은 다음 봉부터 실제 고가·저가로 확인. 비용은 체결마다 곱한다.
사용법: python3 scripts/lab/shortterm.py   → data/lab/shortterm.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from indicators import ema, rsi, sma

TFS = {"1분": "1min", "3분": "3min", "5분": "5min", "15분": "15min", "30분": "30min", "1시간": "1h", "2시간": "2h", "4시간": "4h", "12시간": "12h", "1일": "1D"}
COSTS = {"0.05%": 0.0005, "0.10%": 0.001, "0.25%": 0.0025}
SPLIT = pd.Timestamp("2025-07-01")
SYMS = ["BTC", "ETH"]


def load(sym):
    d = pd.read_csv(C.ML / f"spot1m_{sym}.csv", parse_dates=["time"], index_col="time")[["open", "high", "low", "close"]]
    return d[~d.index.duplicated()].sort_index().astype(float)


def bars(m, rule):
    if rule == "1min":
        return m
    return m.resample(rule, label="left", closed="left").agg({"open": "first", "high": "max", "low": "min", "close": "last"}).dropna()


def basic_signals(b, rule):
    c = b.close
    if rule == "RSI":
        r = rsi(c, 14)
        return (r <= 30).to_numpy(), (r >= 70).to_numpy()
    if rule == "골든크로스":
        f, s = sma(c, 5), sma(c, 20)
        return ((f > s) & (f.shift() <= s.shift())).to_numpy(), (f < s).to_numpy()
    m, sd = sma(c, 20), c.rolling(20).std()
    up = m + 2 * sd
    return ((c > up) & (c.shift() <= up.shift())).to_numpy(), (c < up).to_numpy()


def sim_stop(b, enter, exit_, stop):
    """①~③: 롱만, 손절 s. 봉마다 (총수익률, 체결 수), 거래 목록 (진입 봉, 청산 봉, 비용 전 수익)."""
    o, h, l, c = (b[k].tolist() for k in ("open", "high", "low", "close"))
    en, ex = enter.tolist(), exit_.tolist()
    n = len(c)
    r, f, trades = [0.0] * n, [0] * n, []
    pos, entry, sp, ei = False, 0.0, 0.0, 0
    for i in range(1, n):
        if pos:
            if l[i] <= sp:
                px = o[i] if o[i] < sp else sp
                r[i], pos = px / c[i - 1] - 1, False
                f[i] += 1
                trades.append((ei, i, px / entry - 1))
            else:
                r[i] = c[i] / c[i - 1] - 1
                if ex[i]:
                    pos = False
                    f[i] += 1
                    trades.append((ei, i, c[i] / entry - 1))
                    continue
        if not pos and en[i]:
            pos, entry, ei = True, c[i], i
            sp = entry * (1 - stop)
            f[i] += 1
    return np.array(r), np.array(f), trades


def ha_signals(b):
    """④ 하이킨아시 값으로 EMA 200·스토캐스틱 RSI(14·14·3·3)."""
    o, h, l, c = b.open, b.high, b.low, b.close
    hc = (o + h + l + c) / 4
    x = hc.shift(1)
    x.iloc[0] = (o.iloc[0] + c.iloc[0]) / 2
    ho = x.ewm(alpha=0.5, adjust=False).mean()  # HA 시가 = (전 HA 시가 + 전 HA 종가)/2
    e = ema(hc, 200)
    r = rsi(hc, 14)
    lo, hi = r.rolling(14).min(), r.rolling(14).max()
    k = sma(100 * (r - lo) / (hi - lo).replace(0, np.nan), 3)
    dd = sma(k, 3)
    body = hc - ho
    big = body.abs() > body.abs().shift()
    out = dict(above=(hc > e), below=(hc < e),
               cu=(k > dd) & (k.shift() <= dd.shift()) & (k < 20) & (dd < 20),
               cd=(k < dd) & (k.shift() >= dd.shift()) & (k > 80) & (dd > 80),
               lc=(body > 0) & big & (l >= ho), sc=(body < 0) & big & (h <= ho))
    out = {kk: v.fillna(False).to_numpy().tolist() for kk, v in out.items()}
    out["k"] = k.fillna(50).tolist()
    out["ok"] = e.notna().to_numpy().tolist()
    out["ok"] = [False] * 200 + out["ok"][200:]  # EMA 200 이 다 찬 뒤부터
    return out


def sim_ha(b, s, tp, sl, short_ok):
    """④: 준비(교차) → 진입 캔들 → 익절·손절. 같은 봉에서 둘 다 닿으면 손절."""
    o, h, l, c = (b[k].tolist() for k in ("open", "high", "low", "close"))
    n = len(c)
    r, f, trades = [0.0] * n, [0] * n, []
    pos, arm, entry, ei = 0, 0, 0.0, 0
    for i in range(1, n):
        if pos == 1:
            stop, take = entry * (1 - sl), entry * (1 + tp)
            if l[i] <= stop:
                px = o[i] if o[i] < stop else stop
            elif h[i] >= take:
                px = o[i] if o[i] > take else take
            else:
                px = None
            last = c[i] if px is None else px
            r[i] = last / c[i - 1] - 1
            if px is not None:
                pos = 0
                f[i] += 1
                trades.append((ei, i, px / entry - 1))
        elif pos == -1:
            stop, take = entry * (1 + sl), entry * (1 - tp)
            if h[i] >= stop:
                px = o[i] if o[i] > stop else stop
            elif l[i] <= take:
                px = o[i] if o[i] < take else take
            else:
                px = None
            last = c[i] if px is None else px
            r[i] = (2 - last / entry) / (2 - c[i - 1] / entry) - 1  # 수량 고정 숏
            if px is not None:
                pos = 0
                f[i] += 1
                trades.append((ei, i, 1 - px / entry))
        if pos or not s["ok"][i]:
            continue
        if arm == 1 and (not s["above"][i] or s["k"][i] >= 80):
            arm = 0
        elif arm == -1 and (not s["below"][i] or s["k"][i] <= 20):
            arm = 0
        if arm == 1 and s["lc"][i]:
            pos, arm, entry, ei = 1, 0, c[i], i
            f[i] += 1
            continue
        if arm == -1 and s["sc"][i]:
            pos, arm, entry, ei = -1, 0, c[i], i
            f[i] += 1
            continue
        if s["cu"][i] and s["above"][i]:
            arm = 1
        elif short_ok and s["cd"][i] and s["below"][i]:
            arm = -1
    return np.array(r), np.array(f), trades


def daily_equity(idx, r, f, cost):
    eq = pd.Series(np.cumprod(1 + r) * (1 - cost) ** np.cumsum(f), index=idx)
    return eq.resample("1D").last().ffill()


def stats(eq):
    """일 종가 평가액 → 연복리·샤프(√365)·MDD."""
    eq = eq.dropna()
    if len(eq) < 30:
        return None
    ret = eq.pct_change().dropna()
    yrs = (eq.index[-1] - eq.index[0]).days / 365
    sd = ret.std()
    return {"샤프": float(ret.mean() / sd * np.sqrt(365)) if sd > 0 else 0.0, "연복리": float((eq.iloc[-1] / eq.iloc[0]) ** (1 / yrs) - 1),
            "MDD": float((eq / eq.cummax() - 1).min())}


def periods(port):
    a, b = port[port.index < SPLIT], port[port.index >= SPLIT - pd.Timedelta(days=1)]
    return {"전체": stats(port), "2022-01~2025-06": stats(a), "2025-07~": stats(b)}


def bench(start, end):
    """현물 봇: 바이낸스 현물 일봉 종가 SMA 20·50·100·200 앙상블, t 종가 비중을 t+1 수익에. 그냥 보유도."""
    out = {}
    for cname, cost in (("0.10%", 0.001), ("0.25%", 0.0025)):
        sleeves, hold = [], []
        for s in SYMS:
            d = pd.read_csv(C.ML / f"spot_{s}.csv", parse_dates=["date"], index_col="date").close.astype(float)
            w = sum((d > sma(d, n)).astype(float) for n in (20, 50, 100, 200)) / 4
            ret = d.pct_change()
            net = w.shift() * ret - cost * w.diff().abs().shift().fillna(0)
            net = net[(net.index >= start) & (net.index <= end)]
            sleeves.append((1 + net.fillna(0)).cumprod())
            hold.append(d[(d.index >= start) & (d.index <= end)] / d[d.index >= start].iloc[0])
        out[f"현물 봇 {cname}"] = periods(0.5 * sleeves[0] + 0.5 * sleeves[1])
        out["그냥 보유"] = periods(0.5 * hold[0] + 0.5 * hold[1])
    return out


def cells():
    for rule in ("RSI", "골든크로스", "볼린저"):
        for tf in TFS:
            for stop in (0.02, 0.03):
                yield dict(rule=rule, tf=tf, param=f"손절 {stop * 100:.0f}%", mode="롱만", stop=stop)
    for tf in TFS:
        for name, tp, sl in (("가) 익절 3%·손절 1.5%", 0.03, 0.015), ("나) 익절 1.5%·손절 3%", 0.015, 0.03)):
            for mode in ("롱만", "롱숏"):
                yield dict(rule="하이킨아시", tf=tf, param=name, mode=mode, tp=tp, sl=sl)


def main():
    data = {s: load(s) for s in SYMS}
    start = max(d.index[0] for d in data.values()).normalize()
    end = min(d.index[-1] for d in data.values()).normalize() - pd.Timedelta(days=1)  # 마지막 날은 덜 찼을 수 있다
    res = {cfg_key(c): dict(c, sleeves={}) for c in cells()}
    for tf, rule in TFS.items():
        for s in SYMS:
            b = bars(data[s], rule)
            b = b[b.index < end + pd.Timedelta(days=1)]
            mins = (b.index[1] - b.index[0]).total_seconds() / 60
            basic = {k: basic_signals(b, k) for k in ("RSI", "골든크로스", "볼린저")}
            ha = ha_signals(b)
            for c in cells():
                if c["tf"] != tf:
                    continue
                if c["rule"] == "하이킨아시":
                    r, f, tr = sim_ha(b, ha, c["tp"], c["sl"], c["mode"] == "롱숏")
                else:
                    r, f, tr = sim_stop(b, *basic[c["rule"]], c["stop"])
                res[cfg_key(c)]["sleeves"][s] = dict(eq={k: daily_equity(b.index, r, f, v) for k, v in COSTS.items()},
                                                     trades=[(t[2], (t[1] - t[0]) * mins) for t in tr])
            print(datetime.now().strftime("%H:%M:%S"), tf, s, len(b), "봉", flush=True)
    bm = bench(start, end)
    out = []
    for k, c in res.items():
        tr = c["sleeves"]["BTC"]["trades"] + c["sleeves"]["ETH"]["trades"]
        row = {x: c[x] for x in ("rule", "tf", "param", "mode")}
        for cname in COSTS:
            port = 0.5 * c["sleeves"]["BTC"]["eq"][cname] + 0.5 * c["sleeves"]["ETH"]["eq"][cname]
            port = port[(port.index >= start) & (port.index <= end)]
            row[cname] = periods(port / port.iloc[0])
        g = [t[0] for t in tr]
        row.update(거래=len(tr), 승률=float(np.mean([x > 0 for x in g])) if g else None, 거래당=float(np.mean(g)) if g else None,
                   보유분=float(np.median([t[1] for t in tr])) if tr else None)
        b10, b25 = bm["현물 봇 0.10%"]["전체"], bm["현물 봇 0.25%"]["전체"]
        s10, s25 = row["0.10%"]["전체"], row["0.25%"]["전체"]
        row["판정"] = {"1 샤프·MDD": s10["샤프"] > b10["샤프"] and s10["MDD"] >= b10["MDD"] - 0.05, "2 0.25% 비용": s25["샤프"] > b25["샤프"], "3 거래 30회": len(tr) >= 30}
        row["통과"] = all(row["판정"].values())
        out.append(row)
    (C.OUT / "shortterm.json").write_text(json.dumps({"made": datetime.now().isoformat(timespec="seconds"), "window": [str(start.date()), str(end.date())],
                                                      "bench": bm, "cells": out}, ensure_ascii=False, indent=1))
    print("기간", start.date(), "~", end.date(), "| 현물 봇 0.10% 샤프", round(bm["현물 봇 0.10%"]["전체"]["샤프"], 2), "MDD", round(bm["현물 봇 0.10%"]["전체"]["MDD"], 2),
          "| 0.25%", round(bm["현물 봇 0.25%"]["전체"]["샤프"], 2), "| 보유", round(bm["그냥 보유"]["전체"]["샤프"], 2))
    for row in out:
        a = row["0.10%"]["전체"]
        print(f"{row['rule']} {row['tf']} {row['param']} {row['mode']} | 0.10% 샤프 {a['샤프']:.2f} 연 {a['연복리'] * 100:+.0f}% MDD {a['MDD'] * 100:.0f}% | 0.05% {row['0.05%']['전체']['샤프']:.2f} 0.25% {row['0.25%']['전체']['샤프']:.2f}"
              f" | 거래 {row['거래']} 승률 {row['승률'] if row['승률'] is None else round(row['승률'] * 100)}% 거래당 {row['거래당'] if row['거래당'] is None else round(row['거래당'] * 100, 3)}% | {'통과' if row['통과'] else '-'}")


def cfg_key(c):
    return f"{c['rule']}|{c['tf']}|{c['param']}|{c['mode']}"


if __name__ == "__main__":
    main()
