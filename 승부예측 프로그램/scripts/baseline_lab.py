#!/usr/bin/env python3
"""축구 기준선 실험실 — 기준선 모델의 변형을 **같은 경기에서 시간 순으로** 재서 방향 적중률을 비교한다.

왜 (2026-11-11): 방향 적중률은 심층 조사가 아니라 기준선 모델이 정한다(실제 기준선 50.4% vs 시장 54.9%,
분석은 기준선 대비 +1.0p). 그러니 기준선을 고쳐야 하는데, 우리 기록 748경기로는 2SE 가 ±3.6p 라
1~2p 짜리 개선을 못 가른다. soccer_baseline 이 쓰는 리그 결과 캐시 전체(26개 리그, 약 3시즌)로 잰다.

방법: 리그마다 경기를 시간 순으로 훑는다. 레이팅은 경기 전 값만 쓰고, 레이팅→확률 회귀는
REFIT 경기마다 **그때까지의 경기만으로** 다시 맞춘다. 예열(BURN_IN_DAYS) 뒤 경기만 채점한다.

    python3 scripts/baseline_lab.py                 # 등록된 변형 전부 비교
    python3 scripts/baseline_lab.py --leagues eng.1,esp.1
    python3 scripts/baseline_lab.py --fd            # 5대 리그 7시즌: 골 vs 골+슈팅, 마감 시장 눈금
    python3 scripts/baseline_lab.py --select        # 선별 신호가 시장 정배의 잔차를 가르는가

측정 결과 (2026-11-11)
  · 결과만 쓰는 레이팅은 천장이다. 26개 리그 캐시 10,102경기에서 λ·γ·골차 상한·Elo·pi+Elo 평균이
    전부 현행 대비 ±0.5p 안(2SE 0.2~0.5p)이다. 상수를 더 맞출 곳이 없다.
  · 슈팅을 섞으면 조금 오른다. 5대 리그 11,142경기: 골만 52.58% → 골50+슈팅50 52.98%(+0.40p, 2SE 0.38,
    갈린 437경기 241승 196패) · RPS 0.2010 → 0.1997. 마감 시장은 53.99%. 남은 격차 1.0p.
    슈팅만 쓰면 오히려 −0.45p. → 같은 날 ESPN 일정 응답에서 슈팅을 받아 기준선에 넣었다
    (soccer_baseline.SHOT_W = 0.5). 리그 결과 캐시 10,102경기에서도 +0.27p · RPS 0.2115 → 0.2103 으로 재현됐고,
    학습률 λ.035 는 캐시에서 +0.28p 였지만 5대 리그 자료에서 −0.04p 라 채택하지 않았다.
    우리 기록 748경기: 기준선 50.4% → 50.9%.
  · 선별 신호는 잔차를 가르지 못한다. 시장 60%+ 정배 3,071경기에서 모델 무<24% 는 적중 73.7% vs
    무≥24% 67.8% 지만 시장이 말한 확률이 71.6% vs 64.7% 로 그만큼 다르다(잔차 +2.1p vs +3.1p).
    즉 '무 확률이 낮은 정배'는 그냥 더 센 정배이고 배당도 그만큼 낮다. 모델−시장 격차도 U 자로 들쭉날쭉하다.
  · 정배 자체는 시장이 말한 것보다 조금 더 맞는다. 60~70% 구간 +3.5p(z=+3.01, n=1,691),
    70%+ +0.9p, 50~60% +0.3p. 베트맨 실측(경기결과 정배 회수 96% > 기대값 0.90)과 같은 방향이다.
"""
import argparse, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import soccer_baseline as sb

REFIT = 60


def walk(games, rate, burn=sb.BURN_IN_DAYS, min_fit=120):
    """rate(games) -> 경기마다 경기 전 pred 리스트(없으면 None). 반환: [(g, p(H,D,A))]"""
    preds = rate(games)
    out, par, since = [], None, REFIT
    start = games[0]["t"]
    hist = []
    for g, pr in zip(games, preds):
        if pr is None:
            continue
        g2 = dict(g); g2["pred"] = pr
        if (g["t"] - start).days >= burn and len(hist) >= min_fit and not g.get("neutral"):
            if par is None or since >= REFIT:
                par = sb.fit_league(hist); since = 0
            if par:
                o = sb.predict(par, pr)
                out.append((g, (o["승"], o["무"], o["패"])))
            since += 1
        hist.append(g2)
    return out


def pi_rater(lam=None, gam=None, c=None, cap=None, shots=False):
    """shots=False 면 골만으로 굴린다(2026-11-11 이전 기준선). True 면 soccer_baseline 의 현행 혼합."""
    def rate(games):
        L0, G0, C0 = sb.LAMBDA, sb.GAMMA, sb.C_PSI
        W0 = sb.SHOT_W
        if not shots:
            sb.SHOT_W = 1.0
        if lam is not None: sb.LAMBDA = lam
        if gam is not None: sb.GAMMA = gam
        if c is not None: sb.C_PSI = c
        try:
            gs = [dict(g) for g in games]
            if cap:
                for g in gs:
                    d = g["hg"] - g["ag"]
                    if abs(d) > cap:
                        s = 1 if d > 0 else -1
                        g["hg"], g["ag"] = (cap, 0) if s > 0 else (0, cap)
            sb.run_pi(gs, None, None, True)
            return [g.get("pred") for g in gs]
        finally:
            sb.LAMBDA, sb.GAMMA, sb.C_PSI = L0, G0, C0
            sb.SHOT_W = W0
    return rate


def elo_rater(k=20.0, home=60.0, gmul=0.5, scale=400.0):
    """골차 가중 Elo. pred 는 레이팅 차(홈 이점 포함)를 100 으로 나눈 값 — 회귀가 골 단위로 바꾼다."""
    def rate(games):
        r, out = {}, []
        for g in games:
            h, a = g["home"], g["away"]
            rh, ra = r.get(h, 1500.0), r.get(a, 1500.0)
            out.append((rh - ra) / 100.0)
            ex = 1 / (1 + 10 ** (-(rh + home - ra) / scale))
            d = g["hg"] - g["ag"]
            sc = 1.0 if d > 0 else (0.5 if d == 0 else 0.0)
            kk = k * (1 + gmul * min(abs(d), 3))
            r[h] = rh + kk * (sc - ex); r[a] = ra - kk * (sc - ex)
        return out
    return rate


def blend(*raters, w=None):
    """여러 레이팅의 pred 를 리그 안에서 표준화해 가중 평균(표준화는 그 시점까지의 값으로만)."""
    def rate(games):
        cols = [r(games) for r in raters]
        ws = w or [1.0] * len(cols)
        out = []
        stats = [[0, 0.0, 0.0] for _ in cols]
        for i in range(len(games)):
            z, ok = 0.0, True
            for c, st, wi in zip(cols, stats, ws):
                v = c[i]
                if v is None:
                    ok = False; continue
                n, s1, s2 = st
                sd = math.sqrt(max(s2 / n - (s1 / n) ** 2, 1e-9)) if n > 30 else None
                z += wi * ((v - s1 / n) / sd if sd else 0.0)
                st[0] += 1; st[1] += v; st[2] += v * v
            out.append(z / sum(ws) if ok else None)
        return out
    return rate


def load_fd():
    """football-data 5대 리그 7시즌 — 슈팅·유효슈팅과 마감 배당이 같이 있다. {리그: games}"""
    import csv, glob, datetime as dt, collections
    out = collections.defaultdict(list)
    for f in sorted(glob.glob(os.path.join(sb.ROOT, "data", "[A-Z]*_[0-9][0-9][0-9][0-9].csv"))):
        for r in csv.DictReader(open(f, encoding="utf-8-sig", errors="replace")):
            try:
                hg, ag = int(float(r["FTHG"])), int(float(r["FTAG"]))
            except (KeyError, ValueError, TypeError):
                continue
            t = None
            for fmt in ("%d/%m/%Y", "%d/%m/%y"):
                try:
                    t = dt.datetime.strptime((r.get("Date") or "").strip(), fmt).replace(tzinfo=dt.timezone.utc); break
                except ValueError:
                    pass
            if not t:
                continue
            def num(k):
                try:
                    return float(r.get(k) or "")
                except ValueError:
                    return None
            g = {"t": t, "home": r["HomeTeam"].strip(), "away": r["AwayTeam"].strip(), "hg": hg, "ag": ag,
                 "hs": num("HS"), "as": num("AS"), "hst": num("HST"), "ast": num("AST"), "mk": None}
            for a_, b_, c_ in (("PSCH", "PSCD", "PSCA"), ("PSH", "PSD", "PSA"), ("B365H", "B365D", "B365A")):
                o = [num(a_), num(b_), num(c_)]
                if all(x and x > 1 for x in o):
                    inv = [1 / x for x in o]; g["mk"] = tuple(x / sum(inv) for x in inv); break
            out[r.get("Div", "?")].append(g)
    for k in out:
        out[k].sort(key=lambda g: g["t"])
    return dict(out)


def shot_rater(w=0.5, k_on=0.30, k_off=0.03, lam=None):
    """골 대신 '골과 슈팅 기반 기대득점 대용치의 혼합'으로 pi 를 굴린다.
    대용치 = k_on·유효슈팅 + k_off·빗나간 슈팅. w = 골의 비중(1 이면 현행과 같다)."""
    inner = pi_rater(lam=lam)

    def rate(games):
        gs = []
        for g in games:
            g2 = dict(g)
            if None not in (g.get("hs"), g.get("as"), g.get("hst"), g.get("ast")):
                ph = k_on * g["hst"] + k_off * max(g["hs"] - g["hst"], 0)
                pa = k_on * g["ast"] + k_off * max(g["as"] - g["ast"], 0)
                g2["hg"] = w * g["hg"] + (1 - w) * ph
                g2["ag"] = w * g["ag"] + (1 - w) * pa
            gs.append(g2)
        return inner(gs)
    return rate


FD_VARIANTS = {
    "골만 (옛 기준선)": pi_rater(),
    "골 70 + 슈팅 30": shot_rater(0.7),
    "골 50 + 슈팅 50": shot_rater(0.5),
    "골 30 + 슈팅 70": shot_rater(0.3),
    "슈팅만": shot_rater(0.0),
    "골 30 + 슈팅 70, λ.07": shot_rater(0.3, lam=0.07),
    "골 30 + 슈팅 70, λ.10": shot_rater(0.3, lam=0.10),
}


VARIANTS = {
    "골만 (옛 기준선)": pi_rater(),
    "현행 (골50+슈팅50)": pi_rater(shots=True),
    "pi λ.035": pi_rater(lam=0.035),
    "pi λ.07": pi_rater(lam=0.07),
    "pi γ.7": pi_rater(gam=0.7),
    "pi 골차 상한3": pi_rater(cap=3),
    "elo 골차가중": elo_rater(),
    "elo k30": elo_rater(k=30.0),
    "pi+elo 평균": blend(pi_rater(), elo_rater()),
    "골 70 + 슈팅 30": shot_rater(0.7),
    "골 50 + 슈팅 50": shot_rater(0.5),
    "골 30 + 슈팅 70": shot_rater(0.3),
    "골 50 + 슈팅 50, λ.07": shot_rater(0.5, lam=0.07),
}


def cmd_select():
    """선별 신호 검정 — 시장 정배 중에서 모델이 '더 잘 맞을 경기'를 가려내는가.
    적중률이 아니라 **잔차(실제 적중 − 시장이 말한 확률)** 로 본다. 무 확률이 낮은 경기는 원래
    시장 확률이 높은 경기라 적중률은 당연히 높다 — 선별이 값을 하려면 잔차가 달라야 한다."""
    rows = []
    for c, gs in load_fd().items():
        rows += [(g, p) for g, p in walk(gs, pi_rater()) if g.get("mk")]

    def rep(lab, b):
        n = len(b)
        if n < 30:
            print(f"{lab:<30} n={n}"); return
        hit = sum(1 for g, p, f in b if sb.outcome(g) == f) / n
        mp = sum(g["mk"][f] for g, p, f in b) / n
        se = math.sqrt(sum(g["mk"][f] * (1 - g["mk"][f]) for g, p, f in b)) / n
        print(f"{lab:<30}{n:>6}{hit*100:>8.1f}%{mp*100:>9.1f}%{100*(hit-mp):>+8.1f}p{(hit-mp)/se:>+7.2f}")
    F0 = [(g, p, max(range(3), key=lambda i: g["mk"][i])) for g, p in rows]
    print(f"5대 리그 7시즌 {len(rows)}경기 · 마감 배당(비례 마진 제거) · 모델 = 현행 pi 기준선\n")
    for lo, hi in ((.60, 1.01), (.60, .70), (.70, 1.01), (.50, .60)):
        F = [x for x in F0 if lo <= x[0]["mk"][x[2]] < hi]
        print(f"== 시장 1순위 {lo*100:.0f}~{min(hi,1)*100:.0f}%")
        print(f"{'구분':<30}{'n':>6}{'적중':>9}{'시장 말':>9}{'잔차':>9}{'z':>7}")
        rep("전체", F)
        rep("  모델 무 < 24%", [x for x in F if x[1][1] < .24])
        rep("  모델 무 >= 24%", [x for x in F if x[1][1] >= .24])
        for a_, b_ in ((-1, -.05), (-.05, .05), (.05, 1)):
            rep(f"  모델−시장 {a_*100:+.0f}~{b_*100:+.0f}p", [x for x in F if a_ <= x[1][x[2]] - x[0]["mk"][x[2]] < b_])
        rep("  홈 정배", [x for x in F if x[2] == 0]); rep("  원정 정배", [x for x in F if x[2] == 2])
        print()
    return 0


def score(rows):
    n = len(rows)
    acc = sum(1 for g, p in rows if max(range(3), key=lambda i: p[i]) == sb.outcome(g)) / n
    rps = sum(sb.rps(p, sb.outcome(g)) for g, p in rows) / n
    return n, acc, rps


def main(variants=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", default="")
    ap.add_argument("--by-league", action="store_true")
    ap.add_argument("--fd", action="store_true", help="football-data 5대 리그 7시즌(슈팅·마감 배당 포함)으로 잰다")
    ap.add_argument("--select", action="store_true", help="선별 신호(무 확률·모델−시장 격차)가 시장 정배의 잔차를 가르는지")
    a = ap.parse_args()
    if a.select:
        return cmd_select()
    if a.fd:
        variants = variants or FD_VARIANTS
        data = load_fd()
    else:
        variants = variants or VARIANTS
        codes = [c for c in (a.leagues.split(",") if a.leagues else sb.LEAGUES) if c and not c.startswith("uefa")]
        data = {}
        for c in codes:
            try:
                lg = sb.League(c)
            except SystemExit:
                continue
            if len(lg.games) >= 300:
                data[c] = lg.games
    res = {name: {c: walk(gs, r) for c, gs in data.items()} for name, r in variants.items()}
    base_name = next(iter(variants))
    print(f"리그 {len(data)}개 · 시간 순 채점 (레이팅은 경기 전 값, 회귀는 {REFIT}경기마다 과거로만 재적합)\n")
    print(f"{'변형':<22}{'경기':>6}{'적중률':>8}{'RPS':>8}{'현행 대비':>10}{'2SE':>6}{'갈린 경기':>9}{'갈림 승패':>10}")
    bk = {(c, id(g)): p for c in data for g, p in res[base_name][c]}
    for name in variants:
        rows = [(c, g, p) for c in data for g, p in res[name][c] if (c, id(g)) in bk]
        n, acc, rps = score([(g, p) for _, g, p in rows])
        d, win, lose = [], 0, 0
        for c, g, p in rows:
            y = sb.outcome(g); pb = bk[(c, id(g))]
            t1, t0 = max(range(3), key=lambda i: p[i]), max(range(3), key=lambda i: pb[i])
            d.append((t1 == y) - (t0 == y))
            if t1 != t0:
                win += t1 == y; lose += t0 == y
        mu = sum(d) / len(d)
        se = math.sqrt(sum((x - mu) ** 2 for x in d) / (len(d) - 1) / len(d))
        print(f"{name:<22}{n:>6}{acc*100:>7.2f}%{rps:>8.4f}{mu*100:>+9.2f}p{2*se*100:>6.2f}"
              f"{sum(1 for x in d if x) + 0:>9}{win:>6}-{lose}")
    mk = [(g, g["mk"]) for c in data for g, _ in res[base_name][c] if g.get("mk")]
    if mk:
        n, acc, rps = score(mk)
        print(f"{'(눈금) 마감 시장':<22}{n:>6}{acc*100:>7.2f}%{rps:>8.4f}")
    if a.by_league:
        print(f"\n리그별 — {base_name}")
        for c in data:
            if res[base_name][c]:
                n, acc, rps = score(res[base_name][c])
                print(f"  {c:<8}{n:>5}{acc*100:>7.1f}%{rps:>8.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
