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
SALE_CLOSE_MIN = 10   # data/마감시각.json(베트맨 endDate)에 없을 때만 쓰는 대체값: 경기 시작 10분 전
CLOSE_PATH = os.path.join(ROOT, "data", "마감시각.json")
SCHED = os.path.join(ROOT, "구매일정.csv")
SCHED_COLS = ["회차", "조합", "다리", "마감", "점검시각", "결과예상", "구매", "상태", "메모"]
MIN_COMBO_ODDS = 1.8  # 조합 합계 배당 하한 (사용자 지시 2026-10-19: "최소 배당률은 조합으로 1.8 이상")
BUY_BEFORE_MIN = 30   # 구매 시각 = 마감 30분 전 → 그때 최종 재분석(재스캔·라인업)
END_SPREAD_MAX = 90   # 조합 안 경기 종료 예상 시각 차이 경고 기준(분) — 같은 시간대끼리(2026-10-10)


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


def closes():
    import json
    try:
        return json.load(open(CLOSE_PATH, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def combo_times(by_no, picks, rnd=None):
    """(마감, 점검시각, 결과예상, 종료 차이 분) — 마감은 베트맨 endDate(조합 다리 중 가장 이른 것)."""
    cl = closes()
    ks, ends, cs = [], [], []
    for no, _ in picks:
        opts = by_no.get(no)
        if not opts:
            continue
        k = dt.datetime.strptime(opts[0]["시각"], "%Y-%m-%d %H:%M")
        ks.append(k)
        ends.append(k + dt.timedelta(minutes=DURATION.get(SPORT.get(opts[0]["종목"], opts[0]["종목"]), 120)))
        c = cl.get(f"{rnd or opts[0]['회차']}-{no}")
        cs.append(dt.datetime.strptime(c, "%Y-%m-%d %H:%M") if c else k - dt.timedelta(minutes=SALE_CLOSE_MIN))
    if not ks:
        return None
    close = min(cs)
    return close, close - dt.timedelta(minutes=BUY_BEFORE_MIN), max(ends), (max(ends) - min(ends)).total_seconds() / 60


def timing(by_no, picks):
    """첫 경기 킥오프 기준 구매 마감·구매 시각, 마지막 경기 종료 예상. 종료 시각이 많이 벌어지면 경고."""
    t = combo_times(by_no, picks)
    if not t:
        return ""
    close, buy, end, spread = t
    f = lambda d: d.strftime("%m/%d %H:%M")
    out = f"\n🕒 **구매 시각 {f(buy)}** (베트맨 판매 마감 {f(close)}) · 결과 예상 {f(end)} — 이 시각에 최종 재분석 후 다시 알림"
    kos = [by_no[no][0]["시각"][11:16] for no, _ in picks if by_no.get(no)]
    dawn = kos and all("00:00" <= k <= "05:00" for k in kos)   # 사용자 2026-10-15: 00~05시 킥오프는 한 묶음
    if spread > END_SPREAD_MAX and not dawn:
        out += f"  ⚠ 경기 종료 시각 차이 {spread / 60:.1f}시간 — 비슷한 시각에 끝나는 경기끼리 다시 묶을 것"
    return out


def save_schedule(by_no, rnd, combos, buys):
    """조합별 구매 일정 → 구매일정.csv (autoscan.py 가 점검시각에 final_check.py 를 돌려 알림)"""
    old = list(csv.DictReader(open(SCHED, encoding="utf-8"))) if os.path.exists(SCHED) else []
    keep = {(r["회차"], r["조합"]): r for r in old}
    for title, picks in combos:
        t = combo_times(by_no, picks, rnd)
        if not t:
            continue
        close, buy, end, _ = t
        prev = keep.get((str(rnd), title), {})
        keep[(str(rnd), title)] = {"회차": rnd, "조합": title, "다리": ",".join(f"{n}:{p}" for n, p in picks),
                                   "마감": close.strftime("%Y-%m-%d %H:%M"), "점검시각": buy.strftime("%Y-%m-%d %H:%M"),
                                   "결과예상": end.strftime("%Y-%m-%d %H:%M"), "구매": buys.get(title, prev.get("구매", "")),
                                   "상태": prev.get("상태", "대기"), "메모": prev.get("메모", "")}
    w = csv.DictWriter(open(SCHED, "w", encoding="utf-8", newline=""), fieldnames=SCHED_COLS)
    w.writeheader(); w.writerows(keep.values())
    print(f"구매일정.csv 저장 ({len(combos)}조합)")


OWN = {}  # (번호, 선택) → 내 분석 확률 (--own). 추천 확률은 내 분석만 쓴다 (사용자 지시 2026-10-13)
RAW = {}  # (번호, 선택) → --own 에 넣은 원본 값 (보정 전). 표에는 "적중 예상도 (보정·원본)" 으로
CAL = {}  # (번호, 선택) → 보정 확률 (적중 예상도를 쓴 경우 참고 표시)
RECORD = os.path.join(ROOT, "전체경기기록.csv")
SHORT = {}  # 베트맨 앱은 단축명(콜로래피·미네소타U)으로 표기하는데 G101 API엔 없다(2026-10-15 확인). 표 밑에 번호로 찾으라는 안내만 둔다.


def final_probs(rnd):
    """전체경기기록 보정_*(round_log anchor: 순수50+기준선50→보정 계수) → {번호: {승,무,패}} (2026-10-15).
    --own 으로 들어온 원본 확률은 일반 승무패·승패 선택에 한해 이 최종 값으로 바뀐다. 핸디캡·U/O 는 원본 그대로."""
    out = {}
    try:
        for r in csv.DictReader(open(RECORD, encoding="utf-8-sig")):
            if r["회차"] != str(rnd) or not r.get("보정_승"):
                continue
            if r.get("정합성") in ("A", "B"):
                # 2026-10-17 123 중간회고: 근거 JSON(수집가/분석가) 경기는 분석가 최종이 이미 기준선에서 출발한다.
                # anchor(기준선 50 재혼합 + 옛 평평한 순수로 학습한 온도·홈 편향)를 또 씌우면 홈 승이 시장보다 +7~10%p 부푼다
                # (121·122·123 연속, 번리 39→49·시드니 45→60). 새 방식 30경기 채점 뒤 calibrate 재학습 전까지 분석가 최종을 쓴다.
                continue
            try:
                d = {"승": float(r["보정_승"]), "무": float(r["보정_무"] or 0), "패": float(r["보정_패"])}
                hp = r.get("적중예상도")
                if hp:   # 2026-10-15: 예상 결과(순수 1순위)의 적중 예상도 — 그 선택지에만 붙는다
                    pu = {k: float(r.get(f"순수_{k}") or 0) for k in ("승", "무", "패")}
                    d["_top"] = max(pu, key=pu.get); d["_hit"] = float(hp)
                out[r["번호"]] = d
            except ValueError:
                pass
    except OSError:
        pass
    return out


def leg_type(p, mk, pick, top, odds, raw=None):
    """추천 다리 판정 — 2026-10-19 2차 교체 (297다리 백테스트, 회차 5개 모두 회수 100%+ 확인).
    측정(일치 + 내가 시장보다 3%p+ 낮게 본 다리, 배당 구간별 적중·단식 회수):
        1.20~1.30  69% / 86%   ← 마진 과다, 금지
        1.30~1.45  74% / 101%
        1.45~1.60  82% / 124%  ← 최적
        1.60~1.90  65% / 113%  ← 정확도 낮음, 조합이 깨진다
        1.90+      53% / 108%  ← 금지
    규칙: ① 내 1순위 = 시장 1순위(갈림 39% — 영구 금지) ② 배당 1.30~1.90 ③ 내−시장 < +2(과신 금지).
          B+ = 1.45~1.60 또는 (1.30~1.60 & gap ≤ −3). 조합은 B+ 우선.
    내 확률 절대값은 문턱으로 쓰지 않는다(구간별 적중 비단조). 역배(시장 1순위 아닌 쪽)는 63다리 32%·회수 81%로 제외."""
    if p is None or mk is None or odds is None:
        return "-"
    base = raw if raw is not None else p
    gap = base - mk
    if top and pick != top:
        return "✗ 역배·방향 갈림(실측 32%)"
    if gap >= 8:
        return "✗ 과신(내−시장 +%.0f, 실측 39%%)" % gap
    if gap >= 2:
        return "✗ 내가 시장보다 높음(+%.0f)" % gap
    if odds < 1.30:
        return "✗ 배당<1.30(마진 과다, 실측 69%·86%)"
    if odds > 1.90:
        return "✗ 배당>1.90(실측 53%)"
    if 1.45 <= odds <= 1.60 or (odds <= 1.60 and gap <= -3):
        return "B+ 최적(1.45~1.6 또는 내가 낮게 봄)"
    if odds <= 1.60:
        return "B 일치"
    return "B− 고배당(1.6~1.9, 정확도 65%)"


def leg_type_fun(p, mk, pick, top, odds, raw=None, mk_all=None):
    """도파민(위성) 트랙 — **단식 전용**. 2026-10-19 2차 교체(측정으로 조건·구조 모두 수정).
    측정(119~123, 축구 310경기 / 역배 50다리):
      · 무 기준선(실제 무 발생률) 21.3%.
        내 무 확률 28%+ → 128경기 31%(배수 1.47)  ← 느슨함(전체의 41%)
        **시장 1순위 < 45% + 시장 무 ≥ 28% → 37경기 38%(배수 1.78)·회수 96%**  ← 가장 선별적
        내 1·2순위 차 3%p 미만(박빙) → 22경기 18%(배수 0.85) ← **내 박빙 판정은 무 신호가 아니다**
      · 역배 전체 50다리 26%·회수 76% → **내−시장 ≥ +10%p 16다리 31%·회수 105%**
      · **조합 금지**: 엄선 52다리를 2폴더로 묶으면 25조합 8.0%·회수 50%(단식 102%). 36% 다리를 곱하면 깨진다.
        도파민 평균 배당 2.86이라 단식만으로 사용자 고정(합계 1.8+)을 충족한다.
    mk_all = 시장 확률 dict(무 조건 판정에 필요)."""
    if p is None or mk is None or odds is None:
        return "-"
    base = raw if raw is not None else p
    if pick == "무":
        if not mk_all:
            return "✗ 무 판정에 시장 확률 필요"
        mtop = max(mk_all, key=mk_all.get)
        if mk_all[mtop] >= 45:
            return "✗ 시장 1순위 45%+ (혼전 아님)"
        if mk_all.get("무", 0) < 28:
            return "✗ 시장 무<28(실측 21%)"
        if not (2.2 <= odds <= 4.5):
            return "✗ 무 배당 범위 밖(2.2~4.5)"
        return "D 무 단식(실측 38%·배수 1.78)"
    if top and pick == top:
        return "✗ 정배는 코어 트랙"
    if base - mk < 10:
        return "✗ 역배 근거 약함(내−시장 +%.0f < 10)" % (base - mk)
    if not (1.8 <= odds <= 4.0):
        return "✗ 역배 배당 범위 밖(1.8~4.0)"
    return "D 역배 단식(실측 31%·회수 105%)"


_GRADE = None


def integrity_grade(r):
    """전체경기기록 '정합성' 등급 (integrity.py add). 선택지 번호와 경기 번호가 달라 경기명(홈 vs 원정)으로 찾는다."""
    global _GRADE
    if _GRADE is None:
        _GRADE = {}
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "전체경기기록.csv")
        for x in csv.DictReader(open(p, encoding="utf-8")):
            _GRADE[(x["회차"], f"{x['홈']} vs {x['원정']}")] = x.get("정합성", "")
    return _GRADE.get((str(r.get("회차", "")), r.get("경기", "")), "")


def table(by_no, title, picks):
    lines = []
    if title:
        lines.append(f"**{title}**\n")
    if OWN:   # 2026-10-15 사용자 결정: 내 분석(가리고 확정) 뒤 시장과 비교 — A 갈림 / B 일치
        lines.append("| 번호 | 경기 | 게임 | 승 | 무 | 패 | 내 분석 | 시장 | 유형 |")
        lines.append("|---|---|---|---|---|---|---|---|---|")
    else:
        lines.append("| 번호 | 경기 | 게임 | 승 | 무 | 패 | 확률(시장·내 분석 미입력) |")
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
        p = OWN[(no, pick)] if (no, pick) in OWN else (None if OWN else (float(sel["공정확률"]) if sel and sel["공정확률"] else None))
        if sel:
            odds *= float(sel["베트맨"])
        prob = prob * p / 100 if (p is not None and prob is not None) else None
        when = r["시각"][5:16]
        game_cell = f"{r['경기']} ({when})"
        raw = RAW.get((no, pick))
        cal = CAL.get((no, pick))
        hit = CAL.get((no, pick))   # 적중 예상도(hit_model) — 기록·참고만 (2026-10-15 판정 전)
        ps = (f"{p:.1f}%" + (f" (예상도 {hit:.0f})" if hit is not None else "") + (f" (원본 {raw:.0f})" if raw is not None and abs(raw - p) >= 0.5 else "")) if p is not None else "-"
        if OWN:
            mk = float(sel["공정확률"]) if sel and sel.get("공정확률") else None
            top = max(opts, key=lambda o: float(o["공정확률"] or 0))["선택"] if all(o.get("공정확률") for o in opts) else None
            ty = leg_type(p, mk, pick, top, float(sel["베트맨"]) if sel else None, raw)
            g = integrity_grade(r)   # 2026-10-16 사용자 지시: 데이터 정합성 C(오래된·잘못된 자료)·미검사는 다리 금지
            if g != "A" and g != "B":
                ty = f"✗ 정합성 {g or '미검사'}"
            lines.append(f"| {no} | {game_cell} | {kind(r)} | {c[0]} | {c[1]} | {c[2]} | {ps} | {f'{mk:.1f}%' if mk is not None else '-'} | {ty} |")
        else:
            lines.append(f"| {no} | {game_cell} | {kind(r)} | {c[0]} | {c[1]} | {c[2]} | {ps} |")
    if OWN:
        lines.append("\n유형 A = 시장과 갈림(1순위 다름 또는 내 확률 ≥ 시장+8%p): 확인된 사실 근거 + 배당 1.2+ · B = 일치: 내 60%+·시장 60%+·배당 1.2+ (기대값 조건 폐지 2026-10-16) · ✗ = 둘 다 아님(추천 금지) · ✗ 정합성 = integrity.py 등급 C·미검사(추천 금지, 2026-10-16)")
    lines.append("\n앱에서는 팀명이 단축 표기(예: 콜로래피·미네소타U)라 **게임번호**로 찾는다.")
    t = timing(by_no, picks)
    if t:
        lines.append(t)
    if len(picks) > 1:
        lines.append(f"\n합계 배당 **{odds:.2f}배** · 적중 확률 **{prob * 100:.1f}%**" if prob is not None else f"\n합계 배당 **{odds:.2f}배**")
        if any("도파민" in (title or "") or "[D]" in (title or "") for _ in [0]) and len(picks) > 1:
            lines.append("⚠ 도파민은 **단식 전용**이다 — 엄선 다리도 2폴더로 묶으면 25조합 8%·회수 50%(단식 102%). 한 경기씩 따로 낸다.")
        if len(picks) > 2:
            lines.append(f"⚠ {len(picks)}폴더 — 1.8배 제약에서 3폴더는 다리당 1.22가 필요하고 그 구간 실측 적중 69%(회수 86%)다. **2폴더 권장**(실측 2폴더 회수 128%).")
        if odds < MIN_COMBO_ODDS:
            lines.append(f"⚠ 조합 합계 배당 {odds:.2f} < {MIN_COMBO_ODDS} — 사용자 기준(2026-10-19) 미달. 다리를 더하거나 배당 높은 다리로 바꾼다.")
    else:
        lines.append("⚠ 단일 다리 — 프로토 추천은 2폴더 이상만(2026-10-16).")
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
                   "경기": sel["경기"], "게임": kind(sel), "배당": sel["베트맨"], "확률": OWN.get((no, pick), sel["공정확률"]), "구분": kind_,
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
    ap.add_argument("--own", nargs="*", default=[], help='"번호:선택=내 분석 확률(%%)" — 표·기록의 확률을 내 분석으로 (2026-10-13부터 필수)')
    a = ap.parse_args()
    by_no = load(a.round)
    fin = final_probs(a.round)
    for x in a.own:
        leg, _, v = x.partition("=")
        no, pk = leg.strip().split(":")
        OWN[(no, pk)] = float(v)
        opts = by_no.get(no) or []
        plain = bool(opts) and opts[0]["유형"] in ("승무패", "승패") and not opts[0]["구분"].startswith("전반")
        if plain and no in fin and pk in fin[no] and fin[no][pk] > 0:
            RAW[(no, pk)] = float(v)
            if fin[no].get("_top") == pk and fin[no].get("_hit") is not None:
                OWN[(no, pk)] = fin[no][pk]          # 2026-10-15 구조 변경: 내 분석 = 최종(보정) 확률
                CAL[(no, pk)] = fin[no]["_hit"]      # 적중 예상도는 기록·참고만 (121·122 86경기에서 구간 분리 안 됨)
            else:
                OWN[(no, pk)] = fin[no][pk]   # 예상 결과가 아닌 선택지(또는 모델 없음): 보정 확률
    buys = dict(b.rsplit("=", 1) for b in a.buy)
    items, combos_ = [], []
    for c in a.combos:
        title, _, body = c.rpartition("=")
        picks = [tuple(x.strip().split(":")) for x in body.split(",") if x.strip()]
        print(table(by_no, title, picks) + "\n")
        kind = "도파민" if ("도파민" in title or "[D]" in title) else "추천"   # 코어/위성 분리 집계 (2026-10-19)
        items += [(no, pk, kind, title, "", buys.get(title, "")) for no, pk in picks]
        combos_.append((title, picks))
    for sk in a.skip:
        leg, _, why = sk.partition("=")
        no, pk = leg.strip().split(":")
        items.append((no, pk, "추천제외", "", why.strip(), ""))
    if a.save and combos_:
        save_schedule(by_no, a.round, combos_, buys)
    if a.save or a.skip:
        save_rec(by_no, a.round, [x for x in items if a.save or x[2] == "추천제외"])


if __name__ == "__main__":
    main()
