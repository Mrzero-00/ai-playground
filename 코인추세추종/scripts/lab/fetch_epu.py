"""미국 경제 정책 불확실성 지수(날마다, 뉴스 기반 — Baker · Bloom · Davis) — RESEARCH.md '장 직전 루프 — 37회차'. FRED USEPUINDXD, 키 불필요.
→ data/ml/epu.csv (date · epu)
사용법: python3 scripts/lab/fetch_epu.py
"""
import io

import pandas as pd

from common import ML
from others import get


def main():
    f = pd.read_csv(io.BytesIO(get("https://fred.stlouisfed.org/graph/fredgraph.csv?id=USEPUINDXD")), parse_dates=["observation_date"], index_col="observation_date")
    d = pd.to_numeric(f["USEPUINDXD"], errors="coerce").rename("epu").rename_axis("date").dropna()
    d.to_csv(ML / "epu.csv")
    print(len(d), d.index.min().date(), "~", d.index.max().date())


if __name__ == "__main__":
    main()
