# Affiliate Automation Platform

쿠팡 파트너스 기반의 상품 탐색, 콘텐츠 생성, 게시, 성과 수집을 자동화하는 프로젝트입니다.

첫 번째 MVP는 다음 범위만 구현합니다.

- 대한민국 시장
- 쿠팡 파트너스
- 자체 운영 콘텐츠 사이트
- Instagram Business 계정
- 매일 오전 자동 실행
- 상품 추천 및 콘텐츠 초안 생성
- 관리자 승인 후 게시
- 클릭 및 전환 성과 수집

Amazon 및 다른 제휴 플랫폼은 MVP가 안정화된 이후 Provider Adapter 방식으로 추가합니다.

---

## 1. 핵심 원칙

이 프로젝트는 LLM이 전체 프로세스를 임의로 수행하는 자율형 에이전트가 아닙니다.

```text
Workflow Engine
  ├─ 정해진 순서로 작업 실행
  ├─ 재시도 및 실패 기록
  ├─ 실행 상태 관리
  └─ 승인 및 게시 제어

LLM
  ├─ 트렌드 해석
  ├─ 상품 적합도 평가
  ├─ 콘텐츠 생성
  └─ 정책 위반 가능성 검사

Application Code
  ├─ 상품 필터링
  ├─ 점수 계산
  ├─ 데이터 검증
  ├─ 중복 방지
  └─ 게시 조건 판단
```

LLM은 판단과 생성에 사용하고, 실행 제어와 비즈니스 규칙은 TypeScript 코드가 담당합니다.

---

## 2. 권장 기술 스택

- Monorepo: pnpm + Turborepo
- Frontend: Next.js App Router + TypeScript
- UI: Chakra UI
- Server State: TanStack Query
- Client State: Zustand
- Database: Supabase PostgreSQL
- Storage: Supabase Storage
- Workflow: Trigger.dev
- AI: OpenAI Responses API 기반 Provider Adapter
- Validation: Zod
- Monitoring: Sentry
- AI Trace: Langfuse
- Deployment:
  - Dashboard / Content Site: Vercel
  - Long-running Worker: Trigger.dev Cloud 또는 별도 Worker 런타임

---

## 3. 저장소 구조

```text
affiliate-automation/
├─ apps/
│  ├─ dashboard/
│  ├─ content-site/
│  └─ worker/
│
├─ packages/
│  ├─ affiliate/
│  ├─ ai/
│  ├─ analytics/
│  ├─ compliance/
│  ├─ database/
│  ├─ publishing/
│  ├─ scoring/
│  ├─ shared/
│  └─ ui/
│
├─ trigger/
├─ prompts/
├─ docs/
├─ AGENTS.md
├─ README.md
├─ turbo.json
├─ pnpm-workspace.yaml
└─ package.json
```

---

## 4. MVP 자동화 흐름

매일 오전 06:00 KST에 다음 워크플로우를 실행합니다.

```text
Collect Market Context
        ↓
Collect Coupang Products
        ↓
Normalize and Filter Products
        ↓
Score Product Candidates
        ↓
Select Top Products
        ↓
Generate Channel-specific Content
        ↓
Validate Facts and Compliance
        ↓
Create Review Queue
        ↓
Human Approval
        ↓
Publish Content
        ↓
Collect Performance
```

초기 버전에서는 자동 게시하지 않습니다.

다음 조건을 모두 충족한 콘텐츠만 추후 자동 게시 대상으로 전환합니다.

- 상품 데이터 최신성 확인
- 제휴 고지 문구 존재
- 정책 점수 95점 이상
- 생성 신뢰도 0.9 이상
- 가격 및 할인율 직접 단정 없음
- 금지 카테고리 아님
- 기존 콘텐츠와 중복 아님

---

## 5. 시작 방법

### 필수 요구사항

- Node.js 20 이상
- pnpm 9 이상
- Supabase 프로젝트
- Trigger.dev 프로젝트
- OpenAI API Key
- 쿠팡 파트너스 계정
- Instagram Business 계정

### 설치

```bash
pnpm install
```

### 환경변수

```bash
cp .env.example .env.local
```

`docs/environment.md`를 참고하여 값을 입력합니다.

### 개발 서버

```bash
pnpm dev
```

### 타입 검사

```bash
pnpm typecheck
```

### 테스트

```bash
pnpm test
```

### 린트

```bash
pnpm lint
```

---

## 6. 구현 순서

Codex는 반드시 다음 순서를 따릅니다.

1. Monorepo 초기화
2. 공통 TypeScript 설정
3. Database Schema 및 Migration
4. Affiliate Provider Interface 구현
5. Coupang Provider 구현
6. Product Normalizer 구현
7. Product Scoring Engine 구현
8. AI Provider Adapter 구현
9. Trend Research Workflow 구현
10. Content Generation Workflow 구현
11. Compliance Validator 구현
12. Review Dashboard 구현
13. Publish Adapter 구현
14. Analytics Tracking 구현
15. Trigger.dev Schedule 연결
16. 테스트 및 운영 로그 구축

상세 내용은 `docs/implementation-plan.md`를 참고합니다.

---

## 7. 첫 번째 완료 기준

다음 조건을 모두 충족하면 MVP 1차 완료입니다.

- 매일 오전 워크플로우 자동 실행
- 상품 후보 100개 이상 수집 가능
- 코드 기반 필터링 통과 상품만 저장
- 상품별 점수와 선정 이유 저장
- 상위 상품 5개 콘텐츠 초안 생성
- 관리자 화면에서 승인 및 반려 가능
- 승인 콘텐츠를 자체 사이트에 게시 가능
- 제휴 링크 클릭 이벤트 저장
- 모든 Workflow Run 및 AI Run 추적 가능
- 같은 상품이 짧은 기간 안에 반복 선정되지 않음

---

## 8. 참고 문서

- `AGENTS.md`: Codex 작업 규칙
- `docs/architecture.md`: 전체 시스템 구조
- `docs/implementation-plan.md`: 단계별 개발 계획
- `docs/data-model.md`: DB 및 도메인 모델
- `docs/ai-workflows.md`: AI Agent 및 프롬프트 규칙
- `docs/environment.md`: 환경변수
- `docs/operations.md`: 운영 및 장애 대응

---

## 9. 중요한 제한사항

- 쿠팡 및 각 채널의 공식 API와 운영정책을 우선합니다.
- 무단 대량 크롤링을 기본 수집 방식으로 사용하지 않습니다.
- LLM이 생성한 가격, 할인율, 재고, 배송 정보는 신뢰하지 않습니다.
- 제휴 고지 문구는 모든 게시물에 포함합니다.
- 자동 게시보다 데이터 검증과 정책 준수를 우선합니다.
- 성과가 없는 콘텐츠를 대량 생성하지 않습니다.
- Prompt 변경은 반드시 버전으로 기록합니다.

---

## 10. 현재 구현 상태

Phase 0 Repository Bootstrap이 완료되었습니다.

- pnpm workspace와 Turborepo 구성
- `apps/dashboard`, `apps/content-site`, `apps/worker` 생성
- 도메인별 `packages/*` 및 공통 UI 패키지 생성
- TypeScript strict mode, ESLint, Prettier, Vitest 구성
- Chakra UI, TanStack Query, Zustand 의존성 구성
- Client/Server 환경변수 Zod 검증 및 단위 테스트 추가
- GitHub Actions CI 추가
- 기존 단일 실행형 프로토타입을 `legacy/initial-prototype`으로 이동

Phase 4 Product Scoring까지 구현되어 있습니다. 실제 Supabase Migration 적용과 외부 데이터 Provider
활성화는 키와 공식 명세가 준비된 후 수행합니다. 다음 작업은 Phase 5 Content Pipeline입니다.
