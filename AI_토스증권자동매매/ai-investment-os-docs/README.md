# AI Investment OS

미국 주식 시장 전체에서 후보를 탐색하고, 증거 기반 투자 가설을 생성한 뒤,
결정론적 리스크 게이트를 통과한 거래만 페이퍼 트레이딩하는 시스템의 설계 문서다.

## 읽는 순서

1. `AGENTS.md`
2. `docs/00-product-overview.md`
3. `docs/architecture/01-system-architecture.md`
4. `docs/contracts/02-data-contracts.md`
5. `docs/policies/03-risk-policy.md`
6. `docs/phases/phase-1-mvp.md`

## 핵심 원칙

- 자체 LLM을 만들지 않는다.
- OpenAI API는 비정형 정보 해석에 사용한다.
- 전체 종목 탐색은 정량 스캐너와 데이터 파이프라인이 담당한다.
- 주문 수량과 리스크는 결정론적 코드가 담당한다.
- 손익과 가설·실행 품질을 분리 평가한다.
- 전략은 실거래 중 스스로 변경되지 않는다.
- 새 전략은 백테스트, 워크포워드, 페이퍼, Shadow Mode를 통과해야 한다.
- Phase 1에서는 실제 증권 주문을 절대 구현하지 않는다.
