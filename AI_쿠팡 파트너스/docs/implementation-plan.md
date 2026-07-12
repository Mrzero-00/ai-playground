# Implementation Plan

## Phase 0. Repository Bootstrap

목표: 개발 가능한 Monorepo 기반을 구성합니다.

작업:

- pnpm workspace 구성
- Turborepo 구성
- 공통 TypeScript 설정
- ESLint 및 Prettier 설정
- Vitest 설정
- GitHub Actions 기본 CI
- `.env.example` 추가
- apps 및 packages 빈 구조 생성

완료 조건:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

모두 통과합니다.

---

## Phase 1. Database and Domain

목표: 상품, 실행, 콘텐츠를 저장할 수 있습니다.

작업:

- Supabase 연결
- Migration 생성
- Database Client Package 생성
- Domain Type 정의
- Zod Schema 정의
- Repository Layer 생성
- Seed Script 작성

완료 조건:

- Product 저장 가능
- Product Snapshot 저장 가능
- Workflow Run 저장 가능
- Prompt Version 저장 가능
- Migration 재실행 가능

---

## Phase 2. Affiliate Provider

목표: 쿠팡 상품 데이터를 Domain Product로 변환합니다.

작업:

- `AffiliateProvider` interface
- Coupang Adapter
- API Response Schema
- Product Normalizer
- Affiliate Link 생성
- Mock Fixture
- Contract Test

완료 조건:

- 키워드 검색 가능
- 응답 검증 가능
- 중복 상품 제거 가능
- 상품 Snapshot 저장 가능
- 제휴 링크 생성 가능

실제 API 권한이 없으면 Mock Provider로 먼저 구현합니다.

---

## Phase 3. Market Context

목표: 날짜, 계절, 날씨, 트렌드를 하나의 컨텍스트로 저장합니다.

작업:

- Weather Provider Adapter
- Trend Provider Adapter
- Seasonal Event Resolver
- Market Research Agent
- Structured Output Schema
- Market Context 저장

완료 조건:

- 특정 날짜의 Market Context 생성
- 같은 날짜 중복 생성 방지
- AI 실패 시 Raw Context 저장
- 운영자가 Dashboard에서 확인 가능

---

## Phase 4. Product Scoring

목표: 상품 후보를 정량적으로 정렬합니다.

작업:

- Hard Filter
- Rule-based Score
- AI Semantic Score
- Weight Calculator
- Penalty Calculator
- Ranking Service
- Score Versioning

완료 조건:

- 각 상품 점수 저장
- 선정 및 제외 이유 저장
- 최근 게시 상품 패널티
- 점수 재계산 가능
- Top N 후보 선택 가능

---

## Phase 5. Content Pipeline

목표: 선정 상품의 채널별 콘텐츠 초안을 생성합니다.

작업:

- Content Planning Agent
- Blog Generator
- Instagram Carousel Generator
- Instagram Reel Script Generator
- Prompt Version 연결
- Duplicate Similarity 검사

완료 조건:

- 상품별 Content Plan 생성
- 채널별 독립 콘텐츠 생성
- Structured Metadata 저장
- 동일 문구 반복 감지
- 생성 비용 저장

---

## Phase 6. Compliance

목표: 잘못된 상품 정보와 정책 위반 가능성을 차단합니다.

작업:

- Rule-based Validator
- Affiliate Disclosure Validator
- Pricing Claim Validator
- Health Claim Validator
- Forbidden Category Validator
- AI Compliance Agent
- Final Compliance Score

완료 조건:

- CRITICAL 위반은 자동 반려
- 제휴 문구 자동 삽입
- 가격 단정 문구 감지
- 원본 상품과 콘텐츠 불일치 감지
- 검증 이력 저장

---

## Phase 7. Review Dashboard

목표: 운영자가 콘텐츠를 승인 또는 반려할 수 있습니다.

화면:

- Daily Run 목록
- Product Candidate 목록
- Product Score 상세
- Content Preview
- Compliance Result
- Approve / Reject
- Publish Schedule
- Workflow Logs

완료 조건:

- 승인 상태 변경 가능
- 반려 이유 저장 가능
- 승인 전 게시 불가
- 모바일에서도 검토 가능

---

## Phase 8. Publishing

목표: 승인 콘텐츠를 자체 사이트에 게시합니다.

작업:

- Content Site 게시 Adapter
- Affiliate Redirect Route
- Instagram Publishing Adapter Stub
- Publication 상태 관리
- 실패 재시도

초기에는 자체 사이트 게시를 먼저 완료합니다.

Instagram은 공식 권한 및 계정 설정 후 활성화합니다.

완료 조건:

- 승인 콘텐츠 게시 가능
- 공개 URL 저장
- 게시 실패 재시도
- 같은 콘텐츠 중복 게시 방지
- 제휴 Redirect 추적 가능

---

## Phase 9. Analytics

목표: 클릭과 수익을 측정합니다.

작업:

- Redirect Click Event
- UTM 생성
- Publication Performance 집계
- Provider Conversion Import
- Daily Performance Summary
- Dashboard Chart

완료 조건:

- 콘텐츠별 클릭 수 확인
- 상품별 클릭 수 확인
- 전환 및 수익 저장
- CTR과 Conversion Rate 계산
- 다음 Scoring에 성과 사용

---

## Phase 10. Scheduler

목표: 매일 자동 실행합니다.

Trigger.dev 작업:

```text
daily-market-context
daily-product-discovery
score-product-candidates
generate-content-drafts
validate-generated-content
collect-performance
```

기본 스케줄:

```text
06:00 KST: Market Context
06:10 KST: Product Discovery
06:30 KST: Product Scoring
07:00 KST: Content Generation
07:30 KST: Compliance Validation
23:00 KST: Performance Collection
```

완료 조건:

- 단계별 재시도
- Idempotency Key
- 실패 알림
- Run Dashboard
- 수동 재실행

---

## Codex 최초 작업 지시

Codex가 이 문서를 처음 읽었다면 아래 작업을 수행합니다.

```text
Task: Bootstrap Affiliate Automation Monorepo

1. pnpm + Turborepo Monorepo를 초기화한다.
2. Next.js App Router 기반 apps/dashboard를 생성한다.
3. Next.js App Router 기반 apps/content-site를 생성한다.
4. Node TypeScript 기반 apps/worker를 생성한다.
5. packages/shared, database, affiliate, ai, scoring,
   compliance, publishing, analytics, ui를 생성한다.
6. strict TypeScript 설정을 적용한다.
7. Vitest와 ESLint를 설정한다.
8. 루트 scripts에 dev, build, lint, typecheck, test를 추가한다.
9. GitHub Actions CI를 추가한다.
10. 각 package에 최소 README를 추가한다.
11. 환경변수 Zod Validator를 packages/shared에 구현한다.
12. 모든 명령이 통과하도록 수정한다.
```

첫 PR에서는 실제 외부 API를 연결하지 않습니다.
