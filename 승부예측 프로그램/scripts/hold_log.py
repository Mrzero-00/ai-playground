#!/usr/bin/env python3
"""보류한 조합(조건은 채웠지만 내지 않은 조합)을 장부로 남기고 채점한다 (2026-11-17).

왜: '추천 없음'은 기록이 남지 않아 기권이 값을 했는지 잴 수 없었다. 11/17 블록에서 규칙상 유일한 조합
    (포르투갈 승 + 한국 승, 1.93배)을 로테이션 예고 때문에 내지 않았는데, 그 판단이 맞았는지는 결과가 말한다.
    기권은 실패가 아니지만, 맞을 조합을 계속 버리고 있다면 제외 기준이 틀린 것이다.

  python3 scripts/hold_log.py add 136 "11/17 23:00" "4479:패,4455:패" --why "두 팀 감독 로테이션 예고(e)"
  python3 scripts/hold_log.py report
장부: data/보류조합.csv. 배당은 add 시점의 전체경기기록 베트맨 배당을 적는다.
"""
import argparse, csv, datetime as dt, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, "전체경기기록.csv")
OUT = os.path.join(ROOT, "data", "보류조합.csv")
COLS = ["회차", "블록", "다리", "합계배당", "사유", "기록시각"]


def load():
    return list(csv.DictReader(open(OUT, encoding="utf-8-sig"))) if os.path.exists(OUT) else []


def legs(text):
    return [tuple(x.split(":")) for x in text.replace(" ", "").split(",") if ":" in x]


def cmd_add(a):
    G = {r["번호"]: r for r in csv.DictReader(open(LOG, encoding="utf-8-sig")) if r["회차"] == str(a.round)}
    o = 1.0
    for no, sel in legs(a.legs):
        try:
            o *= float(G[no][f"베트맨_{sel}"])
        except (KeyError, ValueError):
            print(f"{no}:{sel} 의 배당을 전체경기기록에서 찾지 못했다"); return 1
    rows = [r for r in load() if not (r["회차"] == str(a.round) and r["블록"] == a.block and r["다리"] == a.legs)]
    rows.append({"회차": a.round, "블록": a.block, "다리": a.legs, "합계배당": f"{o:.2f}", "사유": a.why,
                 "기록시각": dt.datetime.now().strftime("%Y-%m-%d %H:%M")})
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(rows)
    print(f"보류 기록: {a.round}회 {a.block} {a.legs} 합계 {o:.2f}배 — {a.why}")
    return 0


def cmd_report(a):
    rows = load()
    if not rows:
        print("보류 장부가 비어 있다"); return 1
    G = {(r["회차"], r["번호"]): r for r in csv.DictReader(open(LOG, encoding="utf-8-sig"))}
    n = hit = 0; ret = 0.0
    for r in rows:
        st = []
        for no, sel in legs(r["다리"]):
            g = G.get((r["회차"], no), {})
            res = (g.get("결과") or "").strip()
            st.append(None if res not in ("승", "무", "패") else res == sel)
        done = all(x is not None for x in st)
        ok = done and all(st)
        if done:
            n += 1; hit += ok; ret += float(r["합계배당"]) if ok else 0
        print(f"{r['회차']} {r['블록']:<12} {r['다리']:<22} {r['합계배당']:>5}배  "
              f"{'적중(보류가 빗나감)' if ok else '낙첨(보류가 맞음)' if done else '대기'}  — {r['사유']}")
    if n:
        p = hit / n
        print(f"\n보류 {n}조합 중 맞았을 조합 {hit} ({p*100:.0f}% ±{2*math.sqrt(p*(1-p)/n)*100:.0f}) · 샀다면 회수율 {ret/n*100:.0f}%")
        print("판정 약속: 보류 20조합에서 '샀다면 회수율'이 추천 조합 회수율보다 높으면 제외 기준이 맞을 조합을 버리고 있는 것이다.")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("add"); p.add_argument("round"); p.add_argument("block"); p.add_argument("legs")
    p.add_argument("--why", default=""); p.set_defaults(f=cmd_add)
    s.add_parser("report").set_defaults(f=cmd_report)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
