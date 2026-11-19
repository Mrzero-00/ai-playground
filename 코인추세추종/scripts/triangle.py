"""삼각수렴 돌파 선물 백테스트 (사전 등록: TRIANGLE.md). 바이낸스 무기한 실제 가격·거래량·펀딩비, USDT 기준.
사용법:
  python3 scripts/triangle.py --fetch   # 4시간봉 받기 → data/ml/perp4h_<SYM>.csv (일봉·펀딩은 fetch_ml.py)
  python3 scripts/triangle.py           # 백테스트 + 판정 + 진단
"""
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

FETCH = "--fetch" in sys.argv
sys.argv = [a for a in sys.argv if a != "--fetch"]  # backtest 가 첫 인자를 비용으로 읽는다
from backtest import DATA
from futures_backtest import SPLIT, SYMBOLS, stats

ML = DATA / "ml"
BARS = {"일봉": ("perp_{}.csv", "date", "D"), "4시간": ("perp4h_{}.csv", "time", "4h")}
WINDOWS = [20, 40, 60]
METHODS = {"A": "기본 돌파", "B": "교과서 방향", "C": "거래량 확인", "D": "꼭지 위치", "E": "되돌림 진입", "F": "엄격", "G": "실패 패턴"}
COSTS = (0.001, 0.0025)
K = 3  # 꼭짓점: 앞뒤 K 봉보다 높은 고가 / 낮은 저가
SHRINK, FLAT = 0.6, 0.1  # 폭이 시작의 60% 이하로 좁아짐 / 시작 폭의 10% 이내로 움직인 선은 수평
APEX = (0.25, 0.5)  # 돌파 때 폭 ÷ 시작 폭. 밑변~꼭지의 1/2 ~ 3/4 지점
RETEST, VOL_N = 10, 30  # 되돌림을 기다리는 봉 수 / 돌파 거래량을 견줄 평균의 봉 수
EXPECT = {"상승 삼각형": 1, "하락 쐐기": 1, "하락 삼각형": -1, "상승 쐐기": -1}  # 대칭은 앞선 추세 방향
F0 = {"샤프": 0.86, "MDD": -37.5, "샤프_0.25": 0.77}  # 채택 기준 (TRIANGLE.md)


def fetch():
    from fetch_ml import get, save
    now = datetime.now(timezone.utc).timestamp() * 1000
    for sym in SYMBOLS:
        rows, start = [], 1567296000000  # 2019-09-01
        while True:
            batch = get(f"https://fapi.binance.com/fapi/v1/klines?symbol={sym}USDT&interval=4h&startTime={start}&limit=1500")
            rows += [[datetime.fromtimestamp(k[0] / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M"), *k[1:6]] for k in batch if k[6] < now]  # 진행 중인 봉은 뺀다
            if len(batch) < 1500:
                break
            start = batch[-1][0] + 1
        save(f"perp4h_{sym}.csv", ["time", "open", "high", "low", "close", "volume"], rows)


def bars(sym, tf):
    """봉 시작 시각이 인덱스. fund = 그 봉이 끝날 때까지 붙은 펀딩비 합."""
    name, col, freq = BARS[tf]
    d = pd.read_csv(ML / name.format(sym), parse_dates=[col], index_col=col)[["open", "high", "low", "close", "volume"]].asfreq(freq).ffill()
    f = pd.read_csv(ML / f"funding_{sym}.csv", parse_dates=["time"])
    at = (f.time - pd.Timedelta(seconds=1)).dt.tz_localize(None).dt.floor(freq)
    d["fund"] = f.groupby(at).rate.sum().reindex(d.index).fillna(0.0)
    return d


def find(hi, lo, cl, vol, ph, pl, t, W):
    """봉 t 에서 삼각수렴 돌파를 찾는다. 없으면 None."""
    s = t - W + 1
    x = np.arange(s, t - K + 1)
    xh, xl = x[ph[s:t - K + 1]], x[pl[s:t - K + 1]]
    if len(xh) < 2 or len(xl) < 2:
        return None
    au, bu = np.polyfit(xh, hi[xh], 1)
    al, bl = np.polyfit(xl, lo[xl], 1)
    s0 = min(xh[0], xl[0])  # 패턴 시작 = 가장 이른 꼭짓점
    H, now = (au - al) * s0 + bu - bl, (au - al) * t + bu - bl
    if H <= 0 or now <= 0 or now > SHRINK * H:
        return None
    j = np.arange(s0, t)
    if (cl[s0:t] > au * j + bu).any() or (cl[s0:t] < al * j + bl).any():  # 이미 돌파한 모양
        return None
    mu, ml = au * (t - s0) / H, al * (t - s0) / H  # 패턴 동안 선이 움직인 양 ÷ 시작 폭
    if mu < -FLAT and ml > FLAT:
        shape = "대칭 삼각형"
    elif abs(mu) <= FLAT and ml > FLAT:
        shape = "상승 삼각형"
    elif mu < -FLAT and abs(ml) <= FLAT:
        shape = "하락 삼각형"
    elif mu > FLAT and ml > FLAT:
        shape = "상승 쐐기"
    elif mu < -FLAT and ml < -FLAT:
        shape = "하락 쐐기"
    else:
        return None
    up, dn = au * t + bu, al * t + bl
    if dn <= cl[t] <= up:
        return None
    side = 1 if cl[t] > up else -1
    expect = EXPECT.get(shape) or (int(np.sign(cl[s0] - cl[s0 - W])) if s0 >= W else 0)
    vol_ok = t >= VOL_N and t - s0 >= 3 and np.polyfit(j, vol[s0:t], 1)[0] < 0 and vol[t] > vol[t - VOL_N:t].mean()
    return {"side": side, "H": H, "brk": up if side > 0 else dn, "stop": dn if side > 0 else up, "shape": shape, "t": t,
            "B": side == expect, "C": bool(vol_ok), "D": APEX[0] <= now / H <= APEX[1], "touch3": max(len(xh), len(xl)) >= 3}


def signals(d, W):
    hi, lo, cl, vol = (d[c].to_numpy() for c in ["high", "low", "close", "volume"])
    n = len(d)
    ph, pl = np.zeros(n, bool), np.zeros(n, bool)
    for i in range(K, n - K):
        ph[i] = hi[i] > max(hi[i - K:i].max(), hi[i + 1:i + K + 1].max())
        pl[i] = lo[i] < min(lo[i - K:i].min(), lo[i + 1:i + K + 1].min())
    return [find(hi, lo, cl, vol, ph, pl, t, W) if t >= W + K else None for t in range(n)]


def passes(method, g):
    if method in "AEG":
        return True
    if method == "F":
        return g["B"] and g["C"] and g["D"] and g["touch3"]
    return g[method]


def leave(p, o, h, l, c, late):
    """보유 중인 포지션이 이 봉에서 정리되는가. (가격, 사유) 또는 None."""
    side, stop, target = p["side"], p["stop"], p["target"]
    if (o - stop) * side <= 0:
        return o, "손절"  # 시가가 이미 넘었다
    if (o - target) * side >= 0:
        return o, "익절"
    if (l <= stop) if side > 0 else (h >= stop):
        return stop, "손절"  # 한 봉에서 둘 다 닿으면 손절로 친다
    if (h >= target) if side > 0 else (l <= target):
        return target, "익절"
    return (c, "시간") if late else None


def simulate(sym, d, sigs, W, cost, method):
    """(봉별 수익, 거래 목록)"""
    op, hi, lo, cl, fund = (d[c].to_numpy() for c in ["open", "high", "low", "close", "fund"])
    r, trades, pos, wait = np.zeros(len(d)), [], None, None

    def close_trade(t):
        trades.append({"마켓": sym, "W": W, "진입": d.index[pos["t0"]], "방향": "롱" if pos["side"] > 0 else "숏", "모양": pos["shape"], "사유": pos["why"],
                       "봉수": t - pos["t0"], "수익": (1 + r[pos["first"]:t + 1]).prod() - 1})

    def enter(t, side, px, H, stop, shape):
        """봉 t 안에서 px 에 진입. 그 봉의 남은 움직임까지 수익에 넣는다."""
        r[t] = side * (cl[t] / px - 1) - cost - side * fund[t]
        return {"side": side, "target": px + side * H, "stop": stop, "t0": t, "first": t, "shape": shape}

    for t in range(len(d)):
        if pos:
            out = leave(pos, op[t], hi[t], lo[t], cl[t], t - pos["t0"] >= W)
            r[t] = pos["side"] * ((out[0] if out else cl[t]) / cl[t - 1] - 1) - pos["side"] * fund[t] - (cost if t == pos["first"] else 0) - (cost if out else 0)
            if out:
                pos["why"] = out[1]
                close_trade(t)
                pos = None
            continue  # 정리한 다음 봉부터 다시 찾는다
        if wait and method == "E":  # 되돌림을 기다리는 중
            g, side = wait, wait["side"]
            if (lo[t] <= g["brk"]) if side > 0 else (hi[t] >= g["brk"]):
                px = min(op[t], g["brk"]) if side > 0 else max(op[t], g["brk"])
                pos, wait = enter(t, side, px, g["H"], g["stop"], g["shape"]), None
                if (lo[t] <= g["stop"]) if side > 0 else (hi[t] >= g["stop"]):  # 들어간 봉에서 손절선까지 갔다
                    r[t] = side * (g["stop"] / px - 1) - 2 * cost - side * fund[t]
                    pos["why"] = "손절"
                    close_trade(t)
                    pos = None
            elif (cl[t] - g["stop"]) * side <= 0 or t - g["t"] >= RETEST:
                wait = None
            continue
        if wait and method == "G":  # A 의 가상 거래를 지켜보는 중
            out = leave(wait, op[t], hi[t], lo[t], cl[t], t - wait["t0"] >= W)
            if out:
                g, wait = wait, None
                if out[1] == "손절":  # 반대쪽 선을 뚫었다 → 그 자리에서 반대로
                    pos = enter(t, -g["side"], out[0], g["H"], g["brk"], g["shape"])
                    if (cl[t] - pos["stop"]) * pos["side"] <= 0:  # 같은 봉 종가가 다시 처음 돌파선 밖
                        r[t] -= cost
                        pos["why"] = "손절"
                        close_trade(t)
                        pos = None
            continue
        g = sigs[t]
        if not g or not passes(method, g):
            continue
        if method == "E":
            wait = g
        elif method == "G":
            wait = {"side": g["side"], "target": cl[t] + g["side"] * g["H"], "stop": g["stop"], "t0": t, "H": g["H"], "brk": g["brk"], "shape": g["shape"]}
        else:
            pos = {"side": g["side"], "target": cl[t] + g["side"] * g["H"], "stop": g["stop"], "t0": t, "first": t + 1, "shape": g["shape"]}
    return pd.Series(r, index=d.index), trades


def daily(r):
    return (1 + r).groupby(r.index.normalize()).prod() - 1


def line(r):
    s = stats(r)
    return f"{s['연복리']:>7} / {s['샤프']:5.2f} / {s['MDD']:>6}"


def group(label, g):
    return f"{label} {len(g)}회(이긴 비율 {(g.수익 > 0).mean()*100:.0f}%, 평균 {g.수익.mean()*100:+.2f}%)"


def main():
    data = {(s, tf): bars(s, tf) for s in SYMBOLS for tf in BARS}
    sigs = {(s, tf, W): signals(data[s, tf], W) for (s, tf) in data for W in WINDOWS}
    ret, tr = {}, {}  # (방법, 봉, 비용) → 묶음 일 수익 / (방법, 봉) → 거래
    for m in METHODS:
        for tf in BARS:
            for cost in COSTS:
                per_w, trades = [], []
                for W in WINDOWS:
                    parts = [simulate(s, data[s, tf], sigs[s, tf, W], W, cost, m) for s in SYMBOLS]
                    per_w.append(pd.concat([daily(p[0]) for p in parts], axis=1).dropna().mean(axis=1))
                    trades += sum((p[1] for p in parts), [])
                ret[m, tf, cost] = pd.concat(per_w, axis=1).dropna().mean(axis=1)
                if cost == COSTS[0]:
                    tr[m, tf] = pd.DataFrame(trades, columns=["마켓", "W", "진입", "방향", "모양", "사유", "봉수", "수익"])

    r0 = ret["A", "일봉", COSTS[0]]
    print(f"바이낸스 무기한 {r0.index[0].date()} ~ {r0.index[-1].date()}, 편도 0.10%, USDT 기준. 묶음 = W {WINDOWS} 균등.  연복리 / 샤프 / MDD")
    print(f"{'방법':<16}{'표본 내 ~2022':>24}{'표본 외 2023~':>26}{'0.25%샤프':>9}{'표본외 거래':>8}  판정")
    for tf in BARS:
        for m, name in METHODS.items():
            r, hard, t = ret[m, tf, COSTS[0]], ret[m, tf, COSTS[1]], tr[m, tf]
            n = int((t.진입 >= SPLIT).sum())
            ins, oos, h = stats(r.loc[:SPLIT].iloc[:-1]), stats(r.loc[SPLIT:]), stats(hard.loc[SPLIT:])
            ok = [n >= 30, oos["샤프"] > F0["샤프"] and float(oos["MDD"].rstrip("%")) >= F0["MDD"], h["샤프"] >= F0["샤프_0.25"], ins["샤프"] > 0]
            verdict = "판단 불가(거래 부족)" if not ok[0] else "통과" if all(ok) else "기각 (" + "".join("○" if x else "×" for x in ok) + ")"
            print(f"{tf} {m} {name:<10}{line(r.loc[:SPLIT].iloc[:-1]):>26}{line(r.loc[SPLIT:]):>26}{h['샤프']:>9.2f}{n:>9}  {verdict}")
        print()

    print("[진단] 판정을 바꾸지 않는다")
    for tf in BARS:
        t, r = tr["A", tf], ret["A", tf, COSTS[0]]
        o = t[t.진입 >= SPLIT]
        print(f"\nA 기본 돌파 · {tf}: 전체 거래 {len(t)}회, 평균 보유 {t.봉수.mean():.1f}봉")
        print("  방향(전체): " + " · ".join(group(k, g) for k, g in t.groupby("방향")))
        print("  방향(표본 외): " + " · ".join(group(k, g) for k, g in o.groupby("방향")))
        print("  모양(전체): " + " · ".join(group(k, g) for k, g in t.groupby("모양")))
        print("  정리 사유: " + " · ".join(group(k, g) for k, g in t.groupby("사유")))
        print("  연도별 수익: " + " · ".join(f"{y} {v*100:+.0f}%" for y, v in ((1 + r).groupby(r.index.year).prod() - 1).items()))
        print("  연도별 숏 거래: " + " · ".join(f"{y} {len(g)}회 {g.수익.mean()*100:+.1f}%" for y, g in t[t.방향 == "숏"].groupby(t.진입.dt.year)))
    print("\n방법별 거래당 평균 수익 (전체 기간, 롱 / 숏):")
    for tf in BARS:
        print(f"  {tf}: " + " · ".join(f"{m} {t[t.방향 == '롱'].수익.mean()*100:+.2f}% / {t[t.방향 == '숏'].수익.mean()*100:+.2f}% ({len(t)}회)" for m in METHODS for t in [tr[m, tf]]))


if __name__ == "__main__":
    fetch() if FETCH else main()
