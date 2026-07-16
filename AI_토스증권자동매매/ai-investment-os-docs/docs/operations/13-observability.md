# Observability

## 필수 도구

- Pino 구조화 로그
- Sentry
- OpenTelemetry
- Queue 지연 모니터링
- 데이터 신선도 모니터링
- 주문 상태 불일치 경보

## 주요 알림

- Provider 장애
- 시세 지연
- LLM 검증 실패 급증
- Queue 적체
- DB 저장 실패
- 중복 주문 시도
- Risk Gate 우회 시도
- Paper Broker 상태 불일치
- 일간 손실 한도 도달

## Kill Switch

수동 및 자동 Kill Switch를 모두 제공한다.
Kill Switch 활성화 후 신규 진입을 차단하고 기존 포지션 정책은 별도 설정한다.
