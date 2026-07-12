# Architecture

## 1. 시스템 목표

상품을 직접 판매하지 않고 제휴 링크를 통해 전환 수수료를 얻는 자동화 플랫폼입니다.

핵심 자동화 대상:

- 트렌드 조사
- 상품 후보 수집
- 상품 적합도 평가
- 콘텐츠 기획
- 채널별 콘텐츠 생성
- 검증 및 승인
- 게시
- 클릭과 전환 분석
- 다음 실행에 성과 반영

---

## 2. 아키텍처 개요

```text
External Data
├─ Weather
├─ Search Trends
├─ Affiliate Product API
└─ Channel Analytics
        │
        ▼
Workflow Engine
├─ Context Collector
├─ Product Collector
├─ Scoring Pipeline
├─ AI Content Pipeline
├─ Compliance Pipeline
├─ Publishing Pipeline
└─ Analytics Pipeline
        │
        ▼
PostgreSQL
├─ Products
├─ Snapshots
├─ Scores
├─ Contents
├─ Publications
├─ Events
└─ Runs
        │
        ├─────────────┐
        ▼             ▼
Admin Dashboard   Content Site
```

---

## 3. 애플리케이션 역할

### apps/dashboard

운영자용 관리자 화면입니다.

주요 기능:

- 오늘의 시장 컨텍스트 확인
- 상품 후보 및 점수 확인
- 콘텐츠 미리보기
- 승인 및 반려
- 게시 상태 확인
- 수익 및 클릭 분석
- Workflow Run 확인
- Prompt 버전 관리

### apps/content-site

SEO 기반 자체 콘텐츠 사이트입니다.

주요 기능:

- 추천 글 게시
- 상품 비교 글
- 카테고리 랜딩
- 제휴 고지
- 클릭 추적 Redirect
- Open Graph Metadata

### apps/worker

장기 실행 및 외부 API 연동을 담당합니다.

주요 기능:

- 상품 수집
- AI 호출
- 콘텐츠 검증
- 게시 API 호출
- 분석 데이터 수집
- 실패 재시도

---

## 4. 패키지 역할

### packages/affiliate

제휴 플랫폼별 Adapter를 제공합니다.

```ts
export interface AffiliateProvider {
  provider: AffiliateProviderName;

  searchProducts(
    input: SearchAffiliateProductsInput,
  ): Promise<SearchAffiliateProductsResult>;

  getProduct(
    externalProductId: string,
  ): Promise<AffiliateProduct | null>;

  createAffiliateLink(
    product: AffiliateProduct,
  ): Promise<AffiliateLink>;
}
```

첫 구현체:

```text
CoupangAffiliateProvider
```

추가 구현체:

```text
AmazonAffiliateProvider
```

### packages/ai

AI Provider와 Agent 실행을 담당합니다.

```text
AI Provider Adapter
├─ OpenAIProvider
├─ GeminiProvider
└─ AnthropicProvider
```

Agent는 상태를 직접 변경하지 않고 결과만 반환합니다.

### packages/scoring

상품 점수를 계산합니다.

LLM이 평가한 부분 점수와 코드에서 계산한 점수를 결합합니다.

### packages/compliance

다음 항목을 검증합니다.

- 제휴 고지 문구
- 과장 표현
- 확인되지 않은 효능
- 가격 및 할인율 단정
- 금지 카테고리
- 상품 데이터 불일치
- 중복 콘텐츠
- 링크 유효성

### packages/publishing

채널별 게시 Adapter입니다.

```ts
export interface PublishingProvider {
  channel: PublishingChannel;

  publish(
    content: PublishableContent,
  ): Promise<PublishResult>;
}
```

### packages/analytics

클릭, 전환, 수익 데이터를 정규화합니다.

---

## 5. 데이터 흐름

### 상품 수집

```text
Affiliate API Response
        ↓
Zod Validation
        ↓
Provider DTO
        ↓
Normalizer
        ↓
Domain Product
        ↓
Product + Product Snapshot 저장
```

### 상품 선정

```text
Market Context
        +
Product Snapshot
        +
Historical Performance
        ↓
Rule-based Filters
        ↓
AI Semantic Scoring
        ↓
Weighted Score
        ↓
Candidate Ranking
```

### 콘텐츠 생성

```text
Selected Product
        +
Audience
        +
Channel Template
        +
Prompt Version
        ↓
Structured Content Plan
        ↓
Channel-specific Draft
        ↓
Compliance Validation
        ↓
Review Queue
```

---

## 6. 점수 모델

초기 점수 가중치는 다음과 같습니다.

```ts
const SCORE_WEIGHTS = {
  trend: 0.25,
  season: 0.15,
  weather: 0.15,
  conversionPotential: 0.2,
  commissionPotential: 0.1,
  contentFit: 0.15,
} as const;
```

패널티:

```ts
const PENALTIES = {
  recentlyPublished: 20,
  lowReviewCount: 10,
  unstablePrice: 15,
  duplicatedCategory: 8,
  weakDataConfidence: 20,
} as const;
```

최종 점수는 0~100 범위로 정규화합니다.

가중치는 운영자가 Dashboard에서 변경할 수 있도록 설계하되, 모든 변경 이력을 저장합니다.

---

## 7. 승인 상태

```ts
export type ContentStatus =
  | 'DRAFT'
  | 'VALIDATING'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';
```

초기 MVP에서는 `APPROVED` 상태가 되어야만 게시할 수 있습니다.

---

## 8. 확장 원칙

새로운 제휴 플랫폼을 추가할 때 Core Workflow를 수정하지 않습니다.

```text
Core Workflow
        │
        ├─ Coupang Adapter
        ├─ Amazon Adapter
        └─ Future Provider Adapter
```

새로운 채널을 추가할 때 Content Domain을 재사용하고 Publishing Adapter만 확장합니다.

---

## 9. 보안

- Secret은 환경변수 또는 Secret Manager에 저장합니다.
- 브라우저 번들에 Affiliate Secret을 포함하지 않습니다.
- 모든 외부 API 호출은 Server/Worker에서 수행합니다.
- Redirect Link는 허용된 도메인만 대상으로 합니다.
- Webhook은 서명 검증을 수행합니다.
- 관리자 Route는 인증 및 권한 검사를 수행합니다.
