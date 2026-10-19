#!/usr/bin/env python3
"""적중 예상도 모델 (2026-10-15, 사용자 제안 "예상 결과와 적중 예상도를 따로 구하고, 적중 예상도가 기준 이상일 때만 추천, 기록은 전부")
구조
- 예상 결과 = 순수 확률(승/무/패)의 1순위. 확률을 섞거나 더하지 않는다.
- 적중 예상도 = "그 1순위가 맞을 확률"을 과거 결과로 따로 학습한 로지스틱 회귀.
  입력(축구): 순수 1순위 확률, 1·2순위 차, 홈 픽 여부, 무 픽 여부, 확신도(높음2/중간1/낮음0), 보정(calibrate) 1순위와 일치 여부.
  L2 정규화(λ=1), 5-fold CV 로 구간별 실제 적중률을 같이 보고한다. 표본 40 미만 종목은 모델 없이 '보정 1순위 확률'을 적중 예상도로 쓴다(대체).
- 추천 문턱: 적중 예상도 ≥ 60% (분석규칙). 70% 이상 구간이 실제로 70%를 넘기 시작하면 문턱을 70%로 올린다.
사용
  python3 scripts/hit_model.py fit                 # 전체경기기록 → data/hit_model.json + 회차별분석/적중예상도_YYYY-MM-DD.md
  python3 scripts/hit_model.py fit --exclude 122   # 특정 회차를 빼고 학습(사후 검증용)
  python3 scripts/hit_model.py apply 122           # 회차의 모든 경기에 예상결과·적중예상도 계산해 출력(저장은 round_log anchor 가 함)
  다른 스크립트: from hit_model import predict_row; predict_row(r) → (예상결과, 적중예상도%) 또는 (None, None)
"""
import csv, json, math, os, sys, datetime as dt, random, argparse
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
REC = os.path.join(ROOT, "전체경기기록.csv")
OUT = os.path.join(ROOT, "data", "hit_model.json")
OUTS = ("승", "무", "패")
CONF = {"높음": 2, "상": 2, "중간": 1, "중": 1, "낮음": 0, "하": 0}
MIN_N = 40
PURE_FLOOR = 0.45  # 순수 1순위가 이 미만이면 적중 예상도 상한 50%
L2 = 1.0
FEATS = ["상수", "순수1순위x10", "1-2순위차x10", "홈픽", "무픽", "보정1순위일치"]  # 2026-10-15 13:40: 확률·격차 ×10 스케일(L2 공정), 확신도 제거


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _probs(r, pre):
    v = [_num(r.get(f"{pre}_{k}")) or 0.0 for k in OUTS]
    s = sum(v)
    return [x / s for x in v] if s > 0 else None


def features(r):
    """행 → (예상결과 index, 특징 벡터) 또는 None. 보정 1순위는 전체경기기록 보정_* 열(없으면 calibrate 직접 적용)."""
    p = _probs(r, "순수")
    if not p:
        return None
    i = max(range(3), key=lambda j: p[j]); srt = sorted(p, reverse=True)
    q = _probs(r, "보정")
    if not q:
        try:
            import calibrate
            q = [v / 100 for v in calibrate.apply([v * 100 for v in p], r.get("종목", ""))]
        except Exception:
            q = p
    iq = max(range(3), key=lambda j: q[j])
    two_way = r.get("종목") != "축구"
    x = [1.0, p[i] * 10, (srt[0] - srt[1]) * 10, 1.0 if i == 0 else 0.0, 0.0 if two_way else (1.0 if i == 1 else 0.0),
         1.0 if i == iq else 0.0]
    return i, x


def _sig(z):
    return 1 / (1 + math.exp(-z)) if z > -700 else 0.0


def _fit(X, Y, l2=L2):
    import numpy as np
    from scipy.optimize import minimize
    X = np.array(X); Y = np.array(Y)
    reg = np.ones(X.shape[1]); reg[0] = 0.0
    def nll(w):
        z = np.clip(X @ w, -30, 30); s = 1 / (1 + np.exp(-z))
        loss = -np.sum(Y * np.log(s + 1e-12) + (1 - Y) * np.log(1 - s + 1e-12)) + l2 * np.sum(reg * w ** 2)
        grad = X.T @ (s - Y) + 2 * l2 * reg * w
        return float(loss), grad
    return list(minimize(nll, np.zeros(X.shape[1]), jac=True, method="L-BFGS-B").x)


def _rows(exclude=()):
    out = {}
    for r in (r for r in csv.DictReader(open(REC, encoding="utf-8-sig")) if r.get("정합성") != "C"):  # 2026-10-16 정합성 C(오류 데이터) 학습 제외
        if r.get("결과") not in OUTS or r.get("제외") or str(r.get("회차")) in exclude:
            continue
        if r.get("깊이") == "기준선":   # 모델 자동 채움 — 보정·적중예상도 학습에서 제외 (2026-10-19)
            continue
        f = features(r)
        if not f:
            continue
        i, x = f
        y = OUTS.index(r["결과"])
        out.setdefault(r["종목"], []).append((x, 1.0 if i == y else 0.0, r))
    return out


def load_model():
    try:
        return json.load(open(OUT, encoding="utf-8"))
    except Exception:
        return {}


def predict_row(r, model=None):
    """(예상결과, 적중예상도 %) — 모델 없는 종목은 보정(없으면 순수) 1순위 확률을 대체값으로."""
    model = model if model is not None else load_model()
    f = features(r)
    if not f:
        return None, None
    i, x = f
    m = model.get(r.get("종목", ""))
    if m and m.get("w"):
        hp = _sig(sum(a * b for a, b in zip(m["w"], x))) * 100
        if x[1] < PURE_FLOOR * 10:   # 순수 1순위 45% 미만: 모델이 홈 픽 계수로 과대평가(셀타 36%→64%) → 50%로 묶음 (2026-10-15, 40~45% 구간 실제 53%)
            hp = min(hp, 50.0)
        return OUTS[i], round(hp, 1)
    q = _probs(r, "보정") or _probs(r, "순수")
    return OUTS[i], round(q[i] * 100, 1)


def cmd_fit(exclude=()):
    data = _rows(exclude)
    model = load_model(); today = dt.date.today().isoformat()
    L = [f"# 적중 예상도 모델 ({today}{', ' + ','.join(exclude) + '회 제외' if exclude else ''})", "",
         "예상 결과 = 순수 1순위. 적중 예상도 = 그 1순위가 맞을 확률(로지스틱, 5-fold CV). 추천 문턱 60%, 70% 구간이 실제 70%를 넘기면 70%로.", ""]
    for sp, rows in data.items():
        n = len(rows)
        if n < MIN_N:
            model[sp] = {"n": n, "w": None, "updated": today, "note": "표본 부족 → 보정 1순위 확률 대체"}
            L.append(f"- {sp}: {n}경기, 표본 부족(40 미만) → 보정 1순위 확률을 적중 예상도로 대체"); continue
        X = [x for x, y, r in rows]; Y = [y for x, y, r in rows]
        idx = list(range(n)); random.Random(3).shuffle(idx); pred = [0.0] * n
        for f in range(5):
            te = set(idx[f::5]); tr = [k for k in range(n) if k not in te]
            w = _fit([X[k] for k in tr], [Y[k] for k in tr])
            for k in te:
                pred[k] = _sig(sum(a * b for a, b in zip(w, X[k])))
        w = _fit(X, Y)
        model[sp] = {"n": n, "w": [round(v, 4) for v in w], "feats": FEATS, "updated": today}
        L += [f"## {sp} (n={n})", "", "계수: " + ", ".join(f"{a} {b:+.2f}" for a, b in zip(FEATS, w)), "",
              "| 적중 예상도(CV) | 다리 | 실제 적중 |", "|---|---|---|"]
        for lo, hi in ((0, .5), (.5, .6), (.6, .65), (.65, .7), (.7, .75), (.75, 1.01)):
            s = [k for k in range(n) if lo <= pred[k] < hi]
            if s:
                h = sum(Y[k] for k in s); L.append(f"| {lo*100:.0f}~{min(hi,1)*100:.0f}% | {len(s)} | {int(h)} ({h/len(s)*100:.0f}%) |")
        L += ["", "| 추천 문턱 | 다리 | 적중 |", "|---|---|---|"]
        for th in (.6, .65, .7):
            s = [k for k in range(n) if pred[k] >= th]; h = sum(Y[k] for k in s)
            L.append(f"| {th*100:.0f}%+ | {len(s)} | {int(h)} ({(h/len(s)*100 if s else 0):.0f}%) |")
        s70 = [k for k in range(n) if pred[k] >= .7]; h70 = sum(Y[k] for k in s70)
        model[sp]["th70_ok"] = bool(s70) and len(s70) >= 20 and h70 / len(s70) >= .70
        L.append(f"\n70% 문턱 승격 조건(20다리+·실제 70%+): {'충족' if model[sp]['th70_ok'] else '미충족'}")
        L.append("")
    if not exclude:
        json.dump(model, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        rp = os.path.join(ROOT, "회차별분석", f"적중예상도_{today}.md")
        open(rp, "w", encoding="utf-8").write("\n".join(L) + "\n"); L.append(f"→ {OUT}\n→ {rp}")
    print("\n".join(L))
    return model


def cmd_apply(rnd, model=None):
    model = model if model is not None else load_model()
    for r in csv.DictReader(open(REC, encoding="utf-8-sig")):
        if str(r["회차"]) != str(rnd):
            continue
        o, h = predict_row(r, model)
        if o:
            print(f"{r['번호']:>5} {r['시각']} {r['홈']}-{r['원정']}: 예상 {o} · 적중예상도 {h}% (순수 {r['순수_승']}/{r['순수_무']}/{r['순수_패']}, 보정 {r.get('보정_승','')}/{r.get('보정_무','')}/{r.get('보정_패','')}) 결과 {r.get('결과','')}")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["fit", "apply"]); ap.add_argument("round", nargs="?")
    ap.add_argument("--exclude", nargs="*", default=[])
    a = ap.parse_args()
    if a.cmd == "fit":
        cmd_fit(tuple(a.exclude))
    else:
        cmd_apply(a.round)


if __name__ == "__main__":
    main()
