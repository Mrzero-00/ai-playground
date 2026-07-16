# AI 토스증권 자동매매 프로젝트

- `ai-trading-bot-codex-spec-v3.md`가 제품 명세의 기준이다.
- 검증되지 않았거나 오래된 데이터, unknown/panic/low-liquidity 시장 상태는 항상 NO_TRADE로 처리한다.
- 초기 주문 구현은 PaperBroker로 제한한다. 실제 증권사 주문 코드를 추가하지 않는다.
- 리스크 통제는 결정론적 코드로 유지하고 LLM과 분리한다.
- TypeScript strict mode를 유지하며 변경 후 test와 typecheck를 실행한다.
- 비밀키와 실제 거래 데이터는 커밋하지 않는다.
