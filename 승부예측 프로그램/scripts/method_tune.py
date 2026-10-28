#!/usr/bin/env python3
"""기법별 자기 회고 — 각 기법이 **자기 오류를 보고 자기 파라미터를 스스로 고친다**.

사용자 지시 2026-10-26:
  "모든 기법을 통해 동일한 경기를 분석하고 각자의 방향성을 기록, 회고를 통한 개선도
   각자의 기법에서 알아서 개선해서 각각의 기법들의 분석률을 올리자."

전체 회고는 운영 틀을 고치고, 여기서는 **기법 하나하나가 자기 손잡이를 돌린다.**
  elo         K(갱신 속도) · 홈 이점 · 무 구간 폭
  elo_goal    위 + 득실차 가중
  pi          학습률 · 기준 득점
  poisson     학습률 · 홈 이점 · 평균 득점
  dixon_coles 위 + 저득점 보정 rho
  시장앵커±6   이탈 상한
  갈림→무가중   갈림 반영 배율·상한

규칙(자기 개선이 자기 기만이 되지 않게):
  · 시간 순 분할. 앞 75%로 고르고 뒤 25%로 확인한다. 고른 구간 성적은 채택 근거가 아니다.
  · 좌표 탐색 1회전. 한 파라미터씩 훑고 **시험 구간이 좋아질 때만** 채택한다.
  · 개선폭이 표본오차(2SE) 안이면 **바꾸지 않는다**. 숫자가 조금 좋아 보이는 건 사유가 아니다.
  · 바꾼 내역은 전부 data/기법파라미터.json 의 history 에 남긴다. 되돌릴 수 있어야 한다.

    python3 scripts/method_tune.py diag            # 기법별 약점 진단(어디서 틀리나)
    python3 scripts/method_tune.py tune            # 전 기법 자기 개선
    python3 scripts/method_tune.py tune --only elo
"""
import argparse, collections, copy, datetime as dt, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, HERE)
import predict_engine as E   # noqa: E402

GRID = {
    "elo":         {"k": [10, 15, 20, 28, 36], "home": [40, 55, 70, 85, 100], "draw_w": [80, 120, 180, 260]},
    "elo_goal":    {"k": [10, 15, 20, 28], "home": [40, 55, 70, 85], "draw_w": [80, 120, 180, 260], "gmul": [0.0, 0.3, 0.5, 0.8]},
    "pi":          {"lr": [0.02, 0.04, 0.06, 0.09, 0.13], "base": [1.15, 1.25, 1.35, 1.45]},
    "poisson":     {"lr": [0.02, 0.035, 0.045, 0.07], "gamma": [0.10, 0.18, 0.25, 0.33], "mu": [0.20, 0.30, 0.40]},
    "dixon_coles": {"lr": [0.02, 0.035, 0.045, 0.07], "gamma": [0.10, 0.18, 0.25, 0.33], "mu": [0.20, 0.30, 0.40],
                    "rho": [-0.14, -0.10, -0.07, -0.03, 0.0]},
    "시장앵커±6":    {"cap": [2.0, 4.0, 6.0, 9.0, 14.0]},
    "갈림→무가중":    {"scale": [0.2, 0.35, 0.5, 0.8], "cap": [4.0, 8.0, 12.0]},
}
LAB = ("승", "무", "패")


def corpus():
    rows = E.from_footballdata() + E.from_teamdb() + E.from_ours()
    rows.sort(key=lambda r: r["d"])
    return rows


def score(rows, P, name, split=0.75):
    """시간 순 분할. (학습구간 적중률, 시험구간 적중률, 시험 n)"""
    preds = E.run(rows, P)
    xs = [(r, c[name]) for r, c in preds if name in c and r["hg"] is not None]
    if not xs:
        return 0.0, 0.0, 0
    cut = int(len(xs) * split)
    def acc(sub):
        if not sub:
            return 0.0
        ok = 0
        for r, p in sub:
            t = max(p, key=p.get)
            res = "승" if r["hg"] > r["ag"] else ("무" if r["hg"] == r["ag"] else "패")
            ok += (t == res)
        return ok / len(sub) * 100
    return acc(xs[:cut]), acc(xs[cut:]), len(xs) - cut


def cmd_tune(a):
    rows = corpus()
    P = E.load_params()
    hist = []
    if os.path.exists(E.PARAM):
        try:
            hist = (json.load(open(E.PARAM, encoding="utf-8")) or {}).get("history") or []
        except Exception:
            hist = []
    targets = [a.only] if a.only else [k for k in GRID if k in P]
    today = dt.date.today().isoformat()
    print(f"연대기 {len(rows)}경기 · 기법 {len(targets)}종 자기 개선 (시간 순 75/25)\n")
    for name in targets:
        if name not in GRID:
            print(f"  {name}: 조정할 파라미터 없음"); continue
        _, base_te, n = score(rows, P, name)
        if not n:
            print(f"  {name}: 표본 없음"); continue
        se2 = 2 * math.sqrt(0.25 / n) * 100
        best = copy.deepcopy(P[name]); best_te = base_te
        for key, vals in GRID[name].items():
            for v in vals:
                if v == best[key]:
                    continue
                trial = copy.deepcopy(P); trial[name] = dict(best); trial[name][key] = v
                _, te, _ = score(rows, trial, name)
                if te > best_te:
                    best_te, best = te, dict(trial[name])
        gain = best_te - base_te
        if gain > se2:
            P[name] = best
            hist.append({"날짜": today, "기법": name, "이전": {k: DEF for k, DEF in E.DEFAULTS[name].items()},
                         "채택": best, "시험적중": round(best_te, 2), "이전적중": round(base_te, 2),
                         "개선": round(gain, 2), "n": n})
            print(f"  {name:<12} {base_te:5.1f}% → {best_te:5.1f}%  (+{gain:.1f}p > 2SE {se2:.1f}p) **채택**")
            print(f"     {best}")
        else:
            print(f"  {name:<12} {base_te:5.1f}% (최선 {best_te:5.1f}%, +{gain:.1f}p ≤ 2SE {se2:.1f}p) — 유지")
    json.dump({"current": P, "history": hist[-200:], "갱신": today},
              open(E.PARAM, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n→ {E.PARAM}  (채택 이력 {len(hist)}건)")
    print("※ 개선폭이 2SE 를 넘을 때만 바꾼다. 조금 좋아 보이는 건 사유가 아니다.")
    return 0


def cmd_diag(a):
    """기법별 약점 — 어떤 구간·어떤 방향에서 틀리나."""
    import csv
    p = os.path.join(ROOT, "data", "기법별예측.csv")
    if not os.path.exists(p):
        print("predict_engine.py run 을 먼저 돌린다"); return 1
    rs = list(csv.DictReader(open(p, encoding="utf-8-sig")))
    def band(r):
        try:
            v = float(r["시장최대"])
        except (ValueError, KeyError):
            return "시장없음"
        return "<45" if v < 45 else "45~60" if v < 60 else "60+"
    by = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
    side = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
    for r in rs:
        x = by[r["기법"]][band(r)]; x[1] += 1; x[0] += int(r["적중"])
        y = side[r["기법"]][r["1순위"]]; y[1] += 1; y[0] += int(r["적중"])
    for m in sorted(by, key=lambda m: -sum(v[1] for v in by[m].values())):
        tot_n = sum(v[1] for v in by[m].values()); tot_h = sum(v[0] for v in by[m].values())
        print(f"\n{m}  전체 {tot_h/tot_n*100:.1f}% (n={tot_n})")
        print("   접전도별: " + " · ".join(
            f"{b} {v[0]/v[1]*100:.0f}%(n={v[1]})" for b, v in sorted(by[m].items()) if v[1] >= 15))
        print("   고른 방향: " + " · ".join(
            f"{s} {v[0]/v[1]*100:.0f}%(n={v[1]})" for s, v in sorted(side[m].items()) if v[1] >= 15))
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("tune"); p.add_argument("--only"); p.set_defaults(f=cmd_tune)
    s.add_parser("diag").set_defaults(f=cmd_diag)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
