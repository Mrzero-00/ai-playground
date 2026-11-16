"""업비트 원화마켓 일봉 전체 이력을 data/<market>.csv 로 받는다.
사용법: python3 scripts/fetch.py KRW-BTC KRW-ETH
"""
import csv, json, sys, time, urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
URL = "https://api.upbit.com/v1/candles/days?market={m}&count=200{to}"


def fetch(market):
    rows, to = {}, ""
    while True:
        req = urllib.request.Request(URL.format(m=market, to=to), headers={"Accept": "application/json"})
        batch = json.load(urllib.request.urlopen(req, timeout=10))
        if not batch:
            break
        for c in batch:
            rows[c["candle_date_time_kst"][:10]] = (c["opening_price"], c["high_price"], c["low_price"], c["trade_price"], c["candle_acc_trade_price"])
        oldest = batch[-1]["candle_date_time_utc"]
        to = f"&to={oldest}"
        if len(batch) < 200:
            break
        time.sleep(0.15)
    # 오늘 봉은 아직 미완성이라 뺀다
    dates = sorted(rows)[:-1]
    out = DATA / f"{market}.csv"
    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "open", "high", "low", "close", "value"])
        for d in dates:
            w.writerow([d, *rows[d]])
    print(f"{market}: {len(dates)}일 {dates[0]} ~ {dates[-1]} -> {out.name}")


if __name__ == "__main__":
    for m in sys.argv[1:] or ["KRW-BTC", "KRW-ETH"]:
        fetch(m)
