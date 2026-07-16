# Phase 5 — Small Live Trading

## 선행 조건

- Paper와 Shadow Mode 성과 기준 충족
- 장애 복구 훈련
- 수동 Kill Switch 검증
- 보안 검토
- 브로커 주문 샌드박스 검증

## 초기 제한

- 거래당 최대 위험 0.1~0.25%
- 일간 최대 손실 0.5~1%
- 레버리지 금지
- 최대 동시 포지션 제한
- Event 전략은 더 작은 한도
- 실제 거래와 Paper 거래 병행

Live Broker는 Paper Broker와 동일한 인터페이스를 구현한다.
