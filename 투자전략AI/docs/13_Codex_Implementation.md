# 13. Implementation Status

기준 문서: `01_Architecture.md`

## 구현 완료

- Long-term / Momentum 점수 모듈 분리
- Cross Signal 4분류
- Portfolio Bucket과 단일 종목 한도
- Risk Engine 거부권과 수동 검토
- 사용자 명시 승인 상태 흐름
- 전략별 Position Lot과 Exit Policy 검증
- Long-term Candidate / Momentum Setup 상태 전이
- Model Version 승인·활성화 상태 전이
- 데이터 Snapshot 기준시각·신뢰도·stale 판정
- Job의 성공·부분 성공·실패 상태
- Domain Event와 Audit Log 계약
- 추천가·체결가·부분체결 기록
- 근거 및 모델 버전을 포함하는 Markdown Report
- 테스트용 In-memory Repository와 Decision Workflow
- Supabase PostgreSQL Schema, Index, RLS
- Decimal 문자열 기반 금액·가격·수량 계산
- Proposal 만료와 사용자 승인 직전 재검증
- Risk·Portfolio 정책 버전 및 Snapshot 계보
- API v1, Request/Correlation ID와 쓰기 멱등성
- Transactional Outbox와 멱등 Event Publisher

## 런타임 경계

API는 자동 주문을 실행하지 않는다. 처리 순서는 아래와 같다.

```text
Evaluation
  -> Cross Signal
  -> Allocation Proposal
  -> Risk Decision
  -> Decision Proposal
  -> Explicit User Approval
  -> Execution Record
```

Risk `DENY`는 이후 승인을 생성할 수 없으며, 정상 Risk 판정도 사용자 승인 전에는 `PENDING_APPROVAL` 상태를 유지한다.

사용자 승인은 Proposal 만료, Portfolio 잔여 용량, 가격 허용 범위, 데이터 신선도와 Risk 유효성을 재검증해야 한다. 승인 Event는 Domain 상태·Audit과 함께 Outbox에 기록된 뒤 Publisher가 발행한다.

## 외부 연결 전제

다음 항목은 코드가 아니라 운영 환경 설정이 필요하다.

- Supabase 프로젝트 URL과 서버 전용 키
- 데이터 공급자 API와 수집 주기
- 인증 사용자 및 초기 Portfolio
- 실제 운용 정책으로 승인된 점수 가중치와 Risk Limit

이 값이 없어도 Domain, Migration, API와 테스트는 실행할 수 있다. 자동 주문은 MVP 범위에서 제외한다.

## 검증 명령

```bash
pnpm typecheck
pnpm test
pnpm build
```
