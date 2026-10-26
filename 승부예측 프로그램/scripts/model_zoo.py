#!/usr/bin/env python3
"""분석 기법 리더보드 — 매주 하나씩 늘리고, 전부의 성적을 계속 기록한다.

사용자 제안 2026-10-26:
  "주마다 완전 다른 걸로 변경하지 말고 신규 분석툴을 하나씩 늘려가자.
   Elo 해보고, 다음 주엔 Elo+포아송, 그다음엔 거기에 하나 더. 각각의 결과를 계속 기록하는 거지."

왜 이게 맞나 — 틀을 매주 갈아엎으면 직전 것이 왜 나빴는지 증거가 안 쌓이고,
좋아졌는지도 표본이 모자라 판단이 안 된다. 기법을 **지우지 않고 병렬로 돌려** 같은 경기에서
겨루게 하면, 주차가 지날수록 비교 근거가 누적되고 '방향이 맞나'가 저절로 답해진다.

두 갈래로 잰다. 섞으면 비교가 깨진다.
  A 대규모 검증 (football-data 12,459경기): 과거 결과만으로 돌아가는 기법들. 신규 기법은 **여기서 먼저** 통과해야 한다.
  B 실전 기록 (전체경기기록, 분석 경기): 시장·우리 순수/보정·검증요인. 실제 운영 성적.
  A 에서 챔피언을 이긴 기법만 B 로 승격한다.

규칙(과적합을 막는다):
  · 시간 순 분할만 쓴다. 섞으면 미래를 보고 맞히는 셈이다.
  · 모든 기법을 **같은 경기**에서 잰다. 표본이 다르면 숫자를 비교하지 않는다.
  · 기법을 추가해도 기존 것을 지우지 않는다. 성적이 나빠도 기록으로 남긴다.
  · 챔피언 교체는 차이가 표본오차(±2SE)를 넘을 때만 한다. 한 주 반짝은 교체 사유가 아니다.

    python3 scripts/model_zoo.py eval      # 전 기법 평가 → data/모델성적.csv 에 누적
    python3 scripts/model_zoo.py board     # 리더보드(누적 + 이번 회)
    python3 scripts/model_zoo.py add       # 새 기법 추가하는 법
"""
import argparse, collections, csv, datetime as dt, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, HERE)
BOARD = os.path.join(ROOT, "data", "모델성적.csv")
COLS = ["측정일", "트랙", "기법", "경기", "적중", "적중률", "챔피언대비", "비고"]
LAB = ["H", "D", "A"]


# ---------------------------------------------------------------- 트랙 A: 대규모 검증
def track_a(holdout=0.25):
    """football-data 과거 경기로 모델 계층 기법들을 겨루게 한다. direction_lab 의 엔진을 재사용."""
    import direction_lab as DL
    rows = DL.load()
    if len(rows) < 2000:
        return {}, 0
    preds, cut, bw = DL.run_models(rows, holdout)
    out = {}
    for name, xs in preds.items():
        if not xs:
            continue
        ok = sum(1 for p, res in xs if LAB[max(range(3), key=lambda i: p[i])] == res)
        out[name] = (ok, len(xs))
    return out, len(rows)


def track_a_seg(holdout=0.25):
    """같은 시험 구간을 **경기 양상별로 쪼개** 기법별 성적을 낸다.
    사용자 지적 2026-10-26: "어떤 게임은 Elo 가, 어떤 게임은 포아송이 더 맞을 수 있다."
    전체 평균 한 줄로는 그게 묻힌다. 구간별로 봐야 '어디서 무엇을 쓸지'가 보인다."""
    import direction_lab as DL
    rows = DL.load()
    preds, cut, bw = DL.run_models(rows, holdout)
    mk = preds.get("5 시장") or []
    if not mk:
        return {}
    def band(p):
        t = max(p) * 100
        return "<40" if t < 40 else "40~50" if t < 50 else "50~60" if t < 60 else "60~70" if t < 70 else "70+"
    bands = [band(p) for p, _ in mk]
    out = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
    for name, xs in preds.items():
        if len(xs) != len(mk):
            continue                       # 같은 경기 원칙 — 길이 다르면 비교 안 한다
        for i, (p, res) in enumerate(xs):
            b = bands[i]
            d = out[b][name]
            d[1] += 1
            d[0] += (LAB[max(range(3), key=lambda k: p[k])] == res)
    return out


# ---------------------------------------------------------------- 트랙 B: 실전 기록
def _p(g, pre):
    v = {}
    for k in ("승", "무", "패"):
        x = g.get(f"{pre}_{k}")
        if x in (None, ""):
            return None
        try:
            v[k] = float(x)
        except ValueError:
            return None
    return v


def track_b(window_days=None):
    """우리 기록에서 '같은 경기'에 대해 여러 기법의 1순위를 비교한다."""
    import json
    p = os.path.join(ROOT, "전체경기기록.csv")
    games = [g for g in csv.DictReader(open(p, encoding="utf-8-sig"))
             if g.get("결과") in ("승", "무", "패") and (g.get("깊이") or "") != "기준선"]
    try:
        W = json.load(open(os.path.join(ROOT, "data", "factor_weights.json"), encoding="utf-8"))
        wt = {t: v for t, v in (W.get("types") or {}).items() if v.get("weight")}
    except Exception:
        wt = {}
    fac = collections.defaultdict(lambda: collections.defaultdict(float))
    fp = os.path.join(ROOT, "data", "근거기록.csv")
    if os.path.exists(fp):
        for r in csv.DictReader(open(fp, encoding="utf-8-sig")):
            if r.get("구분") != "요인":
                continue
            try:
                v = float(r.get("영향") or 0)
            except ValueError:
                continue
            if v:
                fac[(r["회차"], r["번호"])][(r.get("유형") or "기타").strip()] += v

    methods = collections.defaultdict(lambda: [0, 0])
    for g in games:
        mk, pu, bo = _p(g, "시장"), _p(g, "순수"), _p(g, "보정")
        if not mk:
            continue                      # 시장이 없으면 비교 불가 — 같은 경기 원칙
        res = g["결과"]
        cand = {"시장": mk}
        if pu:
            cand["우리 순수 분석"] = pu
        if bo:
            cand["우리 보정"] = bo
        # 시장 + 검증된 요인만 (현재 운영 틀)
        d = fac.get((g.get("회차"), g.get("번호")), {})
        delta = sum(v for t, v in d.items() if t in wt)
        m2 = dict(mk)
        m2["승"] = max(0.5, m2["승"] + delta); m2["패"] = max(0.5, m2["패"] - delta)
        cand["시장+검증요인"] = m2
        # 시장 + 전체 요인 (옛 방식, 대조)
        m3 = dict(mk); dall = sum(d.values())
        m3["승"] = max(0.5, m3["승"] + dall); m3["패"] = max(0.5, m3["패"] - dall)
        cand["시장+전체요인(옛)"] = m3
        cand["홈 고정"] = {"승": 100.0, "무": 0.0, "패": 0.0}
        for name, pr in cand.items():
            t = max(pr, key=pr.get)
            methods[name][1] += 1
            methods[name][0] += (t == res)
    return {k: (v[0], v[1]) for k, v in methods.items()}


# ---------------------------------------------------------------- 경기별 예측 적재
PRED = os.path.join(ROOT, "data", "기법별예측.csv")
PCOLS = ["회차", "번호", "경기", "시각", "종목", "리그", "기법", "승", "무", "패",
         "1순위", "결과", "적중", "시장1순위", "시장최대", "기록일"]


def candidates(g, wt, fac):
    """한 경기에 대해 쓸 수 있는 모든 기법의 확률. 새 기법은 여기 한 줄 추가하면 전부에 반영된다."""
    mk, pu, bo = _p(g, "시장"), _p(g, "순수"), _p(g, "보정")
    out = {}
    if mk:
        out["시장"] = mk
        d = fac.get((g.get("회차"), g.get("번호")), {})
        m2 = dict(mk); dv = sum(v for t, v in d.items() if t in wt)
        m2["승"] = max(0.5, m2["승"] + dv); m2["패"] = max(0.5, m2["패"] - dv)
        out["시장+검증요인"] = m2
        m3 = dict(mk); da = sum(d.values())
        m3["승"] = max(0.5, m3["승"] + da); m3["패"] = max(0.5, m3["패"] - da)
        out["시장+전체요인"] = m3
    if pu:
        out["우리 순수 분석"] = pu
    if bo:
        out["우리 보정"] = bo
        if mk:
            out["보정+시장 평균"] = {k: (bo[k] + mk[k]) / 2 for k in ("승", "무", "패")}
    out["홈 고정"] = {"승": 100.0, "무": 0.0, "패": 0.0}
    return out


def cmd_log(a):
    """**모든 경기 × 모든 기법**의 예측을 한 줄씩 쌓는다(사용자 지시 2026-10-26).
    집계만 남기면 나중에 다른 기준으로 못 쪼갠다. 경기별로 남겨 두면 리그·팀·구간 무엇으로든 다시 잴 수 있다."""
    import json
    games = [g for g in csv.DictReader(open(os.path.join(ROOT, "전체경기기록.csv"), encoding="utf-8-sig"))
             if g.get("결과") in ("승", "무", "패")]
    try:
        W = json.load(open(os.path.join(ROOT, "data", "factor_weights.json"), encoding="utf-8"))
        wt = {t for t, v in (W.get("types") or {}).items() if v.get("weight")}
    except Exception:
        wt = set()
    fac = collections.defaultdict(lambda: collections.defaultdict(float))
    fp = os.path.join(ROOT, "data", "근거기록.csv")
    if os.path.exists(fp):
        for r in csv.DictReader(open(fp, encoding="utf-8-sig")):
            if r.get("구분") != "요인":
                continue
            try:
                v = float(r.get("영향") or 0)
            except ValueError:
                continue
            if v:
                fac[(r["회차"], r["번호"])][(r.get("유형") or "기타").strip()] += v
    today = dt.date.today().isoformat()
    rows, seen = [], set()
    for g in games:
        mk = _p(g, "시장")
        mtop = max(mk, key=mk.get) if mk else ""
        mmax = f"{max(mk.values()):.1f}" if mk else ""
        for name, pr in candidates(g, wt, fac).items():
            t = max(pr, key=pr.get)
            key = (g.get("회차"), g.get("번호"), name)
            if key in seen:
                continue
            seen.add(key)
            rows.append({"회차": g.get("회차"), "번호": g.get("번호"),
                         "경기": f"{g.get('홈')} vs {g.get('원정')}", "시각": g.get("시각", ""),
                         "종목": g.get("종목", ""), "리그": g.get("리그", ""), "기법": name,
                         "승": f"{pr['승']:.1f}", "무": f"{pr['무']:.1f}", "패": f"{pr['패']:.1f}",
                         "1순위": t, "결과": g["결과"], "적중": "1" if t == g["결과"] else "0",
                         "시장1순위": mtop, "시장최대": mmax, "기록일": today})
    os.makedirs(os.path.dirname(PRED), exist_ok=True)
    w = csv.DictWriter(open(PRED, "w", encoding="utf-8", newline=""), fieldnames=PCOLS)
    w.writeheader()
    for r in rows:
        w.writerow(r)
    meth = collections.Counter(r["기법"] for r in rows)
    print(f"경기 {len(games)} × 기법 {len(meth)} → {len(rows)}행")
    for m, n in meth.most_common():
        hit = sum(1 for r in rows if r["기법"] == m and r["적중"] == "1")
        print(f"  {m:<16} n={n:4d}  적중 {hit/n*100:5.1f}%")
    print(f"→ {PRED}")
    return 0


def cmd_slice(a):
    """쌓아 둔 경기별 예측을 아무 기준으로나 쪼개 본다."""
    if not os.path.exists(PRED):
        print("먼저 log 를 돌린다"); return 1
    rs = list(csv.DictReader(open(PRED, encoding="utf-8-sig")))
    key = a.by
    def band(r):
        try:
            v = float(r["시장최대"])
        except (ValueError, KeyError):
            return "시장없음"
        return "<40" if v < 40 else "40~50" if v < 50 else "50~60" if v < 60 else "60~70" if v < 70 else "70+"
    getter = {"리그": lambda r: r["리그"], "종목": lambda r: r["종목"],
              "구간": band, "회차": lambda r: r["회차"]}[key]
    d = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
    for r in rs:
        x = d[getter(r)][r["기법"]]
        x[1] += 1; x[0] += int(r["적중"])
    print(f"{key}별 기법 성적 (n>={a.min})\n")
    for seg in sorted(d, key=lambda k: -max(v[1] for v in d[k].values())):
        meths = {m: v for m, v in d[seg].items() if v[1] >= a.min}
        if not meths:
            continue
        n = max(v[1] for v in meths.values())
        rank = sorted(meths.items(), key=lambda kv: -(kv[1][0] / kv[1][1]))
        print(f"  [{seg}] {n}경기")
        for m, (ok, nn) in rank:
            print(f"     {m:<16} {ok/nn*100:5.1f}%  (n={nn})" + ("  ★" if m == rank[0][0] else ""))
        print()
    return 0


# ---------------------------------------------------------------- 기록·보고
def load_board():
    return list(csv.DictReader(open(BOARD, encoding="utf-8-sig"))) if os.path.exists(BOARD) else []


def save_board(rows):
    os.makedirs(os.path.dirname(BOARD), exist_ok=True)
    w = csv.DictWriter(open(BOARD, "w", encoding="utf-8", newline=""), fieldnames=COLS)
    w.writeheader()
    for r in rows:
        w.writerow({c: r.get(c, "") for c in COLS})


def se_diff(h1, n1, h2, n2):
    """두 비율 차이의 표준오차(동일 표본이라 보수적으로 독립 가정)."""
    if not n1 or not n2:
        return 0.0
    p1, p2 = h1 / n1, h2 / n2
    return math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2) * 100


def cmd_eval(a):
    today = dt.date.today().isoformat()
    rows = [r for r in load_board() if r["측정일"] != today]
    print("트랙 A — 대규모 검증(과거 결과 기반 기법)")
    A, nA = track_a()
    champ = max(A.items(), key=lambda kv: kv[1][0] / kv[1][1]) if A else None
    for name, (ok, n) in sorted(A.items(), key=lambda kv: -kv[1][0] / kv[1][1]):
        rate = ok / n * 100
        gap = rate - (champ[1][0] / champ[1][1] * 100) if champ else 0
        print(f"  {name:<22} n={n:5d}  {rate:5.1f}%  {gap:+5.1f}p")
        rows.append({"측정일": today, "트랙": "A", "기법": name, "경기": n, "적중": ok,
                     "적중률": f"{rate:.2f}", "챔피언대비": f"{gap:+.2f}", "비고": f"corpus={nA}"})
    print("\n트랙 B — 실전 기록(우리 경기)")
    B = track_b()
    champB = max(B.items(), key=lambda kv: kv[1][0] / kv[1][1]) if B else None
    for name, (ok, n) in sorted(B.items(), key=lambda kv: -kv[1][0] / kv[1][1]):
        rate = ok / n * 100
        gap = rate - (champB[1][0] / champB[1][1] * 100) if champB else 0
        print(f"  {name:<22} n={n:5d}  {rate:5.1f}%  {gap:+5.1f}p")
        rows.append({"측정일": today, "트랙": "B", "기법": name, "경기": n, "적중": ok,
                     "적중률": f"{rate:.2f}", "챔피언대비": f"{gap:+.2f}", "비고": ""})
    save_board(rows)
    print(f"\n→ {BOARD} ({len(rows)}행 누적)")
    return 0


def cmd_board(a):
    rows = load_board()
    if not rows:
        print("기록 없음 — eval 을 먼저 돌린다"); return 1
    days = sorted({r["측정일"] for r in rows})
    print(f"측정 {len(days)}회 ({days[0]} ~ {days[-1]})\n")
    for tr, title in (("A", "트랙 A — 대규모 검증"), ("B", "트랙 B — 실전 기록")):
        sub = [r for r in rows if r["트랙"] == tr]
        if not sub:
            continue
        last = max(r["측정일"] for r in sub)
        cur = {r["기법"]: r for r in sub if r["측정일"] == last}
        print(f"{title}  (최근 {last})")
        print(f"  {'기법':<22} {'경기':>6} {'적중률':>7} {'직전대비':>8} {'측정':>5}")
        prev_days = [d for d in sorted({r['측정일'] for r in sub}) if d < last]
        prev = {r["기법"]: r for r in sub if prev_days and r["측정일"] == prev_days[-1]}
        best = max(cur.values(), key=lambda r: float(r["적중률"])) if cur else None
        for r in sorted(cur.values(), key=lambda r: -float(r["적중률"])):
            d = ""
            if r["기법"] in prev:
                d = f"{float(r['적중률']) - float(prev[r['기법']]['적중률']):+.1f}p"
            times = sum(1 for x in sub if x["기법"] == r["기법"])
            mark = " ★챔피언" if best and r["기법"] == best["기법"] else ""
            print(f"  {r['기법']:<22} {r['경기']:>6} {float(r['적중률']):>6.1f}% {d:>8} {times:>5}{mark}")
        if best:
            others = [r for r in cur.values() if r["기법"] != best["기법"]]
            if others:
                second = max(others, key=lambda r: float(r["적중률"]))
                s = se_diff(int(best["적중"]), int(best["경기"]), int(second["적중"]), int(second["경기"]))
                diff = float(best["적중률"]) - float(second["적중률"])
                verdict = "유의" if diff > 2 * s else "표본오차 안(교체 보류)"
                print(f"\n  1위 vs 2위 차 {diff:+.1f}p · 2SE {2*s:.1f}p → {verdict}")
        print()
    print("규칙: 챔피언 교체는 차이가 2SE 를 넘을 때만. 한 주 반짝은 사유가 아니다.")
    print("새 기법은 트랙 A 를 먼저 통과해야 트랙 B 로 올린다.")
    return 0


def cmd_seg(a):
    """경기 양상별로 어느 기법이 1등인지 — 전체 평균에 묻히는 것을 드러낸다."""
    segs = track_a_seg()
    if not segs:
        print("자료 부족"); return 1
    today = dt.date.today().isoformat()
    rows = [r for r in load_board() if not (r["측정일"] == today and r["트랙"].startswith("A-"))]
    order = ["<40", "40~50", "50~60", "60~70", "70+"]
    print("트랙 A — 시장 1순위 확률대별 기법 성적 (같은 시험 구간)\n")
    for b in order:
        if b not in segs:
            continue
        d = segs[b]
        n = max(v[1] for v in d.values())
        print(f"  [시장 1순위 {b}%]  {n}경기")
        rank = sorted(d.items(), key=lambda kv: -(kv[1][0] / kv[1][1]))
        mkrate = (d.get("5 시장") or [0, 1])[0] / max(1, (d.get("5 시장") or [0, 1])[1]) * 100
        for name, (ok, nn) in rank:
            rate = ok / nn * 100
            tag = " ★" if name == rank[0][0] else ""
            vs = f"  시장대비 {rate - mkrate:+5.1f}p" if name != "5 시장" else ""
            print(f"     {name:<22} {rate:5.1f}%{vs}{tag}")
            rows.append({"측정일": today, "트랙": f"A-{b}", "기법": name, "경기": nn, "적중": ok,
                         "적중률": f"{rate:.2f}", "챔피언대비": f"{rate - mkrate:+.2f}", "비고": "구간별"})
        print()
    save_board(rows)
    print("읽는 법: 어떤 구간에서 모델이 시장을 넘으면, 그 구간에서는 그 모델을 쓰는 것이 맞다(구간별 라우팅).")
    print("전체 평균으로는 지더라도 구간에서 이기면 기록해 두고 표본이 쌓이기를 기다린다.")
    return 0


def cmd_fair(a):
    """**모든 기법이 값을 낸 공통 경기**에서만 비교한다. 표본이 다르면 숫자를 나란히 두지 않는다."""
    if not os.path.exists(PRED):
        print("먼저 predict_engine.py run / model_zoo.py log 를 돌린다"); return 1
    rs = list(csv.DictReader(open(PRED, encoding="utf-8-sig")))
    by = collections.defaultdict(dict)
    for r in rs:
        by[(r["회차"], r["번호"])][r["기법"]] = r
    meths = sorted({r["기법"] for r in rs})
    if a.only:
        want = set(a.only.split(","))
        meths = [m for m in meths if m in want]
    common = [g for g, d in by.items() if all(m in d for m in meths)]
    if not common:
        # 전부를 포함하는 경기가 없으면, 가장 많은 기법을 공유하는 조합으로 좁힌다
        cnt = collections.Counter()
        for g, d in by.items():
            cnt[frozenset(d) & set(meths)] += 1
        best = max(cnt.items(), key=lambda kv: len(kv[0]) * kv[1])
        meths = sorted(best[0]); common = [g for g, d in by.items() if all(m in d for m in meths)]
    print(f"공통 경기 {len(common)}건 · 기법 {len(meths)}종 (같은 경기에서만 비교)\n")
    print(f"  {'기법':<18} {'적중률':>7} {'vs 시장':>8}")
    base = None
    tbl = []
    for m in meths:
        ok = sum(1 for g in common if by[g][m]["적중"] == "1")
        tbl.append((m, ok / len(common) * 100, ok))
    d = dict((m, r) for m, r, _ in tbl)
    base = d.get("시장") or d.get("market")
    for m, rate, ok in sorted(tbl, key=lambda x: -x[1]):
        vs = f"{rate - base:+7.1f}p" if base is not None and m not in ("시장", "market") else ""
        print(f"  {m:<18} {rate:>6.1f}% {vs:>8}")
    n = len(common)
    if base is not None and n:
        se = math.sqrt(0.5 * 0.5 / n) * 100
        print(f"\n  표본 {n}경기 · 1기법 2SE ≈ ±{2*se:.1f}p — 이보다 작은 차이는 우연과 구분되지 않는다")
    return 0


def cmd_add(a):
    print("""새 분석 기법 추가하는 법 (한 주에 하나씩)

 1) 트랙 A(모델 계층)에 넣을 때 — scripts/direction_lab.py 의 run_models() 안에서
    preds["8 새기법이름"].append((확률3, 실제)) 를 추가한다. 상태 갱신은 기존 루프를 따른다.
    모든 기법이 같은 시험 구간을 쓰므로 비교가 자동으로 맞는다.

 2) 트랙 B(실전)에 넣을 때 — 이 파일 track_b() 의 cand 딕셔너리에 한 줄 추가한다.
    cand["이름"] = {"승": x, "무": y, "패": z}   (시장이 없는 경기는 자동 제외된다)

 3) 넣은 주에 eval → board 로 성적을 남기고, 다음 주 점검에서 2SE 기준으로 판정한다.
    나쁘게 나와도 지우지 않는다 — 어떤 방향이 막혔는지가 기록으로 남아야 한다.

이번 주 후보 예시: 휴식일 보정 / 홈어드밴티지 리그별 추정 / 최근 폼 가중 Elo /
                  득점 레이팅에 결장 가중 / 시장 대비 역추세""")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    s.add_parser("eval").set_defaults(f=cmd_eval)
    s.add_parser("board").set_defaults(f=cmd_board)
    s.add_parser("seg").set_defaults(f=cmd_seg)
    s.add_parser("log").set_defaults(f=cmd_log)
    p = s.add_parser("fair"); p.add_argument("--only"); p.set_defaults(f=cmd_fair)
    p = s.add_parser("slice"); p.add_argument("--by", default="구간", choices=["리그", "종목", "구간", "회차"])
    p.add_argument("--min", type=int, default=20); p.set_defaults(f=cmd_slice)
    s.add_parser("add").set_defaults(f=cmd_add)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
