"""장별 매매 전략 2차 — 선물 자동매매 가정 (RESEARCH.md '장별 매매 전략 2차'). 바이낸스 USDT 무기한 일봉 + 실제 펀딩비.
장 판별은 3상태 루프의 두 판별기(지난 30일 z, + 문턱 여유)를 선물 종가로. 상태는 t 종가, 포지션은 t+1 부터.
사용법: python3 scripts/lab/regime_futures.py   → data/lab/regime_futures.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from indicators import sma, true_range
from regime3 import GNAME, grade, hyst, ztrail

SYMS = ["BTC", "ETH"]
START, END = "2020-01-01", "2026-11-22"
PERIODS = {"2020~2021": ("2020-01-01", "2021-12-31"), "2022~2026": ("2022-01-01", END)}
YEARS = [str(y) for y in range(2020, 2027)]
COSTS = {"0.10%": 0.001, "0.25%": 0.0025}
NAMES = {"T1": "방향만 (상승 롱 · 횡보 0 · 하락 숏)", "T2": "롱만 (상승장만)", "T3": "숏만 (하락장만)", "T4": "T1 + 횡보장 박스권 양방향",
         "T5": "정도 반영 (강한 장 1 · 보통 0.5)", "T6": "T1 + 손절 2N", "T7": "T1 + 손절 2N · 익절 4N"}
CLS = {"가": "지난 30일 z", "나": "지난 30일 z + 문턱 여유"}


def load(sym):
    d = pd.read_csv(C.ML / f"perp_{sym}.csv", parse_dates=["date"], index_col="date")[["open", "high", "low", "close"]].astype(float)
    d = d[d.index <= END]
    f = pd.read_csv(C.ML / f"funding_{sym}.csv", parse_dates=["time"])
    day = (f.time - pd.Timedelta(seconds=1)).dt.tz_localize(None).dt.normalize()  # D+1 00:00 펀딩까지가 D 일봉 몫
    d["fund"] = f.groupby(day).rate.sum().reindex(d.index).fillna(0.0)
    sp = pd.read_csv(C.ML / f"spot_{sym}.csv", parse_dates=["date"], index_col="date").close.astype(float)
    d["ens"] = (sum((sp > sma(sp, n)).astype(float) for n in (20, 50, 100, 200)) / 4).reindex(d.index).ffill()  # 현물 봇 비중 (현물 종가)
    return d


def box(d, g, start=0):
    """T4: 추세 상태면 그 방향, 횡보장이면 볼린저(20, 2) 하단 아래 롱·상단 위 숏, 중간선 청산. start 앞은 포지션 0(그 자리에서 새로 시작)."""
    c = d.close.to_numpy()
    m, sd = sma(d.close, 20).to_numpy(), d.close.rolling(20).std().to_numpy()
    out, pos, was_trend = np.zeros(len(c)), 0, False
    for i in range(start, len(c)):
        if g[i] != 0:
            pos, was_trend = int(np.sign(g[i])), True
        else:
            if was_trend:
                pos, was_trend = 0, False
            if (pos == 1 and c[i] >= m[i]) or (pos == -1 and c[i] <= m[i]):
                pos = 0
            if pos == 0 and not np.isnan(sd[i]):
                pos = 1 if c[i] < m[i] - 2 * sd[i] else (-1 if c[i] > m[i] + 2 * sd[i] else 0)
        out[i] = pos
    return out


def daily(d, pos, cost, lev=1.0):
    """날마다 포지션 = pos × 평가액. 수익 = 어제 포지션 × 오늘 수익 − 펀딩 − 바꾼 만큼 비용."""
    p = pd.Series(pos, index=d.index) * lev
    return (p.shift() * d.close.pct_change() - p.shift() * d.fund - cost * p.diff().abs().shift()).fillna(0.0)


def stops(d, g, cost, take):
    """T6·T7: 상태 방향으로 진입, 2N 손절(take 면 4N 익절). 장중 고가·저가로 확인, 갭이면 시가. 끝난 뒤에는 상태가 바뀔 때까지 쉰다."""
    o, h, l, c, fund = (d[k].to_numpy() for k in ("open", "high", "low", "close", "fund"))
    N = true_range(d).rolling(20).mean().to_numpy()
    want = np.sign(g).astype(int)
    n = len(c)
    ret, pos = np.zeros(n), np.zeros(n)
    cur, locked, stop, tgt, prev = 0, False, np.nan, np.nan, 0
    for i in range(1, n):
        if cur:
            px = None
            if cur == 1:
                if l[i] <= stop:
                    px = min(o[i], stop)
                elif take and h[i] >= tgt:
                    px = max(o[i], tgt)
            else:
                if h[i] >= stop:
                    px = max(o[i], stop)
                elif take and l[i] <= tgt:
                    px = min(o[i], tgt)
            ret[i] = cur * ((c[i] if px is None else px) / c[i - 1] - 1) - cur * fund[i]
            if px is not None:
                ret[i] -= cost
                cur, locked = 0, True
        if want[i] != prev:
            locked = False
        prev = want[i]
        if not locked and want[i] != cur:
            ret[i] -= cost * abs(want[i] - cur)
            cur = int(want[i])
            if cur and not np.isnan(N[i]):
                stop, tgt = c[i] - cur * 2 * N[i], c[i] + cur * 4 * N[i]
            elif cur:
                stop, tgt = (-np.inf, np.inf) if cur == 1 else (np.inf, -np.inf)
        pos[i] = cur
    return pd.Series(ret, index=d.index), pos


def stats(ret):
    ret = ret.dropna()
    if len(ret) < 30:
        return None
    eq = (1 + ret).cumprod()
    sd = ret.std()
    return {"연복리": float(eq.iloc[-1] ** (365 / len(ret)) - 1), "샤프": float(ret.mean() / sd * np.sqrt(365)) if sd > 0 else 0.0, "MDD": float((eq / eq.cummax() - 1).min())}


def cut(r, a, b):
    return r[(r.index >= a) & (r.index <= b)]


def main():
    D = {s: load(s) for s in SYMS}
    rets = {cn: {} for cn in COSTS}   # 비용 → 줄 이름 → [코인별 일 수익]
    info = {}                          # 줄 이름 → 포지션 통계
    today = {}

    def add(key, s, d, pos=None, pair=None):
        for cn, cost in COSTS.items():
            if pair is None:
                r = daily(d, pos, cost)
            else:
                r, pos = stops(d, pair[0], cost, pair[1])
            rets[cn].setdefault(key, []).append(cut(r, START, END))
        p = pd.Series(pos, index=d.index)
        m = (d.index >= START)
        st = info.setdefault(key, {"변경": 0, "롱": [], "숏": [], "펀딩": []})
        st["변경"] += int((p.diff().abs() > 0)[m].sum())
        st["롱"].append(float((p[m] > 0).mean()))
        st["숏"].append(float((p[m] < 0).mean()))
        st["펀딩"].append(float((p.shift() * d.fund)[m].sum() / (m.sum() / 365)))

    for s, d in D.items():
        z = ztrail(d.close, 30)
        states = {"가": grade(z), "나": hyst(z)}
        lr = np.log(d.close)
        zc = (lr.shift(-30) - lr.shift(30)) / (lr.diff().rolling(60).std().shift(-30) * np.sqrt(60))
        add("F0 (현물 봇 비중을 선물 롱으로)", s, d, d.ens.to_numpy())
        add("선물 롱 보유", s, d, np.ones(len(d)))
        add("상한: 장을 미리 안다면 T1", s, d, np.sign(grade(zc)).astype(float))
        for ck, g in states.items():
            sg = np.sign(g).astype(float)
            add(f"T1|{ck}", s, d, sg)
            add(f"T2|{ck}", s, d, np.maximum(sg, 0))
            add(f"T3|{ck}", s, d, np.minimum(sg, 0))
            add(f"T4|{ck}", s, d, box(d, g))
            add(f"T5|{ck}", s, d, g / 2)
            add(f"T6|{ck}", s, d, pair=(g, False))
            add(f"T7|{ck}", s, d, pair=(g, True))
            today.setdefault(s, {})[ck] = {"상태": GNAME[int(g[-1])], "T1": int(sg[-1]), "T5": float(g[-1] / 2)}
        today[s].update(날짜=str(d.index[-1].date()), 종가=float(d.close.iloc[-1]), z=float(z.iloc[-1]))
        # 참고: T1(나) 2배 — 전날 종가 대비 장중 불리한 움직임 49.5% 이면 그 코인 몫 전부 잃음
        sg = np.sign(states["나"]).astype(float)
        r2 = daily(d, sg, COSTS["0.10%"], lev=2.0)
        p = pd.Series(sg, index=d.index).shift()
        liq = ((p == 1) & (d.low / d.close.shift() - 1 <= -0.495)) | ((p == -1) & (d.high / d.close.shift() - 1 >= 0.495))
        r2[liq] = -1.0
        eq = (1 + cut(r2, START, END)).cumprod()
        if (eq <= 0).any():
            r2[r2.index > eq[eq <= 0].index[0]] = 0.0
        rets["0.10%"].setdefault("참고: T1|나 2배", []).append(cut(r2, START, END))
        info.setdefault("참고: T1|나 2배", {"변경": 0, "롱": [0], "숏": [0], "펀딩": [0], "청산": 0})["청산"] += int(cut(liq, START, END).sum())

    port = {cn: {k: pd.concat(v, axis=1).fillna(0).mean(axis=1) for k, v in rr.items()} for cn, rr in rets.items()}
    out = {"made": datetime.now().isoformat(timespec="seconds"), "window": [START, END], "names": NAMES, "classifiers": CLS, "rows": {}, "today": today}
    for k in port["0.10%"]:
        row = {"전체": stats(port["0.10%"][k]), "기간": {pn: stats(cut(port["0.10%"][k], a, b)) for pn, (a, b) in PERIODS.items()},
               "해": {y: float((1 + cut(port["0.10%"][k], f"{y}-01-01", f"{y}-12-31")).prod() - 1) for y in YEARS}}  # 그 해 수익(2026 은 11-22 까지)
        if k in port["0.25%"]:
            row["0.25%"] = {"전체": stats(port["0.25%"][k]), **{pn: stats(cut(port["0.25%"][k], a, b)) for pn, (a, b) in PERIODS.items()}}
        i = info[k]
        row.update(변경=i["변경"], 롱=float(np.mean(i["롱"])), 숏=float(np.mean(i["숏"])), 펀딩=float(np.mean(i["펀딩"])), 청산=i.get("청산"))
        out["rows"][k] = row
    f0 = out["rows"]["F0 (현물 봇 비중을 선물 롱으로)"]
    for k, row in out["rows"].items():
        if "|" not in k or k.startswith("참고"):
            continue
        crit = {"1 샤프·MDD": all(row["기간"][pn]["샤프"] > f0["기간"][pn]["샤프"] and row["기간"][pn]["MDD"] >= f0["기간"][pn]["MDD"] - 0.05 for pn in PERIODS),
                "2 0.25% 비용": all(row["0.25%"][pn]["샤프"] > f0["0.25%"][pn]["샤프"] for pn in PERIODS), "3 변경 30회": row["변경"] >= 30}
        row["판정"], row["통과"] = crit, all(crit.values())
    (C.OUT / "regime_futures.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))

    def line(k):
        r = out["rows"][k]
        a = r["전체"]
        per = " | ".join(f"{pn} {r['기간'][pn]['연복리'] * 100:+.0f}% {r['기간'][pn]['샤프']:.2f} {r['기간'][pn]['MDD'] * 100:.0f}%" for pn in PERIODS)
        h = f" | 0.25% {r['0.25%']['전체']['샤프']:.2f}" if "0.25%" in r else ""
        tag = ("  통과" if r.get("통과") else "") + (f"  청산 {r['청산']}회" if r.get("청산") is not None else "")
        print(f"   {k:30s} 연 {a['연복리'] * 100:+5.0f}% 샤프 {a['샤프']:5.2f} MDD {a['MDD'] * 100:4.0f}% | {per}{h} | 변경 {r['변경']:4d} 롱 {r['롱'] * 100:2.0f}% 숏 {r['숏'] * 100:2.0f}% 펀딩 {r['펀딩'] * 100:+.1f}%{tag}")

    print(f"기간 {START} ~ {END} · 편도 0.10% · (전체 | 2020~2021 | 2022~2026 = 연복리 샤프 MDD)")
    for k in ("F0 (현물 봇 비중을 선물 롱으로)", "선물 롱 보유", "상한: 장을 미리 안다면 T1"):
        line(k)
    for ck, cname in CLS.items():
        print(f"== 판별기 ({ck}) {cname}")
        for t in NAMES:
            line(f"{t}|{ck}")
    line("참고: T1|나 2배")
    print("해마다 수익:", " ".join(YEARS))
    for k in ("F0 (현물 봇 비중을 선물 롱으로)", "선물 롱 보유", "T1|나", "T2|나", "T3|나", "T5|나", "T1|가"):
        print(f"   {k:30s}", " ".join(f"{out['rows'][k]['해'][y] * 100:+5.0f}%" for y in YEARS))
    for s, t in today.items():
        print(f"오늘 {s} {t['날짜']} 종가 {t['종가']:,.1f} z {t['z']:+.2f}: (가) {t['가']['상태']} → T1 {t['가']['T1']:+d} · (나) {t['나']['상태']} → T1 {t['나']['T1']:+d}, T5 {t['나']['T5']:+.1f}")


if __name__ == "__main__":
    main()
