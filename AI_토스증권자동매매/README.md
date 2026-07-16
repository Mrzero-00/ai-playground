> 현재 시장 상태와 미래가치 가설을 검증한 뒤에만 진입하는 안전 우선 미국 주식 페이퍼 자동매매 MVP입니다.

# AI 토스증권 자동매매

실제 주문 없이 `뉴스 출처 검증 → 시장 상태 → 미래가치 가설 → 가격 반영도 → 진입 계획 → 리스크 검증 → PaperBroker → 가설/실행 분리 평가` 흐름을 검증합니다. 기준 명세는 [v3](./ai-trading-bot-codex-spec-v3.md)입니다.

## 안전 범위

- 실제 증권사 API와 실거래 주문은 포함하지 않습니다.
- LLM은 사실과 추론을 분리하며 주문 수량과 손실 한도를 결정하지 않습니다.
- 오래됐거나 검증되지 않은 데이터와 `panic`, `low_liquidity`, `unknown` 시장 상태는 NO_TRADE입니다.
- 예상 이점이 스프레드와 슬리피지 비용을 넘지 못하면 거래하지 않습니다.
- 거래당 위험 0.25%, 일간 1%, 주간 3%, 연속 손실 3회와 손실 후 60분 쿨다운을 기본값으로 사용합니다.

## 시작하기

Node.js 22+와 pnpm이 필요합니다.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

웹은 기본 `http://localhost:3000`, API는 `http://localhost:4000`을 사용합니다. 환경값은 `.env.example`을 참고하세요.

## 구성

- `apps/web`, `apps/api`, `apps/worker`: 대시보드, Fastify API, BullMQ 워크플로
- `packages/thesis`: 사실/추론 분리 Zod 및 OpenAI Structured Output
- `packages/market-regime`, `packages/price-reflection`: 현재 시장 위험과 가격 반영도
- `packages/strategy`, `packages/risk`: 진입 계획과 결정론적 위험 통제
- `packages/execution`: 주문 상태 머신, 가격·시간·가설 손절, PaperBroker
- `packages/broker`: 토스증권 OAuth·시세·계좌 사전검증·멱등 지정가 주문 어댑터
- `packages/evaluator`: 수익과 별도로 가설·실행·리스크 품질 평가
- `packages/db`: 인메모리/Supabase 저장소와 v3 journal migration

## Supabase

`packages/db/migrations/001_initial.sql`, `002_v3_thesis_pipeline.sql` 순서로 적용합니다. `SUPABASE_SERVICE_ROLE_KEY`는 브라우저에 노출하지 마세요. 기본 로컬 API는 인메모리 저장소를 사용합니다.

## 운영 전 조건

현재는 Mock 기반 페이퍼 MVP입니다. 실시간 provider, 데이터 지연 감지, 브로커 대조, Kill Switch 운영 UI, 워크포워드 검증과 충분한 Shadow Mode가 끝나기 전에는 Live Broker를 연결하지 않습니다.

토스증권 API 자격증명과 읽기 전용 연결 절차는 [토스증권 Open API 연결](./docs/toss-invest-setup.md)을 참고하세요.

2~3주간 실시간 시세를 읽고 주문 없이 연결 안정성을 기록하려면 [Shadow Mode 운영](./docs/shadow-operations.md)을 참고하세요.
