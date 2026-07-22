# 13. Implementation Status

기준 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1, `03_LongTerm_Engine.md` v1.0.0-draft, `04_Momentum_Engine.md` v1.0.0-draft, `05_Portfolio_Engine.md` v1.0.0, `06_Learning_Engine.md` v1.0.0, `07_AI_Agents.md` v1.0.0, `08_Database.md` v1.0.0, `09_Scoring_System.md` v1.0.0, `10_Report_System.md` v1.0.0, `11_UI_UX.md` v1.0.0

## 구현 완료

- Long-term / Momentum 점수 모듈 분리
- Cross Signal 4분류
- Portfolio Bucket과 단일 종목 한도
- Risk Engine 거부권과 수동 검토
- 사용자 명시 승인 상태 흐름
- 전략별 Position Lot과 Exit Policy 검증
- Long-term Candidate / Momentum Setup 상태 전이
- Model Version 승인·활성화 상태 전이
- 데이터 Snapshot 기준시각·신뢰도·stale 판정
- Job의 성공·부분 성공·실패 상태
- Domain Event와 Audit Log 계약
- 추천가·체결가·부분체결 기록
- 근거 및 모델 버전을 포함하는 Markdown Report
- 테스트용 In-memory Repository와 Decision Workflow
- Supabase PostgreSQL Schema, Index, RLS
- Decimal 문자열 기반 금액·가격·수량 계산
- Proposal 만료와 사용자 승인 직전 재검증
- Risk·Portfolio 정책 버전 및 Snapshot 계보
- API v1, Request/Correlation ID와 쓰기 멱등성
- Transactional Outbox와 멱등 Event Publisher
- 01·02 정합성 규칙: Risk `DENY` 비가역성, 수정 승인 시 새 Proposal·Risk 재검증
- 85/15 Target과 90/20 Hard Max를 분리한 Portfolio Policy
- Future Core Bucket·개별 Position Hard Limit
- Evidence A~F 계층, Fact/Estimate/Inference 태그와 점수 반영 가능 출처 검증
- Long-term Thesis, Assumption, Break Condition, 반대 근거와 불변 Revision
- Momentum Entry Zone·Chase Limit·Stop·Target·Time Stop과 Stop 확대 통제
- Market Regime 및 감정 상태 기반 신규 위험 Gate
- Decision Journal 원본·Amendment와 수정 승인 요청
- 월급날 Capital Allocation, 현금 유지와 Decimal 금액 계약
- `REQUIRE_MANUAL_REVIEW` 해소용 새 Risk Decision과 `DENY` Override 차단
- 의사결정 과정·결과 분리 Review, Lesson과 Model Change Hypothesis
- Core·Future Core·Momentum Lot별 Signed Decimal 성과 Attribution
- Fact·Estimate·Interpretation·반대 근거·최우선 선택 순서를 강제한 Decision Report
- Philosophy 변경 상태와 Hard Safety 변경 시 Architecture Revision 강제
- Supabase `003_investment_philosophy_v2_2_1.sql` Schema·RLS·불변 기록 Trigger
- Core와 Future Core를 별도 Profile·가중치·Eligibility로 계산하는 Long-term v1 Engine
- N/A 재정규화, Missing/Stale/Conflict 차단과 Industry Profile 적합성 검증
- Evidence Coverage·Source Quality·Model Fit·Disagreement 기반 Confidence와 Cap
- Bear/Base/Bull Scenario, 복수 Method, Reverse DCF를 요구하는 Decimal 가치평가 계약
- Thesis Assumption 강화·약화·Break 판정과 확대 행동 Fail-closed
- Hard Risk·회계·생존·정책·가치평가 Gate와 `REVIEW_REQUIRED`
- Future Core/Core 단계별 관찰 기간과 Human Approval이 필요한 승격 제안
- 운영 상태를 변경하지 않는 Historical Replay와 결정론적 Result Hash
- Long-term 평가 생성·조회·기업 최신 평가·동일 모델 Ranking API
- Long-term Evaluation + Audit + Transactional Outbox 원자 저장 계약
- Supabase `004_long_term_engine_v1.sql` Profile·Factor·Gate·Valuation·Stage·Review Schema와 RLS
- Regime·Portfolio 용량과 분리된 Momentum 7 Factor Score·Range·Confidence
- Point-in-time Universe 정책, 유동성 Tier와 거래정지·상장·Corporate Action Fail-closed
- Breakout·Pullback·Earnings Momentum·Gap Continuation·Sector Rotation·Special Situation Setup Registry
- Corporate-action 조정 Bar 기반 ATR, 정렬된 Benchmark Relative Strength, Volume Ratio와 Catalyst Half-life
- Entry Zone·Chase Limit·Stop·Target·Time Stop·비용 차감 Reward/Risk를 강제하는 Momentum Trade Plan v1
- Market Regime·Setup Regime·Liquidity·Catalyst·Event/Gap·Behavioral·만료 Gate와 `ENTER/WAIT/AVOID/EXIT/REVIEW_REQUIRED`
- Human-only 승인과 순차 Setup Lifecycle, 불변 Plan Revision 및 과정/결과 분리 Trade Review
- 운영 상태를 변경하지 않는 Momentum Historical Replay와 결정론적 Evaluation·Scan Result Hash
- Momentum Scan·평가·기업 최신 평가·동일 버전 Ranking·Plan Revision·가격 재검증·Due Review API
- Momentum Evaluation/Scan/Plan + Audit + Transactional Outbox 원자 저장 계약
- Supabase `005_momentum_engine_v1.sql` Universe·Regime·Factor·Gate·Setup·Plan·Catalyst·Event·Review Schema와 RLS
- Portfolio Snapshot 기반 NAV·전략별 Cash·85/15 Target/Soft/Hard·Future Core 하위 Bucket Ledger
- Company·Sector·Industry·Theme·Currency Look-through와 외화 50% Review·65% Hard Capacity
- Momentum Stop/Gap 기반 Risk 수량, Total·Sector·Theme Open Risk Budget, Liquidity·Round Lot
- 단건 Proposal, 안정 정렬 New Capital Batch, Rebalance Review, Stress Test, Historical Replay와 결정론적 Hash
- Portfolio Proposal·Batch·Rebalance·Stress 조회/생성 API와 Audit·Transactional Outbox 원자 저장 계약
- Supabase `006_portfolio_engine_v1.sql` Policy·Snapshot·Exposure·Open Risk·Capacity·Batch·Rebalance·Stress Schema와 RLS
- 과정 품질과 결과를 독립 분류하는 Learning Review Manifest·Maturity·Process Dimension·Signed Decimal Outcome Attribution
- 저장된 Review만 사용하는 Cohort 표본·성숙도·근거 Coverage·Regime·종목 집중도·Censoring Gate
- 반대 사례와 No-change를 보존하는 Lesson Candidate 및 Human Reviewer 승인/거부
- 승인 Lesson 기반 Champion/Challenger Model Change 불변 Revision과 Replay→Walk-forward→Shadow Guardrail 검증
- Learning Review·Cohort·Lesson·Model Change·Validation API, Audit·Transactional Outbox와 클라이언트 계산값 재검증
- Supabase `007_learning_engine_v1.sql` Review·Attribution·Cohort·Lesson·Model Change·Validation·Shadow·Drift Schema와 RLS
- Agent Definition·Prompt·Provider·Schema Version, 읽기 전용 Capability와 최소 권한 검증
- Run Request·Manifest·DAG Plan·Attempt·Replay·Cancel 상태와 결정론적 Stable Hash
- Evidence-bound Claim, 사용자 소유권·Point-in-time·출처 등급·인용 위치·결정론 결과 일치 검증
- Prompt Injection·금지 권한·Secret 형태 필드·과도한 Context/Output을 차단하는 비신뢰 Output 경계
- 외부 SDK에 독립적인 Provider Interface와 Scripted Provider, Agent Run/Validation API·Audit·Transactional Outbox
- Supabase `008_agent_orchestration_v1.sql` Prompt·Definition·Capability·Plan·Run·Attempt·Tool·Output·Claim·Validation Schema와 RLS
- 사용자 소유·Point-in-time·Evidence 요구·순환 금지를 검증하는 Database Lineage 계약
- Legal/Audit·재현성·민감 원문·Cache 분류별 Retention과 삭제 가능 범위 검증
- Legal Hold·재현성 입력을 Fail-closed하는 삭제 요청과 단선형 불변 Revision Workflow
- Signed Decimal 비교, Warning/Critical Finding, `PASSED/FAILED/BLOCKED`를 분리하는 Reconciliation
- Database 계약 API, 허용 필드 경계, Audit·Transactional Outbox와 결정론적 Result Hash
- Supabase `009_database_hardening_v1.sql` Lineage·Retention·Deletion·Incident·Reconciliation·Migration Verification Schema, RLS, Index, 불변 Trigger
- Long-term Core·Future Core·Momentum Setup을 직접 비교하지 않는 Scoring Scope와 명시적 Direction 계약
- Linear·Piecewise·Target Band 정규화, Basis Point Weight, Critical/N/A/Unknown·Stale·Conflict 처리
- Evidence Manifest에서 사용자·Point-in-time·출처 등급·독립 Source 수를 재계산하는 Factor 경계
- `SCORED/BLOCKED/UNAVAILABLE` 상태로 계산 불가와 실제 0점을 분리하고 기존 Engine에 `scoreStatus` 제공
- Score Range·Sensitivity·Confidence/Cap·Factor Contribution과 동일 Model 변화 설명
- 동일 사용자·Scope·Model·Philosophy와 고유 Subject만 허용하는 결정론적 Ranking
- DRAFT→VALIDATING→SHADOW→APPROVED→ACTIVE→DEPRECATED Model 생명주기와 설정 Hash 불변성
- Scoring Model/Scorecard/Ranking/Change/Replay API, Audit·Transactional Outbox·Idempotency
- Supabase `010_scoring_system_v1.sql` Model·Factor·Threshold·Scorecard·Confidence·Change·Calibration Schema, RLS, Index, 상태 Trigger
- JSON을 진실 원본으로 사용하는 Canonical Report와 Markdown·Notification·Web Artifact 분리
- Report Template DRAFT→APPROVED→ACTIVE→DEPRECATED 생명주기·Content Hash, 유형별 필수 Source·Section·Coverage Gate
- 사용자 소유·Point-in-time·Source Result Hash를 고정하는 Source Manifest
- Fact·Estimate·Interpretation·Recommendation 분리와 결론·반대 근거·위험·행동 순서
- 하나의 최우선 Recommendation, 신규 위험의 반대 근거 의무와 `BLOCKED` 실행 차단
- 입력 순서와 무관한 Canonical/Artifact Hash, 불변 정정 Revision과 Historical Replay
- PDF Renderer 미설정 시 JSON·Markdown·Notification을 보존하는 Format 단위 부분 성공
- Report Template/생성/조회/Artifact/Revision/Replay API, Audit·Transactional Outbox·Idempotency
- Supabase `011_report_system_v1.sql` Template·Request·Run·Canonical·Manifest·Section·Artifact·Replay·Delivery Schema, RLS, Index, 불변 Trigger
- Next.js App Router 기반 반응형 Investment OS Dashboard와 Desktop/Mobile Navigation
- 장기·Momentum 전략을 합산하지 않는 Score/Range/Confidence·Blocked 상태 Component
- Decimal 문자열 정밀도를 보존하는 금액 Formatter와 API Error→안전 복구 View Model
- Canonical Report 순서·Source를 보존하는 Report Renderer와 Snapshot·Model·Hash Lineage Panel
- Risk DENY·Stale·Manual Review·만료를 Fail-closed하는 승인 상태와 중복 제출 방지 Client Boundary
- 잘못된 결정 시각과 미연결 승인·거부 Endpoint를 Fail-closed하고 실제 Section Anchor를 연결한 UI 품질 보완
- Keyboard Focus·Skip Link·Text+Icon 상태·Reduced Motion·Touch Target을 포함한 접근성 Foundation
- Web View Model Unit Test와 Next Production Static Build
- R0~R6 Readiness, Milestone Dependency DAG, 필수 Gate와 Waiver 만료를 검증하는 Planning v1
- Build·Contract·Test·Migration·Security·Operations 증거와 Critical Risk를 Fail-closed하는 Release Evidence Bundle
- Roadmap Plan 불변 Revision·Replay·Stable Hash, API·Audit·Transactional Outbox
- Gate Result 재계산, Plan/Check Point-in-time, Cross-plan Dependency/Evidence를 차단하는 Planning 품질 경계
- Supabase `012_roadmap_planning_v1.sql` Plan·Gate·Check·Milestone·Dependency·Evidence·Replay Schema와 RLS

## 런타임 경계

API는 자동 주문을 실행하지 않는다. 처리 순서는 아래와 같다.

```text
Evaluation
  -> Cross Signal
  -> Allocation Proposal
  -> Risk Decision
  -> Decision Proposal
  -> Explicit User Approval
  -> Execution Record
```

Risk `DENY`는 이후 승인을 생성할 수 없으며, 정상 Risk 판정도 사용자 승인 전에는 `PENDING_APPROVAL` 상태를 유지한다.

`REQUIRE_MANUAL_REVIEW`는 `DENY` Override가 아니다. 추가 근거로 새 Risk Decision을 생성할 수 있지만 Portfolio 승인 금액을 늘릴 수 없고, 이후 Decision Proposal과 사용자 승인 경계를 다시 통과한다. 금액·Stop·전략 수정 역시 기존 Decision을 변경하지 않고 새 Proposal을 요구한다.

사용자 승인은 Proposal 만료, Portfolio 잔여 용량, 가격 허용 범위, 데이터 신선도와 Risk 유효성을 재검증해야 한다. 승인 Event는 Domain 상태·Audit과 함께 Outbox에 기록된 뒤 Publisher가 발행한다.

## 외부 연결 전제

다음 항목은 코드가 아니라 운영 환경 설정이 필요하다.

- Supabase 프로젝트 URL과 서버 전용 키
- 데이터 공급자 API와 수집 주기
- 거래소 Calendar·Corporate Action·완료 Bar·Quote 공급자와 Momentum Scan Scheduler
- 인증 사용자 및 초기 Portfolio
- 실제 운용 정책으로 승인된 점수 가중치와 Risk Limit
- Supabase `001`~`012` 실제 적용과 Auth/RLS 교차 사용자 E2E
- Backup/PITR 설정, Restore Drill, Query Plan·부하 검증과 Retention Operator Runbook
- Scoring Historical Replay·Walk-forward·Shadow Calibration의 실제 표본 및 승인 결과
- Report PDF/Web 저장소, Delivery Provider, Scheduler와 운영 Redaction·접근성 정책
- Web의 실제 Supabase Auth/API 연결, Browser E2E, axe/Screen Reader·Visual Regression과 RUM

이 값이 없어도 Domain, Migration, API와 테스트는 실행할 수 있다. 자동 주문은 MVP 범위에서 제외한다.

## 검증 명령

```bash
pnpm typecheck
pnpm test
pnpm build
```
