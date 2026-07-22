# Supabase setup

Migration은 번호 순서대로 적용합니다.

- `001_investment_os_mvp.sql`: Investment OS MVP 기준 스키마
- `002_architecture_v2_2.sql`: Decimal 통화 Metadata, Proposal 만료, 정책·Snapshot 계보, Job 멱등성, Transactional Outbox

- 사용자별 RLS
- 전략별 Position Lot
- Point-in-time 데이터 Snapshot
- 평가에 사용한 모델 버전과 Snapshot 연결
- Portfolio → Risk → Decision → Execution 이력
- Job, Domain Event, Report, Audit Log

Migration은 Supabase CLI 또는 SQL Editor에서 적용합니다. 서비스 역할 키는 서버 환경에서만 사용해야 하며 클라이언트 번들에 노출하면 안 됩니다.
