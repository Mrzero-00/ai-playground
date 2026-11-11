#!/usr/bin/env python3
"""자체 분석 사전확률 + 검증된 요인, 그리고 '개입이 나았는가' 채점.

**2026-11-02 방향 전환 (사용자 지시)**: "시장 확률을 그대로 사용하지 않고 자체 분석만으로
방향성을 정하는 로직으로 바꾸고, 그 로직을 계속 발전시켜라."

왜 되돌렸나 — 10/26에 '시장을 사전확률로 삼는다'로 바꿨는데, 그 길은 두 가지를 잃는다.
  ① 시장을 출발점으로 삼으면 시장을 넘을 구조적 여지가 없다. 잘해야 시장이고 마진만큼 진다.
  ② 더 나쁘게는, 한도·실패로 조사가 비면 시장값을 그대로 복사해 넣는 일이 생겼다
     (승무패64 14경기 전부). 분석이 없는데 분석한 것처럼 기록이 남았다.

그래서 사전확률은 **자체 기준선**에서 출발한다.
  축구  soccer_baseline(pi-rating→포아송) · 유럽대항전 euro_baseline
  야구  kbo_pitching / mlb_pitching      농구  nba_baseline
그 위에 **실측으로 정보가 확인된 요인만** 얹는다(data/factor_weights.json, weight>0).
검증 안 된 유형은 수집·기록은 하되 확률을 움직이지 않는다.

시장은 **눈금**이다. 추천 판단에 쓰지 않고, 사후 비교와 진단에만 쓴다.
기준선이 없으면 **확률을 만들지 않는다** — 빈칸으로 두고 실패로 남긴다. 시장 복사는 금지다.

판정 지표: 개입한 경기에서 **기준선 대비** 개선폭. 손댄 경기가 기준선만 못하면 그 개입은 틀렸다.

    python3 scripts/prior.py apply --base 48/27/25 --fac "폼:+3.0,기타:-1.5"
    python3 scripts/prior.py report              # 본 지표(기준선 대비 개입 개선폭)
    python3 scripts/prior.py weights             # 확률에 반영 중인 요인
"""
import argparse, collections, csv, json, os, sys

# 조사가 들어가지 않은 깊이 — 성적·학습 집계에서 뺀다(2026-11-02).
# 기준선 = 모델 자동, 시장복사 = 시장 확률 그대로, 미분석 = 등록만 된 상태.
NO_ANALYSIS = ("기준선", "시장복사", "미분석")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
W = os.path.join(ROOT, "data", "factor_weights.json")
SIDES = ("승", "무", "패")


def rows(p):
    f = os.path.join(ROOT, p)
    return list(csv.DictReader(open(f, encoding="utf-8-sig"))) if os.path.exists(f) else []


def weights():
    if not os.path.exists(W):
        return {}
    d = json.load(open(W, encoding="utf-8"))
    return {t: v for t, v in (d.get("types") or {}).items()}


def cmd_weights(a):
    w = weights()
    if not w:
        print("data/factor_weights.json 없음 — factor_fit.py report 를 먼저 돌린다"); return 1
    d = json.load(open(W, encoding="utf-8"))
    print(f"추정일 {d.get('fitted')} · 학습 {d.get('n_train')} / 시험 {d.get('n_test')}경기")
    print(f"시장만 {d.get('acc_market_only')}% → 시장+요인 {d.get('acc_with_factors')}%\n")
    print(f"{'유형':<12} {'등장':>5} {'효과':>9} {'판정':>7} {'확률 반영':>9}")
    for t, v in sorted(w.items(), key=lambda x: -x[1]["effect"]):
        print(f"{t:<12} {v['n']:>5} {v['effect']:>+9.3f} {v['verdict']:>7} {'예' if v['weight'] else '아니오':>9}")
    print("\n'아니오'인 유형은 수집·기록은 하되 확률을 움직이지 않는다(실측 역부호·잡음).")
    return 0


def cmd_apply(a):
    try:
        mk = [float(x) for x in a.base.replace("/", " ").split()]
        assert len(mk) == 3
    except Exception:
        print("--base 는 자체 기준선 '승/무/패' 백분율 (예: 48/27/25)", file=sys.stderr); return 1
    w = weights()
    used, skipped, delta = [], [], 0.0
    for part in (a.fac or "").split(","):
        part = part.strip()
        if not part or ":" not in part:
            continue
        t, v = part.split(":", 1)
        t = t.strip()
        try:
            v = float(v)
        except ValueError:
            continue
        info = w.get(t)
        if info and info.get("weight"):
            used.append((t, v)); delta += v
        else:
            skipped.append((t, v, (info or {}).get("verdict", "미검증")))
    s = sum(mk)
    base = [x / s * 100 for x in mk]
    out = list(base)
    # 홈 기준 부호: 승에 더하고 패에서 뺀다(무는 건드리지 않는다 — 실측상 무 조작은 손해였다)
    out[0] = max(0.5, out[0] + delta)
    out[2] = max(0.5, out[2] - delta)
    t2 = sum(out)
    out = [x / t2 * 100 for x in out]
    print(f"사전확률(자체 기준선) {base[0]:.1f}/{base[1]:.1f}/{base[2]:.1f}")
    if used:
        print("반영한 요인: " + ", ".join(f"{t} {v:+.1f}" for t, v in used) + f"  (합계 {delta:+.1f}%p)")
    else:
        print("반영한 요인 없음 — 기본값은 보정 0이다")
    if skipped:
        print("기록만 하고 확률엔 넣지 않음: " + ", ".join(f"{t} {v:+.1f}({r})" for t, v, r in skipped))
    print(f"최종         {out[0]:.1f}/{out[1]:.1f}/{out[2]:.1f}")
    b0, f0 = base.index(max(base)), out.index(max(out))
    print(f"방향 {SIDES[b0]}" + (f" → {SIDES[f0]} (뒤집힘)" if b0 != f0 else " (유지)"))
    return 0


def _top(g, pre):
    v = {}
    for k in SIDES:
        x = g.get(f"{pre}_{k}")
        if x in (None, ""):
            if k == "무":          # 2026-11-11: 무 빈칸(농구·배구)을 0 으로 읽는다. 전에는 세 칸 중 하나라도 비면 None 을 돌려줘서 2선택지 종목이 통째로 빠졌다.
                v[k] = 0.0
                continue
            return None
        try:
            v[k] = float(x)
        except ValueError:
            return None
    return max(v, key=v.get)


def _day(g):
    """시각 칸을 'YYYY-MM-DD' 로. 대부분 'MM-DD HH:MM' 이라 연도가 없다 — 기록이 2026-10 에
    시작했으므로 10~12월은 2026, 1~9월은 2027 로 읽는다."""
    t = (g.get("시각") or "").strip()
    if len(t) >= 10 and t[4] == "-":
        return t[:10]
    if len(t) >= 5 and t[2] == "-":
        return ("2026-" if t[:2] >= "10" else "2027-") + t[:5]
    return ""


def cmd_report(a):
    """본 지표 — **내 분석이 자체 모델 기준선보다 나았는가.**
    시장과 비교하지 않는다(2026-11-02 사용자 지시: "시장 확률대로 가지 않고 분석하는 힘을 기르는 것").
    시장은 맨 오른쪽에 참고로만 찍는다. 기준선은 predict_engine 이 전 경기에 대해 내는
    자체 모델 방향(dixon_coles → poisson → pi 순으로 있는 것)을 쓴다."""
    import collections
    pred = os.path.join(ROOT, "data", "기법별예측.csv")
    if not os.path.exists(pred):
        print("predict_engine.py run 을 먼저 돌린다"); return 1
    eng = collections.defaultdict(dict)
    for r in csv.DictReader(open(pred, encoding="utf-8-sig")):
        eng[(r["회차"], r["번호"])][r["기법"]] = r["1순위"]
    gs = [g for g in rows("전체경기기록.csv")
          if g.get("결과") in SIDES and (g.get("깊이") or "") not in NO_ANALYSIS]
    # 2026-11-11: 기준선을 predict_engine 의 dixon_coles 로 읽어 왔는데, 그 엔진은 우리 경기 팀명(한글)을
    # 영문 연대기와 잇지 못해 **거의 학습되지 않은 모델**이었다(팀당 사전 갱신 중앙값 2경기).
    # 그래서 '기준선 47% → 분석 54%, +7.2p' 는 분석력이 아니라 빈 모델과의 차이였다.
    # 분석가가 실제로 출발하는 soccer_baseline 을 누수 없이 재현한 값(baseline_replay.py)으로 바꾼다.
    # 내 분석도 순수 열로 읽는다 — 보정 열은 기준선 행에서 시장값으로 덮인 적이 있다.
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import baseline_replay
        real = baseline_replay.load()
    except Exception:
        real = {}
    if not real:
        print("data/기준선재현.csv 없음 — python3 scripts/baseline_replay.py 를 먼저 돌린다"); return 1
    xs, seen = [], set()
    for g in gs:
        me = _top(g, "순수")
        key = (g.get("회차"), g.get("번호"))
        dup = (_day(g), g.get("홈"), g.get("원정"))
        if dup in seen:                  # 같은 경기가 두 회차에 실리면 한 번만
            continue
        base = (real.get(key) or {}).get("1순위")
        if me and base:
            seen.add(dup)
            xs.append((g, me, base, _top(g, "시장")))
    if not xs:
        print("비교 가능한 경기 없음 — predict_engine.py run 으로 기준선을 먼저 만든다"); return 1
    keep = [x for x in xs if x[1] == x[2]]
    moved = [x for x in xs if x[1] != x[2]]
    print(f"분석 경기 {len(xs)}건 — **실제 기준선(soccer_baseline 재현) 대비** · 축구 리그 경기만 (시장은 참고)\n")
    print(f"{'구분':<26} {'경기':>5} {'내 분석':>8} {'기준선':>8} {'개선폭':>8} {'시장':>8}")
    print("-" * 70)
    def line(lab, b):
        if not b:
            return
        a1 = sum(1 for g, me, _, _ in b if me == g["결과"]) / len(b) * 100
        a2 = sum(1 for g, _, bs, _ in b if bs == g["결과"]) / len(b) * 100
        mk = [x for x in b if x[3]]
        a3 = (sum(1 for g, _, _, m in mk if m == g["결과"]) / len(mk) * 100) if mk else float("nan")
        print(f"{lab:<26} {len(b):>5} {a1:>7.1f}% {a2:>7.1f}% {a1-a2:>+7.1f}p {a3:>7.1f}%")
    line("기준선 그대로 둠", keep)
    line("분석해서 방향을 바꿈", moved)
    line("전체", xs)
    print(f"\n개입 비율 {len(moved)/len(xs)*100:.1f}% ({len(moved)}/{len(xs)})")
    print("시장 열은 눈금일 뿐 목표가 아니다 — 시장을 따라가는 것이 아니라 기준선을 넘는 것이 과제다.")

    # 2026-11-11: 위 표는 서로 다른 분석 방식의 기록을 한데 섞는다. 11-02 전의 '내 분석'은
    # 시장 확률을 본(10-26~11-01 은 아예 시장을 사전확률로 삼은) 결과라서, 거기서 기준선을
    # 이긴 것은 자체 분석력이 아니라 시장 정보일 수 있다. 지금 방식의 증거는 마지막 줄뿐이다.
    def paired(lab, b):
        if not b:
            print(f"{lab:<24} 경기 0"); return
        d = [(me == g["결과"]) - (bs == g["결과"]) for g, me, bs, _ in b]
        n = len(d); m = sum(d) / n
        se = (sum((x - m) ** 2 for x in d) / max(n - 1, 1) / n) ** 0.5
        mv = sum(1 for g, me, bs, _ in b if me != bs)
        a1 = sum(1 for g, me, _, _ in b if me == g["결과"]) / n * 100
        mk = [x for x in b if x[3]]
        a3 = (sum(1 for g, _, _, mm in mk if mm == g["결과"]) / len(mk) * 100) if mk else float("nan")
        print(f"{lab:<24} {n:>4} {a1:>6.1f}% {m*100:>+7.1f}p ±{2*se*100:>4.1f} {mv:>5} {a3:>7.1f}%")
    print("\n-- 분석 방식 시기별 (전체 분석 경기 기준 · 개선폭은 2SE 와 같이 읽는다)")
    print(f"{'시기':<24} {'경기':>4} {'내 분석':>6} {'개선폭':>7} {'2SE':>5} {'개입':>5} {'시장':>7}")
    eras = (("10-25 까지 (시장 혼합·참조)", lambda t: t < "2026-10-26"),
            ("10-26~11-01 (시장=사전확률)", lambda t: "2026-10-26" <= t < "2026-11-02"),
            ("★ 11-02 이후 (자체 기준선)", lambda t: t >= "2026-11-02"))
    for lab, f in eras:
        paired(lab, [x for x in xs if f(_day(x[0]))])
    now = [x for x in xs if _day(x[0]) >= "2026-11-02"]
    print("본 지표는 ★ 줄이다. 그 앞 두 줄은 시장을 본 분석이라 지금 방식의 증거가 아니다.")
    if now:
        print("\n-- ★ 11-02 이후를 종목별로")
        for sp in sorted({x[0].get("종목", "") for x in now}):
            paired("   " + sp, [x for x in now if x[0].get("종목", "") == sp])
        nb = sum(1 for g in gs if _day(g) >= "2026-11-02") - len(now)
        if nb:
            print(f"   (11-02 이후 분석 {nb}경기는 재현 가능한 기준선이 없어 빠졌다 — "
                  "유럽대항전·컵·농구·배구·야구. 이 경기들은 방향 적중률만 따로 본다)")
    if moved:
        print("\n-- 개입을 회차별로")
        d = collections.defaultdict(lambda: [0, 0, 0])
        for g, me, bs, _ in moved:
            x = d[g["회차"]]; x[0] += 1; x[1] += (me == g["결과"]); x[2] += (bs == g["결과"])
        for k in sorted(d, key=lambda z: (len(str(z)), str(z))):
            n, h, m = d[k]
            if n < 3:
                continue
            print(f"   {k:<9} 개입 {n:3d}건  내 {h/n*100:5.1f}%  기준선 {m/n*100:5.1f}%  {(h-m)/n*100:+6.1f}p")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("apply"); p.add_argument("--base", required=True, help="자체 기준선 승/무/패 (예: 48/27/25)")
    p.add_argument("--fac", default="")
    p.set_defaults(f=cmd_apply)
    s.add_parser("report").set_defaults(f=cmd_report)
    s.add_parser("weights").set_defaults(f=cmd_weights)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
