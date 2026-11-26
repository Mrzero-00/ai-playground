"""장 직전 양상 찾기 루프 (RESEARCH.md '장 직전 양상 찾기 루프'). 회차마다 가설 하나를 '그날 알 수 있는 것으로 켜지는 규칙' 으로 만들어,
켜진 날의 뒤 30일 장 비율을 평소와 견준다(찾는 기간 2020 ~ 2025 · 검증 기간 2018 ~ 2019 · 2026 ~).
사용법: cd scripts/lab && python3 precursor_loop.py <회차>   → data/lab/precursor_loop.json
"""
import json
import sys
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
import precursor as P1
import precursor2 as P2

OUT = C.OUT / "precursor_loop.json"
PCT_FN = [P1.expanding_pct]  # 18회차부터 바꿔 끼울 수 있다


def pct_of(x):
    return PCT_FN[0](x)


def rolling_pct(x, window=1095, minimum=365):
    """지난 3년(달력 1,095일) 값 안에서의 백분위(0 ~ 100), 값이 365개 이상일 때."""
    def f(a):
        v = a[-1]
        if np.isnan(v):
            return np.nan
        a = a[~np.isnan(a)]
        if len(a) < minimum:
            return np.nan
        return ((a < v).sum() + (a <= v).sum()) / 2 / len(a) * 100
    return x.rolling(window, min_periods=1).apply(f, raw=True)
UP, DOWN = ("대상승", "상승"), ("하락", "대하락")
CODE = {n: g for g, n in P1.TYPES.items()}


def context():
    """지표 34개의 백분위(그날까지), 업비트 종가, 뒤 30일 장(변동성 기준 · 가격 변화율 기준)."""
    days = pd.date_range("2017-09-25", "2026-11-25")
    macro = P1.macro_series(days)
    raw, closes = {}, {}
    for s in P1.SYMS:
        closes[s], raw[s] = P1.raw_features(s, days, macro)
    names = {**P1.NAMES, **P2.NEW}
    ctx = {"days": days, "closes": closes, "names": names, "raw": {}, "pct": {}, "fv": {}, "fa": {}}
    for s in P1.SYMS:
        X = {**raw[s], **P2.new_raw(s, days, raw[s], closes[s], closes)}
        ctx["raw"][s] = X
        ctx["pct"][s] = {k: (X[k] if k in P2.RAW else pct_of(X[k])) for k in names}
        ctx["fv"][s], ctx["fa"][s] = P1.forward_grade(closes[s]), P2.forward_abs(closes[s])
    return ctx


def period_mask(idx, pn):
    d = idx.strftime("%Y-%m-%d")
    if pn == "찾기":
        return (d >= P1.FIND[0]) & (d <= P1.FIND[1])
    return np.any([(d >= a) & (d <= b) for a, b in P1.HOLD], axis=0)


def test_rule(ctx, on, labels="fv"):
    """on[코인] = 규칙이 켜진 날(bool Series). 기간마다 켜진 날 수와, 장마다 (켜진 날에서 뒤 30일이 그 장인 비율, 평소 비율, 배수)."""
    res = {}
    for pn in ("찾기", "검증"):
        hit, base = [], []
        for s in P1.SYMS:
            fg = ctx[labels][s]
            ok = fg.notna() & (fg.index >= "2018-01-01") & period_mask(fg.index, pn)
            o = on[s].reindex(fg.index).fillna(False).astype(bool)
            hit.append(fg[ok & o].to_numpy())
            base.append(fg[ok].to_numpy())
        h, b = np.concatenate(hit), np.concatenate(base)
        r = {"켜진 날": int(len(h))}
        for name, g in CODE.items():
            p, q = (float(np.mean(h == g)) if len(h) else None), float(np.mean(b == g))
            r[name] = {"켜졌을 때": p, "평소": q, "배수": (p / q if p is not None and q > 0 else None)}
        res[pn] = r
    return res


def success(res):
    """성공 조건: 한 장이 두 기간 모두 1.5배 넘게, 켜진 날 두 기간 모두 100일 이상, 반대 방향 장은 두 기간 모두 1.2배 미만."""
    if any(res[pn]["켜진 날"] < 100 for pn in res):
        return []
    won = []
    for ty in UP + DOWN:
        other = DOWN if ty in UP else UP
        if all((res[pn][ty]["배수"] or 0) > 1.5 for pn in res) and all((res[pn][o]["배수"] or 0) < 1.2 for pn in res for o in other):
            won.append(ty)
    return won


def show(name, res):
    def fmt(pn):
        r = res[pn]
        return f"{pn} {r['켜진 날']}일: " + " · ".join(f"{ty} ×{r[ty]['배수']:.2f}" if r[ty]["배수"] is not None else f"{ty} -" for ty in CODE)
    w = success(res)
    print(f"   {name:40s} {fmt('찾기')} | {fmt('검증')}" + (f"  ★ 성공: {', '.join(w)}" if w else ""))
    return w


def r3(ctx):
    """조용함(볼린저 폭 백분위 ≤ 30) + 방향 단서 하나(백분위 ≥ 70 또는 ≤ 30)."""
    out = {}
    for k in ("fund", "taker_s", "kimchi", "fng", "spx"):
        for side, f in (("높음", lambda x: x >= 70), ("낮음", lambda x: x <= 30)):
            on = {s: (ctx["pct"][s]["bbw"] <= 30) & f(ctx["pct"][s][k]) for s in P1.SYMS}
            out[f"조용함 + {ctx['names'][k]} {side}"] = test_rule(ctx, on)
    return out


def stock_state(col, days):
    """주가 지수(거래일)의 200거래일선 위·아래와 지난 20거래일 변화, 달력 날짜로(빈 날은 앞 값)."""
    m = pd.read_csv(C.ML / "macro.csv", parse_dates=["date"], index_col="date")[col].dropna().astype(float)
    above = (m > m.rolling(200).mean()).where(m.rolling(200).mean().notna())
    up = (m.pct_change(20) > 0).where(m.pct_change(20).notna())
    return P1.cal(above.astype(float), days), P1.cal(up.astype(float), days), P1.cal(m, days)


def r5(ctx):
    days = ctx["days"]
    out, rules = {}, {}
    for col, nm in (("S&P 500", "S&P 500"), ("나스닥", "나스닥")):
        above, up, _ = stock_state(col, days)
        for a_v, a_n in ((1.0, "200일선 위"), (0.0, "200일선 아래")):
            for u_v, u_n in ((1.0, "20일 오름"), (0.0, "20일 내림")):
                rules[f"{nm} {a_n} · {u_n}"] = {s: (above == a_v) & (up == u_v) for s in P1.SYMS}
    _, _, nq = stock_state("나스닥", days)
    for side, f in (("높음", lambda x: x >= 70), ("낮음", lambda x: x <= 30)):
        rel = {s: pct_of(ctx["closes"][s] / ctx["closes"][s].shift(30) - 1 - (nq / nq.shift(30) - 1)) for s in P1.SYMS}
        rules[f"코인 상대 강도(나스닥 대비) {side}"] = {s: f(rel[s]) for s in P1.SYMS}
    v = pd.read_csv(C.ML / "risk.csv", parse_dates=["date"], index_col="date").VIX.dropna().astype(float)
    vj = pct_of(P1.cal(v - v.shift(5), days))
    rules["VIX 급등(5일 변화 상위 10%)"] = {s: vj >= 90 for s in P1.SYMS}
    for name, on in rules.items():
        out[name] = test_rule(ctx, on)
        out[f"조용함 + {name}"] = test_rule(ctx, {s: on[s] & (ctx["pct"][s]["bbw"] <= 30) for s in P1.SYMS})
    return out


WIKI = {"BTC": {"영문": "en:Bitcoin", "한국어": "ko:비트코인"}, "ETH": {"영문": "en:Ethereum", "한국어": "ko:이더리움"}}


def r6(ctx):
    """대중의 관심: 위키백과 조회수 7일 ÷ 90일 평균의 백분위. 하루치는 공개가 몇 시간 늦어 전날 값까지만 쓴다."""
    v = pd.read_csv(C.ML / "wiki_views.csv", parse_dates=["date"])
    out = {}
    for lang in ("영문", "한국어"):
        att, up7 = {}, {}
        for s in P1.SYMS:
            x = v[v.article == WIKI[s][lang]].set_index("date").views.astype(float).reindex(ctx["days"]).shift(1)
            att[s] = pct_of(x.rolling(7).mean() / x.rolling(90).mean())
            c = ctx["closes"][s]
            up7[s] = c / c.shift(7) - 1
        out[f"{lang} 관심 급증(상위 10%)"] = test_rule(ctx, {s: att[s] >= 90 for s in P1.SYMS})
        out[f"{lang} 관심 낮음(하위 10%)"] = test_rule(ctx, {s: att[s] <= 10 for s in P1.SYMS})
        out[f"{lang} 관심 급증 × 7일 오름"] = test_rule(ctx, {s: (att[s] >= 90) & (up7[s] > 0) for s in P1.SYMS})
        out[f"{lang} 관심 급증 × 7일 내림"] = test_rule(ctx, {s: (att[s] >= 90) & (up7[s] < 0) for s in P1.SYMS})
    return out


RATES = ("기준금리", "2년물", "10년물", "장단기 금리차")  # 금리는 %p 변화, 나머지는 % 변화


def assets():
    """거래일 자료: FRED 여섯과 금(PAXG 종가, 코인과 같은 날 마감)."""
    a = pd.read_csv(C.ML / "assets.csv", parse_dates=["date"], index_col="date").astype(float)
    out = {k: a[k].dropna() for k in a.columns}
    out["금"] = pd.read_csv(C.ML / "spot_PAXG.csv", parse_dates=["date"], index_col="date").close.astype(float)
    return out


def change(x, n, rate):
    return x - x.shift(n) if rate else x / x.shift(n) - 1


def correlations(ctx, A):
    """서술: 코인 날마다 수익과 자산 날마다 변화의 순위 상관(같은 날, 전체·해마다), 30일 간격 30일 변화끼리의 순위 상관."""
    out = {}
    for s in P1.SYMS:
        c = ctx["closes"][s].dropna()
        rc = c.pct_change()
        for k, x in A.items():
            dx = change(x, 1, k in RATES)
            j = pd.concat([rc, dx], axis=1, join="inner").dropna()
            j = j[j.index >= "2018-01-01"]
            yrs = {str(y): float(g.iloc[:, 0].corr(g.iloc[:, 1], method="spearman")) for y, g in j.groupby(j.index.year) if len(g) > 50}
            m = pd.concat([c, x], axis=1, join="inner").dropna()
            m = m[m.index >= "2018-01-01"].iloc[::21]  # 약 30일(21거래일) 간격
            m30 = pd.concat([m.iloc[:, 0].pct_change(), change(m.iloc[:, 1], 1, k in RATES)], axis=1).dropna()
            out.setdefault(s, {})[k] = {"날마다": float(j.iloc[:, 0].corr(j.iloc[:, 1], method="spearman")), "해마다": yrs,
                                        "30일": float(m30.iloc[:, 0].corr(m30.iloc[:, 1], method="spearman")), "날 수": int(len(j))}
    return out


def r8(ctx):
    A = assets()
    ctx["상관"] = correlations(ctx, A)
    out = {}
    for k, x in A.items():
        lag = 0 if k == "금" else 1  # 미국 자료는 하루 늦춰 쓴다(발표가 늦은 것이 있다)
        xs = x.shift(lag)
        ch = pct_of(P1.cal(change(P1.cal(xs, ctx["days"]), 30, k in RATES), ctx["days"]))
        above = P1.cal((xs > xs.rolling(200).mean()).astype(float).where(xs.rolling(200).mean().notna()), ctx["days"])
        unit = "%p" if k in RATES else "%"
        out[f"{k} 30일 급등(상위 10%)"] = test_rule(ctx, {s: ch >= 90 for s in P1.SYMS})
        out[f"{k} 30일 급락(하위 10%)"] = test_rule(ctx, {s: ch <= 10 for s in P1.SYMS})
        out[f"{k} 200일 평균 위"] = test_rule(ctx, {s: above == 1.0 for s in P1.SYMS})
        out[f"{k} 200일 평균 아래"] = test_rule(ctx, {s: above == 0.0 for s in P1.SYMS})
    return out


def r9(ctx):
    """조용함 뒤 첫 밴드 밖 종가(2차 '다' 와 같은 사건), 그날 거래대금 ≥ 지난 90일 평균 × 1.5 면 거래량 확인. 돌파한 날부터 5일 켜짐."""
    out, on = {}, {}
    for s in P1.SYMS:
        c = ctx["closes"][s].dropna()
        v = pd.read_csv(C.ROOT / "data" / f"KRW-{s}.csv", parse_dates=["date"], index_col="date").value.astype(float).reindex(c.index)
        vr = v / v.shift(1).rolling(90).mean()
        for e in P2.breakouts(c, ctx["pct"][s]["bbw"].reindex(c.index)):
            conf = bool(vr.get(e["날"], np.nan) >= 1.5)
            span = pd.date_range(e["날"], periods=5)
            for key in (f"{e['방향']} 돌파", f"{e['방향']} 돌파 + 거래량 확인" if conf else None):
                if key:
                    on.setdefault(key, {x: pd.Series(False, index=ctx["days"]) for x in P1.SYMS})[s].loc[span.intersection(ctx["days"])] = True
    for key in ("위 돌파 + 거래량 확인", "아래 돌파 + 거래량 확인", "위 돌파", "아래 돌파"):
        out[key] = test_rule(ctx, on[key])
    return out


def r10(ctx, L=30, K=20, SEP=10, LAG=60):
    """직전 30일 경로(첫날 0, 그 30일 일 변동성으로 나눔)가 가장 닮은 과거 20개(60일 넘게 앞선, 서로 10일 넘게 떨어진)의 뒤 30일 장 다수결."""
    shapes, dates, labels, owner = [], [], [], []
    for s in P1.SYMS:
        lr = np.log(ctx["closes"][s].dropna())
        a = lr.to_numpy()
        for i in range(L, len(a)):
            w = a[i - L + 1:i + 1] - a[i - L + 1]
            sd = np.std(np.diff(a[i - L:i + 1]))
            if sd > 0:
                shapes.append(w / sd)
                dates.append(lr.index[i])
                labels.append(ctx["fv"][s].get(lr.index[i], np.nan))
                owner.append(s)
    X, D, Y, O = np.array(shapes), pd.DatetimeIndex(dates), np.array(labels, float), np.array(owner)
    dn = D.to_numpy().astype("datetime64[D]").astype(np.int64)
    vote = {s: pd.Series(np.nan, index=ctx["days"]) for s in P1.SYMS}
    share = {g: {s: pd.Series(np.nan, index=ctx["days"]) for s in P1.SYMS} for g in (2, 1, -1, -2)}
    for q in np.flatnonzero(D >= "2018-01-01"):
        pool = np.flatnonzero((dn <= dn[q] - LAG) & ~np.isnan(Y))
        if len(pool) < 365:
            continue
        order = pool[np.argsort(((X[pool] - X[q]) ** 2).sum(1))]
        picked = []
        for j in order:
            if all(abs(dn[j] - dn[m]) > SEP for m in picked):
                picked.append(j)
                if len(picked) == K:
                    break
        y = Y[picked].astype(int)
        cnt = np.bincount(y + 2, minlength=5)
        top = np.flatnonzero(cnt == cnt.max())
        vote[O[q]].loc[D[q]] = top[0] - 2 if len(top) == 1 else np.nan
        for g in share:
            share[g][O[q]].loc[D[q]] = cnt[g + 2] / K
    out = {}
    for g, nm in ((2, "대상승"), (1, "상승"), (-1, "하락"), (-2, "대하락")):
        out[f"닮은 과거 다수결 {nm}"] = test_rule(ctx, {s: vote[s] == g for s in P1.SYMS})
        out[f"닮은 과거 20개 중 {nm} 절반 이상"] = test_rule(ctx, {s: share[g][s] >= 0.5 for s in P1.SYMS})
    return out


def r11(ctx):
    """유동성: 미국 순유동성(WALCL − TGA − 역레포 × 1,000, 7일 늦춤) · 스테이블코인 시가총액(하루 늦춤)."""
    days = ctx["days"]
    lq = pd.read_csv(C.ML / "liquidity.csv", parse_dates=["date"], index_col="date").astype(float)
    full = pd.date_range(lq.index.min(), days[-1])
    lq = lq.reindex(full).ffill()
    net = (lq.walcl - lq.tga - lq.rrp.fillna(0.0) * 1000).shift(7)
    st = pd.read_csv(C.ML / "stable.csv", parse_dates=["date"], index_col="date")["전체"].astype(float)
    st = st.reindex(pd.date_range(st.index.min(), days[-1])).ffill().shift(1)
    out = {}
    for name, x in (("미국 순유동성", net), ("스테이블코인 시가총액", st)):
        ch = pct_of((x / x.shift(30) - 1).reindex(days))
        above = (x > x.rolling(200).mean()).astype(float).where(x.rolling(200).mean().notna()).reindex(days)
        out[f"{name} 30일 급증(상위 10%)"] = test_rule(ctx, {s: ch >= 90 for s in P1.SYMS})
        out[f"{name} 30일 급감(하위 10%)"] = test_rule(ctx, {s: ch <= 10 for s in P1.SYMS})
        out[f"{name} 200일 평균 위"] = test_rule(ctx, {s: above == 1.0 for s in P1.SYMS})
        out[f"{name} 200일 평균 아래"] = test_rule(ctx, {s: above == 0.0 for s in P1.SYMS})
    return out


def r13(ctx):
    """레버리지 · 청산 대리: 무기한 ÷ 현물 거래대금(7일), 펀딩비 극단 × 지난 7일 가격 방향."""
    out, lev = {}, {}
    for s in P1.SYMS:
        pq = pd.read_csv(C.ML / f"perp_{s}.csv", parse_dates=["date"], index_col="date").quote_volume.astype(float).reindex(ctx["days"])
        sq = pd.read_csv(C.ML / f"spot_{s}.csv", parse_dates=["date"], index_col="date").quote_volume.astype(float).reindex(ctx["days"])
        lev[s] = pct_of((pq / sq).rolling(7).mean())
    up7 = {s: ctx["closes"][s] / ctx["closes"][s].shift(7) - 1 for s in P1.SYMS}
    f = {s: ctx["pct"][s]["fund"] for s in P1.SYMS}
    out["레버리지 거래 비중 높음(상위 10%)"] = test_rule(ctx, {s: lev[s] >= 90 for s in P1.SYMS})
    out["레버리지 거래 비중 낮음(하위 10%)"] = test_rule(ctx, {s: lev[s] <= 10 for s in P1.SYMS})
    out["펀딩비 상위 10% × 7일 내림(롱 몰린 채 밀림)"] = test_rule(ctx, {s: (f[s] >= 90) & (up7[s] < 0) for s in P1.SYMS})
    out["펀딩비 하위 10% × 7일 오름(숏 스퀴즈)"] = test_rule(ctx, {s: (f[s] <= 10) & (up7[s] > 0) for s in P1.SYMS})
    out["레버리지 비중 높음 × 조용함"] = test_rule(ctx, {s: (lev[s] >= 90) & (ctx["pct"][s]["bbw"] <= 30) for s in P1.SYMS})
    return out


def r14(ctx):
    """4시간봉 매수세: 판단 직전 4시간봉(UTC 20 ~ 24시)의 테이커 매수 비율, 지난 24시간 거래대금 ÷ 지난 30일 하루 평균 × 24시간 가격 방향."""
    out, last, surge, move = {}, {}, {}, {}
    for s in P1.SYMS:
        h = pd.read_csv(C.ML / f"perp4ht_{s}.csv", parse_dates=["time"]).set_index("time").astype(float)
        day = h.index.normalize()  # UTC 날짜 = 코인 일봉 날짜(09:00 KST 마감)
        lb = h[h.index.hour == 20]
        last[s] = pct_of((lb.taker_buy_quote / lb.quote_volume).set_axis(lb.index.normalize()).reindex(ctx["days"]))
        qd = h.quote_volume.groupby(day).sum().reindex(ctx["days"])
        surge[s] = pct_of(qd / qd.shift(1).rolling(30).mean())
        cd = h.close.groupby(day).last().reindex(ctx["days"])
        move[s] = cd / cd.shift(1) - 1
    out["직전 4시간 매수세 강함(상위 10%)"] = test_rule(ctx, {s: last[s] >= 90 for s in P1.SYMS})
    out["직전 4시간 매수세 약함(하위 10%)"] = test_rule(ctx, {s: last[s] <= 10 for s in P1.SYMS})
    out["24시간 거래 급증 × 오름"] = test_rule(ctx, {s: (surge[s] >= 90) & (move[s] > 0) for s in P1.SYMS})
    out["24시간 거래 급증 × 내림"] = test_rule(ctx, {s: (surge[s] >= 90) & (move[s] < 0) for s in P1.SYMS})
    return out


def r16(ctx):
    """짧은 시계열 모멘텀(Liu · Tsyvinski 2021): 지난 1 · 2 · 3 · 4주 수익이 그 코인 자기 과거의 상위 · 하위 10%."""
    out = {}
    for w in (1, 2, 3, 4):
        m = {s: pct_of(ctx["closes"][s] / ctx["closes"][s].shift(7 * w) - 1) for s in P1.SYMS}
        out[f"지난 {w}주 수익 상위 10%"] = test_rule(ctx, {s: m[s] >= 90 for s in P1.SYMS})
        out[f"지난 {w}주 수익 하위 10%"] = test_rule(ctx, {s: m[s] <= 10 for s in P1.SYMS})
    return out


def r17(ctx):
    """퍼엘 배수: BTC 하루 발행량 달러 가치 ÷ 365일 평균(하루 늦춤), 두 코인에 같이."""
    iss = pd.read_csv(C.ML / "issuance_BTC.csv", parse_dates=["date"], index_col="date").iss_usd.astype(float)
    puell = (iss / iss.rolling(365).mean()).shift(1)
    pu = puell.reindex(ctx["days"])
    pp = pct_of(pu)
    ctx["퍼엘 최근"] = {str(d.date()): float(v) for d, v in pu.dropna().tail(3).items()}
    return {"퍼엘 < 0.5 (출처: 큰 바닥)": test_rule(ctx, {s: pu < 0.5 for s in P1.SYMS}),
            "퍼엘 > 4 (출처: 큰 꼭대기)": test_rule(ctx, {s: pu > 4 for s in P1.SYMS}),
            "퍼엘 하위 10%": test_rule(ctx, {s: pp <= 10 for s in P1.SYMS}),
            "퍼엘 상위 10%": test_rule(ctx, {s: pp >= 90 for s in P1.SYMS})}


def r18(ctx):
    """3 · 5 · 6 · 8 · 9 · 11 · 13 · 14 · 16 · 17회차 규칙 전부를 지난 3년 백분위로 다시."""
    PCT_FN[0] = rolling_pct
    try:
        c2 = context()
        out = {}
        for k in (3, 5, 6, 8, 9, 11, 13, 14, 16, 17):
            for name, res in ROUNDS[k](c2).items():
                out[f"[{k}] {name}"] = res
    finally:
        PCT_FN[0] = P1.expanding_pct
    return out


def r19(ctx):
    """문턱 이웃: 조용함(볼린저 폭 ≤ 20 · 30 · 40) × 공포·탐욕 / 나스닥 대비 상대 강도(≥ 60 · 70 · 80), 3년 이동 백분위."""
    PCT_FN[0] = rolling_pct
    try:
        c2 = context()
        _, _, nq = stock_state("나스닥", c2["days"])
        rel = {s: rolling_pct(c2["closes"][s] / c2["closes"][s].shift(30) - 1 - (nq / nq.shift(30) - 1)) for s in P1.SYMS}
        out = {}
        for q in (20, 30, 40):
            for g in (60, 70, 80):
                out[f"조용함 ≤ {q} + 공포·탐욕 ≥ {g}"] = test_rule(c2, {s: (c2["pct"][s]["bbw"] <= q) & (c2["pct"][s]["fng"] >= g) for s in P1.SYMS})
                out[f"조용함 ≤ {q} + 상대 강도 ≥ {g}"] = test_rule(c2, {s: (c2["pct"][s]["bbw"] <= q) & (rel[s] >= g) for s in P1.SYMS})
    finally:
        PCT_FN[0] = P1.expanding_pct
    for fam in ("공포·탐욕", "상대 강도"):
        cells = [n for n in out if fam in n and isinstance(out[n], dict)]  # 22회차가 규칙만 모을 때는 건너뛴다
        if not cells:
            continue
        print(f"   {fam}: 9칸 중 대상승 성공 {sum('대상승' in success(out[n]) for n in cells)}칸")
    return out


def r21(ctx):
    """약한 상승 신호 다섯(+1씩): 2주 모멘텀 · 상대 강도 · 관심 × 오름 · 순유동성 200일 위 · 2년물 200일 아래. 3년 이동 백분위."""
    PCT_FN[0] = rolling_pct
    try:
        c2 = context()
        days = c2["days"]
        _, _, nq = stock_state("나스닥", days)
        v = pd.read_csv(C.ML / "wiki_views.csv", parse_dates=["date"])
        lq = pd.read_csv(C.ML / "liquidity.csv", parse_dates=["date"], index_col="date").astype(float)
        lq = lq.reindex(pd.date_range(lq.index.min(), days[-1])).ffill()
        net = (lq.walcl - lq.tga - lq.rrp.fillna(0.0) * 1000).shift(7)
        liq_up = (net > net.rolling(200).mean()).astype(float).where(net.rolling(200).mean().notna()).reindex(days)
        y2 = pd.read_csv(C.ML / "assets.csv", parse_dates=["date"], index_col="date")["2년물"].dropna().astype(float).shift(1)
        rate_dn = P1.cal((y2 < y2.rolling(200).mean()).astype(float).where(y2.rolling(200).mean().notna()), days)
        score = {}
        for s in P1.SYMS:
            c = c2["closes"][s]
            mom = rolling_pct(c / c.shift(14) - 1) >= 70
            rel = rolling_pct(c / c.shift(30) - 1 - (nq / nq.shift(30) - 1)) >= 70
            att = []
            for lang in ("영문", "한국어"):
                x = v[v.article == WIKI[s][lang]].set_index("date").views.astype(float).reindex(days).shift(1)
                att.append(rolling_pct(x.rolling(7).mean() / x.rolling(90).mean()))
            attn = ((att[0] + att[1]) / 2 >= 70) & (c / c.shift(7) - 1 > 0)
            parts = [mom, rel, attn, liq_up == 1.0, rate_dn == 1.0]
            score[s] = sum(pd.Series(x, index=days).fillna(False).astype(int) for x in parts)
        out = {f"합계 ≥ {k}": test_rule(c2, {s: score[s] >= k for s in P1.SYMS}) for k in (3, 4)}
        out["합계 = 5"] = test_rule(c2, {s: score[s] == 5 for s in P1.SYMS})
        out["합계 ≤ 1 (참고)"] = test_rule(c2, {s: score[s] <= 1 for s in P1.SYMS})
    finally:
        PCT_FN[0] = P1.expanding_pct
    return out


def test_dir(ctx, on, h):
    """방향만: 기간마다 켜진 날 수, 켜진 날 뒤 h 일에 오른 비율, 평소 오른 비율."""
    res = {}
    for pn in ("찾기", "검증"):
        hit, base = [], []
        for s in P1.SYMS:
            c = ctx["closes"][s]
            up = (c.shift(-h) / c - 1).dropna() > 0
            up = up[(up.index >= "2018-01-01") & period_mask(up.index, pn)]
            o = on[s].reindex(up.index).fillna(False).astype(bool)
            hit.append(up[o].to_numpy())
            base.append(up.to_numpy())
        hh, bb = np.concatenate(hit), np.concatenate(base)
        res[pn] = {"켜진 날": int(len(hh)), "오른 비율": float(hh.mean()) if len(hh) else None, "평소": float(bb.mean())}
    return res


def dir_success(res):
    if any(res[pn]["켜진 날"] < 100 for pn in res):
        return None
    d = [res[pn]["오른 비율"] - res[pn]["평소"] for pn in res]
    return "오름" if all(x > 0.10 for x in d) else ("내림" if all(x < -0.10 for x in d) else None)


def r22(ctx):
    """18회차 대상 + 19 · 21회차 규칙을 뒤 30 · 60일 부호로. test_rule 을 잠시 바꿔 규칙(켜진 날)만 모은다."""
    masks = []
    real = globals()["test_rule"]
    globals()["test_rule"] = lambda cx, on, labels="fv": (masks.append(on), len(masks) - 1)[1]
    try:
        PCT_FN[0] = rolling_pct
        c2 = context()
        names = {}
        for k in (3, 5, 6, 8, 9, 11, 13, 14, 16, 17, 19, 21):
            PCT_FN[0] = rolling_pct
            for name, idx in ROUNDS[k](c2).items():
                names[f"[{k}] {name}"] = idx
    finally:
        globals()["test_rule"] = real
        PCT_FN[0] = P1.expanding_pct
    out, won = {}, {}
    for name, idx in names.items():
        for h in (30, 60):
            r = test_dir(c2, masks[idx], h)
            out[f"{name} · {h}일"] = r
            w = dir_success(r)
            if w:
                won[f"{name} · {h}일"] = w
    c2["방향 성공"] = won
    return out


NEW = ("2014-01-01", "2017-12-31")  # 23회차: 처음 보는 기간(BTC)


def eval_new(on, c, fv):
    """새 기간에서 켜진 날 수, 다섯 장 배수, 뒤 30 · 60일 오른 비율(평소)."""
    m = (c.index >= NEW[0]) & (c.index <= NEW[1])
    o = on.reindex(c.index).fillna(False).astype(bool)
    f = fv.reindex(c.index)
    ok = m & f.notna()
    r = {"켜진 날": int((ok & o).sum())}
    for g, nm in P1.TYPES.items():
        p_, q_ = (f[ok & o] == g).mean() if (ok & o).any() else np.nan, (f[ok] == g).mean()
        r[nm] = float(p_ / q_) if q_ > 0 and not np.isnan(p_) else None
    for h in (30, 60):
        up = (c.shift(-h) / c - 1 > 0)[m & c.shift(-h).notna()]
        oo = o.reindex(up.index)
        r[f"{h}일 오름"] = float(up[oo].mean()) if oo.any() else None
        r[f"{h}일 평소"] = float(up.mean())
    return r


def r23(ctx):
    """BTC 2014 ~ 2017(처음 보는 기간)에서 규칙 11개를 다시. Coin Metrics 달러 종가 · 발행량, FRED(2010 ~), 3년 이동 백분위."""
    c = pd.read_csv(C.ML / "cmprice_BTC.csv", parse_dates=["date"], index_col="date").close.astype(float)
    days = pd.date_range(c.index.min(), "2026-11-25")
    c = c.reindex(days).ffill()
    fv = P1.forward_grade(c)
    sd20, m20 = c.rolling(20).std(), c.rolling(20).mean()
    quiet = rolling_pct(4 * sd20 / m20) <= 30
    nqa = pd.read_csv(C.ML / "macro.csv", parse_dates=["date"], index_col="date")["나스닥"].dropna().astype(float)
    nq = P1.cal(nqa, days)
    above = P1.cal((nqa > nqa.rolling(200).mean()).astype(float).where(nqa.rolling(200).mean().notna()), days)
    up20 = P1.cal((nqa.pct_change(20) > 0).astype(float).where(nqa.pct_change(20).notna()), days)
    rel = rolling_pct(c / c.shift(30) - 1 - (nq / nq.shift(30) - 1))
    iss = pd.read_csv(C.ML / "issuance_BTC.csv", parse_dates=["date"], index_col="date").iss_usd.astype(float)
    puell = (iss / iss.rolling(365).mean()).shift(1).reindex(days)
    a = pd.read_csv(C.ML / "assets_long.csv", parse_dates=["date"], index_col="date").astype(float)
    ff = a["기준금리"].dropna().shift(1)
    ff_jump = rolling_pct(P1.cal(ff, days) - P1.cal(ff, days).shift(30)) >= 90
    y2 = a["2년물"].dropna().shift(1)
    y2_dn = P1.cal((y2 < y2.rolling(200).mean()).astype(float).where(y2.rolling(200).mean().notna()), days) == 1.0
    oil = P1.cal(a["유가"].dropna().shift(1), days)
    oil_jump = rolling_pct(oil / oil.shift(30) - 1) >= 90
    lq = pd.read_csv(C.ML / "liquidity.csv", parse_dates=["date"], index_col="date").astype(float)
    lq = lq.reindex(pd.date_range(lq.index.min(), days[-1])).ffill()
    net = (lq.walcl - lq.tga - lq.rrp.fillna(0.0) * 1000).shift(7).reindex(days)
    liq_jump = rolling_pct(net / net.shift(30) - 1) >= 90
    v = pd.read_csv(C.ML / "wiki_views.csv", parse_dates=["date"])
    x = v[v.article == "en:Bitcoin"].set_index("date").views.astype(float).reindex(days).shift(1)
    attn = rolling_pct(x.rolling(7).mean() / x.rolling(90).mean()) >= 90
    stock_bear = (above == 0.0) & (up20 == 0.0)
    rules = {  # 이름 → (켜진 날, 주장: 장 이름 또는 '30일 오름' 같은 방향)
        "R1 조용함 + 상대 강도 ≥ 70": (quiet & (rel >= 70), "대상승"),
        "R2 지난 2주 수익 상위 10%": (rolling_pct(c / c.shift(14) - 1) >= 90, "상승"),
        "R3 지난 3주 수익 상위 10%": (rolling_pct(c / c.shift(21) - 1) >= 90, "상승"),
        "R4 퍼엘 < 0.5": (puell < 0.5, "60일 오름"),
        "R5 나스닥 200일 아래 · 20일 내림": (stock_bear, "대하락"),
        "R6 조용함 + 나스닥 200일 아래 · 20일 내림": (quiet & stock_bear, "대하락"),
        "R7 기준금리 30일 급등": (ff_jump, "30일 내림"),
        "R8 2년물 200일 평균 아래": (y2_dn, "대상승"),
        "R9 미국 순유동성 30일 급증": (liq_jump, "60일 오름"),
        "R10 유가 30일 급등": (oil_jump, "60일 오름"),
        "R11 영문 관심 급증": (attn, "60일 오름")}
    out = {}
    for name, (on, claim) in rules.items():
        r = eval_new(on.fillna(False), c, fv)
        r["주장"] = claim
        if r["켜진 날"] < 100:
            r["새 기간"] = "표본 부족"
        elif claim in ("30일 오름", "60일 오름", "30일 내림", "60일 내림"):
            h = claim[:3]
            d = (r[f"{h} 오름"] or 0) - r[f"{h} 평소"]
            r["새 기간"] = "통과" if (d > 0.10 if "오름" in claim else d < -0.10) else "실패"
        else:
            opp = ("하락", "대하락") if claim in ("대상승", "상승") else ("대상승", "상승")
            r["새 기간"] = "통과" if (r[claim] or 0) > 1.5 and all((r[o] or 0) < 1.2 for o in opp) else "실패"
        out[name] = r
    return out


def r25(ctx):
    """MVRV-Z(시가총액 − 실현 시가총액) ÷ 처음부터 쌓인 시가총액 표준편차 · SSR(코인 시가총액 ÷ 스테이블코인 시가총액). 하루 늦춤, 3년 이동 백분위."""
    PCT_FN[0] = rolling_pct
    try:
        c2 = context()
        days = c2["days"]
        st = pd.read_csv(C.ML / "stable.csv", parse_dates=["date"], index_col="date")["전체"].astype(float)
        st = st.reindex(pd.date_range(st.index.min(), days[-1])).ffill()
        rules = {}
        for s in P1.SYMS:
            cap = P1.per_asset("cap.csv", s, "cap")
            mv = P1.per_asset("mvrv.csv", s, "mvrv").reindex(cap.index)
            z = ((cap - cap / mv) / cap.expanding(365).std()).shift(1).reindex(days)
            ssr = (cap.reindex(st.index) / st).shift(1).reindex(days)
            ssr_n = ssr / ssr.rolling(200).mean()
            zp, sp, snp = rolling_pct(z), rolling_pct(ssr), rolling_pct(ssr_n)
            for name, on in (("MVRV-Z > 7", z > 7), ("MVRV-Z < 0", z < 0), ("MVRV-Z 상위 10%", zp >= 90), ("MVRV-Z 하위 10%", zp <= 10),
                             ("SSR 낮음(하위 10%, 대기 자금 많음)", sp <= 10), ("SSR 높음(상위 10%)", sp >= 90),
                             ("SSR ÷ 200일 평균 하위 10%", snp <= 10), ("SSR ÷ 200일 평균 상위 10%", snp >= 90)):
                rules.setdefault(name, {})[s] = on.fillna(False)
        out = {n: test_rule(c2, on) for n, on in rules.items()}
        ctx["dir"] = {f"{n} · {h}일": test_dir(c2, on, h) for n, on in rules.items() for h in (30, 60)}
    finally:
        PCT_FN[0] = P1.expanding_pct
    return out


def hurst_rs(x, sizes=(8, 16, 32, 64, 128)):
    """R/S 허스트 지수: 조각 크기마다 (범위 ÷ 표준편차)의 평균, log 크기에 대한 log R/S 기울기."""
    rs = []
    for n in sizes:
        ch = x[: len(x) // n * n].reshape(-1, n)
        y = ch - ch.mean(1, keepdims=True)
        z = np.cumsum(y, 1)
        sd = ch.std(1)
        ok = sd > 0
        rs.append(np.mean((z.max(1) - z.min(1))[ok] / sd[ok]) if ok.any() else np.nan)
    rs = np.array(rs)
    return np.polyfit(np.log(sizes), np.log(rs), 1)[0] if np.isfinite(rs).all() else np.nan


def r29(ctx):
    """허스트 지수(지난 128일 R/S) × 지난 30일 방향."""
    PCT_FN[0] = rolling_pct
    try:
        c2 = context()
        rules = {}
        for s in P1.SYMS:
            c = c2["closes"][s]
            lr = np.log(c).diff()
            h = lr.rolling(128).apply(lambda a: hurst_rs(a) if np.isfinite(a).all() else np.nan, raw=True)
            hp = rolling_pct(h)
            up, dn = c / c.shift(30) - 1 > 0, c / c.shift(30) - 1 < 0
            for name, on in (("H ≥ 0.6 × 30일 오름", (h >= 0.6) & up), ("H ≥ 0.6 × 30일 내림", (h >= 0.6) & dn), ("H ≤ 0.4", h <= 0.4),
                             ("H 상위 10% × 30일 오름", (hp >= 90) & up), ("H 상위 10% × 30일 내림", (hp >= 90) & dn), ("H 하위 10%", hp <= 10)):
                rules.setdefault(name, {})[s] = on.fillna(False)
            ctx.setdefault("허스트 요약", {})[s] = {"중앙값": float(h.median()), "0.6 이상 비율": float((h >= 0.6).mean()), "0.4 이하 비율": float((h <= 0.4).mean())}
        out = {n: test_rule(c2, on) for n, on in rules.items()}
        ctx["dir"] = {f"{n} · {hh}일": test_dir(c2, on, hh) for n, on in rules.items() for hh in (30, 60)}
    finally:
        PCT_FN[0] = P1.expanding_pct
    print("   허스트 요약:", ctx["허스트 요약"])
    return out


def r32(ctx, H_=60, STEP=30, MIN_TRAIN=500):
    """모든 지표를 한꺼번에: HistGradientBoosting(기본값)으로 뒤 60일 오름 확률을 워크포워드로."""
    from sklearn.ensemble import HistGradientBoostingClassifier
    PCT_FN[0] = rolling_pct
    try:
        c2 = context()
        days = c2["days"]
        _, _, nq = stock_state("나스닥", days)
        iss = pd.read_csv(C.ML / "issuance_BTC.csv", parse_dates=["date"], index_col="date").iss_usd.astype(float)
        puell = (iss / iss.rolling(365).mean()).shift(1).reindex(days)
        J = macro_jumps(days)  # (≥ 90 여부) — 값 자체가 필요해 다시 계산한다
        a = pd.read_csv(C.ML / "assets_long.csv", parse_dates=["date"], index_col="date").astype(float)
        oil = P1.cal(a["유가"].dropna().shift(1), days)
        lq = pd.read_csv(C.ML / "liquidity.csv", parse_dates=["date"], index_col="date").astype(float)
        lq = lq.reindex(pd.date_range(lq.index.min(), days[-1])).ffill()
        net = (lq.walcl - lq.tga - lq.rrp.fillna(0.0) * 1000).shift(7).reindex(days)
        rows = []
        for s in P1.SYMS:
            c = c2["closes"][s]
            X = pd.DataFrame({k: v for k, v in c2["pct"][s].items()}, index=days)
            X["puell"] = puell
            X["rel"] = rolling_pct(c / c.shift(30) - 1 - (nq / nq.shift(30) - 1))
            X["liq30"] = rolling_pct(net / net.shift(30) - 1)
            X["oil30"] = rolling_pct(oil / oil.shift(30) - 1)
            y = (c.shift(-H_) / c - 1 > 0).astype(float).where(c.shift(-H_).notna() & c.notna())
            X["_y"], X["_s"] = y, s
            rows.append(X[c.notna()])
        A = pd.concat(rows).rename_axis("date").reset_index().sort_values("date", kind="stable").reset_index(drop=True)
        cols = [k for k in A.columns if not k.startswith("_") and k != "date"]
        prob = {s: pd.Series(np.nan, index=days) for s in P1.SYMS}
        dates = np.sort(A.date.unique())
        start = np.searchsorted(dates, np.datetime64("2018-01-01"))
        for i in range(start, len(dates), STEP):
            d = dates[i]
            tr = A.date.to_numpy() <= d - np.timedelta64(H_, "D")
            tr &= A._y.notna().to_numpy()
            te = (A.date.to_numpy() >= d) & (A.date.to_numpy() < dates[min(i + STEP, len(dates) - 1)] if i + STEP < len(dates) else A.date.to_numpy() >= d)
            if tr.sum() < MIN_TRAIN or not te.any():
                continue
            m = HistGradientBoostingClassifier(random_state=0).fit(A.loc[tr, cols].to_numpy(float), A.loc[tr, "_y"].to_numpy(int))
            pr = m.predict_proba(A.loc[te, cols].to_numpy(float))[:, list(m.classes_).index(1)] if 1 in m.classes_ else np.zeros(te.sum())
            for s in P1.SYMS:
                k = (A.loc[te, "_s"] == s).to_numpy()
                prob[s].loc[pd.DatetimeIndex(A.loc[te, "date"].to_numpy()[k])] = pr[k]
        rules = {"오를 확률 ≥ 0.6": {s: prob[s] >= 0.6 for s in P1.SYMS}, "오를 확률 ≤ 0.4": {s: prob[s] <= 0.4 for s in P1.SYMS}}
        out = {n: test_rule(c2, on) for n, on in rules.items()}
        ctx["dir"] = {f"{n} · {h}일": test_dir(c2, on, h) for n, on in rules.items() for h in (30, 60)}
        first = min(prob[s].first_valid_index() for s in P1.SYMS)
        print(f"   예측이 있는 첫날 {first.date()} · 예측한 날 " + " · ".join(f"{s} {int(prob[s].notna().sum())}" for s in P1.SYMS))
    finally:
        PCT_FN[0] = P1.expanding_pct
    return out


HALVES = {"1991~2007": ("1991-01-01", "2007-12-31"), "2008~2025": ("2008-01-01", "2025-12-31")}


def nasdaq_test(on, x, gap=0.05, min_days=200):
    """나스닥(거래일): 켜진 날 뒤 21 · 42거래일 오른 비율 대 평소, 두 반쪽."""
    res = {}
    for h in (21, 42):
        up = (x.shift(-h) / x - 1 > 0).where(x.shift(-h).notna())
        for hn, (a, b) in HALVES.items():
            m = up.notna() & (up.index >= a) & (up.index <= b)
            o = on.reindex(up.index).fillna(False).astype(bool)
            res[f"{h}거래일 {hn}"] = {"켜진 날": int((m & o).sum()), "오른 비율": float(up[m & o].mean()) if (m & o).any() else None, "평소": float(up[m].mean())}
    for h in (21, 42):
        rs = [res[f"{h}거래일 {hn}"] for hn in HALVES]
        res[f"{h}거래일 확인"] = bool(all(r["켜진 날"] >= min_days and r["오른 비율"] is not None and r["오른 비율"] - r["평소"] > gap for r in rs))
    return res


def r33(ctx):
    """나스닥 '조용함 + 겁 없음': 볼린저 폭 3년 백분위 ≤ 30 × VIX 3년 백분위 ≤ 30."""
    x = pd.read_csv(C.ML / "macro.csv", parse_dates=["date"], index_col="date")["나스닥"].dropna().astype(float)
    vix = pd.read_csv(C.ML / "risk.csv", parse_dates=["date"], index_col="date").VIX.dropna().astype(float).reindex(x.index).ffill()
    bw = 4 * x.rolling(20).std() / x.rolling(20).mean()
    quiet = rolling_pct(bw, window=756, minimum=252) <= 30  # 거래일로 3년 · 1년
    calm = rolling_pct(vix, window=756, minimum=252) <= 30
    out = {"조용함 + 겁 없음": nasdaq_test(quiet & calm, x), "조용함만": nasdaq_test(quiet, x), "겁 없음만": nasdaq_test(calm, x)}
    for n, r in out.items():
        print(f"   {n:12s} " + " | ".join(f"{k}: {(r[k]['오른 비율'] or 0) * 100:4.1f}%(평소 {r[k]['평소'] * 100:4.1f}, {r[k]['켜진 날']}일)" for k in r if "확인" not in k)
              + f" | 확인 21 {'예' if r['21거래일 확인'] else '아니오'} · 42 {'예' if r['42거래일 확인'] else '아니오'}")
    return out


def r34(ctx):
    """나스닥 약세장(200거래일선 아래 · 지난 20거래일 내림) 뒤 21 · 42거래일."""
    x = pd.read_csv(C.ML / "macro.csv", parse_dates=["date"], index_col="date")["나스닥"].dropna().astype(float)
    bear = (x < x.rolling(200).mean()) & (x.pct_change(20) < 0)
    r = nasdaq_test(bear, x)
    for h in (21, 42):
        rs = [r[f"{h}거래일 {hn}"] for hn in HALVES]
        ok = all(q["켜진 날"] >= 200 and q["오른 비율"] is not None for q in rs)
        d = [q["오른 비율"] - q["평소"] for q in rs] if ok else []
        r[f"{h}거래일 판단"] = "이어짐" if ok and all(v < -0.05 for v in d) else ("되돌림" if ok and all(v > 0.05 for v in d) else "없음")
    print("   나스닥 약세장 " + " | ".join(f"{k}: {(r[k]['오른 비율'] or 0) * 100:4.1f}%(평소 {r[k]['평소'] * 100:4.1f}, {r[k]['켜진 날']}일)" for k in r if "확인" not in k and "판단" not in k)
          + f" | 21 {r['21거래일 판단']} · 42 {r['42거래일 판단']}")
    return {"나스닥 약세장": r}


def r35(ctx):
    """코인 시장 폭: 바이낸스 현물 24개(PAXG 제외)의 오름 ÷ (오름 + 내림), 10일 지수 평균. 0.40 아래 → 10일 안에 0.615 위 = 스러스트."""
    days = ctx["days"]
    rets = {}
    for f in sorted(C.ML.glob("spot_*.csv")):
        sym = f.stem[5:]
        if sym == "PAXG":
            continue
        c = pd.read_csv(f, parse_dates=["date"], index_col="date").close.astype(float)
        rets[sym] = np.sign(c.diff()).reindex(days)
    R = pd.DataFrame(rets)
    adv, dec = (R > 0).sum(1), (R < 0).sum(1)
    n = R.notna().sum(1)
    ratio = (adv / (adv + dec)).where(n >= 10)
    ema = ratio.ewm(span=10, adjust=False).mean().where(n >= 10)
    e = ema.to_numpy()
    thrust = np.zeros(len(e), bool)
    for i in range(len(e)):
        if e[i] > 0.615 and np.nanmin(e[max(0, i - 10):i] if i else [np.nan]) < 0.40 and not (i and e[i - 1] > 0.615):
            thrust[i] = True
    th = pd.Series(thrust, index=days)
    on30 = hold_after(th, 30)
    ctx["스러스트 날"] = [d.strftime("%Y-%m-%d") for d in th[th].index]
    print("   스러스트 날:", ", ".join(ctx["스러스트 날"]) or "없음", f"· 코인 10개 이상인 첫날 {n[n >= 10].index[0].date()}")
    rules = {"스러스트 뒤 30일": on30, "폭 평균 ≥ 0.615": ema >= 0.615, "폭 평균 ≤ 0.40": ema <= 0.40}
    rules = {k: {s: v.fillna(False) for s in P1.SYMS} for k, v in rules.items()}
    out = {k: test_rule(ctx, on) for k, on in rules.items()}
    ctx["dir"] = {f"{k} · {h}일": test_dir(ctx, on, h) for k, on in rules.items() for h in (30, 60)}
    return out


def epu_rules(days):
    e = pd.read_csv(C.ML / "epu.csv", parse_dates=["date"], index_col="date").epu.astype(float)
    e = e.reindex(pd.date_range(e.index.min(), days[-1])).ffill().shift(1)
    m = e.rolling(30).mean()
    lv, ch = rolling_pct(m).reindex(days), rolling_pct(m - m.shift(30)).reindex(days)
    return {"불확실성 높음(상위 10%)": lv >= 90, "불확실성 낮음(하위 10%)": lv <= 10,
            "불확실성 급증(30일 변화 상위 10%)": ch >= 90, "불확실성 급감(30일 변화 하위 10%)": ch <= 10}


def r37(ctx):
    """경제 정책 불확실성(EPU, 지난 30일 평균, 하루 늦춤): 업비트 두 코인 + BTC 2014 ~ 2017(23회차 틀)."""
    R = {k: v.fillna(False) for k, v in epu_rules(ctx["days"]).items()}
    rules = {k: {s: v for s in P1.SYMS} for k, v in R.items()}
    out = {k: test_rule(ctx, on) for k, on in rules.items()}
    ctx["dir"] = {f"{k} · {h}일": test_dir(ctx, on, h) for k, on in rules.items() for h in (30, 60)}
    c = pd.read_csv(C.ML / "cmprice_BTC.csv", parse_dates=["date"], index_col="date").close.astype(float)
    c = c.reindex(pd.date_range(c.index.min(), "2026-11-25")).ffill()
    fv = P1.forward_grade(c)
    R2 = {k: v.fillna(False) for k, v in epu_rules(c.index).items()}
    print("== BTC 2014 ~ 2017(처음 보는 기간): 켜진 날 · 다섯 장 배수 · 뒤 30 · 60일 오른 비율(평소)")
    for k, on in R2.items():
        r = eval_new(on, c, fv)
        print(f"   {k:28s} {r['켜진 날']:4d}일 · " + " ".join(f"{t} ×{r[t]:.2f}" if r[t] is not None else f"{t} -" for t in P1.TYPES.values())
              + f" · 30일 {(r['30일 오름'] or 0) * 100:4.1f}%({r['30일 평소'] * 100:4.1f}) · 60일 {(r['60일 오름'] or 0) * 100:4.1f}%({r['60일 평소'] * 100:4.1f})")
    return out


def r41(ctx):
    """테더(USDT) 발행: 지난 7일 증가율의 3년 이동 백분위(하루 늦춤) ≥ 90 · ≥ 90 × 그 코인 7일 내림 · ≤ 10."""
    days = ctx["days"]
    u = pd.read_csv(C.ML / "stable.csv", parse_dates=["date"], index_col="date")["USDT"].astype(float)
    u = u.reindex(pd.date_range(u.index.min(), days[-1])).ffill().shift(1)
    g = rolling_pct(u / u.shift(7) - 1).reindex(days)
    dn7 = {s: ctx["closes"][s] / ctx["closes"][s].shift(7) - 1 < 0 for s in P1.SYMS}
    rules = {"USDT 발행 급증(7일 상위 10%)": {s: (g >= 90).fillna(False) for s in P1.SYMS},
             "USDT 발행 급증 × 7일 내림": {s: ((g >= 90) & dn7[s]).fillna(False) for s in P1.SYMS},
             "USDT 발행 정체 · 상환(하위 10%)": {s: (g <= 10).fillna(False) for s in P1.SYMS}}
    out = {k: test_rule(ctx, on) for k, on in rules.items()}
    ctx["dir"] = {f"{k} · {h}일": test_dir(ctx, on, h) for k, on in rules.items() for h in (30, 60)}
    return out


ROUNDS = {3: r3, 5: r5, 6: r6, 8: r8, 9: r9, 10: r10, 11: r11, 13: r13, 14: r14, 16: r16, 17: r17, 18: r18, 19: r19, 21: r21, 22: r22, 23: r23, 25: r25, 29: r29, 32: r32, 33: r33, 34: r34, 35: r35, 37: r37, 41: r41}  # 회차 → 함수(ctx) → {규칙 이름: test_rule 결과}


# ---------- 봇 백테스트 회차 ----------

BOT_END, SEED = "2026-11-22", 1_000_000
BOT_STARTS = {"2020~": "2020-01-01", "2023~": "2023-01-01"}
BOT_COSTS = {"0.10%": 0.001, "0.25%": 0.0025}


def bot_weights(c):
    return sum((c > c.rolling(n).mean()).astype(float) for n in (20, 50, 100, 200)) / 4


def bot_test(ctx, variants):
    """variants[이름] = 함수(w, on) → 새 비중(날마다). on = 규칙이 켜진 날. 업비트 현물 봇(하루 한 번, 두 코인 날마다 반반)."""
    out = {}
    for name, fn in variants.items():
        row = {}
        for sn, st in BOT_STARTS.items():
            row[sn] = {}
            for cn, cost in BOT_COSTS.items():
                parts = []
                for s in P1.SYMS:
                    c = ctx["closes"][s].dropna()
                    c = c[c.index <= BOT_END]
                    w = fn(bot_weights(c), ctx["on"][s].reindex(c.index).fillna(False).astype(bool))
                    if name == "변동성 맞춤":  # 30회차: 비중을 그 코인 종가의 변동성으로 맞춘다
                        w = vol_scaled(bot_weights(c), c)
                    r = (w.shift() * c.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
                    parts.append(r[r.index >= st])
                r = pd.concat(parts, axis=1).fillna(0.0).mean(axis=1)
                eq = (1 + r).cumprod()
                row[sn][cn] = {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(r.mean() / r.std() * np.sqrt(365)), "MDD": float((eq / eq.cummax() - 1).min())}
        out[name] = row
    base = out[next(iter(out))]
    for name, row in list(out.items())[1:]:
        row["판정"] = {"샤프 > 봇 (두 구간)": all(row[sn]["0.10%"]["샤프"] > base[sn]["0.10%"]["샤프"] for sn in BOT_STARTS),
                     "MDD 나쁘지 않음": all(row[sn]["0.10%"]["MDD"] >= base[sn]["0.10%"]["MDD"] for sn in BOT_STARTS),
                     "0.25% 에서도": all(row[sn]["0.25%"]["샤프"] > base[sn]["0.25%"]["샤프"] for sn in BOT_STARTS)}
        row["통과"] = all(row["판정"].values())
    return out


def no_raise(w, on):
    """켜진 날에는 비중을 늘리지 않는다(줄이는 것은 그대로)."""
    out, prev = w.copy(), 0.0
    for i, (v, o) in enumerate(zip(w.to_numpy(), on.to_numpy())):
        x = min(v, prev) if o and not np.isnan(v) else v
        out.iloc[i] = x
        prev = 0.0 if np.isnan(x) else x
    return out


def b4(ctx):
    ctx["on"] = {s: (ctx["pct"][s]["bbw"] <= 30) & (ctx["pct"][s]["spx"] <= 30) for s in P1.SYMS}
    return bot_test(ctx, {"지금 봇 (하루 한 번)": lambda w, on: w, "A 켜진 날 늘리지 않음": no_raise, "B 켜진 날 비중 0": lambda w, on: w.where(~on, 0.0)})


def b20(ctx):
    """상승 쪽 두 규칙(3년 이동 백분위)이 켜진 날 비중을 최소 0.5(A) · 1(B)로."""
    PCT_FN[0] = rolling_pct
    try:
        c2 = context()
        _, _, nq = stock_state("나스닥", c2["days"])
        rules = {"조용함 + 탐욕": {s: (c2["pct"][s]["bbw"] <= 30) & (c2["pct"][s]["fng"] >= 70) for s in P1.SYMS},
                 "조용함 + 상대 강도": {s: (c2["pct"][s]["bbw"] <= 30) & (rolling_pct(c2["closes"][s] / c2["closes"][s].shift(30) - 1 - (nq / nq.shift(30) - 1)) >= 70) for s in P1.SYMS}}
    finally:
        PCT_FN[0] = P1.expanding_pct
    out = {}
    for rn, on in rules.items():
        c2["on"] = on
        res = bot_test(c2, {"지금 봇 (하루 한 번)": lambda w, on: w, f"{rn} · A 최소 0.5": lambda w, on: w.where(~on, np.maximum(w, 0.5)),
                            f"{rn} · B 비중 1": lambda w, on: w.where(~on, 1.0)})
        out.update(res)
    return out


def hold_after(on, n=60):
    """처음 켜진 날부터 n 일 동안 켜짐. 끝나면 다시 켜질 수 있다."""
    out, left = np.zeros(len(on), bool), 0
    for i, v in enumerate(on.to_numpy()):
        if left == 0 and v:
            left = n
        if left:
            out[i] = True
            left -= 1
    return pd.Series(out, index=on.index)


def b24(ctx):
    """퍼엘 < 0.5(BTC, 하루 늦춤) 바닥 매수: A 켜진 날 비중 최소 0.5, B 처음 켜진 날부터 60일 동안 최소 0.5."""
    iss = pd.read_csv(C.ML / "issuance_BTC.csv", parse_dates=["date"], index_col="date").iss_usd.astype(float)
    pu = (iss / iss.rolling(365).mean()).shift(1).reindex(ctx["days"])
    on = (pu < 0.5).fillna(False)
    ctx["on"] = {s: on for s in P1.SYMS}
    print("   퍼엘 < 0.5 인 날(2020 ~):", int(on[on.index >= "2020-01-01"].sum()), "· 시기:", ", ".join(sorted({d.strftime("%Y-%m") for d in on[on & (on.index >= "2020-01-01")].index})))
    res = bot_test(ctx, {"지금 봇 (하루 한 번)": lambda w, o: w, "A 퍼엘 < 0.5 인 날 최소 0.5": lambda w, o: w.where(~o, np.maximum(w, 0.5)),
                         "B 켜진 뒤 60일 최소 0.5": lambda w, o: w.where(~hold_after(o).reindex(w.index).fillna(False), np.maximum(w, 0.5))})
    return res


def b26(ctx):
    """퍼엘 바닥 매수의 이웃: 들고 있는 날 30 · 60 · 90 × 최소 비중 0.25 · 0.5 · 1."""
    iss = pd.read_csv(C.ML / "issuance_BTC.csv", parse_dates=["date"], index_col="date").iss_usd.astype(float)
    on = ((iss / iss.rolling(365).mean()).shift(1).reindex(ctx["days"]) < 0.5).fillna(False)
    ctx["on"] = {s: on for s in P1.SYMS}
    variants = {"지금 봇 (하루 한 번)": lambda w, o: w}
    for n in (30, 60, 90):
        h = hold_after(on, n)
        for m in (0.25, 0.5, 1.0):
            variants[f"{n}일 · 최소 {m:g}"] = (lambda h_, m_: (lambda w, o: w.where(~h_.reindex(w.index).fillna(False), np.maximum(w, m_))))(h, m)
    res = bot_test(ctx, variants)
    print(f"   9칸 중 통과 {sum(1 for n, r in res.items() if r.get('통과'))}칸")
    return res


def b27(ctx):
    """BTC 2014 ~ 2017(Coin Metrics 달러 종가, 한 코인): 봇 대 퍼엘 바닥 매수(B = 60일 · 0.5 판정, 26회차 9칸은 참고)."""
    c = pd.read_csv(C.ML / "cmprice_BTC.csv", parse_dates=["date"], index_col="date").close.astype(float)
    c = c.reindex(pd.date_range(c.index.min(), "2017-12-31")).ffill()
    iss = pd.read_csv(C.ML / "issuance_BTC.csv", parse_dates=["date"], index_col="date").iss_usd.astype(float)
    on = ((iss / iss.rolling(365).mean()).shift(1).reindex(c.index) < 0.5).fillna(False)
    print("   퍼엘 < 0.5 인 날(2014 ~ 2017):", int(on["2014":].sum()), "· 시기:", ", ".join(sorted({d.strftime("%Y-%m") for d in on[on & (on.index >= "2014-01-01")].index})))
    w0 = bot_weights(c)
    variants = {"지금 봇 (하루 한 번)": w0}
    for n in (30, 60, 90):
        h = hold_after(on, n)
        for m in (0.25, 0.5, 1.0):
            variants[f"{n}일 · 최소 {m:g}" + (" (판정)" if (n, m) == (60, 0.5) else "")] = w0.where(~h, np.maximum(w0, m))
    out = {}
    for name, w in variants.items():
        row = {}
        for cn, cost in BOT_COSTS.items():
            r = (w.shift() * c.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
            r = r[r.index >= "2014-01-01"]
            eq = (1 + r).cumprod()
            row[cn] = {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(r.mean() / r.std() * np.sqrt(365)), "MDD": float((eq / eq.cummax() - 1).min())}
        out[name] = {"2014~2017": row}
    b = out["지금 봇 (하루 한 번)"]["2014~2017"]
    for name, row in out.items():
        if name.startswith("지금"):
            continue
        a = row["2014~2017"]
        row["통과"] = bool(a["0.10%"]["샤프"] > b["0.10%"]["샤프"] and a["0.10%"]["MDD"] >= b["0.10%"]["MDD"] and a["0.25%"]["샤프"] > b["0.25%"]["샤프"])
    print("== 27회차 — BTC 2014-01 ~ 2017-12, 100만원, 잔고 0.10% (0.25%) · 샤프 (0.25%) · MDD")
    for name, row in out.items():
        a = row["2014~2017"]
        print(f"   {name:24s} {a['0.10%']['잔고'] / 1e4:8,.0f}만 ({a['0.25%']['잔고'] / 1e4:8,.0f}만) · {a['0.10%']['샤프']:.2f} ({a['0.25%']['샤프']:.2f}) · {a['0.10%']['MDD'] * 100:5.1f}% {'통과' if row.get('통과') else ('기각' if '통과' in row else '')}")
    return out


def macro_jumps(days):
    """미국 순유동성(7일 늦춤) · 유가(하루 늦춤) 30일 변화의 3년 이동 백분위 ≥ 90."""
    a = pd.read_csv(C.ML / "assets_long.csv", parse_dates=["date"], index_col="date").astype(float)
    oil = P1.cal(a["유가"].dropna().shift(1), days)
    lq = pd.read_csv(C.ML / "liquidity.csv", parse_dates=["date"], index_col="date").astype(float)
    lq = lq.reindex(pd.date_range(lq.index.min(), days[-1])).ffill()
    net = (lq.walcl - lq.tga - lq.rrp.fillna(0.0) * 1000).shift(7).reindex(days)
    L_ = (rolling_pct(net / net.shift(30) - 1) >= 90).fillna(False)
    O_ = (rolling_pct(oil / oil.shift(30) - 1) >= 90).fillna(False)
    return {"L 유동성": L_, "O 유가": O_, "L 또는 O": L_ | O_}


def b28(ctx):
    """유동성 · 유가 급등 뒤 60일 최소 0.5: 업비트 두 코인(2020 ~ · 2023 ~)과 BTC 달러(2014 ~ 2017)."""
    J = macro_jumps(ctx["days"])
    variants = {"지금 봇 (하루 한 번)": lambda w, o: w}
    for name, on in J.items():
        h = hold_after(on, 60)
        variants[f"{name} 뒤 60일 최소 0.5"] = (lambda h_: (lambda w, o: w.where(~h_.reindex(w.index).fillna(False), np.maximum(w, 0.5))))(h)
    ctx["on"] = {s: pd.Series(False, index=ctx["days"]) for s in P1.SYMS}
    res = bot_test(ctx, variants)
    c = pd.read_csv(C.ML / "cmprice_BTC.csv", parse_dates=["date"], index_col="date").close.astype(float)
    c = c.reindex(pd.date_range(c.index.min(), "2017-12-31")).ffill()
    J2 = macro_jumps(c.index)
    w0 = bot_weights(c)
    old = {}
    for name in ["지금 봇 (하루 한 번)"] + [f"{n} 뒤 60일 최소 0.5" for n in J2]:
        w = w0 if name.startswith("지금") else w0.where(~hold_after(J2[name.split(" 뒤")[0]], 60), np.maximum(w0, 0.5))
        row = {}
        for cn, cost in BOT_COSTS.items():
            r = (w.shift() * c.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
            r = r[r.index >= "2014-01-01"]
            eq = (1 + r).cumprod()
            row[cn] = {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(r.mean() / r.std() * np.sqrt(365)), "MDD": float((eq / eq.cummax() - 1).min())}
        old[name] = row
    b = old["지금 봇 (하루 한 번)"]
    for name, row in res.items():
        if name.startswith("지금"):
            continue
        a = old[name]
        row["2014~2017"] = a
        row["2014~2017 통과"] = bool(a["0.10%"]["샤프"] > b["0.10%"]["샤프"] and a["0.10%"]["MDD"] >= b["0.10%"]["MDD"] and a["0.25%"]["샤프"] > b["0.25%"]["샤프"])
        row["둘 다 통과"] = bool(row.get("통과") and row["2014~2017 통과"])
    res["지금 봇 (하루 한 번)"]["2014~2017"] = b
    print("== 2014 ~ 2017 (BTC 달러): 잔고 0.10% (0.25%) · 샤프 (0.25%) · MDD")
    for name, row in res.items():
        a = row["2014~2017"]
        print(f"   {name:26s} {a['0.10%']['잔고'] / 1e4:7,.0f}만 ({a['0.25%']['잔고'] / 1e4:7,.0f}만) · {a['0.10%']['샤프']:.2f} ({a['0.25%']['샤프']:.2f}) · {a['0.10%']['MDD'] * 100:5.1f}%"
              + ("" if name.startswith("지금") else f" · 이 기간 {'통과' if row['2014~2017 통과'] else '기각'} · 둘 다 {'통과' if row['둘 다 통과'] else '아님'}"))
    return res


def vol_scaled(w, c):
    """봇 비중 × min(1, 목표 ÷ 지난 30일 실현 변동성). 목표 = 봇이 들고 있던 날들의 실현 변동성 평균(전날까지)."""
    rv = np.log(c).diff().rolling(30).std() * np.sqrt(365)
    held = rv.where(w > 0)
    target = held.expanding().mean().shift(1)
    return (w * np.minimum(1.0, target / rv)).fillna(0.0).where(w.notna())


def b30(ctx):
    """변동성에 맞춘 비중: 업비트 두 코인(2020 ~ · 2023 ~)과 BTC 달러(2014 ~ 2017)."""
    ctx["on"] = {s: pd.Series(False, index=ctx["days"]) for s in P1.SYMS}
    closes = {s: ctx["closes"][s].dropna() for s in P1.SYMS}
    res = bot_test(ctx, {"지금 봇 (하루 한 번)": lambda w, o: w, "변동성 맞춤": lambda w, o: w})
    c = pd.read_csv(C.ML / "cmprice_BTC.csv", parse_dates=["date"], index_col="date").close.astype(float)
    c = c.reindex(pd.date_range(c.index.min(), "2017-12-31")).ffill()
    w0 = bot_weights(c)
    old = {}
    for name, w in (("지금 봇 (하루 한 번)", w0), ("변동성 맞춤", vol_scaled(w0, c))):
        row = {}
        for cn, cost in BOT_COSTS.items():
            r = (w.shift() * c.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
            r = r[r.index >= "2014-01-01"]
            eq = (1 + r).cumprod()
            row[cn] = {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(r.mean() / r.std() * np.sqrt(365)), "MDD": float((eq / eq.cummax() - 1).min())}
        old[name] = row
    b, a = old["지금 봇 (하루 한 번)"], old["변동성 맞춤"]
    res["지금 봇 (하루 한 번)"]["2014~2017"] = b
    res["변동성 맞춤"]["2014~2017"] = a
    res["변동성 맞춤"]["2014~2017 통과"] = bool(a["0.10%"]["샤프"] > b["0.10%"]["샤프"] and a["0.10%"]["MDD"] >= b["0.10%"]["MDD"] and a["0.25%"]["샤프"] > b["0.25%"]["샤프"])
    print("== 2014 ~ 2017 (BTC 달러): 잔고 0.10% (0.25%) · 샤프 (0.25%) · MDD")
    for name, row in old.items():
        print(f"   {name:24s} {row['0.10%']['잔고'] / 1e4:7,.0f}만 ({row['0.25%']['잔고'] / 1e4:7,.0f}만) · {row['0.10%']['샤프']:.2f} ({row['0.25%']['샤프']:.2f}) · {row['0.10%']['MDD'] * 100:5.1f}%")
    print("   2014 ~ 2017 판정:", "통과" if res["변동성 맞춤"]["2014~2017 통과"] else "기각")
    return res


def b36(ctx, H_=30, STEP=30, MIN_TRAIN=500):
    """메타 라벨링: 봇 비중 > 0 인 날, 뒤 30일 봇 수익 > 0 일 확률(HistGradientBoosting, 워크포워드). < 0.4 면 그날 비중 0."""
    from sklearn.ensemble import HistGradientBoostingClassifier
    PCT_FN[0] = rolling_pct
    try:
        c2 = context()
        days = c2["days"]
        _, _, nq = stock_state("나스닥", days)
        iss = pd.read_csv(C.ML / "issuance_BTC.csv", parse_dates=["date"], index_col="date").iss_usd.astype(float)
        puell = (iss / iss.rolling(365).mean()).shift(1).reindex(days)
        a = pd.read_csv(C.ML / "assets_long.csv", parse_dates=["date"], index_col="date").astype(float)
        oil = P1.cal(a["유가"].dropna().shift(1), days)
        lq = pd.read_csv(C.ML / "liquidity.csv", parse_dates=["date"], index_col="date").astype(float)
        lq = lq.reindex(pd.date_range(lq.index.min(), days[-1])).ffill()
        net = (lq.walcl - lq.tga - lq.rrp.fillna(0.0) * 1000).shift(7).reindex(days)
        rows = []
        for s in P1.SYMS:
            c = c2["closes"][s]
            cc = c.dropna()
            w = bot_weights(cc).reindex(days)
            br = (w.shift() * c.pct_change()).fillna(0.0)
            fwd = (1 + br).rolling(H_).apply(np.prod, raw=True).shift(-H_) - 1
            X = pd.DataFrame({k: v for k, v in c2["pct"][s].items()}, index=days)
            X["puell"], X["w"] = puell, w
            X["rel"] = rolling_pct(c / c.shift(30) - 1 - (nq / nq.shift(30) - 1))
            X["liq30"] = rolling_pct(net / net.shift(30) - 1)
            X["oil30"] = rolling_pct(oil / oil.shift(30) - 1)
            X["_y"] = (fwd > 0).astype(float).where(fwd.notna() & c.shift(-H_).notna())
            X["_s"] = s
            rows.append(X[(w > 0) & c.notna()])
        A = pd.concat(rows).rename_axis("date").reset_index().sort_values("date", kind="stable").reset_index(drop=True)
        cols = [k for k in A.columns if not k.startswith("_") and k != "date"]
        prob = {s: pd.Series(np.nan, index=days) for s in P1.SYMS}
        dates = np.sort(A.date.unique())
        start = np.searchsorted(dates, np.datetime64("2018-01-01"))
        for i in range(start, len(dates), STEP):
            d = dates[i]
            nxt = dates[i + STEP] if i + STEP < len(dates) else dates[-1] + np.timedelta64(1, "D")
            tr = (A.date.to_numpy() <= d - np.timedelta64(H_, "D")) & A._y.notna().to_numpy()
            te = (A.date.to_numpy() >= d) & (A.date.to_numpy() < nxt)
            if tr.sum() < MIN_TRAIN or not te.any():
                continue
            m = HistGradientBoostingClassifier(random_state=0).fit(A.loc[tr, cols].to_numpy(float), A.loc[tr, "_y"].to_numpy(int))
            pr = m.predict_proba(A.loc[te, cols].to_numpy(float))[:, list(m.classes_).index(1)]
            for s in P1.SYMS:
                k = (A.loc[te, "_s"] == s).to_numpy()
                prob[s].loc[pd.DatetimeIndex(A.loc[te, "date"].to_numpy()[k])] = pr[k]
    finally:
        PCT_FN[0] = P1.expanding_pct
    ctx["on"] = {s: (prob[s] < 0.4).fillna(False) for s in P1.SYMS}
    for s in P1.SYMS:
        p_ = prob[s][prob[s].index >= "2020-01-01"]
        print(f"   {s}: 보유일 중 예측한 날 {int(p_.notna().sum())} · 확률 < 0.4 로 비중 0 이 된 날 {int((p_ < 0.4).sum())}")
    return bot_test(ctx, {"지금 봇 (하루 한 번)": lambda w, o: w, "메타 라벨링(확률 < 0.4 면 0)": lambda w, o: w.where(~o, 0.0)})


def b38(ctx):
    """불확실성을 봇에: A 높음 켜진 뒤 60일 최소 0.5, B 낮음인 날 비중 × 0.5. 업비트 두 코인과 BTC 달러 2014 ~ 2017."""
    E = epu_rules(ctx["days"])
    hiA, loB = hold_after(E["불확실성 높음(상위 10%)"].fillna(False), 60), E["불확실성 낮음(하위 10%)"].fillna(False)
    fA = lambda h: (lambda w, o: w.where(~h.reindex(w.index).fillna(False), np.maximum(w, 0.5)))
    fB = lambda l: (lambda w, o: w.where(~l.reindex(w.index).fillna(False), w * 0.5))
    ctx["on"] = {s: pd.Series(False, index=ctx["days"]) for s in P1.SYMS}
    res = bot_test(ctx, {"지금 봇 (하루 한 번)": lambda w, o: w, "A 불확실성 높음 뒤 60일 최소 0.5": fA(hiA), "B 불확실성 낮음이면 비중 절반": fB(loB)})
    c = pd.read_csv(C.ML / "cmprice_BTC.csv", parse_dates=["date"], index_col="date").close.astype(float)
    c = c.reindex(pd.date_range(c.index.min(), "2017-12-31")).ffill()
    E2 = epu_rules(c.index)
    w0 = bot_weights(c)
    ws = {"지금 봇 (하루 한 번)": w0, "A 불확실성 높음 뒤 60일 최소 0.5": fA(hold_after(E2["불확실성 높음(상위 10%)"].fillna(False), 60))(w0, None),
          "B 불확실성 낮음이면 비중 절반": fB(E2["불확실성 낮음(하위 10%)"].fillna(False))(w0, None)}
    old = {}
    for name, w in ws.items():
        row = {}
        for cn, cost in BOT_COSTS.items():
            r = (w.shift() * c.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
            r = r[r.index >= "2014-01-01"]
            eq = (1 + r).cumprod()
            row[cn] = {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(r.mean() / r.std() * np.sqrt(365)), "MDD": float((eq / eq.cummax() - 1).min())}
        old[name] = row
    b = old["지금 봇 (하루 한 번)"]
    print("== 2014 ~ 2017 (BTC 달러): 잔고 0.10% (0.25%) · 샤프 (0.25%) · MDD")
    for name, row in res.items():
        a = old[name]
        row["2014~2017"] = a
        if not name.startswith("지금"):
            row["2014~2017 통과"] = bool(a["0.10%"]["샤프"] > b["0.10%"]["샤프"] and a["0.10%"]["MDD"] >= b["0.10%"]["MDD"] and a["0.25%"]["샤프"] > b["0.25%"]["샤프"])
            row["둘 다 통과"] = bool(row.get("통과") and row["2014~2017 통과"])
        print(f"   {name:30s} {a['0.10%']['잔고'] / 1e4:7,.0f}만 ({a['0.25%']['잔고'] / 1e4:7,.0f}만) · {a['0.10%']['샤프']:.2f} ({a['0.25%']['샤프']:.2f}) · {a['0.10%']['MDD'] * 100:5.1f}%"
              + ("" if name.startswith("지금") else f" · 이 기간 {'통과' if row['2014~2017 통과'] else '기각'} · 둘 다 {'통과' if row['둘 다 통과'] else '아님'}"))
    return res


def dd_sim(closes, start, cost, limit=None):
    """코인들(반반, 날마다 맞춤)의 봇. limit 이 있으면 비중 × min(1, 1 − 전날 낙폭 ÷ limit). 시작일부터 평가액을 새로 잰다."""
    W = {s: bot_weights(c) for s, c in closes.items()}
    R = {s: c.pct_change() for s, c in closes.items()}
    idx = sorted(set().union(*[c.index for c in closes.values()]))
    idx = [d for d in idx if d >= pd.Timestamp(start)]
    eq, peak, prev = 1.0, 1.0, {s: 0.0 for s in closes}
    out = []
    for d in idx:
        scale = 1.0 if limit is None else max(0.0, min(1.0, 1 - (1 - eq / peak) / limit))
        r = []
        for s in closes:
            w = W[s].get(d, np.nan)
            w = 0.0 if np.isnan(w) else w * scale  # 오늘 정한 비중(내일 수익에 쓰인다)
            ret = R[s].get(d, np.nan)
            r.append(prev[s] * (0.0 if np.isnan(ret) else ret) - cost * abs(w - prev[s]))
            prev[s] = w
        day = float(np.mean(r))
        eq *= 1 + day
        peak = max(peak, eq)
        out.append(day)
    return pd.Series(out, index=idx)


def summ(r):
    eq = (1 + r).cumprod()
    return {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(r.mean() / r.std() * np.sqrt(365)), "MDD": float((eq / eq.cummax() - 1).min())}


def b39(ctx):
    """낙폭에 맞춰 줄이기: 봇 비중 × min(1, 1 − 낙폭 ÷ 0.45)."""
    up = {s: ctx["closes"][s].dropna() for s in P1.SYMS}
    up = {s: c[c.index <= BOT_END] for s, c in up.items()}
    c = pd.read_csv(C.ML / "cmprice_BTC.csv", parse_dates=["date"], index_col="date").close.astype(float)
    btc = {"BTC": c.reindex(pd.date_range(c.index.min(), "2017-12-31")).ffill()}
    res = {}
    for name, lim in (("지금 봇 (하루 한 번)", None), ("낙폭에 맞춰 줄이기(한도 45%)", 0.45)):
        row = {sn: {cn: summ(dd_sim(up, st, cost, lim)) for cn, cost in BOT_COSTS.items()} for sn, st in BOT_STARTS.items()}
        row["2014~2017"] = {cn: summ(dd_sim(btc, "2014-01-01", cost, lim)) for cn, cost in BOT_COSTS.items()}
        res[name] = row
    b, a = res["지금 봇 (하루 한 번)"], res["낙폭에 맞춰 줄이기(한도 45%)"]
    ok = lambda periods: all(a[p]["0.10%"]["샤프"] > b[p]["0.10%"]["샤프"] and a[p]["0.10%"]["MDD"] >= b[p]["0.10%"]["MDD"] and a[p]["0.25%"]["샤프"] > b[p]["0.25%"]["샤프"] for p in periods)
    a["통과"], a["2014~2017 통과"] = ok(list(BOT_STARTS)), ok(["2014~2017"])
    a["둘 다 통과"] = a["통과"] and a["2014~2017 통과"]
    print("   2014 ~ 2017 (BTC 달러): " + " | ".join(f"{n} {r['2014~2017']['0.10%']['잔고'] / 1e4:,.0f}만 · {r['2014~2017']['0.10%']['샤프']:.2f} · {r['2014~2017']['0.10%']['MDD'] * 100:.1f}%" for n, r in res.items())
          + f" → {'통과' if a['2014~2017 통과'] else '기각'} · 둘 다 {'통과' if a['둘 다 통과'] else '아님'}")
    return res


def epu_level(days):
    e = pd.read_csv(C.ML / "epu.csv", parse_dates=["date"], index_col="date").epu.astype(float)
    e = e.reindex(pd.date_range(e.index.min(), days[-1])).ffill().shift(1)
    return rolling_pct(e.rolling(30).mean()).reindex(days)


def b40(ctx):
    """불확실성 낮을 때 줄이기의 이웃: 문턱 ≤ 5 · 10 · 20 × 비중 × 0.25 · 0.5 · 0.75."""
    lv = epu_level(ctx["days"])
    c = pd.read_csv(C.ML / "cmprice_BTC.csv", parse_dates=["date"], index_col="date").close.astype(float)
    c = c.reindex(pd.date_range(c.index.min(), "2017-12-31")).ffill()
    lv2 = epu_level(c.index)
    w0 = bot_weights(c)
    ctx["on"] = {s: pd.Series(False, index=ctx["days"]) for s in P1.SYMS}
    variants = {"지금 봇 (하루 한 번)": lambda w, o: w}
    old = {"지금 봇 (하루 한 번)": w0}
    for q in (5, 10, 20):
        for k in (0.25, 0.5, 0.75):
            low = (lv <= q).fillna(False)
            name = f"낮음 ≤ {q} · 비중 × {k:g}"
            variants[name] = (lambda l, k_: (lambda w, o: w.where(~l.reindex(w.index).fillna(False), w * k_)))(low, k)
            old[name] = w0.where(~(lv2 <= q).fillna(False), w0 * k)
    res = bot_test(ctx, variants)
    old_s = {}
    for name, w in old.items():
        row = {}
        for cn, cost in BOT_COSTS.items():
            r = (w.shift() * c.pct_change() - cost * w.diff().abs().shift()).fillna(0.0)
            r = r[r.index >= "2014-01-01"]
            eq = (1 + r).cumprod()
            row[cn] = {"잔고": float(SEED * eq.iloc[-1]), "샤프": float(r.mean() / r.std() * np.sqrt(365)), "MDD": float((eq / eq.cummax() - 1).min())}
        old_s[name] = row
    b = old_s["지금 봇 (하루 한 번)"]
    n_both = 0
    print("== 2014 ~ 2017 (BTC 달러): 잔고 · 샤프 · MDD → 이 기간 · 둘 다")
    for name, row in res.items():
        a = old_s[name]
        row["2014~2017"] = a
        if not name.startswith("지금"):
            row["2014~2017 통과"] = bool(a["0.10%"]["샤프"] > b["0.10%"]["샤프"] and a["0.10%"]["MDD"] >= b["0.10%"]["MDD"] and a["0.25%"]["샤프"] > b["0.25%"]["샤프"])
            row["둘 다 통과"] = bool(row.get("통과") and row["2014~2017 통과"])
            n_both += row["둘 다 통과"]
        print(f"   {name:24s} {a['0.10%']['잔고'] / 1e4:7,.0f}만 · {a['0.10%']['샤프']:.3f} · {a['0.10%']['MDD'] * 100:5.1f}%"
              + ("" if name.startswith("지금") else f" → {'통과' if row['2014~2017 통과'] else '기각'} · 둘 다 {'통과' if row['둘 다 통과'] else '아님'}"))
    print(f"   9칸 중 둘 다 통과 {n_both}칸")
    return res


BOT_ROUNDS = {4: b4, 20: b20, 24: b24, 26: b26, 27: b27, 28: b28, 30: b30, 36: b36, 38: b38, 39: b39, 40: b40}  # 회차 → 함수(ctx) → {이름: {구간: {비용: 잔고·샤프·MDD}}, 판정}


def run_bot(k, ctx, store):
    res = BOT_ROUNDS[k](ctx)
    if k == 27:  # 한 기간 · 한 코인이라 따로 찍었다
        store["rounds"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "bot": res}
        return
    print(f"== {k}회차 — 봇 백테스트, 100만원, 잔고 0.10% (0.25%) · 샤프 · MDD, 2020~ | 2023~")
    for name, row in res.items():
        cells = " | ".join(f"{row[sn]['0.10%']['잔고'] / 1e4:6,.0f}만 ({row[sn]['0.25%']['잔고'] / 1e4:6,.0f}만) · {row[sn]['0.10%']['샤프']:.2f} ({row[sn]['0.25%']['샤프']:.2f}) · {row[sn]['0.10%']['MDD'] * 100:5.1f}%" for sn in BOT_STARTS)
        print(f"   {name:24s} {cells} {'통과' if row.get('통과') else ('기각' if '통과' in row else '')}")
    store["rounds"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "bot": res}


def run_dir(k, rules, store):
    won = {n: dir_success(r) for n, r in rules.items() if dir_success(r)}
    print(f"== {k}회차 — 방향만: 규칙 {len(rules) // 2}개 × 30 · 60일 = {len(rules)}칸, 방향 성공 {len(won)}칸")
    for n, w in won.items():
        r = rules[n]
        print(f"   {w} · {n:58s} 오른 비율 {r['찾기']['오른 비율'] * 100:4.1f}% (평소 {r['찾기']['평소'] * 100:4.1f}%, {r['찾기']['켜진 날']}일) | {r['검증']['오른 비율'] * 100:4.1f}% (평소 {r['검증']['평소'] * 100:4.1f}%, {r['검증']['켜진 날']}일)")
    near = sorted(((min(r[pn]["오른 비율"] - r[pn]["평소"] for pn in r), n) for n, r in rules.items()
                   if all(r[pn]["켜진 날"] >= 100 for pn in r) and n not in won), reverse=True)[:8]
    print("   오름 쪽 가까운 것(두 기간 중 작은 쪽 차이):")
    for d, n in near:
        r = rules[n]
        print(f"     {n:58s} +{d * 100:4.1f}%p · {r['찾기']['오른 비율'] * 100:4.1f}% | {r['검증']['오른 비율'] * 100:4.1f}%")
    store["rounds"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "dir": rules, "성공": won}


def run(k):
    ctx = context()
    store = json.loads(OUT.read_text()) if OUT.exists() else {"rounds": {}}
    if k in BOT_ROUNDS:
        run_bot(k, ctx, store)
        OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
        return
    rules = ROUNDS[k](ctx)
    if k in (33, 34):  # 나스닥 회차: 결과 꼴이 달라 출력은 회차 함수가 했다
        store["rounds"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "nasdaq": rules}
        OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
        return
    if k == 23:
        print(f"== {k}회차 — BTC {NEW[0]} ~ {NEW[1]}(처음 보는 기간): 켜진 날 · 다섯 장 배수 · 뒤 30 · 60일 오른 비율(평소) · 주장 → 새 기간")
        for n, r in rules.items():
            print(f"   {n:34s} {r['켜진 날']:4d}일 · " + " ".join(f"{t} ×{r[t]:.2f}" if r[t] is not None else f"{t} -" for t in P1.TYPES.values())
                  + f" · 30일 {(r['30일 오름'] or 0) * 100:4.1f}%({r['30일 평소'] * 100:4.1f}) · 60일 {(r['60일 오름'] or 0) * 100:4.1f}%({r['60일 평소'] * 100:4.1f}) · {r['주장']} → {r['새 기간']}")
        store["rounds"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "new": rules}
        OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
        return
    if k == 22:
        run_dir(k, rules, store)
        OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
        return
    print(f"== {k}회차 — 규칙이 켜진 날에서 뒤 30일 장이 나온 배수(켜졌을 때 ÷ 평소), 찾는 기간 | 검증 기간")
    won = {}
    for name, res in rules.items():
        w = show(name, res)
        if w:
            won[name] = w
    store["rounds"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "rules": rules, "성공": won}
    if "dir" in ctx:  # 25회차부터: 방향(뒤 30 · 60일 부호)도 같이
        dw = {n: dir_success(r) for n, r in ctx["dir"].items() if dir_success(r)}
        store["rounds"][str(k)].update(dir=ctx["dir"], 방향성공=dw)
        print("== 방향(뒤 30 · 60일 오른 비율, 평소) 찾기 | 검증")
        for n, r in ctx["dir"].items():
            f, v = r["찾기"], r["검증"]
            print(f"   {n:40s} {(f['오른 비율'] or 0) * 100:4.1f}%({f['평소'] * 100:4.1f}, {f['켜진 날']}일) | {(v['오른 비율'] or 0) * 100:4.1f}%({v['평소'] * 100:4.1f}, {v['켜진 날']}일)" + (f"  ★ 방향 {dw[n]}" if n in dw else ""))
    if "상관" in ctx:
        store["rounds"][str(k)]["상관"] = ctx["상관"]
        print("== 상관(순위, 2018 ~): 코인 날마다 수익 대 자산 날마다 변화 · 30일 간격 30일 변화끼리 · 해마다(날마다)")
        for s, d in ctx["상관"].items():
            for a, v in d.items():
                print(f"   {s} · {a:8s} 날마다 {v['날마다']:+.2f} · 30일 {v['30일']:+.2f} · " + " ".join(f"{y[2:]} {c:+.2f}" for y, c in v["해마다"].items()))
    OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
    print("성공한 규칙:", won or "없음")


if __name__ == "__main__":
    run(int(sys.argv[1]))
