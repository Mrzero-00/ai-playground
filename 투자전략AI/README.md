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

## 시작하기

```bash
pnpm install
pnpm test
pnpm dev
```

API 기본 주소는 `http://localhost:4000`입니다.

- `GET /health`: 상태 확인
- `POST /v1/evaluations/long-term`: 장기 점수 Preview용 Legacy API
- `POST /v1/evaluations/momentum`: 모멘텀 점수 Preview용 Legacy API
- `POST /v1/portfolio/allocate`: 단순 85/15 Preview용 Legacy API
- `POST /api/v1/cross-signals`: 장기·모멘텀 교차 신호 해석
- `POST /api/v1/allocations/propose`: Bucket/종목 한도를 적용한 Decimal 배분 제안
- `POST /api/v1/risk/evaluate`: 데이터·유동성·손실·만료 위험 검증
- `POST /api/v1/decisions`: Proposal과 Risk 판정을 승인 대기 상태로 기록
- `POST /api/v1/decisions/:id/approve`: 재검증 후 사용자 승인과 감사 기록
- `POST /api/v1/decisions/:id/reject`: 사용자 거부와 감사 기록
- `GET /api/v1/decisions/:id`: 저장된 의사결정 조회
- `GET /api/v1/audit/:decisionId`: 의사결정 감사 이력 조회
- `GET /api/v1/events/:decisionId`: 발행된 도메인 이벤트 조회
- `POST /api/v1/operations/outbox/publish`: 대기 중인 Outbox Event 발행
- `POST /api/v1/snapshots/inspect`: 데이터 Snapshot 품질·신선도 검사
- `POST /api/v1/reports/generate`: 근거 링크가 포함된 Markdown 보고서 생성

상태 변경 API는 `Idempotency-Key` Header가 필수이며 모든 응답은 `X-Request-Id`와 `X-Correlation-Id`를 반환합니다. 금액·가격·수량은 JSON 문자열 Decimal, 통화는 ISO 4217 3자리 코드로 전달합니다.

상세 설계 기준은 [Architecture](docs/01_Architecture.md)를 참고하세요.

## 구조

```text
apps/api                 HTTP 진입점
packages/core            순수 도메인 로직
  long-term              장기 투자 점수
  momentum               모멘텀 점수
  portfolio              전략 배분 및 위험 한도
  learning               결정/결과 기록 계약
supabase/migrations      PostgreSQL Schema, Index, RLS
docs                     제품·아키텍처 명세
```

점수와 정책 함수는 입력이 같으면 결과도 같은 순수 함수입니다. 외부 데이터 수집기는 Provider 경계로 연결하며, 자동 주문은 MVP 범위에서 제외합니다. 구현 범위는 [Implementation Status](docs/13_Codex_Implementation.md)에 정리되어 있습니다.
