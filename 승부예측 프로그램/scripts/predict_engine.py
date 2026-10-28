#!/usr/bin/env python3
"""여러 분석 기법을 **동시에** 돌려 경기마다 예측을 남기는 엔진.

사용자 지시 2026-10-26: "그냥 한 번에 지금부터 전부 데이터 쌓아."
기법을 매주 하나씩 늘리는 대신 전부 켜 두고, 경기마다 각 기법의 예측을 한 줄씩 적는다.
나중에 리그·종목·확률 구간 무엇으로든 다시 쪼갤 수 있게 하는 것이 목적이다.

구조 — 결과가 있는 모든 경기를 **시간 순으로 한 번 훑으면서**, 경기 직전 상태로 예측을 내고
그다음 결과로 상태를 갱신한다. 이렇게 해야 미래를 보고 맞히는 일이 없다.

자료원(합쳐서 하나의 연대기로):
  · football-data 5대 리그 7시즌 (data/<Div>_<시즌>.csv)   — 결과·배당
  · teamdb ESPN 캐시 (5대 리그 + 챔피언십·J1·MLS)          — 결과
  · 전체경기기록.csv                                      — 우리가 분석한 경기(점수 있는 것)

기법:
  elo            승패 결과만으로 갱신하는 레이팅 → 레이팅차를 3지선다로
  elo_goal       득실차를 K에 반영한 Elo
  pi             홈/원정을 따로 두는 pi-rating → 기대 득실차 → 포아송
  poisson        팀별 공격·수비력 온라인 추정 → 독립 포아송
  dixon_coles    포아송 + 저득점 무 보정(rho) + 시간 가중
  market         배당에서 뽑은 확률(있을 때만)

    python3 scripts/predict_engine.py run          # 전 경기 예측 → data/기법별예측.csv 갱신
    python3 scripts/predict_engine.py run --quick  # football-data 만(빠름)
"""
import argparse, collections, csv, datetime as dt, glob, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, HERE)
OUT = os.path.join(ROOT, "data", "기법별예측.csv")
PCOLS = ["회차", "번호", "경기", "시각", "종목", "리그", "기법", "승", "무", "패",
         "1순위", "결과", "적중", "시장1순위", "시장최대", "기록일"]
MAXG = 8
LAB = ("승", "무", "패")


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


# ----------------------------------------------------------- 자료 모으기
def from_footballdata():
    out = []
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
                mk = {"승": (1 / oh) / s * 100, "무": (1 / od) / s * 100, "패": (1 / oa) / s * 100}
            out.append({"d": d, "lg": r.get("Div", ""), "sport": "축구",
                        "h": (r.get("HomeTeam") or "").strip(), "a": (r.get("AwayTeam") or "").strip(),
                        "hg": int(hg), "ag": int(ag), "mk": mk, "own": None})
    return out


def from_teamdb():
    import teamdb as T
    out = []
    codes = list(T.LEAGUES.values()) + list(getattr(T, "ESPN_ONLY", {}).values())
    for code in codes:
        db = T.jload(os.path.join(T.DB, "espn", f"{code}.json"), {})
        for eid, e in db.items():
            hs, as_ = (e.get("home") or {}).get("score"), (e.get("away") or {}).get("score")
            if hs in (None, "") or as_ in (None, ""):
                continue
            try:
                d = dt.date.fromisoformat((e.get("date") or "")[:10])
                hg, ag = int(hs), int(as_)
            except (ValueError, TypeError):
                continue
            out.append({"d": d, "lg": code, "sport": "축구",
                        "h": (e.get("home") or {}).get("team", ""), "a": (e.get("away") or {}).get("team", ""),
                        "hg": hg, "ag": ag, "mk": None, "own": None})
    return out


def from_ours():
    import re
    p = os.path.join(ROOT, "전체경기기록.csv")
    now = dt.date.today()
    out = []
    for g in csv.DictReader(open(p, encoding="utf-8-sig")):
        if g.get("결과") not in LAB:
            continue
        m = re.match(r"^\s*(\d+)\s*[:：]\s*(\d+)", (g.get("점수") or ""))
        t = (g.get("시각") or "").strip()
        md = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", t) or re.match(r"^(\d{1,2})-(\d{1,2})", t)
        d = None
        if md:
            gs = md.groups()
            try:
                d = dt.date(int(gs[0]), int(gs[1]), int(gs[2])) if len(gs) == 3 else None
                if d is None:
                    for y in (now.year, now.year - 1):
                        try:
                            c = dt.date(y, int(gs[0]), int(gs[1]))
                        except ValueError:
                            continue
                        if c <= now + dt.timedelta(days=2):
                            d = c; break
            except ValueError:
                d = None
        mk = None
        v = {k: _f(g.get(f"시장_{k}")) for k in LAB}
        if all(x is not None for x in v.values()) and sum(v.values()) > 0:
            mk = v
        out.append({"d": d or now, "lg": g.get("리그", ""), "sport": g.get("종목", "축구"),
                    "h": g.get("홈", ""), "a": g.get("원정", ""),
                    "hg": int(m.group(1)) if m else None, "ag": int(m.group(2)) if m else None,
                    "mk": mk, "own": g})
    return out


# ----------------------------------------------------------- 확률 변환
PARAM = os.path.join(ROOT, "data", "기법파라미터.json")
DEFAULTS = {
    "elo":         {"k": 20.0, "home": 70.0, "draw_w": 120.0},
    "elo_goal":    {"k": 20.0, "home": 70.0, "draw_w": 120.0, "gmul": 0.5},
    "pi":          {"lr": 0.06, "base": 1.35, "draw_w": 0.0},
    "poisson":     {"lr": 0.045, "gamma": 0.25, "mu": 0.30},
    "dixon_coles": {"lr": 0.045, "gamma": 0.25, "mu": 0.30, "rho": -0.07},
    "시장앵커±6":    {"cap": 6.0},
    "갈림→무가중":    {"scale": 0.5, "cap": 8.0},
}


def load_params():
    """기법별 파라미터. 각 기법이 자기 회고로 스스로 고친 값이 여기 쌓인다."""
    d = {k: dict(v) for k, v in DEFAULTS.items()}
    if os.path.exists(PARAM):
        try:
            cur = (json.load(open(PARAM, encoding="utf-8")) or {}).get("current") or {}
            for k, v in cur.items():
                if k in d and isinstance(v, dict):
                    d[k].update({x: y for x, y in v.items() if x in d[k]})
        except Exception:
            pass
    return d


def pois(lh, la, rho=0.0):
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
    t = H + D + A or 1
    return {"승": H / t * 100, "무": D / t * 100, "패": A / t * 100}


def from_rating_gap(gap, draw_w=120.0):
    """레이팅 차 → 3지선다. 무 폭은 고정 상수(학습 없이도 비교군으로 쓸 수 있게)."""
    pw = 1 / (1 + 10 ** (-gap / 400))
    pd = max(0.08, 0.30 * math.exp(-abs(gap) / draw_w))
    h = pw * (1 - pd); a = (1 - pw) * (1 - pd)
    t = h + pd + a
    return {"승": h / t * 100, "무": pd / t * 100, "패": a / t * 100}


# ----------------------------------------------------------- 직접 만든 기법
def _norm(p):
    t = sum(p.values()) or 1
    return {k: v / t * 100 for k, v in p.items()}


def my_methods(r, base, P=None):
    """사용자 위임 2026-10-26: "정립된 기법 외에 네가 직접 만들어도 된다."
    측정에서 나온 사실 위에 세운다 —
      ① 시장이 단일 기법으로 가장 강하다(53.4% vs 모델 51~52%).
      ② 모델을 시장과 섞으면 시장보다 조금 낮아진다 → 모델을 '대체'가 아니라 '소폭 이탈'로 써야 한다.
      ③ 기법들이 갈릴 때가 바로 어려운 경기다 → 갈림 정도 자체가 정보다.
    """
    P = P or load_params()
    out = {}
    models = {k: v for k, v in base.items() if k != "market"}
    mk = base.get("market")

    # 합의 — 모델들의 단순 평균. 개별 모델의 잡음을 상쇄시킨다.
    if models:
        acc = collections.defaultdict(float)
        for p in models.values():
            for k in LAB:
                acc[k] += p[k]
        out["합의(모델평균)"] = _norm({k: acc[k] / len(models) for k in LAB})

    if not mk:
        return out

    # 시장앵커 — 시장에서 출발하되 모델 합의 쪽으로 최대 6%p 만 끌어온다.
    # 전면 혼합(50:50)은 시장보다 낮았고, 모델을 버리면 정보가 0이다. 그 사이를 캡으로 잡는다.
    if "합의(모델평균)" in out:
        cons = out["합의(모델평균)"]
        anc = {}
        for k in LAB:
            cap = P["시장앵커±6"]["cap"]
            d = max(-cap, min(cap, cons[k] - mk[k]))
            anc[k] = max(0.5, mk[k] + d)
        out["시장앵커±6"] = _norm(anc)

        # 합의이탈 — 모델 합의가 시장과 크게 갈리면 그 경기는 무가 늘어난다(실측: 접전 구간 무 31%).
        # 갈림 크기에 비례해 무를 키우고 양끝을 깎는다. 방향은 시장을 따른다.
        gap = max(abs(cons[k] - mk[k]) for k in LAB)
        gp = P["갈림→무가중"]
        bump = min(gp["cap"], gap * gp["scale"])
        dv = {"승": max(0.5, mk["승"] - bump / 2), "무": mk["무"] + bump,
              "패": max(0.5, mk["패"] - bump / 2)}
        out["갈림→무가중"] = _norm(dv)
    return out


# ----------------------------------------------------------- 엔진
def run(rows, P=None, want=None):
    """want 를 주면 그 기법만 계산한다(튜닝 때 빠르게)."""
    P = P or load_params()
    elo = collections.defaultdict(lambda: 1500.0)
    elo_g = collections.defaultdict(lambda: 1500.0)
    pi_h = collections.defaultdict(float); pi_a = collections.defaultdict(float)
    att = collections.defaultdict(float); dfn = collections.defaultdict(float)
    pe, pg, pp, pd, pi_p = P["elo"], P["elo_goal"], P["poisson"], P["dixon_coles"], P["pi"]
    mu, gamma, LR = math.log(1.0 + pp["mu"] + 0.05), pp["gamma"], pp["lr"]
    preds = []
    for r in rows:
        h, a = r["h"], r["a"]
        if not (h and a):
            continue
        key = (h, a)
        lh = min(max(math.exp(mu + att[h] - dfn[a] + gamma), .15), 6)
        la = min(max(math.exp(mu + att[a] - dfn[h]), .15), 6)
        gd = (pi_h[h] - pi_a[a])
        # 축구 공식을 야구·농구·배구에 쓰면 뜻이 없다. 종목이 축구일 때만 레이팅 기법을 낸다.
        cand = {}
        if (r.get("sport") or "축구") == "축구":
            cand.update({
                "elo": from_rating_gap(elo[h] + pe["home"] - elo[a], pe["draw_w"]),
                "elo_goal": from_rating_gap(elo_g[h] + pg["home"] - elo_g[a], pg["draw_w"]),
                "pi": pois(max(.15, pi_p["base"] + gd / 2), max(.15, pi_p["base"] - gd / 2)),
                "poisson": pois(lh, la),
                "dixon_coles": pois(lh, la, rho=pd["rho"]),
            })
            if want:
                cand = {k: v for k, v in cand.items() if k in want}
        if r["mk"]:
            cand["market"] = r["mk"]
        cand.update(my_methods(r, cand, P))
        preds.append((r, cand))
        # --- 결과로 상태 갱신
        if r["hg"] is None or r["ag"] is None:
            continue
        hg, ag = r["hg"], r["ag"]
        sc = 1.0 if hg > ag else (0.5 if hg == ag else 0.0)
        for tbl, kk, hadv in ((elo, pe["k"], pe["home"]),
                              (elo_g, pg["k"] * (1 + pg["gmul"] * min(abs(hg - ag), 3)), pg["home"])):
            ex = 1 / (1 + 10 ** (-(tbl[h] + hadv - tbl[a]) / 400))
            tbl[h] += kk * (sc - ex); tbl[a] -= kk * (sc - ex)
        err = (hg - ag) - gd
        pi_h[h] += pi_p["lr"] * err; pi_a[a] -= pi_p["lr"] * err
        att[h] += LR * (hg - lh); dfn[a] -= LR * (hg - lh)
        att[a] += LR * (ag - la); dfn[h] -= LR * (ag - la)
        for t in (h, a):
            att[t] = min(max(att[t], -1.2), 1.2); dfn[t] = min(max(dfn[t], -1.2), 1.2)
            pi_h[t] = min(max(pi_h[t], -3), 3); pi_a[t] = min(max(pi_a[t], -3), 3)
    return preds


def cmd_run(a):
    rows = from_footballdata()
    if not a.quick:
        rows += from_teamdb() + from_ours()
    rows.sort(key=lambda r: r["d"])
    print(f"연대기 {len(rows)}경기 ({rows[0]['d']} ~ {rows[-1]['d']})")
    preds = run(rows)
    mine = [(r, c) for r, c in preds if r["own"] is not None and r["own"].get("결과") in LAB]
    print(f"우리 기록 경기 {len(mine)}건에 대해 기법 예측 생성")
    today = dt.date.today().isoformat()
    out = []
    for r, cand in mine:
        g = r["own"]
        mk = r["mk"]
        mtop = max(mk, key=mk.get) if mk else ""
        mmax = f"{max(mk.values()):.1f}" if mk else ""
        for name, pr in cand.items():
            t = max(pr, key=pr.get)
            out.append({"회차": g.get("회차"), "번호": g.get("번호"),
                        "경기": f"{g.get('홈')} vs {g.get('원정')}", "시각": g.get("시각", ""),
                        "종목": g.get("종목", ""), "리그": g.get("리그", ""), "기법": name,
                        "승": f"{pr['승']:.1f}", "무": f"{pr['무']:.1f}", "패": f"{pr['패']:.1f}",
                        "1순위": t, "결과": g["결과"], "적중": "1" if t == g["결과"] else "0",
                        "시장1순위": mtop, "시장최대": mmax, "기록일": today})
    # 기존(시장·우리 분석 계열) 줄은 model_zoo.log 가 만든 것을 보존하고 엔진 기법만 교체
    keep = []
    if os.path.exists(OUT):
        eng = set(("elo", "elo_goal", "pi", "poisson", "dixon_coles", "market",
                       "합의(모델평균)", "시장앵커±6", "갈림→무가중"))
        keep = [x for x in csv.DictReader(open(OUT, encoding="utf-8-sig")) if x["기법"] not in eng]
    allr = keep + out
    w = csv.DictWriter(open(OUT, "w", encoding="utf-8", newline=""), fieldnames=PCOLS)
    w.writeheader()
    for x in allr:
        w.writerow({c: x.get(c, "") for c in PCOLS})
    m = collections.Counter(x["기법"] for x in allr)
    print(f"\n{OUT} — 총 {len(allr)}행")
    for name, n in m.most_common():
        hit = sum(1 for x in allr if x["기법"] == name and x["적중"] == "1")
        print(f"  {name:<16} n={n:4d}  적중 {hit/n*100:5.1f}%")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("run"); p.add_argument("--quick", action="store_true"); p.set_defaults(f=cmd_run)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
