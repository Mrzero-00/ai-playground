"""3상태 장 판별 루프 (RESEARCH.md '3상태 장 판별 루프 등록'). 상승·하락·횡보 + 정도 5단계, BTC·ETH, Coin Metrics 일별 종가.
정답은 날 t 를 가운데 둔 60일 움직임의 z. 판별기는 그날까지의 자료만, 배우는 것은 워크포워드.
사용법: python3 scripts/lab/regime3.py <회차>      → data/lab/regime3.json 에 그 회차를 쌓는다
        python3 scripts/lab/regime3.py --summary  → 최고 판별기의 쓸모 확인·차트 자료·오늘 상태
"""
import json
import sys
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import common as C
from indicators import machine, sma
from regime_loop2 import SYMS, ens, load

H, WARM = 30, 365
PERIODS = {"2011~2017": ("2010-01-01", "2017-12-31"), "2018~2021": ("2018-01-01", "2021-12-31"), "2022~2026": ("2022-01-01", "2026-11-22")}
GRADES = [-2, -1, 0, 1, 2]
GNAME = {2: "강한 상승장", 1: "상승장", 0: "횡보장", -1: "하락장", -2: "강한 하락장"}
OUT, PRED = C.OUT / "regime3.json", C.OUT / "regime3_pred.pkl"


def grade(z):
    z = np.asarray(z, float)
    with np.errstate(invalid="ignore"):
        return np.where(z >= 2, 2, np.where(z >= 1, 1, np.where(z <= -2, -2, np.where(z <= -1, -1, 0)))).astype(int)


def hyst(z, enter=1.0, leave=0.5):
    """문턱에 여유: |z| ≥ enter 면 추세로 들어가고, |z| < leave 로 내려와야 횡보로. 반대쪽 문턱을 넘으면 바로 바꾼다. 강한 장은 |z| ≥ 2."""
    z = np.asarray(z, float)
    out, st = np.zeros(len(z), int), 0
    for i, v in enumerate(z):
        if np.isnan(v):
            st = 0
        elif v >= enter:
            st = 1
        elif v <= -enter:
            st = -1
        elif (st == 1 and v < leave) or (st == -1 and v > -leave):
            st = 0
        out[i] = st * (2 if abs(v) >= 2 else 1) if st else 0
    return out


def ztrail(c, n):
    lr = np.log(c)
    return (lr - lr.shift(n)) / (lr.diff().rolling(n).std() * np.sqrt(n))


def rw_value(c):
    """무작위 걸음 최선 규칙의 값: 지난 30일 로그 수익 ÷ (지난 60일 표준편차 × √60) = 정답 z 의 기대값."""
    lr = np.log(c)
    return (lr - lr.shift(H)) / (lr.diff().rolling(2 * H).std() * np.sqrt(2 * H))


def frames():
    out = {}
    for s in SYMS:
        c = load(s).close
        lr = np.log(c)
        zc = (lr.shift(-H) - lr.shift(H)) / (lr.diff().rolling(2 * H).std().shift(-H) * np.sqrt(2 * H))
        out[s] = dict(c=c, zc=zc, lab=grade(zc), lab_h=hyst(zc), known=zc.notna().to_numpy(), valid=zc.notna().to_numpy() & (np.arange(len(c)) >= WARM))
    return out


# ---------- 워크포워드 ----------

class BinTable:
    """값 하나를 0.5 단위 칸으로 나눠 칸마다 과거 정답 비율."""
    classes_ = np.array(GRADES)

    def _bin(self, X):
        return np.clip(np.floor(np.asarray(X)[:, 0] / 0.5), -8, 7).astype(int) + 8

    def fit(self, X, y):
        self.t = np.ones((16, 5))  # 라플라스 평활
        np.add.at(self.t, (self._bin(X), np.asarray(y) + 2), 1)
        return self

    def predict_proba(self, X):
        t = self.t[self._bin(X)]
        return t / t.sum(1, keepdims=True)


def logit():
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))


def walk_forward(F, feats, make_model, min_train=500, step=30):
    """날 d 의 판별에는 d − 30 일 이전(정답 확정)의 두 코인 자료만. step 일마다 다시 배운다. 못 배운 날은 무작위 걸음 최선 규칙."""
    rows = []
    for s, f in F.items():
        X = feats(f["c"], s).copy()
        X["_sym"], X["_lab"], X["_known"], X["_pos"] = s, f["lab"], f["known"], np.arange(len(X))
        rows.append(X)
    A = pd.concat(rows).reset_index().rename(columns={"index": "date", "date": "date"}).sort_values("date", kind="stable").reset_index(drop=True)
    cols = [k for k in A.columns if not k.startswith("_") and k != "date"]
    fin = np.isfinite(A[cols].to_numpy(float)).all(axis=1)
    out = {s: grade(rw_value(f["c"])) for s, f in F.items()}
    dates = np.sort(A.date.unique())
    learned = 0
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for i in range(0, len(dates), step):
            d, nxt = dates[i], dates[min(i + step, len(dates) - 1)] if i + step < len(dates) else dates[-1] + np.timedelta64(1, "D")
            tr = fin & A._known.to_numpy() & (A.date.to_numpy() <= d - np.timedelta64(H, "D"))
            te = fin & (A.date.to_numpy() >= d) & (A.date.to_numpy() < nxt)
            if tr.sum() < min_train or not te.any():
                continue
            m = make_model().fit(A.loc[tr, cols].to_numpy(float), A.loc[tr, "_lab"].to_numpy(int))
            P = np.zeros((te.sum(), 5))
            cls = m.classes_ if hasattr(m, "classes_") else m[-1].classes_
            P[:, [GRADES.index(k) for k in cls]] = m.predict_proba(A.loc[te, cols].to_numpy(float))
            p3 = np.column_stack([P[:, 0] + P[:, 1], P[:, 2], P[:, 3] + P[:, 4]])
            st = p3.argmax(1) - 1
            g = np.where(st == 1, np.where(P[:, 4] > P[:, 3], 2, 1), np.where(st == -1, np.where(P[:, 0] > P[:, 1], -2, -1), 0))
            for s in F:
                k = (A.loc[te, "_sym"] == s).to_numpy()
                out[s][A.loc[te, "_pos"].to_numpy()[k]] = g[k]
            learned += te.sum()
    return out


# ---------- 회차 ----------

def f_rw(c, s):
    return pd.DataFrame({"a": rw_value(c)})


def f_multi(c, s):
    return pd.DataFrame({f"z{n}": ztrail(c, n) for n in (10, 20, 30, 60, 120)})


def f_volpos(c, s):
    X = f_multi(c, s)
    r = np.log(c).diff()
    hi, lo = c.rolling(60).max(), c.rolling(60).min()
    X["vol"] = r.rolling(30).std() / r.rolling(365).std()
    X["pos"] = (c - lo) / (hi - lo).replace(0, np.nan)
    X["dd"] = np.log(c / c.rolling(365).max())
    X["ens"] = ens(c)
    return X


def iter0(F):
    out = {}
    for name, fn in (("늘 횡보", lambda c: np.zeros(len(c), int)), ("지난 60일 z", lambda c: grade(ztrail(c, 60))), ("지난 30일 z", lambda c: grade(ztrail(c, 30))),
                     ("무작위 걸음 최선 규칙", lambda c: grade(rw_value(c))),
                     ("앙상블 비중 (지금 봇)", lambda c: np.where(ens(c) >= 0.75, 1, np.where(ens(c) <= 0.25, -1, 0)))):
        out[name] = {s: np.asarray(fn(f["c"]), int) for s, f in F.items()}
    return out


def iter1(F):
    return {"과거에서 배운 확률표": walk_forward(F, f_rw, BinTable)}


def iter2(F):
    return {"여러 길이 로지스틱": walk_forward(F, f_multi, logit)}


def iter3(F):
    return {"여러 길이 + 변동성·위치 로지스틱": walk_forward(F, f_volpos, logit)}


def iter4(F):
    return {"지난 30일 z + 문턱 여유": {s: hyst(ztrail(f["c"], 30)) for s, f in F.items()}}


ITERS = {0: iter0, 1: iter1, 2: iter2, 3: iter3, 4: iter4}


# ---------- 채점 ----------

def score(F, preds):
    res = {}
    for pn, (a, b) in PERIODS.items():
        P, L, LH = [], [], []
        for s, f in F.items():
            idx = f["c"].index
            m = f["valid"] & np.asarray((idx >= a) & (idx <= b))
            P.append(preds[s][m])
            L.append(f["lab"][m])
            LH.append(f["lab_h"][m])
        p, l, lh = np.concatenate(P), np.concatenate(L), np.sign(np.concatenate(LH))
        p3, l3 = np.sign(p), np.sign(l)
        rec = {str(k): float((p3[l3 == k] == k).mean()) for k in (1, 0, -1)}
        res[pn] = {"일치": float((p3 == l3).mean()), "상태별": rec, "5단계": float((p == l).mean()), "한 단계 이내": float((np.abs(p - l) <= 1).mean()),
                   "정답 비율": {str(k): float((l3 == k).mean()) for k in (1, 0, -1)}, "날": int(len(l)),
                   "여유 정답 일치": float((p3 == lh).mean()), "여유 정답 상태별": {str(k): float((p3[lh == k] == k).mean()) for k in (1, 0, -1)}}
    res["최저 일치"] = min(res[pn]["일치"] for pn in PERIODS)
    res["최저 여유 정답 일치"] = min(res[pn]["여유 정답 일치"] for pn in PERIODS)
    res["성공"] = bool(res["최저 일치"] >= 0.8 and all(r >= 0.5 for pn in PERIODS for r in res[pn]["상태별"].values()))
    return res


def run(k):
    F = frames()
    store = json.loads(OUT.read_text()) if OUT.exists() else {"iters": {}}
    cache = pd.read_pickle(PRED) if PRED.exists() else {}
    preds = ITERS[k](F)
    store["iters"][str(k)] = {"made": datetime.now().isoformat(timespec="seconds"), "methods": {n: score(F, p) for n, p in preds.items()}}
    cache.update(preds)
    pd.to_pickle(cache, PRED)
    for v in store["iters"].values():
        for n in v["methods"]:
            v["methods"][n] = score(F, cache[n])
    OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
    one = next(iter(store["iters"][str(k)]["methods"].values()))
    if k == 0:
        print("정답 비율(상승 / 횡보 / 하락):", " · ".join(f"{pn} {v['정답 비율']['1'] * 100:.0f}/{v['정답 비율']['0'] * 100:.0f}/{v['정답 비율']['-1'] * 100:.0f}%" for pn, v in one.items() if pn in PERIODS))
    print(f"== {k}회차  3상태 일치율 (2011~2017 / 2018~2021 / 2022~2026) · 2022~2026 의 상승·횡보·하락 맞힌 비율 · 5단계 일치")
    for n, r in store["iters"][str(k)]["methods"].items():
        v = [r[pn]["일치"] for pn in PERIODS]
        rc = r["2022~2026"]["상태별"]
        h = [r[pn]["여유 정답 일치"] for pn in PERIODS]
        print(f"   {n:26s} {v[0] * 100:5.1f}% / {v[1] * 100:5.1f}% / {v[2] * 100:5.1f}%  | {rc['1'] * 100:3.0f}·{rc['0'] * 100:3.0f}·{rc['-1'] * 100:3.0f}% | {r['2022~2026']['5단계'] * 100:3.0f}% {'★ 성공' if r['성공'] else ''}"
              f"  (여유 정답 {h[0] * 100:.1f} / {h[1] * 100:.1f} / {h[2] * 100:.1f}%)")
    best = max(((n, r["최저 일치"], i) for i, v in store["iters"].items() for n, r in v["methods"].items() if n != "늘 횡보"), key=lambda t: t[1])
    print(f"지금까지 세 기간 최저 일치율 최고: {best[2]}회차 {best[0]} {best[1] * 100:.1f}%")


# ---------- 쓸모 확인·차트·오늘 ----------

def strategies(c):
    m, sd = sma(c, 20), c.rolling(20).std()
    x = c.to_numpy()
    no = np.zeros(len(x), bool)
    with np.errstate(invalid="ignore"):
        boll = machine(len(x), x < (m - 2 * sd).to_numpy(), no, x >= m.to_numpy(), no)
        donch = machine(len(x), x > c.rolling(20).max().shift().to_numpy(), no, x < c.rolling(10).min().shift().to_numpy(), no)
    return {"보유": np.ones(len(x)), "현물 봇": ens(c).to_numpy(), "볼린저 평균회귀": boll, "돈치안 돌파": donch}


def runs(dates, g):
    out, s = [], 0
    for i in range(1, len(g) + 1):
        if i == len(g) or g[i] != g[s]:
            out.append([str(dates[s].date()), str(dates[i - 1].date()), int(g[s])])
            s = i
    return out


def summary():
    F = frames()
    store, cache = json.loads(OUT.read_text()), pd.read_pickle(PRED)
    best = max(((n, r["최저 일치"]) for v in store["iters"].values() for n, r in v["methods"].items() if n != "늘 횡보"), key=lambda t: t[1])[0]
    use, chart, today = {}, {}, {}
    for src in ("정답 (지나고 본 장)", best, "지난 60일 z"):
        acc = {}
        for s, f in F.items():
            c = f["c"]
            g = f["lab"] if src.startswith("정답") else cache[src][s]
            ok = f["valid"]
            for name, pos in strategies(c).items():
                p = pd.Series(pos, index=c.index)
                ret = (p.shift() * c.pct_change() - 0.001 * p.diff().abs().shift().fillna(0)).shift(-1)  # 날 t 의 상태 → t+1 수익
                for st in (1, 0, -1):
                    for pn, (a, b) in list(PERIODS.items()) + [("전체", ("2010-01-01", "2026-11-22"))]:
                        m = ok & (np.sign(g) == st) & np.asarray((c.index >= a) & (c.index <= b)) & ret.notna().to_numpy()
                        acc.setdefault((name, st, pn), []).append(ret.to_numpy()[m])
        use[src] = {name: {str(st): {pn: (float(np.concatenate(acc[(name, st, pn)]).mean() * 365) if sum(len(x) for x in acc[(name, st, pn)]) else None)
                                     for pn in list(PERIODS) + ["전체"]} for st in (1, 0, -1)} for name in ("보유", "현물 봇", "볼린저 평균회귀", "돈치안 돌파")}
        use[src]["날 비율"] = {str(st): float(np.mean(np.concatenate([np.sign((f["lab"] if src.startswith("정답") else cache[src][s])[f["valid"]]) == st for s, f in F.items()]))) for st in (1, 0, -1)}
    for s, f in F.items():
        c = f["c"]
        m = np.asarray(c.index >= "2018-01-01")
        g = cache[best][s]
        lab = np.where(f["known"], f["lab"], 9)  # 9 = 아직 정답이 없다(마지막 30일)
        chart[s] = {"dates": [str(d.date()) for d in c.index[m][::3]], "price": [float(x) for x in c.to_numpy()[m][::3]],
                    "판별": runs(c.index[m], g[m]), "정답": runs(c.index[m], lab[m])}
        since = pd.Series(g, index=c.index)
        since = since[since != since.shift()].index[-1]
        today[s] = {"날짜": str(c.index[-1].date()), "종가": float(c.iloc[-1]), "판별": int(g[-1]), "이름": GNAME[int(g[-1])], "시작": str(since.date()),
                    "지난 60일 z": float(ztrail(c, 60).iloc[-1]), "지난 30일 z": float(ztrail(c, 30).iloc[-1])}
    store.update(best=best, use=use, chart=chart, today=today, summary_made=datetime.now().isoformat(timespec="seconds"))
    OUT.write_text(json.dumps(store, ensure_ascii=False, indent=1))
    print("최고 판별기:", best)
    for s, t in today.items():
        print(f"오늘 {s} {t['날짜']} 종가 {t['종가']:,.0f}: {t['이름']} ({t['시작']} 부터) · 지난 60일 z {t['지난 60일 z']:+.2f} · 지난 30일 z {t['지난 30일 z']:+.2f}")
    for src, u in use.items():
        print(f"== 상태별 다음 날 수익(연 환산, 전체 기간) — {src} · 날 비율 상승 {u['날 비율']['1'] * 100:.0f}% 횡보 {u['날 비율']['0'] * 100:.0f}% 하락 {u['날 비율']['-1'] * 100:.0f}%")
        for name in ("보유", "현물 봇", "볼린저 평균회귀", "돈치안 돌파"):
            v = u[name]
            per = " | ".join(f"{pn[:4]}: " + "/".join(f"{v[str(st)][pn] * 100:+.0f}" if v[str(st)][pn] is not None else "-" for st in (1, 0, -1)) for pn in PERIODS)
            print(f"   {name:10s} 상승 {v['1']['전체'] * 100:+5.0f}% 횡보 {v['0']['전체'] * 100:+5.0f}% 하락 {v['-1']['전체'] * 100:+5.0f}%   ({per})")


if __name__ == "__main__":
    summary() if sys.argv[1] == "--summary" else run(int(sys.argv[1]))
