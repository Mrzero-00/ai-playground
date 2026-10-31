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
import unicodedata

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



# 2026-10-24(126회 심층회고): '비기기만 해도 우승·잔류'류 서사를 근거 문장에서 알아본다.
DRAW_ENOUGH = ("비기", "무승부만", "승점 1", "승점1", "비겨도", "비기면", "무승부면", "지지만 않")


def draw_is_enough(f):
    t = f"{f.get('내용') or ''} {f.get('근거') or ''}"
    return next((k for k in DRAW_ENOUGH if k in t), None)


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


def ref_date(r=None):
    """최신성 기준일 = **경기일**(없으면 오늘).

    2026-10-22(125회 심층회고): 지금까지 팩트시트·뉴스의 '며칠 지났나'를 오늘 기준으로 쟀다.
    그래서 회고 때 `add` 를 다시 돌리면 분석 시점엔 멀쩡했던 경기가 날짜가 지났다는 이유만으로
    C(추천 금지·학습 제외)로 떨어진다 — 9685 레알-라이프치히가 B → C 로 바뀌며 발견했다.
    등급은 '그때 그 자료로 분석한 것이 타당했는가'를 재는 값이므로 기준일은 경기일이어야 한다.
    경기일이 미래면(분석 시점) 오늘을 쓴다 — 분석 전 검사는 지금 자료가 최신인지를 봐야 하기 때문.
    이미 검사한 경기는 **첫 검사 날짜**를 그대로 쓴다(정합성기록.csv) — 같은 자료를 다시 넣으면
    언제 돌려도 같은 등급이 나와야 하기 때문이다.
    """
    first = _first_check(r)
    if first:
        return first
    t = (r or {}).get("시각") or ""
    m = re.match(r"(?:(\d{4})-)?(\d{1,2})-(\d{1,2})", t.strip())
    if not m:
        return today()
    now = today()
    y = int(m.group(1)) if m.group(1) else now.year
    try:
        d = dt.date(y, int(m.group(2)), int(m.group(3)))
    except ValueError:
        return today()
    if not m.group(1):           # 연도 없는 'MM-DD' — 회차 경계에서 해를 넘긴 경우 보정
        if (d - now).days > 180:
            d = d.replace(year=y - 1)
        elif (now - d).days > 180:
            d = d.replace(year=y + 1)
    return min(d, now) if d > now else d


_FIRST_CHECK = None


def _first_check(r):
    """정합성기록.csv 에 남은 (회차, 번호)의 첫 검사 날짜 — 재실행 시 등급을 고정하기 위한 기준일."""
    global _FIRST_CHECK
    if _FIRST_CHECK is None:
        _FIRST_CHECK = {}
        if os.path.exists(CHK):
            for x in csv.DictReader(open(CHK, encoding="utf-8-sig")):
                k = (str(x.get("회차")), str(x.get("번호")))
                try:
                    d = dt.date.fromisoformat(str(x.get("검사시각"))[:10])
                except ValueError:
                    continue
                if k not in _FIRST_CHECK or d < _FIRST_CHECK[k]:
                    _FIRST_CHECK[k] = d
    if not r:
        return None
    return _FIRST_CHECK.get((str(r.get("회차")), str(r.get("번호"))))


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


def news_check(r, severe):
    """뉴스 확인을 안 한 채 방향을 확정하지 못하게 막는다 (사용자 지시 2026-10-22, 개선안 4번).
    실측: 뉴스위험 칸을 채운 307경기는 내 58.3% vs 시장 58.0%(+0.3p)로 대등하지만,
    빈칸인 176경기는 50.6% vs 56.2%로 **5.7%p 뒤진다**. 확인 결과가 '없음'이어도 적게 한다 —
    빈칸은 '확인했는데 없었다'와 '아예 안 봤다'를 구별하지 못한다."""
    if (r.get("뉴스위험") or "").strip():
        return
    # 방향을 이미 적었는데 뉴스 칸이 비어 있으면 심각
    has_dir = any((r.get(f"{pre}_{k}") or "") for pre in ("순수", "보정") for k in ("승", "무", "패"))
    if has_dir:
        severe.append("뉴스위험 빈칸(확인 안 함 — '없음'이라도 적는다)")


OVERCONF_P = 15.0


def overconf_check(r, severe, minor):
    """내 1순위가 시장보다 크게 높으면 막는다 — 점검표 2회 반복이라 스크립트로 고정(2026-10-22 125회 심층회고).

    왜: 분석전_점검표의 '내 확률이 시장보다 +15%p 이상 높으면 시장 쪽으로 되돌린다' 는 124회에 올라왔는데
        125회 9766(뉴올리언스-인디애나)에서 **+21.6%p** 로 다시 어겼고 졌다. 사람이 읽는 표로는 안 지켜진다.
    실측(중복 제거·기준선/C/제외 뺀 325경기, 내−시장 gap 구간별 1순위 적중):
        ≤-15 84.8% · -15~-5 73.0% · -5~+2 50.0% · +2~+8 46.9% · +8~+15 41.5% · **+15 초과 30.0%**(n=10)
        농구만 보면 +15 초과 5경기에서 1/5(20%).
    무엇: 방향을 적었는데 같은 방향 시장 확률보다 OVERCONF_P 이상 높으면 '심각'으로 잡는다.
        이것은 **추천에서 빼는 게 아니라 숫자를 다시 보게 하는 것**이다(사용자 지시 2026-10-22:
        어긋나는 구간을 빼지 말고 격차 자체를 고쳐라). 근거를 다시 재고 값을 고치거나,
        그대로 두겠다면 왜 시장이 틀렸는지를 근거에 적어야 통과한다.
    시장 확률이 없으면(Pinnacle 미등재) 검사하지 않는다 — 비교 대상이 없다.
    """
    def num(x):
        try:
            return float(x)
        except (TypeError, ValueError):
            return None
    mine = {k: num(r.get(f"순수_{k}")) for k in ("승", "무", "패")}
    mine = {k: v for k, v in mine.items() if v is not None}
    if not mine or sum(mine.values()) <= 0:
        return
    t = max(mine, key=mine.get)
    m = num(r.get(f"시장_{t}"))
    if m is None or m <= 0:
        return
    gap = mine[t] - m
    if gap >= OVERCONF_P:
        severe.append(f"과신 +{gap:.1f}%p (내 {t} {mine[t]:.1f} vs 시장 {m:.1f}) — "
                      f"+{OVERCONF_P:.0f}%p 이상 구간 실측 적중 30%, 값을 되돌리거나 시장이 틀린 이유를 근거에 적는다")
    elif gap >= OVERCONF_P - 7:
        minor.append(f"과신 +{gap:.1f}%p (내 {t} {mine[t]:.1f} vs 시장 {m:.1f})")


ROSTER_KW = re.compile(r"(합류|영입|이적|트레이드|사인|계약|acquir|sign|trade|join)", re.I)


def roster_check(r, e, minor):
    """농구(직전시즌 레이팅 기준선)에서 수집가가 '로스터변화·못찾음·엇갈림'에 스타급 합류를 올렸는데
    분석가가 그 팀의 로스터 순보정을 0 으로 둔 채 방향을 확정하는 것을 잡는다.
    (2026-10-28, 127·128회 988 LA 레이커스-포틀랜드: 수집가가 'Lillard·Morant 백코트'를 적고 합류 경위를
     못찾음에 올렸는데 분석가는 '--adj-away 0 (확인된 이적·영입 없음)' 으로 61% 를 적었다 → 129:136 패.
     반사실: Randle IN 선례 척도 +1.7 이면 56.1, 상한 +3 이면 52.5 로 G1 기권 구간.)
    직전시즌 레이팅은 '그 시즌 로스터'의 값이라, 선발급 합류를 0 으로 두면 기준선 자체가 다른 팀을 가리킨다.
    걸리면 경미(B) — 수집 JSON 의 해당 문장을 그대로 보여 주어 분석가가 확인·보정하거나 기권하게 한다."""
    if r.get("종목") != "농구":
        return
    base = json.dumps(e.get("기준선") or {}, ensure_ascii=False)
    zero = {}
    for side, key in (("홈", "adj-home"), ("원정", "adj-away")):
        m = re.search(r"--?" + key + r"[ =]+(-?\d+(?:\.\d+)?)", base)
        if m and abs(float(m.group(1))) < 1e-9:
            zero[side] = True
    if not zero:
        return
    sujip = os.path.join(ROOT, "data", "수집")
    if not os.path.isdir(sujip):
        return
    # 팀 식별 — 한글명·영문명(team_names.json)·영문 약어(도시 3글자 / 첫 글자 조합) 로 '홈/원정' 을 가른다.
    try:
        tn = json.load(open(os.path.join(ROOT, "data", "team_names.json"), encoding="utf-8"))
    except Exception:
        tn = {}
    def keys(side):
        ko = r[side]
        en = tn.get(ko, "")
        ks = {ko, ko.split()[0]}
        if en:
            w = en.split()
            ks |= {en, w[0], w[0][:3].upper(), "".join(x[0] for x in w).upper(), (w[0][0] + w[1][:2]).upper() if len(w) > 1 else ""}
            if en.startswith("Los Angeles"):
                ks |= {"LA" + w[2][0].upper() if len(w) > 2 else "LA"}
        return {k for k in ks if len(k) >= 2}
    kh, ka = keys("홈"), keys("원정")
    def side_of(text):
        h = any(k in text for k in kh); a_ = any(k in text for k in ka)
        if h and not a_:
            return "홈"
        if a_ and not h:
            return "원정"
        return None
    pref = f"{r['회차']}_{r['번호']}_"
    hits = []
    for fn in sorted(os.listdir(sujip)):
        if not fn.startswith(pref) or not fn.endswith(".json"):
            continue
        try:
            d = json.load(open(os.path.join(sujip, fn), encoding="utf-8"))
        except Exception:
            continue
        items = d if isinstance(d, list) else [d]
        for it in items:
            if not isinstance(it, dict):
                continue
            for k in ("못찾음", "엇갈림", "로스터변화", "로스터거래"):
                v = it.get(k)
                if not v:
                    continue
                for x in (v if isinstance(v, list) else [v]):
                    t = json.dumps(x, ensure_ascii=False) if not isinstance(x, str) else x
                    if not ROSTER_KW.search(t):
                        continue
                    side = side_of(str(x.get("팀", ""))) if isinstance(x, dict) else None
                    if side is None:
                        side = side_of(t)
                    if side in zero:
                        hits.append(f"{k}({side}): {t[:90]}")
    if hits:
        minor.append("로스터 순보정 0 인데 수집가가 합류·영입을 올렸다(직전시즌 레이팅은 그 시즌 로스터 값 — "
                     "확인해 선례 척도로 보정하거나 G1 기권): " + " / ".join(hits[:3]))


def note_checks(r, severe, minor):
    news_check(r, severe)
    overconf_check(r, severe, minor)
    if r.get("종목") != "축구":
        return
    ref = ref_date(r)
    for side in ("홈", "원정"):
        fd, idt = note_dates(r[side])
        if fd is None:
            severe.append(f"{r[side]} 팩트시트 없음")
        elif (ref - fd).days > FACTS_DAYS:
            severe.append(f"{r[side]} 팩트시트 {fd} ({(ref - fd).days}일 지남)")
        if idt is None:
            severe.append(f"{r[side]} INPUTS 없음")
        elif (ref - idt).days > 1:
            severe.append(f"{r[side]} INPUTS {idt} (오래됨)")


def evidence_checks(r, e, severe, minor):
    # 2026-10-21(125회 23:00 블록): 채점은 '정규화된 유형'으로 한다.
    # 지금까지 이 함수는 원문 '유형'을 NEWS_TYPES 와 완전일치로 비교했는데,
    # 분석가에게 주는 어휘표(종목별분석/변수태그.md)는 '결장핵심·일정피로·xG차'를 쓰라고 지시한다.
    # 그래서 지시를 그대로 따른 분석가는 뉴스 요인이 통째로 안 읽혀 '홈/원정 뉴스 확인 기록 없음'
    # 심각 2건으로 반드시 C(추천 금지·학습 제외)가 됐다 — 9672·9738·9742 세 경기가 같은 사유로 C였고,
    # 교정 뒤 숫자를 하나도 바꾸지 않고 전부 A가 됐다(어휘만 교체). 기록용 norm_factor 는 뒤에서
    # 어차히 같은 정규화를 하므로, 채점과 기록이 서로 다른 값을 보던 것 자체가 결함이다.
    # '상태'는 정규화하지 않는다 — norm_state 가 빈칸을 '추정'으로 바꿔 '상태 누락' 검사가 무력화되기 때문.
    e = dict(e)
    # 2026-10-31(129회 13:00 블록): '팀' 칸도 정규화한다.
    # 아래 뉴스 검사는 `f["팀"] == "홈"/"원정"` 으로 **문자열 완전일치**를 보는데, 분석가가 팀 이름을
    # 그대로 적으면("전북 현대모터스") 그 팀의 뉴스 요인이 통째로 안 읽혀 '뉴스 확인 기록 없음' 심각이
    # 뜬다 — 뉴스를 안 찾은 게 아니라 이름으로 적었을 뿐인데 C(추천 금지·학습 제외)가 된다.
    # 바로 위 유형 정규화가 2026-10-21 에 같은 이유로 들어왔고(9672·9738·9742 가 어휘만 바꿔 전부 A),
    # 128회에도 같은 사유로 C9→A4B5 교정이 있었다. 같은 덫을 세 번째로 밟았으니 코드로 막는다.
    # 숫자는 하나도 바뀌지 않는다 — 어느 팀의 요인인지 읽는 방법만 고친다.
    def _norm_side(v):
        v = (v or "").strip()
        if v in ("홈", "원정", "양팀", "-", ""):
            return v
        for side in ("홈", "원정"):
            name = (r.get(side) or "").strip()
            if name and (v == name or v in name or name in v):
                return side
        return v
    e["요인"] = [{**f, "유형": norm_type(f.get("유형", "")), "팀": _norm_side(f.get("팀"))}
                 for f in (e.get("요인") or [])]
    if not e.get("요인") or len(e["요인"]) < 2:
        severe.append("근거 요인 2개 미만")
    if not (e.get("결론") or e.get("핵심근거") or e.get("근거요약") or "").strip():
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
        # 실질 기준(방식에 xG 가 들어가고 경기별 λ 가 양수로 채워졌는가)으로 바꿨었다.
        # 2026-10-25 재수정: 그래도 '방식에 xG 라는 글자가 있는가'는 여전히 문구 검사였다.
        #   승무패63 재사용 분석 7건(636·648·653·658·663·724·759)이 전부 C 로 떨어졌는데,
        #   실제 내용은 "기준선 λ1.41:1.88 출발 …" 처럼 **경기별 λ 를 양수로 세워 둔** 분석이었다.
        #   글자만 없고 실질은 충족한 것이라 거짓 C 다 — C 는 추천 금지 + 학습 제외라 손실이 크다.
        #   검사 내용을 실질로 바꾼다: ① 방식이 '리그평균'이면 심각(위에서 처리)
        #   ② 경기별 λ홈·λ원정 이 양수가 아니면 심각. 문구는 더 보지 않는다.
        if "K리그" not in (r.get("리그") or "") and any(k in (r.get("리그") or "") for k in XG_LEAGUES) and "2부" not in (r.get("리그") or "") and has_ou:
            def _pos(v):
                try:
                    return float(v) > 0
                except (TypeError, ValueError):
                    return False
            if not (_pos(gm.get("λ홈")) and _pos(gm.get("λ원정"))):
                severe.append("xG 제공 리그인데 경기별 λ홈·λ원정 숫자가 없음(핸디캡·언더오버·예상점수의 근거가 사라진다)")
            elif "리그평균" in str(gm.get("방식") or ""):
                severe.append("경기별 λ 라고 적었으나 방식이 리그 평균")
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
                age = (ref_date(r) - dt.date.fromisoformat(f["날짜"][:10])).days
                if f.get("유형") in NEWS_TYPES and age > NEWS_DAYS:
                    # 2026-10-25(126회 20:15 블록): 영향 0 인 오래된 결장까지 심각으로 잡아
                    # 630 인테르-피오렌티나가 C 가 됐다. 그런데 '라우타로 10-15 보도·직전 2경기 결장 →
                    # 신규성 0 이라 영향 0' 은 규칙이 **요구하는** 처리다(분석전_점검표 결장 신규성 D).
                    # 이 검문의 목적은 '낡은 뉴스로 확률을 움직이는 것'을 막는 것이지
                    # '낡은 뉴스를 확인하고 0 으로 적는 것'을 벌하는 게 아니다 — 오히려 확인 기록이라 남겨야 한다.
                    # 영향이 0 이면 경미로만 남기고, 0 이 아닐 때만 심각으로 올린다.
                    (severe if float(f.get("영향") or 0) != 0 else minor).append(f"오래된 뉴스 {age}일: {tag}")
            except ValueError:
                minor.append(f"날짜 형식 오류: {tag}")
        if f.get("유형") in NEWS_TYPES and f.get("상태") not in ("확정", "의심", "추정"):
            # 2026-10-25: '확정/의심/추정' 은 뉴스성 요인(결장·라인업·감독…)에만 뜻이 있다.
            # 폼·날씨·맞대결·전술·동기 같은 계산성 요인까지 잡아 한 경기에서 경미가 7~11건씩 나왔고,
            # 진짜 문제(출처 없음·합계 불일치)가 그 속에 묻혔다. 뉴스성 요인으로만 검문한다.
            minor.append(f"상태 누락: {tag}")
        # 2026-10-21(124회 심층회고): CLAUDE.md 의 '추정 결장 0' 상한이 코드로 막혀 있지 않아
        # 124회에만 '의심·추정'인데 영향 %p 를 준 요인이 53개 나왔다(맨시티 Haaland 의심 -1.9 → 5:1 승,
        # 그 탓에 오버3.5 B+ 다리를 뺐는데 실제 6골). 확인 안 된 결장으로 확률을 움직이지 않는다.
        # 2026-10-21(124회 심층회고): 휴식·일정 피로 요인은 방향 적중 11/51(22%)로 세 회차 연속 꼴찌다
        # (123회 4/21·124회 5/17·승무패61 2/13, 단측 p=0.00003). 대부분 유럽대항전 직후 팀에 감점을 주는데
        # 그 팀이 그냥 이긴다 — pi-rating 기준선이 이미 전력차를 담고, 로테이션은 강팀 뎁스로 흡수된다.
        # 절제 실험(factor_value.py --drop 휴식)도 뺀 쪽이 낫다(1순위 +1.4%p·RPS -0.0072).
        # → 기록은 계속하되 확률은 움직이지 않는다. 분석규칙 2026-10-21 [중간].
        # 2026-10-25(126회 심층회고): '경미'로는 안 지켜져서 '심각'으로 올린다.
        # 126회 288 코모 — 점검표의 옛 항목('대항전 병행 중3일 이하면 ±4%p 이상')을 근거로
        # 휴식 요인에 -4.5%p 를 줬다(기준선 75.2 → 68.8). 사실관계는 맞았지만(UCL 맨유전 10-21 실재)
        # 코모는 중3일에도 2:0·xG 2.32:0.29 로 완승했다. 그 점검표 항목은 2026-10-25 재측정으로 폐기했다:
        #   ESPN 전대회 휴식일 기준, 중3일 이하 팀 실제 50.0% vs 시장 기대 54.4%(n=14, -4.4p)
        #   그런데 상대보다 2일+ 더 쉰 팀도 24.2% vs 28.7%(n=33, -4.5p) — 양쪽이 똑같이 밑돈다.
        #   즉 휴식 차 자체에 신호가 없고, 차이는 시장 보정 쪽 잡음이다.
        # 기록은 계속하되 확률은 움직이지 않는다(분석규칙 2026-10-21 [중간], 절제 실험 1순위 +1.4%p).
        # 2026-10-25 22:00 블록 — **종목으로 가른다**. 위 측정은 전부 축구다(유럽대항전·ESPN 전대회 휴식일·pi-rating).
        # 근거기록 전수로 '휴식' 요인에 0 아닌 값을 준 다리의 방향 적중을 종목별로 재면
        #   축구 n=44 29.5% · 배구 n=11 27.3% · **농구 n=7 57.1%** · 야구 n=2 50.0%
        # 축구·배구는 확실히 해로운데 농구·야구는 표본이 없어 어느 쪽도 말할 수 없다.
        # 측정된 적 없는 종목에 심각을 매겨 C(추천 금지·학습 제외)로 떨구면,
        # 그 종목 분석이 통째로 학습에서 빠져 **영영 측정이 안 된다**(126회 767·779·783 이 그렇게 빠질 뻔했다).
        # NBA 백투백(24시간 내 2경기)은 축구의 중3일과 물리적으로 다른 현상이기도 하다.
        # → 축구·배구는 심각 유지, 그 밖 종목은 경미로 두고 n=30 이 모이면 다시 판정한다.
        if f.get("유형") == "휴식":
            try:
                if float(f.get("영향") or 0) != 0:
                    msg = (f"'휴식' 요인에 영향 {f.get('영향')}%p — 상한 0 이다"
                           f"(2026-10-21 절제 실험·2026-10-25 재측정, 기록만 하고 확률은 움직이지 않는다): {tag}")
                    if r.get("종목") in ("축구", "배구"):
                        severe.append(msg)
                    else:
                        minor.append(msg + " [해당 종목 미측정 n<30 — 경미]")
            except (TypeError, ValueError):
                pass
        # 2026-10-25(126회 4차 심층회고): '로테이션' 요인은 요인 어휘 중 **가장 해로운 하나**다.
        # 절제 실험(factor_value.py --drop 로테이션, 채점 21경기):
        #   요인 포함 1순위 14/21(66.7%) RPS 0.1469  →  뺐다면 17/21(81.0%) RPS 0.1365
        #   = 방향 -14.3%p · RPS +0.0104 로 **두 축 모두 해롭다**(다른 요인은 대개 한 축만 나쁘다).
        # 126회를 뺀 백테스트(19경기)도 63.2% → 78.9%(+15.8%p)로 같은 방향이고,
        # 상한을 0 → ±1.0 → ±1.5 → ±3.0 → 그대로 로 넓힐수록 단조롭게 나빠진다
        #   (81.0% · 81.0% · 76.2% · 76.2% · 66.7%) — 크기 문제라 상한이 아니라 0 이 맞다.
        # 요인 한 줄 방향 적중도 축구 2/12(17%) · 농구 2/10(20%) 로 주요 두 종목이 모두 측정됐고 둘 다 나쁘다
        # (휴식과 달리 종목을 가를 이유가 없다).
        # 왜 해로운가: ① 로테이션은 예고·발표되는 정보라 시장과 pi-rating 이 이미 담고 있고
        #   ② 강팀의 2군 XI 도 상대보다 여전히 강해서(뎁스) 실제 경기력 하락이 '11명 중 6명 교체' 라는
        #   인상만큼 크지 않다. 126회 630 인테르가 그 예다 — UCL 대비 6명 교체를 근거로 -2.6%p 를 줬는데
        #   (로테 합계 -5.2) 실제로는 슈팅 33:7 · 유효 11:2 로 압도하며 2:1 승, 내 64.6% 는 시장 72.9% 에
        #   8.3%p 못 미쳤다. '강팀 과소' 편향이 로테이션 요인을 통로로 들어온다.
        # → 기록은 계속하되 확률은 움직이지 않는다(상한 0). 효과는 다음 회고에서 재고, 안 오르면 내린다.
        # 등급은 '경미'로 둔다 — 절제의 방향 차 3경기(불일치쌍 3, McNemar p=0.125)는 아직 약하다.
        # 심각으로 올리면 그 경기가 C(추천 금지·학습 제외)로 떨어져 표본이 영영 안 모인다
        # (휴식에서 이미 겪은 실패 — 126회 767·779·783). n=40 에서 재측정해 유지되면 심각으로 올린다.
        if f.get("유형") == "로테이션":
            try:
                if float(f.get("영향") or 0) != 0:
                    minor.append(f"'로테이션' 요인에 영향 {f.get('영향')}%p — 상한 0 이다"
                                 f"(2026-10-25 절제 실험 n=21: 빼면 방향 +14.3%p·RPS -0.0104, "
                                 f"요인 방향 적중 축구 2/12·농구 2/10). "
                                 f"기록만 하고 확률은 움직이지 않는다: {tag}")
            except (TypeError, ValueError):
                pass
        # 2026-10-24(126회 심층회고): '비기기만 해도 목표 달성'인 팀의 보수적 운영을 무 가산 근거로
        # 쓰는 서사가 한 블록에서 두 번 연속 깨졌다. 213 청두(비기면 우승) 무 +4.0·승 -3.0 → 홈 0:1 패,
        # 221 허난(승점 1이면 잔류) 무 +4.0 → 3:4 로 총 7골. 둘 다 '압박 받는 쪽이 조심한다'는 가정인데
        # 실제로는 실점이 늘었다. 점검표에 2회 쌓여 규칙으로 고정한다(CLAUDE.md '2회 이상이면 코드로').
        # 동기 요인 자체는 해롭지 않다(부호검정 59.3%, z=+1.0) — 막는 것은 '비기면 된다'는 하위 서사뿐이다.
        # 기록은 계속하되 확률은 움직이지 않는다. 효과는 다음 회고에서 재고, 안 오르면 내린다.
        if f.get("유형") == "동기" and draw_is_enough(f):
            try:
                if float(f.get("영향") or 0) != 0:
                    minor.append(f"'비기면 된다' 동기 서사에 영향 {f.get('영향')}%p "
                                 f"(2026-10-24부터 상한 0, 기록만 — 126회 213·221): {tag}")
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
    # 2026-10-22(125회 심층회고): 같은 선수가 한 경기 안에서 서로 반대로 기록되는 것을 잡는다.
    # 125회 9685 Vinícius Júnior — 수집가는 "라리가 4경기 출전정지이나 UCL은 무관, 선발 유력"(영향 0)으로
    # 정확히 적었는데, 10/21 라인업 점검 단계가 같은 파일에 "결장·출전정지(2026-11-08까지)"를 덧붙였다.
    # 실제로 그는 선발 출전했다(postmatch 결장검증 '출전(선발)'). 영향이 둘 다 0이라 확률은 안 틀렸지만
    # 핵심근거 문장과 근거기록에는 거짓이 남아 학습 자료가 오염된다. 나중 점검이 앞 판단을 모순되게
    # 덮어쓰는 것은 사람이 다시 읽어야 할 일이므로 '심각'이 아니라 '경미'로 알린다.
    # 국내 리그 퇴장·경고누적 출전정지는 UEFA 대항전에 이월되지 않는다(반대도 같다) — 분석규칙 2026-10-22.
    seen = {}
    for f in e.get("요인", []):
        name = str(f.get("선수") or "").strip()
        if not name or f.get("유형") == "뉴스없음":
            continue
        key = (f.get("팀"), unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower().strip())
        out = f.get("유형") in ("결장", "징계")
        txt = str(f.get("내용") or "")
        # '출전 가능·무관·선발 유력' 이 적힌 요인은 '결장 아님' 쪽으로 읽는다
        playing = bool(re.search(r"출전\s*가능|무관|선발\s*유력|결장으로\s*처리하지\s*않", txt + str(f.get("상태") or "")))
        state = "출전" if (playing or not out) else "결장"
        if key in seen and seen[key][0] != state:
            minor.append(f"같은 선수를 서로 반대로 기록({seen[key][1]} ↔ {f.get('유형')}): {f.get('팀')} {name}")
        seen.setdefault(key, (state, f.get("유형")))


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


# 2026-10-25(126회 08:30 블록): 근거 JSON 의 모양이 조금만 달라도 조용히 C 가 됐다.
# 이번에 실제로 난 두 가지 — ① 최상위가 list 가 아니라 단일 dict ② 영향 칸 이름이
# '영향_홈승기준_%p'(오케스트레이터 프롬프트가 그렇게 줬다). 둘 다 분석 내용과 무관한 형식 문제인데
# 합계 검사가 Σ영향=0 으로 읽혀 '합계 불일치' 심각이 떴다. 형식은 받아 주고 내용으로만 채점한다.
IMPACT_ALIASES = ("영향", "영향_홈승기준_%p", "영향_%p", "영향_홈승기준", "영향도")
# 농구·야구 분석가는 리포트 표기(OUT/QUESTIONABLE)를 그대로 쓴다. 실측 버킷(확정 86% / 의심 52% / 추정 41%)에
# 1:1 로 대응하므로 뜻을 바꾸지 않고 받아 준다 — 2026-10-25, 126회 08:30 블록에서 NBA 5건이 전부 '상태 누락'으로 걸렸다.
STATE_ALIASES = {"OUT": "확정", "O": "확정", "확정결장": "확정",
                 "DOUBTFUL": "의심", "QUESTIONABLE": "의심", "GTD": "의심", "출전의문": "의심",
                 "PROBABLE": "추정", "EXPECTED": "추정"}


def normalize_evidence(data, rows=None, rnd=None):
    """근거 JSON 을 채점기가 기대하는 모양으로 맞춘다(내용은 건드리지 않는다)."""
    if isinstance(data, dict):
        data = [data]
    for e in data:
        # 팀 칸에 '홈/원정' 대신 팀 이름을 쓴 경우 — 뉴스 확인 검사가 팀별로 돌지 않아 통째로 심각이 됐다.
        if rows is not None:
            r = find(rows, rnd, e)
            if r:
                for f in e.get("요인") or []:
                    t = str(f.get("팀") or "").strip()
                    if t and t not in ("홈", "원정", "공통"):
                        if t == r["홈"] or t in r["홈"] or r["홈"] in t:
                            f["팀"] = "홈"
                        elif t == r["원정"] or t in r["원정"] or r["원정"] in t:
                            f["팀"] = "원정"
        for f in e.get("요인") or []:
            if "영향" not in f:
                for k in IMPACT_ALIASES:
                    if k in f:
                        f["영향"] = f.pop(k)
                        break
            st = str(f.get("상태") or "").strip()
            if st.upper() in STATE_ALIASES:
                f["상태"] = STATE_ALIASES[st.upper()]
        # '결론'을 안 적고 '핵심근거'·'근거요약'만 적은 경우 — 같은 것을 요구하는 칸이라 받아 준다
        # (2026-10-25 '근거요약' 추가: 126회 22:00 블록 분석가들이 '근거요약' 키로 적어 전원 심각 C 가 됐다.
        #  요구하는 내용은 똑같이 '왜 이 확률인가'라 이름만 다른 것을 심각으로 세는 건 거짓 C 다.)
        for alias in ("핵심근거", "근거요약"):
            if not (e.get("결론") or "").strip() and (e.get(alias) or "").strip():
                e["결론"] = e[alias]
        # 2026-10-26 구조 전환으로 출발 확률의 이름이 '기준선' → '사전확률'(시장) 로 바뀌었는데
        # 채점기는 여전히 '기준선' 키를 찾아 없으면 심각(C) 을 매겼다 — 129회 10/31 16:00 블록 1535 가
        # 이 사유 하나로 거짓 C 였다. 이름만 다른 같은 칸이라 받아 준다(2026-10-31).
        if not (e.get("기준선") or {}):
            for alias in ("사전확률", "사전_확률", "prior"):
                v = e.get(alias)
                if isinstance(v, dict) and any(k in v for k in ("승", "패")):
                    e["기준선"] = {k: v[k] for k in ("승", "무", "패") if k in v}
                    break
        # '선택지'를 {"1338 승무패 패": 42.6} 같은 dict 나 문자열로 적으면 evidence_checks 가
        # c.get() 에서 AttributeError 로 죽어 그 경기가 통째로 기록되지 않았다(129회 4경기).
        # 모양만 리스트[dict] 로 맞춰 준다 — 내용은 건드리지 않는다(2026-10-31).
        sel = e.get("선택지")
        if isinstance(sel, dict):
            e["선택지"] = [{"선택": k, "확률": v} for k, v in sel.items()]
        elif isinstance(sel, str):
            e["선택지"] = [{"선택": sel}] if sel.strip() else []
        elif isinstance(sel, list):
            e["선택지"] = [c if isinstance(c, dict) else {"선택": str(c)} for c in sel]
    return data


EV_KEY = ("회차", "번호", "구분", "유형", "팀", "선수", "영향", "내용", "기준선", "최종", "결론")


def _ev_key(x):
    return tuple(str(x.get(k) or "").strip() for k in EV_KEY)


def _drop_dup_evidence(ev):
    """이미 근거기록에 있는(내용까지 같은) 행과 이번 묶음 안의 중복을 뺀다."""
    seen = set()
    if os.path.exists(EVI):
        seen = {_ev_key(x) for x in csv.DictReader(open(EVI, encoding="utf-8-sig"))}
    out = []
    for x in ev:
        k = _ev_key(x)
        if k in seen:
            continue
        seen.add(k); out.append(x)
    return out


def cmd_dedupe(a):
    """근거기록·결장검증의 완전 중복 행을 한 번 정리한다(첫 행만 남김)."""
    for path, keyf in ((EVI, _ev_key), (os.path.join(ROOT, "data", "결장검증.csv"),
                                        lambda x: tuple((x.get(k) or "") for k in ("회차", "번호", "팀", "선수", "요인상태", "실제")))):
        if not os.path.exists(path):
            continue
        rs = list(csv.DictReader(open(path, encoding="utf-8-sig")))
        cols = list(rs[0].keys()) if rs else []
        seen, keep = set(), []
        for x in rs:
            k = keyf(x)
            if k in seen:
                continue
            seen.add(k); keep.append(x)
        with open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n"); w.writeheader(); w.writerows(keep)
        print(f"{os.path.relpath(path, ROOT)}: {len(rs)}행 → {len(keep)}행 (중복 {len(rs)-len(keep)} 제거)")


def cmd_add(a):
    rows = R.load()
    data = normalize_evidence(json.load(open(a.file, encoding="utf-8")), rows, a.round)
    now = dt.datetime.now(R.KST).strftime("%Y-%m-%d %H:%M")
    ev, ck, snaps = [], [], []
    for e in data:
        r = find(rows, a.round, e)
        if r is None:
            print(f"? 경기 없음: {e.get('번호')} {e.get('홈')}-{e.get('원정')}")
            continue
        # 근거 JSON 이 들고 온 칸을 행에 옮긴 뒤 검사한다(2026-10-31).
        # 왜: news_check 는 전체경기기록 행의 '뉴스위험' 칸을 보는데 cmd_add 는 그 칸을 옮기지 않았다.
        #     분석가가 JSON 에 뉴스위험을 성실히 적어도, 행이 baseline_fill 로 자동 생성돼 칸이 비어 있으면
        #     그 경기는 '확인 안 함' 으로 심각 C 가 되고 학습에서 통째로 빠진다
        #     (129회 1544 — 분석가가 뉴스위험 3건을 적었는데 C). 정보는 있는데 경로가 없어서 버린 것이다.
        #     같은 종류(근거 JSON 내용이 채점기에 닿지 않는 문제)의 다섯 번째 교정이라 코드로 고정한다.
        for key in ("뉴스위험", "예상점수"):
            v = e.get(key)
            if isinstance(v, (int, float)):
                v = str(v)
            if isinstance(v, str) and v.strip() and not (r.get(key) or "").strip():
                r[key] = v.strip()
        severe, minor = [], []
        note_checks(r, severe, minor)
        evidence_checks(r, e, severe, minor)
        roster_check(r, e, minor)
        g = grade_of(severe, minor)
        r["정합성"] = g
        # 2026-10-22(125회 심층회고): 근거 JSON 이 있으면 그 경기는 정의상 심층 분석이다.
        # 그런데 '깊이' 칸을 분석가가 따로 적어야 해서 125회 UCL 9경기를 포함해 빈칸이 많았고,
        # baseline_fill 의 '분석 vs 기준선' 표에서 그 경기들이 '분석' 쪽에 세어지지 않았다
        # (125회 빈칸 10경기 7적중 70% — 분석의 가치를 재는 표에서 가장 잘 맞은 경기가 빠져 있었다).
        # 2026-10-31(129회 심층회고): 분석가가 '사전확률에서 총 이동 0.0%p' 를 표현하려고
        # 근거 JSON 에 깊이="기준선" 을 직접 적는 일이 늘었다(129회만 19행, 누적 70행).
        # 그런데 '기준선' 은 baseline_fill 이 **아무도 분석하지 않은 경기**에 자동으로 붙이는
        # 대조군 꼬리표다. 수집가+분석가 파이프라인을 다 돈 경기가 대조군으로 세어지면
        # 분석 vs 기준선 비교가 양쪽에서 동시에 오염된다 — 분자에서 빠지고 분모에 더해진다.
        # 근거 JSON 이 있으면 정의상 심층 분석이므로 분석가가 뭐라 적었든 '심층' 으로 덮는다.
        # '이동 0' 이라는 사실은 보정메모(총 이동 0.0%p)와 요인 기록에 이미 남는다.
        if (r.get("깊이") or "").strip() in ("", "기준선"):
            r["깊이"] = "심층"
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
    # 2026-10-27(126·127회 심층회고): 같은 근거 JSON 을 두 번 add 하면(등급 재판정·재실행) 근거기록에
    # 같은 행이 두 번 쌓였다 — 전수 4,749행 중 1,546행(33%)이 완전 중복. factor_fit·model_zoo 는 요인 '영향'을
    # (회차,번호,유형)으로 합산하므로 중복 행은 영향을 2배로 세고, postmatch 결장검증도 같은 선수를 두 번 대조했다.
    # → 내용까지 같은 행은 건너뛴다(재분석으로 내용·영향이 바뀐 행은 새 행으로 남는다).
    ev = _drop_dup_evidence(ev)
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
    ev = list(csv.DictReader(open(EVI, encoding="utf-8-sig")))
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
    ev = list(csv.DictReader(open(EVI, encoding="utf-8-sig")))
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
    for x in csv.DictReader(open(EVI, encoding="utf-8-sig")):
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
    sp.add_parser("dedupe")
    a = ap.parse_args()
    {"pre": cmd_pre, "add": cmd_add, "mark": cmd_mark, "grade": cmd_grade, "report": cmd_report, "normalize": cmd_normalize, "dedupe": cmd_dedupe}[a.cmd](a)


if __name__ == "__main__":
    main()
