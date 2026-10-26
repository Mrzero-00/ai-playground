#!/usr/bin/env python3
"""무승부 전용 확률 모델 (사용자 지시 2026-10-22, 개선안 1번).

왜 필요한가 — 측정이 말해 준 것:
  426경기에서 무가 98번(23.0%) 났는데 내가 잡은 건 1번, 시장은 0번이다.
  내가 틀린 경기의 **45%가 무**다. 지금은 무를 따로 계산하지 않고 승·패의 나머지로 두기 때문에
  무가 1순위가 되는 일이 사실상 없다(483경기 중 2번).
  구간을 나눠 보면 '시장 무 28%+ & 시장 1순위 45% 미만' 45경기에서 무 발생률 37.8%,
  그 구간 내 현재 적중은 31.1% — 무로 바꾸면 +6.7%p 다. 표본이 작아 확정은 못 하지만 후보다.

그래서 승·패와 **독립적으로** 무 확률만 내는 모델을 둔다. 특징은 전부 경기 전에 구할 수 있는 것만 쓴다.
학습: football-data.co.uk 과거 경기(data/<Div>_<시즌>.csv, data/extra_*.csv).
검증: 시간 순 분할(앞 시즌 학습 → 뒤 시즌 시험). 섞어서 재면 미래를 보고 맞히는 셈이라 금지.

    python3 scripts/draw_model.py fit            # 학습·시간분할 검증 → data/draw_model.json
    python3 scripts/draw_model.py report         # 신뢰도 곡선·기준선 대비
    python3 scripts/draw_model.py predict --lh 1.4 --la 1.2 --dh 0.30 --da 0.25 --lg 0.24
"""
import argparse, csv, glob, json, math, os, sys, collections, datetime as dt

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "data", "draw_model.json")
FORM = 10          # 최근 몇 경기로 폼·무 성향을 보는가
MINPLAY = 6        # 양 팀 모두 이만큼은 치러야 특징을 믿는다


def _f(x, d=None):
    try:
        return float(x)
    except (TypeError, ValueError):
        return d


def load_matches():
    """(날짜, 리그, 홈, 원정, 홈골, 원정골, 무여부, 시장무확률) 시간순."""
    rows = []
    files = sorted(glob.glob(os.path.join(ROOT, "data", "[A-Z]*_[0-9][0-9][0-9][0-9].csv")))
    files += sorted(glob.glob(os.path.join(ROOT, "data", "extra_*.csv")))
    for f in files:
        try:
            rs = list(csv.DictReader(open(f, encoding="utf-8-sig", errors="replace")))
        except Exception:
            continue
        for r in rs:
            hg, ag = _f(r.get("FTHG") or r.get("HG")), _f(r.get("FTAG") or r.get("AG"))
            if hg is None or ag is None:
                continue
            ds = (r.get("Date") or "").strip()
            d = None
            for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
                try:
                    d = dt.datetime.strptime(ds, fmt).date(); break
                except ValueError:
                    pass
            if not d:
                continue
            lg = (r.get("Div") or r.get("League") or os.path.basename(f).split("_")[0]).strip()
            home = (r.get("HomeTeam") or r.get("Home") or "").strip()
            away = (r.get("AwayTeam") or r.get("Away") or "").strip()
            if not home or not away:
                continue
            # 시장 무 확률(있으면) — 모델 입력이 아니라 비교용
            od = _f(r.get("B365D") or r.get("PSD") or r.get("AvgD") or r.get("PD"))
            oh = _f(r.get("B365H") or r.get("PSH") or r.get("AvgH") or r.get("PH"))
            oa = _f(r.get("B365A") or r.get("PSA") or r.get("AvgA") or r.get("PA"))
            mkd = None
            if od and oh and oa and min(od, oh, oa) > 1:
                s = 1 / od + 1 / oh + 1 / oa
                mkd = (1 / od) / s
            rows.append({"date": d, "lg": lg, "home": home, "away": away,
                         "hg": hg, "ag": ag, "draw": 1 if hg == ag else 0,
                         "ref": (r.get("Referee") or "").strip(), "mkd": mkd})
    rows.sort(key=lambda r: r["date"])
    return rows


def build(rows):
    """경기 전 시점 특징만 만든다 — 그 경기 이전 기록만 본다."""
    hist = collections.defaultdict(list)      # 팀 → [(무여부, 득, 실)]
    lgall = collections.defaultdict(list)     # 리그 → [무여부]
    refs = collections.defaultdict(list)      # 심판 → [무여부]
    X, y, meta = [], [], []
    for r in rows:
        h, a, lg = r["home"], r["away"], r["lg"]
        hh, ha = hist[h][-FORM:], hist[a][-FORM:]
        lr = lgall[lg]
        if len(hh) >= MINPLAY and len(ha) >= MINPLAY and len(lr) >= 50:
            dh = sum(x[0] for x in hh) / len(hh)                 # 홈팀 최근 무 비율
            da = sum(x[0] for x in ha) / len(ha)
            lgrate = sum(lr[-380:]) / len(lr[-380:])             # 리그 무 비율
            gf_h = sum(x[1] for x in hh) / len(hh); ga_h = sum(x[2] for x in hh) / len(hh)
            gf_a = sum(x[1] for x in ha) / len(ha); ga_a = sum(x[2] for x in ha) / len(ha)
            lam_h = max(0.15, (gf_h + ga_a) / 2)                 # 거친 기대 득점
            lam_a = max(0.15, (gf_a + ga_h) / 2)
            tot = lam_h + lam_a
            gap = abs(lam_h - lam_a)
            ppg_h = sum((2 if x[1] > x[2] else 1 if x[0] else 0) for x in hh) / len(hh)
            ppg_a = sum((2 if x[1] > x[2] else 1 if x[0] else 0) for x in ha) / len(ha)
            strength = abs(ppg_h - ppg_a)                        # 전력 차
            rf = refs.get(r["ref"], [])
            rrate = (sum(rf[-60:]) / len(rf[-60:])) if len(rf) >= 20 else lgrate
            X.append([dh, da, lgrate, tot, gap, strength, rrate,
                      math.exp(-tot), 1.0 if gap < 0.25 else 0.0])
            y.append(r["draw"])
            meta.append({"date": r["date"], "lg": lg, "mkd": r["mkd"],
                         "tot": tot, "gap": gap, "strength": strength})
        hist[h].append((r["draw"], r["hg"], r["ag"]))
        hist[a].append((r["draw"], r["ag"], r["hg"]))
        lgall[lg].append(r["draw"])
        if r["ref"]:
            refs[r["ref"]].append(r["draw"])
    return X, y, meta


FEATS = ["홈무비율", "원정무비율", "리그무비율", "기대총득점", "기대득점차",
         "최근승점차", "심판무비율", "exp(-총득점)", "접전플래그"]


def brier(p, y):
    return sum((pi - yi) ** 2 for pi, yi in zip(p, y)) / len(y)


def cmd_fit(a):
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    rows = load_matches()
    X, y, meta = build(rows)
    if len(y) < 500:
        print(f"학습 표본 부족 ({len(y)})", file=sys.stderr); return 1
    X = np.array(X); y = np.array(y)
    dates = [m["date"] for m in meta]
    cut = dates[int(len(dates) * 0.75)]
    tr = [i for i, d in enumerate(dates) if d < cut]
    te = [i for i, d in enumerate(dates) if d >= cut]
    print(f"학습 {len(tr)}경기(~{cut}) · 시험 {len(te)}경기 — 섞지 않고 시간 순으로 자른다")
    mu, sd = X[tr].mean(0), X[tr].std(0) + 1e-9
    Z = (X - mu) / sd
    m = LogisticRegression(C=0.5, max_iter=2000).fit(Z[tr], y[tr])
    p = m.predict_proba(Z[te])[:, 1]
    base = y[tr].mean()
    bb = brier([base] * len(te), y[te]); bm = brier(list(p), y[te])
    print(f"\n시험 구간 실제 무 {y[te].mean()*100:.1f}% · 기준선(평균값) {base*100:.1f}%")
    print(f"Brier  기준선 {bb:.4f} → 모델 {bm:.4f}  ({(bb-bm)/bb*100:+.1f}%)")
    mk = [(i, meta[i]["mkd"]) for i in te if meta[i]["mkd"] is not None]
    if len(mk) > 200:
        idx = [i for i, _ in mk]; mp = [v for _, v in mk]
        ym = y[idx]
        pm = m.predict_proba(Z[idx])[:, 1]
        print(f"시장 배당이 있는 {len(mk)}경기 — Brier 시장 {brier(mp, ym):.4f} · 모델 {brier(list(pm), ym):.4f}")
    print("\n-- 계수 (표준화, 양수면 무 확률을 올린다)")
    for nmf, c in sorted(zip(FEATS, m.coef_[0]), key=lambda x: -abs(x[1])):
        print(f"   {nmf:12s} {c:+.3f}")
    json.dump({"feats": FEATS, "mu": mu.tolist(), "sd": sd.tolist(),
               "coef": m.coef_[0].tolist(), "intercept": float(m.intercept_[0]),
               "n_train": len(tr), "n_test": len(te), "brier_base": bb, "brier_model": bm,
               "base_rate": float(base), "fitted": dt.date.today().isoformat()},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n→ {OUT}")
    return 0


def _load():
    if not os.path.exists(OUT):
        print("먼저 fit 을 돌린다", file=sys.stderr); return None
    return json.load(open(OUT, encoding="utf-8"))


def apply_feats(v, M):
    z = [(x - mu) / sd for x, mu, sd in zip(v, M["mu"], M["sd"])]
    t = M["intercept"] + sum(c * zi for c, zi in zip(M["coef"], z))
    return 1 / (1 + math.exp(-t))


def cmd_report(a):
    import numpy as np
    M = _load()
    if not M:
        return 1
    rows = load_matches()
    X, y, meta = build(rows)
    dates = [m["date"] for m in meta]
    cut = dt.date.fromisoformat(a.since) if a.since else dates[int(len(dates) * 0.75)]
    te = [i for i, d in enumerate(dates) if d >= cut]
    p = [apply_feats(X[i], M) for i in te]
    yy = [y[i] for i in te]
    print(f"검증 {len(te)}경기 ({cut} 이후) · 실제 무 {sum(yy)/len(yy)*100:.1f}%\n")
    print(f"{'모델 무 확률':>12} {'경기':>5} {'모델 평균':>9} {'실제':>7} {'격차':>7}")
    for lo, hi in [(0, .18), (.18, .22), (.22, .26), (.26, .30), (.30, .35), (.35, 1.01)]:
        b = [(pi, yi) for pi, yi in zip(p, yy) if lo <= pi < hi]
        if len(b) < 20:
            continue
        s = sum(x[0] for x in b) / len(b) * 100
        g = sum(x[1] for x in b) / len(b) * 100
        print(f"{lo*100:>5.0f}~{hi*100:<6.0f} {len(b):>5} {s:>8.1f}% {g:>6.1f}% {g-s:>+6.1f}p")
    top = sorted(zip(p, yy), key=lambda x: -x[0])
    for frac in (0.05, 0.10, 0.20):
        k = int(len(top) * frac)
        if k >= 20:
            print(f"\n모델이 무 확률 상위 {frac*100:.0f}% 로 뽑은 {k}경기 → 실제 무 {sum(x[1] for x in top[:k])/k*100:.1f}%"
                  f" (전체 {sum(yy)/len(yy)*100:.1f}%)")
    return 0


def cmd_predict(a):
    M = _load()
    if not M:
        return 1
    tot, gap = a.lh + a.la, abs(a.lh - a.la)
    v = [a.dh, a.da, a.lg, tot, gap, a.strength, a.ref if a.ref is not None else a.lg,
         math.exp(-tot), 1.0 if gap < 0.25 else 0.0]
    print(f"무 확률 {apply_feats(v, M)*100:.1f}%  (리그 평균 {a.lg*100:.1f}%, 기대 {a.lh:.2f}:{a.la:.2f})")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    s.add_parser("fit").set_defaults(f=cmd_fit)
    p = s.add_parser("report"); p.add_argument("--since"); p.set_defaults(f=cmd_report)
    p = s.add_parser("predict")
    p.add_argument("--lh", type=float, required=True, help="홈 기대 득점")
    p.add_argument("--la", type=float, required=True, help="원정 기대 득점")
    p.add_argument("--dh", type=float, required=True, help="홈팀 최근 무 비율 0~1")
    p.add_argument("--da", type=float, required=True, help="원정팀 최근 무 비율 0~1")
    p.add_argument("--lg", type=float, required=True, help="리그 무 비율 0~1")
    p.add_argument("--strength", type=float, default=0.5, help="최근 경기당 승점 차")
    p.add_argument("--ref", type=float, default=None, help="심판 무 비율(없으면 리그값)")
    p.set_defaults(f=cmd_predict)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
