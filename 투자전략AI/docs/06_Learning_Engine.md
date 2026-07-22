# 06. Learning Engine Specification

> 불변 의사결정·실행·성과 기록을 과정과 결과로 분해하고, 우연·과적합·사후편향을 통제한 Lesson과 검증 가능한 변경 가설로 변환하되 운영 모델을 자동 변경하지 않는 학습 계층 명세

- 문서 버전: `v1.0.0-draft`
- 작성일: `2026-07-22`
- 상태: `IMPLEMENTATION-READY DRAFT`
- 선행 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1, `03_LongTerm_Engine.md`, `04_Momentum_Engine.md`, `05_Portfolio_Engine.md`
- 후속 문서: `08_Database.md`, `09_Scoring_System.md`, `10_Report_System.md`, `12_Roadmap.md`
- 구현 기준 경로: `packages/core`, `apps/api`, `supabase/migrations`

---

## 0. 문서의 역할

Learning Engine은 수익이 난 결정을 무조건 칭찬하거나 손실 결정을 무조건 수정하지 않는다. 당시 사용 가능했던 정보, 적용된 모델·정책, 실제 승인·체결, 이후 관측된 결과를 분리해 다음 질문에 답한다.

1. 규칙과 데이터에 충실한 좋은 과정이었는가?
2. 예상한 Thesis·Setup·Risk 경로와 실제 경로가 어디서 달라졌는가?
3. 결과 차이는 모델 오류, 데이터 오류, 실행 오류, 통제 가능한 행동, 정상 변동 중 무엇인가?
4. 단일 사례가 아니라 반복 가능한 패턴인가?
5. 아무것도 바꾸지 않는 것이 더 나은가?
6. 변경 가설은 어떤 Historical Replay·Walk-forward·Shadow 검증을 통과해야 하는가?
7. Hard Safety나 투자 철학 변경이 필요한 경우 누가 승인하는가?

Learning Engine의 출력은 `Review`, `Attribution`, `Lesson`, `ModelChangeProposal`, `ValidationResult`다. 이 출력은 평가 점수·정책·활성 모델을 직접 수정하지 않는다.

### 0.1 규범 우선순위

충돌 시 다음 순서로 해석한다.

1. 법적·보안·Hard Safety·사용자 명시 승인 불변식
2. `01_Architecture.md`의 불변 기록, Point-in-time, 모델 버전, Fail-closed
3. `02_Investment_Philosophy.md`의 과정/결과 분리와 No-change Lesson
4. `03`·`04`의 전략별 Thesis/Setup/Review 계약
5. `05`의 Lot·Portfolio·Risk Attribution 계약
6. 이 문서의 Review·Lesson·변경 검증 계약
7. `09_Scoring_System.md`의 Calibration·Champion/Challenger 수치 계약

### 0.2 선행 문서 충돌 검토

| 경계 | 선행 규칙 | Learning 적용 | 결론 |
|---|---|---|---|
| Strategy 분리 | Long-term과 Momentum 점수·시간축 분리 | Review Cohort·지표·최소 관측 기간 분리 | 충돌 없음 |
| 불변성 | 당시 Evaluation·Proposal·Risk·Decision 보존 | 원본을 수정하지 않고 Review/Lesson을 추가 | 충돌 없음 |
| Point-in-time | 미래 정보의 과거 평가 오염 금지 | Replay는 당시 `availableAt`만 사용 | 충돌 없음 |
| Risk 거부권 | `DENY` Override 금지 | Lesson도 과거·현재 DENY를 해제하지 않음 | 충돌 없음 |
| Human Approval | 모델·정책 변경 명시 승인 | 자동 활성화 없이 Proposal만 생성 | 충돌 없음 |
| Lot 분리 | Core/Future Core/Momentum Lot 분리 | 성과·비용·규칙 준수를 Lot과 전략별 귀속 | 충돌 없음 |

---

## 1. 목표와 비목표

### 1.1 목표

- 좋은 과정/나쁜 결과와 나쁜 과정/좋은 결과를 구분한다.
- Decision→Risk→Approval→Execution→Outcome 계보를 끊지 않는다.
- 가격, FX, 배당, 비용, 세금, Slippage, Timing을 분리 귀속한다.
- Long-term은 사업·Thesis 시간축, Momentum은 Setup·R-Multiple 시간축으로 평가한다.
- `SKIP`, `REJECTED`, `DENY`, 만료된 기회의 사후 결과도 선택 편향 없이 추적한다.
- 반복 가능한 Lesson과 No-change Lesson을 모두 보존한다.
- 변경 가설을 통제된 검증 파이프라인으로 전달한다.
- 기존 Champion과 Challenger를 같은 Point-in-time Dataset에서 비교한다.
- 결과 Hash, 모델 버전, 코드 버전, Dataset Manifest로 재현한다.

### 1.2 비목표

Learning Engine은 다음을 하지 않는다.

- 운영 모델 Weight·Threshold 즉시 수정
- LLM의 자유 서술만으로 Lesson 확정
- 최근 손실 몇 건으로 전략 중단
- 수익 결과만으로 규칙 위반 정당화
- 미래 정보로 과거 판단 재작성
- 서로 다른 전략 점수 또는 성과 Cohort 합성
- Risk `DENY`·Hard Safety 완화
- 사용자 승인 없이 Model/Policy 활성화
- 통계적 유의성만으로 투자 철학 변경

### 1.3 MVP 범위

포함:

- Decision/Trade/Skip Review
- Process/Outcome 4분류
- 전략·Lot·모델·Regime·Setup·Stage별 Attribution
- MAE/MFE/R-Multiple, 비용·Slippage, Thesis/Setup 경로
- Lesson Candidate와 확정 Lesson
- Model Change Hypothesis
- Historical Replay·Walk-forward·Shadow 결과 계약
- Human Approval 전 상태 전이
- API, Audit, Outbox, RLS, 불변 저장

제외:

- Online Learning
- 운영 중 자동 Weight 최적화
- 대규모 Causal Inference 플랫폼
- 완전 자동 Feature Engineering
- 외부 AutoML 서비스 활성화

---

## 2. 핵심 설계 결정

### 2.1 Process와 Outcome은 독립 축이다

```text
Process Quality = Data + Rule Compliance + Sizing + Risk + Approval + Execution Discipline
Outcome Quality = Realized Return + R-Multiple + Drawdown + Thesis/Setup Path
```

| Process | Outcome | 분류 | 기본 해석 |
|---|---|---|---|
| Good | Good | `GOOD_PROCESS_GOOD_OUTCOME` | 재현 가능한 강점 후보 |
| Good | Bad | `GOOD_PROCESS_BAD_OUTCOME` | 정상 변동·모델 한계·Tail Risk 분석 |
| Bad | Good | `BAD_PROCESS_GOOD_OUTCOME` | 운이 규칙 위반을 가린 사례 |
| Bad | Bad | `BAD_PROCESS_BAD_OUTCOME` | 통제 가능한 실패 우선 개선 |

수익은 Process 점수에 직접 포함하지 않는다.

### 2.2 원본은 수정하지 않는다

Review는 다음 ID를 참조한다.

- Evaluation/Thesis/Setup/Plan Revision
- Portfolio Snapshot/Allocation Proposal
- Risk Decision/Decision Proposal/User Decision
- Execution/Fill/Position Lot
- Data Snapshot/Model/Policy/Code Version

오류 정정은 원본 삭제가 아니라 Correction Record와 새 Review Revision으로 남긴다.

### 2.3 No-change도 학습 결과다

관측 결과가 나빴더라도 다음이면 `NO_CHANGE`가 우선이다.

- Process가 규칙에 맞음
- 사전 Scenario 범위 안의 결과
- 표본이 작음
- 특정 Regime에만 나타남
- Multiple Testing 가능성이 큼
- 기존 정책 변경 비용이 예상 이익보다 큼

### 2.4 학습 속도를 전략별로 분리한다

| 전략 | 기본 관측 단위 | 최소 검토 Horizon | 주요 결과 단위 |
|---|---|---|---|
| Core | 분기·연간·Thesis Event | 복수 분기/사업 Cycle | Thesis Accuracy, Fundamental Progress, 세후 IRR |
| Future Core | 분기·Milestone | 복수 분기 | Survival/Dilution, Product Proof, Stage Transition |
| Momentum | 거래·Setup·Regime | 충분한 거래 수와 복수 Regime | R-Multiple, MAE/MFE, Hit Rate, Expectancy |
| Portfolio | 월·분기·Stress | 복수 자금 배분 Cycle | Concentration, Cash, Drawdown, Turnover |
| Risk | Decision·Incident | 충분한 Decision/Incident | Prevented Loss, False Positive, Tail Capture |

Momentum이 더 빠르다는 것은 적은 표본으로 자동 변경한다는 뜻이 아니다.

### 2.5 변경 권한을 분리한다

```text
Observation
  → Review
  → Lesson Candidate
  → Approved Lesson
  → Model Change Proposal
  → Historical Replay
  → Walk-forward
  → Shadow Mode
  → Human Approval
  → New Model Version
  → Controlled Activation
```

어느 단계도 기존 활성 버전을 직접 덮어쓰지 않는다.

---

## 3. 용어와 불변식

### 3.1 용어

| 용어 | 정의 |
|---|---|
| Review | 하나의 결정·거래·비결정에 대한 구조화 사후 검토 |
| Attribution | 결과를 전략·모델·시장·실행·비용 요소로 분해한 기록 |
| Lesson Candidate | 검증 전 반복 패턴 가설 |
| Lesson | Evidence·Review·표본 Gate를 통과한 학습 기록 |
| Model Change Proposal | 모델 변경을 제안하는 불변 가설 |
| Champion | 현재 활성 모델 버전 |
| Challenger | 검증 중인 후보 모델 버전 |
| Replay | 당시 정보와 Universe로 결정 로직 재실행 |
| Walk-forward | 시간 순서를 지킨 학습/검증 창 비교 |
| Shadow Mode | 운영 결정에 영향 없이 Challenger 출력 기록 |
| Outcome Maturity | 결과 평가에 필요한 시간이 경과했는지 여부 |

### 3.2 불변식

1. 완료된 원본 결정·실행·Review·Lesson을 수정하지 않는다.
2. Review는 원본 Model/Policy/Snapshot ID를 가져야 한다.
3. 결과가 미성숙하면 최종 Lesson을 만들지 않는다.
4. 단일 결과로 Model Change를 승인하지 않는다.
5. Long-term과 Momentum 표본을 하나의 기대값으로 합치지 않는다.
6. `SKIP`과 거부 사례를 성과 Dataset에서 삭제하지 않는다.
7. Replay는 `availableAt <= decisionAt` 자료만 사용한다.
8. Challenger는 Champion보다 Risk/Hard Safety를 완화할 수 없다.
9. Lesson은 활성 Model/Policy를 직접 변경하지 않는다.
10. Hard Safety 변경은 Architecture Revision과 ADR이 필요하다.
11. Shadow 결과는 실주문·Portfolio 상태를 변경하지 않는다.
12. 사용자 식별정보·자격증명은 학습 Feature에 포함하지 않는다.

---

## 4. 시스템 경계와 구조

```text
Immutable Decisions / Executions / Outcomes
                  │
                  ▼
          Review Manifest Builder
                  │
          ┌───────┴────────┐
          ▼                ▼
   Process Assessment   Outcome Attribution
          └───────┬────────┘
                  ▼
          Review Classification
                  │
                  ▼
        Cohort / Pattern Analysis
                  │
                  ▼
       Lesson Candidate → Lesson
                  │
                  ▼
        Model Change Proposal
                  │
      Replay → Walk-forward → Shadow
                  │
                  ▼
             Human Approval
```

### 4.1 목표 패키지

```text
packages/core/src/learning-v1/
├── types.ts
├── maturity.ts
├── process.ts
├── outcome.ts
├── attribution.ts
├── review.ts
├── cohort.ts
├── lesson.ts
├── model-change.ts
├── validation.ts
├── hash.ts
└── index.ts
```

### 4.2 의존성 규칙

- Learning은 Strategy/Portfolio/Risk의 public 불변 결과만 읽는다.
- Strategy Engine은 Learning 결과를 런타임 점수에 직접 읽지 않는다.
- Model Registry만 승인된 새 버전을 활성화한다.
- Report는 Review/Lesson을 표현할 수 있으나 내용을 변경하지 않는다.
- AI Agent는 설명·Pattern Candidate를 만들 수 있지만 결정적 Gate를 통과해야 한다.

---

## 5. 시간과 Point-in-time 계약

### 5.1 주요 시각

```ts
type LearningTimeline = {
  decisionAt: string;
  approvedAt?: string;
  firstFillAt?: string;
  lastFillAt?: string;
  positionClosedAt?: string;
  outcomeAsOf: string;
  reviewedAt: string;
};
```

순서는 존재하는 필드에 대해 단조 증가해야 한다. `outcomeAsOf <= reviewedAt`이며 미래 결과를 과거 Review에 넣지 않는다.

### 5.2 Outcome Maturity

```ts
type OutcomeMaturity =
  | 'IMMATURE'
  | 'PARTIALLY_MATURE'
  | 'MATURE'
  | 'CENSORED';
```

- Momentum 종료 거래: Fill/Cost 확정 후 `MATURE`
- 열린 Momentum: `PARTIALLY_MATURE`, 최종 Lesson 금지
- Core: 정책상 최소 분기 또는 Thesis Event가 지나야 `MATURE`
- 상장폐지·데이터 소실: `CENSORED`, 삭제하지 않고 별도 분석
- `SKIP`: 사전에 정의한 관찰 Horizon 이후 평가

### 5.3 사후 정보

Review 설명에는 사후 사실을 사용할 수 있다. 다만 다음을 분리한다.

- `decisionEvidenceIds`: 당시 사용 가능
- `outcomeEvidenceIds`: 결정 이후 관측
- `counterfactualEvidenceIds`: 비교용, 결정 입력이 아니었음

---

## 6. Review Manifest

```ts
interface ReviewManifestV1 {
  id: string;
  reviewType: 'DECISION' | 'TRADE' | 'SKIP' | 'RISK' | 'PORTFOLIO' | 'INCIDENT';
  strategy: 'CORE' | 'FUTURE_CORE' | 'MOMENTUM' | 'PORTFOLIO' | 'RISK';
  decisionId?: string;
  evaluationId?: string;
  proposalId?: string;
  riskDecisionId?: string;
  executionIds: string[];
  lotIds: string[];
  modelVersionId: string;
  policyVersionIds: string[];
  decisionSnapshotIds: string[];
  outcomeSnapshotIds: string[];
  decisionAt: string;
  outcomeAsOf: string;
  maturity: OutcomeMaturity;
}
```

### 6.1 완전성 Gate

다음 중 하나라도 충족하지 않으면 `BLOCKED` Review다.

- 전략 또는 모델 버전 누락
- Decision 계보 단절
- Fill 합계와 Position Lot 수량 불일치
- 비용·통화·FX 기준 누락
- 결정 시 Snapshot의 미래 정보 포함
- Outcome 기준시각 역전
- 중복 Execution/Review ID

---

## 7. Process Assessment

### 7.1 공통 Dimension

```ts
type ProcessDimension =
  | 'DATA_QUALITY'
  | 'EVIDENCE_DISCIPLINE'
  | 'STRATEGY_RULE_COMPLIANCE'
  | 'PORTFOLIO_SIZING'
  | 'RISK_COMPLIANCE'
  | 'HUMAN_APPROVAL'
  | 'EXECUTION_QUALITY'
  | 'PSYCHOLOGY_DISCIPLINE';
```

```ts
interface ProcessDimensionResult {
  dimension: ProcessDimension;
  status: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_APPLICABLE' | 'UNKNOWN';
  score?: number;
  reasonCodes: string[];
  evidenceIds: string[];
  critical: boolean;
}
```

Critical `FAIL/UNKNOWN`은 Process를 Good으로 분류하지 않는다. `NOT_APPLICABLE`은 사전 정의된 경우에만 허용한다.

### 7.2 전략별 규칙

Long-term:

- Thesis·Counter Evidence·Valuation Scenario 존재
- Stage와 관찰 기간 준수
- Thesis Break 사후 완화 없음
- 단기 가격만으로 Thesis 변경 없음

Momentum:

- Universe·Regime·Setup·Plan 유효
- Chase/Stop/Time Stop/Event Policy 준수
- 진입 후 무승인 Stop 확대 없음
- Gap-through-Stop을 계획 가격으로 미화하지 않음

Portfolio/Risk:

- 승인 금액 상향 없음
- Bucket 차입·Lot 전환 없음
- 만료·Stale·Hard Limit 우회 없음
- Risk `DENY` 이후 Decision 생성 없음

### 7.3 심리 규율

감정 상태는 투자 결과로 추론하지 않는다. Decision Journal에 당시 기록된 상태와 행동만 평가한다.

---

## 8. Outcome과 Attribution

### 8.1 통화·비용 계약

금액은 `DecimalString`, 손익은 `SignedDecimalString`을 사용한다.

```text
Net P&L
  = Price P&L
  + Dividend/Distribution
  + FX P&L
  - Fees
  - Taxes
  - Borrow/Financing Cost
```

MVP는 Leverage를 금지하므로 Borrow Cost는 0이거나 데이터 품질 오류다.

### 8.2 결과 계약

```ts
interface OutcomeAttributionV1 {
  id: string;
  reviewManifestId: string;
  baseCurrency: CurrencyCode;
  grossPnlBase: SignedDecimalString;
  netPnlBase: SignedDecimalString;
  pricePnlBase: SignedDecimalString;
  dividendPnlBase: SignedDecimalString;
  fxPnlBase: SignedDecimalString;
  feesBase: DecimalString;
  taxesBase: DecimalString;
  slippageBase: SignedDecimalString;
  returnPercent?: number;
  rMultiple?: number;
  maePercent?: number;
  mfePercent?: number;
  holdingSessions?: number;
  resultHash: string;
}
```

### 8.3 Momentum

- `R-Multiple = Net P&L / Initial Planned Risk`
- MAE/MFE는 Corporate-action 조정 완료 Bar로 계산
- Entry/Exit Slippage와 Gap Loss 분리
- Setup·Regime·Liquidity Tier·Event Policy별 Cohort
- Open Risk가 변경된 경우 Plan Revision별 구간 분리

### 8.4 Long-term

- 가격·배당·FX·세금·비용 분리
- Revenue/FCF/ROIC/Unit Economics 등 Thesis KPI 경로
- Valuation 변화와 Fundamental 변화 분리
- 희석·자금조달·Stage Transition 영향
- 미실현 가격 상승만으로 Thesis 성공 확정 금지

### 8.5 SKIP과 거부

`SKIP`, `REJECTED`, Risk `DENY`는 가상 체결 수익으로 실성과에 합치지 않는다. 별도 Opportunity Outcome으로 다음만 비교한다.

- 기준 시점 이후 최대 상승/하락
- 사전 Entry 조건 충족 여부
- Risk/Hard Safety 사건 발생 여부
- 실제 거래 가능 유동성
- 선택 당시 규칙의 보수성/오탐 가능성

---

## 9. Review 분류

```ts
type DecisionQualityClassification =
  | 'GOOD_PROCESS_GOOD_OUTCOME'
  | 'GOOD_PROCESS_BAD_OUTCOME'
  | 'BAD_PROCESS_GOOD_OUTCOME'
  | 'BAD_PROCESS_BAD_OUTCOME'
  | 'INCOMPLETE_PROCESS'
  | 'IMMATURE_OUTCOME';
```

### 9.1 Good Process Gate

- 모든 Critical Dimension `PASS`
- 비Critical 가중 점수 정책 최소치 이상
- Risk/User Approval 계보 완전
- 데이터 품질 최소치 이상
- 규칙 위반 Audit 없음

### 9.2 Good Outcome

전략별 Benchmark를 사용한다.

- Momentum: 비용후 R-Multiple과 계획된 기대값
- Core/Future Core: 성숙 Horizon의 Thesis KPI와 세후 결과
- Portfolio: 위험 조정 생존성·Drawdown·회전율·Cash 선택
- Risk: Prevented Tail Loss와 False Positive를 함께 평가

단순 `P&L >= 0`은 호환 분류일 뿐 v1 최종 기준이 아니다.

---

## 10. Cohort와 Pattern

### 10.1 Cohort Key

```ts
interface CohortKeyV1 {
  strategy: string;
  modelVersionId: string;
  policyVersionIds: string[];
  marketRegime?: string;
  setupType?: string;
  industryCode?: string;
  stage?: string;
  liquidityTier?: string;
  eventPolicy?: string;
  periodStart: string;
  periodEnd: string;
}
```

서로 다른 Model Version을 묵시적으로 합치지 않는다. 합산 시 버전별 결과와 구성비를 함께 표시한다.

### 10.2 최소 표본 정책

정확한 수치는 `09_Scoring_System.md`가 소유한다. Learning은 다음 Gate를 강제한다.

- Minimum Sample Size
- Minimum Outcome Maturity Ratio
- Minimum Evidence Coverage
- 복수 Regime/Cycle Coverage
- 단일 종목/단일 기간 Concentration Max
- Censored Outcome 비중 Max

Gate 미달은 `INSUFFICIENT_EVIDENCE`, 변경 Proposal 승인 불가다.

### 10.3 통계적 안전

- Survivorship Bias
- Look-ahead Bias
- Selection Bias
- Multiple Testing
- Data Snooping
- Regime Imbalance
- Overlapping Samples
- Transaction Cost Understatement
- Label Leakage

각 검증 결과는 `PASS/WARN/FAIL/UNKNOWN`으로 저장한다. Critical `FAIL/UNKNOWN`은 승격을 막는다.

---

## 11. Lesson 계약

### 11.1 Lesson Candidate

```ts
interface LessonCandidateV1 {
  id: string;
  type: 'DATA' | 'MODEL' | 'EXECUTION' | 'RISK' | 'PSYCHOLOGY' | 'PORTFOLIO' | 'NO_CHANGE';
  strategy: 'CORE' | 'FUTURE_CORE' | 'MOMENTUM' | 'PORTFOLIO' | 'RISK';
  title: string;
  originalAssumption: string;
  observedPattern: string;
  alternativeExplanations: string[];
  supportingReviewIds: string[];
  contradictingReviewIds: string[];
  evidenceIds: string[];
  cohortKey: CohortKeyV1;
  sampleSize: number;
  confidence: number;
  status: 'CANDIDATE' | 'BLOCKED' | 'READY_FOR_REVIEW';
  blockerCodes: string[];
  generatedAt: string;
  resultHash: string;
}
```

### 11.2 확정 Lesson

```ts
interface InvestmentLessonV1 extends LessonCandidateV1 {
  status: 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
  processAssessment: string;
  outcomeAssessment: string;
  modelAssessment: string;
  recommendedAction: 'NO_CHANGE' | 'DATA_FIX' | 'PROCESS_FIX' | 'MODEL_HYPOTHESIS' | 'POLICY_REVIEW' | 'ARCHITECTURE_REVIEW';
  approvedBy: string;
  approvedAt: string;
  supersedesLessonId?: string;
}
```

### 11.3 승격 Gate

- 성숙 Review 존재
- 지지 Evidence와 반대 Evidence 존재
- 대안 설명 최소 1개
- Cohort/표본 Gate 통과
- 데이터·통계 Critical 검사 통과
- Reviewer와 생성 주체 분리
- `NO_CHANGE`가 아닌 경우 예상 부작용 명시

---

## 12. Model Change Proposal

```ts
interface ModelChangeProposalV1 {
  id: string;
  lessonIds: string[];
  targetModelFamily: 'LONG_TERM' | 'MOMENTUM' | 'PORTFOLIO' | 'RISK' | 'CROSS_SIGNAL';
  championModelVersionId: string;
  challengerModelVersionId: string;
  problem: string;
  hypothesis: string;
  proposedChange: string;
  expectedBenefit: string;
  possibleSideEffects: string[];
  rollbackPlan: string;
  primaryMetric: string;
  guardrailMetrics: string[];
  status: 'HYPOTHESIS' | 'VALIDATING' | 'REJECTED' | 'READY_FOR_APPROVAL' | 'APPROVED' | 'ACTIVATED' | 'ROLLED_BACK';
  requiresHistoricalReplay: true;
  requiresWalkForward: true;
  requiresShadowMode: true;
  requiresHumanApproval: true;
  resultHash: string;
}
```

### 12.1 변경 분류

| 변경 | 경로 |
|---|---|
| 데이터 매핑/품질 | Data Fix + Replay |
| Factor Weight/Threshold | Model Change Pipeline |
| Portfolio/Risk 운영 수치 | Policy Review + Replay/Stress |
| Hard Safety | Architecture Revision + ADR |
| 사용자 승인 경계 | 변경 금지, Architecture Review |

### 12.2 금지

- 활성 Model ID 재사용
- 기존 평가 결과 재계산 후 덮어쓰기
- Guardrail 악화 은폐
- 전체 기간으로 튜닝 후 같은 기간 검증
- Shadow 없이 운영 활성화
- `DENY` Override를 성능 개선으로 표현

---

## 13. 검증 파이프라인

### 13.1 Historical Replay

```ts
interface HistoricalReplayRunV1 {
  id: string;
  proposalId: string;
  datasetManifestId: string;
  codeVersion: string;
  seed: string;
  startedAt: string;
  completedAt?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  operationalStateChangeAllowed: false;
}
```

Replay는 당시 Universe, 가격, FX, Corporate Action, 공시·뉴스 `availableAt`, Policy Version을 재현한다.

### 13.2 Walk-forward

- 시간 순서 고정
- Train/Validation/Test 창 비중 저장
- Embargo/Purge 정책 저장
- 전략별 Horizon에 맞는 창 사용
- Test 구간은 최종 비교 전 잠금

### 13.3 Shadow

Champion과 Challenger가 동일 입력을 받는다.

- 출력 차이
- Gate 차이
- Portfolio/Risk 영향
- 예상 거래비용
- 경고·실패율
- Latency/운영 안정성

Shadow는 주문·Decision 상태를 변경하지 않는다.

### 13.4 승격 판정

```ts
type ValidationVerdict =
  | 'PASS'
  | 'PASS_WITH_GUARDRAILS'
  | 'INSUFFICIENT_EVIDENCE'
  | 'FAIL'
  | 'BLOCKED';
```

Primary Metric 개선과 모든 Critical Guardrail 비악화를 동시에 요구한다. 평균 개선만으로 Tail Risk 악화를 허용하지 않는다.

---

## 14. Drift와 Alert

### 14.1 Drift 유형

- Data Schema/Source Drift
- Feature Distribution Drift
- Score Distribution Drift
- Calibration Drift
- Action/Approval Rate Drift
- Portfolio Capacity Drift
- Execution Cost Drift
- Outcome/Expectancy Drift
- Rule Compliance Drift

### 14.2 Drift는 자동 변경 명령이 아니다

Drift 발생 시:

1. Alert 생성
2. 데이터 품질 확인
3. Cohort 분해
4. Incident/Review 생성
5. 필요 시 Model Change Hypothesis

Critical 데이터 Drift는 신규 평가를 Fail-closed할 수 있지만 Learning이 임의로 Threshold를 변경하지 않는다.

---

## 15. 최종 출력과 API

```text
POST /api/v1/learning/reviews
GET  /api/v1/learning/reviews/:id
POST /api/v1/learning/cohorts/analyze
POST /api/v1/learning/lessons/candidates
POST /api/v1/learning/lessons/:id/approve
GET  /api/v1/learning/lessons/:id
POST /api/v1/learning/model-changes
GET  /api/v1/learning/model-changes/:id
POST /api/v1/learning/validations/replays
POST /api/v1/learning/validations/walk-forward
POST /api/v1/learning/validations/shadow-results
POST /api/v1/learning/model-changes/:id/approve
GET  /api/v1/learning/drift-alerts
```

모든 상태 변경 POST는 `Idempotency-Key`가 필수다.

### 15.1 오류

| HTTP | Code | 의미 |
|---:|---|---|
| 400 | `INVALID_LEARNING_REQUEST` | Schema·시간·Decimal 오류 |
| 403 | `LEARNING_OWNERSHIP_MISMATCH` | 다른 사용자 원본 참조 |
| 409 | `LEARNING_LINEAGE_CONFLICT` | Model/Policy/Snapshot 계보 불일치 |
| 409 | `LEARNING_RECORD_IMMUTABLE` | 완료 기록 수정 시도 |
| 422 | `OUTCOME_NOT_MATURE` | 결과 관측 기간 부족 |
| 422 | `INSUFFICIENT_LEARNING_EVIDENCE` | 표본·반대 근거·Cohort 부족 |
| 422 | `POINT_IN_TIME_VIOLATION` | 미래 정보 사용 |
| 423 | `MODEL_CHANGE_BLOCKED` | Critical Guardrail 실패 |
| 404 | `LEARNING_RECORD_NOT_FOUND` | 대상 없음 |

---

## 16. 저장 모델

구현 시 `007_learning_engine_v1.sql`을 추가하고 기존 Migration을 수정하지 않는다.

```text
learning_review_manifests
learning_process_results
learning_outcome_attributions
learning_decision_reviews
learning_cohort_analyses
learning_lesson_candidates
investment_lessons_v1
model_change_proposals_v1
model_validation_runs
model_validation_metrics
shadow_model_observations
learning_drift_alerts
```

### 16.1 제약

- 사용자별 Composite FK
- 원본 Decision/Evaluation/Proposal/Risk/Execution 계보
- 완료 Review·Attribution·Lesson·Validation Result 불변
- `decisionAt <= outcomeAsOf <= reviewedAt`
- Decimal 손익 Reconciliation
- Champion/Challenger Model ID 상이
- Shadow `operational_state_change_allowed = false`
- APPROVED Lesson/Model Change는 승인자·시각 필수
- RLS와 서버 전용 쓰기

### 16.2 Index

- Review by Decision/Lot/Strategy/Model
- Mature Review by Cohort/Period
- Lesson Candidate status/confidence
- Model Change status/target family
- Validation by Proposal/Dataset/Model
- Drift Alert by severity/status/time

---

## 17. Event와 Audit

```text
LearningReviewRequested
LearningReviewCompleted
LearningReviewBlocked
OutcomeAttributed
LessonCandidateCreated
LessonApproved
LessonRejected
ModelChangeProposed
ModelValidationStarted
ModelValidationCompleted
ModelValidationFailed
ShadowObservationRecorded
ModelChangeReadyForApproval
ModelChangeApproved
ModelChangeRejected
LearningDriftDetected
```

Audit에는 다음을 저장한다.

- Actor/Reviewer/Approver
- 원본 Entity IDs
- Model/Policy/Code/Dataset Version
- Process/Outcome 분류
- 표본과 Guardrail
- Before/After가 아니라 Proposal/Supersedes 계보
- Result Hash/Correlation ID

---

## 18. 결정론과 Hash

동일한 Manifest, 원본 기록, Policy, 코드 버전이면 구조화 결과 Hash가 같아야 한다. 자유 서술은 Hash 대상 구조화 근거와 분리한다.

```text
Review Hash = hash(Manifest + Process Results + Outcome Attribution + Policy + Code Version)
Lesson Hash = hash(Cohort + Reviews + Evidence + Alternatives + Gate Results)
Validation Hash = hash(Proposal + Dataset Manifest + Parameters + Metrics + Guardrails)
```

정렬되지 않은 Map/ID 목록은 Stable Sort 후 Hash한다.

---

## 19. 테스트 전략

### 19.1 Unit

- Process/Outcome 4분류
- Maturity 판정
- Decimal P&L Reconciliation
- R-Multiple/MAE/MFE
- 전략별 규칙 준수
- Lesson Gate
- Model Change 상태 전이

### 19.2 Invariant/Property

- 수익 변화가 Process 분류를 바꾸지 않음
- Review가 원본을 변경하지 않음
- 표본 감소로 Confidence/Eligibility가 증가하지 않음
- 비용 증가 시 Net P&L 비증가
- 미래 Evidence 추가 시 기존 Point-in-time Hash 불변
- Challenger가 Hard Safety를 완화할 수 없음

### 19.3 Golden

1. Good Process + Gap Loss → 좋은 과정/나쁜 결과, No-change 후보
2. Stop 무시 + 이익 → 나쁜 과정/좋은 결과
3. Core Thesis Broken 후 가격 반등 → Process 실패 유지
4. 작은 Momentum 표본 → 변경 Evidence 부족
5. 복수 Regime에서 반복된 Slippage → Execution Lesson
6. SKIP 후 급등 → 당시 Gate가 유효하면 자동 후회 Lesson 금지
7. Shadow 평균 개선·Tail 악화 → Validation Fail
8. Hard Safety 변경 제안 → Architecture Review

### 19.4 Integration

- Decision→Execution→Review→Lesson
- Momentum Trade Review→Cohort→Model Change
- Long-term 분기 Outcome→Thesis Lesson
- Replay/Walk-forward/Shadow→Approval-ready
- Audit/Outbox/RLS/Idempotency

---

## 20. 관측성

### 20.1 Metric

- Mature Review 생성률
- Review 계보 완전성
- Process Violation Rate
- Good Process/Bad Outcome 비중
- Strategy/Model/Regime별 Expectancy
- Lesson Candidate→Approved 전환율
- No-change Lesson 비율
- Validation Failure/Insufficient Evidence 비율
- Shadow Divergence·Guardrail Breach
- Drift Alert 해결 시간

### 20.2 Alert

- Review 원본 계보 단절
- Outcome Reconciliation 실패
- Point-in-time 위반
- 단일 Cohort 과집중
- Champion/Challenger Dataset 불일치
- Shadow가 운영 상태 변경 시도
- 승인 없는 Model 활성화
- Critical Drift 미해결

---

## 21. 보안과 개인정보

- Decision Journal 심리 기록은 최소 수집·암호화·사용자 격리
- 자유 서술에서 자격증명·계좌·개인식별정보 제거
- 학습 Dataset Export는 식별자 가명화
- Service Role만 Attribution/Lesson/Validation 결과 삽입
- Reviewer와 Model Approver 권한 분리
- 삭제 요청 시 법적 보존 기록과 파생 Dataset 처리 정책 명시

---

## 22. 구현 계획

### Phase 0 — Legacy 격리

- 기존 `learning.ts` 호환 API 유지
- v1 Package와 타입 분리
- Process/Outcome 호환 매핑

### Phase 1 — Review

- Manifest/Maturity
- Process Dimension
- Outcome Attribution
- Review Classification/Hash

### Phase 2 — Lesson

- Cohort Summary
- Lesson Candidate/Gate
- Approved/Rejected/Superseded Lesson

### Phase 3 — Model Change

- Hypothesis/State Machine
- Replay/Walk-forward/Shadow 계약
- Guardrail Verdict

### Phase 4 — API/Persistence

- `007_learning_engine_v1.sql`
- Repository/Audit/Outbox
- Review/Lesson/Validation API

### Phase 5 — 운영 연결

- Scheduler/Outcome Maturity Worker
- Dataset Builder
- Shadow Runner
- Reviewer/Approver UI

---

## 23. Definition of Done

### 도메인

- [ ] Process/Outcome 독립 분류
- [ ] Strategy별 Maturity/Cohort 분리
- [ ] Decimal Outcome Attribution
- [ ] SKIP/거부 포함 Selection Bias 통제
- [ ] Lesson Candidate/No-change/Gate
- [ ] Model Change 검증 상태 전이
- [ ] Replay/Walk-forward/Shadow 계약

### 안전

- [ ] 원본 Decision/Model/Policy 수정 0건
- [ ] 미래 정보 Replay 유입 0건
- [ ] 승인 없는 Model 활성화 0건
- [ ] Hard Safety 자동 완화 0건
- [ ] Shadow 운영 상태 변경 0건

### API/DB

- [ ] Review/Lesson/Model Change/Validation API
- [ ] Audit/Outbox/Idempotency
- [ ] Composite FK/RLS/Immutable Trigger
- [ ] Result Hash/Replay

### 검증

- [ ] Unit/Invariant/Golden/Integration
- [ ] 동일 입력 Hash 일치
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build`

실제 Dataset Builder·Scheduler·Shadow 운영·승인 UI는 외부 운영 연결 단계다.

---

## 24. 결정 기록

| ID | 결정 | 이유 |
|---|---|---|
| LEARN-ADR-001 | Process와 Outcome 독립 분류 | Outcome Bias 방지 |
| LEARN-ADR-002 | 원본 불변, Review 추가 | 감사·재현성 보존 |
| LEARN-ADR-003 | No-change Lesson 정식 지원 | 과잉 반응·과적합 방지 |
| LEARN-ADR-004 | 전략별 학습 속도 분리 | 시간축·표본 구조 차이 |
| LEARN-ADR-005 | Replay→Walk-forward→Shadow→승인 | 운영 위험 통제 |
| LEARN-ADR-006 | SKIP/거부 Outcome 별도 추적 | 선택 편향 탐지 |
| LEARN-ADR-007 | Hard Safety 변경은 Architecture Review | 하위 계층 완화 금지 |

---

## 부록 A. PR Review Checklist

### Lineage

- [ ] Evaluation→Proposal→Risk→Decision→Execution 계보가 완전한가?
- [ ] 당시 Model/Policy/Snapshot을 참조하는가?
- [ ] Outcome Evidence와 Decision Evidence가 분리되는가?

### Bias

- [ ] 결과가 Process 점수를 바꾸지 않는가?
- [ ] SKIP/거부/상장폐지 표본이 누락되지 않는가?
- [ ] Look-ahead/Survivorship/Selection/Multiple Testing을 검사하는가?

### Change Safety

- [ ] Lesson이 활성 모델을 직접 수정하지 않는가?
- [ ] Challenger가 Guardrail과 Hard Safety를 통과하는가?
- [ ] Shadow가 운영 상태를 변경하지 않는가?
- [ ] 승인자와 생성 주체가 분리되는가?

### Reproducibility

- [ ] Dataset Manifest·Code Version·Seed가 있는가?
- [ ] Stable Sort와 Result Hash를 사용하는가?
- [ ] 동일 입력 Replay 결과가 일치하는가?
