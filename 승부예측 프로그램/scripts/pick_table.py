#!/usr/bin/env python3
"""추천 선택지를 베트맨 화면처럼 표로 보여 준다 (사용자 요청 2026-10-09).

한 줄 = 베트맨 게임 번호 하나. 승/무/패(또는 언더/오버, 승/1점차/패) 칸에 배당을 적고 추천한 칸에만 ✅.
배당·확률은 data/스캔기록.csv(odds_scan.py --log)의 가장 최근 값을 쓴다. 먼저 스캔을 --log로 돌려 둔다.

사용:
  python3 scripts/pick_table.py --round 120 "10/9 오후 2경기=7052:패,7005:승" "10/10 오후=7345:패,7339:패"
  - 조합마다 "제목=번호:선택,번호:선택" 하나. 제목은 생략 가능("7052:패,7005:승").
  - 선택: 승/무/패, 언더/오버, 1점차 (베트맨 칸 이름 그대로)
  --save                         표에 나온 선택지를 추천기록.csv에 '추천'으로 저장 (리그별 성적표용, 회고 때 채점)
  --skip "번호:선택=이유" ...     추천에서 뺀 선택지를 '추천제외'로 저장 (사용자에게는 보여 주지 않음, 기권 정확도 채점용)
  --buy "제목=금액"               --save 와 함께: 그 조합을 샀다고 표시
"""
import argparse
import csv
import datetime as dt
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, "data", "스캔기록.csv")
REC = os.path.join(ROOT, "추천기록.csv")
REC_COLS = ["회차", "번호", "선택", "시각", "종목", "리그", "경기", "게임", "배당", "확률", "구분", "조합", "이유", "구매", "결과", "적중"]
SPORT = {"SC": "축구", "BS": "야구", "BK": "농구", "VL": "배구"}
# 조합은 '비슷한 시각에 끝나는 경기끼리' 묶고 구매 시각을 함께 알린다 (사용자 요청 2026-10-10)
DURATION = {"축구": 115, "야구": 195, "농구": 120, "배구": 120}  # 킥오프→종료 예상(분)
SALE_CLOSE_MIN = 10   # 베트맨 프로토 판매 마감 = 경기 시작 10분 전(가정, 화면 마감 시각이 다르면 그 값을 따른다)
BUY_BEFORE_MIN = 30   # 구매 시각 = 마감 30분 전 → 그때 최종 재분석(재스캔·라인업)
END_SPREAD_MAX = 180  # 조합 안 경기 종료 예상 시각 차이 경고 기준(분)


def load(rnd):
    rows = {}
    for r in csv.DictReader(open(LOG, encoding="utf-8")):
        if r["회차"] != str(rnd):
            continue
        key = (r["번호"], r["선택"])
        if key not in rows or r["scan_time"] >= rows[key]["scan_time"]:
            rows[key] = r
    by_no = {}
    for (no, _), r in rows.items():
        by_no.setdefault(no, []).append(r)
    return by_no


def kind(r):
    """베트맨 화면의 게임 종류 이름 + 기준점 배지"""
    sp = SPORT.get(r["종목"], r["종목"])
    t, g = r["유형"], r["구분"]
    half = "전반 " if g.startswith("전반") else ""
    if "언더오버" in t:
        return f"{sp} {half}언더오버 `U/O {float(g.split()[-1]):.1f}`"
    if "핸디캡" in t:
        v = float(g.replace("전반 ", "").replace("H", ""))
        return f"{sp} {half}핸디캡 `H {v:+.1f}`"  # 베트맨 화면 표기 (예: H -1.0)
    if t == "승N패":
        return f"{sp} 승1패"
    return f"{sp} {half}{'승무패' if t == '승무패' else '승패'}"


def cells(opts, pick):
    names = {o["선택"] for o in opts}
    if names & {"언더", "오버"}:
        order = ["언더", "오버", None]
    elif "1점차" in names:
        order = ["승", "1점차", "패"]
    else:
        order = ["승", "무", "패"]
    by = {o["선택"]: o for o in opts}
    out = []
    for n in order:
        if n is None or n not in by:
            out.append("")
            continue
        txt = f"{n} {float(by[n]['베트맨']):.2f}"
        out.append(f"✅ **{txt}**" if n == pick else txt)
    return out


def timing(by_no, picks):
    """첫 경기 킥오프 기준 구매 마감·구매 시각, 마지막 경기 종료 예상. 종료 시각이 많이 벌어지면 경고."""
    ks, ends = [], []
    for no, _ in picks:
        opts = by_no.get(no)
        if not opts:
            continue
        k = dt.datetime.strptime(opts[0]["시각"], "%Y-%m-%d %H:%M")
        ks.append(k)
        ends.append(k + dt.timedelta(minutes=DURATION.get(SPORT.get(opts[0]["종목"], opts[0]["종목"]), 120)))
    if not ks:
        return ""
    close = min(ks) - dt.timedelta(minutes=SALE_CLOSE_MIN)
    buy = close - dt.timedelta(minutes=BUY_BEFORE_MIN)
    f = lambda d: d.strftime("%m/%d %H:%M")
    out = f"\n🕒 **구매 시각 {f(buy)}** (판매 마감 {f(close)}) · 결과 예상 {f(max(ends))}"
    spread = (max(ends) - min(ends)).total_seconds() / 60
    if spread > END_SPREAD_MAX:
        out += f"  ⚠ 경기 종료 시각 차이 {spread / 60:.1f}시간 — 비슷한 시각에 끝나는 경기끼리 다시 묶을 것"
    return out


def table(by_no, title, picks):
    lines = []
    if title:
        lines.append(f"**{title}**\n")
    lines.append("| 번호 | 경기 | 게임 | 승 | 무 | 패 | 확률 |")
    lines.append("|---|---|---|---|---|---|---|")
    odds, prob = 1.0, 1.0
    for no, pick in picks:
        opts = by_no.get(no)
        if not opts:
            lines.append(f"| {no} | (스캔기록에 없음 — odds_scan.py --round … --log 먼저) | | | | | |")
            continue
        sel = next((o for o in opts if o["선택"] == pick), None)
        r = opts[0]
        c = cells(opts, pick)
        p = float(sel["공정확률"]) if sel and sel["공정확률"] else None
        if sel:
            odds *= float(sel["베트맨"])
        prob = prob * p / 100 if (p is not None and prob is not None) else None
        when = r["시각"][5:16]
        lines.append(f"| {no} | {r['경기']} ({when}) | {kind(r)} | {c[0]} | {c[1]} | {c[2]} | {f'{p:.1f}%' if p is not None else '-'} |")
    t = timing(by_no, picks)
    if t:
        lines.append(t)
    if len(picks) > 1:
        lines.append(f"\n합계 배당 **{odds:.2f}배** · 적중 확률 **{prob * 100:.1f}%**" if prob is not None else f"\n합계 배당 **{odds:.2f}배**")
    return "\n".join(lines)


def save_rec(by_no, rnd, items):
    """items: (번호, 선택, 구분, 조합, 이유, 구매). 같은 (회차, 번호, 선택)은 덮어쓴다."""
    old = list(csv.DictReader(open(REC, encoding="utf-8"))) if os.path.exists(REC) else []
    keep = {(r["회차"], r["번호"], r["선택"]): r for r in old}
    for no, pick, kind_, combo, why, buy in items:
        opts = by_no.get(no) or []
        sel = next((o for o in opts if o["선택"] == pick), None)
        if not sel:
            print(f"  (저장 건너뜀: {no}:{pick} 스캔기록에 없음)")
            continue
        k = (str(rnd), no, pick)
        prev = keep.get(k, {})
        keep[k] = {"회차": rnd, "번호": no, "선택": pick, "시각": sel["시각"], "종목": sel["종목"], "리그": sel["리그"],
                   "경기": sel["경기"], "게임": kind(sel), "배당": sel["베트맨"], "확률": sel["공정확률"], "구분": kind_,
                   "조합": combo, "이유": why, "구매": buy or prev.get("구매", ""),
                   "결과": prev.get("결과", ""), "적중": prev.get("적중", "")}
    w = csv.DictWriter(open(REC, "w", encoding="utf-8", newline=""), fieldnames=REC_COLS)
    w.writeheader()
    w.writerows(keep.values())
    print(f"추천기록.csv 저장 ({len(items)}건)")


def main():
    ap = argparse.ArgumentParser(description="추천 선택지를 베트맨 화면 형태 표로")
    ap.add_argument("--round", type=int, required=True)
    ap.add_argument("combos", nargs="*", help='"제목=번호:선택,번호:선택"')
    ap.add_argument("--save", action="store_true")
    ap.add_argument("--skip", nargs="*", default=[], help='"번호:선택=이유"')
    ap.add_argument("--buy", nargs="*", default=[], help='"제목=금액"')
    a = ap.parse_args()
    by_no = load(a.round)
    buys = dict(b.rsplit("=", 1) for b in a.buy)
    items = []
    for c in a.combos:
        title, _, body = c.rpartition("=")
        picks = [tuple(x.strip().split(":")) for x in body.split(",") if x.strip()]
        print(table(by_no, title, picks) + "\n")
        items += [(no, pk, "추천", title, "", buys.get(title, "")) for no, pk in picks]
    for sk in a.skip:
        leg, _, why = sk.partition("=")
        no, pk = leg.strip().split(":")
        items.append((no, pk, "추천제외", "", why.strip(), ""))
    if a.save or a.skip:
        save_rec(by_no, a.round, [x for x in items if a.save or x[2] == "추천제외"])


if __name__ == "__main__":
    main()
