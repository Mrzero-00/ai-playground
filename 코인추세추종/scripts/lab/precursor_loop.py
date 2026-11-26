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
        ctx["pct"][s] = {k: (X[k] if k in P2.RAW else P1.expanding_pct(X[k])) for k in names}
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
        rel = {s: P1.expanding_pct(ctx["closes"][s] / ctx["closes"][s].shift(30) - 1 - (nq / nq.shift(30) - 1)) for s in P1.SYMS}
        rules[f"코인 상대 강도(나스닥 대비) {side}"] = {s: f(rel[s]) for s in P1.SYMS}
    v = pd.read_csv(C.ML / "risk.csv", parse_dates=["date"], index_col="date").VIX.dropna().astype(float)
    vj = P1.expanding_pct(P1.cal(v - v.shift(5), days))
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
            att[s] = P1.expanding_pct(x.rolling(7).mean() / x.rolling(90).mean())
            c = ctx["closes"][s]
            up7[s] = c / c.shift(7) - 1
        out[f"{lang} 관심 급증(상위 10%)"] = test_rule(ctx, {s: att[s] >= 90 for s in P1.SYMS})
        out[f"{lang} 관심 낮음(하위 10%)"] = test_rule(ctx, {s: att[s] <= 10 for s in P1.SYMS})
        out[f"{lang} 관심 급증 × 7일 오름"] = test_rule(ctx, {s: (att[s] >= 90) & (up7[s] > 0) for s in P1.SYMS})
        out[f"{lang} 관심 급증 × 7일 내림"] = test_rule(ctx, {s: (att[s] >= 90) & (up7[s] < 0) for s in P1.SYMS})
    return out


ROUNDS = {3: r3, 5: r5, 6: r6}  # 회차 → 함수(ctx) → {규칙 이름: test_rule 결과}


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


BOT_ROUNDS = {4: b4}  # 회차 → 함수(ctx) → {이름: {구간: {비용: 잔고·샤프·MDD}}, 판정}


def run_bot(k, ctx, store):
    res = BOT_ROUNDS[k](ctx)
    print(f"== {k}회차 — 봇 백테스트, 100만원, 잔고 0.10% (0.25%) · 샤프 · MDD, 2020~ | 2023~")
    for name, row in res.items():
        cells = " | ".join(f"{row[sn]['0.10%']['잔고'] / 1e4:6,.0f}만 ({row[sn]['0.25%']['잔고'] / 1e4:6,.0f}만) · {row[sn]['0.10%']['샤프']:.2f} ({row[sn]['0.25%']['샤프']:.2f}) · {row[sn]['0.10%']['MDD'] * 100:5.1f}%" for sn in BOT_STARTS)
        print(f"   {name:24s} {cells} {'통과' if row.get('통과') else ('기각' if '통과' in row else '')}")
    store["rounds"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "bot": res}


def run(k):
    ctx = context()
    store = json.loads(OUT.read_text()) if OUT.exists() else {"rounds": {}}
    if k in BOT_ROUNDS:
        run_bot(k, ctx, store)
        OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
        return
    rules = ROUNDS[k](ctx)
    print(f"== {k}회차 — 규칙이 켜진 날에서 뒤 30일 장이 나온 배수(켜졌을 때 ÷ 평소), 찾는 기간 | 검증 기간")
    won = {}
    for name, res in rules.items():
        w = show(name, res)
        if w:
            won[name] = w
    store["rounds"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "rules": rules, "성공": won}
    OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
    print("성공한 규칙:", won or "없음")


if __name__ == "__main__":
    run(int(sys.argv[1]))
