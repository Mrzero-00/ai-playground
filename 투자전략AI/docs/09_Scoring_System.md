# 09. Scoring System Specification

> Investment OS의 Long-term·Future Core·Momentum 점수를 같은 안전 규약으로 계산하되 서로 다른 의미와 모델 버전을 보존하는 결정론적 Scoring 계층 명세

- 문서 버전: `v1.0.0`
- 작성일: `2026-07-22`
- 최종 검토일: `2026-07-23`
- 명세 상태: `SPECIFICATION BASELINE`
- 구현 준비도: `R1 CORE/API/SCHEMA IMPLEMENTED / R2+ OPEN`
- 선행 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1, `03`~`08` 명세
- 후속 문서: `10_Report_System.md`, `11_UI_UX.md`, `12_Roadmap.md`
- 구현 기준: TypeScript 순수 함수 / PostgreSQL·Supabase `010_scoring_system_v1.sql`

---

## 0. 문서의 역할

이 문서는 점수를 하나 더 만드는 문서가 아니다. 각 전략 Engine이 소유한 Factor 의미를 침범하지 않으면서 다음 공통 규약을 확정한다.

1. 원시 관측치를 어떤 방향과 범위로 정규화하는가.
2. `AVAILABLE`, `PARTIAL`, `NOT_APPLICABLE`, `UNKNOWN`, `STALE`, `CONFLICTED`를 어떻게 구분하는가.
3. 가중치·N/A 재정규화·Score Range·반올림을 어떻게 결정론적으로 계산하는가.
4. Score, Confidence, Gate, Action, Size를 어떻게 분리하는가.
5. Model Version이 다른 점수를 어떻게 비교하지 않을 것인가.
6. 점수 변화 원인을 어떻게 Contribution·Input·Model 변화로 분해하는가.
7. Calibration과 Learning이 운영 점수를 자동 변경하지 않도록 어떻게 통제하는가.

### 0.1 소유권

| 책임 | 소유 문서/모듈 |
|---|---|
| Long-term Factor 의미·산업 적용성·진입 임계치 | `03_LongTerm_Engine.md` |
| Momentum Factor·Setup·세션·진입 임계치 | `04_Momentum_Engine.md` |
| Score를 Size Tier 입력으로 사용하는 법 | `05_Portfolio_Engine.md` |
| Calibration·Model Change 검증 | `06_Learning_Engine.md` |
| Agent Claim과 결정론 결과 충돌 처리 | `07_AI_Agents.md` |
| 영속성·불변성·Lineage | `08_Database.md` |
| 공통 정규화·합성·상태·비교·설명 규약 | 이 문서 |

### 0.2 규범 우선순위

1. 법적·보안·사용자 소유권
2. `01`의 전략 분리·승인 경계·Point-in-time
3. `02`의 Evidence·Unknown·Confidence·Risk 철학
4. `03`·`04`의 전략별 Factor/Gate 정책
5. `05`·`06`의 배분·학습 거버넌스
6. 이 문서의 공통 계산 규약

---

## 1. 선행 문서 충돌 검토

| 항목 | 선행 계약 | 09의 해석 | 결론 |
|---|---|---|---|
| 전략 독립성 | Long-term과 Momentum은 서로의 점수를 호출·합성하지 않음 | Scorecard Scope·Model Registry·Ranking 분리 | 충돌 없음 |
| Core/Future Core | 같은 회사라도 별도 Profile | 별도 Model ID·Factor Set·Threshold | 충돌 없음 |
| Gate 우선 | 치명적 위험은 높은 평균 점수로 상쇄 불가 | Score 결과와 Gate 결과를 별도 필드로 유지 | 충돌 없음 |
| Confidence | 점수와 분리 | Confidence Formula·Cap·등급을 별도 결과로 저장 | 충돌 없음 |
| N/A | 사전 선언된 경우만 재정규화 | Model Factor Policy로만 허용 | 충돌 없음 |
| 최소 적용 가중치 | Long-term 기본 85, Momentum 90 | 전략별 Model Policy 값 | 충돌 아님 |
| Risk 방향 | 위험 점수 방향 명시 | 모든 Metric에 Direction Metadata 필수 | 충돌 없음 |
| Portfolio | Score는 Size를 직접 결정하지 않음 | Scorecard는 금액·비중·수량을 출력하지 않음 | 충돌 없음 |
| Learning | 자동 가중치 변경 금지 | DRAFT→SHADOW→APPROVED→ACTIVE 상태 전이 | 충돌 없음 |
| Agent | Agent가 점수·Gate를 확정하지 않음 | Agent 값은 Observation Candidate, Engine이 재계산 | 충돌 없음 |
| Database | DB Trigger에서 점수 계산 금지 | Application 순수 함수 계산 후 불변 저장 | 충돌 없음 |

### 1.1 구현상 해소해야 할 모호성

현재 Long-term v1과 Momentum v1은 Factor가 차단되면 Eligibility를 막지만 호환용 `ScoreRange`에 `0/0/0`을 기록한다. 이는 “계산 불가를 0점으로 대체하지 않는다”는 `01`·`02` 원칙을 하위 소비자가 오해할 수 있다.

09 구현은 다음을 적용한다.

- 표준 결과는 `status: SCORED | BLOCKED | UNAVAILABLE`을 먼저 읽는다.
- `BLOCKED/UNAVAILABLE`에는 총점이 존재하지 않는다.
- 기존 Engine v1의 `0/0/0`은 API 호환 필드로만 유지하고 `scoreStatus`를 함께 제공한다.
- Ranking·Portfolio·Report는 `scoreStatus !== SCORED`인 값을 0점으로 정렬하지 않고 제외/별도 표시한다.

---

## 2. 목표와 비목표

### 2.1 목표

- 모든 점수의 범위·방향·단위·정규화식을 Version으로 고정한다.
- 동일 입력·Model·Code Version은 동일 결과와 Hash를 만든다.
- Factor별 Contribution과 Evidence를 통해 총점을 역추적한다.
- Unknown과 N/A를 구조적으로 구분한다.
- Missing이 줄었다는 이유만으로 점수·Confidence가 부당하게 상승하지 않게 한다.
- Score Range와 Confidence를 병렬 제공한다.
- 같은 모델·같은 Scope 안에서만 Ranking한다.
- Model 변경 전후 점수는 Migration/Shadow 결과로 구분한다.
- 점수 변화 원인을 Data·Factor·Weight·Policy 변화로 분해한다.

### 2.2 비목표

- 서로 다른 전략 점수를 하나의 Universal Score로 합성
- 점수만으로 매수·매도·주문·승인 확정
- Portfolio 상태를 기업·Setup 품질 점수에 반영
- Confidence를 점수에 곱해 하나의 숫자로 숨김
- 결측값에 0·50·평균·직전값 자동 대입
- Agent 자연어 판단을 검증 없이 Factor Score로 사용
- Production 분포를 보고 자동으로 Weight·Threshold 변경
- DB Stored Procedure나 Trigger에서 투자 점수 계산
- 과거 Model Version 결과를 현재 Version으로 덮어쓰기

---

## 3. 핵심 불변식

| ID | 불변식 | 검증 |
|---|---|---|
| SCORE-INV-001 | Long-term, Future Core, Momentum 점수는 직접 비교·합성하지 않는다. | Scope 타입·Ranking 검사 |
| SCORE-INV-002 | Score는 Gate·Action·Size·Approval이 아니다. | Output Schema·통합 테스트 |
| SCORE-INV-003 | 모든 값은 `[0,100]`이고 Direction을 명시한다. | Model Validator |
| SCORE-INV-004 | UNKNOWN/STALE/CONFLICTED는 N/A 재정규화 대상이 아니다. | Availability 테스트 |
| SCORE-INV-005 | N/A는 활성 Model이 사전 허용한 Factor에만 가능하다. | Model/Scorecard 검사 |
| SCORE-INV-006 | Critical Factor는 N/A가 될 수 없다. | Model Validator |
| SCORE-INV-007 | 적용 가중치가 Model 최소치보다 작으면 총점을 계산하지 않는다. | Property Test |
| SCORE-INV-008 | 출처 A~C의 Score Eligible Evidence 없는 Factor는 점수화하지 않는다. | Evidence Join 검사 |
| SCORE-INV-009 | Confidence는 Score와 별도 계산·저장한다. | Schema 검사 |
| SCORE-INV-010 | Hard Gate 실패를 총점으로 상쇄하지 않는다. | Action 통합 테스트 |
| SCORE-INV-011 | Model Version이 다른 결과는 같은 Ranking에 넣지 않는다. | Ranking Validator |
| SCORE-INV-012 | 동일 입력·정책은 정렬 순서와 무관하게 같은 Hash를 만든다. | Determinism Test |
| SCORE-INV-013 | Historical Replay는 운영 상태·활성 Model을 변경하지 않는다. | Replay 테스트 |
| SCORE-INV-014 | AI Agent는 Final Score·Gate·Threshold를 덮어쓰지 못한다. | Agent Output Validator |
| SCORE-INV-015 | Learning 결과는 승인·Shadow 없이 활성 점수를 바꾸지 않는다. | Model 상태 전이 테스트 |

---

## 4. 용어와 타입

### 4.1 Scope

```ts
type ScoreScope =
  | 'LONG_TERM_CORE'
  | 'LONG_TERM_FUTURE_CORE'
  | 'MOMENTUM_SETUP';
```

Scope가 다르면 같은 숫자라도 의미가 다르다. `CORE 80`은 사업의 장기 복리 적합성이고 `MOMENTUM 80`은 특정 Setup의 시점 품질이다.

### 4.2 방향

```ts
type ScoreDirection =
  | 'HIGHER_IS_BETTER'
  | 'HIGHER_IS_WORSE'
  | 'TARGET_IS_BEST';
```

- 최종 합성에는 `HIGHER_IS_BETTER`로 정렬된 품질 점수만 사용한다.
- 위험 원시 지표는 `HIGHER_IS_WORSE`로 정의한 뒤 `qualityScore = 100 - riskScore`처럼 명시적으로 변환한다.
- `TARGET_IS_BEST`는 중심값과 좌우 허용 범위를 Version에 저장한다.
- 호환 `riskScore`는 `riskScoreDirection` 없이는 외부로 내보내지 않는다.

### 4.3 Availability

```ts
type MetricAvailability =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN'
  | 'STALE'
  | 'CONFLICTED';
```

| 상태 | 의미 | 점수 | 가중치 |
|---|---|---|---|
| AVAILABLE | 기준시각에 충분하고 검증됨 | 가능 | 포함 |
| PARTIAL | 일부 정보만 존재, 허용 범위 명시 | 가능, Cap/Warning | 포함 |
| NOT_APPLICABLE | 사전 Model/Industry/Setup 정책상 비적용 | 금지 | 제외 후 재정규화 |
| UNKNOWN | 수집·계산 불가 | 금지 | 차단 |
| STALE | Freshness 기준 초과 | 금지 | 차단 |
| CONFLICTED | 중요 출처가 허용 오차 밖에서 충돌 | 금지 | 차단 |

### 4.4 Score 상태

```ts
type ScoreStatus = 'SCORED' | 'BLOCKED' | 'UNAVAILABLE';
```

- `SCORED`: 모든 Critical 조건과 최소 적용 가중치를 충족해 범위를 계산함
- `BLOCKED`: 입력은 있으나 데이터·Evidence·정책 위반으로 계산을 금지함
- `UNAVAILABLE`: 해당 Scope/Model 자체가 적용되지 않거나 평가가 아직 생성되지 않음

`BLOCKED`와 `UNAVAILABLE`은 점수 0이 아니다.

### 4.5 표준 결과

```ts
interface ScoreRangeV1 {
  point: number;
  low: number;
  high: number;
  sensitivityDriverIds: string[];
}

interface ScorecardResultV1 {
  id: string;
  userId: string;
  subjectType: 'COMPANY' | 'SECURITY' | 'SETUP' | 'REVIEW_COHORT';
  subjectId: string;
  scope: ScoreScope;
  status: ScoreStatus;
  score?: ScoreRangeV1;
  confidence: ConfidenceResultV1;
  factorResults: FactorScoreResultV1[];
  blockerCodes: string[];
  modelVersionId: string;
  philosophyVersionId: string;
  industryProfileVersionId?: string;
  setupDefinitionVersion?: string;
  snapshotIds: string[];
  evidenceIds: string[];
  asOf: string;
  evaluatedAt: string;
  codeVersion: string;
  resultHash: string;
}
```

---

## 5. Model Version 계약

### 5.1 상태

```text
DRAFT -> VALIDATING -> SHADOW -> APPROVED -> ACTIVE -> DEPRECATED
  |          |           |          |
  +-------> REJECTED <---+----------+
```

- `ACTIVE`만 운영 평가를 생성한다.
- Scope별 활성 Model은 한 개다.
- `SHADOW`는 운영 Action/Size/승인을 만들지 않는다.
- `DEPRECATED` 결과는 재현·조회할 수 있으나 신규 운영 평가에 사용하지 않는다.
- Hard Safety를 완화하는 변경은 `01` Architecture Revision을 요구한다.

Model의 Factor·Weight·정규화·Threshold로 구성된 `modelHash`는 상태 전이로 바뀌지 않는다. 상태만 통제된 UPDATE를 허용하고, 후속 Version이 `ACTIVE`가 되면 기존 활성 Version은 같은 저장 작업에서 `DEPRECATED`로 전환한다.

### 5.2 Model 정의

```ts
interface ScoreModelV1 {
  id: string;
  version: string;
  scope: ScoreScope;
  status: 'DRAFT' | 'VALIDATING' | 'SHADOW' | 'APPROVED' | 'ACTIVE' | 'DEPRECATED' | 'REJECTED';
  factorDefinitions: FactorDefinitionV1[];
  minimumApplicableWeight: number;
  thresholds: ScoreThresholdV1[];
  confidencePolicy: ConfidencePolicyV1;
  effectiveFrom: string;
  approvedBy?: string;
  approvedAt?: string;
  supersedesModelVersionId?: string;
  changeReason: string;
  modelHash: string;
}
```

### 5.3 Weight

- 저장 단위는 정수 `basisPoints`, 총합 `10_000`이다.
- 표시/API에서만 `0~100` Percent로 변환할 수 있다.
- 부동소수점 Weight 합 허용 오차로 잘못된 Model을 승인하지 않는다.
- 동일 Factor ID 중복, 0 이하 Weight, 합계 불일치는 거부한다.
- N/A 재정규화 시에도 원본 Weight와 Effective Weight를 모두 저장한다.

### 5.4 변경 분류

| 변경 | Version | 검증 |
|---|---|---|
| 설명 문구·UI Label | Patch | Snapshot |
| Threshold·Cap·정규화 경계 | Minor 이상 | Replay+Walk-forward+Shadow |
| Factor 추가/삭제·의미·방향 변경 | Major | Architecture/Philosophy 영향 검토 |
| Hard Gate 완화 | Architecture Revision | 별도 Human Approval |

적용된 Model Version을 수정하지 않고 새 Version을 생성한다.

---

## 6. Factor 정의

```ts
interface FactorDefinitionV1 {
  id: string;
  label: string;
  direction: ScoreDirection;
  weightBasisPoints: number;
  critical: boolean;
  allowedNotApplicable: boolean;
  normalization: NormalizationPolicyV1;
  evidencePolicy: EvidencePolicyV1;
  partialScoreCap?: number;
  effectiveFrom: string;
}
```

Factor 정의에는 사람이 해석할 수 있는 질문, 원시 Metric 단위, Score Anchor, 산업/Setup 적용 조건, Evidence 요구 수준이 포함되어야 한다.

### 6.1 Factor Score Anchor

| 점수 | 공통 의미 |
|---:|---|
| 90~100 | 매우 강함, 복수 독립 근거와 반증 검토 완료 |
| 80~89.99 | 강함, 핵심 근거 충분 |
| 70~79.99 | 양호, 일부 불확실성 존재 |
| 60~69.99 | 보통 이상, 추가 확인 필요 |
| 40~59.99 | 혼재·중립이 아니라 명시적 약점과 강점 공존 |
| 20~39.99 | 약함, 개선 증거 부족 |
| 0~19.99 | 매우 약함 또는 명시적 부정 증거 |

`50`은 결측 기본값이 아니다. 실제 관측치가 Anchor상 50에 해당할 때만 사용한다.

### 6.2 Evidence 정책

```ts
interface EvidencePolicyV1 {
  minimumSourceTier: 'A' | 'B' | 'C';
  minimumDistinctSources: number;
  counterEvidenceRequired: boolean;
  maximumAgeSeconds?: number;
  pointInTimeRequired: true;
}
```

- A~C의 `scoreEligible=true` Evidence만 Score에 기여한다.
- D는 탐색·Inference 보조, E/F는 탐지·경고 전용이다.
- 동일 원문을 재배포한 여러 링크는 독립 출처로 세지 않는다.
- Counter Evidence를 제거하면 Score/Confidence가 상승해서는 안 된다.
- `availableAt <= asOf <= evaluatedAt`을 강제한다.

---

## 7. 정규화

### 7.1 원칙

- 정규화 경계는 평가 시점의 Model Version에 고정한다.
- 같은 Raw 값이라도 산업·Setup이 다르면 별도 Factor Definition을 쓴다.
- 미래 전체 표본의 Min/Max를 과거 평가에 사용하지 않는다.
- Cross-sectional Percentile은 당시 Universe Snapshot만 사용한다.
- Winsorization 경계도 당시 학습/정책 Snapshot에 고정한다.

### 7.2 선형 정규화

`HIGHER_IS_BETTER`:

```text
score = clamp(100 * (x - floor) / (ceiling - floor), 0, 100)
```

`HIGHER_IS_WORSE`:

```text
score = 100 - clamp(100 * (x - floor) / (ceiling - floor), 0, 100)
```

`floor < ceiling`이어야 한다. 원시값이 범위를 벗어나면 Score를 Clamp하되 `OUTSIDE_CALIBRATION_RANGE` Warning을 기록한다.

### 7.3 Piecewise Anchor

비선형 Factor는 정렬된 `(raw, score)` Anchor를 사용한다.

```text
[(raw0, score0), (raw1, score1), ...]
```

- Raw Anchor는 엄격히 증가한다.
- Direction에 맞게 Score Anchor가 단조여야 한다.
- 구간 사이는 선형 보간한다.
- Anchor 밖은 Clamp하고 Warning을 남긴다.

### 7.4 Target Band

`TARGET_IS_BEST`는 `idealMin <= idealMax`와 좌우 Hard Boundary를 가진다.

- Ideal Band 내부: 100
- 좌우 Boundary까지: Piecewise 감소
- Boundary 밖: 0과 `OUTSIDE_TARGET_BOUNDARY`

비대칭 위험이면 좌우 기울기를 다르게 정의한다.

### 7.5 Percentile/Z-score

Cross-sectional 정규화는 다음 Manifest가 없으면 금지한다.

- Universe Policy Version
- Session/AsOf
- 대상 ID 집합 Hash
- Winsorization 경계
- 평균·표준편차 또는 순위 방식
- 최소 표본 수

표본 수 미달, 0 분산, Survivor Bias가 있으면 `BLOCKED`다. 전체 미래 기간을 사용한 Z-score는 Point-in-time 위반이다.

### 7.6 주관 평가 Rubric

정성 Factor는 자유로운 0~100 입력 대신 Version된 Anchor를 사용한다.

```ts
interface RubricAnchorV1 {
  score: 0 | 20 | 40 | 60 | 80 | 100;
  requiredFacts: string[];
  disqualifyingFacts: string[];
  evidencePolicy: EvidencePolicyV1;
}
```

Anchor 사이 값은 명시적 근거가 있을 때만 허용한다. Agent가 제안한 Anchor는 Domain Validator가 Evidence와 결정론 규칙으로 확인한다.

---

## 8. Factor 평가

```ts
interface FactorObservationV1 {
  factorId: string;
  availability: MetricAvailability;
  rawValue?: string;
  preNormalizedScore?: number;
  bearScore?: number;
  bullScore?: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  observedAt: string;
  availableAt: string;
  explanation: string;
}
```

### 8.1 검증 순서

1. Factor가 Model에 존재하는지 검사
2. 시각·Snapshot·Evidence 소유권 검사
3. Availability와 값 존재 규칙 검사
4. N/A 허용·Critical 여부 검사
5. Raw 정규화 또는 사전 점수 Rubric 검사
6. Bear ≤ Point ≤ Bull 검사
7. Partial Cap과 Warning 적용
8. Contribution 계산

### 8.2 결과

```ts
interface FactorScoreResultV1 {
  factorId: string;
  status: 'SCORED' | 'BLOCKED' | 'NOT_APPLICABLE';
  availability: MetricAvailability;
  direction: ScoreDirection;
  score?: number;
  low?: number;
  high?: number;
  originalWeightBasisPoints: number;
  effectiveWeightBasisPoints: number;
  contribution?: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  warningCodes: string[];
  explanation: string;
}
```

### 8.3 Partial

`PARTIAL`은 자동 N/A가 아니다.

- 점수를 계산할 최소 관측치는 충족해야 한다.
- Factor별 `partialScoreCap`을 적용한다.
- Confidence Cap/감점을 별도 적용한다.
- 부족한 정보와 다음 확인 조건을 기록한다.
- Critical Input 일부가 없으면 Partial이 아니라 UNKNOWN/BLOCKED다.

---

## 9. 가중 합성과 N/A

### 9.1 공식

원본 Weight 합은 `10_000bp`다.

```text
applicableWeight = Σ originalWeight_i where status = SCORED
effectiveWeight_i = originalWeight_i / applicableWeight
point = Σ score_i × effectiveWeight_i
```

- 계산 중간값은 반올림하지 않는다.
- 공개 결과만 소수점 둘째 자리 Half-up으로 반올림한다.
- 내부 Result Hash는 정렬된 정규화 입력과 명시된 Precision을 사용한다.

### 9.2 N/A 재정규화

다음을 모두 만족할 때만 가능하다.

- 활성 Model/Industry/Setup이 Factor N/A를 사전 허용
- Factor가 Critical이 아님
- Observation이 명시적으로 `NOT_APPLICABLE`
- 점수·Bear·Bull 값이 없음
- 적용 가중치가 Model 최소치 이상

UNKNOWN을 N/A로 바꾸거나, 평가 후 유리한 Factor만 N/A로 제거하면 `MODEL_POLICY_VIOLATION`이다.

### 9.3 차단

다음 중 하나면 `status=BLOCKED`, `score` 없음이다.

- Critical Factor 누락·Unknown·Stale·Conflicted
- 비Critical Factor라도 Model이 Missing 차단 정책을 사용
- 적용 가중치 최소치 미달
- Evidence·Point-in-time 위반
- 중복 Factor·Evidence·불명확한 Direction
- Model/Industry/Setup Version 불일치

---

## 10. Score Range와 민감도

### 10.1 Range

```text
low   = Σ factorLow_i  × effectiveWeight_i
point = Σ factorPoint_i × effectiveWeight_i
high  = Σ factorHigh_i × effectiveWeight_i
```

항상 `0 <= low <= point <= high <= 100`이어야 한다.

### 10.2 Range 작성 규칙

- Bear/Bull 값은 Factor 정의의 동일 Rubric을 사용한다.
- 모르는 값을 임의로 넓은 Range로 대체하지 않는다. 모르면 BLOCKED다.
- Range는 확률 구간이라고 표시하지 않는다.
- Factor별 Spread 기여도를 계산해 상위 3개 Sensitivity Driver를 저장한다.

### 10.3 순위 동률

두 결과의 Range가 겹치면 단일 숫자 순위가 달라도 같은 Tier로 표시할 수 있다. Portfolio는 작은 Point 차이를 확정 우위로 해석하지 않는다.

---

## 11. Confidence

### 11.1 분리 원칙

Score는 “관측된 품질”, Confidence는 “그 점수를 얼마나 신뢰할 수 있는가”다.

```ts
interface ConfidenceResultV1 {
  score: number;
  grade: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
  dimensions: {
    evidenceCoverage: number;
    sourceQuality: number;
    freshness?: number;
    modelFit: number;
    disagreement: number;
  };
  appliedCaps: Array<{ code: string; maximum: number }>;
  warningCodes: string[];
}
```

### 11.2 전략별 공식

Long-term 기본:

```text
0.35 × Evidence Coverage
+ 0.25 × Source Quality
+ 0.25 × Model Fit
+ 0.15 × (100 - Disagreement)
```

Momentum 기본:

```text
0.30 × Evidence Coverage
+ 0.20 × Source Quality
+ 0.20 × Data Freshness
+ 0.20 × Model Fit
+ 0.10 × (100 - Disagreement)
```

공식이 다른 것은 시간축과 데이터 Freshness 민감도가 다르기 때문이며 충돌이 아니다.

### 11.3 Cap

Cap은 감점 후 더하는 방식이 아니라 `min(base, caps...)`다.

공통 예:

- Counter Evidence 없음: 최대 49
- Critical 출처 충돌: 최대 49
- 산업/Setup Model 검증 미완료: 최대 59
- 기업 제공 자료에 주요 Factor 과의존: 최대 59
- Segment 미분리·부분 Volume·부적절 Benchmark: 최대 64

Cap 적용 이유를 모두 저장한다.

### 11.4 등급

| 등급 | 점수 | 의미 |
|---|---:|---|
| HIGH | 80~100 | 표준 판단에 사용 가능, Gate 별도 |
| MEDIUM | 65~79.99 | 제한적 사용, 추가 확인 |
| LOW | 50~64.99 | 관찰·탐색만 가능 |
| UNVERIFIED | 0~49.99 | 신규 위험 확대 금지 |

전략 Engine의 더 엄격한 Threshold가 우선한다.

---

## 12. Gate·Action·Size와의 경계

```text
Observations + Evidence
        ↓
Factor Scorecard + Confidence
        ↓
Strategy Gate / Thesis / Setup / Valuation
        ↓
Action Candidate
        ↓
Portfolio Capacity + Risk Veto
        ↓
User Approval
```

- 높은 Score는 Hard Gate를 통과시키지 않는다.
- Market Regime은 Momentum Setup Score에 곱하지 않는다.
- Valuation 분류·Thesis Break는 Long-term Score와 별도 Action 입력이다.
- Score는 요청 금액·수량을 직접 계산하지 않는다.
- Portfolio는 Score/Confidence로 사전 정의된 Tier를 선택할 수 있지만 Hard Capacity를 늘리지 못한다.
- 사용자 승인은 Score를 수정하는 행위가 아니다.

---

## 13. 전략별 기본 Model

### 13.1 Long-term Core

| Factor | Weight |
|---|---:|
| Business Durability | 20 |
| Moat | 15 |
| Growth Durability | 15 |
| Management/Capital Allocation | 10 |
| Financial/FCF | 15 |
| Valuation | 15 |
| Risk Resilience | 10 |

- 신규 Core 기본 Gate: Score 78, Confidence 75
- 기존 Core 유지 검토: Score 70, Confidence 65
- 핵심 Factor·관찰 기간·Thesis·Valuation Gate는 `03`을 따른다.
- 최소 적용 가중치 기본 85, Industry Profile이 더 높게 설정 가능하다.

### 13.2 Future Core

| Factor | Weight |
|---|---:|
| Market Growth | 20 |
| Product Proof | 15 |
| Moat Formation | 15 |
| Unit Economics | 15 |
| Management Execution | 10 |
| Survival/Dilution | 15 |
| Valuation Asymmetry | 10 |

- 기본 Gate: Score 75, Confidence 65
- Product Proof·Survival/Dilution·Stress Runway·관찰 기간은 별도 Hard 조건이다.
- Core 점수가 없거나 낮다는 이유만으로 Future Core를 차단하지 않는다.

### 13.3 Momentum Setup

| Factor | Weight |
|---|---:|
| Relative Strength | 20 |
| Sector Leadership | 10 |
| Price Structure | 20 |
| Volume Confirmation | 15 |
| Catalyst Quality | 15 |
| Liquidity/Execution | 10 |
| Reward/Risk Timing | 10 |

- 신규 Entry 후보 기본 Gate: Score 75, Confidence 70
- Score 65~74.99: `WAIT`, 65 미만: 원칙적으로 `AVOID`
- 최소 적용 가중치 90
- Universe·Regime·Event·Liquidity·Price/Chase·Plan Gate는 별도다.

### 13.4 Cross Signal

Cross Signal은 새로운 점수를 만들지 않는다.

```text
Long High + Momentum High -> DUAL_HIGH
Long High + Momentum Low  -> LONG_ONLY
Long Low  + Momentum High -> MOMENTUM_ONLY
Long Low  + Momentum Low  -> LOW_CONVICTION
```

High/Low 임계치는 각 Evaluation의 Scope·Model Version에 속한다. 서로의 숫자를 평균하지 않는다.

---

## 14. Ranking

### 14.1 비교 가능 조건

Ranking 집합은 다음이 같아야 한다.

- `scope`
- `modelVersionId`
- `philosophyVersionId`
- Industry/Setup 비교 정책
- Momentum의 경우 Universe Policy·Session
- 기준 통화가 필요한 파생 지표의 FX Snapshot 정책
- `status=SCORED`

### 14.2 안정 정렬

기본 정렬:

1. Eligibility Tier
2. Score Point 내림차순
3. Confidence 내림차순
4. Score Range 폭 오름차순
5. Subject ID 오름차순

Model Version이 다르면 별도 목록으로 나눈다. Gate 실패 결과는 “투자 가능 Ranking”에서 제외하고 분석 목록에만 표시한다.

### 14.3 Percentile

Percentile은 Score 자체를 바꾸지 않는 표시값이다. Universe·Session·표본 Hash를 함께 저장한다.

---

## 15. 점수 변화 설명

### 15.1 같은 Model Version

```text
Total Delta = Σ Contribution Delta
```

Factor별로 다음을 기록한다.

- 이전/현재 Raw Value
- 이전/현재 Availability
- 이전/현재 Score·Weight·Contribution
- 새 Evidence·제거/정정된 Evidence
- Data Freshness·Conflict 변화
- Bear/Base/Bull 변화

### 15.2 Model Version 변경

동일 입력 Snapshot에 이전·신규 Model을 모두 실행한다.

```text
Observed Delta = Data Delta + Model Delta + Interaction Residual
```

- Data Delta: 이전 Model로 새 입력 재평가
- Model Delta: 같은 새 입력에 신규 Model 적용
- Residual: 비선형/상호작용 차이

서로 다른 Model 점수 차이를 기업의 실제 변화로 표시하지 않는다.

### 15.3 설명 계약

```ts
interface ScoreChangeExplanationV1 {
  id: string;
  previousScorecardId: string;
  currentScorecardId: string;
  comparisonStatus: 'COMPARABLE' | 'MODEL_CHANGED' | 'NOT_COMPARABLE';
  pointDelta?: number;
  confidenceDelta: number;
  factorDeltas: FactorContributionDeltaV1[];
  reasonCodes: string[];
  evidenceAddedIds: string[];
  evidenceRemovedOrCorrectedIds: string[];
  resultHash: string;
}
```

설명 없는 점수 변경을 Report/UI에 표시하지 않는다.

---

## 16. Calibration과 검증

### 16.1 Score는 확률이 아니다

Score 80을 “상승 확률 80%”로 표시하지 않는다. Calibration은 Strategy별 Outcome과 Horizon을 정의한 뒤 점수 구간의 결과 분포를 측정한다.

### 16.2 검증 단위

Long-term:

- 3/5년 Thesis 유지·훼손
- FCF·ROIC·성장 지속성
- Permanent Impairment·Drawdown
- Valuation 기대수익 실현 범위

Momentum:

- Setup Horizon 내 Trigger·Invalidation
- 비용 차감 R-multiple
- Win Rate, Expectancy, Tail Loss
- Regime·Liquidity·Setup별 분해

### 16.3 필수 검증

- Historical Replay Point-in-time
- Purged/Embargoed Walk-forward
- Survivorship/Delisting/Corporate Action 포함
- 거래 비용·Slippage 포함
- 산업·Regime·Liquidity·시가총액 Cohort
- Calibration Curve·단조성
- Score Distribution·Missing·N/A Drift
- Tail Loss·Turnover·Concentration Guardrail
- Shadow 운영

### 16.4 승격 금지 조건

- 표본·성숙도 Gate 미달
- 미래 정보·수정 데이터 누출
- Tail Risk 악화
- 특정 회사·산업·Regime 집중
- Missing 감소만으로 겉보기 성능 개선
- 운영 Score 분포가 예상 범위 밖
- 설명률·Evidence Coverage 저하

---

## 17. Drift

### 17.1 관측 대상

- Raw Feature 분포
- Factor Score·Contribution 분포
- Total Score·Range 폭
- Confidence·Cap 사유
- Availability 비율
- N/A 비율
- Gate Failure 비율
- Ranking Turnover
- Outcome Calibration

### 17.2 경보와 대응

Drift는 자동 Weight 변경 신호가 아니다.

```text
Drift detected
  -> Incident / Learning Review
  -> Cohort analysis
  -> Lesson candidate
  -> Model change proposal
  -> Replay / Walk-forward / Shadow
  -> Human approval
  -> New active version
```

Critical Drift에서는 신규 위험 확대를 차단할 수 있지만 기존 점수를 조용히 다시 쓰지 않는다.

---

## 18. API

```text
POST /api/v1/scoring/models/validate
GET  /api/v1/scoring/models/:id
POST /api/v1/scoring/models/:id/transitions
POST /api/v1/scoring/scorecards/evaluate
GET  /api/v1/scoring/scorecards/:id
POST /api/v1/scoring/rankings/validate
POST /api/v1/scoring/changes/explain
GET  /api/v1/scoring/changes/:id
POST /api/v1/scoring/replays
```

### 18.1 쓰기 계약

- 상태 변경 API는 `Idempotency-Key` 필수
- Request/Correlation ID 반환
- 클라이언트 임의 Total·Contribution·Confidence 확정값은 재계산
- 허용 필드만 정규화해 저장
- Domain Result + Audit + Outbox를 한 Transaction에 저장

### 18.2 오류

| HTTP | Code | 의미 |
|---:|---|---|
| 400 | `INVALID_SCORING_CONTRACT` | 범위·방향·Weight·시각 오류 |
| 403 | `SCORING_OWNERSHIP_MISMATCH` | Cross-user 참조 |
| 404 | `SCORING_RESOURCE_NOT_FOUND` | Model·Scorecard 없음 |
| 409 | `SCORING_VERSION_CONFLICT` | Model/Scope/Policy 불일치 |
| 409 | `SCORING_RECORD_IMMUTABLE` | 기존 결과 수정 |
| 422 | `SCORING_INPUT_BLOCKED` | Unknown·Stale·Conflict·Evidence 부족 |
| 423 | `SCORING_MODEL_NOT_ACTIVE` | 운영 평가에 비활성 Model 사용 |

차단된 정당한 평가를 오류로 유실하지 않는다. Evaluate API는 유효한 요청이면 `201`과 `status=BLOCKED`를 저장할 수 있다.

---

## 19. 영속성

`010_scoring_system_v1.sql`은 다음을 추가한다.

```text
scoring_models
scoring_factor_definitions
scoring_thresholds
scoring_scorecards
scoring_factor_results
scoring_confidence_results
scoring_confidence_caps
scoring_change_explanations
scoring_factor_deltas
scoring_calibration_runs
scoring_calibration_buckets
```

### 19.1 제약

- 사용자별 Composite FK
- Scope별 Active Model Partial Unique
- Weight 합은 승인 함수/Service 검증과 Verification Record로 확인
- Score·Confidence `[0,100]`
- `low <= point <= high`
- `status=SCORED`일 때만 Score 필수
- N/A 결과는 Score/Contribution 없음
- Factor Result가 Model Definition에 연결
- Scorecard·Factor·Confidence·Change·Calibration 불변 Trigger
- 사용자별 RLS, 서버 전용 쓰기

### 19.2 Lineage

Scorecard는 다음을 고정한다.

- Model/Philosophy/Industry/Setup Version
- Snapshot/Evidence IDs
- AsOf/EvaluatedAt
- Code Version
- Factor Result IDs
- Confidence Result
- Result Hash

---

## 20. 감사와 Event

Audit Action:

```text
SCORING_MODEL_VALIDATED
SCORING_SCORECARD_EVALUATED
SCORING_CHANGE_EXPLAINED
SCORING_REPLAY_COMPLETED
```

Domain Event:

```text
ScoringModelValidated
ScorecardEvaluated
ScorecardBlocked
ScoreChangeExplained
ScoringReplayCompleted
```

Event에는 전체 Factor Payload 대신 ID·Scope·Status·Model Version·Score/Confidence 요약·Result Hash를 넣는다.

---

## 21. 보안과 공격 경계

- 사용자·Portfolio·Evidence Ownership 재검증
- 임의 Weight·Threshold·Direction을 운영 요청에서 받지 않음
- Prompt/Agent Output의 `score`, `gate`, `positionSize` 권한 필드 거부
- NaN·Infinity·과도한 정밀도·음수 Weight 거부
- 중복 Factor/Evidence·Unicode 혼동 ID 거부
- 정렬되지 않은 입력은 Canonicalize 후 Hash
- Secret 형태 필드는 허용 Schema 밖에서 폐기
- Model Definition 활성화는 별도 Human Approval
- Replay/Shadow가 운영 Event를 생성하지 않도록 분리

---

## 22. 관측성

Metric:

- `scoring_evaluation_total{scope,status,model_version}`
- `scoring_duration_ms{scope}`
- `scoring_factor_block_total{scope,factor,reason}`
- `scoring_availability_total{scope,factor,status}`
- `scoring_score_distribution{scope,model_version}`
- `scoring_confidence_distribution{scope,model_version}`
- `scoring_range_width_distribution{scope}`
- `scoring_ranking_turnover{scope}`
- `scoring_drift_alert_total{scope,severity}`
- `scoring_change_explanation_coverage{scope}`

Log에는 Correlation ID, Scorecard ID, Scope, Model Version, Status, Blocker Codes, Result Hash를 남긴다. 원문 Evidence·Secret은 기록하지 않는다.

---

## 23. 테스트 전략

### 23.1 단위·속성

- Score·Confidence 범위
- Weight 합 `10_000bp`
- 동일 입력 결정론
- 입력·Evidence 순서 불변 Hash
- 선형/Piecewise/Target 정규화 경계
- 방향 반전 단조성
- N/A 재정규화
- UNKNOWN/STALE/CONFLICTED 차단
- Critical N/A 금지
- 최소 적용 가중치
- Bear ≤ Point ≤ Bull
- Cap은 Confidence를 증가시키지 않음

### 23.2 전략 회귀

- Long-term과 Momentum 동일 숫자 직접 비교 금지
- Portfolio 상태 변화가 전략 Score를 바꾸지 않음
- Market Regime 변화가 Momentum Setup Score를 바꾸지 않음
- Thesis/Gate 실패가 Score를 수정하지 않고 Action만 제한
- Counter Evidence 제거가 Confidence를 높이지 않음
- Model Version 변경 시 기존 결과 불변

### 23.3 API/Repository

- Idempotency 동일 요청 재사용
- 같은 Key 다른 Body 충돌
- Cross-user Model/Evidence 거부
- 차단 결과도 Audit/Outbox 원자 저장
- 오류가 미처리 Promise가 아니라 표준 JSON으로 반환
- 임의/Secret 필드 제거
- 같은 Model/Scope만 Ranking
- Score Change 비교 가능성 판정

### 23.4 Migration

- 001~010 순차 적용
- Active Model Unique
- Composite FK·RLS
- 불변 UPDATE/DELETE 차단
- Score 상태별 Null Check
- 실제 Auth User A/B E2E

---

## 24. 구현 계획

### Phase 0 — 공통 계약

- Scope·Direction·Availability·Status
- Model/Factor/Observation/Scorecard 타입
- Canonical Hash

### Phase 1 — 결정론 계산

- Model Validator
- Linear/Piecewise/Target Normalizer
- Factor Validator
- Weighted Score·Range·N/A
- Confidence·Cap

### Phase 2 — 비교와 설명

- Ranking Validator/Stable Sort
- Same-model Contribution Delta
- Model-change Decomposition

### Phase 3 — 영속성과 API

- `010_scoring_system_v1.sql`
- Repository·Audit·Outbox
- Validate/Evaluate/Get/Rank/Explain API

### Phase 4 — Engine 연결

- Long-term/Momentum 결과에 `scoreStatus` 추가
- Blocked `0` Sentinel 소비 금지
- 기존 v1 응답 호환 Adapter
- Portfolio/Report가 `SCORED`만 사용하도록 검사

### Phase 5 — 검증

- Unit/Property/Integration
- 전체 Typecheck/Test/Build
- Migration 정적 검토
- 실제 Supabase/RLS/Replay/Shadow는 운영 환경에서 수행

---

## 25. Definition of Done

### 계약

- [x] Scope·Direction·Availability·Status 타입
- [x] Model/Factor/Basis Point Weight Validator·생명주기
- [x] Linear/Piecewise/Target 정규화·N/A·Range·Confidence
- [x] Gate/Action/Size 분리와 Engine `scoreStatus`
- [x] Ranking·Change Explanation
- [x] Deterministic Config/Result Hash

### API/DB

- [x] Scoring Validate/Transition/Evaluate/Get/Rank/Explain/Replay API
- [x] Repository·Audit·Outbox·Idempotency
- [x] `010_scoring_system_v1.sql`
- [x] RLS·Composite FK·불변 Result·Model 상태 Trigger

### 호환·검증

- [x] 기존 Engine Blocked 0 Sentinel을 `scoreStatus` Provenance로 격리
- [x] Long-term/Momentum 회귀 테스트
- [x] Unit/Invariant/API Integration
- [x] Migration 정적 검토
- [x] `pnpm typecheck`, `pnpm test`, `pnpm build`
- [ ] 실제 Supabase Auth/RLS·Replay·Walk-forward·Shadow Calibration

운영 완료에는 실제 Supabase 적용, Auth/RLS E2E, Historical Replay, Walk-forward, Shadow, Calibration 승인 결과가 추가로 필요하다.

---

## 26. 결정 기록

| ID | 결정 | 이유 |
|---|---|---|
| SCORE-ADR-001 | 전략별 Scope를 분리하고 Universal Score를 만들지 않음 | 의미가 다른 숫자의 허위 비교 방지 |
| SCORE-ADR-002 | Score·Confidence·Gate·Action·Size 분리 | 평균 점수로 불확실성과 위험 은폐 방지 |
| SCORE-ADR-003 | Weight는 Basis Point 정수 | 합계·재현성 오류 방지 |
| SCORE-ADR-004 | N/A만 재정규화 | 결측을 이용한 점수 부풀리기 방지 |
| SCORE-ADR-005 | Blocked 결과에는 총점 없음 | 계산 불가를 저점으로 오해하지 않게 함 |
| SCORE-ADR-006 | 모든 Metric에 Direction 저장 | 위험 점수 방향 혼동 방지 |
| SCORE-ADR-007 | Range와 Confidence 병렬 제공 | Point 추정의 가짜 정밀도 완화 |
| SCORE-ADR-008 | 같은 Model/Scope만 Ranking | 버전·전략 간 비호환 비교 차단 |
| SCORE-ADR-009 | 변화 설명에서 Data와 Model Delta 분리 | 모델 변경을 기업 변화로 오해하지 않게 함 |
| SCORE-ADR-010 | Learning은 새 Version 제안만 가능 | 자동 최적화에 의한 정책 Drift 방지 |
| SCORE-ADR-011 | Application 순수 함수가 계산 | DB·Agent에 판단 권한 집중 방지 |
| SCORE-ADR-012 | 차단 평가도 불변 기록 | Silent Failure와 선택 편향 방지 |
