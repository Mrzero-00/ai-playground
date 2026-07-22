# 02. Investment Philosophy

> Long-term Investing과 Momentum Investing을 하나의 포트폴리오 안에서 운영하되, 목적·분석·자금·위험·청산·성과·학습 규칙을 분리하기 위한 Investment OS의 최상위 투자 정책

- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 문서 상태: Detailed Specification Draft
- 상위 문서: `01_Architecture.md`
- Part 문서: `docs/02_Investment_Philosophy/`

## 문서 구성

1. Foundations, Objectives, and Governance
2. Long-term, Core, and Future Core
3. Momentum and Tactical Investing
4. Capital Allocation, Portfolio, and Risk
5. Decision Process, Psychology, Learning, and Templates

### 01 Architecture 정합성 규칙

이 문서는 `01_Architecture.md`의 하위 정책 문서다. 표현이 다르게 해석될 경우 다음 계약을 우선한다.

- Hard Safety 위반과 Risk `DENY`는 MVP에서 누구도 Override할 수 없다.
- `REQUIRE_MANUAL_REVIEW`는 `DENY`의 우회가 아니다. 검토 후 새 Risk Decision을 만들고 전체 승인 경계를 다시 통과한다.
- 금액·가격·수량은 `DecimalString`, 손익은 `SignedDecimalString`, 통화는 `CurrencyCode`를 사용한다. 비중·점수·신뢰도만 제한된 `number`를 사용한다.
- 금액·Stop·전략을 수정한 승인은 기존 Decision을 변경하지 않는다. 새 Proposal을 생성해 Portfolio와 Risk를 재검증하며, 전략 변경은 독립 Evaluation부터 다시 시작한다.
- 사용자의 최종 투자 권한은 Portfolio·Risk가 허용한 범위 안에서 승인 또는 거부하는 권한이며, 상위 안전 제한을 완화하는 권한이 아니다.

---
## 02-1. Foundations, Objectives, and Governance

> Investment OS가 무엇을 최적화하며, 어떤 원칙을 절대 훼손하지 않는지를 정의하는 최상위 투자 정책

- Chapter: `02_Investment_Philosophy`
- Part: 1 / 5
- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 문서 상태: Draft for Review
- 상위 문서: `01_Architecture.md`
- 적용 범위: Long-term, Future Core, Momentum, Portfolio, Risk, Learning Engine

---

### 1. 문서의 역할

이 문서는 특정 종목을 추천하거나 특정 수익률을 약속하지 않는다. Investment OS가 반복적으로 의사결정을 내릴 때 지켜야 하는 **정책, 우선순위, 금지 규칙, 증거 기준**을 정의한다.

Architecture가 시스템의 책임 경계를 정의한다면, Investment Philosophy는 다음 질문에 답한다.

- 이 시스템은 무엇을 위해 존재하는가?
- 어떤 수익을 좋은 수익으로 간주하는가?
- 장기투자와 모멘텀 투자는 왜 함께 존재하는가?
- 두 전략이 충돌할 때 무엇을 우선하는가?
- 무엇을 알 수 없다고 인정해야 하는가?
- 어떤 상황에서도 금지해야 할 행동은 무엇인가?
- 과거 판단에서 무엇을 배우고 어떻게 모델을 바꿀 것인가?

이 문서의 원칙은 하위 Engine의 점수, 화면, API, Agent 프롬프트보다 우선한다.

---

### 2. Investment OS의 존재 이유

#### 2.1 해결하려는 문제

개인 투자자의 성과를 훼손하는 주요 원인은 정보 부족만이 아니다. 더 자주 발생하는 문제는 다음과 같다.

1. 투자 목적과 시간축이 섞인다.
2. 매수 이유와 보유 이유가 달라진다.
3. 손실 난 단기 거래가 장기투자로 변질된다.
4. 평단과 손익이 현재 가치 판단을 지배한다.
5. 좋은 기업과 좋은 가격을 구분하지 못한다.
6. 뉴스와 주가 움직임을 사업 변화로 오해한다.
7. 동일한 실수를 기록하지 않아 반복한다.
8. 추천은 남지만 당시 근거와 데이터 기준일은 남지 않는다.
9. 전략이 잘될 때 위험 예산을 무제한 확대한다.
10. 실패한 판단을 모델이 아니라 운 탓으로만 처리한다.

Investment OS는 이 문제를 다음 구조로 해결한다.

```text
명확한 전략 구분
  + 구조화된 증거
  + 자금 Bucket
  + 사전 위험 규칙
  + 의사결정 기록
  + 결과 회고
  + 모델 버전 관리
```

#### 2.2 시스템의 최종 목적

최종 목적은 단기적으로 가장 높은 수익률을 얻는 것이 아니다.

> 사용자가 수십 년 동안 지속할 수 있는 방식으로 실질 구매력을 복리로 성장시키면서, 치명적인 손실과 감정적 의사결정을 피하는 것.

이를 위해 시스템은 다음을 동시에 추구한다.

- 장기 복리의 원천이 되는 고품질 기업 보유
- 아직 충분히 증명되지 않았지만 큰 잠재력이 있는 Future Core 탐색
- 제한된 위험 예산으로 단기 모멘텀 기회 활용
- 현금과 기회비용을 포함한 전체 자본 배분
- 판단 품질의 지속적인 개선

---

### 3. 최적화 목표

Investment OS는 다음 목표를 계층적으로 최적화한다.

#### 3.1 1순위: 생존

복리는 생존한 자본에만 작동한다.

따라서 다음 상황을 피하는 것이 최우선이다.

- 단일 종목 실패가 전체 투자 인생을 훼손하는 구조
- 레버리지로 인한 강제 청산
- 유동성 부족으로 원하는 시점에 청산하지 못하는 상태
- 단기 손실 복구를 위한 위험 확대
- 데이터 오류나 자동화 오류로 인한 대규모 주문
- 현금흐름 필요 시점과 투자 기간의 불일치

#### 3.2 2순위: 규칙 준수 가능성

이론적으로 높은 수익률을 내더라도 사용자가 반복 실행할 수 없는 전략은 좋은 전략이 아니다.

시스템은 다음 특성을 선호한다.

- 사전에 정의된 규칙
- 의사결정 횟수의 통제
- 손실 시 행동이 명확함
- 장기·단기 자금의 분리
- 사용자 승인 가능성
- 보고서가 행동으로 연결되는 구조

#### 3.3 3순위: 위험조정 복리 성장

수익률만이 아니라 다음을 함께 평가한다.

- 최대 낙폭
- 회복 기간
- 손실의 비대칭성
- 포트폴리오 집중도
- 실현 가능한 유동성
- 세금·수수료·슬리피지
- 전략의 용량
- 기대수익의 지속 가능성

#### 3.4 4순위: 학습 속도

같은 실수를 반복하지 않는 시스템은 시간이 지날수록 강해진다.

좋은 투자 결과뿐 아니라 다음도 가치 있는 결과로 저장한다.

- 적절한 근거로 내렸지만 확률적으로 실패한 결정
- 수익은 났지만 규칙을 위반한 나쁜 결정
- 잘못된 데이터로 만들어진 추천
- 맞았지만 재현할 수 없는 우연한 판단
- 피해야 했던 손실을 막은 `SKIP` 결정

---

### 4. 수익의 원천을 구분한다

Investment OS는 모든 수익을 같은 종류로 보지 않는다.

#### 4.1 Long-term Return Sources

장기 수익은 주로 다음에서 발생한다.

```text
매출 성장
+ 마진 확대
+ 자본 효율 개선
+ 잉여현금흐름 증가
+ 자사주 매입 또는 합리적 재투자
+ 경쟁우위 강화
+ 적정 밸류에이션 유지 또는 회복
```

장기 Engine은 기업가치의 성장과 현재 가격의 관계를 평가한다.

#### 4.2 Future Core Return Sources

Future Core의 수익은 다음 변화에서 발생한다.

- 작은 매출 기반에서 대규모 시장으로 진입
- 제품에서 플랫폼으로 확장
- 초기 고객 검증에서 반복 가능한 판매로 전환
- 적자 성장에서 영업 레버리지로 전환
- 시장이 의심하던 기술이 상용화
- 경쟁사 탈락과 점유율 상승
- 소형·중형 기업이 기관 투자 가능 규모로 성장

Future Core는 높은 잠재력과 높은 실패 확률을 동시에 가진다.

#### 4.3 Momentum Return Sources

모멘텀 수익은 기업가치의 장기 성장과 별개로 발생할 수 있다.

- 정보 반영의 지연
- 실적 추정치 상향
- 수급 불균형
- 강한 상대강도
- 섹터 로테이션
- 촉매 이후 추세 지속
- 시장 참여자의 포지셔닝 변화
- 위험 선호 국면의 확대

Momentum Engine은 추세가 존재하는 동안만 참여하며, 추세의 이유를 영구적 기업가치로 해석하지 않는다.

#### 4.4 Return Attribution 의무

모든 포지션은 어떤 수익 원천을 기대하는지 기록해야 한다.

```ts
type ReturnSource =
  | 'FUNDAMENTAL_COMPOUNDING'
  | 'VALUATION_NORMALIZATION'
  | 'FUTURE_CORE_SCALE_UP'
  | 'MOMENTUM_CONTINUATION'
  | 'CATALYST_REPRICING'
  | 'SPECIAL_SITUATION'
  | 'CASH_YIELD';
```

수익 원천이 바뀌면 신규 Decision으로 기록해야 한다. 기존 포지션의 설명을 사후적으로 바꾸지 않는다.

---

### 5. 전략의 정의

#### 5.1 Long-term Investing

- 기본 시간축: 5~15년
- 주요 종료 조건: Thesis Break, 구조적 경쟁력 약화, 과도한 가격, 더 나은 기회
- 주요 데이터: 실적, FCF, 시장 구조, 경쟁력, 경영진, 밸류에이션
- 가격 변동의 의미: 사업 논지와 분리해 해석
- 기본 행동: 축적, 보유, 재평가

#### 5.2 Core

Core는 이미 상당 부분 검증된 장기 복리 후보다.

필수 특성:

- 이해 가능한 사업 모델
- 구조적 수요
- 검증된 경쟁우위
- 재무적 생존성을 넘어선 자본 창출력
- 장기 성장을 뒷받침하는 재투자 기회
- 심각한 희석 없이 성장 가능한 구조
- 데이터로 검증 가능한 투자 논지

Core는 유명 기업이나 대형주와 동의어가 아니다.

#### 5.3 Future Core

Future Core는 Core가 될 가능성이 있지만 아직 불확실성이 큰 기업이다.

필수 특성:

- 충분히 큰 시장
- 실제 고객 또는 사용 데이터
- 성장의 질을 확인할 수 있는 지표
- 경쟁우위가 형성될 가능성
- 재무적으로 증명 단계까지 생존할 능력
- 현재 기업가치와 잠재 가치 사이의 비대칭성

Future Core는 단순한 테마주와 구분한다.

#### 5.4 Momentum Investing

- 기본 시간축: 수일~수개월
- 주요 종료 조건: Stop, Target, Time Stop, Setup Invalidation
- 주요 데이터: 가격, 거래량, 상대강도, 변동성, 촉매, 시장 Regime
- 가격 변동의 의미: 거래 신호 자체
- 기본 행동: 진입, 관리, 청산, 회고

Momentum은 장기 기업가치 판단의 보조 점수가 아니다. 독립 전략이다.

#### 5.5 Cash

현금은 투자 실패의 표시가 아니다.

현금의 역할:

- 미래 기회에 대한 옵션
- 예측 오류에 대한 완충
- 생활 자금과 투자 자금의 분리
- Momentum 손실 한도 유지
- 급락 시 강제 매도 방지
- 고평가 시장에서 기대수익 보존

현금은 `아무것도 하지 않음`이 아니라 의도적으로 선택된 포지션이다.

---

### 6. 전략 분리의 불변 규칙

아래 규칙은 시스템의 **Invariants**다.

#### INV-001: 매수 목적은 사후 변경할 수 없다

Momentum으로 진입한 포지션이 손실 나면 Long-term으로 자동 전환할 수 없다.

전환하려면 다음 절차가 필요하다.

1. 기존 Momentum Decision 종료
2. Momentum 규칙에 따른 청산 또는 손실 확정
3. 독립적인 Long-term 평가 실행
4. Portfolio/Risk 재검증
5. 새로운 Long-term Decision 생성

#### INV-002: 자금 Bucket을 임의로 넘지 않는다

Momentum 손실을 복구하기 위해 Long-term Bucket을 사용하지 않는다.

#### INV-003: 동일 종목도 Lot을 분리한다

기업이 같아도 전략이 다르면 다음을 별도로 기록한다.

- 원가
- 수량
- 진입 근거
- 종료 규칙
- 성과
- 모델 버전

#### INV-004: 수익이 규칙 위반을 정당화하지 않는다

손절을 지키지 않았는데 주가가 반등해 수익이 났더라도 좋은 결정으로 기록하지 않는다.

#### INV-005: 손실이 합리적 결정을 나쁜 결정으로 만들지 않는다

충분한 근거와 적절한 위험 크기로 실행했지만 확률적으로 실패한 거래는 모델 평가와 결과 평가를 분리한다.

#### INV-006: Score는 전략 간 직접 비교하지 않는다

`Long-term Score 85`와 `Momentum Score 85`는 같은 의미가 아니다.

#### INV-007: 추천과 실행은 분리한다

분석 결과가 `BUY` 또는 `ENTER`여도 Portfolio와 Risk 검증, 사용자 승인 전에는 실행하지 않는다.

#### INV-008: 출처 없는 사실은 핵심 점수에 반영하지 않는다

LLM의 추론은 `Inference`로 표시하고, 공식 데이터와 구분한다.

---

### 7. 의사결정 우선순위

서로 충돌할 때 다음 순서를 따른다.

```text
1. 생활 자금 및 법적·세무 제약
2. Hard Safety Rule
3. Risk Engine
4. Portfolio Limit
5. 사용자 승인
6. 전략별 분석 결과
7. Cross Signal
8. 표현 방식과 보고서 순위
```

예를 들어 Long-term Score가 매우 높더라도 단일 종목 비중이 상한을 초과하면 추가 매수하지 않을 수 있다.

Momentum Score가 매우 높더라도 유동성이나 이벤트 위험이 기준을 초과하면 진입하지 않는다.

---

### 8. 증거의 계층

#### 8.1 Evidence Hierarchy

| 등급 | 예시 | 기본 용도 |
|---|---|---|
| A | SEC 공시, 감사 재무제표, 거래소 데이터, 공식 IR | 핵심 사실과 점수 |
| B | 공식 컨퍼런스콜, 규제기관, 계약 상대 공식 발표 | 논지와 촉매 |
| C | 신뢰도 높은 데이터 공급자·전문 언론 | 보완 및 교차 검증 |
| D | 업계 인터뷰, 설문, 채널 체크 | 가설과 조기 신호 |
| E | 소셜 미디어, 익명 주장 | 관찰만 가능 |
| F | 출처 불명 요약 | 점수 반영 금지 |

#### 8.2 Fact, Estimate, Inference 구분

모든 분석 문장은 다음 중 하나로 분류할 수 있어야 한다.

```ts
type EvidenceType =
  | 'FACT'
  | 'CONSENSUS_ESTIMATE'
  | 'MANAGEMENT_GUIDANCE'
  | 'MODEL_ESTIMATE'
  | 'INFERENCE'
  | 'HYPOTHESIS';
```

예시:

- `FACT`: 최근 분기 매출
- `MANAGEMENT_GUIDANCE`: 다음 회계연도 가이던스
- `MODEL_ESTIMATE`: 내부 DCF 가정
- `INFERENCE`: 고객 증가가 전환비용 상승을 의미할 가능성
- `HYPOTHESIS`: 신규 제품이 플랫폼으로 확장될 가능성

#### 8.3 데이터 기준일

모든 평가에 다음을 저장한다.

- 데이터 기준일
- 평가 시각
- 시장 가격 기준 시각
- 사용한 모델 버전
- 출처
- 데이터 신뢰도
- 누락된 데이터

과거 평가를 현재 데이터로 덮어쓰지 않는다.

---

### 9. 불확실성 정책

#### 9.1 확률로 사고한다

Investment OS는 확정적 표현보다 시나리오를 선호한다.

```text
Base Case
Bull Case
Bear Case
Thesis Break Case
```

각 시나리오에는 다음이 필요하다.

- 핵심 가정
- 관찰 가능한 지표
- 예상 시간축
- 발생 가능성
- 포트폴리오 영향
- 대응 행동

#### 9.2 모르는 것을 점수화하지 않는다

데이터가 부족한 경우 중립 점수를 자동 부여하지 않는다.

```ts
type MetricAvailability =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN';
```

`UNKNOWN`은 신뢰도와 포지션 크기를 낮추는 방향으로 처리한다.

#### 9.3 Confidence와 Score를 분리한다

높은 점수라도 데이터 신뢰도가 낮으면 포지션을 작게 가져가야 한다.

```ts
interface EvaluationConfidence {
  score: number;
  evidenceCoverage: number;
  sourceQuality: number;
  modelFit: number;
  disagreement: number;
}
```

#### 9.4 예측과 관찰을 구분한다

- 관찰: 현재 매출 성장률
- 예측: 향후 성장률
- 논지: 왜 성장률이 지속될 것인지
- 트리거: 어떤 데이터가 예측을 수정하게 하는지

---

### 10. 사용자와 시스템의 책임

#### 10.1 시스템의 책임

- 일관된 기준으로 분석
- 근거와 출처 표시
- 전략별 결과 분리
- 위험 한도 검증
- 과거 판단 보존
- 불확실성 공개
- 하나의 최우선 선택을 명시
- 현금 유지도 합법적 결론으로 처리

#### 10.2 사용자의 책임

- 실제 투자 가능 자금 입력
- 투자 기간과 생활 자금 분리
- 위험 설정 승인
- 최종 주문 승인
- 보유 내역 정확히 기록
- 규칙을 변경하려면 사유 남김
- 세무·법률·개인 재무 상황 확인

#### 10.3 시스템이 하지 않는 것

- 수익 보장
- 미래 주가 확정
- 사용자 동의 없는 주문
- 손실 회피를 위한 사후 논리 변경
- 투자 책임 대체
- 출처 없는 루머를 사실로 처리
- 위험 한도를 넘어선 고확신 추천

---

### 11. 정책 수준

모든 규칙은 다음 수준 중 하나를 가진다.

| 수준 | 의미 |
|---|---|
| MUST | 위반 시 시스템이 실행을 막아야 함 |
| SHOULD | 기본적으로 지키되 예외 사유와 승인이 필요 |
| MAY | 상황에 따라 사용할 수 있음 |
| MUST NOT | 실행 자체가 금지됨 |

예시:

- Momentum 거래는 Stop을 **MUST** 가진다.
- Long-term Thesis는 분기 실적 후 검토를 **SHOULD** 한다.
- Future Core는 탐색 포지션을 **MAY** 가질 수 있다.
- 손실 Momentum을 자동 Long-term 전환하면 **MUST NOT** 된다.

---

### 12. 철학 변경 거버넌스

Investment Philosophy는 시장 상황에 따라 매주 바꾸지 않는다.

#### 12.1 변경 가능 항목

- 전략별 목표 비중 범위
- 위험 한도
- Score 항목
- 모델 가중치
- 리뷰 주기
- 보고서 형식
- 데이터 신뢰도 기준

#### 12.2 쉽게 바꾸면 안 되는 항목

- 전략 분리
- 자금 Bucket 분리
- Risk Engine 거부권
- 모델 버전 기록
- 출처와 기준일 보존
- Human-in-the-loop
- 손실 거래의 사후 전략 변경 금지

#### 12.3 변경 절차

```text
문제 발견
  ↓
Investment Lesson
  ↓
Policy Change Proposal
  ↓
영향 분석
  ↓
Historical Replay
  ↓
사용자 승인
  ↓
새 Philosophy Version
  ↓
하위 문서 동기화
```

#### 12.4 변경 기록

```ts
interface PhilosophyChange {
  version: string;
  effectiveFrom: string;
  section: string;
  previousPolicy: string;
  newPolicy: string;
  rationale: string;
  relatedLessons: string[];
  approvedBy: string;
}
```

---

### 13. Anti-goals

Investment OS는 다음 제품이 아니다.

- 실시간 급등주 알림만 제공하는 서비스
- 목표주가를 하나의 숫자로 맞히는 서비스
- AI가 자동으로 모든 투자를 결정하는 서비스
- 뉴스 감성에 따라 매수·매도를 반복하는 서비스
- 손실 종목의 평단을 낮추는 도구
- 포트폴리오를 매일 최적화하는 수학 모델
- 모든 유망 산업을 동일 비중으로 담는 테마 ETF
- 단기 성과로 장기 모델을 매주 변경하는 시스템

---

### 14. 최상위 체크리스트

모든 신규 투자 제안은 최소한 다음에 답해야 한다.

#### 공통

- 이 포지션은 어느 전략인가?
- 예상 보유 기간은 얼마인가?
- 기대 수익의 원천은 무엇인가?
- 어떤 데이터가 근거인가?
- 가장 중요한 반대 근거는 무엇인가?
- 포지션이 틀렸음을 무엇으로 판단하는가?
- 현재 포트폴리오에서 감당 가능한가?
- 현금보다 우월한가?
- 더 나은 대안과 비교했는가?
- 실제 실행 전 Risk 검증을 통과했는가?

#### 장기 추가 질문

- 기업가치가 장기간 커질 구조인가?
- 시장과 경쟁우위가 지속 가능한가?
- 현재 가격이 기대수익을 남기는가?
- Thesis가 가격 하락이 아니라 사업 데이터로 검증되는가?

#### Momentum 추가 질문

- 현재 시장 Regime이 허용하는가?
- 유동성이 충분한가?
- 진입·손절·목표·Time Stop이 있는가?
- Setup이 무효화되면 즉시 종료할 수 있는가?

---

### 15. Part 1 완료 기준

이 Part는 다음을 고정한다.

- Investment OS의 목적
- 최적화 우선순위
- 전략의 정의
- 수익 원천의 분리
- 전략 불변 규칙
- 증거와 불확실성 기준
- 사용자와 시스템의 책임
- 철학 변경 거버넌스

다음 Part에서는 Long-term, Core, Future Core의 철학과 의사결정 규칙을 상세히 정의한다.

---

## 02-2. Long-term, Core, and Future Core Philosophy

> 기업가치의 장기 성장에 참여하기 위한 종목 선정, 축적, 보유, 재평가, 승격·강등 원칙

- Chapter: `02_Investment_Philosophy`
- Part: 2 / 5
- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 관련 Engine: Long-term Engine, Core Engine, Future Core Engine
- 관련 후속 문서: `03_LongTerm_Engine.md`, `09_Scoring_System.md`

---

### 1. Long-term 전략의 목적

Long-term 전략의 목적은 주가가 오를 종목을 장기간 보유하는 것이 아니다.

> 장기간 기업가치를 복리로 증가시킬 수 있는 사업의 일부를, 기대수익이 충분한 가격에 취득하고, 핵심 가정이 유지되는 동안 보유하는 것.

이 정의에는 세 가지 조건이 모두 필요하다.

1. **좋은 사업**: 장기적으로 가치가 커질 수 있어야 한다.
2. **좋은 가격**: 사업이 좋아도 가격이 모든 낙관을 반영하면 기대수익이 낮다.
3. **좋은 보유 규칙**: 변동성은 견디되 Thesis 훼손은 방치하지 않아야 한다.

Long-term 전략은 가격 예측보다 사업가치의 방향과 속도를 평가한다. 다만 가치평가를 무시하지 않는다.

---

### 2. 장기 수익 방정식

장기 기대수익은 다음 구성요소로 분해한다.

```text
Expected Long-term Return
≈ Fundamental Growth
+ Shareholder Yield
+ Valuation Change
- Dilution
- Permanent Impairment Risk
```

#### 2.1 Fundamental Growth

- 매출 성장
- 영업이익 성장
- FCF 성장
- 단위 경제성 개선
- 자본 효율 개선
- 점유율 상승

#### 2.2 Shareholder Yield

- 배당
- 순자사주 매입
- 주당 지표 개선

단순한 자사주 매입 금액이 아니라 주식보상까지 반영한 **순주식수 감소**를 본다.

#### 2.3 Valuation Change

- 과소평가 회복
- 사업 품질 향상에 따른 멀티플 상승
- 과도한 기대 정상화에 따른 멀티플 하락

장기 수익이 멀티플 확장에만 의존하면 취약한 Thesis다.

#### 2.4 Dilution

- 주식보상
- 증자
- 전환사채
- 인수 대가로 발행된 주식

Future Core는 희석을 특히 강하게 반영한다.

#### 2.5 Permanent Impairment

일시적인 가격 하락이 아니라 기업의 장기 가치가 훼손되는 위험이다.

- 기술 대체
- 경쟁우위 상실
- 과도한 부채
- 규제에 의한 사업 모델 붕괴
- 고객 집중으로 인한 계약 손실
- 반복적 자본 조달 실패
- 회계 신뢰 상실

---

### 3. Business Quality 철학

Business Quality는 단순히 현재 이익률이 높은지를 의미하지 않는다.

좋은 사업은 다음 질문에 긍정적으로 답할 가능성이 높다.

1. 고객이 이 제품을 계속 사용해야 하는 이유가 있는가?
2. 회사가 가격을 올리거나 더 많은 제품을 판매할 수 있는가?
3. 경쟁사가 자본을 투입해도 쉽게 따라올 수 없는가?
4. 성장이 커질수록 경제성이 개선되는가?
5. 경영진이 벌어들인 현금을 높은 수익률로 재투자할 수 있는가?
6. 외부 자본 없이도 장기간 성장할 수 있는가?
7. 실패 시 회복할 수 있는 재무적 여유가 있는가?

#### 3.1 Business Quality의 구성

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

#### 3.2 좋은 사업과 좋은 주식의 차이

좋은 사업도 다음 이유로 나쁜 투자가 될 수 있다.

- 현재 가격이 지나치게 높음
- 성장 기대가 비현실적임
- 규제 위험이 가격에 반영되지 않음
- 경영진이 주주가치를 희석함
- 산업의 자본집약도가 급격히 높아짐
- 매출은 성장하지만 FCF가 구조적으로 나오지 않음

반대로 평범한 사업도 극단적 저평가와 명확한 촉매가 있으면 수익을 낼 수 있다. 그러나 해당 투자는 Core가 아니라 별도 전략으로 분류해야 한다.

---

### 4. Market / TAM 철학

#### 4.1 큰 시장은 필요조건이지 충분조건이 아니다

TAM이 크다는 사실만으로 기업이 성공하지 않는다.

확인해야 할 질문:

- 실제 지불 의사가 있는 시장인가?
- 회사가 접근 가능한 `Serviceable Available Market`은 얼마인가?
- 판매·규제·생산 제약을 반영한 `Serviceable Obtainable Market`은 얼마인가?
- 시장 성장의 원인이 구조적인가, 일시적인가?
- 성장의 경제적 이익을 공급자가 가져가는가, 고객이 가져가는가?
- 신규 공급이 수익성을 빠르게 훼손할 수 있는가?

#### 4.2 TAM 확장 경로

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

#### 4.3 유행과 구조적 성장 구분

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

### 5. Moat 철학

Moat는 경쟁사가 존재하지 않는다는 뜻이 아니다.

> 경쟁이 존재해도 장기간 초과수익과 고객 관계를 유지할 수 있게 하는 구조적 우위.

#### 5.1 Moat 유형

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

#### 5.2 Moat는 결과로 검증한다

경영진의 `우리는 플랫폼이다`라는 표현보다 다음 결과를 본다.

- 높은 유지율
- 안정적 또는 상승하는 매출총이익률
- 고객당 매출 증가
- 낮아지는 CAC Payback
- 경쟁사 대비 점유율 상승
- 가격 인상 후 유지되는 사용량
- 제품 확장에 따른 마진 개선

#### 5.3 Moat의 시간축

Future Core는 완성된 Moat보다 **Moat Formation**을 평가한다.

Core는 이미 형성된 Moat가 강화 또는 약화되는지를 평가한다.

---

### 6. Unit Economics와 성장의 질

매출 성장률 하나만으로 성장의 질을 판단하지 않는다.

#### 6.1 공통 질문

- 신규 고객을 얻는 비용은 얼마인가?
- 고객이 남기는 장기 가치가 취득 비용보다 충분히 큰가?
- 성장이 마케팅 지출 중단 후에도 유지되는가?
- 가격 할인 없이 성장하는가?
- 매출채권과 계약 조건이 악화되지 않는가?
- 현금 회수가 매출 인식과 일치하는가?
- 주식보상을 포함해도 경제적 이익이 존재하는가?

#### 6.2 SaaS / Subscription

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

#### 6.3 Marketplace / Network

- GMV
- Take Rate
- Active Buyers / Sellers
- Frequency
- Cohort Retention
- Contribution Margin
- Subsidy Dependence
- Fraud / Loss Rate

#### 6.4 Hardware / Semiconductor

- ASP
- Unit Shipment
- Capacity Utilization
- Yield
- Inventory Days
- Gross Margin through Cycle
- Customer Concentration
- Design Win Duration
- CapEx Intensity

#### 6.5 Industrial / Energy

- Backlog Quality
- Book-to-Bill
- Project Margin
- Working Capital
- Capacity Expansion
- Contract Escalator
- Regulatory Approval
- Commodity Exposure

#### 6.6 Biotechnology

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

### 7. Management와 Capital Allocation

#### 7.1 경영진 평가 원칙

카리스마보다 다음을 본다.

- 약속과 실제 결과의 일치
- 불리한 정보의 투명성
- 장기 목표와 단기 보상의 정렬
- 핵심 인재 유지
- 자본 배분의 일관성
- 인수 가격과 사후 성과
- 주식보상 규율
- 실패 인정과 전략 수정 능력

#### 7.2 Founder-led의 해석

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

#### 7.3 Capital Allocation 우선순위

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

### 8. Financial Strength와 생존성

#### 8.1 Core의 재무 기준

Core는 일반적으로 다음 중 다수를 만족해야 한다.

- 반복 가능한 영업현금흐름
- 만기 구조가 관리 가능한 부채
- 불황에도 투자 가능한 유동성
- 주식 희석 없이 사업 운영 가능
- 높은 이자보상능력
- 운전자본 변동을 견딜 수 있음

#### 8.2 Future Core의 재무 기준

Future Core는 현재 이익보다 **증명 단계까지 생존 가능한지**가 중요하다.

필수 확인:

- Cash Runway
- 예상 Burn Rate
- 추가 자금조달 시점
- 희석 가능성
- 부채 Covenant
- 생산·임상·데이터센터 등 다음 자본 지출
- 손익분기점 도달 가정

#### 8.3 성장과 FCF의 관계

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

### 9. Valuation 철학

#### 9.1 Valuation은 가격 예측이 아니다

Valuation의 목적은 정확한 적정가 하나를 계산하는 것이 아니다.

> 현재 가격에서 기대수익이 어떤 가정에 의존하는지, 하방과 상방이 얼마나 비대칭적인지를 파악하는 것.

#### 9.2 복수 방법 사용

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

#### 9.3 Reverse DCF 우선 질문

현재 가격이 정당화되려면 다음이 얼마나 필요할까?

- 매출 성장률
- 최종 마진
- 재투자율
- 자본 비용
- 희석
- Terminal Growth

이 가정이 현실적인지 사업 데이터와 비교한다.

#### 9.4 고성장주의 멀티플

고성장주는 현재 이익이 작아 PER이 왜곡될 수 있다.

따라서 다음을 함께 본다.

- 성장 지속 기간
- 총이익 성장
- 영업 레버리지
- FCF 전환 시점
- 희석
- 밸류에이션이 요구하는 미래 시장점유율

#### 9.5 가격 매력도는 절대·상대 기준을 모두 사용한다

절대 기준:

- 보수적 가정에서 양의 기대수익이 있는가?
- 하방 시 영구 손실 가능성이 감당 가능한가?

상대 기준:

- 같은 산업 대안보다 좋은가?
- 다른 산업 Core보다 좋은가?
- 현금·채권·지수보다 위험조정 기대수익이 좋은가?

---

### 10. Margin of Safety

Margin of Safety는 단순히 적정가보다 몇 퍼센트 낮은지를 의미하지 않는다.

다음 네 종류로 구성된다.

#### 10.1 Price Margin

보수적 가치 범위 대비 할인.

#### 10.2 Business Margin

예상보다 성장이 낮아도 생존하고 가치를 만들 수 있는 사업 구조.

#### 10.3 Balance Sheet Margin

추정이 틀려도 자금조달 없이 버틸 수 있는 재무 여력.

#### 10.4 Position Size Margin

기업 판단이 틀려도 전체 포트폴리오가 치명적으로 훼손되지 않는 비중.

Future Core는 Price Margin보다 Position Size와 Balance Sheet Margin을 더 중요하게 볼 수 있다.

---

### 11. Opportunity Cost 철학

#### 11.1 모든 매수의 진짜 질문

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

#### 11.2 신규 투자와 기존 보유의 일관성

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

#### 11.3 Opportunity Cost 비교표

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

#### 11.4 과도한 순위 최적화 방지

종목 간 점수 차이가 작고 오차 범위가 크면 `1위 몰빵`을 하지 않는다.

```text
Score Difference < Uncertainty Band
→ 실질적으로 동일 등급
→ 분산 또는 비중 유지 가능
```

---

### 12. Investment Thesis Framework

#### 12.1 Thesis의 정의

Thesis는 `회사가 좋다`라는 서술이 아니다.

> 현재 시장 가격이 충분히 반영하지 않은 가치 창출 메커니즘과, 이를 검증할 수 있는 관찰 지표의 집합.

#### 12.2 Thesis 구성

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

#### 12.3 좋은 Thesis의 조건

- 3~5문장으로 요약 가능
- 사실과 추론이 구분됨
- 핵심 가정 수가 제한됨
- 관찰 가능한 지표가 있음
- 반대 시나리오가 있음
- 가격과 기업가치가 연결됨
- 무엇이 틀리면 매도할지 명확함

#### 12.4 나쁜 Thesis의 예

- AI 시대이므로 오른다.
- 유명한 CEO가 있다.
- 주가가 많이 떨어졌다.
- 과거 고점까지 반등할 것이다.
- 기관 목표주가가 높다.
- 언젠가 시장이 알아줄 것이다.

#### 12.5 Thesis Assumption

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

#### 12.6 Thesis Break

Thesis Break는 주가 하락률이 아니다.

가능한 예:

- 핵심 제품의 구조적 점유율 하락
- 고객 유지율의 지속적 훼손
- 계약이 매출·현금흐름으로 전환되지 않음
- 예상보다 큰 희석 없이는 생존 불가
- 핵심 기술이 대체됨
- 경영진 신뢰 상실
- 규제로 사업 모델이 불가능해짐

#### 12.7 Thesis 상태

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

### 13. Core와 Future Core의 구분

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

#### 13.1 Future Core 단계

```text
Universe
→ Watch
→ Candidate
→ Strong Candidate
→ Future Core
→ Core Promoted
```

#### 13.2 단계별 증거 요구

##### Universe

- 산업 가설
- 기업 기본 정보
- 최소한의 데이터

##### Watch

- 실제 제품·고객 존재
- 시장 규모 검증 필요
- 재무 생존성 확인 중

##### Candidate

- 매출·사용량 성장
- 고객 가치 확인
- 경영진·재무 자료 신뢰 가능

##### Strong Candidate

- 복수 분기 증거
- 점유율 또는 단위 경제성 개선
- 희석·생존 위험 관리 가능

##### Future Core

- 반복 가능한 성장
- Moat 형성
- 합리적 가격
- 탐색 포지션 보유 가능

##### Core Promoted

- 산업 리더십 또는 명확한 우위
- FCF 또는 높은 확률의 FCF 전환
- 재무 생존성 검증
- 장기 보유에 적합한 지배구조

#### 13.3 강등 규칙

- 성장 둔화 자체보다 원인을 본다.
- 제품 문제가 아닌 시장 일시 둔화일 수 있다.
- 단, 생존·희석·신뢰 문제는 빠르게 반영한다.
- 순위 하락과 포지션 매도는 별도 결정이다.

---

### 14. 진입과 축적 철학

#### 14.1 최초 진입

최초 진입의 목적은 확신을 선언하는 것이 아니라 실제 추적 책임을 만드는 것이다.

필수 조건:

- 전략 분류 완료
- Thesis 작성
- 가치 범위 작성
- 주요 반대 근거 작성
- 포트폴리오 한도 확인
- 리뷰 일정 설정

#### 14.2 분할매수

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

#### 14.3 가격 상승 중 추가매수

주가가 올랐다는 이유만으로 추가매수를 금지하지 않는다.

다음이 가격보다 더 빠르게 개선될 수 있다.

- 이익 전망
- 시장 크기
- Moat
- FCF
- 신뢰도

질문은 항상 같다.

> 현재 가격에서 오늘 처음 평가해도 매수할 것인가?

#### 14.4 월급날 신규 자금

월급날은 자동 매수일이 아니라 정기 자본 배분일이다.

가능한 결론:

- 기존 Core 추가
- 신규 Core 진입
- Future Core 탐색 포지션
- 현금 유지
- 전략 비중 복원

---

### 15. 보유 철학

#### 15.1 보유의 적극성

보유는 아무것도 하지 않는 것이 아니다.

보유 중 수행할 일:

- 실적 검토
- Thesis 상태 업데이트
- 경쟁사 비교
- 산업 구조 변화 확인
- 가치 범위 업데이트
- 포트폴리오 집중도 확인

#### 15.2 가격 변동 처리

| 상황 | 기본 대응 |
|---|---|
| 가격 하락, Thesis 강화 | 추가매수 검토 |
| 가격 하락, Thesis 유지 | 가치·비중 재검토 |
| 가격 하락, Thesis 약화 | 추가매수 중단 |
| 가격 하락, Thesis 파손 | 청산 검토 |
| 가격 상승, 가치도 상승 | 보유 또는 추가 가능 |
| 가격 상승, 가치 정체 | 비중·기회비용 검토 |
| 가격 급등, 극단적 고평가 | 축소 또는 신규매수 중단 |

#### 15.3 승자를 너무 일찍 팔지 않는다

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

### 16. 매도와 축소 철학

#### 16.1 매도 분류

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

#### 16.2 Thesis Break 매도

가격 회복을 기다리지 않는다.

`내 평단`은 기업가치와 무관하다.

#### 16.3 Valuation 매도

좋은 기업을 고평가만으로 전량 매도하는 것은 신중해야 한다.

가능한 대응 순서:

1. 신규매수 중단
2. 자동 재투자 중단
3. 일부 축소
4. 극단적 가정에서만 정당화되는 경우 추가 축소
5. 사업 논지와 함께 훼손된 경우 전량 검토

#### 16.4 더 나은 대안

기회비용 매도는 다음을 요구한다.

- 기존 종목의 세후 기대수익
- 대안의 기대수익
- 신뢰도 차이
- 거래 비용
- 포트폴리오 분산 효과
- 판단 오류 가능성

작은 점수 차이로 잦은 교체를 하지 않는다.

---

### 17. Drawdown 철학

#### 17.1 Drawdown은 정보이지 자동 신호가 아니다

가격 하락은 다음 중 하나일 수 있다.

- 시장 전체 위험 회피
- 밸류에이션 정상화
- 일시적 실적 문제
- 구조적 사업 훼손
- 정보 비대칭
- 단순 수급

시스템은 원인을 분류한 뒤 행동한다.

#### 17.2 Drawdown Review

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

#### 17.3 패닉 셀 방지

- 시장 중 급락 시 즉시 장기 Thesis를 바꾸지 않는다.
- 공식 정보가 없는 경우 거래 종료 후 검토할 수 있다.
- 단, 사기·회계·파산 등 Hard Risk는 즉시 대응한다.
- 사용자 감정 상태를 Decision Journal에 기록할 수 있다.

---

### 18. 산업별 평가 적합성

하나의 점수 모델을 모든 산업에 동일 적용하지 않는다.

#### 18.1 Software

중요도 상승:

- Retention
- Gross Margin
- CAC Efficiency
- Platform Expansion
- Switching Cost

#### 18.2 Semiconductor

중요도 상승:

- Cycle Position
- Design Win
- Yield
- Capacity
- Customer Concentration
- Technology Roadmap

#### 18.3 Capital-intensive Infrastructure

중요도 상승:

- Contract-backed CapEx
- Financing Cost
- Utilization
- FCF Conversion
- Counterparty Risk

#### 18.4 Biotechnology

중요도 상승:

- Clinical Probability
- Cash Runway
- Regulatory Milestone
- Portfolio Diversification

#### 18.5 Consumer / Marketplace

중요도 상승:

- Cohort
- Frequency
- Brand
- Unit Economics
- Network Liquidity

공통 Core Score는 유지하되 산업별 Sub-model을 사용할 수 있다.

---

### 19. 예시: 같은 기업을 다르게 판단하는 방법

> 아래는 시스템 동작 설명을 위한 가상 예시이며 현재 투자 추천이 아니다.

#### 19.1 Oracle-like Infrastructure Company

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

#### 19.2 Microsoft-like Platform Company

핵심 질문:

- 높은 사업 품질이 현재 가격에 얼마나 반영되었는가?
- AI 투자가 기존 소프트웨어·클라우드 경제성을 높이는가?
- CapEx 증가보다 FCF 성장이 빠른가?

좋은 회사라는 사실만으로 항상 최우선 매수 후보가 되는 것은 아니다.

#### 19.3 Early-stage Future Core

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

### 20. Long-term Decision Contract

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

### 21. Long-term 체크리스트

#### 사업

- 고객에게 필수적인가?
- 시장은 구조적으로 성장하는가?
- 점유율이 상승하는가?
- 경쟁우위가 결과로 확인되는가?
- 제품이 생태계로 확장될 수 있는가?

#### 재무

- 성장의 질이 좋은가?
- FCF 또는 FCF 전환 경로가 명확한가?
- 부채와 희석이 감당 가능한가?
- 재투자 수익률이 높은가?
- 불황에서도 생존 가능한가?

#### 경영진

- 약속을 지키는가?
- 불리한 정보를 투명하게 공개하는가?
- 자본을 합리적으로 배분하는가?
- 주주와 이해가 정렬되는가?

#### 가격

- 현재 가격이 요구하는 가정은 무엇인가?
- Bear Case에서도 영구 손실 위험이 감당 가능한가?
- 대안 대비 기대수익이 좋은가?
- Margin of Safety가 가격·사업·재무·비중 중 어디에 있는가?

#### 논지

- Thesis가 구체적인가?
- 관찰 지표가 있는가?
- Thesis Break가 명확한가?
- 다음 리뷰 시점이 정해졌는가?

#### 포트폴리오

- 동일 산업·고객·기술 위험에 집중되는가?
- 현재 비중에서 판단 오류를 감당할 수 있는가?
- 신규 자금의 최선의 사용인가?

---

### 22. Part 2 완료 기준

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

---

## 02-3. Momentum and Tactical Investing Philosophy

> 제한된 위험 예산으로 단기·중기 가격 추세와 촉매를 활용하되, 장기투자 규칙을 오염시키지 않는 전술적 투자 정책

- Chapter: `02_Investment_Philosophy`
- Part: 3 / 5
- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 관련 Engine: Momentum Engine, Risk Engine, Portfolio Engine
- 관련 후속 문서: `04_Momentum_Engine.md`, `09_Scoring_System.md`

---

### 1. Momentum 전략의 목적

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

### 2. Momentum과 단순 추격매수의 차이

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

### 3. 전략의 시간축

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

### 4. Expected Value 철학

Momentum 거래는 적중률이 아니라 기대값으로 평가한다.

```text
Expectancy
= Win Rate × Average Win
- Loss Rate × Average Loss
- Trading Costs
```

#### 4.1 R-Multiple

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

#### 4.2 적중률 착시

- 80% 적중률이어도 평균 손실이 평균 수익보다 크면 실패할 수 있다.
- 40% 적중률이어도 평균 수익이 평균 손실의 3배면 성공할 수 있다.
- 손절 미준수로 발생한 큰 손실은 모델의 작은 Edge를 파괴한다.

#### 4.3 거래 비용

다음을 기대값에서 차감한다.

- 수수료
- 세금
- 환전 비용
- Bid-Ask Spread
- Slippage
- Gap Loss
- 미체결 기회비용

---

### 5. Market Regime 우선 원칙

좋은 개별 종목도 시장 Regime이 불리하면 성공 확률이 낮아질 수 있다.

#### 5.1 Regime 분류 예시

```ts
type MarketRegime =
  | 'RISK_ON_TREND'
  | 'RISK_ON_VOLATILE'
  | 'NEUTRAL_RANGE'
  | 'RISK_OFF'
  | 'CRISIS';
```

#### 5.2 Regime 입력

- 주요 지수 추세
- 상승·하락 종목 비율
- 신고가·신저가
- 변동성 지수
- 신용 스프레드
- 금리 변동
- 섹터 확산도
- 거래량
- 시장 리더의 건전성

#### 5.3 Regime별 기본 정책

| Regime | 신규 진입 | 포지션 크기 | Setup 요구 |
|---|---|---|---|
| Risk-on Trend | 허용 | 정상 | 표준 |
| Risk-on Volatile | 선별 허용 | 축소 | 높은 유동성 |
| Neutral Range | 제한 | 축소 | 빠른 목표·명확한 촉매 |
| Risk-off | 원칙적 제한 | 매우 작음 | 예외적 상대강도 |
| Crisis | 기본적으로 신규 Long 금지 | 0 | 신규 위험 차단·정책 재검토 |

Regime는 개별 종목 Score를 바꾸기보다 `거래 허용도`와 `Position Size Multiplier`를 조정한다.

---

### 6. Universe 철학

모든 상장 종목을 거래 대상으로 삼지 않는다.

#### 6.1 기본 필터

- 최소 시가총액
- 최소 일평균 거래대금
- 최대 Spread
- 최소 주가
- 거래정지·상장폐지 위험 제외
- 회계·공시 신뢰도
- 공매도·차입 제약
- ADR·해외 규제 위험

#### 6.2 Liquidity 우선

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

#### 6.3 Penny Stock와 과도한 저유동성 제외

MVP에서는 다음을 원칙적으로 제외한다.

- 극저가 주식
- 거래량이 특정 날짜에만 급증한 종목
- 반복적 증자 기업
- 홍보성 뉴스 의존 기업
- 공시가 불충분한 기업
- 단일 임상·판결 이벤트만 남은 극단적 Binary Risk

---

### 7. Sector Rotation 철학

Momentum은 개별 기업만이 아니라 자금 흐름의 계층을 본다.

```text
Market
→ Asset Class
→ Sector
→ Industry
→ Company
```

#### 7.1 좋은 후보의 구조

- 시장이 상승 추세
- 해당 섹터가 시장 대비 강함
- 산업이 섹터 내에서 강함
- 종목이 산업 내 리더

#### 7.2 약한 시장의 강한 종목

상대강도가 높아도 시장이 극단적으로 약하면 다음을 구분한다.

- 실제 기관 축적
- 단순 방어주 특성
- Short Squeeze
- 이벤트성 급등

약한 시장에서의 예외적 강세는 후보 가치는 있지만 Position Size를 낮춘다.

---

### 8. Relative Strength 철학

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

### 9. Volume 철학

거래량은 참여 강도와 유동성을 보여주지만 원인을 직접 말해주지 않는다.

#### 9.1 긍정적 거래량 패턴

- 돌파 시 평균 대비 유의미한 증가
- 조정 시 감소
- 상승일 거래량이 하락일보다 우세
- 실적 Gap 후 높은 거래량과 가격 유지
- 장기간 Base 형성 후 수요 증가

#### 9.2 위험한 거래량 패턴

- 뉴스 없는 저유동성 급증
- 장중 급등 후 종가 약세
- 반복적인 긴 윗꼬리
- 거래량 증가와 함께 지지선 이탈
- 증자 발표 전후 이상 거래

#### 9.3 거래량과 시가총액

같은 거래량 증가율이라도 종목 규모에 따라 의미가 다르다.

- Mega-cap: 작은 상대 증가도 큰 자금 유입일 수 있음
- Small-cap: 높은 증가율이 소수 주문으로 발생할 수 있음

---

### 10. Catalyst 철학

Momentum은 `왜 지금인가?`에 답해야 한다.

#### 10.1 Catalyst 유형

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

#### 10.2 좋은 Catalyst

- 기업가치 추정치를 실제로 바꿈
- 여러 분기에 영향을 줄 수 있음
- 시장 기대와 차이가 큼
- 거래량과 추정치 수정이 동반됨
- 후속 데이터로 검증 가능

#### 10.3 약한 Catalyst

- 구체적 금액 없는 파트너십
- 이미 알려진 행사
- 반복 보도
- 경영진의 모호한 낙관론
- 매출과 무관한 홍보
- 소셜 미디어 루머

#### 10.4 Catalyst Half-life

촉매는 시간이 지나면서 정보 가치가 감소한다.

시스템은 다음을 기록한다.

- 최초 발생 시각
- 시장 반응
- 추정치 수정 여부
- 가격이 이미 반영한 정도
- 후속 확인 일정

---

### 11. Setup Taxonomy

Setup은 사후 설명이 아니라 사전 정의된 패턴이다.

#### 11.1 Breakout

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

#### 11.2 Pullback

조건 예시:

- 기존 상승 추세
- 낮은 거래량의 조정
- 주요 이동평균 또는 이전 돌파선 지지
- 상대강도 유지

무효화:

- 고거래량 지지선 이탈
- 섹터 리더십 상실

#### 11.3 Earnings Momentum

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

#### 11.4 Gap Continuation

조건 예시:

- 강한 공식 촉매
- Gap 이후 가격 유지
- 충분한 유동성
- 장중 지지 형성

위험:

- Opening Exhaustion
- Spread 확대
- 뉴스 해석 반전

#### 11.5 Sector Rotation

조건 예시:

- 섹터 ETF 상대강도 전환
- 복수 종목 동반 상승
- 자금 유입 데이터
- 지속 가능한 산업 촉매

#### 11.6 Special Situation

- Index Inclusion
- Spin-off
- Tender
- Restructuring
- Court / Regulatory Event

Special Situation은 일반 Momentum과 별도 Sub-strategy로 관리할 수 있다.

---

### 12. Entry 철학

#### 12.1 Entry는 신호가 아니라 가격 구간이다

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

#### 12.2 Chase Limit

좋은 Setup도 진입 가격이 나쁘면 기대값이 낮아진다.

다음 경우 대기한다.

- 계획한 Entry Zone 초과
- Stop까지 거리가 지나치게 큼
- Gap이 평균 변동성을 크게 초과
- Reward/Risk가 기준 미달
- 장 초반 유동성이 불안정

`놓친 거래`는 손실이 아니다.

#### 12.3 Partial Entry

불확실성이 높지만 Setup이 유효한 경우 분할 진입이 가능하다.

단, 분할은 손실을 무제한 평균내리는 방식이 아니다.

- 초기 시험 포지션
- 확인 후 추가
- 최대 위험은 사전에 고정
- Stop은 전체 Position 기준

#### 12.4 Confirmation과 Early Entry

- Early Entry: 좋은 가격, 낮은 확인
- Confirmation Entry: 높은 확인, 나쁜 가격 가능

시스템은 두 방식을 별도 Setup으로 기록해 성과를 비교한다.

---

### 13. Stop Loss와 Invalidation

#### 13.1 Stop의 목적

Stop은 틀렸음을 완벽하게 증명하는 가격이 아니다.

> 거래 가설의 기대값이 충분히 낮아져 더 이상 위험을 감수할 이유가 없는 지점.

#### 13.2 Stop 유형

- Structural Stop: 지지·돌파 무효화
- Volatility Stop: ATR 기반
- Time Stop: 정해진 기간 내 진행 없음
- Event Stop: 이벤트 전 청산
- Portfolio Stop: 전체 Risk Limit 초과

#### 13.3 Mental Stop 금지

MVP에서는 실제 주문 연동이 없더라도 Stop 가격을 기록해야 한다.

`상황을 보고 판단`만 있는 거래는 승인하지 않는다.

#### 13.4 Stop 확대 금지

진입 후 손실을 피하기 위해 Stop을 더 멀리 옮기면 안 된다.

예외:

- 주식 분할 등 가격 조정
- 데이터 오류
- 사전에 정의된 변동성 모델 적용

예외는 Audit Log에 남긴다.

#### 13.5 Gap through Stop

실제 손실은 Stop보다 클 수 있다.

따라서 다음 종목은 Position Size를 줄인다.

- 실적 발표 보유
- 임상·규제 이벤트
- 저유동성
- 높은 공매도 비율
- 뉴스 Gap 빈도 높음

---

### 14. Position Sizing 철학

Momentum 포지션은 투자 금액보다 손실 가능 금액으로 결정한다.

```text
Position Size
= Allowed Risk Amount
÷ (Entry Price - Stop Price)
```

#### 14.1 Allowed Risk

Allowed Risk는 다음에 따라 조정한다.

- 전체 포트폴리오 크기
- Momentum Bucket 크기
- 현재 Open Risk
- Market Regime
- Setup Quality
- 유동성
- 이벤트 위험
- 최근 Drawdown

#### 14.2 Score가 높아도 무제한 비중 금지

- Score는 확률 추정치이며 확정이 아니다.
- 상관된 거래가 여러 개면 실제 위험이 중복된다.
- 같은 섹터 5종목은 독립 거래 5개가 아니다.

#### 14.3 Pyramiding

승자에 추가하는 것은 허용할 수 있다.

조건:

- 기존 포지션이 이익 상태
- 새로운 Setup 발생
- 전체 Risk 재계산
- Stop 상향으로 Open Risk 통제
- 손실 포지션 물타기와 구분

---

### 15. Exit 철학

#### 15.1 Exit 유형

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

#### 15.2 Target Exit

- 1차 목표에서 일부 청산 가능
- 나머지는 추세 유지 시 보유 가능
- 목표가는 기술적 저항·변동성·R-Multiple 기반

#### 15.3 Trailing Stop

Trailing Stop은 승자의 상방을 열어두기 위한 도구다.

가능한 기준:

- 이동평균
- ATR
- 이전 저점
- 최고가 대비 비율

Setup별로 하나의 기준을 고정해 성과를 검증한다.

#### 15.4 Time Stop

예상 기간 내 움직임이 없으면 자본을 회수한다.

시간 정지는 손실이 아니더라도 적용할 수 있다.

#### 15.5 Early Exit

다음 경우 Stop 도달 전 종료할 수 있다.

- 핵심 촉매 반전
- 거래량 분배 패턴
- 시장 Regime 급변
- 허위 공시·회계 문제
- 포트폴리오 전체 위험 급증

사후 감정이 아니라 사전 정의된 조건이어야 한다.

---

### 16. Event Risk 철학

#### 16.1 이벤트 분류

- Earnings
- FDA / Clinical
- Court Decision
- Regulatory Approval
- Product Launch
- Macro Announcement
- Lock-up Expiry
- Share Offering

#### 16.2 Binary Event

결과가 불연속적이고 예상 손실이 Stop을 크게 넘을 수 있는 이벤트다.

기본 정책:

- 별도 Event Strategy가 없으면 보유 금지 또는 대폭 축소
- Position Size에 Gap Scenario 반영
- 기대값과 확률을 별도 계산
- 일반 Momentum Score만으로 승인 금지

#### 16.3 Earnings Hold

실적을 넘겨 보유하려면 다음이 필요하다.

- 실적 전용 Setup
- 예상 Gap Risk
- 포지션 축소 여부
- 옵션·헤지 여부
- Bear Scenario 손실
- 사용자 승인

---

### 17. Long-term과 Momentum의 충돌 처리

#### 17.1 Long-term High / Momentum Low

해석:

- 기업은 매력적이나 단기 추세는 약함
- 장기 분할매수 가능
- Momentum 진입은 대기

Long-term 매수 시 Momentum Stop을 적용하지 않는다.

#### 17.2 Long-term Low / Momentum High

해석:

- Tactical Only
- 작은 위험 예산
- 손절 후 장기 전환 금지
- 사업 품질이 낮으면 Gap Risk 가중

#### 17.3 Dual High

해석:

- 장기 매력과 단기 추세가 동시 우호적
- 단, Long-term Lot과 Momentum Lot 분리
- 같은 종목 총노출 한도 적용
- 단기 수익이 장기 Thesis를 대신하지 않음

#### 17.4 Long-term Thesis Break / Momentum Bounce

구조적 악재 이후 기술적 반등이 가능할 수 있다.

그러나:

- Core 보유 논지는 종료 가능
- Momentum은 별도 Tactical Setup으로만 허용
- 손실 회복 목적의 거래 금지

---

### 18. Momentum의 심리 규칙

#### 18.1 FOMO

예방:

- Chase Limit
- Entry Zone
- `MISSED` 상태 기록
- 놓친 거래의 사후 수익을 손실로 계산하지 않음

#### 18.2 Revenge Trading

예방:

- 연속 손실 후 Cooldown
- 일간·주간 손실 한도
- 같은 종목 즉시 재진입 제한
- 신규 거래 전 체크리스트 재승인

#### 18.3 Anchoring

- 진입가는 시장에 의미가 없다.
- Stop과 현재 Setup만 본다.
- 손익분기점 회복을 목표로 하지 않는다.

#### 18.4 Overconfidence

- 연속 수익 후 Position Size 자동 확대 금지
- 최소 거래 샘플 전 모델 변경 금지
- 수익과 규칙 준수를 별도 평가

#### 18.5 Loss Aversion

- Stop을 비용이 아니라 전략 보험료로 해석
- 계획된 1R 손실은 정상 결과
- 큰 손실 회피가 핵심 목표

---

### 19. 거래 리뷰 철학

모든 종료 거래는 리뷰한다.

#### 19.1 Outcome Metrics

- P&L
- R-Multiple
- Holding Days
- MAE
- MFE
- Slippage
- Fees

#### 19.2 Process Metrics

- Setup 준수
- Entry 준수
- Position Size 준수
- Stop 준수
- Exit 준수
- 감정 개입
- 데이터 품질

#### 19.3 결과 매트릭스

| 결과 | 규칙 준수 | 평가 |
|---|---|---|
| 수익 | 준수 | 좋은 결정 가능 |
| 손실 | 준수 | 정상 확률 결과 가능 |
| 수익 | 위반 | 나쁜 결정, 좋은 결과 |
| 손실 | 위반 | 수정 우선순위 높음 |

#### 19.4 Setup별 평가

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

### 20. Momentum Model 변경 원칙

Momentum은 장기 모델보다 빠르게 학습할 수 있지만 과적합 위험이 크다.

#### 20.1 변경 제안 조건

- 충분한 거래 수
- 여러 시장 Regime 포함
- 거래 비용 포함
- 특정 대형 승자 제거 후에도 Edge 유지
- Out-of-sample 또는 Replay 검증

#### 20.2 변경 금지 예

- 최근 3회 손실
- 단일 종목 실패
- 한 달 성과 부진
- 감정적 불편
- 과거 데이터에만 맞춘 임계치

#### 20.3 Shadow Mode

새 모델은 실제 적용 전 Shadow Mode로 운영할 수 있다.

```text
Active Model
vs
Candidate Model
```

동일 신호를 생성하고 성과를 비교한 뒤 활성화한다.

---

### 21. 예시 거래 계획

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

### 22. Momentum Decision Contract

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

### 23. Momentum 체크리스트

#### 시장

- Regime이 신규 Long을 허용하는가?
- 시장 Breadth가 악화 중인가?
- 변동성이 Position Size에 반영되었는가?

#### 종목

- 유동성이 충분한가?
- 상대강도가 시장·섹터 대비 높은가?
- 거래량이 Setup을 확인하는가?
- 홍보성·저품질 종목이 아닌가?

#### 촉매

- `왜 지금인가?`에 답하는가?
- 공식 출처가 있는가?
- 이미 가격에 과도하게 반영되었는가?
- 후속 추정치 수정이 가능한가?

#### 계획

- Entry Zone이 있는가?
- Chase Limit이 있는가?
- Stop이 있는가?
- Target 또는 Trailing Rule이 있는가?
- Time Stop이 있는가?

#### 위험

- 1R은 얼마인가?
- Gap Risk를 감당할 수 있는가?
- 같은 섹터 포지션과 상관되는가?
- 연속 손실 한도를 초과하지 않는가?

#### 행동

- FOMO 진입인가?
- 손실 복구 목적이 있는가?
- 실패 시 Long-term 전환 생각이 있는가?
- 계획대로 청산할 준비가 되어 있는가?

---

### 24. Part 3 완료 기준

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

---

## 02-4. Capital Allocation, Portfolio Construction, and Risk Philosophy

> 장기 복리 자산을 보호하면서 Future Core와 Momentum에 제한된 위험 예산을 배분하기 위한 포트폴리오 헌법

- Chapter: `02_Investment_Philosophy`
- Part: 4 / 5
- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 관련 Engine: Portfolio Engine, Risk Engine, Cross Signal Engine
- 관련 후속 문서: `05_Portfolio_Engine.md`, `09_Scoring_System.md`

---

### 1. Capital Allocation의 목적

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

### 2. 기본 Bucket 구조

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

#### 2.1 기본 목표 비중

아래는 초기 시스템 기본값이며 사용자별 Policy로 설정 가능하다.

| Bucket | 기본 목표 | 허용 범위 예시 | 역할 |
|---|---:|---:|---|
| Long-term Total | 85% | 80~90% | 장기 복리의 중심 |
| Core | 70% | 60~80% | 검증된 장기 기업 |
| Future Core | 15% | 5~20% | 미래 Core 탐색 |
| Momentum Total | 15% | 10~20% | 전술적 기회 |
| Cash | 각 Bucket 내부 | 상황별 | 위험 완충·옵션 가치 |

`Core + Future Core`는 Long-term Total 안에서 합산한다.

#### 2.2 범위의 의미

범위는 시장을 예측해 매주 바꾸기 위한 것이 아니다.

- Long-term 80% 아래: Momentum 또는 현금이 장기 전략을 침범했는지 검토
- Momentum 20% 위: 신규 단기 진입 원칙적 금지
- Future Core 20% 위: 개별 기업 실패와 상관 위험 검토
- Cash 증가: 매력적 대안 부족 또는 위험 국면의 합법적 결과

#### 2.3 Target, Soft Limit, Hard Limit

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

### 3. 자금의 정의

#### 3.1 Investable Capital

투자 가능 자금에서 제외할 항목:

- 생활비
- 비상자금
- 단기간 내 사용할 자금
- 세금 납부 예정액
- 고금리 부채 상환 필요액
- 법적·계약상 제한 자금

Investment OS는 생활 안전성을 희생해 기대수익을 높이지 않는다.

#### 3.2 New Capital

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

#### 3.3 Cash의 소속

현금은 전략별로 구분한다.

- Long-term Cash: 월급날 투자, 조정, 신규 Core를 위한 자금
- Momentum Cash: 신규 Setup과 손실 한도 관리를 위한 자금
- Common Reserve: 사용자 정책에 따라 전략 간 이동 가능한 예비 자금

Momentum Cash가 남는다고 자동으로 Long-term에 배치하지 않으며, 반대도 동일하다.

---

### 4. 월급날 Capital Allocation 철학

매월 25일 전후는 자동 매수일이 아니라 **정기 자본 배분 Decision Point**다.

#### 4.1 월급날 절차

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

#### 4.2 신규 자금의 우선 사용

기본 우선순위:

1. 생활 안전자금 부족 보완
2. Hard Limit 위반 복원
3. Long-term 목표 비중 보완
4. 매력적인 Core / Future Core
5. Momentum Bucket이 목표 미달이고 유효 Setup 존재
6. 현금 유지

#### 4.3 자동 균등매수 금지

매월 동일 종목을 자동으로 사는 것은 선택 가능한 전략이지만 기본값은 아니다.

각 월급날 다음을 재평가한다.

- 현재 가격
- Thesis 상태
- 대안
- 집중도
- 데이터 기준일
- 다음 주요 이벤트

#### 4.4 아무것도 사지 않는 결론

모든 후보가 비싸거나 데이터가 불충분하면 현금을 유지한다.

보고서는 `이번 달 매수 없음`을 실패로 표현하지 않는다.

---

### 5. Position Sizing의 공통 철학

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

#### 5.1 Score와 Size의 관계

Score가 높다고 선형적으로 비중을 늘리지 않는다.

이유:

- Score 오차
- 데이터 상관
- 모델 미적합
- Tail Risk
- 동일 산업 위험

#### 5.2 Confidence와 불확실성

예시:

- 높은 점수 + 높은 신뢰도: 정상 비중 가능
- 높은 점수 + 낮은 신뢰도: 탐색 비중
- 중간 점수 + 높은 신뢰도: 보유·대기
- 낮은 점수: 신규 진입 금지 가능

#### 5.3 Position Size의 세 단계

```text
Starter Position
→ Confirmed Position
→ Full Policy Position
```

- Starter: 추적 책임을 만드는 작은 비중
- Confirmed: 실적·Thesis 증거 강화 후 확대
- Full Policy: 최대 허용 비중 내 성숙한 포지션

---

### 6. Long-term Position Sizing

아래 값은 구현 기본값을 설계하기 위한 예시 범위이며 최종 수치는 `05_Portfolio_Engine.md`에서 확정한다.

#### 6.1 Core

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

#### 6.2 Future Core

| 단계 | 총 포트폴리오 대비 예시 |
|---|---:|
| Research / No Position | 0% |
| Starter | 0.5~1.5% |
| Candidate | 1~3% |
| Strong Candidate | 2~4% |
| Future Core Maximum Review | 4~6% |

Future Core는 가격 하락보다 사업 증거 강화에 따라 비중을 확대한다.

#### 6.3 Position Size 감소 요인

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

### 7. Momentum Position Sizing

Momentum은 투자 금액보다 `허용 손실`을 기준으로 크기를 정한다.

#### 7.1 Risk per Trade

총 포트폴리오 대비 위험 예산의 예시:

| 상태 | 1회 거래 위험 예시 |
|---|---:|
| 정상 Regime | 0.25~0.50% |
| High-quality Setup | 최대 0.75% 검토 |
| 변동성 확대 | 0.10~0.30% |
| Drawdown 상태 | 추가 축소 또는 0% |

이는 원금 투자 비중이 아니라 Stop 도달 시 예상 손실이다.

#### 7.2 Open Risk

```text
Open Risk
= Σ 각 Momentum Position의 Stop 기준 예상 손실
```

포지션이 10개여도 상관된 섹터라면 단순 합보다 높은 위험으로 본다.

#### 7.3 Momentum Bucket Hard Limit

- Momentum 총 시장가치 상한
- Momentum Open Risk 상한
- 일간·주간·월간 손실 상한
- 한 섹터 Momentum 노출 상한
- 이벤트 Overnight 노출 상한

하나라도 초과하면 신규 거래를 제한한다.

---

### 8. Concentration 철학

종목 수는 분산의 충분조건이 아니다.

#### 8.1 Concentration Dimension

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

#### 8.2 Look-through Exposure

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

#### 8.3 Concentration 경고 단계

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

### 9. Correlation 철학

과거 가격 상관만으로 미래 위험을 측정하지 않는다.

#### 9.1 세 종류의 상관

1. **Price Correlation**: 과거 수익률 동조
2. **Fundamental Correlation**: 동일 수요·고객·원가에 의존
3. **Event Correlation**: 같은 정책·금리·규제 이벤트 영향

가격 상관이 낮아도 Fundamental Correlation이 높을 수 있다.

#### 9.2 Stress Correlation

정상 시장보다 위기 시 상관이 상승할 수 있다.

Risk Engine은 다음 시나리오를 고려한다.

- 금리 급등
- AI CapEx 축소
- 신용 경색
- 지정학 충격
- 달러 급등
- 경기 침체

---

### 10. Risk Budget 철학

Risk Budget은 변동성을 없애는 것이 아니라 **어디서 얼마만큼의 손실을 감수할지 사전에 결정하는 것**이다.

#### 10.1 Risk Layer

```text
Total Risk Budget
├── Long-term Fundamental Risk
├── Future Core Failure Risk
├── Momentum Trading Risk
├── Liquidity Risk
├── Currency Risk
└── Operational / Model Risk
```

#### 10.2 Long-term Risk

Long-term 포지션에는 기술적 Stop을 기본 적용하지 않는다.

대신 다음을 사용한다.

- Position Size
- Thesis Break
- 재무 생존성
- 집중 한도
- 가치 범위
- 정기 리뷰

#### 10.3 Future Core Risk

- 작은 초기 비중
- 승격 단계
- 현금 Runway 모니터링
- 희석·고객 집중 감점
- Binary Event 제한

#### 10.4 Momentum Risk

- Stop
- Risk per Trade
- Open Risk
- Time Stop
- Drawdown Limit
- Regime Multiplier

#### 10.5 Operational Risk

- 잘못된 티커
- 중복 주문
- 통화 단위 오류
- stale price
- 모델 출력 오류
- 데이터 소스 중단

Operational Risk는 투자 Thesis와 무관하게 주문을 거부할 수 있다.

---

### 11. Drawdown Policy

#### 11.1 전략별 Drawdown 분리

- Long-term Drawdown
- Future Core Drawdown
- Momentum Drawdown
- Total Portfolio Drawdown

각 Drawdown의 원인과 대응이 다르다.

#### 11.2 Momentum Drawdown Control

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

#### 11.3 Long-term Drawdown Control

장기 하락을 Momentum 손절처럼 처리하지 않는다.

검토 순서:

1. 시장 전체 요인인가?
2. 사업 지표가 변했는가?
3. Thesis Assumption이 훼손됐는가?
4. 밸류에이션이 개선됐는가?
5. 집중 위험이 과도한가?
6. 신규 자금으로 추가할 가치가 있는가?

#### 11.4 Total Portfolio Drawdown

전체 Drawdown이 사용자 정책 임계치에 도달하면 다음을 수행한다.

- 모든 신규 Momentum Risk 축소
- 고위험 Future Core 리뷰
- 데이터·모델·포트폴리오 원인 분해
- 강제 저점 매도보다 생존 계획 우선
- 사용자 재무 상황 재확인

---

### 12. Rebalancing 철학

#### 12.1 Calendar Rebalancing만 사용하지 않는다

분기·연간 정기 검토는 필요하지만, 단순히 목표 비중을 맞추기 위해 승자를 자동 매도하지 않는다.

#### 12.2 Rebalancing Trigger

- Hard Limit 초과
- Thesis 변화
- 신규 자금 유입
- 전략 비중 이탈
- 위험 요인 중복
- 가치평가 변화
- 생활 자금 필요

#### 12.3 New Money First

가능하면 신규 자금으로 비중을 조정한다.

장점:

- 세금·거래비용 감소
- 장기 승자 불필요한 매도 방지
- 감정적 매매 감소

#### 12.4 Drift 허용

좋은 기업이 성장해 비중이 올라간 경우 목표를 초과할 수 있다.

다만 Hard Review Zone에서는 다음을 점검한다.

- 단일 실패 영향
- 사업 수익원 분산
- 밸류에이션
- 사용자의 심리적 감당 가능성
- 세후 기대수익

---

### 13. Sell Funding Priority

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

### 14. Leverage와 Margin 철학

MVP 기본값은 다음과 같다.

- Margin 사용 금지
- 차입 투자 금지
- Naked Option 금지
- 강제 청산 가능 구조 금지

향후 Leverage Engine을 추가하려면 별도 정책, Stress Test, 법적·세무 검토가 필요하다.

장기 복리의 핵심은 최대 수익이 아니라 강제 퇴장 가능성을 낮추는 것이다.

---

### 15. Currency와 환율

사용자의 기준 통화와 자산 통화를 구분한다.

```ts
type CurrencyExposure = {
  assetCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  marketValueBase: DecimalString;
  fxPnL: SignedDecimalString;
};
```

#### 15.1 환율을 기업 성과와 분리

- 주가 수익
- 배당
- 환율 수익

을 별도 Attribution으로 표시한다.

#### 15.2 환율 타이밍 최소화

월급날 투자 시 환율이 불리하다는 이유만으로 장기간 투자 결정을 멈추지 않을 수 있다.

단, 단기 필요 자금·환전 비용·극단적 변동은 고려한다.

#### 15.3 Hedge

기본값은 자동 Hedge가 아니다.

Hedge 도입 시:

- 비용
- 기간
- 세금
- 롤오버
- 장기 기대수익 감소

를 별도 평가한다.

---

### 16. Liquidity 철학

#### 16.1 개인 현금흐름 유동성

- 최소 비상자금
- 12개월 내 필요 자금
- 세금
- 대출 상환

을 포트폴리오와 분리한다.

#### 16.2 자산 유동성

- 거래량
- Spread
- 거래정지 위험
- 장전·장후 체결
- 해외시장 시간차

Future Core와 Momentum은 유동성 감점을 강하게 적용한다.

#### 16.3 Liquidity Stress

위기 시 정상 거래량을 가정하지 않는다.

Position Size는 `평상시 청산 가능`이 아니라 `불리한 시장에서도 합리적으로 청산 가능`한 수준을 지향한다.

---

### 17. Tax와 비용 철학

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

### 18. Cross Signal과 Allocation

Cross Signal은 종목의 전략 관계를 해석하지만 Portfolio Limit을 우회하지 않는다.

#### 18.1 Dual High Conviction

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

#### 18.2 Long-term Only

```text
Long-term High + Momentum Low
```

- 장기 분할매수 가능
- 단기 추세 대기
- 가격 하락 원인이 Thesis Break가 아닌지 확인

#### 18.3 Momentum Only

```text
Long-term Low + Momentum High
```

- Momentum Bucket만 사용
- 작은 위험
- 장기 전환 금지

#### 18.4 Avoid

```text
Long-term Low + Momentum Low
```

- 신규 자금 우선순위 낮음
- 기존 포지션은 전략별 종료 규칙 검토

---

### 19. Manual Risk Review와 비가역적 거부권

Risk Engine은 다음 상태를 반환한다.

```text
APPROVE
APPROVE_WITH_REDUCTION
REQUIRE_MANUAL_REVIEW
DENY
```

#### 19.1 Hard Deny 예시

- 잘못된 가격·통화 데이터
- Momentum Stop 누락
- Hard Limit 초과
- 거래정지·상장폐지 위험
- 사용자 승인 불가
- 생활 자금 침범
- 자동 주문 중복

#### 19.2 Manual Review 예시

- 실적 발표 임박
- 고유동성 평시, 저유동성 이벤트
- 단일 종목 총노출 급증
- Thesis와 가격 데이터 불일치
- 모델 간 극단적 의견 충돌

#### 19.3 Manual Review 처리 권한

MVP에서는 Hard Safety 위반과 Risk `DENY`를 Override할 수 없다. `REQUIRE_MANUAL_REVIEW`만 추가 근거를 검토할 수 있으며 다음을 요구한다.

- 검토 사유와 근거
- 검토자와 검토 시각
- 변경된 최대 손실
- 재검토 일정
- 원 Risk Decision을 가리키는 새 Risk Decision
- Audit Log

검토 결과가 허용 또는 감액이더라도 기존 Decision을 직접 승인하지 않고 새 Risk Decision으로 Decision Proposal을 다시 구성한다.

---

### 20. Scenario and Stress Testing

Portfolio Engine은 정상 기대값뿐 아니라 스트레스 시나리오를 본다.

#### 20.1 기본 시나리오

- 시장 -10%, -20%, -35%
- 금리 급등
- AI CapEx 축소
- 신용 경색
- 달러 급등
- 특정 산업 규제
- 최대 보유 종목 실적 충격
- Future Core 자금조달 실패
- Momentum Gap through Stop

#### 20.2 결과

- 총 예상 손실
- Bucket별 손실
- 종목별 기여
- 상관 위험
- 현금 필요
- Hard Limit 위반

#### 20.3 Stress Test의 용도

정확한 위기 예측이 아니라 다음을 확인한다.

- 하나의 시나리오가 치명적인가?
- 어디서 위험이 중복되는가?
- 사용자가 감정적으로 감당 가능한가?
- 강제 매도 가능성이 있는가?

---

### 21. Portfolio Decision Matrix

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

### 22. Allocation Decision Contract

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

### 23. 월급날 보고서 요구사항

월급날 보고서는 최소 다음을 제공한다.

#### 23.1 현재 상태

- 총 투자 가능 자산
- Long-term / Momentum / Cash 비중
- Core / Future Core 비중
- 상위 종목 비중
- 산업·Theme 노출
- Hard / Soft Limit

#### 23.2 후보 비교

- 기존 Core
- 신규 Core
- Future Core
- 현금
- Momentum은 유효 Setup이 있을 때만

#### 23.3 최종 하나의 결론

예:

- 이번 달은 Core A에 70%, 현금 30%
- Future Core B에 탐색 비중만 배치
- Momentum Bucket이 상한이므로 신규 단기 거래 금지
- 모든 후보가 비싸 현금 유지

#### 23.4 실행 전 조건

- 가격 유효 범위
- 데이터 기준일
- 다음 이벤트
- Thesis Break
- 비중 한도

---

### 24. Portfolio 체크리스트

#### 자금

- 생활 자금과 분리됐는가?
- 세금·예정 지출을 반영했는가?
- 신규 자금의 출처가 기록됐는가?

#### Bucket

- Long-term 80~90% 정책을 지키는가?
- Momentum 10~20% 상한을 지키는가?
- Cash의 전략 소속이 명확한가?

#### 집중

- 단일 종목 비중은?
- 동일 산업·Theme 노출은?
- 고객·공급자·금리·정책 위험이 중복되는가?

#### Position Size

- Score뿐 아니라 Confidence를 반영했는가?
- Future Core는 작은 비중인가?
- Momentum은 Stop 기준 위험으로 계산했는가?

#### 위험

- Hard Limit 위반이 있는가?
- Stress Scenario에서 생존 가능한가?
- Gap·유동성·환율 위험을 반영했는가?

#### 기회비용

- 현금과 비교했는가?
- 기존 Core 추가와 비교했는가?
- 작은 점수 차이로 잦은 교체를 하는가?

#### 실행

- 사용자 승인이 필요한가?
- Lot과 전략이 분리됐는가?
- 다음 리뷰 일정이 있는가?

---

### 25. Part 4 완료 기준

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

---

## 02-5. Decision Process, Psychology, Learning, and Operating Templates

> 좋은 결과보다 좋은 의사결정 과정을 반복하고, 편향과 모델 오류를 기록해 Investment OS를 통제된 방식으로 진화시키는 운영 원칙

- Chapter: `02_Investment_Philosophy`
- Part: 5 / 5
- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 관련 Engine: Decision Engine, Learning Engine, Report Engine
- 관련 후속 문서: `06_Learning_Engine.md`, `10_Report_System.md`, `13_Codex_Implementation.md`

---

### 1. 의사결정 품질과 투자 결과를 분리한다

좋은 투자 결과가 반드시 좋은 결정에서 나온 것은 아니다. 나쁜 결과가 반드시 나쁜 결정이라는 뜻도 아니다.

Investment OS는 다음 네 가지를 구분한다.

| 의사결정 과정 | 결과 | 해석 |
|---|---|---|
| 좋음 | 좋음 | 재현 가능한 성공 후보 |
| 좋음 | 나쁨 | 정상적인 확률 손실 가능 |
| 나쁨 | 좋음 | 위험한 행운 |
| 나쁨 | 나쁨 | 우선 개선 대상 |

#### 1.1 좋은 의사결정의 조건

- 전략이 사전에 분류됨
- 당시 이용 가능한 데이터만 사용
- 반대 근거가 포함됨
- 위험과 Position Size가 사전에 정해짐
- 실행 전 기대수익과 실패 조건이 있음
- 결과에 따라 과거 논리를 바꾸지 않음
- 규칙 위반이 기록됨

#### 1.2 Outcome Bias 방지

수익률이 높았다는 이유만으로 다음을 정당화하지 않는다.

- 무계획 진입
- Stop 미준수
- 과도한 집중
- 루머 기반 매수
- 손실 Position 평균내기
- 장기·Momentum 전략 혼합

반대로 계획된 작은 Momentum 손실이나 합리적 Future Core 실패는 시스템이 감당하기로 한 비용일 수 있다.

---

### 2. Decision Lifecycle

모든 투자 결정은 다음 생명주기를 가진다.

```text
Idea
→ Research
→ Evaluation
→ Portfolio Fit
→ Risk Review
→ Decision Proposal
→ User Approval
→ Execution
→ Monitoring
→ Exit / Continue
→ Review
→ Lesson
```

#### 2.1 Idea

Idea는 투자 제안이 아니다.

Idea Source:

- 산업 지도
- 실적
- 공시
- 뉴스
- 스크리너
- 사용자 입력
- 기존 후보 변화
- 경쟁사 분석

Idea 단계에서는 Position을 만들지 않는다.

#### 2.2 Research

필수 작업:

- 기업 Master 확인
- 공식 자료 수집
- 주요 수익원
- 산업·경쟁사
- 위험
- 데이터 신뢰도

#### 2.3 Evaluation

전략별 Engine이 독립적으로 평가한다.

- Long-term Evaluation
- Future Core Evaluation
- Momentum Evaluation

#### 2.4 Portfolio Fit

- Bucket 여유
- 종목 비중
- Theme 노출
- 현금
- 상관 위험

#### 2.5 Risk Review

- Hard Rule
- 유동성
- Event
- Drawdown
- 데이터 오류

#### 2.6 Decision Proposal

최종 제안은 하나의 행동을 명확히 한다.

```ts
type DecisionAction =
  | 'BUY'
  | 'ACCUMULATE'
  | 'ENTER'
  | 'HOLD'
  | 'WAIT'
  | 'REDUCE'
  | 'EXIT'
  | 'SKIP'
  | 'CASH';
```

#### 2.7 Approval

MVP에서는 사용자가 승인한다.

승인 시 다음을 고정한다.

- 전략
- 금액·수량
- 기준 가격
- 모델 버전
- Thesis 또는 Setup
- 위험 한도
- 다음 리뷰

#### 2.8 Execution

추천과 실제 체결을 구분한다.

- 제안 가격
- 주문 가격
- 체결 가격
- 수량
- Slippage
- 미체결
- 부분체결

#### 2.9 Monitoring

전략별 관찰 항목과 주기가 다르다.

#### 2.10 Exit / Continue

보유 연장은 자동이 아니다. Review 결과에 따라 `Continue` Decision을 생성할 수 있다.

#### 2.11 Review and Lesson

결과와 과정, 모델 적합성을 분리해 평가한다.

---

### 3. Decision Journal 철학

Decision Journal은 거래 일지가 아니라 당시 사고를 보존하는 기록이다.

#### 3.1 반드시 기록할 내용

- 의사결정 시각
- 데이터 기준일
- 전략
- 기대 보유 기간
- 기대 수익 원천
- 주요 가정
- 반대 근거
- 위험
- Position Size
- 실행 조건
- 종료 조건
- 감정 상태
- 사용 모델 버전
- 근거 출처

#### 3.2 수정 불변성

기존 기록은 수정할 수 있더라도 원본을 보존한다.

```text
Decision v1
→ Amendment v2
→ Review
```

사후적으로 예측을 더 정확하게 보이도록 원문을 덮어쓰지 않는다.

#### 3.3 `SKIP` 기록

사지 않은 결정도 기록할 가치가 있다.

- 가격이 과도함
- 데이터 불충분
- Risk Limit
- 더 나은 대안
- FOMO 억제

`SKIP`의 사후 성과를 추적해 지나친 보수성도 검토한다.

---

### 4. Pre-mortem과 Inversion

#### 4.1 Pre-mortem

투자 전에 다음 상황을 가정한다.

> 2년 뒤 이 투자가 큰 실패로 끝났다. 가장 가능성 높은 이유는 무엇인가?

Long-term 예시:

- TAM은 컸지만 기업이 점유율을 얻지 못함
- CapEx가 FCF로 전환되지 않음
- 경영진이 희석을 반복
- 고객 집중이 현실화
- 기술이 대체됨

Momentum 예시:

- 이미 Crowded Trade였음
- Gap 이후 추격 진입
- Stop을 지키지 않음
- 실적 이벤트를 과소평가
- 시장 Regime이 바뀜

#### 4.2 Inversion

`어떻게 성공할까?`뿐 아니라 `어떻게 실패할 수 있을까?`를 묻는다.

#### 4.3 Kill Criteria

조사 중 다음이 확인되면 분석을 조기 종료할 수 있다.

- 회계 신뢰 불가
- 생존 불가능한 자금 구조
- 투자 Thesis가 가격 상승 기대뿐
- Momentum 유동성 기준 미달
- 데이터가 검증 불가
- Portfolio Hard Limit 초과

분석 시간을 절약하는 것도 자본 배분의 일부다.

---

### 5. 행동 편향과 시스템 통제

Investment OS는 인간의 편향을 없애지 못한다. 대신 편향이 행동으로 이어지기 어렵게 설계한다.

### 5.1 Anchoring

증상:

- 평단을 기준으로 판단
- 과거 고점을 적정가로 인식
- 최초 목표가를 고수

통제:

- 현재 가치 범위와 평단을 화면에서 분리
- `오늘 현금 100%라면 살 것인가?` 질문
- 과거 고점 미표시 모드
- Thesis와 현재 데이터 우선

### 5.2 Loss Aversion

증상:

- 손실 확정을 피함
- Momentum Stop을 미룸
- Thesis Broken Position 보유

통제:

- Strategy별 종료 규칙
- Stop 자동 경고
- Thesis Break Review
- 손실 금액보다 위험 기준 표시

### 5.3 Disposition Effect

증상:

- 작은 수익을 빨리 확정
- 큰 손실은 오래 보유

통제:

- Core 자동 익절 금지
- Momentum Target·Trailing 사전 정의
- 매도 근거 분류

### 5.4 Confirmation Bias

증상:

- 긍정 뉴스만 수집
- 반대 의견 무시

통제:

- Bear Case 필수
- 반대 근거 3개
- Red Team Agent
- Thesis Assumption 상태 추적

### 5.5 Recency Bias

증상:

- 최근 수익 전략에 과도한 비중
- 최근 손실 후 전략 폐기

통제:

- 최소 샘플 기준
- 여러 Regime 성과
- 장기 모델의 느린 변경 주기

### 5.6 FOMO

증상:

- Entry Zone 초과
- 뉴스 급등 추격
- 월급날 무조건 매수

통제:

- Chase Limit
- 현금도 최종 선택
- `MISSED` 상태
- 다음 기회 목록

### 5.7 Overconfidence

증상:

- 연속 수익 후 비중 급증
- 하나의 성공 사례로 모델 확신

통제:

- Hard Position Limit
- Risk per Trade 상한
- Model Version 승인
- 수익과 규칙 준수 분리

### 5.8 Sunk Cost

증상:

- 많은 시간·돈을 썼으므로 계속 보유
- 프로젝트에 애착

통제:

- 과거 투입액을 현재 평가 점수에서 제외
- Thesis Break 우선
- 신규 자금은 독립 Decision

### 5.9 Narrative Fallacy

증상:

- 매력적인 이야기로 숫자 부족을 보완

통제:

- Fact / Inference / Hypothesis 태그
- 관찰 가능한 Milestone
- 데이터 Coverage 점수

### 5.10 Activity Bias

증상:

- 매주 무언가 거래해야 한다고 느낌

통제:

- `HOLD`, `WAIT`, `CASH`, `SKIP`을 동등한 Action으로 취급
- 거래 횟수 KPI 금지
- 좋은 무행동 사례 기록

---

### 6. 감정 상태의 기록

감정은 투자 근거가 아니지만 위험 신호가 될 수 있다.

```ts
type EmotionalState =
  | 'CALM'
  | 'EXCITED'
  | 'FEARFUL'
  | 'FRUSTRATED'
  | 'REVENGE_RISK'
  | 'FOMO_RISK'
  | 'FATIGUED';
```

#### 6.1 감정 기반 Safety Rule

- `REVENGE_RISK`: 신규 Momentum 거래 제한
- `FOMO_RISK`: Chase Limit 강화
- `FATIGUED`: 대규모 결정 Manual Review
- `FEARFUL`: 장기 포지션 즉시 전량 매도 전 Cooling Period 가능

단, 회계 부정·파산 위험 등 Hard Event에서는 Cooling Period보다 위험 대응이 우선한다.

#### 6.2 감정과 결과 분석

장기적으로 다음을 분석할 수 있다.

- 감정 상태별 규칙 위반률
- FOMO 거래 성과
- 피로 상태의 실행 오류
- 손실 후 재진입 성과

---

### 7. Review Cadence

전략과 데이터에 맞는 주기로 검토한다.

#### 7.1 Daily

- Momentum Open Position
- Stop / Target
- Market Regime
- Risk Alert

#### 7.2 Weekly

- Core / Future Core 주요 변화
- Momentum 후보
- Portfolio Exposure
- 뉴스와 Thesis 영향
- 신규·제외 후보

#### 7.3 Monthly

- 월급날 Capital Allocation
- 전략별 비중
- Momentum 거래 성과
- Future Core 단계 변화
- Cash 결정

#### 7.4 Quarterly

- 기업 실적
- Thesis Assumption
- Long-term Score
- FCF·재무 위험
- 승격·강등
- 산업 구조

#### 7.5 Annual

- 전체 전략 성과
- 벤치마크
- 최대 낙폭
- 의사결정 품질
- 모델 버전
- 철학 변경 필요
- 개인 재무 목표

#### 7.6 Event-driven

- Earnings
- Guidance Change
- CEO/CFO Departure
- Regulation
- Major Contract
- Financing
- Accounting Issue
- Stop / Thesis Break

---

### 8. Learning Philosophy

Learning Engine의 목표는 과거를 완벽히 설명하는 것이 아니라 미래 의사결정을 더 일관되게 만드는 것이다.

#### 8.1 Learning Unit

```ts
interface InvestmentLesson {
  title: string;
  strategy: 'LONG_TERM' | 'FUTURE_CORE' | 'MOMENTUM' | 'PORTFOLIO' | 'RISK';
  originalAssumption: string;
  observedOutcome: string;
  processAssessment: string;
  modelAssessment: string;
  proposedChange?: string;
  confidence: number;
  sampleSize: number;
}
```

#### 8.2 Lesson 유형

- Data Lesson
- Model Lesson
- Execution Lesson
- Risk Lesson
- Psychology Lesson
- Portfolio Lesson
- No-change Lesson

`No-change Lesson`도 중요하다. 결과가 나빴다고 항상 모델을 바꾸지 않는다.

#### 8.3 Learning의 세 단계

```text
Observation
→ Hypothesis
→ Policy / Model Change
```

관찰 하나를 즉시 규칙으로 만들지 않는다.

#### 8.4 장기와 Momentum의 학습 속도

| 구분 | Long-term | Momentum |
|---|---|---|
| 기본 샘플 | 분기·연간 | 거래 단위 |
| 변경 속도 | 느림 | 상대적으로 빠름 |
| 주요 위험 | 너무 늦은 수정 | 과적합 |
| 검증 | 장기 Replay·Case Study | 다수 거래·Regime |

---

### 9. Model Evolution Governance

#### 9.1 모델 변경 제안

제안에는 다음이 필요하다.

- 문제 정의
- 관련 사례
- 기존 모델의 실패 방식
- 변경 항목
- 예상 장점
- 예상 부작용
- 과거 데이터 영향
- Rollback Plan

#### 9.2 검증 단계

```text
Draft
→ Historical Replay
→ Shadow Mode
→ Review
→ Approved
→ Active
→ Deprecated
```

#### 9.3 Look-ahead Bias 금지

과거 평가 재현 시 당시 알 수 없었던 데이터를 사용하지 않는다.

- 수정된 실적
- 후속 공시
- 미래 지수 구성
- 생존 기업만 남긴 Universe

#### 9.4 Overfitting 방지

- 너무 많은 파라미터 금지
- 특정 종목에 맞춘 규칙 금지
- 거래 비용 포함
- Out-of-sample 검증
- 단순 모델과 비교
- 복잡도가 개선 폭을 정당화하는지 확인

#### 9.5 Rollback

새 모델이 예상치 못한 문제를 만들면 이전 Active Version으로 돌아갈 수 있어야 한다.

모든 Decision은 사용 모델 버전을 저장한다.

---

### 10. Score 철학

Score는 의사결정을 단순화하지만 정밀한 진실처럼 보일 위험이 있다.

#### 10.1 Score의 역할

- 비교
- 우선순위
- 변화 추적
- 규칙 기반 경고
- 설명 구조

#### 10.2 Score가 하지 못하는 것

- 미래 주가 확정
- Tail Risk 완전 반영
- 모든 산업의 질적 차이 표현
- 사용자 재무 상황 대체
- Position Size 자동 결정

#### 10.3 점수와 등급

작은 숫자 차이는 의미가 없을 수 있다.

예:

```text
Company A: 89
Company B: 87
Uncertainty Band: ±5
```

두 기업을 실질적으로 같은 등급으로 처리할 수 있다.

#### 10.4 Score Change Explanation

점수가 바뀌면 이유를 저장한다.

- 원시 데이터 변화
- Thesis 변화
- 모델 버전 변화
- 가격 변화
- Confidence 변화

점수만 바뀌고 설명이 없는 상태를 허용하지 않는다.

---

### 11. Explainability와 보고 원칙

#### 11.1 보고서의 순서

좋은 보고서는 다음 순서로 읽힌다.

1. 결론
2. 이번 변화
3. 근거
4. 반대 근거
5. 위험
6. 행동
7. 다음 검토 조건
8. 출처

#### 11.2 한 개의 최우선 선택

사용자가 여러 선택지 중 하나를 선택해야 할 때 시스템은 최우선 후보 하나를 제시한다.

단, 불확실성이 크면 `현금 유지`가 최우선 선택일 수 있다.

#### 11.3 확신 표현

- High Confidence
- Medium Confidence
- Low Confidence

확신은 문체의 강도가 아니라 데이터 Coverage와 모델 적합성에 기반한다.

#### 11.4 반대 근거 의무

매수 추천에는 최소 하나 이상의 강한 반대 근거가 포함되어야 한다.

#### 11.5 Facts와 Interpretation

보고서에서 다음을 시각적으로 구분한다.

- Fact
- Estimate
- Interpretation
- Recommendation

---

### 12. Human-in-the-loop

MVP에서는 사용자가 Portfolio·Risk가 허용한 범위 안에서 최종 승인 또는 거부 권한을 가진다.

#### 12.1 승인 유형

```ts
type ApprovalType =
  | 'APPROVED_AS_PROPOSED'
  | 'APPROVED_WITH_MODIFICATION'
  | 'REJECTED'
  | 'DEFERRED';
```

#### 12.2 수정 승인

사용자가 금액·Stop·전략을 변경하면 원래 제안과 변경 요청을 모두 저장한다. 수정값으로 기존 Proposal을 직접 승인하지 않으며 새 Proposal을 생성해 Portfolio·Risk·만료·가격·데이터를 재검증한다. 전략 변경은 기존 Decision을 종료하고 독립 Evaluation부터 새 Lifecycle을 시작한다.

#### 12.3 Manual Risk Review

Risk `DENY`와 Hard Safety는 Override할 수 없다. `REQUIRE_MANUAL_REVIEW`의 재검토는 다음을 요구한다.

- 구체적 사유
- 최대 손실
- 종료 조건
- 재검토 날짜
- 사용자의 명시적 확인

재검토 결과는 원 Risk Decision을 덮어쓰지 않고 새 Risk Decision으로 기록한다.

#### 12.4 자동화 확장 조건

자동 주문은 다음이 검증되기 전 도입하지 않는다.

- 데이터 안정성
- 주문 중복 방지
- Risk Engine
- Paper / Shadow Mode
- 실패 복구
- 감사 로그
- 사용자 Kill Switch

---

### 13. 성공 지표

Investment OS의 성공은 단기 수익률 하나로 평가하지 않는다.

#### 13.1 Portfolio Outcome

- CAGR
- 실질 수익률
- 최대 낙폭
- 회복 기간
- 변동성
- 세후 수익
- 전략별 기여

#### 13.2 Decision Quality

- Thesis 작성률
- Risk Review 통과율
- 규칙 준수율
- Stop 준수율
- 사후 전략 변경 비율
- FOMO 거래 비율
- `SKIP` 품질

#### 13.3 Learning Quality

- Lesson 기록률
- 모델 변경의 검증률
- Rollback 가능성
- 점수 변화 설명률
- 동일 오류 반복률

#### 13.4 Behavioral Sustainability

- 과도한 앱 확인 빈도 감소
- 충동 거래 감소
- 장기 보유 규칙 준수
- 사용자의 스트레스 수준
- 월급날 프로세스 준수

#### 13.5 Benchmark

전략별 Benchmark를 분리한다.

- Long-term: 적절한 주식 지수
- Future Core: 중소형 성장 또는 맞춤 Benchmark
- Momentum: 현금 포함 Tactical Benchmark
- Total Portfolio: 사용자 기준 통화의 혼합 Benchmark

Benchmark를 이기지 못했다는 이유만으로 단기간에 모델을 폐기하지 않는다.

---

### 14. Anti-patterns

#### AP-001: 물타기 자동화

```text
가격 하락
→ 자동 추가매수
```

문제:

- Thesis 약화를 무시
- 집중 증가
- 평단 중심 사고

대안:

- Thesis Review
- 가치 범위
- Portfolio Fit
- Opportunity Cost

#### AP-002: Momentum의 장기화

```text
Stop 도달
→ 좋은 회사이므로 보유
```

금지한다.

#### AP-003: 점수 하나로 전부 결정

기업 점수, 위험, 포트폴리오 적합성, Confidence를 분리한다.

#### AP-004: 모든 뉴스에 반응

뉴스가 Thesis 또는 Setup을 바꾸지 않으면 Action을 생성하지 않는다.

#### AP-005: 매주 모델 변경

성과 변동과 모델 실패를 구분한다.

#### AP-006: 후보군 과잉 확장

Future Core 후보를 너무 많이 유지하면 추적 품질이 낮아진다.

- 집중 후보 5~8개
- 넓은 Universe는 별도

#### AP-007: Theme 분산 착시

회사 수가 많아도 같은 경제적 위험에 의존하면 분산이 아니다.

#### AP-008: 분석 마비

완벽한 데이터가 없다는 이유로 모든 결정을 미루지 않는다.

- Confidence 낮춤
- Position 작게
- Watch 유지
- 추가 정보 요청

#### AP-009: 자동화 과신

Agent가 생성한 문장을 사실로 간주하지 않는다.

#### AP-010: 수익률 경쟁

다른 투자자의 단기 수익률을 기준으로 전략을 변경하지 않는다.

---

### 15. 사례 1 — 장기 매력과 단기 약세

> 구조 설명용 가상 사례

```text
Company A
Long-term Score: 91
Momentum Score: 38
Portfolio Weight: 4%
Thesis: 유지
Price: Base Value Range 하단
```

가능한 결론:

- Long-term Bucket에서 분할매수 검토
- Momentum Lot 신규 진입 금지
- 단기 약세 원인이 Thesis Break인지 재확인
- 총 종목 비중 한도 확인

잘못된 결론:

- Momentum이 약하므로 장기 Thesis도 자동 하향
- 가격 하락만 보고 무제한 추가매수

---

### 16. 사례 2 — 단기 강세와 낮은 장기 품질

```text
Company B
Long-term Score: 44
Momentum Score: 94
Catalyst: 강한 실적 Gap
Liquidity: 충분
```

가능한 결론:

- Momentum Bucket에서 제한된 위험으로 거래
- Stop·Target·Time Stop 필수
- 손실 시 장기 전환 금지
- Future Core 후보로 자동 편입 금지

---

### 17. 사례 3 — Future Core의 성장과 희석

```text
Company C
Revenue Growth: 높음
Gross Margin: 개선
Cash Runway: 12개월
Customer Concentration: 높음
Expected Dilution: 큼
```

가능한 결론:

- 높은 성장 점수와 낮은 생존 Confidence를 분리
- Watch 또는 작은 Starter
- 자금조달 후 조건 재평가
- 주가 하락을 매수 기회로 자동 해석 금지

---

### 18. 사례 4 — 수익은 났지만 나쁜 거래

```text
Momentum Position
Planned Stop: 95
Actual Lowest Price: 90
Stop 미실행
Final Exit: 108
```

성과:

- 금전적 수익

프로세스 평가:

- Stop 위반
- 예상 최대 손실 초과
- 재현 가능한 좋은 거래가 아님

Learning:

- 주문·알림 시스템 개선
- 결과를 이유로 규칙 변경 금지

---

### 19. 운영 템플릿 — Long-term Decision Memo

```md
# Long-term Decision Memo

## Identity
- Ticker:
- Company:
- Strategy: Core / Future Core
- Decision Date:
- Data As Of:
- Model Version:

## Proposed Action
- Action:
- Amount / Weight:
- Expected Horizon:

## Thesis
- One-sentence Thesis:
- Return Sources:
- Key Assumptions:

## Evidence
- Facts:
- Estimates:
- Inferences:
- Source Quality:

## Business Quality
- Market:
- Moat:
- Unit Economics:
- Management:
- Financial Strength:

## Valuation
- Bear Range:
- Base Range:
- Bull Range:
- Reverse DCF Assumptions:

## Risks
- Top Risks:
- Thesis Break Conditions:
- Portfolio Concentration:

## Opportunity Cost
- Alternative 1:
- Alternative 2:
- Cash:

## Review
- Next Earnings:
- Next Review Date:
- Metrics to Watch:
```

---

### 20. 운영 템플릿 — Future Core Discovery Memo

```md
# Future Core Discovery Memo

## Company / Industry
- Ticker:
- Industry:
- Stage:

## Why It Can Become Much Larger
- TAM:
- Initial Wedge:
- Expansion Path:
- Moat Formation:

## Evidence of Product-Market Fit
- Customers:
- Usage:
- Retention:
- Revenue Growth:

## Economic Quality
- Gross Margin:
- Unit Economics:
- Operating Leverage:

## Survival
- Cash:
- Burn:
- Runway:
- Dilution Risk:

## Management
- Founder / Team:
- Capital Allocation:
- Governance:

## Underappreciated Change
- What the Market May Be Missing:
- What Is Already Priced In:

## Stage Gates
- Watch → Candidate:
- Candidate → Strong Candidate:
- Future Core → Core:

## Starter Position
- Allowed:
- Max Initial Weight:
- Conditions to Add:
- Conditions to Remove:
```

---

### 21. 운영 템플릿 — Momentum Trade Plan

```md
# Momentum Trade Plan

## Identity
- Ticker:
- Setup Type:
- Market Regime:
- Model Version:

## Signal
- Relative Strength:
- Sector Strength:
- Volume:
- Catalyst:
- Liquidity:

## Plan
- Entry Zone:
- Chase Limit:
- Stop:
- Target 1:
- Target 2:
- Time Stop:

## Risk
- Risk per Share:
- Allowed Risk Amount:
- Position Size:
- Gap / Event Risk:
- Correlated Open Positions:

## Invalidation
- Price:
- Volume:
- Catalyst:
- Market:

## Approval
- Proposed:
- Approved:
- Changes:
```

---

### 22. 운영 템플릿 — Monthly Capital Allocation

```md
# Monthly Capital Allocation Report

## New Capital
- Source:
- Amount:
- Non-investable Reserve Check:

## Current Portfolio
- Long-term:
- Core:
- Future Core:
- Momentum:
- Cash:

## Risk
- Top Company Exposure:
- Top Theme Exposure:
- Hard Limit:
- Stress Result:

## Candidate Ranking
| Rank | Asset | Strategy | Attractiveness | Confidence | Portfolio Fit | Action |

## Final Recommendation
- Primary Allocation:
- Secondary Allocation:
- Cash Retained:
- Why:

## Conditions
- Valid Price Range:
- Next Review:
- Stop / Thesis Break:
```

---

### 23. 운영 템플릿 — Review and Lesson

```md
# Decision Review

## Original Decision
- Strategy:
- Action:
- Thesis / Setup:
- Expected Outcome:
- Risk:

## Actual Outcome
- P&L / R:
- Holding Period:
- Major Events:

## Process Assessment
- Data Quality:
- Rule Compliance:
- Position Size:
- Execution:
- Psychology:

## Model Assessment
- What Was Correct:
- What Was Wrong:
- Was This Random Variance?:

## Lesson
- Observation:
- Hypothesis:
- Proposed Change:
- More Samples Needed?:

## Governance
- Model Change Proposal:
- Approval Status:
- Effective Version:
```

---

### 24. 구현 요구사항으로 변환되는 철학

이 문서의 철학은 제품 기능으로 강제되어야 한다.

#### 24.1 필수 제품 기능

- 전략 선택 없는 주문 기록 금지
- 동일 종목 전략별 Lot 분리
- Momentum Stop 필수
- Long-term Thesis 필수
- 모델 버전 자동 저장
- 데이터 기준일 표시
- Fact / Inference 태그
- Risk Hard Limit
- 사용자 승인
- Decision 원본 보존
- `CASH`, `SKIP`, `WAIT` Action 지원
- 반대 근거 입력 필수
- Review 일정
- 전략별 성과 Attribution

#### 24.2 UI 원칙

- 평단보다 Thesis와 Risk를 상단에 표시
- 장기·Momentum 탭 분리
- 동일 종목 총노출 경고
- Score와 Confidence 병렬 표시
- 변경 이유가 없는 점수 표시 금지
- Stale Data 경고
- Hard Limit 명확히 표시

#### 24.3 Agent 원칙

- Agent는 정책을 변경하지 못함
- 숫자 계산은 deterministic code 우선
- 공식 출처 우선
- 구조화된 Output Schema
- 반대 의견 Agent 또는 단계 포함
- Risk 실패 시 추천 생성 금지

---

### 25. Philosophy Acceptance Criteria

`02_Investment_Philosophy`는 다음 기준을 만족해야 승인된다.

#### 전략

- Long-term과 Momentum 목적이 분리됨
- Core와 Future Core가 구분됨
- 현금의 역할이 정의됨

#### 자금

- Long-term 80~90%, Momentum 10~20% 기본 정책
- Bucket 이동 규칙
- 월급날 자본 배분 절차

#### 위험

- Position Size 원칙
- Concentration과 Correlation
- Stop과 Thesis Break 구분
- Risk Engine 거부권

#### 행동

- 평단·손익 편향 방지
- FOMO·Revenge·Confirmation Bias 통제
- 전략 변경 금지

#### 학습

- Decision Journal
- Review
- Lesson
- Model Version
- Human Approval

#### 구현

- 필수 데이터와 제품 기능으로 변환 가능
- 후속 Engine 문서가 참조할 용어가 명확
- 모순되는 규칙이 없음

---

### 26. 용어집

| 용어 | 정의 |
|---|---|
| Core | 검증된 장기 복리 후보 |
| Future Core | Core로 성장할 가능성이 있는 초기·중기 기업 |
| Momentum | 가격·거래량·촉매 기반 전술 전략 |
| Thesis | 시장이 충분히 반영하지 않은 가치 창출 가설 |
| Thesis Break | 장기 가치 가정이 구조적으로 무효화된 상태 |
| Setup | Momentum 진입을 위한 사전 정의 패턴 |
| Invalidation | Setup의 기대값이 사라지는 조건 |
| Position Lot | 전략별로 분리된 보유 단위 |
| Bucket | 전략별 자금 구획 |
| Risk Budget | 감수 가능한 손실·노출의 사전 한도 |
| Confidence | Score를 신뢰할 수 있는 정도 |
| Evidence Coverage | 핵심 가정을 뒷받침하는 데이터 충족도 |
| Opportunity Cost | 현재 자본의 다른 사용 대안 |
| R-Multiple | Momentum 초기 위험 대비 손익 |
| MAE | 거래 중 최대 불리한 움직임 |
| MFE | 거래 중 최대 유리한 움직임 |
| Market Regime | 시장의 추세·변동성·위험 선호 상태 |
| Historical Replay | 당시 데이터만으로 과거 의사결정을 재현하는 검증 |
| Shadow Mode | 신규 모델을 실제 실행 없이 병렬 평가하는 상태 |

---

### 27. Chapter 완료와 다음 단계

`02_Investment_Philosophy`는 다음 다섯 Part로 구성된다.

1. Foundations, Objectives, and Governance
2. Long-term, Core, and Future Core
3. Momentum and Tactical Investing
4. Capital Allocation, Portfolio, and Risk
5. Decision Process, Psychology, Learning, and Templates

다음 상세 설계 순서는 Architecture에서 정한 대로 진행한다.

1. `05_Portfolio_Engine.md`
2. `03_LongTerm_Engine.md`
3. `04_Momentum_Engine.md`
4. `09_Scoring_System.md`
5. `06_Learning_Engine.md`

Philosophy 변경이 필요하면 하위 Engine을 임의로 수정하기 전에 이 Chapter의 버전을 먼저 올린다.
