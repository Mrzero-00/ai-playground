#!/bin/zsh
# 자동 루프 실행기 (사용자 지시 2026-10-19 — 매 갱신마다 아래 순서로 반복)
#   1) 회고할 내용이 있는지 파악 → 있으면 심층 회고(분석이 맞았는지 정확한 데이터 산출)
#   2) 회고 결과로 분석 방식·스킬·도구(코드) 개선
#   3) 추천 조합 분석
#   4) 커밋·푸시 → 배포 → 사용자 알림
# launchd 가 호출: daily(08:03, 회차 감시 포함) / blocks(20분마다). 설치는 automation/README.md.
# 무인 실행은 Desktop 아래 .git(TCC 보호) worktree 대신 별도 클론 pacu-auto 에서 돈다.
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
PROJ="/Users/sonsang-il/orca/workspaces/ai/pacu-auto/승부예측 프로그램"
LOG="$PROJ/logs/auto_$(date +%Y%m%d).log"
LOCK="/tmp/pacu_auto_runner.lock"
MODE="${1:-blocks}"
PERM="${PACU_PERM:-acceptEdits}"
mkdir -p "$PROJ/logs"
cd "$PROJ" || exit 1
exec >>"$LOG" 2>&1
echo "=== $(date '+%F %T') mode=$MODE perm=$PERM"
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then echo "다른 실행 진행 중 — 건너뜀"; exit 0; fi
echo $$ > "$LOCK"; trap 'rm -f "$LOCK"' EXIT
git pull --rebase --autostash origin pacu 2>&1 | tail -2 || echo "pull 실패(계속)"

# ---------- 1단계 사전 판정: 채점(파이썬, 비용 0)부터 돌리고 회고 필요 여부를 본다
for RND in $(python3 - <<'PY'
import csv, os
p = "전체경기기록.csv"
rs = list(csv.DictReader(open(p, encoding="utf-8-sig"))) if os.path.exists(p) else []
rounds = sorted({r["회차"] for r in rs if not r["회차"].startswith("승무패")}, key=lambda x: int(x) if x.isdigit() else 0)[-2:]
print(" ".join(rounds))
PY
); do python3 scripts/round_log.py results "$RND" >/dev/null 2>&1; done
python3 scripts/grade_all.py >/dev/null 2>&1
eval "$(python3 scripts/loop_state.py)"
echo "회고 판정: 새 결과 ${NEW}경기 · RETRO=${RETRO} · 대상 [${ROUNDS}] · 완결 [${DONE}]"

# 주간 방향 점검(사용자 지시 2026-10-26): 회고는 틀 안에서 가중치만 고친다.
# 틀 자체가 맞는지는 일주일에 한 번 따로 묻는다. due 가 0이면 이번 주 차례.
REVIEW=0
if [ "$MODE" = "daily" ] && python3 scripts/direction_review.py due >/dev/null 2>&1; then REVIEW=1; fi
echo "주간 방향 점검: $([ "$REVIEW" = 1 ] && echo '이번 주 차례' || echo '아직')"

DUE="$(python3 scripts/round_watch.py due 2>/dev/null | grep -v '^$' | grep -v '^없음$' | grep -vi 'no due' || true)"
if [ -n "$DUE" ]; then echo "분석 대기 블록: $DUE"; else echo "분석 대기 블록 없음"; fi

if [ "$RETRO" = "0" ] && [ -z "$DUE" ] && [ "$REVIEW" = "0" ] && [ "$MODE" != "daily" ]; then
  echo "할 일 없음 — 종료(비용 0)"; exit 0
fi

# RULES 는 작은따옴표·백틱이 섞여도 안전하도록 인용 heredoc 으로 담는다(2026-10-22 사고 수정).
# 전에는 RULES='...' 안에 '없음' 같은 작은따옴표가 들어가 문자열이 조기에 닫히고
# 뒤쪽이 셸 명령으로 실행돼 매 블록이 'command not found / RULES: parameter not set' 로 죽었다.
read -r -d '' RULES <<'PACU_RULES_EOF'
★★★ 구조 전환(2026-10-26): 보정 상수를 맞추는 틀로는 목표에 못 간다. 모델 계층은 51~52%에서 한계(시장 53.4%),
   요인 보정은 시장 대비 −5.0p 로 오히려 깎고 있다. 그래서 ① 사전확률은 시장에서 출발 ② 기본 보정 0, 검증 가능한
   사실이 있는 소수 경기만 개입 ③ factor_weights.json 에서 weight>0 인 유형만 확률을 움직임(나머지는 기록만)
   ④ 판정은 '개입한 경기에서 사전확률 대비 개선폭'(prior.py report). 분석할 때는 prior.py apply 로 사전확률+검증요인만 얹는다. 시장은 목표가 아니라 그 위에 올려야 넘어서는 바닥이다.
· 회고와 주간 점검은 다르다. 회고는 틀 안에서 가중치·문턱을 고치고, 주간 방향 점검(direction_review.py)은 틀 자체를 유지·조정·전환으로 판정한다. 점검에서 '전환'이 나오면 회고 결과보다 그쪽을 따른다.
★★ 목표는 단 하나다: 단일 경기 방향 예측 100%. 시장은 목표가 아니라 진단용 눈금이다 — '시장 수준'을 목표로 적지 않는다.
   모든 변경은 '방향 적중률이 올랐는가'로만 채택·기각한다. 회수율·RPS·Brier 는 보조 진단일 뿐이다.
   측정은 분석한 경기로만 한다(깊이=기준선 자동 채움은 대조군으로 분리).
   진짜 전장은 시장과 갈리는 경기다(실측 55경기 40.0%) — 갈림을 피하지 말고 갈릴 때 맞게 만든다.
★ 현행 규칙(어기지 말 것): 고정 2가지 = 단일 경기 방향 정확도 100% 목표 · 조합 합계 배당 1.8 이상, 코어 회수율 200% 목표. 그 외 방법은 측정 근거로 변경 가능(사용자 전권 위임 2026-10-19).
· 리그 제한: 축구 5대 리그+K리그, 야구 KBO·MLB, 농구 KBL·NBA, 배구 KOVO. 대항전·컵은 한 팀이라도 지정 리그면 대상. 그 외는 분석·기록만.
· 코어 추천: ① 내 1순위 = 시장 1순위 ② 배당 1.30~2.20 ③ 내−시장 < +2. 우선순위 B++(1.60~2.20 & 내−시장 ≤ −3 & 시장 52%+, 200% 경로) > B+(1.45~1.60) > B. 2폴더 고정(3폴더 이상 금지), 합계 1.8+. 동시간대 짝 없으면 추천 없음.
· 도파민 트랙 폐지(2026-10-22 사용자 지시): 역배·무 위성 추천을 만들지 않는다. leg_type_fun 호출 금지, 새 [도파민] 행 생성 금지. 지난 기록은 남기되 집계에서 뺀다.
· 방향은 전부 아니면 무다. 적중·실패 모두 원인을 적고 '경기 전에 알 수 있었나'를 가린다(result_log.py). 경기 중 사건이라도 피로 누적·컨디션 난조 같은 사전 신호가 있었으면 '부분'으로 잡아 신호를 점검표에 올린다. 운으로 맞은 적중은 좋은 분석으로 세지 않는다.
· 분석할 때 경기마다 예상점수(홈:원정)를 남긴다 — 총득점 오차와 득실차 오차를 갈라야 핸디캡·언더오버를 고칠 수 있다.
· 뉴스위험 칸을 비운 채 방향을 확정하지 않는다(integrity pre 가 막는다). '없음'이라도 적는다 — 실측 빈칸 경기는 시장에 5.7%p 뒤진다.
· 무를 더 고르는 전략은 폐기했다(12,454경기 전수 검증: 어떤 무 포켓에서도 1순위가 낫다). 개선은 **접전(시장 1순위 45% 미만) 경기에서 1순위를 더 잘 고르는 것**으로만 한다 — 내 부진이 전부 거기서 난다(내 32.9% vs 시장 38.4%, 146경기).
· 결장을 '의심·추정'으로 적은 것은 실측 적중 51%·47%다. 동전 던지기를 확률 보정에 큰 값으로 넣지 않는다(확정은 85%).
· 어긋나는 확률 구간을 추천에서 빼지 않는다 — 격차 자체를 고친다(calib_report.py, |z|<2 는 흔들림이라 쫓지 않음).
· 가상 추천 모드: 실구매 0. 추천·기록·채점은 계속.
· 블록 전 경기에 방향(승/무/패)+확률을 남긴다(후보 깊이=심층, 나머지 깊이=가벼움). 표본을 버리지 않는다.
· 분석가는 teamdb.py card 를 먼저 읽는다. 강팀 감점 상한(폼·발언 −5, 추정 결장 0). 분석일정이 완료면 중복 금지.
· 보고는 ① 추천 다리 적중률 ② 분석한 전 경기 1순위 적중률(시장 대비) 두 줄을 적는다. ②가 1번 목표의 지표다.
PACU_RULES_EOF

STEP12="[1단계 회고] 새로 채점된 경기 ${NEW}건(회차 ${ROUNDS}${DONE:+, 완결 ${DONE}}). 회차운영절차 심층 회고를 수행한다: postmatch.py --round <회차> → process_grade.py --all → **맞은 경기 포함 경기별 내용 회고**(내 근거가 실제 선발·xG·슈팅·흐름에 나타났는가 / 실력·운·분산·오판 / 맞은 근거는 팀노트·종목 파일에 보충 — 이 세 줄 없이는 회고 미완) → **calib_report.py --save**(내가 쓴 확률이 그대로 나왔는지, |z|>=2 인 유의 편향만 추림) → **result_log.py pending** 으로 채점된 경기를 **적중·실패 모두** 끌어와 하나씩 result_log.py add --요인 --판정 --점검 기록(실패=가능/부분/불가, 적중=근거대로/운; 가능·부분이면 점검 항목 필수. 판정은 증거를 보고 네가 정한다) → **result_log.py checklist** 로 분석전_점검표.md 갱신 → result_log.py report 로 근거대로 비율·되풀이 항목 확인 → **lineup_grade.py report**(결장 주장·예상 XI 적중) 확인 → 사실 오류 점검 → own_model report·fast_learn·bet_hit·calibrate fit·hit_model fit·baseline_fill --all 갱신 → **factor_fit.py report**(요인 가중치 재추정) → **prior.py report**(본 지표: 개입한 경기에서 사전확률 대비 개선폭 — 음수면 그 개입을 되돌린다) → **direction_lab.py run**(모델 계층 상한 재확인, 분기마다). 산출: 회차별분석/<날짜>_<회차>_심층회고.md.
[2단계 개선] 판정 기준은 방향 적중률 하나다 — 회고에서 나온 원인이 코드로 막을 수 있으면 **그 자리에서 스크립트를 고친다**(기준선·보정·입력 수집·채점·정합성·추천 판정 pick_table.leg_type). 규칙 후보는 만든 회차를 뺀 이전 회차로 백테스트한 뒤 등급을 정해 분석규칙에 반영한다. 추천 기준 자체도 측정이 더 나은 쪽을 가리키면 바꾼다. 문서만 쌓고 코드를 안 고치면 같은 실수가 반복된다. **어긋난 확률 구간을 추천에서 빼는 식의 '덮는' 변경은 금지**(사용자 지시 2026-10-22) — 원인을 찾아 기법·입력·가중치를 고친다. 점검표에서 2회 이상 되풀이된 항목은 규칙이나 스크립트로 고정하고, 넣은 뒤 효과를 다음 회고에서 재서 안 오르면 내린다."

if [ "$MODE" = "daily" ]; then
  STEP3="[3단계 분석] 회차 감시: teamdb.py update(5대 리그+K리그+챔피언십·J1·MLS) → round_watch.py check → team_facts.py --round <판매 중 회차> --stale 3 → match_inputs.py --round <회차> → context_inputs.py fill --round <회차>(심판·날씨) → plan(분석일정에만 남긴다) → 분석 시각이 된 블록이 있으면 블록분석_절차.md B 절차로 추천 조합까지. 분석가는 **분석전_점검표.md 를 먼저 읽고** 항목별 해당 여부를 근거에 남기며, 경기마다 **예상점수**를 적는다. round_watch.py toto(승무패 새 회차면 팩트시트·입력·teamdb 후 14경기 패널; 무 복수는 '시장 1순위<45% & 시장 무 28%+' 경기에)."
else
  STEP3="[3단계 분석] 아래 블록을 블록분석_절차.md B(오케스트레이터: integrity.py pre → 수집가 → 분석가(검색 금지, 근거 JSON) → integrity.py add)로 처리하고 추천 표·근거 요약을 기록한다. 분석가는 **분석전_점검표.md 를 먼저 읽고** 항목별 해당 여부를 근거에 남기며, 경기마다 **예상점수**를 적는다. 승무패 회차면 14경기 패널 → 마킹.
처리 대상:
${DUE:-(없음 — 3단계 건너뜀)}"
fi

if [ "$RETRO" = "1" ]; then STEP12_OUT="$STEP12"; else STEP12_OUT="[1~2단계] 새 결과 ${NEW}건으로 회고 임계(8건) 미달 — 건너뛴다."; fi

if [ "$REVIEW" = "1" ]; then
  STEP0="[0단계 주간 방향 점검] python3 scripts/direction_review.py run 을 돌려 회차별분석/방향점검_<날짜>.md 를 만든다.
그 안의 1~4절 숫자를 읽고 **5. 판정** 칸을 직접 채운다 — 유지 / 조정 / 전환 중 하나를 고르고 근거 숫자를 적는다.
고른 판정은 **그 자리에서 실행한다**(조정이면 구성요소를 교체하고, 전환이면 분석 방향을 바꾸고 CLAUDE.md 에 기록).
이 점검은 회고와 다르다 — 회고는 틀 안에서 가중치를 고치고, 이 점검은 **틀 자체를 바꿀 수 있다**.
'유지'를 고를 때도 왜 유지인지 숫자로 적는다. 다음 점검에서 무엇이 몇 %p 올라야 성공인지도 적는다."
else
  STEP0="[0단계] 주간 방향 점검은 이번 주 차례가 아니다 — 건너뛴다."
fi

PROMPT="[자동 루프 ${MODE}] 아래 단계를 순서대로 수행한다.
${STEP0}
${STEP12_OUT}
${STEP3}
[4단계 배포] 커밋·푸시(origin pacu, pacu:main) → sh ../betman-dashboard/deploy.sh 로 대시보드 갱신·배포 → PushNotification 한 줄 알림(추천 유무·일반 승률·도파민 승률). round_watch.py done 으로 블록 상태도 닫는다.
${RULES}"

caffeinate -i -s claude -p "$PROMPT" --permission-mode "$PERM" --output-format text --max-turns 400 2>&1 | tail -c 20000
python3 scripts/loop_state.py --commit >/dev/null 2>&1
echo "=== $(date '+%F %T') 끝"
