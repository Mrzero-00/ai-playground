# MVP 릴리스 체크리스트

## 자동 검증

- [ ] pnpm typecheck
- [ ] pnpm test
- [ ] pnpm build
- [ ] pnpm ait:build
- [ ] git diff --check

## 핵심 시나리오

- [ ] 첫 발송은 오늘 무료 1장 사용
- [ ] 두 번째 발송은 이용권 없을 때 결제 화면 이동
- [ ] 300원 결제 후 1장 지급
- [ ] 같은 orderId 재호출 시 중복 지급 없음
- [ ] 미결 주문 복원과 지급 완료 처리
- [ ] 시·구 선택 및 선택 구 안에서만 낙하
- [ ] 정확한 좌표 비노출
- [ ] AR 발견과 선착순 한 명 획득
- [ ] 신고 즉시 숨김

## 운영 환경

- [ ] ALLOW_SIMULATED_LOCATION=false
- [ ] ALLOW_SIMULATED_PURCHASE=false
- [ ] mTLS 인증서와 암호화 키 비밀 저장소 설정
- [ ] 결제·환불 대사 배치 설정
- [ ] 실제 안전 영역 승인
