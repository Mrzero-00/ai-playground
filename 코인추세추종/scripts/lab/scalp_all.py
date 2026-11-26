"""단타 전면 분석 (RESEARCH.md '단타 전면 분석 — 모든 상황에서 절대 손실인가'). 전략 8 × 봉 5 × 방향 2 × 비용 4, BTC · ETH,
바이낸스 현물 1분봉 2022 ~ 2026-11. 비용 전 엣지 · 손익분기 편도 비용 · 비용별 연 수익 · 해마다 · 장마다.
사용법: python3 scripts/lab/scalp_all.py   → data/lab/scalp_all.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
from regime3 import grade, hyst
from shortterm import bars, load

SYMS = ["BTC", "ETH"]
TFS = {"1분": "1min", "5분": "5min", "15분": "15min", "1시간": "1h", "4시간": "4h"}
COSTS = {"0": 0.0, "0.02%": 0.0002, "0.05%": 0.0005, "0.10%": 0.001}
YEARS = [2022, 2023, 2024, 2025, 2026]
TYPES = {2: "대상승", 1: "상승", 0: "횡보", -1: "하락", -2: "대하락"}


def rsi(c, n=14):
    d = c.diff()
    up, dn = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean(), (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn)


def state(enter, exit_):
    """진입 조건이 켜지면 1, 청산 조건이 켜지면 0, 그 사이는 앞 상태."""
    s = pd.Series(np.nan, index=enter.index)
    s[exit_.fillna(False).to_numpy()] = 0.0
    s[enter.fillna(False).to_numpy()] = 1.0
    return s.ffill().fillna(0.0)


def positions(b, name, ls):
    """봉 t 종가에 정한 포지션(−1 · 0 · 1). ls = 롱숏."""
    c, h, l = b.close, b.high, b.low
    if name == "S1 짧은 모멘텀":
        r = c.pct_change()
        return (np.sign(r) if ls else (r > 0).astype(float)).fillna(0.0)
    if name == "S2 짧은 되돌림":
        r = c.pct_change()
        return (-np.sign(r) if ls else (r < 0).astype(float)).fillna(0.0)
    if name == "S3 이동평균 5/20":
        d = c.rolling(5).mean() - c.rolling(20).mean()
        return (np.sign(d) if ls else (d > 0).astype(float)).fillna(0.0)
    if name == "S4 RSI 되돌림":
        x = rsi(c)
        p = state(x < 30, x > 50)
        return p - state(x > 70, x < 50) if ls else p
    m, sd = c.rolling(20).mean(), c.rolling(20).std()
    up, lo = m + 2 * sd, m - 2 * sd
    if name == "S5 볼린저 되돌림":
        p = state(c < lo, c >= m)
        return p - state(c > up, c <= m) if ls else p
    if name == "S6 볼린저 돌파":
        p = state(c > up, c < m)
        return p - state(c < lo, c > m) if ls else p
    if name == "S7 돈치안 돌파":
        hi20, lo10, lo20, hi10 = h.rolling(20).max().shift(), l.rolling(10).min().shift(), l.rolling(20).min().shift(), h.rolling(10).max().shift()
        p = state(c > hi20, c < lo10)
        return p - state(c < lo20, c > hi10) if ls else p
    raise ValueError(name)


def larry(m, ls):
    """S8 변동성 돌파(1분봉): 그날 시가 ± 0.5 × 전날 범위를 처음 넘은 쪽으로, 그날 마지막 봉에 정리(다음 날 시가에 판다)."""
    day = m.index.normalize()
    d = m.groupby(day).agg(open=("open", "first"), high=("high", "max"), low=("low", "min"))
    rng = (d.high - d.low).shift()
    up_t = (d.open + 0.5 * rng).reindex(day).to_numpy()
    dn_t = (d.open - 0.5 * rng).reindex(day).to_numpy()
    c = m.close.to_numpy()
    upx = pd.Series(c > up_t, index=m.index).groupby(day).cummax().to_numpy()
    dnx = pd.Series(c < dn_t, index=m.index).groupby(day).cummax().to_numpy() if ls else np.zeros(len(c), bool)
    pos = np.arange(len(c))
    fu = pd.Series(np.where(c > up_t, pos, np.iinfo(np.int64).max), index=m.index).groupby(day).cummin().to_numpy()
    fd = pd.Series(np.where(c < dn_t, pos, np.iinfo(np.int64).max), index=m.index).groupby(day).cummin().to_numpy() if ls else np.full(len(c), np.iinfo(np.int64).max)
    p = np.where(upx & (fu <= fd), 1.0, np.where(dnx & (fd < fu), -1.0, 0.0))
    last = pd.Series(pos, index=m.index).groupby(day).transform("max").to_numpy() == pos
    p[last] = 0.0
    return pd.Series(p, index=m.index)


def daily_labels(m):
    """그날의 5단계 장(사후 정답, 가운데 60일 z, 여유 정답) — 장 판별 루프와 같은 정의."""
    c = m.close.groupby(m.index.normalize()).last()
    lr = np.log(c)
    zc = (lr.shift(-30) - lr.shift(30)) / (lr.diff().rolling(60).std().shift(-30) * np.sqrt(60))
    ok = zc.notna()
    return pd.Series(hyst(zc[ok]), index=zc[ok].index).reindex(c.index)


def evaluate(b, p, lab):
    c = b.close.to_numpy()
    ret = np.r_[0.0, c[1:] / c[:-1] - 1]
    pv = p.to_numpy()
    gross = np.r_[0.0, pv[:-1]] * ret
    turn = np.abs(np.r_[pv[0], np.diff(pv)])
    idx = b.index
    yrs = (idx[-1] - idx[0]).days / 365
    out = {"거래(연)": float(turn.sum() / 2 / yrs), "비용 전 합": float(gross.sum()), "회전": float(turn.sum())}
    out["손익분기 편도"] = float(gross.sum() / turn.sum()) if turn.sum() > 0 else None
    out["거래당 비용 전"] = float(gross.sum() / (turn.sum() / 2)) if turn.sum() > 0 else None
    year = idx.year.to_numpy()
    for cn, cost in COSTS.items():
        net = gross - cost * turn
        lg = np.log1p(np.maximum(net, -0.999999))
        out[cn] = {"연 수익": float(np.exp(lg.sum() / yrs) - 1), "해마다": {str(y): float(np.exp(lg[year == y].sum()) - 1) for y in YEARS}}
    lb = lab.reindex(idx.normalize()).to_numpy()
    out["장마다"] = {}
    for g, nm in TYPES.items():
        k = lb == g
        days = k.sum() * (idx[1] - idx[0]).total_seconds() / 86400 if len(idx) > 1 else 0
        if days > 30:
            out["장마다"][nm] = {cn: float((gross[k] - cost * turn[k]).sum() / days * 365) for cn, cost in (("0", 0.0), ("0.05%", 0.0005))}
    return out


def judge(r):
    a = r["0.05%"]
    return bool(a["연 수익"] > 0 and sum(v > 0 for v in a["해마다"].values()) >= 4)


def bench(m):
    """같은 기간 일봉 봇(현물 앙상블, 편도 0.10%)과 그냥 보유."""
    c = m.close.groupby(m.index.normalize()).last()
    w = sum((c > c.rolling(n).mean()).astype(float) for n in (20, 50, 100, 200)) / 4
    r = (w.shift() * c.pct_change() - 0.001 * w.diff().abs().shift()).fillna(0.0)
    yrs = (c.index[-1] - c.index[0]).days / 365
    return {"일봉 봇 연 수익": float((1 + r).prod() ** (1 / yrs) - 1), "보유 연 수익": float((c.iloc[-1] / c.iloc[0]) ** (1 / yrs) - 1),
            "봇 해마다": {str(y): float((1 + r[r.index.year == y]).prod() - 1) for y in YEARS}}


def main():
    out = {"made": datetime.now().isoformat(timespec="seconds"), "rows": {}, "bench": {}}
    for s in SYMS:
        m = load(s)
        lab = daily_labels(m)
        out["bench"][s] = bench(m)
        for tn, rule in TFS.items():
            b = bars(m, rule)
            for name in ("S1 짧은 모멘텀", "S2 짧은 되돌림", "S3 이동평균 5/20", "S4 RSI 되돌림", "S5 볼린저 되돌림", "S6 볼린저 돌파", "S7 돈치안 돌파"):
                for ls in (False, True):
                    r = evaluate(b, positions(b, name, ls), lab)
                    r["통과"] = judge(r)
                    out["rows"][f"{s} · {tn} · {name} · {'롱숏' if ls else '롱만'}"] = r
            print(s, tn, "끝", flush=True)
        for ls in (False, True):
            r = evaluate(m, larry(m, ls), lab)
            r["통과"] = judge(r)
            out["rows"][f"{s} · 1분 · S8 변동성 돌파 · {'롱숏' if ls else '롱만'}"] = r
    (C.OUT / "scalp_all.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    rows = out["rows"]
    print(f"== 칸 {len(rows)}개. 손익분기 편도 비용(이보다 수수료가 낮아야 이익)의 분포")
    be = np.array([r["손익분기 편도"] if r["손익분기 편도"] is not None else np.nan for r in rows.values()])
    for lim in (0.0, 0.0002, 0.0005, 0.001):
        print(f"   손익분기 > {lim * 100:.2f}% 인 칸: {int(np.nansum(be > lim))}개")
    print("== 봉 길이마다: 칸 수 · 비용 전 연 수익 > 0 인 칸 · 손익분기 > 0.05% 인 칸 · 0.05% 에서 통과(연 + · 다섯 해 중 넷 +)")
    for tn in TFS:
        ks = [k for k in rows if f" · {tn} · " in k]
        print(f"   {tn:4s} {len(ks):3d}칸 · 비용 전 + {sum(rows[k]['0']['연 수익'] > 0 for k in ks):3d} · 손익분기 > 0.05% {sum((rows[k]['손익분기 편도'] or 0) > 0.0005 for k in ks):3d} · 통과 {sum(rows[k]['통과'] for k in ks):3d}")
    print("== 손익분기가 가장 높은 칸 15개 (손익분기 편도 · 거래당 비용 전 · 연 거래 · 연 수익 비용 전 / 0.05% / 0.10% · 0.05% 해마다)")
    top = sorted(rows.items(), key=lambda kv: -(kv[1]["손익분기 편도"] or -1))[:15]
    for k, r in top:
        print(f"   {k:44s} {r['손익분기 편도'] * 100:6.3f}% · {r['거래당 비용 전'] * 100:6.3f}% · {r['거래(연)']:7.0f}회 · {r['0']['연 수익'] * 100:+6.0f}% / {r['0.05%']['연 수익'] * 100:+6.0f}% / {r['0.10%']['연 수익'] * 100:+6.0f}%"
              f" · " + " ".join(f"{y[2:]} {v * 100:+.0f}" for y, v in r["0.05%"]["해마다"].items()) + (" ★ 통과" if r["통과"] else ""))
    win = {k: r for k, r in rows.items() if r["통과"]}
    both = {}
    for k in win:
        key = k.split(" · ", 1)[1]
        both[key] = both.get(key, 0) + 1
    print("== 0.05% 에서 통과한 칸:", len(win), "· 두 코인 모두 통과한 전략·봉·방향:", [k for k, v in both.items() if v == 2] or "없음")
    print("== 장마다 연 환산 비용 전 수익(모든 칸 평균) · 0.05%")
    for nm in TYPES.values():
        g0 = [r["장마다"][nm]["0"] for r in rows.values() if nm in r["장마다"]]
        g5 = [r["장마다"][nm]["0.05%"] for r in rows.values() if nm in r["장마다"]]
        print(f"   {nm:4s} 비용 전 평균 {np.mean(g0) * 100:+7.1f}% · 칸 중 + {sum(x > 0 for x in g0)}/{len(g0)} | 0.05% 평균 {np.mean(g5) * 100:+8.1f}% · + {sum(x > 0 for x in g5)}/{len(g5)}")
    for s, b in out["bench"].items():
        print(f"== 비교 {s}: 일봉 봇 연 {b['일봉 봇 연 수익'] * 100:+.0f}% · 보유 연 {b['보유 연 수익'] * 100:+.0f}% · 봇 해마다 " + " ".join(f"{y[2:]} {v * 100:+.0f}" for y, v in b["봇 해마다"].items()))


if __name__ == "__main__":
    main()
