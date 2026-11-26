"""바이낸스 무기한 4시간봉(테이커 매수 거래대금 포함) — RESEARCH.md '장 직전 루프 — 14회차'. 공개 API, 키 불필요.
→ data/ml/perp4ht_<코인>.csv (time UTC 봉 시작 · close · quote_volume · taker_buy_quote)
사용법: python3 scripts/lab/fetch_4h_taker.py
"""
import csv
import sys
import time
from datetime import datetime, timezone

from common import ML, ROOT

sys.path.insert(0, str(ROOT / "scripts"))
from fetch_ml import get  # noqa: E402

URL = "https://fapi.binance.com/fapi/v1/klines?symbol={s}USDT&interval=4h&startTime={t}&limit=1500"


def main():
    now = datetime.now(timezone.utc).timestamp() * 1000
    for s in ("BTC", "ETH"):
        rows, start = [], 0
        while True:
            batch = get(URL.format(s=s, t=start))
            if not batch:
                break
            for k in batch:
                if k[6] < now:  # 닫힌 봉만
                    rows.append([datetime.fromtimestamp(k[0] / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M"), k[4], k[7], k[10]])
            start = batch[-1][0] + 1
            if len(batch) < 1500:
                break
            time.sleep(0.3)
        with (ML / f"perp4ht_{s}.csv").open("w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["time", "close", "quote_volume", "taker_buy_quote"])
            w.writerows(rows)
        print(s, len(rows), rows[0][0], "~", rows[-1][0])


if __name__ == "__main__":
    main()
