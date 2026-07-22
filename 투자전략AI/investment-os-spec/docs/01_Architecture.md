# 01. Investment OS Architecture

> Long-term Investing과 Momentum Investing을 하나의 포트폴리오 안에서 운영하되, 분석 논리·자금·위험·성과·학습을 분리하는 Investment OS의 기준 아키텍처

- 문서 버전: v2.1
- 작성일: 2026-07-22
- 문서 상태: Architecture Baseline
- 상위 문서: `00_Vision.md`
- 후속 문서:
  - `02_Investment_Philosophy.md`
  - `03_LongTerm_Engine.md`
  - `04_Momentum_Engine.md`
  - `05_Portfolio_Engine.md`
  - `06_Learning_Engine.md`
  - `07_AI_Agents.md`
  - `08_Database.md`
  - `09_Scoring_System.md`
  - `10_Report_System.md`
  - `11_UI_UX.md`
  - `12_Roadmap.md`
  - `13_Codex_Implementation.md`

---

## 1. 문서 목적

이 문서는 Investment OS 전체의 구조와 책임 경계를 정의한다.

핵심 목표는 다음과 같다.

1. 장기투자와 모멘텀 투자를 동일한 플랫폼 안에서 운영한다.
2. 두 전략이 서로의 규칙을 오염시키지 않도록 독립된 Engine으로 분리한다.
3. 실제 자금 배분은 Portfolio Engine이 통제한다.
4. 모든 추천은 Risk Engine의 검증을 통과해야 한다.
5. 판단, 실행, 결과, 회고를 모두 기록한다.
6. 과거 판단과 실제 성과를 비교해 모델을 명시적으로 버전업한다.
7. 자동화가 잘못 동작하더라도 장기 자산 전체가 훼손되지 않도록 안전장치를 둔다.

이 문서는 세부 점수 공식이나 투자 기준을 확정하지 않는다. 대신 각 기능이 어느 Engine에 속하고, 어떤 입력과 출력을 가지며, 누가 최종 권한을 가지는지를 확정한다.

---

## 2. 핵심 설계 원칙

### 2.1 하나의 플랫폼, 복수의 독립 전략

Investment OS는 하나의 애플리케이션이지만 내부적으로 여러 투자 전략을 독립된 모듈로 운영한다.

```text
Investment OS
├── Long-term Investment System
│   ├── Core Engine
│   └── Future Core Engine
├── Tactical Investment System
│   └── Momentum Engine
├── Cross Signal Engine
├── Portfolio Engine
├── Risk Engine
├── Decision Engine
├── Learning Engine
├── Report Engine
└── Data Platform
```

### 2.2 전략별 진실은 분리한다

같은 기업이라도 장기 관점과 단기 관점은 서로 다른 결론을 가질 수 있다.

예시:

```text
Company A
- Long-term Score: 92
- Momentum Score: 36
```

해석:

- 장기 분할매수 후보일 수 있다.
- 단기 진입 시점은 부적절할 수 있다.

반대 예시:

```text
Company B
- Long-term Score: 41
- Momentum Score: 96
```

해석:

- 단기 거래 후보일 수 있다.
- 단기 거래 실패 후 장기 보유로 전환하면 안 된다.

### 2.3 점수는 판단 자료이며 주문 명령이 아니다

각 Engine은 분석 결과를 반환한다. 실제 투자 가능 여부와 금액은 Portfolio Engine과 Risk Engine이 결정한다.

```text
Analysis Engine
    ↓
Signal / Score
    ↓
Portfolio Capacity Check
    ↓
Risk Validation
    ↓
Decision Proposal
    ↓
User Approval
    ↓
Execution Record
```

### 2.4 장기 자산 보호가 최우선이다

기본 자산 배분은 다음과 같다.

- Long-term Bucket: 전체 투자자산의 80~90%
- Momentum Bucket: 전체 투자자산의 10~20%
- Cash Reserve: 각 Bucket 내부 또는 공통 현금으로 별도 관리

Momentum 손실을 복구하기 위해 Long-term 자산을 매도하거나 장기 투자 예산을 전용하지 않는다.

### 2.5 모든 판단은 시간 이력을 가진다

현재 상태만 저장하지 않는다.

- 당시 데이터
- 사용한 모델 버전
- 점수
- 추천
- 근거
- 위험
- 승인 여부
- 실제 실행
- 결과

를 스냅샷으로 남긴다.

### 2.6 자동 학습이 아니라 통제된 모델 진화

LLM이 과거 결과를 자동으로 영구 학습한다고 가정하지 않는다.

Investment OS의 학습은 다음 과정으로 이루어진다.

```text
Decision
  ↓
Outcome
  ↓
Review
  ↓
Lesson
  ↓
Model Change Proposal
  ↓
Human Approval
  ↓
New Model Version
```

---

## 3. 시스템 컨텍스트

### 3.1 외부 입력

Investment OS는 다음 외부 데이터를 사용할 수 있다.

- 실시간 또는 지연 시세
- 일봉·주봉·분봉 데이터
- 거래량과 변동성
- 기업 실적 및 재무제표
- SEC 공시
- 기업 IR 자료
- 컨퍼런스콜
- 뉴스
- 애널리스트 추정치
- 옵션 데이터
- 기관 수급
- 경제 지표
- 금리·환율·원자재
- 사용자 포트폴리오
- 사용자 매수·매도 기록
- 사용자 위험 설정

모든 데이터는 `Data Platform`을 통해 정규화된 뒤 Engine으로 전달한다.

### 3.2 외부 출력

시스템은 다음 결과를 생성한다.

- Long-term 기업 평가
- Future Core 후보 목록
- Momentum 후보 목록
- 종목별 진입·손절·목표가 제안
- 자금 배분안
- 주간·월간·분기 보고서
- 위험 경고
- 모델 변경 제안
- Decision Journal
- Markdown / JSON / Web Report

### 3.3 초기 실행 범위

MVP에서는 주문을 자동으로 실행하지 않는다.

```text
MVP
- 데이터 수집
- 분석
- 점수
- 추천
- 포트폴리오 검증
- 사용자 승인
- 수동 실행 기록
```

자동 주문은 향후 별도 Phase에서 추가한다.

---

## 4. 전체 논리 아키텍처

```text
┌────────────────────────────────────────────────────────────┐
│                        Data Sources                         │
│ Price / Volume / SEC / IR / News / Options / Portfolio    │
└────────────────────────────┬───────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                       Data Platform                        │
│ Collect → Normalize → Validate → Timestamp → Source Link  │
└───────────────┬──────────────────────┬─────────────────────┘
                │                      │
                ▼                      ▼
┌────────────────────────┐   ┌──────────────────────────────┐
│ Long-term System       │   │ Momentum System              │
│ Core / Future Core     │   │ Scan / Rank / Trade Plan     │
└───────────────┬────────┘   └───────────────┬──────────────┘
                │                            │
                └──────────────┬─────────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Cross Signal Engine │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Portfolio Engine    │
                    │ Budget / Exposure   │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Risk Engine         │
                    │ Approve/Reduce/Deny │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Decision Engine     │
                    │ Proposal / Approval │
                    └──────────┬──────────┘
                               ▼
                  ┌─────────────────────────┐
                  │ Journal / Report / Alert│
                  └────────────┬────────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Learning Engine     │
                    │ Review / Versioning │
                    └─────────────────────┘
```

---

## 5. Engine 정의

## 5.1 Long-term Investment System

Long-term System은 기업의 장기 가치 창출 가능성을 평가한다.

### 구성

```text
Long-term Investment System
├── Core Engine
├── Future Core Engine
├── Fundamental Analysis Module
├── Valuation Module
├── Thesis Module
└── Long-term Review Module
```

### 주요 책임

- 사업 퀄리티 평가
- 장기 시장 성장성 평가
- 경쟁우위와 생태계 평가
- 재무 건전성 평가
- 밸류에이션 평가
- 투자 논지 생성
- 논지 강화·약화·훼손 판정
- Core / Future Core 승격·강등
- 월간 추가 매수 후보 선정

### 입력

- 기업 기본정보
- 실적 및 재무제표
- 경영진 가이던스
- 산업 데이터
- 경쟁사 데이터
- 현재 밸류에이션
- 기존 Thesis
- 기존 점수 이력
- 모델 버전

### 출력

```ts
interface LongTermEvaluation {
  companyId: string;
  evaluatedAt: string;
  modelVersionId: string;

  coreScore?: number;
  futureCoreScore?: number;
  businessQualityScore: number;
  valuationScore: number;
  financialStrengthScore: number;
  growthDurabilityScore: number;
  riskScore: number;

  stage:
    | 'universe'
    | 'watch'
    | 'candidate'
    | 'strong_candidate'
    | 'future_core'
    | 'core'
    | 'removed';

  action:
    | 'ACCUMULATE'
    | 'BUY_ON_WEAKNESS'
    | 'HOLD'
    | 'WATCH'
    | 'REDUCE'
    | 'EXIT';

  thesisStatus: 'strengthened' | 'unchanged' | 'weakened' | 'broken';
  thesisSummary: string;
  catalysts: string[];
  risks: string[];
  thesisBreakConditions: string[];
  evidenceIds: string[];
}
```

### 금지 사항

Long-term System은 다음을 직접 결정하지 않는다.

- 단기 진입가
- 손절가
- 당일 거래량 기반 주문
- Momentum 예산
- 실제 매수 금액
- 주문 실행

---

## 5.2 Core Engine

Core Engine은 이미 상당 부분 검증된 고품질 기업을 평가한다.

### 특징

- 투자 기간: 5~15년
- 평가 주기: 주간 모니터링 + 분기 실적 리뷰
- 주요 관심:
  - 사업 지속성
  - FCF
  - 자본 배분
  - 밸류에이션
  - 경쟁 우위
  - 장기 복리 가능성
- 점수 변화 속도: 느림
- 잦은 모델 변경 금지

### 예시 대상

- 대형 플랫폼
- 검증된 AI 인프라 기업
- 독점적 제조 역량 보유 기업
- 높은 전환 비용과 반복 매출 보유 기업

---

## 5.3 Future Core Engine

Future Core Engine은 미래의 Core가 될 가능성이 있는 기업을 발굴한다.

### 특징

- 투자 기간: 5~15년
- 초기 비중: 종목당 1~4%
- 후보 수: 기본 5~8개
- 주요 관심:
  - 거대한 TAM
  - 매출 성장 가속
  - 점유율 상승
  - 생태계 형성
  - Founder / Management
  - 수익성 개선
  - 재무 생존성
  - 시장의 과소평가
- 주가 하락만으로 비중 확대 금지
- 사업 증거 강화 시 비중 확대

### 산업 범위

Future Core는 AI에 고정하지 않는다.

- AI
- 반도체
- 로봇
- 전력
- 원전
- 바이오
- 우주
- 양자
- 사이버보안
- 핀테크
- 방산
- 기타 신규 구조적 성장 산업

---

## 5.4 Momentum Engine

Momentum Engine은 짧은 기간 동안의 비대칭적 가격 움직임을 탐색한다.

### 구성

```text
Momentum Engine
├── Universe Scanner
├── Market Regime Module
├── Sector Rotation Module
├── Relative Strength Module
├── Volume & Liquidity Module
├── Catalyst Module
├── Entry Planner
├── Exit Planner
└── Trade Review Module
```

### 주요 책임

- 거래 가능한 종목 Universe 구성
- 시장 Regime 판단
- 섹터 상대강도 분석
- 종목 상대강도 분석
- 거래량·유동성·변동성 분석
- 촉매 확인
- 진입 구간 제안
- 손절가 제안
- 1차·2차 목표가 제안
- 최대 보유 기간 제안
- 거래 무효화 조건 제시
- 거래 후 성과 리뷰

### 입력

- 시세
- 거래량
- 변동성
- Gap
- 상대강도
- 섹터 데이터
- 뉴스 촉매
- 실적 일정
- 옵션 데이터
- 기관 수급
- 유동성
- 현재 포지션
- Momentum 모델 버전

### 출력

```ts
interface MomentumEvaluation {
  companyId: string;
  evaluatedAt: string;
  modelVersionId: string;

  momentumScore: number;
  relativeStrengthScore: number;
  volumeScore: number;
  catalystScore: number;
  liquidityScore: number;
  setupQualityScore: number;
  riskScore: number;

  setupType:
    | 'BREAKOUT'
    | 'PULLBACK'
    | 'GAP_CONTINUATION'
    | 'EARNINGS_MOMENTUM'
    | 'SECTOR_ROTATION'
    | 'SPECIAL_SITUATION';

  action: 'ENTER' | 'WAIT' | 'AVOID' | 'EXIT';

  entryZone?: {
    min: number;
    max: number;
  };

  stopLoss?: number;
  target1?: number;
  target2?: number;
  maxHoldingDays?: number;

  invalidationConditions: string[];
  catalystSummary: string;
  evidenceIds: string[];
}
```

### 금지 사항

Momentum Engine은 다음을 해서는 안 된다.

- 손절된 포지션을 장기 투자로 자동 전환
- Long-term Bucket에서 자금 차입
- 손실 복구를 위한 포지션 확대
- 유동성이 부족한 종목 추천
- 손절가 없는 진입 추천
- 실적·FDA·법원 판결 등 이벤트 위험을 무시
- 장기 기업 점수를 근거로 단기 손절 무효화

---

## 5.5 Cross Signal Engine

Cross Signal Engine은 Long-term과 Momentum 결과를 비교한다.

이 Engine은 새로운 원본 점수를 만들기보다 두 전략의 관계를 해석한다.

### 시그널 매트릭스

| Long-term | Momentum | 분류 | 기본 해석 |
|---:|---:|---|---|
| 높음 | 높음 | Dual High Conviction | 장기 매수 시점과 단기 추세가 동시에 우호적 |
| 높음 | 낮음 | Long-term Opportunity | 장기 가치 우수, 단기 추세 불리 |
| 낮음 | 높음 | Tactical Only | 단기 거래만 허용, 장기 전환 금지 |
| 낮음 | 낮음 | Avoid | 신규 진입 우선순위 낮음 |

### 출력 예시

```ts
interface CrossSignal {
  companyId: string;
  evaluatedAt: string;
  longTermScore: number;
  momentumScore: number;

  classification:
    | 'DUAL_HIGH_CONVICTION'
    | 'LONG_TERM_ONLY'
    | 'MOMENTUM_ONLY'
    | 'AVOID';

  interpretation: string;
  portfolioNotes: string[];
}
```

### 중요 원칙

같은 종목을 장기와 단기로 동시에 보유할 수 있다. 단, Position Lot을 분리한다.

```text
ORCL
├── Long-term Lot
│   ├── 목적: 5~10년 보유
│   └── Exit: Thesis Break
└── Momentum Lot
    ├── 목적: 수일~수주
    └── Exit: Stop / Target / Time Stop
```

단기 Lot의 손절을 장기 논지로 무효화하면 안 된다.

---

## 5.6 Portfolio Engine

Portfolio Engine은 모든 Engine의 추천을 실제 포트폴리오 제약 안에 배치한다.

### 주요 책임

- Long-term / Momentum 목표 비중 관리
- Bucket별 현금 관리
- 종목별 최대 비중 관리
- 산업별 최대 비중 관리
- 동일 종목 중복 노출 계산
- 신규 자금 배분
- 리밸런싱 제안
- 위험 예산 계산
- 주문 가능 금액 산출
- 추천 우선순위 조정

### 기본 Bucket 구조

```text
Total Portfolio
├── Long-term Bucket: 80~90%
│   ├── Core
│   ├── Future Core
│   └── Long-term Cash
├── Momentum Bucket: 10~20%
│   ├── Open Positions
│   └── Momentum Cash
└── Common Reserve Cash
```

### Portfolio Engine 입력

- Long-term 평가
- Momentum 평가
- Cross Signal
- 현재 보유
- 사용 가능 현금
- 사용자 위험 설정
- 종목·산업별 제한
- 최대 손실 한도
- 환율
- 세금·수수료 설정

### Portfolio Engine 출력

```ts
interface AllocationProposal {
  generatedAt: string;

  strategy: 'LONG_TERM' | 'MOMENTUM';
  companyId?: string;

  requestedAmount: number;
  approvedAmount: number;

  currentStrategyWeight: number;
  projectedStrategyWeight: number;

  currentCompanyWeight: number;
  projectedCompanyWeight: number;

  status:
    | 'APPROVED'
    | 'REDUCED'
    | 'WAIT'
    | 'REJECTED';

  reasons: string[];
  constraintsTriggered: string[];
}
```

### Portfolio Engine 권한

Portfolio Engine은 분석 Engine의 추천을 다음처럼 변경할 수 있다.

- 승인
- 금액 축소
- 대기
- 거부

예:

```text
Momentum Score: 96
하지만 Momentum Bucket 비중: 20%
→ 신규 진입 거부
```

---

## 5.7 Risk Engine

Risk Engine은 전체 시스템에서 가장 높은 거부 권한을 가진다.

### 주요 책임

- 포트폴리오 집중 위험
- 단일 종목 위험
- 산업 상관 위험
- 유동성 위험
- Gap Risk
- 이벤트 위험
- 부채·파산·희석 위험
- 환율 위험
- 데이터 불완전 위험
- 모델 불확실성
- 최대 손실 한도
- 일간·주간·월간 Drawdown 통제

### 결과

```ts
interface RiskDecision {
  evaluatedAt: string;
  proposalId: string;

  status:
    | 'APPROVE'
    | 'APPROVE_WITH_REDUCTION'
    | 'REQUIRE_MANUAL_REVIEW'
    | 'DENY';

  maxApprovedAmount?: number;
  riskFlags: string[];
  rationale: string;
}
```

### 우선순위

Risk Engine의 `DENY`는 다른 모든 추천보다 우선한다.

```text
Momentum Engine: ENTER
Portfolio Engine: APPROVED
Risk Engine: DENY
→ 최종 결과: 진입 금지
```

---

## 5.8 Decision Engine

Decision Engine은 최종 투자 제안을 구성한다.

### 주요 책임

- 분석 결과 통합
- 추천 근거 요약
- 사용자 승인 요청
- 승인·거부 기록
- 실제 주문 결과 기록
- 전략과 Lot 연결
- Review 일정 등록

### MVP 원칙

- 사용자의 명시적 승인 없이 주문 실행 금지
- 승인 후에도 실제 체결 결과를 별도로 기록
- 추천가와 체결가 차이를 기록
- 미체결·부분체결 상태 지원

---

## 5.9 Learning Engine

Learning Engine은 각 전략의 성과와 모델 오류를 검토한다.

### 내부 분리

```text
Learning Engine
├── Long-term Learning
├── Momentum Learning
├── Portfolio Learning
└── Risk Learning
```

### Long-term Learning

- 리뷰 주기: 분기·연간
- 평가 항목:
  - 투자 논지 정확성
  - 실적 예상과 실제 결과
  - 밸류에이션 판단
  - 승격·강등 타이밍
  - 기회비용

### Momentum Learning

- 리뷰 주기: 거래 종료 후 + 월간
- 평가 항목:
  - Hit Rate
  - Expectancy
  - 평균 손익비
  - 최대 불리한 움직임
  - 최대 유리한 움직임
  - Setup별 성과
  - 시장 Regime별 성과
  - 손절 준수율
  - Time Stop 유효성

### Portfolio Learning

- 장기·단기 비중이 적절했는가?
- 전략 간 자금 이동이 성과를 악화시켰는가?
- 현금 보유 판단은 적절했는가?
- 집중 위험이 실제 손실에 미친 영향은 무엇인가?

### 모델 변경 원칙

Learning Engine은 모델 변경을 제안할 수 있지만 직접 활성화하지 않는다.

```text
Learning Result
  ↓
Model Change Proposal
  ↓
Backtest / Historical Replay
  ↓
Human Review
  ↓
Approve New Version
```

---

## 5.10 Report Engine

Report Engine은 각 Engine의 결과를 사람이 읽을 수 있는 형태로 변환한다.

### 보고서 유형

- Daily Momentum Brief
- Weekly Investment OS Report
- Monthly Capital Allocation Report
- Quarterly Long-term Review
- Earnings Review
- Trade Review
- Model Evolution Report
- Annual Investment Review

### 출력 형식

- Markdown
- Web
- JSON
- PDF
- Notification Summary

### 원칙

보고서는 분석의 원본 데이터와 근거를 링크해야 한다.

---

## 5.11 Data Platform

Data Platform은 전체 시스템의 공통 기반이다.

### 구성

```text
Data Platform
├── Ingestion
├── Normalization
├── Validation
├── Source Registry
├── Snapshot Store
├── Feature Store
├── Document Store
├── Portfolio Ledger
└── Audit Log
```

### 주요 책임

- 외부 데이터 수집
- 티커·통화·시간대 정규화
- 데이터 기준일 기록
- 출처와 원문 연결
- 중복 제거
- 결측·이상치 표시
- Point-in-time Snapshot 보존
- 모델 입력 데이터 재현 가능성 확보
- 모든 변경 Audit

### 데이터 신뢰도

각 데이터에는 신뢰도를 표시한다.

```ts
type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
```

- HIGH: SEC, 기업 IR, 거래소
- MEDIUM: 신뢰도 높은 데이터 공급자
- LOW: 단일 언론 보도, 비공식 추정
- UNVERIFIED: 출처 미검증

---

## 6. 권한 및 우선순위

최종 의사결정 우선순위는 다음과 같다.

```text
1. Hard Safety Rules
2. Risk Engine
3. Portfolio Constraints
4. User Approval
5. Strategy Engine Recommendation
6. Cross Signal Interpretation
7. Report Presentation
```

### 예시

#### 상황 A

```text
Long-term: ACCUMULATE
Portfolio: 종목 비중 한도 초과
Risk: 집중 위험
```

결과:

```text
신규 매수 거부 또는 축소
```

#### 상황 B

```text
Momentum: ENTER
Portfolio: 예산 있음
Risk: 실적 발표 임박 + Gap Risk
```

결과:

```text
Manual Review 또는 거래 금지
```

#### 상황 C

```text
Long-term: BUY
Momentum: EXIT
```

결과:

- Long-term Lot은 별도 판단
- Momentum Lot은 청산
- 전체 기업 평가를 하나로 합치지 않음

---

## 7. 데이터 흐름

## 7.1 주간 Long-term 흐름

```text
Weekly Trigger
  ↓
Financial / News / Industry Data Update
  ↓
Long-term Evaluation
  ↓
Core / Future Core Ranking
  ↓
Thesis Change Detection
  ↓
Portfolio Implication
  ↓
Risk Validation
  ↓
Weekly Report
  ↓
Snapshot & Lesson Candidate 저장
```

## 7.2 일간 Momentum 흐름

```text
Daily Market Open Preparation
  ↓
Market Regime
  ↓
Universe Scan
  ↓
Sector Ranking
  ↓
Ticker Ranking
  ↓
Catalyst & Liquidity Validation
  ↓
Trade Plan
  ↓
Portfolio Capacity
  ↓
Risk Validation
  ↓
User Approval
  ↓
Execution Journal
```

## 7.3 거래 종료 후 흐름

```text
Position Closed
  ↓
Actual P&L
  ↓
Setup Result
  ↓
Rule Compliance Check
  ↓
Trade Review
  ↓
Learning Dataset
  ↓
Monthly Model Review
```

## 7.4 실적 발표 후 흐름

```text
Earnings Released
  ↓
Official Data Capture
  ↓
Expected vs Actual
  ↓
Long-term Thesis Update
  ↓
Momentum Gap / Trend Analysis
  ↓
Separate Long-term and Momentum Decisions
  ↓
Reports
```

---

## 8. 동일 기업의 다중 전략 처리

하나의 기업에 여러 전략 포지션이 존재할 수 있다.

### Position Lot

```ts
interface PositionLot {
  id: string;
  portfolioId: string;
  companyId: string;

  strategy:
    | 'CORE'
    | 'FUTURE_CORE'
    | 'MOMENTUM';

  openedAt: string;
  averagePrice: number;
  quantity: number;

  thesisId?: string;
  momentumSetupId?: string;

  exitPolicy:
    | 'THESIS_BREAK'
    | 'VALUATION'
    | 'STOP_LOSS'
    | 'TARGET'
    | 'TIME_STOP';

  status: 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED';
}
```

### 규칙

1. 각 Lot은 별도 원가와 목적을 가진다.
2. Momentum Lot 손절은 Long-term Lot에 영향을 주지 않을 수 있다.
3. Long-term Thesis 훼손은 Momentum 거래의 기술적 반등 가능성과 별개다.
4. UI에서 종목 총수량과 전략별 수량을 동시에 표시한다.
5. 전략별 실현손익을 분리한다.

---

## 9. 상태 모델

## 9.1 Long-term Candidate 상태

```text
Universe
  ↓
Watch
  ↓
Candidate
  ↓
Strong Candidate
  ↓
Future Core
  ↓
Core
```

어느 단계에서든 다음 상태로 이동 가능하다.

```text
Weakened
Removed
Archived
```

## 9.2 Momentum Setup 상태

```text
Detected
  ↓
Validated
  ↓
Planned
  ↓
Approved
  ↓
Entered
  ↓
Managing
  ↓
Closed
  ↓
Reviewed
```

대체 상태:

```text
Rejected
Expired
Invalidated
Cancelled
```

## 9.3 Model Version 상태

```text
Draft
  ↓
Testing
  ↓
Approved
  ↓
Active
  ↓
Deprecated
  ↓
Archived
```

---

## 10. 동기식·비동기식 처리

### 동기식이 적합한 작업

- 사용자 화면 요청
- 점수 조회
- 포트폴리오 비중 계산
- Risk Validation
- 최종 제안 조회
- 사용자 승인

### 비동기식이 적합한 작업

- 대량 시장 데이터 수집
- 뉴스 요약
- 실적 문서 분석
- Universe Scan
- 주간 리포트 생성
- 모델 성과 계산
- 백테스트
- 과거 Snapshot 재평가

### Job 상태

```ts
type JobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'PARTIAL'
  | 'CANCELLED';
```

---

## 11. 이벤트 기반 아키텍처

초기 MVP는 단순 Cron + DB 구조로 시작할 수 있다. 이후 이벤트 기반으로 확장한다.

### 주요 도메인 이벤트

```text
MarketDataUpdated
FinancialStatementPublished
NewsDetected
EarningsReleased
LongTermEvaluationCompleted
MomentumSignalDetected
PortfolioLimitExceeded
RiskAlertRaised
DecisionApproved
OrderExecuted
PositionClosed
ReviewCompleted
ModelVersionActivated
ReportGenerated
```

### 예시

```text
EarningsReleased
  ↓
Fundamental Agent
  ↓
LongTermEvaluationCompleted
  ↓
ThesisChanged
  ↓
PortfolioReviewRequired
  ↓
ReportGenerated
```

---

## 12. AI Agent와 Engine의 관계

Engine과 Agent는 같은 개념이 아니다.

- Engine: 도메인 규칙과 시스템 책임
- Agent: 특정 분석 작업을 수행하는 실행 주체

예:

```text
Long-term Engine
├── Fundamental Agent
├── Valuation Agent
├── Industry Agent
└── Thesis Agent
```

Momentum Engine:

```text
Momentum Engine
├── Market Regime Agent
├── Sector Agent
├── Scanner Agent
├── Catalyst Agent
└── Trade Plan Agent
```

### 원칙

1. Agent 결과는 구조화된 JSON Schema를 따른다.
2. Agent는 직접 DB 핵심 상태를 수정하지 않는다.
3. Orchestrator가 검증 후 저장한다.
4. 숫자 계산은 가능한 한 deterministic code로 수행한다.
5. LLM은 해석·요약·가설 생성에 사용한다.
6. 출처 없는 주장은 점수에 반영하지 않는다.

---

## 13. 저장소 및 패키지 구조

```text
investment-os/
├── apps/
│   ├── web/
│   └── worker/
├── packages/
│   ├── domain/
│   │   ├── long-term/
│   │   ├── momentum/
│   │   ├── portfolio/
│   │   ├── risk/
│   │   ├── learning/
│   │   └── reporting/
│   ├── scoring/
│   ├── agents/
│   ├── data-sources/
│   ├── db/
│   ├── schemas/
│   ├── shared/
│   └── ui/
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed/
├── docs/
└── tests/
    ├── unit/
    ├── integration/
    ├── replay/
    └── e2e/
```

### 경계 규칙

- `long-term` 패키지는 `momentum` 내부 구현을 import하지 않는다.
- `momentum` 패키지는 `long-term` 내부 구현을 import하지 않는다.
- 두 Engine의 결과는 공통 schema를 통해 Portfolio Engine으로 전달한다.
- Risk Engine은 모든 전략 결과를 읽을 수 있다.
- Report Engine은 읽기 전용으로 동작한다.
- UI는 도메인 계산을 직접 수행하지 않는다.

---

## 14. API 경계 초안

### Long-term

```text
POST /api/evaluations/long-term
GET  /api/companies/:ticker/long-term
GET  /api/rankings/core
GET  /api/rankings/future-core
POST /api/theses
POST /api/theses/:id/review
```

### Momentum

```text
POST /api/scans/momentum
GET  /api/signals/momentum
POST /api/trade-plans
POST /api/trade-plans/:id/approve
POST /api/trades/:id/close
```

### Portfolio

```text
GET  /api/portfolio
POST /api/allocations/propose
POST /api/allocations/:id/review
GET  /api/exposure
```

### Risk

```text
POST /api/risk/evaluate
GET  /api/risk/alerts
POST /api/risk/limits
```

### Learning

```text
POST /api/reviews/trade
POST /api/reviews/investment
GET  /api/lessons
POST /api/model-change-proposals
```

---

## 15. 장애 및 실패 처리

### 15.1 데이터 수집 실패

- 최신 데이터가 없으면 마지막 정상 Snapshot 사용 가능
- 단, 데이터 기준일을 명확히 표시
- 오래된 데이터로 신규 거래 추천 금지
- `staleData=true` 플래그 저장

### 15.2 일부 Agent 실패

- 전체 Job을 `PARTIAL`로 표시
- 실패한 분석 항목을 명시
- 핵심 Risk Agent 실패 시 최종 추천 생성 금지
- 대체 모델 사용 여부 기록

### 15.3 LLM 비정상 출력

- JSON Schema 검증
- 허용 범위 검증
- 숫자 합계 검증
- 출처 ID 검증
- 실패 시 재시도
- 반복 실패 시 수동 검토

### 15.4 시세 급변

- 분석 이후 가격 변동 임계치 초과 시 추천 무효화
- Momentum Entry Zone 벗어나면 재평가
- Long-term 추천은 가격 매력도만 재계산 가능

### 15.5 사용자 입력 오류

- 주문 금액·수량 검증
- 전략 Bucket 확인
- 중복 포지션 경고
- 손절가 없는 Momentum 기록 금지

---

## 16. 보안 및 감사

### 필수 감사 로그

- 모델 버전 변경
- 점수 수동 수정
- 포트폴리오 한도 변경
- Risk Override
- 사용자 승인
- 거래 기록 수정
- 보고서 재생성
- 데이터 소스 변경

### 원칙

- API Key는 서버 환경에만 저장
- 사용자별 Row Level Security
- 보고서와 투자 기록은 비공개 기본값
- 민감한 자산 정보는 최소 수집
- 자동 주문 기능 도입 시 권한 분리
- Risk Override에는 사유 필수

---

## 17. 관찰 가능성

### 로그

- Job 실행
- Agent 입력·출력
- API 오류
- 데이터 품질 경고
- Risk 거부
- 모델 버전
- 리포트 생성

### 메트릭

- 데이터 수집 성공률
- Agent 성공률
- 평균 분석 시간
- Signal 생성 수
- Risk 거부율
- 사용자 승인율
- 추천 후 실행률
- 장기·Momentum 성과
- 모델 버전별 성과

### 알림

- 데이터 수집 실패
- Risk Limit 초과
- Portfolio Bucket 초과
- Thesis Break
- Stop Loss 도달
- 모델 비정상 출력
- Job 반복 실패

---

## 18. 테스트 전략

### Unit Test

- 점수 계산
- Bucket 계산
- Position Sizing
- Risk Limit
- 상태 전이
- 전략별 Lot 손익

### Integration Test

- Data → Engine → Portfolio → Risk
- Earnings Event → Thesis Update
- Momentum Scan → Trade Plan
- Trade Close → Learning Record

### Historical Replay

과거 시점 데이터만 사용해 당시 추천을 재현한다.

중요:

- 미래 데이터 누출 금지
- 수정된 재무 데이터 사용 여부 기록
- 모델 버전 고정
- 당시 Universe 재현

### E2E

- 기업 등록
- 분석 실행
- 추천 확인
- 사용자 승인
- 거래 기록
- 포지션 종료
- 회고 생성

---

## 19. MVP 아키텍처

MVP에서는 모든 기능을 한 번에 구현하지 않는다.

### MVP 구성

```text
Next.js Web
    ↓
Supabase
    ↓
Manual / Scheduled Analysis Jobs
    ↓
Long-term + Momentum Evaluation
    ↓
Portfolio / Risk Rules
    ↓
Markdown Reports
```

### MVP에 포함

- 기업·산업 관리
- Long-term Score
- Future Core Score
- Momentum Score
- 전략별 포지션 Lot
- Portfolio Bucket
- Risk Limits
- Decision Journal
- Weekly / Monthly Reports
- Model Version

### MVP 제외

- 자동 주문
- 초단위 시세
- 고빈도 거래
- 완전 자동 모델 변경
- 복잡한 ML 예측
- 다중 브로커 연동
- 옵션 주문

---

## 20. 확장 아키텍처

향후 다음 Engine을 추가할 수 있다.

```text
Investment OS
├── Long-term Engine
├── Momentum Engine
├── Dividend Engine
├── ETF Allocation Engine
├── Options Overlay Engine
├── Macro Engine
└── Tax Optimization Engine
```

새로운 Engine은 다음 공통 인터페이스를 구현해야 한다.

```ts
interface StrategyEvaluation {
  strategy: string;
  assetId: string;
  evaluatedAt: string;
  modelVersionId: string;

  score: number;
  action: string;
  confidence: number;

  rationale: string[];
  risks: string[];
  evidenceIds: string[];
}
```

Portfolio Engine과 Risk Engine은 공통 인터페이스만 알면 된다.

---

## 21. 아키텍처 결정 기록

### ADR-001: 하나의 프로젝트, 복수 Engine

**결정**

Long-term과 Momentum을 별도 프로젝트로 분리하지 않고 하나의 Investment OS 안에서 독립 Engine으로 운영한다.

**이유**

- 동일 포트폴리오 자금을 관리해야 한다.
- 동일 기업의 장기·단기 신호를 함께 볼 수 있다.
- Risk와 Portfolio 규칙을 공통 적용할 수 있다.
- 데이터 수집과 기업 Master를 공유할 수 있다.

**대가**

- 도메인 경계 관리가 중요하다.
- 전략 규칙 혼합을 막는 테스트가 필요하다.

### ADR-002: 전략별 Position Lot 분리

**결정**

같은 기업을 여러 전략에서 보유할 경우 Lot을 분리한다.

**이유**

- Exit Rule이 다르다.
- 성과 평가가 다르다.
- 단기 손실의 장기 전환을 방지한다.

### ADR-003: Risk Engine의 거부권

**결정**

Risk Engine은 모든 Strategy 및 Portfolio 추천을 거부할 수 있다.

**이유**

- 자동화 오류로 인한 대규모 손실 방지
- 집중·유동성·이벤트 위험 통제

### ADR-004: Human-in-the-loop

**결정**

MVP에서는 모든 실제 투자 실행에 사용자 승인을 요구한다.

**이유**

- 모델 검증 전 자동 주문 위험
- 데이터 오류와 LLM 오류 방지
- 투자 책임과 통제 유지

### ADR-005: 모델 버전 고정

**결정**

각 평가·추천·거래에 사용된 모델 버전을 저장한다.

**이유**

- 결과 재현
- 성과 비교
- 모델 변경 영향 분석

---

## 22. 미결정 사항

다음 내용은 후속 문서에서 확정한다.

### `02_Investment_Philosophy.md`

- Long-term / Momentum 목표 비중의 정확한 범위
- 자금 이동 허용 조건
- 손실 한도
- 현금의 정의
- 사용자 승인 원칙

### `03_LongTerm_Engine.md`

- Core Score 공식
- Future Core Score 공식
- 승격·강등 임계치
- 산업별 평가 차이

### `04_Momentum_Engine.md`

- Momentum Score 공식
- 거래 Universe
- 보유 기간
- Setup 종류
- Stop / Target 규칙

### `05_Portfolio_Engine.md`

- 최대 종목 비중
- 최대 산업 비중
- Position Sizing
- Drawdown Limit
- 동일 종목 중복 노출 계산

### `08_Database.md`

- 실제 ERD
- 테이블과 Index
- RLS
- Snapshot 저장 전략

---

## 23. 완료 기준

이 Architecture 문서는 다음 조건을 만족할 때 기준 문서로 승인한다.

- Long-term과 Momentum의 책임이 분리되어 있다.
- Portfolio와 Risk의 권한이 명확하다.
- 동일 종목 다중 전략 처리 규칙이 있다.
- 데이터 흐름과 상태 전이가 정의되어 있다.
- Agent와 Engine의 차이가 설명되어 있다.
- MVP와 확장 범위가 구분되어 있다.
- 장애·감사·테스트 원칙이 포함되어 있다.
- 후속 문서가 참조할 공통 용어가 확정되어 있다.

---

## 24. 다음 문서

Architecture 승인 후 다음 순서로 상세화한다.

1. `02_Investment_Philosophy.md`
2. `05_Portfolio_Engine.md`
3. `03_LongTerm_Engine.md`
4. `04_Momentum_Engine.md`
5. `09_Scoring_System.md`
6. `06_Learning_Engine.md`
7. `08_Database.md`
8. `07_AI_Agents.md`
9. `10_Report_System.md`
10. `11_UI_UX.md`
11. `12_Roadmap.md`
12. `13_Codex_Implementation.md`

Architecture의 변경이 필요한 경우, 하위 문서를 먼저 수정하지 않고 이 문서의 버전을 먼저 올린다.
