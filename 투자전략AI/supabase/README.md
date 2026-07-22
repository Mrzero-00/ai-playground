# Supabase setup

Migration은 번호 순서대로 적용합니다.

- `001_investment_os_mvp.sql`: Investment OS MVP 기준 스키마
- `002_architecture_v2_2.sql`: Decimal 통화 Metadata, Proposal 만료, 정책·Snapshot 계보, Job 멱등성, Transactional Outbox
- `003_investment_philosophy_v2_2_1.sql`: Philosophy Version, Evidence, Thesis, Momentum Plan, Decision Journal, Review, Lesson, 전략별 Attribution
- `004_long_term_engine_v1.sql`: Industry Profile, Core/Future Core 결과, Factor·Gate, 가치평가 Scenario, Stage Transition, Review Schedule
- `005_momentum_engine_v1.sql`: Momentum Universe·Regime·7 Factor·Gate·Setup·Plan Revision·Catalyst·Event Risk·Trade Review
- `006_portfolio_engine_v1.sql`: Portfolio Policy·Snapshot·Exposure·Open Risk·Capacity·Batch·Rebalance·Stress 결과
- `007_learning_engine_v1.sql`: Review Manifest·과정/성과 귀속·Cohort·Lesson·Model Change·Replay/Walk-forward/Shadow 검증·Drift Alert
- `008_agent_orchestration_v1.sql`: Agent/Prompt/Capability Version·Run Plan·Manifest·Attempt·Tool Call·Claim·Validation·Provider Circuit

- 사용자별 RLS
- 전략별 Position Lot
- Point-in-time 데이터 Snapshot
- 평가에 사용한 모델 버전과 Snapshot 연결
- Portfolio → Risk → Decision → Execution 이력
- Job, Domain Event, Report, Audit Log
- Risk `DENY` 비가역성, Manual Review 계보와 수정 승인 재검증
- 불변 Evidence·Thesis·Decision Journal·Review 기록
- Long-term Profile별 점수·Confidence·Gate·가치평가·승격 계보
- Momentum Signal·Plan의 불변 Revision, 동일 세션 Ranking, Event/Gap Risk와 Review 계보
- Portfolio Snapshot·경제적 노출·Total/Sector/Theme Open Risk·배분 Proposal·Stress 결과의 불변 계보
- Learning Review→Cohort→Lesson→Model Change의 사용자·Model·Policy 계보와 승인 경계
- Agent Prompt·Provider·Evidence의 Point-in-time 계보, 읽기 전용 Capability와 비신뢰 Output 검증 이력

Migration은 Supabase CLI 또는 SQL Editor에서 적용합니다. 서비스 역할 키는 서버 환경에서만 사용해야 하며 클라이언트 번들에 노출하면 안 됩니다.
