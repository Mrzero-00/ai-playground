#!/usr/bin/env python3
"""팀별 홈 이점 — 리그 평균으로 뭉개지 않고 팀마다 계산한다 (사용자 지시 2026-11-05).

왜 수축(shrinkage)을 쓰는가
---------------------------
팀별 홈 이점을 '관측값 그대로' 쓰면 표본오차를 실력으로 착각한다.
2026-11-05 분산성분 측정(14개 리그·264팀, 팀당 25경기 이상):

    관측분산 0.0721 = 참분산 0.0005 + 표본오차분산 0.0716   → 신뢰도 0.007

즉 그 시점의 팀별 산포(오사수나 +0.94 ~ 입스위치 -0.18)는 거의 전부 잡음이었다.
EPL·라리가는 관측분산이 표본오차보다 작아 참분산이 0 이었다.

그래서 이 도구는 **리그마다 신뢰도를 실측해** 관측 편차에 그만큼만 곱한다
(경험적 베이즈). 팀 차이가 진짜로 생기면 신뢰도가 올라가 자동으로 반영되고,
잡음이면 스스로 리그 평균으로 수축한다. 사람이 손으로 문턱을 정하지 않는다.

    팀 홈이점 = 리그평균 + 신뢰도 x (팀 관측값 - 리그평균)
    신뢰도 = max(0, 관측분산 - 표본오차분산) / 관측분산        (리그별)

쓰는 법
-------
    python3 scripts/home_edge.py table --league esp.1   # 리그 전체 표 + 신뢰도
    python3 scripts/home_edge.py card 오사수나 A빌바오     # 경기 1건 (분석가용)
    python3 scripts/home_edge.py fit                   # 전 리그 재추정 → data/home_edge.json
    python3 scripts/home_edge.py round 승무패67          # 회차 전 경기

분석가는 방향을 정하기 전에 `card` 를 읽고, **신뢰도가 0 이면 리그 평균을 쓴다**
(그게 이 도구의 답이다 — 팀 고유 홈이점이 측정되지 않았다는 뜻).
"""
import argparse, json, math, os, sys, csv, io

HANGUL_LO, HANGUL_HI = chr(0xAC00), chr(0xD7A3)   # 한글 음절 범위
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(HERE, "..", "data", "home_edge.json")
REC = os.path.join(HERE, "..", "전체경기기록.csv")
MIN_GAMES = 12          # 팀을 표에 올리는 최소 홈·원정 경기 수
MIN_TEAMS = 8           # 리그 신뢰도를 추정할 최소 팀 수


def pts(h, a):
    return (3, 0) if h > a else ((1, 1) if h == a else (0, 3))


def split(games):
    """팀별 홈/원정 승점 목록."""
    H, A = defaultdict(list), defaultdict(list)
    for x in games:
        if x.get("hg") is None or x.get("ag") is None or x.get("neutral"):
            continue
        ph, pa = pts(x["hg"], x["ag"])
        H[x["home"]].append(ph)
        A[x["away"]].append(pa)
    return H, A


def league_fit(games):
    """리그 하나의 팀별 홈이점 + 신뢰도(경험적 베이즈 수축계수)."""
    H, A = split(games)
    LAST = {}
    for x in games:
        if x.get("hg") is None or x.get("neutral"):
            continue
        d = x.get("date") or ""
        for t in (x["home"], x["away"]):
            if d > LAST.get(t, ""):
                LAST[t] = d
    raw = {}
    for t in H:
        if len(H[t]) < MIN_GAMES or len(A[t]) < MIN_GAMES:
            continue
        hp = sum(H[t]) / len(H[t])
        ap = sum(A[t]) / len(A[t])
        vh = (sum((p - hp) ** 2 for p in H[t]) / (len(H[t]) - 1)) / len(H[t]) if len(H[t]) > 1 else 1.0
        va = (sum((p - ap) ** 2 for p in A[t]) / (len(A[t]) - 1)) / len(A[t]) if len(A[t]) > 1 else 1.0
        raw[t] = dict(edge=hp - ap, hp=hp, ap=ap, nh=len(H[t]), na=len(A[t]), se2=vh + va,
                      last=LAST.get(t, ""))
    if len(raw) < MIN_TEAMS:
        return dict(mean=None, rel=0.0, v_obs=None, v_err=None, teams={})
    mu = sum(r["edge"] for r in raw.values()) / len(raw)
    v_obs = sum((r["edge"] - mu) ** 2 for r in raw.values()) / (len(raw) - 1)
    v_err = sum(r["se2"] for r in raw.values()) / len(raw)
    rel = max(0.0, v_obs - v_err) / v_obs if v_obs > 0 else 0.0
    for t, r in raw.items():
        r["shrunk"] = mu + rel * (r["edge"] - mu)
        r["dev"] = r["shrunk"] - mu
        r["raw_dev"] = r["edge"] - mu
        r.pop("se2", None)
    return dict(mean=mu, rel=rel, v_obs=v_obs, v_err=v_err, teams=raw)


def fit_all(verbose=True):
    import soccer_baseline as sb
    res = {}
    for lg in sb.LEAGUES:
        try:
            g = sb.load_results(lg)
        except Exception:
            continue
        f = league_fit(g)
        if not f["teams"]:
            continue
        res[lg] = f
        if verbose:
            print(f"  {lg:8s} 팀 {len(f['teams']):2d}  리그평균 {f['mean']:+.2f}  "
                  f"관측분산 {f['v_obs']:.4f}  오차분산 {f['v_err']:.4f}  신뢰도 {f['rel']:.3f}"
                  + ("  ← 팀 차이 측정 안 됨(리그 평균 사용)" if f["rel"] < 0.05 else ""))
    json.dump(res, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if verbose:
        print(f"\n→ {os.path.relpath(OUT, os.path.join(HERE,'..'))} ({len(res)} 리그)")
    return res


def load():
    if not os.path.exists(OUT):
        return fit_all(verbose=False)
    return json.load(io.open(OUT, encoding="utf-8"))


def _norm(s):
    """비교용 정규화. 라틴 문자는 발음기호·기호를 지우고(Atletico <-> Atletico),
    한글 음절은 보존한다.

    여기서 두 번 사고가 났다 (2026-11-05):
      1) 한글을 지우면 빈 문자열이 되어 서로 다른 한글 팀명이 전부 같아진다.
      2) 한글을 지운 "FC이마바리" -> "fc" 가 "sunderlandafc" 에 부분 일치해
         선덜랜드가 일본 2부 팀으로 해석됐다.
    그래서 한글 범위를 반드시 남기고, 부분 일치는 접두사로만 허용한다.
    """
    import unicodedata
    # NFKD 는 한글 음절을 자모(U+1100~)로 분해해 아래 범위 검사를 빠져나간다.
    # 발음기호만 떼고 NFC 로 되돌려 한글 음절을 복원한다.
    t = unicodedata.normalize("NFKD", s)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = unicodedata.normalize("NFC", t)
    keep = []
    for c in t:
        if c.isdigit() or ("a" <= c.lower() <= "z") or (HANGUL_LO <= c <= HANGUL_HI):
            keep.append(c)
    return "".join(keep).lower()


def _is_latin(k):
    return bool(k) and all(c.isdigit() or ("a" <= c <= "z") for c in k)


def resolve(name, data):
    """한글/영문 팀명 -> (리그, 팀명). 같은 팀이 여러 리그에 있으면 가장 최근에 뛴 리그."""
    try:
        import soccer_baseline as sb
        names = sb.load_names()
    except Exception:
        names = {}
    cands = {name}
    v = names.get(name)
    if isinstance(v, str):
        cands.add(v)
    elif isinstance(v, list):
        cands.update(v)
    keys = {_norm(c) for c in cands}
    keys.discard("")
    if not keys:
        return None, None

    def best(hits):
        return max(hits, key=lambda x: data[x[0]]["teams"][x[1]].get("last", ""))

    hits = [(lg, t) for lg, f in data.items() for t in f["teams"] if _norm(t) in keys]
    if hits:
        return best(hits)

    # 부분 일치: 양쪽 다 라틴 문자이고 둘 다 6자 이상, 그리고 한쪽이 다른 쪽의 접두사일 때만.
    # ("fc" 같은 짧은 조각이 긴 이름을 삼키는 것을 막는다)
    lat = {k for k in keys if _is_latin(k) and len(k) >= 6}
    if lat:
        hits = []
        for lg, f in data.items():
            for t in f["teams"]:
                nt = _norm(t)
                if not (_is_latin(nt) and len(nt) >= 6):
                    continue
                if any(nt.startswith(k) or k.startswith(nt) for k in lat):
                    hits.append((lg, t))
        if hits:
            return best(hits)
    return None, None

def fmt_team(lg, t, f, side):
    r = f["teams"][t]
    mu, rel = f["mean"], f["rel"]
    tag = "리그평균과 같다(팀 차이 미측정)" if rel < 0.05 else f"평균대비 {r['dev']:+.2f}"
    return (f"  {side} {t}  [{lg}]\n"
            f"    홈 {r['hp']:.2f} pts/경기 ({r['nh']}경기) · 원정 {r['ap']:.2f} ({r['na']}경기)\n"
            f"    관측 홈이점 {r['edge']:+.2f}  (리그평균 {mu:+.2f}, 관측 편차 {r['raw_dev']:+.2f})\n"
            f"    ▶ 쓸 값 {r['shrunk']:+.2f}  — 신뢰도 {rel:.3f} 적용, {tag}")


def cmd_card(a):
    data = load()
    print(f"=== 팀별 홈 이점 카드 ===")
    for nm, side in ((a.home, "홈  "), (a.away, "원정")):
        lg, t = resolve(nm, data)
        if not t:
            print(f"  {side} {nm}: 자료 없음 (홈·원정 각 {MIN_GAMES}경기 미만이거나 미등록 리그)")
            continue
        print(fmt_team(lg, t, data[lg], side))
    print("\n  해석: '쓸 값'이 리그평균과 같으면 그 리그에서 팀 고유 홈이점이\n"
          "        표본오차를 넘지 못한다는 뜻이다. 그때 확률을 팀별로 비틀지 않는다.")


def cmd_table(a):
    data = load()
    f = data.get(a.league)
    if not f:
        print(f"{a.league}: 자료 없음. 가능한 리그: {', '.join(sorted(data))}")
        return
    print(f"### {a.league} 팀별 홈 이점 · 리그평균 {f['mean']:+.2f} · 신뢰도 {f['rel']:.3f}")
    if f["rel"] < 0.05:
        print("※ 관측 산포가 표본오차를 넘지 못한다 — 아래 '관측' 칸은 거의 전부 잡음이고\n"
              "   '쓸 값'이 리그평균으로 수축한다. 이 리그에서는 팀별 보정을 하지 않는다.")
    print("\n| 팀 | 홈경기 | 홈 pts | 원정 pts | 관측 홈이점 | 쓸 값 |")
    print("|---|---:|---:|---:|---:|---:|")
    for t, r in sorted(f["teams"].items(), key=lambda kv: -kv[1]["edge"]):
        print(f"| {t[:26]} | {r['nh']} | {r['hp']:.2f} | {r['ap']:.2f} | {r['edge']:+.2f} | {r['shrunk']:+.2f} |")


def cmd_round(a):
    data = load()
    rows = [r for r in csv.DictReader(io.open(REC, encoding="utf-8")) if r.get("회차") == a.round]
    if not rows:
        print(f"{a.round}: 전체경기기록에 없음")
        return
    print(f"### {a.round} 팀별 홈 이점\n")
    print("| 번 | 홈 | 원정 | 홈팀 관측 | 홈팀 쓸 값 | 리그평균 | 신뢰도 | 판정 |")
    print("|---|---|---|---:|---:|---:|---:|---|")
    for r in sorted(rows, key=lambda x: int(x["번호"])):
        lg, t = resolve(r["홈"], data)
        if not t:
            print(f"| {r['번호']} | {r['홈']} | {r['원정']} | — | — | — | — | 자료 없음 |")
            continue
        f = data[lg]; d = f["teams"][t]
        verdict = "리그평균 사용" if f["rel"] < 0.05 else ("홈 강" if d["dev"] > 0.05 else ("홈 약" if d["dev"] < -0.05 else "평균"))
        print(f"| {r['번호']} | {r['홈']} | {r['원정']} | {d['edge']:+.2f} | {d['shrunk']:+.2f} | "
              f"{f['mean']:+.2f} | {f['rel']:.3f} | {verdict} |")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("fit", help="전 리그 재추정"); s.set_defaults(fn=lambda a: fit_all())
    s = sub.add_parser("table", help="리그 표"); s.add_argument("--league", required=True); s.set_defaults(fn=cmd_table)
    s = sub.add_parser("card", help="경기 1건"); s.add_argument("home"); s.add_argument("away"); s.set_defaults(fn=cmd_card)
    s = sub.add_parser("round", help="회차 전 경기"); s.add_argument("round"); s.set_defaults(fn=cmd_round)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
