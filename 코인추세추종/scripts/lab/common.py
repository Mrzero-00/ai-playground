"""예측 방법 탐색 공용 (RESEARCH.md): 데이터·기준선·지표·워크포워드·DSR.
데이터 함수는 봉인 구간(2025-07-01~)을 잘라 내고 읽는다. open_seal() 을 부른 뒤에만 그 구간이 보인다.
"""
import json, math, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from statistics import NormalDist

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
ML, OUT = ROOT / "data" / "ml", ROOT / "data" / "lab"
SYMBOLS = ["BTC", "ETH"]
START = pd.Timestamp("2019-11-27")  # ETH 무기한 첫날 — 두 마켓이 다 있는 날부터 센다
DEV_END = pd.Timestamp("2025-06-30")  # 개발 구간 끝. 그 뒤는 봉인 구간
BLOCKS = [("2022-01-01", "2022-12-31"), ("2023-01-01", "2023-12-31"), ("2024-01-01", "2024-12-31"), ("2025-01-01", "2025-06-30")]
COST, COST_HARD = 0.001, 0.0025
MIN_TRAIN, MIN_TEST = 20, 30  # 워크포워드: 훈련 거래가 이보다 적은 칸은 고르지 않는다 / 시험 거래 기준
SMAS = [20, 50, 100, 200]
FREQ = {"1d": "D", "4h": "4h", "1h": "1h"}
SEAL = OUT / "seal_opened.json"
_open = False


def open_seal():
    """봉인 구간을 연다. 처음 연 시각이 남는다(RESEARCH.md 원칙 4)."""
    global _open
    _open = True
    if not SEAL.exists():
        SEAL.parent.mkdir(parents=True, exist_ok=True)
        SEAL.write_text(json.dumps({"at": datetime.now().isoformat(timespec="seconds")}))


def last_day():
    if not _open:
        return DEV_END
    return min(pd.Timestamp(pd.read_csv(ML / f"perp_{s}.csv", usecols=["date"]).date.max()) for s in SYMBOLS)


def days():
    return pd.date_range(START, last_day(), freq="D")


# ---------- 데이터 ----------

def fetch(tf):
    """바이낸스 무기한 tf 봉(거래량 포함) → data/ml/perp<tf>_<SYM>.csv. 진행 중인 봉은 뺀다. 파일에는 전부 받고, 읽을 때 자른다."""
    def get(url):
        for i in range(3):
            try:
                return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "coin-trend-lab"}), timeout=20))
            except Exception:
                if i == 2:
                    raise
                time.sleep(2 + i)
    now = datetime.now(timezone.utc).timestamp() * 1000
    for sym in SYMBOLS:
        rows, start = [], 1567296000000  # 2019-09-01
        while True:
            batch = get(f"https://fapi.binance.com/fapi/v1/klines?symbol={sym}USDT&interval={tf}&startTime={start}&limit=1500")
            rows += [[datetime.fromtimestamp(k[0] / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M"), *k[1:6]] for k in batch if k[6] < now]
            if len(batch) < 1500:
                break
            start = batch[-1][0] + 1
            time.sleep(0.2)
        pd.DataFrame(rows, columns=["time", "open", "high", "low", "close", "volume"]).to_csv(ML / f"perp{tf}_{sym}.csv", index=False)
        print(f"perp{tf}_{sym}.csv {len(rows)}줄 {rows[0][0]} ~ {rows[-1][0]}")


def perp(sym, tf):
    """바이낸스 무기한 봉. 인덱스 = 봉 시작(UTC). fund = 그 봉이 끝날 때까지 붙은 펀딩비 합(롱이 낸다)."""
    name, col = ("perp_{}.csv", "date") if tf == "1d" else (f"perp{tf}_{{}}.csv", "time")
    freq = FREQ[tf]
    d = pd.read_csv(ML / name.format(sym), parse_dates=[col], index_col=col)[["open", "high", "low", "close", "volume"]]
    d = d[d.index < last_day() + pd.Timedelta(days=1)].asfreq(freq).ffill()
    f = pd.read_csv(ML / f"funding_{sym}.csv", parse_dates=["time"])
    at = (f.time - pd.Timedelta(seconds=1)).dt.tz_localize(None).dt.floor(freq)
    d["fund"] = f.groupby(at).rate.sum().reindex(d.index).fillna(0.0)
    return d


def upbit(sym):
    """업비트 원화 현물 일봉. 날짜 D = D 09:00 KST(= D 00:00 UTC) 에 시작하는 봉 — 바이낸스 일봉과 같은 날짜."""
    d = pd.read_csv(ROOT / "data" / f"KRW-{sym}.csv", parse_dates=["date"], index_col="date")
    return d[d.index <= last_day()].asfreq("D").ffill()


def day_codes(index):
    """봉 시작 시각 → days() 안의 칸 번호. 범위 밖은 -1."""
    code = ((index.normalize() - START) // pd.Timedelta(days=1)).to_numpy().astype(np.int64)
    code[(code < 0) | (code >= len(days()))] = -1
    return code


def to_daily(code, n, r, turn, cnt):
    """봉별 (비용 전 수익, 회전, 거래 수) → 일별."""
    m = code >= 0
    g = np.expm1(np.bincount(code[m], np.log1p(np.maximum(r[m], -0.999)), n))
    return g, np.bincount(code[m], turn[m], n), np.bincount(code[m], cnt[m], n)


def positions(d, pos, funding=True):
    """pos = 봉 t 종가에 정한 목표 포지션(-1~1). t+1 봉부터 수익을 받는다. → 봉별 (비용 전 수익, 회전, 거래 수)."""
    p = pos.fillna(0.0).to_numpy(float)
    held = np.r_[0.0, p[:-1]]
    r = held * d.close.pct_change().fillna(0.0).to_numpy()
    if funding and "fund" in d:
        r -= held * d.fund.to_numpy()
    turn = np.abs(np.diff(np.r_[0.0, p]))  # 봉 t 종가에 바꾼 양 → 그날 비용
    return r, turn, (turn > 1e-9).astype(float)


def combine(per_sym):
    """마켓별 일별 (수익, 회전, 거래 수) → 두 마켓 반씩. 비용 = 비용률 × 회전(평균)."""
    g = sum(x[0] for x in per_sym) / len(per_sym)
    t = sum(x[1] for x in per_sym) / len(per_sym)
    n = sum(x[2] for x in per_sym)
    return g.astype(np.float32), t.astype(np.float32), n.astype(np.int32)


def ensemble(close):
    e = sum((close > close.rolling(n).mean()).astype(float) for n in SMAS) / len(SMAS)
    return e.where(close.rolling(max(SMAS)).mean().notna(), 0.0)


def bench(name):
    """기준선 일별 (비용 전 수익, 회전, 거래 수). F0 = 바이낸스 무기한 앙상블 롱만(FUTURES.md), 현물봇 = 업비트 원화 앙상블(실전 봇)."""
    D, out = days(), []
    for sym in SYMBOLS:
        d = perp(sym, "1d") if name == "F0" else upbit(sym)
        r, t, n = positions(d, ensemble(d.close), funding=name == "F0")
        out.append(to_daily(day_codes(d.index), len(D), r, t, n))
    return combine(out)


# ---------- 지표 ----------

def stats(r, n=None):
    r = np.asarray(r, float)
    eq = np.cumprod(1 + r)
    sd = r.std()
    return {"샤프": float(r.mean() / sd * math.sqrt(365)) if sd > 0 else None, "연복리": float(eq[-1] ** (365 / len(r)) - 1),
            "MDD": float((eq / np.maximum.accumulate(eq) - 1).min()), "거래": None if n is None else int(n)}


def sharpe_rows(R):
    """행마다 연율 샤프. 변동이 없으면 nan."""
    mu, sd = R.mean(1), R.std(1)
    return np.where(sd > 0, mu / np.where(sd > 0, sd, 1) * math.sqrt(365), np.nan)


def walk_forward(chunks, D, cost, blocks=BLOCKS):
    """chunks = [(설정 목록, G, T, N)]. 블록마다 그 전 날까지만 보고 훈련 샤프가 가장 높은 칸(훈련 거래 MIN_TRAIN 이상)을 골라 블록에 적용.
    → (시험 일 수익, 시험 날짜, 시험 거래 수, 고른 칸 [(블록 시작, 설정, 훈련 샤프)])"""
    rs, ds, n_test, picks = [], [], 0, []
    c = np.float32(cost)
    for a, b in blocks:
        tr = D < pd.Timestamp(a)
        te = (D >= pd.Timestamp(a)) & (D <= pd.Timestamp(b))
        best = (-np.inf, None, None)
        for ci, (cfgs, G, T, N) in enumerate(chunks):
            if not len(cfgs):
                continue
            sh = sharpe_rows(G[:, tr] - c * T[:, tr])
            sh = np.where((N[:, tr].sum(1) >= MIN_TRAIN) & np.isfinite(sh), sh, -np.inf)
            k = int(np.argmax(sh))
            if sh[k] > best[0]:
                best = (float(sh[k]), ci, k)
        if best[1] is None:  # 고를 칸이 없으면 쉰다
            rs.append(np.zeros(te.sum()))
            picks.append((a, None, None))
        else:
            cfgs, G, T, N = chunks[best[1]]
            rs.append(G[best[2], te] - c * T[best[2], te])
            n_test += int(N[best[2], te].sum())
            picks.append((a, cfgs[best[2]], best[0]))
        ds.append(D[te])
    return np.concatenate(rs), ds[0].append(ds[1:]), n_test, picks


def dsr(best, sr_all):
    """Deflated Sharpe Ratio (Bailey·López de Prado 2014). best = 최고 칸의 일 수익, sr_all = 모든 칸의 일 샤프(연율 아님).
    시행 횟수를 감안해도 최고 칸의 샤프가 0 보다 클 확률."""
    sr_all = np.asarray(sr_all, float)
    sr_all = sr_all[np.isfinite(sr_all)]
    r = np.asarray(best, float)
    if len(sr_all) < 2 or r.std() == 0:
        return None
    nd, emc, N = NormalDist(), 0.5772156649, len(sr_all)
    sr0 = sr_all.std() * ((1 - emc) * nd.inv_cdf(1 - 1 / N) + emc * nd.inv_cdf(1 - 1 / (N * math.e)))
    sr, z = r.mean() / r.std(), (r - r.mean()) / r.std()
    den = 1 - (z ** 3).mean() * sr + ((z ** 4).mean() - 1) / 4 * sr ** 2
    return float(nd.cdf((sr - sr0) * math.sqrt(len(r) - 1) / math.sqrt(den))) if den > 0 else None
