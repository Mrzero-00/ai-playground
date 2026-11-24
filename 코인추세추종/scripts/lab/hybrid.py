"""현물 봇 + 하락장 선물 숏 조합 (RESEARCH.md '현물 봇 + 하락장 선물 숏 조합').
현물 다리 = 업비트 원화 현물 봇(앙상블), 숏 다리 = 바이낸스 무기한 1배, 판별기 (나)가 하락장일 때만. 숏에 쓰는 돈은 USDT — 원/달러를 곱한다.
사용법: python3 scripts/lab/hybrid.py   → data/lab/hybrid.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
import regime_futures as R
from indicators import sma
from regime3 import hyst, ztrail

START, END, SEED = R.START, R.END, 1_000_000
PERIODS = R.PERIODS
YEARS = R.YEARS
COSTS = {"0.10%": 0.001, "0.25%": 0.0025}
NAMES = {"C0": "현물 봇 100% (기준)", "C1": "현물 봇 100% + 쉬는 돈으로 숏 (이론값)", "C2": "현물 80% + 숏 전용 20%", "C3": "현물 70% + 숏 전용 30%",
         "C4": "현물 50% + 숏 전용 50%", "보유": "업비트 현물 그냥 보유", "숏만": "숏 다리만 (USDT, 원화 환산)"}


def build(cost):
    """일 수익: 현물 봇, 현물 보유, 숏 전용 몫(원화 환산), 쉬는 돈 숏 겹치기."""
    fx = pd.read_csv(C.ML / "usdkrw.csv", parse_dates=["date"], index_col="date").krw.astype(float)
    days = pd.date_range("2019-09-01", END)
    fxr = fx.reindex(days).ffill().pct_change().fillna(0.0)  # 원/달러 일 변화 (주말·휴일은 0)
    bot, hold, sleeve, over = [], [], [], []
    for s in R.SYMS:
        c = pd.read_csv(C.ROOT / "data" / f"KRW-{s}.csv", parse_dates=["date"], index_col="date").close.astype(float)
        c = c[c.index <= END]
        w = sum((c > sma(c, n)).astype(float) for n in (20, 50, 100, 200)) / 4
        bot.append((w.shift() * c.pct_change() - cost * w.diff().abs().shift()).fillna(0.0))
        hold.append(c.pct_change().fillna(0.0))
        d = R.load(s)
        sh = pd.Series(np.minimum(np.sign(hyst(ztrail(d.close, 30))), 0).astype(float), index=d.index)  # −1 (하락장) / 0
        f = fxr.reindex(d.index).fillna(0.0)
        sleeve.append((1 + R.daily(d, sh.to_numpy(), cost)) * (1 + f) - 1)  # 숏 전용 몫: USDT 로 들고 있다
        pos = sh * (1 - w.reindex(d.index).ffill().fillna(0.0))              # 쉬는 돈만큼만 숏
        over.append(R.daily(d, pos.to_numpy(), cost) + pos.abs().shift().fillna(0.0) * f)
    mean = lambda parts: R.cut(pd.concat(parts, axis=1).fillna(0.0).mean(axis=1), START, END)
    return {"bot": mean(bot), "hold": mean(hold), "sleeve": mean(sleeve), "over": R.cut(pd.concat([b.add(o, fill_value=0.0) for b, o in zip(bot, over)], axis=1).fillna(0.0).mean(axis=1), START, END)}


def split(bot, sleeve, share):
    """현물 share · 숏 전용 1 − share, 해마다 첫날 다시 맞춘다. 일 수익을 돌려준다."""
    a, b, prev, out = share, 1 - share, 1.0, []
    year = None
    for t in bot.index:
        if t.year != year:
            tot = a + b
            a, b, year = tot * share, tot * (1 - share), t.year
        a *= 1 + bot[t]
        b *= 1 + sleeve.get(t, 0.0)
        out.append((a + b) / prev - 1)
        prev = a + b
    return pd.Series(out, index=bot.index)


def stats(r):
    eq = (1 + r).cumprod()
    return {"잔고": float(SEED * eq.iloc[-1]), "연복리": float(eq.iloc[-1] ** (365 / len(r)) - 1), "샤프": float(r.mean() / r.std() * np.sqrt(365)) if r.std() > 0 else 0.0,
            "MDD": float((eq / eq.cummax() - 1).min())}


def main():
    out = {"made": datetime.now().isoformat(timespec="seconds"), "window": [START, END], "names": NAMES, "rows": {}}
    series = {}
    for cn, cost in COSTS.items():
        L = build(cost)
        series[cn] = {"C0": L["bot"], "C1": L["over"], "C2": split(L["bot"], L["sleeve"], 0.8), "C3": split(L["bot"], L["sleeve"], 0.7),
                      "C4": split(L["bot"], L["sleeve"], 0.5), "보유": L["hold"], "숏만": L["sleeve"]}
    for k in NAMES:
        r = series["0.10%"][k]
        row = {"전체": stats(r), "기간": {pn: stats(R.cut(r, a, b)) for pn, (a, b) in PERIODS.items()},
               "해": {y: float((1 + R.cut(r, f"{y}-01-01", f"{y}-12-31")).prod() - 1) for y in YEARS},
               "연말 잔고": {str(t.year): float(v) for t, v in (SEED * (1 + r).cumprod()).resample("YE").last().items()},
               "0.25%": {"전체": stats(series["0.25%"][k]), **{pn: stats(R.cut(series["0.25%"][k], a, b)) for pn, (a, b) in PERIODS.items()}}}
        out["rows"][k] = row
    c0 = out["rows"]["C0"]
    for k in ("C1", "C2", "C3", "C4"):
        row = out["rows"][k]
        crit = {"1 샤프·MDD": all(row["기간"][pn]["샤프"] > c0["기간"][pn]["샤프"] and row["기간"][pn]["MDD"] >= c0["기간"][pn]["MDD"] - 0.05 for pn in PERIODS),
                "2 0.25% 비용": all(row["0.25%"][pn]["샤프"] > c0["0.25%"][pn]["샤프"] for pn in PERIODS)}
        row["판정"], row["통과"] = crit, all(crit.values())
    (C.OUT / "hybrid.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"100만원 {START} → {END} · 편도 0.10% (0.25%)")
    for k, nm in NAMES.items():
        r = out["rows"][k]
        a, h = r["전체"], r["0.25%"]["전체"]
        per = " | ".join(f"{pn} {r['기간'][pn]['연복리'] * 100:+.0f}% {r['기간'][pn]['샤프']:.2f} {r['기간'][pn]['MDD'] * 100:.0f}%" for pn in PERIODS)
        tag = "  통과" if r.get("통과") else ("  -" if "통과" in r else "")
        print(f"   {k:3s} {nm:28s} 잔고 {a['잔고'] / 1e4:6,.0f}만 ({h['잔고'] / 1e4:6,.0f}만) 연 {a['연복리'] * 100:+4.0f}% 샤프 {a['샤프']:.2f} ({h['샤프']:.2f}) MDD {a['MDD'] * 100:4.0f}% | {per}{tag}")
    print("해마다 수익:", " ".join(YEARS))
    for k in NAMES:
        print(f"   {k:4s}", " ".join(f"{out['rows'][k]['해'][y] * 100:+5.0f}%" for y in YEARS))


if __name__ == "__main__":
    main()
