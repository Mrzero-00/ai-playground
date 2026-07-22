# 02-5. Decision Process, Psychology, Learning, and Operating Templates

> 좋은 결과보다 좋은 의사결정 과정을 반복하고, 편향과 모델 오류를 기록해 Investment OS를 통제된 방식으로 진화시키는 운영 원칙

- Chapter: `02_Investment_Philosophy`
- Part: 5 / 5
- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 최종 검토일: 2026-07-23
- 명세 상태: Draft for Review
- 구현 준비도: R1 Foundation Implemented / Policy Approval Open
- 정본: `docs/02_Investment_Philosophy.md`
- 관련 Engine: Decision Engine, Learning Engine, Report Engine
- 관련 후속 문서: `06_Learning_Engine.md`, `10_Report_System.md`, `13_Codex_Implementation.md`

---

## 1. 의사결정 품질과 투자 결과를 분리한다

좋은 투자 결과가 반드시 좋은 결정에서 나온 것은 아니다. 나쁜 결과가 반드시 나쁜 결정이라는 뜻도 아니다.

Investment OS는 다음 네 가지를 구분한다.

| 의사결정 과정 | 결과 | 해석 |
|---|---|---|
| 좋음 | 좋음 | 재현 가능한 성공 후보 |
| 좋음 | 나쁨 | 정상적인 확률 손실 가능 |
| 나쁨 | 좋음 | 위험한 행운 |
| 나쁨 | 나쁨 | 우선 개선 대상 |

### 1.1 좋은 의사결정의 조건

- 전략이 사전에 분류됨
- 당시 이용 가능한 데이터만 사용
- 반대 근거가 포함됨
- 위험과 Position Size가 사전에 정해짐
- 실행 전 기대수익과 실패 조건이 있음
- 결과에 따라 과거 논리를 바꾸지 않음
- 규칙 위반이 기록됨

### 1.2 Outcome Bias 방지

수익률이 높았다는 이유만으로 다음을 정당화하지 않는다.

- 무계획 진입
- Stop 미준수
- 과도한 집중
- 루머 기반 매수
- 손실 Position 평균내기
- 장기·Momentum 전략 혼합

반대로 계획된 작은 Momentum 손실이나 합리적 Future Core 실패는 시스템이 감당하기로 한 비용일 수 있다.

---

## 2. Decision Lifecycle

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

### 2.1 Idea

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

### 2.2 Research

필수 작업:

- 기업 Master 확인
- 공식 자료 수집
- 주요 수익원
- 산업·경쟁사
- 위험
- 데이터 신뢰도

### 2.3 Evaluation

전략별 Engine이 독립적으로 평가한다.

- Long-term Evaluation
- Future Core Evaluation
- Momentum Evaluation

### 2.4 Portfolio Fit

- Bucket 여유
- 종목 비중
- Theme 노출
- 현금
- 상관 위험

### 2.5 Risk Review

- Hard Rule
- 유동성
- Event
- Drawdown
- 데이터 오류

### 2.6 Decision Proposal

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

### 2.7 Approval

MVP에서는 사용자가 승인한다.

승인 시 다음을 고정한다.

- 전략
- 금액·수량
- 기준 가격
- 모델 버전
- Thesis 또는 Setup
- 위험 한도
- 다음 리뷰

### 2.8 Execution

추천과 실제 체결을 구분한다.

- 제안 가격
- 주문 가격
- 체결 가격
- 수량
- Slippage
- 미체결
- 부분체결

### 2.9 Monitoring

전략별 관찰 항목과 주기가 다르다.

### 2.10 Exit / Continue

보유 연장은 자동이 아니다. Review 결과에 따라 `Continue` Decision을 생성할 수 있다.

### 2.11 Review and Lesson

결과와 과정, 모델 적합성을 분리해 평가한다.

---

## 3. Decision Journal 철학

Decision Journal은 거래 일지가 아니라 당시 사고를 보존하는 기록이다.

### 3.1 반드시 기록할 내용

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

### 3.2 수정 불변성

기존 기록은 수정할 수 있더라도 원본을 보존한다.

```text
Decision v1
→ Amendment v2
→ Review
```

사후적으로 예측을 더 정확하게 보이도록 원문을 덮어쓰지 않는다.

### 3.3 `SKIP` 기록

사지 않은 결정도 기록할 가치가 있다.

- 가격이 과도함
- 데이터 불충분
- Risk Limit
- 더 나은 대안
- FOMO 억제

`SKIP`의 사후 성과를 추적해 지나친 보수성도 검토한다.

---

## 4. Pre-mortem과 Inversion

### 4.1 Pre-mortem

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

### 4.2 Inversion

`어떻게 성공할까?`뿐 아니라 `어떻게 실패할 수 있을까?`를 묻는다.

### 4.3 Kill Criteria

조사 중 다음이 확인되면 분석을 조기 종료할 수 있다.

- 회계 신뢰 불가
- 생존 불가능한 자금 구조
- 투자 Thesis가 가격 상승 기대뿐
- Momentum 유동성 기준 미달
- 데이터가 검증 불가
- Portfolio Hard Limit 초과

분석 시간을 절약하는 것도 자본 배분의 일부다.

---

## 5. 행동 편향과 시스템 통제

Investment OS는 인간의 편향을 없애지 못한다. 대신 편향이 행동으로 이어지기 어렵게 설계한다.

## 5.1 Anchoring

증상:

- 평단을 기준으로 판단
- 과거 고점을 적정가로 인식
- 최초 목표가를 고수

통제:

- 현재 가치 범위와 평단을 화면에서 분리
- `오늘 현금 100%라면 살 것인가?` 질문
- 과거 고점 미표시 모드
- Thesis와 현재 데이터 우선

## 5.2 Loss Aversion

증상:

- 손실 확정을 피함
- Momentum Stop을 미룸
- Thesis Broken Position 보유

통제:

- Strategy별 종료 규칙
- Stop 자동 경고
- Thesis Break Review
- 손실 금액보다 위험 기준 표시

## 5.3 Disposition Effect

증상:

- 작은 수익을 빨리 확정
- 큰 손실은 오래 보유

통제:

- Core 자동 익절 금지
- Momentum Target·Trailing 사전 정의
- 매도 근거 분류

## 5.4 Confirmation Bias

증상:

- 긍정 뉴스만 수집
- 반대 의견 무시

통제:

- Bear Case 필수
- 반대 근거 3개
- Red Team Agent
- Thesis Assumption 상태 추적

## 5.5 Recency Bias

증상:

- 최근 수익 전략에 과도한 비중
- 최근 손실 후 전략 폐기

통제:

- 최소 샘플 기준
- 여러 Regime 성과
- 장기 모델의 느린 변경 주기

## 5.6 FOMO

증상:

- Entry Zone 초과
- 뉴스 급등 추격
- 월급날 무조건 매수

통제:

- Chase Limit
- 현금도 최종 선택
- `MISSED` 상태
- 다음 기회 목록

## 5.7 Overconfidence

증상:

- 연속 수익 후 비중 급증
- 하나의 성공 사례로 모델 확신

통제:

- Hard Position Limit
- Risk per Trade 상한
- Model Version 승인
- 수익과 규칙 준수 분리

## 5.8 Sunk Cost

증상:

- 많은 시간·돈을 썼으므로 계속 보유
- 프로젝트에 애착

통제:

- 과거 투입액을 현재 평가 점수에서 제외
- Thesis Break 우선
- 신규 자금은 독립 Decision

## 5.9 Narrative Fallacy

증상:

- 매력적인 이야기로 숫자 부족을 보완

통제:

- Fact / Inference / Hypothesis 태그
- 관찰 가능한 Milestone
- 데이터 Coverage 점수

## 5.10 Activity Bias

증상:

- 매주 무언가 거래해야 한다고 느낌

통제:

- `HOLD`, `WAIT`, `CASH`, `SKIP`을 동등한 Action으로 취급
- 거래 횟수 KPI 금지
- 좋은 무행동 사례 기록

---

## 6. 감정 상태의 기록

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

### 6.1 감정 기반 Safety Rule

- `REVENGE_RISK`: 신규 Momentum 거래 제한
- `FOMO_RISK`: Chase Limit 강화
- `FATIGUED`: 대규모 결정 Manual Review
- `FEARFUL`: 장기 포지션 즉시 전량 매도 전 Cooling Period 가능

단, 회계 부정·파산 위험 등 Hard Event에서는 Cooling Period보다 위험 대응이 우선한다.

### 6.2 감정과 결과 분석

장기적으로 다음을 분석할 수 있다.

- 감정 상태별 규칙 위반률
- FOMO 거래 성과
- 피로 상태의 실행 오류
- 손실 후 재진입 성과

---

## 7. Review Cadence

전략과 데이터에 맞는 주기로 검토한다.

### 7.1 Daily

- Momentum Open Position
- Stop / Target
- Market Regime
- Risk Alert

### 7.2 Weekly

- Core / Future Core 주요 변화
- Momentum 후보
- Portfolio Exposure
- 뉴스와 Thesis 영향
- 신규·제외 후보

### 7.3 Monthly

- 월급날 Capital Allocation
- 전략별 비중
- Momentum 거래 성과
- Future Core 단계 변화
- Cash 결정

### 7.4 Quarterly

- 기업 실적
- Thesis Assumption
- Long-term Score
- FCF·재무 위험
- 승격·강등
- 산업 구조

### 7.5 Annual

- 전체 전략 성과
- 벤치마크
- 최대 낙폭
- 의사결정 품질
- 모델 버전
- 철학 변경 필요
- 개인 재무 목표

### 7.6 Event-driven

- Earnings
- Guidance Change
- CEO/CFO Departure
- Regulation
- Major Contract
- Financing
- Accounting Issue
- Stop / Thesis Break

---

## 8. Learning Philosophy

Learning Engine의 목표는 과거를 완벽히 설명하는 것이 아니라 미래 의사결정을 더 일관되게 만드는 것이다.

### 8.1 Learning Unit

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

### 8.2 Lesson 유형

- Data Lesson
- Model Lesson
- Execution Lesson
- Risk Lesson
- Psychology Lesson
- Portfolio Lesson
- No-change Lesson

`No-change Lesson`도 중요하다. 결과가 나빴다고 항상 모델을 바꾸지 않는다.

### 8.3 Learning의 세 단계

```text
Observation
→ Hypothesis
→ Policy / Model Change
```

관찰 하나를 즉시 규칙으로 만들지 않는다.

### 8.4 장기와 Momentum의 학습 속도

| 구분 | Long-term | Momentum |
|---|---|---|
| 기본 샘플 | 분기·연간 | 거래 단위 |
| 변경 속도 | 느림 | 상대적으로 빠름 |
| 주요 위험 | 너무 늦은 수정 | 과적합 |
| 검증 | 장기 Replay·Case Study | 다수 거래·Regime |

---

## 9. Model Evolution Governance

### 9.1 모델 변경 제안

제안에는 다음이 필요하다.

- 문제 정의
- 관련 사례
- 기존 모델의 실패 방식
- 변경 항목
- 예상 장점
- 예상 부작용
- 과거 데이터 영향
- Rollback Plan

### 9.2 검증 단계

```text
Draft
→ Historical Replay
→ Shadow Mode
→ Review
→ Approved
→ Active
→ Deprecated
```

### 9.3 Look-ahead Bias 금지

과거 평가 재현 시 당시 알 수 없었던 데이터를 사용하지 않는다.

- 수정된 실적
- 후속 공시
- 미래 지수 구성
- 생존 기업만 남긴 Universe

### 9.4 Overfitting 방지

- 너무 많은 파라미터 금지
- 특정 종목에 맞춘 규칙 금지
- 거래 비용 포함
- Out-of-sample 검증
- 단순 모델과 비교
- 복잡도가 개선 폭을 정당화하는지 확인

### 9.5 Rollback

새 모델이 예상치 못한 문제를 만들면 이전 Active Version으로 돌아갈 수 있어야 한다.

모든 Decision은 사용 모델 버전을 저장한다.

---

## 10. Score 철학

Score는 의사결정을 단순화하지만 정밀한 진실처럼 보일 위험이 있다.

### 10.1 Score의 역할

- 비교
- 우선순위
- 변화 추적
- 규칙 기반 경고
- 설명 구조

### 10.2 Score가 하지 못하는 것

- 미래 주가 확정
- Tail Risk 완전 반영
- 모든 산업의 질적 차이 표현
- 사용자 재무 상황 대체
- Position Size 자동 결정

### 10.3 점수와 등급

작은 숫자 차이는 의미가 없을 수 있다.

예:

```text
Company A: 89
Company B: 87
Uncertainty Band: ±5
```

두 기업을 실질적으로 같은 등급으로 처리할 수 있다.

### 10.4 Score Change Explanation

점수가 바뀌면 이유를 저장한다.

- 원시 데이터 변화
- Thesis 변화
- 모델 버전 변화
- 가격 변화
- Confidence 변화

점수만 바뀌고 설명이 없는 상태를 허용하지 않는다.

---

## 11. Explainability와 보고 원칙

### 11.1 보고서의 순서

좋은 보고서는 다음 순서로 읽힌다.

1. 결론
2. 이번 변화
3. 근거
4. 반대 근거
5. 위험
6. 행동
7. 다음 검토 조건
8. 출처

### 11.2 한 개의 최우선 선택

사용자가 여러 선택지 중 하나를 선택해야 할 때 시스템은 최우선 후보 하나를 제시한다.

단, 불확실성이 크면 `현금 유지`가 최우선 선택일 수 있다.

### 11.3 확신 표현

- High Confidence
- Medium Confidence
- Low Confidence

확신은 문체의 강도가 아니라 데이터 Coverage와 모델 적합성에 기반한다.

### 11.4 반대 근거 의무

매수 추천에는 최소 하나 이상의 강한 반대 근거가 포함되어야 한다.

### 11.5 Facts와 Interpretation

보고서에서 다음을 시각적으로 구분한다.

- Fact
- Estimate
- Interpretation
- Recommendation

---

## 12. Human-in-the-loop

MVP에서는 사용자가 Portfolio·Risk가 허용한 범위 안에서 최종 승인 또는 거부 권한을 가진다.

### 12.1 승인 유형

```ts
type ApprovalType =
  | 'APPROVED_AS_PROPOSED'
  | 'APPROVED_WITH_MODIFICATION'
  | 'REJECTED'
  | 'DEFERRED';
```

### 12.2 수정 승인

사용자가 금액·Stop·전략을 변경하면 원래 제안과 변경 요청을 모두 저장한다. 수정값으로 기존 Proposal을 직접 승인하지 않으며 새 Proposal을 생성해 Portfolio·Risk·만료·가격·데이터를 재검증한다. 전략 변경은 기존 Decision을 종료하고 독립 Evaluation부터 새 Lifecycle을 시작한다.

### 12.3 Manual Risk Review

Risk `DENY`와 Hard Safety는 Override할 수 없다. `REQUIRE_MANUAL_REVIEW`의 재검토는 다음을 요구한다.

- 구체적 사유
- 최대 손실
- 종료 조건
- 재검토 날짜
- 사용자의 명시적 확인

재검토 결과는 원 Risk Decision을 덮어쓰지 않고 새 Risk Decision으로 기록한다.

### 12.4 자동화 확장 조건

자동 주문은 다음이 검증되기 전 도입하지 않는다.

- 데이터 안정성
- 주문 중복 방지
- Risk Engine
- Paper / Shadow Mode
- 실패 복구
- 감사 로그
- 사용자 Kill Switch

---

## 13. 성공 지표

Investment OS의 성공은 단기 수익률 하나로 평가하지 않는다.

### 13.1 Portfolio Outcome

- CAGR
- 실질 수익률
- 최대 낙폭
- 회복 기간
- 변동성
- 세후 수익
- 전략별 기여

### 13.2 Decision Quality

- Thesis 작성률
- Risk Review 통과율
- 규칙 준수율
- Stop 준수율
- 사후 전략 변경 비율
- FOMO 거래 비율
- `SKIP` 품질

### 13.3 Learning Quality

- Lesson 기록률
- 모델 변경의 검증률
- Rollback 가능성
- 점수 변화 설명률
- 동일 오류 반복률

### 13.4 Behavioral Sustainability

- 과도한 앱 확인 빈도 감소
- 충동 거래 감소
- 장기 보유 규칙 준수
- 사용자의 스트레스 수준
- 월급날 프로세스 준수

### 13.5 Benchmark

전략별 Benchmark를 분리한다.

- Long-term: 적절한 주식 지수
- Future Core: 중소형 성장 또는 맞춤 Benchmark
- Momentum: 현금 포함 Tactical Benchmark
- Total Portfolio: 사용자 기준 통화의 혼합 Benchmark

Benchmark를 이기지 못했다는 이유만으로 단기간에 모델을 폐기하지 않는다.

---

## 14. Anti-patterns

### AP-001: 물타기 자동화

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

### AP-002: Momentum의 장기화

```text
Stop 도달
→ 좋은 회사이므로 보유
```

금지한다.

### AP-003: 점수 하나로 전부 결정

기업 점수, 위험, 포트폴리오 적합성, Confidence를 분리한다.

### AP-004: 모든 뉴스에 반응

뉴스가 Thesis 또는 Setup을 바꾸지 않으면 Action을 생성하지 않는다.

### AP-005: 매주 모델 변경

성과 변동과 모델 실패를 구분한다.

### AP-006: 후보군 과잉 확장

Future Core 후보를 너무 많이 유지하면 추적 품질이 낮아진다.

- 집중 후보 5~8개
- 넓은 Universe는 별도

### AP-007: Theme 분산 착시

회사 수가 많아도 같은 경제적 위험에 의존하면 분산이 아니다.

### AP-008: 분석 마비

완벽한 데이터가 없다는 이유로 모든 결정을 미루지 않는다.

- Confidence 낮춤
- Position 작게
- Watch 유지
- 추가 정보 요청

### AP-009: 자동화 과신

Agent가 생성한 문장을 사실로 간주하지 않는다.

### AP-010: 수익률 경쟁

다른 투자자의 단기 수익률을 기준으로 전략을 변경하지 않는다.

---

## 15. 사례 1 — 장기 매력과 단기 약세

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

## 16. 사례 2 — 단기 강세와 낮은 장기 품질

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

## 17. 사례 3 — Future Core의 성장과 희석

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

## 18. 사례 4 — 수익은 났지만 나쁜 거래

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

## 19. 운영 템플릿 — Long-term Decision Memo

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

## 20. 운영 템플릿 — Future Core Discovery Memo

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

## 21. 운영 템플릿 — Momentum Trade Plan

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

## 22. 운영 템플릿 — Monthly Capital Allocation

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

## 23. 운영 템플릿 — Review and Lesson

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

## 24. 구현 요구사항으로 변환되는 철학

이 문서의 철학은 제품 기능으로 강제되어야 한다.

### 24.1 필수 제품 기능

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

### 24.2 UI 원칙

- 평단보다 Thesis와 Risk를 상단에 표시
- 장기·Momentum 탭 분리
- 동일 종목 총노출 경고
- Score와 Confidence 병렬 표시
- 변경 이유가 없는 점수 표시 금지
- Stale Data 경고
- Hard Limit 명확히 표시

### 24.3 Agent 원칙

- Agent는 정책을 변경하지 못함
- 숫자 계산은 deterministic code 우선
- 공식 출처 우선
- 구조화된 Output Schema
- 반대 의견 Agent 또는 단계 포함
- Risk 실패 시 추천 생성 금지

---

## 25. Philosophy Acceptance Criteria

`02_Investment_Philosophy`는 다음 기준을 만족해야 승인된다.

### 전략

- Long-term과 Momentum 목적이 분리됨
- Core와 Future Core가 구분됨
- 현금의 역할이 정의됨

### 자금

- Long-term 80~90%, Momentum 10~20% 기본 정책
- Bucket 이동 규칙
- 월급날 자본 배분 절차

### 위험

- Position Size 원칙
- Concentration과 Correlation
- Stop과 Thesis Break 구분
- Risk Engine 거부권

### 행동

- 평단·손익 편향 방지
- FOMO·Revenge·Confirmation Bias 통제
- 전략 변경 금지

### 학습

- Decision Journal
- Review
- Lesson
- Model Version
- Human Approval

### 구현

- 필수 데이터와 제품 기능으로 변환 가능
- 후속 Engine 문서가 참조할 용어가 명확
- 모순되는 규칙이 없음

---

## 26. 용어집

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

## 27. Chapter 완료와 하위 문서 소유권

`02_Investment_Philosophy`는 다음 다섯 Part로 구성된다.

1. Foundations, Objectives, and Governance
2. Long-term, Core, and Future Core
3. Momentum and Tactical Investing
4. Capital Allocation, Portfolio, and Risk
5. Decision Process, Psychology, Learning, and Templates

다음 문서는 이미 작성된 하위 계약이며 Philosophy 변경 시 영향 분석과 재검토 순서로 사용한다.

1. `05_Portfolio_Engine.md`
2. `03_LongTerm_Engine.md`
3. `04_Momentum_Engine.md`
4. `09_Scoring_System.md`
5. `06_Learning_Engine.md`

Philosophy 변경이 필요하면 하위 Engine을 임의로 수정하기 전에 이 Chapter의 버전을 먼저 올리고, `13_Codex_Implementation.md`의 구현·검증 영향도 함께 갱신한다.
