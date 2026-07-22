# 13. Codex Implementation & Verification

> **Version**: 1.0.0
>
> **Status**: R1 IMPLEMENTED / R2+ EXTERNAL GATES OPEN
>
> **Evidence as of**: 2026-07-22
>
> **Scope**: 01~12 명세의 코드 구현 상태, 검증 증거, 운영 전제와 다음 실행 순서

---

## 1. 목적

이 문서는 “무엇이 구현되었는가”를 파일 목록으로만 주장하지 않는다. 각 Capability를 다음 네 가지로 연결한다.

```text
Specification
  -> Implementation
  -> Verification Evidence
  -> Readiness / Open Gate
```

핵심 목적은 다음과 같다.

1. 01~12의 구현 상태를 동일한 기준으로 판정한다.
2. 코드 완료와 운영 준비 완료를 구분한다.
3. 구현 주장을 실제 파일·Migration·Test·Build 증거와 연결한다.
4. 자동 주문 금지, Human Approval, 전략 분리 등 안전 불변식을 재확인한다.
5. 다음 작업이 외부 환경 없이 가능한지 명확히 표시한다.

---

## 2. 문서 우선순위

이 문서는 구현 현황을 보고하는 하위 문서다. Domain 또는 Safety 계약을 변경하지 않는다.

1. 01 Architecture — System Boundary와 Safety Invariant
2. 02 Investment Philosophy — 투자 원칙과 Human-only Decision
3. 03~10 — Engine, Data, Scoring, Report Domain Contract
4. 11 — 사용자 표현과 상호작용 계약
5. 12 — Readiness, Gate, Release 순서
6. 13 — 구현 증거와 Gap 보고

불일치가 발견되면 코드를 상위 명세에 맞추거나 상위 문서 Revision을 먼저 승인한다. 13의 상태 표시는 상위 계약을 Override할 수 없다.

---

## 3. 상태 용어

### 3.1 구현 상태

| 상태 | 의미 |
|---|---|
| `NOT_STARTED` | 문서만 있고 코드가 없음 |
| `FOUNDATION` | 타입·핵심 함수 또는 UI 골격이 있음 |
| `IMPLEMENTED` | Core/API/Schema 또는 해당 범위 코드와 테스트가 있음 |
| `INTEGRATED` | 전체 Walking Skeleton에서 검증됨 |
| `SHADOW_VALIDATED` | 실데이터 Shadow 기간·표본 Gate 통과 |
| `PRODUCTION_READY` | 보안·복구·운영·법무 Gate까지 통과 |

### 3.2 Roadmap Readiness

12 문서의 R0~R6를 사용한다.

- 현재 Repository Baseline: **R1 IMPLEMENTED**
- Preview Supabase·Auth/RLS: R2 Gate 미통과
- 실데이터 Read-only Shadow: R3 Gate 미통과
- Shadow Validation: R4 미진입
- Controlled User Pilot: R5 미진입
- Production Readiness: R6 미진입

`IMPLEMENTED`나 R1을 Production Ready로 표현하지 않는다.

---

## 4. 기준 문서

| No | 문서 | Version | 문서 상태 | 구현 판정 기준 |
|---|---|---|---|---|
| 01 | Architecture | v2.3 | Architecture Baseline | Boundary, State, Audit, Outbox, Approval |
| 02 | Investment Philosophy | v2.2.1 | Detailed Specification Draft | Policy, Evidence, Thesis, Safety |
| 03 | Long-term Engine | v1.0.0-draft | Implementation-ready Draft | Core/Future Core, Valuation, Replay |
| 04 | Momentum Engine | v1.0.0-draft | Implementation-ready Draft | Universe, Setup, Plan, Replay |
| 05 | Portfolio Engine | v1.0.0 | Core Implemented | Ledger, Capacity, Risk, Stress |
| 06 | Learning Engine | v1.0.0 | Core/API/Schema Implemented | Review, Cohort, Lesson, Change |
| 07 | AI Agents | v1.0.0 | Core/API/Schema Implemented | Capability, Manifest, Validation |
| 08 | Database | v1.0.0 | Core/API/Schema Implemented | Lineage, Retention, RLS, Reconcile |
| 09 | Scoring System | v1.0.0 | Core/API/Schema Implemented | Scope, Model, Scorecard, Confidence |
| 10 | Report System | v1.0.0 | Core/API/Schema Implemented | Canonical, Artifact, Revision, Replay |
| 11 | UI/UX | v1.0.0 | Review MVP Implemented | Safe View Model, Responsive Review UI |
| 12 | Roadmap | v1.0.0 | Approved for Implementation | Gate, Milestone, Evidence, Readiness |

03·04와 02의 문서 상태가 Draft인 사실을 숨기지 않는다. 현재 코드는 해당 Draft 계약의 Foundation을 구현했으며 Production Policy 확정은 별도 승인 대상이다.

---

## 5. Architecture Conformance

| Invariant | 구현 위치 | 검증 | 상태 |
|---|---|---|---|
| Long-term·Momentum Score 분리 | `long-term-v1`, `momentum-v1`, `scoring-v1` | Scope/Ranking Test | PASS |
| Portfolio에서만 자본 통합 | `portfolio-v1` | Ledger/Capacity/Batch Test | PASS |
| Risk `DENY` Override 금지 | Risk/Decision Workflow | Approval·Manual Review Test | PASS |
| 사용자 승인 전 행동 금지 | Decision Workflow, UI | State/API/UI Test | PASS |
| AI Agent 주문 권한 없음 | `agent-v1` Capability | Forbidden Authority Test | PASS |
| Point-in-time | Snapshot/Evidence/Database/Report/Planning | Future Input Test | PASS |
| 불변 Revision | Thesis/Plan/Lesson/Model/Report/Roadmap | Lineage Test | PASS |
| Decimal 문자열 | Decimal, Portfolio, Attribution | Precision/Reconciliation Test | PASS |
| Audit + Transactional Outbox | Repository/API | API Lineage Test | PASS |
| Replay 결과 결정론 | 각 Engine/Report/Roadmap | Stable Hash Test | PASS |
| Cross-user 격리 | Migration RLS 정의 | 실제 Auth/RLS E2E 필요 | OPEN |
| Backup/Restore | 운영 환경 | Restore Drill 필요 | OPEN |

Repository 범위의 Invariant는 통과했지만 실제 Supabase의 RLS와 복구 능력은 아직 증거가 없다.

---

## 6. Capability 구현 매트릭스

### 6.1 01 Architecture

- 상태: `IMPLEMENTED / R1`
- 코드: 공통 Contract, State Machine, Workflow, Repository, Audit, Event, Outbox
- Schema: `001`, `002`
- 증거: Architecture/Core/API Test
- Open Gate: 실제 Service Adapter, Distributed Transaction, 운영 Observability

### 6.2 02 Investment Philosophy

- 상태: `IMPLEMENTED / R1`
- 코드: Philosophy Policy, Evidence Tier, Thesis, Momentum Plan, Decision Journal, Attribution
- Schema: `003_investment_philosophy_v2_2_1.sql`
- 증거: Risk DENY, 85/15, Evidence, Thesis, Journal Test
- Open Gate: 실제 운용 Policy 승인, 법무 문구, 사용자 적합성

### 6.3 03 Long-term Engine

- 상태: `IMPLEMENTED / R1`
- 코드: Core/Future Core Profile, Factor, Gate, Valuation, Thesis Assessment, Stage, Replay
- API: 평가, 조회, 최신 기업 평가, Ranking, Due Review, Replay
- Schema: `004_long_term_engine_v1.sql`
- 증거: Profile 독립, N/A, Unknown, Hard Risk, Valuation, Replay Test
- Open Gate: Provider, 실제 Historical Walk-forward, Policy Calibration

### 6.4 04 Momentum Engine

- 상태: `IMPLEMENTED / R1`
- 코드: Universe, Regime, Indicator, 7 Factor, Setup, Trade Plan, Lifecycle, Replay
- API: Scan, 평가, Ranking, Plan/Revision, 가격 검증, Due Review, Replay
- Schema: `005_momentum_engine_v1.sql`
- 증거: Universe, Corporate Action, Chase, Event Gap, Lifecycle Test
- Open Gate: 완료 Bar·Calendar·Quote Provider, Scheduler, 실제 비용 Model

### 6.5 05 Portfolio Engine

- 상태: `IMPLEMENTED / R1`
- 코드: Snapshot Ledger, Exposure, Open Risk, Sizing, Batch, Rebalance, Stress
- API: Policy, Proposal, Batch, Portfolio View, Rebalance, Stress, Replay
- Schema: `006_portfolio_engine_v1.sql`
- 증거: 85/15, Future Core, FX, Capacity, Open Risk, Stress Test
- Open Gate: 실제 계좌 Position/FX, Policy 승인, Broker Reconciliation

### 6.6 06 Learning Engine

- 상태: `IMPLEMENTED / R1`
- 코드: Review Manifest, Maturity, Process/Outcome, Cohort, Lesson, Model Change
- API: Review, Cohort, Lesson, Validation, Change Workflow
- Schema: `007_learning_engine_v1.sql`
- 증거: 과정/결과 분리, Censoring, No-change, Champion/Challenger Test
- Open Gate: 최소 표본, 실제 Shadow, Human Review Committee

### 6.7 07 AI Agents

- 상태: `IMPLEMENTED / R1`
- 코드: Definition, Prompt, Capability, Plan DAG, Run, Provider, Output Validation
- API: Definition, Plan Validate, Run, Output, Replay, Cancel
- Schema: `008_agent_orchestration_v1.sql`
- 증거: 최소 권한, Injection, Secret, Evidence Claim, Deterministic Override Test
- Open Gate: 실제 Provider, Cost/Quota, Prompt Red-team, 운영 Kill Switch

### 6.8 08 Database

- 상태: `IMPLEMENTED / R1`
- 코드: Lineage, Retention, Deletion Revision, Reconciliation
- API: Health, Migration, Lineage, Retention, Deletion, Reconciliation
- Schema: `001`~`012`
- 증거: Ownership/PIT/Cycle/Legal Hold/Decimal Test
- Open Gate: Preview 적용, Auth/RLS E2E, PITR, Restore, Query Plan, 부하

### 6.9 09 Scoring System

- 상태: `IMPLEMENTED / R1`
- 코드: Model Lifecycle, Normalization, Evidence Gate, Scorecard, Confidence, Ranking, Change
- API: Model, Transition, Evaluate, Ranking, Change, Replay
- Schema: `010_scoring_system_v1.sql`
- 증거: Basis Point, N/A/Unknown, Scope, Range, Confidence, Stable Ranking Test
- Open Gate: Historical Calibration, Walk-forward, Shadow, Reviewer 승인

### 6.10 10 Report System

- 상태: `IMPLEMENTED / R1`
- 코드: Template, Source Manifest, Canonical Compose, Renderer, Revision, Replay
- API: Template, Report, Artifact, Revision, Replay
- Schema: `011_report_system_v1.sql`
- 증거: PIT/Ownership, Coverage, Counter Evidence, Stable Hash, Escaping Test
- Open Gate: PDF Renderer, Object Storage, Delivery Provider, Redaction 운영 검증

### 6.11 11 UI/UX

- 상태: `FOUNDATION / REVIEW MVP / R1`
- 코드: Next.js App Router Dashboard, Score/Confidence, Report, Lineage, Decision Panel
- 증거: View Model Test, Production Build, Desktop/390px Browser Review, Console 0 Error
- 안전 경계: 잘못된 시각, DENY, Stale, Manual Review, 미연결 Endpoint Fail-closed
- Open Gate: Auth/API 실연결, axe, Screen Reader, Visual Regression, RUM, 사용자 Test

### 6.12 12 Roadmap

- 상태: `IMPLEMENTED / R1`
- 코드: Gate, Check, Milestone DAG, Plan Revision, Evidence Bundle, Replay
- API: Gate, Plan, Revision, Release Evidence, Replay
- Schema: `012_roadmap_planning_v1.sql`
- 증거: Gate 재계산, Waiver, Cycle, Required Gate, Cross-plan Boundary Test
- Open Gate: 실제 Preview/Shadow/Pilot Release Evidence

---

## 7. Repository 구조

```text
apps/
  api/                    HTTP API, request trace, idempotency, Audit/Outbox
  web/                    Next.js review dashboard and safe decision UI

packages/core/src/
  long-term-v1/           Long-term deterministic domain
  momentum-v1/            Momentum deterministic domain
  portfolio-v1/           Portfolio ledger, sizing and stress
  learning-v1/            Review, lesson and model governance
  agent-v1/               Untrusted AI boundary and orchestration
  database-v1/            Lineage, retention and reconciliation
  scoring-v1/             Versioned deterministic scoring
  report-v1/              Canonical report and artifacts
  planning-v1/            Roadmap gate and release evidence

supabase/migrations/      001~012 additive schema and RLS
docs/                     00~13 product and engineering baseline
```

Legacy Preview 모듈은 호환을 위해 남아 있고 v1 모듈이 현재 명세 구현 기준이다.

---

## 8. API 경계

공통 계약:

- `/api/v1/*`와 내부 `/api/*` Alias
- 상태 변경 요청의 `Idempotency-Key`
- `X-Request-Id`, `X-Correlation-Id`
- JSON Decimal 문자열
- 서버 재검증
- Domain State + Audit + Outbox 원자 저장 계약
- Error Code 기반 안전 복구

API는 자동 주문을 실행하지 않는다.

```text
Evaluation
  -> Cross Signal
  -> Allocation Proposal
  -> Risk Decision
  -> Decision Proposal
  -> Explicit User Approval
  -> Execution Record
```

`Execution Record`는 승인된 외부 실행의 감사 기록 경계이며 현재 시스템이 무인 주문을 생성한다는 의미가 아니다.

---

## 9. 데이터베이스 상태

### 구현됨

- 001~012 순서형 Migration 파일
- UUID, Composite Ownership FK, Index, RLS
- 주요 불변 Record Update/Delete Trigger
- Revision Chain과 상태 전이 Trigger
- Point-in-time·Cross-plan·Evidence Boundary
- Reconciliation과 Migration Verification Schema

### 아직 증거 없음

- 실제 Supabase Project 적용
- Auth 사용자 A/B RLS E2E
- Service Role 최소 권한
- PITR와 Restore Drill
- Migration Lock/Timeout/대용량 Table 영향
- Query Plan과 부하
- Retention Operator 실행

Migration 파일의 존재는 실제 DB 운영 검증을 뜻하지 않는다.

---

## 10. 검증 증거 Snapshot

2026-07-22 Baseline:

| Suite | 결과 |
|---|---:|
| Core Unit/Contract | 128 passed |
| API Contract | 11 passed |
| Web View Model | 5 passed |
| Total | 144 passed |
| TypeScript | Core/API/Web passed |
| Production Build | Core/API/Next passed |
| Browser Review | Desktop + 390px Mobile passed |
| Browser Console | warning/error 0 |

검증 명령:

```bash
pnpm test
pnpm typecheck
pnpm build
```

이 Snapshot은 Commit과 함께 갱신되어야 하며 최신 실행 없이 영구 보증으로 사용하지 않는다.

---

## 11. 자동 검증 Manifest 계약

Implementation Status는 사람이 적은 목록만으로 관리하지 않는다. Machine-readable Manifest가 다음을 연결해야 한다.

```ts
type CapabilityImplementation = {
  id: string;
  document: string;
  readiness: "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6";
  implementationPaths: string[];
  testPaths: string[];
  migration?: string;
  openGateCodes: string[];
};
```

Verifier 요구사항:

1. 01~12 Entry가 빠짐없이 고유해야 한다.
2. 문서·구현·테스트·Migration 경로가 실제로 존재해야 한다.
3. Migration 번호가 중복 없이 연속이어야 한다.
4. Manifest의 최신 Migration이 실제 최신 파일과 일치해야 한다.
5. R2 이상 주장은 필요한 외부 Evidence Ref 없이는 실패해야 한다.
6. 자동 주문 비활성 Flag가 명시되어야 한다.
7. 실패 결과는 0 Exit로 위장하지 않아야 한다.

---

## 12. 보안·개인정보 상태

### Repository에서 검증됨

- Secret 형태 Agent Context 차단
- Untrusted Output Schema·Injection 검사
- 사용자 소유권과 Point-in-time
- RLS Policy 정의
- Client Log에 Secret을 넣지 않는 UI 경계
- 자동 주문 비활성

### 운영 전 필요

- Threat Model Review
- 실제 CSP/CSRF/CORS
- Secret Manager와 Rotation
- Auth Session·Re-authentication
- Analytics/Log Redaction 검사
- Dependency/SBOM/Vulnerability Gate
- Incident Response와 Key Revocation Drill

---

## 13. 알려진 Gap

### P0 — Production 진입 차단

- 실제 Auth/RLS E2E 없음
- Backup/PITR·Restore 증거 없음
- 실데이터 Point-in-time Provider 없음
- 실제 Policy/Model 승인 없음
- 운영 Security/Privacy Review 없음

### P1 — Shadow 진입 전 필요

- Provider Contract·Quota·Cost·Kill Switch
- Scheduler와 완료 Bar·Calendar·Corporate Action
- Observability SLO·Alert·Runbook
- Reconciliation Operator
- Shadow 표본·기간 사전 등록

### P2 — Pilot 전 필요

- Web Auth/API 연결
- 승인 Race·Re-auth E2E
- Accessibility 자동·수동 검증
- Usability Test와 법무 문구
- PDF/Delivery 운영 연결

---

## 14. 다음 실행 순서

12 Roadmap의 Critical Path를 따른다.

1. Implementation Manifest와 Verifier를 코드화한다.
2. 전체 Synthetic Walking Skeleton Replay를 통합 Test로 묶는다.
3. Preview Supabase에 001~012를 실제 적용한다.
4. Auth 사용자 A/B로 RLS E2E를 수행한다.
5. Backup/PITR와 Restore Drill을 수행한다.
6. Provider 하나를 Read-only로 연결한다.
7. Shadow 표본·기간·중단 기준을 사전 등록한다.

1~2는 Repository만으로 가능하다. 3 이후는 외부 환경과 Credential이 필요하다.

---

## 15. 변경 관리

새 Capability 또는 Migration이 추가되면 다음을 함께 변경한다.

- 해당 Specification Version/Status
- Implementation Manifest
- 구현·테스트 경로
- Migration Latest Marker
- README 구조/API
- 13 Capability Matrix와 증거 Snapshot
- 12 Roadmap Gate 또는 Open Gate

문서와 코드 중 하나만 바뀐 상태로 구현 완료를 선언하지 않는다.

---

## 16. Definition of Done

- [x] 01~12의 문서 Version과 구현 상태가 구분되어 있다.
- [x] R1과 R2~R6 운영 준비가 분리되어 있다.
- [x] Architecture Safety Invariant별 구현·증거·Open Gate가 있다.
- [x] 각 Capability가 코드·API·Schema·Test·외부 Gap과 연결된다.
- [x] 실제 Supabase·Provider·Auth 미검증 상태를 명시한다.
- [x] 자동 주문 금지와 Human Approval 경계를 재확인한다.
- [x] 현재 Test/Typecheck/Build·Browser Evidence가 기록되어 있다.
- [ ] Machine-readable Implementation Manifest가 있다.
- [ ] Manifest Verifier와 자동 테스트가 있다.
- [ ] R2 Preview Evidence Bundle이 있다.
- [ ] R3~R6 Gate가 실제로 통과되었다.

---

## 17. 완료 판정

01~12의 **Repository 구현 목표는 R1 기준으로 완료**되었다. 이는 다음을 의미한다.

- Specification 기반 Domain/API/UI/Migration Foundation이 존재한다.
- 결정론, Fail-closed, 소유권, Point-in-time, Revision, Audit/Outbox를 자동 테스트한다.
- 전체 Typecheck와 Production Build가 통과한다.

다음은 완료를 의미하지 않는다.

- 실제 자금 운용 준비
- Production Security/Privacy 승인
- 실데이터 성능·정확도·수익성 검증
- Auth/RLS·Backup/Restore 운영 검증
- 자동 주문 허용

따라서 다음 개발의 Breakpoint는 코드 부족이 아니라 **R2 외부 환경 증거의 부재**다. Repository 안에서 가능한 다음 작업은 Implementation Manifest 검증과 Synthetic Walking Skeleton 통합이며, 그 이후에는 Preview Supabase와 Provider Credential이 필요하다.
