# AGENTS.md

이 문서는 Codex가 저장소에서 작업할 때 따라야 하는 실행 규칙입니다.

---

## 1. Codex 역할

Codex는 이 프로젝트의 개발 및 유지보수 담당자입니다.

Codex가 담당하는 범위:

- TypeScript 코드 작성
- 테스트 작성
- DB Migration 작성
- Workflow 구현
- API Adapter 구현
- 문서 업데이트
- 오류 수정
- 리팩터링

Codex가 직접 담당하지 않는 범위:

- 운영 정책을 임의로 결정
- 확인되지 않은 외부 API 명세 추정
- 실제 계정 권한 없이 게시 성공 가정
- 제휴 정책 위반 가능성이 있는 우회 구현
- 승인 없이 자동 게시 활성화

---

## 2. 작업 시작 전 반드시 확인할 파일

작업 전 아래 파일을 순서대로 읽습니다.

1. `README.md`
2. `docs/architecture.md`
3. `docs/data-model.md`
4. `docs/ai-workflows.md`
5. `docs/implementation-plan.md`
6. 현재 작업과 관련된 package의 README 또는 source

---

## 3. 개발 원칙

### TypeScript

- 모든 앱과 패키지는 TypeScript를 사용합니다.
- `any` 사용을 금지합니다.
- 외부 데이터는 `unknown`으로 받은 뒤 Zod로 검증합니다.
- 도메인 타입과 API DTO 타입을 분리합니다.
- enum보다 string union을 우선합니다.

### Validation

- 외부 API 응답
- AI Structured Output
- 환경변수
- Route Handler 입력
- Workflow payload

위 데이터는 반드시 Zod Schema로 검증합니다.

### Error Handling

모든 외부 연동 오류는 다음 정보를 포함해야 합니다.

```ts
interface ExternalServiceErrorContext {
  provider: string;
  operation: string;
  retryable: boolean;
  statusCode?: number;
  requestId?: string;
}
```

단순히 `throw new Error("failed")` 형태로 처리하지 않습니다.

### Logging

로그에 반드시 포함할 필드:

- workflowRunId
- agentRunId
- provider
- operation
- startedAt
- durationMs
- success
- errorCode

API Key, Access Token, 개인정보는 로그에 기록하지 않습니다.

---

## 4. AI 구현 규칙

- AI 결과를 자유 형식 문자열로 받지 않습니다.
- 가능한 모든 결과는 Structured Output으로 생성합니다.
- Prompt는 소스 코드 안에 직접 작성하지 않습니다.
- Prompt는 `/prompts` 아래 파일로 관리합니다.
- Prompt 버전은 DB에 기록합니다.
- AI가 생성한 URL, 가격, 할인율, 재고 수량을 신뢰하지 않습니다.
- AI 응답은 게시 전에 compliance validation을 통과해야 합니다.
- AI 실패 시 전체 Workflow가 중단되지 않도록 단계별 재시도를 적용합니다.

---

## 5. 데이터베이스 규칙

- Supabase PostgreSQL을 사용합니다.
- Migration 파일 없이 운영 DB를 직접 수정하지 않습니다.
- 모든 주요 테이블은 `created_at`, `updated_at`을 가집니다.
- 외부 상품 ID는 provider와 함께 unique constraint를 설정합니다.
- 동일 상품의 가격, 재고, 평점 변화는 snapshot으로 저장합니다.
- Workflow와 Agent 실행 로그는 삭제하지 않고 보존 기간 정책을 적용합니다.

---

## 6. Workflow 규칙

각 Workflow는 다음 속성을 가져야 합니다.

- Idempotent
- Retryable
- Observable
- Resumable
- Auditable

같은 날짜의 동일 워크플로우가 중복 실행되더라도 게시물이 중복 생성되지 않아야 합니다.

Idempotency Key 예시:

```text
daily-product-discovery:2026-07-13:KR:COUPANG
```

---

## 7. 테스트 규칙

최소 테스트 범위:

- Product Normalizer Unit Test
- Product Scoring Unit Test
- Compliance Rule Unit Test
- Affiliate Provider Contract Test
- AI Schema Validation Test
- Workflow Idempotency Test
- Duplicate Product Prevention Test

외부 API는 테스트에서 직접 호출하지 않고 mock 또는 fixture를 사용합니다.

---

## 8. 작업 단위

한 번의 구현 작업은 가능한 한 다음 단위를 유지합니다.

```text
Feature
├─ Domain Type
├─ Schema
├─ Service
├─ Adapter
├─ Test
└─ Documentation
```

여러 기능을 한 번에 크게 구현하지 않습니다.

---

## 9. 완료 조건

작업 완료 전 다음 명령이 통과해야 합니다.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

통과하지 못한 명령이 있으면 이유와 남은 문제를 작업 결과에 명시합니다.

---

## 10. 최초 실행 명령

저장소가 비어 있다면 다음 순서로 초기화합니다.

```text
1. pnpm workspace 및 Turborepo 구성
2. apps/dashboard 생성
3. apps/content-site 생성
4. apps/worker 생성
5. packages/shared 생성
6. packages/database 생성
7. packages/affiliate 생성
8. packages/ai 생성
9. packages/scoring 생성
10. packages/compliance 생성
11. packages/publishing 생성
12. packages/analytics 생성
13. Trigger.dev 연결
14. Supabase Migration 생성
15. 기본 CI 추가
```

첫 번째 구현 목표는 `docs/implementation-plan.md`의 Phase 0과 Phase 1입니다.
