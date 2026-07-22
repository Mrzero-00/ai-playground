# 10. Report System

- 문서 버전: v1.0.0
- 작성일: 2026-07-22
- 최종 검토일: 2026-07-23
- 명세 상태: SPECIFICATION BASELINE
- 구현 준비도: R1 CORE / API / SCHEMA IMPLEMENTED / R2+ OPEN
- 기준 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1, `03_LongTerm_Engine.md`~`09_Scoring_System.md`
- 후속 문서: `11_UI_UX.md`, `12_Roadmap.md`, `13_Codex_Implementation.md`

---

## 1. 문서 목적

Report System은 Long-term, Momentum, Portfolio, Risk, Learning, Agent, Scoring Engine이 이미 생성한 불변 결과를 사람이 검토하고 행동할 수 있는 보고서로 조합한다.

보고서는 새로운 투자 판단을 만드는 엔진이 아니다. 원본 결과를 변경하거나 누락된 점수를 임의 보간하지 않으며, 읽기 시점의 최신값을 과거 보고서에 섞지 않는다. 모든 결론은 생성 시점에 고정된 Source Manifest로 되돌아갈 수 있어야 한다.

이 문서의 목표는 다음과 같다.

1. 독자와 의사결정 목적별 보고서 계약을 정의한다.
2. 결론·변화·근거·반대 근거·위험·행동·다음 검토 조건의 읽기 순서를 강제한다.
3. Fact, Estimate, Interpretation, Recommendation을 구조적으로 분리한다.
4. Snapshot·Evidence·Model·Policy·Result Hash의 Point-in-time 계보를 보존한다.
5. JSON, Markdown, Web, PDF, Notification Summary가 같은 Canonical Report를 표현하도록 한다.
6. 비동기 생성·멱등성·재시도·부분 실패·재생성 계약을 정의한다.
7. 보고서가 투자 원장과 도메인 결과를 수정하지 못하도록 읽기 전용 경계를 둔다.

---

## 2. 비목표

Report System은 다음을 수행하지 않는다.

- Long-term 또는 Momentum 점수 재계산
- Portfolio 배분·Risk 판정 재계산
- 추천 금액·수량·Stop의 임의 수정
- 자동 주문 또는 사용자 승인 대행
- Agent 자유 문장을 도메인 사실로 승격
- 최신 데이터로 과거 보고서를 조용히 갱신
- PDF/Markdown을 진실 원본으로 취급
- 생성 실패를 원본 Evaluation·Decision 트랜잭션에 전파
- 서로 다른 사용자, Portfolio, Model Scope의 결과 혼합
- `BLOCKED`·`UNAVAILABLE` 점수를 0점으로 표현
- 투자 성과를 과정 품질과 동일시

---

## 3. 선행 문서 정합성 및 충돌 검토

### 3.1 결론

01~09와 기획적 충돌은 없다. 10번은 기존 Engine 결과의 읽기 전용 Projection 계층이다. 다만 아래 경계를 위반하면 충돌이 발생하므로 구현 불변조건으로 고정한다.

| 선행 문서 | 이어받는 계약 | Report System의 금지 사항 |
|---|---|---|
| 01 Architecture | Report Engine 읽기 전용, Event 기반 비동기 생성 | 원본 Domain Row 수정, 생성 실패로 원본 롤백 |
| 02 Philosophy | 결론 우선, 하나의 최우선 선택, 반대 근거, Fact/Estimate 분리 | 확신을 문체로 과장, 추천만 표시 |
| 03 Long-term | Evaluation·Thesis·Valuation·Stage·Review 계보 | 장기 점수 재계산, Thesis Break 누락 |
| 04 Momentum | Setup·Plan·만료·Stop·Regime 계보 | 만료 Plan을 현재 실행 가능으로 표시 |
| 05 Portfolio | Snapshot·Capacity·Proposal·Stress·정책 버전 | 승인 가능 금액 확대, 다른 Snapshot 혼합 |
| 06 Learning | 과정/결과 분리, 성숙도, 반대 사례, Model Change 거버넌스 | 단일 성공 사례를 Lesson으로 단정 |
| 07 AI Agents | Agent Output은 비신뢰 입력, Evidence Claim 검증 | 생성 문장을 검증 없이 Canonical Fact로 저장 |
| 08 Database | 사용자 소유권, 불변 계보, Retention, 삭제 | Cache 삭제를 원본 삭제로 확대 |
| 09 Scoring | Scope 분리, `SCORED/BLOCKED/UNAVAILABLE`, 변화 설명 | 전략 간 점수 직접 비교, 미산출을 0점 처리 |

### 3.2 권위 순서

충돌 시 다음 순서로 판단한다.

```text
Hard Safety / Risk Decision
  > Approved Domain Result
  > Point-in-time Source Manifest
  > Canonical Report JSON
  > Rendered Artifact
  > Notification Summary
```

Rendered Artifact가 Canonical JSON과 다르면 Artifact는 폐기하고 같은 Canonical Report에서 재생성한다.

### 3.3 투자 판단과 표현의 분리

Report Composer는 다음만 수행할 수 있다.

- 승인된 필드를 Section으로 선택
- 정해진 순서로 정렬
- 단위와 Locale을 적용
- 누락·오래됨·충돌 상태를 경고
- 원본 링크와 설명을 표시
- 길이 제한에 맞춰 결정론적으로 축약

Report Composer는 추천 방향, 배분 금액, 점수, Confidence, Gate 결과를 변경할 수 없다.

---

## 4. 핵심 설계 원칙

### 4.1 Canonical-first

JSON 구조체가 보고서의 진실 원본이다. Markdown, Web, PDF, Notification은 같은 Canonical JSON을 렌더링한 Artifact다.

### 4.2 Point-in-time

모든 Source는 `availableAt <= dataAsOf <= generatedAt`을 만족해야 한다. 과거 보고서 재생성은 원본 Manifest에 고정된 Source Revision만 사용한다.

### 4.3 Explain before persuade

보고서는 결론을 먼저 보여주되, 원본 근거·반대 근거·위험·불확실성·다음 검토 조건을 같은 수준으로 노출한다.

### 4.4 One primary recommendation

행동 선택이 필요한 보고서는 최우선 Recommendation을 정확히 하나 가진다. `HOLD_CASH`, `NO_ACTION`, `WAIT_FOR_DATA`도 유효한 최우선 선택이다.

### 4.5 Fail closed

필수 Source가 누락·오래됨·충돌·권한 불일치 상태면 행동 가능한 보고서를 만들지 않는다. `BLOCKED` 보고서는 원인과 해소 조건만 제공한다.

### 4.6 Immutable publication

발행된 Report Revision과 Artifact는 수정하지 않는다. 정정은 새 Revision을 만들고 이전 Revision과의 관계 및 변경 이유를 저장한다.

### 4.7 Deterministic rendering

같은 Canonical Report, Template Version, Renderer Version, Locale은 같은 Artifact Hash를 생성해야 한다.

### 4.8 No secret persistence

API Key, Token, Cookie, Provider 원문 Secret, 내부 Prompt는 Manifest·Report·Artifact·Log에 저장하지 않는다.

---

## 5. 보고서 카탈로그

| 유형 | 주 독자 | 기본 주기 | 목적 | 최우선 판단 |
|---|---|---:|---|---|
| `DAILY_MOMENTUM_BRIEF` | 사용자 | 거래일 | Setup·Regime·Plan 변화 확인 | 오늘 신규 행동 여부 |
| `WEEKLY_INVESTMENT_OS` | 사용자 | 주간 | 전략별 변화·위험·리뷰 일정 통합 | 이번 주 우선 검토 |
| `MONTHLY_CAPITAL_ALLOCATION` | 사용자/승인자 | 월급날·신규 자금 유입 | 신규 자금 배분 검토 | 하나의 배분안 또는 현금 유지 |
| `QUARTERLY_LONG_TERM_REVIEW` | 사용자 | 분기·실적 발표 후 | Thesis·가치평가·Stage 점검 | 유지·축소·추가 검토 |
| `EARNINGS_REVIEW` | 사용자 | 실적 Event | 예상 대비 변화와 Thesis 영향 | Thesis 재검토 여부 |
| `TRADE_REVIEW` | 사용자 | Position 종료 후 | 과정·결과·규칙 준수 검토 | 학습 후보 생성 여부 |
| `MODEL_EVOLUTION` | 사용자/모델 검토자 | 변경 제안 시 | Champion/Challenger 근거와 Guardrail | 승인·거부·추가 검증 |
| `ANNUAL_INVESTMENT_REVIEW` | 사용자 | 연간 | 전략별 성과·과정·정책 적합성 | 다음 해 정책 검토 |

### 5.1 최소 구현 범위

v1은 다음을 완전 구현한다.

- Weekly Investment OS
- Monthly Capital Allocation
- Quarterly Long-term Review
- Trade Review
- Model Evolution
- 범용 Decision Report와 Notification Summary

Daily, Earnings, Annual은 같은 계약을 사용하며 Template Registry에 확장 가능하게 둔다.

---

## 6. 상태 모델

### 6.1 Report Run

```text
REQUESTED
  -> VALIDATING
  -> GENERATING
  -> SUCCEEDED
  -> PARTIALLY_SUCCEEDED
  -> BLOCKED
  -> FAILED
  -> CANCELLED
```

허용 전이:

| 현재 | 다음 |
|---|---|
| REQUESTED | VALIDATING, CANCELLED |
| VALIDATING | GENERATING, BLOCKED, FAILED, CANCELLED |
| GENERATING | SUCCEEDED, PARTIALLY_SUCCEEDED, FAILED, CANCELLED |
| Terminal | 없음 |

`SUCCEEDED`, `PARTIALLY_SUCCEEDED`, `BLOCKED`, `FAILED`, `CANCELLED`은 Terminal이다.

### 6.2 Report Revision

```text
DRAFT -> PUBLISHED -> SUPERSEDED
                  \-> WITHDRAWN
```

- `DRAFT`: 내부 생성 완료, 아직 사용자 기준 발행 아님
- `PUBLISHED`: 조회·배포 가능한 불변 Revision
- `SUPERSEDED`: 정정 Revision이 발행됨
- `WITHDRAWN`: 보안·법적·중대한 데이터 문제로 노출 중단

`PUBLISHED` 내용을 직접 수정할 수 없다.

### 6.3 Delivery

```text
PENDING -> SENT -> DELIVERED
        -> FAILED -> RETRY_SCHEDULED -> SENT
        -> CANCELLED
```

보고서 생성 성공과 Delivery 성공은 독립 상태다. Notification 실패는 발행된 보고서를 실패로 바꾸지 않는다.

---

## 7. 도메인 계약

### 7.1 공통 식별자

```ts
type ReportType =
  | "DAILY_MOMENTUM_BRIEF"
  | "WEEKLY_INVESTMENT_OS"
  | "MONTHLY_CAPITAL_ALLOCATION"
  | "QUARTERLY_LONG_TERM_REVIEW"
  | "EARNINGS_REVIEW"
  | "TRADE_REVIEW"
  | "MODEL_EVOLUTION"
  | "ANNUAL_INVESTMENT_REVIEW"
  | "DECISION_REPORT";

type ReportFormat = "JSON" | "MARKDOWN" | "WEB" | "PDF" | "NOTIFICATION";
type ReportAudience = "USER" | "APPROVER" | "REVIEWER" | "OPERATOR";
type ReportStatus = "READY" | "BLOCKED";
```

### 7.2 생성 요청

```ts
interface ReportRequestV1 {
  id: string;
  userId: string;
  reportType: ReportType;
  audience: ReportAudience;
  locale: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  dataAsOf: string;
  requestedAt: string;
  requestedBy: string;
  templateVersion: string;
  rendererVersion: string;
  sourceRefs: ReportSourceRefV1[];
  requestedFormats: ReportFormat[];
  idempotencyKey: string;
  correlationId: string;
}
```

검증 규칙:

1. `periodStart <= periodEnd <= dataAsOf <= requestedAt`
2. `requestedFormats`는 중복 없이 최소 하나
3. `sourceRefs`는 보고서 유형별 필수 Source를 포함
4. 모든 Source의 `userId`가 요청 사용자와 일치
5. `idempotencyKey`는 사용자와 생성 목적 안에서 유일
6. Locale·Timezone은 명시적 Allowlist 사용
7. Template·Renderer Version은 활성 Registry에 존재

### 7.3 Source Manifest

```ts
type ReportSourceType =
  | "LONG_TERM_EVALUATION"
  | "MOMENTUM_EVALUATION"
  | "MOMENTUM_PLAN"
  | "PORTFOLIO_SNAPSHOT"
  | "ALLOCATION_PROPOSAL"
  | "CAPITAL_ALLOCATION"
  | "RISK_DECISION"
  | "LEARNING_REVIEW"
  | "COHORT_ANALYSIS"
  | "LESSON"
  | "MODEL_CHANGE"
  | "MODEL_VALIDATION"
  | "SCORECARD"
  | "SCORE_CHANGE"
  | "EVIDENCE"
  | "SNAPSHOT";

interface ReportSourceRefV1 {
  sourceType: ReportSourceType;
  sourceId: string;
  sourceRevision: number;
  userId: string;
  availableAt: string;
  asOf: string;
  resultHash: string;
  modelVersionIds: string[];
  policyVersionIds: string[];
  snapshotIds: string[];
  evidenceIds: string[];
  required: boolean;
}
```

Manifest는 Source 내용 전체를 복제하지 않는다. 식별자, Revision, 시각, Hash, 계보만 고정한다. 원문 Payload는 권한이 있는 Repository에서 조회한다.

### 7.4 Canonical Report

```ts
interface CanonicalReportV1 {
  id: string;
  userId: string;
  requestId: string;
  reportType: ReportType;
  status: ReportStatus;
  revision: number;
  supersedesReportId?: string;
  title: string;
  audience: ReportAudience;
  locale: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  dataAsOf: string;
  generatedAt: string;
  templateVersion: string;
  rendererVersion: string;
  primaryRecommendation: ReportRecommendationV1;
  sections: ReportSectionV1[];
  quality: ReportQualityV1;
  sourceManifest: ReportSourceRefV1[];
  warningCodes: string[];
  blockerCodes: string[];
  resultHash: string;
}
```

### 7.5 Statement와 Section

```ts
type StatementKind = "FACT" | "ESTIMATE" | "INTERPRETATION" | "RECOMMENDATION";
type SectionKind =
  | "CONCLUSION"
  | "CHANGES"
  | "FACTS"
  | "ESTIMATES"
  | "INTERPRETATIONS"
  | "COUNTER_EVIDENCE"
  | "RISKS"
  | "ACTIONS"
  | "NEXT_REVIEW"
  | "SOURCES";

interface ReportStatementV1 {
  id: string;
  kind: StatementKind;
  text: string;
  sourceIds: string[];
  evidenceIds: string[];
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  materiality: "PRIMARY" | "SECONDARY" | "CONTEXT";
  warningCodes: string[];
}

interface ReportSectionV1 {
  kind: SectionKind;
  heading: string;
  order: number;
  statements: ReportStatementV1[];
}
```

모든 `FACT`는 최소 하나의 Source ID를 가진다. `ESTIMATE`, `INTERPRETATION`, `RECOMMENDATION`은 근거 Source와 계산/정책 버전을 연결한다.

### 7.6 최우선 Recommendation

```ts
type RecommendationAction =
  | "REVIEW"
  | "APPROVE_EXISTING_PROPOSAL"
  | "REJECT_EXISTING_PROPOSAL"
  | "HOLD_CASH"
  | "NO_ACTION"
  | "WAIT_FOR_DATA"
  | "REDUCE_RISK"
  | "CREATE_NEW_PROPOSAL";

interface ReportRecommendationV1 {
  action: RecommendationAction;
  summary: string;
  rationaleSourceIds: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  executable: boolean;
  proposalId?: string;
  expiresAt?: string;
  conditions: string[];
}
```

`executable: true`는 실행을 의미하지 않는다. 이미 존재하는 유효 Proposal을 사용자가 별도 승인 API에서 검토할 수 있다는 뜻이다.

### 7.7 품질 결과

```ts
interface ReportQualityV1 {
  completeness: "COMPLETE" | "PARTIAL" | "INSUFFICIENT";
  freshness: "FRESH" | "STALE" | "MIXED";
  lineage: "VALID" | "INVALID";
  sourceCoverageBps: number;
  counterEvidencePresent: boolean;
  primaryRecommendationCount: number;
  pointInTimeValid: boolean;
}
```

행동 가능한 `READY` 보고서는 다음을 모두 만족한다.

- `lineage === VALID`
- `pointInTimeValid === true`
- `primaryRecommendationCount === 1`
- 매수·추가 위험 Recommendation이면 `counterEvidencePresent === true`
- 유형별 최소 `sourceCoverageBps`
- 필수 Source가 모두 Fresh 또는 정책상 허용된 Stale

---

## 8. 보고서 구성 규칙

### 8.1 고정 순서

사용자용 Decision Report는 다음 순서를 바꾸지 않는다.

1. Conclusion
2. Changes
3. Facts
4. Estimates
5. Interpretations
6. Counter Evidence
7. Risks
8. Priority Recommendation
9. Actions
10. Next Review
11. Sources

빈 선택 Section은 `없음`을 명시할 수 있지만 필수 Section을 삭제하지 않는다.

### 8.2 변화 기준선

`Changes`는 임의 서술이 아니라 동일 Report Type의 직전 Published Revision 또는 명시된 Baseline Source와 비교한다.

변화는 다음 원인으로 분해한다.

- 원시 데이터 변화
- Evaluation·Thesis·Setup 변화
- 가격·환율·Portfolio Snapshot 변화
- Model·Policy·Template Version 변화
- Confidence·Coverage 변화
- 수정·정정 Source 반영

점수 변화는 `ScoreChangeExplanation`이 없으면 `설명 대기`로 표시하고 Recommendation 근거에 사용하지 않는다.

### 8.3 Confidence 표현

Confidence는 Source Coverage, Freshness, Model Fit, Disagreement 결과를 그대로 사용한다. Composer가 높이거나 평균내지 않는다.

- HIGH: 높은 Coverage와 중대한 Conflict 없음
- MEDIUM: 제한적 누락 또는 불확실성
- LOW: 행동보다 추가 확인이 우선

### 8.4 Blocked 표현

Blocked 보고서는 다음을 반드시 포함한다.

- 차단 코드
- 영향을 받은 결론/행동
- 마지막 유효 Source 기준시각
- 필요한 데이터 또는 검토
- 자동 재시도 가능 여부

Blocked 보고서에 실행 가능한 Recommendation을 포함하지 않는다.

### 8.5 민감정보와 개인화

- Portfolio 금액은 소유 사용자와 승인된 Audience에만 노출
- Notification에는 기본적으로 절대 금액·전체 보유 종목을 넣지 않음
- 공유용 Artifact는 별도 Redaction Policy와 새 Artifact Hash 필요
- Redacted Artifact도 Canonical Report ID와 Redaction Policy Version을 기록

---

## 9. 유형별 필수 계약

### 9.1 Weekly Investment OS

필수 Source:

- 최신 Portfolio Snapshot
- 활성 Long-term/Momentum Evaluation 변화
- Risk Alert와 만료 예정 Proposal/Plan
- 도래한 Review 조건
- 설명 가능한 Score Change

필수 Section:

- 이번 주 최우선 검토 한 건
- 전략별 신규/종료/차단 변화
- Portfolio Concentration·Open Risk·현금 상태
- Thesis Break·Stop·만료·Event Risk
- 다음 7일 Review 일정

### 9.2 Monthly Capital Allocation

필수 Source:

- 동일 시점 Portfolio Snapshot
- 신규 투자 가능 금액과 비투자 Reserve
- Capital Allocation Decision 또는 Allocation Proposal
- Portfolio Policy·Risk Decision·Stress Result
- 후보별 유효 Evaluation/Scorecard

최종 결론 예:

- 기존 Core A에 70%, 현금 30%
- Future Core B에 탐색 비중만 배치
- Momentum Open Risk 상한으로 신규 단기 거래 없음
- 모든 후보의 Margin of Safety 부족으로 현금 유지

보고서는 기존 Proposal을 링크할 수 있지만 금액을 다시 계산하지 않는다.

### 9.3 Quarterly Long-term Review

필수 Source:

- 직전 및 현재 Long-term Evaluation
- Thesis Revision·Assumption·Break Condition
- Bear/Base/Bull Valuation
- 최신 Evidence와 Counter Evidence
- Portfolio Exposure와 다음 Review Trigger

`CORE`와 `FUTURE_CORE`는 같은 순위표에서 직접 비교하지 않는다.

### 9.4 Trade Review

필수 Source:

- 원 Decision·Proposal·Risk Decision
- Execution·Position Lot·Exit
- Process Review·Outcome Attribution
- 관련 Momentum Plan 또는 Long-term Thesis

과정이 좋고 결과가 나쁠 수 있으며 반대도 가능하다. 두 축을 별도 Section으로 표시한다.

### 9.5 Model Evolution

필수 Source:

- 승인된 Lesson
- Model Change Proposal 최신 Revision
- Historical Replay, Walk-forward, Shadow 결과
- Guardrail·Drift·Regression 결과
- Human Approval 상태

검증을 통과하지 않은 변경을 `추천 모델`로 표현하지 않는다.

---

## 10. Template Registry

```ts
interface ReportTemplateV1 {
  id: string;
  userId: string;
  reportType: ReportType;
  version: string;
  status: "DRAFT" | "APPROVED" | "ACTIVE" | "DEPRECATED";
  requiredSourceTypes: ReportSourceType[];
  requiredSections: SectionKind[];
  minimumCoverageBps: number;
  allowedFormats: ReportFormat[];
  maxStatementCount: number;
  contentHash: string;
}
```

규칙:

- 활성 Template은 Report Type·Locale별 하나
- 필수 Section·Source 완화는 Major Version과 Human Approval 필요
- 문구·Label 수정은 Patch 가능
- Template Version은 발행 보고서에 고정
- Deprecated Template으로 신규 보고서를 만들 수 없음

---

## 11. 생성 파이프라인

```text
Report Request
  -> Ownership / Idempotency Validation
  -> Source Manifest Freeze
  -> Point-in-time / Hash / Freshness Validation
  -> Template Resolution
  -> Canonical Projection
  -> Quality Gate
  -> Canonical Report Persist
  -> Artifact Render(JSON/Markdown/Web/PDF/Notification)
  -> Artifact Hash Verification
  -> Publish + Audit + Outbox
  -> Delivery (independent retry)
```

### 11.1 생성 알고리즘

1. 요청의 사용자·기간·시각·형식을 검증한다.
2. Idempotency Key로 기존 Run을 조회한다.
3. Source를 읽고 소유권·Revision·Result Hash를 확인한다.
4. Manifest를 안정 정렬해 고정한다.
5. Report Type에 맞는 활성 Template을 선택한다.
6. Source Adapter가 Canonical Statement를 생성한다.
7. 중복 Statement는 Source와 의미 Key 기준으로 제거한다.
8. Section 순서와 최우선 Recommendation 개수를 검증한다.
9. Quality Gate가 `READY` 또는 `BLOCKED`를 결정한다.
10. Result Hash를 계산하고 불변 저장한다.
11. 요청 Format별 Artifact를 렌더링한다.
12. 성공한 Artifact만 저장하고 부분 실패를 Run에 기록한다.
13. Published Revision, Audit, Outbox를 원자 기록한다.

### 11.2 안정 정렬

정렬 우선순위:

```text
section.order ASC
materiality PRIMARY -> SECONDARY -> CONTEXT
source.availableAt DESC
statement.id ASC
```

입력 배열 순서가 달라도 Canonical Result Hash는 같아야 한다.

### 11.3 Hash 입력

Result Hash에는 다음을 포함한다.

- Canonical Report의 사용자 표시 필드
- 정렬된 Source Manifest와 Result Hash
- Template Version과 Content Hash
- Renderer-independent Locale/Timezone
- Warning·Blocker Code

다음은 제외한다.

- 요청 수신 순서
- 서버 Trace ID
- 비결정적 생성 소요 시간
- Delivery 상태
- Artifact 저장 URL
- Secret·내부 Prompt

---

## 12. Artifact 계약

```ts
interface ReportArtifactV1 {
  id: string;
  userId: string;
  reportId: string;
  reportRevision: number;
  format: ReportFormat;
  rendererVersion: string;
  locale: string;
  content: string;
  contentType: string;
  contentHash: string;
  redactionPolicyVersion?: string;
  generatedAt: string;
}
```

### 12.1 Markdown

- 구조화된 고정 Heading 사용
- Source ID를 클릭 가능한 내부 Reference로 표현 가능
- 표가 화면 폭을 넘으면 목록으로 결정론적 전환
- 사용자 입력 문자열의 Markdown/HTML Injection Escape

### 12.2 Web

- Canonical JSON을 API에서 조회해 UI Component로 표시
- Action Button은 Report가 아니라 Proposal/Decision ID를 호출
- Stale/Blocked/Expired를 색상 외 Text·Icon으로도 표현

### 12.3 PDF

- 장기 보관·공유용 파생 Artifact
- 페이지마다 Report ID, Revision, dataAsOf 표시
- Source Appendix와 Disclaimer 포함
- PDF 생성 실패가 Markdown/JSON 발행을 막지 않음

### 12.4 Notification Summary

- 제목, 최우선 Recommendation, 핵심 Warning, Report Deep Link만 포함
- Notification 자체로 투자 승인 불가
- 민감 금액·세부 포지션은 기본 Redaction
- 글자 수 초과 시 문장 중간 절단 대신 우선순위 기반 생략

---

## 13. API 계약

### 13.1 Template — R1 IMPLEMENTED

```http
POST /api/v1/reports/templates/validate
POST /api/v1/reports/templates/:id/transitions
GET  /api/v1/reports/templates/:id
```

### 13.2 생성 — R1 IMPLEMENTED

```http
POST /api/v1/reports
GET  /api/v1/reports/:id
GET  /api/v1/reports/:id/artifacts
GET  /api/v1/reports/:id/artifacts/:format
POST /api/v1/reports/:id/revisions
POST /api/v1/reports/:id/replays
```

### 13.3 목록과 비교 — R2+ TARGET

```http
GET  /api/v1/reports?type=&status=&periodStart=&periodEnd=&cursor=
POST /api/v1/reports/changes/explain
```

### 13.4 Delivery — R2+ TARGET

```http
POST /api/v1/reports/:id/deliveries
GET  /api/v1/reports/:id/deliveries
POST /api/v1/report-deliveries/:id/retry
```

`R1 IMPLEMENTED`는 현재 공개 API 계약이고 `R2+ TARGET`은 목표 명세다. 목록·변화 비교·Delivery API는 Object Storage, Delivery Provider, Redaction과 운영 재시도 정책을 연결한 뒤 공개한다.

### 13.5 상태 코드

| HTTP | Code | 의미 |
|---:|---|---|
| 201 | `REPORT_CREATED` | Canonical Report 생성 |
| 200 | `REPORT_FOUND` | 조회 성공 |
| 400 | `INVALID_REPORT_CONTRACT` | Schema·Template 규칙 위반 |
| 403 | `REPORT_OWNERSHIP_MISMATCH` | 사용자 소유권 불일치 |
| 404 | `REPORT_RESOURCE_NOT_FOUND` | Report·Template·Source 없음 |
| 409 | `REPORT_IDEMPOTENCY_CONFLICT` | 같은 Key의 다른 Payload |
| 409 | `REPORT_REVISION_CONFLICT` | Revision 계보 분기 |
| 410 | `REPORT_SOURCE_EXPIRED` | 행동 Source가 만료됨 |
| 422 | `REPORT_SOURCE_INCOMPLETE` | 필수 Source·계보·반대 근거 부족 |
| 423 | `REPORT_BLOCKED` | Quality Gate 차단 |

쓰기 API는 `Idempotency-Key`가 필수이며 응답은 `X-Request-Id`, `X-Correlation-Id`를 반환한다.

---

## 14. 저장 모델

### 14.1 Table

```text
report_templates
report_template_sections
report_requests
report_runs
report_run_attempts
reports
report_source_manifest
report_sections
report_statements
report_artifacts
report_deliveries
report_delivery_attempts
report_change_explanations
```

### 14.2 핵심 제약

- `(user_id, idempotency_key)` 유일
- `(user_id, report_type, revision_chain_id, revision)` 유일
- Published Report·Source Manifest·Statement·Artifact Update/Delete 금지
- `supersedes_report_id`는 같은 사용자·유형·Revision Chain
- `data_as_of <= generated_at`
- Source `available_at <= report.data_as_of`
- Artifact `(report_id, format, renderer_version, redaction_policy_version)` 유일
- `content_hash`, `result_hash` 필수
- `source_coverage_bps` 0~10000
- 사용자별 RLS와 Service Role 쓰기 경계

### 14.3 캐시와 보존

- Canonical Report, Manifest, Audit: 감사·재현성 보존 정책
- Artifact: 재생성 가능한 Cache 정책 가능
- Delivery Payload/Attempt: 운영 보존 정책
- Provider 원문·민감 첨부: 별도 보존·암호화 정책
- Artifact 삭제는 Canonical Report와 Source 계보를 삭제하지 않음

---

## 15. 보안 및 권한

### 15.1 권한 원칙

- 사용자는 자신의 Report와 Source만 읽는다.
- Report Composer Service는 Source Read, Report Write만 가진다.
- Portfolio, Evaluation, Risk, Model Table Update 권한을 갖지 않는다.
- Renderer는 Canonical Report Read와 Artifact Write만 가진다.
- Delivery Worker는 Redacted Artifact와 목적지 최소 정보만 읽는다.

### 15.2 비신뢰 콘텐츠

Evidence, 사용자 메모, Agent Output, 외부 문서는 비신뢰 문자열이다.

- HTML/Markdown Escape
- URL Scheme Allowlist
- Script·Event Handler 제거
- Prompt Injection 문구를 명령으로 실행하지 않음
- External Link에 안전 속성 적용
- Secret 형태 Field는 Canonical Projection 전에 제거

### 15.3 감사 대상

- Report 요청·생성·발행·정정·철회
- Template 승인·활성화·폐기
- Source Manifest 검증 실패
- Artifact Redaction과 공유
- Delivery 요청·실패·재시도
- 운영자 재생성

---

## 16. Event와 비동기 처리

### 16.1 수신 Event

```text
LongTermEvaluationCompleted
MomentumEvaluationCompleted
PortfolioSnapshotCreated
CapitalAllocationDecisionCreated
RiskAlertRaised
PositionClosed
LearningReviewCompleted
ModelValidationCompleted
ScoreChangeExplained
```

### 16.2 발행 Event

```text
ReportGenerationRequested
ReportGenerated
ReportGenerationBlocked
ReportArtifactGenerated
ReportPublished
ReportSuperseded
ReportDeliveryRequested
ReportDelivered
ReportDeliveryFailed
```

### 16.3 트랜잭션 경계

Canonical Report + Audit + Outbox는 하나의 트랜잭션으로 저장한다. Artifact 생성과 Delivery는 별도 재시도 가능 작업이다.

원본 Engine은 `ReportGenerationRequested`만 발행하며 Report 완료를 기다리지 않는다.

---

## 17. 재시도·멱등성·부분 실패

### 17.1 생성 멱등성

```text
userId + reportType + periodStart + periodEnd + dataAsOf
+ templateVersion + sourceManifestHash + revisionPurpose
```

같은 Key와 같은 Payload는 기존 결과를 반환한다. 같은 Key와 다른 Payload는 409다.

### 17.2 부분 실패

- JSON 성공, Markdown 성공, PDF 실패 → `PARTIALLY_SUCCEEDED`
- Canonical Projection 실패 → Artifact 생성 없음
- Notification 실패 → Report 상태 유지, Delivery만 실패
- Optional Source 실패 → Warning과 Coverage 감소
- Required Source 실패 → `BLOCKED`

### 17.3 Replay

Replay는 원본 Source Manifest·Template·Locale·Timezone을 사용한다.

- 운영 Report Revision을 변경하지 않음
- 결과 Hash 비교 제공
- Renderer 변경 비교 가능
- Source를 최신 Revision으로 교체하지 않음
- `replayOfReportId`와 코드 버전 저장

---

## 18. 관측성

### 18.1 Metric

- Report 생성 성공/차단/실패율
- 유형별 생성 지연 p50/p95/p99
- Source Coverage 분포
- Stale/Conflict/Ownership 차단 수
- Artifact Format별 성공률과 생성 시간
- Delivery 성공률·재시도·영구 실패율
- Replay Hash 불일치 수
- Template Version별 오류율
- Report 조회 후 승인/거부/No-action 비율

### 18.2 Log

구조화 로그는 다음을 포함한다.

- requestId, correlationId, userId hash
- reportId, runId, reportType, revision
- source count/hash, template/renderer version
- status, warning/blocker code
- elapsedMs, attempt

Source 본문, Portfolio 절대 금액, Secret, Token은 로그에 남기지 않는다.

### 18.3 Alert

- 동일 Source Manifest Replay Hash 불일치
- Ownership/RLS 실패 급증
- Report 생성 지연 SLO 초과
- 필수 Source Coverage 급락
- Delivery Provider 연속 실패
- 활성 Template 없음
- Published Artifact Hash 불일치

---

## 19. 테스트 전략

### 19.1 Unit

- 날짜·기간·Locale·Timezone 검증
- Source 안정 정렬과 Manifest Hash
- 필수 Source 및 소유권 검증
- Point-in-time 위반 차단
- Section 순서와 Statement Kind
- 최우선 Recommendation 정확히 하나
- 매수 Recommendation의 반대 근거 의무
- Blocked 보고서의 `executable: false`
- Markdown Escape와 Notification 축약
- 같은 입력의 동일 Result/Artifact Hash

### 19.2 Contract

- 모든 Report Type의 필수 Source/Section
- JSON Schema와 TypeScript 계약 일치
- Error Code 매핑
- `SCORED/BLOCKED/UNAVAILABLE` 표시 분리
- Decimal 문자열이 Renderer에서 정밀도 손실 없이 표시

### 19.3 Integration

- Request → Manifest → Canonical → Artifact → Audit/Outbox
- 사용자 교차 Source 참조 거부
- Idempotency 동일 요청 반환/다른 Payload 충돌
- Revision 단선 계보와 기존 Revision 불변
- Artifact 일부 실패 후 Format 단위 재시도
- Delivery 실패가 Report 상태에 영향 없음
- Report 실패가 원본 Evaluation/Decision에 영향 없음

### 19.4 Database

- RLS 교차 사용자 차단
- Published Row Update/Delete Trigger
- Revision·Idempotency Unique Constraint
- Source `available_at <= data_as_of`
- Artifact Cache 삭제 후 동일 Hash 재생성
- Audit + Outbox 원자성

### 19.5 Replay/Golden

- 같은 Manifest·Template·Renderer의 byte-stable Markdown
- 입력 Source 배열 순서 변경에도 동일 Hash
- Template Version 변화 시 기대된 Diff만 발생
- Locale별 Golden Snapshot
- 과거 보고서에 미래 Source가 포함되지 않음

---

## 20. 실패 시나리오

| 상황 | 처리 |
|---|---|
| Portfolio Snapshot 누락 | Monthly Report BLOCKED |
| Proposal 만료 | 승인 링크 비활성, 새 Proposal 필요 |
| Scorecard `BLOCKED` | 0점 대신 산출 불가와 원인 표시 |
| Score 변화 설명 없음 | 변화 Section 경고, 행동 근거 제외 |
| Source Hash 불일치 | 생성 차단 및 운영 Alert |
| Optional PDF 실패 | JSON/Markdown 발행, 부분 성공 |
| Notification Provider 실패 | Report 유지, Delivery 재시도 |
| 과거 보고서 재생성 | 고정 Manifest 사용 |
| Template 폐기 | 기존 보고서 조회 가능, 신규 생성 금지 |
| 사용자 소유권 불일치 | 403, 어떤 Source가 존재하는지 노출 금지 |
| Agent 문장에 Citation 없음 | Canonical Statement 채택 거부 |
| 모든 후보 부적합 | `HOLD_CASH`를 정상 결론으로 발행 |

---

## 21. 구현 단계

### Phase 1 — Canonical Core

- report-v1 Type, Validation, Stable Hash
- Source Manifest와 Quality Gate
- Template Registry와 유형별 필수 계약
- 결정론적 Markdown/Notification Renderer
- 기존 `report.ts` Legacy API 유지

### Phase 2 — Persistence/API

- Report·Artifact·Revision Repository
- 생성·조회·Artifact·Replay API
- Audit + Transactional Outbox
- `011_report_system_v1.sql`

### Phase 3 — Delivery/Operations

- Delivery 상태와 재시도
- PDF/Web Renderer Adapter
- Scheduler와 Event Consumer
- 운영 Metric·Alert·Runbook

### Phase 4 — Calibration

- 사용자 행동과 Report 유용성 분석
- Template 개선은 Model/Policy 변경과 분리
- Golden/Replay 회귀 검증

---

## 22. Definition of Done

### 22.1 Core

- [x] Canonical Report와 Source Manifest가 불변인가?
- [x] Point-in-time·소유권·Hash를 검증하는가?
- [x] 결론→변화→근거→반대 근거→위험→행동 순서를 강제하는가?
- [x] Fact·Estimate·Interpretation·Recommendation이 분리되는가?
- [x] 최우선 Recommendation이 정확히 하나인가?
- [x] `BLOCKED/UNAVAILABLE`를 0점으로 표현하지 않는가?
- [x] 같은 입력이 같은 Result Hash를 만드는가?

### 22.2 API/DB

- [x] 쓰기 멱등성과 Revision 단선 계보가 있는가?
- [x] Report + Audit + Outbox가 원자 저장되는가?
- [x] Published Report·Artifact Update/Delete가 차단되는가?
- [x] 사용자별 RLS가 적용되는가?
- [x] Artifact 부분 실패와 Delivery 실패가 분리되는가?

### 22.3 Security/Operations

- [x] Report Composer가 원본 Domain을 수정할 권한이 없는가?
- [x] 외부·사용자·Agent 문자열을 Escape하는가?
- [ ] 운영 Adapter에서 Secret과 민감 금액이 Log/Notification에 노출되지 않는가?
- [ ] 운영 Metric에서 Replay Hash와 Artifact Hash를 감시하는가?
- [x] Artifact Cache 삭제 후 재현 가능한가?

---

## 23. 수용 기준

1. 같은 Source Manifest, Template Version, Locale로 두 번 생성한 Canonical `resultHash`가 같다.
2. Source 입력 순서를 섞어도 결과와 Markdown Hash가 같다.
3. 미래 `availableAt` Source가 하나라도 있으면 생성이 차단된다.
4. 다른 사용자의 Source를 참조하면 403이며 존재 여부를 노출하지 않는다.
5. Monthly Report는 Portfolio Snapshot·배분 결과·Risk/Policy 계보 없이는 행동 가능 상태가 되지 않는다.
6. 매수 또는 신규 위험 Recommendation은 Counter Evidence 없이는 차단된다.
7. `BLOCKED` Scorecard는 0점으로 렌더링되지 않는다.
8. `HOLD_CASH`와 `NO_ACTION`은 실패가 아니라 유효한 결론이다.
9. Published Revision의 변경은 실패하고 정정은 새 Revision으로만 가능하다.
10. PDF 실패 시 JSON/Markdown Report는 유지되고 PDF만 재시도된다.
11. Notification 실패가 Report를 실패 상태로 변경하지 않는다.
12. Replay는 원본 Manifest를 사용하며 운영 Revision을 만들지 않는다.
13. Legacy Report API와 v1 Canonical API가 공존한다.
14. Report 생성 실패가 원본 Evaluation, Proposal, Decision을 롤백하지 않는다.
15. 전체 테스트·타입 검사·빌드가 통과한다.

---

## 24. 운영 전 추가 필요사항

코드 구현과 별개로 실제 운영에는 다음이 필요하다.

- 사용자 Locale·Timezone·Notification 선호 설정
- 활성 Template의 Human Approval
- Web/PDF 저장소와 Signed URL 정책
- Email/Push/Slack 등 Delivery Provider와 Secret 관리
- Scheduler·Event Consumer 배포
- Source별 Freshness·Coverage 운영 기준
- 개인정보·금융정보 Redaction 정책
- Report 보존·Archive·삭제 Runbook
- PDF 폰트·접근성·페이지 Golden 검증
- 실사용자 대상 가독성·행동 오해 가능성 검토

이 항목이 없어도 Canonical Domain, API, Migration, 테스트는 구현할 수 있다. 자동 주문은 계속 범위 밖이다.
