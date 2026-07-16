# AI 자동매매 시스템 구현 명세서 v2

> 목적: 자체 LLM을 새로 학습하지 않고, `OpenAI API + 규칙 엔진 + 거래 데이터 + 소형 ML 모델`을 조합해 점진적으로 성능을 개선하는 자동매매 시스템을 구현한다.

## 1. 핵심 결론

이 프로젝트에서 직접 만들어야 하는 것은 거대한 자체 AI 모델이 아니다.

다음 네 요소를 결합한 **AI 기반 자동매매 운영 시스템**을 만든다.

```text
기존 LLM(OpenAI API)
        +
정량 규칙 엔진
        +
거래 데이터베이스
        +
소형 예측 모델(LightGBM/XGBoost)
```

LLM은 뉴스·공시·실적·계약의 의미를 해석한다.

규칙 엔진은 포지션 크기, 손절, 일간 손실 제한, 유동성 제한을 결정론적으로 통제한다.

소형 ML 모델은 누적된 거래 데이터를 바탕으로 목표가 선도달 확률, 손절가 선도달 확률, 기대수익 등을 계산한다.

ChatGPT 예약 모니터링은 실제 주문 파이프라인에 포함하지 않고, 사람이 확인하는 별도 리서치 채널로 유지한다.

---

## 2. 권장 최종 아키텍처

```text
┌────────────────────────────────────────┐
│ Market / News / Filing Data Providers  │
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│ Collector Workers                      │
│ 시세·뉴스·공시 수집 / 정규화 / 중복제거 │
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│ Quant Scanner                          │
│ 거래량·갭·Float·공매도·가격구조 필터     │
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│ LLM Catalyst Analyzer                  │
│ OpenAI API로 뉴스·공시 의미 해석         │
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│ ML Probability Model                   │
│ 목표가/손절가 선도달 확률 예측            │
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│ Deterministic Risk Engine              │
│ 비중·손절·일간손실·유동성 제한            │
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│ Execution Engine                       │
│ Paper Broker → Live Broker             │
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│ Trade Journal / Evaluator              │
│ 결과 저장·실패 분석·전략 변경안 생성      │
└────────────────────────────────────────┘
```

---

## 3. 구현 원칙

### 해야 하는 것

- OpenAI API로 비정형 시장 정보를 구조화한다.
- 실제 거래 당시의 입력 특징을 모두 저장한다.
- 전략 규칙을 버전 관리한다.
- 새 전략은 백테스트와 페이퍼 트레이딩을 통과해야 한다.
- 실제 주문 판단은 LLM 단독이 아니라 규칙 엔진과 함께 결정한다.
- 초기에는 PaperBroker만 사용한다.

### 하지 않는 것

- 자체 LLM을 처음부터 학습하지 않는다.
- LLM이 실시간으로 자기 코드를 수정하지 않는다.
- 손실 한 번만 보고 전략 가중치를 바꾸지 않는다.
- ChatGPT 예약 알림을 실제 주문 트리거로 사용하지 않는다.
- LLM에게 최종 리스크 통제를 맡기지 않는다.

---

## 4. 권장 기술 스택

### Monorepo

```text
pnpm workspace
Turborepo
```

### Frontend

- Next.js App Router
- TypeScript
- Chakra UI
- TanStack Query
- Zustand
- TradingView Lightweight Charts

### Backend

- Node.js 20+
- TypeScript
- Fastify
- BullMQ
- Redis
- Railway, Fly.io 또는 AWS ECS

### Database

- Supabase PostgreSQL
- Supabase Auth
- Row Level Security
- pgvector는 뉴스 유사도 검색이 필요할 때만 추가

### AI / ML

- OpenAI Responses API
- Structured Outputs
- Zod
- Python 학습 서비스
- LightGBM 또는 XGBoost
- scikit-learn
- MLflow는 2단계 이후 선택

### Observability

- Sentry
- OpenTelemetry
- Pino
- 주문 감사 로그
- 전략 버전 로그

---

## 5. 전략 구성

### Core Strategy

- 보유 기간: 수개월~수년
- 입력: 실적, 가이던스, 밸류에이션, 산업 구조
- 목표: 장기 위험조정 수익률
- 손절: 투자 논리 훼손 중심

### Momentum Strategy

- 보유 기간: 수일~수개월
- 입력: 실적 상향, 거래량, 상대강도, 업종 순환
- 목표: 추세 지속 구간 포착

### Dopamine Strategy

- 보유 기간: 수분~3거래일
- 입력: FDA, 합병, 역합병, 스핀오프, AI 전환, Float, RVOL, 공매도
- 기본 알림/진입 후보 기준: 매력도 9.0 이상
- 9.5 이상: 최우선 강력 후보
- 목표: 손실 제한과 비대칭 수익

### Risk Engine

Risk Engine은 반드시 결정론적 코드로 구현한다.

- 거래당 최대 위험 금액
- 일간 최대 손실
- 최대 동시 포지션 수
- 종목당 최대 비중
- 최소 유동성
- 최대 스프레드
- 갭 상승 추격 제한
- 손절 주문 필수
- Kill Switch

---

## 6. AI의 역할

LLM은 다음 업무만 담당한다.

- 뉴스·SEC 공시 요약
- 이벤트 유형 분류
- 이벤트 강도 평가
- 희석 가능성 및 숨은 리스크 추출
- 진입 논리와 무효화 조건 생성
- 거래 종료 후 정성적 실패 원인 분석

LLM은 다음 업무를 직접 결정하지 않는다.

- 주문 수량
- 계좌 위험 한도
- 손절 주문 실행 여부
- 일간 거래 중단 여부
- 전략 자동 승격 여부

---

## 7. 구조화된 AI 출력

```ts
import { z } from 'zod';

export const CatalystAnalysisSchema = z.object({
  symbol: z.string(),
  strategy: z.enum(['core', 'momentum', 'dopamine']),
  catalystType: z.enum([
    'earnings',
    'guidance',
    'contract',
    'fda',
    'merger',
    'reverse_merger',
    'spinoff',
    'ai_pivot',
    'listing',
    'short_squeeze',
    'other',
  ]),
  catalystScore: z.number().min(0).max(10),
  confidence: z.number().min(0).max(1),
  action: z.enum(['ENTER', 'WATCH', 'REJECT']),
  thesis: z.array(z.string()),
  risks: z.array(z.string()),
  invalidationConditions: z.array(z.string()),
  expiresAt: z.string().datetime(),
});

export type CatalystAnalysis = z.infer<typeof CatalystAnalysisSchema>;
```

LLM은 반드시 위 스키마에 맞는 JSON만 반환한다.

---

## 8. 정량 특징 데이터

```ts
export type SignalFeatures = {
  symbol: string;
  observedAt: string;

  marketCap: number | null;
  floatShares: number | null;
  shortInterestPercent: number | null;

  relativeVolume: number;
  premarketGapPercent: number;
  intradayChangePercent: number;
  spreadPercent: number;
  vwapDistancePercent: number;

  catalystType: string;
  catalystScore: number;
  llmConfidence: number;

  marketRegime: 'risk_on' | 'neutral' | 'risk_off';
  sectorRelativeStrength: number | null;
};
```

이 데이터는 신호 생성 시점의 원본 그대로 저장한다.

---

## 9. 최종 진입 판단

```ts
type FinalDecisionInput = {
  llmCatalystScore: number;
  llmConfidence: number;
  mlTarget1HitProbability: number | null;
  mlStopFirstProbability: number | null;
  ruleEnginePassed: boolean;
};

export function shouldEnter(input: FinalDecisionInput): boolean {
  if (!input.ruleEnginePassed) return false;
  if (input.llmCatalystScore < 9) return false;
  if (input.llmConfidence < 0.7) return false;

  // ML 모델 도입 전에는 null 허용
  if (
    input.mlTarget1HitProbability !== null &&
    input.mlTarget1HitProbability < 0.65
  ) {
    return false;
  }

  if (
    input.mlStopFirstProbability !== null &&
    input.mlStopFirstProbability > 0.35
  ) {
    return false;
  }

  return true;
}
```

---

## 10. 주문 상태 머신

```text
CREATED
  ↓
VALIDATED
  ↓
ENTRY_PENDING
  ├─ EXPIRED
  ├─ CANCELLED
  └─ ENTRY_FILLED
          ↓
      POSITION_OPEN
          ├─ STOP_FILLED
          ├─ TARGET1_FILLED
          │       ↓
          │   PARTIAL_OPEN
          │       ├─ BREAKEVEN_STOP
          │       └─ TARGET2_FILLED
          └─ MANUAL_EXIT
```

필수 규칙:

- 주문 생성과 동시에 손절 주문 준비
- 지정 시간 내 미체결 시 취소
- 1차 목표 체결 후 잔여 수량 손절가 조정
- 모든 상태 변경을 감사 로그에 기록
- 서버 재시작 후 상태 복구 가능해야 함

---

## 11. DB 핵심 테이블

```text
strategy_versions
signals
signal_features
llm_analyses
orders
fills
positions
trades
trade_metrics
evaluation_runs
strategy_proposals
model_versions
model_predictions
risk_events
```

### trades

```sql
create table trades (
  id uuid primary key default gen_random_uuid(),
  strategy_version_id uuid not null,
  symbol text not null,
  strategy_type text not null,

  signal_at timestamptz not null,
  entry_at timestamptz,
  exit_at timestamptz,

  planned_entry_min numeric,
  planned_entry_max numeric,
  actual_entry_price numeric,
  actual_exit_price numeric,

  stop_loss numeric,
  target_1 numeric,
  target_2 numeric,

  pnl_amount numeric,
  pnl_percent numeric,
  mfe_percent numeric,
  mae_percent numeric,
  slippage_percent numeric,

  exit_reason text,
  created_at timestamptz not null default now()
);
```

---

## 12. 전략 학습 방식

“학습”은 세 단계로 나눈다.

### 단계 1: 규칙/가중치 개선

초기 전략은 사람이 정의한다.

```ts
export const strategyV1 = {
  minCatalystScore: 9,
  minRelativeVolume: 5,
  maxSpreadPercent: 2,
  maxPremarketGapPercent: 80,
  maxRiskPerTradePercent: 0.5,
};
```

Evaluator가 거래 결과를 분석해 변경안을 생성한다.

```json
{
  "proposal": {
    "minRelativeVolume": 8,
    "maxPremarketGapPercent": 60
  },
  "reason": "최근 120건에서 RVOL 8 미만 그룹의 기대값이 음수",
  "sampleSize": 120,
  "confidence": 0.87
}
```

변경안은 즉시 적용하지 않는다.

### 단계 2: 소형 ML 모델

최소 수백 건 이상의 거래가 쌓인 뒤 추가한다.

입력:

- marketCap
- floatShares
- relativeVolume
- shortInterestPercent
- premarketGapPercent
- catalystType
- entryTime
- marketRegime
- spreadPercent
- vwapDistancePercent

출력:

- 1차 목표가 선도달 확률
- 손절가 선도달 확률
- 예상 최대 상승폭
- 예상 최대 하락폭

권장 모델:

- LightGBM
- XGBoost
- CatBoost
- Logistic Regression baseline

### 단계 3: LLM 파인튜닝

선택 사항이며 초기에는 하지 않는다.

목적:

- 출력 형식 안정화
- 이벤트 분류 일관성 향상
- 도메인 표현 방식 개선

수익률 예측 모델로 사용하지 않는다.

---

## 13. 전략 승격 절차

```text
현재 전략 v1
  ↓
Evaluator가 v2 제안
  ↓
과거 데이터 백테스트
  ↓
워크포워드 검증
  ↓
페이퍼 트레이딩
  ↓
Shadow Mode
  ↓
소액 실거래
  ↓
성과 기준 충족 시 승격
```

승격 조건 예시:

- 최소 거래 수 충족
- 기대값 개선
- 최대 낙폭 악화 없음
- 샤프 또는 소르티노 개선
- 특정 한두 종목에 성과 편중 없음
- 수수료·슬리피지 반영 후 우수

---

## 14. ChatGPT 모니터링의 위치

ChatGPT 예약 모니터링은 핵심 실행 파이프라인에서 제외한다.

활용 방식:

- 외부 봇이 놓친 후보 발견
- 사람에게 별도 리서치 제공
- 외부 봇 점수와 비교
- 누락된 이벤트 패턴 수집
- 전략 개선 아이디어 제공

주문 트리거로는 사용하지 않는다.

---

## 15. 구현 로드맵

### Phase 1 — MVP

- Monorepo 구성
- Supabase 스키마
- MockMarketDataProvider
- MockNewsProvider
- OpenAI Structured Output 연동
- 규칙 기반 Signal Engine
- PaperBroker
- 거래 결과 저장
- Next.js 대시보드

완료 기준:

```text
수집 → 분석 → 신호 → 페이퍼 주문 → 종료 → 결과 저장
```

전체 흐름이 자동 실행된다.

### Phase 2 — 실시간 포지션 관리

- 실시간 시세 WebSocket
- 주문 상태 머신
- 손절·1차·2차 목표 자동 관리
- 서버 재시작 복구
- Kill Switch
- 알림 시스템

### Phase 3 — Evaluator

- MFE/MAE 분석
- 전략별 기대값
- 실패 패턴 집계
- 전략 변경안 생성
- 백테스트 비교

### Phase 4 — ML 모델

- Python 학습 파이프라인
- LightGBM baseline
- 모델 버전 관리
- 예측 API
- Shadow Mode 검증

### Phase 5 — Live Broker

- 실제 증권사 Adapter
- 최소 금액 실거래
- 계좌 위험 한도
- 운영 대시보드
- 장애 대응 절차

---

## 16. 권장 폴더 구조

```text
apps/
  web/
  api/
  worker/
  ml-service/

packages/
  ai/
    schemas/
    prompts/
    analyzers/

  strategy/
    core/
    momentum/
    dopamine/
    evaluator/

  risk/
  execution/
  market-data/
  news/
  broker/
  db/
  observability/
  shared/
```

---

## 17. Codex 초기 구현 프롬프트

```text
아래 요구사항으로 TypeScript 기반 pnpm monorepo를 생성해줘.

목표:
OpenAI API, 규칙 엔진, Supabase, PaperBroker를 사용해 미국 주식 이벤트 자동매매 MVP를 구현한다. 자체 LLM 학습은 하지 않는다.

구성:
- apps/web: Next.js App Router, Chakra UI, TanStack Query
- apps/api: Fastify
- apps/worker: BullMQ worker
- apps/ml-service: 초기에는 placeholder만 생성
- packages/ai: OpenAI Structured Outputs와 Zod schema
- packages/strategy: core, momentum, dopamine 전략
- packages/risk: 결정론적 리스크 엔진
- packages/execution: 주문 상태 머신과 PaperBroker
- packages/db: Supabase repository
- packages/shared: 공통 타입

필수 구현:
1. CatalystAnalysisSchema
2. SignalFeatures 타입
3. Dopamine 전략 기본 조건
4. RiskEngine
5. PaperBrokerProvider
6. 주문 상태 머신
7. trades, signals, signal_features, strategy_versions SQL migration
8. 샘플 시장 데이터를 이용한 end-to-end 페이퍼 거래
9. Vitest 테스트
10. README와 환경변수 예제

중요 원칙:
- 모든 코드는 TypeScript strict mode
- LLM 응답은 구조화된 JSON만 허용
- 리스크 엔진은 LLM과 분리
- 실제 증권 주문은 구현하지 않음
- 전략 변경은 버전 관리
- 거래 결과는 반드시 DB에 저장
```

---

## 18. 첫 번째 완료 목표

첫 번째 버전에서는 다음 한 흐름만 완성한다.

```text
가짜 뉴스 이벤트 입력
→ 정량 특징 생성
→ OpenAI API 이벤트 분석
→ 규칙 엔진 검증
→ PaperBroker 가상 진입
→ 손절 또는 목표가 체결 시뮬레이션
→ 거래 결과 저장
→ 대시보드 표시
```

이 흐름이 안정화된 뒤 실제 시장 데이터와 증권사 API를 붙인다.
