# 02-2. Long-term, Core, and Future Core Philosophy

> 기업가치의 장기 성장에 참여하기 위한 종목 선정, 축적, 보유, 재평가, 승격·강등 원칙

- Chapter: `02_Investment_Philosophy`
- Part: 2 / 5
- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 최종 검토일: 2026-07-23
- 명세 상태: Draft for Review
- 구현 준비도: R1 Foundation Implemented / Policy Approval Open
- 정본: `docs/02_Investment_Philosophy.md`
- 관련 Engine: Long-term Engine, Core Engine, Future Core Engine
- 관련 후속 문서: `03_LongTerm_Engine.md`, `09_Scoring_System.md`

---

## 1. Long-term 전략의 목적

Long-term 전략의 목적은 주가가 오를 종목을 장기간 보유하는 것이 아니다.

> 장기간 기업가치를 복리로 증가시킬 수 있는 사업의 일부를, 기대수익이 충분한 가격에 취득하고, 핵심 가정이 유지되는 동안 보유하는 것.

이 정의에는 세 가지 조건이 모두 필요하다.

1. **좋은 사업**: 장기적으로 가치가 커질 수 있어야 한다.
2. **좋은 가격**: 사업이 좋아도 가격이 모든 낙관을 반영하면 기대수익이 낮다.
3. **좋은 보유 규칙**: 변동성은 견디되 Thesis 훼손은 방치하지 않아야 한다.

Long-term 전략은 가격 예측보다 사업가치의 방향과 속도를 평가한다. 다만 가치평가를 무시하지 않는다.

---

## 2. 장기 수익 방정식

장기 기대수익은 다음 구성요소로 분해한다.

```text
Expected Long-term Return
≈ Fundamental Growth
+ Shareholder Yield
+ Valuation Change
- Dilution
- Permanent Impairment Risk
```

### 2.1 Fundamental Growth

- 매출 성장
- 영업이익 성장
- FCF 성장
- 단위 경제성 개선
- 자본 효율 개선
- 점유율 상승

### 2.2 Shareholder Yield

- 배당
- 순자사주 매입
- 주당 지표 개선

단순한 자사주 매입 금액이 아니라 주식보상까지 반영한 **순주식수 감소**를 본다.

### 2.3 Valuation Change

- 과소평가 회복
- 사업 품질 향상에 따른 멀티플 상승
- 과도한 기대 정상화에 따른 멀티플 하락

장기 수익이 멀티플 확장에만 의존하면 취약한 Thesis다.

### 2.4 Dilution

- 주식보상
- 증자
- 전환사채
- 인수 대가로 발행된 주식

Future Core는 희석을 특히 강하게 반영한다.

### 2.5 Permanent Impairment

일시적인 가격 하락이 아니라 기업의 장기 가치가 훼손되는 위험이다.

- 기술 대체
- 경쟁우위 상실
- 과도한 부채
- 규제에 의한 사업 모델 붕괴
- 고객 집중으로 인한 계약 손실
- 반복적 자본 조달 실패
- 회계 신뢰 상실

---

## 3. Business Quality 철학

Business Quality는 단순히 현재 이익률이 높은지를 의미하지 않는다.

좋은 사업은 다음 질문에 긍정적으로 답할 가능성이 높다.

1. 고객이 이 제품을 계속 사용해야 하는 이유가 있는가?
2. 회사가 가격을 올리거나 더 많은 제품을 판매할 수 있는가?
3. 경쟁사가 자본을 투입해도 쉽게 따라올 수 없는가?
4. 성장이 커질수록 경제성이 개선되는가?
5. 경영진이 벌어들인 현금을 높은 수익률로 재투자할 수 있는가?
6. 외부 자본 없이도 장기간 성장할 수 있는가?
7. 실패 시 회복할 수 있는 재무적 여유가 있는가?

### 3.1 Business Quality의 구성

```text
Business Quality
├── Demand Durability
├── Competitive Advantage
├── Unit Economics
├── Recurring Economics
├── Capital Efficiency
├── Management Quality
├── Financial Resilience
└── Adaptability
```

### 3.2 좋은 사업과 좋은 주식의 차이

좋은 사업도 다음 이유로 나쁜 투자가 될 수 있다.

- 현재 가격이 지나치게 높음
- 성장 기대가 비현실적임
- 규제 위험이 가격에 반영되지 않음
- 경영진이 주주가치를 희석함
- 산업의 자본집약도가 급격히 높아짐
- 매출은 성장하지만 FCF가 구조적으로 나오지 않음

반대로 평범한 사업도 극단적 저평가와 명확한 촉매가 있으면 수익을 낼 수 있다. 그러나 해당 투자는 Core가 아니라 별도 전략으로 분류해야 한다.

---

## 4. Market / TAM 철학

### 4.1 큰 시장은 필요조건이지 충분조건이 아니다

TAM이 크다는 사실만으로 기업이 성공하지 않는다.

확인해야 할 질문:

- 실제 지불 의사가 있는 시장인가?
- 회사가 접근 가능한 `Serviceable Available Market`은 얼마인가?
- 판매·규제·생산 제약을 반영한 `Serviceable Obtainable Market`은 얼마인가?
- 시장 성장의 원인이 구조적인가, 일시적인가?
- 성장의 경제적 이익을 공급자가 가져가는가, 고객이 가져가는가?
- 신규 공급이 수익성을 빠르게 훼손할 수 있는가?

### 4.2 TAM 확장 경로

좋은 Future Core는 하나의 제품에서 시작해 다음과 같이 시장을 확장할 수 있다.

```text
Single Product
  ↓
Product Suite
  ↓
Workflow
  ↓
Platform
  ↓
Ecosystem
```

확장 가능성은 다음 증거로 판단한다.

- 기존 고객의 추가 제품 채택
- 고객당 매출 증가
- 파트너 생태계
- 개발자 또는 공급자 네트워크
- 데이터 축적 효과
- 새로운 지역·산업 진입

### 4.3 유행과 구조적 성장 구분

구조적 성장의 조건:

- 고객의 비용 또는 시간을 지속적으로 절감
- 규제·인구·기술 변화가 수요를 뒷받침
- 기존 방식으로 돌아갈 유인이 낮음
- 반복 구매 또는 사용 증가
- 산업 투자와 실제 매출이 연결됨

유행의 경고 신호:

- 고객보다 투자자 관심이 먼저 증가
- 매출보다 파트너십 발표가 많음
- 제품 사용 데이터가 없음
- 모든 경쟁사가 동일한 TAM 숫자를 사용
- 수익화 경로가 계속 미래로 연기됨

---

## 5. Moat 철학

Moat는 경쟁사가 존재하지 않는다는 뜻이 아니다.

> 경쟁이 존재해도 장기간 초과수익과 고객 관계를 유지할 수 있게 하는 구조적 우위.

### 5.1 Moat 유형

| 유형 | 관찰 지표 | 실패 신호 |
|---|---|---|
| Switching Cost | 갱신율, 이탈률, 통합 깊이 | 교체 기간 단축, 가격 인하 압력 |
| Network Effect | 사용자·공급자 증가가 가치 향상 | 멀티호밍, 네트워크 분절 |
| Scale Economy | 단위 비용 하락, 조달 우위 | 규모 확대에도 마진 악화 |
| Data Advantage | 데이터량·품질이 제품 개선 | 데이터가 범용화되거나 접근 가능 |
| Brand / Trust | 가격 프리미엄, 재구매 | 고객 인식 악화, 대체재 확산 |
| IP / Regulation | 특허, 인증, 허가 | 특허 만료, 규제 변화 |
| Ecosystem | 파트너·개발자·보완재 | 생태계 참여 감소 |
| Distribution | 낮은 CAC, 강한 채널 | 채널 의존도·수수료 상승 |

### 5.2 Moat는 결과로 검증한다

경영진의 `우리는 플랫폼이다`라는 표현보다 다음 결과를 본다.

- 높은 유지율
- 안정적 또는 상승하는 매출총이익률
- 고객당 매출 증가
- 낮아지는 CAC Payback
- 경쟁사 대비 점유율 상승
- 가격 인상 후 유지되는 사용량
- 제품 확장에 따른 마진 개선

### 5.3 Moat의 시간축

Future Core는 완성된 Moat보다 **Moat Formation**을 평가한다.

Core는 이미 형성된 Moat가 강화 또는 약화되는지를 평가한다.

---

## 6. Unit Economics와 성장의 질

매출 성장률 하나만으로 성장의 질을 판단하지 않는다.

### 6.1 공통 질문

- 신규 고객을 얻는 비용은 얼마인가?
- 고객이 남기는 장기 가치가 취득 비용보다 충분히 큰가?
- 성장이 마케팅 지출 중단 후에도 유지되는가?
- 가격 할인 없이 성장하는가?
- 매출채권과 계약 조건이 악화되지 않는가?
- 현금 회수가 매출 인식과 일치하는가?
- 주식보상을 포함해도 경제적 이익이 존재하는가?

### 6.2 SaaS / Subscription

주요 지표:

- ARR / RPO / Backlog
- Net Revenue Retention
- Gross Revenue Retention
- CAC Payback
- Gross Margin
- Rule of 40
- Expansion Revenue
- Remaining Contract Duration
- Stock-based Compensation

### 6.3 Marketplace / Network

- GMV
- Take Rate
- Active Buyers / Sellers
- Frequency
- Cohort Retention
- Contribution Margin
- Subsidy Dependence
- Fraud / Loss Rate

### 6.4 Hardware / Semiconductor

- ASP
- Unit Shipment
- Capacity Utilization
- Yield
- Inventory Days
- Gross Margin through Cycle
- Customer Concentration
- Design Win Duration
- CapEx Intensity

### 6.5 Industrial / Energy

- Backlog Quality
- Book-to-Bill
- Project Margin
- Working Capital
- Capacity Expansion
- Contract Escalator
- Regulatory Approval
- Commodity Exposure

### 6.6 Biotechnology

- Clinical Stage
- Probability-adjusted Pipeline
- Cash Runway
- Trial Design
- Safety / Efficacy
- Regulatory Path
- Manufacturing Scalability
- Partner Economics

산업별 지표는 다르지만 공통 목적은 같다.

> 성장에 투입되는 1원의 자본이 장기적으로 얼마의 경제적 가치를 만드는가?

---

## 7. Management와 Capital Allocation

### 7.1 경영진 평가 원칙

카리스마보다 다음을 본다.

- 약속과 실제 결과의 일치
- 불리한 정보의 투명성
- 장기 목표와 단기 보상의 정렬
- 핵심 인재 유지
- 자본 배분의 일관성
- 인수 가격과 사후 성과
- 주식보상 규율
- 실패 인정과 전략 수정 능력

### 7.2 Founder-led의 해석

창업자 경영은 가산점의 자동 근거가 아니다.

장점 가능성:

- 장기 비전
- 제품 집착
- 높은 내부자 지분
- 빠른 의사결정

위험 가능성:

- 견제 부족
- 과도한 의결권
- 관련자 거래
- 제국 확장
- 승계 위험

Founder는 점수 항목이 아니라 **관찰해야 할 경영 구조**다.

### 7.3 Capital Allocation 우선순위

기업이 현금을 사용하는 방법:

1. 높은 수익률의 내부 재투자
2. 전략적 M&A
3. 부채 상환
4. 자사주 매입
5. 배당
6. 현금 보유

좋은 배분은 고정된 순서가 아니라 현재 기회와 가격에 따라 달라진다.

예:

- 자사주가 고평가된 상태에서 대규모 매입은 가치 파괴일 수 있다.
- 고수익 재투자 기회가 없는 회사의 무리한 확장은 좋지 않다.
- Future Core가 생존에 필요한 현금을 배당하면 위험하다.

---

## 8. Financial Strength와 생존성

### 8.1 Core의 재무 기준

Core는 일반적으로 다음 중 다수를 만족해야 한다.

- 반복 가능한 영업현금흐름
- 만기 구조가 관리 가능한 부채
- 불황에도 투자 가능한 유동성
- 주식 희석 없이 사업 운영 가능
- 높은 이자보상능력
- 운전자본 변동을 견딜 수 있음

### 8.2 Future Core의 재무 기준

Future Core는 현재 이익보다 **증명 단계까지 생존 가능한지**가 중요하다.

필수 확인:

- Cash Runway
- 예상 Burn Rate
- 추가 자금조달 시점
- 희석 가능성
- 부채 Covenant
- 생산·임상·데이터센터 등 다음 자본 지출
- 손익분기점 도달 가정

### 8.3 성장과 FCF의 관계

낮은 FCF가 항상 나쁜 것은 아니다.

구분해야 한다.

- 좋은 낮은 FCF: 높은 수익률로 재투자 중
- 나쁜 낮은 FCF: 단위 경제성이 나쁘고 규모가 커질수록 손실 증가
- 일시적 낮은 FCF: 선투자 후 계약 매출 전환
- 구조적 낮은 FCF: 유지 CapEx가 지속적으로 과도함

시스템은 CapEx를 다음처럼 분해하도록 요구한다.

```text
Maintenance CapEx
Growth CapEx
Contract-backed CapEx
Speculative CapEx
```

---

## 9. Valuation 철학

### 9.1 Valuation은 가격 예측이 아니다

Valuation의 목적은 정확한 적정가 하나를 계산하는 것이 아니다.

> 현재 가격에서 기대수익이 어떤 가정에 의존하는지, 하방과 상방이 얼마나 비대칭적인지를 파악하는 것.

### 9.2 복수 방법 사용

사업 유형에 따라 다음을 조합한다.

- DCF
- Reverse DCF
- Earnings Multiple
- FCF Yield
- EV/Sales with Margin Bridge
- EV/EBITDA
- Sum-of-the-Parts
- Probability-adjusted Value
- Historical Band
- Peer Comparison

하나의 숫자보다 범위를 사용한다.

```text
Bear Value Range
Base Value Range
Bull Value Range
```

### 9.3 Reverse DCF 우선 질문

현재 가격이 정당화되려면 다음이 얼마나 필요할까?

- 매출 성장률
- 최종 마진
- 재투자율
- 자본 비용
- 희석
- Terminal Growth

이 가정이 현실적인지 사업 데이터와 비교한다.

### 9.4 고성장주의 멀티플

고성장주는 현재 이익이 작아 PER이 왜곡될 수 있다.

따라서 다음을 함께 본다.

- 성장 지속 기간
- 총이익 성장
- 영업 레버리지
- FCF 전환 시점
- 희석
- 밸류에이션이 요구하는 미래 시장점유율

### 9.5 가격 매력도는 절대·상대 기준을 모두 사용한다

절대 기준:

- 보수적 가정에서 양의 기대수익이 있는가?
- 하방 시 영구 손실 가능성이 감당 가능한가?

상대 기준:

- 같은 산업 대안보다 좋은가?
- 다른 산업 Core보다 좋은가?
- 현금·채권·지수보다 위험조정 기대수익이 좋은가?

---

## 10. Margin of Safety

Margin of Safety는 단순히 적정가보다 몇 퍼센트 낮은지를 의미하지 않는다.

다음 네 종류로 구성된다.

### 10.1 Price Margin

보수적 가치 범위 대비 할인.

### 10.2 Business Margin

예상보다 성장이 낮아도 생존하고 가치를 만들 수 있는 사업 구조.

### 10.3 Balance Sheet Margin

추정이 틀려도 자금조달 없이 버틸 수 있는 재무 여력.

### 10.4 Position Size Margin

기업 판단이 틀려도 전체 포트폴리오가 치명적으로 훼손되지 않는 비중.

Future Core는 Price Margin보다 Position Size와 Balance Sheet Margin을 더 중요하게 볼 수 있다.

---

## 11. Opportunity Cost 철학

### 11.1 모든 매수의 진짜 질문

`이 종목이 좋은가?`만으로는 부족하다.

> 현재 사용 가능한 신규 자본을 배분할 수 있는 대안 중 이 종목이 가장 나은가?

대안에는 다음이 포함된다.

- 기존 Core 추가매수
- 신규 Core
- Future Core
- Momentum Bucket 유지
- 현금
- 시장지수
- 부채 상환 또는 생활 안전자금

### 11.2 신규 투자와 기존 보유의 일관성

현재 보유 여부는 기업 자체의 매력도 점수를 바꾸지 않는다.

그러나 실제 매수 금액은 다음 때문에 달라질 수 있다.

- 이미 큰 포지션
- 같은 산업에 집중
- 같은 위험요인에 노출
- 세금·유동성
- 더 높은 기대수익의 대안

즉:

```text
Company Attractiveness ≠ Allocation Decision
```

### 11.3 Opportunity Cost 비교표

매월 신규 자금 배분 시 다음을 비교한다.

| 항목 | Candidate A | Candidate B | Cash |
|---|---:|---:|---:|
| Business Quality | | | N/A |
| Valuation | | | Yield 기준 |
| 5~10Y Growth | | | 낮음 |
| Downside | | | 낮음 |
| Portfolio Fit | | | 높음 |
| Confidence | | | 높음 |
| Final Action | | | |

### 11.4 과도한 순위 최적화 방지

종목 간 점수 차이가 작고 오차 범위가 크면 `1위 몰빵`을 하지 않는다.

```text
Score Difference < Uncertainty Band
→ 실질적으로 동일 등급
→ 분산 또는 비중 유지 가능
```

---

## 12. Investment Thesis Framework

### 12.1 Thesis의 정의

Thesis는 `회사가 좋다`라는 서술이 아니다.

> 현재 시장 가격이 충분히 반영하지 않은 가치 창출 메커니즘과, 이를 검증할 수 있는 관찰 지표의 집합.

### 12.2 Thesis 구성

```ts
interface LongTermThesis {
  summary: string;
  returnSources: string[];
  keyAssumptions: ThesisAssumption[];
  milestones: ThesisMilestone[];
  catalysts: string[];
  risks: string[];
  breakConditions: ThesisBreakCondition[];
  valuationRange: ValuationRange;
  expectedHorizon: string;
  reviewSchedule: string[];
}
```

### 12.3 좋은 Thesis의 조건

- 3~5문장으로 요약 가능
- 사실과 추론이 구분됨
- 핵심 가정 수가 제한됨
- 관찰 가능한 지표가 있음
- 반대 시나리오가 있음
- 가격과 기업가치가 연결됨
- 무엇이 틀리면 매도할지 명확함

### 12.4 나쁜 Thesis의 예

- AI 시대이므로 오른다.
- 유명한 CEO가 있다.
- 주가가 많이 떨어졌다.
- 과거 고점까지 반등할 것이다.
- 기관 목표주가가 높다.
- 언젠가 시장이 알아줄 것이다.

### 12.5 Thesis Assumption

각 가정은 다음을 가진다.

```ts
interface ThesisAssumption {
  id: string;
  statement: string;
  evidenceType: 'FACT' | 'INFERENCE' | 'HYPOTHESIS';
  importance: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  currentStatus: 'SUPPORTED' | 'MIXED' | 'UNSUPPORTED';
  observableMetrics: string[];
  nextReviewAt: string;
}
```

### 12.6 Thesis Break

Thesis Break는 주가 하락률이 아니다.

가능한 예:

- 핵심 제품의 구조적 점유율 하락
- 고객 유지율의 지속적 훼손
- 계약이 매출·현금흐름으로 전환되지 않음
- 예상보다 큰 희석 없이는 생존 불가
- 핵심 기술이 대체됨
- 경영진 신뢰 상실
- 규제로 사업 모델이 불가능해짐

### 12.7 Thesis 상태

```text
Strengthened
Unchanged
Weakened
Broken
Replaced
```

`Weakened`는 즉시 매도를 의미하지 않는다. 비중 확대 중단, 예상 범위 하향, 추가 검증이 필요할 수 있다.

`Broken`은 가격과 관계없이 포지션을 근본적으로 재평가한다.

---

## 13. Core와 Future Core의 구분

| 구분 | Core | Future Core |
|---|---|---|
| 사업 검증 | 높음 | 부분적 |
| 현금흐름 | 검증 또는 명확 | 약하거나 전환 중 |
| 실패 확률 | 상대적으로 낮음 | 높음 |
| 초기 비중 | 중간 이상 가능 | 작게 시작 |
| 추가매수 근거 | 가격+논지 유지 | 사업 증거 강화 |
| 리뷰 주기 | 분기 중심 | 월간·분기 중심 |
| 핵심 위험 | 성장 둔화·고평가 | 생존·희석·상용화 |
| 승격 | 해당 없음 | Core로 승격 가능 |

### 13.1 Future Core 단계

```text
Universe
→ Watch
→ Candidate
→ Strong Candidate
→ Future Core
→ Core Promoted
```

### 13.2 단계별 증거 요구

#### Universe

- 산업 가설
- 기업 기본 정보
- 최소한의 데이터

#### Watch

- 실제 제품·고객 존재
- 시장 규모 검증 필요
- 재무 생존성 확인 중

#### Candidate

- 매출·사용량 성장
- 고객 가치 확인
- 경영진·재무 자료 신뢰 가능

#### Strong Candidate

- 복수 분기 증거
- 점유율 또는 단위 경제성 개선
- 희석·생존 위험 관리 가능

#### Future Core

- 반복 가능한 성장
- Moat 형성
- 합리적 가격
- 탐색 포지션 보유 가능

#### Core Promoted

- 산업 리더십 또는 명확한 우위
- FCF 또는 높은 확률의 FCF 전환
- 재무 생존성 검증
- 장기 보유에 적합한 지배구조

### 13.3 강등 규칙

- 성장 둔화 자체보다 원인을 본다.
- 제품 문제가 아닌 시장 일시 둔화일 수 있다.
- 단, 생존·희석·신뢰 문제는 빠르게 반영한다.
- 순위 하락과 포지션 매도는 별도 결정이다.

---

## 14. 진입과 축적 철학

### 14.1 최초 진입

최초 진입의 목적은 확신을 선언하는 것이 아니라 실제 추적 책임을 만드는 것이다.

필수 조건:

- 전략 분류 완료
- Thesis 작성
- 가치 범위 작성
- 주요 반대 근거 작성
- 포트폴리오 한도 확인
- 리뷰 일정 설정

### 14.2 분할매수

분할매수는 가격 하락에 자동 반응하는 규칙이 아니다.

추가매수 사유:

1. 가격은 하락했지만 Thesis는 유지 또는 강화
2. 실적 증거가 개선
3. 가치 범위가 상향
4. 대안 대비 기대수익이 개선
5. 포트폴리오 한도 내

추가매수 금지:

- 평단을 낮추기 위한 목적
- 손실 회복 기대
- Thesis가 약화됐는데 가격만 하락
- 포트폴리오 집중 상한 초과
- 데이터가 오래되었거나 불완전

### 14.3 가격 상승 중 추가매수

주가가 올랐다는 이유만으로 추가매수를 금지하지 않는다.

다음이 가격보다 더 빠르게 개선될 수 있다.

- 이익 전망
- 시장 크기
- Moat
- FCF
- 신뢰도

질문은 항상 같다.

> 현재 가격에서 오늘 처음 평가해도 매수할 것인가?

### 14.4 월급날 신규 자금

월급날은 자동 매수일이 아니라 정기 자본 배분일이다.

가능한 결론:

- 기존 Core 추가
- 신규 Core 진입
- Future Core 탐색 포지션
- 현금 유지
- 전략 비중 복원

---

## 15. 보유 철학

### 15.1 보유의 적극성

보유는 아무것도 하지 않는 것이 아니다.

보유 중 수행할 일:

- 실적 검토
- Thesis 상태 업데이트
- 경쟁사 비교
- 산업 구조 변화 확인
- 가치 범위 업데이트
- 포트폴리오 집중도 확인

### 15.2 가격 변동 처리

| 상황 | 기본 대응 |
|---|---|
| 가격 하락, Thesis 강화 | 추가매수 검토 |
| 가격 하락, Thesis 유지 | 가치·비중 재검토 |
| 가격 하락, Thesis 약화 | 추가매수 중단 |
| 가격 하락, Thesis 파손 | 청산 검토 |
| 가격 상승, 가치도 상승 | 보유 또는 추가 가능 |
| 가격 상승, 가치 정체 | 비중·기회비용 검토 |
| 가격 급등, 극단적 고평가 | 축소 또는 신규매수 중단 |

### 15.3 승자를 너무 일찍 팔지 않는다

좋은 기업의 장기 수익은 소수의 큰 승자가 만들 수 있다.

따라서 단순 수익률 기준의 자동 익절은 Core에 적용하지 않는다.

매도는 다음 근거를 필요로 한다.

- Thesis Break
- 구조적 성장률 하향
- 경쟁우위 약화
- 경영진·지배구조 훼손
- 극단적 고평가와 낮은 기대수익
- 포트폴리오 생존을 위협하는 집중
- 더 높은 확신과 기대수익의 대안

---

## 16. 매도와 축소 철학

### 16.1 매도 분류

```ts
type LongTermExitReason =
  | 'THESIS_BROKEN'
  | 'BUSINESS_QUALITY_DETERIORATED'
  | 'VALUATION_EXTREME'
  | 'PORTFOLIO_RISK'
  | 'BETTER_OPPORTUNITY'
  | 'LIQUIDITY_NEED'
  | 'GOVERNANCE_FAILURE'
  | 'MODEL_ERROR';
```

### 16.2 Thesis Break 매도

가격 회복을 기다리지 않는다.

`내 평단`은 기업가치와 무관하다.

### 16.3 Valuation 매도

좋은 기업을 고평가만으로 전량 매도하는 것은 신중해야 한다.

가능한 대응 순서:

1. 신규매수 중단
2. 자동 재투자 중단
3. 일부 축소
4. 극단적 가정에서만 정당화되는 경우 추가 축소
5. 사업 논지와 함께 훼손된 경우 전량 검토

### 16.4 더 나은 대안

기회비용 매도는 다음을 요구한다.

- 기존 종목의 세후 기대수익
- 대안의 기대수익
- 신뢰도 차이
- 거래 비용
- 포트폴리오 분산 효과
- 판단 오류 가능성

작은 점수 차이로 잦은 교체를 하지 않는다.

---

## 17. Drawdown 철학

### 17.1 Drawdown은 정보이지 자동 신호가 아니다

가격 하락은 다음 중 하나일 수 있다.

- 시장 전체 위험 회피
- 밸류에이션 정상화
- 일시적 실적 문제
- 구조적 사업 훼손
- 정보 비대칭
- 단순 수급

시스템은 원인을 분류한 뒤 행동한다.

### 17.2 Drawdown Review

특정 하락 임계치 도달 시 자동 매도 대신 리뷰를 시작한다.

```text
Price Drawdown Trigger
  ↓
Data Freshness Check
  ↓
News / Filing Check
  ↓
Thesis Assumption Review
  ↓
Valuation Update
  ↓
Portfolio Risk Review
  ↓
Action
```

### 17.3 패닉 셀 방지

- 시장 중 급락 시 즉시 장기 Thesis를 바꾸지 않는다.
- 공식 정보가 없는 경우 거래 종료 후 검토할 수 있다.
- 단, 사기·회계·파산 등 Hard Risk는 즉시 대응한다.
- 사용자 감정 상태를 Decision Journal에 기록할 수 있다.

---

## 18. 산업별 평가 적합성

하나의 점수 모델을 모든 산업에 동일 적용하지 않는다.

### 18.1 Software

중요도 상승:

- Retention
- Gross Margin
- CAC Efficiency
- Platform Expansion
- Switching Cost

### 18.2 Semiconductor

중요도 상승:

- Cycle Position
- Design Win
- Yield
- Capacity
- Customer Concentration
- Technology Roadmap

### 18.3 Capital-intensive Infrastructure

중요도 상승:

- Contract-backed CapEx
- Financing Cost
- Utilization
- FCF Conversion
- Counterparty Risk

### 18.4 Biotechnology

중요도 상승:

- Clinical Probability
- Cash Runway
- Regulatory Milestone
- Portfolio Diversification

### 18.5 Consumer / Marketplace

중요도 상승:

- Cohort
- Frequency
- Brand
- Unit Economics
- Network Liquidity

공통 Core Score는 유지하되 산업별 Sub-model을 사용할 수 있다.

---

## 19. 예시: 같은 기업을 다르게 판단하는 방법

> 아래는 시스템 동작 설명을 위한 가상 예시이며 현재 투자 추천이 아니다.

### 19.1 Oracle-like Infrastructure Company

관찰:

- 대규모 계약 증가
- AI 인프라 수요
- CapEx와 부채 상승
- 계약의 현금 전환 시점 불확실

잘못된 Thesis:

> AI 관련주이므로 장기적으로 오른다.

개선된 Thesis:

> 대규모 계약이 높은 가동률과 반복 가능한 클라우드 매출로 전환되고, 성장 CapEx 이후 FCF가 회복된다면 현재 가치보다 높은 장기 기업가치를 만들 수 있다.

핵심 검증 지표:

- 계약의 매출 전환
- OCI 성장
- 데이터센터 가동률
- FCF
- 순부채
- 고객 집중도

Thesis Break 후보:

- 계약 취소·지연이 반복
- CapEx 증가에도 가동률 부진
- 투자적격 재무 안정성 훼손
- 특정 고객 의존 위험 현실화

### 19.2 Microsoft-like Platform Company

핵심 질문:

- 높은 사업 품질이 현재 가격에 얼마나 반영되었는가?
- AI 투자가 기존 소프트웨어·클라우드 경제성을 높이는가?
- CapEx 증가보다 FCF 성장이 빠른가?

좋은 회사라는 사실만으로 항상 최우선 매수 후보가 되는 것은 아니다.

### 19.3 Early-stage Future Core

관찰:

- 매출 40% 성장
- 적자
- 큰 TAM
- 고객 3곳 집중
- 현금 18개월

결론:

- 높은 성장 점수 가능
- 낮은 재무 신뢰도
- 작은 탐색 비중만 허용
- 고객 다변화와 조달 위험 개선 전 Core 승격 금지

---

## 20. Long-term Decision Contract

Long-term Engine의 최종 출력은 다음 질문에 명확히 답해야 한다.

1. 사업이 장기적으로 가치가 커질 가능성이 있는가?
2. 현재 가격이 보수적 기대수익을 제공하는가?
3. 가장 중요한 세 가지 가정은 무엇인가?
4. 다음 실적에서 무엇을 확인해야 하는가?
5. Thesis는 강화·유지·약화·파손 중 무엇인가?
6. 신규 자금 배분 우선순위는 몇 번째인가?
7. 추가매수 가능한 조건은 무엇인가?
8. 추가매수를 중단할 조건은 무엇인가?
9. 포트폴리오에서 허용 가능한 비중은 얼마인가?
10. 반대 의견과 불확실성은 무엇인가?

---

## 21. Long-term 체크리스트

### 사업

- 고객에게 필수적인가?
- 시장은 구조적으로 성장하는가?
- 점유율이 상승하는가?
- 경쟁우위가 결과로 확인되는가?
- 제품이 생태계로 확장될 수 있는가?

### 재무

- 성장의 질이 좋은가?
- FCF 또는 FCF 전환 경로가 명확한가?
- 부채와 희석이 감당 가능한가?
- 재투자 수익률이 높은가?
- 불황에서도 생존 가능한가?

### 경영진

- 약속을 지키는가?
- 불리한 정보를 투명하게 공개하는가?
- 자본을 합리적으로 배분하는가?
- 주주와 이해가 정렬되는가?

### 가격

- 현재 가격이 요구하는 가정은 무엇인가?
- Bear Case에서도 영구 손실 위험이 감당 가능한가?
- 대안 대비 기대수익이 좋은가?
- Margin of Safety가 가격·사업·재무·비중 중 어디에 있는가?

### 논지

- Thesis가 구체적인가?
- 관찰 지표가 있는가?
- Thesis Break가 명확한가?
- 다음 리뷰 시점이 정해졌는가?

### 포트폴리오

- 동일 산업·고객·기술 위험에 집중되는가?
- 현재 비중에서 판단 오류를 감당할 수 있는가?
- 신규 자금의 최선의 사용인가?

---

## 22. Part 2 완료 기준

이 Part는 다음을 정의한다.

- Long-term 수익의 원천
- Business Quality와 Moat
- 성장의 질과 산업별 지표
- Management와 Capital Allocation
- 재무 생존성
- Valuation과 Margin of Safety
- Opportunity Cost
- Investment Thesis와 Thesis Break
- Core와 Future Core의 단계
- 진입·축적·보유·축소·매도 원칙

세부 점수 공식, 데이터 필드, 승격 임계치는 `03_LongTerm_Engine.md`와 `09_Scoring_System.md`에서 구현한다.
