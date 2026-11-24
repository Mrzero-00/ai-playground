"""업비트 원화 30분봉 (RESEARCH.md '판단 시간 창'). 공개 API, 키 불필요. 최신에서 과거로 200개씩.
→ data/ml/upbit30m_<코인>.csv (time = 봉 시작, 한국 시각 · open · high · low · close · volume)
사용법: python3 scripts/lab/fetch_upbit30.py BTC ETH
"""
import csv, json, sys, time, urllib.error, urllib.request

from common import ML

URL = "https://api.upbit.com/v1/candles/minutes/30?market=KRW-{s}&count=200{to}"
STOP = "2019-06-01T00:00:00"  # 한국 시각, 이 앞은 받지 않는다


def get(url):
    for i in range(8):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=20))
        except urllib.error.HTTPError as e:
            if e.code != 429 and i >= 3:
                raise
            time.sleep(1 + i)
        except Exception:
            if i == 7:
                raise
            time.sleep(2 + i)


def fetch(sym):
    rows, to, n = {}, "", 0
    while True:
        batch = get(URL.format(s=sym, to=to))
        if not batch:
            break
        for c in batch:
            rows[c["candle_date_time_kst"]] = (c["opening_price"], c["high_price"], c["low_price"], c["trade_price"], c["candle_acc_trade_volume"])
        oldest = batch[-1]
        n += 1
        if n % 100 == 0:
            print(sym, oldest["candle_date_time_kst"], len(rows), flush=True)
        if oldest["candle_date_time_kst"] <= STOP or len(batch) < 200:
            break
        to = f"&to={oldest['candle_date_time_utc']}"
        time.sleep(0.12)
    with (ML / f"upbit30m_{sym}.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time", "open", "high", "low", "close", "volume"])
        for k in sorted(rows):
            w.writerow([k.replace("T", " ")[:16], *rows[k]])
    ks = sorted(rows)
    print(sym, "끝", len(rows), "봉", ks[0], "~", ks[-1], flush=True)


if __name__ == "__main__":
    for s in sys.argv[1:] or ["BTC", "ETH"]:
        fetch(s)
