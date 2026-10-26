#!/usr/bin/env python3
"""시장 기준 사전확률 + 검증된 요인만 올리기, 그리고 '개입이 나았는가' 채점.

구조 전환(2026-10-26, CLAUDE.md ★★★★★):
  기본값은 **보정 0**이다. 사전확률(시장)을 그대로 두는 것이 기본이고,
  경기 후 검증 가능한 사실이 있는 소수 경기만 손댄다.
  손댈 때도 `data/factor_weights.json` 에서 weight>0 로 판정된 유형만 확률을 움직인다.
  나머지 유형은 수집·기록은 계속하되 확률에는 넣지 않는다(실측에서 역부호·잡음이었다).

판정 지표도 바뀌었다. 전체 적중률은 경기 구성에 끌려다니므로 보조다.
**본 지표 = 개입한 경기에서 사전확률 대비 개선폭.** 손댄 경기가 사전확률만 못하면 그 개입은 틀린 것이다.

    python3 scripts/prior.py apply --mk 52/26/22 --fac "결장:+3.0,폼:-1.5"
    python3 scripts/prior.py report              # 개입 채점(본 지표)
    python3 scripts/prior.py weights             # 지금 쓰는 유형별 가중치
"""
import argparse, collections, csv, json, os, sys

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
        mk = [float(x) for x in a.mk.replace("/", " ").split()]
        assert len(mk) == 3
    except Exception:
        print("--mk 는 '승/무/패' 백분율 (예: 52/26/22)", file=sys.stderr); return 1
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
    print(f"사전확률(시장) {base[0]:.1f}/{base[1]:.1f}/{base[2]:.1f}")
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
            return None
        try:
            v[k] = float(x)
        except ValueError:
            return None
    return max(v, key=v.get)


def cmd_report(a):
    gs = [g for g in rows("전체경기기록.csv")
          if g.get("결과") in SIDES and (g.get("깊이") or "") != "기준선"]
    xs = []
    for g in gs:
        me, mk = _top(g, "보정") or _top(g, "순수"), _top(g, "시장")
        if me and mk:
            xs.append((g, me, mk))
    if not xs:
        print("비교 가능한 경기 없음"); return 1
    keep = [(g, me, mk) for g, me, mk in xs if me == mk]
    moved = [(g, me, mk) for g, me, mk in xs if me != mk]
    print(f"분석 경기 {len(xs)}건 — 사전확률(시장) 대비\n")
    print(f"{'구분':<26} {'경기':>5} {'내 적중':>8} {'사전확률':>9} {'개선폭':>8}")
    print("-" * 60)
    for lab, b in (("사전확률 그대로 둠", keep), ("개입해서 방향을 바꿈", moved)):
        if not b:
            continue
        a1 = sum(1 for g, me, _ in b if me == g["결과"]) / len(b) * 100
        a2 = sum(1 for g, _, mk in b if mk == g["결과"]) / len(b) * 100
        print(f"{lab:<26} {len(b):>5} {a1:>7.1f}% {a2:>8.1f}% {a1-a2:>+7.1f}p")
    a1 = sum(1 for g, me, _ in xs if me == g["결과"]) / len(xs) * 100
    a2 = sum(1 for g, _, mk in xs if mk == g["결과"]) / len(xs) * 100
    print(f"{'전체':<26} {len(xs):>5} {a1:>7.1f}% {a2:>8.1f}% {a1-a2:>+7.1f}p")
    print(f"\n개입 비율 {len(moved)/len(xs)*100:.1f}% ({len(moved)}/{len(xs)})")
    print("본 지표는 '개입해서 방향을 바꾼' 줄의 개선폭이다. 음수면 그 개입은 손해였다.")
    if moved:
        print("\n-- 개입한 경기를 회차별로")
        d = collections.defaultdict(lambda: [0, 0, 0])
        for g, me, mk in moved:
            x = d[g["회차"]]; x[0] += 1; x[1] += (me == g["결과"]); x[2] += (mk == g["결과"])
        for k in sorted(d, key=lambda z: int(z) if str(z).isdigit() else 0):
            n, h, m = d[k]
            if n < 3:
                continue
            print(f"   {k}회  개입 {n:2d}건  내 {h/n*100:5.1f}%  사전확률 {m/n*100:5.1f}%  {(h-m)/n*100:+5.1f}p")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("apply"); p.add_argument("--mk", required=True); p.add_argument("--fac", default="")
    p.set_defaults(f=cmd_apply)
    s.add_parser("report").set_defaults(f=cmd_report)
    s.add_parser("weights").set_defaults(f=cmd_weights)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
