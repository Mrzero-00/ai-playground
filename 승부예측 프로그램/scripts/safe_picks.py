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

★★ 후보로 뽑힌 경기는 **반드시 심층 분석을 거친 뒤에만 추천한다** (사용자 지시 2026-11-05).
  기준선만으로 추천하면 안 된다 — 2026-11-05 에 후보 4경기를 심층으로 열었더니 **네 번 다 내려갔다**:
    2748 78.3→74.0(-4.3) · 2760 69.3→64.3(-5.0) · 2701 75.7→67.7(-8.0) · 2807 71.1→63.1(-8.0)
  특히 **2807 은 과신 검문(+8p)에 걸리지도 않았는데(+5.5p) 8p 내려갔다** — 선덜랜드가
  프리미어리그 20위 최하위인데 리그보정이 예측의 92%를 차지해 eng.1 +1.07 을 온전히 받고 있었다.
  즉 **검문을 통과한 기준선도 믿을 수 없다.** 후보는 전부 열어 본다.
  → 이 스크립트는 깊이=심층이 아닌 후보를 '추천 불가(심층 필요)'로 갈라 찍는다.

★ 선별 회수율은 **수익 지표**이고, 방향 적중률 100% 목표는 **분석력 지표**다. 섞지 않는다.
  선별은 쉬운 경기만 골라 돈을 버는 실무 수단이고, 목표는 어려운 경기도 맞히는 것이다.

기본 조건 (--relax 로 완화):
  시장 1순위 확률 >= 60% · 배당 >= 1.2 · 무 확률 < 24% · 내 1순위 = 시장 1순위
  깊이는 가리지 않는다 — 기준선 행이 바로 쓰는 값이다.

  python3 scripts/baseline_fill.py --round 131      # 먼저 기준선을 깐다
  python3 scripts/odds_scan.py --round 131 --save   # 시장확률·배당을 채운다
  python3 scripts/safe_picks.py --round 131 --md    # 그 회차에서 고른다
  python3 scripts/safe_picks.py --backtest          # 근거 숫자를 다시 잰다 (기준선 기준)
  python3 scripts/safe_picks.py --forward           # ★ 채택 이후 구간만으로 잰다 — 회고 때 이 숫자를 본다

★★★ 2026-11-11 — 백테스트 신호와 실전 신호가 달랐다
  위 '기준선 무<24%' 숫자는 predict_engine 의 Dixon-Coles 무 확률로 잰 것인데, 후보를 실제로
  고를 때는 전체경기기록의 순수_무(soccer_baseline·euro_baseline·심층)를 쓴다. 같은 171경기에서
  두 신호가 고르는 경기는 36경기만 겹친다. 채택 이후 37경기에서는
    실전 신호 통과 22경기 81.8% · 회수 108.5%   /   탈락 15경기 53.3% · 74.1%  (z=+1.86)
    DC 신호(백테스트가 검증한 쪽) 9경기 55.6%
  로 **검증한 신호는 실전에서 안 통했고, 검증 안 한 신호가 통하고 있다.** 둘 다 표본이 작다.
  그래서 ① 후보를 볼 때마다 정배 전부를 통과·탈락과 함께 data/선별후보.csv 에 자동으로 남기고
  ② `--forward` 가 그 장부로 통과 vs 탈락을 잰다. 통과 60경기까지 문턱을 바꾸지 않는다.
"""
import csv, os, sys, math, argparse, itertools

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LOG = os.path.join(ROOT, "전체경기기록.csv")
L = ("승", "무", "패")
NO_ANALYSIS = ("기준선", "시장복사", "미분석", "")
SPORTS = ("축구",)          # 검증된 종목만. 농구·배구는 사용자 지시로 제외.

DEF = dict(mp=60.0, odds=1.2, draw=24.0, agree=True)


def no_offset_leagues(round_):
    """euro_baseline 의 리그 강도 오프셋 표에 없는 리그(=보정 0 으로 처리됨) 팀이 끼인 경기 번호.
    2026-11-04: 오프셋 표는 15개 리그뿐이라 체코·헝가리·불가리아·세르비아·폴란드·크로아티아·
    스웨덴·리투아니아·카자흐스탄·키프로스·보스니아·안도라·아제르바이잔 등이 빠진다.
    131회 축구 22경기가 여기 걸렸고 안전정배 후보 10개 중 4개가 포함됐다.
    빠진 리그 팀은 '평균 리그' 로 취급돼 과대·과소평가 어느 쪽으로도 틀어질 수 있으므로
    후보 목록에 반드시 표시한다 — 선별이 쓰는 무 확률이 불완전한 모델에서 나온다."""
    import io, contextlib
    try:
        import sys as _s
        _s.path.insert(0, os.path.join(ROOT, "scripts"))
        import euro_baseline as eb, soccer_baseline as sb
        with contextlib.redirect_stdout(io.StringIO()):
            _, _, _, _, _, off = eb.state(quiet=True)
            names = sb.load_names(); teams = eb.teams_recent()
    except Exception:
        return set()
    bad = set()
    for r in csv.DictReader(open(LOG, encoding="utf-8-sig")):
        if r["회차"] != str(round_) or r["종목"] != "축구":
            continue
        try:
            h = sb.match_team(r["홈"], teams, names); a = sb.match_team(r["원정"], teams, names)
            if not (h and a):
                continue
            with contextlib.redirect_stdout(io.StringIO()):
                b, _ = eb.predict_pair(h, a)
            if b.get("홈리그") is None or b.get("원정리그") is None:
                bad.add(r["번호"])
        except Exception:
            continue
    return bad


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


def real_baseline_map():
    """soccer_baseline 을 킥오프 2시간 전 상태로 과거에 다시 깐 값(baseline_replay.py).
    실전에서 후보를 고를 때 쓰는 모델과 **같은 모델**이고 누수가 없다 — 백테스트는 이걸로 잰다."""
    try:
        sys.path.insert(0, os.path.join(ROOT, "scripts"))
        import baseline_replay
        return baseline_replay.load()
    except Exception:
        return {}


LEDGER = os.path.join(ROOT, "data", "선별후보.csv")
LCOLS = ["기록시각", "회차", "번호", "시각", "리그", "경기", "선택", "배당", "시장1순위", "내확률",
         "내무", "DC무", "깊이", "통과", "탈락사유"]
ADOPTED = 131          # 이 선별 규칙을 쓰기 시작한 프로토 회차(2026-11-04). 승무패는 66회.


def _after_adoption(rn):
    rn = str(rn)
    if rn.isdigit():
        return int(rn) >= ADOPTED
    return rn.startswith("승무패") and rn[3:].isdigit() and int(rn[3:]) >= 66


def why_fail(g, c):
    out = []
    if g["my"]["무"] >= c["draw"]:
        out.append(f"무>={c['draw']:.0f}")
    if c["agree"] and g["bt"] != g["mt"]:
        out.append("1순위 갈림")
    return "·".join(out)


def ledger_rows(G, c, stamp, bm=None):
    """시장 정배(시장 1순위 mp+ · 배당 odds+) **전부**를 통과/탈락과 함께 한 줄씩.
    탈락한 정배가 대조군이다 — 후보만 적으면 선별이 값을 했는지 잴 수 없다."""
    out = []
    for g in G:
        if g["mp"] < c["mp"] or g["od"][g["mt"]] < c["odds"]:
            continue
        r = g["row"]
        dc = (bm or {}).get((r["회차"], r["번호"]))
        out.append({"기록시각": stamp, "회차": r["회차"], "번호": r["번호"], "시각": r.get("시각", ""),
                    "리그": r.get("리그", ""), "경기": f"{r['홈']} vs {r['원정']}", "선택": g["mt"],
                    "배당": f"{g['od'][g['mt']]:.2f}", "시장1순위": f"{g['mp']:.1f}",
                    "내확률": f"{g['my'][g['mt']]:.1f}", "내무": f"{g['my']['무']:.1f}",
                    "DC무": f"{dc['무']:.1f}" if dc else "", "깊이": g["depth"],
                    "통과": "1" if passes(g, c) else "0", "탈락사유": why_fail(g, c)})
    return out


def ledger_append(new):
    """덮어쓰지 않는다. 같은 경기는 통과·깊이·내무가 바뀌었을 때만 새 줄을 더한다(이력)."""
    old = list(csv.DictReader(open(LEDGER, encoding="utf-8-sig"))) if os.path.exists(LEDGER) else []
    last = {}
    for r in old:
        last[(r["회차"], r["번호"])] = r
    add = []
    for r in new:
        q = last.get((r["회차"], r["번호"]))
        if q and all(q.get(k) == r[k] for k in ("통과", "깊이", "내무", "선택")):
            continue
        add.append(r)
    if add:
        with open(LEDGER, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=LCOLS); w.writeheader(); w.writerows(old + add)
    return len(add)


def cmd_forward(a):
    """**전진 시험** — 규칙을 쓰기 시작한 뒤의 경기만으로 선별이 값을 했는지 본다.
    백테스트는 규칙을 찾은 표본으로 규칙을 재므로 늘 좋게 나온다. 믿을 숫자는 이쪽이다.
    장부(data/선별후보.csv)에 구매 전 찍어 둔 값이 있으면 그것을, 없으면 지금 기록으로 재구성한다."""
    c = dict(DEF)
    res = {(r["회차"], r["번호"]): (r.get("결과") or "").strip()
           for r in csv.DictReader(open(LOG, encoding="utf-8-sig"))}
    led = {}
    if os.path.exists(LEDGER):
        for r in csv.DictReader(open(LEDGER, encoding="utf-8-sig")):
            led[(r["회차"], r["번호"])] = r          # 마지막 줄 = 구매 직전 상태
    bm = baseline_map()
    rebuilt = 0
    for r in ledger_rows([g for g in rows(scored=True) if _after_adoption(g["row"]["회차"])], c, "재구성", bm):
        if (r["회차"], r["번호"]) not in led:
            led[(r["회차"], r["번호"])] = r; rebuilt += 1
    X = [(r, res.get(k)) for k, r in led.items() if res.get(k) in L and _after_adoption(r["회차"])]
    if not X:
        print("채점된 전진 표본이 없다"); return 0

    def st(sub):
        n = len(sub)
        if not n:
            return None
        h = sum(1 for r, o in sub if r["선택"] == o)
        ret = sum(float(r["배당"]) for r, o in sub if r["선택"] == o) / n
        return n, h / n, ret, sum(float(r["시장1순위"]) for r, _ in sub) / n

    def line(lab, sub):
        s_ = st(sub)
        if not s_:
            print(f"{lab:<30}{0:>4}"); return
        n, h, ret, mp = s_
        print(f"{lab:<30}{n:>4}{h*100:>8.1f}% ±{200*math.sqrt(max(h*(1-h),1e-9)/n):>4.1f}"
              f"{mp:>9.1f}%{ret*100:>9.1f}%")
    P = [x for x in X if x[0]["통과"] == "1"]; F = [x for x in X if x[0]["통과"] != "1"]
    print(f"전진 시험 — {ADOPTED}회·승무패66 이후, 시장 {c['mp']:.0f}%+ · 배당 {c['odds']}+ 축구 정배 "
          f"{len(X)}경기 (그중 {rebuilt}경기는 장부가 없어 현재 기록으로 재구성)\n")
    print(f"{'구분':<30}{'n':>4}{'적중':>9}{'2SE':>6}{'시장 말':>9}{'회수율':>9}")
    line("정배 전부 (대조군)", X)
    line("선별 통과 (내 무<24·일치)", P)
    line("  └ 그중 심층", [x for x in P if x[0]["깊이"] == "심층"])
    line("선별 탈락", F)
    line("참고: DC 무<24 (백테스트 신호)", [x for x in X if x[0]["DC무"] and float(x[0]["DC무"]) < c["draw"]])
    sp, sf = st(P), st(F)
    if sp and sf:
        se = math.sqrt(sp[1]*(1-sp[1])/sp[0] + sf[1]*(1-sf[1])/sf[0])
        z = (sp[1] - sf[1]) / se if se else 0
        print(f"\n통과 − 탈락 = {(sp[1]-sf[1])*100:+.1f}%p (z={z:+.2f}). "
              + ("유의하다(|z|≥2)." if abs(z) >= 2 else "아직 유의하지 않다(|z|<2) — 규칙을 손대지 말고 표본을 쌓는다."))
    print("판정 약속: 통과 60경기에서 |z|≥2 면 유지, 통과 적중이 대조군보다 낮으면 폐기. 그 전에는 문턱을 바꾸지 않는다.")
    return 0


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
    # 2026-11-11: 위 두 줄은 predict_engine 의 Dixon-Coles 무 확률이다. 실제로 후보를 고를 때 쓰는 값은
    # 전체경기기록의 순수_무(soccer_baseline·euro_baseline·심층)라서 **다른 모델**이다.
    # 같은 171경기에서 두 신호가 고르는 경기는 36경기만 겹친다. 실전 신호를 따로 찍는다.
    live = [g for g in B if g["my"]["무"] < DEF["draw"] and g["bt"] == g["mt"]]
    line("실전 신호: 순수 무<24·일치", live)
    line("  └ 두 신호 겹침", [g for g in live if g["base"]["무"] < DEF["draw"]])
    # ★ 실전과 같은 모델(soccer_baseline)을 누수 없이 과거에 깐 값으로 잰다 — 이 블록이 진짜 백테스트다.
    rb = real_baseline_map()
    R = []
    seen = set()
    for g in G:
        if g["mp"] < DEF["mp"]:
            continue
        b = rb.get((g["row"]["회차"], g["row"]["번호"]))
        k = ((g["row"].get("시각") or "")[-11:], g["row"]["홈"], g["row"]["원정"])
        if not b or k in seen:            # 같은 경기가 두 회차에 실리면 한 번만
            continue
        seen.add(k); g["rb"] = b; R.append(g)
    print(f"\n★ 실제 기준선(soccer_baseline 재현, 누수 없음) — 시장 {DEF['mp']:.0f}%+ 정배 {len(R)}경기"
          f" (유럽대항전·컵은 재현 불가라 빠진다)")
    line("선별 없음", R)
    for th in (22, 24, 26, 28):
        line(f"실제 기준선 무 < {th}%", [g for g in R if g["rb"]["무"] < th])
        line(f"실제 기준선 무 >= {th}%", [g for g in R if g["rb"]["무"] >= th])
    line("기준선 1순위 = 시장 1순위", [g for g in R if g["rb"]["1순위"] == g["mt"]])
    line("기준선 1순위 ≠ 시장 1순위", [g for g in R if g["rb"]["1순위"] != g["mt"]])
    for lo, hi in ((0, 50), (50, 60), (60, 70), (70, 101)):
        line(f"기준선이 본 시장 1순위 확률 {lo}~{hi}", [g for g in R if lo <= g["rb"][g["mt"]] < hi])
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
    print("\n2SE 를 넘지 못한다 — 아직 유의하지 않다. 시험 구간에서는 선별 없음과 차이가 없다.")
    print("이 표는 규칙을 찾은 표본으로 규칙을 잰 것이다. 믿을 숫자는 `--forward`(채택 이후 구간)다.")
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
    nooff = no_offset_leagues(a.round)
    for g in G:
        g["dl"] = dl(g["row"].get("시각"))
        g["nooff"] = g["row"]["번호"] in nooff
    sel = [g for g in G if passes(g, c)]
    sel.sort(key=lambda g: (g["dl"] or __import__("datetime").datetime.max, -g["mp"]))
    if c == DEF:        # 기본 조건으로 볼 때만 장부에 남긴다(완화·실험 조건은 전진 시험을 오염시킨다)
        import datetime as _dt
        n_new = ledger_append(ledger_rows([g for g in G if g["res"] not in L], c,
                                          _dt.datetime.now().strftime("%Y-%m-%d %H:%M"), baseline_map()))
        if n_new:
            print(f"(선별 장부에 {n_new}줄 기록 — data/선별후보.csv, 통과·탈락 모두)", file=sys.stderr)
    # 2026-11-05 사용자 지시: 추천은 심층을 거친 다리로만 한다.
    DEEP = ("심층",)
    deep = [g for g in sel if (g["depth"] or "").strip() in DEEP]
    shallow = [g for g in sel if g not in deep]
    head = (f"### {a.round}회 안전 정배 후보 — 시장 1순위 {c['mp']:.0f}%+ · 배당 {c['odds']}+ "
            f"· 내 무<{c['draw']:.0f}%" + (" · 1순위 일치" if c["agree"] else ""))
    if a.md:
        print(head + "\n")
        print("| 번호 | 경기 | 선택 | 배당 | 시장 1순위 | 내 확률 | 무 확률 | 킥오프 | 구매 마감 | 주의 |")
        print("|---|---|---|---:|---:|---:|---:|---|---|---|")
        for g in sel:
            r = g["row"]
            print(f"| {r['번호']} | {r['홈']} vs {r['원정']} | {g['mt']} | {g['od'][g['mt']]:.2f} "
                  f"| {g['mp']:.1f}% | {g['my'][g['mt']]:.1f}% | {g['my']['무']:.1f}% "
                  f"| {(r.get('시각') or '')[:11]} | {g['dl'].strftime('%m-%d %H:%M') if g['dl'] else '?'} "
                  f"| {'⚠ 리그 오프셋 없음' if g['nooff'] else ''} |")
    else:
        print(head)
        print(f"{'번호':>5} {'경기':<30}{'선택':>4}{'배당':>7}{'시장':>7}{'내확률':>7}{'무':>7}  구매마감")
        for g in sel:
            r = g["row"]
            print(f"{r['번호']:>5} {(r['홈']+' vs '+r['원정'])[:29]:<30}{g['mt']:>4}"
                  f"{g['od'][g['mt']]:>7.2f}{g['mp']:>6.1f}%{g['my'][g['mt']]:>6.1f}%"
                  f"{g['my']['무']:>6.1f}%  {g['dl'].strftime('%m-%d %H:%M') if g['dl'] else '?'}"
                  f"{'  ⚠리그오프셋없음' if g['nooff'] else ''}")
    nb = sum(1 for g in sel if g["nooff"])
    print(f"\n후보 {len(sel)}/{len(G)}경기" +
          (f"  ·  ⚠ 그중 {nb}경기는 리그 강도 오프셋이 없는 팀이 끼여 무 확률이 불완전하다" if nb else ""))
    print(f"  ├ 심층 검증됨(추천 가능) {len(deep)}경기: " +
          (", ".join(g["row"]["번호"] for g in deep) or "없음"))
    print(f"  └ 기준선만(추천 불가, 심층 필요) {len(shallow)}경기: " +
          (", ".join(g["row"]["번호"] for g in shallow) or "없음"))
    if shallow:
        print("\n  ※ 기준선만 있는 후보는 추천하지 않는다 — 2026-11-05 에 후보 4경기를 열었더니")
        print("     네 번 다 내려갔다(-4.3 ~ -8.0%p). 과신 검문을 통과한 것도 8p 내려갔다.")
        print("     위 번호들에 수집→심층 분석을 돌린 뒤 다시 이 스크립트를 실행한다.")
    if len(sel) < 2:
        print("조합을 만들려면 2경기 이상 필요하다. --relax 로 조건을 완화하거나 다음 블록을 기다린다.")
        return 0
    # 조합 — 사용자 고정 조건: 합계 배당 1.8 이상 · 같은 마감(동시간대) 우선
    import collections as _c
    grp = _c.defaultdict(list)
    for g in sel:
        grp[g["dl"]].append(g)
    for d in sorted(grp, key=lambda x: (x is None, x)):
        gs = [g for g in grp[d] if g in deep]   # 심층만 조합에 넣는다
        label = d.strftime("%m-%d %H:%M") if d else "마감 미상"
        if len(gs) < 2:
            tot = len([g for g in grp[d]])
            print(f"\n[구매 마감 {label}] 심층 검증 {len(gs)}경기 (후보 {tot}) — 조합에 심층 2경기가 필요하다")
            continue
        combos = []
        for k in (2, 3):
            for cb in itertools.combinations(gs, k):
                o = math.prod(g["od"][g["mt"]] for g in cb)
                if o < 1.8:
                    continue
                pp = math.prod(g["my"][g["mt"]] / 100 for g in cb)
                combos.append((pp * o, pp, o, cb))
        # 2026-11-11: 조합 성공률은 합계 배당이 거의 다 정한다(과거 26조합: 평균 합계 3.11배 → 성공 30.8%,
        # 132회 1.82·1.92배 두 조합은 둘 다 적중). 합계 1.8 을 넘는 선에서 가장 낮은 합계가 성공률이 가장 높다.
        # 내 확률 곱 순으로 세우되 시장 눈금 곱을 옆에 찍어 내 확률 과신이 순위를 흔드는지 보이게 한다.
        combos.sort(key=lambda x: -x[1])
        print(f"\n[구매 마감 {label}] 심층 검증 {len(gs)}경기 (후보 {len(grp[d])}) · 합계배당 1.8+ 조합")
        if not combos:
            print("  합계 배당 1.8 을 넘는 조합이 없다 — 후보 배당이 전부 낮다는 뜻이다.")
        for ev, pp, o, cb in combos[:5]:
            legs = " + ".join(f"{g['row']['번호']}{g['mt']}" for g in cb)
            mkp = math.prod(g["mp"] / 100 for g in cb)
            print(f"  {legs:<28} 합계배당 {o:>5.2f}  적중 {pp*100:>5.1f}% (시장 눈금 {mkp*100:>4.1f}%)  기대회수 {ev*100:>6.1f}%")
    print("\n주의: 아직 유의하지 않은 가설이다 — 현재 성적은 `safe_picks.py --forward` 로 본다. 실투자는 중단 상태다.")
    return 0


def main():
    ap = argparse.ArgumentParser(description="정배 중 이변·무 위험이 낮은 경기 선별")
    ap.add_argument("--round", help="회차 (예: 131, 승무패67)")
    ap.add_argument("--backtest", action="store_true", help="근거 숫자를 다시 잰다")
    ap.add_argument("--forward", action="store_true", help="채택 이후 구간만으로 선별 성적을 잰다(전진 시험)")
    ap.add_argument("--md", action="store_true")
    ap.add_argument("--relax", action="store_true", help="시장 55%%+ · 내 무<26%% 로 완화")
    ap.add_argument("--mp", type=float, help="시장 1순위 확률 하한")
    ap.add_argument("--odds", type=float, help="배당 하한")
    ap.add_argument("--draw", type=float, help="내 무 확률 상한")
    a = ap.parse_args()
    if a.backtest:
        return cmd_backtest(a)
    if a.forward:
        return cmd_forward(a)
    if not a.round:
        ap.error("--round, --backtest, --forward 중 하나는 필요하다")
    return cmd_pick(a)


if __name__ == "__main__":
    sys.exit(main())
