# 11. UI / UX

- 문서 버전: v1.0.0
- 작성일: 2026-07-22
- 최종 검토일: 2026-07-23
- 명세 상태: SPECIFICATION BASELINE
- 구현 준비도: R1 FOUNDATION / REVIEW MVP IMPLEMENTED / R2+ OPEN
- 기준 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1, `03_LongTerm_Engine.md`~`10_Report_System.md`
- 후속 문서: `12_Roadmap.md`, `13_Codex_Implementation.md`

---

## 1. 목적

Investment OS UI는 투자 결정을 대신하는 화면이 아니라, 각 Engine이 만든 사실·판단·제약·계보를 사용자가 빠르게 이해하고 안전하게 승인 또는 거부하도록 돕는 검토 인터페이스다.

핵심 목표는 다음과 같다.

1. Long-term과 Momentum을 목적·평가·Lot·Exit 관점에서 분리한다.
2. 평단과 수익률보다 Thesis, Setup, Risk, Break/Stop을 먼저 보여준다.
3. Score와 Confidence, 상태와 데이터 품질을 서로 대체하지 않고 병렬 표시한다.
4. 결론, 변화, 근거, 반대 근거, 위험, 행동, 다음 검토 조건 순서를 보존한다.
5. Portfolio·Risk가 허용한 범위 안에서만 명시적 사용자 승인을 제공한다.
6. Stale·Blocked·Expired·Partial 상태를 정상값이나 실패 없는 상태로 오해시키지 않는다.
7. 모든 중요한 수치와 행동을 원본 Snapshot·Evidence·Model·Policy·Report로 추적 가능하게 한다.
8. 모바일과 데스크톱, 키보드와 보조기술에서 동일한 의미를 제공한다.

---

## 2. 비목표

- UI에서 Score, Allocation, Risk, 손익을 재계산하지 않는다.
- Long-term과 Momentum 점수를 하나의 종합 점수로 합치지 않는다.
- `BLOCKED`, `UNAVAILABLE`, N/A를 0으로 표시하지 않는다.
- Risk `DENY` 또는 Hard Safety를 해제하는 Control을 제공하지 않는다.
- 기존 Proposal의 금액·Stop·전략을 직접 수정해 승인하지 않는다.
- 사용자 동의 없이 주문을 Broker에 전송하지 않는다.
- 색상만으로 상태를 전달하지 않는다.
- Agent 자유 문장을 검증된 Fact처럼 표시하지 않는다.
- 최신 데이터를 과거 Report나 Decision 화면에 조용히 혼합하지 않는다.
- 수익률을 과정 품질의 대리 지표로 사용하지 않는다.

---

## 3. 선행 문서 충돌 검토

### 3.1 결론

01~10과 기획 충돌은 없다. 11번은 기존 도메인 계약의 Presentation·Interaction 계층이다. 다음 충돌 가능성을 UI 불변조건으로 해소한다.

| 선행 계약 | UI 적용 | 금지 |
|---|---|---|
| 장기·모멘텀 독립 | 별도 탭·Badge·Score Card | 합산 종합점수 |
| Portfolio에서만 통합 | Portfolio 화면의 Look-through 노출 | 기업 화면에서 배분 재계산 |
| Risk `DENY` 비가역 | 비활성 Button과 이유·해소 불가 표기 | Override Button |
| 수정 승인은 새 Proposal | 수정 요청 Flow와 재계산 안내 | 기존 승인 Modal 내 직접 수정 |
| Point-in-time | 모든 화면에 `dataAsOf` | 최신 Quote로 과거 판단 덮어쓰기 |
| Score 상태 분리 | 숫자 대신 `산출 불가/차단` | 0점 표시 |
| Canonical Report | Canonical JSON Component | Markdown Parsing으로 판단 생성 |
| Agent Output 비신뢰 | Citation·검증 상태 Badge | 미검증 문장 행동 근거 사용 |
| Learning 과정/결과 분리 | 2축 Review Matrix | 수익이면 좋은 결정으로 표시 |

### 3.2 화면 권위 순서

```text
Hard Safety / Risk
  > Approved Domain Result
  > Canonical Report
  > UI View Model
  > Visual Decoration
```

화면 표시와 도메인 응답이 다르면 도메인 응답이 우선하며 행동 Control을 차단한다.

---

## 4. 사용자와 핵심 작업

### 4.1 사용자 역할

| 역할 | 주요 작업 | 제한 |
|---|---|---|
| USER | Portfolio·Report 확인, Proposal 승인/거부, Journal·Review | Risk 완화 불가 |
| APPROVER | 고위험 제안·Model/Template 변경 검토 | Hard Safety 변경 불가 |
| REVIEWER | Lesson·Model Change·Template 승인 | 투자 승인 대행 불가 |
| OPERATOR | Job·Data·Delivery 상태 확인 | 사용자 투자 판단 변경 불가 |

### 4.2 핵심 사용자 작업

- 오늘 확인할 위험과 Review 찾기
- 장기 Thesis 또는 Momentum Setup의 변화 이해하기
- 같은 종목의 전략별 Lot과 총노출 확인하기
- 신규 자금 배분안과 현금 유지 이유 검토하기
- Proposal의 만료·가격·Policy·Risk 상태 확인 후 승인/거부하기
- Trade 종료 후 과정과 결과를 분리해 Review하기
- Model 변경 근거와 검증 단계를 검토하기
- 과거 Report·Decision을 해당 시점 데이터로 재현하기

---

## 5. 정보 구조

```text
Investment OS
├── Home
│   ├── Attention Queue
│   ├── Portfolio Snapshot
│   ├── Strategy Summary
│   └── Latest Report
├── Long-term
│   ├── Core
│   ├── Future Core
│   └── Company Detail
├── Momentum
│   ├── Daily Brief
│   ├── Setups
│   └── Trade Plan Detail
├── Portfolio
│   ├── Allocation
│   ├── Exposure
│   ├── Open Risk
│   └── Stress
├── Decisions
│   ├── Pending Approval
│   ├── Manual Review
│   └── History
├── Reports
│   ├── Weekly
│   ├── Monthly
│   ├── Quarterly
│   └── Review / Model
├── Learning
│   ├── Reviews
│   ├── Lessons
│   └── Model Changes
└── Operations
    ├── Data Quality
    ├── Jobs / Agents
    └── Audit / Lineage
```

모바일 하단 Navigation은 `Home`, `Strategies`, `Portfolio`, `Decisions`, `Reports` 다섯 개로 제한한다. 나머지는 More Drawer에서 접근한다.

---

## 6. 전역 Shell

### 6.1 Header

- 현재 Portfolio
- 기준 통화
- 사용자 시간대
- 전체 데이터 기준시각
- Data Health 상태
- Pending Approval 수
- 사용자 Menu

### 6.2 Side Navigation

- 현재 위치를 Text와 `aria-current`로 표시
- Badge는 숫자만 두지 않고 Label 제공
- 전략 Navigation은 Long-term과 Momentum을 분리
- 접힌 상태에서도 Tooltip과 Screen Reader Label 제공

### 6.3 Global Status Bar

우선순위:

```text
CRITICAL_BLOCKER > STALE_DATA > PARTIAL_SERVICE > REVIEW_DUE > HEALTHY
```

상태 Bar는 원인, 영향, 기준시각, 가능한 행동을 제공한다. 닫아도 해당 상태가 해소된 것으로 처리하지 않는다.

---

## 7. 시각 언어와 Design Token

### 7.1 의미 색상

| Token | 의미 | 예시 |
|---|---|---|
| `surface` | 기본 배경 | Page, Card |
| `text-primary` | 핵심 정보 | 결론, 제목 |
| `text-muted` | 보조 정보 | 기준시각, ID |
| `positive` | 검증된 유리 상태 | 한도 내, 강화 |
| `caution` | 검토 필요 | Stale, Manual Review |
| `critical` | 행동 차단 | DENY, Hard Limit |
| `info` | 중립 정보 | Snapshot, Version |
| `strategy-long-term` | 장기 전략 식별 | Core/Future Core |
| `strategy-momentum` | 모멘텀 전략 식별 | Setup/Plan |

상승=초록, 하락=빨강을 투자 가치 판단과 혼용하지 않는다. 모든 상태는 Icon+Text+Color로 표현한다.

### 7.2 Typography

- 숫자는 Tabular Number 사용
- 금액·가격·수량은 서버 Decimal 문자열 유지
- 제목보다 결론과 차단 상태의 시각 우선순위가 높음
- 본문 최소 16px, 보조 Text 최소 13px
- 긴 Evidence 제목은 두 줄 후 전체 보기 제공

### 7.3 Spacing과 Density

- 기본 4px Grid
- 투자 승인 화면은 Comfortable Density 고정
- Table은 Compact 선택 가능하나 위험·상태 열 숨김 불가
- Touch Target 최소 44×44px

---

## 8. 공통 View Model

UI는 API DTO를 그대로 계산하지 않고, 의미 손실 없는 View Model로 투영한다.

```ts
type UiStatus = "READY" | "REVIEW" | "BLOCKED" | "STALE" | "EXPIRED" | "UNAVAILABLE";

interface DataLineageViewModel {
  dataAsOf: string;
  generatedAt?: string;
  snapshotIds: string[];
  evidenceIds: string[];
  modelVersionIds: string[];
  policyVersionIds: string[];
  resultHash?: string;
}

interface ScoreViewModel {
  status: "SCORED" | "BLOCKED" | "UNAVAILABLE";
  point?: number;
  low?: number;
  high?: number;
  confidence?: number;
  confidenceGrade?: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  blockerCodes: string[];
  warningCodes: string[];
}
```

`point`가 없을 때 0이나 `-` 하나로 대체하지 않는다. 상태 Label과 이유를 함께 표시한다.

---

## 9. 핵심 Component

### 9.1 Status Badge

- Text Label 필수
- Tooltip에 정의와 다음 행동
- 상태별 Icon
- `aria-label`에 상태와 영향

### 9.2 Score + Confidence

```text
Score 82 [76–87]
Confidence 71 · MEDIUM
Data as of 2026-07-22 18:00 KST
```

- Score Range가 있으면 Point만 크게 표시하지 않음
- Confidence를 Score 옆에 같은 Hierarchy로 표시
- Blocked면 숫자 영역 대신 차단 이유
- 변화는 Score Change Explanation이 있을 때만 표시

### 9.3 Evidence Drawer

- Statement에서 바로 열림
- Fact/Estimate/Interpretation 구분
- Source Tier·발행일·availableAt·인용 위치
- Counter Evidence 별도 Group
- 원문은 안전한 외부 Link로 열기
- 미검증 Agent Claim은 행동 근거에서 제외 표시

### 9.4 Lineage Panel

- Snapshot, Model, Policy, Template, Renderer Version
- `dataAsOf`, 생성시각, Result Hash
- Copy ID Button
- Replay 상태와 Hash 일치 여부

### 9.5 State Notice

```ts
interface StateNoticeProps {
  severity: "INFO" | "CAUTION" | "CRITICAL";
  title: string;
  description: string;
  reasonCodes: string[];
  dataAsOf?: string;
  nextAction?: { label: string; href: string };
}
```

### 9.6 Empty State

`데이터 없음`, `조건에 맞는 후보 없음`, `권한 없음`, `서비스 오류`를 서로 다른 문구와 행동으로 표시한다. `현금 유지`, `신규 거래 없음`은 정상 결론이다.

---

## 10. Home Dashboard

### 10.1 정보 우선순위

1. Critical Blocker와 승인 대기
2. 오늘/이번 주 Review Due
3. 최신 Portfolio Snapshot
4. 전략별 변화
5. 최신 Canonical Report
6. 운영 상태

### 10.2 Attention Queue

정렬:

```text
Hard Risk / Expiring Proposal
  > Thesis Break / Stop / Exit
  > Manual Review
  > Review Due
  > Stale Data
  > Informational Change
```

각 항목은 한 가지 주요 행동만 가진다.

### 10.3 Portfolio Summary

- Investable NAV와 Cash
- Long-term / Momentum 실제 비중과 정책 범위
- Core / Future Core 하위 비중
- 상위 Company·Theme·Currency 노출
- Momentum Open Risk
- Snapshot 기준시각

차트 아래에 동일 데이터 Table을 제공한다.

---

## 11. Long-term 화면

### 11.1 목록

Core와 Future Core는 탭 또는 별도 Route다. 같은 Row에 두 점수를 넣어 직접 순위를 유도하지 않는다.

열:

- Company
- Stage
- Eligibility/Score Status
- Score Range
- Confidence
- Thesis Status
- Valuation Range 대비 Price
- Next Review
- Data Quality

### 11.2 상세

순서:

1. Thesis와 Break Condition
2. Hard Risk·Gate
3. Core 또는 Future Core Score/Confidence
4. Bear/Base/Bull Valuation
5. Evidence와 Counter Evidence
6. 현재 전략별 Position Lot·총노출
7. Stage History
8. Review Schedule·Lineage

현재 가격과 평단은 Thesis·Risk 다음에 배치한다.

---

## 12. Momentum 화면

### 12.1 Daily Brief

- Market Regime과 Permission
- ENTER/WAIT/AVOID/EXIT 수
- 만료 임박 Plan
- Stop/Gap/Event Risk
- Data Session과 완료 Bar 기준

### 12.2 Setup 목록

- Setup Type
- Score Range/Confidence
- Entry Zone·현재 위치
- Chase Limit
- Stop·Target·Reward/Risk
- Expires At
- Action과 Blocker

만료 또는 Chase Limit 초과 Row는 승인 행동을 제공하지 않는다.

### 12.3 Trade Plan 상세

Plan Revision을 Timeline으로 표시한다. Stop 확대는 새 Revision과 승인 이유가 없으면 UI에서도 불가능하다.

---

## 13. Portfolio 화면

### 13.1 Allocation

- Target / Soft / Hard 범위
- 실제 비중
- 신규 자금 배분 결과
- Cash Retained와 이유
- 후보별 요청·허용·축소 금액

### 13.2 Exposure

- Company, Sector, Industry, Theme, Currency Look-through
- 동일 종목 Long-term/Momentum Lot을 분리하면서 총노출도 표시
- Soft 접근과 Hard 초과를 분리

### 13.3 Open Risk

- Momentum Total/Sector/Theme Open Risk
- Stop·Gap 기준 손실
- 한도 대비 잔여 Capacity

### 13.4 Stress

- Scenario 정의와 Version
- Bucket별 손실
- 상위 기여 종목
- Stress는 예측이 아니라 정책 검토 입력임을 명시

---

## 14. Decision과 승인 Flow

### 14.1 승인 전 화면

필수 표시:

- Action·전략·종목
- 요청/Portfolio 허용/Risk 허용 금액
- 수량·가격 범위·기준 통화
- Proposal·Risk·Portfolio 상태
- 만료시각과 남은 시간
- Thesis/Setup 요약
- Counter Evidence와 핵심 Risk
- Snapshot·Model·Policy Version
- 수정 시 새 Proposal이 필요하다는 안내

### 14.2 승인 상태

| 상태 | Primary Control |
|---|---|
| `PENDING_APPROVAL` + 유효 | 승인, 거부 |
| `REQUIRE_MANUAL_REVIEW` | 추가 근거 검토 |
| `DENY/BLOCKED` | 없음, 이유 보기 |
| `EXPIRED` | 새 Proposal 요청 |
| `APPROVED/REJECTED` | 기록 보기 |

### 14.3 승인 절차

```text
Open Decision
  -> Read Required Sections
  -> Confirm latest server status
  -> Explicit confirm checkbox
  -> Approve or Reject
  -> Server revalidation
  -> Success / Changed / Expired result
```

승인 Button은 위험한 행동이므로 Modal에서 다음을 다시 보여준다.

- 대상, 전략, 금액, 수량
- 가격 허용 범위
- 만료시각
- Risk 상태
- 자동 주문이 아니라 승인 기록이라는 범위

### 14.4 동시성과 재검증

- Button 클릭 시 중복 제출 차단
- `Idempotency-Key` 생성
- 409/410/422/423을 각기 다른 복구 흐름으로 표시
- 서버가 변경된 Proposal을 반환하지 않으면 기존 화면을 성공으로 바꾸지 않음
- 승인 후 Audit/Decision ID 제공

### 14.5 수정 요청

금액·Stop·전략 수정은 승인 Modal에 Input으로 넣지 않는다. `수정 요청`은 원본을 참조한 새 Proposal 생성 Flow로 이동한다.

---

## 15. Report 화면

Canonical Report Section을 다음 순서로 렌더링한다.

1. Priority Recommendation
2. Conclusion
3. Changes
4. Facts
5. Estimates
6. Interpretations
7. Counter Evidence
8. Risks
9. Actions
10. Next Review
11. Sources

- `BLOCKED` Report는 상단에 차단 이유와 필요한 Source 표시
- Artifact 실패는 Format별로 표시
- 과거 Revision은 Read-only
- 정정 Revision 간 Diff 제공
- Replay Hash 불일치는 Critical 표시
- 승인 Button은 Report 자체가 아니라 연결된 Proposal ID에서만 활성화

---

## 16. Learning 화면

### 16.1 Review Matrix

```text
                 Outcome Good   Outcome Bad
Process Good     Preserve       Variance / Assumption
Process Bad      Lucky          Corrective Action
```

과정과 결과를 두 개의 Badge와 독립 설명으로 표시한다.

### 16.2 Lesson

- Cohort 표본과 성숙도
- Supporting/Contradicting Review
- Alternative Explanation
- No-change Option
- Reviewer와 승인시각

### 16.3 Model Change

- Champion/Challenger
- Replay→Walk-forward→Shadow 단계
- Guardrail 결과
- Drift와 Tail Risk
- Human Approval 상태

검증을 통과하지 않은 모델에는 Activate Control이 없다.

---

## 17. Data Quality와 오류 상태

### 17.1 Data Quality 표시

- Freshness
- Completeness
- Conflict
- Source Tier
- Coverage
- Last Successful Snapshot

### 17.2 상태별 UX

| 상태 | 표현 | 행동 |
|---|---|---|
| Loading | Skeleton + `aria-busy` | 없음 |
| Empty | 원인별 Empty State | 조건 변경/데이터 추가 |
| Stale | 기준시각과 영향 | 새로고침/대기 |
| Partial | 성공·실패 Component 분리 | 실패 부분 재시도 |
| Blocked | 이유·해소 조건 | Source/Review 이동 |
| Forbidden | 존재 여부 비공개 | 이전 화면 |
| Not Found | 일반화된 메시지 | 목록 이동 |
| Network | 마지막 검증 상태와 Offline 표시 | 재시도 |

낙관적 UI는 Bookmark 같은 비중요 행동에만 사용한다. 승인·정책·Model 상태는 서버 성공 전 변경하지 않는다.

---

## 18. 반응형 설계

### Desktop ≥ 1200px

- Side Navigation + Main + Context Panel
- Table와 Detail Split View 가능
- 승인 Panel은 고정 폭, Source Drawer 별도

### Tablet 768~1199px

- 접히는 Navigation
- Table 핵심 열 유지, 나머지 Row Detail
- Context Panel은 Drawer

### Mobile < 768px

- Bottom Navigation
- Card 기반 목록
- 핵심 상태·결론·Risk 우선
- 표는 가로 Scroll보다 Card 변환 우선
- 승인 Summary를 한 화면에서 검토 후 Confirm 단계 분리

---

## 19. 접근성

WCAG 2.2 AA를 목표로 한다.

- 모든 기능 키보드 접근
- Focus Visible과 논리적 Focus 순서
- Skip Link
- Landmark와 Heading 계층
- Form Label·Error Description 연결
- Status 변화 `aria-live` 사용
- Chart의 Table 대안
- 색상 외 Icon/Text 상태 표현
- 200% 확대에서 내용·행동 손실 없음
- 모션 감소 설정 존중
- Modal Focus Trap과 닫기 후 Focus 복귀
- 날짜·금액을 Screen Reader가 이해 가능한 Label로 제공

승인·거부 Button은 위치·색상만으로 구분하지 않고 동사와 대상까지 Label에 포함한다.

---

## 20. 국제화와 숫자

- 서버 시각은 UTC, UI는 사용자 Timezone
- 원본 `dataAsOf`를 변환해도 UTC 값은 Tooltip에 제공
- Decimal 문자열은 Number로 변환하지 않고 Locale Formatter가 문자열 정밀도 유지
- Currency Code를 Symbol과 함께 제공
- Percent의 분모와 기준을 Label로 명시
- 번역 Text를 Hash·도메인 Code와 혼합하지 않음
- 영어 Error Code와 사용자 언어 설명을 분리

---

## 21. Frontend Architecture

```text
apps/web
├── app
│   ├── page.tsx
│   ├── long-term
│   ├── momentum
│   ├── portfolio
│   ├── decisions
│   ├── reports
│   ├── learning
│   └── operations
├── components
│   ├── shell
│   ├── status
│   ├── score
│   ├── lineage
│   ├── report
│   └── decision
├── lib
│   ├── api-client.ts
│   ├── view-model.ts
│   ├── decimal-format.ts
│   └── error-map.ts
└── styles
```

### 21.1 Data 원칙

- Server Component에서 초기 Read
- 승인 등 Mutation은 Client Boundary
- Domain API가 계산한 결과만 표시
- Query Key에 user/portfolio/asOf/version 포함
- Mutation 성공 후 관련 Query를 서버 결과로 갱신
- 오래된 Cache를 행동 가능한 상태로 사용하지 않음

### 21.2 API Client

```ts
interface ApiResult<T> {
  data?: T;
  requestId: string;
  correlationId: string;
  error?: { code: string; message: string; retryable: boolean };
}
```

- Runtime Schema 검증
- Abort Signal
- Read Timeout
- 쓰기 `Idempotency-Key`
- 401/403 구분하되 Resource 존재 노출 금지
- Error Code를 일관된 UX 상태로 변환

### 21.3 View Model 경계

View Model 함수는 순수하고 테스트 가능해야 한다. 도메인 필드 누락을 기본값 0으로 채우지 않고 `BLOCKED/UNAVAILABLE`로 승격한다.

---

## 22. 보안과 개인정보

- HttpOnly Secure Session
- CSP와 Trusted Types 검토
- 사용자/Agent/외부 문자열 Escape
- 외부 Link Scheme Allowlist
- 민감 금액은 권한 없는 Audience에서 Redaction
- URL·Analytics·Client Log에 Portfolio 금액/Token 금지
- 승인 화면에서 Clickjacking 방지
- CSRF 보호와 SameSite Cookie
- Client에 Service Role Key 금지
- 권한 실패 시 Resource 존재 여부 비공개
- Clipboard 복사는 명시적 사용자 행동

---

## 23. 성능과 복원력

- 첫 화면 Critical CSS와 Shell 우선
- 큰 Table Virtualization
- Chart 지연 로드
- Evidence Drawer 요청 분리
- Skeleton은 실제 Layout과 유사
- 독립 Widget Error Boundary
- Report JSON이 있으면 PDF 실패와 무관하게 표시
- Offline/Network 재연결 후 승인 상태 반드시 재조회

목표:

| 항목 | 목표 |
|---|---:|
| LCP p75 | ≤ 2.5s |
| INP p75 | ≤ 200ms |
| CLS p75 | ≤ 0.1 |
| 승인 Double Submit | 0 |
| Critical 상태 접근성 누락 | 0 |

---

## 24. 분석 Event

수집 가능한 Event:

- `attention_item_opened`
- `evidence_drawer_opened`
- `lineage_opened`
- `decision_approval_started`
- `decision_approved`
- `decision_rejected`
- `decision_changed_on_revalidation`
- `report_section_viewed`
- `blocked_reason_opened`

수집 금지:

- Evidence 원문
- Portfolio 절대 금액
- 종목별 개인 보유 수량
- Thesis 자유 문장
- 인증·Provider Secret

Analytics 실패는 제품 행동에 영향을 주지 않는다.

---

## 25. 테스트 전략

### Unit

- Score 상태 View Model
- Decimal 문자열 Format
- 시간대 변환
- Error Code→State Notice
- Report Section 안정 정렬
- Approval Control 활성 조건

### Component

- Score/Confidence 병렬 표시
- Blocked/Unavailable 숫자 미표시
- Stale Warning에 기준시각
- Chart Table 대안
- Modal Focus와 Keyboard
- 긴 Text·빈 Section·부분 Artifact

### Contract

- API DTO Runtime 검증
- 새 필드 추가 시 안전한 무시
- 필수 필드 누락 시 Fail Closed
- 모든 Error Code의 사용자 상태

### E2E

1. Report에서 Proposal 이동→서버 재검증→승인
2. 승인 중 Proposal 만료→성공 표시 없음→새 Proposal 안내
3. Risk DENY→승인 Control 없음
4. 수정 요청→새 Proposal 계보
5. Long-term/Momentum 동일 종목 Lot 분리와 총노출
6. 미래 Snapshot이 과거 Report에 나타나지 않음
7. 키보드만으로 핵심 Flow 완료
8. 모바일 320px에서 가로 정보 손실 없음

### Visual/Accessibility

- Light/Dark, Desktop/Tablet/Mobile Snapshot
- axe Critical/Serious 0
- High Contrast
- 200% Zoom
- Reduced Motion
- Screen Reader 승인 Flow 수동 검증

---

## 26. 구현 단계

### Phase 1 — Foundation

- Next.js App Router Shell
- Design Token과 반응형 Navigation
- View Model·Decimal/Date·Error Mapping
- Status Badge, Score/Confidence, State Notice, Lineage

### Phase 2 — Review MVP

- Home Dashboard
- Strategy 분리 화면
- Portfolio Summary
- Canonical Report Renderer
- Decision 승인/거부 안전 Flow

### Phase 3 — Learning/Operations

- Review Matrix·Lesson·Model Change
- Data Quality·Jobs·Agent·Audit
- Report Revision/Replay Diff

### Phase 4 — Production Hardening

- 실제 Auth/RLS E2E
- CSP/CSRF/Analytics Redaction
- Accessibility 수동 검증
- Web Vitals·부하·실사용 가독성 검증

---

## 27. Definition of Done

### Product

- [x] 장기·Momentum이 탐색·점수·Lot에서 분리되는가?
- [x] Thesis/Setup과 Risk가 평단/수익률보다 먼저 보이는가?
- [x] Score·Range·Confidence·상태가 병렬 표시되는가?
- [x] 현금 유지·No Action이 정상 결론으로 보이는가?
- [x] 모든 중요 수치에 기준시각과 Lineage가 있는가?

### Safety

- [x] Risk DENY와 Blocked 화면에 승인 Control이 없는가?
- [x] 승인 직전 서버 재검증을 수행하는가?
- [ ] 실제 API 연결에서 수정 요청이 새 Proposal Flow로 이동하는가?
- [x] Double Submit을 방지하는가?
- [x] UI가 도메인 계산을 하지 않는가?

### Quality

- [x] Mobile/Desktop 핵심 Flow가 가능한가?
- [ ] WCAG 2.2 AA 자동 검사에 Critical/Serious가 없는가?
- [x] Loading/Empty/Stale/Partial/Blocked/Error 상태가 구분되는가?
- [x] Runtime View Model 검증과 Error Mapping이 있는가?
- [ ] 실제 Auth/API를 연결한 Component·E2E·Visual 회귀가 있는가?

---

## 28. 수용 기준

1. Core와 Future Core, Momentum 점수를 한 Ranking에 합치지 않는다.
2. `BLOCKED/UNAVAILABLE` Score에 숫자 0을 표시하지 않는다.
3. Score 변화 설명이 없으면 변화 수치 대신 설명 대기 상태를 표시한다.
4. 동일 종목의 전략별 Lot과 총노출을 동시에 확인할 수 있다.
5. Risk `DENY`, 만료, Stale 필수 데이터에서는 승인 Button이 없다.
6. 승인 클릭 후 서버 응답 전 성공 상태로 바꾸지 않는다.
7. 승인 중 상태가 바뀌면 새 상태와 재검토 경로를 제공한다.
8. 금액·Stop·전략 수정은 새 Proposal 요청으로 이동한다.
9. Report Section은 Canonical 순서를 유지한다.
10. 모든 Report Fact에서 Source/Evidence Drawer로 이동할 수 있다.
11. 색상을 제거해도 모든 상태를 구분할 수 있다.
12. 키보드만으로 Navigation·Report 검토·승인/거부가 가능하다.
13. 320px 폭과 200% 확대에서 핵심 정보·행동이 손실되지 않는다.
14. Client Log와 Analytics에 Secret·절대 Portfolio 금액이 없다.
15. 전체 테스트·타입 검사·빌드가 통과한다.

---

## 29. 운영 전 추가 필요사항

### 구현 품질 리뷰 반영

- 잘못된 `now`/`expiresAt` 계약은 승인·거부 모두 Fail-closed한다.
- 승인 또는 거부 Endpoint가 연결되지 않은 Preview Control은 활성화하지 않는다.
- Desktop/Mobile Navigation의 구현된 Section Anchor를 실제 DOM과 일치시킨다.
- 390px Mobile·Desktop Production 화면, 콘솔 오류, 승인 확인 안전장치를 Browser에서 검증했다.

- 실제 사용자 Research와 Usability Test
- 브랜드·법무 Disclaimer 확정
- Supabase Auth/RLS 연결
- Production API Gateway와 CSRF/CSP
- Browser/Device Matrix
- Screen Reader 수동 검증
- Analytics Privacy Review
- Web Vitals RUM
- 장애·승인 사고 대응 Runbook

이 항목이 없어도 UI Domain Contract, Component, Mock Dashboard와 테스트는 구현할 수 있다. 자동 주문은 계속 범위 밖이다.
