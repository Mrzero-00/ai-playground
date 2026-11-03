#!/usr/bin/env python3
"""정배 중 **이변·무가 날 확률이 낮은 경기**만 골라낸다 (사용자 제안 2026-11-04).

왜 이 방향인가:
  역배·무를 맞히는 건 우리 실적이 나쁘다(역배 32건 중 5건 15.6%, 무 13건 중 1건 7.7%).
  그래서 어려운 걸 맞히려 하지 않고, **어려운 일이 안 일어날 경기를 고른다.**
  분석의 역할은 방향을 뒤집는 것이 아니라 **정배 중 안전한 것을 가려내는 선별**이다.

★ 쓰는 확률은 **기준선 무 확률**이다. 심층 분석이 필요 없다(측정으로 확인).
  시장 1순위 60%+ · 배당 1.2+ 164경기에서
    선별 없음            적중 69.5%(n=164) · 회수율  95.8%
    심층분석 무<24%       적중 80.6%(n= 31) · 회수율 107.8%
    **기준선 무<24%**     적중 81.6%(n= 49) · 회수율 111.5%   ← 더 좋고 표본도 1.6배
  문턱 민감도(22~25% 전 구간 80%+ / 회수 108~113%, 26% 에서 71.9%/98.7% 로 무너짐)
  시간 분할(학습 114/시험 50): 기준선 무<24% 학습 87.0%/122.6% · 시험 76.9%/101.7%
  같은 회차 2다리 조합(합계배당 1.8+): 134건 적중 55.2% · 평균 합계배당 1.99 · 회수율 108.5%
  빈도: 선별 49경기가 9회차에 분포(회차당 평균 5.4), 9회차 중 7회차에서 2경기 이상
  ※ 2SE ±11.1p 로 **아직 유의하지 않다**. 그리고 회수율의 상당 부분은 '시장 60%+ 정배를
    산다' 자체에서 온다 — 무 필터가 더하는 몫은 +5~12p 다. 표본을 쌓으며 쓴다.

★ 선별 회수율은 **수익 지표**이고, 방향 적중률 100% 목표는 **분석력 지표**다. 섞지 않는다.
  선별은 쉬운 경기만 골라 돈을 버는 실무 수단이고, 목표는 어려운 경기도 맞히는 것이다.

기본 조건 (--relax 로 완화):
  시장 1순위 확률 >= 60% · 배당 >= 1.2 · 무 확률 < 24% · 내 1순위 = 시장 1순위
  깊이는 가리지 않는다 — 기준선 행이 바로 쓰는 값이다.

  python3 scripts/baseline_fill.py --round 131      # 먼저 기준선을 깐다
  python3 scripts/odds_scan.py --round 131 --save   # 시장확률·배당을 채운다
  python3 scripts/safe_picks.py --round 131 --md    # 그 회차에서 고른다
  python3 scripts/safe_picks.py --backtest          # 근거 숫자를 다시 잰다 (기준선 기준)
"""
import csv, os, sys, math, argparse, itertools

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LOG = os.path.join(ROOT, "전체경기기록.csv")
L = ("승", "무", "패")
NO_ANALYSIS = ("기준선", "시장복사", "미분석", "")
SPORTS = ("축구",)          # 검증된 종목만. 농구·배구는 사용자 지시로 제외.

DEF = dict(mp=60.0, odds=1.2, draw=24.0, agree=True)


def deadlines(round_):
    """분석일정.csv 의 블록 끝마감. 경기 시각이 속한 블록의 마감을 돌려준다.
    (사용자 고정: 조합은 같은 시간대 우선 — 2026-10-13)"""
    import datetime as dt
    p = os.path.join(ROOT, "분석일정.csv")
    bl = []
    if os.path.exists(p):
        for r in csv.DictReader(open(p, encoding="utf-8-sig")):
            if r["회차"] != str(round_):
                continue
            try:
                bl.append((dt.datetime.strptime(r["첫마감"], "%Y-%m-%d %H:%M"),
                           dt.datetime.strptime(r["끝마감"], "%Y-%m-%d %H:%M")))
            except Exception:
                pass
    bl.sort()

    def of(t):
        """t = 'MM-DD HH:MM' 또는 'YYYY-MM-DD HH:MM'"""
        t = (t or "").strip()
        if not t:
            return None
        try:
            if len(t) >= 16:
                ko = dt.datetime.strptime(t[:16], "%Y-%m-%d %H:%M")
            else:
                y = dt.datetime.now().year
                ko = dt.datetime.strptime(f"{y}-{t}", "%Y-%m-%d %H:%M")
        except ValueError:
            return None
        cand = [b for b in bl if b[0] <= ko]
        return max(cand, key=lambda b: b[0])[1] if cand else None
    return of


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def rows(round_=None, scored=None):
    out = []
    for r in csv.DictReader(open(LOG, encoding="utf-8-sig")):
        if round_ is not None and r["회차"] != str(round_):
            continue
        if r["종목"] not in SPORTS:
            continue
        # 깊이를 가리지 않는다 — 검증된 신호는 '기준선 무 확률'이고 기준선 행이 바로 그 값이다
        # (2026-11-04: 심층 요구 때 247경기 중 31경기만 남아 회차당 1~2경기였다)
        mk = {k: _f(r.get(f"시장_{k}")) for k in L}
        od = {k: _f(r.get(f"베트맨_{k}")) for k in L}
        my = {k: _f(r.get(f"순수_{k}")) for k in L}
        if any(v is None for v in mk.values()) or sum(mk.values()) <= 0:
            continue
        if any(v is None for v in my.values()) or sum(my.values()) <= 0:
            continue
        if any((od[k] or 0) <= 1 for k in L):
            continue
        mt = max(mk, key=mk.get)
        g = dict(row=r, mk=mk, od=od, my=my, mt=mt, bt=max(my, key=my.get),
                 res=(r.get("결과") or "").strip(), mp=mk[max(mk, key=mk.get)],
                 depth=(r.get("깊이") or "미분석"))
        if scored is True and g["res"] not in L:
            continue
        if scored is False and g["res"] in L:
            continue
        out.append(g)
    return out


def passes(g, c):
    if g["mp"] < c["mp"]:
        return False
    if g["od"][g["mt"]] < c["odds"]:
        return False
    if g["my"]["무"] >= c["draw"]:
        return False
    if c["agree"] and g["bt"] != g["mt"]:
        return False
    return True


def stat(sub):
    n = len(sub)
    if not n:
        return None
    h = sum(1 for g in sub if g["mt"] == g["res"])
    ret = sum((g["od"][g["mt"]] if g["mt"] == g["res"] else 0) for g in sub) / n
    se = 200 * math.sqrt(max(h / n * (1 - h / n), 1e-9) / n)
    return dict(n=n, hit=h, rate=h / n * 100, se=se, ret=ret * 100,
                odds=sum(g["od"][g["mt"]] for g in sub) / n)


def baseline_map():
    """predict_engine 이 전 경기 연대기에 깐 자체 모델 확률 (dixon_coles→poisson→pi)."""
    import collections
    p = os.path.join(ROOT, "data", "기법별예측.csv")
    pred = collections.defaultdict(dict)
    if os.path.exists(p):
        for r in csv.DictReader(open(p, encoding="utf-8-sig")):
            pred[(r["회차"], r["번호"])][r["기법"]] = r
    out = {}
    for key, e in pred.items():
        for kk in ("dixon_coles", "poisson", "pi"):
            if kk in e:
                out[key] = {k: float(e[kk][k]) for k in L}
                break
    return out


def cmd_backtest(a):
    bm = baseline_map()
    G = []
    for g in rows(scored=True):
        g["base"] = bm.get((g["row"]["회차"], g["row"]["번호"]))
        if g["od"][g["mt"]] >= DEF["odds"]:
            G.append(g)
    B = [g for g in G if g["mp"] >= DEF["mp"] and g["base"]]
    print(f"정배 풀 배당{DEF['odds']}+ {len(G)}경기 · 그중 시장 1순위 {DEF['mp']:.0f}%+ 이고 "
          f"기준선 있는 경기 {len(B)}경기 (축구, 결과 있음)\n")
    print(f"{'선별 방식':<34}{'n':>5}{'적중':>8}{'2SE':>7}{'평균배당':>9}{'회수율':>9}")

    def line(lab, sub):
        s_ = stat(sub)
        if not s_:
            print(f"{lab:<34}{0:>5}")
        elif s_["n"] < 10:
            print(f"{lab:<34}{s_['n']:>5}   표본 부족")
        else:
            print(f"{lab:<34}{s_['n']:>5}{s_['rate']:>7.1f}%{s_['se']:>6.1f}p"
                  f"{s_['odds']:>9.2f}{s_['ret']:>8.1f}%")

    line("선별 없음 (시장 60%+ 전부)", B)
    line("기준선 무 확률 < 24%", [g for g in B if g["base"]["무"] < DEF["draw"]])
    line("  + 내 1순위도 시장과 일치", [g for g in B if g["base"]["무"] < DEF["draw"] and g["bt"] == g["mt"]])
    print(f"\n{'문턱 민감도':<34}{'n':>5}{'적중':>8}{'2SE':>7}{'평균배당':>9}{'회수율':>9}")
    for th in (22, 23, 24, 25, 26):
        line(f"기준선 무 < {th}%", [g for g in B if g["base"]["무"] < th])
    B.sort(key=lambda g: (g["row"].get("시각") or ""))
    cut = int(len(B) * 0.7)
    print(f"\n시간 분할 (학습 {cut} / 시험 {len(B)-cut})")
    for lab, sel in (("선별 없음", lambda g: True),
                     (f"기준선 무<{DEF['draw']:.0f}%", lambda g: g["base"]["무"] < DEF["draw"])):
        tr, te = stat([g for g in B[:cut] if sel(g)]), stat([g for g in B[cut:] if sel(g)])
        f = lambda s_: (f"{s_['rate']:.1f}% 회수 {s_['ret']:.1f}% (n={s_['n']})"
                        if s_ and s_["n"] >= 10 else (f"n={s_['n']}" if s_ else "n=0"))
        print(f"  {lab:<16} 학습 {f(tr):<30} 시험 {f(te)}")
    print("\n2SE 를 넘지 못한다 — 아직 유의하지 않다. 회수율의 상당 부분은")
    print("'시장 60%+ 정배를 산다' 자체에서 오고, 무 필터가 더하는 몫은 +5~12p 다.")
    return 0


def cmd_pick(a):
    c = dict(DEF)
    if a.relax:
        c.update(mp=55.0, draw=26.0)
    for k in ("mp", "odds", "draw"):
        if getattr(a, k) is not None:
            c[k] = getattr(a, k)
    G = rows(round_=a.round)
    if not G:
        print(f"{a.round}회에 조건을 볼 수 있는 분석 경기가 없다 "
              f"(깊이·시장확률·배당·순수 중 빠진 것이 있는지 확인한다)", file=sys.stderr)
        return 1
    dl = deadlines(a.round)
    for g in G:
        g["dl"] = dl(g["row"].get("시각"))
    sel = [g for g in G if passes(g, c)]
    sel.sort(key=lambda g: (g["dl"] or __import__("datetime").datetime.max, -g["mp"]))
    head = (f"### {a.round}회 안전 정배 후보 — 시장 1순위 {c['mp']:.0f}%+ · 배당 {c['odds']}+ "
            f"· 내 무<{c['draw']:.0f}%" + (" · 1순위 일치" if c["agree"] else ""))
    if a.md:
        print(head + "\n")
        print("| 번호 | 경기 | 선택 | 배당 | 시장 1순위 | 내 확률 | 무 확률 | 킥오프 | 구매 마감 |")
        print("|---|---|---|---:|---:|---:|---:|---|---|")
        for g in sel:
            r = g["row"]
            print(f"| {r['번호']} | {r['홈']} vs {r['원정']} | {g['mt']} | {g['od'][g['mt']]:.2f} "
                  f"| {g['mp']:.1f}% | {g['my'][g['mt']]:.1f}% | {g['my']['무']:.1f}% "
                  f"| {(r.get('시각') or '')[:11]} | {g['dl'].strftime('%m-%d %H:%M') if g['dl'] else '?'} |")
    else:
        print(head)
        print(f"{'번호':>5} {'경기':<30}{'선택':>4}{'배당':>7}{'시장':>7}{'내확률':>7}{'무':>7}  구매마감")
        for g in sel:
            r = g["row"]
            print(f"{r['번호']:>5} {(r['홈']+' vs '+r['원정'])[:29]:<30}{g['mt']:>4}"
                  f"{g['od'][g['mt']]:>7.2f}{g['mp']:>6.1f}%{g['my'][g['mt']]:>6.1f}%"
                  f"{g['my']['무']:>6.1f}%  {g['dl'].strftime('%m-%d %H:%M') if g['dl'] else '?'}")
    print(f"\n후보 {len(sel)}/{len(G)}경기")
    if len(sel) < 2:
        print("조합을 만들려면 2경기 이상 필요하다. --relax 로 조건을 완화하거나 다음 블록을 기다린다.")
        return 0
    # 조합 — 사용자 고정 조건: 합계 배당 1.8 이상 · 같은 마감(동시간대) 우선
    import collections as _c
    grp = _c.defaultdict(list)
    for g in sel:
        grp[g["dl"]].append(g)
    for d in sorted(grp, key=lambda x: (x is None, x)):
        gs = grp[d]
        label = d.strftime("%m-%d %H:%M") if d else "마감 미상"
        if len(gs) < 2:
            print(f"\n[구매 마감 {label}] 후보 {len(gs)}경기 — 조합에 2경기가 필요하다")
            continue
        combos = []
        for k in (2, 3):
            for cb in itertools.combinations(gs, k):
                o = math.prod(g["od"][g["mt"]] for g in cb)
                if o < 1.8:
                    continue
                pp = math.prod(g["my"][g["mt"]] / 100 for g in cb)
                combos.append((pp * o, pp, o, cb))
        combos.sort(key=lambda x: -x[1])
        print(f"\n[구매 마감 {label}] 후보 {len(gs)}경기 · 합계배당 1.8+ 조합 (적중 확률 높은 순)")
        if not combos:
            print("  합계 배당 1.8 을 넘는 조합이 없다 — 후보 배당이 전부 낮다는 뜻이다.")
        for ev, pp, o, cb in combos[:5]:
            legs = " + ".join(f"{g['row']['번호']}{g['mt']}" for g in cb)
            print(f"  {legs:<28} 합계배당 {o:>5.2f}  적중 {pp*100:>5.1f}%  기대회수 {ev*100:>6.1f}%")
    print("\n주의: 2SE 를 넘지 못한 가설이다(기준선 무<24%: 적중 81.6% 회수 111.5%, n=49). 실투자는 중단 상태다.")
    return 0


def main():
    ap = argparse.ArgumentParser(description="정배 중 이변·무 위험이 낮은 경기 선별")
    ap.add_argument("--round", help="회차 (예: 131, 승무패67)")
    ap.add_argument("--backtest", action="store_true", help="근거 숫자를 다시 잰다")
    ap.add_argument("--md", action="store_true")
    ap.add_argument("--relax", action="store_true", help="시장 55%+ · 내 무<26% 로 완화")
    ap.add_argument("--mp", type=float, help="시장 1순위 확률 하한")
    ap.add_argument("--odds", type=float, help="배당 하한")
    ap.add_argument("--draw", type=float, help="내 무 확률 상한")
    a = ap.parse_args()
    if a.backtest:
        return cmd_backtest(a)
    if not a.round:
        ap.error("--round 또는 --backtest 중 하나는 필요하다")
    return cmd_pick(a)


if __name__ == "__main__":
    sys.exit(main())
