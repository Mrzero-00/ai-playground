#!/usr/bin/env python3
"""
데이터 정합성 검사 + 근거 기록 (사용자 지시 2026-10-16)

왜: 지금은 분석 기술을 키우기 위한 '자료를 쌓는 단계'다. 오래된 정보·리그 평균·과거 시즌 자료로 낸 확률을
    그대로 기록하면 학습 자료가 오염돼 정확도 향상을 오히려 막는다(10/16: 프로시노네 언더 78.9%는 경기별 xG 대신
    리그 평균 근처 기준선 총득점으로 계산 → 실제 xG로는 약 50%; 123회 팀 팩트시트 미생성 상태로 분석).
    그래서 (1) 분석에 쓴 자료가 최신인지 검사하고, (2) 확률이 어떤 근거로 몇 %p씩 만들어졌는지 구조화해 남긴다.

자료
  data/근거기록.csv   한 행 = 한 근거(요인) 또는 경기 요약. 결과 뒤 방향 적중을 채워 요인별 정확도를 배운다.
  data/정합성기록.csv 한 행 = 한 경기 검사 결과(등급 A/B/C, 문제 목록).
  전체경기기록.csv '정합성' 열 = 등급. **C는 calibrate·hit_model·own_model·fast_learn 학습에서 제외**, pick_table 다리 금지.

근거 JSON (조사 에이전트가 경기마다 출력 — 조사프롬프트.md '근거 JSON' 절)
  [{"번호": "8665", "홈": "프랑크푸르트", "원정": "쾰른",
    "기준선": {"승": 51.4, "무": 24.8, "패": 23.9, "출처": "soccer_baseline pi-rating 2026-10-16"},
    "득점모델": {"방식": "xG", "λ홈": 2.31, "λ원정": 2.16, "출처": "Understat 시즌 xG/xGA (INPUTS 2026-10-16)"},
    "요인": [{"유형": "결장", "팀": "원정", "선수": "Skhiri", "등급": "A", "상태": "확정", "영향": 3,
              "내용": "발목 인대, 연내 복귀 불가(감독)", "출처": "https://...", "날짜": "2026-10-14"}],
    "최종": {"승": 54, "무": 24, "패": 22},
    "선택지": [{"번호": "8665", "선택": "패", "확률": 70, "계산": "점수분포 λ2.31:2.16"}],
    "결론": "왜 이 확률인가 2~3문장", "미확인": ["확정 선발"]}]
  - 영향 = 홈 승 확률 변화 %p (+ 홈 유리, − 원정 유리). 기준선 승 + Σ영향 ≈ 최종 승 (±2) 이어야 한다.
  - 유형 어휘: 결장 · 복귀 · 징계 · 라인업 · 감독 · xG · 폼 · 휴식 · 일정 · 맞대결 · 동기 · 홈원정 · 전술 · 날씨 · 선발투수 · 불펜 · 기타
  - 상태: 확정 · 의심 · 추정(추정만으로 된 요인은 A 갈림 근거 불가)
  - 뉴스가 없을 때(2026-10-16): {"유형": "뉴스없음", "팀": "원정", "영향": 0, "검색처": "구단 공식, 지역지 X, Transfermarkt 부상표", "내용": "10/16 21시 검색, 결장·징계 보도 없음"}
    → 정상(등급 영향 없음). 뉴스 보정 0으로 데이터(기준선·xG·직전 선발 XI)만으로 계산. 이 경기는 A 갈림 근거가 없으니 B 일치만 가능.
    팀마다 뉴스 요인 또는 '뉴스없음' 중 하나는 반드시 있어야 한다(없으면 '확인 안 함' = C).

사용
  python3 scripts/integrity.py pre <회차> [--from "MM-DD HH:MM" --to ...]   # 분석 전: 팩트시트·INPUTS 최신 여부 (빠지면 먼저 채운다)
  python3 scripts/integrity.py add <회차> <근거.json>                        # 근거 기록 + 검사 + 등급을 전체경기기록에
  python3 scripts/integrity.py grade <회차>                                  # 결과 뒤 요인별 방향 적중 채점
  python3 scripts/integrity.py report                                        # 요인 유형별 적중(등급 A·B만)
"""
import argparse
import csv
import datetime as dt
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import round_log as R  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
NOTES = os.path.join(ROOT, "팀노트")
EVI = os.path.join(ROOT, "data", "근거기록.csv")
CHK = os.path.join(ROOT, "data", "정합성기록.csv")
EVI_COLS = ["회차", "번호", "경기", "기록시각", "구분", "유형", "팀", "선수", "등급", "상태", "영향", "내용", "출처", "날짜", "검색처",
            "기준선", "득점모델", "최종", "선택지", "결론", "미확인", "결과", "방향적중"]
CHK_COLS = ["회차", "번호", "경기", "검사시각", "등급", "심각", "경미"]
SNAP = os.path.join(ROOT, "data", "예측스냅샷.csv")
SNAP_COLS = ["회차", "번호", "경기", "기록시각", "단계", "근거파일", "정합성", "기준선", "최종", "선택지", "시장", "결과", "점수"]

# ── 어휘 고정 (사용자 지시 2026-10-18: 나중에 분석 스킬을 키울 수 있는 데이터) ──────────────
# 분석가가 자유롭게 쓰면 같은 요인이 '일정·일정피로·휴식'처럼 쪼개져 유형별 30건 판정에 영원히 못 간다.
TYPES = ("결장", "복귀", "징계", "라인업", "로테이션", "감독", "휴식", "이동", "고도", "날씨", "xG", "폼", "기준선불신",
         "맞대결", "동기", "홈원정", "전술", "선발투수", "불펜", "뉴스없음", "기타")
TYPE_RULES = [  # (포함 문자열들, 표준 유형) — 위에서부터 먼저 맞는 것
    (("뉴스없음",), "뉴스없음"), (("기준선",), "기준선불신"), (("로테이션",), "로테이션"), (("고도",), "고도"), (("이동", "원정거리"), "이동"),
    (("날씨", "우천", "강풍", "기온"), "날씨"), (("징계", "퇴장", "경고누적", "출장정지"), "징계"), (("복귀",), "복귀"),
    (("결장", "부상", "이탈", "의심정보"), "결장"), (("라인업", "선발명단", "예상xi"), "라인업"), (("감독",), "감독"),
    (("휴식", "일정", "피로", "연전"), "휴식"), (("xg",), "xG"), (("폼", "흐름", "연승", "연패", "득점력"), "폼"),
    (("맞대결", "상대전적"), "맞대결"), (("동기", "순위경쟁", "강등", "클래스"), "동기"), (("홈원정", "홈 이점", "홈이점"), "홈원정"),
    (("전술", "포메이션", "상성"), "전술"), (("선발투수",), "선발투수"), (("불펜",), "불펜")]
STATES = ("확정", "의심", "추정")


def norm_type(t):
    t0 = (t or "").strip()
    if t0 in TYPES:
        return t0
    low = t0.lower().replace(" ", "")
    for keys, std in TYPE_RULES:
        if any(k.replace(" ", "") in low for k in keys):
            return std
    return "기타"


def norm_state(s):
    s0 = (s or "").strip()
    for st in STATES:
        if s0.startswith(st):
            return st
    if s0.startswith("확인"):
        return "확정"
    return "추정"     # 빈칸·자유 서술 = 확인 안 된 것으로 본다


# 결장 '여부'를 흐리는 표현. '복귀 전망/복귀 예상'은 결장이 확정이고 돌아올 날짜만 추정하는 것이라 뺀다.
HEDGE = ("유력", "아마", "불투명", "출전 가능", "결장 가능", "가능성", "doubtful", "questionable", "probable", "game-time")
HEDGE_OK = ("복귀 전망", "복귀 예상", "복귀 가능", "복귀 시점")


def hedged(f):
    """'확정' 결장인데 내용이 결장 여부 자체를 추측하고 있으면 그 표현을 돌려준다."""
    txt = (f.get("내용") or "")
    for ok in HEDGE_OK:
        txt = txt.replace(ok, "")
    low = txt.lower()
    for h in HEDGE:
        if h in txt or h in low:
            return h
    return ""


def norm_factor(f):
    """표준 유형·상태로 바꾸고, 바뀐 원문은 내용 앞에 [원: …]으로 남긴다."""
    f = dict(f)
    t, st = norm_type(f.get("유형", "")), norm_state(f.get("상태", ""))
    keep = []
    if t != (f.get("유형") or ""):
        keep.append(f"유형 {f.get('유형')}")
    if st != (f.get("상태") or ""):
        keep.append(f"상태 {f.get('상태')}")
    if keep:
        f["내용"] = f"[원: {' · '.join(keep)}] " + (f.get("내용") or "")
    f["유형"], f["상태"] = t, st
    return f
XG_LEAGUES = ("프리미어리그", "라리가", "분데스리가", "세리에A", "리그1")   # Understat xG 제공 (2부 리그 제외)
NEWS_TYPES = ("결장", "복귀", "징계", "라인업", "감독", "선발투수", "불펜")
NEWS_DAYS = 7      # 결장·라인업류 뉴스는 분석 시점 7일 이내 기사만
FACTS_DAYS = 3
TOL_SUM = 2.0      # 기준선 승 + Σ영향 vs 최종 승 허용 오차(%p)


def today():
    return dt.datetime.now(R.KST).date() if hasattr(R, "KST") else dt.date.today()


def note_dates(team):
    """팀노트의 FACTS·INPUTS 수집 날짜 (없으면 None)."""
    p = os.path.join(NOTES, f"{team}.md")
    if not os.path.exists(p):
        return None, None
    s = open(p, encoding="utf-8").read()
    f = re.search(r"FACTS:START -->\s*\n## 팩트시트 \(자동 수집 (\d{4}-\d{2}-\d{2})", s)
    i = re.search(r"INPUTS:START -->\s*\n## 입력\(자동 수집 (\d{4}-\d{2}-\d{2})", s)
    d = lambda m: dt.date.fromisoformat(m.group(1)) if m else None
    return d(f), d(i)


def note_checks(r, severe, minor):
    if r.get("종목") != "축구":
        return
    for side in ("홈", "원정"):
        fd, idt = note_dates(r[side])
        if fd is None:
            severe.append(f"{r[side]} 팩트시트 없음")
        elif (today() - fd).days > FACTS_DAYS:
            severe.append(f"{r[side]} 팩트시트 {fd} ({(today() - fd).days}일 지남)")
        if idt is None:
            severe.append(f"{r[side]} INPUTS 없음")
        elif (today() - idt).days > 1:
            severe.append(f"{r[side]} INPUTS {idt} (오래됨)")


def evidence_checks(r, e, severe, minor):
    if not e.get("요인") or len(e["요인"]) < 2:
        severe.append("근거 요인 2개 미만")
    if not (e.get("결론") or "").strip():
        severe.append("결론(추천 이유) 없음")
    b, fin = e.get("기준선") or {}, e.get("최종") or {}
    if not b or not fin:
        severe.append("기준선 또는 최종 확률 없음")
    else:
        s = sum(float(f.get("영향") or 0) for f in e.get("요인", []))
        gap = float(fin["승"]) - (float(b["승"]) + s)
        if abs(gap) > 2 * TOL_SUM:
            severe.append(f"합계 불일치: 기준선 {b['승']} + 영향 {s:+.1f} ≠ 최종 {fin['승']} (차 {gap:+.1f})")
        elif abs(gap) > TOL_SUM:
            minor.append(f"합계 오차 {gap:+.1f}%p")
    gm = e.get("득점모델") or {}
    has_ou = any(re.search(r"언더|오버|H[-+]", str(c.get("계산", "")) + str(c.get("선택", ""))) or c.get("계산") for c in e.get("선택지", []))
    if r.get("종목") == "축구":
        if gm.get("방식") == "리그평균":
            severe.append("득점모델이 리그 평균 — 경기별 λ 필요")
        # 2026-10-19 수정: '방식' 문자열 완전일치(== "xG")는 거짓 C를 냈다.
        # "xG+기준선 혼합" 처럼 xG 를 실제로 쓴 분석까지 탈락시켰으므로,
        # 실질 기준(방식에 xG 가 들어가고 경기별 λ 가 양수로 채워졌는가)으로 바꾼다.
        if "K리그" not in (r.get("리그") or "") and any(k in (r.get("리그") or "") for k in XG_LEAGUES) and "2부" not in (r.get("리그") or "") and has_ou:
            def _pos(v):
                try:
                    return float(v) > 0
                except (TypeError, ValueError):
                    return False
            if "xG" not in str(gm.get("방식") or ""):
                severe.append("xG 제공 리그인데 핸디캡·언더오버 확률을 xG λ로 계산하지 않음")
            elif not (_pos(gm.get("λ홈")) and _pos(gm.get("λ원정"))):
                severe.append("득점모델 방식에 xG 라고 적었으나 경기별 λ홈·λ원정 숫자가 없음")
    # 뉴스 없음 ≠ 확인 안 함 (2026-10-16 사용자 질문): 팀마다 '결장·라인업 뉴스를 찾아봤다'는 기록이 있어야 한다.
    # 찾았으면 뉴스 요인(URL·날짜), 못 찾았으면 유형 '뉴스없음' + 검색처 2곳 이상(현지 매체·구단 공식 등) + 영향 0.
    for side in ("홈", "원정"):
        fs = [f for f in e.get("요인", []) if f.get("팀") == side]
        news = [f for f in fs if f.get("유형") in NEWS_TYPES]
        none_ = [f for f in fs if f.get("유형") == "뉴스없음"]
        if not news and not none_:
            severe.append(f"{side} 뉴스 확인 기록 없음(찾았으면 요인, 없으면 '뉴스없음'+검색처)")
        for f in none_:
            if len([x for x in re.split(r"[,·/]", str(f.get("검색처", ""))) if x.strip()]) < 2:
                severe.append(f"{side} '뉴스없음'인데 검색처 2곳 미만")
            if float(f.get("영향") or 0) != 0:
                severe.append(f"{side} '뉴스없음' 요인에 영향 %p를 줌(0이어야 함)")
    for f in e.get("요인", []):
        if f.get("유형") == "뉴스없음":
            continue
        tag = f"{f.get('유형')}·{f.get('선수') or f.get('내용', '')[:15]}"
        if not f.get("출처"):
            (severe if f.get("유형") in NEWS_TYPES else minor).append(f"출처 없음: {tag}")
        if not f.get("날짜"):
            (severe if f.get("유형") in NEWS_TYPES else minor).append(f"날짜 없음: {tag}")
        else:
            try:
                age = (today() - dt.date.fromisoformat(f["날짜"][:10])).days
                if f.get("유형") in NEWS_TYPES and age > NEWS_DAYS:
                    severe.append(f"오래된 뉴스 {age}일: {tag}")
            except ValueError:
                minor.append(f"날짜 형식 오류: {tag}")
        if f.get("상태") not in ("확정", "의심", "추정"):
            minor.append(f"상태 누락: {tag}")
        # 2026-10-21(124회 심층회고): CLAUDE.md 의 '추정 결장 0' 상한이 코드로 막혀 있지 않아
        # 124회에만 '의심·추정'인데 영향 %p 를 준 요인이 53개 나왔다(맨시티 Haaland 의심 -1.9 → 5:1 승,
        # 그 탓에 오버3.5 B+ 다리를 뺐는데 실제 6골). 확인 안 된 결장으로 확률을 움직이지 않는다.
        # 2026-10-21(124회 심층회고): 휴식·일정 피로 요인은 방향 적중 11/51(22%)로 세 회차 연속 꼴찌다
        # (123회 4/21·124회 5/17·승무패61 2/13, 단측 p=0.00003). 대부분 유럽대항전 직후 팀에 감점을 주는데
        # 그 팀이 그냥 이긴다 — pi-rating 기준선이 이미 전력차를 담고, 로테이션은 강팀 뎁스로 흡수된다.
        # 절제 실험(factor_value.py --drop 휴식)도 뺀 쪽이 낫다(1순위 +1.4%p·RPS -0.0072).
        # → 기록은 계속하되 확률은 움직이지 않는다. 분석규칙 2026-10-21 [중간].
        if f.get("유형") == "휴식":
            try:
                if float(f.get("영향") or 0) != 0:
                    minor.append(f"'휴식' 요인에 영향 {f.get('영향')}%p (2026-10-21부터 상한 0, 기록만): {tag}")
            except (TypeError, ValueError):
                pass
        if f.get("유형") == "결장" and f.get("상태") == "추정":
            try:
                if float(f.get("영향") or 0) != 0:
                    minor.append(f"'추정' 결장에 영향 {f.get('영향')}%p (상한 0): {tag}")
            except (TypeError, ValueError):
                pass
        # 2026-10-21(125회 심층회고): '확정'인데 근거 문장이 추측인 결장을 잡는다.
        # 124회 9630 KCC 허웅 — 근거가 감독 코멘트("다음 경기도 **아마** 쉽지 않을 것")뿐인데 상태를 확정,
        # 영향 +4%p 로 썼다. 실제로는 복귀해 11득점했다(삼성이 이겨서 결과는 맞았지만 요인은 사실 오류).
        # 상태 칸이 확신도를 담는 자리인데 '유력·아마'가 섞이면 그 뒤 모든 집계(요인 검증·절제 실험)가 흐려진다.
        # 확률을 깎지는 않는다 — 의심 결장의 영향은 52경기 절제 실험에서 해롭지 않았다(1순위 48.1% 동일, RPS 0.2057 vs 뺀 쪽 0.2077).
        # 라벨만 바로잡게 '경미'로 알린다.
        if f.get("유형") == "결장" and norm_state(f.get("상태")) == "확정" and hedged(f):
            minor.append(f"'확정' 결장인데 근거가 추측 표현({hedged(f)}) — 상태는 '의심'이어야 한다: {tag}")


def grade_of(severe, minor):
    return "C" if severe else ("B" if minor else "A")


def append(path, cols, rows):
    new = not os.path.exists(path)
    with open(path, "a", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, lineterminator="\n")
        if new:
            w.writeheader()
        for x in rows:
            w.writerow({c: x.get(c, "") for c in cols})


def find(rows, rnd, e):
    # 번호 우선. 이름 일치는 결과 없는 행만(2026-10-17: 같은 대진 연전 — 한신-DeNA 4차전 근거가 3차전 8615 행에 붙던 버그)
    for r in rows:
        if r["회차"] == str(rnd) and r["번호"] == str(e.get("번호")):
            return r
    for r in rows:
        if r["회차"] == str(rnd) and r["홈"] == e.get("홈") and r["원정"] == e.get("원정") and not r.get("결과"):
            return r
    return None


def cmd_pre(a):
    rows = [r for r in R.load() if r["회차"] == str(a.round)]
    bad = 0
    for r in rows:
        t = r["시각"][:11] if len(r["시각"]) <= 11 else r["시각"][5:16]
        if a.frm and t < a.frm or a.to and t > a.to:
            continue
        sev = []
        note_checks(r, sev, [])
        if sev:
            bad += 1
            print(f"✗ {r['번호']} {r['홈']}-{r['원정']}: " + " / ".join(sev))
    print(f"분석 전 정합성: 문제 {bad}경기" + (" → team_facts.py --round N --stale 3 · match_inputs.py --round N --date MM-DD 먼저 실행" if bad else " — 통과"))


def cmd_add(a):
    data = json.load(open(a.file, encoding="utf-8"))
    rows = R.load()
    now = dt.datetime.now(R.KST).strftime("%Y-%m-%d %H:%M")
    ev, ck, snaps = [], [], []
    for e in data:
        r = find(rows, a.round, e)
        if r is None:
            print(f"? 경기 없음: {e.get('번호')} {e.get('홈')}-{e.get('원정')}")
            continue
        severe, minor = [], []
        note_checks(r, severe, minor)
        evidence_checks(r, e, severe, minor)
        g = grade_of(severe, minor)
        r["정합성"] = g
        game = f"{r['홈']}-{r['원정']}"
        base = {"회차": r["회차"], "번호": r["번호"], "경기": game, "기록시각": now}
        for f in e.get("요인", []):
            f = norm_factor(f)
            ev.append({**base, "구분": "요인", **{k: f.get(k, "") for k in ("유형", "팀", "선수", "등급", "상태", "영향", "내용", "출처", "날짜", "검색처")}})
        snaps.append({"회차": r["회차"], "번호": r["번호"], "경기": game, "기록시각": now,
                      "단계": "재분석" if "재분석" in os.path.basename(a.file) or "갱신" in os.path.basename(a.file) else "초기",
                      "근거파일": os.path.relpath(a.file, ROOT) if os.path.isabs(a.file) else a.file, "정합성": g,
                      "기준선": json.dumps(e.get("기준선"), ensure_ascii=False), "최종": json.dumps(e.get("최종"), ensure_ascii=False),
                      "선택지": json.dumps(e.get("선택지"), ensure_ascii=False), "시장": json.dumps(market_now(r), ensure_ascii=False),
                      "결과": "", "점수": ""})
        ev.append({**base, "구분": "요약", "기준선": json.dumps(e.get("기준선"), ensure_ascii=False),
                   "득점모델": json.dumps(e.get("득점모델"), ensure_ascii=False), "최종": json.dumps(e.get("최종"), ensure_ascii=False),
                   "선택지": json.dumps(e.get("선택지"), ensure_ascii=False), "결론": e.get("결론", ""),
                   "미확인": " / ".join(e.get("미확인", []))})
        ck.append({"회차": r["회차"], "번호": r["번호"], "경기": game, "검사시각": now, "등급": g,
                   "심각": " / ".join(severe), "경미": " / ".join(minor)})
        print(f"[{g}] {r['번호']} {game}" + (f" — 심각: {' / '.join(severe)}" if severe else "") + (f" — 경미: {' / '.join(minor)}" if minor else ""))
    R.save(rows)
    append(EVI, EVI_COLS, ev)
    append(CHK, CHK_COLS, ck)
    append(SNAP, SNAP_COLS, snaps)   # 덮어쓰지 않는 예측 기록 — 초기·라인업 후 재분석을 모두 남긴다
    print(f"근거 {len(ev)}행 → data/근거기록.csv · 검사 {len(ck)}경기 → data/정합성기록.csv · 등급 → 전체경기기록 '정합성'")
    if any(c["등급"] == "C" for c in ck):
        print("⚠ C 경기는 추천 다리 금지·학습 제외. 자료를 고쳐 다시 add 하면 새 등급으로 덮어쓴다.")


def market_now(r):
    """그 시점 스캔기록의 이 경기 선택지별 시장 공정확률·베트맨 배당 {번호/구분/선택: [공정, 배당]}."""
    out = {}
    p = os.path.join(ROOT, "data", "스캔기록.csv")
    if not os.path.exists(p):
        return out
    want = f"{r['홈']} vs {r['원정']}"
    for x in csv.DictReader(open(p, encoding="utf-8-sig")):
        if x["회차"] == r["회차"] and x["경기"] == want:
            out[f"{x['번호']}/{x['구분']}/{x['선택']}"] = [x["공정확률"], x["베트맨"]]
    return out


def cmd_normalize(a):
    """기존 근거기록의 유형·상태를 표준 어휘로 정리(원문은 내용 앞 [원: …])."""
    ev = list(csv.DictReader(open(EVI, encoding="utf-8")))
    before = (len({x["유형"] for x in ev if x["구분"] == "요인"}), len({x["상태"] for x in ev if x["구분"] == "요인"}))
    n = 0
    for i, x in enumerate(ev):
        if x["구분"] != "요인":
            continue
        y = norm_factor(x)
        if (y["유형"], y["상태"]) != (x["유형"], x["상태"]):
            ev[i] = {**x, **{k: y[k] for k in ("유형", "상태", "내용")}}; n += 1
    with open(EVI, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=EVI_COLS, extrasaction="ignore"); w.writeheader(); w.writerows(ev)
    after = (len({x["유형"] for x in ev if x["구분"] == "요인"}), len({x["상태"] for x in ev if x["구분"] == "요인"}))
    print(f"{n}행 정리 · 유형 {before[0]}→{after[0]}종 · 상태 {before[1]}→{after[1]}종")


def cmd_mark(a):
    """근거 JSON 없이 등급만 지정(소급 표시용): integrity.py mark 123 8670=C:사유 ..."""
    rows = R.load()
    now = dt.datetime.now(R.KST).strftime("%Y-%m-%d %H:%M")
    ck = []
    for item in a.items:
        no, rest = item.split("=", 1)
        g, why = (rest.split(":", 1) + [""])[:2]
        for r in rows:
            if r["회차"] == str(a.round) and r["번호"] == no:
                r["정합성"] = g
                ck.append({"회차": r["회차"], "번호": no, "경기": f"{r['홈']}-{r['원정']}", "검사시각": now, "등급": g,
                           "심각" if g == "C" else "경미": why})
                print(f"[{g}] {no} {r['홈']}-{r['원정']} {why}")
    R.save(rows)
    append(CHK, CHK_COLS, ck)


def cmd_grade(a):
    if not os.path.exists(EVI):
        return print("근거기록 없음")
    res = {(r["회차"], r["번호"]): r.get("결과", "") for r in R.load()}
    ev = list(csv.DictReader(open(EVI, encoding="utf-8")))
    n = 0
    for x in ev:
        if x["회차"] != str(a.round) or x["방향적중"]:
            continue
        out = res.get((x["회차"], x["번호"]), "")
        if out not in ("승", "무", "패"):
            continue
        x["결과"] = out
        if x["구분"] == "요인":
            try:
                v = float(x["영향"] or 0)
            except ValueError:
                v = 0
            x["방향적중"] = "중립" if v == 0 else ("1" if (v > 0 and out == "승") or (v < 0 and out == "패") else ("무" if out == "무" else "0"))
        n += 1
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=EVI_COLS, lineterminator="\n")
    w.writeheader()
    for x in ev:
        w.writerow({c: x.get(c, "") for c in EVI_COLS})
    open(EVI, "w", encoding="utf-8").write(buf.getvalue())
    print(f"{a.round}회 근거 {n}행 채점")


def cmd_report(a):
    if not os.path.exists(EVI):
        return print("근거기록 없음")
    grade = {(r["회차"], r["번호"]): r.get("정합성", "") for r in R.load()}
    agg = {}
    for x in csv.DictReader(open(EVI, encoding="utf-8")):
        if x["구분"] != "요인" or x["방향적중"] not in ("0", "1", "무") or grade.get((x["회차"], x["번호"])) == "C":
            continue
        k = (x["유형"], x["상태"])
        a_ = agg.setdefault(k, [0, 0, 0])
        a_[0] += 1
        a_[1] += x["방향적중"] == "1"
        a_[2] += x["방향적중"] == "무"
    print("| 유형 | 상태 | 표본 | 방향 적중 | 무 |\n|---|---|---|---|---|")
    for (t, s), (n, h, d) in sorted(agg.items(), key=lambda kv: -kv[1][0]):
        print(f"| {t} | {s} | {n} | {h}/{n - d} ({100 * h / max(1, n - d):.0f}%) | {d} |")


def main():
    ap = argparse.ArgumentParser(description="데이터 정합성 검사 + 근거 기록")
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("pre"); p.add_argument("round"); p.add_argument("--from", dest="frm", default=""); p.add_argument("--to", default="")
    p = sp.add_parser("add"); p.add_argument("round"); p.add_argument("file")
    p = sp.add_parser("mark"); p.add_argument("round"); p.add_argument("items", nargs="+")
    p = sp.add_parser("grade"); p.add_argument("round")
    sp.add_parser("report")
    sp.add_parser("normalize")
    a = ap.parse_args()
    {"pre": cmd_pre, "add": cmd_add, "mark": cmd_mark, "grade": cmd_grade, "report": cmd_report, "normalize": cmd_normalize}[a.cmd](a)


if __name__ == "__main__":
    main()
