"""바이낸스 현물 1분봉 (단타 글 3가지 시험용, RESEARCH.md '단타 글 3가지 등록'). 2022-01-01 부터 마지막 마감 봉까지.
이어 받기: 파일이 있으면 마지막 봉 다음부터. → data/ml/spot1m_<코인>.csv (time UTC, open, high, low, close, volume)
사용법: python3 scripts/lab/fetch_1m.py BTC ETH
"""
import csv, json, sys, time, urllib.request
from datetime import datetime, timezone

from common import ML

START = int(datetime(2022, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)


def get(url):
    for i in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=30))
        except Exception as e:
            if i == 4:
                raise
            print("다시 시도", e, flush=True)
            time.sleep(5 * (i + 1))


def fetch(sym):
    path = ML / f"spot1m_{sym}.csv"
    since = START
    if path.exists():
        with path.open() as f:
            last = f.readlines()[-1].split(",")[0]
        if last != "time":
            since = int(datetime.strptime(last, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc).timestamp() * 1000) + 60_000
    new = not path.exists()
    now = int(time.time() * 1000)
    n = 0
    with path.open("a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["time", "open", "high", "low", "close", "volume"])
        while since < now - 60_000:
            ks = get(f"https://api.binance.com/api/v3/klines?symbol={sym}USDT&interval=1m&startTime={since}&limit=1000")
            ks = [k for k in ks if k[6] < now]  # 마감된 봉만
            if not ks:
                break
            for k in ks:
                w.writerow([datetime.fromtimestamp(k[0] / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M"), k[1], k[2], k[3], k[4], k[5]])
            n += len(ks)
            since = ks[-1][0] + 60_000
            if n % 100_000 < 1000:
                print(sym, datetime.fromtimestamp(since / 1000, timezone.utc).strftime("%Y-%m-%d"), n, flush=True)
            time.sleep(0.1)
    print(sym, "끝", n, "봉", flush=True)


if __name__ == "__main__":
    for s in sys.argv[1:] or ["BTC", "ETH"]:
        fetch(s)
