#!/bin/sh
# 대시보드 데이터 재생성 + 커밋/푸시 (Vercel 은 GitHub main 푸시로 자동 배포, Root Directory = betman-dashboard)
set -e
cd "$(dirname "$0")/.."
python3 "승부예측 프로그램/scripts/dashboard_data.py"
git add betman-dashboard/data >/dev/null 2>&1 || true
git commit -q -m "dashboard: 데이터 갱신 $(date '+%m-%d %H:%M')" 2>/dev/null || true
git pull --rebase --autostash origin pacu >/dev/null 2>&1 || true
git push -q origin pacu 2>/dev/null || true
git push -q origin pacu:main 2>/dev/null || true
# 즉시 반영이 필요하면 리포 루트에서 CLI 배포(프로젝트 링크 .vercel 이 있을 때만; 없으면 GitHub 푸시 → 자동 배포에 맡긴다)
[ -d .vercel ] && vercel --prod --yes 2>&1 | grep -E "Aliased|Error" || true
