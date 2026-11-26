"""미국 금리 · 달러 · 유가(FRED)와 금(바이낸스 PAXG/USDT 일봉) — RESEARCH.md '장 직전 루프 — 8회차'. 키 불필요.
→ data/ml/assets.csv (date · 기준금리 · 2년물 · 10년물 · 장단기 금리차 · 달러 지수 · 유가) , data/ml/spot_PAXG.csv
사용법: python3 scripts/lab/fetch_assets.py
"""
import io
import sys

import pandas as pd

from common import ML, ROOT
from others import get

sys.path.insert(0, str(ROOT / "scripts"))
from fetch_ml import KLINE_COLS, klines, save  # noqa: E402

FRED = {"기준금리": "DFF", "2년물": "DGS2", "10년물": "DGS10", "장단기 금리차": "T10Y2Y", "달러 지수": "DTWEXBGS", "유가": "DCOILWTICO"}


def main():
    cols = {}
    for name, sid in FRED.items():
        f = pd.read_csv(io.BytesIO(get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}")), parse_dates=["observation_date"], index_col="observation_date")
        cols[name] = pd.to_numeric(f[sid], errors="coerce")
        print(name, sid, cols[name].dropna().index.min().date(), "~", cols[name].dropna().index.max().date())
    d = pd.DataFrame(cols).rename_axis("date")
    d = d[d.index >= "2015-01-01"]
    d.to_csv(ML / "assets.csv")
    save("spot_PAXG.csv", KLINE_COLS, klines("https://api.binance.com/api/v3/klines", "PAXGUSDT", 1000))
    p = pd.read_csv(ML / "spot_PAXG.csv")
    print("PAXG", p.date.iloc[0], "~", p.date.iloc[-1], len(p))


if __name__ == "__main__":
    main()
