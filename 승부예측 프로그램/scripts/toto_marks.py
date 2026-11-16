#!/usr/bin/env python3
"""승무패 마킹 안을 장부로 남기고 채점한다 (2026-11-17).

왜: 승무패 마킹 추천은 회고 문서의 글로만 남았다(추천기록.csv 에 승무패 행 0건). 승무패69 만 해도
    원래 4조합 · 사용자 의견 16조합 · 동기 가설 4조합 · 사용자 실제 마킹을 손으로 대조해야 했다.

  python3 scripts/toto_marks.py add 승무패69 "원래 4조합" --top "5:승/무,13:승/패" [--src 추천] [--note …]
      --top : 내 1순위(전체경기기록 순수 확률)로 14칸을 채우고, 적은 칸만 덮어쓴다
  python3 scripts/toto_marks.py add 승무패68 "사용자 실제" --marks "1:패,2:무,…,14:승" --src 사용자
  python3 scripts/toto_marks.py report [승무패69]
장부: data/승무패마킹.csv (회차·안·출처·마킹·조합수·기록시각·비고). 같은 회차·안 이름으로 다시 add 하면 덮어쓴다.
채점: 경기마다 결과가 마킹 칸 안에 있으면 맞힌 것. 맞힌 수 14 = 1등, 13 = 2등, 12 = 3등, 11 = 4등.
"""
import argparse, csv, datetime as dt, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, "전체경기기록.csv")
OUT = os.path.join(ROOT, "data", "승무패마킹.csv")
COLS = ["회차", "안", "출처", "마킹", "조합수", "기록시각", "비고"]
L = ("승", "무", "패")
RANK = {14: "1등", 13: "2등", 12: "3등", 11: "4등"}


def games(rnd):
    g = [r for r in csv.DictReader(open(LOG, encoding="utf-8-sig")) if r["회차"] == rnd]
    return sorted(g, key=lambda r: int(r["번호"]))


def top(r):
    try:
        v = {k: float(r.get(f"순수_{k}") or 0) for k in L}
    except ValueError:
        return None
    return max(v, key=v.get) if sum(v.values()) > 0 else None


def parse(text):
    out = {}
    for x in (text or "").replace(" ", "").split(","):
        if ":" in x:
            no, sel = x.split(":", 1)
            sels = [s for s in sel.split("/") if s in L]
            if sels:
                out[str(int(no))] = sels
    return out


def fmt(m):
    return ",".join(f"{no}:{'/'.join(m[no])}" for no in sorted(m, key=int))


def load():
    return list(csv.DictReader(open(OUT, encoding="utf-8-sig"))) if os.path.exists(OUT) else []


def cmd_add(a):
    G = games(a.round)
    if not G:
        print(f"{a.round} 경기가 전체경기기록에 없다"); return 1
    m = {}
    if a.top is not None:
        for r in G:
            t = top(r)
            if t:
                m[r["번호"]] = [t]
        m.update(parse(a.top))
    m.update(parse(a.marks))
    miss = [r["번호"] for r in G if r["번호"] not in m]
    if miss:
        print("마킹이 빈 경기:", ", ".join(miss), "— --marks 로 채우거나 순수 확률을 먼저 기록한다"); return 1
    n = 1
    for v in m.values():
        n *= len(v)
    rows = [r for r in load() if not (r["회차"] == a.round and r["안"] == a.name)]
    rows.append({"회차": a.round, "안": a.name, "출처": a.src, "마킹": fmt(m), "조합수": n,
                 "기록시각": dt.datetime.now().strftime("%Y-%m-%d %H:%M"), "비고": a.note})
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(rows)
    print(f"{a.round} '{a.name}' {n}조합: {fmt(m)}")
    return 0


def cmd_report(a):
    rows = [r for r in load() if not a.round or r["회차"] == a.round]
    if not rows:
        print("마킹 장부가 비어 있다"); return 1
    for rnd in sorted({r["회차"] for r in rows}, key=lambda x: (len(x), x)):
        G = games(rnd)
        res = {r["번호"]: r["결과"] for r in G if r.get("결과") in L}
        tops = {r["번호"]: top(r) for r in G}
        one = sum(tops.get(no) == v for no, v in res.items())
        print(f"\n{rnd} — 채점 {len(res)}/{len(G)}경기 · 내 1순위 단일 {one}/{len(res)}")
        print(f"  {'안':<22}{'출처':<8}{'조합':>4}{'맞힘':>8}  틀린 경기")
        for r in rows:
            if r["회차"] != rnd:
                continue
            m = parse(r["마킹"])
            miss = [no for no, v in res.items() if v not in m.get(no, [])]
            hit = len(res) - len(miss)
            fin = len(res) == len(G)
            tail = (RANK.get(hit, "낙첨") if fin else f"남은 {len(G) - len(res)}경기 다 맞으면 {RANK.get(len(G) - len(miss), '낙첨')}")
            print(f"  {r['안']:<22}{r['출처']:<8}{r['조합수']:>4}{hit:>5}/{len(res):<2}  "
                  f"{', '.join(f'{no}번({res[no]})' for no in sorted(miss, key=int)) or '없음'} → {tail}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    s = ap.add_subparsers(dest="c", required=True)
    p = s.add_parser("add"); p.add_argument("round"); p.add_argument("name")
    p.add_argument("--top", nargs="?", const="", default=None); p.add_argument("--marks", default="")
    p.add_argument("--src", default="추천"); p.add_argument("--note", default=""); p.set_defaults(f=cmd_add)
    p = s.add_parser("report"); p.add_argument("round", nargs="?"); p.set_defaults(f=cmd_report)
    a = ap.parse_args()
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
