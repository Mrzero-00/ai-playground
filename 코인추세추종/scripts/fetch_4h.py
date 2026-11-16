"""업비트 4시간봉 전체 이력을 data/4h/<market>.csv 로 받는다.
사용법: python3 scripts/fetch_4h.py KRW-BTC KRW-ETH
"""
import csv, json, sys, time, urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "4h"
URL = "https://api.upbit.com/v1/candles/minutes/240?market={m}&count=200{to}"


def get(url):
    for i in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=10))
        except Exception:
            time.sleep(1 + i)
    raise RuntimeError(url)


def fetch(market):
    rows, to = {}, ""
    while True:
        batch = get(URL.format(m=market, to=to))
        for c in batch:
            rows[c["candle_date_time_kst"]] = (c["opening_price"], c["high_price"], c["low_price"], c["trade_price"])
        if len(batch) < 200:
            break
        to = f"&to={batch[-1]['candle_date_time_utc']}"
        time.sleep(0.25)
    keys = sorted(rows)[:-1]  # 진행 중인 봉 제외
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / f"{market}.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time", "open", "high", "low", "close"])
        for k in keys:
            w.writerow([k, *rows[k]])
    print(f"{market}: {len(keys)}봉 {keys[0]} ~ {keys[-1]}")


if __name__ == "__main__":
    for m in sys.argv[1:] or ["KRW-BTC", "KRW-ETH"]:
        fetch(m)
