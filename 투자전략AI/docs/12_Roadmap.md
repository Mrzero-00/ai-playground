# 12. Investment OS Roadmap

> **Version**: 1.0.0
>
> **Status**: APPROVED FOR IMPLEMENTATION
>
> **Last updated**: 2026-07-22
>
> **Audience**: Product, Engineering, Data, Security, Operations
>
> **Authoritative scope**: 01~11의 제품·도메인 계약을 변경하지 않고 배포 가능한 Increment로 배열한다.

---

## 1. 목적

이 문서는 Investment OS를 “기능이 많은 투자 앱”이 아니라 **재현 가능하고 안전한 개인 투자 운영체계**로 출시하기 위한 실행 순서를 정의한다. 각 단계는 날짜 약속이 아니라 검증 가능한 Outcome, 선행 의존성, 진입/종료 Gate, 증거 Artifact로 관리한다.

Roadmap은 다음 질문에 답한다.

1. 무엇을 어떤 순서로 통합해야 하는가?
2. 다음 단계로 이동하려면 어떤 증거가 필요한가?
3. 외부 Provider, Auth, 실제 데이터가 없어도 어디까지 검증 가능한가?
4. 언제 Rollback·중단·범위 축소를 결정하는가?
5. 문서상 구현 완료와 운영 준비 완료를 어떻게 구분하는가?

---

## 2. 문서 우선순위와 충돌 판정

### 2.1 우선순위

충돌 시 다음 순서를 따른다.

1. 01 Architecture의 Safety Invariant와 Trust Boundary
2. 02 Investment Philosophy의 투자 원칙과 Human-only Decision
3. 03~10의 Domain Contract와 상태 전이
4. 11 UI/UX의 표현·상호작용 계약
5. 12 Roadmap의 순서·Gate·Release 계획
6. 13 Codex Implementation의 현재 구현 상태

Roadmap은 상위 문서의 계약을 완화할 수 없다. 일정 압박은 Risk `DENY`, 명시적 사용자 승인, Point-in-time, 소유권, 불변 Revision, Audit/Outbox 원자성을 우회하는 근거가 아니다.

### 2.2 01~11 충돌 검토 결과

| 검토 영역 | 상위 계약 | Roadmap 해석 | 결과 |
|---|---|---|---|
| 실행 권한 | AI는 주문 권한 없음 | 모든 Phase에서 Read-only 또는 Human Approval 유지 | 충돌 없음 |
| 전략 분리 | Long-term·Momentum 독립 | 공통 UI/Portfolio는 통합하되 Score/Ranking은 분리 | 충돌 없음 |
| Portfolio | 85/15은 Policy Target | 실데이터 전에는 승인된 Policy Fixture로 Shadow 검증 | 충돌 없음 |
| Learning | 자동 Model 승격 금지 | Lesson·Change는 Human Review 후 Shadow만 수행 | 충돌 없음 |
| Agent | Evidence-bound, 최소 권한 | Provider 연결보다 Validation Boundary를 먼저 출시 | 충돌 없음 |
| Database | Lineage·Retention·RLS | 외부 DB 전 In-memory 계약 검증, Production 전 RLS E2E 필수 | 충돌 없음 |
| Scoring | 계산 불가와 0점 분리 | UI·Report·API Gate에서 `BLOCKED/UNAVAILABLE` 보존 | 충돌 없음 |
| Report | Canonical JSON이 Source of Truth | PDF/Delivery 실패가 Canonical 성공을 되돌리지 않음 | 충돌 없음 |
| UI | 서버가 최종 판정 | Client 계산은 표시용 View Model에 한정 | 충돌 없음 |

현재 발견된 기획 충돌은 없다. 다만 **구현 완료**와 **운영 준비 완료**가 혼용될 위험이 있으므로 본 문서는 Readiness Level을 별도로 둔다.

---

## 3. 범위

### 3.1 포함

- 01~11 Capability의 통합 순서
- Increment·Milestone·Dependency·Gate 모델
- Local, CI, Preview, Shadow, Production 환경 승격
- 실제 데이터·Auth·Provider 연결 순서
- 품질, 보안, 운영, 투자 안전 Release Gate
- Rollback·Kill Switch·중단 기준
- 지표·증거·의사결정 기록
- 기술부채와 운영 전제의 명시적 관리

### 3.2 비목표

- 수익률 약속 또는 투자 추천
- 자동 주문·무인 운용
- 01~11 Domain Contract 재정의
- 특정 Broker·Data Provider 확정
- 근거 없는 출시일 고정
- Gate 실패를 일정으로 Override
- Production Secret·실계좌 정보의 저장 방식 상세

---

## 4. Roadmap 원칙

### 4.1 Outcome over Output

파일·Endpoint·화면의 존재가 Milestone 완료를 의미하지 않는다. 종료 조건은 사용자 가치와 안전 속성이 검증 가능한 Artifact로 남는 것이다.

### 4.2 Walking Skeleton First

최초 통합 경로는 다음 하나의 읽기 전용 흐름이다.

```text
Snapshot
  -> Long-term / Momentum Evaluation
  -> Strategy-separated Score
  -> Portfolio Proposal
  -> Risk Decision
  -> Canonical Report
  -> UI Review
  -> Decision Preview
```

실주문은 포함하지 않는다.

### 4.3 Fail-closed Promotion

필수 증거 누락, 결과 Hash 불일치, Stale 입력, RLS 실패, Critical Reconciliation은 다음 환경 승격을 차단한다.

### 4.4 Reversible Delivery

새 Schema·Model·Prompt·Policy·UI는 가능한 한 Additive, Versioned, Feature-flagged, Replayable하게 배포한다.

### 4.5 Evidence before Automation

Scheduler·Provider 자동화보다 먼저 입력 계약, Validation, Audit, Replay, Kill Switch를 완성한다.

---

## 5. Readiness Level

| Level | 이름 | 의미 | 허용 데이터/행동 |
|---|---|---|---|
| R0 | SPECIFIED | 계약과 수용 기준이 승인됨 | 문서·Fixture |
| R1 | IMPLEMENTED | Domain/API/UI 코드와 단위 테스트 존재 | Synthetic/Fixture |
| R2 | INTEGRATED | 전체 Walking Skeleton과 Migration 검증 | Synthetic/Anonymized |
| R3 | SHADOW_READY | Auth/RLS·Provider·관측·Runbook 검증 | 실데이터 Read-only |
| R4 | SHADOW_VALIDATED | 기간·표본 Gate를 만족한 Shadow 결과 | 실데이터, 무행동 |
| R5 | USER_PILOT | 제한 사용자 Human Approval Flow | Paper/수동 실행 기록 |
| R6 | PRODUCTION_READY | 보안·복구·운영·법무 Gate 통과 | 승인된 운영 범위 |

R1은 R6가 아니다. 13 문서의 “구현됨”은 기본적으로 R1을 의미하며, 외부 연결 항목은 R2~R6에서 다룬다.

---

## 6. Workstream

| ID | Workstream | 핵심 책임 | 주요 문서 |
|---|---|---|---|
| WS-A | Platform & Contracts | API Envelope, State, Event, Hash, Replay | 01, 08 |
| WS-B | Investment Domain | Philosophy, Long-term, Momentum | 02, 03, 04 |
| WS-C | Portfolio & Risk | Lot, Allocation, Capacity, Stress, Approval | 01, 05 |
| WS-D | Intelligence | Learning, Scoring, Agent Boundary | 06, 07, 09 |
| WS-E | Experience | Report, UI, Accessibility | 10, 11 |
| WS-F | Data & Operations | Supabase, RLS, Provider, Observability, Recovery | 01, 08 |
| WS-G | Assurance | Security, Privacy, Model Risk, Release Evidence | 01~12 |

각 Increment는 한 Workstream의 부분 완료가 아니라 필요한 Workstream을 세로로 자른 결과여야 한다.

---

## 7. Capability 의존성

```text
Architecture + Philosophy
          |
          v
Snapshot / Evidence / Model / Policy Registry
          |
    +-----+------------------+
    |                        |
Long-term                Momentum
    |                        |
    +----------+-------------+
               v
        Scoring (separate scopes)
               |
               v
     Portfolio + Risk + Stress
               |
               v
       Report + Decision Review UI
               |
               v
        Learning + Model Change

Cross-cutting: Database, Agent Validation, Audit, Outbox, Observability
```

Hard Dependency는 없으면 시작할 수 없는 계약이다. Soft Dependency는 Fixture/Adapter로 대체 가능하지만 Production Gate 전에는 해소해야 한다.

---

## 8. Increment 0 — Contract Baseline

### 목표

01~12의 Invariant, 상태, 오류, Version, Hash, 소유권, Point-in-time 계약을 실행 가능한 Baseline으로 고정한다.

### 산출물

- Domain Contract와 State Machine Test
- Stable Hash·Signed Decimal·Idempotency Test
- Audit/Outbox Transaction Boundary
- Migration 순서와 검증 Manifest
- 구현 상태와 운영 전제 분리

### Exit Gate

- 전체 Test/Typecheck/Build 통과
- 문서 간 충돌 0건 또는 승인된 Decision Record 존재
- 동일 입력 Replay Hash 일치
- 자동 주문 경로 0개

### 중단 기준

- Domain 타입이 전략 간 공유되어 의미가 손실됨
- Risk `DENY` 이후 승인 생성 가능
- 사용자 소유권 또는 Point-in-time 검증 부재

---

## 9. Increment 1 — Deterministic Review MVP

### 목표

Synthetic Fixture 하나로 Long-term·Momentum 평가부터 Canonical Report와 UI Review까지 재현한다.

### 사용자 Outcome

- 서로 다른 전략 결과가 섞이지 않는다.
- Score, Range, Confidence, Blocker, Source를 확인한다.
- 현금 유지·No Action을 정상 결론으로 이해한다.
- 승인 API 미연결 상태에서는 어떤 결정도 제출할 수 없다.

### Exit Gate

- E2E Fixture Replay 결과 Hash 일치
- `BLOCKED/UNAVAILABLE`가 숫자 0으로 표시되지 않음
- Canonical Report 필수 Source/Section Coverage 통과
- 390px Mobile·Desktop 핵심 Review Flow 검증
- Console Critical/Error 0건

---

## 10. Increment 2 — Persistent Preview

### 목표

Supabase에 001~012 Migration을 적용하고 Auth/RLS 환경에서 동일 Review 흐름을 영속화한다.

### 주요 작업

- Migration dry-run, verify, rollback/forward-fix 절차
- 사용자 A/B 교차 접근 음성·양성 Test
- Audit·Outbox·Revision 불변 Trigger 검증
- Seed Fixture와 데이터 정리 절차
- Backup/PITR 설정과 Restore Drill

### Exit Gate

- Cross-user Read/Write 0건
- Migration Verification `PASSED`
- Restore Drill RPO/RTO 목표 충족
- Domain 상태와 Audit/Outbox 원자성 확인
- Critical Reconciliation 0건

---

## 11. Increment 3 — Provider Read-only Shadow

### 목표

시장·기업·환율·Calendar·Corporate Action Provider를 최소 권한 Adapter로 연결하고 실데이터를 읽기 전용 Shadow 처리한다.

### 주요 작업

- Provider Contract Test와 Rate/Quota Budget
- Source Tier, available-at, as-of, timezone 정규화
- Completion Bar·Split/Dividend·Currency 처리
- Stale/Partial/Conflict/Fallback 상태
- Secret Rotation과 Provider Kill Switch

### Exit Gate

- Point-in-time 누출 Test 0건
- Source Coverage와 Freshness SLO 충족
- Provider 장애 시 Fail-closed 또는 명시적 Degraded
- Replay 입력 Snapshot 보존
- 비용·Quota 경보 검증

---

## 12. Increment 4 — Shadow Validation

### 목표

실데이터 결과를 일정 기간 축적하여 Process 품질, Calibration, Drift, 운영 안정성을 검증한다.

### 최소 검증 축

- 전략·시장 국면·Sector·유동성 Cohort
- 결정 품질과 결과의 독립 분류
- Unknown/Stale/Conflict 비율
- Score Range Coverage와 Confidence Calibration
- Portfolio Capacity·Open Risk·Stress 분포
- Report 근거 Coverage
- Agent Claim Validation 실패율

### Exit Gate

- 승인된 최소 표본·기간 충족
- Look-ahead·Survivorship Bias Review 통과
- Critical Drift 0건 또는 승인된 Mitigation
- Shadow 결과가 운영 상태를 변경하지 않음
- Model/Policy 변경은 Champion/Challenger 절차만 사용

---

## 13. Increment 5 — Controlled User Pilot

### 목표

제한된 사용자에게 Report·Decision Journal·명시적 승인/거부를 제공하되 자동 주문은 계속 금지한다.

### 주요 작업

- 실제 Auth Session과 Re-authentication
- 승인 직전 서버 재검증
- 만료·가격·Portfolio·Risk 충돌 UX
- Paper 또는 수동 실행 결과 기록
- Support·Incident·Approval Runbook
- Privacy·법무 문구와 Analytics Redaction

### Exit Gate

- 승인 중 상태 변경 Race Test 통과
- 중복 제출·Idempotency Conflict Test 통과
- 접근성 Critical/Serious 0건
- 사용자 이해도·오조작 기준 충족
- P0/P1 Incident 대응 Drill 통과

---

## 14. Increment 6 — Production Readiness

### 목표

운영, 보안, 복구, 감사, 비용, 법무 기준을 통합 승인한다. 이 단계 역시 자동 주문 권한을 암묵적으로 허용하지 않는다.

### 필수 승인

- Product Owner: 범위·사용자 가치
- Investment Policy Owner: 전략·Risk Policy
- Engineering: 신뢰성·성능·변경 관리
- Security/Privacy: Threat Model·Secret·RLS·Retention
- Operations: SLO·Alert·Runbook·On-call·Restore
- Model Risk Reviewer: Calibration·Drift·Change Governance

### Exit Gate

- Production Readiness Review 전 항목 승인
- Open Critical Risk 0건
- Backup Restore와 Provider 장애 Drill 통과
- Rollback/Feature Flag/Kill Switch 검증
- Release Evidence Bundle 불변 저장

---

## 15. Environment 승격

| From | To | 필수 증거 | 자동/수동 |
|---|---|---|---|
| Local | CI | Test, Typecheck, Build | 자동 |
| CI | Preview | Migration lint, Contract diff, Security scan | 자동 |
| Preview | Integrated | E2E, RLS, Reconciliation | 수동 승인 |
| Integrated | Shadow | Provider contract, Runbook, Kill switch | 수동 승인 |
| Shadow | Pilot | 표본·Calibration·Usability | 위원 승인 |
| Pilot | Production | PRR Evidence Bundle | 다중 승인 |

승격은 단방향 상태 전이다. 실패한 Gate를 “조건부 통과”로 덮지 않고 Blocker와 Owner, 해소 증거를 기록한다.

---

## 16. Gate 모델

### 16.1 Gate 상태

- `PENDING`: 아직 평가 전
- `PASSED`: 모든 필수 Check 통과
- `FAILED`: 평가 완료, 하나 이상의 필수 Check 실패
- `BLOCKED`: 평가에 필요한 증거 자체가 없음
- `WAIVED`: 비안전 항목만 만료·Owner·근거가 있는 예외 승인

Safety, Security, Ownership, RLS, Point-in-time, Risk, Replay Hash Check는 Waive할 수 없다.

### 16.2 Check 결과

각 Check는 다음을 가진다.

```ts
type RoadmapCheck = {
  id: string;
  category: "PRODUCT" | "DOMAIN" | "DATA" | "SECURITY" | "QUALITY" | "OPERATIONS" | "MODEL_RISK";
  required: boolean;
  status: "PASSED" | "FAILED" | "BLOCKED" | "WAIVED";
  evidenceRefs: string[];
  evaluatedAt: string;
  evaluatorId: string;
  expiresAt?: string;
  blockerCode?: string;
};
```

### 16.3 판정 우선순위

1. 필수 증거 누락 → `BLOCKED`
2. 필수 Check 실패 → `FAILED`
3. 유효하지 않은 Waiver → `FAILED`
4. 모든 필수 Check 통과 → `PASSED`

---

## 17. Milestone과 Dependency 계약

Milestone은 다음 불변 필드를 가진다.

```ts
type RoadmapMilestone = {
  id: string;
  version: number;
  title: string;
  readinessTarget: "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6";
  status: "PLANNED" | "IN_PROGRESS" | "AT_RISK" | "BLOCKED" | "READY" | "RELEASED" | "CANCELLED";
  dependencyIds: string[];
  requiredGateIds: string[];
  ownerIds: string[];
  scopeRefs: string[];
  targetWindow?: { start: string; end: string };
};
```

규칙:

- Dependency Graph는 비순환이어야 한다.
- 자기 자신과 존재하지 않는 Milestone을 참조할 수 없다.
- Dependency가 `READY/RELEASED`가 아니면 현재 Milestone은 `READY`가 될 수 없다.
- 필수 Gate가 `PASSED`가 아니면 `RELEASED`가 될 수 없다.
- Target Window는 약속이 아니라 계획 가정이며 안전 Gate보다 우선하지 않는다.
- 완료 후 내용 수정은 기존 Record 변경이 아니라 새 Version을 만든다.

---

## 18. Critical Path

현재 Critical Path는 다음과 같다.

```text
Contract Baseline
  -> End-to-end Fixture
  -> Supabase Migration + Auth/RLS
  -> Provider Read-only
  -> Shadow Dataset
  -> Calibration + Operations Drill
  -> Controlled Pilot
  -> Production Readiness Review
```

UI 확장, PDF Renderer, 추가 Provider는 병렬화할 수 있지만 Auth/RLS, Point-in-time Data, Restore, Shadow 표본은 대체할 수 없다.

---

## 19. Release Train과 변경 유형

| 변경 유형 | 예 | 요구 Gate |
|---|---|---|
| DOC_ONLY | 설명·Runbook 정정 | Link/Conflict Review |
| PATCH | UI 문구·비안전 Bug | Test/Build |
| DOMAIN_MINOR | 새 상태·선택 필드 | Contract/Replay/Migration |
| MODEL_POLICY | Weight·Threshold·Prompt | Replay/Walk-forward/Shadow/Approval |
| DATA_SCHEMA | Table·RLS·Retention | Migration/RLS/Restore/Reconciliation |
| SAFETY_CRITICAL | Risk·승인·Execution 경계 | 전체 Safety Review와 다중 승인 |

Release Train은 작은 Batch를 선호하며 Model/Policy와 Schema의 동시 대규모 변경을 피한다.

---

## 20. Feature Flag와 Kill Switch

필수 Control:

- Workstream 또는 Capability 단위 Read Flag
- Provider Adapter 단위 Disable
- Agent Definition/Prompt Version Disable
- Report Delivery Disable
- Decision Submission Disable
- 모든 외부 Side Effect Global Disable

Kill Switch는 UI에만 존재하면 안 된다. 서버와 Worker가 동일한 운영 Policy를 확인해야 하며 변경은 Audit Event로 남긴다.

---

## 21. Rollback과 Forward Fix

### Rollback 가능

- UI/Renderer/Read Adapter
- Feature Flag
- 이전 Active Model/Policy로 전환
- Stateless Worker Version

### 직접 Rollback 금지

- Published Report·Decision·Audit·Outbox·Review
- Applied Destructive Migration
- 이미 외부에 전달된 Artifact

이 경우 불변 Revision, 보상 Event, Additive Migration, Forward Fix를 사용한다.

---

## 22. Risk Register

| Risk | 조기 신호 | 예방 | 대응 |
|---|---|---|---|
| 운영 준비와 구현 완료 혼동 | R1을 Production Ready로 표현 | Readiness Level | 승격 차단 |
| Provider 데이터 누출 | available-at > decision-at | PIT Test | 결과 폐기·Incident |
| 전략 혼합 | 단일 Ranking/Score | Scope 타입 분리 | 결과 차단 |
| RLS 오류 | Cross-user Test 실패 | DB Gate | 환경 폐쇄 |
| Model 과적합 | Cohort 편중·Drift | Walk-forward/Shadow | Challenger 중단 |
| 승인 Race | 승인 중 Proposal 변경 | 서버 재검증 | 409·새 Proposal |
| 비용 폭증 | Agent/Provider Quota 증가 | Budget/Alert | Capability Disable |
| 설명-결과 불일치 | Report Hash/Source mismatch | Canonical/Replay | Artifact 폐기 |
| 운영자 피로 | Alert false positive | SLO/Error Budget | Alert 재설계 |

---

## 23. Metric 체계

### Product

- Review 완료율과 소요 시간
- 근거 Drawer/Lineage 확인율
- 승인·거부·No Action 이해도
- 잘못된 전략 혼합 인지 사례

### Quality/Safety

- Blocked 결과의 숫자 표시 위반 0건
- Cross-user 접근 0건
- Replay Hash 불일치 0건
- 승인 직전 재검증 누락 0건
- Critical Reconciliation 0건

### Data/Model

- Source Freshness·Coverage·Conflict
- Confidence Calibration과 Range Coverage
- Regime/Cohort Drift
- Claim Validation 실패율
- Lesson Acceptance와 No-change 비율

### Operations

- Availability, latency, job success
- Provider quota/cost
- RPO/RTO Drill 결과
- Incident MTTA/MTTR
- Error Budget 소진율

Metric은 전략 수익률만으로 Roadmap 성공을 판정하지 않는다.

---

## 24. Release Evidence Bundle

각 승격은 다음 Bundle을 Content Hash와 함께 고정한다.

- Commit SHA와 Build Artifact
- 문서 Version과 Contract Diff
- Test/Typecheck/Build 결과
- Migration·RLS·Reconciliation 결과
- Replay·Calibration·Drift 결과
- Security/Privacy Review
- Accessibility/Usability 결과
- Runbook·Restore·Incident Drill
- Open Risk와 승인/거부 기록
- Feature Flag·Kill Switch 상태

Bundle의 누락은 `BLOCKED`이며 빈 Evidence Ref로 `PASSED`를 만들 수 없다.

---

## 25. 운영 Cadence

| Cadence | Review |
|---|---|
| 매 변경 | Contract, Test, Build, Risk Diff |
| 매주 | Milestone/Gate/Blocker, Provider/Data Quality |
| 격주 | Product Usability, Accessibility, Tech Debt |
| 매월 | Model/Policy Drift, Cohort, Cost, Retention |
| 분기 | Architecture, Threat Model, Restore, Roadmap 재승인 |
| Incident 후 | Blameless Review와 Gate/Runbook 개선 |

Roadmap 수정은 과거 결과를 덮어쓰지 않고 Revision과 변경 사유를 남긴다.

---

## 26. 현재 Baseline과 다음 순서

### 현재

- 01~11 Specification 작성 및 Foundation 구현: R1
- Core/API/Web Unit·Build 검증: R1
- Supabase Migration 파일: R1, 실제 적용 미검증
- 실제 Auth/RLS/Provider/Backup/Observability: R0~R1
- 실데이터 Shadow/Pilot/Production: 미진입

### 다음 실행 순서

1. Roadmap Gate·Dependency·Release Evidence 계약을 코드화한다.
2. 전체 Fixture Walking Skeleton을 하나의 Replay Test로 묶는다.
3. Supabase Preview에 Migration을 적용하고 Auth/RLS E2E를 수행한다.
4. Backup/PITR·Restore와 Reconciliation을 검증한다.
5. Provider 하나를 Read-only로 연결해 Point-in-time Shadow를 시작한다.
6. 최소 표본·기간을 사전 등록하고 Shadow Validation을 수행한다.

---

## 27. Definition of Done

- [x] 01~11과의 우선순위·충돌 판정이 명시되어 있다.
- [x] 구현 완료와 운영 준비 완료가 분리되어 있다.
- [x] Capability Dependency와 Critical Path가 정의되어 있다.
- [x] 각 Increment의 Outcome·Exit Gate·중단 기준이 있다.
- [x] 환경 승격과 Waive 불가 Safety Gate가 있다.
- [x] Milestone·Dependency·Gate·Evidence 계약이 결정론적으로 정의되어 있다.
- [x] Rollback 불가 Record에 Forward Fix 원칙이 있다.
- [x] Risk·Metric·운영 Cadence가 있다.
- [x] Roadmap 계약의 실행 코드와 테스트가 있다.
- [ ] Preview Supabase·Auth/RLS·Provider 환경 증거가 있다.
- [ ] Shadow/Pilot/Production Gate가 실제로 통과되었다.

---

## 28. 구현 경계

이번 단계에서 구현할 수 있는 범위:

- `planning-v1` Milestone, Dependency DAG, Gate, Check, Evidence Bundle
- Fail-closed Readiness 판정과 Stable Result Hash
- 상태 전이·Revision·Replay 계약
- Unit Test와 012 Migration

구현 완료 항목:

- `planning-v1` Gate·Check·Milestone·Dependency DAG·Readiness 판정
- 비순환·소유권·필수 Gate·Target Window·Linear Revision 검증
- 비 Waivable/만료 Waiver·필수 Evidence를 Fail-closed하는 Gate
- Build·Contract·Test·Migration·Security·Operations·Gate를 묶는 Release Evidence Bundle
- 입력 순서와 무관한 Stable Hash 및 Historical Replay
- Roadmap Plan·Revision·Gate·Evidence·Replay API와 Audit/Transactional Outbox
- `012_roadmap_planning_v1.sql` Plan·Gate·Check·Milestone·Dependency·Evidence·Replay Schema, RLS, Index, 불변 Trigger

외부 연결 없이는 완료할 수 없는 범위:

- Preview Supabase 실제 Migration/RLS E2E
- Provider 실데이터 Shadow
- Backup/PITR Restore Drill
- 실사용 Accessibility/Usability
- Calibration 최소 표본과 운영 승인

이 경계는 미완료를 숨기기 위한 것이 아니라 R1과 R2~R6를 정확히 구분하기 위한 것이다.
