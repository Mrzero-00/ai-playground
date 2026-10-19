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

DUE="$(python3 scripts/round_watch.py due 2>/dev/null | grep -v '^$' | grep -v '^없음$' | grep -vi 'no due' || true)"
if [ -n "$DUE" ]; then echo "분석 대기 블록: $DUE"; else echo "분석 대기 블록 없음"; fi

if [ "$RETRO" = "0" ] && [ -z "$DUE" ] && [ "$MODE" != "daily" ]; then
  echo "할 일 없음 — 종료(비용 0)"; exit 0
fi

RULES='★ 현행 규칙(어기지 말 것): 고정 2가지 = 단일 경기 방향 정확도 100% 목표 · 조합 합계 배당 1.8 이상, 코어 회수율 200% 목표. 그 외 방법은 측정 근거로 변경 가능(사용자 전권 위임 2026-10-19).
· 리그 제한: 축구 5대 리그+K리그, 야구 KBO·MLB, 농구 KBL·NBA, 배구 KOVO. 대항전·컵은 한 팀이라도 지정 리그면 대상. 그 외는 분석·기록만.
· 코어 추천: ① 내 1순위 = 시장 1순위 ② 배당 1.30~2.20 ③ 내−시장 < +2. 우선순위 B++(1.60~2.20 & 내−시장 ≤ −3 & 시장 52%+, 200% 경로) > B+(1.45~1.60) > B. 2폴더 고정(3폴더 이상 금지), 합계 1.8+. 동시간대 짝 없으면 추천 없음.
· 도파민: 기록 전용(금액 0)·단식 전용. 코어 분석이 끝난 뒤 기계적으로만 추출(별도 조사 금지). 역배 = 내−시장 ≥ +10%p·배당 1.8~4.0, 무 = 시장 1순위<45% & 시장 무 ≥28%·배당 2.2~4.5. 제목에 [도파민], 집계·보고 분리.
· 가상 추천 모드: 실구매 0. 추천·기록·채점은 계속.
· 블록 전 경기에 방향(승/무/패)+확률을 남긴다(후보 깊이=심층, 나머지 깊이=가벼움). 표본을 버리지 않는다.
· 분석가는 teamdb.py card 를 먼저 읽는다. 강팀 감점 상한(폼·발언 −5, 추정 결장 0). 분석일정이 완료면 중복 금지.
· 보고는 일반(코어) 승률과 도파민 승률을 따로 적는다.'

STEP12="[1단계 회고] 새로 채점된 경기 ${NEW}건(회차 ${ROUNDS}${DONE:+, 완결 ${DONE}}). 회차운영절차 심층 회고를 수행한다: postmatch.py --round <회차> → process_grade.py --all → **맞은 경기 포함 경기별 내용 회고**(내 근거가 실제 선발·xG·슈팅·흐름에 나타났는가 / 실력·운·분산·오판 / 맞은 근거는 팀노트·종목 파일에 보충 — 이 세 줄 없이는 회고 미완) → 오답·운 경기 원인 분류 → 사실 오류 점검 → own_model report·fast_learn·bet_hit·calibrate fit·hit_model fit·baseline_fill --all·upset_log report 갱신. 산출: 회차별분석/<날짜>_<회차>_심층회고.md.
[2단계 개선] 회고에서 나온 원인이 코드로 막을 수 있으면 **그 자리에서 스크립트를 고친다**(기준선·보정·입력 수집·채점·정합성·추천 판정 pick_table.leg_type). 규칙 후보는 만든 회차를 뺀 이전 회차로 백테스트한 뒤 등급을 정해 분석규칙에 반영한다. 추천 기준 자체도 측정이 더 나은 쪽을 가리키면 바꾼다. 문서만 쌓고 코드를 안 고치면 같은 실수가 반복된다."

if [ "$MODE" = "daily" ]; then
  STEP3="[3단계 분석] 회차 감시: teamdb.py update → round_watch.py check → team_facts.py --round <판매 중 회차> --stale 3 → match_inputs.py --round <회차> → plan(분석일정에만 남긴다) → 분석 시각이 된 블록이 있으면 블록분석_절차.md B 절차로 추천 조합까지. round_watch.py toto(승무패 새 회차면 팩트시트·입력·teamdb 후 14경기 패널; 무 복수는 '시장 1순위<45% & 시장 무 28%+' 경기에)."
else
  STEP3="[3단계 분석] 아래 블록을 블록분석_절차.md B(오케스트레이터: integrity.py pre → 수집가 → 분석가(검색 금지, 근거 JSON) → integrity.py add)로 처리하고 추천 표·근거 요약을 기록한다. 승무패 회차면 14경기 패널 → 마킹.
처리 대상:
${DUE:-(없음 — 3단계 건너뜀)}"
fi

if [ "$RETRO" = "1" ]; then STEP12_OUT="$STEP12"; else STEP12_OUT="[1~2단계] 새 결과 ${NEW}건으로 회고 임계(8건) 미달 — 건너뛴다."; fi

PROMPT="[자동 루프 ${MODE}] 아래 단계를 순서대로 수행한다.
${STEP12_OUT}
${STEP3}
[4단계 배포] 커밋·푸시(origin pacu, pacu:main) → sh ../betman-dashboard/deploy.sh 로 대시보드 갱신·배포 → PushNotification 한 줄 알림(추천 유무·일반 승률·도파민 승률). round_watch.py done 으로 블록 상태도 닫는다.
${RULES}"

caffeinate -i -s claude -p "$PROMPT" --permission-mode "$PERM" --output-format text --max-turns 400 2>&1 | tail -c 20000
python3 scripts/loop_state.py --commit >/dev/null 2>&1
echo "=== $(date '+%F %T') 끝"
