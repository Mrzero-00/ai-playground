# 03. Long-term Engine Specification

> Core와 Future Core 후보를 Point-in-time 데이터, 검증 가능한 근거, 가치평가와 Thesis로 평가하는 실행 명세

- 문서 버전: `v1.0.0-draft`
- 작성일: `2026-07-22`
- 상태: `IMPLEMENTATION-READY DRAFT`
- 선행 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1
- 후속 문서: `05_Portfolio_Engine.md`, `08_Database.md`, `09_Scoring_System.md`, `10_Risk_Engine.md`
- 구현 기준 경로: `packages/core`, `apps/api`, `supabase/migrations`

---

## 0. 문서의 역할

이 문서는 Long-term 철학을 설명하는 글이 아니다. `01_Architecture.md`의 시스템 경계와 `02_Investment_Philosophy.md`의 원칙을 실제 코드, 데이터베이스, API, Job, 테스트로 구현할 수 있도록 고정하는 **도메인 설계 계약**이다.

이 문서가 답해야 하는 질문은 다음과 같다.

1. 어떤 데이터가 있어야 평가를 시작할 수 있는가?
2. Core와 Future Core는 무엇을 다르게 평가하는가?
3. 점수보다 먼저 통과해야 하는 Gate는 무엇인가?
4. 데이터 부족, 산업별 비적용, 상충하는 근거를 어떻게 처리하는가?
5. Thesis가 강화·유지·약화·파손됐다는 것을 어떻게 판정하는가?
6. 후보가 언제 승격·강등되며 어떤 증거가 필요한가?
7. Engine이 제안할 수 있는 행동과 결정하면 안 되는 행동은 무엇인가?
8. 같은 입력을 과거 시점에서 재현하고 감사할 수 있는가?
9. 구현 완료를 어떤 테스트와 지표로 증명할 것인가?

### 0.1 규범 우선순위

문서가 충돌하면 다음 순서로 해석한다.

1. 법적·보안·사용자 승인 불변식
2. `01_Architecture.md`의 Engine 분리, Point-in-time, 감사, Fail-closed 원칙
3. `02_Investment_Philosophy.md`의 투자 원칙과 Hard Safety
4. 이 문서의 Long-term 세부 계약
5. `09_Scoring_System.md`의 공통 정규화·캘리브레이션 계약
6. 구현 코드와 운영 설정

상위 문서를 우회하기 위해 하위 설정을 변경할 수 없다. 충돌이 발견되면 계산을 계속하지 않고 `POLICY_CONFLICT`로 평가를 차단한다.

### 0.2 03과 09의 책임 분리

`03_LongTerm_Engine.md`는 다음을 소유한다.

- Long-term 평가 Factor와 의미
- Core / Future Core 평가 Profile
- v1 가중치와 Gate
- 승격·강등 상태 전이
- Thesis Lifecycle
- 가치평가와 산업별 평가 방식
- Long-term API, Event, 저장 계약

`09_Scoring_System.md`는 다음을 소유한다.

- 여러 Engine에 공통인 정규화 함수
- Outlier, Winsorization, Percentile 규칙
- 장기 성과 기반 캘리브레이션 방법
- 모델 비교, Champion/Challenger, Drift 기준
- 공통 Score Explainability 형식

따라서 09가 추가되기 전에도 이 문서의 v1 규칙으로 Long-term Engine을 구현할 수 있다. 이후 09가 정규화 방식을 개선하더라도 모델 버전을 새로 발행하며 과거 평가를 덮어쓰지 않는다.

---

## 1. 목표와 비목표

### 1.1 목표

Long-term Engine의 목표는 다음 문장을 구조화된 결과로 만드는 것이다.

> 장기간 기업가치를 복리로 증가시킬 가능성이 있는 사업인지, 현재 가격이 그 불확실성을 감안한 기대수익을 제공하는지, 어떤 증거가 그 판단을 지지하거나 반박하는지 평가한다.

구체적인 목표는 다음과 같다.

- 검증된 사업을 `CoreProfile`로 평가한다.
- 아직 검증 중인 구조적 성장 기업을 `FutureCoreProfile`로 평가한다.
- 숫자 점수와 별도로 데이터 신뢰도와 불확실성을 표현한다.
- Thesis의 핵심 가정, 관찰 지표, Break 조건을 평가와 연결한다.
- 점수 변화가 아니라 증거 변화로 승격·강등을 설명한다.
- 순위, 후보 행동, 다음 검토 항목을 제공한다.
- 모든 출력이 당시 이용 가능했던 데이터만 사용했음을 재현한다.

### 1.2 비목표

Long-term Engine은 다음을 직접 결정하거나 실행하지 않는다.

- 실제 매수 금액과 포트폴리오 비중
- Momentum 예산과 단기 Setup
- 장중 진입가, 손절가, 목표가
- 주문 생성·승인·전송
- 세금·환전·유동성 최종 판단
- 사용자 승인 대체
- 뉴스나 경영진 발언만으로 확정적 사실 생성

`ACCUMULATE`, `REDUCE`, `EXIT`는 **기업 평가 관점의 후보 행동**이다. 실제 자금 배분과 주문 가능 여부는 Portfolio → Risk → Human Approval 순서로 별도 결정한다.

### 1.3 성공 지표

운영 품질은 단순 수익률이 아니라 다음 지표를 함께 본다.

| 영역 | 핵심 지표 |
|---|---|
| 재현성 | 동일 Snapshot·모델 버전 입력의 결과 일치율 100% |
| 계보 | 평가의 Snapshot·Evidence·Model Version 연결률 100% |
| 안전 | Critical Data 누락 상태에서 투자 확대 행동 생성 0건 |
| 설명성 | 모든 Factor 점수에 점수 반영 Evidence 또는 명시적 N/A 사유 존재 |
| Thesis | Candidate 이상 기업의 활성 Thesis·Break 조건 보유율 100% |
| 운영 | 예정 리뷰 지연, 실패 Job, 데이터 Stale 상태의 탐지율 100% |
| 품질 | 승격 결정의 최소 기간·증거 Gate 위반 0건 |

수익률은 장기 검증 지표이지만, 짧은 기간의 수익률로 모델 품질을 단정하거나 자동 변경하지 않는다.

---

## 2. 핵심 설계 결정

### 2.1 기업 매력도와 자본 배분은 분리한다

Long-term Score에는 다음을 넣지 않는다.

- 현재 포트폴리오 비중
- 현금 잔액
- 다른 보유 종목과의 중복 노출
- 사용자 월급 규모
- 단기 유동성 수요
- `portfolioFit`

이 값들은 기업 자체의 매력도가 아니라 배분 제약이다. Long-term Engine은 `relativeAttractiveness`와 `opportunityCostContext`를 참고 정보로 출력할 수 있으나, Core/Future Core 품질 점수에는 섞지 않는다.

현재 `packages/core/src/long-term.ts`의 `opportunityCost`, `portfolioFit` 가중치는 v1 구현 시 제거 대상이다. Legacy API는 명시적 `legacy: true` 응답과 폐기 일정을 제공한 뒤 교체한다.

### 2.2 Core와 Future Core는 하나의 점수 구간이 아니다

다음 분류는 금지한다.

```text
total >= 80 → Core
total >= 65 → Future Core
else → Watch
```

Future Core는 낮은 품질의 Core가 아니다. 검증 단계와 수익 원천, 주요 실패 위험이 다른 별도 Profile이다.

- `CoreProfile`: 이미 확인된 지속성, 현금흐름, 자본 배분, 경쟁우위를 중시한다.
- `FutureCoreProfile`: 성장 증거, 제품·고객 검증, 단위 경제성 개선, 생존성과 희석을 중시한다.

동일 기업에 두 Profile을 모두 실행할 수 있지만 `coreScore`와 `futureCoreScore`는 서로 직접 비교하지 않는다. Core 승격은 Future Core 점수가 높아졌기 때문이 아니라 Core Eligibility Gate와 Core Profile을 새로 통과했기 때문에 발생한다.

### 2.3 Gate가 Score보다 우선한다

점수가 높아도 다음 조건을 통과하지 못하면 행동과 승격을 차단한다.

- 신원과 상장 증권 매핑 불명확
- Critical Data 누락 또는 미래 정보 혼입
- 회계 신뢰성 중대 경고
- 재무 생존성 확인 불가
- Thesis와 반대 근거 부재
- 가치평가 기준일과 시장가격 기준일 불일치
- 산업 Profile 부적합

Score는 순위를 돕지만 Gate를 우회하지 못한다.

### 2.4 위험 점수의 방향을 명시한다

`riskScore`처럼 방향이 모호한 이름을 계산 계약에서 사용하지 않는다.

- `permanentImpairmentRisk`: 높을수록 위험함
- `riskResilienceScore`: 높을수록 영구 손실에 강함

외부 호환 출력에 `riskScore`가 필요하면 반드시 `riskScoreDirection: 'HIGHER_IS_RISKIER'`를 함께 제공한다. 총점에는 `riskResilienceScore = 100 - permanentImpairmentRisk`를 사용한다.

### 2.5 결측은 중립 점수가 아니다

모르는 값에 `0`, `50`, 산업 평균을 자동 대입하지 않는다.

```ts
type MetricAvailability =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN'
  | 'STALE'
  | 'CONFLICTED';
```

- `NOT_APPLICABLE`: 산업 Profile이 사전에 허용한 경우에만 가중치 재정규화
- `UNKNOWN`: 정보 부족이며 Confidence와 Eligibility에 불이익
- `STALE`: 최신성 기준 초과, Critical 여부에 따라 차단
- `CONFLICTED`: 출처 간 불일치, 조정 전까지 수동 검토 또는 차단
- `PARTIAL`: 사용 범위와 한계를 명시하고 Confidence를 낮춤

### 2.6 AI는 근거를 추출하고 규칙은 결정론적으로 계산한다

AI Agent가 수행할 수 있는 일:

- 공시와 실적 발표에서 후보 Fact 추출
- Thesis 초안과 반대 논거 제안
- 산업 지표 매핑 후보 생성
- 비정형 리스크 요약

AI Agent가 단독으로 수행할 수 없는 일:

- 출처 등급 확정 없이 Fact 승인
- Model Version 없이 점수 계산
- Gate 우회
- 상태 전이 확정
- 투자 금액과 주문 승인

모든 점수, Gate, 상태 전이는 순수 함수와 버전된 정책으로 재실행 가능해야 한다.

---

## 3. 용어와 불변식

### 3.1 주요 용어

| 용어 | 정의 |
|---|---|
| Evaluation | 특정 시점의 Snapshot과 모델로 생성한 불변 평가 결과 |
| Profile | Core 또는 Future Core에 맞춘 Factor·Gate·가중치 집합 |
| Factor | 사업 특성 한 축의 0~100 평가와 근거 묶음 |
| Metric | Factor 계산에 쓰이는 관찰 가능한 원시·파생 값 |
| Gate | 점수와 무관하게 다음 단계 또는 행동을 허용하는 조건 |
| Thesis | 수익 원천, 핵심 가정, 위험, Break 조건을 가진 버전 문서 |
| Evidence | 특정 진술을 지지하거나 반박하는 출처 연결 기록 |
| Snapshot | 평가 시점에 사용할 수 있었던 입력의 불변 사본 |
| Stage | 기업 후보의 장기 검증 단계 |
| Action Candidate | 기업 평가 관점의 다음 행동 후보, 주문 지시가 아님 |
| Review Trigger | 정기 또는 사건 기반 재평가 시작 조건 |

### 3.2 시스템 불변식

각 불변식은 코드 테스트와 DB 제약으로 가능한 한 이중 강제한다.

| ID | 불변식 |
|---|---|
| LT-INV-001 | `dataAsOf`, `marketPriceAsOf`, Evidence `asOf`는 `evaluatedAt` 이후일 수 없다. |
| LT-INV-002 | 완료된 Evaluation과 Thesis는 수정하지 않고 새 Revision을 추가한다. |
| LT-INV-003 | 모든 완료 Evaluation은 Snapshot, Model Version, Evidence를 가진다. |
| LT-INV-004 | 점수 반영 Evidence는 A~C 등급이며 `scoreEligible=true`여야 한다. |
| LT-INV-005 | Counter Evidence가 없으면 Candidate 이상 승격과 확대 행동을 금지한다. |
| LT-INV-006 | Critical Gate 실패 시 `ACCUMULATE`, `BUY_ON_WEAKNESS`, 승격을 금지한다. |
| LT-INV-007 | Core와 Future Core Score를 단일 임계치로 상호 변환하지 않는다. |
| LT-INV-008 | 기업 품질 점수에 포트폴리오 비중과 자금 사정을 넣지 않는다. |
| LT-INV-009 | `NOT_APPLICABLE`과 `UNKNOWN`을 동일하게 처리하지 않는다. |
| LT-INV-010 | 상태 전이는 이전 상태, 평가 ID, 사유, Actor, 정책 버전을 기록한다. |
| LT-INV-011 | Long-term Engine은 주문을 생성하거나 Momentum 내부 모듈을 import하지 않는다. |
| LT-INV-012 | Decimal 값은 Binary Floating Point로 금액 계산하지 않는다. |
| LT-INV-013 | 모델 버전 변경은 과거 평가를 덮어쓰지 않는다. |
| LT-INV-014 | Thesis `BROKEN`은 가격 상승·하락과 무관하게 확대 행동을 차단한다. |
| LT-INV-015 | 승격은 한 단계씩 진행하며 최소 관찰 기간과 증거 Gate를 통과한다. |

---

## 4. 시스템 경계와 구성요소

```text
Data Providers
  ├─ Market Data
  ├─ Financial Statements
  ├─ Filings / Earnings
  ├─ Industry / Competitor Data
  └─ Manual Research
          │
          ▼
Snapshot & Evidence Layer
          │
          ▼
Long-term Orchestrator
  ├─ Eligibility Gate
  ├─ Industry Profile Resolver
  ├─ Metric Normalizer
  ├─ Fundamental Analyzer
  ├─ Valuation Analyzer
  ├─ Thesis Assessor
  ├─ Core Evaluator
  ├─ Future Core Evaluator
  ├─ Stage Transition Policy
  └─ Review Scheduler
          │
          ▼
Immutable Evaluation + Outbox
          │
          ├─ Ranking Read Model
          ├─ Portfolio Engine
          ├─ Report Engine
          └─ Human Review UI
```

### 4.1 패키지 경계

목표 구현 구조는 다음과 같다.

```text
packages/core/src/long-term/
├── types.ts
├── factor-registry.ts
├── industry-profile.ts
├── eligibility.ts
├── metric-normalization.ts
├── core-profile.ts
├── future-core-profile.ts
├── confidence.ts
├── valuation.ts
├── thesis-assessment.ts
├── stage-policy.ts
├── action-policy.ts
├── review-policy.ts
├── explainability.ts
└── index.ts

apps/api/src/long-term/
├── routes.ts
├── schemas.ts
├── service.ts
└── repository.ts
```

`packages/core`는 네트워크, DB, 현재 시간에 직접 의존하지 않는다. 시간과 데이터는 입력으로 주입한다. `apps/api`는 인증, 멱등성, 저장, Transactional Outbox, HTTP 오류 변환을 담당한다.

### 4.2 의존성 규칙

허용:

```text
Long-term → shared contracts / scoring primitives / evidence / thesis
Portfolio → Long-term public output
Report → Long-term public output
Risk → Long-term public output
```

금지:

```text
Long-term → Momentum internals
Long-term → Portfolio internals
Long-term → Broker / Order adapter
Long-term pure domain → HTTP / Supabase client
```

---

## 5. 평가 실행 흐름

### 5.1 전체 파이프라인

```text
1. Request Accepted
2. Idempotency Checked
3. Company Identity Resolved
4. Point-in-time Snapshot Frozen
5. Evidence Set Validated
6. Industry Profile Resolved
7. Data Quality & Eligibility Gates Evaluated
8. Metrics Derived
9. Factor Scores Calculated
10. Core / Future Core Profile Evaluated
11. Confidence & Uncertainty Calculated
12. Thesis Compared With Prior Revision
13. Stage / Action Candidate Proposed
14. Immutable Evaluation Stored
15. Outbox Events Stored In Same Transaction
16. Ranking Read Model Updated Asynchronously
```

단계 4~13은 동일한 입력에 대해 결정론적이어야 한다. 14~15 중 하나만 성공하는 상태를 허용하지 않는다.

### 5.2 평가 모드

```ts
type LongTermEvaluationMode =
  | 'INITIAL_SCREEN'
  | 'FULL_REVIEW'
  | 'SCHEDULED_REFRESH'
  | 'EARNINGS_REVIEW'
  | 'EVENT_REVIEW'
  | 'DRAWDOWN_REVIEW'
  | 'HISTORICAL_REPLAY';
```

| 모드 | 목적 | 허용 출력 |
|---|---|---|
| INITIAL_SCREEN | Universe를 Watch 후보로 좁힘 | `UNIVERSE`, `WATCH` 또는 Gate 차단 결과 |
| FULL_REVIEW | 전 Factor·가치평가·Thesis 평가 | 모든 제안, 단 Gate 적용 |
| SCHEDULED_REFRESH | 데이터 신선도와 점수 변화 확인 | 유지·리뷰 예약·강등 후보 |
| EARNINGS_REVIEW | 실적 후 핵심 가정 재검증 | Thesis 상태·행동·단계 제안 |
| EVENT_REVIEW | 규제, 제품, 경영진, 회계 사건 반영 | Hard Risk 우선 |
| DRAWDOWN_REVIEW | 가격 하락 원인 분류 | 자동 매도 없이 검토 결과 |
| HISTORICAL_REPLAY | 당시 정보만으로 재현 | 운영 상태 변경 금지 |

`INITIAL_SCREEN` 결과만으로 `CANDIDATE` 이상 승격하거나 투자 확대 행동을 생성할 수 없다.

### 5.3 실행 원자성

다음 데이터는 하나의 트랜잭션으로 저장한다.

- Evaluation
- Factor Results
- Gate Results
- Thesis Assessment
- Stage Transition Proposal 또는 확정 기록
- Review Schedule
- Audit Log
- Outbox Event

외부 보고서 생성 실패는 Evaluation 트랜잭션을 롤백하지 않는다. `ReportGenerationRequested` Event를 재처리한다.

---

## 6. 입력 계약과 Point-in-time

### 6.1 최상위 입력

```ts
interface LongTermEvaluationRequest {
  requestId: string;
  correlationId: string;
  companyId: string;
  securityId: string;
  profile: 'CORE' | 'FUTURE_CORE' | 'BOTH';
  mode: LongTermEvaluationMode;
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  modelVersionId: string;
  philosophyVersionId: string;
  industryProfileVersionId: string;
  snapshotIds: string[];
  evidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  previousEvaluationId?: string;
  activeThesisId?: string;
  requestedBy: { type: 'USER' | 'SYSTEM' | 'JOB'; id: string };
}
```

API 입력은 임의의 Factor 점수를 직접 받지 않는다. 운영 평가에서는 Snapshot과 Evidence로부터 계산한다. 테스트와 Preview 전용 함수만 구조화된 Metric 입력을 허용한다.

### 6.2 Snapshot 필수 범주

Full Review의 입력 Manifest에는 다음 범주를 모두 확인한 결과가 필요하다. 모든 범주의 값이 항상 존재해야 한다는 뜻은 아니다. Industry Profile이 필수로 지정한 값은 `AVAILABLE/PARTIAL`이어야 하며, 나머지는 값이 없더라도 `NOT_APPLICABLE/UNKNOWN`과 사유를 명시한다.

| 범주 | 예시 | 기본 최신성 |
|---|---|---|
| Identity | 법인, 상장 증권, 통화, 주식수 | 변경 시 즉시 |
| Market | 종가, 시가총액, 기업가치 | 거래일 1일 |
| Financial | 손익·재무상태·현금흐름 | 최근 공시 + 공시일 |
| Estimates | 매출·이익·FCF Consensus | 7일 |
| Guidance | 회사 Guidance | 최신 실적 발표 |
| Operating | 고객, 사용량, 생산능력, 계약 | 산업 Profile별 |
| Industry | TAM, 점유율, 수급, 경쟁 | 90일 또는 사건 발생 시 |
| Governance | 임원, 보상, 주식수, 내부자 | 최신 공시 |
| Thesis | 활성 Thesis와 이전 Revision | 항상 최신 승인본 |

최신성은 단순 `periodEnd`가 아니라 시장에 공개된 `availableAt`으로 판정한다. 2026-03-31 분기 데이터가 2026-05-01 공개됐다면 4월 Replay에서 사용할 수 없다.

### 6.3 Snapshot 시간 필드

```ts
interface PointInTimeSnapshotRef {
  snapshotId: string;
  sourceId: string;
  observedAt?: string;
  periodStart?: string;
  periodEnd?: string;
  availableAt: string;
  collectedAt: string;
  contentHash: string;
  complete: boolean;
  anomalyFlags: string[];
}
```

필수 검증:

- `availableAt <= evaluatedAt`
- `collectedAt`이 늦더라도 Historical Replay에서는 `availableAt` 기준을 지키고 원본 존재 여부 기록
- `contentHash`가 다른 수정 공시는 별도 Snapshot
- Restatement는 원 공시를 덮어쓰지 않음
- `complete=false` 또는 Critical anomaly가 있으면 관련 Gate 실패

### 6.4 데이터 정합성 우선순위

같은 지표가 다를 때 기본 우선순위:

1. 규제기관 제출 원문
2. 감사된 회사 공시
3. 회사 실적 자료
4. 신뢰 가능한 데이터 Provider
5. Consensus
6. 2차 분석 자료

상위 출처가 항상 자동 승리하는 것은 아니다. 단위, 회계 기준, 기간, Restatement 여부가 다르면 `CONFLICTED`로 분류하고 조정 근거를 남긴다.

---

## 7. 산업 Profile

### 7.1 목적

모든 산업에 SaaS 지표나 동일한 Margin 기준을 강제하지 않는다. Industry Profile은 다음을 버전 관리한다.

- 필수·선택·비적용 Metric
- Metric 정의와 단위
- 정상화 방식
- 성장성과 Cycle 구분
- Critical Gate
- 가치평가 방법과 가중치
- Factor 내 Metric 가중치
- 최신성 기준
- 업종 특유의 Hard Risk

### 7.2 계약

```ts
interface IndustryProfile {
  id: string;
  version: string;
  industryCode: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  applicableMetrics: MetricRule[];
  criticalMetrics: string[];
  valuationMethods: ValuationMethodRule[];
  hardRiskRules: GateRule[];
  benchmarkSetId?: string;
  minimumApplicableWeight: number;
  effectiveFrom: string;
}
```

기업이 복수 사업을 운영하면 매출 또는 가치 기여도 기준 Segment Profile을 적용한다. 단일 산업 코드로 억지 분류하지 않는다. Segment 데이터가 불충분하면 `CONGLOMERATE_UNRESOLVED` Confidence Cap을 적용한다.

### 7.3 v1 산업군

| Profile | 핵심 Metric | 특수 위험 | 주 가치평가 |
|---|---|---|---|
| SOFTWARE | NRR, GRR, CAC Payback, Gross Margin, RPO | 성장비용 자본화, SBC, 플랫폼 종속 | DCF, EV/Revenue, EV/FCF |
| SEMICONDUCTOR | Design Win, Yield, Wafer/Capacity, ASP, 재고 | Cycle, 고객 집중, 기술 전환 | Mid-cycle DCF, EV/EBITDA, P/E |
| INFRASTRUCTURE | 계약, 가동률, CapEx, 자금조달 비용 | 부채, 건설 지연, 거래상대방 | Project/Corporate DCF, EV/EBITDA |
| BIOTECH | 임상 단계, 성공 확률, 현금 Runway | 임상 실패, 규제, 단일 자산 | rNPV, Pipeline Sum-of-parts |
| CONSUMER_MARKETPLACE | Cohort, Frequency, Take Rate, Liquidity | 유행, CAC 상승, 양면시장 이탈 | DCF, GMV/Revenue 보조 |
| FINANCIAL_FINTECH | NIM/Take Rate, Credit Loss, CAC/LTV, 자본비율 | 규제, 신용, 유동성 | Residual Income, P/B, DCF |
| INDUSTRIAL_ROBOTICS | 수주, Backlog, 설치대수, Service Mix | Cycle, 공급망, 고객 CapEx | DCF, EV/EBITDA |
| ENERGY_POWER | 계약가격, 발전량, Reserve, CapEx | 원자재, 규제, 프로젝트 | NAV, DCF, EV/EBITDA |

미지원 산업은 Generic Profile로 자동 평가하지 않는다. `INDUSTRY_PROFILE_NOT_SUPPORTED`를 반환하고 Watch 단계의 정성 분석만 허용한다.

---

## 8. Metric과 Factor 공통 계약

### 8.1 Metric Result

```ts
interface MetricResult {
  metricId: string;
  definitionVersion: string;
  availability: MetricAvailability;
  rawValue?: string;
  normalizedValue?: number;
  unit?: string;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'RANGE_OPTIMAL';
  period?: string;
  asOf?: string;
  evidenceIds: string[];
  warnings: string[];
  explanation: string;
}
```

금액·비율의 원시 값은 Decimal String으로 전달한다. `normalizedValue`만 0~100 정수 또는 소수 Score로 표현할 수 있다.

### 8.2 Factor Result

```ts
interface FactorResult {
  factorId: string;
  score?: number;
  status: 'SCORED' | 'BLOCKED' | 'NOT_APPLICABLE';
  weight: number;
  applicableWeight: number;
  metricResults: MetricResult[];
  supportingEvidenceIds: string[];
  counterEvidenceIds: string[];
  confidence: EvaluationConfidence;
  trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNKNOWN';
  materialChanges: string[];
  explanation: string;
}
```

### 8.3 점수 범위와 반올림

- 모든 Factor와 Profile Score는 `[0, 100]`
- 내부 계산은 최소 Decimal 6자리 정밀도
- 저장은 소수 둘째 자리까지 허용
- 화면 표시는 소수 첫째 자리 또는 정수
- Gate 비교는 반올림 전 값 사용
- 같은 값의 순위는 Confidence, Valuation Upside, companyId 순으로 안정 정렬

### 8.4 가중치 재정규화

Profile 총점:

```text
ProfileScore
= Σ(FactorScore_i × ApplicableWeight_i)
 / Σ(ApplicableWeight_i)
```

단 다음 조건을 모두 만족해야 한다.

- N/A가 Industry Profile에서 사전 허용됨
- 적용 가능 가중치 합이 Profile의 `minimumApplicableWeight` 이상
- Critical Factor가 N/A가 아님
- N/A 사유와 Profile Version 기록

Core와 Future Core v1의 `minimumApplicableWeight`는 각각 `85`다. `UNKNOWN`, `STALE`, `CONFLICTED`는 N/A 재정규화 대상이 아니다.

### 8.5 점수 구간의 의미

| 구간 | 의미 |
|---|---|
| 90~100 | 예외적으로 강한 증거, 장기간 지속 여부 별도 검증 |
| 80~89.99 | 강함, 핵심 가정 대부분을 고품질 근거가 지지 |
| 70~79.99 | 양호, 일부 중요한 불확실성 존재 |
| 60~69.99 | 혼합, 후보 유지 가능하지만 승격 근거 부족 |
| 40~59.99 | 취약 또는 검증 부족 |
| 0~39.99 | 구조적 약점 또는 중대한 반대 근거 |

90점 이상은 자동으로 좋은 투자라는 뜻이 아니다. Valuation, Gate, Confidence, Thesis를 별도로 통과해야 한다.

---

## 9. Core Profile v1

### 9.1 목적

Core Profile은 이미 상당 부분 검증된 기업이 향후 5~15년간 높은 확률로 기업가치를 복리 성장시킬 수 있는지 평가한다.

### 9.2 Factor와 가중치

| Factor | ID | 가중치 | 핵심 질문 |
|---|---:|---:|---|
| Business Durability | `CORE_BUSINESS_DURABILITY` | 20 | 수요와 수익 모델이 장기간 지속되는가? |
| Moat Evidence | `CORE_MOAT` | 15 | 경쟁우위가 주장 아닌 결과로 검증되는가? |
| Growth Durability | `CORE_GROWTH_DURABILITY` | 15 | 성장 경로와 재투자 기회가 지속되는가? |
| Management & Capital Allocation | `CORE_MANAGEMENT_CAPITAL` | 10 | 경영진이 현금을 주당 가치 증가에 배분하는가? |
| Financial Strength & FCF | `CORE_FINANCIAL_FCF` | 15 | 불황 생존성과 FCF 창출이 검증됐는가? |
| Valuation & Expected Return | `CORE_VALUATION` | 15 | 보수적 가정에서도 기대수익이 충분한가? |
| Risk Resilience | `CORE_RISK_RESILIENCE` | 10 | 영구 손실 위험에 대한 완충 장치가 있는가? |
| 합계 |  | 100 |  |

### 9.3 Core Factor 세부 규칙

#### 9.3.1 Business Durability

평가 항목:

- 반복·재구매 매출의 질
- 고객 문제의 중요도와 사용 지속성
- 가격 결정력
- 매출총이익 안정성
- 자본 효율과 증분 ROIC
- 제품·지역·고객 다변화
- 경기 하강기 방어력

Critical 반대 근거:

- 일회성 매출을 반복 매출로 분류
- 매출 성장과 현금 회수의 지속적 괴리
- 주요 제품의 구조적 대체
- 가격 인상 후 사용량·유지율 급락

#### 9.3.2 Moat Evidence

Moat 유형별로 최소 하나의 결과 지표가 필요하다.

| Moat 주장 | 필요한 결과 예시 |
|---|---|
| Switching Cost | GRR/NRR, 교체 기간, 업무 통합 깊이 |
| Network Effect | 참여자 증가에 따른 유동성·매칭·가치 개선 |
| Scale | 단위비용 하락, 조달 우위, 경쟁사 대비 Margin |
| Data | 데이터 축적이 정확도·전환율·비용에 미친 효과 |
| Brand | 가격 프리미엄, 재구매, 신뢰 지표 |
| IP/Regulation | 보호 기간, 허가, 대체 경로 비용 |
| Ecosystem | 개발자·파트너·보완재 증가와 경제 기여 |
| Distribution | CAC, 채널 통제력, Organic Mix |

경영진 발언만 있으면 최대 50점, 단일 분기 결과만 있으면 최대 65점, 4개 분기 이상 일관된 결과와 반대 근거 검토가 있어야 80점 이상을 허용한다.

#### 9.3.3 Growth Durability

평가 항목:

- TAM → SAM → SOM의 검증 가능성
- 성장의 가격·물량·점유율 분해
- 신규 제품과 Cross-sell
- 증분 이익률
- 주당 기준 성장
- 성장 재투자 수익률
- Base/Bear Case 지속 기간

Acquisition과 FX를 제외한 Organic Growth를 분리한다. 희석을 제외한 매출 증가만으로 높은 점수를 줄 수 없다.

#### 9.3.4 Management & Capital Allocation

평가 항목:

- Guidance 신뢰도와 불리한 정보 공개
- 내부자 이해관계와 보상 구조
- R&D, CapEx, M&A의 사후 수익률
- 순자사주 매입과 주식수 변화
- 부채 만기와 조달 판단
- Empire Building과 잦은 전략 변경

최근 발언의 설득력보다 3~5년 실행 이력을 우선한다.

#### 9.3.5 Financial Strength & FCF

평가 항목:

- FCF Margin과 전환율
- 운전자본과 자본화 정책
- 순현금·순부채, 이자보상, 만기 분포
- Stress Case 유동성
- 주식보상·증자 반영 주당 FCF
- Off-balance-sheet 의무

회계상 이익이 높아도 FCF 전환의 구조적 설명이 없으면 80점 이상을 제한한다.

#### 9.3.6 Valuation & Expected Return

Valuation은 기업 품질과 별도 Factor다. 좋은 회사라는 이유로 가격을 무시하지 않는다.

필수 출력:

- Bear/Base/Bull 공정가치 범위
- 현재 가격이 암시하는 Reverse DCF 가정
- 5년 및 10년 기대수익 범위
- Fundamental Growth, Shareholder Yield, Multiple Change, Dilution 기여
- Margin of Safety 유형
- 민감도 상위 3개 변수

#### 9.3.7 Risk Resilience

다음을 종합한다.

- 기술 대체와 경쟁우위 침식
- 규제와 법률
- 고객·공급자 집중
- 회계·지배구조
- 부채·유동성
- 지정학·통화
- 핵심 인물 의존
- 가치평가 기대 과잉

위험이 존재하지 않는 기업을 찾는 것이 아니라 위험을 감당할 재무·사업·가격 완충 장치가 있는지 평가한다.

### 9.4 Core Eligibility Gate

Core 진입 또는 유지에는 다음 조건이 필요하다.

| Gate | 신규 Core | 기존 Core 유지 |
|---|---:|---:|
| Core Profile Score | `>= 78` | `>= 70` 또는 리뷰 |
| Confidence Score | `>= 75` | `>= 65` |
| Business Durability | `>= 75` | `>= 65` |
| Financial Strength & FCF | `>= 70` | `>= 60` |
| Risk Resilience | `>= 60` | `>= 50`, 미만이면 약화 |
| Thesis | 완전한 활성 Thesis | `BROKEN` 아님 |
| Valuation | Base 기대수익 양수, Bear 손실 감내 가능 | 극단 고평가 시 축소 검토 |
| Evidence 기간 | 원칙적으로 8개 분기 | 기존 이력 사용 가능 |
| Hard Risk | 0건 | 발생 시 즉시 리뷰 |

임계치는 v1 정책 기본값이며 Model Version에 저장한다. 점수만 통과했다고 Core가 되는 것은 아니며 Stage 최소 기간과 사용자 검토를 함께 통과해야 한다.

---

## 10. Future Core Profile v1

### 10.1 목적

Future Core Profile은 현재 완성된 Core가 아니라, 사업 증거가 강화될 때 Core로 발전할 수 있는 기업을 식별한다. 높은 성장률보다 **검증 속도와 생존 가능성**을 본다.

### 10.2 Factor와 가중치

| Factor | ID | 가중치 | 핵심 질문 |
|---|---:|---:|---|
| Market & Structural Growth | `FC_MARKET_GROWTH` | 20 | 시장이 실제 지불 수요와 구조적 성장으로 이어지는가? |
| Product & Customer Proof | `FC_PRODUCT_PROOF` | 15 | 제품 가치가 고객 행동과 매출로 검증되는가? |
| Moat Formation | `FC_MOAT_FORMATION` | 15 | 경쟁우위가 형성되고 강화되는 방향인가? |
| Unit Economics Trajectory | `FC_UNIT_ECONOMICS` | 15 | 규모가 커질수록 경제성이 개선되는가? |
| Management & Execution | `FC_MANAGEMENT_EXECUTION` | 10 | 경영진이 이정표를 일관되게 달성하는가? |
| Survival & Dilution | `FC_SURVIVAL_DILUTION` | 15 | 실패를 견딜 Runway와 합리적 희석 경로가 있는가? |
| Valuation & Asymmetry | `FC_VALUATION_ASYMMETRY` | 10 | 확률 가중 Upside가 Downside와 희석을 보상하는가? |
| 합계 |  | 100 |  |

### 10.3 Future Core Factor 세부 규칙

#### 10.3.1 Market & Structural Growth

TAM 숫자보다 다음을 요구한다.

- 실제 고객 예산과 구매 주체
- 도입을 유도하는 비용·시간·규제 요인
- SAM과 회사가 획득 가능한 SOM
- 공급 증가 시 경제적 이익 귀속
- 구조적 성장과 Cycle/유행 분리
- 시장 성장 없이도 가능한 점유율 시나리오

회사 자료의 TAM만 있으면 최대 50점이다. 독립 출처, 실제 매출, 고객 예산 증거가 결합돼야 70점 이상이다.

#### 10.3.2 Product & Customer Proof

평가 항목:

- 실제 사용량과 반복 구매
- Cohort 유지율
- 고객당 매출 증가
- Pilot → Production 전환
- 고객 집중과 다변화
- 가격 인하 없는 성장
- Reference Customer와 계약의 질

파트너십 발표, LOI, 비구속 MOU는 매출·사용 증거와 구분한다.

#### 10.3.3 Moat Formation

현재 Moat의 절대 수준과 함께 변화 방향을 본다.

- 제품 성능 격차 확대
- 데이터·설치 기반·생태계 누적
- 고객 Workflow 통합
- 공급망·인증·규제 진입장벽
- Scale에 따른 비용곡선 개선
- 경쟁사의 추격 속도

빠른 성장 자체는 Moat가 아니다.

#### 10.3.4 Unit Economics Trajectory

평가 항목:

- Gross Margin 방향
- Contribution Margin
- CAC Payback, LTV/CAC
- Incremental Margin
- Burn Multiple
- CapEx당 매출·현금흐름
- 주식보상 포함 인건비 경제성

현재 적자여도 개선 경로가 실적으로 검증되면 점수를 받을 수 있다. 단, 이익 전환이 매년 미래로 이동하면 `MILESTONE_SLIPPAGE`를 적용한다.

#### 10.3.5 Management & Execution

- 핵심 이정표 달성률
- Guidance 변경 이력
- 채용·제품·생산 실행
- 불리한 정보 공개 품질
- 창업자 집중 위험과 승계
- 관련자 거래·보상·희석

Founder의 비전은 증거가 아니라 가설이다. 실행 이력으로 전환돼야 점수에 반영한다.

#### 10.3.6 Survival & Dilution

필수 Stress Case:

- 매출 성장률 50% 감소
- Gross Margin 개선 4개 분기 지연
- 자금조달 비용 상승
- 최소 18개월 운영 자금 확보 여부
- 향후 24개월 예상 희석
- 전환사채·조건부 지급·부외 의무

현금 Runway가 12개월 미만이고 확정적 조달 수단이 없으면 `SURVIVAL_GATE_FAILED`다. 12~18개월이면 확대 행동과 Future Core 승격을 차단한다.

#### 10.3.7 Valuation & Asymmetry

초기 기업은 단일 DCF 정밀도를 가장하지 않는다.

- 성공 단계별 확률 가중 Scenario
- 실패·희석·추가 조달 포함 Downside
- Reverse DCF 또는 현재 가격의 시장 점유율 가정
- Milestone 달성 전후 가치 변화
- Exit Multiple 민감도

높은 Upside만 제시하고 실패 확률을 생략하면 평가를 완료할 수 없다.

### 10.4 Future Core Eligibility Gate

| Gate | Future Core 진입 | Strong Candidate |
|---|---:|---:|
| Future Core Profile Score | `>= 75` | `>= 68` |
| Confidence Score | `>= 65` | `>= 55` |
| Product & Customer Proof | `>= 65` | `>= 55` |
| Survival & Dilution | `>= 65` | `>= 55` |
| 현금 Runway | Stress 기준 18개월 이상 | Base 기준 18개월 이상 |
| 관찰 기간 | 최소 4개 분기 | 최소 2개 분기 |
| Thesis | Future Core Thesis 완비 | 초안 이상, Break 조건 필수 |
| Counter Evidence | 최소 2개 Material 항목 검토 | 최소 1개 |
| Hard Risk | 0건 | 0건 |

높은 점수라도 고객·생존 Gate를 통과하지 못하면 `WATCH` 또는 `CANDIDATE`에 머문다.

### 10.5 Future Core → Core 승격 Gate

승격은 분류명 변경이 아니라 새 `CoreProfile` 평가다.

필수 조건:

1. `FUTURE_CORE`에서 최소 4개 분기 관찰
2. Core Profile Score `>= 78`
3. Core Confidence `>= 75`
4. 반복 가능한 수요와 사업 모델 증거
5. FCF가 양수이거나 보수적 시나리오에서 8개 분기 내 전환 가능
6. 재무 생존성·희석 문제가 Core 수준으로 개선
7. 형성 중인 Moat가 결과 지표로 확인
8. Core용 Thesis Revision 작성
9. 반대 근거와 실패 시나리오 재평가
10. Human Review 완료

승격 후에도 기존 Future Core Evaluation과 Thesis는 보존한다.

---

## 11. 공통 Eligibility와 Hard Risk Gate

### 11.1 Gate 결과

```ts
interface GateResult {
  gateId: string;
  status: 'PASSED' | 'FAILED' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';
  severity: 'INFO' | 'SOFT' | 'HARD';
  reasonCode: string;
  evidenceIds: string[];
  explanation: string;
  blockedActions: LongTermAction[];
}
```

### 11.2 공통 Gate 목록

| Gate ID | 실패 조건 | 효과 |
|---|---|---|
| `IDENTITY_RESOLVED` | 법인·증권·통화 매핑 불명확 | 평가 차단 |
| `POINT_IN_TIME_VALID` | 미래 정보 또는 기준일 오류 | 평가 차단 |
| `DATA_QUALITY_SUFFICIENT` | Critical 누락·이상 미해결 | 평가 또는 확대 차단 |
| `EVIDENCE_BALANCED` | 점수 근거·반대 근거 부재 | Candidate 이상 차단 |
| `ACCOUNTING_TRUST` | 중대한 회계 신뢰 문제 | `REDUCE/EXIT` 리뷰 |
| `FINANCIAL_SURVIVAL` | Stress Case 생존 불가 | 확대·승격 차단 |
| `VALUATION_AVAILABLE` | 현재 가격·주식수·가치범위 불가 | 매수 행동 차단 |
| `THESIS_COMPLETE` | 핵심 가정·Break·Review 부재 | Candidate 이상 차단 |
| `INDUSTRY_PROFILE_VALID` | Profile 미지원·버전 불일치 | Full Review 차단 |
| `POLICY_VERSION_ACTIVE` | 비활성·충돌 정책 | 상태 변경 차단 |

### 11.3 Hard Risk

다음 사건은 총점과 무관하게 즉시 수동 검토를 생성한다.

- 감사의견 문제, 공시 철회, 중대한 Restatement
- 파산, 채무불이행, Going Concern
- 핵심 사업의 불법성 또는 영업 금지 가능성
- 현금·고객·계약의 진위 문제
- 경영진 사기·횡령·중대한 관련자 거래
- 핵심 제품의 안전 문제 또는 허가 취소
- Thesis Break 조건의 명백한 충족

Hard Risk 시 기본 행동은 무조건 `EXIT`가 아니라 `REVIEW_REQUIRED`다. 다만 `ACCUMULATE`, `BUY_ON_WEAKNESS`와 모든 승격은 즉시 금지한다.

---

## 12. 가치평가 Engine 계약

### 12.1 가치평가 원칙

가치평가는 단일 목표가가 아니라 가정과 범위를 출력한다.

```ts
type ValuationMethod =
  | 'DCF'
  | 'REVERSE_DCF'
  | 'RELATIVE_MULTIPLE'
  | 'SUM_OF_PARTS'
  | 'RESIDUAL_INCOME'
  | 'RISK_ADJUSTED_NPV'
  | 'NAV';
```

Industry Profile은 최소 두 방법을 지정한다. 하나는 절대 가치 또는 현금흐름 기반이어야 하며, `RELATIVE_MULTIPLE`만으로 Full Review를 완료할 수 없다.

### 12.2 Scenario

```ts
interface ValuationScenario {
  name: 'BEAR' | 'BASE' | 'BULL';
  probability: number;
  assumptions: ValuationAssumption[];
  enterpriseValue: DecimalString;
  equityValue: DecimalString;
  valuePerShare: DecimalString;
  expectedAnnualReturn5y?: DecimalString;
  expectedAnnualReturn10y?: DecimalString;
  evidenceIds: string[];
}
```

확률 합은 1이어야 한다. 확률은 투자 성공 확률의 정밀한 예측이 아니라 Scenario 비교를 위한 명시적 가정이며 Version에 저장한다.

### 12.3 공통 계산

```text
Equity Value
= Enterprise Value
+ Cash
- Debt
- Preferred Claims
- Minority Interest
- Other Claims

Value Per Share
= Equity Value / Fully Diluted Shares
```

주식수에는 옵션, RSU, 전환증권, 조건부 대가를 합리적으로 반영한다. Future Core는 향후 자금조달 희석 Scenario를 별도로 계산한다.

장기 기대수익 분해:

```text
Expected Return
≈ Fundamental Per-share Growth
+ Net Shareholder Yield
+ Valuation Re-rating
- Dilution
- Probability-weighted Permanent Impairment
```

### 12.4 Reverse DCF

Reverse DCF는 현재 가격을 정당화하려면 필요한 다음 가정을 출력한다.

- 매출 성장률과 지속 기간
- 목표 Margin
- 재투자율과 ROIC
- Terminal Growth
- Discount Rate
- 희석

시스템은 Base Forecast와 Implied Forecast의 차이를 `expectationGap`으로 제공한다. 큰 차이는 자동 매도 신호가 아니라 Valuation Confidence와 행동 정책의 입력이다.

### 12.5 Margin of Safety

Margin of Safety는 다음 네 종류로 태그한다.

```ts
type MarginOfSafetyType =
  | 'PRICE'
  | 'BUSINESS_QUALITY'
  | 'FINANCIAL_STRENGTH'
  | 'POSITION_SIZE';
```

Long-term Engine은 앞의 세 항목을 평가한다. `POSITION_SIZE`는 Portfolio Engine 소유이므로 필요 조건만 전달한다.

### 12.6 가치평가 데이터 오류

다음 경우 매수 관련 Action을 차단한다.

- Market Price Stale
- Fully Diluted Share Count 부재
- 통화 또는 FX 기준일 불일치
- Enterprise Value 조정 항목 미확인
- Scenario가 하나뿐임
- Bear Case 또는 희석 분석 부재

---

## 13. Confidence와 불확실성

### 13.1 Confidence는 점수와 분리한다

높은 Score와 낮은 Confidence는 높은 확신이 아니다. Profile Score에 Confidence를 곱해 하나의 숫자로 숨기지 않는다.

기존 `EvaluationConfidence` 계약을 유지한다.

```ts
interface EvaluationConfidence {
  score: number;
  evidenceCoverage: number;
  sourceQuality: number;
  modelFit: number;
  disagreement: number;
}
```

`disagreement`는 높을수록 출처·모델 간 불일치가 크다.

### 13.2 v1 공식

```text
Confidence Score
= 0.35 × Evidence Coverage
+ 0.25 × Source Quality
+ 0.25 × Model Fit
+ 0.15 × (100 - Disagreement)
```

| 등급 | Score | 의미 |
|---|---:|---|
| HIGH | 80 이상 | 핵심 지표 대부분이 고품질 복수 근거로 검증 |
| MEDIUM | 65~79.99 | 의사결정 가능하나 중요 불확실성 존재 |
| LOW | 50~64.99 | Watch·추가 조사 중심 |
| INSUFFICIENT | 50 미만 | 확대·승격 차단 |

### 13.3 Confidence Cap

| 조건 | 최대 Confidence |
|---|---:|
| Counter Evidence 없음 | 49 |
| Critical Metric `UNKNOWN` | 49 |
| 회사 자료만으로 주요 Factor 산정 | 59 |
| 2개 분기 미만 운영 이력 | 59 |
| 복합기업 Segment 미분리 | 64 |
| 주요 출처 `CONFLICTED` | 49 |
| Model Fit 검증되지 않은 새 Industry Profile | 59 |

Cap은 평균 계산 후 적용한다.

### 13.4 불확실성 범위

Profile Score는 다음을 함께 출력한다.

```ts
interface ScoreRange {
  point: number;
  low: number;
  high: number;
  sensitivityDrivers: string[];
}
```

Low/High는 Confidence만으로 기계 생성하지 않는다. Material Metric의 Bear/Base/Bull 입력을 재계산한 민감도 결과를 사용한다. Ranking에서는 구간이 겹치는 기업을 정밀 순위로 가장하지 않고 동일 Tier로 묶는다.

---

## 14. Evidence와 설명 가능성

### 14.1 주장 단위 연결

모든 Factor 설명은 다음 구조를 따른다.

```text
Claim
├─ Supporting Evidence
├─ Counter Evidence
├─ Interpretation
├─ Uncertainty
└─ Score Impact
```

Fact와 해석을 한 문장으로 합치지 않는다.

잘못된 예:

> NRR 125%이므로 강력한 Moat가 있다.

올바른 예:

- Fact: 최근 공시 NRR은 125%다.
- Interpretation: 기존 고객 확장이 관찰된다.
- Counter Evidence: 신규 고객 CAC가 상승했다.
- Uncertainty: NRR 산식과 고객군 변화가 완전히 공개되지 않았다.
- Impact: Product Proof +8, Moat Formation +4, Confidence Cap 없음.

### 14.2 최소 Evidence 규칙

Candidate 이상:

- Factor마다 점수 반영 Evidence 1개 이상
- Profile 전체 Counter Evidence 1개 이상
- Thesis 핵심 가정마다 Evidence 연결

Future Core 이상:

- Material Factor마다 독립 출처 포함 2개 이상
- Material Counter Evidence 2개 이상 검토
- 최소 4개 분기 Timeline

Core:

- 핵심 Factor마다 다기간 Evidence
- 회계·재무·경쟁우위에 A 또는 B 등급 출처
- 최소 8개 분기 Timeline 원칙

### 14.3 Explanation Output

평가 결과는 최소 다음을 사람이 읽을 수 있게 제공한다.

1. 결론 한 문장
2. Score와 Confidence
3. 통과·실패 Gate
4. 강점 상위 3개
5. 위험 상위 3개
6. 이전 평가 이후 Material Change
7. Thesis 상태와 이유
8. 다음 확인 지표와 날짜
9. Action Candidate와 금지 조건
10. 사용한 Snapshot·모델 버전

---

## 15. Thesis Lifecycle

### 15.1 Thesis 생성 조건

`CANDIDATE` 진입 전 다음이 필요하다.

- 1~7개의 핵심 가정
- Long-term Return Source
- 관찰 가능한 Metric
- Catalyst와 Milestone
- Risk와 Counter Evidence
- Thesis Break 조건
- Bear/Base/Bull 가치범위
- Review Schedule
- Snapshot과 Model Version

기존 `LongTermThesis` 계약을 기준으로 하며 수정은 새 Revision을 만든다.

### 15.2 상태 판정

```ts
type ThesisStatus =
  | 'STRENGTHENED'
  | 'UNCHANGED'
  | 'WEAKENED'
  | 'BROKEN'
  | 'REPLACED';
```

| 상태 | 판정 기준 | 기본 효과 |
|---|---|---|
| STRENGTHENED | 중요 가정이 새 고품질 근거로 강화 | 확대 검토 가능 |
| UNCHANGED | Material 가정 변화 없음 | 기존 정책 유지 |
| WEAKENED | 중요 가정 일부가 Mixed/Unsupported | 확대 중단, 리뷰 강화 |
| BROKEN | Critical Break 충족 또는 수익 원천 붕괴 | 확대 금지, 축소/청산 리뷰 |
| REPLACED | 사업 변화로 새 Thesis가 필요 | 기존 원본 보존, 재승인 |

주가 하락·상승만으로 Thesis 상태를 바꾸지 않는다.

### 15.3 가정 판정

각 가정은 다음 상태를 가진다.

```ts
type AssumptionStatus =
  | 'SUPPORTED'
  | 'MIXED'
  | 'UNSUPPORTED'
  | 'NOT_TESTED';
```

Critical 가정 하나가 `UNSUPPORTED`여도 자동 `BROKEN`은 아니다. 사전에 정의한 Break 조건이 충족됐는지 평가한다. 단, 회계 신뢰·생존·사업 적법성 조건은 Hard Break로 설정할 수 있다.

### 15.4 Thesis Diff

Revision은 다음 Diff를 저장한다.

- 변경된 가정과 변경 전후 상태
- 추가·제거된 Evidence
- 가치 범위 변경
- Break 조건 변경
- 예상 기간 변경
- 변경 사유
- 변경 제안자와 승인자
- 이전 Thesis ID

성과가 나빠진 뒤 Break 조건을 완화하는 행위는 `THESIS_DRIFT` Audit Flag를 발생시킨다.

### 15.5 Thesis Review 주기

| 단계 | 정기 리뷰 | 사건 리뷰 |
|---|---|---|
| WATCH | 분기 또는 데이터 업데이트 | 선택 |
| CANDIDATE | 월간 | 실적·중대 뉴스 |
| STRONG_CANDIDATE | 월간 + 분기 Full | 필수 |
| FUTURE_CORE | 월간 모니터 + 분기 Full | 필수 |
| CORE | 주간 모니터 + 분기 Full | 필수 |
| WEAKENED | 해소까지 주간 | 모든 Material Event |

주간 Core 모니터는 매주 전체 점수를 새로 만드는 것이 아니라 Data Freshness, Break 조건, 사건 여부를 검사한다.

---

## 16. Candidate Stage와 상태 전이

### 16.1 상태

```text
UNIVERSE
  → WATCH
  → CANDIDATE
  → STRONG_CANDIDATE
  → FUTURE_CORE
  → CORE

Any Active State → WEAKENED → WATCH or REMOVED
Any Non-archived State → REMOVED → ARCHIVED
```

`ARCHIVED`는 Terminal이다. 재검토하려면 새 Candidate Aggregate를 만든다.

### 16.2 단계별 최소 요구

| 단계 | 최소 요구 |
|---|---|
| UNIVERSE | 기업 Identity, 산업 가설, 최소 Snapshot |
| WATCH | 실제 제품·고객, Industry Profile, 초기 Evidence |
| CANDIDATE | Full Review, Thesis, 가치범위, Counter Evidence |
| STRONG_CANDIDATE | 2개 분기 이상 증거, Score·Confidence Gate |
| FUTURE_CORE | 4개 분기, 반복 성장, 생존·희석 Gate, Human Review |
| CORE | Core Profile과 승격 Gate, 8개 분기 원칙, Human Review |
| WEAKENED | Material 약화 사유, 확대 금지, 해소 조건 |
| REMOVED | 제거 사유와 재진입 조건 |
| ARCHIVED | 보존 목적, 새 상태 전이 금지 |

### 16.3 전이 계약

```ts
interface LongTermStageTransition {
  id: string;
  companyId: string;
  from: LongTermCandidateState;
  to: LongTermCandidateState;
  evaluationId: string;
  thesisId?: string;
  reasonCode: string;
  rationale: string;
  evidenceIds: string[];
  policyVersionId: string;
  proposedAt: string;
  proposedBy: ActorRef;
  approvedAt?: string;
  approvedBy?: ActorRef;
}
```

`FUTURE_CORE`, `CORE`, `REMOVED`, `ARCHIVED` 전이는 Human Review가 필요하다. Hard Risk로 `WEAKENED`를 생성하는 것은 자동화할 수 있지만, 거래 행동은 별도 승인이다.

### 16.4 강등 규칙

| 조건 | 제안 상태 |
|---|---|
| Score가 유지 기준 미달 1회, Thesis 유지 | 현 상태 + Review |
| 유지 기준 미달 2회 연속 또는 2개 Material Factor 악화 | WEAKENED |
| Thesis WEAKENED | WEAKENED 또는 현 상태 + 확대 금지 |
| Thesis BROKEN | WEAKENED + EXIT Review |
| 생존 Gate 실패 | WEAKENED 또는 REMOVED Review |
| 데이터만 Stale | 상태 유지, 행동 차단, 긴급 Refresh |
| 모델 변경으로만 Score 하락 | 상태 자동 변경 금지, Parallel Review |

가격 하락만으로 강등하지 않는다.

### 16.5 Hysteresis

임계치 부근의 잦은 승강을 막는다.

- 승격 임계치는 유지 임계치보다 높다.
- 승격은 연속 평가 또는 최소 관찰 기간을 요구한다.
- 단일 비중요 Factor 변화로 단계 변경 금지
- Model Version 변경 직후 자동 승격·강등 금지
- `WEAKENED → WATCH` 복귀는 약화 원인 해소 Evidence 필요

---

## 17. Action Candidate 정책

### 17.1 행동 정의

```ts
type LongTermAction =
  | 'ACCUMULATE'
  | 'BUY_ON_WEAKNESS'
  | 'HOLD'
  | 'WATCH'
  | 'REDUCE'
  | 'EXIT'
  | 'REVIEW_REQUIRED';
```

| 행동 | 의미 |
|---|---|
| ACCUMULATE | 현재 가치와 Thesis가 추가 배분 검토에 적합 |
| BUY_ON_WEAKNESS | Thesis 유지, 사전 정의 가격 조건에서 재평가 |
| HOLD | 사업·가치·Thesis가 유지되나 신규 배분 우선순위 낮음 |
| WATCH | 정보·가격·증거가 부족해 관찰 |
| REDUCE | Thesis 약화, 극단 고평가, 위험 증가로 축소 검토 |
| EXIT | Thesis Break 또는 영구 손실 위험으로 청산 검토 |
| REVIEW_REQUIRED | 자동 결론 불가, 사람 검토 필요 |

### 17.2 의사결정 표

| Thesis | Valuation | Gate | 기본 행동 |
|---|---|---|---|
| STRENGTHENED | ATTRACTIVE | PASS | ACCUMULATE 검토 |
| UNCHANGED | ATTRACTIVE | PASS | ACCUMULATE 또는 BUY_ON_WEAKNESS |
| UNCHANGED | FAIR | PASS | HOLD |
| UNCHANGED | EXPENSIVE | PASS | HOLD / 신규매수 중단 |
| UNCHANGED | EXTREME | PASS | REDUCE 검토 |
| WEAKENED | 무관 | PASS/SOFT | WATCH 또는 REDUCE, 확대 금지 |
| BROKEN | 무관 | 무관 | EXIT Review |
| 무관 | 무관 | HARD FAIL | REVIEW_REQUIRED, 확대 금지 |
| 무관 | UNKNOWN | 무관 | WATCH, 매수 행동 금지 |

### 17.3 추가매수 불변식

`ACCUMULATE` 또는 `BUY_ON_WEAKNESS`에 필요한 조건:

- Thesis가 `STRENGTHENED` 또는 `UNCHANGED`
- Critical Gate 모두 통과
- Confidence가 단계 최소치 이상
- Valuation이 `ATTRACTIVE` 또는 사전 가격 조건 존재
- 데이터가 최신
- Counter Evidence 검토 완료
- Portfolio/Risk 검토가 필요하다는 표시

평단 하락, 손실 회복 욕구, 가격 하락 자체는 조건이 아니다.

### 17.4 기회비용

Long-term Engine은 동일 Profile 내 후보를 다음 정보로 비교한다.

- 기대수익 범위
- Confidence
- 영구 손실 위험
- Thesis 상태
- Score Range

작은 점수 차이를 매매 신호로 사용하지 않는다. 기본 Tier:

- `TIER_A`: Gate 통과, 높은 기대수익·Confidence
- `TIER_B`: 투자 가능, 일부 불확실성
- `TIER_C`: Watch 또는 가격 대기
- `TIER_D`: 약화·차단

세금, 거래비용, 집중도, 실제 비중을 포함한 최종 기회비용은 Portfolio Engine이 계산한다.

---

## 18. Drawdown과 Event Review

### 18.1 Drawdown은 Trigger다

가격 하락은 자동 매도 또는 매수 신호가 아니다.

```text
Drawdown Detected
  → Market-wide vs Company-specific Classification
  → Data Freshness Check
  → Filing / News / Price-volume Anomaly Review
  → Thesis Assumption Review
  → Valuation Refresh
  → Action Candidate
```

### 18.2 기본 Trigger

| Trigger | Lookback | 처리 |
|---|---:|---|
| -15% | 20 거래일 | Light Review |
| -25% | 60 거래일 | Full Drawdown Review |
| -35% | 고점 대비 | Full Review + Human Notification |
| 시장 대비 -15%p | 60 거래일 | Company-specific 원인 조사 |

이 값은 주문 Stop이 아니다. Industry Volatility Profile에 따라 조정하고 버전 관리한다.

### 18.3 Event Trigger

- Earnings/Guidance 발표
- 8-K/주요 공시
- 감사인·CFO·CEO 변경
- 대규모 자금조달·M&A
- 주요 고객 계약 취소
- 제품 리콜·규제 결정
- 경쟁사의 구조적 가격 인하
- 신용등급·부채 Covenant 변화
- 주식수 급증
- Thesis Milestone 도래 또는 지연

중복 Event는 `companyId + eventType + sourceEventId`로 멱등 처리한다.

---

## 19. 최종 출력 계약

```ts
interface LongTermEvaluationResult {
  id: string;
  companyId: string;
  securityId: string;
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  mode: LongTermEvaluationMode;
  modelVersionId: string;
  philosophyVersionId: string;
  industryProfileVersionId: string;
  snapshotIds: string[];

  profiles: {
    core?: ProfileEvaluation;
    futureCore?: ProfileEvaluation;
  };

  primaryProfile: 'CORE' | 'FUTURE_CORE' | 'NONE';
  stageBefore: LongTermCandidateState;
  proposedStage: LongTermCandidateState;
  action: LongTermAction;
  actionConstraints: string[];

  thesisId?: string;
  thesisStatus?: ThesisStatus;
  thesisAssessment: ThesisAssessment;

  gateResults: GateResult[];
  valuation: ValuationResult;
  confidence: EvaluationConfidence;
  permanentImpairmentRisk: number;
  riskScoreDirection: 'HIGHER_IS_RISKIER';

  supportingEvidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  materialChanges: MaterialChange[];
  nextReviewAt: string;
  reviewTriggers: string[];
  explanation: EvaluationExplanation;
}
```

### 19.1 Profile Evaluation

```ts
interface ProfileEvaluation {
  profile: 'CORE' | 'FUTURE_CORE';
  score: ScoreRange;
  factorResults: FactorResult[];
  eligibility: 'ELIGIBLE' | 'INELIGIBLE' | 'REVIEW_REQUIRED';
  confidence: EvaluationConfidence;
  rankingTier: 'A' | 'B' | 'C' | 'D';
}
```

`primaryProfile`은 더 높은 점수를 고르는 필드가 아니다. 현재 Stage와 통과한 Eligibility를 기준으로 한다.

### 19.2 기존 계약 호환

`LongTermEvaluationRecord`의 다음 필드는 유지 가능하다.

- `coreScore`, `futureCoreScore`
- `businessQualityScore`
- `valuationScore`
- `financialStrengthScore`
- `growthDurabilityScore`
- `stage`, `action`, `thesisStatus`
- Evidence와 Confidence

단 다음 보완이 필요하다.

- `profileResults` JSON 또는 정규화 Factor Table
- `gateResults`
- `primaryProfile`
- `industryProfileVersionId`, `philosophyVersionId`
- `permanentImpairmentRisk`, `riskScoreDirection`
- `nextReviewAt`, `reviewTriggers`
- `stageBefore`, `proposedStage`

Legacy `businessQualityScore`는 Core/Future Core의 서로 다른 Factor를 요약한 호환 필드이므로 세부 판단에 사용하지 않는다.

---

## 20. API 설계

### 20.1 엔드포인트

```text
POST /api/v1/long-term/evaluations
GET  /api/v1/long-term/evaluations/:id
GET  /api/v1/companies/:companyId/long-term
GET  /api/v1/long-term/rankings?profile=CORE
GET  /api/v1/long-term/rankings?profile=FUTURE_CORE
POST /api/v1/long-term/theses
POST /api/v1/long-term/theses/:id/revisions
POST /api/v1/long-term/theses/:id/reviews
POST /api/v1/long-term/stage-transitions/:id/approve
GET  /api/v1/long-term/reviews/due
POST /api/v1/long-term/replays
```

상태 변경 POST는 `Idempotency-Key`가 필수다.

### 20.2 평가 요청

```json
{
  "companyId": "uuid",
  "securityId": "uuid",
  "profile": "BOTH",
  "mode": "FULL_REVIEW",
  "evaluatedAt": "2026-07-22T09:00:00Z",
  "dataAsOf": "2026-07-21T20:00:00Z",
  "marketPriceAsOf": "2026-07-21T20:00:00Z",
  "modelVersionId": "uuid",
  "philosophyVersionId": "uuid",
  "industryProfileVersionId": "uuid",
  "snapshotIds": ["uuid"],
  "evidenceIds": ["uuid"],
  "scoringEvidenceIds": ["uuid"],
  "counterEvidenceIds": ["uuid"],
  "activeThesisId": "uuid"
}
```

응답은 비동기 Full Review면 `202 Accepted`와 `jobId`, 동기 Preview/조회면 `200 OK`를 사용한다. 동일 멱등 키와 동일 Body는 같은 결과를 반환한다. 같은 키에 다른 Body면 `409 IDEMPOTENCY_CONFLICT`다.

### 20.3 오류 코드

| HTTP | Code | 의미 |
|---:|---|---|
| 400 | `INVALID_EVALUATION_REQUEST` | Schema 또는 날짜 오류 |
| 409 | `IDEMPOTENCY_CONFLICT` | 같은 키의 다른 요청 |
| 409 | `POLICY_VERSION_CONFLICT` | 활성 정책과 요청 버전 충돌 |
| 422 | `POINT_IN_TIME_VIOLATION` | 미래 정보 혼입 |
| 422 | `INSUFFICIENT_EVIDENCE` | 최소 근거 미달 |
| 422 | `INDUSTRY_PROFILE_NOT_SUPPORTED` | 평가 Profile 부재 |
| 422 | `VALUATION_INPUT_INCOMPLETE` | 가치평가 Critical 입력 누락 |
| 423 | `HARD_RISK_REVIEW_REQUIRED` | 자동 상태 변경 잠금 |
| 404 | `EVALUATION_NOT_FOUND` | 평가 없음 |
| 500 | `LONG_TERM_EVALUATION_FAILED` | 재시도 가능한 내부 실패 |

오류 응답은 `requestId`, `correlationId`, `retryable`, 실패 Component를 포함한다.

### 20.4 조회와 Ranking

- Cursor Pagination 사용
- 기본적으로 최신 완료 Evaluation만 노출
- `asOf`, `modelVersionId`, `industryProfileVersionId` 필터 제공
- 서로 다른 Model Version 점수를 한 Ranking에 혼합하지 않음
- Score Range가 겹치면 동일 Tier 표시
- Gate 실패 기업은 점수가 높아도 상단 투자 가능 Ranking에서 제외

---

## 21. 저장 모델

### 21.1 신규 Migration

구현 시 `004_long_term_engine_v1.sql`을 추가한다. 기존 Migration을 수정하지 않는다.

### 21.2 권장 Table

```text
long_term_evaluations
long_term_profile_results
long_term_factor_results
long_term_metric_results
long_term_gate_results
long_term_stage_transitions
long_term_review_schedules
long_term_material_changes
industry_profiles
industry_metric_rules
valuation_results
valuation_scenarios
```

기존 `evaluations`를 공통 Header로 유지하고 Long-term 전용 세부 Table을 1:1 또는 1:N으로 연결할 수 있다.

### 21.3 핵심 Column

`long_term_evaluations`:

```text
evaluation_id uuid PK/FK
user_id uuid
company_id uuid
security_id uuid
mode text
primary_profile text
stage_before text
proposed_stage text
action text
action_constraints text[]
thesis_id uuid nullable
thesis_status text nullable
philosophy_version_id uuid
industry_profile_version_id uuid
permanent_impairment_risk numeric(5,2)
next_review_at timestamptz
review_triggers text[]
explanation jsonb
created_at timestamptz
```

`long_term_factor_results`:

```text
id uuid PK
evaluation_id uuid FK
profile text
factor_id text
score numeric(5,2) nullable
status text
weight numeric(7,4)
applicable_weight numeric(7,4)
trend text
confidence jsonb
explanation text
supporting_evidence_ids uuid[]
counter_evidence_ids uuid[]
```

### 21.4 제약과 인덱스

필수 제약:

- 모든 Score `[0,100]`
- `data_as_of <= evaluated_at`
- `market_price_as_of <= evaluated_at`
- 승격 Transition은 `from <> to`
- Revision 원본 수정 방지 Trigger
- 완료 Evaluation의 Model/Snapshot/Evidence 비어 있음 금지
- 프로필별 Factor ID Unique
- `ARCHIVED` 이후 Transition 금지

필수 인덱스:

- `(user_id, company_id, evaluated_at desc)`
- `(user_id, primary_profile, evaluated_at desc)`
- `(evaluation_id, profile, factor_id)` unique
- `(user_id, proposed_stage, next_review_at)`
- Due Review partial index
- Active Industry Profile partial unique index

### 21.5 RLS와 권한

- 사용자는 자신의 평가와 Thesis만 조회
- Engine Service Role만 Evaluation 결과 삽입
- 사용자는 Evidence와 Thesis 초안을 제출할 수 있으나 승인 상태 직접 변경 금지
- Stage 승인과 정책 활성화는 명시적 권한 필요
- Outbox와 Processed Event는 서버 전용

---

## 22. Job과 Event

### 22.1 Job 유형

```ts
type LongTermJobType =
  | 'LONG_TERM_INITIAL_SCREEN'
  | 'LONG_TERM_FULL_REVIEW'
  | 'LONG_TERM_EARNINGS_REVIEW'
  | 'LONG_TERM_EVENT_REVIEW'
  | 'LONG_TERM_DRAWDOWN_REVIEW'
  | 'LONG_TERM_RANKING_REFRESH'
  | 'LONG_TERM_HISTORICAL_REPLAY';
```

Job은 `correlationId`, `idempotencyKey`, `attempt`, 실패 Component와 재시도 가능 여부를 기록한다.

### 22.2 Event

```text
LongTermEvaluationRequested
LongTermEvaluationCompleted
LongTermEvaluationBlocked
LongTermThesisAssessed
LongTermThesisRevised
LongTermStageChangeProposed
LongTermStageChanged
LongTermReviewScheduled
LongTermHardRiskDetected
LongTermRankingRefreshRequested
```

### 22.3 Event Payload 최소 계약

모든 Event:

- `eventId`
- `eventType`
- `aggregateId`
- `occurredAt`
- `correlationId`
- `schemaVersion`
- `modelVersionId`
- `payload`

`LongTermEvaluationCompleted` Payload:

- evaluationId
- companyId
- primaryProfile
- stageBefore / proposedStage
- action
- coreScore / futureCoreScore
- confidenceScore
- thesisStatus
- hardRisk 여부
- nextReviewAt

Event에는 전체 Evidence 원문을 복제하지 않고 ID만 전달한다.

### 22.4 재시도와 중복

- Provider Timeout: 지수 Backoff, 최대 3회
- 결정론 계산 오류: 재시도하지 않고 실패 고정
- DB Deadlock: 제한 재시도
- Outbox 발행: At-least-once, Consumer 멱등
- 같은 Event ID 재수신: 처리 결과 재사용
- Partial Job: 성공 Component와 실패 Component 분리 기록

---

## 23. Fail-closed와 운영 예외

### 23.1 차단 우선 조건

다음 조건에서는 과거 점수를 그대로 사용해 확대 행동을 내지 않는다.

- Critical 데이터 Stale
- 시장가격 기준일 오류
- 모델 또는 정책 버전 비활성
- Industry Profile Resolution 실패
- Evidence 무결성 실패
- 계산 값 NaN/Infinity/범위 초과
- 통화 변환 기준일 부재
- Thesis Revision 충돌

조회 화면에는 마지막 정상 평가를 `STALE_RESULT`로 표시할 수 있지만 새로운 행동 근거로 사용할 수 없다.

### 23.2 부분 실패

예:

- Core Profile 성공, Future Core Profile 실패
- Fundamental 성공, Valuation 실패
- 평가 성공, Ranking 갱신 실패

처리:

- Profile 하나가 실패하면 `BOTH` 요청은 `PARTIAL`
- Valuation 실패 시 매수 행동 차단
- 저장된 성공 결과는 실패 Component와 함께 표시
- Stage 변경은 전체 필수 Component 성공 시에만 허용

### 23.3 수동 Override

점수나 Gate 값을 직접 덮어쓰는 Override는 금지한다. 사람은 다음만 할 수 있다.

- 오류 Evidence를 제외한 새 평가 요청
- Industry Profile 수정 제안
- Stage Transition 승인·거절
- Hard Risk Review 해소
- 새 Thesis Revision 작성

모든 조치는 Audit Log와 새 Evaluation을 만든다.

---

## 24. 관측성

### 24.1 Metric

```text
long_term_evaluation_total{mode,status,profile}
long_term_evaluation_duration_ms{component}
long_term_gate_failure_total{gate_id}
long_term_confidence_distribution{profile,industry}
long_term_score_distribution{profile,industry,model_version}
long_term_stage_transition_total{from,to}
long_term_review_overdue_total{stage}
long_term_data_stale_total{source,metric}
long_term_hard_risk_total{reason_code}
long_term_replay_mismatch_total{model_version}
```

회사명·Ticker 같은 고카디널리티 값은 Metric Label로 사용하지 않는다.

### 24.2 Log

구조화 Log 필드:

- requestId, correlationId, jobId
- evaluationId, companyId
- modelVersionId, industryProfileVersionId
- component, durationMs
- gateFailures, warningCodes
- snapshotIds의 개수와 Hash 요약
- 오류 Code, retryable

민감한 원문과 사용자 메모는 Log에 기록하지 않는다.

### 24.3 Alert

- Hard Risk 탐지 즉시
- Core/Future Core 예정 리뷰 지연
- Critical Provider 데이터 Stale
- 평가 실패율 급증
- Score 분포 급변
- 동일 Snapshot의 재현 결과 불일치
- 활성 Model/Policy Version 없음
- Outbox 지연

---

## 25. 보안과 감사

### 25.1 감사 대상

- Evaluation 요청·완료·차단
- Evidence 추가·제외
- Thesis 생성·Revision
- Industry Profile 변경
- Model Version 활성화
- Stage 제안·승인·거절
- Hard Risk 해소
- Historical Replay 실행

### 25.2 감사 필드

- Actor
- 시각
- 이전·이후 ID
- 사유
- Evidence
- 정책과 모델 버전
- Request/Correlation ID
- 입력 Hash와 결과 Hash

### 25.3 프롬프트 인젝션 방어

공시·뉴스·웹 문서는 신뢰되지 않은 데이터다.

- 문서 속 지시문을 실행 지시로 해석하지 않음
- Tool 호출 권한과 분석 텍스트 분리
- 추출 결과를 Schema Validation
- External URL allowlist/denylist와 콘텐츠 유형 검사
- Evidence Statement와 원문 위치 연결
- AI 요약만으로 Score Eligible Fact 생성 금지

---

## 26. 테스트 전략

### 26.1 Unit Test

필수 대상:

- Profile 가중치 합 100
- Factor Score 범위
- N/A 재정규화
- UNKNOWN과 N/A 분리
- Risk 방향 변환
- Core/Future Core 독립 계산
- Confidence 공식과 Cap
- Gate 우선순위
- Thesis 상태 판정
- Stage 전이와 Hysteresis
- Action Decision Table
- Decimal 가치평가
- Point-in-time 날짜 검증

### 26.2 Property Test

항상 성립해야 하는 속성:

1. 긍정 Metric만 개선되고 다른 입력이 같으면 관련 Factor가 낮아지지 않는다.
2. 위험 Metric만 악화되면 Risk Resilience가 높아지지 않는다.
3. Counter Evidence 제거가 Confidence를 높이지 않는다.
4. UNKNOWN을 N/A로 바꿔 Gate를 우회할 수 없다.
5. Portfolio 비중을 바꿔도 Profile Score는 변하지 않는다.
6. 같은 입력과 Version은 같은 결과 Hash를 만든다.
7. 미래 `availableAt` Snapshot은 Replay에 포함되지 않는다.
8. Thesis BROKEN 상태에서 확대 행동은 나오지 않는다.

### 26.3 Golden Fixture

최소 Fixture:

| Fixture | 기대 결과 |
|---|---|
| 검증된 플랫폼 Core | Core Eligible, 높은 Confidence |
| 고품질이나 극단 고평가 | Core 품질 높음, HOLD/REDUCE 검토 |
| 초기 고성장·18개월 미만 Runway | Future Core Score 가능, 승격·확대 차단 |
| 큰 TAM·고객 증거 없음 | WATCH, Market 점수 Cap |
| 반도체 Cycle Peak | Mid-cycle 정상화로 과대평가 방지 |
| 바이오 단일 자산 | rNPV, 성공 확률·Runway Gate |
| 회계 Restatement | Hard Risk, REVIEW_REQUIRED |
| Thesis Broken | EXIT Review |
| 데이터 Stale | 이전 결과 표시 가능, 새 행동 차단 |
| 복합기업 Segment 부재 | Confidence Cap |

실제 회사명을 Fixture ID에 넣지 않아도 되며 입력과 기대 결과를 코드 리뷰 가능한 JSON으로 보존한다.

### 26.4 Integration Test

- API → Job → Core 계산 → DB → Outbox
- 동일 Idempotency-Key 재호출
- RLS 사용자 격리
- Evaluation과 Outbox 원자성
- Thesis Revision 불변성
- Stage 승인 권한
- Partial Job 복구
- Ranking Model Version 분리

### 26.5 Historical Replay

Replay는 다음을 보장한다.

- 당시 `availableAt` 이전 자료만 사용
- 생존 편향을 줄이기 위해 상장폐지·합병 기업 포함
- Restatement의 당시 버전 사용
- 모델 버전 고정
- 운영 Stage와 알림을 변경하지 않음
- 결과를 별도 Replay Namespace에 저장

평가 지표:

- Factor별 예측 방향성과 장기 Fundamental 성과
- 승격 후 Thesis Break 비율
- Confidence Calibration
- False Promotion / Missed Candidate
- Turnover와 상태 진동
- 산업별 분포·Drift

수익률 하나로 Factor를 최적화하지 않는다.

### 26.6 Mutation과 회귀 테스트

- 임계치 비교 연산 변경을 잡는 Mutation Test
- 가중치 누락·중복 회귀
- 미래 데이터 혼입 회귀
- N/A 재정규화 회귀
- Risk 방향 역전 회귀
- Thesis Broken 확대 행동 회귀

---

## 27. 모델 버전과 변경 거버넌스

### 27.1 Model Version 내용

- Profile Factor와 가중치
- Metric 정의·정규화
- Gate와 임계치
- Confidence 공식과 Cap
- Industry Profile Version
- 가치평가 기본 가정
- 코드 Commit SHA
- Fixture 결과 Hash
- 승인자와 유효 시작일

### 27.2 변경 절차

```text
Change Proposal
  → Rationale & Evidence
  → Golden Fixture
  → Historical Replay
  → Challenger Evaluation
  → Human Review
  → Version Activation
  → Drift Monitoring
```

운영 성과가 나쁘다는 이유로 임계치를 즉시 낮추거나 Thesis Break 조건을 수정하지 않는다.

### 27.3 Champion / Challenger

- Champion만 운영 Action과 Stage에 영향
- Challenger는 Shadow 결과만 저장
- 동일 Snapshot으로 비교
- 최소 관찰 기간 전 자동 승격 금지
- 차이는 Factor, 산업, Confidence, Stage 영향으로 분해

---

## 28. 구현 계획

### 28.1 현행 구현 Gap

이 문서를 작성한 시점의 코드는 01·02 기반 계약 일부를 이미 제공하지만, Long-term Engine 본체가 완료된 상태는 아니다.

| 현재 자산 | 재사용할 부분 | 추가·교체할 부분 |
|---|---|---|
| `packages/core/src/long-term.ts` | 순수 함수 형태, 공통 Score Primitive | 6개 Legacy Factor, 단일 임계치 분류, `portfolioFit`·`opportunityCost` 제거 |
| `packages/core/src/contracts.ts` | Point-in-time, Evidence, Confidence 필드 | Profile/Factor/Gate/Industry/Review 세부 결과와 `REVIEW_REQUIRED` 행동 추가 |
| `packages/core/src/thesis.ts` | 불변 Revision, 가정·Break·가치범위 | Evaluation 비교, Thesis 상태 판정, Diff와 Drift 탐지 |
| `packages/core/src/state-machine.ts` | 단계 이름과 순차 승격 | 최소 관찰 기간, Evidence Gate, 승인, Active→ARCHIVED 직접 전이 차단 |
| `packages/core/src/evidence.ts` | 출처 등급과 Score Eligibility | Factor별 Coverage, 상충 근거, Confidence 계산 연결 |
| `supabase/migrations/003_*` | Evidence, Thesis, 공통 Evaluation 계보 | Long-term Profile/Factor/Gate/Valuation/Transition Table |
| `apps/api` Legacy Preview | 기존 소비자 호환 기준 | Snapshot 기반 Full Review, Job, 조회, Ranking API |

특히 현재 상태 머신은 Terminal 상태를 넓게 허용하고, 현재 Long-term 함수는 높은 단일 점수를 Core로 분류한다. 새 구현은 기존 함수를 조용히 확장하지 않고 새 계약을 병행 도입한 뒤 명시적으로 전환한다.

### 28.2 Phase 0 — Legacy 격리

목표:

- 기존 `evaluateLongTerm`의 단일 Score 분류를 Legacy로 표시
- 새 계약과 이름 충돌 방지
- 현행 API 소비자 파악

완료 조건:

- Legacy 테스트 유지
- 새 Engine이 `portfolioFit`과 `opportunityCost`를 Score에 사용하지 않음
- 폐기 경고와 마이그레이션 경로 문서화

### 28.3 Phase 1 — 순수 도메인 Core

구현:

- `types.ts`
- Factor Registry
- Industry Profile
- Metric Availability
- Core/Future Core Profile
- Confidence
- Gate
- Action/Stage Policy

완료 조건:

- Unit/Property/Golden Test 통과
- 동일 입력 결과 Hash 일치
- Core와 Future Core 독립 테스트

### 28.4 Phase 2 — Thesis와 Valuation

구현:

- 기존 Thesis 계약 연결
- Thesis Assessment/Diff
- DCF/Reverse DCF/Scenario 계약
- Decimal 계산
- Review Scheduler

완료 조건:

- Thesis Revision 불변성
- BROKEN 확대 차단
- 가치평가 불완전 시 Action 차단

### 28.5 Phase 3 — Persistence와 API

구현:

- Migration `004_long_term_engine_v1.sql`
- Repository
- API Schema/Route/Service
- Idempotency
- Audit/Outbox

완료 조건:

- Integration Test
- RLS Test
- Evaluation+Outbox 원자성
- 오류 Code 계약

### 28.6 Phase 4 — Job과 Ranking

구현:

- 정기·실적·Event·Drawdown Job
- Ranking Read Model
- Due Review
- Report 연결

완료 조건:

- 중복 Event 멱등성
- Version 혼합 없는 Ranking
- Review 지연 Alert

### 28.7 Phase 5 — Replay와 운영 품질

구현:

- Historical Replay
- Champion/Challenger
- Drift Dashboard
- 운영 Runbook

완료 조건:

- 미래 정보 혼입 방지 Test
- Replay 결과 재현
- 장애·Rollback Drill

---

## 29. Definition of Done

03 Long-term Engine 구현은 다음 조건을 모두 만족해야 완료다.

### 도메인

- [ ] Core와 Future Core가 독립 Profile로 구현됨
- [ ] 기업 매력도와 포트폴리오 배분이 분리됨
- [ ] Factor·Gate·Confidence·Thesis·Stage·Action 계약 구현
- [ ] Industry Profile과 N/A 정책 구현
- [ ] 위험 방향이 명시됨

### 데이터

- [ ] 모든 결과에 Snapshot, Evidence, Model Version 연결
- [ ] Point-in-time 검증과 Restatement 보존
- [ ] Critical Missing/Stale/Conflict Fail-closed
- [ ] Decimal 가치평가

### 안전

- [ ] Thesis BROKEN과 Hard Risk가 확대 행동을 차단
- [ ] 사용자 승인 없이 Future Core/Core 확정 전이 불가
- [ ] 주문·실제 비중 결정 없음
- [ ] Momentum 내부 의존 없음

### API/DB

- [ ] v1 API와 오류 계약 구현
- [ ] 멱등성, Audit, Transactional Outbox
- [ ] Revision 불변성과 RLS
- [ ] Ranking의 Model Version 격리

### 검증

- [ ] Unit/Property/Golden/Integration Test 통과
- [ ] Historical Replay의 미래 정보 차단
- [ ] 동일 입력 재현율 100%
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm build` 통과
- [ ] 운영 Metric·Alert·Runbook 준비

문서가 완성된 상태와 Engine이 구현 완료된 상태를 혼동하지 않는다. 이 체크리스트의 코드·DB·운영 항목이 모두 충족돼야 런타임 완료다.

---

## 30. 의도적으로 후속 문서에 남기는 항목

### `05_Portfolio_Engine.md`

- Core/Future Core 실제 비중
- 종목·산업·상관·공통 위험 한도
- 신규 자금 배분과 Cash 선택
- 세후 기회비용

### `08_Database.md`

- 전체 ERD와 Retention
- Partition, Backup, Restore
- Provider 원본 저장 정책

### `09_Scoring_System.md`

- 산업 내 Percentile과 절대 기준 혼합
- Outlier/Winsorization
- Metric별 정규화 함수의 통계 검증
- Calibration과 Drift 통계
- Cross-engine Score Explainability 표준

### `10_Risk_Engine.md`

- Portfolio Risk Limit
- 유동성·집중·Drawdown 제한
- 실행 전 최종 Risk Decision

후속 문서는 이 문서의 Engine 경계를 침범하지 않는다. 예를 들어 Portfolio가 낮은 가중치를 이유로 기업 품질 점수를 변경하거나, Risk가 Thesis를 직접 수정할 수 없다.

---

## 31. 결정 기록

| ID | 결정 | 이유 |
|---|---|---|
| LT-ADR-001 | Core/Future Core를 별도 Profile로 구현 | 검증 단계와 실패 구조가 다름 |
| LT-ADR-002 | Gate를 Score보다 우선 | 높은 평균 점수가 치명적 위험을 숨기는 문제 방지 |
| LT-ADR-003 | Portfolio Fit을 Score에서 제외 | 기업 매력도와 배분 제약 분리 |
| LT-ADR-004 | 결측과 N/A를 구분 | 데이터 부족으로 점수를 왜곡하거나 우회하는 문제 방지 |
| LT-ADR-005 | Confidence를 Score와 분리 | 높은 점수·낮은 신뢰도를 숨기지 않음 |
| LT-ADR-006 | Profile별 v1 임계치를 03에 포함 | 09 이전에도 구현 가능하도록 함 |
| LT-ADR-007 | 승격은 새 Profile 평가 | Future Core 고득점을 Core 자격으로 오인 방지 |
| LT-ADR-008 | Thesis와 Evaluation을 불변 Revision으로 보존 | 사후 합리화와 Thesis Drift 방지 |
| LT-ADR-009 | Drawdown을 Review Trigger로 사용 | 가격 변동과 기업가치 훼손 분리 |
| LT-ADR-010 | Industry 미지원 시 Fail-closed | 잘못된 공통 모델 적용 방지 |

---

## 부록 A. 대표 시나리오

### A.1 좋은 Core, 비싼 가격

입력:

- Core Business/Moat/Financial 점수 높음
- Thesis `UNCHANGED`
- Reverse DCF가 매우 높은 성장 지속을 요구
- 기대수익 Base 낮음

결과:

- Core Eligibility 유지 가능
- 기업 품질 Score 유지
- Action `HOLD` 또는 `REDUCE` 검토
- 신규 `ACCUMULATE` 금지

좋은 회사와 좋은 현재 가격을 분리한다.

### A.2 급락한 Future Core

입력:

- 주가 -35%
- 매출 성장 유지
- 고객 집중 증가
- Runway 14개월
- 자금조달 계획 불확실

결과:

- 가격 하락으로 Valuation Asymmetry가 개선될 수 있음
- Survival Gate 실패로 확대 금지
- `DRAWDOWN_REVIEW`
- Stage 유지 또는 `WEAKENED`
- 가격만으로 추가매수하지 않음

### A.3 Future Core의 Core 승격

입력:

- Future Core 6개 분기 관찰
- 고객 다변화와 반복 구매
- FCF 전환
- Moat 결과 확인
- Core Profile 81, Confidence 79

결과:

- Core용 Thesis Revision 생성
- `FUTURE_CORE → CORE` 제안
- Human Review 필요
- 과거 Future Core 기록 보존

### A.4 데이터는 부족하지만 점수는 높아 보이는 기업

입력:

- 회사 발표상 성장률 매우 높음
- 독립 근거 없음
- Counter Evidence 없음
- 주식수와 희석 불명확

결과:

- Confidence 최대 49
- Valuation Gate 실패
- `WATCH`
- 점수와 무관하게 승격·확대 차단

---

## 부록 B. 구현 Review Checklist

### Pull Request 공통

- [ ] 새 정책이 Version 필드 없이 추가되지 않았는가?
- [ ] 현재 시간·네트워크가 순수 도메인 함수에 숨겨지지 않았는가?
- [ ] Number로 금액 계산하지 않는가?
- [ ] Evidence와 Snapshot 없이 점수를 만들 수 없는가?
- [ ] N/A와 UNKNOWN 테스트가 있는가?
- [ ] Risk 방향이 이름과 출력에 명시됐는가?
- [ ] Core/Future Core가 단일 임계치로 합쳐지지 않았는가?
- [ ] Portfolio/Momentum 내부 모듈을 참조하지 않는가?
- [ ] 상태 변경과 Outbox가 같은 트랜잭션인가?
- [ ] 사용자 승인 대상 전이를 자동 확정하지 않는가?

### Migration

- [ ] 기존 Migration 수정 없음
- [ ] RLS 활성화
- [ ] Score/날짜/불변성 Check
- [ ] 롤백 또는 Forward-fix 절차
- [ ] 인덱스 비용 검토

### Model 변경

- [ ] 변경 이유와 근거
- [ ] Golden Fixture Diff
- [ ] Historical Replay
- [ ] 산업별 영향
- [ ] Score/Confidence 분포 Drift
- [ ] 승인과 유효일

---

## 부록 C. 미결정 사항과 기본값

다음 항목은 구현을 막지 않지만 운영 데이터로 재검증한다.

| 항목 | v1 기본값 | 재검증 시점 |
|---|---:|---|
| Core 신규 Score Gate | 78 | Replay와 12개월 Shadow 결과 |
| Future Core Score Gate | 75 | 산업별 표본 확보 후 |
| Core 최소 관찰 | 8개 분기 | 산업별 Cycle 검토 |
| Future Core 최소 관찰 | 4개 분기 | Milestone 기반 산업 검토 |
| Confidence Core Gate | 75 | Confidence Calibration |
| Confidence Future Core Gate | 65 | Confidence Calibration |
| 최소 적용 가중치 | 85 | Industry Profile 확장 시 |
| Future Core Stress Runway | 18개월 | 자본시장 Regime 변화 시 |
| Drawdown Trigger | 15/25/35% | 산업 변동성 Profile 구현 시 |

기본값 변경은 Configuration 수정이 아니라 Model Version 변경이다.

---

## 부록 D. 01·02 정합성 확인

| 상위 요구 | 03 반영 위치 |
|---|---|
| Long-term과 Momentum 독립 | 1.2, 4.2 |
| Core/Future Core 분리 | 2.2, 9, 10 |
| Point-in-time | 6, 26.5 |
| Model Version | 19, 27 |
| Evidence·Counter Evidence | 14 |
| Thesis 강화·약화·파손 | 15 |
| 승격·강등 | 16 |
| 실제 금액·주문 비소유 | 1.2, 17 |
| 산업별 Sub-model | 7 |
| Financial Survival과 희석 | 10.3.6 |
| 복수 가치평가와 Reverse DCF | 12 |
| Drawdown은 자동 신호 아님 | 18 |
| Transactional Outbox | 5.3, 22 |
| Human-in-the-loop | 16.3, 29 |

이 문서는 `01_Architecture.md`와 `02_Investment_Philosophy.md`의 기획적 충돌 없이 Long-term 구현 책임을 구체화한다.
