# 02-3. Momentum and Tactical Investing Philosophy

> 제한된 위험 예산으로 단기·중기 가격 추세와 촉매를 활용하되, 장기투자 규칙을 오염시키지 않는 전술적 투자 정책

- Chapter: `02_Investment_Philosophy`
- Part: 3 / 5
- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 최종 검토일: 2026-07-23
- 명세 상태: Draft for Review
- 구현 준비도: R1 Foundation Implemented / Policy Approval Open
- 정본: `docs/02_Investment_Philosophy.md`
- 관련 Engine: Momentum Engine, Risk Engine, Portfolio Engine
- 관련 후속 문서: `04_Momentum_Engine.md`, `09_Scoring_System.md`

---

## 1. Momentum 전략의 목적

Momentum 전략은 단기 가격을 정확히 예측하는 시스템이 아니다.

> 가격·거래량·상대강도·촉매가 만들어내는 지속 가능한 추세가 존재할 때만 참여하고, 추세가 무효화되면 미리 정한 작은 손실로 종료하는 확률적 전략.

Momentum은 다음 가정 위에서 동작한다.

- 새로운 정보가 모든 시장 참여자에게 동시에 완전히 반영되지 않는다.
- 실적·가이던스·정책 변화는 여러 차례의 추정치 수정으로 이어질 수 있다.
- 기관 수급은 규모 때문에 일정 기간 지속될 수 있다.
- 강한 종목은 시장이 우호적인 동안 상대적 강세를 유지할 수 있다.
- 손실은 작게 제한하고 승자는 더 오래 보유하면 낮은 적중률로도 양의 기대값을 만들 수 있다.

Momentum의 목표는 매 거래에서 이기는 것이 아니라, 반복 가능한 Setup의 장기 기대값을 실현하는 것이다.

---

## 2. Momentum과 단순 추격매수의 차이

Momentum은 `주가가 올랐으니 산다`가 아니다.

좋은 Momentum Setup은 다음이 함께 존재한다.

```text
Favorable Market Regime
+ Strong Sector
+ Strong Relative Strength
+ Sufficient Liquidity
+ Confirmed Volume
+ Identifiable Catalyst
+ Defined Entry
+ Defined Invalidation
+ Positive Expected Value
```

단순 추격매수의 특징:

- 진입 근거가 가격 상승 하나뿐
- 손절 기준 없음
- 뉴스가 이미 충분히 반영되었는지 검토하지 않음
- 유동성과 Gap Risk 무시
- 실패 시 장기 보유로 전환
- 목표가보다 기대감만 존재

---

## 3. 전략의 시간축

Momentum은 Setup별로 시간축을 명시해야 한다.

| 유형 | 일반적 시간축 | 핵심 종료 규칙 |
|---|---|---|
| Intraday | 당일 | 장 마감 전 또는 Setup 무효화 |
| Swing | 수일~수주 | Stop / Target / Time Stop |
| Position Momentum | 수주~수개월 | 추세·실적 수정 종료 |
| Event-driven | 이벤트 전후 | 이벤트 계획에 따른 종료 |

MVP의 기본 범위는 `Swing`과 `Position Momentum`이다.

초단타와 고빈도 거래는 다음 이유로 제외한다.

- 실시간 인프라 요구
- 높은 슬리피지 민감도
- 개인 투자자의 실행 불리
- 시스템 복잡도 증가
- 장기 전략과 심리적으로 충돌 가능

---

## 4. Expected Value 철학

Momentum 거래는 적중률이 아니라 기대값으로 평가한다.

```text
Expectancy
= Win Rate × Average Win
- Loss Rate × Average Loss
- Trading Costs
```

### 4.1 R-Multiple

각 거래의 초기 위험을 `1R`로 정의한다.

```text
1R = Entry Price - Stop Price
```

Long 포지션 기준 예:

- 진입: 100
- 손절: 95
- 주당 위험: 5
- 목표: 110
- 잠재 보상: 10
- 초기 Reward/Risk: 2R

모든 성과는 원화 손익뿐 아니라 `R-Multiple`로 기록한다.

### 4.2 적중률 착시

- 80% 적중률이어도 평균 손실이 평균 수익보다 크면 실패할 수 있다.
- 40% 적중률이어도 평균 수익이 평균 손실의 3배면 성공할 수 있다.
- 손절 미준수로 발생한 큰 손실은 모델의 작은 Edge를 파괴한다.

### 4.3 거래 비용

다음을 기대값에서 차감한다.

- 수수료
- 세금
- 환전 비용
- Bid-Ask Spread
- Slippage
- Gap Loss
- 미체결 기회비용

---

## 5. Market Regime 우선 원칙

좋은 개별 종목도 시장 Regime이 불리하면 성공 확률이 낮아질 수 있다.

### 5.1 Regime 분류 예시

```ts
type MarketRegime =
  | 'RISK_ON_TREND'
  | 'RISK_ON_VOLATILE'
  | 'NEUTRAL_RANGE'
  | 'RISK_OFF'
  | 'CRISIS';
```

### 5.2 Regime 입력

- 주요 지수 추세
- 상승·하락 종목 비율
- 신고가·신저가
- 변동성 지수
- 신용 스프레드
- 금리 변동
- 섹터 확산도
- 거래량
- 시장 리더의 건전성

### 5.3 Regime별 기본 정책

| Regime | 신규 진입 | 포지션 크기 | Setup 요구 |
|---|---|---|---|
| Risk-on Trend | 허용 | 정상 | 표준 |
| Risk-on Volatile | 선별 허용 | 축소 | 높은 유동성 |
| Neutral Range | 제한 | 축소 | 빠른 목표·명확한 촉매 |
| Risk-off | 원칙적 제한 | 매우 작음 | 예외적 상대강도 |
| Crisis | 기본적으로 신규 Long 금지 | 0 | 신규 위험 차단·정책 재검토 |

Regime는 개별 종목 Score를 바꾸기보다 `거래 허용도`와 `Position Size Multiplier`를 조정한다.

---

## 6. Universe 철학

모든 상장 종목을 거래 대상으로 삼지 않는다.

### 6.1 기본 필터

- 최소 시가총액
- 최소 일평균 거래대금
- 최대 Spread
- 최소 주가
- 거래정지·상장폐지 위험 제외
- 회계·공시 신뢰도
- 공매도·차입 제약
- ADR·해외 규제 위험

### 6.2 Liquidity 우선

Momentum은 진입보다 청산 가능성이 중요하다.

확인 항목:

- Average Daily Dollar Volume
- 예상 주문 금액 / 거래대금
- 호가 깊이
- Spread
- 장전·장후 유동성
- Gap 빈도
- 이벤트 당일 거래량 안정성

포지션 규모가 종목의 유동성을 침범하면 Score가 높아도 거래하지 않는다.

### 6.3 Penny Stock와 과도한 저유동성 제외

MVP에서는 다음을 원칙적으로 제외한다.

- 극저가 주식
- 거래량이 특정 날짜에만 급증한 종목
- 반복적 증자 기업
- 홍보성 뉴스 의존 기업
- 공시가 불충분한 기업
- 단일 임상·판결 이벤트만 남은 극단적 Binary Risk

---

## 7. Sector Rotation 철학

Momentum은 개별 기업만이 아니라 자금 흐름의 계층을 본다.

```text
Market
→ Asset Class
→ Sector
→ Industry
→ Company
```

### 7.1 좋은 후보의 구조

- 시장이 상승 추세
- 해당 섹터가 시장 대비 강함
- 산업이 섹터 내에서 강함
- 종목이 산업 내 리더

### 7.2 약한 시장의 강한 종목

상대강도가 높아도 시장이 극단적으로 약하면 다음을 구분한다.

- 실제 기관 축적
- 단순 방어주 특성
- Short Squeeze
- 이벤트성 급등

약한 시장에서의 예외적 강세는 후보 가치는 있지만 Position Size를 낮춘다.

---

## 8. Relative Strength 철학

상대강도는 절대 수익률과 다르다.

확인 대상:

- 시장 대비
- 섹터 대비
- 산업 동종 기업 대비
- 최근 1·3·6·12개월
- 상승일과 하락일의 거래량 구조
- 조정 시 방어력

좋은 상대강도는 다음 패턴을 보일 수 있다.

- 시장 조정 중 덜 하락
- 시장 반등 시 먼저 신고가
- 실적 후 Gap을 유지
- 거래량 증가와 함께 저항 돌파
- 조정 거래량 감소

상대강도 점수는 미래 수익을 보장하지 않으며, 과열·Crowding 위험과 함께 본다.

---

## 9. Volume 철학

거래량은 참여 강도와 유동성을 보여주지만 원인을 직접 말해주지 않는다.

### 9.1 긍정적 거래량 패턴

- 돌파 시 평균 대비 유의미한 증가
- 조정 시 감소
- 상승일 거래량이 하락일보다 우세
- 실적 Gap 후 높은 거래량과 가격 유지
- 장기간 Base 형성 후 수요 증가

### 9.2 위험한 거래량 패턴

- 뉴스 없는 저유동성 급증
- 장중 급등 후 종가 약세
- 반복적인 긴 윗꼬리
- 거래량 증가와 함께 지지선 이탈
- 증자 발표 전후 이상 거래

### 9.3 거래량과 시가총액

같은 거래량 증가율이라도 종목 규모에 따라 의미가 다르다.

- Mega-cap: 작은 상대 증가도 큰 자금 유입일 수 있음
- Small-cap: 높은 증가율이 소수 주문으로 발생할 수 있음

---

## 10. Catalyst 철학

Momentum은 `왜 지금인가?`에 답해야 한다.

### 10.1 Catalyst 유형

- Earnings Surprise
- Guidance Raise
- Estimate Revision
- Product Launch
- Regulatory Approval
- Major Contract
- Industry Supply Shock
- Policy Change
- Capital Return
- Index Inclusion
- Management Change
- Technical Breakout without New Fundamental News

### 10.2 좋은 Catalyst

- 기업가치 추정치를 실제로 바꿈
- 여러 분기에 영향을 줄 수 있음
- 시장 기대와 차이가 큼
- 거래량과 추정치 수정이 동반됨
- 후속 데이터로 검증 가능

### 10.3 약한 Catalyst

- 구체적 금액 없는 파트너십
- 이미 알려진 행사
- 반복 보도
- 경영진의 모호한 낙관론
- 매출과 무관한 홍보
- 소셜 미디어 루머

### 10.4 Catalyst Half-life

촉매는 시간이 지나면서 정보 가치가 감소한다.

시스템은 다음을 기록한다.

- 최초 발생 시각
- 시장 반응
- 추정치 수정 여부
- 가격이 이미 반영한 정도
- 후속 확인 일정

---

## 11. Setup Taxonomy

Setup은 사후 설명이 아니라 사전 정의된 패턴이다.

### 11.1 Breakout

조건 예시:

- 충분한 Base 기간
- 명확한 저항
- 거래량 증가
- 시장·섹터 확인
- 과도한 Gap이 아님

무효화:

- 돌파선 아래 종가 회귀
- 거래량 없는 False Breakout
- 시장 Regime 급변

### 11.2 Pullback

조건 예시:

- 기존 상승 추세
- 낮은 거래량의 조정
- 주요 이동평균 또는 이전 돌파선 지지
- 상대강도 유지

무효화:

- 고거래량 지지선 이탈
- 섹터 리더십 상실

### 11.3 Earnings Momentum

조건 예시:

- 실적·가이던스 서프라이즈
- 추정치 상향
- 높은 거래량
- Gap 유지
- 다음 분기까지 이어질 촉매

위험:

- 일회성 세금·비용 효과
- 낮은 기대치 Beat
- 매출보다 비용 절감 중심
- 다음 날 Gap Fade

### 11.4 Gap Continuation

조건 예시:

- 강한 공식 촉매
- Gap 이후 가격 유지
- 충분한 유동성
- 장중 지지 형성

위험:

- Opening Exhaustion
- Spread 확대
- 뉴스 해석 반전

### 11.5 Sector Rotation

조건 예시:

- 섹터 ETF 상대강도 전환
- 복수 종목 동반 상승
- 자금 유입 데이터
- 지속 가능한 산업 촉매

### 11.6 Special Situation

- Index Inclusion
- Spin-off
- Tender
- Restructuring
- Court / Regulatory Event

Special Situation은 일반 Momentum과 별도 Sub-strategy로 관리할 수 있다.

---

## 12. Entry 철학

### 12.1 Entry는 신호가 아니라 가격 구간이다

정확한 한 가격보다 다음을 정의한다.

```ts
interface EntryPlan {
  currency: CurrencyCode;
  entryZoneMin: DecimalString;
  entryZoneMax: DecimalString;
  trigger: string;
  chaseLimit: DecimalString;
  initialStop: DecimalString;
  target1?: DecimalString;
  target2?: DecimalString;
  trailingStopRule?: string;
  timeStopDays: number;
}
```

### 12.2 Chase Limit

좋은 Setup도 진입 가격이 나쁘면 기대값이 낮아진다.

다음 경우 대기한다.

- 계획한 Entry Zone 초과
- Stop까지 거리가 지나치게 큼
- Gap이 평균 변동성을 크게 초과
- Reward/Risk가 기준 미달
- 장 초반 유동성이 불안정

`놓친 거래`는 손실이 아니다.

### 12.3 Partial Entry

불확실성이 높지만 Setup이 유효한 경우 분할 진입이 가능하다.

단, 분할은 손실을 무제한 평균내리는 방식이 아니다.

- 초기 시험 포지션
- 확인 후 추가
- 최대 위험은 사전에 고정
- Stop은 전체 Position 기준

### 12.4 Confirmation과 Early Entry

- Early Entry: 좋은 가격, 낮은 확인
- Confirmation Entry: 높은 확인, 나쁜 가격 가능

시스템은 두 방식을 별도 Setup으로 기록해 성과를 비교한다.

---

## 13. Stop Loss와 Invalidation

### 13.1 Stop의 목적

Stop은 틀렸음을 완벽하게 증명하는 가격이 아니다.

> 거래 가설의 기대값이 충분히 낮아져 더 이상 위험을 감수할 이유가 없는 지점.

### 13.2 Stop 유형

- Structural Stop: 지지·돌파 무효화
- Volatility Stop: ATR 기반
- Time Stop: 정해진 기간 내 진행 없음
- Event Stop: 이벤트 전 청산
- Portfolio Stop: 전체 Risk Limit 초과

### 13.3 Mental Stop 금지

MVP에서는 실제 주문 연동이 없더라도 Stop 가격을 기록해야 한다.

`상황을 보고 판단`만 있는 거래는 승인하지 않는다.

### 13.4 Stop 확대 금지

진입 후 손실을 피하기 위해 Stop을 더 멀리 옮기면 안 된다.

예외:

- 주식 분할 등 가격 조정
- 데이터 오류
- 사전에 정의된 변동성 모델 적용

예외는 Audit Log에 남긴다.

### 13.5 Gap through Stop

실제 손실은 Stop보다 클 수 있다.

따라서 다음 종목은 Position Size를 줄인다.

- 실적 발표 보유
- 임상·규제 이벤트
- 저유동성
- 높은 공매도 비율
- 뉴스 Gap 빈도 높음

---

## 14. Position Sizing 철학

Momentum 포지션은 투자 금액보다 손실 가능 금액으로 결정한다.

```text
Position Size
= Allowed Risk Amount
÷ (Entry Price - Stop Price)
```

### 14.1 Allowed Risk

Allowed Risk는 다음에 따라 조정한다.

- 전체 포트폴리오 크기
- Momentum Bucket 크기
- 현재 Open Risk
- Market Regime
- Setup Quality
- 유동성
- 이벤트 위험
- 최근 Drawdown

### 14.2 Score가 높아도 무제한 비중 금지

- Score는 확률 추정치이며 확정이 아니다.
- 상관된 거래가 여러 개면 실제 위험이 중복된다.
- 같은 섹터 5종목은 독립 거래 5개가 아니다.

### 14.3 Pyramiding

승자에 추가하는 것은 허용할 수 있다.

조건:

- 기존 포지션이 이익 상태
- 새로운 Setup 발생
- 전체 Risk 재계산
- Stop 상향으로 Open Risk 통제
- 손실 포지션 물타기와 구분

---

## 15. Exit 철학

### 15.1 Exit 유형

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

### 15.2 Target Exit

- 1차 목표에서 일부 청산 가능
- 나머지는 추세 유지 시 보유 가능
- 목표가는 기술적 저항·변동성·R-Multiple 기반

### 15.3 Trailing Stop

Trailing Stop은 승자의 상방을 열어두기 위한 도구다.

가능한 기준:

- 이동평균
- ATR
- 이전 저점
- 최고가 대비 비율

Setup별로 하나의 기준을 고정해 성과를 검증한다.

### 15.4 Time Stop

예상 기간 내 움직임이 없으면 자본을 회수한다.

시간 정지는 손실이 아니더라도 적용할 수 있다.

### 15.5 Early Exit

다음 경우 Stop 도달 전 종료할 수 있다.

- 핵심 촉매 반전
- 거래량 분배 패턴
- 시장 Regime 급변
- 허위 공시·회계 문제
- 포트폴리오 전체 위험 급증

사후 감정이 아니라 사전 정의된 조건이어야 한다.

---

## 16. Event Risk 철학

### 16.1 이벤트 분류

- Earnings
- FDA / Clinical
- Court Decision
- Regulatory Approval
- Product Launch
- Macro Announcement
- Lock-up Expiry
- Share Offering

### 16.2 Binary Event

결과가 불연속적이고 예상 손실이 Stop을 크게 넘을 수 있는 이벤트다.

기본 정책:

- 별도 Event Strategy가 없으면 보유 금지 또는 대폭 축소
- Position Size에 Gap Scenario 반영
- 기대값과 확률을 별도 계산
- 일반 Momentum Score만으로 승인 금지

### 16.3 Earnings Hold

실적을 넘겨 보유하려면 다음이 필요하다.

- 실적 전용 Setup
- 예상 Gap Risk
- 포지션 축소 여부
- 옵션·헤지 여부
- Bear Scenario 손실
- 사용자 승인

---

## 17. Long-term과 Momentum의 충돌 처리

### 17.1 Long-term High / Momentum Low

해석:

- 기업은 매력적이나 단기 추세는 약함
- 장기 분할매수 가능
- Momentum 진입은 대기

Long-term 매수 시 Momentum Stop을 적용하지 않는다.

### 17.2 Long-term Low / Momentum High

해석:

- Tactical Only
- 작은 위험 예산
- 손절 후 장기 전환 금지
- 사업 품질이 낮으면 Gap Risk 가중

### 17.3 Dual High

해석:

- 장기 매력과 단기 추세가 동시 우호적
- 단, Long-term Lot과 Momentum Lot 분리
- 같은 종목 총노출 한도 적용
- 단기 수익이 장기 Thesis를 대신하지 않음

### 17.4 Long-term Thesis Break / Momentum Bounce

구조적 악재 이후 기술적 반등이 가능할 수 있다.

그러나:

- Core 보유 논지는 종료 가능
- Momentum은 별도 Tactical Setup으로만 허용
- 손실 회복 목적의 거래 금지

---

## 18. Momentum의 심리 규칙

### 18.1 FOMO

예방:

- Chase Limit
- Entry Zone
- `MISSED` 상태 기록
- 놓친 거래의 사후 수익을 손실로 계산하지 않음

### 18.2 Revenge Trading

예방:

- 연속 손실 후 Cooldown
- 일간·주간 손실 한도
- 같은 종목 즉시 재진입 제한
- 신규 거래 전 체크리스트 재승인

### 18.3 Anchoring

- 진입가는 시장에 의미가 없다.
- Stop과 현재 Setup만 본다.
- 손익분기점 회복을 목표로 하지 않는다.

### 18.4 Overconfidence

- 연속 수익 후 Position Size 자동 확대 금지
- 최소 거래 샘플 전 모델 변경 금지
- 수익과 규칙 준수를 별도 평가

### 18.5 Loss Aversion

- Stop을 비용이 아니라 전략 보험료로 해석
- 계획된 1R 손실은 정상 결과
- 큰 손실 회피가 핵심 목표

---

## 19. 거래 리뷰 철학

모든 종료 거래는 리뷰한다.

### 19.1 Outcome Metrics

- P&L
- R-Multiple
- Holding Days
- MAE
- MFE
- Slippage
- Fees

### 19.2 Process Metrics

- Setup 준수
- Entry 준수
- Position Size 준수
- Stop 준수
- Exit 준수
- 감정 개입
- 데이터 품질

### 19.3 결과 매트릭스

| 결과 | 규칙 준수 | 평가 |
|---|---|---|
| 수익 | 준수 | 좋은 결정 가능 |
| 손실 | 준수 | 정상 확률 결과 가능 |
| 수익 | 위반 | 나쁜 결정, 좋은 결과 |
| 손실 | 위반 | 수정 우선순위 높음 |

### 19.4 Setup별 평가

다음 기준으로 분리한다.

- 시장 Regime
- 섹터
- Setup Type
- Catalyst Type
- Entry Method
- Exit Method
- 시가총액
- 변동성 구간

모든 거래를 한 평균으로 합치지 않는다.

---

## 20. Momentum Model 변경 원칙

Momentum은 장기 모델보다 빠르게 학습할 수 있지만 과적합 위험이 크다.

### 20.1 변경 제안 조건

- 충분한 거래 수
- 여러 시장 Regime 포함
- 거래 비용 포함
- 특정 대형 승자 제거 후에도 Edge 유지
- Out-of-sample 또는 Replay 검증

### 20.2 변경 금지 예

- 최근 3회 손실
- 단일 종목 실패
- 한 달 성과 부진
- 감정적 불편
- 과거 데이터에만 맞춘 임계치

### 20.3 Shadow Mode

새 모델은 실제 적용 전 Shadow Mode로 운영할 수 있다.

```text
Active Model
vs
Candidate Model
```

동일 신호를 생성하고 성과를 비교한 뒤 활성화한다.

---

## 21. 예시 거래 계획

> 아래는 구조 설명용 가상 예시이며 실제 투자 추천이 아니다.

```md
Ticker: COMPANY_A
Strategy: Momentum / Earnings Momentum
Market Regime: Risk-on Trend
Catalyst: Revenue Beat + Guidance Raise
Entry Zone: 102~104
Chase Limit: 106
Initial Stop: 98
Target 1: 112
Target 2: 120
Time Stop: 10 trading days
Risk: 0.40% of total portfolio
Invalidation:
- 98 종가 이탈
- Sector relative strength 급락
- Guidance 정정
Event:
- 다음 실적 전 전량 재검토
```

좋은 거래 계획은 진입 전에 Exit가 정의되어 있다.

---

## 22. Momentum Decision Contract

Momentum Engine의 최종 제안은 다음에 답해야 한다.

1. 현재 Market Regime은 무엇인가?
2. 해당 섹터와 종목의 상대강도는 어떤가?
3. Setup Type은 무엇인가?
4. 왜 지금 진입하는가?
5. 유동성은 충분한가?
6. Entry Zone과 Chase Limit은 어디인가?
7. Setup이 틀렸음을 어디에서 인정하는가?
8. 잠재 보상 대비 위험은 얼마인가?
9. Position Size는 어떻게 계산했는가?
10. Event / Gap Risk가 있는가?
11. 최대 보유 기간은 얼마인가?
12. 현재 Open Risk와 상관 위험을 감당할 수 있는가?

---

## 23. Momentum 체크리스트

### 시장

- Regime이 신규 Long을 허용하는가?
- 시장 Breadth가 악화 중인가?
- 변동성이 Position Size에 반영되었는가?

### 종목

- 유동성이 충분한가?
- 상대강도가 시장·섹터 대비 높은가?
- 거래량이 Setup을 확인하는가?
- 홍보성·저품질 종목이 아닌가?

### 촉매

- `왜 지금인가?`에 답하는가?
- 공식 출처가 있는가?
- 이미 가격에 과도하게 반영되었는가?
- 후속 추정치 수정이 가능한가?

### 계획

- Entry Zone이 있는가?
- Chase Limit이 있는가?
- Stop이 있는가?
- Target 또는 Trailing Rule이 있는가?
- Time Stop이 있는가?

### 위험

- 1R은 얼마인가?
- Gap Risk를 감당할 수 있는가?
- 같은 섹터 포지션과 상관되는가?
- 연속 손실 한도를 초과하지 않는가?

### 행동

- FOMO 진입인가?
- 손실 복구 목적이 있는가?
- 실패 시 Long-term 전환 생각이 있는가?
- 계획대로 청산할 준비가 되어 있는가?

---

## 24. Part 3 완료 기준

이 Part는 다음을 정의한다.

- Momentum 전략의 기대값
- Market Regime과 Universe
- 상대강도·거래량·촉매
- Setup Taxonomy
- Entry·Stop·Target·Time Stop
- 위험 기반 Position Sizing
- Event와 Gap Risk
- Long-term과의 충돌 처리
- 거래 심리와 리뷰
- 모델 변경 원칙

세부 Indicator, 임계치, 스캔 로직은 `04_Momentum_Engine.md`와 `09_Scoring_System.md`에서 구현한다.
