# 02-4. Capital Allocation, Portfolio Construction, and Risk Philosophy

> 장기 복리 자산을 보호하면서 Future Core와 Momentum에 제한된 위험 예산을 배분하기 위한 포트폴리오 헌법

- Chapter: `02_Investment_Philosophy`
- Part: 4 / 5
- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 관련 Engine: Portfolio Engine, Risk Engine, Cross Signal Engine
- 관련 후속 문서: `05_Portfolio_Engine.md`, `09_Scoring_System.md`

---

## 1. Capital Allocation의 목적

좋은 종목을 고르는 것만으로 좋은 포트폴리오가 만들어지지 않는다.

> Capital Allocation은 제한된 자본을 서로 다른 시간축·수익 원천·위험 구조에 배치해, 개별 판단 오류가 전체 투자 생존을 훼손하지 않도록 만드는 과정이다.

Portfolio Engine은 다음 질문에 답한다.

- 현재 신규 자금은 어느 전략 Bucket에 배치해야 하는가?
- 좋은 종목이라도 지금 더 살 수 있는가?
- 같은 산업·기술·고객 위험이 중복되는가?
- 현재 포지션 크기가 확신과 불확실성에 적합한가?
- 현금을 유지하는 편이 더 나은가?
- 장기 복리 자산을 보호하면서 Momentum 기회를 활용할 수 있는가?

기업 매력도와 실제 자금 배분을 분리한다.

```text
Attractiveness Evaluation
≠
Allocation Approval
```

---

## 2. 기본 Bucket 구조

기본 정책은 전체 투자자산을 다음처럼 구분한다.

```text
Total Investable Portfolio
├── Long-term Bucket: 기본 80~90%
│   ├── Core
│   ├── Future Core
│   └── Long-term Cash
├── Momentum Bucket: 기본 10~20%
│   ├── Active Momentum Positions
│   └── Momentum Cash
└── Common Reserve: 선택적
```

### 2.1 기본 목표 비중

아래는 초기 시스템 기본값이며 사용자별 Policy로 설정 가능하다.

| Bucket | 기본 목표 | 허용 범위 예시 | 역할 |
|---|---:|---:|---|
| Long-term Total | 85% | 80~90% | 장기 복리의 중심 |
| Core | 70% | 60~80% | 검증된 장기 기업 |
| Future Core | 15% | 5~20% | 미래 Core 탐색 |
| Momentum Total | 15% | 10~20% | 전술적 기회 |
| Cash | 각 Bucket 내부 | 상황별 | 위험 완충·옵션 가치 |

`Core + Future Core`는 Long-term Total 안에서 합산한다.

### 2.2 범위의 의미

범위는 시장을 예측해 매주 바꾸기 위한 것이 아니다.

- Long-term 80% 아래: Momentum 또는 현금이 장기 전략을 침범했는지 검토
- Momentum 20% 위: 신규 단기 진입 원칙적 금지
- Future Core 20% 위: 개별 기업 실패와 상관 위험 검토
- Cash 증가: 매력적 대안 부족 또는 위험 국면의 합법적 결과

### 2.3 Target, Soft Limit, Hard Limit

```ts
interface AllocationLimit {
  target: number;
  softMin: number;
  softMax: number;
  hardMin?: number;
  hardMax: number;
}
```

- `Target`: 정상 상태의 목표
- `Soft Limit`: 경고·신규 자금 조절
- `Hard Limit`: 신규 위험 증가 실행 거부. 한도 복원을 위한 축소·청산만 별도 검토

---

## 3. 자금의 정의

### 3.1 Investable Capital

투자 가능 자금에서 제외할 항목:

- 생활비
- 비상자금
- 단기간 내 사용할 자금
- 세금 납부 예정액
- 고금리 부채 상환 필요액
- 법적·계약상 제한 자금

Investment OS는 생활 안전성을 희생해 기대수익을 높이지 않는다.

### 3.2 New Capital

월급·사업소득·배당·매도대금 등 새로 들어온 자금은 출처를 기록한다.

```ts
type CapitalSource =
  | 'SALARY'
  | 'DIVIDEND'
  | 'POSITION_EXIT'
  | 'INTEREST'
  | 'EXTERNAL_TRANSFER'
  | 'TAX_REFUND';
```

### 3.3 Cash의 소속

현금은 전략별로 구분한다.

- Long-term Cash: 월급날 투자, 조정, 신규 Core를 위한 자금
- Momentum Cash: 신규 Setup과 손실 한도 관리를 위한 자금
- Common Reserve: 사용자 정책에 따라 전략 간 이동 가능한 예비 자금

Momentum Cash가 남는다고 자동으로 Long-term에 배치하지 않으며, 반대도 동일하다.

---

## 4. 월급날 Capital Allocation 철학

매월 25일 전후는 자동 매수일이 아니라 **정기 자본 배분 Decision Point**다.

### 4.1 월급날 절차

```text
New Capital Confirmed
  ↓
Emergency / Near-term Needs Check
  ↓
Current Bucket Weights
  ↓
Hard Limit Check
  ↓
Long-term Candidate Ranking
  ↓
Future Core Evidence Review
  ↓
Momentum Opportunity Availability
  ↓
Cash Alternative
  ↓
Allocation Proposal
  ↓
Risk Review
  ↓
User Approval
```

### 4.2 신규 자금의 우선 사용

기본 우선순위:

1. 생활 안전자금 부족 보완
2. Hard Limit 위반 복원
3. Long-term 목표 비중 보완
4. 매력적인 Core / Future Core
5. Momentum Bucket이 목표 미달이고 유효 Setup 존재
6. 현금 유지

### 4.3 자동 균등매수 금지

매월 동일 종목을 자동으로 사는 것은 선택 가능한 전략이지만 기본값은 아니다.

각 월급날 다음을 재평가한다.

- 현재 가격
- Thesis 상태
- 대안
- 집중도
- 데이터 기준일
- 다음 주요 이벤트

### 4.4 아무것도 사지 않는 결론

모든 후보가 비싸거나 데이터가 불충분하면 현금을 유지한다.

보고서는 `이번 달 매수 없음`을 실패로 표현하지 않는다.

---

## 5. Position Sizing의 공통 철학

Position Size는 확신을 표현하는 동시에 판단 오류를 제한하는 장치다.

다음 요소를 함께 반영한다.

```text
Position Size
= Strategy Budget
× Opportunity Quality
× Confidence
× Risk Multiplier
× Portfolio Fit
× Liquidity Multiplier
```

### 5.1 Score와 Size의 관계

Score가 높다고 선형적으로 비중을 늘리지 않는다.

이유:

- Score 오차
- 데이터 상관
- 모델 미적합
- Tail Risk
- 동일 산업 위험

### 5.2 Confidence와 불확실성

예시:

- 높은 점수 + 높은 신뢰도: 정상 비중 가능
- 높은 점수 + 낮은 신뢰도: 탐색 비중
- 중간 점수 + 높은 신뢰도: 보유·대기
- 낮은 점수: 신규 진입 금지 가능

### 5.3 Position Size의 세 단계

```text
Starter Position
→ Confirmed Position
→ Full Policy Position
```

- Starter: 추적 책임을 만드는 작은 비중
- Confirmed: 실적·Thesis 증거 강화 후 확대
- Full Policy: 최대 허용 비중 내 성숙한 포지션

---

## 6. Long-term Position Sizing

아래 값은 구현 기본값을 설계하기 위한 예시 범위이며 최종 수치는 `05_Portfolio_Engine.md`에서 확정한다.

### 6.1 Core

| 단계 | 총 포트폴리오 대비 예시 |
|---|---:|
| Starter | 1~3% |
| Normal | 3~8% |
| High Conviction | 8~12% |
| Hard Review Zone | 12~15% 이상 |

Core의 큰 비중은 다음을 요구한다.

- 높은 Business Quality
- 높은 Evidence Coverage
- 분산된 수익원
- 재무 안정성
- 포트폴리오 내 낮은 중복 위험
- 명시적 집중투자 승인

### 6.2 Future Core

| 단계 | 총 포트폴리오 대비 예시 |
|---|---:|
| Research / No Position | 0% |
| Starter | 0.5~1.5% |
| Candidate | 1~3% |
| Strong Candidate | 2~4% |
| Future Core Maximum Review | 4~6% |

Future Core는 가격 하락보다 사업 증거 강화에 따라 비중을 확대한다.

### 6.3 Position Size 감소 요인

- 고객 집중
- 현금 Runway 부족
- 희석 가능성
- Binary Event
- 회계 품질
- 지정학
- 높은 CapEx 불확실성
- 모델이 산업에 적합하지 않음
- 상관된 기존 보유

---

## 7. Momentum Position Sizing

Momentum은 투자 금액보다 `허용 손실`을 기준으로 크기를 정한다.

### 7.1 Risk per Trade

총 포트폴리오 대비 위험 예산의 예시:

| 상태 | 1회 거래 위험 예시 |
|---|---:|
| 정상 Regime | 0.25~0.50% |
| High-quality Setup | 최대 0.75% 검토 |
| 변동성 확대 | 0.10~0.30% |
| Drawdown 상태 | 추가 축소 또는 0% |

이는 원금 투자 비중이 아니라 Stop 도달 시 예상 손실이다.

### 7.2 Open Risk

```text
Open Risk
= Σ 각 Momentum Position의 Stop 기준 예상 손실
```

포지션이 10개여도 상관된 섹터라면 단순 합보다 높은 위험으로 본다.

### 7.3 Momentum Bucket Hard Limit

- Momentum 총 시장가치 상한
- Momentum Open Risk 상한
- 일간·주간·월간 손실 상한
- 한 섹터 Momentum 노출 상한
- 이벤트 Overnight 노출 상한

하나라도 초과하면 신규 거래를 제한한다.

---

## 8. Concentration 철학

종목 수는 분산의 충분조건이 아니다.

### 8.1 Concentration Dimension

- Company
- Sector
- Industry
- Geography
- Currency
- Customer
- Supplier
- Technology
- Factor
- Revenue Model
- Regulatory Regime

예:

- 클라우드 회사 3개와 반도체 회사 3개를 보유해도 모두 AI CapEx에 의존하면 같은 위험에 집중될 수 있다.

### 8.2 Look-through Exposure

기업의 공식 섹터보다 수익의 실제 원천을 본다.

```ts
interface EconomicExposure {
  theme: string;
  revenueSensitivity: number;
  confidence: number;
}
```

예시 Theme:

- AI Infrastructure Spend
- Consumer Credit
- Interest Rates
- Oil Price
- Government Defense Budget
- Healthcare Reimbursement

### 8.3 Concentration 경고 단계

```text
Normal
→ Elevated
→ High
→ Hard Limit Breach
```

경고는 자동 매도를 의미하지 않는다.

가능한 대응:

- 신규매수 중단
- 신규 자금의 다른 산업 배치
- Momentum 중복 진입 제한
- 일부 축소
- Hedge 검토

---

## 9. Correlation 철학

과거 가격 상관만으로 미래 위험을 측정하지 않는다.

### 9.1 세 종류의 상관

1. **Price Correlation**: 과거 수익률 동조
2. **Fundamental Correlation**: 동일 수요·고객·원가에 의존
3. **Event Correlation**: 같은 정책·금리·규제 이벤트 영향

가격 상관이 낮아도 Fundamental Correlation이 높을 수 있다.

### 9.2 Stress Correlation

정상 시장보다 위기 시 상관이 상승할 수 있다.

Risk Engine은 다음 시나리오를 고려한다.

- 금리 급등
- AI CapEx 축소
- 신용 경색
- 지정학 충격
- 달러 급등
- 경기 침체

---

## 10. Risk Budget 철학

Risk Budget은 변동성을 없애는 것이 아니라 **어디서 얼마만큼의 손실을 감수할지 사전에 결정하는 것**이다.

### 10.1 Risk Layer

```text
Total Risk Budget
├── Long-term Fundamental Risk
├── Future Core Failure Risk
├── Momentum Trading Risk
├── Liquidity Risk
├── Currency Risk
└── Operational / Model Risk
```

### 10.2 Long-term Risk

Long-term 포지션에는 기술적 Stop을 기본 적용하지 않는다.

대신 다음을 사용한다.

- Position Size
- Thesis Break
- 재무 생존성
- 집중 한도
- 가치 범위
- 정기 리뷰

### 10.3 Future Core Risk

- 작은 초기 비중
- 승격 단계
- 현금 Runway 모니터링
- 희석·고객 집중 감점
- Binary Event 제한

### 10.4 Momentum Risk

- Stop
- Risk per Trade
- Open Risk
- Time Stop
- Drawdown Limit
- Regime Multiplier

### 10.5 Operational Risk

- 잘못된 티커
- 중복 주문
- 통화 단위 오류
- stale price
- 모델 출력 오류
- 데이터 소스 중단

Operational Risk는 투자 Thesis와 무관하게 주문을 거부할 수 있다.

---

## 11. Drawdown Policy

### 11.1 전략별 Drawdown 분리

- Long-term Drawdown
- Future Core Drawdown
- Momentum Drawdown
- Total Portfolio Drawdown

각 Drawdown의 원인과 대응이 다르다.

### 11.2 Momentum Drawdown Control

예시 상태:

```text
Normal
→ Caution
→ Reduced Risk
→ Pause
→ Review Required
```

가능한 정책:

- 최근 Peak 대비 손실 증가 시 Risk per Trade 축소
- 연속 손실 시 Cooldown
- 월간 손실 한도 도달 시 신규 거래 중단
- 모델 또는 실행 문제 검토 후 재개

### 11.3 Long-term Drawdown Control

장기 하락을 Momentum 손절처럼 처리하지 않는다.

검토 순서:

1. 시장 전체 요인인가?
2. 사업 지표가 변했는가?
3. Thesis Assumption이 훼손됐는가?
4. 밸류에이션이 개선됐는가?
5. 집중 위험이 과도한가?
6. 신규 자금으로 추가할 가치가 있는가?

### 11.4 Total Portfolio Drawdown

전체 Drawdown이 사용자 정책 임계치에 도달하면 다음을 수행한다.

- 모든 신규 Momentum Risk 축소
- 고위험 Future Core 리뷰
- 데이터·모델·포트폴리오 원인 분해
- 강제 저점 매도보다 생존 계획 우선
- 사용자 재무 상황 재확인

---

## 12. Rebalancing 철학

### 12.1 Calendar Rebalancing만 사용하지 않는다

분기·연간 정기 검토는 필요하지만, 단순히 목표 비중을 맞추기 위해 승자를 자동 매도하지 않는다.

### 12.2 Rebalancing Trigger

- Hard Limit 초과
- Thesis 변화
- 신규 자금 유입
- 전략 비중 이탈
- 위험 요인 중복
- 가치평가 변화
- 생활 자금 필요

### 12.3 New Money First

가능하면 신규 자금으로 비중을 조정한다.

장점:

- 세금·거래비용 감소
- 장기 승자 불필요한 매도 방지
- 감정적 매매 감소

### 12.4 Drift 허용

좋은 기업이 성장해 비중이 올라간 경우 목표를 초과할 수 있다.

다만 Hard Review Zone에서는 다음을 점검한다.

- 단일 실패 영향
- 사업 수익원 분산
- 밸류에이션
- 사용자의 심리적 감당 가능성
- 세후 기대수익

---

## 13. Sell Funding Priority

현금이 필요하거나 위험을 줄여야 할 때 다음 순서로 검토할 수 있다.

1. Thesis Broken
2. 규칙 위반 Momentum
3. 기대값이 사라진 Momentum
4. Weak Future Core
5. 과도한 집중 포지션 일부
6. 극단적 고평가 Core
7. 높은 품질 Core는 마지막 검토

이 순서는 절대 규칙이 아니지만, 평단·손익 대신 현재 기대수익과 위험을 기준으로 한다.

---

## 14. Leverage와 Margin 철학

MVP 기본값은 다음과 같다.

- Margin 사용 금지
- 차입 투자 금지
- Naked Option 금지
- 강제 청산 가능 구조 금지

향후 Leverage Engine을 추가하려면 별도 정책, Stress Test, 법적·세무 검토가 필요하다.

장기 복리의 핵심은 최대 수익이 아니라 강제 퇴장 가능성을 낮추는 것이다.

---

## 15. Currency와 환율

사용자의 기준 통화와 자산 통화를 구분한다.

```ts
type CurrencyExposure = {
  assetCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  marketValueBase: DecimalString;
  fxPnL: SignedDecimalString;
};
```

### 15.1 환율을 기업 성과와 분리

- 주가 수익
- 배당
- 환율 수익

을 별도 Attribution으로 표시한다.

### 15.2 환율 타이밍 최소화

월급날 투자 시 환율이 불리하다는 이유만으로 장기간 투자 결정을 멈추지 않을 수 있다.

단, 단기 필요 자금·환전 비용·극단적 변동은 고려한다.

### 15.3 Hedge

기본값은 자동 Hedge가 아니다.

Hedge 도입 시:

- 비용
- 기간
- 세금
- 롤오버
- 장기 기대수익 감소

를 별도 평가한다.

---

## 16. Liquidity 철학

### 16.1 개인 현금흐름 유동성

- 최소 비상자금
- 12개월 내 필요 자금
- 세금
- 대출 상환

을 포트폴리오와 분리한다.

### 16.2 자산 유동성

- 거래량
- Spread
- 거래정지 위험
- 장전·장후 체결
- 해외시장 시간차

Future Core와 Momentum은 유동성 감점을 강하게 적용한다.

### 16.3 Liquidity Stress

위기 시 정상 거래량을 가정하지 않는다.

Position Size는 `평상시 청산 가능`이 아니라 `불리한 시장에서도 합리적으로 청산 가능`한 수준을 지향한다.

---

## 17. Tax와 비용 철학

Investment OS는 세후·비용후 성과를 우선한다.

고려 항목:

- 매매 수수료
- 환전 비용
- 배당 원천징수
- 양도소득세
- 손익통산
- 세금 납부 유동성
- 잦은 교체의 비용

세금만을 이유로 Thesis Broken 포지션을 유지하지 않는다.

세금 최적화는 투자 논지를 보조해야지 대체하면 안 된다.

---

## 18. Cross Signal과 Allocation

Cross Signal은 종목의 전략 관계를 해석하지만 Portfolio Limit을 우회하지 않는다.

### 18.1 Dual High Conviction

```text
Long-term High + Momentum High
```

가능한 의미:

- 장기 매력과 단기 타이밍 동시 우호
- Long-term Lot과 Momentum Lot 모두 허용 가능

제약:

- 종목 총노출 한도
- 산업 집중도
- 두 Lot의 Exit 독립
- Momentum 위험은 Stop 기준

### 18.2 Long-term Only

```text
Long-term High + Momentum Low
```

- 장기 분할매수 가능
- 단기 추세 대기
- 가격 하락 원인이 Thesis Break가 아닌지 확인

### 18.3 Momentum Only

```text
Long-term Low + Momentum High
```

- Momentum Bucket만 사용
- 작은 위험
- 장기 전환 금지

### 18.4 Avoid

```text
Long-term Low + Momentum Low
```

- 신규 자금 우선순위 낮음
- 기존 포지션은 전략별 종료 규칙 검토

---

## 19. Manual Risk Review와 비가역적 거부권

Risk Engine은 다음 상태를 반환한다.

```text
APPROVE
APPROVE_WITH_REDUCTION
REQUIRE_MANUAL_REVIEW
DENY
```

### 19.1 Hard Deny 예시

- 잘못된 가격·통화 데이터
- Momentum Stop 누락
- Hard Limit 초과
- 거래정지·상장폐지 위험
- 사용자 승인 불가
- 생활 자금 침범
- 자동 주문 중복

### 19.2 Manual Review 예시

- 실적 발표 임박
- 고유동성 평시, 저유동성 이벤트
- 단일 종목 총노출 급증
- Thesis와 가격 데이터 불일치
- 모델 간 극단적 의견 충돌

### 19.3 Manual Review 처리 권한

MVP에서는 Hard Safety 위반과 Risk `DENY`를 Override할 수 없다. `REQUIRE_MANUAL_REVIEW`만 추가 근거를 검토할 수 있으며 다음을 요구한다.

- 검토 사유와 근거
- 검토자와 검토 시각
- 변경된 최대 손실
- 재검토 일정
- 원 Risk Decision을 가리키는 새 Risk Decision
- Audit Log

검토 결과가 허용 또는 감액이더라도 기존 Decision을 직접 승인하지 않고 새 Risk Decision으로 Decision Proposal을 다시 구성한다.

---

## 20. Scenario and Stress Testing

Portfolio Engine은 정상 기대값뿐 아니라 스트레스 시나리오를 본다.

### 20.1 기본 시나리오

- 시장 -10%, -20%, -35%
- 금리 급등
- AI CapEx 축소
- 신용 경색
- 달러 급등
- 특정 산업 규제
- 최대 보유 종목 실적 충격
- Future Core 자금조달 실패
- Momentum Gap through Stop

### 20.2 결과

- 총 예상 손실
- Bucket별 손실
- 종목별 기여
- 상관 위험
- 현금 필요
- Hard Limit 위반

### 20.3 Stress Test의 용도

정확한 위기 예측이 아니라 다음을 확인한다.

- 하나의 시나리오가 치명적인가?
- 어디서 위험이 중복되는가?
- 사용자가 감정적으로 감당 가능한가?
- 강제 매도 가능성이 있는가?

---

## 21. Portfolio Decision Matrix

| 기업 매력 | Portfolio Fit | Risk | 기본 결론 |
|---|---|---|---|
| 높음 | 높음 | 낮음 | 승인 가능 |
| 높음 | 낮음 | 중간 | 축소·대기 |
| 높음 | 낮음 | 높음 | 거부 가능 |
| 중간 | 높음 | 낮음 | 관찰·소액 |
| 낮음 | 높음 | 낮음 | 현금 우선 |
| 낮음 | 낮음 | 높음 | 거부 |

좋은 기업이라는 이유만으로 Portfolio Fit과 Risk를 생략하지 않는다.

---

## 22. Allocation Decision Contract

Portfolio Engine의 최종 제안은 다음을 포함해야 한다.

```ts
interface CapitalAllocationDecision {
  generatedAt: string;
  dataAsOf: string;
  capitalSource: CapitalSource;
  availableAmount: DecimalString;
  currency: CurrencyCode;

  currentWeights: Record<string, number>;
  targetWeights: Record<string, number>;
  projectedWeights: Record<string, number>;

  proposals: AllocationItem[];
  cashRetained: DecimalString;
  constraintsTriggered: string[];
  stressSummary: string;
  finalRecommendation: string;
}
```

각 Allocation Item:

- 전략
- 기업
- 요청 금액
- 승인 금액
- 현재·예상 비중
- 투자 근거
- 거부·축소 사유
- 다음 검토 조건

---

## 23. 월급날 보고서 요구사항

월급날 보고서는 최소 다음을 제공한다.

### 23.1 현재 상태

- 총 투자 가능 자산
- Long-term / Momentum / Cash 비중
- Core / Future Core 비중
- 상위 종목 비중
- 산업·Theme 노출
- Hard / Soft Limit

### 23.2 후보 비교

- 기존 Core
- 신규 Core
- Future Core
- 현금
- Momentum은 유효 Setup이 있을 때만

### 23.3 최종 하나의 결론

예:

- 이번 달은 Core A에 70%, 현금 30%
- Future Core B에 탐색 비중만 배치
- Momentum Bucket이 상한이므로 신규 단기 거래 금지
- 모든 후보가 비싸 현금 유지

### 23.4 실행 전 조건

- 가격 유효 범위
- 데이터 기준일
- 다음 이벤트
- Thesis Break
- 비중 한도

---

## 24. Portfolio 체크리스트

### 자금

- 생활 자금과 분리됐는가?
- 세금·예정 지출을 반영했는가?
- 신규 자금의 출처가 기록됐는가?

### Bucket

- Long-term 80~90% 정책을 지키는가?
- Momentum 10~20% 상한을 지키는가?
- Cash의 전략 소속이 명확한가?

### 집중

- 단일 종목 비중은?
- 동일 산업·Theme 노출은?
- 고객·공급자·금리·정책 위험이 중복되는가?

### Position Size

- Score뿐 아니라 Confidence를 반영했는가?
- Future Core는 작은 비중인가?
- Momentum은 Stop 기준 위험으로 계산했는가?

### 위험

- Hard Limit 위반이 있는가?
- Stress Scenario에서 생존 가능한가?
- Gap·유동성·환율 위험을 반영했는가?

### 기회비용

- 현금과 비교했는가?
- 기존 Core 추가와 비교했는가?
- 작은 점수 차이로 잦은 교체를 하는가?

### 실행

- 사용자 승인이 필요한가?
- Lot과 전략이 분리됐는가?
- 다음 리뷰 일정이 있는가?

---

## 25. Part 4 완료 기준

이 Part는 다음을 정의한다.

- Long-term 80~90%, Momentum 10~20%의 Bucket 철학
- 월급날 신규 자금 배분
- Core·Future Core·Momentum Position Sizing 원칙
- 집중·상관·Theme 위험
- 전략별 Risk Budget과 Drawdown
- Rebalancing과 New Money First
- Cash·Leverage·Currency·Liquidity·Tax 원칙
- Cross Signal의 Portfolio 처리
- 비가역적 Risk 거부권, Manual Review와 Stress Test

구체적인 계산 공식, 정책 설정 UI, 데이터 스키마는 `05_Portfolio_Engine.md`, `08_Database.md`, `09_Scoring_System.md`에서 구현한다.
