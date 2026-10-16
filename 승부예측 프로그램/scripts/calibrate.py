#!/usr/bin/env python3
"""순수 확률 보정 계수 (2026-10-15)
왜: 207경기에서 순수 1순위 적중은 시장과 같은데(118 vs 116) RPS는 더 나빴다(0.208 vs 0.198).
    승자는 고르면서 확률이 너무 평평하고(홈 승 -5%p, 무 +4%p 편향, 분석규칙 2026-10-10) 그게 60%+ 조건을 막는다.
    회고로 경기마다 고치는 대신, 결과로 '얼마나 펴야 하는지'를 숫자로 학습해 추천 직전에 적용한다.
모델: 3-way(축구)  logit z_i = log p_i;  z' = T·z + (b_h, b_d, 0)  → softmax.   T = 온도(1보다 크면 더 확신), b = 홈·무 편향.
      2-way(야구·농구·배구)  logit = log(p_h/p_a);  z' = T·z + b.
      파라미터는 RPS 최소화, 5-fold 교차검증 RPS가 원본보다 나을 때만 채택. 표본이 적으면 T·b 를 1·0 쪽으로 줄인다(n/(n+100)).
사용:
  python3 scripts/calibrate.py fit            # 전체경기기록.csv → data/calibration.json + 회차별분석/보정계수_YYYY-MM-DD.md
  python3 scripts/calibrate.py apply 축구 62 20 18   # 보정된 확률 출력
  다른 스크립트: from calibrate import apply; apply([62,20,18], "축구") → [승,무,패] (%)
"""
import csv, json, math, os, sys, datetime as dt, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(ROOT, "전체경기기록.csv")
OUT = os.path.join(ROOT, "data", "calibration.json")
SHRINK_N = 100
GROUPS = {"축구": 3, "야구": 2, "농구": 2, "배구": 2}


def _softmax(z):
    m = max(z); e = [math.exp(v - m) for v in z]; s = sum(e)
    return [v / s for v in e]


def _apply3(p, T, bh, bd):
    z = [math.log(max(v, 1e-4)) for v in p]
    return _softmax([T * z[0] + bh, T * z[1] + bd, T * z[2]])


def _apply2(p, T, b):
    z = math.log(max(p[0], 1e-4) / max(p[1], 1e-4))
    q = 1 / (1 + math.exp(-(T * z + b)))
    return [q, 1 - q]


def apply(probs, sport, params=None):
    """probs: [승,무,패] 또는 [승,패] (% 또는 0~1). 반환은 입력과 같은 단위."""
    if params is None:
        params = load_params()
    g = params.get(sport)
    pct = max(probs) > 1.0
    p = [v / 100 if pct else v for v in probs]
    if g is None or not g.get("adopted"):
        return list(probs)
    if GROUPS.get(sport) == 3:
        if len(p) != 3:
            return list(probs)
        q = _apply3(p, g["T"], g["bh"], g["bd"])
    else:
        q = _apply2([p[0], p[-1]], g["T"], g["b"])
        if len(p) == 3:
            q = [q[0], 0.0, q[1]]
    return [round(v * 100, 1) if pct else v for v in q]


def load_params():
    try:
        return json.load(open(OUT, encoding="utf-8"))
    except Exception:
        return {}


def _rps(p, y):
    c = 0.0; s = 0.0
    for i in range(len(p) - 1):
        c += p[i] - (1 if y == i else 0); s += c * c
    return s / (len(p) - 1)


def _rows():
    out = {k: [] for k in GROUPS}
    for r in (r for r in csv.DictReader(open(REC, encoding="utf-8-sig")) if r.get("정합성") != "C"):  # 2026-10-16 정합성 C(오류 데이터) 학습 제외
        sp = r["종목"]
        if sp not in GROUPS or not r.get("순수_승") or r.get("결과") not in ("승", "무", "패"):
            continue
        if r.get("제외"):
            continue
        try:
            p = [float(r["순수_승"] or 0), float(r["순수_무"] or 0), float(r["순수_패"] or 0)]
        except ValueError:
            continue
        s = sum(p)
        if s <= 0:
            continue
        p = [v / s for v in p]
        y = {"승": 0, "무": 1, "패": 2}[r["결과"]]
        if GROUPS[sp] == 2:
            if y == 1:
                continue
            p = [p[0], p[2]]; y = 0 if y == 0 else 1
        out[sp].append((p, y, r))
    return out


def _fit(data, k):
    """좌표 탐색(격자 → 미세). 반환 (T, bh, bd) 또는 (T, b)."""
    def loss(par):
        if k == 3:
            return sum(_rps(_apply3(p, *par), y) for p, y, _ in data) / len(data)
        return sum(_rps(_apply2(p, *par), y) for p, y, _ in data) / len(data)
    best = [1.0, 0.0, 0.0] if k == 3 else [1.0, 0.0]
    bl = loss(best)
    steps = [(0.25, 0.25), (0.1, 0.1), (0.03, 0.03)]
    for st, sb in steps:
        improved = True
        while improved:
            improved = False
            for i in range(len(best)):
                d = st if i == 0 else sb
                for sign in (1, -1):
                    cand = list(best); cand[i] += sign * d
                    if cand[0] < 0.3 or cand[0] > 4:
                        continue
                    l = loss(cand)
                    if l < bl - 1e-9:
                        best, bl, improved = cand, l, True
    return best, bl


def _cv(data, k, folds=5, seed=7):
    idx = list(range(len(data))); random.Random(seed).shuffle(idx)
    tot_raw = tot_cal = 0.0
    for f in range(folds):
        test = set(idx[f::folds])
        tr = [data[i] for i in range(len(data)) if i not in test]
        te = [data[i] for i in test]
        par, _ = _fit(tr, k)
        for p, y, _ in te:
            tot_raw += _rps(p, y)
            q = _apply3(p, *par) if k == 3 else _apply2(p, *par)
            tot_cal += _rps(q, y)
    return tot_raw / len(data), tot_cal / len(data)


def _reliability(data, k, par):
    """확률 구간별 예측 평균 vs 실제 적중률 (1순위 기준) — 원본과 보정 나란히."""
    bins = {}
    for p, y, _ in data:
        q = _apply3(p, *par) if k == 3 else _apply2(p, *par)
        for tag, pp in (("원본", p), ("보정", q)):
            i = max(range(len(pp)), key=lambda j: pp[j])
            b = min(int(pp[i] * 10) * 10, 90)
            d = bins.setdefault((tag, b), [0, 0.0, 0])
            d[0] += 1; d[1] += pp[i]; d[2] += 1 if y == i else 0
    return bins


def cmd_fit():
    rows = _rows()
    params = load_params()
    today = dt.date.today().isoformat()
    L = [f"# 순수 확률 보정 계수 ({today})", "",
         "원본 = 순수 확률 그대로. 보정 = 로짓에 온도 T 를 곱하고 홈·무 편향을 더한 뒤 정규화. 5-fold 교차검증 RPS 가 원본보다 낮을 때만 채택.",
         "표본 적으면 n/(n+100) 만큼만 적용(T→1, b→0 쪽으로 축소).", "",
         "| 종목 | n | T | 홈 편향 | 무 편향 | 원본 RPS | 보정 RPS(학습) | 원본 CV | 보정 CV | 채택 |", "|---|---|---|---|---|---|---|---|---|---|"]
    D = []  # 상세(신뢰도 표)는 종목 표 다음에
    for sp, k in GROUPS.items():
        data = rows[sp]
        n = len(data)
        if n < 20:
            L.append(f"| {sp} | {n} | - | - | - | - | - | - | - | 표본 부족 |")
            params[sp] = {"adopted": False, "n": n, "updated": today}
            continue
        par, l_fit = _fit(data, k)
        raw = sum(_rps(p, y) for p, y, _ in data) / n
        cv_raw, cv_cal = _cv(data, k)
        adopted = cv_cal < cv_raw - 0.0005
        w = n / (n + SHRINK_N)
        shr = [1 + (par[0] - 1) * w] + [v * w for v in par[1:]]
        if k == 3:
            g = {"adopted": adopted, "n": n, "T": round(shr[0], 3), "bh": round(shr[1], 3), "bd": round(shr[2], 3),
                 "fit": {"T": round(par[0], 3), "bh": round(par[1], 3), "bd": round(par[2], 3)},
                 "rps_raw": round(raw, 4), "rps_fit": round(l_fit, 4), "cv_raw": round(cv_raw, 4), "cv_cal": round(cv_cal, 4), "updated": today}
            L.append(f"| {sp} | {n} | {par[0]:.2f}→{shr[0]:.2f} | {par[1]:+.2f}→{shr[1]:+.2f} | {par[2]:+.2f}→{shr[2]:+.2f} | {raw:.4f} | {l_fit:.4f} | {cv_raw:.4f} | {cv_cal:.4f} | {'예' if adopted else '아니오'} |")
        else:
            g = {"adopted": adopted, "n": n, "T": round(shr[0], 3), "b": round(shr[1], 3),
                 "fit": {"T": round(par[0], 3), "b": round(par[1], 3)},
                 "rps_raw": round(raw, 4), "rps_fit": round(l_fit, 4), "cv_raw": round(cv_raw, 4), "cv_cal": round(cv_cal, 4), "updated": today}
            L.append(f"| {sp} | {n} | {par[0]:.2f}→{shr[0]:.2f} | {par[1]:+.2f}→{shr[1]:+.2f} | - | {raw:.4f} | {l_fit:.4f} | {cv_raw:.4f} | {cv_cal:.4f} | {'예' if adopted else '아니오'} |")
        params[sp] = g
        if adopted:
            D += ["", f"### {sp} 신뢰도 (1순위 확률 구간별: 예측 평균 → 실제 적중)", "", "| 구간 | 원본 n | 원본 예측 | 원본 실제 | 보정 n | 보정 예측 | 보정 실제 |", "|---|---|---|---|---|---|---|"]
            rel = _reliability(data, k, shr)
            for b in range(30, 100, 10):
                o = rel.get(("원본", b)); c = rel.get(("보정", b))
                f = lambda d: f"{d[0]} | {d[1]/d[0]*100:.0f}% | {d[2]/d[0]*100:.0f}%" if d else "0 | - | -"
                if o or c:
                    D.append(f"| {b}~{b+9}% | {f(o)} | {f(c)} |")
            # 60%+ 통과 경기 수 변화
            th_raw = sum(1 for p, y, _ in data if max(p) >= 0.6); hit_raw = sum(1 for p, y, _ in data if max(p) >= 0.6 and max(range(len(p)), key=lambda j: p[j]) == y)
            cal = [(_apply3(p, *shr) if k == 3 else _apply2(p, *shr), y) for p, y, _ in data]
            th_cal = sum(1 for q, y in cal if max(q) >= 0.6); hit_cal = sum(1 for q, y in cal if max(q) >= 0.6 and max(range(len(q)), key=lambda j: q[j]) == y)
            D += ["", f"60%+ 통과: 원본 {th_raw}경기 적중 {hit_raw} ({hit_raw/th_raw*100 if th_raw else 0:.0f}%) → 보정 {th_cal}경기 적중 {hit_cal} ({hit_cal/th_cal*100 if th_cal else 0:.0f}%)"]
    json.dump(params, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    L += D
    L += ["", "적용: pick_table.py --own 에 넣은 내 확률은 자동으로 이 계수로 보정된 값이 표·추천기록에 쓰인다(원본은 괄호). block_report.py 는 '보정' 열을 보여 준다.",
          "재학습: 회차 결과 채점 후 `python3 scripts/calibrate.py fit`. 계수가 CV에서 지면 자동으로 미채택(원본 그대로)."]
    rp = os.path.join(ROOT, "회차별분석", f"보정계수_{today}.md")
    open(rp, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L)); print(f"\n→ {OUT}\n→ {rp}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] == "fit":
        cmd_fit()
    elif sys.argv[1] == "apply":
        sp = sys.argv[2]; p = [float(x) for x in sys.argv[3:]]
        print(apply(p, sp))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
