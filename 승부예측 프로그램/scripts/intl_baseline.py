#!/usr/bin/env python3
"""국가대표 경기 자체 기준선 — 결과만 쓰는 Elo → 승/무/패.

왜 (2026-11-12):
  A매치 주간에는 회차의 축구가 전부 국가대표 경기인데 자체 기준선이 없었다(soccer_baseline 은 리그,
  euro_baseline 은 유럽 클럽 대항전). 기준선이 없으면 확률을 만들지 않으므로 134회·승무패68 의
  축구 전 경기가 빈칸이 된다. 시장을 복사하지 않고 방향을 내려면 자체 모델이 필요하다.

무엇:
  data/intl/results.csv (martj42/international_results, 1872~) 를 시간 순으로 훑는 World Football Elo.
  K 는 대회 무게(친선 20 · 네이션스리그·예선 40 · 대륙 본선 50 · 월드컵 60) × 골차 배수, 홈 이점 HOME 점.
  승/무/패는 Elo 차 → 순서형 로지스틱(B, C). B·C·HOME 은 2006~2019 로 맞추고 2020~ 로 시험했다.

  python3 scripts/intl_baseline.py --backtest
  python3 scripts/intl_baseline.py card 잉글랜드 크로아티아 [--neutral] [--date 2026-11-13]
  python3 scripts/intl_baseline.py round 134          # 회차의 국가대표 경기 전부
  python3 scripts/intl_baseline.py --update           # 결과 자료 다시 받기

한계: 선수단·결장·동기(친선 로테이션)를 모른다. 친선전은 시험 구간 적중률이 대회 경기보다 낮다(--backtest).
"""
import argparse, csv, json, math, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "data", "intl", "results.csv")
NAMES = os.path.join(ROOT, "data", "intl", "names.json")
LOG = os.path.join(ROOT, "전체경기기록.csv")
URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"

HOME = 125.0     # 홈 이점(Elo 점) — fit() 로 맞춘 값
B = 0.00500      # 순서형 로지스틱 기울기
C = 0.650        # 무 폭
START = 1500.0
INTL_LEAGUES = ("국제친선", "네이션스리그", "월드컵", "아시안컵", "유로", "코파", "A매치", "골드컵", "네이션스컵")


def kfac(t):
    t = t.lower()
    if "friendly" in t:
        return 20
    if "fifa world cup" == t:
        return 60
    if "qualification" in t or "nations league" in t:
        return 40
    if any(x in t for x in ("uefa euro", "copa am", "african cup", "asian cup", "gold cup", "confederations")):
        return 50
    return 30


def gmult(d):
    d = abs(d)
    return 1.0 if d <= 1 else 1.5 if d == 2 else 1.75 + (d - 3) / 8.0


def probs(dr, b=None, c=None):
    """Elo 차(홈 − 원정, 홈 이점 포함) → (승, 무, 패)"""
    b = B if b is None else b; c = C if c is None else c
    sig = lambda x: 1 / (1 + math.exp(-x))
    pa = sig(-c - b * dr)
    ph = 1 - sig(c - b * dr)
    return ph, 1 - ph - pa, pa


_G = []


def games():
    if _G:
        return _G
    out = []
    for r in csv.DictReader(open(SRC, encoding="utf-8")):
        try:
            out.append((r["date"], r["home_team"], r["away_team"], int(r["home_score"]), int(r["away_score"]),
                        r["tournament"], r["neutral"].upper() == "TRUE"))
        except ValueError:
            continue
    out.sort(key=lambda g: g[0])
    _G.extend(out)
    return _G


def walk(G, home=None, until=None):
    """시간 순으로 훑으며 (경기, 경기 전 Elo 차, 팀별 경기 수) 를 낸다."""
    home = HOME if home is None else home
    R, N, rows = {}, {}, []
    for g in G:
        d, h, a, hg, ag, t, neu = g
        if until and d >= until:
            break
        rh, ra = R.get(h, START), R.get(a, START)
        dr = rh - ra + (0 if neu else home)
        rows.append((g, dr, min(N.get(h, 0), N.get(a, 0))))
        we = 1 / (1 + 10 ** (-dr / 400))
        w = 1.0 if hg > ag else 0.5 if hg == ag else 0.0
        delta = kfac(t) * gmult(hg - ag) * (w - we)
        R[h], R[a] = rh + delta, ra - delta
        N[h], N[a] = N.get(h, 0) + 1, N.get(a, 0) + 1
    return rows, R, N


def _res(g):
    return 0 if g[3] > g[4] else 1 if g[3] == g[4] else 2


def fit():
    G = games()
    best = None
    for home in (100, 125, 150, 175):
        rows = [(g, dr) for g, dr, n in walk(G, home)[0] if "2006" <= g[0] < "2020" and n >= 30]
        for b in (0.0040, 0.0044, 0.0046, 0.0048, 0.0050, 0.0052):
            for c in (0.50, 0.55, 0.60, 0.65, 0.70):
                ll = sum(math.log(max(probs(dr, b, c)[_res(g)], 1e-9)) for g, dr in rows) / len(rows)
                if best is None or ll > best[0]:
                    best = (ll, home, b, c, len(rows))
    print(f"학습(2006~2019, 두 팀 다 30경기+) {best[4]}경기: HOME={best[1]} B={best[2]} C={best[3]} 로그우도 {best[0]:.4f}")
    return 0


def backtest():
    G = games()
    rows = [(g, dr) for g, dr, n in walk(G)[0] if g[0] >= "2020" and n >= 30]

    def line(lab, sub):
        n = len(sub)
        if n < 30:
            return
        hit = said = 0.0
        for g, dr in sub:
            p = probs(dr)
            k = max(range(3), key=lambda i: p[i])
            hit += k == _res(g); said += p[k]
        se = math.sqrt(hit / n * (1 - hit / n) / n)
        print(f"{lab:<28}{n:>6}  적중 {hit/n*100:5.1f}% ±{2*se*100:4.1f}  내 말 {said/n*100:5.1f}%  잔차 {(hit-said)/n*100:+5.1f}p")
    print("국가대표 Elo 기준선 — 시험 구간 2020~ (상수는 2006~2019 로 맞춤)\n")
    line("전체", rows)
    line("  친선", [x for x in rows if "friendly" in x[0][5].lower()])
    line("  대회(친선 제외)", [x for x in rows if "friendly" not in x[0][5].lower()])
    line("  UEFA 네이션스리그", [x for x in rows if x[0][5] == "UEFA Nations League"])
    print()
    for lo, hi in ((0, 45), (45, 55), (55, 60), (60, 70), (70, 80), (80, 101)):
        line(f"  1순위 {lo}~{hi}%", [x for x in rows if lo <= max(probs(x[1])) * 100 < hi])
    print()
    for lo, hi in ((60, 70), (70, 80), (80, 101)):
        line(f"  친선 1순위 {lo}~{hi}%", [x for x in rows if "friendly" in x[0][5].lower() and lo <= max(probs(x[1])) * 100 < hi])
        line(f"  대회 1순위 {lo}~{hi}%", [x for x in rows if "friendly" not in x[0][5].lower() and lo <= max(probs(x[1])) * 100 < hi])
    d = [x for x in rows if (lambda p: p[1] >= max(p[0], p[2]) - 0.08)(probs(x[1]))]
    print(f"\n무 확률이 1순위와 8p 안: {len(d)}경기 실제 무 {sum(_res(g)==1 for g,_ in d)/max(len(d),1)*100:.1f}%"
          f" (전체 무 {sum(_res(g)==1 for g,_ in rows)/len(rows)*100:.1f}%)")
    return 0


def name(ko):
    m = json.load(open(NAMES, encoding="utf-8")) if os.path.exists(NAMES) else {}
    ko = ko.strip()
    if ko in m:
        return m[ko]
    c = [v for k, v in m.items() if k.startswith(ko) or ko.startswith(k)]   # 승무패는 팀명을 4자로 자른다
    return c[0] if len(set(c)) == 1 else None


def baseline(home, away, neutral=False, date=None):
    """한글 팀명 → {'승','무','패'(0~1), 'elo_h','elo_a','n_h','n_a','last'} 또는 None"""
    h, a = name(home), name(away)
    if not h or not a:
        return None
    _, R, N = walk(games(), until=date)
    if h not in R or a not in R:
        return None
    p = probs(R[h] - R[a] + (0 if neutral else HOME))
    return {"승": p[0], "무": p[1], "패": p[2], "elo_h": R[h], "elo_a": R[a], "n_h": N[h], "n_a": N[a], "en": (h, a)}


def recent(team, k=8, until=None):
    out = [g for g in games() if team in (g[1], g[2]) and (not until or g[0] < until)][-k:]
    return [f"{g[0]} {g[1]} {g[3]}-{g[4]} {g[2]} ({g[5]}{' 중립' if g[6] else ''})" for g in out]


def card(home, away, neutral, date):
    b = baseline(home, away, neutral, date)
    if not b:
        print(f"기준선 없음 — 팀명 매핑 실패({home}→{name(home)}, {away}→{name(away)}). data/intl/names.json 에 추가한다.")
        return 1
    h, a = b["en"]
    print(f"{home}({h}) Elo {b['elo_h']:.0f} · {b['n_h']}경기  vs  {away}({a}) Elo {b['elo_a']:.0f} · {b['n_a']}경기"
          f"  {'중립' if neutral else f'홈 이점 +{HOME:.0f}'}")
    print(f"기준선: 승 {b['승']*100:.1f} / 무 {b['무']*100:.1f} / 패 {b['패']*100:.1f}")
    for t in (h, a):
        print(f"\n{t} 최근 8경기"); print("\n".join("  " + x for x in recent(t, until=date)))
    return 0


def is_intl(g):
    return g.get("종목") == "축구" and any(k in (g.get("리그") or "") for k in INTL_LEAGUES)


def round_(rnd):
    cache = {}
    for g in csv.DictReader(open(LOG, encoding="utf-8-sig")):
        if g["회차"] != rnd or not is_intl(g) or g.get("결과"):
            continue
        b = baseline(g["홈"], g["원정"])
        if not b:
            print(f"{g['번호']:>5} {g['홈']} vs {g['원정']}: 기준선 없음(팀명 {name(g['홈'])}/{name(g['원정'])})"); continue
        print(f"{g['번호']:>5} {g['시각'][-11:]} {g['홈']} vs {g['원정']}: {b['승']*100:.1f}/{b['무']*100:.1f}/{b['패']*100:.1f}"
              f"  Elo {b['elo_h']:.0f}-{b['elo_a']:.0f}  | 시장 {g.get('시장_승','')}/{g.get('시장_무','')}/{g.get('시장_패','')}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?"); ap.add_argument("args", nargs="*")
    ap.add_argument("--backtest", action="store_true"); ap.add_argument("--fit", action="store_true")
    ap.add_argument("--update", action="store_true"); ap.add_argument("--neutral", action="store_true")
    ap.add_argument("--date")
    a = ap.parse_args()
    if a.update:
        urllib.request.urlretrieve(URL, SRC); print("받음:", SRC); return 0
    if a.fit:
        return fit()
    if a.backtest:
        return backtest()
    if a.cmd == "card" and len(a.args) == 2:
        return card(a.args[0], a.args[1], a.neutral, a.date)
    if a.cmd == "round" and a.args:
        return round_(a.args[0])
    ap.print_help(); return 1


if __name__ == "__main__":
    sys.exit(main())
