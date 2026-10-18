#!/usr/bin/env python3
"""과정 채점 — 맞은 경기도 '맞을 만했는지' 본다 (사용자 지적 2026-10-19: "회고가 실패 경기만 보고 만든다는 것부터 잘못됐다")
왜: 회고 2단계가 오답만 분류하니 운으로 맞은 분석이 '좋은 분석'으로 남고, 내용은 맞았는데 진 분석이 '틀린 분석'으로 버려진다.
무엇: 결과가 나온 축구 경기 전부를 4분면으로 나눈다.
  - 예측 = 순수 1순위(승/무/패). 결과적중 = 1순위 == 결과.
  - 내용적중 = 경기 내용이 예측 쪽이었는가: 경기 xG(있으면) 아니면 유효슈팅(없으면 슈팅) 차이로 '지배한 쪽'을 정한다.
      승 예측 → 홈 지배면 내용적중, 패 예측 → 원정 지배, 무 예측 → 차이가 작으면(유효슈팅 차 ≤1 또는 xG 차 ≤0.3) 내용적중.
      퇴장이 있으면 '퇴장' 표시(내용 판정 신뢰 낮음).
  - 요인검증 = data/결장검증.csv 에서 그 경기 결장 요인 중 실제와 맞은 비율(요인 없으면 '-').
  4분면: 실력(결과O 내용O) · 운(결과O 내용X) · 분산(결과X 내용O) · 오판(결과X 내용X)
  과정 점수 = (실력+분산)/전체 — 결과와 무관하게 '분석이 경기 내용을 맞춘 비율'. 결과 적중률과 같이 추적한다.
사용: python3 scripts/process_grade.py [--round 123] [--all]   → 회차별분석/과정채점_<회차|전체>_<날짜>.md, data/과정채점.csv(행=경기)
"""
import argparse, csv, datetime as dt, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC = os.path.join(ROOT, "전체경기기록.csv")
POST = os.path.join(ROOT, "data", "경기후.csv")
ABS = os.path.join(ROOT, "data", "결장검증.csv")
FIX = os.path.join(ROOT, "data", "과정채점_수정.csv")   # 사람(에이전트) 검토로 바뀐 4분면 — 재실행해도 유지
OUT = os.path.join(ROOT, "data", "과정채점.csv")
COLS = ["회차", "번호", "경기", "예측", "확률", "결과", "점수", "결과적중", "지배", "내용근거", "내용적중", "4분면", "요인검증", "퇴장", "정합성", "추천"]


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def dominant(p):
    """(지배: 홈/원정/대등, 근거 문자열). xG 우선, 없으면 유효슈팅, 없으면 슈팅."""
    hx, ax = num(p.get("홈xG")), num(p.get("원정xG"))
    if hx is not None and ax is not None:
        d = hx - ax
        return ("홈" if d > 0.3 else "원정" if d < -0.3 else "대등"), f"xG {hx:.2f}:{ax:.2f}"
    hs, as_ = num(p.get("홈유효")), num(p.get("원정유효"))
    ts, ta = num(p.get("홈슈팅")), num(p.get("원정슈팅")); po, pa = num(p.get("홈점유")), num(p.get("원정점유"))
    if hs is not None and as_ is not None and (hs + as_) > 0:
        d = hs - as_
        if d > 1:
            return "홈", f"유효 {hs:.0f}:{as_:.0f}"
        if d < -1:
            return "원정", f"유효 {hs:.0f}:{as_:.0f}"
        # 유효 대등이면 슈팅 차 ≥6 또는 점유 차 ≥20p 로 보조 판정 (2026-10-19 내용 회고: 유효만 보면 '대등' 과다)
        if ts is not None and ta is not None and abs(ts - ta) >= 6:
            return ("홈" if ts > ta else "원정"), f"유효 {hs:.0f}:{as_:.0f}·슈팅 {ts:.0f}:{ta:.0f}"
        if po is not None and pa is not None and abs(po - pa) >= 20:
            return ("홈" if po > pa else "원정"), f"유효 {hs:.0f}:{as_:.0f}·점유 {po:.0f}:{pa:.0f}"
        return "대등", f"유효 {hs:.0f}:{as_:.0f}"
    hs, as_ = num(p.get("홈슈팅")), num(p.get("원정슈팅"))
    if hs is not None and as_ is not None and (hs + as_) > 0:
        d = hs - as_
        return ("홈" if d > 3 else "원정" if d < -3 else "대등"), f"슈팅 {hs:.0f}:{as_:.0f}"
    return None, ""


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--round"); ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    post = {(r["회차"], r["번호"]): r for r in csv.DictReader(open(POST, encoding="utf-8"))} if os.path.exists(POST) else {}
    absv = collections.defaultdict(lambda: [0, 0])
    if os.path.exists(ABS):
        for r in csv.DictReader(open(ABS, encoding="utf-8")):
            k = (r["회차"], r["번호"]); st = r.get("실제", "")
            if st.startswith("미확인"):
                continue
            absv[k][0] += 1; absv[k][1] += 1 if st.startswith("결장 맞음") else 0
    rows = []
    for r in csv.DictReader(open(REC, encoding="utf-8-sig")):
        if r["종목"] != "축구" or r.get("결과") not in ("승", "무", "패") or not r.get("순수_승"):
            continue
        if a.round and r["회차"] != a.round:
            continue
        k = (r["회차"], r["번호"]); p = post.get(k)
        if not p:
            continue
        pu = {x: num(r.get(f"순수_{x}")) or 0 for x in ("승", "무", "패")}; pred = max(pu, key=pu.get)
        dom, why = dominant(p)
        if dom is None:
            continue
        ok_res = pred == r["결과"]
        ok_con = (pred == "승" and dom == "홈") or (pred == "패" and dom == "원정") or (pred == "무" and dom == "대등")
        quad = "실력" if ok_res and ok_con else "운" if ok_res else "분산" if ok_con else "오판"
        red = (num(p.get("홈퇴장")) or 0) + (num(p.get("원정퇴장")) or 0)
        av = absv.get(k); fv = f"{av[1]}/{av[0]}" if av else "-"
        rows.append({"회차": r["회차"], "번호": r["번호"], "경기": f"{r['홈']}-{r['원정']}", "예측": pred, "확률": f"{pu[pred]:.0f}", "결과": r["결과"], "점수": r.get("점수", ""),
                     "결과적중": int(ok_res), "지배": dom, "내용근거": why, "내용적중": int(ok_con), "4분면": quad, "요인검증": fv,
                     "퇴장": int(red), "정합성": r.get("정합성", ""), "추천": r.get("추천", "")})
    fixes = {(f["회차"], f["번호"]): f for f in csv.DictReader(open(FIX, encoding="utf-8"))} if os.path.exists(FIX) else {}
    for x in rows:
        f = fixes.get((x["회차"], x["번호"]))
        if f:
            x["4분면"] = f["4분면"]; x["내용적중"] = int(f["내용적중"]); x["내용근거"] += f" [검토: {f['메모']}]"
    # 저장(회차 단위로 덮어쓰기)
    old = list(csv.DictReader(open(OUT, encoding="utf-8"))) if os.path.exists(OUT) else []
    done = {(x["회차"], x["번호"]) for x in rows}
    keep = [x for x in old if (x["회차"], x["번호"]) not in done]
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(keep + rows)
    # 보고
    today = dt.date.today().isoformat()
    L = [f"# 과정 채점 — {a.round or '전체'} ({today})", "",
         "결과만 보지 않고 '분석이 경기 내용을 맞췄는가'를 같이 본다. 지배 = 경기 xG(없으면 유효슈팅·슈팅) 우위. 4분면: 실력(결과O 내용O) · 운(결과O 내용X) · 분산(결과X 내용O) · 오판(결과X 내용X).", ""]
    def table(title, sel):
        n = len(sel)
        if not n:
            return
        q = collections.Counter(x["4분면"] for x in sel)
        hit = sum(x["결과적중"] for x in sel)
        clean = [x for x in sel if not x["퇴장"]]   # 퇴장 경기는 과정 점수에서 제외(내용 검증 불가)
        con = sum(x["내용적중"] for x in clean)
        L.append(f"## {title} (n={n}) — 결과 적중 {hit}/{n} ({hit/n*100:.0f}%) · **과정 점수 {con}/{len(clean)} ({(con/len(clean)*100 if clean else 0):.0f}%, 퇴장 {n-len(clean)}경기 제외)** · 실력 {q['실력']} · 운 {q['운']} · 분산 {q['분산']} · 오판 {q['오판']}")
        L.append("")
    table("전체", rows)
    for rnd in sorted({x["회차"] for x in rows}):
        table(f"회차 {rnd}", [x for x in rows if x["회차"] == rnd])
    for g in ("A", "B", "C"):
        table(f"정합성 {g}", [x for x in rows if x["정합성"] == g])
    table("추천 다리(추천 열 있음)", [x for x in rows if x["추천"]])
    L += ["## 운으로 맞은 경기 (결과O 내용X) — '좋은 분석'으로 남기면 안 되는 것", "", "| 회차 | 경기 | 예측(확률) | 결과 | 내용 | 요인검증 |", "|---|---|---|---|---|---|"]
    for x in rows:
        if x["4분면"] == "운":
            L.append(f"| {x['회차']} | {x['경기']} | {x['예측']}({x['확률']}) | {x['결과']} {x['점수']} | {x['지배']} {x['내용근거']}{' 퇴장' if x['퇴장'] else ''} | {x['요인검증']} |")
    L += ["", "## 분산으로 진 경기 (결과X 내용O) — 분석을 버리면 안 되는 것", "", "| 회차 | 경기 | 예측(확률) | 결과 | 내용 | 요인검증 |", "|---|---|---|---|---|---|"]
    for x in rows:
        if x["4분면"] == "분산":
            L.append(f"| {x['회차']} | {x['경기']} | {x['예측']}({x['확률']}) | {x['결과']} {x['점수']} | {x['지배']} {x['내용근거']}{' 퇴장' if x['퇴장'] else ''} | {x['요인검증']} |")
    L += ["", "## 오판 (결과X 내용X) — 원인 분류 대상", "", "| 회차 | 경기 | 예측(확률) | 결과 | 내용 | 요인검증 |", "|---|---|---|---|---|---|"]
    for x in rows:
        if x["4분면"] == "오판":
            L.append(f"| {x['회차']} | {x['경기']} | {x['예측']}({x['확률']}) | {x['결과']} {x['점수']} | {x['지배']} {x['내용근거']}{' 퇴장' if x['퇴장'] else ''} | {x['요인검증']} |")
    rp = os.path.join(ROOT, "회차별분석", f"과정채점_{a.round or '전체'}_{today}.md")
    open(rp, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L[:14])); print(f"→ {OUT}\n→ {rp}")


if __name__ == "__main__":
    main()
