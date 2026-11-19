"""2단계 2차: 변동성 돌파·펀딩비·김치 프리미엄, 4차(참고용): 공포·탐욕 지수·요일, 5차(참고용): 메이어 배수·MVRV, 6차(참고용): 월말·월초, 7차(참고용): 스테이블코인 공급·미국 증시 추세 (RESEARCH.md 등록). 모두 일 단위(09:00 KST = 00:00 UTC 마감).
모드: 선물 롱숏, 선물 롱만, 현물 롱만(업비트 원화). 봉인 구간은 읽지 않는다.
  python3 scripts/lab/others.py --fetch-fng   # 공포·탐욕 지수 전부 → data/ml/fng.csv (읽을 때 자른다)
  python3 scripts/lab/others.py --fetch-mvrv  # Coin Metrics 커뮤니티 MVRV 전부 → data/ml/mvrv.csv
  python3 scripts/lab/others.py --fetch-stable  # DefiLlama 스테이블코인 유통량(전체·USDT) → data/ml/stable.csv
  python3 scripts/lab/others.py --fetch-macro   # FRED S&P 500·나스닥 종가 → data/ml/macro.csv
"""
import io, json, sys, urllib.request

import numpy as np
import pandas as pd

from common import ML, SYMBOLS, combine, day_codes, days, last_day, perp, positions, to_daily, upbit
from indicators import MODES, grid, machine, sma


def daily_funding(sym):
    """날짜 D = D 00:00 UTC 다음 펀딩부터 D+1 00:00 UTC 펀딩까지의 합 — D 일봉 마감 때 다 알 수 있다."""
    f = pd.read_csv(ML / f"funding_{sym}.csv", parse_dates=["time"])
    s = f.groupby((f.time - pd.Timedelta(seconds=1)).dt.tz_localize(None).dt.normalize()).rate.sum()
    return s[s.index <= last_day()]


def premium(sym):
    """김치 프리미엄 = 업비트 원화 종가 ÷ (바이낸스 현물 USDT 종가 × 그날 ECB 원/달러) − 1. 두 일봉 모두 00:00 UTC 마감."""
    up = upbit(sym).close
    sp = pd.read_csv(ML / f"spot_{sym}.csv", parse_dates=["date"], index_col="date").close
    fx = pd.read_csv(ML / "usdkrw.csv", parse_dates=["date"], index_col="date").krw
    sp, fx = sp[sp.index <= last_day()], fx[fx.index <= last_day()]
    fx = fx.reindex(fx.index.union(up.index)).ffill().reindex(up.index)  # 주말·휴일은 직전 영업일 환율
    return up / (sp.reindex(up.index) * fx) - 1


def hold(trigger, H):
    """신호(-1/0/1)가 나면 H 봉 동안 든다. 새 신호가 오면 다시 센다."""
    out, pos, left = np.zeros(len(trigger)), 0, 0
    for i, t in enumerate(trigger):
        if t != 0:
            pos, left = t, H
        out[i] = pos if left > 0 else 0
        left = max(left - 1, 0)
    return out


def contrarian(x, p):
    """x 의 z 점수(최근 W 일)가 th 를 넘으면 반대로 H 일."""
    z = (x - x.rolling(p["W"]).mean()) / x.rolling(p["W"]).std()
    return hold(np.where(z > p["th"], -1, np.where(z < -p["th"], 1, 0)), p["H"])


def s_funding(d, p, sym):
    f = daily_funding(sym).reindex(d.index).fillna(0.0)
    if p["rule"] == "z역추세":
        return pd.Series(contrarian(f, p), index=d.index)
    return (f.rolling(p["W"]).mean() < 0).astype(float)  # 음수평균: 최근 W 일 평균 펀딩이 음수면 롱


def s_kimchi(d, p, sym):
    pr = premium(sym).reindex(d.index)
    if p["rule"] == "z역추세":
        return pd.Series(contrarian(pr, p), index=d.index)
    if p["rule"] == "부호전환":  # 음수에서 양수로 바뀐 날부터 H 일 롱
        return pd.Series(hold(((pr > 0) & (pr.shift(1) <= 0)).astype(int).to_numpy(), p["H"]), index=d.index)
    return pd.Series(hold(np.where(pr > p["th"], -1, 0), p["H"]), index=d.index)  # 과열: th 넘으면 H 일 숏


def fetch_fng():
    url = "https://api.alternative.me/fng/?limit=0&format=json&date_format=world"
    rows = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "coin-trend-lab"}), timeout=30))["data"]
    d = pd.DataFrame({"date": pd.to_datetime([r["timestamp"] for r in rows], format="%d-%m-%Y"), "value": [int(r["value"]) for r in rows]})
    d.sort_values("date").to_csv(ML / "fng.csv", index=False)
    print(f"fng.csv {len(d)}줄 {d.date.min().date()} ~ {d.date.max().date()}")


def fng():
    """공포·탐욕 지수. 날짜 D 값은 D 00:00 UTC 에 나온다 — D 일봉 마감 때 안다."""
    f = pd.read_csv(ML / "fng.csv", parse_dates=["date"], index_col="date").value
    return f[f.index <= last_day()]


def s_fng(d, p, sym):
    v = fng().reindex(d.index).ffill().to_numpy(float)
    lo, ex = p["lo"], p["exit"]
    with np.errstate(invalid="ignore"):
        return pd.Series(machine(len(v), v <= lo, v >= 100 - lo, v >= ex, v <= 100 - ex), index=d.index)


DOW = {"월": [0], "화": [1], "수": [2], "목": [3], "금": [4], "토": [5], "일": [6], "평일만": [0, 1, 2, 3, 4], "주말만": [5, 6]}


def s_dow(d, p, sym):
    """봉 t 종가에 다음 봉(t+1)의 요일을 보고 정한다."""
    return pd.Series((d.index + pd.Timedelta(days=1)).dayofweek.isin(DOW[p["day"]]).astype(float), index=d.index)


def s_tom(d, p, sym):
    """봉 t 종가에 다음 날(t+1)이 달의 마지막 k 일 또는 첫 m 일이면 1."""
    nxt = d.index + pd.Timedelta(days=1)
    left = nxt.days_in_month - nxt.day  # 달 끝까지 남은 날 (마지막 날 = 0)
    return pd.Series(((left < p["k"]) | (nxt.day <= p["m"])).astype(float), index=d.index)


def s_mayer(d, p, sym):
    ma = sma(d.close, 200)
    mm = (d.close / ma).to_numpy()
    with np.errstate(invalid="ignore"):
        out = (mm < 2.4).astype(float) if p["rule"] == "2.4 아래 보유" else machine(len(mm), mm <= p["lo"], np.zeros(len(mm), bool), mm >= p["exit"], np.zeros(len(mm), bool))
    return pd.Series(out, index=d.index).where(ma.notna(), 0.0)


def fetch_mvrv():
    url = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc,eth&metrics=CapMVRVCur&frequency=1d&page_size=10000&start_time=2015-01-01"
    rows = []
    while url:
        j = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "coin-trend-lab"}), timeout=30))
        rows += [(r["time"][:10], r["asset"].upper(), float(r["CapMVRVCur"])) for r in j["data"] if r.get("CapMVRVCur")]
        url = j.get("next_page_url")
    d = pd.DataFrame(rows, columns=["date", "asset", "mvrv"]).sort_values(["asset", "date"])
    d.to_csv(ML / "mvrv.csv", index=False)
    print(f"mvrv.csv {len(d)}줄", d.groupby("asset").date.agg(["min", "max"]).to_dict("index"))


def mvrv(sym):
    f = pd.read_csv(ML / "mvrv.csv", parse_dates=["date"])
    s = f[f.asset == sym].set_index("date").mvrv
    s.index = s.index + pd.Timedelta(days=1)  # D 날짜 값은 D+1 봉 신호부터 (하루 늦게)
    return s[s.index <= last_day()]


def s_mvrv(d, p, sym):
    v = mvrv(sym).reindex(d.index).ffill().to_numpy(float)
    with np.errstate(invalid="ignore"):
        return pd.Series(machine(len(v), v <= p["lo"], np.zeros(len(v), bool), v >= p["exit"], np.zeros(len(v), bool)), index=d.index)


def get(url):
    # FRED 는 낯선 User-Agent 를 응답 없이 붙잡아 둔다 — curl 이름으로 받는다
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "curl/8.7.1"}), timeout=60).read()


def fetch_stable():
    cols = {}
    for name, q in (("전체", ""), ("USDT", "?stablecoin=1")):
        rows = json.loads(get("https://stablecoins.llama.fi/stablecoincharts/all" + q))
        cols[name] = pd.Series({pd.Timestamp(int(r["date"]), unit="s"): r["totalCirculatingUSD"]["peggedUSD"] for r in rows})
    d = pd.DataFrame(cols).rename_axis("date")
    d.to_csv(ML / "stable.csv")
    print(f"stable.csv {len(d)}줄 {d.index.min().date()} ~ {d.index.max().date()}")


def stable(coin):
    s = pd.read_csv(ML / "stable.csv", parse_dates=["date"], index_col="date")[coin]
    s.index = s.index + pd.Timedelta(days=1)  # D 날짜 값은 D+1 봉 신호부터 (하루 늦게)
    return s[s.index <= last_day()]


def s_stable(d, p, sym):
    v = stable(p["coin"]).reindex(d.index).ffill()
    g = (v / v.shift(p["L"]) - 1).to_numpy()
    with np.errstate(invalid="ignore"):
        return pd.Series(np.where(g > p["th"], 1.0, np.where(g < -p["th"], -1.0, 0.0)), index=d.index)


MACRO = {"S&P 500": "SP500", "나스닥": "NASDAQCOM"}


def fetch_macro():
    cols = {}
    for name, sid in MACRO.items():
        f = pd.read_csv(io.BytesIO(get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}")), parse_dates=["observation_date"], index_col="observation_date")
        cols[name] = pd.to_numeric(f[sid], errors="coerce")
    d = pd.DataFrame(cols).rename_axis("date")
    d.to_csv(ML / "macro.csv")
    print(f"macro.csv {len(d)}줄 {d.index.min().date()} ~ {d.index.max().date()}")


def s_macro(d, p, sym):
    """미국 종가(20~21시 UTC)는 같은 날 코인 일봉 마감(다음 날 00:00 UTC) 전에 나온다."""
    x = pd.read_csv(ML / "macro.csv", parse_dates=["date"], index_col="date")[p["index"]].dropna()
    x = x[x.index <= last_day()]
    up = (x > x.rolling(p["n"]).mean()).astype(float).where(x.rolling(p["n"]).mean().notna())
    up = up.reindex(up.index.union(d.index)).ffill().reindex(d.index)  # 주말·휴일은 직전 거래일
    return (2 * up - 1).fillna(0.0)


def vbreak_day(o, h, l, c, p):
    """일봉 기준 목표가·거르기·크기. → (롱 목표가, 숏 목표가, 롱 가능, 숏 가능, 크기)"""
    rng = (h - l).shift(1)
    k = (1 - (o - c).abs() / (h - l)).rolling(20).mean().shift(1) if p["k"] == "노이즈" else p["k"]
    lt, st = o + k * rng, o - k * rng
    if p["ma"]:
        ma = c.rolling(p["ma"]).mean().shift(1)  # 어제까지의 종가 평균
        okl, oks = o > ma, o < ma
    else:
        okl = oks = pd.Series(True, index=o.index)
    size = (0.02 / (rng / c.shift(1))).clip(upper=1.0) if p["size"] == "변동성 조절" else pd.Series(1.0, index=o.index)
    return lt, st, okl, oks, size


def vbreak(sym, p, market, mode):
    """래리 윌리엄스 변동성 돌파: 그날 목표가에 닿으면 그 가격에 들어가 그날 종가(다음 날 시가)에 정리. → 일별 (수익, 회전, 거래)."""
    n = len(days())
    if market == "spot":
        d = upbit(sym)
        lt, _, okl, _, size = vbreak_day(d.open, d.high, d.low, d.close, p)
        hit = ((d.high >= lt) & okl & lt.notna()).to_numpy()
        sz = size.fillna(0).to_numpy()
        r = np.where(hit, sz * (d.close.to_numpy() / lt.to_numpy() - 1), 0.0)
        return to_daily(day_codes(d.index), n, np.nan_to_num(r), np.where(hit, 2 * sz, 0.0), hit.astype(float))
    d, h1 = perp(sym, "1d"), perp(sym, "1h")
    lt, st, okl, oks, size = vbreak_day(d.open, d.high, d.low, d.close, p)
    day = h1.index.normalize()
    hl = (h1.high.to_numpy() >= lt.reindex(day).to_numpy()) & okl.reindex(day).fillna(False).to_numpy()
    hs = (h1.low.to_numpy() <= st.reindex(day).to_numpy()) & oks.reindex(day).fillna(False).to_numpy()
    if mode == "선물 롱만":
        hs[:] = False
    fund, code = h1.fund.to_numpy(), day_codes(d.index)
    r, turn, cnt = np.zeros(len(d)), np.zeros(len(d)), np.zeros(len(d))
    starts = np.r_[0, np.flatnonzero(day[1:] != day[:-1]) + 1, len(h1)]
    pos_of = {t: i for i, t in enumerate(d.index)}
    for a, b in zip(starts[:-1], starts[1:]):
        i = pos_of.get(day[a])
        if i is None or not np.isfinite(size.iloc[i]):
            continue
        jl = a + np.argmax(hl[a:b]) if hl[a:b].any() else None
        js = a + np.argmax(hs[a:b]) if hs[a:b].any() else None
        if jl is not None and js is not None:
            if jl == js:
                continue  # 같은 시간에 둘 다 닿았다 — 순서를 모르니 건너뛴다
            js, jl = (js, None) if js < jl else (None, jl)
        if jl is None and js is None:
            continue
        side, j, px = (1, jl, lt.iloc[i]) if jl is not None else (-1, js, st.iloc[i])
        sz = float(size.iloc[i])
        r[i] = sz * (side * (d.close.iloc[i] / px - 1) - side * fund[j:b].sum())
        turn[i], cnt[i] = 2 * sz, 1
    return to_daily(code, n, r, turn, cnt)


FAMILIES = {
    "vbreak": dict(name="변동성 돌파", default=dict(k=0.5, ma=0, size="1배"),
                   params=grid(k=[0.3, 0.4, 0.5, 0.6, 0.7, "노이즈"], ma=[0, 3, 5, 10, 20], size=["1배", "변동성 조절"]),
                   sources=["Larry Williams 변동성 돌파 (시가 + k × 전날 고저폭, k 0.5)", "국내 업비트 봇 변형: 이동평균 거르기, 노이즈 비율 k, 변동성 조절(목표 2%)"]),
    "funding": dict(name="펀딩비 역추세", fn=s_funding, default=dict(rule="z역추세", W=30, th=2.0, H=1),
                    params=grid(rule=["z역추세"], W=[30, 90, 180], th=[1.0, 1.5, 2.0], H=[1, 3, 7]) + grid(rule=["음수평균"], W=[7, 30, 90], th=["-"], H=["-"]),
                    sources=["BitMEX Research, XBTUSD Funding Mean Reversion Strategy — 극단 펀딩 뒤 반대 방향", "K33 Research — 30일 평균 펀딩이 음수일 때 뒤 90일 수익"]),
    "kimchi": dict(name="김치 프리미엄", fn=s_kimchi, default=dict(rule="과열", W="-", th=0.03, H=7),
                   params=grid(rule=["z역추세"], W=[30, 90, 180], th=[1.0, 1.5, 2.0], H=[1, 3, 7]) + grid(rule=["부호전환"], W=["-"], th=["-"], H=[7, 30])
                   + grid(rule=["과열"], W=["-"], th=[0.03, 0.05, 0.10], H=[3, 7]),
                   sources=["CryptoQuant — 한국 프리미엄 3% 넘는 과열 뒤 단기 조정", "CryptoSlate — 프리미엄이 음수→양수로 바뀐 뒤 7·30일 수익"]),
    "fng": dict(name="공포·탐욕 지수 역발상", fn=s_fng, default=dict(lo=10, exit=35), params=grid(lo=[10, 20, 25], exit=[35, 50, 65]),
                sources=["alternative.me Crypto Fear & Greed Index (2018-02-01~)", "Your One Trade of the Year (Medium) — 10 이하 매수, 35·50·65 위 매도", "Glassnode 인용 — 25 미만 뒤 30일 수익"]),
    "dow": dict(name="요일 효과", fn=s_dow, default=dict(day="월"), params=grid(day=list(DOW)),
                sources=["Caporale·Plastun (2019, Finance Research Letters) The day of the week effect in the cryptocurrency market — 비트코인 월요일"]),
    "tom": dict(name="월말·월초 효과", fn=s_tom, default=dict(k=1, m=3), params=grid(k=[1, 2, 4], m=[0, 1, 3]),
                sources=["Lakonishok·Smidt (1988) — 마지막 거래일 + 첫 3거래일", "Kumar (2022, Managerial Finance) — BTC·ETH 월말·월초 수익이 높다"]),
    "mayer": dict(name="메이어 배수", fn=s_mayer, default=dict(rule="저평가", lo=0.8, exit=2.4),
                  params=grid(rule=["저평가"], lo=[0.8, 0.9, 1.0], exit=[1.2, 1.5, 2.4]) + grid(rule=["2.4 아래 보유"], lo=["-"], exit=["-"]),
                  sources=["Trace Mayer, Mayer Multiple — 종가 ÷ 200일 평균, 2.4 아래면 사 모은다", "Glassnode — 0.8 과매도, 2.4 과매수"]),
    "mvrv": dict(name="MVRV", fn=s_mvrv, default=dict(lo=1.0, exit=3.5), params=grid(lo=[0.8, 1.0, 1.2], exit=[1.5, 2.4, 3.5]),
                 sources=["Murad Mahmudov·David Puell (2018) MVRV", "Glassnode — 1 아래 바닥, 3.5 이상 꼭대기", "Coin Metrics 커뮤니티 API CapMVRVCur"]),
    "stable": dict(name="스테이블코인 공급 증가", fn=s_stable, default=dict(coin="USDT", L=30, th=0.0),
                   params=grid(coin=["전체", "USDT"], L=[7, 14, 30, 60, 90], th=[0.0, 0.01, 0.03]),
                   sources=["Griffin·Shams (2020, Journal of Finance) Is Bitcoin Really Untethered? — 테더 발행과 비트코인 수익", "반론: Wei (2018, Economics Letters), Lyons·Viswanath-Natraj (VoxEU) — 발행이 가격을 움직인다는 증거 없음", "DefiLlama 스테이블코인 유통량"]),
    "macro": dict(name="미국 증시 추세", fn=s_macro, default=dict(index="S&P 500", n=200), params=grid(index=list(MACRO), n=[20, 50, 100, 200]),
                  sources=["Adrian·Iyer·Qureshi (2022, IMF 블로그) Crypto Prices Move More in Sync With Stocks — 비트코인·S&P 500 수익 상관 0.01→0.36", "CoinDesk (2025) S&P 500 200일선 회복이 비트코인에 순풍", "FRED SP500·NASDAQCOM"]),
}


class Family:
    CHUNK = "tf"

    def __init__(self, key):
        f = FAMILIES[key]
        self.key, self.NAME, self.SOURCES, self.DEFAULT = key, f["name"], f["sources"], dict(tf="1d", mode="선물 롱숏", **f["default"])
        self.GRID = {"tf": ["1d"], "mode": MODES, **{k: list(dict.fromkeys(p[k] for p in f["params"])) for k in f["params"][0]}}
        self.UNITS = [{"name": m, "bench": "현물봇" if m == "현물 롱만" else "F0", "where": (lambda c, m=m: c["mode"] == m)} for m in MODES]

    def default(self, unit):
        return {**self.DEFAULT, "mode": unit["name"]}

    def tasks(self):
        return [(self.key, "perp"), (self.key, "spot")]


def task(arg):
    key, market = arg
    f, n = FAMILIES[key], len(days())
    modes = ["선물 롱숏", "선물 롱만"] if market == "perp" else ["현물 롱만"]
    data = None if key == "vbreak" else {s: (perp(s, "1d") if market == "perp" else upbit(s)) for s in SYMBOLS}
    cfgs, G, T, N = [], [], [], []
    for p in f["params"]:
        sig = None if key == "vbreak" else {s: f["fn"](d, p, s).fillna(0.0).clip(-1, 1) for s, d in data.items()}
        for mode in modes:
            if key == "vbreak":
                per = [vbreak(s, p, market, mode) for s in SYMBOLS]
            else:
                per = [to_daily(day_codes(data[s].index), n, *positions(data[s], sig[s] if mode == "선물 롱숏" else sig[s].clip(lower=0), funding=market == "perp")) for s in SYMBOLS]
            g, t, c = combine(per)
            cfgs.append(dict(tf="1d", mode=mode, **p))
            G.append(g), T.append(t), N.append(c)
    return cfgs, np.array(G), np.array(T), np.array(N)


if __name__ == "__main__":
    if "--fetch-fng" in sys.argv:
        fetch_fng()
    if "--fetch-mvrv" in sys.argv:
        fetch_mvrv()
    if "--fetch-stable" in sys.argv:
        fetch_stable()
    if "--fetch-macro" in sys.argv:
        fetch_macro()
