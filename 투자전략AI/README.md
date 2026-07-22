# Investment OS

> 장기 복리 투자와 모멘텀 투자를 독립적으로 평가하고 포트폴리오에서 통합하는 AI 투자 의사결정 시스템입니다.

장기 복리 투자와 모멘텀 투자를 독립적으로 평가하고, 포트폴리오 엔진에서만 결합하는 의사결정 시스템입니다.

# Investment OS v2 Specification

## Goal

Build an Investment Operating System supporting BOTH:

- Long-term investing (Core / Future Core)
- Momentum investing (Tactical)

## Architecture

Investment OS

- Long-term Engine
- Future Core Engine
- Momentum Engine
- Portfolio Engine
- Risk Engine
- Learning Engine
- Report Engine
- Data Platform

See docs/ for detailed specifications.

## Detailed specifications

- [Architecture](docs/01_Architecture.md)
- [Investment Philosophy](docs/02_Investment_Philosophy.md)
- [Investment Philosophy Part Index](docs/02_Investment_Philosophy/README.md)
- [Long-term Engine](docs/03_LongTerm_Engine.md)
- [Momentum Engine](docs/04_Momentum_Engine.md)
- [Portfolio Engine](docs/05_Portfolio_Engine.md)
- [Learning Engine](docs/06_Learning_Engine.md)
- [AI Agents](docs/07_AI_Agents.md)
- [Database](docs/08_Database.md)
- [Scoring System](docs/09_Scoring_System.md)
- [Report System](docs/10_Report_System.md)
- [UI / UX](docs/11_UI_UX.md)

## 시작하기

```bash
pnpm install
pnpm test
pnpm dev
```

API 기본 주소는 `http://localhost:4000`입니다.

- `GET /health`: 상태 확인
- `POST /v1/evaluations/long-term`: 장기 점수 Preview용 Legacy API
- `POST /api/v1/long-term/evaluations`: Core/Future Core Profile·Gate·Thesis·가치평가 기반 불변 평가 생성
- `GET /api/v1/long-term/evaluations/:id`: Long-term 평가와 근거 계보 조회
- `GET /api/v1/companies/:companyId/long-term`: 기업의 최신 Long-term 평가 조회
- `GET /api/v1/long-term/rankings?profile=CORE|FUTURE_CORE`: 동일 모델 버전의 투자 가능 후보 순위
- `GET /api/v1/long-term/reviews/due`: 기준시각까지 도래한 Long-term 정기·사건 리뷰 조회
- `POST /api/v1/long-term/replays`: 운영 상태를 변경하지 않는 Historical Replay
- `POST /v1/evaluations/momentum`: 모멘텀 점수 Preview용 Legacy API
- `POST /api/v1/momentum/scans`: 동일 세션·모델·Universe 정책으로 Momentum 후보 일괄 평가
- `GET /api/v1/momentum/scans/:id`: 불변 Scan 결과와 후보별 실패 원인 조회
- `POST /api/v1/momentum/evaluations`: Universe·Regime·7 Factor·Setup·Trade Plan Gate 기반 불변 평가 생성
- `GET /api/v1/momentum/evaluations/:id`: Momentum 평가·Gate·근거·Plan 계보 조회
- `GET /api/v1/companies/:companyId/momentum`: 기업의 최신 Momentum 평가 조회
- `GET /api/v1/momentum/rankings`: 동일 모델·Universe 정책·세션의 `ENTER`/`WAIT` 후보 순위
- `POST /api/v1/momentum/plans`: 불변 Momentum Trade Plan Revision 생성
- `POST /api/v1/momentum/plans/:id/revisions`: 기존 Plan을 수정하지 않는 다음 Revision 생성
- `POST /api/v1/momentum/plans/:id/validate-price`: 현재가의 Entry Zone·Chase 상태 재검증
- `GET /api/v1/momentum/reviews/due`: 기준시각까지 도래한 Momentum 리뷰 조회
- `POST /api/v1/momentum/replays`: 운영 상태를 변경하지 않는 Historical Replay
- `POST /v1/portfolio/allocate`: 단순 85/15 Preview용 Legacy API
- `POST /api/v1/portfolio/policies/validate`: Portfolio v1 Target·Soft·Hard·Open Risk·외화 정책 검증
- `POST /api/v1/allocations/proposals`: Snapshot·Capacity·수량·Risk Handoff 기반 불변 배분안 생성
- `GET /api/v1/allocations/proposals/:id`: 저장된 Portfolio v1 배분안 조회
- `POST /api/v1/allocations/new-capital`: 동일 Snapshot의 후보를 안정 정렬해 공동 Capacity 내 신규 자금 배분
- `GET /api/v1/allocations/new-capital/:id`: 불변 신규 자금 배분 결정 조회
- `POST /api/v1/portfolios/:id/rebalance`: Hard/Soft Drift·노출·Open Risk 리밸런싱 검토
- `GET /api/v1/portfolio/rebalance-reviews/:id`: 불변 Rebalance 검토 결과 조회
- `POST /api/v1/portfolios/:id/stress-tests`: 시장·Sector·Theme·FX·Gap Stress 실행
- `GET /api/v1/portfolio/stress-results/:id`: 불변 Stress 결과 조회
- `GET /api/v1/portfolios/:id`: 최신 Portfolio Snapshot과 Ledger 조회
- `GET /api/v1/portfolios/:id/exposures`: Company·Sector·Industry·Theme·Currency 노출 조회
- `GET /api/v1/portfolios/:id/open-risk`: Momentum Open Risk 조회
- `POST /api/v1/allocations/replays`: 운영 상태를 바꾸지 않는 Portfolio Historical Replay
- `POST /api/v1/learning/reviews`: 원시 Outcome을 서버에서 재계산하고 과정·결과를 분리한 불변 Review 생성
- `GET /api/v1/learning/reviews/:id`: Review·Manifest·Model/Policy 계보 조회
- `POST /api/v1/learning/cohorts/analyze`: 저장된 Review만으로 표본·성숙도·근거·집중도 Gate 분석
- `GET /api/v1/learning/cohorts/:id`: 불변 Cohort 분석 조회
- `POST /api/v1/learning/lessons/candidates`: 반대 사례를 포함한 Lesson Candidate 생성
- `POST /api/v1/learning/lessons/:candidateId/approve`: Human Reviewer의 Lesson 승인·거부
- `GET /api/v1/learning/lessons/:id`: 확정 Lesson과 근거 Review 조회
- `POST /api/v1/learning/model-changes`: 승인된 Lesson 기반 Champion/Challenger 변경 가설 생성
- `POST /api/v1/learning/model-changes/:id/transitions`: 불변 Model Change 상태 Revision 생성
- `POST /api/v1/learning/validations`: Replay·Walk-forward·Shadow 3단계 Guardrail 검증
- `GET /api/v1/learning/validations/:id`: Model Validation 결과 조회
- `POST /api/v1/learning/model-changes/:id/approve`: 검증 완료 변경 가설의 Human Approval
- `GET /api/v1/learning/model-changes/:id`: Model Change Revision 조회
- `GET /api/v1/agents/definitions`: 활성 Agent Definition과 최소 권한 Capability 조회
- `POST /api/v1/agents/definitions/validate`: Agent Version·Timeout·Token·Capability 계약 검증
- `POST /api/v1/agents/plans/validate`: Workflow Scope와 Dependency Cycle을 검사한 결정론적 DAG 생성
- `POST /api/v1/agents/runs`: Agent/Prompt/Provider/Snapshot/Evidence를 고정한 불변 Run Manifest 생성
- `GET /api/v1/agents/runs/:id`: Agent Run·검증 결과·Result Hash 조회
- `GET /api/v1/agents/runs/:id/attempts`: Run Attempt 상태 조회
- `POST /api/v1/agents/outputs/validate`: 비신뢰 Output의 Schema·Evidence·소유권·시각·결정론·Injection 검증
- `POST /api/v1/agents/replays`: 입력 `asOf`와 Context를 보존하는 비운영 Replay 생성
- `POST /api/v1/agents/runs/:id/cancel`: 비종료 Run 취소
- `GET /api/v1/database/health`: Database v1 계약과 운영 환경 추가 점검 항목 조회
- `GET /api/v1/database/migrations`: 적용 순서 기준 Migration Manifest 조회
- `POST /api/v1/database/lineage/validate`: Point-in-time·순환·Evidence 계보 검증
- `POST /api/v1/database/retention/policies/validate`: 보존·Archive·Hard Delete 정책 검증
- `POST /api/v1/database/deletion-requests`: Legal Hold·재현성 보호를 적용한 삭제 요청 생성
- `POST /api/v1/database/deletion-requests/:id/transitions`: 기존 Row를 변경하지 않는 삭제 요청 Revision 생성
- `GET /api/v1/database/deletion-requests/:id`: 삭제 요청 Revision 조회
- `POST /api/v1/database/reconciliations/validate`: Decimal 기반 정합성 검사와 Critical 차단 결과 저장
- `GET /api/v1/database/reconciliations/:id`: 불변 정합성 검사 결과 조회
- `POST /api/v1/scoring/models/validate`: Basis Point Weight·정규화·Evidence·Confidence 정책을 검증한 DRAFT Model 등록
- `POST /api/v1/scoring/models/:id/transitions`: DRAFT→VALIDATING→SHADOW→APPROVED→ACTIVE 생명주기 전이
- `GET /api/v1/scoring/models/:id`: Scoring Model·설정 Hash·상태 조회
- `POST /api/v1/scoring/scorecards/evaluate`: 방향·N/A·Evidence·Range·Confidence 기반 불변 Scorecard 생성
- `GET /api/v1/scoring/scorecards/:id`: Scorecard·Factor Contribution·Blocker 조회
- `POST /api/v1/scoring/rankings/validate`: 동일 Scope·Model·Philosophy 결과만 안정 정렬
- `POST /api/v1/scoring/changes/explain`: 동일 Model 점수 변화의 Factor Contribution 분해
- `GET /api/v1/scoring/changes/:id`: 불변 Score Change 설명 조회
- `POST /api/v1/scoring/replays`: 운영 상태를 바꾸지 않는 Historical Replay Scorecard 생성
- `POST /api/v1/reports/templates/validate`: Source·Section·Format 계약을 검증한 DRAFT Report Template 등록
- `POST /api/v1/reports/templates/:id/transitions`: DRAFT→APPROVED→ACTIVE→DEPRECATED Template 생명주기 전이
- `GET /api/v1/reports/templates/:id`: Report Template·설정 Hash 조회
- `POST /api/v1/reports`: Point-in-time Source Manifest 기반 Canonical Report와 Artifact 생성
- `GET /api/v1/reports/:id`: 불변 Canonical Report·Quality·Blocker·계보 조회
- `GET /api/v1/reports/:id/artifacts`: 생성에 성공한 JSON·Markdown·Notification Artifact 목록
- `GET /api/v1/reports/:id/artifacts/:format`: Format별 불변 Artifact 조회
- `POST /api/v1/reports/:id/revisions`: 기존 발행본을 변경하지 않는 정정 Revision 생성
- `POST /api/v1/reports/:id/replays`: 원본 Manifest를 유지한 결정론적 Report Replay
- `POST /api/v1/cross-signals`: 장기·모멘텀 교차 신호 해석
- `POST /api/v1/allocations/propose`: Bucket/종목 한도를 적용한 Decimal 배분 제안
- `POST /api/v1/portfolio/allocate`: 85/15 정책을 적용한 Decimal 자금 배분
- `POST /api/v1/philosophy/policies/validate`: 02 투자 철학 정책과 Hard Safety 검증
- `POST /api/v1/evidence/validate`: Evidence 유형·출처 등급·기준일 검증
- `POST /api/v1/evidence/sets/validate`: 평가 Evidence와 점수 반영 가능 출처 검증
- `POST /api/v1/theses/validate`: Long-term Thesis·반대 근거·Review 계약 검증
- `POST /api/v1/momentum/plans/validate`: Entry·Stop·Chase·Time Stop 계획 검증
- `POST /api/v1/decisions/journal/validate`: 원본 보존형 Decision Journal 검증
- `POST /api/v1/decisions/modifications/request`: 수정 승인을 새 Proposal 요청으로 변환
- `POST /api/v1/allocations/monthly`: 월급날 자금 배분과 Cash 유지액 계산
- `POST /api/v1/risk/evaluate`: 데이터·유동성·손실·만료 위험 검증
- `POST /api/v1/risk/manual-review/resolve`: `REQUIRE_MANUAL_REVIEW`를 새 Risk Decision으로 해소
- `POST /api/v1/decisions`: Proposal과 Risk 판정을 승인 대기 상태로 기록
- `POST /api/v1/decisions/:id/approve`: 재검증 후 사용자 승인과 감사 기록
- `POST /api/v1/decisions/:id/reject`: 사용자 거부와 감사 기록
- `GET /api/v1/decisions/:id`: 저장된 의사결정 조회
- `GET /api/v1/audit/:decisionId`: 의사결정 감사 이력 조회
- `GET /api/v1/events/:decisionId`: 발행된 도메인 이벤트 조회
- `POST /api/v1/operations/outbox/publish`: 대기 중인 Outbox Event 발행
- `POST /api/v1/snapshots/inspect`: 데이터 Snapshot 품질·신선도 검사
- `POST /api/v1/reports/generate`: 근거 링크가 포함된 Markdown 보고서 생성
- `POST /api/v1/reports/decision`: Fact·Interpretation·반대 근거·최우선 선택을 분리한 보고서 생성
- `POST /api/v1/reviews/assess`: 결과와 과정 품질을 분리한 Decision Review
- `POST /api/v1/lessons/validate`: 표본·근거를 포함한 Investment Lesson 검증
- `POST /api/v1/performance/attribute`: Core·Future Core·Momentum Lot별 손익 Attribution

상태 변경 API는 `Idempotency-Key` Header가 필수이며 모든 응답은 `X-Request-Id`와 `X-Correlation-Id`를 반환합니다. 금액·가격·수량은 JSON 문자열 Decimal, 통화는 ISO 4217 3자리 코드로 전달합니다.

상세 설계 기준은 [Architecture](docs/01_Architecture.md)를 참고하세요.

## 구조

```text
apps/api                 HTTP 진입점
packages/core            순수 도메인 로직
  long-term              Legacy 장기 투자 점수 Preview
  long-term-v1           Core/Future Core Profile, Gate, Confidence, Valuation, Thesis·Stage 정책
  momentum               Legacy 모멘텀 점수 Preview
  momentum-v1            Universe, Regime, 7 Factor, Setup, Trade Plan, Gate, Lifecycle 정책
  portfolio              전략 배분 및 위험 한도
  portfolio-v1           Snapshot Ledger, Exposure, Open Risk, Sizing, Batch, Rebalance, Stress
  philosophy-policy      02 투자 철학, 안전 정책과 변경 거버넌스
  evidence / thesis      출처 계층, 장기 논지와 Point-in-time 계보
  momentum-plan          Entry·Stop·Target·Time Stop 계약
  decision-journal       원본 보존, 수정 승인 재검증 계약
  performance-attribution 전략 Lot별 Decimal 손익 분리
  learning               Legacy 결정/결과 기록 계약
  learning-v1            Review Maturity, Process/Outcome, Cohort, Lesson, Model Change 검증
  agent-v1               Definition/Prompt, Manifest, Evidence Claim, DAG, 보안 검증, Provider 경계
  database-v1            Lineage, Retention, Deletion Revision, Decimal Reconciliation 계약
  scoring-v1             Model Lifecycle, Normalization, N/A, Range, Confidence, Ranking, Change 계약
  report-v1              Canonical Report, Source Manifest, Quality Gate, Revision, Artifact, Replay 계약
supabase/migrations      PostgreSQL Schema, Index, RLS
docs                     제품·아키텍처 명세
```

점수와 정책 함수는 입력이 같으면 결과도 같은 순수 함수입니다. 외부 데이터 수집기는 Provider 경계로 연결하며, 자동 주문은 MVP 범위에서 제외합니다. 구현 범위는 [Implementation Status](docs/13_Codex_Implementation.md)에 정리되어 있습니다.
