# 07. AI Agents Specification

> AI Agent를 투자 결정을 내리는 권한 주체가 아니라, 격리된 비정형 분석을 수행하고 검증 가능한 후보를 제출하는 비신뢰 실행 계층으로 정의한다.

- 문서 버전: `v1.0.0-draft`
- 작성일: `2026-07-22`
- 상태: `IMPLEMENTATION-READY DRAFT`
- 선행 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1, `03_LongTerm_Engine.md`, `04_Momentum_Engine.md`, `05_Portfolio_Engine.md`, `06_Learning_Engine.md` v1.0.0
- 후속 문서: `08_Database.md`, `09_Scoring_System.md`, `10_Report_System.md`, `11_UI_UX.md`, `12_Roadmap.md`
- 구현 기준 경로: `packages/core/src/agent-v1`, `apps/api`, `supabase/migrations`

---

## 0. 문서의 역할

이 문서는 Agent의 이름만 나열하지 않는다. 각 Agent가 무엇을 읽고, 어떤 도구를 쓸 수 있으며, 어떤 구조로 결과를 반환하고, 어느 검증에 실패하면 폐기되는지를 실행 가능한 계약으로 고정한다.

Investment OS에서 Agent는 다음 역할만 수행한다.

1. 공시·실적 발표·뉴스처럼 비정형인 자료에서 후보 Fact를 추출한다.
2. 이미 검증된 Fact를 연결해 Interpretation·Counterargument·Hypothesis 후보를 만든다.
3. 계산 Engine이 요구하는 누락 정보와 충돌을 구조화해 알린다.
4. 보고서 초안을 만들되 원본 계산 결과와 출처를 변경하지 않는다.

Agent는 다음 권한이 없다.

- 점수·Gate·Position Size·Risk Limit 계산 확정
- `DENY`, Hard Safety 또는 Human Approval 우회
- Model·Policy·Prompt Version 활성화
- 주문 생성·전송
- 핵심 Domain Table 직접 쓰기
- 출처 없는 주장을 Fact로 승격
- 과거 결과를 운영 프롬프트에 자동 영구 학습

### 0.1 규범 우선순위

충돌 시 다음 순서로 해석한다.

1. 법적·보안·Hard Safety·사용자 명시 승인
2. `01`의 Domain 불변식, Point-in-time, Fail-closed, Agent 비신뢰 경계
3. `02`의 공식 출처 우선, 반대 논거, 전략 분리, 행동 편향 통제
4. `03`·`04`의 전략별 Fact·Thesis·Setup·Gate 계약
5. `05`의 Portfolio·Risk·Sizing 결정론
6. `06`의 Review·Lesson·Model Change 승인 경계
7. 이 문서의 Agent 실행·검증·운영 정책

### 0.2 선행 문서 충돌 검토

| 경계 | 선행 규칙 | 07 적용 | 결론 |
|---|---|---|---|
| Engine/Agent | Engine이 규칙과 상태를 소유 | Agent는 Candidate만 제출 | 충돌 없음 |
| 점수 | 순수 함수·버전 정책으로 계산 | Agent 숫자는 계산 입력 후보일 뿐 | 충돌 없음 |
| Risk | `DENY` 비가역, 실패 시 Fail-closed | Risk Agent 실패는 승인 근거가 아님 | 충돌 없음 |
| Strategy | Long-term/Momentum 점수와 시간축 분리 | Agent Run·Prompt·출력을 전략별 격리 | 충돌 없음 |
| Evidence | 출처 등급·시각·원문 위치 필요 | Claim마다 Evidence ID와 인용 위치 요구 | 충돌 없음 |
| Portfolio | 총노출·수량은 deterministic | Agent는 서술형 위험 후보만 생성 | 충돌 없음 |
| Learning | Lesson·Model Change는 검증·승인 필요 | Pattern Agent는 Candidate만 생성 | 충돌 없음 |
| Human Approval | 투자·모델·정책 변경 명시 승인 | Agent 승인 행위 금지 | 충돌 없음 |

---

## 1. 목표와 비목표

### 1.1 목표

- Agent 입력·출력을 버전된 Schema로 재현한다.
- Provider·Model·Prompt·Tool·Document Version 계보를 보존한다.
- 모든 Claim을 검증 가능한 Evidence에 연결한다.
- 비신뢰 문서와 시스템 지시를 분리해 Prompt Injection을 방어한다.
- Deterministic Verifier가 Agent 출력을 승인·차단한다.
- Agent별 최소 권한과 허용 도구를 강제한다.
- Timeout·Retry·Fallback·Partial Result를 명시한다.
- 동일 Run의 중복 부작용을 막고 결과 Hash를 안정화한다.
- Red Team과 반대 근거 단계를 기본 흐름에 포함한다.
- Agent 실패가 투자 위험 확대나 안전 규칙 완화로 이어지지 않게 한다.

### 1.2 비목표

- 범용 자율 투자 Agent
- Agent 간 자유 채팅으로 최종 결정 생성
- 웹 검색 결과를 즉시 공식 Fact로 저장
- 모델의 Chain-of-thought 저장 또는 노출
- 장기 기억이 정책을 자동 변경하는 구조
- Provider 응답의 확률값을 투자 Confidence로 직접 사용
- Agent가 SQL·Shell·브라우저를 임의 실행하는 구조
- Agent가 사용자 계좌·인증정보·전체 Portfolio를 기본 입력으로 받는 구조
- LLM 장애를 이유로 deterministic Gate를 생략하는 구조

### 1.3 MVP 범위

포함:

- Agent Definition Registry
- Run Request·Context Manifest·Structured Output
- Evidence-bound Claim·Fact Candidate·Counterargument
- Prompt Template Version과 Rendered Prompt Hash
- Tool Capability Policy
- JSON 구조·범위·Evidence·시간·정책 검증
- Long-term/Momentum/Learning/Report용 Orchestration Plan
- Timeout·Retry·Fallback·Circuit Breaker 상태 계약
- Audit·Outbox·Idempotency·Result Hash
- API와 In-memory Repository
- PostgreSQL Migration

운영 연결 단계:

- 실제 LLM Provider Adapter
- 브라우저·공시·뉴스 Provider Adapter
- Queue Worker와 Scheduler
- Secret Manager·Provider별 Rate Limit
- Reviewer UI와 Prompt Evaluation Dashboard

---

## 2. 핵심 용어

### 2.1 Engine

버전된 정책과 순수 함수로 점수·Gate·상태·수량·Risk를 계산하는 Domain 책임이다. 같은 입력이면 같은 결과를 만들어야 한다.

### 2.2 Agent

하나의 명확한 분석 목적을 가진 비신뢰 실행 단위다. Agent 결과는 `ACCEPTED`가 아니라 기본적으로 `UNVERIFIED`다.

### 2.3 Orchestrator

Run Plan을 검증하고 의존 순서에 따라 Agent를 실행하며, 각 결과를 검증한 후 다음 단계에 전달하는 Application Service다. Domain 결정을 대신하지 않는다.

### 2.4 Provider Adapter

LLM·검색·문서 저장소 등 외부 시스템을 공통 인터페이스로 감싼다. Domain과 Agent 계약은 특정 Provider SDK에 의존하지 않는다.

### 2.5 Tool Capability

Agent가 호출할 수 있는 읽기 전용 기능의 허용 목록이다. Capability는 이름·버전·입력 Schema·데이터 등급·최대 호출 수를 가진다.

### 2.6 Claim

Agent가 제출한 최소 주장 단위다. `FACT_CANDIDATE`, `ESTIMATE`, `INTERPRETATION`, `HYPOTHESIS`, `COUNTERARGUMENT` 중 하나이며 Evidence ID가 필요하다.

### 2.7 Run Manifest

Provider·Model·Prompt·Tool·입력 Snapshot·문서·시각·예산·코드 버전을 묶는 불변 실행 명세다.

### 2.8 Validation Finding

Schema·Evidence·시간·범위·정책·보안 검증 결과다. Severity는 `INFO`, `WARNING`, `ERROR`, `CRITICAL`이다.

---

## 3. 절대 불변식

| ID | 불변식 | 검증 방식 |
|---|---|---|
| AG-INV-001 | Agent 출력은 Domain Fact가 아니다. | Candidate 전용 타입 |
| AG-INV-002 | Agent는 Domain 핵심 상태를 직접 수정하지 않는다. | Repository·Capability 분리 |
| AG-INV-003 | Agent는 점수·Gate·Risk·Size·승인을 확정하지 않는다. | Output Schema 금지 필드 검사 |
| AG-INV-004 | 모든 Fact Candidate는 Evidence ID와 원문 위치를 가진다. | Evidence Verifier |
| AG-INV-005 | Evidence `availableAt`은 Run `asOf` 이후일 수 없다. | Point-in-time Verifier |
| AG-INV-006 | Long-term과 Momentum Context를 암묵적으로 합치지 않는다. | Strategy Scope 검사 |
| AG-INV-007 | Prompt·Provider·Model·Tool Version을 기록한다. | Manifest 필수 필드 |
| AG-INV-008 | 비신뢰 문서의 명령은 실행 지시로 해석하지 않는다. | Content Envelope·Tool Policy |
| AG-INV-009 | Agent 실패는 Risk Rule을 완화하지 않는다. | Fail-closed Outcome Mapping |
| AG-INV-010 | 계산 결과와 Agent 설명이 충돌하면 계산 결과가 우선한다. | Consistency Verifier |
| AG-INV-011 | 동일 Manifest와 Provider 응답은 동일 Normalized Hash를 만든다. | Stable Hash Test |
| AG-INV-012 | Agent는 Model·Policy·Prompt를 활성화하지 않는다. | State Machine 권한 검사 |
| AG-INV-013 | Prompt와 Log에 Secret·전체 계좌 식별자를 포함하지 않는다. | Redaction 검사 |
| AG-INV-014 | Human Approval 대상은 Agent가 승인할 수 없다. | Actor Type 검사 |
| AG-INV-015 | Tool 호출은 선언된 Capability와 Budget 안에서만 가능하다. | Tool Gateway 검사 |

---

## 4. 논리 아키텍처

```text
Domain Event / API Request
          ↓
Agent Orchestrator
  ├─ Run Plan Validator
  ├─ Context Builder
  ├─ Capability Gateway
  ├─ Provider Adapter
  ├─ Output Normalizer
  ├─ Deterministic Verifier
  └─ Audit + Outbox
          ↓
Verified Candidate Store
          ↓
Domain Engine / Human Reviewer / Report Composer
```

### 4.1 의존성 방향

```text
agent-v1 → public Domain contracts
agent-v1 → Provider/Tool interfaces
api/worker → agent-v1 orchestration
Domain Engine ─X→ Provider SDK
Agent ─X→ Domain repository write
Agent ─X→ Execution/Order adapter
```

### 4.2 물리 구조 목표

```text
packages/core/src/agent-v1/
├── types.ts
├── registry.ts
├── manifest.ts
├── validation.ts
├── capability.ts
├── provider.ts
├── executor.ts
├── orchestration.ts
├── redaction.ts
├── hash.ts
└── index.ts
```

초기 구현은 `packages/core` 안에 두되 Provider SDK와 네트워크 I/O는 Application Adapter에 둔다.

---

## 5. Agent Catalog

### 5.1 공통 분류

| Criticality | 의미 | 실패 시 |
|---|---|---|
| `ADVISORY` | 설명·요약 보조 | 구조화 결과만 계속 표시 가능 |
| `REQUIRED_FOR_ANALYSIS` | 해당 분석 완전성에 필수 | Run `PARTIAL/BLOCKED` |
| `REQUIRED_FOR_RISK` | 신규 위험 제안의 안전에 필수 | 제안·승인 진행 금지 |

### 5.2 Long-term Agents

| Agent | 책임 | 입력 | 출력 | Criticality |
|---|---|---|---|---|
| Fundamental | 공시에서 사업·재무 Fact 후보 추출 | Filing Evidence | Fact Candidates·Missing Fields | REQUIRED_FOR_ANALYSIS |
| Industry | 산업 KPI·비교 기준 후보 매핑 | Industry Profile·Evidence | KPI Mapping Candidates | REQUIRED_FOR_ANALYSIS |
| Valuation Narrative | 가치평가 가정의 근거·반례 설명 | Deterministic Valuation Result | Interpretation·Counterarguments | ADVISORY |
| Thesis | Assumption·Break Condition 초안 | Verified Facts·Prior Thesis | Thesis Revision Candidate | REQUIRED_FOR_ANALYSIS |
| Long-term Red Team | Thesis 반대 논거·숨은 가정 탐색 | Thesis Candidate·Evidence | Counterarguments·Missing Evidence | REQUIRED_FOR_ANALYSIS |

Valuation Agent는 DCF를 직접 계산하지 않는다. 현금흐름·할인율·주식수 계산은 Long-term Engine이 담당하고 Agent는 가정의 근거와 불확실성만 설명한다.

### 5.3 Momentum Agents

| Agent | 책임 | 입력 | 출력 | Criticality |
|---|---|---|---|---|
| Market Regime Narrative | 결정론적 Regime 결과 설명 | Regime Metrics·Snapshots | Interpretation·Warnings | ADVISORY |
| Sector Context | Sector Breadth·Leadership 맥락 후보 | Sector Snapshot | Context Candidates | ADVISORY |
| Catalyst | 공식 Event에서 Catalyst Fact 후보 추출 | Event Evidence | Catalyst Candidates·Decay Inputs | REQUIRED_FOR_ANALYSIS |
| Setup Narrator | 계산된 Pattern과 무효화 조건 설명 | Indicator Result·Setup Registry | Setup Explanation | ADVISORY |
| Trade Plan Critic | 기존 Plan의 누락·모순 검토 | Deterministic Plan | Findings only | REQUIRED_FOR_RISK |
| Momentum Red Team | Gap·Event·Liquidity·Crowding 반례 | Setup·Plan·Evidence | Counterarguments·Risk Candidates | REQUIRED_FOR_RISK |

Scanner·ATR·Relative Strength·Volume Ratio·Entry/Stop/Target·수량 계산은 Agent가 아니라 deterministic code다.

### 5.4 Portfolio·Risk Agents

| Agent | 책임 | 금지 |
|---|---|---|
| Exposure Narrator | 계산된 Company/Sector/Theme/FX 노출을 설명 | Weight 재계산·한도 변경 |
| Scenario Author | Stress Scenario 후보와 가정 제안 | Stress 손실 확정 |
| Risk Evidence Reviewer | Risk Finding의 근거 완전성 점검 | `DENY` 해제·승인금액 증가 |
| Behavioral Safety | 사용자 입력에서 FOMO·Revenge 후보 표시 | 심리 진단 확정·주문 차단 단독 결정 |

Portfolio·Risk Agent 출력은 모두 `REVIEW_REQUIRED` 후보가 될 수 있지만 `APPROVE`를 만들 수 없다.

### 5.5 Learning·Report Agents

| Agent | 책임 | 금지 |
|---|---|---|
| Review Narrator | Process/Outcome 구조화 결과 설명 | 분류값 변경 |
| Pattern Candidate | 통과한 Cohort에서 Lesson 초안 | Lesson 승인 |
| Model Change Author | 승인 Lesson을 변경 가설 문서로 변환 | 검증 통과·활성화 선언 |
| Report Composer | Fact·Interpretation·반대 근거 조합 | Fact 생성·계산값 수정 |

---

## 6. Agent Definition 계약

```ts
type AgentDefinitionV1 = {
  id: string;
  version: string;
  purpose: string;
  strategyScope: 'LONG_TERM' | 'MOMENTUM' | 'PORTFOLIO' | 'RISK' | 'LEARNING' | 'REPORTING';
  criticality: 'ADVISORY' | 'REQUIRED_FOR_ANALYSIS' | 'REQUIRED_FOR_RISK';
  promptTemplateId: string;
  promptVersion: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  allowedCapabilities: ToolCapabilityGrantV1[];
  maximumAttempts: number;
  timeoutMs: number;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  fallbackAgentDefinitionId?: string;
  enabled: boolean;
};
```

### 6.1 Definition 검증

- `id + version`은 유일하다.
- `maximumAttempts`는 1~3이다.
- Timeout은 1초 이상, 운영 상한 이하이다.
- Prompt·Input·Output Schema Version은 활성 Registry에 존재해야 한다.
- Capability Grant는 Agent Scope와 일치해야 한다.
- `REQUIRED_FOR_RISK` Agent는 자유 웹 탐색만으로 완료될 수 없다.
- Fallback은 자신 또는 순환 의존성을 가리킬 수 없다.
- 비활성 Definition은 새 Run에 선택되지 않는다.

### 6.2 Version 정책

다음 변경은 새 Agent Definition Version을 요구한다.

- System Instruction 의미 변경
- Output Schema 필드·Enum·필수성 변경
- Tool Capability 추가·확대
- Provider/Model 기본값 변경
- Timeout·Retry·Fallback의 안전 의미 변경
- Evidence 검증 정책 변경

문구 오탈자만 고쳐도 Prompt Version과 Hash는 바뀌지만 Agent Definition의 Major Version까지 올릴 필요는 없다.

---

## 7. Run Request와 Manifest

```ts
type AgentRunRequestV1 = {
  id: string;
  userId: string;
  agentDefinitionId: string;
  agentDefinitionVersion: string;
  strategyScope: AgentDefinitionV1['strategyScope'];
  purpose: string;
  asOf: string;
  correlationId: string;
  idempotencyKey: string;
  inputSnapshotIds: string[];
  evidenceIds: string[];
  context: Record<string, unknown>;
  requestedBy: { actorType: 'USER' | 'SYSTEM' | 'SCHEDULER'; actorId: string };
};

type AgentRunManifestV1 = {
  id: string;
  requestId: string;
  userId: string;
  agentDefinitionId: string;
  agentDefinitionVersion: string;
  providerId: string;
  providerVersion: string;
  modelId: string;
  modelRevision?: string;
  promptTemplateId: string;
  promptVersion: string;
  renderedPromptHash: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  inputSnapshotIds: string[];
  evidenceIds: string[];
  capabilityGrantIds: string[];
  asOf: string;
  codeVersion: string;
  temperature: number;
  seed?: number;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  createdAt: string;
  manifestHash: string;
};
```

### 7.1 시간 계약

```text
Evidence observedAt <= availableAt <= Run asOf <= createdAt
Snapshot asOf <= Run asOf
Prompt/Agent Definition effectiveFrom <= createdAt
```

Run `asOf` 이후 공개된 수정 공시·실적·가격을 과거 Run에 추가하지 않는다. Replay는 새 Run ID와 원래 `asOf`를 사용한다.

### 7.2 Context 최소화

Context Builder는 Agent 목적에 필요한 필드만 제공한다.

- 전체 Portfolio 대신 필요한 집계·한도만 제공
- 계좌번호·API Key·Email·주소 제거
- 긴 문서는 Evidence ID와 필요한 Chunk만 제공
- 계산 결과는 `DETERMINISTIC_RESULT` Envelope로 표시
- 외부 문서는 `UNTRUSTED_CONTENT` Envelope로 표시

---

## 8. Evidence와 Claim 계약

```ts
type AgentClaimV1 = {
  id: string;
  kind: 'FACT_CANDIDATE' | 'ESTIMATE' | 'INTERPRETATION' | 'HYPOTHESIS' | 'COUNTERARGUMENT';
  subject: string;
  predicate: string;
  value: string | number | boolean;
  unit?: string;
  periodStart?: string;
  periodEnd?: string;
  evidenceRefs: Array<{
    evidenceId: string;
    location: { page?: number; section?: string; startOffset?: number; endOffset?: number };
    support: 'SUPPORTS' | 'CONTRADICTS' | 'CONTEXT_ONLY';
  }>;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
  uncertaintyReasons: string[];
};
```

### 8.1 Claim 규칙

- `FACT_CANDIDATE`는 최소 1개 `SUPPORTS` Evidence가 필요하다.
- `ESTIMATE`는 방법·가정·단위를 포함한다.
- `INTERPRETATION`은 Fact처럼 저장되지 않는다.
- `HYPOTHESIS`는 검증 방법이나 반증 조건을 포함한다.
- `COUNTERARGUMENT`는 반대 Evidence 또는 확인 필요 항목을 포함한다.
- `HIGH`는 공식 원문과 위치가 검증된 경우에만 가능하다.
- Agent 자기평가 Confidence는 Domain Score Confidence와 별개다.
- Evidence에 없는 숫자는 `FACT_CANDIDATE`로 제출할 수 없다.
- 서로 충돌하는 Claim은 하나를 숨기지 않고 Conflict Group으로 묶는다.

### 8.2 원문 인용

원문은 전체 복제하지 않고 위치·짧은 발췌·Hash를 저장한다. UI와 Report는 사용 권한이 확인된 범위에서만 발췌를 표시한다.

---

## 9. Structured Output

```ts
type AgentOutputV1 = {
  schemaVersion: '1';
  runId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'BLOCKED';
  summary: string;
  claims: AgentClaimV1[];
  counterarguments: AgentClaimV1[];
  missingInformation: Array<{
    code: string;
    description: string;
    critical: boolean;
    suggestedEvidenceKinds: string[];
  }>;
  qualityFlags: string[];
  proposedActions: Array<{
    action: 'REQUEST_EVIDENCE' | 'REQUEST_REVIEW' | 'RERUN_DETERMINISTIC_ENGINE' | 'NO_CHANGE';
    reasonCodes: string[];
  }>;
};
```

### 9.1 금지 필드와 값

Agent Output에는 다음 의미를 가진 필드를 둘 수 없다.

- `approved`, `order`, `execute`, `activateModel`, `overrideRisk`
- 최종 Position Quantity 또는 승인 금액
- 정책·점수 Weight 수정 명령
- 인증정보·Provider Secret
- 내부 Chain-of-thought

`proposedActions`는 제한된 Workflow 요청일 뿐 Domain Action이 아니다.

### 9.2 완료 의미

- `COMPLETED`: 필수 출력과 Evidence 검증이 통과함
- `PARTIAL`: 일부 비핵심 항목 실패, 누락 목록이 명시됨
- `BLOCKED`: Critical Evidence·Schema·보안·시간 검증 실패

Agent가 스스로 `COMPLETED`를 반환해도 Verifier가 `REJECTED`할 수 있다.

---

## 10. Prompt 계약

### 10.1 Prompt 구성

```text
1. Immutable System Policy
2. Agent Purpose and Scope
3. Output JSON Schema
4. Allowed Tool Capabilities
5. Deterministic Results (trusted, read-only)
6. Evidence Metadata
7. Untrusted Document Content
8. Explicit Task
```

외부 문서 내용은 System Policy와 같은 메시지나 구획에 넣지 않는다.

### 10.2 Prompt Template

```ts
type PromptTemplateV1 = {
  id: string;
  version: string;
  strategyScope: AgentDefinitionV1['strategyScope'];
  systemPolicy: string;
  taskTemplate: string;
  outputSchemaVersion: string;
  requiredVariables: string[];
  forbiddenContentClasses: string[];
  effectiveFrom: string;
  approvedBy: string;
  approvedAt: string;
  templateHash: string;
};
```

### 10.3 Prompt Injection 방어

- 외부 문서의 “이전 지시를 무시하라” 같은 문장을 데이터로만 취급한다.
- 문서 본문에서 Tool 이름·URL·코드가 발견되어도 자동 실행하지 않는다.
- Tool 호출 인자는 Capability Gateway가 새로 검증한다.
- URL은 Evidence Registry에 이미 승인된 Source 또는 명시적 Allowlist만 허용한다.
- HTML Script·숨은 텍스트·Base64 명령 후보를 제거하거나 격리한다.
- 문서에서 발견한 Credential·개인정보는 Prompt에 재주입하지 않는다.
- Output에 Prompt·Secret 추출 시도가 있으면 `SECURITY_POLICY_VIOLATION`으로 차단한다.

### 10.4 Prompt Version 승인

Prompt는 `DRAFT → EVALUATING → APPROVED → ACTIVE → DEPRECATED` 상태를 가진다. 작성자와 승인자를 분리할 수 있어야 한다. Agent는 Prompt 상태를 바꿀 수 없다.

---

## 11. Tool Capability와 최소 권한

```ts
type ToolCapabilityGrantV1 = {
  id: string;
  capability: string;
  version: string;
  mode: 'READ_ONLY';
  allowedResourceKinds: string[];
  allowedSourceIds: string[];
  maximumCalls: number;
  timeoutMs: number;
  maximumResponseBytes: number;
  validFrom: string;
  validUntil?: string;
};
```

### 11.1 기본 허용 Capability

- `evidence.read`
- `snapshot.read`
- `filing.chunk.read`
- `market.calendar.read`
- `domain.result.read`
- `schema.lookup`

### 11.2 기본 금지 Capability

- 임의 SQL
- Shell 실행
- 임의 URL Fetch
- 파일 쓰기
- Domain 상태 변경
- Order·Broker API
- Secret Store 조회
- 다른 사용자의 Context 검색

### 11.3 Tool 결과

모든 Tool Result는 다음 Envelope를 가진다.

```ts
type ToolResultEnvelopeV1 = {
  callId: string;
  capability: string;
  resourceId: string;
  sourceId: string;
  asOf: string;
  availableAt: string;
  contentType: string;
  contentHash: string;
  truncated: boolean;
  payload: unknown;
};
```

Tool Result도 비신뢰 데이터이며 Schema·크기·시각·소유권을 재검증한다.

---

## 12. Deterministic Validation Pipeline

```text
Provider Raw Output
  ↓ 1. Parse / JSON Repair Budget
Normalized Output
  ↓ 2. Schema / Enum / Range
  ↓ 3. Forbidden Authority Fields
  ↓ 4. Evidence Existence / Ownership / Location
  ↓ 5. Point-in-time / Strategy Scope
  ↓ 6. Deterministic Result Consistency
  ↓ 7. Security / Redaction / Size
Verified Candidate or Rejected Result
```

### 12.1 JSON Repair

문법 오류만 제한적으로 고칠 수 있다. 의미 필드·숫자·Evidence ID를 새로 추정하지 않는다. Repair가 발생하면 Raw Output Hash와 Repair Finding을 모두 기록한다.

### 12.2 범위 검증

- 빈 ID·중복 ID 차단
- Enum 외 값 차단
- 비정상 날짜·미래 시각 차단
- NaN·Infinity 차단
- 최대 Claim·문자·배열 길이 강제
- Evidence 없는 숫자 Claim 차단
- 동일 Claim의 상충 Confidence 차단

### 12.3 계산 일치 검증

Agent가 “Gate 통과”, “Score 82”, “허용 수량 10”처럼 deterministic 결과를 서술할 경우 원본 결과와 비교한다. 다르면:

1. 원본 계산 결과를 유지한다.
2. Agent Claim은 거부한다.
3. `DETERMINISTIC_CONFLICT` Finding을 기록한다.
4. Criticality에 따라 Run을 `PARTIAL` 또는 `BLOCKED`로 만든다.

### 12.4 검증 결과

```ts
type AgentValidationResultV1 = {
  id: string;
  runId: string;
  verdict: 'ACCEPTED' | 'ACCEPTED_WITH_WARNINGS' | 'REJECTED';
  findings: Array<{
    code: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    path?: string;
    message: string;
    evidenceIds: string[];
  }>;
  acceptedClaimIds: string[];
  rejectedClaimIds: string[];
  validatedAt: string;
  policyVersion: string;
  resultHash: string;
};
```

---

## 13. Orchestration

### 13.1 Run Plan

```ts
type AgentPlanV1 = {
  id: string;
  userId: string;
  workflow: 'LONG_TERM_REVIEW' | 'MOMENTUM_REVIEW' | 'LEARNING_REVIEW' | 'REPORT_GENERATION';
  asOf: string;
  nodes: Array<{
    id: string;
    agentDefinitionId: string;
    dependsOn: string[];
    required: boolean;
  }>;
  maximumConcurrency: number;
  deadlineAt: string;
  createdAt: string;
};
```

Plan은 Cycle이 없는 DAG여야 한다. Dependency가 `REJECTED/BLOCKED`이면 해당 결과를 필수로 요구하는 하위 Node는 실행하지 않는다.

### 13.2 Long-term 흐름

```text
Filing Evidence
  ├─ Fundamental Agent ─┐
  └─ Industry Agent ────┼→ Deterministic Long-term Engine
                        │          ↓
                        ├→ Thesis Agent
                        └→ Long-term Red Team
                                   ↓
                          Human Review / Report
```

Engine 점수는 Agent 설명보다 먼저 또는 독립적으로 계산할 수 있다. Thesis·Red Team 출력은 점수를 직접 덮지 않는다.

### 13.3 Momentum 흐름

```text
Market/Bar/Event Snapshots
  ├→ Deterministic Indicators / Universe / Regime
  ├→ Catalyst Agent
  └→ Sector Context Agent
           ↓
Deterministic Setup + Trade Plan
  ├→ Trade Plan Critic
  └→ Momentum Red Team
           ↓
Risk Engine → Human Approval
```

Risk 필수 Agent가 실패하면 신규 `ENTER` 제안은 차단한다. 이미 계산된 `WAIT/AVOID/EXIT`와 경고는 표시할 수 있다.

### 13.4 Learning 흐름

```text
Immutable Review + Eligible Cohort
        ↓
Pattern Candidate Agent
        ↓ deterministic Lesson Gate
Human Lesson Review
        ↓
Model Change Author
        ↓ Replay → Walk-forward → Shadow
Human Model Approval
```

### 13.5 Report 흐름

Report Composer는 검증된 Fact·Engine Result·Accepted Claim만 읽는다. 일부 Advisory Agent 실패 시 구조화 보고서는 생성할 수 있지만 누락과 실패를 표시한다.

---

## 14. 상태 모델

```ts
type AgentRunStatusV1 =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'CANCELLED';
```

### 14.1 허용 전이

```text
PENDING → RUNNING | CANCELLED
RUNNING → SUCCEEDED | PARTIAL | BLOCKED | FAILED | TIMED_OUT | CANCELLED
Terminal → 전이 없음
```

재시도는 기존 Run 상태를 바꾸지 않고 새 Attempt Record를 추가한다. 최종 Run은 Attempt들을 집계한다.

### 14.2 상태 의미

- `SUCCEEDED`: Provider 완료 + Validation Accepted
- `PARTIAL`: 일부 Claim/Node만 Accepted
- `BLOCKED`: 안전·Evidence·Point-in-time 검증 차단
- `FAILED`: Provider·Parser·내부 오류
- `TIMED_OUT`: Deadline 초과
- `CANCELLED`: 사용자·시스템이 시작 전 또는 실행 중 취소

---

## 15. Timeout, Retry, Fallback

### 15.1 Retry 분류

| 오류 | Retry | 설명 |
|---|---:|---|
| 429/일시 Provider 장애 | 가능 | Backoff + Jitter |
| Network Timeout | 가능 | 동일 Manifest, 새 Attempt |
| JSON Syntax 오류 | 1회 가능 | 명시적 Schema 재요청 |
| Schema 의미 오류 | 제한적 | 같은 입력으로 1회 |
| Evidence/Ownership 위반 | 불가 | 입력 또는 권한 수정 필요 |
| Prompt Injection 탐지 | 불가 | Security Review |
| Point-in-time 위반 | 불가 | Context Builder 오류 |
| Deterministic 충돌 | 불가 | Candidate 폐기 |

### 15.2 Backoff

Retry는 최대 3회이며 `baseDelay * 2^attempt + jitter`를 사용한다. 전체 Plan Deadline을 넘는 Retry는 시작하지 않는다.

### 15.3 Fallback

Fallback은 사전 승인된 Definition만 사용한다.

- Provider 변경 시 Provider·Model·Prompt Hash를 새 Manifest에 기록
- 저비용 모델 Fallback은 Output Schema와 Evidence 규칙이 같아야 함
- `REQUIRED_FOR_RISK`는 단순 요약 모델로 강등하지 않음
- Fallback도 실패하면 `BLOCKED/PARTIAL` 처리
- 이전 정상 결과를 사용하면 `stale`과 원래 `asOf`를 표시

### 15.4 Circuit Breaker

Provider·Model·Agent Definition별 연속 실패율이 임계치를 넘으면 새 Run을 임시 차단한다. 읽기 전용 이전 결과는 표시할 수 있으나 신규 투자 위험은 확대하지 않는다.

---

## 16. 비용·Token·Rate Limit

### 16.1 Budget

```ts
type AgentBudgetV1 = {
  maximumInputTokens: number;
  maximumOutputTokens: number;
  maximumToolCalls: number;
  maximumCostMicros: number;
  deadlineAt: string;
};
```

Budget 초과는 자동으로 더 큰 비용 모델을 호출하는 근거가 아니다. Chunk 우선순위, 문서 요약 Cache, 비핵심 Node 생략 순으로 대응한다.

### 16.2 Context 압축

- 동일 문서 중복 Chunk 제거
- Evidence Metadata 우선, 본문은 필요한 범위만
- 이전 Agent 자유 서술 대신 구조화 Claim 전달
- Engine Result는 필수 필드만 전달
- Summary의 Summary를 반복 생성하지 않음

### 16.3 Rate Limit 격리

Provider·User·Workflow·Agent Definition 단위 Token Bucket을 분리한다. 대량 Report 생성이 Risk 검토 Agent 용량을 고갈시키지 않아야 한다.

---

## 17. Idempotency, Cache, Replay

### 17.1 Idempotency Key

```text
hash(userId + agentDefinitionVersion + asOf + sorted inputSnapshotIds
     + sorted evidenceIds + normalized context + promptVersion + provider/model policy)
```

동일 Key의 `SUCCEEDED` Run은 재사용할 수 있다. 실패 Run은 새 Attempt를 만들되 기존 기록을 변경하지 않는다.

### 17.2 Cache 허용

- Evidence Chunk 정규화
- Prompt Template Rendering
- 동일 Manifest의 Provider Raw Response
- Validation Result

Cache Hit도 원본 `asOf`, TTL, Model/Prompt Version을 확인한다. 시세·Portfolio처럼 빠르게 변하는 입력은 Snapshot ID가 바뀌면 무효화한다.

### 17.3 Replay

Replay는 운영 상태 변경 Capability를 가지지 않는다. 원래 Manifest를 복제하고 변경 대상(Provider·Model·Prompt)만 명시한다. 비교는 Claim Coverage·Evidence Precision·Validation Finding·Cost·Latency로 수행한다.

---

## 18. Provider 추상화

```ts
interface AgentProviderV1 {
  readonly id: string;
  readonly version: string;
  execute(input: {
    manifest: AgentRunManifestV1;
    systemPolicy: string;
    task: string;
    evidence: ToolResultEnvelopeV1[];
    outputSchema: Record<string, unknown>;
  }): Promise<{
    providerRequestId: string;
    rawOutput: string;
    inputTokens?: number;
    outputTokens?: number;
    costMicros?: number;
    finishedAt: string;
  }>;
}
```

### 18.1 Provider 선택

선택 기준은 최신성보다 승인 상태다.

- 구조화 출력 준수율
- Evidence ID 보존율
- Prompt Injection 평가
- Latency·가용성
- 비용 상한
- 데이터 보존·지역·Privacy 계약
- Replay 품질

### 18.2 Provider 응답 보존

Raw Output은 암호화·접근 제한·Retention 정책을 적용한다. Domain 소비자는 Raw Output이 아니라 Normalized/Validated Result만 읽는다.

---

## 19. Human Review와 권한 분리

### 19.1 Human Review 대상

- Critical Claim Conflict
- 낮은 출처 등급의 중요 주장
- Thesis Break Candidate
- Binary Event·Gap Risk
- Risk Agent Finding
- Lesson 승인
- Model/Prompt/Agent Definition 변경
- Tool Capability 확대

### 19.2 승인 원칙

- Agent·System Actor는 Human Approval 필드에 들어갈 수 없다.
- 작성자와 승인자를 분리할 수 있다.
- 승인 시 Raw/Normalized/Validation Finding과 Evidence를 함께 보여준다.
- 수정 승인 대신 새 Candidate Revision을 만든다.
- 승인 이후 Evidence가 정정되면 기존 승인을 변경하지 않고 Review Event를 생성한다.

---

## 20. API

```text
POST /api/v1/agents/definitions/validate
POST /api/v1/agents/plans/validate
POST /api/v1/agents/runs
GET  /api/v1/agents/runs/:id
GET  /api/v1/agents/runs/:id/attempts
POST /api/v1/agents/runs/:id/cancel
POST /api/v1/agents/outputs/validate
POST /api/v1/agents/replays
GET  /api/v1/agents/definitions
GET  /api/v1/agents/prompts/:id/versions
```

MVP 코드 구현은 외부 Provider 호출 없이 Definition·Plan·Run Manifest·Output Validation·불변 Run 저장을 제공한다. 실제 Provider 실행은 Worker Adapter 연결 후 활성화한다.

### 20.1 오류

| HTTP | Code | 의미 |
|---:|---|---|
| 400 | `INVALID_AGENT_REQUEST` | Schema·상태·시간 오류 |
| 403 | `AGENT_OWNERSHIP_MISMATCH` | 다른 사용자 Context 참조 |
| 409 | `AGENT_VERSION_CONFLICT` | Definition·Prompt·Schema Version 불일치 |
| 409 | `AGENT_IDEMPOTENCY_CONFLICT` | 같은 Key에 다른 입력 |
| 413 | `AGENT_CONTEXT_TOO_LARGE` | Context·문서·Output 상한 초과 |
| 422 | `AGENT_OUTPUT_REJECTED` | Evidence·범위·계산 일치 검증 실패 |
| 423 | `AGENT_RUN_BLOCKED` | Critical Risk·Security·Point-in-time 실패 |
| 429 | `AGENT_RATE_LIMITED` | Budget·Provider 제한 |
| 504 | `AGENT_TIMED_OUT` | Run Deadline 초과 |
| 404 | `AGENT_RESOURCE_NOT_FOUND` | Definition·Run·Prompt 없음 |

모든 상태 변경 POST는 `Idempotency-Key`가 필수다.

---

## 21. 저장 모델

구현 시 `008_agent_orchestration_v1.sql`을 추가하고 기존 Migration을 수정하지 않는다.

```text
agent_definitions
agent_prompt_templates
agent_tool_capability_grants
agent_run_plans
agent_plan_nodes
agent_runs
agent_run_attempts
agent_run_manifests
agent_tool_calls
agent_raw_outputs
agent_normalized_outputs
agent_claims
agent_claim_evidence
agent_validation_results
agent_validation_findings
agent_provider_circuit_states
```

### 21.1 제약

- 사용자별 Run·Plan RLS
- Definition·Prompt·Capability는 운영자 전용 쓰기
- Run Manifest·Attempt·Output·Validation 불변
- Agent Definition/Prompt Version Composite FK
- `asOf <= createdAt <= startedAt <= finishedAt` 허용 범위
- Terminal Run 수정 금지
- Tool Call은 Manifest Capability Grant의 부분집합
- Claim Evidence는 같은 사용자·Run Context에 포함
- Raw Output과 Secret 접근 권한 분리
- Result Hash와 Correlation ID 필수

### 21.2 Index

- Run by user/status/createdAt
- Run by idempotencyKey
- Run by agentDefinition/version/asOf
- Attempt by run/number
- Claim by subject/predicate/kind
- Finding by code/severity/time
- Prompt/Definition active version
- Provider circuit state

---

## 22. Event와 Audit

```text
AgentRunRequested
AgentRunStarted
AgentRunSucceeded
AgentRunPartiallyCompleted
AgentRunBlocked
AgentRunFailed
AgentRunTimedOut
AgentRunCancelled
AgentOutputValidated
AgentOutputRejected
AgentSecurityViolationDetected
AgentProviderCircuitOpened
AgentReplayCompleted
PromptVersionApproved
AgentDefinitionActivated
```

Audit에는 다음을 기록한다.

- 요청 Actor·User·Correlation ID
- Agent/Prompt/Provider/Model/Schema Version
- 입력 Snapshot·Evidence ID
- Tool Capability와 호출 결과 Metadata
- Token·Cost·Latency
- Raw/Normalized/Validation Hash
- Retry·Fallback 이유
- Finding과 최종 상태
- Human Review·승인자

원문 전체, Secret, Chain-of-thought는 Audit에 기록하지 않는다.

---

## 23. 보안·Privacy·데이터 거버넌스

### 23.1 Threat Model

- 공시·뉴스·웹 문서의 Prompt Injection
- 악성 Tool Argument·URL 우회
- 다른 사용자 Evidence ID 추측
- Provider Prompt/Output Log를 통한 Secret 유출
- 과도한 Context로 인한 자산 정보 노출
- Agent가 위조한 Evidence ID·인용 위치
- Prompt Version Supply-chain 변경
- Cache Key 충돌과 사용자 간 Cache 오염
- Output Bomb·비정상 JSON 깊이

### 23.2 통제

- User ID·Resource Ownership 서버 재검증
- Secret은 Prompt·Tool Result·Log에서 제거
- User별 Cache Namespace
- JSON 깊이·배열·문자·Byte 상한
- URL·Source Allowlist
- Capability Token 단기 발급
- Raw Output 암호화와 제한된 Retention
- Prompt/Definition 승인·Hash·불변 Version
- Security Finding 발생 시 Retry 금지
- Provider Data Retention/Training Opt-out 정책 기록

### 23.3 심리·행동 데이터

FOMO·Revenge 같은 행동 입력은 민감정보로 취급한다. 필요한 최소 범주만 Agent에 전달하며 의료·정신건강 진단 표현을 금지한다.

---

## 24. 관측성

### 24.1 Metric

- Run 성공·Partial·Blocked·Timeout 비율
- Agent Definition/Provider/Model별 Latency
- Input/Output Token·Cost
- JSON Schema 준수율
- Evidence-bound Claim 비율
- Claim Acceptance/Rejection 비율
- Point-in-time·Ownership·Injection Finding 수
- Deterministic Conflict 비율
- Retry·Fallback·Circuit Open 비율
- Human Review 전환율
- Replay 품질 차이

### 24.2 Alert

- `REQUIRED_FOR_RISK` Agent 연속 실패
- Evidence 위조·소유권 위반
- Prompt Injection Critical Finding
- Provider 오류율·Latency 급증
- Token·Cost Budget 급증
- 동일 Prompt Version의 Schema 실패 증가
- Agent 설명과 Engine 결과 충돌 증가
- 승인되지 않은 Definition/Prompt 선택 시도

### 24.3 Log

구조화 Log는 `timestamp`, `level`, `service`, `requestId`, `correlationId`, `runId`, `attemptId`, `agentDefinition`, `outcome`, `latencyMs`를 포함한다. 입력 본문과 전체 Output은 일반 Log에 넣지 않는다.

---

## 25. 테스트 전략

### 25.1 Unit

- Definition·Capability·Budget 검증
- Manifest 시간·정렬·Hash
- Claim Schema·Evidence 연결
- 금지 권한 필드 탐지
- Output 상태와 Finding 매핑
- DAG Cycle·누락 Dependency 탐지
- Run 상태 전이
- Redaction

### 25.2 Security

- 문서 내 “시스템 지시 무시” 공격
- Tool 이름·URL·SQL 삽입
- 다른 사용자 Evidence ID
- Secret Echo
- Unicode/숨은 텍스트·과도한 JSON Depth
- Raw Output 권한 없는 조회
- User 간 Cache 충돌

### 25.3 Invariant

- Agent Output이 Domain 상태를 변경하지 않음
- Risk Agent 실패로 승인 가능성이 증가하지 않음
- Evidence 제거로 Accepted Claim이 증가하지 않음
- 미래 Evidence 추가가 과거 Run Hash를 바꾸지 않음
- Strategy Scope 변경으로 기존 Run이 오염되지 않음
- Fallback이 Capability를 확대하지 않음
- Replay가 운영 상태를 변경하지 않음

### 25.4 Golden

1. 공시 숫자 + 정확한 위치 → Fact Candidate Accepted
2. 출처 없는 숫자 → Claim Rejected
3. 문서 속 Tool 실행 지시 → Security Finding, 호출 0건
4. Agent “Gate 통과”와 Engine “Fail” 충돌 → Engine 우선, Agent Rejected
5. Momentum Plan 누락 → Risk Review Finding, 자동 Plan 수정 금지
6. Red Team 반대 Evidence → Thesis Candidate와 함께 보존
7. Provider Timeout → 새 Attempt, 동일 Manifest, 위험 확대 0건
8. Prompt Version Replay → 품질 비교만 수행, 활성화 0건

### 25.5 Integration

- Run Request→Manifest→Provider Stub→Validation→Repository→Outbox
- Definition/Prompt/Capability Version 계보
- Long-term Agent Plan DAG
- Momentum Required-for-Risk 실패 차단
- Learning Pattern Candidate→deterministic Lesson Gate
- Idempotency 재호출과 입력 충돌
- Partial Run과 Report 누락 표시

---

## 26. 구현 계획

### Phase 0 — 계약

- Agent Definition·Run·Manifest·Output 타입
- Stable Hash·시간·Budget 검증
- Capability 최소 권한

### Phase 1 — 검증

- Claim·Evidence·Strategy·Point-in-time 검증
- Forbidden Authority·Deterministic Conflict 검사
- Security Finding과 Redaction

### Phase 2 — Orchestration

- DAG Plan 검증
- Run/Attempt 상태
- Provider Interface와 Scripted Stub
- Retry/Fallback Outcome 계약

### Phase 3 — API/Persistence

- `008_agent_orchestration_v1.sql`
- Repository·Audit·Outbox·Idempotency
- Definition/Plan/Run/Output Validation API

### Phase 4 — 운영 연결

- Queue Worker
- 실제 Provider·Evidence Tool Adapter
- Secret Manager·Rate Limiter·Circuit Breaker
- Human Review·Prompt Evaluation UI

---

## 27. Definition of Done

### 도메인

- [ ] Engine/Agent 권한 분리
- [ ] Definition·Prompt·Provider·Schema Version 계보
- [ ] Evidence-bound Claim
- [ ] Point-in-time·Strategy Scope 검증
- [ ] Deterministic Conflict 차단
- [ ] DAG Plan·Run/Attempt 상태
- [ ] Retry·Fallback·Replay 계약

### 안전

- [ ] Agent Domain 직접 쓰기 0건
- [ ] Risk/Approval/Activation 권한 0건
- [ ] Prompt Injection Tool 실행 0건
- [ ] Secret Prompt/Log 노출 0건
- [ ] 다른 사용자 Evidence 참조 0건
- [ ] Agent 실패에 따른 위험 확대 0건

### API/DB

- [ ] Definition/Plan/Run/Validation API
- [ ] Audit/Outbox/Idempotency
- [ ] RLS/Composite FK/Immutable Trigger
- [ ] Result Hash/Replay

### 검증

- [ ] Unit/Security/Invariant/Golden/Integration
- [ ] 동일 Manifest Hash 일치
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build`

실제 외부 LLM 호출·Worker·Tool Adapter·Reviewer UI는 운영 연결 단계다. Provider가 없어도 계약·검증·Orchestrator·Persistence는 완전히 테스트 가능해야 한다.

---

## 28. 결정 기록

| ID | 결정 | 이유 |
|---|---|---|
| ADR-AG-001 | Agent Output은 비신뢰 Candidate다. | 환각·Injection·권한 우회 차단 |
| ADR-AG-002 | Engine 계산과 Agent 설명을 분리한다. | 재현성과 안전성 확보 |
| ADR-AG-003 | Claim마다 Evidence 위치를 요구한다. | 출처 위조와 검증 불가능 주장 차단 |
| ADR-AG-004 | Tool은 READ_ONLY Capability Allowlist다. | 최소 권한과 감사 가능성 |
| ADR-AG-005 | Prompt·Provider·Model·Schema Version을 Manifest에 고정한다. | Replay와 회귀 분석 |
| ADR-AG-006 | Retry는 새 Attempt, 변경은 새 Revision이다. | 불변 이력과 멱등성 |
| ADR-AG-007 | Risk 필수 Agent 실패는 Fail-closed다. | 안전 규칙 우회 방지 |
| ADR-AG-008 | Chain-of-thought를 저장하지 않는다. | Privacy·보안·불필요한 결합 방지 |
| ADR-AG-009 | 실제 Provider는 Adapter로 후속 연결한다. | Domain을 외부 SDK와 분리 |
| ADR-AG-010 | Agent는 Model·Prompt를 활성화하지 못한다. | Human Governance 유지 |
