# Security

- API 키는 서버 환경변수와 Secret Manager에만 저장
- 프론트엔드에 브로커 키 노출 금지
- 주문 권한과 조회 권한 분리
- Production과 Paper 계정 분리
- 모든 주문 요청에 idempotency key
- 관리자 액션 감사 로그
- Risk Policy 변경은 명시적 승인 필요
- DB RLS 적용
- 실제 거래 단계에서는 출금 권한 없는 API 키 우선
