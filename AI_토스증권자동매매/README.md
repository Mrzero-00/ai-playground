> 미국 시장 후보를 발견하고 증거 기반 가설과 결정론적 리스크 승인을 거쳐 Paper Trade를 재현하는 AI Investment OS Phase 1 MVP입니다.

# AI Investment OS — Phase 1 MVP

기준 문서는 [`ai-investment-os-docs`](./ai-investment-os-docs/README.md)입니다. Mock 이벤트 한 건이 `Discovery → Evidence Bundle → Thesis → Decision → Risk Gate → Paper Broker → Evaluation → Repository → Dashboard` 전체 흐름을 통과합니다.

## 빠른 실행

Node.js 22+와 pnpm이 필요합니다.

```bash
nvm use
pnpm install
pnpm mvp
```

성공하면 `var/mvp/latest.json`이 생성됩니다. 외부 시세·뉴스·OpenAI·실제 주문은 호출하지 않습니다.

Dashboard는 Seed 실행 후 별도 터미널에서 실행합니다.

```bash
pnpm mvp:api
pnpm mvp:web
```

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
- `packages/os-repository`: In-memory 테스트 및 Supabase 저장소
- `apps/mvp`: 한 명령 Seed Vertical Slice
- `apps/api`, `apps/web`: 결과 API와 Dashboard

## Supabase

`001_initial.sql`, `002_v3_thesis_pipeline.sql`, `003_phase1_vertical_slice.sql` 순서로 적용합니다. `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 설정되면 `pnpm mvp`가 단계 이벤트와 최종 Run을 Supabase에 저장하고, 없으면 로컬 Seed 저장소를 사용합니다.

## Phase 1 경계

- 실제 증권 주문 없음
- 실시간 WebSocket 없음
- OpenAI 호출 없음(분석 인터페이스만 유지하고 Seed는 Mock 사용)
- 다중 LLM 위원회, ML, Evidence Graph DB, 전략 자동 승격 없음
- 기존 Toss/Finnhub 실험 코드는 `pnpm mvp` 실행 경로에서 호출되지 않음
