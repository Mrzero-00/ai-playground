# 08. Database Specification

> Investment OS의 의사결정·근거·모델·실행·학습 계보를 사용자별로 격리하고, 과거를 덮어쓰지 않으며, 장애 후에도 재현 가능한 PostgreSQL/Supabase 저장 계층 명세

- 문서 버전: `v1.0.0`
- 작성일: `2026-07-22`
- 상태: `CORE/API/SCHEMA IMPLEMENTED`
- 선행 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1, `03`~`07` Engine/Agent 명세
- 후속 문서: `09_Scoring_System.md`, `10_Report_System.md`, `11_UI_UX.md`, `12_Roadmap.md`
- 기준 DB: PostgreSQL 15+ / Supabase
- 기준 Migration: `001`~`009`

---

## 0. 문서의 역할

Database는 단순 저장 공간이 아니다. 다음 불변식을 최종 방어하는 계층이다.

1. 다른 사용자의 Portfolio·Decision·Evidence를 참조할 수 없다.
2. 완료된 Evaluation·Proposal·Decision·Review·Lesson·Agent Output을 덮어쓰지 않는다.
3. 모든 결과에서 당시 Model·Policy·Snapshot·Evidence·Code Version을 역추적할 수 있다.
4. Domain 상태와 Event 발행 의도를 같은 Transaction에 기록한다.
5. Decimal 금액·시간·Enum·상태 전이를 DB 제약으로도 방어한다.
6. 삭제·정정·Retention도 감사 가능한 Workflow로 처리한다.
7. 백업 성공이 아니라 실제 복구 가능성으로 운영 준비를 판단한다.

### 0.1 규범 우선순위

1. 법적 보존·삭제, 개인정보, 인증·인가
2. `01`의 안전 불변식·Point-in-time·Outbox
3. `02`의 Evidence·Decision Journal·전략 Lot 분리
4. `03`~`07`의 Domain별 Schema·상태·승인 계약
5. 이 문서의 물리 저장·RLS·Migration·운영 정책

### 0.2 선행 문서 충돌 검토

| 경계 | 선행 계약 | DB 적용 | 결론 |
|---|---|---|---|
| 전략 분리 | Long-term/Momentum 점수·Lot 분리 | Strategy/Profile/Lot FK와 Check | 충돌 없음 |
| Risk | `DENY` Override 금지 | 상태 전이 Trigger·Append-only Decision | 충돌 없음 |
| 승인 | 사람 승인 전 실행 금지 | Decision/Execution FK·상태 Check | 충돌 없음 |
| Snapshot | 과거 입력 덮어쓰기 금지 | Snapshot Revision·Hash·시각 | 충돌 없음 |
| Learning | Review→Lesson→Model Change 계보 | Composite FK·불변 결과 | 충돌 없음 |
| Agent | 비신뢰 Output·최소 권한 | Raw/Validated 분리·RLS | 충돌 없음 |
| Report | 근거와 버전 보존 | Report Revision·Evidence Link | 충돌 없음 |

---

## 1. 목표와 비목표

### 1.1 목표

- 사용자·Portfolio 소유권을 모든 참조 경로에서 강제한다.
- Domain Record를 불변 원본과 명시적 Revision으로 저장한다.
- `observedAt`, `availableAt`, `asOf`, `createdAt`의 의미를 분리한다.
- 금액·가격·수량은 `numeric`, API에서는 Decimal String으로 보존한다.
- JSONB는 유연한 Payload에만 사용하고 핵심 검색·제약 필드는 Column으로 승격한다.
- Composite FK·Check·Unique·Trigger로 Application 실수를 방어한다.
- RLS와 Service 계층 Ownership 검증을 함께 사용한다.
- Outbox·Processed Event·Idempotency를 표준화한다.
- Migration을 순방향·무중단·검증 가능하게 운영한다.
- Backup·PITR·Restore Drill·Retention·삭제 요청을 운영 계약으로 만든다.

### 1.2 비목표

- Database Trigger 안에서 투자 점수 계산
- DB를 Provider 원문 무제한 Document Lake로 사용
- JSONB 하나로 모든 Domain Entity 저장
- Client가 Service Role로 직접 쓰기
- 완료 이력의 Hard Delete를 일반 API에 제공
- Production Migration 자동 Rollback
- 백업 파일 존재만으로 복구 완료 선언
- Analytics Query가 운영 Transaction을 장시간 점유하는 구조

---

## 2. 저장 원칙

### 2.1 Source of Truth

| 데이터 | Source of Truth |
|---|---|
| 사용자·세션 | Supabase Auth |
| Portfolio·Lot·Cash | Portfolio Ledger Tables |
| Evidence·Snapshot | Data Platform Tables |
| Evaluation·Plan | Strategy Result Tables |
| Risk·Decision·Execution | Decision Chain Tables |
| Review·Lesson·Model Change | Learning Tables |
| Agent Manifest·Validated Claim | Agent Tables |
| Event 발행 의도 | `event_outbox` |
| 감사 | `audit_logs`와 Domain Revision |

Report·Cache·검색 Index는 파생 데이터이며 원본을 대체하지 않는다.

### 2.2 불변과 가변

불변:

- Snapshot·Evidence
- 완료 Evaluation·Plan·Proposal·Stress Result
- Decision·Execution 사실
- Review·Attribution·Cohort·Lesson
- Model Validation
- Agent Manifest·Attempt·Raw/Normalized Output·Validation
- Domain Event·Audit

통제된 가변:

- 현재 Portfolio 이름·표시 설정
- Job/Outbox 실행 상태
- Circuit Breaker 상태
- 삭제 요청 Workflow 상태
- 운영 Incident 상태

가변 상태도 Terminal이면 수정하지 않거나 Resolution Revision을 추가한다.

### 2.3 Revision 패턴

```text
logical entity
  ├─ revision 1 (immutable)
  ├─ revision 2, supersedes revision 1
  └─ revision 3, supersedes revision 2
```

현재값 조회는 최신 Revision View나 Query로 제공한다. 과거 Row를 UPDATE해 현재처럼 보이게 만들지 않는다.

---

## 3. Naming과 타입

### 3.1 Naming

- Table·Column·Constraint: `snake_case`
- 영속 Enum 값: `UPPER_SNAKE_CASE`
- PK: `id`
- 사용자 소유: `user_id`
- 시각: 의미 + `_at`, 기준시각은 `_as_of`
- 외부 Version: `*_version`
- FK: `*_id`
- 복수 ID: 가능하면 Link Table, 제한된 Manifest는 `uuid[]`
- Boolean: 긍정형 `complete`, `enabled`, `point_in_time_valid`

### 3.2 ID

- 내부 PK는 UUID
- Domain 외부 식별자는 별도 Column
- 순차 ID를 사용자 노출하지 않는다.
- Event·Outbox는 같은 UUID를 공유할 수 있다.
- Composite FK를 위해 사용자 소유 Table은 `unique(id, user_id)`를 둔다.

### 3.3 Decimal

| 용도 | DB 타입 |
|---|---|
| 가격·수량·금액 | `numeric(30,6)` 기본 |
| 비율·수익률 | `numeric(16,8)` |
| 점수 | `numeric(8,5)` |
| 통화 | `text check (~ '^[A-Z]{3}$')` |

Float/Double은 투자 금액·가격·수량·손익에 사용하지 않는다. 계산 결과는 Reconciliation Check를 둔다.

### 3.4 시간

모든 운영 시각은 `timestamptz`다. 거래 Session Date만 `date`를 사용할 수 있다. Application과 DB Session Time Zone은 UTC를 사용하고 UI에서 사용자 지역으로 변환한다.

### 3.5 JSONB

허용:

- 외부 Provider 원본 Payload
- 버전된 결과 세부 구조
- Event Payload
- 가변 Finding·Metric Map

금지:

- Ownership·상태·금액·핵심 검색 키를 JSONB에만 저장
- JSONB 내부 값만으로 FK를 흉내냄
- Schema Version 없는 장기 보존 Payload

---

## 4. 시간과 Point-in-time

### 4.1 시간 의미

```ts
type TemporalRecord = {
  observedAt: string;  // 현실에서 발생한 시각
  availableAt: string; // 시스템이 사용할 수 있게 된 시각
  asOf: string;        // 평가가 고정한 기준시각
  collectedAt: string; // 수집 완료 시각
  createdAt: string;   // DB 기록 시각
};
```

### 4.2 기본 제약

```text
observedAt <= availableAt <= collectedAt <= createdAt
source asOf <= evaluation asOf <= evaluation createdAt
decisionAt <= outcomeAsOf <= reviewedAt
```

Provider에 따라 `collectedAt`과 `createdAt`은 같을 수 있다. 미래 정정 자료를 과거 Evaluation과 연결하지 않는다.

### 4.3 정정 데이터

정정 공시·Corporate Action·Provider Correction은:

1. 기존 Snapshot을 유지한다.
2. 새 Snapshot ID를 만든다.
3. `supersedes_snapshot_id` 또는 Lineage Edge를 기록한다.
4. 정정 사유·수집시각·Source Hash를 기록한다.
5. 필요한 경우 새 Replay를 실행한다.

### 4.4 Bitemporal 확장

법적·회계상 정정 이력이 중요한 Table은 `valid_from/valid_to`와 `recorded_at`을 분리할 수 있다. MVP는 불변 Revision + `available_at/as_of`로 동일 목적을 달성한다.

---

## 5. 전체 Domain Map

```text
Auth User
  ├─ Portfolio ─ Lot / Cash / Snapshot / Exposure
  ├─ Model Version ─ Evaluation / Plan / Proposal
  ├─ Evidence ─ Snapshot ─ Feature / Claim
  ├─ Decision ─ Risk ─ Execution
  ├─ Review ─ Cohort ─ Lesson ─ Model Change ─ Validation
  ├─ Agent Definition/Prompt ─ Run ─ Output ─ Claim
  └─ Audit / Event Outbox / Report
```

### 5.1 Data Platform

- `data_sources`
- `data_snapshots`
- `evidence_records`
- `industry_profiles`
- Momentum Universe·Regime·Indicator 입력
- Portfolio Market/FX Snapshot

### 5.2 Strategy

- `model_versions`
- `evaluations`
- Long-term Profile/Factor/Gate/Valuation/Thesis Tables
- Momentum Universe/Factor/Gate/Setup/Plan/Scan Tables

### 5.3 Portfolio·Decision

- `portfolios`
- `position_lots`
- Portfolio Snapshot/Position/Cash/Exposure/Open Risk
- Allocation Proposal/Capacity/Capital Decision/Rebalance/Stress
- `risk_decisions`
- `decisions`
- `execution_records`

### 5.4 Learning·Agent

- Learning Manifest/Process/Outcome/Review/Cohort/Lesson
- Model Change/Validation/Shadow/Drift
- Agent Prompt/Definition/Capability/Plan/Manifest/Run/Attempt/Output/Claim/Validation

### 5.5 Operations

- `jobs`
- `domain_events`
- `event_outbox`
- `processed_events`
- `idempotency_requests`
- `audit_logs`
- `reports`

---

## 6. Ownership와 Composite FK

### 6.1 원칙

단순 `child.parent_id → parent.id`는 존재만 보장하고 같은 사용자인지는 보장하지 못한다. 사용자 소유 Entity 사이에는 다음 패턴을 사용한다.

```sql
unique (id, user_id)
foreign key (parent_id, user_id) references parent(id, user_id)
```

### 6.2 Portfolio 경유 Ownership

Lot·Allocation처럼 직접 `user_id`가 없는 Legacy Table은 Portfolio FK를 통해 소유권을 검증한다. 신규 Table은 가능하면 `user_id`를 직접 포함해 Composite FK와 RLS를 단순화한다.

### 6.3 배열 ID

`uuid[]`는 순서 없는 Manifest에만 제한적으로 사용한다.

- 생성 시 중복·빈 배열을 Application에서 검증
- 핵심 참조 무결성이 필요하면 Link Table 사용
- Query·Join 대상이면 Link Table 사용
- 배열 안의 사용자 소유권은 Service 계층에서 일괄 확인

### 6.4 Cross-user 공격

다른 사용자에게 존재하는 UUID를 추측해도:

- Composite FK가 삽입을 차단한다.
- RLS가 조회를 차단한다.
- Service가 요청 Actor와 `user_id`를 비교한다.
- Audit에 Ownership Finding을 기록한다.

---

## 7. RLS와 역할

### 7.1 역할

| 역할 | 권한 |
|---|---|
| Authenticated User | 자신의 읽기·허용된 사용자 입력 |
| API Service | 검증된 Domain 상태 Transaction |
| Worker | Job·Outbox·Provider 결과 처리 |
| Reviewer | 자신의 Tenant 내 승인 대상 조회·승인 API |
| Operator | Migration·Incident·복구, 최소 인원 |

Service Role Key는 Browser·Prompt·일반 Log에 절대 노출하지 않는다.

### 7.2 Policy 패턴

```sql
using (user_id = auth.uid())
with check (user_id = auth.uid())
```

Append-only 결과는 User Select만 허용하고 Write Policy를 만들지 않는다. Service Role이 검증된 서버 API 뒤에서 쓴다.

### 7.3 RLS만 신뢰하지 않는다

- API에서 User/Portfolio Ownership 재검증
- Background Job Payload의 User ID 재검증
- Composite FK 적용
- Service Role 사용 경로 제한
- RLS Regression Test

### 7.4 Raw Agent Output

Raw Provider Output은 일반 사용자 RLS Policy를 두지 않는다. 검증된 Normalized Result만 일반 조회 대상으로 삼고, Raw 접근은 보안·운영 Role과 Retention 정책을 따른다.

---

## 8. 불변성·상태 전이·Trigger

### 8.1 불변 Trigger

완료 결과는 `prevent_immutable_investment_record_update()`를 사용한다. 수정이 필요하면 새 Revision을 INSERT한다.

### 8.2 상태 전이 Trigger

Job·Run·삭제 요청처럼 상태가 진행되는 Table은:

- ID·Ownership·원본 Input Hash 변경 금지
- 허용 전이만 승인
- Terminal 상태 UPDATE 금지
- 완료시각·승인자 조건 강제

### 8.3 Trigger의 한계

Trigger는 Domain 계산을 수행하지 않는다. 다음만 담당한다.

- 무결성
- 상태 전이
- 불변성
- 기본 Audit Metadata

투자 규칙·점수·Risk 계산은 Application Domain 함수가 담당한다.

---

## 9. Transaction 경계

### 9.1 상태 + Audit + Outbox

```text
BEGIN
  INSERT/UPDATE Domain State
  INSERT Audit Log
  INSERT Event Outbox
COMMIT
```

셋 중 하나라도 실패하면 전체를 Rollback한다.

### 9.2 주요 Transaction

- Evaluation + Factor/Gate + Audit + Outbox
- Proposal + Capacity Result + Snapshot Link + Audit + Outbox
- Decision Approval + Revalidation Result + Audit + Outbox
- Execution + Lot Ledger 변화 + Audit + Outbox
- Learning Review + Manifest/Outcome + Audit + Outbox
- Lesson/Model Change Revision + Audit + Outbox
- Agent Run/Validation + Claim + Audit + Outbox

### 9.3 긴 작업

LLM·Provider·Backtest·문서 Parsing을 DB Transaction 안에서 수행하지 않는다.

1. Input Manifest 저장
2. 외부 작업 실행
3. 결과 검증
4. 짧은 완료 Transaction

### 9.4 Isolation

- 기본 Read Committed
- Portfolio Capacity·승인 직전에는 Row Lock 또는 Optimistic Version
- 같은 Portfolio 동시 승인에는 Advisory Lock 또는 명시적 Version 비교
- Serializable은 좁은 핵심 경계에만 검토

---

## 10. Outbox와 멱등성

### 10.1 Outbox

- Domain Event와 동일 ID
- `PENDING/PUBLISHED/FAILED`
- `attempts`, `published_at`, `last_error`
- Pending Partial Index
- 최소 한 번 전달

### 10.2 Consumer

`processed_events(consumer_name, event_id)` PK로 중복 처리를 막는다. Event Handler는 같은 Event를 다시 받아도 결과가 변하지 않아야 한다.

### 10.3 API Idempotency

```text
(user_id, operation, idempotency_key)
request_hash
response_status
response_body
expires_at
```

같은 Key·같은 Hash는 이전 응답을 반환한다. 같은 Key·다른 Hash는 `409`다.

### 10.4 Outbox 정리

Published Row는 보존 정책 이후 Archive할 수 있다. 미발행·실패 Row는 삭제하지 않는다. 실패 원인과 재처리 횟수를 모니터링한다.

---

## 11. Lineage

### 11.1 Lineage Edge

```ts
type DataLineageEdgeV1 = {
  id: string;
  userId: string;
  fromEntityType: string;
  fromEntityId: string;
  toEntityType: string;
  toEntityId: string;
  relation: 'DERIVED_FROM' | 'USED_INPUT' | 'SUPERSEDES' | 'VALIDATES' | 'EXPLAINS';
  asOf: string;
  createdAt: string;
};
```

핵심 FK를 Lineage Edge로 대체하지 않는다. Edge는 배열·외부 문서·다단계 파생 관계 검색을 보완한다.

### 11.2 필수 역추적

```text
Report
  → Decision / Evaluation / Review
  → Model + Policy Version
  → Snapshot + Evidence
  → Source + availableAt
  → Code / Prompt / Provider Version
```

### 11.3 순환

`SUPERSEDES`, `DERIVED_FROM` 관계는 자기 참조와 순환을 금지한다. MVP Application 검증, 운영 단계 Recursive CTE Audit으로 검사한다.

---

## 12. Index 전략

### 12.1 원칙

- 실제 Query Pattern에서 시작한다.
- Equality Column 뒤에 시간 Desc를 둔다.
- Partial Index로 Open/Pending/Active를 좁힌다.
- FK Column에 Index가 필요한지 확인한다.
- JSONB GIN은 검증된 검색 요구에만 추가한다.
- 쓰기 비용과 Vacuum을 고려한다.

### 12.2 핵심 Query

| Query | Index |
|---|---|
| 기업 최신 Evaluation | `(user_id, company_id, evaluated_at desc)` |
| Portfolio Open Lots | `(portfolio_id, status)` Partial |
| Due Review | `(user_id, next_review_at)` Partial |
| Pending Outbox | `(status, created_at)` Partial |
| Entity Audit | `(user_id, entity_id, occurred_at desc)` |
| Model별 Cohort | `(user_id, model_version_id, analyzed_at desc)` |
| Agent Run 상태 | `(user_id, status, created_at desc)` |

### 12.3 Pagination

대량 이력은 Offset 대신 `(time, id)` Keyset Pagination을 사용한다. 정렬 동률을 위해 ID를 두 번째 Key로 둔다.

---

## 13. Partition·Archive·Retention

### 13.1 Partition 후보

- Market Bar·Tick
- 대량 Snapshot
- Domain Event·Audit
- Agent Raw Output
- 장기 Validation Metric

MVP 데이터량에서는 단일 Table로 시작하고, 실제 Size/Query Plan을 근거로 월 단위 Partition을 도입한다.

### 13.2 Retention 등급

| 등급 | 예 | 정책 |
|---|---|---|
| Legal/Audit | 승인·실행·감사 | 장기 보존, 법적 정책 우선 |
| Reproducibility | Snapshot·Evaluation·Model | Model 사용 기간 + 검증 기간 |
| Operational | Job·Outbox | 완료 후 제한 보존 |
| Sensitive Raw | Agent Raw Output·심리 입력 | 최소 기간·암호화 |
| Cache | Render·Provider Cache | 짧은 TTL, 재생성 가능 |

### 13.3 Archive

Archive는 삭제가 아니다. Read-only Storage로 이동해 Hash와 Lookup Metadata를 유지한다. 원본이 없으면 재현할 수 없는 Record를 무분별하게 Archive하지 않는다.

---

## 14. 삭제·정정 Workflow

### 14.1 삭제 요청

```text
REQUESTED → VERIFIED → PLANNED → EXECUTING → COMPLETED
                   └→ REJECTED / BLOCKED
```

### 14.2 삭제 전 분류

- 법적 보존 대상
- 사용자 개인정보
- 금융 의사결정·거래 기록
- 공유되지 않은 파생 Cache
- 다른 기록의 재현성에 필요한 Snapshot

### 14.3 실행

- 일반 API Hard Delete 금지
- 대상 Entity·Table·Row Count 계획 저장
- 법적 Hold 확인
- 백업·Archive 영향 기록
- 완료 후 Tombstone/Audit
- 파생 데이터·검색 Index·Cache 함께 처리

### 14.4 정정

잘못된 Fact는 원본 삭제보다 `CORRECTS/SUPERSEDES` Revision을 우선한다. UI는 최신값과 정정 이력을 함께 제공한다.

---

## 15. Migration 정책

### 15.1 규칙

- 적용된 Migration 수정 금지
- 새 번호·명확한 이름
- 하나의 Transaction이 가능한 변경은 `begin/commit`
- Lock이 긴 DDL은 별도 운영 절차
- 대량 Backfill은 Batch Job
- Default→Backfill→Not Null 순서
- 파괴적 변경은 Expand/Migrate/Contract

### 15.2 Expand/Migrate/Contract

```text
1. 새 Column/Table 추가
2. 구·신 Schema 동시 읽기/쓰기
3. Backfill + 검증
4. Read 전환
5. 이전 Column 사용 중단 확인
6. 후속 Migration에서 제거
```

### 15.3 Migration 검증

- 빈 DB에 `001`부터 전체 적용
- 운영 Schema Snapshot과 Diff
- FK·Check·Unique·RLS·Trigger 목록 검증
- 대표 Query `EXPLAIN`
- RLS Cross-user Test
- Downstream API Typecheck/Test

### 15.4 Rollback

운영 Rollback은 자동 Down Migration을 기본으로 하지 않는다. 데이터 손실 없는 Forward Fix를 우선한다. 배포 전 Snapshot·PITR 시점을 확인한다.

---

## 16. Backup·PITR·복구

### 16.1 목표

- RPO: 운영 등급에 따라 명시
- RTO: 사용자 조회·승인·Worker별 명시
- PITR 활성 상태 확인
- Backup 암호화·지역·Retention 확인

### 16.2 Restore Drill

분기 또는 중요한 Migration 전후에:

1. 격리 환경 복구
2. Row Count·FK·Hash 검증
3. 대표 사용자 계보 Query
4. 최신 Outbox 처리 여부 확인
5. API Smoke Test
6. 실제 RTO 기록

### 16.3 복구 후 Event

복구 지점 이후 외부로 발행됐던 Event와 DB 상태가 어긋날 수 있다. Processed Event·외부 Side Effect를 대조하고 무조건 재발행하지 않는다.

---

## 17. 성능·Connection·Lock

### 17.1 Connection

- API/Worker Pool 분리
- Transaction Pooling 호환 Query
- Idle Transaction 금지
- Statement/Lock Timeout 설정
- 대량 Batch 동시성 제한

### 17.2 Lock

- 긴 `ALTER TABLE` 사전 검토
- Index는 가능한 운영 친화 방식 사용
- Portfolio 승인 Lock 범위를 좁게 유지
- Deadlock Retry는 멱등 작업만

### 17.3 Query Budget

- API Query Timeout
- Report/Analytics는 Read Replica 또는 비동기 Materialization 고려
- N+1 Query 탐지
- Full Table Scan Alert
- Slow Query Sampling 시 PII 제거

---

## 18. 데이터 품질과 Reconciliation

### 18.1 품질 Incident

```ts
type DataQualityIncidentV1 = {
  id: string;
  userId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: 'MISSING' | 'STALE' | 'CONFLICT' | 'OUTLIER' | 'SCHEMA' | 'LINEAGE' | 'RECONCILIATION';
  entityType: string;
  entityId: string;
  detectedAt: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
};
```

### 18.2 Reconciliation

- Portfolio Position + Cash - Liability = NAV
- Gross P&L - Fees - Taxes = Net P&L
- Bucket 합계 + 공통 Reserve = 100%
- Filled Quantity <= Requested Quantity
- Active Model 전략별 최대 1개
- Event Outbox Published와 Domain Event 일치
- Agent Accepted Claim은 Validation 결과에 존재

### 18.3 Fail-closed

Critical Lineage·Ownership·Reconciliation 오류가 있으면 신규 위험 확대 API를 차단한다. 읽기 화면은 마지막 정상 Snapshot과 Incident를 표시할 수 있다.

---

## 19. 보안

### 19.1 Encryption

- 전송 TLS
- 저장 암호화
- Agent Raw Output·민감 심리 기록 추가 암호화 검토
- Key Rotation과 접근 감사

### 19.2 Secret

Secret은 DB Domain Table, JSONB Payload, Audit, Prompt에 저장하지 않는다. Secret Manager Reference만 저장할 수 있다.

### 19.3 SQL Injection

- Parameterized Query
- 동적 Identifier Allowlist
- Client 제공 Filter를 SQL Fragment로 연결 금지
- Service 함수와 RPC 입력 Schema 검증

### 19.4 Audit 접근

Audit은 Owner 읽기 또는 운영 Role로 제한한다. `before_data/after_data`에 Secret·전체 Raw 문서를 넣지 않는다.

---

## 20. API와 운영 조회

```text
POST /api/v1/database/lineage/validate
POST /api/v1/database/reconciliations/validate
GET  /api/v1/database/reconciliations/:id
POST /api/v1/database/retention/policies/validate
POST /api/v1/database/deletion-requests
GET  /api/v1/database/deletion-requests/:id
POST /api/v1/database/deletion-requests/:id/transitions
GET  /api/v1/database/health
GET  /api/v1/database/migrations
```

MVP 코드는 Lineage·Retention·Deletion State·Reconciliation 계약과 In-memory/API 검증을 제공한다. Reconciliation 불일치와 Legal Hold는 요청 오류로 손실시키지 않고 `201` 결과의 `FAILED`/`BLOCKED`로 저장한다. 실제 Backup/PITR·Migration 적용·Connection Metric은 배포 환경에서 검증한다.

### 20.1 오류

| HTTP | Code | 의미 |
|---:|---|---|
| 400 | `INVALID_DATABASE_CONTRACT` | Schema·시간·상태·Hash 오류 |
| 403 | `DATABASE_OWNERSHIP_MISMATCH` | Cross-user 참조 |
| 409 | `DATABASE_LINEAGE_CONFLICT` | 계보·Revision 충돌 |
| 409 | `DATABASE_RECORD_IMMUTABLE` | Terminal 수정 |
| 404 | `DATABASE_RESOURCE_NOT_FOUND` | 요청·정책 없음 |

---

## 21. `009_database_hardening_v1.sql`

새 Migration은 기존 001~008을 다시 정의하지 않고 운영 공통 계약을 보강한다.

```text
data_lineage_edges
data_retention_policies
data_deletion_requests
data_deletion_request_items
data_quality_incidents
database_reconciliation_runs
database_reconciliation_findings
migration_verification_runs
```

추가 보강:

- `audit_logs`, `domain_events` 불변 Trigger
- 불변 공통 Table의 UPDATE·DELETE 차단과 삭제 Revision 분기 금지
- 사용자 소유 핵심 Table의 Composite Unique/FK 누락 보강
- 상태·시간·Hash Check
- 사용자별 RLS와 서버 전용 쓰기
- Open Incident·Deletion·Reconciliation Index

---

## 22. 관측성

### 22.1 Metric

- Connection 사용률·대기
- Transaction/Query Latency
- Lock Wait·Deadlock
- Cache Hit·Index Hit
- Table/Index Size·Bloat
- WAL·Replication Lag
- Outbox Pending/Failed Age
- RLS Denial·Ownership Error
- Reconciliation Failure
- Backup Age·Restore Drill RTO
- Migration Duration·Lock Time

### 22.2 Alert

- Connection Pool 포화
- Replication Lag
- Pending Outbox 임계 초과
- Critical Reconciliation/Lineage Incident
- Cross-user FK/RLS Test 실패
- Backup/PITR 비정상
- Disk/Storage 급증
- Slow Query 증가
- Migration Verification 실패

---

## 23. 테스트 전략

### 23.1 Schema

- `001`~최신 빈 DB 적용
- Constraint·Index·RLS·Trigger Snapshot
- Migration 순서·중복 이름
- 금지 타입(Float 금액) 탐지

### 23.2 RLS

- User A가 User B Row 읽기/쓰기 실패
- Portfolio 경유 Lot/Proposal/Execution 격리
- Service Role만 Outbox·Raw Agent Output 접근
- Reviewer 권한 범위

### 23.3 Constraint

- Cross-user Composite FK 실패
- Terminal Update 실패
- Decimal·Currency·시간 Check
- Strategy/Lot/Exit Policy Check
- Active Model Unique
- Duplicate Idempotency Key

### 23.4 Transaction

- Domain 성공 + Outbox 실패 → 전체 Rollback
- 동일 Event 중복 Consumer → Side Effect 1회
- 동시 Portfolio 승인 → Capacity 초과 0건
- Retry 후 Audit/Event 중복 없음

### 23.5 Recovery

- Backup Restore
- Migration 중단 후 Forward Fix
- Outbox Reconciliation
- Hash·Row Count·대표 계보 Query

---

## 24. 구현 계획

### Phase 0 — Contract

- Lineage Edge
- Retention Policy
- Deletion Request State
- Reconciliation Finding

### Phase 1 — Hardening Migration

- `009_database_hardening_v1.sql`
- Audit/Event 불변성
- Composite FK·RLS·Index
- 운영 공통 Table

### Phase 2 — API/Repository

- Lineage·Retention·Reconciliation 검증
- Deletion Request 불변 Workflow
- Audit·Outbox·Idempotency

### Phase 3 — Verification

- Unit/Invariant/API Integration
- 전체 Typecheck/Test/Build
- Migration 정적 검토

### Phase 4 — 운영 연결

- Supabase Migration 실제 적용
- Auth/RLS E2E
- PITR·Restore Drill
- Query Plan·Load Test
- Retention/Deletion Operator Runbook

---

## 25. Definition of Done

### 계약

- [x] Ownership·Composite FK Schema
- [x] 불변 Revision·상태 전이·분기 차단
- [x] Point-in-time·Lineage·순환 차단
- [x] Decimal·시간·Enum Check
- [x] Outbox·Idempotency
- [x] Retention·삭제 Workflow
- [x] Reconciliation

### 보안

- [x] Composite FK·RLS로 Cross-user 참조 차단 계약
- [x] Service Role Client 미사용 구조
- [x] Database v1 허용 필드 경계로 임의 Secret 저장 차단
- [x] Raw Agent Output Owner Select·Service Write RLS 계약
- [ ] 실제 Supabase Auth/RLS 교차 사용자 E2E

### API/DB

- [x] `009_database_hardening_v1.sql`
- [x] Lineage/Retention/Deletion/Reconciliation API
- [x] RLS/Trigger/Index
- [x] Audit/Outbox/Idempotency

### 검증

- [x] Unit/Invariant/API Integration
- [x] Migration 정적 검토
- [x] `pnpm typecheck`, `pnpm test`, `pnpm build`
- [ ] Supabase Migration 실제 적용·Restore·Load Test

운영 완료에는 Supabase 실제 적용, RLS E2E, PITR/Restore Drill, Load/Query Plan 검증이 추가로 필요하다.

---

## 26. 결정 기록

| ID | 결정 | 이유 |
|---|---|---|
| ADR-DB-001 | PostgreSQL/Supabase를 운영 Source of Truth로 사용 | Transaction·RLS·Constraint |
| ADR-DB-002 | 사용자 소유 FK는 Composite FK를 우선 | Cross-user 참조 차단 |
| ADR-DB-003 | 완료 기록은 UPDATE 대신 Revision | 재현성·감사 |
| ADR-DB-004 | 금액은 numeric/API Decimal String | 부동소수점 오류 방지 |
| ADR-DB-005 | JSONB와 핵심 Column을 분리 | 유연성·무결성 균형 |
| ADR-DB-006 | Domain State+Audit+Outbox를 원자 저장 | 상태/Event 불일치 방지 |
| ADR-DB-007 | 적용된 Migration을 수정하지 않음 | 환경 간 재현성 |
| ADR-DB-008 | 삭제는 검증된 Workflow | 법적 보존·계보 보호 |
| ADR-DB-009 | Backup보다 Restore Drill을 완료 기준으로 사용 | 실제 복구 가능성 |
| ADR-DB-010 | 핵심 FK와 Lineage Edge를 병행 | 무결성과 다단계 탐색 |
