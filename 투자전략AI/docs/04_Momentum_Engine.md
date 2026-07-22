# 04. Momentum Engine Specification

> 제한된 위험 예산 안에서 반복 가능한 가격·거래량·상대강도·촉매 Setup을 탐지하고, 진입 전 무효화·청산 계획까지 생성하는 실행 명세

- 문서 버전: `v1.0.0-draft`
- 작성일: `2026-07-22`
- 상태: `IMPLEMENTATION-READY DRAFT`
- 선행 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1, `03_LongTerm_Engine.md` v1.0.0-draft
- 후속 문서: `05_Portfolio_Engine.md`, `08_Database.md`, `09_Scoring_System.md`
- 구현 기준 경로: `packages/core`, `apps/api`, `supabase/migrations`

---

## 0. 문서의 역할

이 문서는 Momentum 투자 철학을 반복 설명하지 않는다. `01_Architecture.md`의 Engine 경계와 `02-3_Momentum_and_Tactical_Investing.md`의 정책을 코드·데이터·API·Job·테스트로 구현할 수 있도록 고정하는 **Momentum 도메인 계약**이다.

이 문서가 답해야 하는 질문은 다음과 같다.

1. 어떤 종목이 거래 가능한 Universe에 포함되는가?
2. Market Regime과 종목 Setup Score는 어떻게 분리되는가?
3. Relative Strength, Sector, Volume, Catalyst, Liquidity와 Risk/Reward를 어떻게 평가하는가?
4. Breakout·Pullback·Earnings Momentum 등 Setup은 어떤 증거로 유효해지는가?
5. Entry Zone, Chase Limit, Initial Stop, Target, Time Stop은 어떻게 생성·검증되는가?
6. 결측·오래된 데이터·Corporate Action·장전 정보는 어떻게 처리하는가?
7. Event/Gap Risk와 Crisis에서 어떤 행동을 차단하는가?
8. Momentum 신호가 Long-term Lot과 전략을 오염시키지 않는가?
9. 탐지부터 종료·리뷰까지 상태 전이가 재현 가능한가?
10. Historical Replay에서 Look-ahead, Survivorship, 비용 누락을 어떻게 막는가?

### 0.1 규범 우선순위

충돌 시 다음 순서로 해석한다.

1. 법적·보안·Hard Safety·사용자 승인 불변식
2. `01_Architecture.md`의 Engine 분리, Point-in-time, Decimal, Audit, Fail-closed 원칙
3. `02_Investment_Philosophy.md`의 Momentum·Portfolio·Risk 철학
4. 이 문서의 Momentum 세부 계약
5. `09_Scoring_System.md`의 공통 정규화·캘리브레이션 계약
6. 구현 코드와 운영 설정

하위 설정으로 상위 안전 정책을 완화할 수 없다. 충돌은 `POLICY_CONFLICT`로 차단하고 모델 버전 변경 절차를 시작한다.

### 0.2 04와 09의 책임 분리

이 문서는 다음을 소유한다.

- Momentum v1 Factor와 가중치
- Universe·Regime·Liquidity·Event Gate
- Setup Taxonomy와 Setup별 Eligibility
- Entry·Stop·Target·Time Stop 계약
- Signal Lifecycle과 Action 정책
- Catalyst Half-life와 데이터 신선도
- Momentum API·Event·저장·테스트 계약

`09_Scoring_System.md`는 다음을 소유한다.

- Indicator의 시장·산업 내 Percentile 정규화
- Outlier, Winsorization, Z-score, Missing 통계 정책
- 여러 시장 Regime에 걸친 Calibration
- Champion/Challenger와 Drift 통계
- Cross-engine 설명 가능성 공통 형식

09가 없어도 이 문서의 v1 절대 기준과 버전된 정규화 입력으로 구현할 수 있다. 이후 정규화 개선은 새 Model Version으로만 활성화한다.

---

## 1. 목표와 비목표

### 1.1 목표

Momentum Engine의 목표는 다음 문장을 구조화된 결과로 만드는 것이다.

> 거래 가능한 유동성을 가진 종목에서 시장·섹터·가격·거래량·촉매가 정렬된 반복 가능한 Setup을 찾고, 기대값이 남아 있는 가격에서만 진입 후보를 만들며, 진입 전에 실패 조건과 최대 보유 기간을 고정한다.

구체적인 목표:

- 거래 가능한 Universe를 Point-in-time으로 구성한다.
- Market Regime이 신규 Long 위험을 허용하는지 판정한다.
- Setup별 Factor와 Gate를 분리 평가한다.
- Entry Zone과 Chase Limit을 통해 FOMO 진입을 차단한다.
- Stop·Target/Trailing·Time Stop을 진입 전에 요구한다.
- Catalyst의 공식 출처, 시각, 시장 반영 정도를 추적한다.
- Score와 Confidence, 실행 가능성, Event Risk를 분리한다.
- 동일 입력·모델 버전의 결과를 재현한다.
- 종료 후 R-Multiple·MAE·MFE·규칙 준수로 학습할 수 있게 한다.

### 1.2 비목표

Momentum Engine은 다음을 직접 결정하거나 실행하지 않는다.

- 실제 주문 수량과 최종 Position Size
- Portfolio Bucket 또는 단일 종목 한도 변경
- 사용자 승인 대체
- 주문 전송·정정·취소
- Long-term Thesis·Core/Future Core 상태 변경
- 손절된 Momentum Lot의 Long-term 전환
- 초단타·고빈도·Market Making
- 옵션 가격·Greeks 기반 전략 실행
- Short 전략과 무제한 손실 전략

Momentum Engine은 주당 위험, 유동성 용량, Regime Multiplier와 Setup 품질을 출력한다. 실제 금액은 Portfolio → Risk → Human Approval에서 계산한다.

### 1.3 MVP 범위

포함:

- 현물 Long
- Swing: 2~20 거래일
- Position Momentum: 10~90 거래일
- Breakout, Pullback, Earnings Momentum, Gap Continuation, Sector Rotation
- 제한적 Special Situation 분석
- 일봉 중심, 필요 시 5·15·60분 확인 Bar
- 수동 또는 예약 분석과 Paper 실행 준비

제외:

- Intraday Scalping
- HFT
- Short Selling
- Leveraged ETF의 장기 보유
- Naked Option
- 자동 Binary Event 베팅
- 24시간 Crypto 파생상품

### 1.4 성공 지표

| 영역 | 지표 |
|---|---|
| 재현성 | 같은 Snapshot·Model Version의 결과 Hash 일치율 100% |
| 안전 | Stop 없는 `ENTER` 0건 |
| Chase | Chase Limit 초과 `ENTER` 0건 |
| 계보 | Signal·Plan·Evidence·Snapshot·Model 연결률 100% |
| 전략 분리 | Momentum 손실 후 Long-term 자동 전환 0건 |
| 운영 | 만료 Signal·Plan의 승인·실행 0건 |
| 리스크 | Crisis 신규 Long, Critical Liquidity 실패 진입 0건 |
| 리뷰 | 종료 거래의 Process/Outcome Review 생성률 100% |

수익률·승률만으로 Engine 품질을 평가하지 않는다. 거래비용 후 Expectancy, Tail Loss, 규칙 준수와 함께 본다.

---

## 2. 핵심 설계 결정

### 2.1 Setup 품질과 거래 허용도를 분리한다

Momentum Score에 다음을 넣지 않는다.

- Market Regime Multiplier
- Momentum Bucket 잔여 금액
- 현재 Open Risk
- Portfolio Drawdown
- 동일 섹터 보유량
- 사용자 감정 상태
- 실제 주문 금액

이 값들은 Setup 자체의 품질이 아니라 거래 허용·배분 제약이다.

```text
Setup Attractiveness
  ≠ Market Permission
  ≠ Portfolio Capacity
  ≠ Risk Approval
  ≠ Order Execution
```

Regime이 `CRISIS`여도 강한 상대강도 Setup은 분석 결과로 남을 수 있지만 Action은 `AVOID` 또는 `REVIEW_REQUIRED`이며 신규 위험을 만들 수 없다.

### 2.2 Momentum과 Long-term은 Score·상태·Lot을 공유하지 않는다

- Long-term Score를 Momentum Factor로 사용하지 않는다.
- Momentum Stop으로 Core Lot을 청산하지 않는다.
- Momentum Setup 무효화를 Long-term Thesis Break로 바꾸지 않는다.
- 손절된 Momentum Lot에 Thesis를 사후 부착하지 않는다.
- Dual High여도 Position Lot, Entry/Exit Policy, 성과 Attribution을 분리한다.

Cross Signal은 이미 완료된 두 Evaluation ID를 해석할 뿐 원본 점수를 합성하지 않는다.

### 2.3 Gate가 Score보다 우선한다

다음은 고득점이어도 진입을 차단한다.

- 거래정지·상장폐지·Corporate Action 미반영
- 최소 유동성·Spread·Price Gate 실패
- Market Data Stale 또는 Session 불일치
- Entry·Stop·Target/Trailing·Time Stop 누락
- Chase Limit 초과
- 최소 Reward/Risk 미달
- Critical Binary Event 무계획 보유
- Catalyst 출처·발생시각 불명확
- Crisis 또는 Hard Risk
- Signal/Plan 만료

### 2.4 위험 점수 방향을 명시한다

- `executionRisk`: 높을수록 위험
- `gapRisk`: 높을수록 위험
- `setupResilienceScore`: 높을수록 Setup이 실패 위험에 강함

호환 출력의 `riskScore`에는 반드시 `riskScoreDirection: 'HIGHER_IS_RISKIER'`를 포함한다. 총점에는 위험 자체가 아니라 실행·구조의 품질을 사용한다.

### 2.5 Missing은 중립값이 아니다

```ts
type MomentumMetricAvailability =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN'
  | 'STALE'
  | 'CONFLICTED';
```

- Critical Metric `UNKNOWN/STALE/CONFLICTED`: Signal 차단
- `NOT_APPLICABLE`: Setup Profile이 사전 허용할 때만 가중치 재정규화
- `PARTIAL`: 사용 범위 설명과 Confidence Cap
- 결측을 0·50·최근 값으로 자동 대체 금지

### 2.6 탐지와 계획을 분리한다

```text
Candidate Detection
  → Setup Validation
  → Trade Plan Generation
  → Portfolio Proposal
  → Risk Decision
  → Human Approval
  → Execution
```

`DETECTED`는 거래 추천이 아니다. Trade Plan이 없으면 `ENTER`를 생성할 수 없다.

### 2.7 가격은 거래소 세션과 Corporate Action을 인식한다

- Indicator 계산은 조정 가격을 사용할 수 있다.
- 실제 Entry/Stop/Target은 비조정 거래 가격을 사용한다.
- Split·배당·Spin-off 적용 시 원본과 조정 계수를 보존한다.
- Bar는 거래소 시간대·세션·완료 여부를 가진다.
- 미완료 Bar로 종가 기준 Signal을 확정하지 않는다.

---

## 3. 용어와 불변식

### 3.1 용어

| 용어 | 정의 |
|---|---|
| Universe | 해당 시점에 거래 가능 조건을 통과한 증권 집합 |
| Candidate | Scanner가 발견했지만 Setup 검증 전인 종목 |
| Setup | 사전에 정의된 가격·거래량·촉매 패턴 |
| Signal | 특정 Setup이 검증된 불변 평가 결과 |
| Trade Plan | Entry·Stop·Exit·Time Stop·Invalidation 계약 |
| Trigger | Entry Zone 안에서 실행 검토를 시작시키는 관찰 조건 |
| Chase Limit | 초과 시 좋은 Setup도 진입하지 않는 최대 가격 |
| Initial Risk | 기준 Entry와 Initial Stop 간 가격 위험 |
| 1R | 계획된 초기 손실 단위 |
| Open Risk | 모든 활성 Momentum Lot의 Stop 기준 잠재 손실 |
| Gap Risk | Stop을 건너뛰는 불연속 가격 변화 위험 |
| Catalyst Half-life | 촉매의 정보 가치가 감소하는 시간 규칙 |
| Invalidation | Setup 기대값이 소멸했다고 판정하는 조건 |
| Time Stop | 정해진 기간 내 진행이 없을 때 종료하는 조건 |

### 3.2 불변식

| ID | 불변식 |
|---|---|
| MOM-INV-001 | 모든 입력의 `availableAt <= evaluatedAt`이다. |
| MOM-INV-002 | 완료된 Signal·Plan·Review는 수정하지 않고 Revision을 추가한다. |
| MOM-INV-003 | 모든 완료 Signal은 Snapshot·Evidence·Model Version을 가진다. |
| MOM-INV-004 | `ENTER`는 Entry Zone·Chase·Stop·Target/Trailing·Time Stop을 모두 가진다. |
| MOM-INV-005 | Initial Stop은 Entry Zone 아래이고 Chase는 Entry Zone 상단 이상이다. |
| MOM-INV-006 | 진입 후 Stop 확대는 사전 예외와 Risk 재검증 없이 금지한다. |
| MOM-INV-007 | Chase Limit 초과 가격에서 `ENTER`를 허용하지 않는다. |
| MOM-INV-008 | Critical Liquidity·Regime·Event Gate 실패가 Score로 상쇄되지 않는다. |
| MOM-INV-009 | Momentum Lot은 `STOP_LOSS/TARGET/TIME_STOP` 정책만 사용한다. |
| MOM-INV-010 | Momentum Lot을 Core/Future Core로 자동 전환하지 않는다. |
| MOM-INV-011 | Momentum Engine은 주문 수량·실제 금액을 승인하지 않는다. |
| MOM-INV-012 | 금액·가격·수량은 Decimal String을 사용한다. |
| MOM-INV-013 | 만료된 Signal·Plan은 새 승인에 사용할 수 없다. |
| MOM-INV-014 | 모델 버전 변경은 과거 Signal과 Review를 덮어쓰지 않는다. |
| MOM-INV-015 | Historical Replay는 운영 상태·알림·주문을 변경하지 않는다. |
| MOM-INV-016 | 미완료 Bar의 종가를 확정 값으로 사용하지 않는다. |
| MOM-INV-017 | 거래비용과 Slippage를 제외한 Backtest Expectancy를 운영 근거로 사용하지 않는다. |

---

## 4. 시스템 경계와 구성요소

```text
Market / Reference / Event Providers
  ├─ Adjusted & Raw Bars
  ├─ Quotes / Spread / Depth
  ├─ Corporate Actions
  ├─ Market / Sector Benchmarks
  ├─ Earnings / Calendar
  └─ News / Filing Evidence
             │
             ▼
Point-in-time Snapshot & Evidence
             │
             ▼
Momentum Orchestrator
  ├─ Universe Scanner
  ├─ Market Regime Evaluator
  ├─ Sector Rotation Evaluator
  ├─ Relative Strength Evaluator
  ├─ Volume / Liquidity Evaluator
  ├─ Catalyst Evaluator
  ├─ Setup Detector & Validator
  ├─ Entry / Exit Planner
  ├─ Confidence / Gate Policy
  └─ Signal Lifecycle Policy
             │
             ▼
Immutable Signal + Plan + Outbox
             │
             ├─ Portfolio Engine
             ├─ Risk Engine
             ├─ Report / UI
             └─ Human Approval
```

### 4.1 목표 패키지 구조

```text
packages/core/src/momentum-v1/
├── types.ts
├── universe.ts
├── indicators.ts
├── regime.ts
├── factor-profile.ts
├── setup-registry.ts
├── setups/
│   ├── breakout.ts
│   ├── pullback.ts
│   ├── earnings-momentum.ts
│   ├── gap-continuation.ts
│   └── sector-rotation.ts
├── catalyst.ts
├── liquidity.ts
├── trade-plan.ts
├── gates.ts
├── confidence.ts
├── lifecycle.ts
├── review.ts
└── index.ts
```

초기 구현은 파일 수를 줄일 수 있지만 Public Contract와 모듈 책임은 유지한다.

### 4.2 의존성 규칙

허용:

```text
Momentum → shared Decimal / Evidence / Snapshot / Scoring primitives
Portfolio → Momentum public Evaluation / Plan
Risk → Momentum public Evaluation / Plan
Cross Signal → Long-term public result + Momentum public result
```

금지:

```text
Momentum → Long-term internals
Momentum → Portfolio internals
Momentum pure domain → Supabase / HTTP / Broker
Momentum → Order execution adapter
```

---

## 5. 실행 파이프라인

### 5.1 전체 흐름

```text
1. Trading Calendar & Session Resolved
2. Point-in-time Universe Snapshot Frozen
3. Corporate Actions Applied
4. Market Regime Evaluated
5. Universe Hard Filters Applied
6. Indicators Calculated
7. Setup Candidates Detected
8. Setup-specific Gates Evaluated
9. Momentum Factors Scored
10. Confidence & Data Quality Calculated
11. Catalyst / Event Risk Assessed
12. Trade Plan Generated & Validated
13. Action and Signal State Proposed
14. Signal + Plan + Audit + Outbox Stored
15. Ranking Read Model Updated
16. Portfolio / Risk Handoff
```

단계 1~13은 동일한 입력과 버전에서 결정론적이어야 한다.

### 5.2 실행 모드

```ts
type MomentumEvaluationMode =
  | 'UNIVERSE_SCAN'
  | 'SETUP_VALIDATION'
  | 'PLAN_REFRESH'
  | 'EVENT_REVIEW'
  | 'POSITION_REVIEW'
  | 'EXIT_REVIEW'
  | 'HISTORICAL_REPLAY';
```

| 모드 | 목적 | 운영 상태 영향 |
|---|---|---|
| UNIVERSE_SCAN | 대량 Candidate 탐지 | DETECTED까지만 |
| SETUP_VALIDATION | Setup과 Gate 검증 | VALIDATED/REJECTED |
| PLAN_REFRESH | 가격·Stop·Target·만료 갱신 | 새 Plan Revision |
| EVENT_REVIEW | 이벤트·Gap Risk 검토 | Invalidate/Review |
| POSITION_REVIEW | 활성 Lot의 추세·Stop 확인 | 관리 제안 |
| EXIT_REVIEW | 종료 사유와 성과 기록 | CLOSED/REVIEWED |
| HISTORICAL_REPLAY | 당시 정보로 재현 | 운영 변경 금지 |

### 5.3 실행 시각

- `UNIVERSE_SCAN`: 정규장 종가 확정 후
- `SETUP_VALIDATION`: 종가 Scan 또는 장중 Trigger 시
- `PLAN_REFRESH`: 시장가격·Corporate Action·Event 변경 시
- `POSITION_REVIEW`: 장 시작 전, 장 마감 후, Event 직후
- `EXIT_REVIEW`: 체결 기록 확정 후

정규장 종가 기반 Signal은 거래소 공식 Bar 완료 전 확정하지 않는다.

### 5.4 원자성

같은 트랜잭션에 저장:

- Momentum Evaluation
- Factor·Gate 결과
- Setup Instance
- Trade Plan
- Lifecycle Transition Proposal
- Audit Log
- Transactional Outbox

Ranking·Report 실패는 원본 Signal 저장을 롤백하지 않고 Event로 재처리한다.

---

## 6. 시간·시장 데이터 계약

### 6.1 Bar 계약

```ts
interface PriceBar {
  securityId: string;
  interval: '5M' | '15M' | '60M' | '1D' | '1W';
  sessionDate: string;
  startAt: string;
  endAt: string;
  availableAt: string;
  open: DecimalString;
  high: DecimalString;
  low: DecimalString;
  close: DecimalString;
  adjustedClose: DecimalString;
  volume: DecimalString;
  vwap?: DecimalString;
  complete: boolean;
  adjustmentFactor: DecimalString;
  sourceId: string;
  snapshotId: string;
}
```

검증:

- `low <= open/close <= high`
- 모든 가격 양수, 거래량 0 이상
- `availableAt <= evaluatedAt`
- 완료 Bar만 종가 Signal에 사용
- 중복 `(securityId, interval, startAt, sourceId)` 금지
- 거래정지 Bar와 0 거래량 Bar 명시적 Flag

### 6.2 Quote·Liquidity 계약

```ts
interface LiquiditySnapshot {
  securityId: string;
  asOf: string;
  currency: CurrencyCode;
  lastPrice: DecimalString;
  bid: DecimalString;
  ask: DecimalString;
  spreadBps: number;
  averageDailyDollarVolume20d: DecimalString;
  medianDailyDollarVolume60d: DecimalString;
  estimatedMarketImpactBps?: number;
  halted: boolean;
  shortSaleRestricted?: boolean;
  snapshotId: string;
}
```

`bid <= ask`, Spread·Market Impact는 음수가 될 수 없다. 장전·장후 Quote는 정규장 Quote와 별도 세션으로 표시한다.

### 6.3 Corporate Action

```ts
type CorporateActionType =
  | 'SPLIT'
  | 'REVERSE_SPLIT'
  | 'DIVIDEND'
  | 'SPIN_OFF'
  | 'RIGHTS_OFFERING'
  | 'SYMBOL_CHANGE'
  | 'MERGER';
```

모든 Indicator는 사용한 조정 계수와 Corporate Action ID를 기록한다. Split 전 Stop·Target은 자동 덮어쓰지 않고 경제적으로 동일한 새 Plan Revision을 만든다.

### 6.4 Session과 Calendar

- 거래소·시간대·정규장·반일장·휴장 Calendar 버전 저장
- 일수는 Calendar Day가 아니라 Trading Session 기준
- 실적 `BMO/AMC/DURING_MARKET/UNKNOWN` 구분
- DST와 해외 거래소 시차를 UTC로 정규화

### 6.5 Point-in-time

Historical Replay는 수정된 가격·실적 Calendar를 현재 값으로 소급 적용하지 않는다. 당시 이용 가능한 Corporate Action·상장 상태·Universe 구성과 뉴스 `availableAt`을 사용한다.

---

## 7. Universe v1

### 7.1 Universe Profile

```ts
interface MomentumUniversePolicy {
  id: string;
  version: string;
  market: string;
  allowedSecurityTypes: Array<'COMMON_STOCK' | 'ADR' | 'ETF'>;
  minimumPrice: DecimalString;
  minimumMarketCap: DecimalString;
  minimumAddv20: DecimalString;
  maximumMedianSpreadBps: number;
  minimumListingSessions: number;
  excludedVenues: string[];
  excludedRiskFlags: string[];
  effectiveFrom: string;
}
```

### 7.2 v1 기본값

미국 상장 현물 Long의 초기 기본값:

| 항목 | 기본값 |
|---|---:|
| Security Type | Common Stock, ADR, 비레버리지 ETF |
| 최소 가격 | USD 5 |
| 최소 시가총액 | USD 300M |
| 최소 20일 ADDV | USD 10M |
| 최대 Median Spread | 50 bps |
| 최소 상장 이력 | 120 Sessions |
| OTC | 제외 |
| Leveraged/Inverse ETF | 제외 |
| 거래정지·상장폐지 절차 | 제외 |

이 수치는 v1 운영 기본값이며 Model/Universe Policy Version에 저장한다. Portfolio 주문 크기가 유동성에 비해 크면 더 엄격한 Risk Gate를 적용한다.

### 7.3 Hard Exclusion

- 거래정지
- 상장폐지 또는 심각한 공시 미준수
- 가격·주식수·통화 Identity 불명확
- 반복적 Reverse Split/Pump 위험
- Critical Corporate Action 미처리
- 주요 시세 Source 불일치
- 극단적 Spread/Market Impact
- Binary Event만 남은 일반 Setup
- Borrow/Settlement 제한으로 실행 불가능

### 7.4 Universe 결과

```ts
interface UniverseDecision {
  securityId: string;
  eligible: boolean;
  reasonCodes: string[];
  liquidityTier: 'L1' | 'L2' | 'L3' | 'INELIGIBLE';
  maxParticipationRate?: number;
  snapshotIds: string[];
  policyVersionId: string;
}
```

`maxParticipationRate`는 Risk/Execution 입력이며 Engine이 주문 수량을 결정한다는 뜻이 아니다.

---

## 8. Market Regime v1

### 8.1 Regime는 Gate다

Market Regime은 종목 Setup Score를 변경하지 않는다. 별도 평가 결과로 거래 허용도와 최대 Risk Multiplier를 제공한다.

```ts
type MarketRegime =
  | 'RISK_ON_TREND'
  | 'RISK_ON_VOLATILE'
  | 'NEUTRAL_RANGE'
  | 'RISK_OFF'
  | 'CRISIS';
```

### 8.2 입력

- 대표 지수 50/200일 추세
- 20/50일 Breadth
- 신고가/신저가 비율
- 상승/하락 거래대금
- 변동성 수준과 Term Structure
- Credit Spread 또는 위험 Proxy
- 섹터 확산도
- 리더 종목의 분포
- Gap/Limit/Halt 빈도

### 8.3 결정 규칙

v1은 Rule Ensemble로 시작한다.

```text
Trend Vote
+ Breadth Vote
+ Volatility Vote
+ Credit/Risk Vote
+ Leadership Vote
→ Regime Classification + Confidence
```

단일 Indicator가 Regime을 확정하지 않는다. Critical 입력 누락은 `UNKNOWN`이며 신규 위험을 차단한다.

### 8.4 Gate 정책

| Regime | 신규 Long | Risk Multiplier | 추가 조건 |
|---|---|---:|---|
| RISK_ON_TREND | 허용 | 1.00 | 표준 Gate |
| RISK_ON_VOLATILE | 축소 허용 | 0.60 | L1/L2 유동성 |
| NEUTRAL_RANGE | 선별 허용 | 0.40 | Catalyst·빠른 Exit |
| RISK_OFF | 수동 검토 | 0.20 | 예외적 RS·작은 Gap Risk |
| CRISIS | 금지 | 0.00 | 신규 Long 없음 |
| UNKNOWN | 금지 | 0.00 | 데이터 복구 |

Multiplier는 Position Size 입력일 뿐 Setup Score에 곱하지 않는다.

### 8.5 Regime Hysteresis

- 단일 거래일로 Trend ↔ Risk-off 전환 금지
- Crisis Hard Trigger는 즉시 가능
- 일반 전환은 2개 세션 확인 또는 임계치 완충
- Model Version 변경 직후 과거 Signal 재분류 금지

---

## 9. Momentum Factor Profile v1

### 9.1 Factor와 가중치

| Factor | ID | 가중치 | 질문 |
|---|---:|---:|---|
| Relative Strength | `MOM_RELATIVE_STRENGTH` | 20 | 시장·섹터·동종 대비 지속적 강세인가? |
| Sector & Leadership | `MOM_SECTOR_LEADERSHIP` | 10 | 자금 흐름 계층에서 리더인가? |
| Price Structure & Setup | `MOM_PRICE_STRUCTURE` | 20 | 사전 정의 Setup 구조가 깨끗한가? |
| Volume Confirmation | `MOM_VOLUME_CONFIRMATION` | 15 | 수요·공급이 가격 움직임을 확인하는가? |
| Catalyst Quality | `MOM_CATALYST_QUALITY` | 15 | 왜 지금인지 공식·지속 가능한 이유가 있는가? |
| Liquidity & Execution | `MOM_LIQUIDITY_EXECUTION` | 10 | 계획 가격에서 진입·청산 가능한가? |
| Reward/Risk & Timing | `MOM_REWARD_RISK_TIMING` | 10 | Chase 이후에도 비용 포함 기대값이 충분한가? |
| 합계 |  | 100 |  |

Market Regime, Portfolio Capacity, 감정 상태는 Factor에 포함하지 않는다.

### 9.2 Score 공식

```text
MomentumScore
= Σ(FactorScore_i × ApplicableWeight_i)
 / Σ(ApplicableWeight_i)
```

조건:

- Score 범위 0~100
- Setup Profile이 사전 허용한 N/A만 재정규화
- 적용 가능 가중치 최소 90
- Critical Factor N/A 금지
- `UNKNOWN/STALE/CONFLICTED`는 재정규화 대상 아님
- Gate 실패는 Score와 별도로 Action을 차단

### 9.3 Factor 점수 의미

| 점수 | 의미 |
|---:|---|
| 85~100 | 복수 독립 지표가 강하게 정렬, 과열 여부 별도 확인 |
| 75~84.99 | 거래 검토 가능한 강한 Setup |
| 65~74.99 | 관찰·조건부 계획 가능 |
| 50~64.99 | 혼합 또는 확인 부족 |
| 0~49.99 | 구조 약함·반대 증거 우세 |

### 9.4 Entry Eligibility

`ENTER` 후보의 기본 Gate:

- Momentum Score `>= 75`
- Confidence `>= 70`
- Price Structure `>= 70`
- Liquidity/Execution `>= 65`
- Reward/Risk/Timing `>= 65`
- 모든 Hard Gate 통과
- Regime `ALLOW` 또는 `ALLOW_REDUCED`
- 유효 Trade Plan

Score 65~74.99는 `WAIT`, 65 미만은 원칙적으로 `AVOID`다. Setup별 Gate가 더 엄격할 수 있다.

### 9.5 Hysteresis

- Signal 진입 임계치와 유지 임계치를 분리
- 기존 활성 Setup은 Score 70까지 유지 검토 가능
- Stop/Invalidation 충족은 유지 점수와 무관하게 종료
- Model Version 변경으로만 Signal 자동 종료 금지

---

## 10. Relative Strength

### 10.1 수익률 기간

거래일 기준:

- 21일
- 63일
- 126일
- 252일

신규 상장 기업은 이용 가능한 기간을 표시하며, 최소 63일 이력이 없으면 일반 Momentum Score를 차단한다.

### 10.2 Benchmark 상대수익

```text
ExcessReturn_h
= SecurityTotalReturn_h
- BenchmarkTotalReturn_h
```

시장, Sector, Industry Benchmark를 각각 계산한다.

### 10.3 v1 RS Composite

```text
Raw RS
= 0.15 × ExcessReturn_21d
+ 0.25 × ExcessReturn_63d
+ 0.30 × ExcessReturn_126d
+ 0.30 × ExcessReturn_252d
```

최근 5일 Gap 하나가 장기 RS를 지배하지 않도록 기간을 분산한다. 정확한 0~100 정규화는 09가 담당하지만 v1은 동일 Universe Percentile을 사용한다.

### 10.4 RS 품질

가점:

- 시장 조정 중 방어
- 반등 시 선행
- 여러 기간의 일관성
- 섹터·산업 대비 동시 강세
- 상승일 거래량 우위

감점:

- 단일 Gap이 전부
- Short Squeeze 가능성
- 저유동성 왜곡
- 최근 급등 후 장기 RS 약함
- Benchmark 부적합

---

## 11. Sector & Leadership

### 11.1 계층

```text
Market → Sector → Industry → Company
```

각 계층의 21/63/126일 상대수익, Breadth, 거래대금, 리더 수를 본다.

### 11.2 Leadership 조건

- Sector가 시장 대비 63일 상위 40% 이상
- Industry가 Sector 대비 악화 중이 아님
- 종목이 Industry 내 63일 상위 30% 이상
- 복수 종목이 동반될 때 Rotation 신뢰도 상승

숫자는 v1 기본값이며 Policy Version에 저장한다.

### 11.3 예외적 강세

Risk-off에서 종목만 강한 경우:

- Defensive 특성
- Short Squeeze
- 단일 Event
- 실제 기관 축적

을 구분한다. Regime Gate를 자동 우회하지 않는다.

---

## 12. Volume Confirmation

### 12.1 기본 Indicator

```text
VolumeRatio20 = CurrentVolume / AverageVolume20
DollarVolume = Close × Volume
UpDownVolumeRatio20 = Σ UpDayVolume / Σ DownDayVolume
```

모든 계산은 Corporate Action과 비정상 Bar를 정리한 뒤 수행한다.

### 12.2 긍정 패턴

- Breakout Session Volume Ratio 1.5 이상
- Pullback Volume가 상승 구간 대비 감소
- 실적 Gap 후 2~3일 Dollar Volume 유지
- 상승일 거래량 우세
- 가격은 횡보하나 누적 거래대금 증가

### 12.3 부정 패턴

- 장중 급등 후 약한 종가
- 반복 긴 윗꼬리
- 지지선 이탈과 거래량 증가
- Offering 전후 비정상 거래
- 단일 소형 주문으로 만든 Volume Ratio

### 12.4 Volume Data Gate

- 최소 20개 완료 Session
- 거래정지·0 Volume 분리
- Provider 간 Volume 단위 일치
- 장전·장후 Volume 분리
- 미완료 당일 Bar는 Intraday Profile에서만 사용

---

## 13. Price Structure와 변동성

### 13.1 기본 Indicator

- SMA/EMA 20, 50, 200
- ATR 14
- 20/55/252일 High
- Base Depth와 Duration
- Breakout Distance
- Gap Percent
- Close Location Value
- Swing High/Low

### 13.2 ATR

```text
TrueRange_t
= max(
  High_t - Low_t,
  abs(High_t - Close_{t-1}),
  abs(Low_t - Close_{t-1})
)

ATR14 = WilderAverage(TrueRange, 14)
```

분모 가격이 0이거나 Corporate Action 미반영 시 계산을 차단한다.

### 13.3 과열·확장

다음은 Chase 위험으로 표시한다.

- 20일 평균 대비 거리 과다
- ATR 대비 Gap 과다
- Base 없이 연속 급등
- Target까지 남은 거리보다 Stop 거리가 큼
- 거래량 Climax와 약한 종가

높은 RS가 과열을 상쇄하지 않는다.

---

## 14. Catalyst

### 14.1 계약

```ts
interface MomentumCatalyst {
  id: string;
  companyId: string;
  type: CatalystType;
  occurredAt: string;
  availableAt: string;
  sourceTier: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  official: boolean;
  summary: string;
  expectedDuration: 'INTRADAY' | 'DAYS' | 'WEEKS' | 'MONTHS';
  halfLifeHours: number;
  estimateRevisionObserved: boolean;
  priceReactionPercent: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
}
```

### 14.2 Catalyst 유형

- EARNINGS_SURPRISE
- GUIDANCE_CHANGE
- ESTIMATE_REVISION
- PRODUCT_LAUNCH
- REGULATORY_DECISION
- MAJOR_CONTRACT
- SUPPLY_DEMAND_SHOCK
- POLICY_CHANGE
- CAPITAL_RETURN
- INDEX_INCLUSION
- MANAGEMENT_CHANGE
- TECHNICAL_ONLY

### 14.3 출처

Fact 기반 Catalyst는 A~C 출처가 필요하다. 소셜 미디어·익명 루머는 Candidate 탐지에는 사용할 수 있으나 Score·ENTER 근거가 될 수 없다.

### 14.4 Half-life

```text
FreshnessFactor
= 2 ^ (-ElapsedHours / HalfLifeHours)
```

Half-life는 Catalyst Profile에 저장한다. Freshness가 최소값 아래로 내려가면 Catalyst Factor를 자동 유지하지 않고 새 검증을 요구한다.

### 14.5 가격 반영

다음을 함께 본다.

- Gap/수익률 크기
- 거래량
- 추정치 수정
- 후속 Analyst/산업 반응
- 다음 저항·Valuation이 아닌 기술적 Supply
- Fade 여부

좋은 뉴스라는 이유만으로 좋은 Entry가 되지 않는다.

---

## 15. Setup Registry

### 15.1 공통 계약

```ts
interface SetupDefinition {
  type: MomentumSetupType;
  version: string;
  requiredIndicators: string[];
  criticalFactorIds: MomentumFactorId[];
  detectionRules: Rule[];
  validationRules: Rule[];
  invalidationRules: Rule[];
  defaultHoldingSessions: { min: number; max: number };
  allowedRegimes: MarketRegime[];
  eventPolicy: string;
}
```

Setup Definition 변경은 Model Version 변경이다.

### 15.2 Breakout v1

탐지:

- 최소 20 Session Base
- Base Depth 원칙적으로 35% 이하
- 20/55일 High 또는 명확한 Resistance 접근
- 종가가 Resistance 위 또는 Entry Trigger 근접
- 50일 평균 거래대금 Gate 통과

검증:

- 돌파 Session Volume Ratio 기본 1.5 이상
- Close가 Range 상단 30% 이내
- Chase Distance 기본 1 ATR 이내
- 시장·섹터 Gate
- False Breakout 반대 근거 검토

Invalidation:

- 돌파선 아래 종가 회귀
- Trigger 후 2~3 Session 진전 없음
- 고거래량 약세 반전
- Regime 급변

### 15.3 Pullback v1

탐지:

- 20/50일 상승 추세
- 최근 유효 Breakout 또는 Higher High
- 2~10 Session 조정
- 20EMA/50SMA/이전 돌파선 근접

검증:

- 조정 거래량 감소
- RS 유지
- 지지 부근 반전 Trigger
- 조정 깊이 기본 0.5~2.0 ATR

Invalidation:

- 고거래량 Structural Support 이탈
- 50일 추세 훼손
- Sector Leadership 상실

### 15.4 Earnings Momentum v1

탐지:

- 공식 실적·가이던스 발표
- 매출/이익/핵심 KPI Surprise 또는 Guidance 상향
- Gap 또는 높은 거래량 반응

검증:

- 일회성 회계 효과 분리
- 추정치 수정 확인
- Gap 유지 또는 첫 Pullback 지지
- 다음 실적 전 Time Horizon
- 후속 Event Calendar

Invalidation:

- Gap 저점 또는 구조적 지지 이탈
- Guidance 정정
- 추정치 상승 없이 Price만 급등
- Gap Fade와 고거래량 매도

### 15.5 Gap Continuation v1

탐지:

- 공식 Catalyst
- 전일 종가 대비 Gap 기본 2% 이상
- ADDV·Spread Gate 통과

검증:

- Opening Range 유지
- Gap이 3 ATR을 초과하면 기본 `WAIT`
- 정규장 유동성 확인
- Catalyst Half-life 유효

Invalidation:

- Gap Fill 또는 Opening Range Low 이탈
- Spread 급증
- 뉴스 해석 반전

### 15.6 Sector Rotation v1

탐지:

- Sector ETF/Index의 시장 대비 RS 전환
- 산업 Breadth 개선
- 복수 종목 동반 Volume

검증:

- 단일 Mega-cap 효과 분리
- 산업 Catalyst 또는 자금 흐름 지속성
- 후보 종목이 Sector 내 리더

Invalidation:

- Sector RS 재하락
- Breadth 붕괴
- 리더 종목 분배

### 15.7 Special Situation

Index Inclusion, Spin-off, Tender, Restructuring, Court/Regulatory Event는 일반 Setup과 동일 Score로 자동 진입하지 않는다.

- 별도 Definition Version
- 법률·조건·일정 Evidence
- Binary Scenario
- Manual Review
- Gap-through-Stop 가정

v1 자동 `ENTER` 대상에서 제외한다.

---

## 16. Trade Plan

### 16.1 Plan 계약

기존 `MomentumTradePlan`과 `EntryPlan`을 기준으로 확장한다.

```ts
interface MomentumTradePlanV1 {
  id: string;
  revision: number;
  companyId: string;
  securityId: string;
  evaluationId: string;
  setupId: string;
  setupType: MomentumSetupType;
  marketRegime: MarketRegime;
  currency: CurrencyCode;

  entryZoneMin: DecimalString;
  entryZoneMax: DecimalString;
  chaseLimit: DecimalString;
  trigger: string;
  initialStop: DecimalString;
  target1?: DecimalString;
  target2?: DecimalString;
  trailingStopRule?: string;
  timeStopSessions: number;

  referenceEntry: DecimalString;
  unitRisk: DecimalString;
  rewardRiskToTarget1?: number;
  rewardRiskToTarget2?: number;
  invalidationConditions: string[];
  eventPolicy: EventHoldingPolicy;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  snapshotIds: string[];
  modelVersionId: string;
  generatedAt: string;
  expiresAt: string;
  supersedesPlanId?: string;
}
```

### 16.2 가격 관계

Long 기준:

```text
0 < Initial Stop
< Entry Zone Min
<= Reference Entry
<= Entry Zone Max
<= Chase Limit

Target 1, 2 > Reference Entry
```

### 16.3 1R와 Reward/Risk

```text
UnitRisk = ReferenceEntry - InitialStop
RewardRisk(target) = (Target - ReferenceEntry) / UnitRisk
```

v1 기본:

- Target 기반 Plan의 Target1 R/R `>= 1.5`
- Target2 또는 최종 기대 R/R `>= 2.0`
- 거래비용·예상 Slippage 차감 후 기준 충족
- Gap Risk가 크면 Stop 거리 대신 Scenario Loss를 Risk에 전달

### 16.4 Entry Zone

Entry Zone은 다음에서 생성할 수 있다.

- Breakout Level ± 허용 Buffer
- Pullback Support + Confirmation Range
- Gap Continuation Opening Range
- ATR 기반 Trigger Range

정확한 단일 가격 예측을 가장하지 않는다.

### 16.5 Chase Limit

Chase Limit은 다음 중 더 보수적인 값:

- Entry Zone Max + Setup별 ATR 배수
- 최소 R/R가 유지되는 최대 가격
- 다음 Supply/Resistance 전 여유가 남는 가격

현재 가격이 Chase Limit을 초과하면 Action은 `WAIT` 또는 `AVOID`다.

### 16.6 Initial Stop

Stop 우선순위:

1. Structural Invalidation
2. Volatility Noise 완충
3. 최소 가격 단위 반영
4. Gap Risk Scenario

Position Size를 맞추기 위해 논리 없는 Stop을 임의로 좁히지 않는다.

### 16.7 Target과 Trailing

최소 하나 필요:

- Target1
- Trailing Stop Rule

Target2는 선택이다. Trailing Rule은 구체적인 Indicator·Period·업데이트 주기를 가진다.

### 16.8 Time Stop

Setup별 기본:

| Setup | 기본 Time Stop |
|---|---:|
| Breakout | 5~15 Sessions |
| Pullback | 5~20 Sessions |
| Earnings Momentum | 10~40 Sessions |
| Gap Continuation | 2~10 Sessions |
| Sector Rotation | 20~60 Sessions |

Time Stop은 손실 상태에만 적용되는 것이 아니다.

### 16.9 Plan 만료

- 종가 기반 다음 세션 진입 Plan: 기본 다음 정규장 종료까지
- Intraday Trigger Plan: 해당 세션 종료까지
- 가격이 Entry/Chase 구조를 벗어나면 조기 만료
- Catalyst 정정·Corporate Action·Regime 전환 시 새 Revision 필요

---

## 17. Stop Revision과 Position 관리

### 17.1 Stop 확대 금지

```text
Long Position:
Proposed Stop < Current Stop
→ Risk Widening
→ 기본 거부
```

허용 가능한 예외:

- Corporate Action Adjustment
- 명백한 Data Correction
- 진입 전 정의한 Volatility Model

예외도 새 Plan Revision, 이유, Evidence, Risk 재검증과 사용자 승인이 필요하다.

### 17.2 Stop 상향

Stop 상향은 다음을 만족해야 한다.

- 현재가 아래
- 새 구조 또는 사전 Trailing Rule 근거
- 시장 Microstructure Noise 고려
- Remaining Position 전체와 일치
- Audit Log

### 17.3 Pyramiding

추가 진입은 새 Setup Instance다.

- 기존 Lot 이익 또는 Open Risk 감소
- 새 Trigger
- 총 Open Risk 재계산
- Portfolio/Risk 승인
- 손실 평균내기 금지

### 17.4 Exit 우선순위

1. Hard Risk·거래정지 해제 후 특별 처리
2. Stop/Invalidation
3. Event Policy
4. Portfolio Risk
5. Target/Trailing
6. Time Stop
7. Discretionary Early Exit with pre-defined reason

---

## 18. Event와 Gap Risk

### 18.1 Event 계약

```ts
type EventHoldingPolicy =
  | 'EXIT_BEFORE_EVENT'
  | 'REDUCE_BEFORE_EVENT'
  | 'HOLD_WITH_SCENARIO_APPROVAL'
  | 'EVENT_IS_SETUP'
  | 'NO_KNOWN_EVENT';
```

### 18.2 Binary Event

- Earnings
- FDA/Clinical
- Court Decision
- Regulatory Approval
- M&A Vote
- Financing/Lock-up
- Macro Announcement for rate-sensitive instruments

일반 Setup은 `EXIT_BEFORE_EVENT`가 기본이다. `EVENT_IS_SETUP`은 별도 Event Profile과 Manual Review가 필요하다.

### 18.3 Gap Scenario

```ts
interface GapRiskScenario {
  baseStopLoss: DecimalString;
  adverseGapPrice: DecimalString;
  scenarioLossPerUnit: DecimalString;
  probabilityBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  source: string;
}
```

정밀 확률을 가장하지 않는다. 과거 Event Gap, 옵션 Implied Move, 산업 특성을 참고한다.

### 18.4 Event Gate

다음이면 `ENTER` 차단:

- Event Calendar UNKNOWN
- 이벤트가 Plan Horizon 안에 있으나 Policy 없음
- Binary Event인데 Gap Scenario 없음
- Manual Review 필요한 Setup인데 승인 없음
- 공식 일정 출처 불일치

---

## 19. Confidence

### 19.1 구성

기존 `EvaluationConfidence`를 사용한다.

```text
Confidence
= 0.30 × Evidence Coverage
+ 0.25 × Source Quality
+ 0.25 × Data Freshness
+ 0.20 × Model Fit
- Disagreement Penalty
```

호환 계약상 `modelFit` 필드에 Setup/Regime Model Fit을, `disagreement`에 Provider·Indicator 불일치를 기록한다.

v1 계산:

```text
Confidence Score
= 0.30 × EvidenceCoverage
+ 0.20 × SourceQuality
+ 0.20 × DataFreshness
+ 0.20 × ModelFit
+ 0.10 × (100 - Disagreement)
```

### 19.2 등급

| 등급 | Score | 사용 |
|---|---:|---|
| HIGH | 80 이상 | 표준 Gate 가능 |
| MEDIUM | 70~79.99 | 축소 또는 표준 검토 |
| LOW | 50~69.99 | WAIT·Manual Review |
| INSUFFICIENT | 50 미만 | AVOID |

### 19.3 Cap

| 조건 | 최대 Confidence |
|---|---:|
| Counter Evidence 없음 | 49 |
| Market Regime UNKNOWN | 49 |
| Critical Bar/Quote 불일치 | 49 |
| Catalyst가 회사 홍보자료만 | 59 |
| 상장 120 Sessions 미만 일반 Setup | 59 |
| Setup Definition Shadow 상태 | 59 |
| Volume PARTIAL | 64 |
| Sector Benchmark 부적합 | 64 |

### 19.4 Score Range

Factor의 Bear/Base/Bull 입력으로 Low/Point/High를 계산한다. Confidence를 점수에 곱해 숨기지 않는다. Range가 넓으면 Ranking Tier를 낮춘다.

---

## 20. Gate와 Action 정책

### 20.1 Gate 결과

```ts
interface MomentumGateResult {
  gateId: string;
  status: 'PASSED' | 'FAILED' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';
  severity: 'INFO' | 'SOFT' | 'HARD';
  reasonCode: string;
  evidenceIds: string[];
  blockedActions: MomentumAction[];
  explanation: string;
}
```

### 20.2 공통 Gate

| Gate | 실패 효과 |
|---|---|
| `POINT_IN_TIME_VALID` | 평가 차단 |
| `UNIVERSE_ELIGIBLE` | AVOID |
| `MARKET_DATA_FRESH` | AVOID |
| `CORPORATE_ACTIONS_APPLIED` | 평가 차단 |
| `REGIME_PERMISSION` | WAIT/AVOID/Review |
| `LIQUIDITY_SUFFICIENT` | AVOID |
| `SETUP_VALID` | WAIT/AVOID |
| `CATALYST_VALID` | Setup별 WAIT/AVOID |
| `TRADE_PLAN_COMPLETE` | ENTER 차단 |
| `REWARD_RISK_SUFFICIENT` | WAIT/AVOID |
| `CHASE_LIMIT_VALID` | ENTER 차단 |
| `EVENT_POLICY_VALID` | ENTER 차단 |
| `BEHAVIORAL_POLICY_CLEAR` | Review/Deny |
| `SIGNAL_NOT_EXPIRED` | AVOID |

### 20.3 Action

```ts
type MomentumAction =
  | 'ENTER'
  | 'WAIT'
  | 'AVOID'
  | 'EXIT'
  | 'REVIEW_REQUIRED';
```

### 20.4 결정 표

| Setup | Regime | Gate | 가격 | Action |
|---|---|---|---|---|
| Eligible | Allow | Pass | Entry Zone | ENTER |
| Eligible | Allow Reduced | Pass | Entry Zone | ENTER + reduced constraint |
| Eligible | Risk-off | Pass | Entry Zone | REVIEW_REQUIRED |
| Eligible | Crisis/Unknown | 무관 | 무관 | AVOID |
| Eligible | Allow | Pass | Entry 미도달 | WAIT |
| Eligible | Allow | Pass | Chase 초과 | AVOID |
| Low Score | 무관 | Pass | 무관 | WAIT/AVOID |
| 무관 | 무관 | Hard Fail | 무관 | AVOID/REVIEW_REQUIRED |
| Active Position | 무관 | Stop/Invalidation | 무관 | EXIT |

### 20.5 ENTER 불변식

`ENTER`에 필요한 조건:

- Score·Confidence Gate
- 모든 Hard Gate 통과
- 현재 가격이 Entry Zone 또는 Trigger 허용 범위
- Chase Limit 이하
- 유효한 Stop
- Target 또는 Trailing
- Time Stop
- Event Policy
- Signal·Plan 미만료
- Portfolio/Risk/Human Approval 필요 표시

---

## 21. Signal Lifecycle

### 21.1 상태

```text
DETECTED
  → VALIDATED
  → PLANNED
  → APPROVED
  → ENTERED
  → MANAGING
  → CLOSED
  → REVIEWED

Any pre-entry state → REJECTED | EXPIRED | INVALIDATED | CANCELLED
Entered/Managing → CLOSED → REVIEWED
```

### 21.2 상태별 요구

| 상태 | 최소 요구 |
|---|---|
| DETECTED | Candidate, Setup Type, Snapshot |
| VALIDATED | Factor·Gate·Evidence·Confidence |
| PLANNED | 완전한 Trade Plan |
| APPROVED | Portfolio·Risk·Human Approval |
| ENTERED | 실제 Execution Record·Lot |
| MANAGING | 활성 Stop·Target·Event Policy |
| CLOSED | Exit Execution·Reason |
| REVIEWED | Outcome·Process Review |

### 21.3 전이 계약

```ts
interface MomentumSetupTransition {
  id: string;
  setupId: string;
  from: MomentumSetupState;
  to: MomentumSetupState;
  evaluationId: string;
  planId?: string;
  decisionId?: string;
  executionId?: string;
  reasonCode: string;
  evidenceIds: string[];
  modelVersionId: string;
  occurredAt: string;
  actor: ActorRef;
}
```

단계 건너뛰기 금지. `APPROVED`에는 Human Actor와 만료 재검증이 필요하다.

### 21.4 만료·무효화

- `EXPIRED`: 시간 경과, 새 탐지 가능
- `INVALIDATED`: Setup 조건 붕괴, 동일 Setup ID 재활성화 금지
- `REJECTED`: Gate/Risk/User 거부
- `CANCELLED`: 운영·사용자 취소, 사유 필요

Terminal 상태는 수정하지 않는다.

---

## 22. 포지션 관리와 Exit

### 22.1 Exit Reason

```ts
type MomentumExitReason =
  | 'STOP_LOSS'
  | 'TARGET_REACHED'
  | 'TRAILING_STOP'
  | 'TIME_STOP'
  | 'SETUP_INVALIDATED'
  | 'MARKET_REGIME_CHANGED'
  | 'EVENT_RISK'
  | 'PORTFOLIO_RISK'
  | 'MANUAL_ERROR_CORRECTION';
```

### 22.2 Stop Trigger

- Intraday Stop과 Close-based Stop을 구분
- Quote Source·Timestamp 기록
- Gap-through-Stop은 실제 Fill로 성과 계산
- 거래정지 중에는 Risk Alert와 Manual Handling

### 22.3 Target

- Partial Exit 허용
- 남은 수량과 Stop Revision 필요
- Target 체결이 전체 Setup 종료인지 명시
- Target 도달 전 Front-running Rule 금지

### 22.4 Time Stop

- 거래 Session 수 기준
- 휴장 제외
- 부분 진행 시 연장하려면 사전 Rule 필요
- 임의 연장은 새 Plan Revision과 승인

### 22.5 Regime Change

Regime 악화는 모든 Position의 즉시 시장가 청산을 의미하지 않는다.

- 신규 위험 차단
- Stop Tightening 후보
- Exposure 축소를 Portfolio/Risk에 요청
- Setup Invalidation과 구분

---

## 23. 최종 출력 계약

```ts
interface MomentumEvaluationV1 {
  id: string;
  companyId: string;
  securityId: string;
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  mode: MomentumEvaluationMode;
  modelVersionId: string;
  philosophyVersionId: string;
  universePolicyVersionId: string;
  setupDefinitionVersion: string;
  snapshotIds: string[];

  marketRegime: MarketRegimeEvaluation;
  universeDecision: UniverseDecision;
  setup: SetupEvaluation;
  score: ScoreRange;
  factorResults: MomentumFactorResult[];
  confidence: EvaluationConfidence;

  action: MomentumAction;
  actionConstraints: string[];
  gateResults: MomentumGateResult[];
  tradePlan?: MomentumTradePlanV1;

  executionRisk: number;
  gapRisk: number;
  riskScoreDirection: 'HIGHER_IS_RISKIER';
  evidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  nextReviewAt: string;
  expiresAt: string;
  operationalStateChangeAllowed: boolean;
  explanation: MomentumExplanation;
  resultHash: string;
}
```

### 23.1 Setup Evaluation

```ts
interface SetupEvaluation {
  setupId: string;
  setupType: MomentumSetupType;
  status: 'ELIGIBLE' | 'CONDITIONAL' | 'INELIGIBLE';
  detectedAt: string;
  triggerStatus: 'NOT_TRIGGERED' | 'TRIGGERED' | 'CHASED' | 'INVALIDATED';
  holdingHorizon: { minSessions: number; maxSessions: number };
  invalidationConditions: string[];
  warnings: string[];
}
```

### 23.2 호환 필드

기존 `MomentumEvaluationRecord`의 다음을 유지한다.

- momentumScore
- relativeStrengthScore
- volumeScore
- catalystScore
- liquidityScore
- setupQualityScore
- riskScore + 방향 Metadata
- setupType, action
- entryZone, stopLoss, target1, target2, maxHoldingDays
- Evidence, Snapshot, Confidence

보완:

- marketRegime 결과와 Gate
- Universe Decision
- Factor 세부 결과
- Chase Limit
- Time Stop Session
- Catalyst ID/Half-life
- Event Policy/Gap Risk
- setupDefinitionVersion, universePolicyVersionId
- resultHash, expiresAt

Legacy 총점은 호환 Preview로만 유지한다.

---

## 24. API 설계

### 24.1 엔드포인트

```text
POST /api/v1/momentum/scans
GET  /api/v1/momentum/scans/:id
POST /api/v1/momentum/evaluations
GET  /api/v1/momentum/evaluations/:id
GET  /api/v1/companies/:companyId/momentum
GET  /api/v1/momentum/rankings
POST /api/v1/momentum/plans
POST /api/v1/momentum/plans/:id/revisions
POST /api/v1/momentum/plans/:id/validate-price
GET  /api/v1/momentum/reviews/due
POST /api/v1/momentum/replays
```

상태 변경 POST는 `Idempotency-Key` 필수다.

### 24.2 평가 요청 핵심

```json
{
  "companyId": "uuid",
  "securityId": "uuid",
  "mode": "SETUP_VALIDATION",
  "setupType": "BREAKOUT",
  "evaluatedAt": "2026-07-22T21:10:00Z",
  "modelVersionId": "uuid",
  "universePolicyVersionId": "uuid",
  "setupDefinitionVersion": "breakout-v1",
  "snapshotIds": ["uuid"],
  "evidenceIds": ["uuid"],
  "counterEvidenceIds": ["uuid"]
}
```

운영 API는 임의 Factor 점수를 입력받지 않는다. Snapshot과 버전된 Indicator에서 계산한다. 테스트·Shadow용 순수 함수만 구조화된 Factor 입력을 허용한다.

### 24.3 오류

| HTTP | Code | 의미 |
|---:|---|---|
| 400 | `INVALID_MOMENTUM_REQUEST` | Schema·날짜 오류 |
| 409 | `IDEMPOTENCY_CONFLICT` | 같은 키의 다른 Body |
| 409 | `MODEL_VERSION_CONFLICT` | 비활성·혼합 버전 |
| 422 | `POINT_IN_TIME_VIOLATION` | 미래 정보 혼입 |
| 422 | `UNIVERSE_INELIGIBLE` | 거래 Universe 실패 |
| 422 | `SETUP_INPUT_INCOMPLETE` | Indicator·Evidence 부족 |
| 422 | `TRADE_PLAN_INVALID` | Entry/Stop/Exit 계약 위반 |
| 423 | `MOMENTUM_RISK_REVIEW_REQUIRED` | Event/Regime/Human Review |
| 410 | `SIGNAL_EXPIRED` | Signal·Plan 만료 |
| 404 | `MOMENTUM_EVALUATION_NOT_FOUND` | 평가 없음 |

### 24.4 Ranking

- 같은 Model·Universe Policy·Session만 비교
- `ENTER` 가능과 `WAIT` 후보 분리
- Score Range 중첩 시 동일 Tier
- Gate 실패 종목은 투자 가능 Ranking 제외
- 현재가격/Chase 상태 표시
- Cursor Pagination

---

## 25. 저장 모델

### 25.1 신규 Migration

구현 시 `005_momentum_engine_v1.sql`을 추가한다. 기존 Migration을 수정하지 않는다.

### 25.2 Table

```text
momentum_universe_policies
momentum_universe_memberships
market_regime_evaluations
momentum_evaluations
momentum_factor_results
momentum_gate_results
momentum_setup_instances
momentum_trade_plan_revisions
momentum_setup_transitions
momentum_catalysts
momentum_event_risk_assessments
momentum_trade_reviews
```

기존 공통 `evaluations`, `momentum_trade_plans`, `position_lots`, `execution_records`와 ID로 연결한다.

### 25.3 제약

- Score·Confidence·Risk `[0,100]`
- 날짜 Point-in-time
- Entry/Stop/Chase/Target 관계
- `ENTER`와 완전한 Plan 일치
- `HISTORICAL_REPLAY → operational_state_change_allowed=false`
- Signal/Plan 불변 Revision
- Stage 건너뛰기 금지
- Strategy Lot `MOMENTUM`
- 사용자별 Composite FK와 RLS

### 25.4 Index

- `(user_id, security_id, evaluated_at desc)`
- `(user_id, setup_type, evaluated_at desc)`
- 동일 Session Ranking
- 활성 Setup partial index
- 만료 예정 Plan
- Due Review
- Catalyst `(company_id, available_at desc)`

### 25.5 RLS

- 사용자는 자신의 Signal·Plan·Review만 조회
- Service Role만 Evaluation 결과 삽입
- 사용자 승인 API만 APPROVED Transition 생성
- Outbox·Processed Event 서버 전용
- Composite FK로 다른 사용자의 Evaluation 참조 차단

---

## 26. Job과 Event

### 26.1 Job

```ts
type MomentumJobType =
  | 'MOMENTUM_UNIVERSE_SCAN'
  | 'MOMENTUM_SETUP_VALIDATION'
  | 'MOMENTUM_PLAN_REFRESH'
  | 'MOMENTUM_EVENT_REVIEW'
  | 'MOMENTUM_POSITION_REVIEW'
  | 'MOMENTUM_RANKING_REFRESH'
  | 'MOMENTUM_HISTORICAL_REPLAY';
```

### 26.2 Event

```text
MomentumUniverseUpdated
MarketRegimeChanged
MomentumCandidateDetected
MomentumEvaluationCompleted
MomentumEvaluationBlocked
MomentumSetupValidated
MomentumTradePlanCreated
MomentumTradePlanExpired
MomentumSetupInvalidated
MomentumEntryReviewRequested
MomentumPositionReviewRequested
MomentumExitTriggered
MomentumTradeReviewed
MomentumRankingRefreshRequested
```

### 26.3 Event Payload

`MomentumEvaluationCompleted`:

- evaluationId
- companyId/securityId
- setupId/type
- score/range/confidence
- regime/gate
- action
- planId/expiry
- model/universe/setup version
- nextReviewAt

원문 Evidence는 ID만 전달한다.

### 26.4 멱등성

- Scan: `session + universePolicyVersion + modelVersion`
- Candidate: `securityId + setupType + setupDefinitionVersion + detectedBar`
- Catalyst: `sourceId + sourceEventId`
- Evaluation: 요청 Idempotency-Key
- Consumer: Event ID

---

## 27. Fail-closed와 운영 예외

### 27.1 차단 조건

- Market Calendar 불명확
- Corporate Action 미처리
- Critical Bar/Quote Stale
- Provider 가격 불일치
- Regime UNKNOWN/CRISIS
- Liquidity/Spread Gate 실패
- Stop·Target/Trailing·Time Stop 누락
- Event Calendar UNKNOWN
- Signal/Plan 만료
- 계산 NaN/Infinity/범위 초과
- Model/Policy Version 비활성

### 27.2 부분 실패

예:

- Universe 성공, Catalyst Provider 실패
- Setup Detection 성공, Quote 실패
- Evaluation 성공, Ranking 실패

처리:

- Critical Component 실패면 `ENTER` 차단
- 성공 Component와 실패 Code 보존
- Ranking·Report는 재처리
- 이전 Signal을 최신처럼 재사용하지 않음

### 27.3 수동 Override

사람도 다음을 직접 덮어쓸 수 없다.

- Crisis Gate
- Stop 없는 Entry
- Chase 초과
- Portfolio/Risk DENY
- 만료 Plan

가능한 조치:

- 새 Snapshot과 평가
- 새 Plan Revision
- Event Manual Review
- 승인·거부
- Data Correction Audit

---

## 28. 관측성과 Alert

### 28.1 Metric

```text
momentum_scan_total{status,market}
momentum_scan_duration_ms{component}
momentum_universe_size{market,policy_version}
momentum_candidate_total{setup_type}
momentum_evaluation_total{action,setup_type,regime}
momentum_gate_failure_total{gate_id}
momentum_score_distribution{setup_type,model_version}
momentum_confidence_distribution{setup_type}
momentum_plan_expired_total{setup_type}
momentum_setup_invalidated_total{reason}
momentum_stop_revision_total{direction,reason}
momentum_replay_mismatch_total{model_version}
```

### 28.2 Alert

- Crisis/Regime 급변
- 가격 Provider 불일치
- Corporate Action 미적용
- 활성 Position의 Stop/Plan 누락
- Plan 만료 임박
- Event Calendar 변경
- Outbox 지연
- Signal 분포 급변
- Replay 불일치

### 28.3 Log

- request/correlation/job/evaluation/setup/plan ID
- model/universe/setup version
- session/calendar version
- gate failures
- snapshot count/hash
- 계산 Component/Duration
- 오류 Code/Retryable

민감 정보와 전체 뉴스 원문을 Log에 기록하지 않는다.

---

## 29. 보안과 감사

### 29.1 감사 대상

- Universe Policy 변경
- Regime Model 변경
- Signal 생성·차단
- Plan 생성·Revision·만료
- Stop 수정 요청
- Event Review
- Setup Transition
- Model 활성화
- Historical Replay

### 29.2 프롬프트 인젝션

뉴스·공시·소셜 텍스트는 신뢰되지 않은 입력이다.

- 문서 속 명령 실행 금지
- Catalyst Fact와 Agent 해석 분리
- 출처·원문 위치·시간 연결
- Schema Validation
- D/E/F 출처만으로 Score/ENTER 금지
- Tool 권한과 분석 텍스트 분리

### 29.3 데이터 라이선스

- Provider 재배포 권한
- Snapshot 보존 범위
- 실시간/지연 데이터 표시
- 사용자 화면 노출 가능 필드
- Backtest 용도 허용 여부

를 Provider Adapter 설정에 기록한다.

---

## 30. 테스트 전략

### 30.1 Unit

- Factor 가중치 합 100
- Score 범위·N/A 재정규화
- Regime 분리
- Universe Filter
- RS·ATR·Volume Indicator
- Corporate Action 조정
- Setup별 Detection/Validation/Invalidation
- Catalyst Half-life
- Entry/Stop/Chase/Target 관계
- Reward/Risk
- Confidence와 Cap
- Gate·Action 표
- Lifecycle 전이
- Plan 만료·Revision

### 30.2 Property

1. Portfolio 금액 변화가 Momentum Score를 바꾸지 않는다.
2. Market Regime 변화가 동일 Setup Score를 바꾸지 않는다.
3. Crisis에서 `ENTER`가 나오지 않는다.
4. Stop 없는 Plan은 `ENTER`가 아니다.
5. 현재가격이 Chase를 넘으면 `ENTER`가 아니다.
6. Initial Stop을 낮추면 Unit Risk가 감소하지 않는다.
7. UNKNOWN을 N/A로 바꿔 Gate를 우회할 수 없다.
8. 같은 Snapshot·Version은 같은 Hash를 만든다.
9. 미래 `availableAt`은 Replay에 포함되지 않는다.
10. Momentum Lot은 Long-term Exit Policy를 가질 수 없다.

### 30.3 Golden Fixture

| Fixture | 기대 |
|---|---|
| 정상 Breakout | ENTER 후보, 완전 Plan |
| 고득점이나 Chase 초과 | AVOID |
| Pullback 고거래량 이탈 | INVALIDATED |
| Earnings Beat + Guidance Raise | Eligible Earnings Momentum |
| 실적 Gap Fade | WAIT/AVOID |
| Crisis 강한 종목 | Score 보존, AVOID |
| 저유동성 급등 | Universe Ineligible |
| Split 미반영 | Evaluation Blocked |
| Binary Event 계획 없음 | ENTER 차단 |
| Stop 누락 | Plan Invalid |
| 만료 Plan | 410/AVOID |
| Long-term High/Momentum Low | Strategy 분리 |

### 30.4 Integration

- Provider Snapshot → Scan → Evaluation → Plan → DB → Outbox
- Idempotency
- RLS 사용자 격리
- Signal/Plan/Audit/Outbox 원자성
- Ranking 버전 분리
- Due Review
- Plan Revision 불변성

### 30.5 Historical Replay

필수:

- Point-in-time Universe
- 상장폐지·합병 포함
- Corporate Action 당시 버전
- 미완료 Bar 제외
- Spread·Slippage·수수료·세금
- Gap-through-Stop
- 다음 Bar 체결 가정의 명시
- Regime별 Out-of-sample
- 운영 상태 변경 없음

평가:

- 거래비용 후 Expectancy
- Average Win/Loss, Win Rate
- Profit Factor
- R-Multiple 분포
- MAE/MFE
- Max Drawdown
- Tail Loss
- Turnover/Capacity
- Setup·Regime별 성과
- 규칙 준수 민감도

### 30.6 과적합 방지

- Walk-forward
- Purged Time Split
- Embargo
- Parameter Stability
- 특정 대형 승자 제거
- Multiple Testing 보정
- Shadow Mode

최근 몇 건의 성과로 가중치·Stop을 자동 변경하지 않는다.

---

## 31. 모델 버전과 거버넌스

### 31.1 Version 내용

- Factor·가중치
- Indicator Definition
- Universe Policy
- Regime Rule
- Setup Definition
- Gate·임계치
- Confidence Formula
- Plan 기본값
- Calendar/Corporate Action 정책
- 비용·Slippage Model
- 코드 Commit SHA
- Fixture/Replay Hash
- 승인·유효일

### 31.2 변경 절차

```text
Change Proposal
  → Evidence & Sample Size
  → Unit / Golden Fixture
  → Walk-forward Replay
  → Capacity & Cost Test
  → Shadow Mode
  → Human Approval
  → Activation
  → Drift Monitoring
```

### 31.3 최소 변경 근거

- 여러 Regime 포함
- 충분한 거래 수
- 특정 종목 의존성 제거
- 비용 후 Edge
- Parameter 주변 안정성
- Out-of-sample 유지

---

## 32. 현재 구현 Gap

| 현재 자산 | 재사용 | 추가·교체 |
|---|---|---|
| `momentum.ts` | 순수 Weighted Score 패턴 | Legacy 5 Factor와 단일 임계치, Regime/Liquidity/Setup Gate 분리 |
| `momentum-plan.ts` | Entry·Stop·Chase·Target·Time Stop, Regime Gate, Stop 확대 통제 | Revision·R/R·현재가격 검증·Event Policy·만료 Lifecycle |
| `contracts.ts` | Evaluation Lineage와 ENTER 기본 검증 | Factor/Gate/Universe/Regime/Chase/Gap/Hash 확장 |
| `state-machine.ts` | 순차 Momentum Setup State | Transition Evidence·만료·승인 메타데이터 |
| `risk.ts` | Stop 필수, Regime·Event·Behavioral Gate | Gap Scenario·Signal/Plan 만료·Open Risk Handoff |
| `portfolio.ts` | Momentum Bucket·종목 한도 | 주당 위험·유동성 Capacity 기반 수량은 05에서 연결 |
| `evidence.ts` | 출처 등급·점수 가능 출처 | Catalyst Half-life·Market Source Conflict |
| DB 001~004 | Evaluation·Plan·Lot·Event·Outbox 기반 | Momentum v1 세부 Table과 Revision |

Legacy `evaluateMomentum`은 기존 소비자를 위해 유지하되 `legacy: true` 또는 폐기 일정으로 격리한다.

---

## 33. 구현 계획

### 33.1 Phase 0 — Legacy 격리

- 기존 Preview API 유지
- 새 v1 이름·경로 분리
- Legacy 소비자·테스트 파악
- 단일 Score가 Regime/Portfolio 결정을 하지 않음을 명시

### 33.2 Phase 1 — 순수 도메인

- Types
- Universe
- Regime
- Factor Profile
- Confidence
- Gate/Action
- Indicator

완료: Unit·Property·Golden Fixture 통과.

### 33.3 Phase 2 — Setup과 Trade Plan

- Setup Registry
- Breakout/Pullback/Earnings/Gap/Sector
- Catalyst
- Entry/Stop/Target/Time Stop
- R/R·Chase·Event Policy
- Lifecycle

완료: 불완전 Plan·Chase·Event Fail-closed.

### 33.4 Phase 3 — API와 Persistence

- `005_momentum_engine_v1.sql`
- Repository
- Evaluation·Plan·Ranking·Review API
- Audit/Outbox/Idempotency

완료: Integration·RLS·Atomicity.

### 33.5 Phase 4 — Scan과 운영 Job

- Universe Scan
- Schedule
- Event Review
- Ranking Read Model
- Due Review·Alert

### 33.6 Phase 5 — Replay와 Learning

- Point-in-time Replay
- 비용·Slippage·Gap Model
- Trade Review
- Champion/Challenger
- Drift Dashboard

---

## 34. Definition of Done

### 도메인

- [ ] Setup Score와 Regime/Portfolio/Risk가 분리됨
- [ ] Universe·Regime·7 Factor·Confidence·Gate 구현
- [ ] 5개 MVP Setup 구현
- [ ] Entry·Stop·Chase·Target/Trailing·Time Stop 구현
- [ ] Event/Gap Risk와 Catalyst Half-life 구현
- [ ] Lifecycle과 Plan Revision 구현

### 데이터

- [ ] Bar·Quote·Corporate Action Point-in-time
- [ ] Snapshot·Evidence·Model 계보
- [ ] Missing/Stale/Conflict Fail-closed
- [ ] Decimal 가격·금액·수량

### 안전

- [ ] Stop 없는 ENTER 0
- [ ] Chase 초과 ENTER 0
- [ ] Crisis 신규 Long 0
- [ ] Binary Event 무계획 ENTER 0
- [ ] Long-term 자동 전환 0
- [ ] 실제 금액·주문 승인 없음

### API/DB

- [ ] v1 API·오류 계약
- [ ] 멱등성·Audit·Outbox
- [ ] 불변 Signal/Plan Revision·RLS
- [ ] 동일 Version Ranking
- [ ] Due Review·만료

### 검증

- [ ] Unit/Property/Golden/Integration
- [ ] Point-in-time Replay
- [ ] 비용·Slippage·Gap 포함
- [ ] 동일 입력 재현 100%
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build`

문서 완료와 운영 완료를 혼동하지 않는다. 실제 Provider·DB·인증·Scheduler 연결까지 끝나야 운영 준비 완료다.

---

## 35. 후속 문서 책임

### `05_Portfolio_Engine.md`

- Allowed Risk Amount
- Position Size
- Momentum Bucket/Open Risk
- 섹터·상관·동일 종목 총노출
- Pyramiding 총 Risk

### `08_Database.md`

- 전체 ERD·Partition·Retention
- 원시 Bar/Quote 저장
- Backup/Restore

### `09_Scoring_System.md`

- Indicator 정규화
- Percentile·Outlier
- Calibration·Drift
- Cross-engine 설명성

### Risk 계층 후속 상세화 (`01_Architecture.md`·`05_Portfolio_Engine.md` 연계)

- Portfolio Drawdown
- Gap/Liquidity/Open Risk 최종 Gate
- 실행 전 재검증

후속 Engine은 Momentum 원본 Score나 Plan을 직접 수정하지 않고 새 Decision 또는 Revision으로 연결한다.

---

## 36. 결정 기록

| ID | 결정 | 이유 |
|---|---|---|
| MOM-ADR-001 | Regime을 Score가 아닌 Gate로 분리 | Setup 품질과 거래 허용도 혼합 방지 |
| MOM-ADR-002 | Portfolio/Open Risk를 Score에서 제외 | 기업/Setup 매력도와 배분 분리 |
| MOM-ADR-003 | Detection과 Plan을 별도 단계로 운영 | 탐지를 거래 추천으로 오해하지 않음 |
| MOM-ADR-004 | Entry보다 Stop·Exit 계약을 먼저 강제 | Tail Loss와 사후 합리화 방지 |
| MOM-ADR-005 | N/A와 UNKNOWN 분리 | 결측을 이용한 Gate 우회 방지 |
| MOM-ADR-006 | Special Situation 자동 ENTER 제외 | Binary·법률 위험이 일반 Setup과 다름 |
| MOM-ADR-007 | Corporate Action 조정과 거래가격 분리 | Indicator·실행 가격 왜곡 방지 |
| MOM-ADR-008 | Historical Replay에 비용·Gap 포함 | 비현실적 Edge 방지 |
| MOM-ADR-009 | Score·Confidence 분리 | 데이터 신뢰도를 숨기지 않음 |
| MOM-ADR-010 | Plan Revision 불변 저장 | Stop 확대·사후 변경 감사 가능성 |

---

## 부록 A. 대표 시나리오

### A.1 강한 Breakout, 정상 Regime

입력:

- Score 82, Confidence 84
- Risk-on Trend
- Volume Ratio 1.8
- Entry 100~102, Chase 104, Stop 96
- Target1 112, Time Stop 10

결과:

- Setup Eligible
- 현재가 101이면 `ENTER` 후보
- Portfolio/Risk/Human Approval 필요
- Engine은 수량을 결정하지 않음

### A.2 좋은 Setup, Chase 초과

입력:

- Score 86
- 현재가 108, Chase 104

결과:

- Score는 유지
- Action `AVOID` 또는 새 Pullback 대기
- Chase를 올려 진입하지 않음

### A.3 Crisis의 예외적 상대강도

입력:

- RS 95, Setup Score 80
- Regime Crisis

결과:

- 분석 Score 보존
- Risk Multiplier 0
- 신규 Long `AVOID`
- 이후 정상 Regime에서 새 평가

### A.4 Earnings Gap과 Binary Event

입력:

- 실적 Beat, Gap 12%, Volume 3x
- 다음 규제 결정 5일 후
- Event Policy 없음

결과:

- Earnings Momentum Candidate
- Event Gate 실패
- `REVIEW_REQUIRED`, ENTER 차단

### A.5 Momentum 손절과 Long-term High

입력:

- Momentum Stop 체결
- 기존 Core Evaluation 높음

결과:

- Momentum Lot 종료
- Long-term Lot은 별도 정책으로 유지 가능
- Momentum Lot을 Core로 변경하지 않음

---

## 부록 B. PR Review Checklist

### Domain

- [ ] Regime/Portfolio/Risk가 Score에 섞이지 않았는가?
- [ ] Long-term 내부 모듈을 import하지 않는가?
- [ ] Missing과 N/A가 구분되는가?
- [ ] Risk 방향이 명시됐는가?
- [ ] 가격·금액이 Decimal인가?
- [ ] 현재 시간·네트워크가 순수 함수에 숨겨지지 않았는가?

### Trade Plan

- [ ] Entry·Stop·Chase 관계가 검증되는가?
- [ ] Target 또는 Trailing이 있는가?
- [ ] Time Stop이 있는가?
- [ ] Stop 확대가 차단되는가?
- [ ] Event Policy와 만료가 있는가?

### Persistence/API

- [ ] Idempotency-Key
- [ ] Evaluation·Plan·Audit·Outbox 원자성
- [ ] RLS·Composite FK
- [ ] Signal/Plan 불변 Revision
- [ ] 동일 Version Ranking

### Test

- [ ] Crisis·Chase·Stop·Event Negative Case
- [ ] Corporate Action
- [ ] Point-in-time
- [ ] 거래비용·Slippage
- [ ] 전략 Lot 분리

---

## 부록 C. v1 기본값과 재검증

| 항목 | 기본값 | 재검증 |
|---|---:|---|
| Momentum Entry Score | 75 | Walk-forward/Shadow |
| Confidence Entry Gate | 70 | Calibration |
| 최소 가격 | USD 5 | 시장별 Universe |
| 최소 Market Cap | USD 300M | Capacity 분석 |
| 최소 ADDV20 | USD 10M | 주문 규모·Slippage |
| 최대 Spread | 50 bps | Liquidity Tier |
| 최소 상장 이력 | 120 Sessions | IPO Profile 추가 시 |
| Breakout Volume Ratio | 1.5 | Setup Replay |
| Target1 최소 R/R | 1.5 | 비용 후 Expectancy |
| 최종 최소 R/R | 2.0 | Setup별 Expectancy |
| Risk-on Volatile Multiplier | 0.60 | Regime 성과 |
| Neutral Multiplier | 0.40 | Regime 성과 |
| Risk-off Multiplier | 0.20 | Tail Risk |

변경은 환경변수 즉시 수정이 아니라 버전된 Policy/Model 변경이다.

---

## 부록 D. 01·02·03 정합성

| 상위 요구 | 04 반영 |
|---|---|
| Long-term/Momentum 독립 | 2.2, 4.2 |
| Portfolio에서만 자금 결합 | 1.2, 2.1, 35 |
| Point-in-time | 6, 30.5 |
| Decimal | 3.2, 16 |
| Evidence/Counter Evidence | 14, 19 |
| Market Regime는 허용도 조정 | 8 |
| Universe·Liquidity | 7 |
| Setup Taxonomy | 15 |
| Entry·Stop·Target·Time Stop | 16 |
| Stop 확대 금지 | 17 |
| Event/Gap Risk | 18 |
| Human-in-the-loop | 20, 21 |
| Transactional Outbox | 5.4, 26 |
| Historical Replay | 30.5 |
| Momentum Loss의 장기 전환 금지 | 2.2, A.5 |

이 문서는 01·02·03의 Engine 경계와 충돌 없이 Momentum 구현 책임을 구체화한다.
