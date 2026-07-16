# Phase 1 — Vertical Slice MVP

## 목표

샘플 시장 이벤트 한 건이 다음 전체 흐름을 통과하게 한다.

```text
Mock 데이터
→ Discovery
→ Evidence Bundle
→ Thesis 분석
→ Decision
→ Risk Gate
→ Paper Broker
→ 거래 종료
→ Evaluation
→ DB 저장
→ Dashboard
```

## 구현 범위

### Monorepo
- pnpm workspace
- Turborepo
- TypeScript strict

### 앱
- `apps/web`: Next.js App Router, Chakra UI, TanStack Query
- `apps/api`: Fastify
- `apps/worker`: BullMQ

### 패키지
- shared contracts + Zod
- mock providers
- discovery
- evidence
- AI thesis analyzer
- decision
- risk
- paper broker
- evaluator
- Supabase repository

### 테스트
- 단위 테스트
- Zod validation
- Risk Gate 거부 테스트
- 주문 상태 머신 테스트
- End-to-end Paper Trade 테스트

## 제외

- 실제 증권 API
- 실시간 WebSocket
- 다중 LLM 위원회
- ML 모델
- Knowledge/Evidence Graph DB
- Counterfactual 전체 구현
- 자동 전략 승격
- 실제 돈 사용

## 완료 조건

- 한 명령으로 개발 환경 실행
- Seed 데이터로 전체 흐름 재현
- 모든 단계 DB 저장
- Risk Gate 우회 불가
- 타입 검사와 테스트 통과
- README에 실행법 포함
