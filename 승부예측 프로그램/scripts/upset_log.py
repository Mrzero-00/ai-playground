#!/usr/bin/env python3
"""이변(역배·무) 가상 기록 — 실제 추천 없이 30건 쌓아 판정 (사용자 지시 2026-10-12, 종목별분석/역배_무_외부자료.md)

후보 조건 (일반 승무패/승패, 순수 = 내 최종 판단):
  - 시장 1순위가 아닌 선택(역배) 또는 무
  - 순수 − 시장(Pinnacle 공정) ≥ 5%p
  - 순수 × 베트맨 배당 ≥ 1.05
  python3 scripts/upset_log.py scan <회차> ["<블록>"]   # 후보를 data/이변기록.csv에 기록(같은 경기·선택은 최신값으로 갱신)
  python3 scripts/upset_log.py report                  # 결과 채점: 적중·ROI(베트맨)·CLV(기록 시 시장 → 최신 시장), 종목·무/역배별
판정 (분석규칙.md [시험]): 30건 뒤 ROI > 0 이고 CLV 평균 > 0 이면 소액 별도 추천 검토, 아니면 폐기.
"""
import csv
import datetime as dt
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
REC = os.path.join(ROOT, "전체경기기록.csv")
LOG = os.path.join(ROOT, "data", "이변기록.csv")
COLS = ["기록시각", "회차", "종목", "리그", "홈", "원정", "선택", "유형", "순수", "시장", "베트맨", "기대값", "결과", "적중"]
OUT = ("승", "무", "패")
GAP, EV_MIN = 5.0, 1.05


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def candidates(r):
    pu = [num(r.get(f"순수_{k}")) for k in OUT]
    mk = [num(r.get(f"시장_{k}")) for k in OUT]
    bt = [num(r.get(f"베트맨_{k}")) for k in OUT]
    if None in (pu[0], pu[2], mk[0], mk[2]):
        return []
    top = max(range(3), key=lambda i: mk[i] or 0)
    out = []
    for i, k in enumerate(OUT):
        if i == top or not pu[i] or not mk[i] or not bt[i]:
            continue
        ev = pu[i] / 100 * bt[i]
        if pu[i] - mk[i] >= GAP and ev >= EV_MIN:
            out.append((k, "무" if k == "무" else "역배", pu[i], mk[i], bt[i], round(ev, 3)))
    return out


def load_log():
    return list(csv.DictReader(open(LOG, encoding="utf-8"))) if os.path.exists(LOG) else []


def save_log(rows):
    with open(LOG, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def cmd_scan(rnd, block=None):
    keys = None
    if block:
        import round_watch as rw
        keys = {(g["홈"], g["원정"]) for g in rw.assign_blocks(rw.games_of(int(rnd))).get(block, [])}
    log = load_log()
    idx = {(r["회차"], r["홈"], r["원정"], r["선택"]): r for r in log}
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    n = 0
    for r in csv.DictReader(open(REC, encoding="utf-8")):
        if r["회차"] != str(rnd) or (keys is not None and (r["홈"], r["원정"]) not in keys) or r.get("결과"):
            continue
        for k, typ, p, m, b, ev in candidates(r):
            row = {"기록시각": now, "회차": r["회차"], "종목": r["종목"], "리그": r["리그"], "홈": r["홈"], "원정": r["원정"],
                   "선택": k, "유형": typ, "순수": p, "시장": m, "베트맨": b, "기대값": ev, "결과": "", "적중": ""}
            key = (r["회차"], r["홈"], r["원정"], k)
            if key in idx:
                idx[key].update(row)
            else:
                log.append(row)
                idx[key] = row
            n += 1
            print(f"[이변] {r['홈']}-{r['원정']} {k}({typ}) 순수 {p:.0f} vs 시장 {m:.0f} · 베트맨 {b} · 기대값 {ev}")
    save_log(log)
    print(f"이변 후보 {n}건 (가상 기록, 추천 아님) → data/이변기록.csv")


def cmd_report():
    log = load_log()
    rec = {(r["회차"], r["홈"], r["원정"]): r for r in csv.DictReader(open(REC, encoding="utf-8"))}
    groups = {}
    for x in log:
        r = rec.get((x["회차"], x["홈"], x["원정"]), {})
        res = r.get("결과", "")
        if res in OUT or res in ("승", "패"):
            x["결과"], x["적중"] = res, "1" if res == x["선택"] else "0"
        latest = num(r.get(f"시장_{x['선택']}"))
        if not x["적중"]:
            continue
        for g in ("전체", x["종목"], x["유형"]):
            s = groups.setdefault(g, [0, 0, 0.0, 0.0, 0])
            s[0] += 1
            s[1] += int(x["적중"])
            s[2] += (float(x["베트맨"]) if x["적중"] == "1" else 0) - 1
            if latest is not None:
                s[3] += latest - float(x["시장"])
                s[4] += 1
    save_log(log)
    print(f"이변 가상 기록 {len(log)}건 (채점 {groups.get('전체', [0])[0]}건) — 판정 기준 30건")
    for g, (n, h, pl, clv, nc) in groups.items():
        print(f"  {g}: {h}/{n} 적중 · ROI {pl / n * 100:+.1f}% · CLV 평균 {clv / nc if nc else 0:+.1f}%p")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "scan":
        cmd_scan(a[1], a[2] if len(a) > 2 else None)
    elif a and a[0] == "report":
        cmd_report()
    else:
        print(__doc__)
