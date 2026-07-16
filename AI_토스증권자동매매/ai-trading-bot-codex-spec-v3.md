# AI 자동매매 시스템 구현 명세서 v3

> 목적: 과거 차트와 거래 통계만을 따라가는 자동매매 봇이 아니라,  
> 미래가치를 바꾸는 정보에 대한 투자 가설을 만들고, 정량 데이터로 진입과 리스크를 검증하며, 거래 결과에서 가설의 질과 실행의 질을 분리해 학습하는 시스템을 구현한다.

---

## 1. 핵심 철학

이 시스템은 과거 데이터를 이용해 미래를 예언하지 않는다.

과거 데이터는 다음을 위해 사용한다.

- 현재 투자 가설의 성공 가능성 추정
- 진입 가격과 손절 폭 검증
- 시장 체제별 전략 성과 비교
- 거래 비용과 슬리피지 반영
- 계좌가 파산하지 않도록 위험 제한
- 실패한 가설과 실패한 실행을 구분

핵심 원칙은 다음과 같다.

```text
미래가치 가설
→ 가격 반영 정도 평가
→ 통계적으로 유리한 진입 구조 확인
→ 리스크 엔진 검증
→ 주문 실행
→ 가설과 실행을 분리 평가
→ 검증된 전략만 승격
```

이 시스템의 목표는 모든 거래에서 수익을 내는 것이 아니다.

```text
좋은 가설에는 크게 참여하고
틀린 가설에서는 작게 잃고
우연한 수익을 실력으로 착각하지 않는다
```

---

## 2. 하지 않는 것

다음 방식은 사용하지 않는다.

- 차트 패턴만으로 매매 판단
- 거래량 증가만으로 자동 진입
- 손익 결과만으로 전략 평가
- 손실 한 번 발생 후 즉시 전략 수정
- LLM이 직접 포지션 크기 결정
- LLM이 자기 코드를 자동 변경
- 실거래 중 전략 파라미터 자동 변경
- 자체 LLM을 처음부터 학습
- ChatGPT 예약 모니터링을 주문 트리거로 사용
- 무제한 레버리지
- 물타기를 기본 전략으로 사용
- 손절 없는 포지션 운용

---

## 3. 전체 아키텍처

```text
┌──────────────────────────────────────────┐
│ Market / News / Filing Data Providers    │
│ 시세, 뉴스, SEC, 실적, 옵션, 공매도       │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Collector Workers                        │
│ 수집, 정규화, 중복 제거, 시점 저장         │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Market Regime Engine                     │
│ 시장 상태 분류                           │
│ risk_on / neutral / risk_off / panic     │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Thesis Engine                            │
│ 미래가치를 바꾸는 사건 해석               │
│ 매출, 현금흐름, 시장규모, 희석, 규제        │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Price Reflection Engine                  │
│ 호재가 가격에 얼마나 반영됐는지 평가       │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Quant Entry Engine                       │
│ 진입 구조, 변동성, 거래량, VWAP, Float    │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ ML Probability Model                     │
│ 목표가/손절가 선도달 확률 추정             │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Deterministic Risk Engine                │
│ 비중, 손절, 일간손실, 스프레드, 유동성     │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Execution Engine                         │
│ Paper Broker → Live Broker               │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Trade Journal                            │
│ 신호, 주문, 체결, 시장상태, 가설 저장       │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Evaluator                                │
│ 수익/손실과 별도로 가설·실행 품질 평가      │
└───────────────────┬──────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ Strategy Proposal Engine                 │
│ 변경안 생성 → 백테스트 → 페이퍼 → 승격     │
└──────────────────────────────────────────┘
```

---

## 4. 핵심 엔진 구성

### 4.1 Market Regime Engine

시장 상태를 먼저 판단한다.

예시 상태:

```ts
export type MarketRegime =
  | 'risk_on'
  | 'neutral'
  | 'risk_off'
  | 'panic'
  | 'event_driven'
  | 'low_liquidity';
```

사용 데이터:

- Nasdaq / S&P 500 추세
- VIX
- 국채금리
- 달러
- 시장 폭
- 업종 상대강도
- 상승/하락 종목 비율
- 거래대금
- 갭 상승 종목 유지율
- 프리마켓 급등 후 종가 유지율

목적:

- 동일 전략이 시장마다 다르게 작동하는 문제 해결
- 현재 시장에서 사용 가능한 전략만 활성화
- 전략별 최대 비중 조정
- 위험한 장에서는 거래 횟수 자동 축소

---

### 4.2 Thesis Engine

Thesis Engine은 가격이 아니라 미래가치를 평가한다.

주식에서 평가할 내용:

- 신규 계약이 매출에 미치는 영향
- 실적과 가이던스 변화
- 수주잔고 증가
- 시장 규모 확대
- 경쟁력 변화
- 규제 영향
- 경영진 자본배분
- 주식 희석 가능성
- 부채 및 현금흐름
- 고객 집중도
- 계약의 구속력

코인에서 평가할 내용:

- 실제 사용자와 거래량
- 프로토콜 수수료
- 토큰 언락 일정
- 재단과 내부자 보유량
- 개발자 활동
- 스테이블코인 유동성
- 규제 변화
- 거래소 상장폐지
- 토큰 공급 증가율

출력 예시:

```ts
export type InvestmentThesis = {
  symbol: string;
  thesisType:
    | 'revenue_growth'
    | 'margin_expansion'
    | 'market_expansion'
    | 'regulatory_catalyst'
    | 'capital_structure'
    | 'short_squeeze'
    | 'liquidity_event'
    | 'other';

  thesisScore: number;
  confidence: number;

  futureValueDrivers: string[];
  expectedImpactWindow: 'intraday' | 'days' | 'weeks' | 'months' | 'years';

  assumptions: string[];
  invalidationConditions: string[];
  dilutionRisks: string[];
  hiddenRisks: string[];

  estimatedMateriality: {
    revenueImpactPercent: number | null;
    earningsImpactPercent: number | null;
    marketCapImpactPercent: number | null;
  };
};
```

---

### 4.3 Price Reflection Engine

좋은 뉴스라도 이미 가격에 모두 반영됐으면 진입하지 않는다.

평가 항목:

- 뉴스 발표 전후 상승률
- 프리마켓 갭
- 장중 고점 대비 현재 위치
- 과거 유사 이벤트 평균 반응
- 현재 밸류에이션
- 거래량 유지 여부
- 뉴스 발표 후 매물 출회
- 기관/내부자/전환사채 물량
- 예상 가치 변화 대비 주가 변화

출력 예시:

```ts
export type PriceReflectionAssessment = {
  symbol: string;

  reflectionLevel: 'underpriced' | 'fair' | 'overpriced' | 'unknown';
  reflectedPercent: number | null;

  entryAllowed: boolean;
  reason: string[];

  chaseRisk: number;
  dilutionPressure: number;
  liquidityRisk: number;
};
```

---

### 4.4 Quant Entry Engine

정량 데이터는 매수 이유가 아니라 진입 구조 검증에 사용한다.

입력:

- Relative Volume
- VWAP
- ATR
- 스프레드
- 호가 깊이
- 프리마켓 갭
- Float
- 공매도
- 장중 고가/저가
- 거래정지 이력
- 1분/5분 거래량
- 업종 상대강도

출력:

```ts
export type EntryPlan = {
  symbol: string;

  entryType:
    | 'limit_pullback'
    | 'breakout'
    | 'vwap_reclaim'
    | 'opening_range'
    | 'no_entry';

  entryMin: number | null;
  entryMax: number | null;

  stopLoss: number | null;
  target1: number | null;
  target2: number | null;

  timeStopMinutes: number | null;
  maxHoldingMinutes: number | null;

  invalidationPrice: number | null;
  expiresAt: string;

  riskRewardTarget1: number | null;
  riskRewardTarget2: number | null;
};
```

---

## 5. 손절 구조

손절은 세 가지로 분리한다.

### 5.1 가격 손절

초단기 이벤트 매매에 사용한다.

```text
진입 구조가 깨졌을 때
VWAP 이탈
장중 저점 이탈
거래량 동반 지지선 이탈
```

### 5.2 시간 손절

예상한 모멘텀이 나오지 않으면 종료한다.

예:

```text
뉴스 발표 후 90분 안에 거래량 재확대가 없으면 청산
진입 후 30분 안에 목표 방향으로 움직이지 않으면 비중 축소
```

### 5.3 가설 손절

미래가치 가설이 무너지면 가격과 상관없이 종료한다.

예:

- 계약이 비구속적
- 계약 규모가 예상보다 작음
- 임상 데이터 해석 오류
- 대규모 희석 발표
- 가이던스 하향
- 고객 이탈
- 규제 리스크 증가
- 유동성 부족
- 상장폐지 위험 확대

---

## 6. 거래 평가 모델

거래 결과를 단순히 익절/손절로만 평가하지 않는다.

```ts
export type TradeEvaluation = {
  tradeId: string;

  profitable: boolean;

  thesisCorrect: boolean;
  executionCorrect: boolean;
  riskControlCorrect: boolean;

  outcomeType:
    | 'good_thesis_good_execution'
    | 'good_thesis_bad_execution'
    | 'bad_thesis_good_execution'
    | 'bad_thesis_lucky_profit'
    | 'good_process_bad_outcome'
    | 'bad_process_good_outcome';

  thesisScoreBefore: number;
  thesisScoreAfter: number;

  executionIssues: string[];
  thesisIssues: string[];
  riskIssues: string[];

  lessons: string[];
};
```

### 평가 예시

#### 좋은 가설 + 나쁜 실행 + 손실

```text
계약의 미래 매출 기여는 맞았음
하지만 진입이 너무 빨랐음
손절 폭이 변동성보다 좁았음
```

학습 결과:

```text
가설 점수는 유지
진입 규칙과 손절 규칙만 수정
```

#### 나쁜 가설 + 우연한 수익

```text
홍보성 뉴스였음
사업 실체가 약했음
하지만 시장 광기로 급등
```

학습 결과:

```text
성공 전략으로 강화하지 않음
가설 점수는 하향
실행 수익은 운으로 분류
```

---

## 7. 전략 학습 방식

### 7.1 규칙 기반 학습

초기에는 전략 파라미터를 사람이 정의한다.

```ts
export const strategyV1 = {
  minThesisScore: 8.5,
  minCatalystScore: 9,
  minRelativeVolume: 5,
  maxSpreadPercent: 2,
  maxPremarketGapPercent: 80,
  maxRiskPerTradePercent: 0.25,
  maxDailyLossPercent: 1,
};
```

Evaluator는 거래 결과를 분석해 변경안을 만든다.

```json
{
  "proposal": {
    "maxPremarketGapPercent": 60,
    "minRelativeVolume": 8,
    "maxRiskPerTradePercent": 0.2
  },
  "reason": [
    "갭 60% 초과 구간의 기대값이 음수",
    "RVOL 8 미만 그룹의 목표가 도달률이 낮음",
    "변동성 확대 장에서 손절 슬리피지 증가"
  ],
  "sampleSize": 240,
  "confidence": 0.88
}
```

변경안은 즉시 실거래에 반영하지 않는다.

---

### 7.2 ML 기반 학습

거래 데이터가 최소 수백 건 이상 쌓인 후 도입한다.

권장 모델:

- Logistic Regression
- LightGBM
- XGBoost
- CatBoost

입력:

```text
시장 상태
시가총액
Float
Relative Volume
공매도 비율
프리마켓 갭
스프레드
VWAP 거리
이벤트 유형
가설 점수
희석 위험
진입 시각
업종 상대강도
```

출력:

```text
1차 목표가 선도달 확률
2차 목표가 선도달 확률
손절가 선도달 확률
기대 최대 상승폭
기대 최대 하락폭
예상 보유 시간
```

---

### 7.3 전략 승격

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

승격 조건:

- 최소 거래 수 충족
- 기대값 개선
- 최대 낙폭 악화 없음
- 특정 시장 구간에만 편중되지 않음
- 특정 종목에 성과 편중 없음
- 수수료와 슬리피지 반영 후 우수
- 가설 정확도 개선
- 실행 품질 개선
- 위험 통제 위반 없음

---

## 8. 리스크 엔진

리스크 엔진은 LLM과 완전히 분리한다.

필수 제한:

```ts
export const riskPolicy = {
  maxRiskPerTradePercent: 0.25,
  maxDailyLossPercent: 1,
  maxWeeklyLossPercent: 3,

  maxOpenPositions: 3,
  maxStrategyExposurePercent: 10,

  minDollarVolume: 5_000_000,
  maxSpreadPercent: 2,

  maxConsecutiveLosses: 3,
  cooldownMinutesAfterLoss: 60,

  leverageAllowed: false,
};
```

Kill Switch 조건:

- 일간 손실 한도 초과
- 연속 손실 초과
- 주문 체결 오류
- 시세 데이터 지연
- 브로커 API 불일치
- DB 기록 실패
- 비정상 슬리피지
- 시장 급변
- 거래정지 종목
- 상장폐지 경고
- 유동성 급감

---

## 9. 데이터 저장

핵심 테이블:

```text
market_regimes
theses
thesis_assumptions
price_reflections
signals
signal_features
entry_plans
orders
fills
positions
trades
trade_metrics
trade_evaluations
strategy_versions
strategy_proposals
backtest_runs
paper_runs
model_versions
model_predictions
risk_events
```

### 거래 시 반드시 저장할 데이터

```text
신호 생성 시점
뉴스 원문
공시 원문
가설
가설 점수
가정
무효화 조건
시장 상태
가격 반영 정도
진입 근거
손절 근거
목표가 근거
실제 체결가
슬리피지
MFE
MAE
보유 시간
종료 이유
가설 정확도
실행 정확도
리스크 준수 여부
```

---

## 10. 권장 기술 스택

### Monorepo

- pnpm workspace
- Turborepo

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
- Railway / Fly.io / AWS ECS

### Database

- Supabase PostgreSQL
- Supabase Auth
- Row Level Security

### AI

- OpenAI Responses API
- Structured Outputs
- Zod
- Embedding은 유사 뉴스 검색에만 선택적으로 사용

### ML

- Python
- LightGBM
- XGBoost
- scikit-learn
- Pandas
- MLflow 선택

### Observability

- Sentry
- OpenTelemetry
- Pino
- 주문 감사 로그
- 전략 버전 로그

---

## 11. 권장 폴더 구조

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
    thesis/
    evaluator/

  market-regime/
  thesis/
  price-reflection/
  strategy/
    core/
    momentum/
    dopamine/

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

## 12. MVP 구현 범위

첫 번째 버전에서는 다음만 구현한다.

```text
샘플 뉴스 입력
→ Thesis Engine으로 미래가치 가설 생성
→ 가격 반영 정도 평가
→ Quant Entry Engine으로 진입 구간 생성
→ Risk Engine 검증
→ PaperBroker 주문
→ 결과 저장
→ Trade Evaluator 평가
```

완료 기준:

- 모든 단계가 자동 실행
- 모든 입력과 출력이 DB에 저장
- 거래 종료 후 가설과 실행이 분리 평가
- 전략 버전이 기록
- 실제 주문은 없음

---

## 13. 단계별 로드맵

### Phase 1 — Thesis 기반 Paper Trading

- 데이터 모델
- Thesis Engine
- Price Reflection Engine
- Entry Plan
- Risk Engine
- PaperBroker
- Trade Journal
- Evaluator

### Phase 2 — 실시간 데이터

- WebSocket 시세
- SEC 공시
- 뉴스 수집
- 옵션/공매도
- 주문 상태 머신
- 서버 재시작 복구

### Phase 3 — 전략 평가

- MFE/MAE
- 가설 정확도
- 실행 정확도
- 시장 상태별 성과
- 전략 변경안 생성
- 백테스트

### Phase 4 — ML 모델

- LightGBM baseline
- 목표가 선도달 확률
- 손절가 선도달 확률
- 모델 버전 관리
- Shadow Mode

### Phase 5 — 소액 실거래

- 실제 Broker Adapter
- 거래당 위험 0.1~0.25%
- 일간 손실 제한
- 수동 Kill Switch
- 실거래/페이퍼 병행

---

## 14. Codex 초기 구현 프롬프트

```text
TypeScript 기반 pnpm monorepo로 AI 자동매매 MVP를 구현해줘.

목표:
과거 차트 패턴만으로 거래하지 않고, 미래가치를 바꾸는 뉴스와 공시를 투자 가설로 구조화한 뒤 정량 진입 검증과 결정론적 리스크 엔진을 거쳐 페이퍼 트레이딩을 수행한다.

핵심 원칙:
- 자체 LLM을 만들지 않는다.
- OpenAI API는 가설 생성과 비정형 정보 해석에만 사용한다.
- 주문 수량과 리스크 한도는 코드 기반 Risk Engine이 결정한다.
- 거래 결과는 수익 여부와 별개로 가설 정확도와 실행 정확도를 분리 평가한다.
- 전략 변경은 즉시 적용하지 않고 버전 관리한다.
- 실제 증권 주문은 구현하지 않는다.

구성:
- apps/web: Next.js App Router, Chakra UI, TanStack Query
- apps/api: Fastify
- apps/worker: BullMQ
- apps/ml-service: placeholder
- packages/ai: OpenAI Structured Outputs
- packages/market-regime
- packages/thesis
- packages/price-reflection
- packages/strategy
- packages/risk
- packages/execution
- packages/db
- packages/shared

필수 구현:
1. MarketRegime 타입
2. InvestmentThesis 타입과 Zod schema
3. PriceReflectionAssessment
4. EntryPlan
5. TradeEvaluation
6. RiskEngine
7. PaperBroker
8. 주문 상태 머신
9. Supabase migration
10. 샘플 뉴스 기반 end-to-end 거래
11. Vitest 테스트
12. README
13. 환경변수 예제

거래 평가 규칙:
- profitable
- thesisCorrect
- executionCorrect
- riskControlCorrect
- outcomeType

MVP 흐름:
샘플 뉴스
→ 가설 생성
→ 가격 반영 평가
→ 진입 계획
→ 리스크 검증
→ 페이퍼 주문
→ 거래 종료
→ 가설/실행 분리 평가
→ DB 저장
```

---

## 15. 최종 방향

이 시스템은 차트 패턴을 학습하는 봇이 아니다.

```text
미래를 바꾸는 정보 해석
+
통계적 진입 검증
+
엄격한 리스크 관리
+
가설과 실행을 분리한 학습
```

이 네 요소를 결합한 투자 운영 시스템이다.

자동학습의 목표는 수익률만 높이는 것이 아니다.

```text
잘못된 가설을 줄이고
좋은 가설을 더 잘 실행하며
시장 상태가 바뀌었을 때 거래를 줄이고
계좌가 생존하도록 만드는 것
```
