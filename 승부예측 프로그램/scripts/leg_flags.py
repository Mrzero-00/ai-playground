#!/usr/bin/env python3
"""다리판단(조합에 써도 되는가)과 동기 가설을 장부로 남기고 채점한다.

왜 (2026-11-17):
  분석가는 근거 JSON 에 `다리판단`("가능 — …" / "제외권고 — …")을 적는데 어떤 스크립트도 읽지 않았다.
  safe_picks 는 제외권고 다리를 그대로 조합에 넣어 보여 줬고, 제외가 맞았는지는 손으로 셌다
  (135~136회: 가능 16경기 12적중, 제외 2경기 2적중 — 제외 기준은 아직 값을 못 보였다).
  사용자 가설 "Elo 가 비슷하면 동기 큰 쪽이 유리"(data/동기가설.csv)도 결과를 손으로 채웠다.

무엇:
  data/다리판단.csv  회차·번호·경기·기록시각·판정(가능|제외)·사유((a)~(e) 코드)·원문
    - integrity.py add 가 근거 JSON 을 등록할 때 자동으로 한 줄 쓴다(재분석이면 새 줄, 마지막 줄이 유효).
  python3 scripts/leg_flags.py backfill     # data/근거/*.json 을 훑어 빠진 판정을 채운다
  python3 scripts/leg_flags.py report       # 가능 vs 제외 — 1순위 적중률(전체 · 시장 60%+ 정배 · 사유별)
  python3 scripts/leg_flags.py motive       # 동기가설.csv 결과를 채우고 성적을 낸다
판정 약속: 제외된 정배 20경기에서 적중률이 제외 안 된 정배보다 낮지 않으면 제외 기준을 폐기한다(분석규칙 2026-11-17).
"""
import argparse, csv, datetime as dt, glob, json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, "전체경기기록.csv")
OUT = os.path.join(ROOT, "data", "다리판단.csv")
MOT = os.path.join(ROOT, "data", "동기가설.csv")
COLS = ["회차", "번호", "경기", "기록시각", "판정", "사유", "원문"]
L = ("승", "무", "패")


def parse(text):
    """'제외권고 — (a) …' → ('제외', 'a', 원문). 판정을 못 읽으면 None."""
    t = (text or "").strip()
    if not t:
        return None
    # 글머리로만 판정한다 — "가능 — 제외 기준 (a)~(d) 해당 없음" 같은 문장을 제외로 읽지 않는다.
    v = "가능" if t.startswith("가능") else "제외" if t.startswith("제외") else None
    if not v:
        return None
    codes = []
    if v == "제외":
        lead = re.split(r"다만|단 |그러나|\. ", t, 1)[0][:160]     # 사유는 첫 문장에서만 읽는다
        codes = sorted(set(re.findall(r"\(([a-f])\)", lead)))
        if "G1" in lead:
            codes.append("G1")
    return v, "·".join(codes), t[:300]


def record(rnd, no, game, text, when=None):
    """다리판단 한 줄 추가. 직전 줄과 판정·원문이 같으면 건너뛴다. 추가했으면 True."""
    p = parse(text)
    if not p:
        return False
    old = list(csv.DictReader(open(OUT, encoding="utf-8-sig"))) if os.path.exists(OUT) else []
    last = [r for r in old if r["회차"] == str(rnd) and r["번호"] == str(no)]
    if last and last[-1]["판정"] == p[0] and last[-1]["원문"] == p[2]:
        return False
    new = not os.path.exists(OUT)
    with open(OUT, "a", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        if new:
            w.writeheader()
        w.writerow({"회차": rnd, "번호": no, "경기": game, "판정": p[0], "사유": p[1], "원문": p[2],
                    "기록시각": when or dt.datetime.now().strftime("%Y-%m-%d %H:%M")})
    return True


def record_motive(rnd, no, game, side, why, my=None, note=""):
    """동기가설.csv 에 표본 한 줄(이미 있으면 건너뜀). side = '홈'|'원정' — 한 팀만 승리가 필요한 경기."""
    if side not in ("홈", "원정") or not os.path.exists(MOT):
        return False
    rows = list(csv.DictReader(open(MOT, encoding="utf-8-sig")))
    if any(r["회차"] == str(rnd) and r["번호"] == str(no) for r in rows):
        return False
    cols = list(rows[0].keys()) if rows else ["회차", "번호", "경기", "동기_큰쪽", "동기_내용", "중립기준선_승", "중립기준선_무",
                                                "중립기준선_패", "내확률_동기쪽", "시장_동기쪽", "결과", "적중", "비고"]
    with open(MOT, "a", encoding="utf-8-sig", newline="") as f:
        csv.DictWriter(f, fieldnames=cols).writerow(
            {"회차": rnd, "번호": no, "경기": game.replace("-", " vs "), "동기_큰쪽": side, "동기_내용": (why or "")[:200],
             "내확률_동기쪽": "" if my is None else my, "비고": note or "분석가 근거 JSON 의 동기쪽(자동 등록)"})
    return True


def latest():
    """{(회차, 번호): {'판정','사유','원문'}} — 마지막 줄이 유효."""
    out = {}
    if os.path.exists(OUT):
        for r in csv.DictReader(open(OUT, encoding="utf-8-sig")):
            out[(r["회차"], r["번호"])] = r
    return out


def _top(g, pre):
    try:
        v = {k: float(g.get(f"{pre}_{k}") or 0) for k in L}
    except ValueError:
        return None, 0.0
    if sum(v.values()) <= 0:
        return None, 0.0
    k = max(v, key=v.get)
    return k, v[k]


def games(prefer=None):
    """채점된 경기 — 같은 경기가 두 회차에 실리면 한 번만. prefer(행→bool)가 참인 회차의 행을 먼저 고른다."""
    grp = {}
    for g in csv.DictReader(open(LOG, encoding="utf-8-sig")):
        if g.get("결과") not in L:
            continue
        grp.setdefault(((g.get("시각") or "")[-11:-6], g["홈"][:4], g["원정"][:4]), []).append(g)
    return [next((g for g in v if prefer and prefer(g)), v[0]) for v in grp.values()]


def cmd_backfill(a):
    n = 0
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "근거", "*.json"))):
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        rnd = os.path.basename(f).split("_")[0]
        for e in data if isinstance(data, list) else [data]:
            if isinstance(e, dict) and e.get("다리판단") and e.get("번호") is not None:
                n += record(rnd, e["번호"], f"{e.get('홈', '')}-{e.get('원정', '')}", e["다리판단"],
                            when=(e.get("분석시각") or "")[:10] or None)
    print(f"다리판단 {n}줄 추가 → data/다리판단.csv")
    return 0


def cmd_report(a):
    F = latest()
    X = []
    for g in games(lambda g: (g["회차"], g["번호"]) in F):
        f = F.get((g["회차"], g["번호"]))
        me, _ = _top(g, "순수")
        if not f or not me:
            continue
        mk, mp = _top(g, "시장")
        X.append((g, f, me == g["결과"], mk == me and mp >= 60.0))
    if not X:
        print("채점된 다리판단이 없다 — leg_flags.py backfill 을 먼저 돌린다"); return 1

    def line(lab, sub):
        n = len(sub)
        if not n:
            print(f"{lab:<30}{0:>4}"); return
        h = sum(x[2] for x in sub); p = h / n
        print(f"{lab:<30}{n:>4}{h:>5}{p*100:>7.1f}% ±{2*math.sqrt(p*(1-p)/n)*100:>4.1f}")
    print(f"다리판단 채점 {len(X)}경기 (1순위 방향 적중 · 중복 회차 제거)\n")
    print(f"{'구분':<30}{'n':>4}{'적중':>5}{'적중률':>8}  2SE")
    for lab, sub in (("전체", X), ("시장 60%+ 정배(내 1순위 일치)", [x for x in X if x[3]])):
        print(f"-- {lab}")
        line("  가능", [x for x in sub if x[1]["판정"] == "가능"])
        line("  제외", [x for x in sub if x[1]["판정"] == "제외"])
    print("-- 제외 사유별(한 경기가 여러 사유에 걸리면 각각 센다)")
    for c in ("a", "b", "c", "d", "e", "f", "G1"):
        sub = [x for x in X if x[1]["판정"] == "제외" and c in (x[1]["사유"] or "")]
        if sub:
            line(f"  ({c})", sub)
    ex = [x for x in X if x[1]["판정"] == "제외" and x[3]]
    print(f"\n판정 약속: 제외된 정배 20경기(현재 {len(ex)})에서 적중률이 '가능' 정배보다 낮지 않으면 제외 기준을 폐기한다.")
    if a.list:
        for g, f, hit, fav in X:
            if f["판정"] == "제외":
                print(f"  {g['회차']} {g['번호']} {g['홈']}-{g['원정']} ({f['사유']}) → {g['결과']} {g.get('점수','')} {'적중' if hit else '실패'}")
    return 0


def cmd_motive(a):
    if not os.path.exists(MOT):
        print("data/동기가설.csv 없음"); return 1
    rows = list(csv.DictReader(open(MOT, encoding="utf-8-sig")))
    cols = list(rows[0].keys())
    G = {(g["회차"], g["번호"]): g for g in csv.DictReader(open(LOG, encoding="utf-8-sig"))}
    side = {"홈": "승", "원정": "패"}
    filled = 0
    for r in rows:
        g = G.get((r["회차"], r["번호"]))
        if g and g.get("결과") in L and not (r.get("적중") or "").strip():
            r["결과"] = f"{g['결과']}({g.get('점수', '')})"
            r["적중"] = "1" if side.get(r["동기_큰쪽"]) == g["결과"] else "0"
            filled += 1
    if filled:
        with open(MOT, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    done = [r for r in rows if (r.get("적중") or "").strip() in ("0", "1")]
    print(f"동기 가설 — 결과 {filled}건 새로 채움 · 채점 {len(done)}건 · 대기 {len(rows) - len(done)}건\n")

    def split(r):
        g = G.get((r["회차"], r["번호"]))
        me, _ = _top(g, "순수") if g else (None, 0)
        if "표본 아님" in (r.get("비고") or ""):
            return "참고(실력차 큼)"
        return "동기쪽 = 내 1순위" if me == side.get(r["동기_큰쪽"]) else "동기쪽 ≠ 내 1순위(가설이 가르는 표본)"
    for lab in ("동기쪽 = 내 1순위", "동기쪽 ≠ 내 1순위(가설이 가르는 표본)", "참고(실력차 큼)"):
        sub = [r for r in done if split(r) == lab]
        if sub:
            h = sum(int(r["적중"]) for r in sub)
            print(f"  {lab:<36}{h}/{len(sub)}")
    print("\n동기쪽이 내 1순위와 같은 경기는 기준선만으로도 맞는다 — 가설의 값은 갈리는 표본에서만 잰다(30건에서 판정).")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    s.add_parser("backfill").set_defaults(f=cmd_backfill)
    p = s.add_parser("report"); p.add_argument("--list", action="store_true"); p.set_defaults(f=cmd_report)
    s.add_parser("motive").set_defaults(f=cmd_motive)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
