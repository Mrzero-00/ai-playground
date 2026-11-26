"""미국 M2 통화량(월별, 계절 조정) — RESEARCH.md '장 직전 루프 — 44회차'. FRED M2SL, 키 불필요.
→ data/ml/m2.csv (date · m2) — date 는 그 달 1일(값은 다음 달 말에 나온다)
사용법: python3 scripts/lab/fetch_m2.py
"""
import io

import pandas as pd

from common import ML
from others import get


def main():
    f = pd.read_csv(io.BytesIO(get("https://fred.stlouisfed.org/graph/fredgraph.csv?id=M2SL")), parse_dates=["observation_date"], index_col="observation_date")
    d = pd.to_numeric(f["M2SL"], errors="coerce").rename("m2").rename_axis("date").dropna()
    d.to_csv(ML / "m2.csv")
    print(len(d), d.index.min().date(), "~", d.index.max().date())


if __name__ == "__main__":
    main()
