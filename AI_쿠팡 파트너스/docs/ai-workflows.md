# AI Workflows

## 1. 기본 원칙

AI는 다음 작업만 담당합니다.

- 비정형 트렌드 요약
- 상품과 상황의 의미적 적합도 평가
- 타깃 고객과 구매 맥락 분석
- 콘텐츠 기획 및 초안 생성
- 자연어 정책 위반 가능성 검사

AI가 담당하지 않는 작업:

- 최종 가격 판단
- 재고 판단
- 링크 생성
- 최종 게시 여부
- 점수 합산
- 중복 방지
- 데이터베이스 상태 전환

---

## 2. Agent 구성

### Market Research Agent

입력:

```ts
interface MarketResearchInput {
  date: string;
  locale: 'ko-KR';
  weather: WeatherContext[];
  searchTrends: SearchTrend[];
  seasonalEvents: SeasonalEvent[];
  previousPerformanceSummary: PerformanceSummary;
}
```

출력:

```ts
interface MarketResearchOutput {
  themes: Array<{
    keyword: string;
    reason: string;
    targetAudience: string[];
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    confidence: number;
  }>;
  avoidedThemes: Array<{
    keyword: string;
    reason: string;
  }>;
}
```

### Product Scoring Agent

입력:

- 정규화된 상품 정보
- 시장 컨텍스트
- 과거 성과 요약
- 최근 게시 이력

출력:

```ts
interface ProductSemanticScoreOutput {
  trendScore: number;
  seasonScore: number;
  weatherScore: number;
  conversionPotentialScore: number;
  contentFitScore: number;
  confidence: number;
  reasons: string[];
  risks: string[];
}
```

모든 점수는 0~100 범위입니다.

### Content Planning Agent

출력:

```ts
interface ContentPlanOutput {
  targetAudience: string[];
  customerProblem: string;
  contentAngle: string;
  keyBenefits: string[];
  cautions: string[];
  channelPlans: Array<{
    channel: 'BLOG' | 'INSTAGRAM_CAROUSEL' | 'INSTAGRAM_REEL';
    hook: string;
    structure: string[];
    callToAction: string;
  }>;
}
```

### Content Generation Agent

채널별 Prompt를 사용합니다.

- `blog-product-guide`
- `instagram-carousel`
- `instagram-reel`
- `short-caption`

하나의 원고를 다른 채널에 재활용하지 않습니다.

### Compliance Agent

입력:

- 원본 상품 데이터
- 생성 콘텐츠
- 채널
- 제휴 정책 규칙

출력:

```ts
interface ComplianceOutput {
  score: number;
  passed: boolean;
  violations: Array<{
    code: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    sourceText?: string;
  }>;
  requiredDisclosures: string[];
}
```

---

## 3. Prompt 관리

Prompt 파일 구조:

```text
prompts/
├─ market-research/
│  ├─ system.md
│  └─ user-template.md
├─ product-scoring/
├─ content-planning/
├─ blog-product-guide/
├─ instagram-carousel/
├─ instagram-reel/
└─ compliance/
```

Prompt 변경 시:

1. 파일 수정
2. 테스트 Fixture 실행
3. Prompt Version 증가
4. DB 등록
5. 활성 버전 전환
6. 이전 버전 유지

---

## 4. 모델 선택

초기 권장 전략:

```text
Market Research
→ 고성능 추론 모델

Product Semantic Scoring
→ 중간급 모델, 배치 입력

Content Planning
→ 중간급 모델

Content Generation
→ 중간급 모델

Compliance First Pass
→ 저비용 모델

Compliance Final Pass
→ 고성능 모델 또는 규칙 엔진과 결합
```

모델 이름은 코드에 직접 작성하지 않고 환경변수 또는 설정 테이블에서 관리합니다.

---

## 5. 실패 처리

AI 호출 실패 시:

```text
1차 실패
→ 동일 모델 재시도

2차 실패
→ 지수 백오프

3차 실패
→ 대체 모델 사용

대체 모델 실패
→ REVIEW_REQUIRED 또는 WORKFLOW_PARTIAL_FAILURE
```

AI 실패 때문에 이미 수집한 상품 데이터가 손실되면 안 됩니다.

---

## 6. 비용 제한

각 Workflow Run은 최대 AI 비용 제한을 가집니다.

```ts
interface WorkflowBudget {
  maxCostUsd: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxAgentRuns: number;
}
```

제한 초과 시 남은 후보를 처리하지 않고 검토 상태로 종료합니다.

---

## 7. 품질 평가

AI 결과는 다음 기준으로 평가합니다.

- Schema Validity
- Factual Consistency
- Product Data Alignment
- Tone Match
- Duplicate Similarity
- Compliance Score
- Human Approval Rate
- Click-through Rate
- Conversion Rate

좋은 Prompt는 글이 자연스러운 Prompt가 아니라 성과와 승인율이 높은 Prompt입니다.
