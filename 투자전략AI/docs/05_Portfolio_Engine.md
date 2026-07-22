# 05. Portfolio Engine Specification

> 독립적으로 평가된 Long-term·Future Core·Momentum 기회를 하나의 투자 가능 자산 원장 위에서 제한하고, 현금·집중·유동성·손실 예산을 보존한 채 Risk 검토 가능한 최대 배분안을 만드는 실행 명세

- 문서 버전: `v1.0.0`
- 작성일: `2026-07-22`
- 최종 검토일: `2026-07-23`
- 명세 상태: `SPECIFICATION BASELINE`
- 구현 준비도: `R1 CORE IMPLEMENTED / R2+ OPEN` — Provider·실제 Supabase·인증·Scheduler·Broker 연결은 운영 단계
- 선행 문서: `01_Architecture.md` v2.3, `02_Investment_Philosophy.md` v2.2.1, `03_LongTerm_Engine.md` v1.0.0-draft, `04_Momentum_Engine.md` v1.0.0-draft
- 후속 문서: `08_Database.md`, `09_Scoring_System.md`
- 구현 기준 경로: `packages/core`, `apps/api`, `supabase/migrations`

---

## 0. 문서의 역할

이 문서는 좋은 기업과 좋은 Setup을 다시 평가하지 않는다. Long-term·Momentum Engine이 생성한 불변 Evaluation을 현재 Portfolio Snapshot, 현금, Position Lot, 가격, 환율, 정책과 결합해 **Portfolio 제약 안에서 검토 가능한 최대 금액·수량**으로 변환한다.

이 문서가 답해야 하는 질문은 다음과 같다.

1. `Total Investable Assets`와 Bucket별 현금을 어떻게 정의하는가?
2. 85/15 Target, Soft Range, Hard Limit은 어떻게 다른가?
3. Core·Future Core·Momentum의 Position Size를 어떻게 계산하는가?
4. Momentum은 Stop·Gap Risk에서 허용 손실과 수량을 어떻게 역산하는가?
5. 동일 기업의 전략별 Lot을 분리하면서 총노출은 어떻게 합산하는가?
6. Sector·Theme·Currency·Customer 등 Look-through 집중도를 어떻게 계산하는가?
7. 유동성·세금·비용·환율·Round Lot을 어떤 순서로 반영하는가?
8. 신규 자금, Rebalancing, Cash 유지 중 무엇을 선택하는가?
9. Drawdown과 Stress 결과를 Risk Engine에 어떻게 전달하는가?
10. Proposal이 왜 승인이나 주문이 아닌가?

### 0.1 규범 우선순위

충돌 시 다음 순서로 해석한다.

1. 법적·보안·Hard Safety·사용자 명시 승인 불변식
2. `01_Architecture.md`의 Engine 분리, Decimal, Point-in-time, Audit, Fail-closed
3. `02-4_Capital_Allocation_Portfolio_and_Risk.md`의 자본 배분 철학
4. `03_LongTerm_Engine.md`, `04_Momentum_Engine.md`의 전략별 Evaluation·Lot 계약
5. 이 문서의 Portfolio 계산·정책 계약
6. `09_Scoring_System.md`의 정규화·Calibration 계약
7. 구현 코드와 운영 설정

Portfolio 정책은 분석 Score·Thesis·Momentum Setup을 수정할 수 없다. 하위 설정으로 Hard Safety를 완화할 수 없다.

### 0.2 Portfolio와 Risk의 책임 분리

Portfolio Engine이 소유한다.

- Investable Assets와 Bucket Ledger
- 전략·Lot·기업·Sector·Theme·Currency 노출
- 현금과 신규 자금의 소속
- Position Sizing과 Portfolio Capacity
- Momentum Allowed Risk와 Open Risk 계산
- Soft/Hard Limit 판정
- 동일 기업 Cross-strategy 총노출
- Rebalancing 후보와 Stress 입력/결과
- Risk에 전달할 불변 Allocation Proposal

Risk Engine이 소유한다.

- Proposal 이후 독립적인 최종 위험 재검증
- 데이터·운영·시장·이벤트·Drawdown 거부권
- `APPROVE`, `APPROVE_WITH_REDUCTION`, `REQUIRE_MANUAL_REVIEW`, `DENY`
- Portfolio 승인 금액 이하의 최종 최대 금액

```text
Strategy Evaluation
  → Portfolio Capacity / Sizing
  → Risk Veto / Reduction
  → Decision Proposal
  → Human Approval
  → Manual Execution Record
```

Portfolio `approvedAmount`는 Risk 승인, 사용자 승인 또는 Broker 주문이 아니다.

---

## 1. 목표와 비목표

### 1.1 목표

- 장기 복리 Bucket을 Momentum 손실로부터 회계상 격리한다.
- 전략별 Cash와 Common Reserve를 중복 계산하지 않는다.
- 개별 판단 실패가 전체 투자 생존을 훼손하지 않도록 Hard Limit을 적용한다.
- 좋은 Evaluation이라도 Portfolio Fit이 낮으면 축소·대기·거부한다.
- Momentum은 Stop과 Gap Scenario로 허용 손실을 먼저 고정한다.
- 동일 기업의 Core·Future Core·Momentum Lot을 별도 관리하면서 총노출을 계산한다.
- 정상 상관과 Stress Correlation을 구분한다.
- 신규 자금으로 Drift를 먼저 복원하고 불필요한 매도를 줄인다.
- 현금 유지를 정상적인 Allocation 결과로 표현한다.
- 동일 Snapshot·Policy·Request의 결과를 재현한다.

### 1.2 비목표

Portfolio Engine은 다음을 하지 않는다.

- 기업 품질·가치평가·Thesis 재계산
- Momentum Factor·Setup·Entry·Stop 변경
- Risk `DENY` 완화
- 사용자 승인 대체
- 주문 전송·정정·취소
- 수익률 예측을 이용한 무제한 최적화
- 손실 Momentum Lot을 Long-term Lot으로 전환
- 세금만을 이유로 Thesis Broken Position 유지
- Leverage·Margin·Short·Naked Option 허용

### 1.3 MVP 범위

포함:

- 단일 사용자·복수 Portfolio
- Base Currency 1개, Asset Currency 복수
- Core·Future Core·Momentum·Cash
- 신규 자금과 단일/Batch Allocation
- 전략·기업·Sector·Theme·Currency 집중도
- Momentum Risk-per-trade/Open Risk
- Stress Scenario와 Rebalancing 제안
- Decimal 금액·가격·수량
- 수동 주문 이전 Proposal 생성

제외:

- 자동 Broker 실행
- Tax-lot 최적화 Solver
- 파생상품 Greeks·Margin
- Short·Leverage
- 기관 수준의 실시간 최적화
- 비유동 사모자산 평가

### 1.4 성공 지표

| 영역 | 지표 |
|---|---|
| 회계 | 자산·현금·Lot의 이중 계산 0건 |
| 안전 | Hard Limit 초과 신규 위험 증가 0건 |
| 전략 분리 | Momentum의 Long-term Bucket 차입·Lot 전환 0건 |
| 수량 | Stop 없는 Momentum 수량 제안 0건 |
| 승인 | Portfolio 결과만으로 실행된 주문 0건 |
| 계보 | Proposal→Evaluation·Snapshot·Policy 연결률 100% |
| 재현 | 동일 입력 Result Hash 일치율 100% |
| 만료 | 만료 Proposal 승인·실행 0건 |

수익률만으로 Portfolio Engine 품질을 평가하지 않는다. 생존성, 집중, 비용, Cash 선택, 규칙 준수를 함께 본다.

---

## 2. 핵심 설계 결정

### 2.1 Score와 Size는 분리한다

높은 Score는 후보 품질을 의미하지만 큰 Position을 자동 의미하지 않는다.

```text
Position Capacity
  = Policy Capacity
  ∩ Cash Capacity
  ∩ Company Capacity
  ∩ Exposure Capacity
  ∩ Liquidity Capacity
  ∩ Risk Budget Capacity
```

Score·Confidence는 사전 정의된 Size Tier와 Multiplier 선택에만 사용한다. 모든 Hard Capacity 이후의 결과를 늘릴 수 없다.

### 2.2 Target·Soft·Hard를 분리한다

- Target: 정상 상태의 장기 목표
- Soft Min/Max: 신규 자금 방향과 경고
- Hard Max: 신규 위험 증가 금지
- Review Zone: 기존 Drift를 즉시 강제 매도하지 않고 검토

Hard Max 위의 기존 Position은 있을 수 있다. 이 경우 신규 증가량은 0이며 축소·현금화 Proposal만 허용한다.

### 2.3 Cash는 자산이고 실패가 아니다

Cash는 다음 중 하나에 정확히 귀속한다.

- Long-term Cash
- Momentum Cash
- Common Reserve

Common Reserve를 별도 운영하면 Long-term+Momentum Deployable Hard Max의 합을 Reserve만큼 낮춘다. 같은 Cash를 Bucket 내부와 Reserve에 동시에 기록하지 않는다.

### 2.4 전략 Lot은 분리하고 기업 총노출은 합산한다

```text
Company Gross Exposure
  = Core Lots
  + Future Core Lots
  + Momentum Lots
```

단, Exit Policy와 성과 Attribution은 Lot별로 분리한다. Momentum Stop은 Core Lot을 청산하지 않고, Core Thesis는 Momentum Stop을 취소하지 않는다.

### 2.5 Momentum Size는 허용 손실에서 역산한다

```text
Allowed Risk Amount
  → Scenario Loss per Unit
  → Raw Quantity
  → Liquidity / Notional / Cash Cap
  → Executable Quantity
```

요청 금액을 먼저 정한 뒤 Stop을 억지로 좁히지 않는다.

### 2.6 New Money First

목표 Drift는 가능한 경우 신규 자금·배당·매도대금으로 먼저 조정한다. Calendar만으로 좋은 장기 Position을 기계적으로 매도하지 않는다.

### 2.7 Proposal은 짧게 만료된다

가격·환율·Portfolio 상태·유동성은 변한다. 모든 증가 Proposal은 `expiresAt`을 가지며 승인 직전에 같은 Portfolio Snapshot 이후의 변경 여부를 재확인한다.

---

## 3. 용어와 불변식

### 3.1 용어

| 용어 | 의미 |
|---|---|
| Investable Assets | 생활·세금·단기 필요 자금을 제외한 운용 가능 순자산 |
| NAV | Base Currency로 환산한 Portfolio 순자산 |
| Bucket | 전략별 자본·현금의 회계상 구획 |
| Gross Exposure | Long Market Value의 합, Cash 제외 |
| Net Exposure | Long-Short; MVP Long-only에서는 Gross와 동일 |
| Company Exposure | 모든 전략 Lot을 합친 동일 기업 노출 |
| Open Risk | Stop/Gap Scenario 기준 남은 Momentum 예상 손실 |
| Capacity | 정책을 위반하지 않고 추가 가능한 최대 금액 |
| Drift | 현재 비중과 Target의 차이 |
| Look-through | 법적 섹터가 아닌 경제적 민감도 기준 노출 |

### 3.2 불변식

1. 모든 금액·가격·수량은 Decimal String으로 계산한다.
2. Weight·Multiplier만 제한적으로 Number를 사용한다.
3. Portfolio Snapshot의 `asOf <= generatedAt`이어야 한다.
4. 모든 Asset Value는 동일 FX Snapshot으로 Base Currency 환산한다.
5. Liability와 Reserved Cash를 Investable Assets에 포함하지 않는다.
6. Lot 하나는 전략 하나만 가진다.
7. Momentum은 Momentum Bucket만 사용한다.
8. Core/Future Core는 Long-term Bucket만 사용한다.
9. Company Limit은 전략을 가로질러 합산한다.
10. Risk는 Portfolio 승인 금액을 늘릴 수 없다.
11. 사용자도 Portfolio/Risk 한도를 늘리는 수정 승인을 할 수 없다.
12. 만료·Stale·불완전 Snapshot은 신규 위험을 차단한다.
13. Historical Replay는 운영 Ledger를 변경하지 않는다.
14. Leverage와 음수 Cash는 허용하지 않는다.

---

## 4. 시스템 경계와 패키지 구조

```text
Long-term Evaluation ─┐
Momentum Evaluation ──┼─→ Candidate Adapter
Cross Signal ─────────┘
                              ↓
Portfolio Snapshot → Ledger / Exposure / Cash
                              ↓
Policy → Capacity → Sizing → Stress
                              ↓
                 Allocation Proposal
                              ↓
                         Risk Engine
```

### 4.1 목표 구조

```text
packages/core/src/portfolio-v1/
├── types.ts
├── policy.ts
├── ledger.ts
├── exposure.ts
├── sizing.ts
├── open-risk.ts
├── stress.ts
├── batch.ts
├── rebalance.ts
├── engine.ts
└── index.ts
```

### 4.2 의존성 규칙

- Strategy Engine은 Portfolio 상태를 입력으로 받아 Score를 바꾸지 않는다.
- Portfolio는 Strategy Evaluation의 ID·Action·Confidence·계획만 읽는다.
- Portfolio는 Risk Decision을 만들지 않는다.
- Risk는 Portfolio Proposal을 읽고 금액을 유지·축소·거부한다.
- Decision은 두 결과와 사용자 승인을 결합한다.
- Execution은 승인된 Decision만 참조한다.

---

## 5. 시간·금액·환율 계약

### 5.1 Decimal

금액, 가격, 수량, FX 환산 결과는 JSON에서 문자열이다.

```json
{
  "portfolioValue": "125000.37",
  "requestedAmount": "2500",
  "quantity": "17",
  "unitRisk": "6.25"
}
```

지수 표기, `NaN`, `Infinity`, 음수 0을 금지한다.

### 5.2 Portfolio Snapshot

```ts
interface PortfolioSnapshotV1 {
  id: string;
  portfolioId: string;
  userId: string;
  baseCurrency: CurrencyCode;
  asOf: string;
  positions: PositionSnapshot[];
  cashBalances: CashBalance[];
  liabilitiesBase: DecimalString;
  reservedCashBase: DecimalString;
  fxSnapshotId: string;
  marketSnapshotIds: string[];
  complete: boolean;
  anomalyFlags: string[];
}
```

### 5.3 FX

```ts
interface FxRate {
  pair: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: DecimalString;
  asOf: string;
  snapshotId: string;
}
```

- Base Currency와 동일하면 Rate 1
- 교차환율은 경로와 Source를 저장
- Bid/Ask가 중요한 실행 계산에는 Mid만 사용하지 않음
- FX Snapshot이 오래되거나 Currency가 누락되면 신규 배분 차단
- 가격 P&L과 FX P&L은 Attribution에서 분리

### 5.4 Session과 신선도

- Position Price는 완료된 Session 또는 명시적 실시간 Quote
- Momentum Proposal은 Plan의 Session과 Price Session 일치
- Long-term Proposal도 Market Price 기준일을 보존
- Snapshot 이후 Execution·Cash 예약이 있으면 재계산

---

## 6. Ledger와 NAV

### 6.1 Position Snapshot

```ts
interface PositionSnapshot {
  lotId: string;
  companyId: string;
  securityId: string;
  strategy: 'CORE' | 'FUTURE_CORE' | 'MOMENTUM';
  quantity: DecimalString;
  marketPrice: DecimalString;
  assetCurrency: CurrencyCode;
  marketValueBase: DecimalString;
  costBasisBase: DecimalString;
  stopPrice?: DecimalString;
  gapScenarioLossPerUnitBase?: DecimalString;
  sectorCode: string;
  industryCode: string;
  exposureTags: EconomicExposure[];
  liquidityTier: 'L1' | 'L2' | 'L3' | 'INELIGIBLE';
}
```

### 6.2 Cash Balance

```ts
interface CashBalance {
  id: string;
  currency: CurrencyCode;
  amount: DecimalString;
  amountBase: DecimalString;
  owner: 'LONG_TERM' | 'MOMENTUM' | 'COMMON_RESERVE';
  available: boolean;
  settlementDate?: string;
}
```

미결제 매도대금은 Settlement 정책에 따라 `available=false`다. 주문 예약 금액은 사용 가능 Cash에서 뺀다.

### 6.3 NAV 공식

```text
Gross Asset Value
  = Σ Position Market Value Base
  + Σ Cash Amount Base

Investable NAV
  = Gross Asset Value
  - Liabilities Base
  - Reserved Non-investable Cash Base
```

`Investable NAV <= 0`이면 신규 위험을 차단한다.

### 6.4 Ledger 검증

- Lot ID 중복 금지
- Company/Security Identity 필수
- Strategy와 Bucket 일치
- 가격·수량 양수
- Cash Owner 단일값
- 통화·FX 경로 완전
- Market Value 재계산값과 입력값 허용 오차 검증
- Portfolio 소유권 일치

---

## 7. Bucket Policy v1

### 7.1 기본값

| Bucket | Target | Soft Min | Soft Max | Hard Max |
|---|---:|---:|---:|---:|
| Long-term Total | 85% | 80% | 90% | 90% |
| Momentum Total | 15% | 10% | 20% | 20% |
| Future Core | 15% | 5% | 18% | 20% |

Future Core는 Long-term의 하위 Bucket이며 Long-term과 별도로 NAV에 더하지 않는다.

### 7.2 Bucket Weight

```text
Long-term Weight
  = (Core + Future Core + Long-term Cash) / Investable NAV

Momentum Weight
  = (Momentum Positions + Momentum Cash) / Investable NAV
```

Common Reserve가 있으면 별도 Weight를 표시하고 Long-term/Momentum Deployable Limit에서 차감한다.

### 7.3 Drift 상태

```ts
type LimitState =
  | 'BELOW_SOFT_MIN'
  | 'WITHIN_TARGET_RANGE'
  | 'ABOVE_SOFT_MAX'
  | 'AT_HARD_MAX'
  | 'ABOVE_HARD_MAX';
```

- Below: 신규 자금 우선 후보
- Above Soft: 신규 증가 축소 또는 중단
- At/Above Hard: 신규 증가 0
- 기존 초과는 Risk·세금·Thesis를 검토해 축소 Proposal 생성

### 7.4 Bucket 간 이동

Bucket Transfer는 암묵적으로 일어나지 않는다.

필수:

- Transfer ID
- From/To Bucket
- Amount/Currency
- Policy 이유
- Portfolio Snapshot
- Risk 재검증
- 사용자 승인
- Audit

Momentum 손실을 Long-term Cash로 자동 보충하지 않는다.

---

## 8. Position Policy v1

### 8.1 Core

| Size Tier | 목표 범위 | 조건 |
|---|---:|---|
| STARTER | 1~3% | 신규·검증 책임 생성 |
| NORMAL | 3~8% | Core Eligibility·Confidence 충족 |
| HIGH_CONVICTION | 8~10% | 분산된 수익원·낮은 중복 위험 |
| CONCENTRATION_REVIEW | 10~15% | 신규 증가 기본 중단, 명시 검토 |

v1 일반 `maxSinglePosition=10%`다. 사용자별 집중 정책을 별도 승인한 경우에도 Hard Safety·Risk를 우회할 수 없다.

### 8.2 Future Core

| Stage | 최대 기본 비중 |
|---|---:|
| WATCH/RESEARCH | 0% |
| CANDIDATE Starter | 1.5% |
| STRONG_CANDIDATE | 3% |
| FUTURE_CORE | 6% |

Future Core 전체 Hard Max는 20%, 단일 Position Hard Max는 6%다. 가격 하락만으로 Size Tier를 올리지 않는다.

### 8.3 Momentum

Momentum 단일 기업 총 Notional은 일반 Company Limit과 Momentum Bucket Capacity를 모두 통과해야 한다. Size는 Risk per Trade에서 역산하며 Setup Score를 Notional에 직접 곱하지 않는다.

### 8.4 Dual Lot

Dual High여도 다음을 모두 계산한다.

- Core/Future Core Lot Capacity
- Momentum Lot Capacity
- Company Gross Capacity
- Sector/Theme Capacity
- Momentum Open Risk Capacity

가장 작은 Capacity를 사용한다.

---

## 9. Opportunity Quality와 Size Tier

### 9.1 Long-term Size Eligibility

```ts
interface LongTermSizingSignal {
  evaluationId: string;
  profile: 'CORE' | 'FUTURE_CORE';
  action: 'ACCUMULATE' | 'BUY_ON_WEAKNESS' | 'HOLD' | 'WATCH';
  score: number;
  confidence: number;
  valuationClassification: string;
  thesisStatus: string;
  stage: string;
}
```

- `HOLD/WATCH`: 신규 금액 0 또는 Review
- Thesis Broken/Hard Gate: 증가 금지
- Core 신규 일반 Size: Score·Confidence Gate 이후 Tier 선택
- Future Core: Stage별 Max가 Score보다 우선

### 9.2 Momentum Size Eligibility

```ts
interface MomentumSizingSignal {
  evaluationId: string;
  setupId: string;
  action: 'ENTER' | 'WAIT' | 'AVOID' | 'REVIEW_REQUIRED';
  score: number;
  confidence: number;
  marketRegimeMultiplier: number;
  liquidityTier: string;
  tradePlanId?: string;
}
```

`ENTER`와 유효 Plan이 아니면 신규 수량 0이다.

### 9.3 Multiplier 기본값

Size Multiplier는 Score를 재평가하지 않는다.

| 조건 | Multiplier 예시 |
|---|---:|
| High Quality + High Confidence | 1.00 |
| Entry Gate 최소 통과 | 0.60 |
| Confidence 70~79 | 0.75 |
| Partial Data Cap | 0~0.50 |
| Risk-on Volatile | Regime 0.60 |
| Neutral Range | Regime 0.40 |
| Risk-off Review | 0 until approval |
| Crisis | 0 |

Multiplier 곱셈 결과는 모든 Hard Max 이하에서만 유효하다.

---

## 10. Momentum Risk Sizing

### 10.1 Base Risk per Trade

v1 기본:

| 상태 | NAV 대비 위험 |
|---|---:|
| 표준 | 0.50% |
| 최소 | 0.10% |
| High-quality 검토 상한 | 0.75% |
| Pause/Crisis | 0% |

### 10.2 Allowed Risk

```text
Base Risk Amount = Investable NAV × Base Risk Rate

Allowed Risk Amount
  = Base Risk Amount
  × Setup Quality Multiplier
  × Confidence Multiplier
  × Regime Multiplier
  × Drawdown Multiplier
  × Liquidity Multiplier
```

각 Multiplier 범위는 0~1이다. 결과는 Momentum Open Risk Remaining보다 클 수 없다.

### 10.3 Scenario Loss per Unit

```text
Stop Loss per Unit
  = Reference Entry - Initial Stop

Scenario Loss per Unit
  = max(
      Stop Loss per Unit + Expected Cost per Unit,
      Gap Scenario Loss per Unit
    )
```

Gap Scenario가 필요한 Setup인데 없으면 수량 0이다.

### 10.4 Quantity

```text
Raw Quantity
  = floor(Allowed Risk Amount / Scenario Loss per Unit)

Risk Notional
  = Raw Quantity × Reference Entry
```

그 후 다음 Cap을 적용한다.

1. Momentum Bucket Cash
2. Momentum Bucket Hard Max
3. Company Gross Hard Max
4. Sector/Theme Hard Max
5. Liquidity Participation Capacity
6. Minimum Lot/Round Lot

```text
Executable Quantity
  = floor_to_lot(
      min(Raw Quantity, Capacity Quantity...),
      lotSize
    )
```

수량이 Minimum Economic Size 미만이면 `WAIT` 또는 `REJECTED`다.

### 10.5 Open Risk

```text
Position Open Risk
  = Quantity × max(Current Price - Active Stop, Gap Scenario Loss Per Unit)

Portfolio Momentum Open Risk
  = Σ Position Open Risk
```

현재가가 Stop 아래이거나 Halt 상태이면 정규 Stop 체결을 가정하지 않고 Event/Gap Assessment를 사용한다.

### 10.6 v1 Open Risk Limit

- 기본 Momentum Open Risk Hard Max: NAV의 2.0%
- 동일 Sector Open Risk Hard Max: NAV의 0.75%
- 동일 Theme Open Risk Hard Max: NAV의 1.0%
- 단일 Position 위험 기본 상한: NAV의 0.75%

운영 수치는 버전된 Policy이며 Replay/검증 없이 변경하지 않는다.

---

## 11. Exposure Model

### 11.1 Dimension

- Strategy/Bucket
- Company
- Security
- Sector/Industry
- Geography
- Currency
- Customer/Supplier
- Technology/Theme
- Revenue Model
- Regulatory Regime
- Interest-rate/Commodity Sensitivity

### 11.2 Economic Exposure

```ts
interface EconomicExposure {
  dimension: 'THEME' | 'CUSTOMER' | 'SUPPLIER' | 'MACRO' | 'REGULATORY';
  key: string;
  sensitivity: number;
  confidence: number;
  evidenceIds: string[];
}
```

Look-through Amount:

```text
Market Value Base × Sensitivity × Confidence Weight
```

Confidence가 낮은 Exposure를 0으로 만들지 않는다. UNKNOWN Critical Exposure는 Concentration Review를 요구한다.

### 11.3 기본 Hard Limit

| Dimension | 기본 Hard Max |
|---|---:|
| Company Gross | 10% |
| Future Core Company | 6% |
| Sector Gross | 30% |
| Industry Gross | 20% |
| Theme Look-through | 25% |
| Single Foreign Currency Gross | 50% Review, 65% Hard |
| Momentum Sector Open Risk | 0.75% NAV |

Core 집중 정책은 별도 버전으로만 변경한다. Hard Limit은 단순 종목 수로 대체하지 않는다.

### 11.4 Correlation

가격 상관, Fundamental Correlation, Event Correlation을 별도 저장한다.

```ts
interface CorrelationAssessment {
  leftExposureKey: string;
  rightExposureKey: string;
  normalCorrelation?: number;
  stressCorrelation: number;
  fundamentalLink: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  eventLink: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  asOf: string;
}
```

정상 가격 상관이 낮아도 Fundamental/Event Link가 High면 분산으로 인정하지 않는다.

---

## 12. Liquidity Capacity

### 12.1 ADDV Capacity

```text
Daily Participation Capacity
  = ADDV × Max Participation Rate

Exit Days
  = Position Market Value / Daily Participation Capacity
```

v1 기본 Max Participation:

- L1: 5%
- L2: 3%
- L3: 1%
- Ineligible: 0%

### 12.2 Stress Liquidity

정상 ADDV의 30~50%, Spread 2~4배, Gap/Halt를 가정한다. Exit Days가 사용자 정책을 넘으면 Size를 줄인다.

### 12.3 Momentum

Momentum Plan Horizon보다 예상 Exit Days가 길면 진입 금지한다. 현재가가 Entry Zone 안이어도 유동성 Capacity가 우선한다.

### 12.4 Long-term

Long-term은 긴 Horizon이지만 Thesis Break·자금 필요 시 청산 가능성을 고려한다. Future Core·Special Situation에는 더 엄격한 Haircut을 적용한다.

---

## 13. Cash와 신규 자금

### 13.1 Investable New Capital

```text
Confirmed Inflow
  - Emergency Fund Deficit
  - Near-term Obligations
  - Tax Reserve
  - Debt Repayment Priority
  = Investable New Capital
```

0 이하이면 투자 Proposal을 만들지 않는다.

### 13.2 우선순위

1. 생활 안전·세금 Reserve
2. 음수·미결제 Cash 복원
3. Hard Limit 위반 해소
4. Long-term Soft Min 복원
5. 유효 Core/Future Core 후보
6. Momentum Target 미달 + `ENTER` Setup
7. Cash 유지

### 13.3 Batch Allocation

여러 후보를 동시에 계산할 때 순차 계산 순서에 따라 결과가 달라지지 않도록 한다.

- 모든 후보를 같은 Snapshot으로 평가
- Constraint를 공동 적용
- 안정적 Tie-break 사용
- 승인 금액 합계가 Cash를 초과하지 않음
- 작은 Score 차이로 전액 집중하지 않음
- 남는 금액은 Cash

### 13.4 Tie-break

1. Hard Gate 통과
2. Underweight Bucket 복원
3. 높은 Confidence
4. 더 큰 Margin of Safety 또는 R/R
5. 낮은 Concentration 증가
6. 낮은 비용/세금
7. Stable ID

---

## 14. Rebalancing

### 14.1 Trigger

- 신규 자금
- Bucket Hard/Soft Drift
- Company/Sector/Theme Limit
- Thesis Break·Stage 변화
- Momentum Stop/Close
- FX 급변
- 사용자 생활 자금 변경
- 정기 검토

### 14.2 Action

```ts
type RebalanceAction =
  | 'NEW_MONEY_TO_UNDERWEIGHT'
  | 'FREEZE_NEW_RISK'
  | 'REDUCE_POSITION'
  | 'TRANSFER_CASH'
  | 'REVIEW_REQUIRED'
  | 'NO_ACTION';
```

### 14.3 매도 우선순위

기본 검토 순서:

1. Thesis Broken
2. 규칙 위반/무효 Momentum
3. 기대값 소멸 Momentum
4. Weak Future Core
5. 과도한 중복 노출
6. 극단적 고평가 Core

세금·비용·시장 충격을 고려하지만 Thesis Broken을 세금으로 영구 유지하지 않는다.

### 14.4 Drift와 승자

가격 상승으로 Core가 Target을 넘었다는 이유만으로 자동 매도하지 않는다. Hard Review에서 단일 실패 영향·Valuation·사업 집중·세후 대안을 비교한다.

---

## 15. Drawdown 상태

Portfolio는 Drawdown을 측정하고 Size Multiplier·Review Context를 만든다. 최종 중단·거부는 Risk가 재검증한다.

### 15.1 상태

```ts
type DrawdownState =
  | 'NORMAL'
  | 'CAUTION'
  | 'REDUCED_RISK'
  | 'PAUSE'
  | 'REVIEW_REQUIRED';
```

### 15.2 Momentum v1

| Peak 대비 전략 Drawdown | 상태 | 신규 Risk Multiplier |
|---|---|---:|
| < 3% | NORMAL | 1.00 |
| 3~5% | CAUTION | 0.75 |
| 5~8% | REDUCED_RISK | 0.50 |
| 8~10% | PAUSE | 0.00 |
| >=10% 또는 모델 이상 | REVIEW_REQUIRED | 0.00 |

연속 손실·Slippage Drift·규칙 위반은 더 엄격한 상태를 만들 수 있다.

### 15.3 Long-term

가격 Drawdown만으로 자동 Stop을 만들지 않는다. Thesis, Fundamental, Valuation, Concentration을 검토한다. 단, 전체 생존·생활 자금·Hard Concentration은 별개다.

### 15.4 Total Portfolio

Total Drawdown이 정책 임계치에 도달하면 신규 Momentum Risk, 고위험 Future Core, 공통 Theme 집중을 먼저 검토한다. 무조건적인 저점 매도 정책은 사용하지 않는다.

---

## 16. Stress Testing

### 16.1 Scenario 계약

```ts
interface PortfolioStressScenario {
  id: string;
  version: string;
  name: string;
  marketShockPercent: number;
  sectorShocks: Record<string, number>;
  themeShocks: Record<string, number>;
  currencyShocks: Record<string, number>;
  liquidityHaircut: number;
  momentumGapMultiplier: number;
  assumptions: string[];
}
```

### 16.2 기본 Scenario

- 시장 -10/-20/-35%
- 금리 급등
- AI CapEx 축소
- 신용 경색
- 달러 급등
- 주요 Sector 규제
- 최대 Company 실적 충격
- Future Core 자금조달 실패
- Momentum Gap-through-Stop

### 16.3 결과

```ts
interface PortfolioStressResult {
  scenarioId: string;
  estimatedLossBase: SignedDecimalString;
  estimatedLossPercent: number;
  bucketLosses: Record<string, SignedDecimalString>;
  topContributors: StressContribution[];
  breachedLimitIds: string[];
  cashAfterStressBase: DecimalString;
  forcedSaleRisk: boolean;
}
```

Stress는 정밀 예측이 아니라 취약성 순위와 생존 가능성을 확인한다.

---

## 17. Policy 계약

```ts
interface PortfolioPolicyV1 {
  id: string;
  version: string;
  baseCurrency: CurrencyCode;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  effectiveFrom: string;

  longTerm: AllocationLimit;
  momentum: AllocationLimit;
  futureCore: AllocationLimit;
  commonReserveTarget: number;

  corePositionHardMax: number;
  futureCorePositionHardMax: number;
  companyGrossHardMax: number;
  sectorGrossHardMax: number;
  industryGrossHardMax: number;
  themeGrossHardMax: number;
  currencyGrossReviewThreshold: number;
  currencyGrossHardMax: number;

  momentumBaseRiskPerTrade: number;
  momentumMaxRiskPerTrade: number;
  momentumOpenRiskHardMax: number;
  momentumSectorOpenRiskHardMax: number;
  momentumThemeOpenRiskHardMax: number;

  liquidityParticipationByTier: Record<string, number>;
  minimumEconomicAmountBase: DecimalString;
  proposalTtlMinutes: number;
  leverageAllowed: false;
}
```

### 17.1 Policy 검증

- Target 합과 Reserve 관계 일치
- Soft Min <= Target <= Soft Max <= Hard Max
- Future Core는 Long-term Hard Max 이하
- Position Max <= Company Max 또는 명시적 예외
- Risk per Trade <= Open Risk Max
- Multiplier·Weight 0~1
- Leverage false
- Effective Date와 Version 필수

### 17.2 변경

정책 변경은 기존 Proposal·Evaluation을 재작성하지 않는다. 새 요청부터 새 Policy Version을 사용한다. Hard Safety 변경은 Architecture Revision을 요구한다.

---

## 18. Allocation Request

```ts
interface AllocationRequestV1 {
  id: string;
  portfolioId: string;
  userId: string;
  generatedAt: string;
  expiresAt: string;
  mode: 'SINGLE' | 'NEW_CAPITAL' | 'REBALANCE' | 'HISTORICAL_REPLAY';
  strategy: 'LONG_TERM' | 'MOMENTUM';
  lotStrategy: 'CORE' | 'FUTURE_CORE' | 'MOMENTUM';
  fundingBucket: 'LONG_TERM' | 'MOMENTUM';
  companyId: string;
  securityId: string;
  sectorCode: string;
  industryCode: string;
  themeKeys: string[];
  action: 'BUY' | 'ACCUMULATE' | 'ENTER';
  requestedAmountBase?: DecimalString;
  requestedRiskAmountBase?: DecimalString;
  currentPrice: DecimalString;
  assetCurrency: CurrencyCode;
  fxRateToBase: DecimalString;
  sizingSignal: LongTermSizingSignalV1 | MomentumSizingSignalV1;
  momentumRiskPlan?: MomentumRiskPlanInput;
  portfolioSnapshot: PortfolioSnapshotV1;
  policy: PortfolioPolicyV1;
  liquidity: LiquidityCapacityInputV1;
  snapshotIds: string[];
}
```

운영 API는 Evaluation ID와 Snapshot을 조회해 입력을 구성한다. 클라이언트가 현재 Weight·Capacity를 임의로 선언해 한도를 우회할 수 없다.

---

## 19. Capacity 계산

### 19.1 공통 Capacity

```text
Requested Capacity
Cash Capacity
Strategy Bucket Capacity
Lot Sub-bucket Capacity
Company Gross Capacity
Sector Capacity
Industry Capacity
Theme Capacity
Liquidity Capacity
Momentum Risk Capacity (Momentum only)
```

각 Capacity는 Decimal Amount와 Reason Code를 반환한다.

### 19.2 최종 Amount

```text
Portfolio Approved Amount
  = min(all applicable capacities)
```

- 0: `REJECTED`
- 요청보다 작고 경제적 최소 이상: `REDUCED`
- 요청과 같음: `APPROVED`
- 데이터/Review 조건: `WAIT`

### 19.3 Quantity

- Long-term: Approved Amount / Current Price, 정책 Lot Size로 내림
- Momentum: Risk Quantity와 Notional Capacity Quantity 중 최소
- Fractional Share 지원 여부는 Security Metadata에 저장
- 내림 후 남는 Cash는 원 Bucket에 남김

### 19.4 Price Drift

Proposal 생성 후 가격이 움직이면:

- 허용 Tolerance 안: 수량/금액 재검증
- Capacity 초과: 금액 하향
- Entry/Chase 위반: Momentum Proposal 무효
- 가격 하락: 자동 수량 상향 금지, 새 Proposal 필요

---

## 20. Gate와 상태

### 20.1 Portfolio Gate

| Gate | 실패 효과 |
|---|---|
| `PORTFOLIO_OWNERSHIP_VALID` | REJECTED |
| `SNAPSHOT_COMPLETE` | WAIT/REJECTED |
| `POINT_IN_TIME_VALID` | REJECTED |
| `CURRENCY_CONVERSION_VALID` | WAIT |
| `EVALUATION_ACTION_ELIGIBLE` | REJECTED |
| `LOT_STRATEGY_MATCH` | REJECTED |
| `CASH_AVAILABLE` | REDUCED/REJECTED |
| `BUCKET_CAPACITY_AVAILABLE` | REDUCED/REJECTED |
| `COMPANY_CAPACITY_AVAILABLE` | REDUCED/REJECTED |
| `EXPOSURE_CAPACITY_AVAILABLE` | REDUCED/REVIEW |
| `LIQUIDITY_CAPACITY_AVAILABLE` | REDUCED/REJECTED |
| `MOMENTUM_RISK_CAPACITY_AVAILABLE` | REDUCED/REJECTED |
| `PROPOSAL_NOT_EXPIRED` | REJECTED |

### 20.2 결과 상태

```ts
type PortfolioProposalStatus =
  | 'APPROVED'
  | 'REDUCED'
  | 'WAIT'
  | 'REJECTED';
```

Portfolio의 `APPROVED`는 “Portfolio 제약상 Risk 검토 가능”을 뜻한다.

---

## 21. 최종 출력 계약

```ts
interface AllocationProposalV1 {
  id: string;
  portfolioId: string;
  companyId: string;
  securityId: string;
  generatedAt: string;
  expiresAt: string;
  mode: AllocationRequestV1['mode'];
  strategy: 'LONG_TERM' | 'MOMENTUM';
  lotStrategy: 'CORE' | 'FUTURE_CORE' | 'MOMENTUM';
  action: 'BUY' | 'ACCUMULATE' | 'ENTER';
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;

  requestedAmount: DecimalString;
  approvedAmount: DecimalString;
  executableQuantity: DecimalString;
  referencePrice: DecimalString;
  allowedRiskAmount?: DecimalString;
  scenarioLossPerUnit?: DecimalString;
  projectedOpenRisk?: DecimalString;

  status: PortfolioProposalStatus;
  capacities: CapacityResult[];
  currentWeights: PortfolioWeights;
  projectedWeights: PortfolioWeights;
  exposureChanges: ExposureChange[];
  constraintsTriggered: string[];
  reasons: string[];
  riskHandoff: PortfolioRiskHandoff;

  evaluationId: string;
  tradePlanId?: string;
  portfolioSnapshotId: string;
  snapshotIds: string[];
  policyVersionId: string;
  operationalStateChangeAllowed: boolean;
  resultHash: string;
}
```

### 21.1 Capacity Result

```ts
interface CapacityResult {
  capacityId: string;
  status: 'AVAILABLE' | 'LIMITED' | 'EXHAUSTED' | 'UNKNOWN';
  maximumAdditionalAmount: DecimalString;
  currentValue: DecimalString;
  projectedValue: DecimalString;
  hardLimitValue: DecimalString;
  reasonCode: string;
}
```

### 21.2 Risk Handoff

```ts
interface PortfolioRiskHandoff {
  portfolioValueBase: DecimalString;
  approvedAmountBase: DecimalString;
  currentCompanyExposureBase: DecimalString;
  projectedCompanyExposureBase: DecimalString;
  currentMomentumOpenRiskBase: DecimalString;
  projectedMomentumOpenRiskBase: DecimalString;
  drawdownState: DrawdownState;
  stressResultIds: string[];
  requiresManualReview: boolean;
  flags: string[];
}
```

Risk Engine은 이 값과 최신 Snapshot을 독립 재검증한다.

---

## 22. Batch Capital Allocation

```ts
interface CapitalAllocationDecisionV1 {
  id: string;
  portfolioId: string;
  generatedAt: string;
  dataAsOf: string;
  capitalSource: CapitalSource;
  availableAmount: DecimalString;
  currency: CurrencyCode;
  currentWeights: PortfolioWeights;
  targetWeights: PortfolioWeights;
  projectedWeights: PortfolioWeights;
  proposals: AllocationProposalV1[];
  cashRetained: DecimalString;
  constraintsTriggered: string[];
  stressSummary: string;
  finalRecommendation: string;
  snapshotIds: string[];
  policyVersionId: string;
  resultHash: string;
}
```

Batch는 각 Item의 개별 Capacity와 전체 Cash·Exposure Capacity를 동시에 만족해야 한다.

---

## 23. API 설계

```text
GET  /api/v1/portfolios/:id
GET  /api/v1/portfolios/:id/exposures
GET  /api/v1/portfolios/:id/open-risk
POST /api/v1/portfolio/policies/validate
POST /api/v1/allocations/proposals
GET  /api/v1/allocations/proposals/:id
POST /api/v1/allocations/new-capital
GET  /api/v1/allocations/new-capital/:id
POST /api/v1/portfolios/:id/rebalance
GET  /api/v1/portfolio/rebalance-reviews/:id
POST /api/v1/portfolios/:id/stress-tests
GET  /api/v1/portfolio/stress-results/:id
POST /api/v1/allocations/replays
```

상태 변경 POST는 `Idempotency-Key`가 필수다.

### 23.1 오류

| HTTP | Code | 의미 |
|---:|---|---|
| 400 | `INVALID_PORTFOLIO_REQUEST` | Schema·Decimal 오류 |
| 403 | `PORTFOLIO_OWNERSHIP_MISMATCH` | 소유권 불일치 |
| 409 | `PORTFOLIO_SNAPSHOT_CONFLICT` | Snapshot 이후 Ledger 변경 |
| 409 | `POLICY_VERSION_CONFLICT` | 비활성·혼합 Policy |
| 410 | `ALLOCATION_PROPOSAL_EXPIRED` | 만료 |
| 422 | `PORTFOLIO_SNAPSHOT_INCOMPLETE` | 가격·FX·Lot 누락 |
| 422 | `BUCKET_CAPACITY_EXHAUSTED` | 전략 Capacity 없음 |
| 422 | `MOMENTUM_RISK_CAPACITY_EXHAUSTED` | Open Risk 없음 |
| 423 | `PORTFOLIO_REVIEW_REQUIRED` | 집중·Stress 수동 검토 |
| 404 | `ALLOCATION_PROPOSAL_NOT_FOUND` | Proposal 없음 |

### 23.2 읽기 모델

Portfolio 응답은 다음을 분리한다.

- NAV와 Cash
- Bucket Weight/Drift
- Position Lot
- Company/Sector/Theme/Currency Exposure
- Momentum Open Risk
- Hard/Soft Breach
- Pending Proposal/Reserved Cash

---

## 24. 저장 모델

R1에서 `006_portfolio_engine_v1.sql`을 추가했다. 적용된 기존 Migration은 수정하지 않고 후속 변경은 새 Migration으로 추가한다.

### 24.1 Table

```text
portfolio_policies
portfolio_snapshots
portfolio_position_snapshots
portfolio_cash_balances
economic_exposure_definitions
portfolio_exposure_snapshots
momentum_open_risk_snapshots
portfolio_stress_scenarios
portfolio_stress_results
allocation_proposals_v1
allocation_capacity_results
capital_allocation_decisions_v1
bucket_transfer_requests
portfolio_rebalance_reviews
```

기존 `portfolios`, `position_lots`, `allocation_proposals`, `risk_decisions`, `decisions`, `execution_records`와 ID로 연결한다.

### 24.2 제약

- 사용자별 Composite FK
- Decimal Amount >= 0, 투자/수량 > 0
- Weight/Multiplier 0~1
- Snapshot `asOf <= createdAt`
- Proposal `generatedAt < expiresAt`
- Approved <= Requested와 모든 Capacity
- Momentum Quantity와 Risk 식 일치
- Historical Replay는 운영 변경 false
- Proposal/Snapshot/Capacity 불변
- Strategy Lot/Bucket 일치
- Leverage false

### 24.3 Index

- Portfolio Snapshot 최신 조회
- Company/Sector/Theme Exposure
- Open Risk by Setup/Sector
- Proposal 만료·상태
- Policy Active partial unique
- Rebalance Due Review

### 24.4 RLS

- 사용자는 자신의 Portfolio 읽기
- Service Role만 Snapshot·Exposure·Proposal 결과 삽입
- Policy 변경은 사용자 소유권과 상태 전이 검증
- 다른 사용자의 Evaluation·Lot·Snapshot 참조 차단
- Audit/Outbox는 서버 전용

---

## 25. Event와 Job

### 25.1 Job

```ts
type PortfolioJobType =
  | 'PORTFOLIO_SNAPSHOT_BUILD'
  | 'EXPOSURE_REFRESH'
  | 'OPEN_RISK_REFRESH'
  | 'NEW_CAPITAL_ALLOCATION'
  | 'REBALANCE_REVIEW'
  | 'STRESS_TEST'
  | 'PROPOSAL_EXPIRY'
  | 'PORTFOLIO_HISTORICAL_REPLAY';
```

### 25.2 Event

```text
PortfolioSnapshotCreated
PortfolioExposureUpdated
PortfolioLimitApproached
PortfolioLimitExceeded
MomentumOpenRiskUpdated
AllocationProposalCreated
AllocationProposalReduced
AllocationProposalRejected
AllocationProposalExpired
CapitalAllocationDecisionCreated
BucketTransferRequested
PortfolioReviewRequired
PortfolioRebalanceReviewed
PortfolioStressCompleted
```

### 25.3 멱등성

- Snapshot: `portfolioId + asOf + ledgerVersion`
- Exposure: `portfolioSnapshotId + policyVersion`
- Proposal: Request `Idempotency-Key`
- New Capital: `capitalSourceId + policyVersion`
- Stress: `portfolioSnapshotId + scenarioVersion`

---

## 26. Fail-closed

다음이면 신규 위험 증가를 만들지 않는다.

- Portfolio 소유권 불일치
- Snapshot 불완전/오래됨
- 가격·FX 누락/충돌
- 음수 NAV/Cash/수량
- Evaluation/Plan 만료
- Policy 비활성·혼합
- Lot Strategy/Bucket 불일치
- Company/Sector/Theme Hard Capacity 0
- Momentum Stop/Gap Scenario 누락
- Open Risk Snapshot 누락
- Pending Order/Reserved Cash 미반영
- Risk Service 불가

읽기는 마지막 정상 Snapshot을 `STALE` 표기해 제공할 수 있지만 신규 Proposal은 금지한다.

---

## 27. 관측성

### 27.1 Metric

- NAV reconciliation error
- Bucket drift
- Company/Sector/Theme concentration
- Momentum open risk/NAV
- Capacity reduction rate
- Cash retention rate
- Proposal expiry rate
- Snapshot age
- FX missing/conflict count
- Risk reduction/deny rate after Portfolio approval
- Slippage vs proposed notional

### 27.2 Alert

- Ledger 불일치
- Hard Limit 초과
- Open Risk Hard Max 초과
- Negative Available Cash
- Snapshot/FX stale
- Proposal 반복 만료
- Risk가 Portfolio 계산보다 더 작은 Company Exposure 감지
- 동일 Lot 중복

### 27.3 Audit

Policy, Snapshot, Proposal, Capacity, Rebalance, Bucket Transfer, Manual Review를 기록한다. 계산 입력 Hash와 코드 버전을 포함한다.

---

## 28. 보안

- Portfolio/User 소유권을 RLS와 Service에서 이중 확인
- 클라이언트의 Weight·NAV·Capacity를 신뢰하지 않음
- 서버 전용 키를 브라우저에 노출하지 않음
- Idempotency-Key 재사용 Body 충돌은 409
- Prompt/문서가 Hard Limit을 해제할 수 없음
- 숫자 Overflow·정밀도·통화 단위 검증
- Snapshot과 Proposal은 불변

---

## 29. 테스트 전략

### 29.1 Unit

- NAV/Cash reconciliation
- 85/15 Bucket/Reserve
- Soft/Hard State
- Core/Future Core Position Cap
- Cross-strategy Company 합산
- Decimal Capacity min
- Momentum Risk Quantity
- Gap Scenario/Open Risk
- Liquidity Quantity
- FX conversion
- Drawdown Multiplier
- Proposal 만료

### 29.2 Property

- Approved Amount <= Requested Amount
- Approved Amount <= 모든 Capacity
- Quantity 증가 시 Notional/Risk 비감소
- Hard Limit 여유 감소 시 승인 금액 비증가
- 순서가 바뀐 Lot/Exposure 입력의 결과 동일
- Risk/Portfolio가 Engine Score를 변경하지 않음
- Replay가 운영 저장소를 변경하지 않음

### 29.3 Integration

- Long-term Evaluation → Core/Future Core Proposal
- Momentum Evaluation+Plan → Risk Quantity Proposal
- Dual Lot Company Exposure
- Proposal+Audit+Outbox 원자 저장
- Ranking/New Capital Batch
- Risk Handoff 금액 상향 불가
- RLS 사용자 격리

### 29.4 Golden Scenario

1. Long-term 85%, Momentum 15% 정상
2. Momentum Hard Max에서 Score 95 진입 거부
3. Future Core Company 6% Cap
4. Dual Lot Company Gross 10% Cap
5. Gap Risk로 Momentum 수량 축소
6. Sector/Theme 집중으로 좋은 후보 축소
7. 모든 후보 부적합 → Cash 100% 유지
8. Historical Replay 동일 Hash

### 29.5 Replay

- Point-in-time Price/FX/Corporate Action
- 당시 Policy와 Evaluation
- Survivorship 포함
- Settlement·Reserved Cash
- Cost/Tax/Slippage
- 주문 미체결·부분체결
- Strategy별 Attribution

---

## 30. Legacy에서 v1으로의 구현 결과

| 기존 자산 | 재사용 | v1 구현 결과 |
|---|---|---|
| `portfolio.ts` | 85/15, Strategy/Company/Future Core Cap, Decimal Proposal | Snapshot 기반 NAV, Exposure, 수량, Risk Handoff, Hash |
| `capital-allocation.ts` | 신규 자금·Cash 유지·Item 검증 | 공동 Capacity, 안정적 Ranking, Batch Hash |
| `risk.ts` | 비가역 DENY, 만료·Stale·Stop·Behavioral Gate | Portfolio v1 Handoff와 Drawdown/Stress 재검증 |
| `position-lot.ts` | 전략·Exit 분리 | Security/FX/Exposure/Open Risk Snapshot |
| `cross-signal.ts` | Score 합성 금지 | Dual Lot 총노출 Handoff |
| `momentum-v1` | Entry/Stop/Gap/Regime/Liquidity | Risk Quantity/Notional Capacity 연결 |
| DB 001~005 | Portfolio/Lot/Proposal/Risk 기반 | Snapshot·Exposure·Capacity·Stress·Batch 상세 Table |

Legacy `proposeAllocation`은 기존 소비자를 위해 유지하고 v1은 `portfolio-v1`로 격리한다.

---

## 31. 구현 이력과 운영 연결

### Phase 0 — Legacy 격리

- 기존 85/15 Preview/API 유지
- v1 이름·경로 분리
- Portfolio/Risk 경계 테스트

### Phase 1 — Ledger·Policy

- Types/Policy
- Snapshot/NAV/Cash/FX
- Bucket/Position Limit

### Phase 2 — Exposure·Sizing

- Company/Sector/Theme/Currency
- Long-term Size Tier
- Momentum Allowed Risk/Quantity/Open Risk
- Liquidity Capacity

### Phase 3 — Proposal·Batch·Stress

- Capacity Engine
- Allocation Proposal v1
- New Capital Batch
- Rebalance/Stress/Replay

### Phase 4 — API·Persistence

- `006_portfolio_engine_v1.sql`
- Repository/Audit/Outbox
- 조회·Proposal·Exposure·Risk·Stress API

### Phase 5 — 운영 연결(미완료, 외부 환경 필요)

- Provider/Scheduler
- Broker Pending Order/Settlement
- Tax/Cost Adapter
- Drift Alert

---

## 32. Definition of Done

### 도메인

- [x] Ledger/NAV/Cash 이중 계산 방지
- [x] 85/15 Target·Soft·Hard 분리
- [x] Core/Future Core/Momentum Size 구현
- [x] 동일 기업 Dual Lot 총노출
- [x] Sector/Theme/Currency Look-through
- [x] Momentum Total/Sector/Theme Open Risk 수량 역산
- [x] Liquidity·FX·Momentum 비용·Round Lot
- [x] Rebalance·Stress·Cash 선택
- [ ] 실제 세금·비용 Provider와 Tax-lot Adapter 연결

### 안전

- [x] Hard Limit 초과 신규 증가 0
- [x] Stop/Gap 없는 Momentum 수량 0
- [x] 전략 간 자금 차입 0
- [x] Risk/User 승인 우회 0
- [x] Leverage/음수 Cash 0
- [x] 만료 Proposal 실행 0

### API/DB

- [x] v1 Proposal·Batch·Exposure·Open Risk·Stress API
- [x] Audit·Outbox·Idempotency
- [x] Snapshot/Proposal/Capacity 불변
- [x] Composite FK·RLS

### 검증

- [x] Unit/Invariant/Golden/Integration
- [x] Point-in-time Replay
- [x] 동일 입력 Hash 100%
- [x] `pnpm typecheck`, `pnpm test`, `pnpm build`

실제 Provider·Supabase·인증·Scheduler·Broker Pending Order 연결이 끝나야 운영 준비 완료다. 자동 주문은 MVP 범위가 아니다.

---

## 33. 후속 문서 책임

### `08_Database.md`

- 전체 ERD/Partition/Retention
- Ledger Source of Truth
- Backup/Restore/Reconciliation

### `09_Scoring_System.md`

- Candidate Ranking 정규화
- Opportunity Quality Calibration
- Drift/Champion-Challenger

### Risk 계층 후속 상세화 (`01_Architecture.md`·이 문서 연계)

- 최종 Drawdown·Liquidity·Gap·Operational Veto
- 승인 직전 재검증
- Risk Alert 운영

후속 문서는 Strategy Score·Thesis·Setup 또는 원본 Proposal을 수정하지 않고 새 Decision/Revision으로 연결한다.

---

## 34. 결정 기록

| ID | 결정 | 이유 |
|---|---|---|
| PORT-ADR-001 | Target·Soft·Hard 분리 | 정상 Drift와 신규 위험 금지를 구분 |
| PORT-ADR-002 | Cash를 Bucket/Reserve 중 하나에만 귀속 | 이중 계산 방지 |
| PORT-ADR-003 | Strategy Lot 분리, Company Gross 합산 | Exit 독립성과 집중 위험 동시 보존 |
| PORT-ADR-004 | Momentum 수량을 허용 손실에서 역산 | 금액에 맞춘 Stop 왜곡 방지 |
| PORT-ADR-005 | Portfolio 승인 후 Risk 독립 검증 | 권한 분리와 비가역 거부권 |
| PORT-ADR-006 | New Money First | 세금·비용·불필요한 매도 감소 |
| PORT-ADR-007 | 모든 증가 Proposal 만료 | 가격·Cash·Exposure 동시성 보호 |
| PORT-ADR-008 | Normal/Stress Correlation 분리 | 위기 시 가짜 분산 방지 |

---

## 부록 A. 대표 시나리오

### A.1 Momentum Hard Max

- Momentum Score 96, Confidence 90
- Momentum Bucket 20%
- Bucket Capacity 0

결과: Score는 유지하고 `REJECTED`, `BUCKET_CAPACITY_EXHAUSTED`.

### A.2 Dual High

- Core 7%
- 새 Momentum Notional 요청 5%
- Company Gross Hard Max 10%

결과: Momentum은 최대 3% Notional 이하로 축소. 두 Lot의 Exit는 독립.

### A.3 Gap Risk

- NAV 100,000
- Allowed Risk 500
- Stop Loss/Unit 5
- Gap Scenario Loss/Unit 10

결과: Raw Quantity 50, 100이 아님.

### A.4 Future Core

- Future Core Company 현재 5.5%
- 요청 2%
- Hard Max 6%

결과: Company/Sub-bucket Capacity 0.5% 이하로 축소.

### A.5 Cash

- Long-term underweight
- 모든 후보 Evaluation Action `WATCH`

결과: Target 복원을 위해 부적합 후보를 매수하지 않고 Long-term Cash 유지.

### A.6 Crisis

- 강한 Momentum Setup
- Regime Multiplier 0

결과: Allowed Risk 0, 신규 수량 0. Setup Score는 변경하지 않음.

---

## 부록 B. PR Review Checklist

### Ledger

- [ ] NAV 구성요소가 한 번만 포함되는가?
- [ ] FX 기준시각과 Base Currency가 일치하는가?
- [ ] Pending/Reserved Cash가 반영되는가?

### Policy

- [ ] Target/Soft/Hard가 분리되는가?
- [ ] Strategy·Lot·Company·Exposure Capacity가 모두 적용되는가?
- [ ] Hard Limit을 기존 Drift와 신규 증가에 다르게 처리하는가?

### Momentum

- [ ] Stop/Gap Scenario가 수량보다 먼저 계산되는가?
- [ ] Open Risk/Regime/Drawdown/Liquidity Multiplier가 0~1인가?
- [ ] Chase/Plan 만료를 재검증하는가?

### Boundary

- [ ] Strategy Score를 수정하지 않는가?
- [ ] Risk 승인이나 사용자 승인을 가장하지 않는가?
- [ ] Lot 전환·Bucket 차입이 없는가?

### Persistence

- [ ] Snapshot/Proposal/Capacity가 불변인가?
- [ ] Composite FK/RLS/Audit/Outbox가 있는가?
- [ ] Idempotency와 Result Hash가 있는가?

---

## 부록 C. 01~04 정합성

| 선행 원칙 | 05 구현 해석 |
|---|---|
| Long-term/Momentum Score 독립 | Portfolio는 점수를 합산·수정하지 않음 |
| Portfolio→Risk→Human | Proposal은 Risk 검토 가능 금액일 뿐 |
| Position Lot 분리 | 전략별 Exit/Attribution 유지 |
| Cross Signal은 해석만 | Dual Lot 총노출 계산에만 사용 |
| Momentum Stop/Chase/Event | Plan 유효성과 Scenario Loss를 수량 전에 검증 |
| Point-in-time | Price/FX/Ledger/Policy/Evaluation 기준시각 보존 |
| Decimal | 금액·가격·수량·FX 환산에 부동소수점 금지 |
| Fail-closed | Snapshot/FX/Open Risk 불완전 시 신규 위험 0 |
| Human Approval | Portfolio·Risk 이후에도 실행 전 명시 승인 필요 |
