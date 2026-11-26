"""정반대로 했다면 — 거울 봇 (RESEARCH.md '정반대로 했다면'). M1 거울 봇 −(1 − e) · M0 완전 반대 −e, 참고로 F1 대칭 · 선물 e 롱 · 업비트 현물 봇·보유.
계산 틀은 levlong.py 와 같다(바이낸스 무기한, 실제 펀딩, 배수 맞추는 비용, 격리 마진 청산 두 기준, 코인마다 따로, 원화 환산). 판정 없음.
사용법: python3 scripts/lab/mirror.py   → data/lab/mirror.json
"""
import json
from datetime import datetime

import numpy as np
import pandas as pd

import common as C
import regime_futures as R
from levlong import COSTS, END, SEED, fx, krw, load, sleeve, spot_bot, stats

STARTS = ("2020-01-01", "2026-01-01")
PLANS = {"M1 거울 봇 (아래 선 개수만큼 숏)": lambda e: -(1 - e), "M0 완전 반대 (봇이 살 때 숏)": lambda e: -e,
         "F1 대칭 (본체 롱 + 거울 숏, 선물 한 계좌)": lambda e: 2 * e - 1, "선물로 본체 (e 롱)": lambda e: e}
SPOT, HOLD = "업비트 현물 봇 (본체)", "업비트 현물 보유"


def yearly(eq):
    ends = {y: float(eq[eq.index.year == y].iloc[-1]) for y in range(2020, 2027)}
    return {str(y): (ends[y] / (ends[y - 1] if y > 2020 else SEED) - 1) if (ends.get(y - 1) or y == 2020) else None for y in ends}


def hold(start):
    parts = []
    for s in R.SYMS:
        c = pd.read_csv(C.ROOT / "data" / f"KRW-{s}.csv", parse_dates=["date"], index_col="date").close.astype(float)
        c = c[(c.index >= pd.Timestamp(start) - pd.Timedelta(days=1)) & (c.index <= END)]
        parts.append(SEED / len(R.SYMS) * c / c.iloc[0])
    return sum(parts).iloc[1:]


def main():
    D, F = load(), fx()
    out = {"made": datetime.now().isoformat(timespec="seconds"), "rows": {}}
    for st in STARTS:
        for cn, cost in COSTS.items():
            eq = spot_bot(st, cost)
            row = out["rows"].setdefault(SPOT, {})
            row.setdefault(st, {})[cn] = stats(eq)
            if st == "2020-01-01" and cn == "0.10%":
                row["해"] = yearly(eq)
        eq = hold(st)
        row = out["rows"].setdefault(HOLD, {})
        row[st] = {cn: stats(eq) for cn in COSTS}
        if st == "2020-01-01":
            row["해"] = yearly(eq)
    for name, fn in PLANS.items():
        row = out["rows"].setdefault(name, {})
        for st in STARTS:
            for cn, cost in COSTS.items():
                for basis in ("가", "나"):
                    res = [sleeve(d, fn(d.ens.fillna(0.0)), st, cost, basis) for d in D.values()]
                    eq = krw([q for q, _, _ in res], st, F)
                    sm = stats(eq)
                    sm["청산"] = {s: liq for s, (_, liq, _) in zip(D, res) if liq}
                    row.setdefault(st, {}).setdefault(cn, {})[basis] = sm
                    if st == "2020-01-01" and cn == "0.10%":
                        row.setdefault("해", {})[basis] = yearly(eq)
                        if basis == "가":
                            row["펀딩"] = float(np.mean([f for _, _, f in res]) / ((eq.index[-1] - eq.index[0]).days / 365))
    (C.OUT / "mirror.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))

    def pick(r, st, cn, basis):
        x = r[st][cn]
        return x.get(basis, x) if isinstance(x, dict) and basis in x else x

    for st in STARTS:
        print(f"== {st} 시작 → {END} · 100만원 · 잔고 0.10% (0.25%) · 샤프 · MDD · 청산 — 청산 기준 (가) 선물 가격 / (나) 현물 가격")
        for name, r in out["rows"].items():
            for basis in (("가", "나") if name in PLANS else ("-",)):
                a, h = pick(r, st, "0.10%", basis), pick(r, st, "0.25%", basis)
                tag = f"({basis})" if basis != "-" else "    "
                print(f"   {name:30s} {tag} {a['잔고'] / 1e4:8,.1f}만 ({h['잔고'] / 1e4:8,.1f}만) · {a['샤프']:5.2f} · {a['MDD'] * 100:6.1f}% · {a.get('청산') or ''}"
                      + (f" · 펀딩 {r['펀딩'] * 100:+.1f}%" if name in PLANS and basis == "가" and st == STARTS[0] else ""))
    print("== 해마다 수익 (2020 시작, 0.10%; 거울·반대는 (가)/(나))")
    for name, r in out["rows"].items():
        if name in PLANS:
            for basis in ("가", "나"):
                print(f"   {name:30s} ({basis}) " + " ".join("  청산 뒤" if v is None else f"{v * 100:+7.0f}%" for v in r["해"][basis].values()))
        else:
            print(f"   {name:30s}     " + " ".join(f"{v * 100:+7.0f}%" for v in r["해"].values()))


if __name__ == "__main__":
    main()
