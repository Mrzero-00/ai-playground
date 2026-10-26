# betman-dashboard — Claude 작업 지침

- 목적: 승부예측 프로그램의 산출물(추천 조합·티켓·과정 채점·teamdb)을 보는 읽기 전용 대시보드. 분석 로직은 여기 두지 않는다.
- 데이터 흐름: `승부예측 프로그램/scripts/dashboard_data.py` → `data/*.json`(커밋). 사이트는 JSON만 읽는다. 스키마를 바꾸면 두 쪽을 같이 고친다.
- 스택: 빌드 없는 정적 HTML/JS/CSS. 외부 스크립트는 cdnjs(Chart.js)만. 다크 모드 지원, 모바일 폭 우선.
- 배포: Vercel 프로젝트 루트 = 이 폴더(`vercel.json` 정적). 개인 배팅 금액이 들어 있으므로 공개 URL이면 Vercel 보호(인증) 설정을 권장.
- 금지: 배당·확률 계산을 사이트에서 다시 하지 않는다(표시만).
