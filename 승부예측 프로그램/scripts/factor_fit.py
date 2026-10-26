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

2026-10-26 (127회 심층회고) — **게이트를 계수 문턱에서 '실측 2관문'으로 바꿨다.**
  왜: 이전 게이트는 `effect > 0.02` 하나였다. 로그오즈 0.02 는 표준오차(0.12~0.37)보다 훨씬 작아
  잡음이 그대로 통과했다. 실제로 회차마다 판정이 뒤집혔다 — 결장이 '역부호'→'정보', 기준선불신이
  '정보'→'잡음'. 그 상태로 weight=1.0 을 받은 세 유형(결장·폼·기타)을 시험셋에서 재 보니
  **전부 방향 적중률을 깎고 있었다**(결장 -1.3p · 폼 -0.4p · 기타 -3.1p, 시장만 57.1% 기준).
  그래서 유형이 확률을 움직이려면 두 관문을 다 통과해야 한다:
    ① 부호 안정성 — 학습 구간 부트스트랩 400회에서 같은 부호가 95% 이상.
    ② 시험셋 기여 — 그 유형 하나만 시장 위에 얹었을 때 방향 적중률이 올라간다(> 0).
  둘 중 하나라도 못 넘으면 weight=0 — **수집·기록은 하되 확률을 움직이지 않는다**.
  이것은 '덮는' 변경이 아니다. 어느 구간을 추천에서 빼는 게 아니라, 정보가 없다고 실측된 보정을
  끄는 것이다. 표본이 늘면 같은 관문으로 다시 재서 켠다.

    python3 scripts/factor_fit.py report
    python3 scripts/factor_fit.py report --min 40 --boot 400
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

    cls = list(m1.classes_)
    ih, ia = cls.index(0), cls.index(2)

    # 관문 ① 부호 안정성 — 학습 구간을 재표집해 effect 부호가 흔들리는지 본다.
    #   표준오차가 effect 보다 크면 그 유형은 '정보'가 아니라 그 회차의 우연이다.
    rng = np.random.default_rng(a.seed)
    boot = np.zeros((a.boot, len(keep)))
    for b in range(a.boot):
        idx = rng.integers(0, cut, cut)
        try:
            mb = LogisticRegression(max_iter=2000, C=0.5).fit(X[tr][idx], y[tr][idx])
        except Exception:
            boot[b] = np.nan; continue
        cb = list(mb.classes_)
        boot[b] = mb.coef_[cb.index(0)][2:] - mb.coef_[cb.index(2)][2:]

    # 관문 ② 시험셋 기여 — 그 유형 하나만 시장 위에 얹어 방향 적중률이 오르는지 본다.
    def solo(j):
        c = [0, 1, 2 + j]
        m = LogisticRegression(max_iter=2000, C=0.5).fit(X[tr][:, c], y[tr])
        return (m.predict(X[te][:, c]) == y[te]).mean() * 100

    print("\n-- 유형별 판정 (관문 ① 부호 안정성 95%+ · 관문 ② 시험셋 방향 적중 기여 > 0)")
    print(f"{'유형':<12} {'등장':>5} {'effect':>8} {'표준오차':>8} {'양수비율':>8} {'단독 시험':>9} {'차':>7}  판정")
    w = {}
    for j, t in enumerate(keep):
        eff = float(m1.coef_[ih][2 + j] - m1.coef_[ia][2 + j])
        col = boot[:, j]; col = col[~np.isnan(col)]
        se = float(col.std()) if len(col) else float("nan")
        pos = float((col > 0).mean()) if len(col) else float("nan")
        s_acc = solo(j); d = s_acc - a0
        stable = pos >= 0.95            # 양의 정보라고 말할 수 있는가
        helps = d > 0                   # 실제로 미래 경기를 더 맞히는가
        if stable and helps:
            verdict, weight = "정보(채택)", 1.0
        elif pos <= 0.05:
            verdict, weight = "역부호", 0.0
        elif not stable:
            verdict, weight = "잡음(부호 불안정)", 0.0
        else:
            verdict, weight = "기여 없음", 0.0
        print(f"{t:<12} {types[t]:>5} {eff:>+8.3f} {se:>8.3f} {pos:>7.1%} "
              f"{s_acc:>8.1f}% {d:>+6.1f}p  {verdict}")
        w[t] = {"n": types[t], "effect": round(eff, 4), "se": round(se, 4),
                "sign_stability": round(pos, 3), "solo_test_acc": round(s_acc, 2),
                "solo_delta": round(d, 2), "verdict": verdict, "weight": weight}

    kept = [t for t in keep if w[t]["weight"]]
    # 채택된 유형만 얹었을 때 시험셋 적중 — json 의 acc_with_factors 가 실제 운용값을 가리키게 한다.
    cols = [0, 1] + [2 + keep.index(t) for t in kept]
    if kept:
        mk = LogisticRegression(max_iter=2000, C=0.5).fit(X[tr][:, cols], y[tr])
        a_kept = (mk.predict(X[te][:, cols]) == y[te]).mean() * 100
    else:
        a_kept = a0                      # 채택 0 = 사전확률 그대로 = 시장만
    print(f"\n{'채택 유형만 적용':<28} {len(y)-cut:>8} {a_kept:>9.1f}%   {a_kept-a0:+.1f}p"
          f"   ({', '.join(kept) if kept else '채택 0 — 보정 없음'})")

    import json
    out = {"fitted": __import__("datetime").date.today().isoformat(),
           "n_train": cut, "n_test": len(y) - cut, "boot": a.boot,
           "acc_market_only": round(a0, 2), "acc_all_factors": round(a1, 2),
           "acc_with_factors": round(a_kept, 2),
           "gate": "부호 안정성 95%+ AND 단독 시험셋 기여 > 0",
           "types": w,
           "note": "weight=0 인 유형은 수집·기록은 하되 확률을 움직이지 않는다. 표본이 늘면 재추정한다."}
    json.dump(out, open(os.path.join(ROOT, "data", "factor_weights.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"→ data/factor_weights.json ({len(kept)}/{len(keep)} 유형만 확률에 반영)")
    print("\n계수는 '내가 매긴 %p 1점이 결과 로그오즈를 얼마나 움직였나'다.")
    print("두 관문을 다 넘지 못한 유형은 수집·기록만 하고 확률은 사전확률 그대로 둔다 — 보정 0 이 기본값이다.")
    print("'역부호'는 반대로 적용하고 있다는 뜻이지만, 뒤집어 쓰지 않는다(표본이 적어 부호만 바꾸면 과적합이다).")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("report")
    p.add_argument("--min", type=int, default=30)
    p.add_argument("--boot", type=int, default=400, help="부호 안정성 부트스트랩 횟수")
    p.add_argument("--seed", type=int, default=7)
    p.set_defaults(f=cmd_report)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
