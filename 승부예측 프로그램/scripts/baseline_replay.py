#!/usr/bin/env python3
"""실제 기준선(soccer_baseline)을 과거 경기에 **킥오프 2시간 전 상태로** 다시 깐다.

왜 (2026-11-11):
  회고의 본 지표 '기준선 대비 개선폭'(prior.py report · replay.py)과 선별 백테스트(safe_picks --backtest)가
  기준선으로 `data/기법별예측.csv` 의 dixon_coles 를 써 왔다. 그런데 predict_engine 은 우리 기록 경기의
  팀명을 한글 그대로 넣어서, 영문 팀명으로 된 14,200경기 연대기와 이어지지 않는다 — 우리 축구 1,169행에서
  팀당 사전 갱신 횟수 중앙값이 2 이고 두 팀 다 5경기 미만인 행이 858행이다. 즉 지금까지 '기준선'이라고
  부른 것은 거의 학습되지 않은 모델이었고, 분석가가 실제로 출발하는 soccer_baseline 과 다른 물건이다.

무엇:
  전체경기기록의 축구 행마다 soccer_baseline.row_baseline(킥오프 2시간 전 cutoff — 사후 누수 없음)을
  계산해 data/기준선재현.csv 에 남긴다. soccer_baseline 이 다루는 리그만 나온다(유럽대항전·컵은
  euro_baseline 이 현재 상태만 내서 과거를 누수 없이 재현할 수 없다 — 빈칸으로 둔다).
  국가대표 경기는 intl_baseline(Elo)을 **경기 전날까지의 결과로** 다시 깐다(2026-11-17 — 11-02 이후 분석
  236경기 중 209경기가 재현 기준선이 없어 본 지표에서 빠져 있었다). 개최지는 홈으로 둔다 — 분석가의
  중립 교정은 '개입'으로 잡힌다.

  python3 scripts/baseline_replay.py            # 새로 생긴 행만 추가
  python3 scripts/baseline_replay.py --all      # 전부 다시 계산(기준선 모델을 고친 뒤)
  python3 scripts/baseline_replay.py --report   # 기준선 / 내 분석 / 시장 방향 적중률
"""
import argparse, contextlib, csv, datetime as dt, io, math, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LOG = os.path.join(ROOT, "전체경기기록.csv")
OUT = os.path.join(ROOT, "data", "기준선재현.csv")
COLS = ["회차", "번호", "승", "무", "패", "1순위", "계산일"]
L = ("승", "무", "패")


def load():
    """{(회차, 번호): {'승':%, '무':%, '패':%, '1순위': str}}"""
    out = {}
    if os.path.exists(OUT):
        for r in csv.DictReader(open(OUT, encoding="utf-8-sig")):
            try:
                out[(r["회차"], r["번호"])] = {"승": float(r["승"]), "무": float(r["무"]),
                                             "패": float(r["패"]), "1순위": r["1순위"]}
            except ValueError:
                continue
    return out


def _eve(g):
    """경기 전날 'YYYY-MM-DD'. 시각 칸은 한국 시각이고 원자료는 현지 날짜라, 전날로 끊어야 그 경기 자신이 안 들어간다."""
    t = (g.get("시각") or "").strip()
    if len(t) >= 10 and t[4] == "-":
        d = t[:10]
    elif len(t) >= 5 and t[2] == "-":
        d = ("2026-" if t[:2] >= "10" else "2027-") + t[:5]
    else:
        return None
    try:
        return (dt.date.fromisoformat(d) - dt.timedelta(days=1)).isoformat()
    except ValueError:
        return None


def build(all_=False):
    sys.path.insert(0, os.path.join(ROOT, "scripts"))
    import soccer_baseline as sb
    import intl_baseline as ib
    old = [] if all_ or not os.path.exists(OUT) else list(csv.DictReader(open(OUT, encoding="utf-8-sig")))
    have = {(r["회차"], r["번호"]) for r in old}
    names, cache, add, miss = sb.load_names(), {}, [], 0
    today = dt.date.today().isoformat()
    allrows = [g for g in csv.DictReader(open(LOG, encoding="utf-8-sig")) if (g["회차"], g["번호"]) not in have]
    rows = [g for g in allrows if g.get("종목") == "축구"]
    # 2026-11-17: NBA 도 경기일 전 상태로 재현한다(nba_baseline.team_ratings(as_of) — baseline_fill 과 같은 호출).
    try:
        import baseline_fill as bf
        nbc = {}
        for g in allrows:
            if g.get("리그") != "NBA":
                continue
            d = bf._match_date(g)
            if not d:
                miss += 1; continue
            if d not in nbc:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    nbc[d] = bf.nb.team_ratings(d)
            b = bf.nb.auto_baseline(bf.nb.espn_name(bf.T.en_name(g["홈"])), bf.nb.espn_name(bf.T.en_name(g["원정"])), d, ratings=nbc[d])
            if not b:
                miss += 1; continue
            ph = b["p_home"]
            add.append({"회차": g["회차"], "번호": g["번호"], "승": f"{ph:.1f}", "무": "0.0", "패": f"{100 - ph:.1f}",
                        "1순위": "승" if ph >= 50 else "패", "계산일": today})
    except Exception as ex:
        print(f"(NBA 재현 건너뜀: {ex})")
    for g in rows:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            try:
                b = sb.row_baseline(g, names, cache)
            except (Exception, SystemExit):
                b = None
            if not b and ib.is_intl(g) and _eve(g):
                try:
                    b = ib.baseline(g["홈"], g["원정"], date=_eve(g))
                except Exception:
                    b = None
        if not b:
            miss += 1
            continue
        p = {k: b[k] * 100 for k in L}
        add.append({"회차": g["회차"], "번호": g["번호"], **{k: f"{p[k]:.1f}" for k in L},
                    "1순위": max(p, key=p.get), "계산일": today})
    if add or all_:
        with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(old + add)
    print(f"기준선 재현: 새로 {len(add)}행 · 기준선 없음 {miss}행(지원 밖 리그·팀 매칭 실패) · 누적 {len(old) + len(add)}행")
    return 0


def _top(g, pre):
    v = {}
    for k in L:
        try:
            v[k] = float(g.get(f"{pre}_{k}") or 0)
        except ValueError:
            return None
    return max(v, key=v.get) if sum(v.values()) > 0 else None


def report():
    base = load()
    G = [g for g in csv.DictReader(open(LOG, encoding="utf-8-sig"))
         if g.get("종목") == "축구" and g.get("결과") in L and (g["회차"], g["번호"]) in base]
    seen, X = set(), []
    for g in G:                      # 같은 경기가 두 회차에 실리면 한 번만 센다
        k = __import__("matchkey").key(g)
        if k in seen:
            continue
        seen.add(k); X.append(g)

    def line(lab, sub):
        n = len(sub)
        if n < 10:
            print(f"{lab:<34}{n:>5}"); return
        b = sum(base[(g["회차"], g["번호"])]["1순위"] == g["결과"] for g in sub) / n
        mm = [g for g in sub if _top(g, "시장")]
        m = sum(_top(g, "시장") == g["결과"] for g in mm) / len(mm) if mm else float("nan")
        aa = [g for g in sub if _top(g, "순수") and (g.get("깊이") or "") in ("심층", "가벼움")]
        if aa:
            a = sum(_top(g, "순수") == g["결과"] for g in aa) / len(aa)
            ab = sum(base[(g["회차"], g["번호"])]["1순위"] == g["결과"] for g in aa) / len(aa)
            d = [(_top(g, "순수") == g["결과"]) - (base[(g["회차"], g["번호"])]["1순위"] == g["결과"]) for g in aa]
            mu = sum(d) / len(d)
            se = math.sqrt(sum((x - mu) ** 2 for x in d) / max(len(d) - 1, 1) / len(d))
            tail = (f"  | 분석 {len(aa):>4}경기: 내 {a*100:5.1f}% vs 기준선 {ab*100:5.1f}% "
                    f"= {mu*100:+5.1f}p ±{2*se*100:4.1f}")
        else:
            tail = ""
        print(f"{lab:<34}{n:>5}{b*100:>8.1f}%{m*100:>8.1f}%{tail}")
    print(f"실제 기준선(soccer_baseline, 킥오프 2시간 전 상태) — 축구 {len(X)}경기 (중복 회차 제거)\n")
    print(f"{'구분':<34}{'경기':>5}{'기준선':>9}{'시장':>9}")
    line("전체", X)
    for lg in sorted({g["리그"] for g in X}, key=lambda z: -sum(1 for g in X if g["리그"] == z)):
        line("  " + lg, [g for g in X if g["리그"] == lg])
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--report", action="store_true")
    a = ap.parse_args()
    return report() if a.report else build(a.all)


if __name__ == "__main__":
    sys.exit(main())
