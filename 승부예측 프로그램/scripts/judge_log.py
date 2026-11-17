#!/usr/bin/env python3
"""내 판단 장부 — 계산식(기준선) 방향 옆에 Claude 의 판단을 경기 전에 따로 적고, 결과가 나면 나란히 채점한다.

왜 (사용자 결정 2026-11-17):
  추천은 계산식과 규칙으로 낸다. 결장 선수의 팀 내 비중·동기·로테이션처럼 숫자에 안 잡히는 것을 읽은
  '내 판단'은 추천에 섞지 않고 따로 쌓는다. 섞으면 무엇이 맞았는지 알 수 없고, 과거에 판단을 섞었을 때
  계산식보다 낫다는 증거가 없었다(강팀 하향 18건 중 15건이 확률을 망쳤다). 갈린 경기가 쌓이면 판정한다.

무엇:
  data/내판단.csv  회차·번호·경기·시각·기록시각·계산식(1순위)·계산식확률·판단·확신·다리·이유·출처
    - 경기 시작 뒤에는 기록하지 않는다(결과를 보고 적은 판단은 표본이 아니다).
    - 같은 경기를 다시 적으면 새 줄이 붙고 마지막 줄이 유효하다(덮어쓰지 않는다).
    - integrity.py add 가 근거 JSON 의 `"내판단": {"방향","확신","다리","이유"}` 를 자동으로 옮긴다.

  python3 scripts/judge_log.py add <회차> <번호> <승|무|패> <낮음|중간|높음> [--leg 넣음|뺌] --why "한 줄"
  python3 scripts/judge_log.py show <회차>      # 아직 안 끝난 경기의 판단 — 계산식과 갈린 경기·뺀 다리 표시
  python3 scripts/judge_log.py report          # 계산식 vs 내 판단 (전체 · 갈린 경기 · 확신별 · 다리 의견)

판정 약속: 계산식과 갈린 경기 30건에서 내 판단이 계산식보다 6건 이상 더 맞으면(18-12) 추천에 반영을 검토하고,
  덜 맞으면 판단은 기록만 계속한다. 다리 의견은 '뺌' 정배 20경기의 적중률이 '넣음' 정배보다 낮은지로 본다.
"""
import argparse, csv, datetime as dt, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
LOG = os.path.join(ROOT, "전체경기기록.csv")
OUT = os.path.join(ROOT, "data", "내판단.csv")
COLS = ["회차", "번호", "경기", "시각", "기록시각", "계산식", "계산식확률", "판단", "확신", "다리", "이유", "출처"]
L = ("승", "무", "패")
CONF = ("낮음", "중간", "높음")


def kickoff(s, now=None):
    """'11-17 23:00' | '2026-11-17 23:00' → datetime. 연도가 없으면 지금과 가장 가까운 해."""
    now = now or dt.datetime.now()
    s = (s or "").strip()
    try:
        if len(s) >= 16:
            return dt.datetime.strptime(s[:16], "%Y-%m-%d %H:%M")
        t = dt.datetime.strptime(f"{now.year}-{s}", "%Y-%m-%d %H:%M")
    except ValueError:
        return None
    for y in (now.year - 1, now.year + 1):
        c = t.replace(year=y)
        if abs(c - now) < abs(t - now):
            t = c
    return t


def row_of(rnd, no):
    for g in csv.DictReader(open(LOG, encoding="utf-8-sig")):
        if g["회차"] == str(rnd) and g["번호"] == str(no):
            return g
    return None


def _top(v):
    try:
        v = {k: float(v.get(k) or 0) for k in L}
    except (ValueError, AttributeError):
        return None, {}
    if sum(v.values()) <= 0:
        return None, {}
    return max(v, key=v.get), v


def record(rnd, no, pick, conf, leg="", why="", src="메인", probs=None, when=None, force=False):
    """판단 한 줄 추가. probs = 계산식 확률 {'승','무','패'}(없으면 전체경기기록 순수 칸). 반환: (기록했나, 사유)."""
    if pick not in L or conf not in CONF or leg not in ("", "넣음", "뺌"):
        return False, "형식 오류(방향 승/무/패 · 확신 낮음/중간/높음 · 다리 넣음/뺌)"
    g = row_of(rnd, no)
    if not g:
        return False, "전체경기기록에 없는 경기"
    now = when or dt.datetime.now()
    ko = kickoff(g.get("시각"), now)
    if not force and (g.get("결과") in L or (ko and now >= ko)):
        return False, "경기가 이미 시작됐다 — 경기 전 판단만 기록한다"
    base, v = _top(probs or {k: g.get(f"순수_{k}") for k in L})
    if not base:
        return False, "계산식 확률이 없다"
    old = list(csv.DictReader(open(OUT, encoding="utf-8-sig"))) if os.path.exists(OUT) else []
    last = [r for r in old if r["회차"] == str(rnd) and r["번호"] == str(no)]
    if last and (last[-1]["판단"], last[-1]["확신"], last[-1]["다리"], last[-1]["이유"]) == (pick, conf, leg, why[:300]):
        return False, "직전 기록과 같다"
    new = not os.path.exists(OUT)
    with open(OUT, "a", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        if new:
            w.writeheader()
        w.writerow({"회차": rnd, "번호": no, "경기": f"{g['홈']}-{g['원정']}", "시각": g.get("시각", ""),
                    "기록시각": now.strftime("%Y-%m-%d %H:%M"), "계산식": base,
                    "계산식확률": "/".join(f"{v[k]:.1f}" for k in L), "판단": pick, "확신": conf, "다리": leg,
                    "이유": why[:300], "출처": src})
    return True, "갈림" if pick != base else "일치"


def latest():
    out = {}
    if os.path.exists(OUT):
        for r in csv.DictReader(open(OUT, encoding="utf-8-sig")):
            out[(r["회차"], r["번호"])] = r
    return out


def cmd_add(a):
    ok, msg = record(a.round, a.no, a.pick, a.conf, a.leg or "", a.why or "", force=a.force)
    print(f"{a.round} {a.no}: {'기록' if ok else '건너뜀'} — {msg}")
    return 0 if ok else 1


def cmd_show(a):
    F = latest()
    rows = [(k, r) for k, r in F.items() if k[0] == str(a.round)]
    if not rows:
        print("이 회차에 기록된 판단이 없다"); return 1
    print(f"{'번호':>5} {'시각':<12}{'경기':<28}{'계산식':<20}{'판단':<6}{'확신':<6}{'다리':<5} 이유")
    for (rnd, no), r in sorted(rows, key=lambda x: (x[1]["시각"], x[0][1])):
        g = row_of(rnd, no) or {}
        if g.get("결과") in L and not a.all:
            continue
        mark = "≠" if r["판단"] != r["계산식"] else " "
        print(f"{no:>5} {r['시각']:<12}{r['경기'][:26]:<28}{r['계산식'] + ' ' + r['계산식확률']:<20}{mark + r['판단']:<6}{r['확신']:<6}{r['다리'] or '-':<5} {r['이유'][:70]}")
    return 0


def cmd_report(a):
    import matchkey
    F = latest()
    grp = {}
    for g in csv.DictReader(open(LOG, encoding="utf-8-sig")):
        if g.get("결과") in L and (g["회차"], g["번호"]) in F:
            grp.setdefault(matchkey.key(g), g)
    X = [(g, F[(g["회차"], g["번호"])]) for g in grp.values()]
    if not X:
        print(f"채점된 판단이 없다 (기록 {len(F)}경기, 결과 대기)"); return 0

    def line(lab, sub):
        n = len(sub)
        if not n:
            print(f"{lab:<26}{0:>4}"); return
        b = sum(r["계산식"] == g["결과"] for g, r in sub); j = sum(r["판단"] == g["결과"] for g, r in sub)
        print(f"{lab:<26}{n:>4}{b:>7}{b/n*100:>7.1f}%{j:>7}{j/n*100:>7.1f}%{(j-b)/n*100:>+8.1f}p ±{2*math.sqrt(max(abs(j-b),1))/n*100:.1f}")
    print(f"내 판단 채점 {len(X)}경기 (경기 전 기록만 · 중복 회차 제거)\n")
    print(f"{'구분':<26}{'n':>4}{'계산식':>7}{'':>8}{'내 판단':>7}{'':>8}{'차':>9}")
    line("전체", X)
    line("일치", [x for x in X if x[1]["판단"] == x[1]["계산식"]])
    D = [x for x in X if x[1]["판단"] != x[1]["계산식"]]
    line("갈림", D)
    for c in CONF:
        line(f"  확신 {c}", [x for x in X if x[1]["확신"] == c])
    if D:
        print(f"\n갈린 경기 {len(D)}/30 (판정 약속)")
        for g, r in D:
            print(f"  {g['회차']} {g['번호']} {r['경기'][:24]:<26} 계산식 {r['계산식']} · 판단 {r['판단']}({r['확신']}) → 결과 {g['결과']}"
                  f"  {'판단 적중' if r['판단'] == g['결과'] else '계산식 적중' if r['계산식'] == g['결과'] else '둘 다 실패'}")
    print("\n다리 의견 — 계산식 1순위가 맞았는가")
    for v in ("넣음", "뺌"):
        sub = [x for x in X if x[1]["다리"] == v]
        n = len(sub); h = sum(r["계산식"] == g["결과"] for g, r in sub)
        print(f"  {v}: {h}/{n}" + (f" ({h/n*100:.1f}%)" if n else ""))
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("add")
    p.add_argument("round"); p.add_argument("no"); p.add_argument("pick", choices=L); p.add_argument("conf", choices=CONF)
    p.add_argument("--leg", choices=("넣음", "뺌")); p.add_argument("--why", default=""); p.add_argument("--force", action="store_true")
    p = sp.add_parser("show"); p.add_argument("round"); p.add_argument("--all", action="store_true")
    sp.add_parser("report")
    a = ap.parse_args()
    sys.exit({"add": cmd_add, "show": cmd_show, "report": cmd_report}[a.cmd](a))
