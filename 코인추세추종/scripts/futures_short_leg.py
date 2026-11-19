"""진단: F2 의 숏 다리만 떼어 본다 (e = 0 인 다음 날 숏 1배, 그 밖에는 0). 사전 등록 판정(FUTURES.md)을 바꾸지 않는다.
사용법: python3 scripts/futures_short_leg.py
"""
import pandas as pd

import futures_backtest as fb

legs, eps = [], []
for sym in fb.SYMBOLS:
    r, pos, _, _ = fb.returns(sym, lambda e: -(e == 0).astype(float))
    legs.append(r)
    p = pos.reindex(r.index).fillna(0)
    for idx in p[p < 0].groupby((p != p.shift()).cumsum()).groups.values():  # 숏이 이어진 구간
        eps.append((sym, idx[0], len(idx), (1 + r.loc[idx]).prod() - 1, r.loc[idx].min()))
r = pd.concat(legs, axis=1).dropna().mean(axis=1)
ep = pd.DataFrame(eps, columns=["마켓", "시작", "일수", "수익", "최악의_하루"])

print("연도별 수익: " + " · ".join(f"{y} {v*100:+.0f}%" for y, v in ((1 + r).groupby(r.index.year).prod() - 1).items()))
for label, start in [("전체", str(r.index[0].date())), ("표본 외 2023~", fb.SPLIT)]:
    e, s = ep[ep.시작 >= start], fb.stats(r.loc[start:])
    print(f"\n[{label}] 연복리 {s['연복리']} / 샤프 {s['샤프']:.2f} / MDD {s['MDD']}, 숏 잡은 날 {(r.loc[start:] != 0).mean()*100:.0f}%")
    print(f"  숏 구간 {len(e)}번 — 이긴 비율 {(e.수익 > 0).mean()*100:.0f}%, 중앙값 {e.수익.median()*100:+.1f}%, 길이 중앙값 {e.일수.median():.0f}일")
    print(f"  3일 이하로 끝난 구간 {(e.일수 <= 3).mean()*100:.0f}% (평균 {e[e.일수 <= 3].수익.mean()*100:+.1f}%) · 15일 넘게 간 구간 {(e.일수 > 15).sum()}번 (평균 {e[e.일수 > 15].수익.mean()*100:+.1f}%)")
    print(f"  수익 상위 5번의 합 {e.수익.nlargest(5).sum()*100:+.0f}%p, 모든 구간의 합 {e.수익.sum()*100:+.0f}%p · 가장 나쁜 구간 {e.수익.min()*100:+.1f}% · 숏 중 최악의 하루 {e.최악의_하루.min()*100:+.1f}%")
