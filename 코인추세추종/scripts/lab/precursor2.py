"""장 직전 지표 양상 2차 (RESEARCH.md '장 직전 지표 양상 2차'). 가 새 지표 14개(변화량·사이클·매수세) · 나 가격 변화율로 나눈 장에 지표 34개 ·
다 조용함 뒤 돌파 방향. 사건·기간·통과 기준·쓸모 확인은 1차(precursor.py)와 같다. 판정 없음.
사용법: python3 scripts/lab/precursor2.py   → data/lab/precursor2.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
import precursor as P1
from regime_loop2 import HALVINGS

NEW = {"fund_ch": "펀딩비 14일 변화", "fng_ch": "공포·탐욕 14일 변화", "kimchi_ch": "김치 프리미엄 14일 변화", "mvrv_ch": "MVRV 30일 변화",
       "hashrib": "해시 리본(30일 ÷ 60일)", "exs_ch": "거래소 보유량 30일 변화", "ethbtc": "ETH/BTC 30일 변화", "halving": "반감기 주기 위치",
       "streak": "연이은 하락일 수", "wrsi": "주봉 RSI(14주)", "bigbars": "큰 봉 수(30일)", "bandout": "밴드 밖 종가(5일)",
       "taker_s": "테이커 매수 비율 현물(7일)", "taker_p": "테이커 매수 비율 선물(7일)"}
RAW = {"halving"}  # 백분위 대신 값 그대로(0 ~ 100)
ENTER, LEAVE, STRONG = 0.14, 0.07, 0.336  # 나: 가운데 60일 로그 변화 문턱
SQ, LOOK, GAP = 20, 20, 20  # 다: 조용함 백분위 · 돌파를 기다리는 날 · 다음 사건까지 쉬는 날


def taker(path, days):
    d = pd.read_csv(C.ML / path, parse_dates=["date"], index_col="date").astype(float).reindex(days)
    return (d.taker_buy_quote / d.quote_volume).rolling(7).mean()


def new_raw(sym, days, X, c, closes):
    lr = np.log(c)
    hr = P1.cal(pd.read_csv(C.ML / "hashrate.csv", parse_dates=["date"], index_col="date").hashrate.astype(float), days)
    exs = P1.per_asset("exsupply.csv", sym, "exsupply").reindex(days)
    r = closes["ETH"] / closes["BTC"]
    last = pd.Series(HALVINGS.searchsorted(days, side="right") - 1, index=days)
    up = np.sign(c.diff())
    run = up.groupby((up != up.shift()).cumsum()).cumcount() + 1
    wk = c.resample("W").last()
    sd20, m20 = c.rolling(20).std(), c.rolling(20).mean()
    out_ = ((c > m20 + 2 * sd20).astype(float) - (c < m20 - 2 * sd20).astype(float)).rolling(5).sum()
    big = (lr.diff().abs() > 2 * lr.diff().rolling(365).std()).astype(float).rolling(30).sum()
    return {"fund_ch": X["fund"] - X["fund"].shift(14), "fng_ch": X["fng"] - X["fng"].shift(14), "kimchi_ch": X["kimchi"] - X["kimchi"].shift(14),
            "mvrv_ch": X["mvrv"] - X["mvrv"].shift(30), "hashrib": hr.rolling(30).mean() / hr.rolling(60).mean(), "exs_ch": exs / exs.shift(30) - 1,
            "ethbtc": r / r.shift(30) - 1, "halving": pd.Series((days - HALVINGS[last.to_numpy()]).days / 1461 * 100, index=days),
            "streak": (-up * run).where(c.notna()), "wrsi": P1.rsi(wk).reindex(days, method="ffill").where(c.notna()), "bigbars": big.where(lr.diff().rolling(365).std().notna()),
            "bandout": out_, "taker_s": taker(f"spot_{sym}.csv", days), "taker_p": taker(f"perp_{sym}.csv", days)}


def label_abs(c):
    """나: 가운데 60일 로그 변화 L 로 나눈 장. |L| ≥ 0.14 면 추세로 들어가고 0.07 아래로 내려와야 횡보, |L| ≥ 0.336 이면 강한 장."""
    lr = np.log(c)
    L = (lr.shift(-P1.H) - lr.shift(P1.H)).dropna()
    out, st = np.zeros(len(L), int), 0
    for i, v in enumerate(L.to_numpy()):
        if v >= ENTER:
            st = 1
        elif v <= -ENTER:
            st = -1
        elif (st == 1 and v < LEAVE) or (st == -1 and v > -LEAVE):
            st = 0
        out[i] = st * (2 if abs(v) >= STRONG else 1) if st else 0
    return pd.Series(out, index=L.index)


def forward_abs(c):
    lr = np.log(c)
    f = lr.shift(-P1.H) - lr
    k = np.sqrt(0.5)
    return pd.Series(np.where(f.notna(), np.where(f >= STRONG * k, 2, np.where(f >= ENTER * k, 1, np.where(f <= -STRONG * k, -2, np.where(f <= -ENTER * k, -1, 0)))), np.nan), index=c.index)


def breakouts(c, bbp):
    """다: 조용한 날(볼린저 폭 백분위 ≤ 20) 뒤 20일 안의 첫 밴드 밖 종가. 한 번 잡으면 20일 동안 새로 잡지 않는다."""
    m, sd = c.rolling(20).mean(), c.rolling(20).std()
    up, dn = (c > m + 2 * sd).to_numpy(), (c < m - 2 * sd).to_numpy()
    q, px, idx = (bbp <= SQ).to_numpy(), c.to_numpy(), c.index
    out, nxt, i = [], 0, 0
    while i < len(c):
        if i >= nxt and q[i]:
            for b in range(i + 1, min(i + LOOK + 1, len(c))):
                if up[b] or dn[b]:
                    fwd = px[b + 30] / px[b] - 1 if b + 30 < len(c) and not np.isnan(px[b + 30]) else None
                    out.append({"날": idx[b], "방향": "위" if up[b] else "아래", "뒤 30일": fwd})
                    nxt = b + GAP
                    i = b
                    break
        i += 1
    return out


def period(d):
    d = str(d.date())
    return "찾기" if P1.FIND[0] <= d <= P1.FIND[1] else ("검증" if any(a <= d <= b for a, b in P1.HOLD) else "밖")


def main():
    days = pd.date_range("2017-09-25", "2026-11-25")
    macro = P1.macro_series(days)
    raw, closes = {}, {}
    for s in P1.SYMS:
        closes[s], raw[s] = P1.raw_features(s, days, macro)
    allnames = {**P1.NAMES, **NEW}
    pct, FGv, FGa = {}, {}, {}
    for s in P1.SYMS:
        X = {**raw[s], **new_raw(s, days, raw[s], closes[s], closes)}
        pct[s] = {k: (X[k].where(X[k].notna()) if k in RAW else P1.expanding_pct(X[k])) for k in allnames}
        FGv[s], FGa[s] = P1.forward_grade(closes[s]), forward_abs(closes[s])
    out = {"made": datetime.now().isoformat(timespec="seconds"), "names": allnames}

    # 가: 1차 사건(변동성 기준)에 새 지표 14개
    ev = sum((P1.events(s, closes[s].dropna())[0] for s in P1.SYMS), [])
    _, _, outl_a, rows_a = P1.analyze(ev, pct, FGv, NEW)
    # 나: 가격 변화율로 나눈 장에 지표 34개
    evb = sum((P1.events(s, closes[s].dropna(), label_abs)[0] for s in P1.SYMS), [])
    find_b, hold_b, outl_b, rows_b = P1.analyze(evb, pct, FGa, allnames)
    out.update({"가": rows_a, "나": rows_b, "나 사건": [{**{k: v for k, v in e.items() if k not in ("시작", "값")}, "시작": str(e["시작"].date())} for e in evb]})

    # 다: 조용함 뒤 돌파 방향
    bo, base = [], {"찾기": [], "검증": []}
    for s in P1.SYMS:
        c = closes[s]
        for e in breakouts(c.dropna(), pct[s]["bbw"].reindex(c.dropna().index)):
            e.update(코인=s, 기간=period(e["날"]))
            bo.append(e)
        fwd = (c.shift(-30) / c - 1).dropna()
        for pn in base:
            base[pn] += [v for t, v in fwd.items() if period(t) == pn]
    brk = {}
    for pn in ("찾기", "검증"):
        b = {"평소 중앙값": float(np.median(base[pn]))}
        for dr in ("위", "아래"):
            v = np.array([e["뒤 30일"] for e in bo if e["기간"] == pn and e["방향"] == dr and e["뒤 30일"] is not None])
            b[dr] = {"n": int(len(v)), "중앙값": float(np.median(v)) if len(v) else None, "오른 비율": float(np.mean(v > 0)) if len(v) else None}
        b["통과"] = bool(b["위"]["n"] and b["아래"]["n"] and b["위"]["중앙값"] > b["평소 중앙값"] > b["아래"]["중앙값"]
                       and b["위"]["오른 비율"] >= 0.6 and 1 - b["아래"]["오른 비율"] >= 0.6)
        brk[pn] = b
    out["다"] = {"돌파": [{**e, "날": str(e["날"].date())} for e in bo], "요약": brk, "통과": brk["찾기"]["통과"] and brk["검증"]["통과"]}
    (C.OUT / "precursor2.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))

    def show(rows, title):
        print(title)
        hit = [r for r in rows if r["통과"]]
        for r in hit:
            u = r["쓸모"]
            hv = f"{r['검증 같은 쪽'] * 100:.0f}% (n {r['검증 n']})" if r["검증 같은 쪽"] is not None else f"n {r['검증 n']}"
            print(f"   {r['장']:4s} {r['이름']:24s} {r['쪽']} · 백분위 {r['중앙 백분위']:4.0f} · {r['같은 쪽'] * 100:3.0f}% · n {r['n']:2d} | {r['검증']} {hv}"
                  f" | {u['구간에서 그 장'] * 100:4.1f}% 대 {u['평소 그 장'] * 100:4.1f}% ({u['구간 날']}일)")
        if not hit:
            print("   통과 없음")

    show(rows_a, "== 가. 새 지표 14개 (1차 사건) — 찾는 기간 통과 (중앙 백분위 · 같은 쪽 · n | 검증 | 쓸모)")
    print("   동떨어진 사건:", len(outl_a))
    cnt = lambda grp, ty: sum(e["장"] == ty for e in grp)
    print("== 나. 가격 변화율로 나눈 장 — 사건 수 (찾기 / 검증): " + " · ".join(f"{ty} {cnt(find_b, ty) + cnt(outl_b, ty)} / {cnt(hold_b, ty)}" for ty in P1.TYPES.values()))
    print("   동떨어진 사건(빼고 봄):", "; ".join(f"{e['코인']} {e['시작'].date()} {e['장']}({e['변화'] * 100:+.0f}%)" for e in outl_b) or "없음")
    show(rows_b, "   지표 34개 — 찾는 기간 통과")
    print("== 다. 조용함 뒤 돌파 방향 (뒤 30일 수익 중앙값 · 오른 비율 · n, 평소 중앙값)")
    for pn, b in brk.items():
        print(f"   {pn}: 위 돌파 {b['위']['중앙값'] * 100:+5.1f}% · 오름 {b['위']['오른 비율'] * 100:3.0f}% · n {b['위']['n']} | 아래 돌파 {b['아래']['중앙값'] * 100:+5.1f}% · 오름 {b['아래']['오른 비율'] * 100:3.0f}% · n {b['아래']['n']}"
              f" | 평소 {b['평소 중앙값'] * 100:+5.1f}% | {'통과' if b['통과'] else '실패'}")


if __name__ == "__main__":
    main()
