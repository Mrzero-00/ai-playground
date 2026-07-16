# Codex 작업 지침

## 문서 우선순위

작업 전 반드시 다음 순서로 문서를 읽는다.

1. `docs/00-product-overview.md`
2. `docs/architecture/01-system-architecture.md`
3. `docs/contracts/02-data-contracts.md`
4. `docs/policies/03-risk-policy.md`
5. 현재 요청된 `docs/phases/*.md`

충돌할 경우 우선순위는 다음과 같다.

```text
Risk Policy
> 현재 Phase 문서
> Data Contracts
> Architecture
> Product Overview
```

## 개발 원칙

- TypeScript strict mode를 사용한다.
- 외부 데이터와 브로커는 Provider 인터페이스 뒤에 숨긴다.
- LLM 응답은 Zod로 검증한다.
- Risk Gate는 LLM과 완전히 분리한다.
- 실제 증권 주문은 명시적으로 요청된 Phase 이전에 구현하지 않는다.
- 모든 판단 근거와 체결 결과를 저장한다.
- 문서에 없는 기능을 임의로 추가하지 않는다.
- 실패한 테스트를 삭제하거나 우회하지 않는다.
- 미래 데이터를 과거 시점에 사용하는 look-ahead bias를 금지한다.
- 시간 정보는 UTC로 저장하고 UI에서 지역 시간대로 변환한다.
- 금액 계산에는 부동소수점 직접 연산을 피한다.

## 매 작업의 완료 보고

- 변경 파일
- 구현한 요구사항
- 테스트 및 타입 검사 결과
- 미구현 범위
- 문서와 달라진 부분
- 알려진 위험
- 다음 작업 권장 범위
