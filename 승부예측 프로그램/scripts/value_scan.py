#!/usr/bin/env python3
"""가치 언더 전략(W) — 베트맨 언더 배당이 Pinnacle 공정확률 대비 후한 선택지만 (2026-10-18, 사용자 지시 "회수율 130% 맞추는 방법을 찾아봐")
근거(스캔기록 116~123회, 결과 채점된 선택지 4,937개):
  - 전체 선택지 단식 회수율 0.85, 기대값(공정확률×베트맨) 0.95+ 구간 0.99 — 베트맨 마진이 다리마다 곱해져 확률만 보면 적자.
  - 유형별로 갈라 보니 언더오버만 기대값 0.93+에서 학습(116~121)·검증(122~123) 모두 1.0 이상.
  - 규칙 W = 언더 · 기대값 ≥ 0.93 · 공정확률 ≥ 50% · 근거 '직접'(Pinnacle 같은 라인) · 전반 제외
      다리 53개 단식 1.23 / 시간순 2폴더 22장 10적중 회수율 1.27 (회차별 1.02~1.34, 118·119 표본 작음)
  - 핸디캡(정수)은 같은 조건에서 0.3~0.9로 나빠 제외. 1X2 는 0.9 안팎.
주의: 규칙을 데이터를 보고 골랐다(사후 선택). 53개 표본 → 실제 회수율 90% 구간은 넓다. 실전 전 가상 기록으로 30장+ 확인(분석규칙 [시험]).
사용:
  python3 scripts/value_scan.py --round 123              # 앞으로 열릴 경기 중 W 다리 + 3시간 이내 2폴더
  python3 scripts/value_scan.py --round 123 --log        # 가상 기록(data/가치전략기록.csv)에 추가
  python3 scripts/value_scan.py --report                 # 가상·실전 누적 회수율
  (먼저 odds_scan.py --round N --log 로 스캔기록을 최신화)
"""
import argparse, csv, datetime as dt, itertools, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN = os.path.join(ROOT, "data", "스캔기록.csv")
LOG = os.path.join(ROOT, "data", "가치전략기록.csv")
KST = dt.timezone(dt.timedelta(hours=9))
RULE = {"이름": "W", "선택": "언더", "ev": 0.93, "p": 50.0}
COLS = ["기록시각", "회차", "조합", "번호", "시각", "경기", "구분", "선택", "베트맨", "공정확률", "기대값", "result", "hit"]


def ok(r):
    try:
        ev, p = float(r["기대값"]), float(r["공정확률"])
    except ValueError:
        return False
    return ("언더오버" in r["유형"] and "전반" not in r["구분"] and r["선택"] == RULE["선택"]
            and ev >= RULE["ev"] and p >= RULE["p"] and r["근거"] == "직접" and r["종목"] != "농구")


def t_of(r):
    return dt.datetime.strptime(r["시각"], "%Y-%m-%d %H:%M").replace(tzinfo=KST)


def pairs(legs):
    """킥오프 순으로, 다른 경기·3시간 이내끼리 겹치지 않게 2폴더."""
    legs = sorted(legs, key=t_of); out, i = [], 0
    while i + 1 < len(legs):
        a, b = legs[i], legs[i + 1]
        if a["경기"] != b["경기"] and (t_of(b) - t_of(a)).total_seconds() <= 3 * 3600:
            out.append((a, b)); i += 2
        else:
            i += 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round"); ap.add_argument("--log", action="store_true"); ap.add_argument("--report", action="store_true")
    a = ap.parse_args()
    if a.report:
        if not os.path.exists(LOG):
            print("기록 없음"); return
        R = list(csv.DictReader(open(LOG, encoding="utf-8")))
        res = {(r["회차"], r["번호"], r["선택"]): (r.get("result", ""), r.get("hit", "")) for r in csv.DictReader(open(SCAN, encoding="utf-8-sig"))}
        for r in R:   # 채점: tracker.py results 가 스캔기록에 남긴 적중을 가져온다
            if r["hit"] not in ("0", "1"):
                r["result"], r["hit"] = res.get((r["회차"], r["번호"], r["선택"]), ("", ""))
        with open(LOG, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(R)
        legs = [r for r in R if r["hit"] in ("0", "1")]
        by = {}
        for r in R:
            by.setdefault(r["조합"], []).append(r)
        done = [v for v in by.values() if all(x["hit"] in ("0", "1") for x in v)]
        w = sum(1 for v in done if all(x["hit"] == "1" for x in v))
        pay = sum(float(v[0]["베트맨"]) * float(v[1]["베트맨"]) for v in done if len(v) == 2 and all(x["hit"] == "1" for x in v))
        print(f"W 가상 기록: 다리 {sum(int(r['hit']) for r in legs)}/{len(legs)} · 단식 회수율 {sum(float(r['베트맨']) * int(r['hit']) for r in legs) / max(1, len(legs)):.2f}"
              f" · 2폴더 {w}/{len(done)} · 회수율 {pay / max(1, len(done)):.2f}")
        return
    now = dt.datetime.now(KST)
    latest = {}
    for r in csv.DictReader(open(SCAN, encoding="utf-8-sig")):
        if a.round and r["회차"] != str(a.round):
            continue
        latest[(r["회차"], r["번호"], r["선택"])] = r
    legs = [r for r in latest.values() if ok(r) and t_of(r) > now + dt.timedelta(minutes=15) and not r.get("result")]
    print(f"규칙 W(언더·기대값≥{RULE['ev']}·공정확률≥{RULE['p']:.0f}%) 다리 {len(legs)}개")
    for r in sorted(legs, key=t_of):
        print(f"  {r['시각'][5:]} {r['번호']} {r['경기']} {r['구분']} 언더 {r['베트맨']} · 공정 {r['공정확률']}% · 기대값 {r['기대값']}")
    P = pairs(legs)
    for i, (x, y) in enumerate(P, 1):
        o = float(x["베트맨"]) * float(y["베트맨"]); q = float(x["공정확률"]) * float(y["공정확률"]) / 1e4
        print(f"W{i}: {x['번호']} {x['경기']} {x['구분']} 언더 + {y['번호']} {y['경기']} {y['구분']} 언더 = {o:.2f}배 · 적중 {q * 100:.0f}% · 기대 {o * q:.2f}")
    if a.log and P:
        new = not os.path.exists(LOG)
        old = set()
        if not new:
            old = {(r["회차"], r["번호"]) for r in csv.DictReader(open(LOG, encoding="utf-8"))}
        with open(LOG, "a", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLS)
            if new:
                w.writeheader()
            for x, y in P:
                if (x["회차"], x["번호"]) in old or (y["회차"], y["번호"]) in old:
                    continue
                cid = f"{x['회차']}-{x['번호']}+{y['번호']}"
                for r in (x, y):
                    w.writerow({"기록시각": now.strftime("%Y-%m-%d %H:%M"), "회차": r["회차"], "조합": cid, "번호": r["번호"], "시각": r["시각"], "경기": r["경기"],
                                "구분": r["구분"], "선택": r["선택"], "베트맨": r["베트맨"], "공정확률": r["공정확률"], "기대값": r["기대값"], "result": "", "hit": ""})
        print(f"→ {LOG}")


if __name__ == "__main__":
    main()
