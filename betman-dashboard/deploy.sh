#!/bin/sh
# 대시보드 데이터 재생성 + Vercel 프로덕션 배포 (08시 정기 작업·블록 점검 뒤)
set -e
cd "$(dirname "$0")"
python3 "../승부예측 프로그램/scripts/dashboard_data.py"
vercel --prod --yes 2>&1 | grep -E "Production|Aliased|Error" || true
