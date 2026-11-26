"""장이 시작되기 직전의 지표 양상 (RESEARCH.md '장이 시작되기 직전의 지표 양상'). 5단계 장(여유를 둔 정답)이 14일 넘게 이어진 구간의
시작일마다 전날 지표 20개의 백분위(그 코인 자기 과거 값 안에서, 그날까지 쌓인 것만)를 모아 같은 장끼리 닮았는지 본다.
찾는 기간 2020 ~ 2025, 검증 기간 2018 ~ 2019 · 2026 ~. 판정 없음.
사용법: python3 scripts/lab/precursor.py   → data/lab/precursor.json
"""
import json
from bisect import bisect_left, bisect_right, insort
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
import regime_futures as R
from indicators import sma
from regime3 import hyst

SYMS, H = ["BTC", "ETH"], 30
FIND, HOLD = ("2020-01-01", "2025-12-31"), [("2018-01-01", "2019-12-31"), ("2026-01-01", "2026-12-31")]
TYPES = {2: "대상승", 1: "상승", 0: "횡보", -1: "하락", -2: "대하락"}
MIN_SEG, MIN_HIST = 14, 365
NAMES = {"ret30": "지난 30일 수익", "dist200": "200일선 대비", "dd365": "365일 고점 대비 낙폭", "volr": "변동성 비율(30일 ÷ 365일)", "bbw": "볼린저 폭",
         "valr": "거래대금 비율(7일 ÷ 90일)", "rsi": "RSI(14)", "fund": "펀딩비(7일 합)", "basis": "선물 괴리(7일)", "fng": "공포·탐욕 지수",
         "kimchi": "김치 프리미엄(7일)", "cbprem": "코인베이스 프리미엄(7일)", "dvol": "내재 변동성 DVOL", "mvrv": "MVRV", "netflow": "거래소 순유입(7일)",
         "active": "활성 주소 비율(7일 ÷ 90일)", "spx": "S&P 500 200일선 대비", "vix": "VIX", "credit": "신용 스프레드 30일 변화", "real": "실질금리 30일 변화"}


def cal(s, days):
    """달력 날짜로 늘리고 빈 날(주말·휴일)은 앞 값으로."""
    return s[~s.index.duplicated()].sort_index().reindex(days, method="ffill")


def per_asset(path, sym, col):
    d = pd.read_csv(C.ML / path, parse_dates=["date"])
    return d[d.asset == sym].set_index("date")[col].astype(float)


def rsi(c, n=14):
    d = c.diff()
    up, dn = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean(), (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn)


def expanding_pct(x):
    """그날까지 쌓인 값 안에서의 백분위(0 ~ 100). 값이 MIN_HIST 개보다 적으면 NaN."""
    seen, out = [], np.full(len(x), np.nan)
    for i, v in enumerate(np.asarray(x, float)):
        if np.isnan(v):
            continue
        insort(seen, v)
        if len(seen) >= MIN_HIST:
            out[i] = (bisect_left(seen, v) + bisect_right(seen, v)) / 2 / len(seen) * 100
    return pd.Series(out, index=x.index)


def raw_features(sym, days, macro):
    """지표 원값(백분위로 바꾸기 전). 업비트 일봉 종가 c 와 함께."""
    u = pd.read_csv(C.ROOT / "data" / f"KRW-{sym}.csv", parse_dates=["date"], index_col="date").astype(float).reindex(days)
    c, lr = u.close, np.log(u.close)
    sp = pd.read_csv(C.ML / f"spot_{sym}.csv", parse_dates=["date"], index_col="date").close.astype(float).reindex(days)
    pp = pd.read_csv(C.ML / f"perp_{sym}.csv", parse_dates=["date"], index_col="date").close.astype(float).reindex(days)
    f = pd.read_csv(C.ML / f"funding_{sym}.csv", parse_dates=["time"])
    fund = f.groupby((f.time - pd.Timedelta(seconds=1)).dt.tz_localize(None).dt.normalize()).rate.sum().reindex(days)
    fx = cal(pd.read_csv(C.ML / "usdkrw.csv", parse_dates=["date"], index_col="date").krw.astype(float), days)
    cb = per_asset("coinbase.csv", sym, "close").reindex(days)
    oc = pd.read_csv(C.ML / "onchain.csv", parse_dates=["date"])
    oc = oc[oc.asset == sym].set_index("date").reindex(days)
    exs = per_asset("exsupply.csv", sym, "exsupply").reindex(days)
    sd20 = c.rolling(20).std()
    X = {"ret30": c / c.shift(30) - 1, "dist200": np.log(c / sma(c, 200)), "dd365": c / c.rolling(365).max() - 1,
         "volr": lr.diff().rolling(30).std() / lr.diff().rolling(365).std(), "bbw": 4 * sd20 / sma(c, 20),
         "valr": u.value.rolling(7).mean() / u.value.rolling(90).mean(), "rsi": rsi(c),
         "fund": fund.rolling(7).sum(), "basis": (pp / sp - 1).rolling(7).mean(), "fng": macro["fng"],
         "kimchi": (c / (sp * fx) - 1).rolling(7).mean(), "cbprem": (cb / sp - 1).rolling(7).mean(),
         "dvol": per_asset("dvol.csv", sym, "dvol").reindex(days), "mvrv": np.log(per_asset("mvrv.csv", sym, "mvrv").reindex(days)),
         "netflow": (oc.inflow - oc.outflow).rolling(7).sum() / exs, "active": oc.active.rolling(7).mean() / oc.active.rolling(90).mean(),
         "spx": macro["spx"], "vix": macro["vix"], "credit": macro["credit"], "real": macro["real"]}
    return c, X


def features(sym, days, macro):
    c, X = raw_features(sym, days, macro)
    return c, {k: expanding_pct(v) for k, v in X.items()}


def macro_series(days):
    m = pd.read_csv(C.ML / "macro.csv", parse_dates=["date"], index_col="date")["S&P 500"].dropna().astype(float)
    cr = cal(pd.read_csv(C.ML / "credit.csv", parse_dates=["date"], index_col="date").iloc[:, 0].dropna().astype(float), days)
    ry = cal(pd.read_csv(C.ML / "realyield.csv", parse_dates=["date"], index_col="date").iloc[:, 0].dropna().astype(float), days)
    return {"fng": cal(pd.read_csv(C.ML / "fng.csv", parse_dates=["date"], index_col="date").value.astype(float), days),
            "spx": cal(np.log(m / sma(m, 200)), days),
            "vix": cal(pd.read_csv(C.ML / "risk.csv", parse_dates=["date"], index_col="date").VIX.dropna().astype(float), days),
            "credit": cr - cr.shift(30), "real": ry - ry.shift(30)}


def grade(z):
    return np.where(z >= 2, 2, np.where(z >= 1, 1, np.where(z <= -2, -2, np.where(z <= -1, -1, 0))))


def events(sym, c, label=None):
    """여유 정답의 구간(14일 넘게) 시작일. 자료 맨 앞 구간은 사건이 아니다. label = 날마다 −2 ~ 2 를 주는 함수(없으면 변동성 기준)."""
    if label is None:
        lr = np.log(c)
        zc = (lr.shift(-H) - lr.shift(H)) / (lr.diff().rolling(2 * H).std().shift(-H) * np.sqrt(2 * H))
        ok = zc.notna()
        h = pd.Series(hyst(zc[ok]), index=zc[ok].index)
    else:
        h = label(c)
    sgn = np.sign(h)
    rid = (sgn != sgn.shift()).cumsum()
    out = []
    for i, (_, s) in enumerate(h.groupby(rid)):
        if i == 0 or len(s) < MIN_SEG:
            continue
        k = int(np.sign(s.iloc[0]))
        k = 2 * k if k and (s.abs() == 2).any() else k
        out.append({"코인": sym, "시작": s.index[0], "장": TYPES[k], "날": len(s), "변화": float(c[s.index[-1]] / c[s.index[0]] - 1)})
    return out, h.index[-1]


def forward_grade(c):
    lr = np.log(c)
    zf = (lr.shift(-H) - lr) / (lr.diff().rolling(60).std() * np.sqrt(H))
    return pd.Series(np.where(zf.notna(), grade(zf), np.nan), index=c.index)


def analyze(ev, P, FG, names, codes=None):
    """사건마다 전날 지표 백분위를 붙이고, 동떨어진 사건을 빼고, 장 × 지표마다 양상·검증·쓸모를 낸다. codes = 장 이름 → 뒤 30일 장 값."""
    codes = codes or {n: g for g, n in TYPES.items()}
    for e in ev:
        t = e["시작"] - pd.Timedelta(days=1)
        e["값"] = {k: (None if np.isnan(v := P[e["코인"]][k].get(t, np.nan)) else float(v)) for k in names}
        e["기간"] = "찾기" if FIND[0] <= str(e["시작"].date()) <= FIND[1] else ("검증" if any(a <= str(e["시작"].date()) <= b for a, b in HOLD) else "밖")
    find = [e for e in ev if e["기간"] == "찾기"]

    # 동떨어진 사건: 값이 있는 지표의 절반 이상에서 그 장 중앙값과 3 × 1.4826 × MAD 넘게 떨어짐
    outliers = []
    for ty in TYPES.values():
        grp = [e for e in find if e["장"] == ty]
        med = {k: np.median([e["값"][k] for e in grp if e["값"][k] is not None] or [np.nan]) for k in names}
        mad = {k: 1.4826 * np.median([abs(e["값"][k] - med[k]) for e in grp if e["값"][k] is not None] or [np.nan]) for k in names}
        for e in grp:
            have = [k for k in names if e["값"][k] is not None and mad[k] > 0]
            far = [k for k in have if abs(e["값"][k] - med[k]) > 3 * mad[k]]
            if have and len(far) >= len(have) / 2:
                e["동떨어짐"] = far
                outliers.append(e)
    find = [e for e in find if "동떨어짐" not in e]
    hold = [e for e in ev if e["기간"] == "검증"]

    rows = []
    for ty in TYPES.values():
        for k in names:
            v = np.array([e["값"][k] for e in find if e["장"] == ty and e["값"][k] is not None])
            if len(v) == 0:
                continue
            med = float(np.median(v))
            up = med > 50
            share = float(np.mean(v > 50) if up else np.mean(v < 50))
            ok = len(v) >= 5 and share >= 0.75 and abs(med - 50) >= 20
            hv = np.array([e["값"][k] for e in hold if e["장"] == ty and e["값"][k] is not None])
            hs = float(np.mean(hv > 50) if up else np.mean(hv < 50)) if len(hv) else None
            check = "검증 못 함" if len(hv) < 3 else ("검증 통과" if hs >= 0.6 else "검증 실패")
            row = {"장": ty, "지표": k, "이름": names[k], "n": len(v), "중앙 백분위": med, "쪽": "위" if up else "아래", "같은 쪽": share,
                   "통과": bool(ok), "검증 n": int(len(hv)), "검증 같은 쪽": hs, "검증": check if ok else None}
            if ok:  # 쓸모 확인: 그 구간에 있던 모든 날에서 뒤 30일이 그 장이었던 비율 대 평소
                code = codes[ty]
                zone, base = [], []
                for s in SYMS:
                    p, fg = P[s][k], FG[s]
                    m = p.notna() & fg.notna() & (p.index >= "2018-01-01")
                    base.append((fg[m] == code).to_numpy())
                    zone.append((fg[m & ((p >= 70) if up else (p <= 30))] == code).to_numpy())
                zb, bb = np.concatenate(zone), np.concatenate(base)
                row["쓸모"] = {"구간 날": int(len(zb)), "구간에서 그 장": float(zb.mean()) if len(zb) else None, "평소 그 장": float(bb.mean())}
            rows.append(row)

    return find, hold, outliers, rows


def main():
    days = pd.date_range("2017-09-25", "2026-11-25")
    macro = macro_series(days)
    ev, P, FG, last = [], {}, {}, {}
    for s in SYMS:
        c, P[s] = features(s, days, macro)
        e, last[s] = events(s, c.dropna())
        ev += e
        FG[s] = forward_grade(c)
    find, hold, outliers, rows = analyze(ev, P, FG, NAMES)

    out = {"made": datetime.now().isoformat(timespec="seconds"), "names": NAMES, "정답 끝": {s: str(d.date()) for s, d in last.items()},
           "사건": [{**{k: v for k, v in e.items() if k != "시작"}, "시작": str(e["시작"].date())} for e in ev], "양상": rows}
    (C.OUT / "precursor.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))

    cnt = lambda grp, ty: sum(e["장"] == ty for e in grp)
    print("== 사건 수 (찾기 2020~2025 / 검증 2018~2019 · 2026~, 정답 끝 " + ", ".join(f"{s} {d.date()}" for s, d in last.items()) + ")")
    print("   " + " · ".join(f"{ty} {cnt(find, ty) + cnt(outliers, ty)} / {cnt(hold, ty)}" for ty in TYPES.values()))
    print("== 동떨어진 사건(빼고 봄):", "; ".join(f"{e['코인']} {e['시작'].date()} {e['장']}({e['변화'] * 100:+.0f}%) — {', '.join(NAMES[k] for k in e['동떨어짐'])}" for e in outliers) or "없음")
    print("== 찾는 기간에서 통과한 양상 (중앙 백분위 · 같은 쪽 비율 · n | 검증 | 쓸모: 그 구간에서 뒤 30일이 그 장인 비율 대 평소)")
    for r in rows:
        if r["통과"]:
            u = r["쓸모"]
            hv = f"{r['검증 같은 쪽'] * 100:.0f}% (n {r['검증 n']})" if r["검증 같은 쪽"] is not None else f"n {r['검증 n']}"
            print(f"   {r['장']:4s} {r['이름']:22s} {r['쪽']} · 백분위 {r['중앙 백분위']:4.0f} · {r['같은 쪽'] * 100:3.0f}% · n {r['n']:2d} | {r['검증']} {hv}"
                  f" | {u['구간에서 그 장'] * 100:4.1f}% 대 {u['평소 그 장'] * 100:4.1f}% ({u['구간 날']}일)")
    print("== 장마다 가장 한쪽으로 치우친 지표 5개 (통과 여부와 상관없이, 중앙 백분위 · 같은 쪽 비율 · n)")
    for ty in TYPES.values():
        top = sorted([r for r in rows if r["장"] == ty and r["n"] >= 5], key=lambda r: -abs(r["중앙 백분위"] - 50))[:5]
        print(f"   {ty:4s} " + " | ".join(f"{r['이름']} {r['중앙 백분위']:.0f}({r['같은 쪽'] * 100:.0f}%·{r['n']})" for r in top))


if __name__ == "__main__":
    main()
