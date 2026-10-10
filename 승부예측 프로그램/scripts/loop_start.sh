#!/bin/bash
# 자동 루프의 'PC 쪽' 준비 (사용자 요청 2026-10-10: 다른 PC에서 "루프 켜줘" 한마디로 같은 설정)
# Claude가 루프_시작.md 절차 1단계에서 실행한다. Claude 예약 작업(CronCreate)은 이 스크립트가 아니라 Claude가 건다.
#   bash scripts/loop_start.sh        # 켜기
#   bash scripts/loop_start.sh stop   # 끄기(이 PC의 autoscan·잠자기 방지 중지)
cd "$(dirname "$0")/.." || exit 1
if [ "$1" = "stop" ]; then
  pkill -f "scripts/autoscan.py" && echo "autoscan 중지"
  pkill -f "caffeinate -ims" && echo "잠자기 방지 해제"
  exit 0
fi
git pull --no-rebase origin pacu || echo "⚠ pull 실패 — 충돌을 먼저 해결"
python3 --version || { echo "⚠ python3 없음"; exit 1; }
if pgrep -f "scripts/autoscan.py" >/dev/null; then echo "autoscan 이미 실행 중"
else nohup python3 scripts/autoscan.py >> data/autoscan.log 2>&1 & echo "autoscan 시작 (pid $!)"; fi
if [ "$(uname)" = "Darwin" ]; then
  if pgrep -f "caffeinate -ims" >/dev/null; then echo "잠자기 방지 이미 켜짐"
  else nohup caffeinate -ims >/dev/null 2>&1 & echo "잠자기 방지 켬 — 화면은 꺼져도 됨 (덮개 닫지 말 것, 전원 연결)"; fi
else
  echo "⚠ macOS가 아님 — 전원 옵션에서 절전 모드를 '안 함'으로 직접 설정"
fi
python3 scripts/round_watch.py unreserve
python3 scripts/round_watch.py check
python3 scripts/round_watch.py plan
