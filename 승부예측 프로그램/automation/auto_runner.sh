#!/bin/zsh
# 세션과 무관한 자동 실행기 (사용자 요청 2026-10-19 "PC 켜 두면 알아서 새 회차 추천·기록·푸시")
# launchd 가 호출한다: daily(08:03) / blocks(20분마다). 헤드리스 Claude(claude -p)가 블록분석_절차를 수행한다.
# 설치 방법은 automation/README.md. 잠자기 방지: 실행 중 caffeinate. 중복 방지: 잠금 파일.
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
# 무인 실행은 Desktop 아래 .git(TCC 보호)에 묶인 worktree 대신 별도 클론에서 돈다(2026-10-19: launchd 에서 "not a git repository" — Desktop 접근 권한).
PROJ="/Users/sonsang-il/orca/workspaces/ai/pacu-auto/승부예측 프로그램"
LOG="$PROJ/logs/auto_$(date +%Y%m%d).log"
LOCK="/tmp/pacu_auto_runner.lock"
MODE="${1:-blocks}"
# 무인 실행 권한: 기본은 acceptEdits(편집만 자동, Bash 는 .claude/settings.json 허용 목록 필요).
# 완전 무인으로 돌리려면 PERM=bypassPermissions 로 바꾼다 — 사용자가 직접 결정한다.
PERM="${PACU_PERM:-acceptEdits}"
mkdir -p "$PROJ/logs"
cd "$PROJ" || exit 1
exec >>"$LOG" 2>&1
echo "=== $(date '+%F %T') mode=$MODE perm=$PERM"
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then echo "다른 실행 진행 중 — 건너뜀"; exit 0; fi
echo $$ > "$LOCK"; trap 'rm -f "$LOCK"' EXIT
git pull --rebase --autostash origin pacu 2>&1 | tail -2 || echo "pull 실패(계속)"
RULES='★ 현행 규칙: 리그 제한(축구 5대 리그+K리그, 야구 KBO·MLB, 농구 KBL·NBA, 배구 KOVO; 대항전·컵은 한 팀이라도 지정 리그면 대상; 그 외는 분석·기록만) · 추천 = ① 내 1순위 = 시장 1순위 ② 배당 1.30~1.90(1.45~1.60 최적, 1.3 미만·1.9 초과 금지) ③ 내 순수 확률이 시장보다 높지 않음(내−시장 < +2, −3%p 이하면 B+ 우선) — 2026-10-19 백테스트 교체, 내 확률 문턱은 쓰지 않는다 · **2폴더 고정**·합계 1.8 이상(3폴더 이상 금지 — 저배당 다리가 조합을 깬다, 동시간대 짝 없으면 추천 없음) · 기대값 조건 없음 · 가상 추천 모드(구매 0, 추천·기록·채점 계속) · 분석가는 teamdb.py card 먼저 · 강팀 감점 상한(폼·발언 −5, 추정 결장 0) · 분석일정이 이미 완료면 중복 금지. **코어 조합 1개 + 도파민 조합 1개**(도파민 = 역배 내−시장 ≥+10%p·배당 1.8~4.0 또는 무 내 28%+·배당 2.5~4.5, 조건 맞을 때만, 조합 제목에 [도파민] — 집계·보고 분리). 보고 때 일반 추천 승률과 도파민 추천 승률을 따로 적는다. 끝나면 round_watch.py done, 커밋·푸시(origin pacu, pacu:main), 마지막에 sh ../betman-dashboard/deploy.sh 로 대시보드 갱신.'
if [ "$MODE" = "daily" ]; then
  PROMPT="[정기 작업: 회차 감시 08시, 헤드리스] 승부예측 프로그램 폴더의 블록분석_절차.md A 절차: teamdb.py update → round_watch.py check → team_facts.py --round <판매 중 회차> --stale 3 → match_inputs.py --round <회차> → plan(예약은 걸지 말고 분석일정에만 남긴다 — 블록 실행은 auto_runner blocks 가 분석 시각에 한다) → 즉시 분석할 블록(due)이 있으면 B 절차로 처리 → round_watch.py toto(승무패 새 회차면 팩트시트·입력·teamdb 후 14경기 패널, 가중치 ①0.25 ②0.2 ④0.25 ⑤0.3) → `baseline_fill.py --all`(분석 안 한 축구 경기에 기준선 방향 자동 기록, 깊이=기준선) → 학습 갱신(round_log results·tracker results·grade_all·postmatch·process_grade --all·own_model report·fast_learn·bet_hit·calibrate fit·hit_model fit·upset_log report) → **결과가 모두 나온 회차(프로토·승무패)가 있으면 회차운영절차 '심층 회고 5단계'를 그 회차에 실행**: 채점 → 전 경기 4분면 → **맞은 경기 포함 경기별 내용 회고**(근거가 실제로 나타났는지, 실력/운, 맞은 근거는 팀노트에 보충) → 오답·운 경기 원인 분류(에이전트) → 사실 오류 점검 → 규칙 후보는 만든 회차를 뺀 이전 회차로 백테스트한 뒤 [관찰]/[중간] 등급으로 분석규칙에 반영 → **도구 개선까지 한다**: 반복된 오판·운 패턴이 스크립트로 막을 수 있는 것이면 해당 스크립트(기준선·보정·입력 수집·채점·정합성)를 직접 고치고 무엇을 왜 고쳤는지 회고에 적는다(문서 규칙만 쌓지 않는다). 산출 회차별분석/<날짜>_<회차>_심층회고.md → **단일 경기 1순위 적중률(최상위 지표)·과정 점수·조합 성공률** 한 줄 → 커밋·푸시 → deploy.sh. $RULES"
else
  DUE="$(python3 scripts/round_watch.py due 2>/dev/null | grep -v '^$' | grep -v '^없음$' | grep -vi 'no due' || true)"
  if [ -z "$DUE" ]; then echo "due 블록 없음"; exit 0; fi
  echo "due: $DUE"
  PROMPT="[블록 점검·가상 추천, 헤드리스] 아래 블록(분석 시각 도래)을 블록분석_절차.md B(오케스트레이터: integrity.py pre → 수집가 → 분석가(검색 금지, 근거 JSON) → integrity.py add)로 처리하고 추천 표·근거 요약을 기록해줘. **블록 안 모든 경기에 승/무/패 방향과 확률을 남긴다**(추천 후보가 아니어도) — 후보는 심층(깊이=심층), 나머지는 기준선+간단 보정(깊이=가벼움). 단일 경기 방향 정확도가 최상위 지표이므로 표본을 버리지 않는다. 승무패 회차면 14경기 패널 → 마킹. 처리 대상:
$DUE
$RULES"
fi
caffeinate -i -s claude -p "$PROMPT" --permission-mode "$PERM" --output-format text --max-turns 400 2>&1 | tail -c 20000
echo "=== $(date '+%F %T') 끝"
