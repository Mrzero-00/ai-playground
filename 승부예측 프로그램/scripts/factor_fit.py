#!/usr/bin/env python3
"""요인 → 확률 환산을 실측으로 다시 세운다.

사용자 지시 2026-10-26: 목표는 단일 경기 방향 예측 100%. 승인 기다리지 말고 계속 고쳐라.

왜 — 실험대(direction_lab)가 보여 준 것: 과거 결과만 쓰는 모델은 51~52%에서 막히고 시장은 53.4%다.
그 차이는 결과표에 없는 정보(선발·부상·휴식·동기)에서 온다. 우리는 그걸 수집하고 있는데,
막상 확률로 바꾸는 단계의 계수(-0.9%p 같은 값)는 경험칙으로 붙어 있고 한 번도 실측된 적이 없다.

그래서 여기서 재는 것: **각 요인 유형이 시장 확률 위에 정보를 더하는가.**
  모형: 다항 로지스틱, 입력 = 시장 로그오즈 + 요인 유형별 합계(%p, 홈 기준 부호)
  계수가 양이면 그 유형은 시장이 모르는 정보를 담고 있다(내가 매긴 방향대로 결과가 움직인다).
  0 근처면 잡음이고, 음이면 부호가 반대다.
  판정은 **방향 적중률**로만 한다(시간 순 분할, 과거로 학습해 미래를 맞힌다).

    python3 scripts/factor_fit.py report
    python3 scripts/factor_fit.py report --min 40
"""
import argparse, collections, csv, math, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SIDES = ("승", "무", "패")


def rows(p):
    f = os.path.join(ROOT, p)
    return list(csv.DictReader(open(f, encoding="utf-8-sig"))) if os.path.exists(f) else []


def build(minn):
    games = {(g["회차"], g["번호"]): g for g in rows("전체경기기록.csv")}
    fac = collections.defaultdict(lambda: collections.defaultdict(float))
    for r in rows("data/근거기록.csv"):
        if r.get("구분") != "요인":
            continue
        try:
            v = float(r.get("영향") or 0)
        except ValueError:
            continue
        if not v:
            continue
        t = (r.get("유형") or "기타").strip() or "기타"
        fac[(r["회차"], r["번호"])][t] += v
    types = collections.Counter()
    for k, d in fac.items():
        for t in d:
            types[t] += 1
    keep = [t for t, n in types.items() if n >= minn]
    keep.sort(key=lambda t: -types[t])

    X, y, meta = [], [], []
    for key, g in games.items():
        if g.get("결과") not in SIDES:
            continue
        mk = {}
        ok = True
        for s in SIDES:
            x = g.get(f"시장_{s}")
            if x in (None, ""):
                ok = False; break
            try:
                mk[s] = max(float(x), 0.5) / 100
            except ValueError:
                ok = False; break
        if not ok:
            continue
        d = fac.get(key, {})
        # 시장 로그오즈(무 기준) 2개 + 요인 유형별 합계
        f = [math.log(mk["승"] / mk["무"]), math.log(mk["패"] / mk["무"])]
        f += [d.get(t, 0.0) for t in keep]
        X.append(f)
        y.append(SIDES.index(g["결과"]))
        meta.append({"회차": g["회차"], "번호": g["번호"], "시각": g.get("시각", ""), "n_fac": len(d)})
    return X, y, meta, keep, types


def cmd_report(a):
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    X, y, meta, keep, types = build(a.min)
    if len(y) < 150:
        print(f"표본 부족 ({len(y)}경기)", file=sys.stderr); return 1
    X = np.array(X); y = np.array(y)
    order = sorted(range(len(y)), key=lambda i: (int(meta[i]["회차"]) if meta[i]["회차"].isdigit() else 0,
                                                 meta[i]["번호"]))
    X, y = X[order], y[order]
    cut = int(len(y) * 0.7)
    tr, te = slice(0, cut), slice(cut, len(y))
    print(f"시장 확률이 있는 {len(y)}경기 · 학습 {cut} / 시험 {len(y)-cut} (시간 순)")
    print(f"요인 유형 {len(keep)}종 ({a.min}경기 이상 등장): {', '.join(keep)}\n")

    # 1) 시장만
    m0 = LogisticRegression(max_iter=2000, C=1.0).fit(X[tr][:, :2], y[tr])
    a0 = (m0.predict(X[te][:, :2]) == y[te]).mean() * 100
    # 2) 시장 + 요인
    m1 = LogisticRegression(max_iter=2000, C=0.5).fit(X[tr], y[tr])
    a1 = (m1.predict(X[te]) == y[te]).mean() * 100
    # 3) 우리가 실제 쓴 최종 확률
    print(f"{'입력':<28} {'시험 경기':>8} {'방향 적중률':>10}")
    print("-" * 50)
    print(f"{'시장만':<28} {len(y)-cut:>8} {a0:>9.1f}%")
    print(f"{'시장 + 요인(실측 가중)':<28} {len(y)-cut:>8} {a1:>9.1f}%   {a1-a0:+.1f}p")

    print("\n-- 유형별 계수 (홈승 방향, 양수면 시장이 모르는 정보를 담고 있다)")
    print(f"{'유형':<12} {'등장':>5} {'홈승 계수':>10} {'원정승 계수':>11}  판정")
    cls = list(m1.classes_)
    ih, ia = cls.index(0), cls.index(2)
    for j, t in enumerate(keep):
        ch = m1.coef_[ih][2 + j]; ca = m1.coef_[ia][2 + j]
        eff = ch - ca
        verdict = "정보 있음" if eff > 0.02 else ("부호 반대" if eff < -0.02 else "잡음")
        print(f"{t:<12} {types[t]:>5} {ch:>+10.3f} {ca:>+11.3f}  {verdict}")
    import json
    w = {}
    for j, t in enumerate(keep):
        eff = m1.coef_[ih][2 + j] - m1.coef_[ia][2 + j]
        w[t] = {"n": types[t], "effect": round(float(eff), 4),
                "verdict": "정보" if eff > 0.02 else ("역부호" if eff < -0.02 else "잡음"),
                "weight": 1.0 if eff > 0.02 else (0.0 if eff > -0.02 else 0.0)}
    out = {"fitted": __import__("datetime").date.today().isoformat(),
           "n_train": cut, "n_test": len(y) - cut,
           "acc_market_only": round(a0, 2), "acc_with_factors": round(a1, 2),
           "types": w,
           "note": "weight=0 인 유형은 수집·기록은 하되 확률을 움직이지 않는다. 표본이 늘면 재추정한다."}
    json.dump(out, open(os.path.join(ROOT, "data", "factor_weights.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"\n→ data/factor_weights.json ({sum(1 for v in w.values() if v['weight'])}/{len(w)} 유형만 확률에 반영)")
    print("\n계수는 '내가 매긴 %p 1점이 결과 로그오즈를 얼마나 움직였나'다.")
    print("판정이 '잡음'인 유형은 수집은 하되 확률 조정에 쓰지 않는 쪽이 낫다.")
    print("판정이 '부호 반대'면 지금 반대로 적용하고 있다는 뜻이라 즉시 고친다.")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("report"); p.add_argument("--min", type=int, default=30); p.set_defaults(f=cmd_report)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
