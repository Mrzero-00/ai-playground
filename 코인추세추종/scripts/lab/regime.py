"""장 판별·전환 감지 (RESEARCH.md '장 판별·전환 감지 등록'). 바이낸스 현물 일봉, 찾기 BTC·ETH / 확인 다른 코인 10개.
(A) 그날까지의 자료로 지금 장을 판별하는 정확도, (B) 장이 바뀔 때 먼저 켜지는 신호의 적중률·잡은 비율·선행 일수.
파라미터는 등록한 기본값 그대로 — 결과를 보고 고르지 않는다.
사용법: python3 scripts/lab/regime.py   → data/lab/regime.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from indicators import rsi, sma, true_range, wilder

DEV = ["BTC", "ETH"]
VAL = ["BNB", "XRP", "ADA", "LTC", "TRX", "ETC", "LINK", "DOGE", "XLM", "SOL"]
LAMS = [0.3, 0.2]
WARM, NEW, AFTER = 365, 45, 30  # 판별기가 다 차는 날 · 새 장 '초반' · 전환 뒤 정확도 구간
COST = 0.001


def load(sym):
    d = pd.read_csv(C.ML / f"spot_{sym}.csv", parse_dates=["date"], index_col="date")[["open", "high", "low", "close", "volume"]].astype(float)
    return d[d.index <= "2026-11-22"]


def lam_label(x, lam):
    """사후 2상태: 고점에서 lam 떨어지면 고점 다음 날부터 하락, 저점에서 lam 오르면 저점 다음 날부터 상승."""
    n = len(x)
    hi_i = lo_i = 0
    state = 0
    pivots = []  # (경계 날짜 인덱스, 그 날까지의 상태)
    for i in range(1, n):
        if state >= 0 and x[i] > x[hi_i]:
            hi_i = i
        if state <= 0 and x[i] < x[lo_i]:
            lo_i = i
        if state >= 0 and x[i] <= x[hi_i] * (1 - lam):
            pivots.append((hi_i, 1))
            state, lo_i = -1, i
        elif state <= 0 and x[i] >= x[lo_i] * (1 + lam):
            pivots.append((lo_i, -1))
            state, hi_i = 1, i
    lab, s = np.zeros(n, int), 0
    for p, st in pivots:
        lab[s:p + 1] = st
        s = p + 1
    lab[s:] = state
    return lab


def lam_realtime(x, lam):
    """같은 규칙을 그날까지로: lam 만큼 움직인 게 확인된 날부터 바뀐다. 첫 확인 전은 0."""
    n = len(x)
    out, state, hi, lo = np.zeros(n, int), 0, x[0], x[0]
    for i in range(n):
        hi, lo = max(hi, x[i]), min(lo, x[i])
        if state >= 0 and x[i] <= hi * (1 - lam):
            state, lo = -1, x[i]
        elif state <= 0 and x[i] >= lo * (1 + lam):
            state, hi = 1, x[i]
        out[i] = state
    return out


def label3(c):
    r = c.shift(-30) / c.shift(30) - 1
    h = 0.5 * r.abs().median()
    return np.where(r >= h, 1, np.where(r <= -h, -1, 0)), r.notna().to_numpy()


def adx(d, n=14):
    up, dn = d.high.diff(), -d.low.diff()
    pdm = pd.Series(np.where((up > dn) & (up > 0), up, 0.0), index=d.index)
    mdm = pd.Series(np.where((dn > up) & (dn > 0), dn, 0.0), index=d.index)
    atr = wilder(true_range(d), n)
    pdi, mdi = 100 * wilder(pdm, n) / atr, 100 * wilder(mdm, n) / atr
    return wilder(100 * (pdi - mdi).abs() / (pdi + mdi), n), pdi, mdi


def classifiers(d):
    """판별기마다 (3상태, 2상태). 3상태가 없는 것은 None."""
    c = d.close
    r60 = c / c.shift(60) - 1
    h = 0.5 * r60.abs().expanding().median()
    ma = c / sma(c, 200)
    w = sum((c > sma(c, n)).astype(float) for n in (20, 50, 100, 200)) / 4
    a, pdi, mdi = adx(d)
    tr = true_range(d)
    chop = 100 * np.log10(tr.rolling(14).sum() / (d.high.rolling(14).max() - d.low.rolling(14).min())) / np.log10(14)
    r14 = np.sign(c / c.shift(14) - 1)
    out = {
        "지난 60일 수익": (np.where(r60 >= h, 1, np.where(r60 <= -h, -1, 0)), np.where(r60 > 0, 1, -1)),
        "200일선": (np.where(ma > 1.05, 1, np.where(ma < 0.95, -1, 0)), np.where(ma > 1, 1, -1)),
        "앙상블 비중": (np.where(w >= 0.75, 1, np.where(w <= 0.25, -1, 0)), np.where(w > 0.5, 1, -1)),
        "ADX 14": (np.where(a < 20, 0, np.where(pdi > mdi, 1, -1)), np.where(pdi > mdi, 1, -1)),
        "초피니스 14": (np.where(chop > 61.8, 0, np.where(r14 > 0, 1, -1)), np.where(r14 > 0, 1, -1)),
    }
    for lam in LAMS:
        out[f"실시간 λ {lam:.0%}"] = (None, lam_realtime(c.to_numpy(), lam))
    return out


def acc_stats(pred, lab, change_near, classes):
    ok = pred == lab
    rec = {k: float(ok[lab == k].mean()) if (lab == k).any() else None for k in classes}
    vals = [v for v in rec.values() if v is not None]
    return {"정확도": float(ok.mean()), "균형 정확도": float(np.mean(vals)), "상태별": rec, "전환 뒤 30일": float(ok[change_near].mean()) if change_near.any() else None}


def near_change(lab):
    chg = np.r_[False, lab[1:] != lab[:-1]]
    near = np.zeros(len(lab), bool)
    for i in np.where(chg)[0]:
        near[i:i + AFTER] = True
    return near


def hold_stats(c, pos):
    """pos(t) 는 t 종가에 정해 t+1 수익에. 편도 0.10%."""
    p = pd.Series(pos, index=c.index).astype(float)
    ret = p.shift() * c.pct_change() - COST * p.diff().abs().shift().fillna(0)
    ret = ret.iloc[WARM:].fillna(0)
    eq = (1 + ret).cumprod()
    yrs = len(ret) / 365
    return {"연복리": float(eq.iloc[-1] ** (1 / yrs) - 1), "샤프": float(ret.mean() / ret.std() * np.sqrt(365)) if ret.std() > 0 else 0.0, "MDD": float((eq / eq.cummax() - 1).min())}


def swings(d, k=5):
    """10일 스윙(앞뒤 5일), k 일 늦게 확인. 날 t 에 알 수 있는 마지막 두 스윙 저점·고점."""
    lo, hi = d.low.to_numpy(), d.high.to_numpy()
    n = len(lo)
    sl, sh = [], []
    L1, L0, H1, H0 = (np.full(n, np.nan) for _ in range(4))
    for t in range(n):
        j = t - k
        if j - k >= 0:
            if lo[j] == lo[j - k:j + k + 1].min():
                sl.append(lo[j])
            if hi[j] == hi[j - k:j + k + 1].max():
                sh.append(hi[j])
        if len(sl) >= 2:
            L1[t], L0[t] = sl[-1], sl[-2]
        if len(sh) >= 2:
            H1[t], H0[t] = sh[-1], sh[-2]
    return L1, L0, H1, H0


def daily_funding_mean(sym):
    p = C.ML / f"funding_{sym}.csv"
    if not p.exists():
        return None
    f = pd.read_csv(p, parse_dates=["time"])
    s = f.groupby((f.time - pd.Timedelta(seconds=1)).dt.tz_localize(None).dt.normalize()).rate.sum()
    return s.asfreq("D").fillna(0).rolling(7).mean()


def signals(d, sym):
    """바닥 신호(하락 → 상승)와 꼭대기 신호(상승 → 하락). 조건이 거짓에서 참이 되는 날만 켜진다."""
    c, o, v = d.close, d.open, d.volume
    m20 = sma(c, 20)
    w = sum((c > sma(c, n)).astype(float) for n in (20, 50, 100, 200)) / 4
    vmean = v.rolling(20).mean().shift()
    L1, L0, H1, H0 = swings(d)
    cc = c.to_numpy()
    r = rsi(c, 14)
    r20 = c / c.shift(20) - 1

    def event(cond):
        cond = pd.Series(np.asarray(cond, bool), index=d.index)
        return (cond & ~cond.shift(fill_value=False)).to_numpy()

    bottom = {
        "20일선 돌파": event(c > m20),
        "앙상블 첫 변화": event(w > 0),
        "거래량 급증": event((c > o) & (v > 2 * vmean)),
        "고점·저점 구조": event((L1 > L0) & (cc > H1)),
        "RSI 다이버전스": event((c < c.shift(30)) & (r > r.shift(30)) & (r.shift() < 30) & (r >= 30)),
        "하락 둔화": event((r20 > -0.05) & (r20.rolling(20).min() < -0.20)),
    }
    top = {
        "20일선 돌파": event(c < m20),
        "앙상블 첫 변화": event(w < 1),
        "거래량 급증": event((c < o) & (v > 2 * vmean)),
        "고점·저점 구조": event((H1 < H0) & (cc < L1)),
        "RSI 다이버전스": event((c > c.shift(30)) & (r < r.shift(30)) & (r.shift() > 70) & (r <= 70)),
        "하락 둔화": event((r20 < 0.05) & (r20.rolling(20).max() > 0.20)),
    }
    fm = daily_funding_mean(sym) if sym in DEV else None
    if fm is not None:
        fm = fm.reindex(d.index)
        fm = fm.shift()  # D 날짜 합은 D+1 00:00 에 끝난다 — D+1 일봉에서 쓴다
        bottom["펀딩비 전환"] = event(fm > 0) & (fm.shift() < 0).to_numpy()
        top["펀딩비 전환"] = event(fm < 0) & (fm.shift() > 0).to_numpy()
    return bottom, top


def score(fire, rt, lab, side):
    """side = 1 바닥 신호(실시간 하락일 때만, 새 장 = 상승), −1 꼭대기 신호."""
    n = len(lab)
    start = np.zeros(n, int)
    for i in range(1, n):
        start[i] = i if lab[i] != lab[i - 1] else start[i - 1]
    watch = (rt == -side) & (np.arange(n) >= WARM)
    newreg = (lab == side) & (np.arange(n) - start <= NEW)
    hit = fire & watch & newreg
    false = fire & watch & (lab == -side)
    late = fire & watch & (lab == side) & ~newreg
    base_hit, base_false = (watch & newreg).sum(), (watch & (lab == -side)).sum()
    turns = [i for i in range(max(WARM, 1), n) if lab[i] == side and lab[i - 1] == -side]
    caught, leads = 0, []
    for b in turns:
        conf = next((j for j in range(b, n) if rt[j] == side), None)
        hs = [j for j in range(b, min(b + NEW + 1, n)) if hit[j]]
        if hs:
            caught += 1
            if conf is not None:
                leads.append(conf - hs[0])
    return dict(켜짐=int((fire & watch).sum()), 적중=int(hit.sum()), 헛경보=int(false.sum()), 늦음=int(late.sum()), 기준적중=int(base_hit), 기준헛=int(base_false),
                전환=len(turns), 잡음=caught, 선행=leads)


def summarize(parts):
    tot = {k: sum(p[k] for p in parts) for k in ("켜짐", "적중", "헛경보", "늦음", "기준적중", "기준헛", "전환", "잡음")}
    leads = sum((p["선행"] for p in parts), [])
    prec = tot["적중"] / (tot["적중"] + tot["헛경보"]) if tot["적중"] + tot["헛경보"] else None
    base = tot["기준적중"] / (tot["기준적중"] + tot["기준헛"]) if tot["기준적중"] + tot["기준헛"] else None
    return dict(tot, 적중률=prec, 기준=base, 배수=(prec / base) if prec is not None and base else None, 잡은비율=tot["잡음"] / tot["전환"] if tot["전환"] else None,
                선행중앙=float(np.median(leads)) if leads else None, 선행수=len(leads))


def main():
    groups = {"찾기 (BTC·ETH)": DEV, "확인 (다른 코인 10개)": VAL}
    acc3, acc2, value, trans = {}, {lam: {} for lam in LAMS}, {}, {lam: {} for lam in LAMS}
    pool = {g: {"3": {}, "2": {lam: {} for lam in LAMS}, "hold": {}, "bot": {lam: {} for lam in LAMS}, "top": {lam: {} for lam in LAMS}} for g in groups}
    for g, syms in groups.items():
        for s in syms:
            d = load(s)
            c, x = d.close, d.close.to_numpy()
            cl = classifiers(d)
            l3, ok3 = label3(c)
            ok3 = ok3 & (np.arange(len(x)) >= WARM)
            near3 = near_change(l3)
            for name, (p3, p2) in cl.items():
                if p3 is not None:
                    pool[g]["3"].setdefault(name, []).append((p3[ok3], l3[ok3], near3[ok3]))
            labs = {lam: lam_label(x, lam) for lam in LAMS}
            for lam, lab in labs.items():
                ok2 = (np.arange(len(x)) >= WARM)
                near2 = near_change(lab)
                for name, (p3, p2) in cl.items():
                    pool[g]["2"][lam].setdefault(name, []).append((np.asarray(p2)[ok2], lab[ok2], near2[ok2]))
            pool[g]["hold"].setdefault("사후 라벨 λ 30% (미래를 본 상한)", []).append(hold_stats(c, labs[0.3] == 1))
            pool[g]["hold"].setdefault("그냥 보유", []).append(hold_stats(c, np.ones(len(x))))
            for name, (p3, p2) in cl.items():
                pool[g]["hold"].setdefault(name, []).append(hold_stats(c, np.asarray(p2) == 1))
            bottom, top = signals(d, s)
            for lam, lab in labs.items():
                rt = lam_realtime(x, lam)
                for name, f in bottom.items():
                    pool[g]["bot"][lam].setdefault(name, []).append(score(f, rt, lab, 1))
                for name, f in top.items():
                    pool[g]["top"][lam].setdefault(name, []).append(score(f, rt, lab, -1))
    out = {"made": datetime.now().isoformat(timespec="seconds"), "groups": {g: v for g, v in groups.items()}, "A3": {}, "A2": {}, "hold": {}, "B": {}}
    for g in groups:
        out["A3"][g] = {}
        for name, parts in pool[g]["3"].items():
            p, l, nr = (np.concatenate([q[i] for q in parts]) for i in range(3))
            out["A3"][g][name] = acc_stats(p, l, nr, (1, 0, -1))
        maj = max((1, 0, -1), key=lambda k: np.mean(l == k))
        out["A3"][g]["가장 많은 상태로만"] = {"정확도": float(np.mean(l == maj)), "균형 정확도": 1 / 3, "상태별": {k: float(k == maj) for k in (1, 0, -1)}, "전환 뒤 30일": None}
        out["A2"][g] = {}
        for lam in LAMS:
            out["A2"][g][f"{lam:.0%}"] = {}
            for name, parts in pool[g]["2"][lam].items():
                p, l, nr = (np.concatenate([q[i] for q in parts]) for i in range(3))
                out["A2"][g][f"{lam:.0%}"][name] = acc_stats(p, l, nr, (1, -1))
            out["A2"][g][f"{lam:.0%}"]["어제 장 = 오늘 장 (사후 라벨을 하루 늦게 앎)"] = None
        out["hold"][g] = {name: {k: float(np.median([v[k] for v in vs])) for k in ("연복리", "샤프", "MDD")} for name, vs in pool[g]["hold"].items()}
        out["B"][g] = {f"{lam:.0%}": {"바닥": {n: summarize(ps) for n, ps in pool[g]["bot"][lam].items()},
                                       "꼭대기": {n: summarize(ps) for n, ps in pool[g]["top"][lam].items()}} for lam in LAMS}
    v = out["B"]["확인 (다른 코인 10개)"]["30%"]
    out["후보"] = [f"{side} · {n}" for side in ("바닥", "꼭대기") for n, r in v[side].items()
                 if r["배수"] is not None and r["배수"] >= 1.5 and (r["잡은비율"] or 0) >= 0.5 and r["선행중앙"] is not None and r["선행중앙"] >= 0]
    (C.OUT / "regime.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))

    for g in groups:
        print(f"== {g}  (A) 3상태")
        for name, r in out["A3"][g].items():
            print(f"   {name:16s} 정확도 {r['정확도'] * 100:4.0f}% 균형 {r['균형 정확도'] * 100:4.0f}% | 상승 {r['상태별'][1] * 100:3.0f}% 정체 {r['상태별'][0] * 100:3.0f}% 하락 {r['상태별'][-1] * 100:3.0f}%"
                  + (f" | 전환 뒤 30일 {r['전환 뒤 30일'] * 100:3.0f}%" if r["전환 뒤 30일"] is not None else ""))
        for lam in LAMS:
            print(f"   (A) 2상태 λ {lam:.0%}")
            for name, r in out["A2"][g][f"{lam:.0%}"].items():
                if r:
                    print(f"      {name:16s} 정확도 {r['정확도'] * 100:4.0f}% 균형 {r['균형 정확도'] * 100:4.0f}% | 전환 뒤 30일 {r['전환 뒤 30일'] * 100:3.0f}%")
        print("   상승일 때만 보유 (코인별 중앙값)")
        for name, r in out["hold"][g].items():
            print(f"      {name:30s} 연 {r['연복리'] * 100:+5.0f}% 샤프 {r['샤프']:.2f} MDD {r['MDD'] * 100:4.0f}%")
        for lam in LAMS:
            for side in ("바닥", "꼭대기"):
                print(f"   (B) λ {lam:.0%} {side} 신호")
                for name, r in out["B"][g][f"{lam:.0%}"][side].items():
                    pc = lambda x: "-" if x is None else f"{x * 100:.0f}"
                    mult = "-" if r["배수"] is None else f"{r['배수']:.1f}"
                    print(f"      {name:12s} 켜짐 {r['켜짐']:4d} 적중률 {pc(r['적중률'])}% (기준 {pc(r['기준'])}%, {mult}배) 잡음 {r['잡음']}/{r['전환']} 선행 중앙 {r['선행중앙']}일")
    print("감시 도구 후보:", out["후보"])


if __name__ == "__main__":
    main()
