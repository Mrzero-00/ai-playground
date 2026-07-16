# Codex 작업 운영 방식

한 번에 전체 시스템을 구현시키지 않는다.

## 권장 세션

1. 문서 분석과 계획만
2. Monorepo와 공통 타입
3. DB와 Repository
4. Discovery와 Evidence Bundle
5. Thesis Analyzer
6. Decision과 Risk Gate
7. Paper Broker와 상태 머신
8. Evaluator와 대시보드
9. E2E 테스트와 문서화

각 세션 종료 시 커밋 가능한 상태를 유지한다.

## 리뷰 질문

- 실제 Phase 범위를 넘었는가?
- LLM에 결정론적 역할을 맡겼는가?
- 데이터 시점이 재현 가능한가?
- Mock과 실제 Provider가 분리됐는가?
- Risk Gate를 우회할 경로가 있는가?
- 실패 상태와 재시작 복구가 테스트됐는가?
