# Database Schema

## 핵심 테이블

```text
evidence_records
market_candidates
evidence_bundles
market_regimes
research_runs
committee_results
theses
entry_plans
risk_decisions
strategy_versions
orders
fills
positions
trades
trade_metrics
trade_evaluations
counterfactual_runs
strategy_proposals
backtest_runs
paper_runs
model_versions
model_predictions
risk_events
system_events
```

## 필수 감사 정보

모든 신호와 거래에 다음을 연결한다.

- 데이터 as-of 시점
- Evidence ID
- 프롬프트 버전
- 모델 이름과 버전
- 전략 버전
- Risk Policy 버전
- 코드 커밋 SHA
- 주문 및 상태 변경 로그

## 저장 원칙

- 원본 데이터와 정규화 데이터를 모두 보존
- 중복 방지를 위한 content hash
- idempotency key 사용
- 주문 상태 변경은 append-only 감사 로그 유지
