"""손절 규칙 — 여러 형태 (RESEARCH.md '손절 규칙 — 여러 형태'). 지금 봇(09:00 맞춤 + 4시간마다 늘리기만)에 손절을 더한다.
형태 A 매수가 대비 % · B 고점 대비 추적 % · C ATR(터틀·샹들리에) · D 급락 속도(−3σ) · E 저점 이탈, 다시 사는 규칙 R1 다음 09:00 · R2 새 매수 신호.
손절 확인은 30분마다(09:00 제외), 업비트 30분봉 종가. 수익은 30분 격자.
사용법: python3 scripts/lab/stoploss.py   → data/lab/stoploss.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from fastbuy import COSTS, END, MAS, SEED, STARTS, SYMS, grid

BUY = 240  # 늘리는 확인: 4시간마다 (지금 봇)
BASE = "손절 없음 (지금 봇)"
# (형태, 이름, 값, 보조 자료 이름) — D 의 값은 30분봉 개수
STOPS = [("A", "A 매수가 −5%", 0.05, None), ("A", "A 매수가 −10%", 0.10, None), ("A", "A 매수가 −15%", 0.15, None),
         ("B", "B 고점 −5%", 0.05, None), ("B", "B 고점 −10%", 0.10, None), ("B", "B 고점 −15%", 0.15, None),
         ("C1", "C 터틀 매수가 − 2×ATR(20)", None, "atr20"), ("C2", "C 샹들리에 고점 − 3×ATR(22)", None, "atr22"),
         ("D", "D 1시간 −3σ", 2, "sig2"), ("D", "D 4시간 −3σ", 8, "sig8"), ("D", "D 24시간 −3σ", 48, "sig48"),
         ("E", "E 10일 저점 이탈", None, "low10"), ("E", "E 20일 저점 이탈", None, "low20")]
REENTRY = {"R1": "다음 09:00", "R2": "새 매수 신호"}


def prep(sym):
    g = grid(sym)
    mins = (g.index.hour * 60 + g.index.minute - 540) % 1440
    nine = np.asarray(mins == 0)
    d = g[nine]
    wd = (sum((d > d.rolling(n).mean()).astype(float) for n in MAS) / len(MAS)).reindex(g.index).to_numpy()
    s, per = g[mins % BUY == 0], 1440 // BUY
    up = (sum((s > s.rolling(n * per).mean()).astype(float) for n in MAS) / len(MAS)).reindex(g.index).to_numpy()
    day = pd.read_csv(C.ROOT / "data" / f"KRW-{sym}.csv", parse_dates=["date"], index_col="date")
    known = day.index + pd.Timedelta(hours=33)  # 일봉 D(09:00 ~ 다음 날 09:00)는 D+1 09:00 에 닫힌다
    pc = day.close.shift()
    tr = pd.concat([day.high - day.low, (day.high - pc).abs(), (day.low - pc).abs()], axis=1).max(axis=1)

    def on_grid(x):
        return pd.Series(x.to_numpy(), index=known).reindex(g.index, method="ffill").to_numpy()

    P = dict(g=g, px=g.to_numpy(), lp=np.log(g).to_numpy(), nine=nine, wd=wd, up=up,
             atr20=on_grid(tr.ewm(alpha=1 / 20, adjust=False).mean()), atr22=on_grid(tr.ewm(alpha=1 / 22, adjust=False).mean()),
             low10=on_grid(day.low.rolling(10).min()), low20=on_grid(day.low.rolling(20).min()))
    for nb in (2, 8, 48):
        P[f"sig{nb}"] = np.log(g).diff(nb).rolling(1440).std().shift().to_numpy()
    P["일봉 종가 차이"] = float((pd.Series(day.close.to_numpy(), index=known).reindex(g.index).dropna() / g - 1).abs().max())
    return P


def simulate(P, kind=None, k=None, aux=None, re="R1"):
    """30분 격자의 비중과 손절한 자리. kind None 이면 지금 봇."""
    px, lp, nine, wd, up = P["px"], P["lp"], P["nine"], P["wd"], P["up"]
    a = P[aux] if aux else None
    out, stops = np.zeros(len(px)), []
    x = avg = hi = last = 0.0
    opened, stopped = 0, False
    for i in range(len(px)):
        p = px[i]
        if x > 0.0 and p > hi:
            hi = p
        if nine[i]:  # 일 단위 판단. 손절로 쉬는 중이면 다시 사는 규칙이 풀어 줄 때만
            today = wd[i]
            if stopped and (re == "R1" or today > last):
                stopped = False
            if not stopped and today != x:
                if today > x:
                    if x == 0.0:
                        avg, hi, opened = p, p, i
                    else:
                        avg = (avg * x + p * (today - x)) / today
                x = today
            last = today
        elif x > 0.0:
            if kind == "A":
                hit = p <= avg * (1 - k)
            elif kind == "B":
                hit = p <= hi * (1 - k)
            elif kind == "C1":
                hit = p <= avg - 2 * a[i]
            elif kind == "C2":
                hit = p <= hi - 3 * a[i]
            elif kind == "D":
                hit = lp[i] - lp[max(i - k, opened)] <= -3 * a[i]
            elif kind == "E":
                hit = p < a[i]
            else:
                hit = False
            if hit:
                x, stopped = 0.0, True
                stops.append(i)
            elif up[i] > x:
                avg = (avg * x + p * (up[i] - x)) / up[i]
                x = up[i]
        elif not stopped and up[i] > x:
            x = up[i]
            avg, hi, opened = p, p, i
        out[i] = x
    return pd.Series(out, index=P["g"].index), np.array(stops, int)


def measure(G, W):
    row = {}
    for sn, start in STARTS.items():
        row[sn] = {}
        for cn, cost in COSTS.items():
            parts, orders = [], 0
            for s in SYMS:
                g, w = G[s]["g"], W[s][0]
                r = (w.shift() * g.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
                m = r.index > pd.Timestamp(start) + pd.Timedelta(hours=9)
                parts.append(r[m])
                orders += int((w.diff().abs() > 0)[m].sum())
            eq = (1 + pd.concat(parts, axis=1).fillna(0.0).mean(axis=1)).cumprod()
            d = eq[(eq.index.hour == 9) & (eq.index.minute == 0)]
            rd = d.pct_change().dropna()
            row[sn][cn] = {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(rd.mean() / rd.std() * np.sqrt(365)), "MDD": float((d / d.cummax() - 1).min()),
                           "연 주문": orders / ((eq.index[-1] - eq.index[0]).days / 365)}
            if sn == "2020~" and cn == "0.10%":
                row["폭락"] = {"하루 최악": float(rd.min()), "최악의 날": str(rd.idxmin().date()), "−10% 이하 날": int((rd <= -0.10).sum()), "−5% 이하 날": int((rd <= -0.05).sum()), "날": int(len(rd))}
    t0 = pd.Timestamp(STARTS["2020~"]) + pd.Timedelta(hours=9)
    n, gaps = 0, []
    for s in SYMS:  # 진단: 손절한 뒤 다시 살 때의 가격이 손절한 가격보다 높았나
        w, stops = W[s]
        px, held = G[s]["px"], np.flatnonzero(w.to_numpy() > 0)
        for i in stops[G[s]["g"].index[stops] > t0]:
            n += 1
            j = np.searchsorted(held, i, side="right")
            if j < len(held):
                gaps.append(px[held[j]] / px[i] - 1)
    row["진단"] = {"손절": n, "더 비싸게 다시 삼": float(np.mean(np.array(gaps) > 0)) if gaps else None, "가격 차 중앙값": float(np.median(gaps)) if gaps else None}
    return row


def main():
    G = {s: prep(s) for s in SYMS}
    out = {"made": datetime.now().isoformat(timespec="seconds"), "일봉 종가 차이": {s: G[s]["일봉 종가 차이"] for s in SYMS}, "rows": {}}
    out["rows"][BASE] = measure(G, {s: simulate(G[s]) for s in SYMS})
    for rk, rn in REENTRY.items():
        for kind, name, k, aux in STOPS:
            row = measure(G, {s: simulate(G[s], kind, k, aux, rk) for s in SYMS})
            row["형태"], row["다시"] = name[0], rk
            out["rows"][f"{name} · {rk} {rn}"] = row
    base = out["rows"][BASE]
    for name, r in out["rows"].items():
        if name == BASE:
            continue
        crit = {"샤프 > 지금 봇 (두 구간)": all(r[sn]["0.10%"]["샤프"] > base[sn]["0.10%"]["샤프"] for sn in STARTS),
                "MDD 나쁘지 않음": all(r[sn]["0.10%"]["MDD"] >= base[sn]["0.10%"]["MDD"] for sn in STARTS),
                "0.25% 에서도": all(r[sn]["0.25%"]["샤프"] > base[sn]["0.25%"]["샤프"] for sn in STARTS)}
        r["판정"], r["통과"] = crit, all(crit.values())
    (C.OUT / "stoploss.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print("일봉 종가와 30분 격자 09:00 가격의 가장 큰 차이:", " · ".join(f"{s} {v * 100:.3f}%" for s, v in out["일봉 종가 차이"].items()))
    for sn in STARTS:
        print(f"== {sn} {END} 까지 · 100만원 · 편도 0.10% (0.25%)")
        for name, r in out["rows"].items():
            a, h = r[sn]["0.10%"], r[sn]["0.25%"]
            print(f"   {name:36s} 잔고 {a['잔고'] / 1e4:6,.0f}만 ({h['잔고'] / 1e4:6,.0f}만) 샤프 {a['샤프']:.2f} ({h['샤프']:.2f}) MDD {a['MDD'] * 100:5.1f}% 연 주문 {a['연 주문']:4.0f}회 {'통과' if r.get('통과') else ('기각' if '통과' in r else '')}")
    print("== 폭락 대비(2020~, 0.10%) 하루 최악 · −10% 이하 날 · −5% 이하 날 | 진단: 손절 횟수 · 손절가보다 비싸게 다시 산 비율 · 가격 차 중앙값")
    for name, r in out["rows"].items():
        f, d = r["폭락"], r["진단"]
        dg = f"{d['손절']}회 · {d['더 비싸게 다시 삼'] * 100:.0f}% · {d['가격 차 중앙값'] * 100:+.2f}%" if d["손절"] and d["더 비싸게 다시 삼"] is not None else "—"
        print(f"   {name:36s} {f['하루 최악'] * 100:6.1f}% ({f['최악의 날']}) · {f['−10% 이하 날']:2d} · {f['−5% 이하 날']:2d} | {dg}")


if __name__ == "__main__":
    main()
