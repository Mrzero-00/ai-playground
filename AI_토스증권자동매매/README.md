> 미국 시장 후보를 발견하고 증거 기반 가설과 결정론적 리스크 승인을 거쳐 Paper Trade를 재현하는 AI Investment OS Phase 1 MVP입니다.

# AI Investment OS

기준 문서는 [`ai-investment-os-docs`](./ai-investment-os-docs/README.md)입니다. Mock 이벤트 한 건이 `Discovery → Evidence Bundle → Thesis → Decision → Risk Gate → Paper Broker → Evaluation → Repository → Dashboard` 전체 흐름을 통과합니다.

## 빠른 실행

Node.js 22+와 pnpm이 필요합니다.

```bash
nvm use
pnpm install
pnpm dev
```

이 명령은 Seed, API, Dashboard를 함께 실행합니다. 성공하면 최종 결과 `var/mvp/latest.json`과 단계별 감사 로그 `var/mvp/stages.jsonl`이 생성됩니다. 외부 시세·뉴스·OpenAI·실제 주문은 호출하지 않습니다.

Dashboard는 Seed 실행 후 별도 터미널에서 실행합니다.

```bash
pnpm mvp:api
pnpm mvp:web
```

BullMQ Worker는 `pnpm mvp:worker`로 실행합니다. `REDIS_URL`이 없으면 로컬 인라인 모드로 한 번 실행하고, 설정되어 있으면 `investment-os` Queue를 사용합니다.

브라우저에서 `http://localhost:3100`을 엽니다. 이 프로젝트의 웹 포트는 다른 개발 프로젝트와 충돌하지 않도록 `3100`으로 고정되어 있습니다. API는 `4000`을 사용합니다.

## 검증

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Phase 1 패키지

- `packages/contracts`: 문서 계약의 TypeScript 타입과 Zod 검증
- `packages/discovery`: Mock 후보 탐색과 정량 필터
- `packages/evidence`: as-of Evidence Bundle 및 look-ahead 차단
- `packages/decision-engine`: Mock Thesis, Committee 요약, Entry Plan
- `packages/risk-gate`: LLM과 분리된 결정론적 승인/거부
- `packages/paper-broker`: Risk Gate 승인 필수 상태 머신
- `packages/os-evaluator`: 손익과 가설·실행·리스크 품질 분리 평가
- `packages/os-repository`: 로컬 JSON 감사 로그, In-memory 테스트 및 Supabase 저장소
- `apps/mvp`: 한 명령 Seed Vertical Slice
- `apps/api`, `apps/web`: 결과 API와 Dashboard
- `apps/worker`: BullMQ 또는 로컬 인라인 Worker

## Supabase

`packages/db/migrations/003_phase1_vertical_slice.sql`을 적용합니다. `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 설정되면 `pnpm mvp`가 단계 이벤트와 최종 Run을 Supabase에 저장하고, 없으면 로컬 JSON 저장소를 사용합니다.

## Phase 1 경계

- 실제 증권 주문 없음
- 실시간 WebSocket 없음
- OpenAI 호출 없음(분석 인터페이스만 유지하고 Seed는 Mock 사용)
- 다중 LLM 위원회, ML, Evidence Graph DB, 전략 자동 승격 없음
- 실거래 Broker 및 유료 데이터 Provider 없음

## Phase 2 — Realtime Data

- `packages/realtime-data`: 토스증권 OAuth2 읽기 전용 현재가, 시세 신선도, SEC submissions, RSS 뉴스 Provider
- 복구 가능한 포지션 상태 머신, 시간 손절, 1차 부분 익절, 최종 익절
- 운영 알림 인터페이스

토스 Provider는 `TOSS_INVEST_CLIENT_ID`, `TOSS_INVEST_CLIENT_SECRET`을 서버에서만 사용하며 현재 Phase에서는 주문 API를 호출하지 않습니다.

## Phase 3 — Research Committee and Evaluator

- `packages/research-evaluator`: Bull/Bear/Market/Skeptic 독립 분석과 의견 분산·충돌·누락 증거 통합
- MAE/MFE, 슬리피지, 보유 시간, 시장 국면별 성과 집계
- 자동 적용이 금지된 Strategy Proposal 초안과 기본 Counterfactual 시나리오

## Phase 4 — ML and Memory

- `packages/ml-memory`: 시간 정합성·누락률 선행 검증, Logistic Regression baseline, XGBoost-style gradient-boosted decision stumps
- 목표가가 손절가보다 먼저 도달할 확률, 모델 버전 Registry, Risk Gate에 영향이 없는 Shadow Prediction
- 미래 정보 조회를 차단하는 Episodic/Semantic/Regime Memory

## Phase 5 — Small Live Trading

- `packages/live-broker`: Paper Broker와 동형인 Broker 인터페이스, 토스 주문 Adapter, 멱등키, 수동 Kill Switch
- Paper·Shadow 성과, 복구훈련, Kill Switch 시험, 보안검토, 샌드박스 주문 검증, Paper 병행이 모두 증명되어야 주문 가능
- 거래당 0.25%, Event 0.1%, 일간 손실 0.5%, 최대 2포지션, 무레버리지 제한
- `packages/db/migrations/004_live_trading_audit.sql`: RLS가 활성화된 서비스 전용 주문 감사 로그

`LIVE_TRADING_ENABLED=false`가 기본값이며 Kill Switch도 시작 시 활성화됩니다. Production은 코드 설정 외에 `LIVE_PRODUCTION_ACK=I_ACCEPT_REAL_MONEY_RISK`가 추가로 필요합니다. 이 저장소의 자동 테스트와 기본 명령은 실제 주문을 전송하지 않습니다.

## 21일 Forward Paper 검증

토스 실시간 랭킹과 현재가를 이용해 실제 주문 없이 전략 실효성을 측정합니다.

```bash
nvm use
pnpm install
pnpm paper:forward
```

Runner는 미국 시장 거래대금 상위와 1일 급등 랭킹의 교집합을 찾고, 거래대금·등락률·시세 신선도와 2회 연속 상승 관측을 통과한 종목만 가상 진입합니다. 진입과 청산에는 슬리피지와 주문별 수수료를 반영하며 1차 부분 익절, 2차 익절, 가격 손절, 시간 손절을 처리합니다.

- 상태: `var/forward-paper/state.json`
- 요약 리포트: `var/forward-paper/report.json`
- API: `GET /forward-paper/state`, `GET /forward-paper/report`
- Dashboard: `http://localhost:3100`

재시작하면 기존 상태를 복구해 계속 실행합니다. 21일이 지나면 자동 종료합니다. 단일 사이클 점검은 다음처럼 실행합니다.

```bash
FORWARD_PAPER_ONCE=true pnpm paper:forward
```

실행 중에도 `LIVE_TRADING_ENABLED=false`를 유지해야 합니다. Forward Runner는 Live Broker 패키지를 의존하지 않으며 실제 주문 API 호출 코드가 없습니다.
