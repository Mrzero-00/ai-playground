#!/usr/bin/env python3
"""방향 적중률 실험대 — '분석 방법을 어떻게 바꾸면 적중률이 오르는가'에 숫자로 답한다.

사용자 지시 2026-10-26: 목표는 단일 경기 방향 예측 100%. 시장은 목표가 아니라 눈금이다.
그래서 여기서는 **방향 적중률 하나로만** 방법들을 줄 세운다(회수율·Brier 는 참고로만 찍는다).

검증은 시간 순이다. 과거로 학습하고 미래를 맞힌다. 섞으면 미래를 보고 맞히는 셈이라 금지.
데이터: football-data.co.uk 5대 리그 7시즌(data/<Div>_<시즌>.csv) — 결과·배당·슈팅·심판이 있다.

겨루는 방법
  1 홈 고정         아무 분석도 안 한 바닥값
  2 Elo            승점 기반 레이팅, 레이팅 차 → 3지선다(문턱은 학습 구간에서 적합)
  3 득점 레이팅      팀별 공격·수비력을 온라인으로 갱신 → 포아송 점수 분포 → 1X2
  4 득점+저득점보정   3 에 저득점 구간 보정(무가 과소 추정되는 것을 교정)
  5 시장            배당에서 뽑은 확률 (눈금)
  6 득점+시장 혼합    3 과 5 를 섞는다 — 내 모델이 시장에 정보를 더하는지 보는 핵심 비교

    python3 scripts/direction_lab.py run
    python3 scripts/direction_lab.py run --holdout 0.3
"""
import argparse, collections, csv, datetime as dt, glob, math, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MAXG = 8          # 포아송 점수 격자


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def load():
    rows = []
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "[A-Z]*_[0-9][0-9][0-9][0-9].csv"))):
        for r in csv.DictReader(open(f, encoding="utf-8-sig", errors="replace")):
            hg, ag = _f(r.get("FTHG")), _f(r.get("FTAG"))
            if hg is None or ag is None:
                continue
            d = None
            for fmt in ("%d/%m/%Y", "%d/%m/%y"):
                try:
                    d = dt.datetime.strptime((r.get("Date") or "").strip(), fmt).date(); break
                except ValueError:
                    pass
            if not d:
                continue
            oh, od, oa = _f(r.get("B365H")), _f(r.get("B365D")), _f(r.get("B365A"))
            mk = None
            if oh and od and oa and min(oh, od, oa) > 1:
                s = 1 / oh + 1 / od + 1 / oa
                mk = ((1 / oh) / s, (1 / od) / s, (1 / oa) / s)
            rows.append({"d": d, "lg": r.get("Div", ""), "h": r.get("HomeTeam", ""), "a": r.get("AwayTeam", ""),
                         "hg": int(hg), "ag": int(ag), "mk": mk,
                         "res": "H" if hg > ag else ("D" if hg == ag else "A")})
    rows.sort(key=lambda r: r["d"])
    return rows


def poisson_probs(lh, la, rho=0.0):
    """포아송 점수 분포 → (홈승, 무, 원정승). rho 는 0:0·1:1 같은 저득점 칸 보정."""
    ph = [math.exp(-lh) * lh ** k / math.factorial(k) for k in range(MAXG)]
    pa = [math.exp(-la) * la ** k / math.factorial(k) for k in range(MAXG)]
    H = D = A = 0.0
    for i in range(MAXG):
        for j in range(MAXG):
            p = ph[i] * pa[j]
            if rho:
                if i == 0 and j == 0: p *= 1 - lh * la * rho
                elif i == 0 and j == 1: p *= 1 + lh * rho
                elif i == 1 and j == 0: p *= 1 + la * rho
                elif i == 1 and j == 1: p *= 1 - rho
            if i > j: H += p
            elif i == j: D += p
            else: A += p
    t = H + D + A
    return (H / t, D / t, A / t) if t else (1 / 3, 1 / 3, 1 / 3)


def run_models(rows, holdout):
    cut = rows[int(len(rows) * (1 - holdout))]["d"]
    # --- 상태
    elo = collections.defaultdict(lambda: 1500.0)
    att = collections.defaultdict(float)      # 공격력
    dfn = collections.defaultdict(float)      # 수비력
    mu = math.log(1.35)                       # 리그 평균 득점 로그
    gamma = 0.25                              # 홈 이점
    LR = 0.045
    preds = collections.defaultdict(list)     # 이름 → [(확률3, 실제)]
    edi = []                                  # Elo 레이팅차·실제 (문턱 적합용)

    for r in rows:
        h, a = r["h"], r["a"]
        lh = math.exp(mu + att[h] - dfn[a] + gamma)
        la = math.exp(mu + att[a] - dfn[h])
        lh, la = min(max(lh, .15), 6), min(max(la, .15), 6)
        test = r["d"] >= cut
        if test:
            preds["1 홈 고정"].append(((1, 0, 0), r["res"]))
            dr = elo[h] + 70 - elo[a]
            edi.append((dr, r["res"], True))
            p3 = poisson_probs(lh, la)
            p4 = poisson_probs(lh, la, rho=-0.07)
            preds["3 득점 레이팅"].append((p3, r["res"]))
            preds["4 득점+저득점보정"].append((p4, r["res"]))
            if r["mk"]:
                preds["5 시장"].append((r["mk"], r["res"]))
                bl = tuple((x + y) / 2 for x, y in zip(p4, r["mk"]))
                preds["6 득점+시장 혼합"].append((bl, r["res"]))
                b3 = tuple(0.3 * x + 0.7 * y for x, y in zip(p4, r["mk"]))
                preds["7 시장70+모델30"].append((b3, r["res"]))
        else:
            edi.append((elo[h] + 70 - elo[a], r["res"], False))
        # --- 갱신 (학습·시험 모두 과거 정보만 쓰므로 누수 아님)
        ex = 1 / (1 + 10 ** (-(elo[h] + 70 - elo[a]) / 400))
        sc = 1.0 if r["res"] == "H" else (0.5 if r["res"] == "D" else 0.0)
        k = 20 * (1 + 0.5 * min(abs(r["hg"] - r["ag"]), 3))
        elo[h] += k * (sc - ex); elo[a] -= k * (sc - ex)
        att[h] += LR * (r["hg"] - lh); dfn[a] -= LR * (r["hg"] - lh)
        att[a] += LR * (r["ag"] - la); dfn[h] -= LR * (r["ag"] - la)
        for t in (h, a):
            att[t] = min(max(att[t], -1.2), 1.2); dfn[t] = min(max(dfn[t], -1.2), 1.2)

    # Elo → 3지선다: 학습 구간에서 무 구간 폭을 적합
    tr = [(d, res) for d, res, is_te in edi if not is_te]
    best, bw = None, 0
    for w in range(0, 220, 10):
        ok = sum(1 for d, res in tr
                 if (res == "H" and d > w) or (res == "A" and d < -w) or (res == "D" and abs(d) <= w))
        if best is None or ok > best:
            best, bw = ok, w
    for d, res, is_te in edi:
        if is_te:
            p = (1, 0, 0) if d > bw else ((0, 0, 1) if d < -bw else (0, 1, 0))
            preds["2 Elo"].append((p, res))
    return preds, cut, bw


def acc(xs):
    if not xs:
        return None, 0
    lab = ["H", "D", "A"]
    ok = sum(1 for p, res in xs if lab[max(range(3), key=lambda i: p[i])] == res)
    return ok / len(xs) * 100, len(xs)


def cmd_run(a):
    rows = load()
    if len(rows) < 2000:
        print(f"과거 경기 부족({len(rows)})", file=sys.stderr); return 1
    preds, cut, bw = run_models(rows, a.holdout)
    print(f"과거 {len(rows)}경기 · {cut} 부터를 시험 구간으로(앞은 학습) · Elo 무 구간 ±{bw}\n")
    common = set(range(len(preds["5 시장"]))) if preds.get("5 시장") else None
    print(f"{'방법':<20} {'경기':>6} {'방향 적중률':>10}")
    print("-" * 40)
    order = ["1 홈 고정", "2 Elo", "3 득점 레이팅", "4 득점+저득점보정", "5 시장", "6 득점+시장 혼합", "7 시장70+모델30"]
    base = None
    for k in order:
        if k not in preds:
            continue
        r, n = acc(preds[k])
        mark = ""
        if k == "5 시장":
            base = r
        elif base is not None:
            mark = f"   시장 대비 {r-base:+.1f}p"
        print(f"{k:<20} {n:>6} {r:>9.1f}%{mark}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("run"); p.add_argument("--holdout", type=float, default=0.25); p.set_defaults(f=cmd_run)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
