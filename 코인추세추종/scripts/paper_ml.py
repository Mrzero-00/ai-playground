"""ML 거르기(L-A) 모의 매매. ML.md 사전 등록 실험에서 통과한 하나를 3개월 병행 검증한다.
목표 비중 = 앙상블 비중 × [로지스틱 회귀가 낸 '5일 뒤 오를 확률' > 0.5].
모델은 워크포워드와 똑같이 '그 달 1일 −5일'까지 정답이 보인 데이터로 학습한다(달마다 같은 모델).
장부는 paper_ml/ 에 따로 쌓이고 체결 계산은 paper.py 와 같다.
사용법: python3 scripts/paper_ml.py [--report]
"""
import json, sys
from datetime import datetime

import pandas as pd

import fetch, fetch_ml, ml, paper

DIR = paper.ROOT / "paper_ml"


def predictions():
    """오늘 쓸 마켓별 (신호 날짜, 앙상블 비중, 확률)."""
    df = ml.features()
    cols = [c for c in df.columns if c not in ("y", "market")]
    df = df.dropna(subset=cols)
    out = {}
    for m in ml.MARKETS:
        t = df[df.market == m].index.max()
        cut = t.replace(day=1) - pd.Timedelta(days=ml.H)  # ml.walk_forward 와 같은 학습 구간
        train = df[(df.index <= cut) & df.y.notna()]
        clf = ml.MODELS["L"]()
        clf.fit(train[cols], train.y)
        row = df[(df.market == m) & (df.index == t)]
        out[m] = (t.strftime("%Y-%m-%d"), float(row.ens.iloc[0]), float(clf.predict_proba(row[cols])[0, 1]))
    return out


def run():
    now = datetime.now(paper.KST)
    st = DIR / "state.json"
    if now.hour < 9 or (st.exists() and json.loads(st.read_text())["last_run"] == now.strftime("%Y-%m-%d")):
        print(f"--- {now.isoformat(timespec='seconds')} 09:00 이전이거나 오늘 이미 실행함. 건너뜀.")
        return
    for m in ml.MARKETS:
        fetch.fetch(m)
    for s in fetch_ml.SYMBOLS:
        fetch_ml.save(f"spot_{s}.csv", fetch_ml.KLINE_COLS, fetch_ml.klines("https://api.binance.com/api/v3/klines", f"{s}USDT", 1000))
        fetch_ml.save(f"perp_{s}.csv", fetch_ml.KLINE_COLS, fetch_ml.klines("https://fapi.binance.com/fapi/v1/klines", f"{s}USDT", 1500))
        fetch_ml.save(f"funding_{s}.csv", ["time", "rate"], fetch_ml.funding(f"{s}USDT"))
    fetch_ml.save("usdkrw.csv", ["date", "krw"], fetch_ml.usdkrw())
    pred = predictions()

    def target(m, dates, px):
        day, ens, p = pred[m]
        if day != dates[-1]:
            raise RuntimeError(f"{m} 피처 날짜 {day} ≠ 신호 날짜 {dates[-1]}. 데이터가 덜 올라왔다. 다음 재시도에서 다시 돈다.")
        target = ens * (p > 0.5)
        print(f"{m} 앙상블 {ens:.2f} × [p={p:.3f} > 0.5] → {target:.2f}")
        return target

    paper.run(DIR, target)


if __name__ == "__main__":
    paper.report(DIR) if "--report" in sys.argv else run()
