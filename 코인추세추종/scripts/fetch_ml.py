"""ML 실험용 과거 데이터 백필 (ML.md). 매번 처음부터 다시 받는다.
  data/ml/spot_<SYM>.csv     바이낸스 현물 일봉
  data/ml/perp_<SYM>.csv     바이낸스 USDT 무기한 일봉
  data/ml/funding_<SYM>.csv  바이낸스 펀딩비 (8시간)
  data/ml/usdkrw.csv         ECB USD/KRW (영업일)
사용법: python3 scripts/fetch_ml.py
"""
import csv, json, time, urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "ml"
SYMBOLS = ["BTC", "ETH"]
KLINE_COLS = ["date", "open", "high", "low", "close", "volume", "quote_volume", "taker_buy_quote"]


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "coin-trend-ml"})
    for i in range(3):
        try:
            return json.load(urllib.request.urlopen(req, timeout=20))
        except Exception:
            if i == 2:
                raise
            time.sleep(2 + i)


def day(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).strftime("%Y-%m-%d")


def save(name, header, rows):
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / name).open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"{name}: {len(rows)}줄 {rows[0][0] if rows else ''} ~ {rows[-1][0] if rows else ''}")


def klines(base, symbol, limit):
    rows, start = [], 0
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    while True:
        batch = get(f"{base}?symbol={symbol}&interval=1d&startTime={start}&limit={limit}")
        if not batch:
            break
        for k in batch:
            if day(k[0]) < today:  # 진행 중인 봉은 뺀다
                rows.append([day(k[0]), k[1], k[2], k[3], k[4], k[5], k[7], k[10]])
        start = batch[-1][0] + 1
        if len(batch) < limit:
            break
        time.sleep(0.3)
    return rows


def funding(symbol):
    rows, start = [], 1567296000000  # 2019-09-01. 0 을 주면 최근 500개만 온다
    while True:
        batch = get(f"https://fapi.binance.com/fapi/v1/fundingRate?symbol={symbol}&startTime={start}&limit=1000")
        if not batch:
            break
        rows += [[datetime.fromtimestamp(b["fundingTime"] / 1000, timezone.utc).isoformat(timespec="seconds"), b["fundingRate"]] for b in batch]
        start = batch[-1]["fundingTime"] + 1
        if len(batch) < 1000:
            break
        time.sleep(0.3)
    return rows


def usdkrw():
    rows = []
    for y in range(2017, date.today().year + 1):
        r = get(f"https://api.frankfurter.app/{y}-01-01..{y}-12-31?from=USD&to=KRW")
        rows += [[d, v["KRW"]] for d, v in sorted(r["rates"].items())]
    return sorted({r[0]: r for r in rows}.values())


if __name__ == "__main__":
    for s in SYMBOLS:
        save(f"spot_{s}.csv", KLINE_COLS, klines("https://api.binance.com/api/v3/klines", f"{s}USDT", 1000))
        save(f"perp_{s}.csv", KLINE_COLS, klines("https://fapi.binance.com/fapi/v1/klines", f"{s}USDT", 1500))
        save(f"funding_{s}.csv", ["time", "rate"], funding(f"{s}USDT"))
    save("usdkrw.csv", ["date", "krw"], usdkrw())
