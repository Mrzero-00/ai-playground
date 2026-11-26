"""BTC 하루 발행량의 달러 가치(Coin Metrics 무료 API, IssTotUSD) — RESEARCH.md '장 직전 루프 — 17회차'. 퍼엘 배수 = 이 값 ÷ 365일 평균.
→ data/ml/issuance_BTC.csv (date · iss_usd)
사용법: python3 scripts/lab/fetch_puell.py
"""
import csv
import json
import time
import urllib.request

from common import ML

URL = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=IssTotUSD&frequency=1d&start_time=2013-01-01&page_size=10000&paging_from=start"


def main():
    rows, url = [], URL
    while url:
        d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=60))
        rows += [(r["time"][:10], r["IssTotUSD"]) for r in d["data"]]
        url = d.get("next_page_url")
        time.sleep(1)
    with (ML / "issuance_BTC.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "iss_usd"])
        w.writerows(rows)
    print(len(rows), rows[0][0], "~", rows[-1][0])


if __name__ == "__main__":
    main()
