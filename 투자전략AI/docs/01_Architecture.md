# 01. Investment OS Architecture

> Long-term Investing과 Momentum Investing을 하나의 포트폴리오 안에서 운영하되, 분석 논리·자금·위험·성과·학습을 분리하는 Investment OS의 기준 아키텍처

- 문서 버전: v2.3
- 명세 상태: `ARCHITECTURE BASELINE`
- 구현 준비도: `R1 FOUNDATION IMPLEMENTED / R2+ OPEN`
- 작성일: `2026-07-22`
- 최종 검토일: `2026-07-23`
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

**변경 이력**

| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v2.1 | 2026-07-22 | Long-term·Momentum 통합 운영 기준 아키텍처 수립 |
| v2.2 | 2026-07-22 | 안전 불변식, 시간·금액 계약, Decision 승인 경계, Point-in-time, Outbox, Fail Closed, 완료 정의 보강 |
| v2.3 | 2026-07-22 | 02 철학 정합성: Decision Action·Lot subtype·Manual Review 계보·Signed P&L·수정 승인 재검증 계약 추가 |

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

### 1.1 규범 수준

이 문서의 표현은 다음 의미로 사용한다.

- **반드시 / 금지**: 구현과 운영이 지켜야 하는 아키텍처 불변식
- **기본값**: 후속 정책 문서에서 변경할 수 있지만, 변경 전까지 적용하는 값
- **권장**: 합리적 이유와 ADR을 남기면 다른 구현을 선택할 수 있는 사항
- **예시**: 계약을 설명하기 위한 비규범적 자료

이 문서와 후속 문서가 충돌하면 이 문서를 우선한다. 단, 후속 문서의 결정으로 아키텍처를 변경하려면 이 문서의 버전과 관련 ADR을 먼저 갱신한다.

### 1.2 범위와 비범위

이 문서는 논리 컴포넌트, 책임, 권한, 데이터 흐름, 공통 계약과 안전 불변식을 정의한다. 다음 항목은 후속 문서에 위임한다.

- 점수 공식과 가중치
- 종목·산업·전략별 수치 한도
- 데이터 공급자 선정
- 화면 상세 설계
- 배포 일정과 운영 조직

따라서 이 문서의 **승인 완료**, 이 문서에 대한 **구조 구현 완료**, Investment OS의 **제품 개발 완료**는 서로 다른 상태다.

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
- Cash Reserve: Long-term·Momentum Bucket 내부 현금 또는 공통 Reserve로 관리

비중은 동일한 평가 시점과 동일한 분모인 `Total Investable Assets`를 사용하며 항상 합계가 100%여야 한다. Bucket 내부 현금은 해당 Bucket 비중에 포함한다. 공통 Reserve를 별도로 둘 경우 Long-term과 Momentum의 투자 가능 상한을 그만큼 낮춰 중복 계산을 방지한다.

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

### 2.7 아키텍처 불변식

아래 항목은 후속 문서가 변경할 수 없는 기본 안전 계약이다. 변경하려면 이 문서와 ADR을 먼저 개정한다.

| ID | 불변식 | 검증 방법 |
|---|---|---|
| INV-001 | Long-term과 Momentum은 서로의 내부 점수 로직을 호출하지 않는다. | 의존성·단위 테스트 |
| INV-002 | 점수나 Signal만으로 주문 또는 체결 기록을 생성하지 않는다. | Workflow 통합 테스트 |
| INV-003 | 모든 자금 변경 제안은 Portfolio와 Risk 검증을 순서대로 통과한다. | 통합·E2E 테스트 |
| INV-004 | Hard Safety 위반과 Risk `DENY`는 사용자도 승인할 수 없다. | 상태 전이 테스트 |
| INV-005 | MVP의 실행 기록은 사용자의 명시적 승인 이후에만 생성한다. | 감사 로그·E2E 테스트 |
| INV-006 | 동일 기업이라도 전략별 Position Lot과 Exit Policy를 분리한다. | DB 제약·단위 테스트 |
| INV-007 | 모든 평가·제안·결정은 모델 버전과 입력 Snapshot을 재현할 수 있어야 한다. | Replay 테스트 |
| INV-008 | 미래 시점 데이터를 과거 판단에 사용하지 않는다. | Point-in-time Replay 테스트 |
| INV-009 | 모델 변경은 검증과 사람의 승인을 거쳐야 활성화된다. | 상태 전이·DB 제약 테스트 |
| INV-010 | 보고서와 Agent는 원본 도메인 사실을 수정하지 않는다. | 권한·의존성 테스트 |

### 2.8 식별자와 시간 원칙

- 모든 영속 Aggregate와 Event는 전역적으로 유일한 ID를 가진다.
- 하나의 분석 실행은 `correlationId`, 재시도 가능한 명령은 `idempotencyKey`를 가진다.
- 시각은 저장 시 UTC ISO 8601 또는 `timestamptz`를 사용하고, UI에서 사용자 시간대로 변환한다.
- 외부 데이터는 최소한 `asOf`(데이터 기준 시점), `collectedAt`(수집 시점), `sourceId`를 가진다.
- 도메인 판단은 `evaluatedAt`, 사용자 행동은 `decidedAt`, 체결 사실은 `executedAt`으로 구분한다.
- 금액은 `amount`와 ISO 4217 `currency`를 함께 저장하며 부동소수점 금액 연산을 금지한다.

문서의 TypeScript 계약에서 금액·가격·수량은 다음 논리 타입을 사용한다. 실제 구현은 검증된 Decimal Library 또는 DB `numeric`으로 계산한다.

```ts
type DecimalString = string;
type SignedDecimalString = string; // P&L·FX Attribution처럼 음수가 가능한 값 전용
type CurrencyCode = string;
```

`DecimalString`은 금액·가격·수량처럼 음수가 될 수 없는 값에, `SignedDecimalString`은 손익과 Attribution처럼 음수가 가능한 값에 사용한다. 두 타입 모두 지수 표기와 부동소수점 연산을 금지한다.

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
                    │ Hard Rules + Veto   │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Decision Engine     │
                    │ Compose Proposal    │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ User Approval Gate  │
                    │ Approve / Reject    │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Manual Execution    │
                    │ Execution Record    │
                    └──────────┬──────────┘
                               ▼
                  ┌──────────────────────────┐
                  │ Journal / Report / Alert │
                  └────────────┬─────────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Learning Engine     │
                    │ Review / Versioning │
                    └─────────────────────┘
```

위 흐름에서 아래 방향은 허용 또는 다음 단계 진행을 의미한다. Risk `DENY`, 사용자 `REJECT`, 만료와 검증 실패는 종료 상태로 분기하며 Manual Execution에 도달하지 않는다.

---

## 5. Engine 정의

### 5.1 Long-term Investment System

Long-term System은 기업의 장기 가치 창출 가능성을 평가한다.

#### 구성

```text
Long-term Investment System
├── Core Engine
├── Future Core Engine
├── Fundamental Analysis Module
├── Valuation Module
├── Thesis Module
└── Long-term Review Module
```

#### 주요 책임

- 사업 퀄리티 평가
- 장기 시장 성장성 평가
- 경쟁우위와 생태계 평가
- 재무 건전성 평가
- 밸류에이션 평가
- 투자 논지 생성
- 논지 강화·약화·훼손 판정
- Core / Future Core 승격·강등
- 월간 추가 매수 후보 선정

#### 입력

- 기업 기본정보
- 실적 및 재무제표
- 경영진 가이던스
- 산업 데이터
- 경쟁사 데이터
- 현재 밸류에이션
- 기존 Thesis
- 기존 점수 이력
- 모델 버전

#### 출력

```ts
interface LongTermEvaluation {
  id: string;
  companyId: string;
  evaluatedAt: string;
  modelVersionId: string;
  snapshotIds: string[];

  coreScore?: number;
  futureCoreScore?: number;
  businessQualityScore: number;
  valuationScore: number;
  financialStrengthScore: number;
  growthDurabilityScore: number;
  riskScore: number;

  stage:
    | 'UNIVERSE'
    | 'WATCH'
    | 'CANDIDATE'
    | 'STRONG_CANDIDATE'
    | 'FUTURE_CORE'
    | 'CORE'
    | 'REMOVED';

  action:
    | 'ACCUMULATE'
    | 'BUY_ON_WEAKNESS'
    | 'HOLD'
    | 'WATCH'
    | 'REDUCE'
    | 'EXIT';

  thesisStatus: 'STRENGTHENED' | 'UNCHANGED' | 'WEAKENED' | 'BROKEN';
  thesisSummary: string;
  catalysts: string[];
  risks: string[];
  thesisBreakConditions: string[];
  evidenceIds: string[];
}
```

#### 금지 사항

Long-term System은 다음을 직접 결정하지 않는다.

- 단기 진입가
- 손절가
- 당일 거래량 기반 주문
- Momentum 예산
- 실제 매수 금액
- 주문 실행

---

### 5.2 Core Engine

Core Engine은 이미 상당 부분 검증된 고품질 기업을 평가한다.

#### 특징

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

#### 예시 대상

- 대형 플랫폼
- 검증된 AI 인프라 기업
- 독점적 제조 역량 보유 기업
- 높은 전환 비용과 반복 매출 보유 기업

---

### 5.3 Future Core Engine

Future Core Engine은 미래의 Core가 될 가능성이 있는 기업을 발굴한다.

#### 특징

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

#### 산업 범위

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

### 5.4 Momentum Engine

Momentum Engine은 짧은 기간 동안의 비대칭적 가격 움직임을 탐색한다.

#### 구성

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

#### 주요 책임

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

#### 입력

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

#### 출력

```ts
interface MomentumEvaluation {
  id: string;
  companyId: string;
  evaluatedAt: string;
  modelVersionId: string;
  snapshotIds: string[];

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
    min: DecimalString;
    max: DecimalString;
  };

  stopLoss?: DecimalString;
  target1?: DecimalString;
  target2?: DecimalString;
  maxHoldingDays?: number;

  invalidationConditions: string[];
  catalystSummary: string;
  evidenceIds: string[];
}
```

모든 점수는 `0~100` 범위이며 정확한 방향, 결측 처리, 정규화와 합성 방식은 `09_Scoring_System.md`에서 정의한다. `riskScore`처럼 이름만으로 높고 낮음의 의미가 혼동될 수 있는 값은 후속 문서에서 `higherIsRiskier` 같은 방향 Metadata를 Schema에 포함한다. 계산 불가능한 값을 임의의 중립 점수나 0으로 대체하지 않는다.

#### 금지 사항

Momentum Engine은 다음을 해서는 안 된다.

- 손절된 포지션을 장기 투자로 자동 전환
- Long-term Bucket에서 자금 차입
- 손실 복구를 위한 포지션 확대
- 유동성이 부족한 종목 추천
- 손절가 없는 진입 추천
- 실적·FDA·법원 판결 등 이벤트 위험을 무시
- 장기 기업 점수를 근거로 단기 손절 무효화

---

### 5.5 Cross Signal Engine

Cross Signal Engine은 Long-term과 Momentum 결과를 비교한다.

이 Engine은 새로운 원본 점수를 만들기보다 두 전략의 관계를 해석한다.

#### 시그널 매트릭스

| Long-term | Momentum | 분류 | 기본 해석 |
|---:|---:|---|---|
| 높음 | 높음 | Dual High Conviction | 장기 매수 시점과 단기 추세가 동시에 우호적 |
| 높음 | 낮음 | Long-term Opportunity | 장기 가치 우수, 단기 추세 불리 |
| 낮음 | 높음 | Tactical Only | 단기 거래만 허용, 장기 전환 금지 |
| 낮음 | 낮음 | Avoid | 신규 진입 우선순위 낮음 |

#### 출력 예시

```ts
interface CrossSignal {
  companyId: string;
  evaluatedAt: string;
  longTermEvaluationId: string;
  momentumEvaluationId: string;
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

Cross Signal은 원본 평가를 복사하거나 새 점수를 만들지 않는다. 두 평가의 ID와 모델 버전 조합이 같으면 같은 결과를 반환하는 결정적 해석 함수여야 한다. `높음/낮음` 임계값은 `09_Scoring_System.md`에서 버전 관리한다.

한쪽 Evaluation이 없거나 stale이면 누락 값을 0으로 대체하지 않으며 Cross Signal을 생성하지 않는다. Orchestrator는 생성 보류 사유를 Job 결과와 데이터 품질 경고로 기록한다.

#### 중요 원칙

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

### 5.6 Portfolio Engine

Portfolio Engine은 모든 Engine의 추천을 실제 포트폴리오 제약 안에 배치한다.

#### 주요 책임

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

#### 기본 Bucket 구조

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

#### Portfolio Engine 입력

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

#### Portfolio Engine 출력

```ts
interface AllocationProposal {
  id: string;
  portfolioId: string;
  generatedAt: string;
  expiresAt: string;

  strategy: 'LONG_TERM' | 'MOMENTUM';
  action: 'BUY' | 'ACCUMULATE' | 'ENTER';
  lotStrategy?: 'CORE' | 'FUTURE_CORE' | 'MOMENTUM';
  companyId?: string;

  requestedAmount: DecimalString;
  approvedAmount: DecimalString;
  currency: CurrencyCode;

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
  inputEvaluationIds: string[];
  snapshotIds: string[];
  policyVersionId: string;
}
```

`approvedAmount`는 Risk 승인 또는 사용자 승인을 의미하지 않는다. Portfolio 제약 안에서 검토 가능한 최대 금액일 뿐이며, `expiresAt` 이후에는 새 시세와 포트폴리오 상태로 다시 계산한다.

#### Portfolio Engine 권한

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

### 5.7 Risk Engine

Risk Engine은 전체 시스템에서 가장 높은 거부 권한을 가진다.

#### 주요 책임

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

#### Hard Safety와 Risk Policy

Hard Safety는 설정값이나 모델 판단이 아니라 실행 경계 자체를 보호하는 불변 규칙이다. MVP의 최소 Hard Safety는 다음과 같다.

- Risk 검증이 없거나 실패한 Proposal은 Decision 승인 대상으로 만들지 않는다.
- Risk `DENY`, 만료된 Proposal, 핵심 stale data가 있는 Proposal은 실행할 수 없다.
- Momentum `ENTER`는 유효한 Entry Zone, Stop Loss, 최대 보유 기간이 반드시 필요하다.
- 음수·0·비정상 금액, 통화 불일치, Portfolio 소유권 불일치 요청은 거부한다.
- Momentum Bucket이 Long-term Bucket 자금을 사용하거나 손실 포지션을 Long-term Lot으로 전환할 수 없다.
- MVP에서는 승인 여부와 무관하게 시스템이 Broker 주문을 자동 전송하지 않는다.

Risk Policy는 최대 비중, Drawdown 임계값처럼 후속 문서에서 수치와 버전을 변경할 수 있는 규칙이다. Hard Safety 변경은 일반 정책 변경으로 처리하지 않고 Architecture 개정과 별도 ADR을 요구한다.

#### 결과

```ts
interface RiskDecision {
  id: string;
  evaluatedAt: string;
  proposalId: string;
  riskPolicyVersionId: string;
  dataAsOf: string;

  status:
    | 'APPROVE'
    | 'APPROVE_WITH_REDUCTION'
    | 'REQUIRE_MANUAL_REVIEW'
    | 'DENY';

  maxApprovedAmount?: DecimalString;
  riskFlags: string[];
  rationale: string;
  supersedesRiskDecisionId?: string;
  reviewedBy?: string;
  manualReviewEvidenceIds?: string[];
}
```

#### 우선순위

Risk Engine의 `DENY`는 다른 모든 추천보다 우선한다.

```text
Momentum Engine: ENTER
Portfolio Engine: APPROVED
Risk Engine: DENY
→ 최종 결과: 진입 금지
```

MVP에서는 Hard Safety 위반과 Risk `DENY`를 Override할 수 없다. 운영자가 할 수 있는 조치는 입력 데이터 또는 정책 오류를 수정한 뒤 새 Proposal과 Risk Decision을 생성하는 것뿐이다. 감사 항목의 `Risk Override`는 향후 완화 가능한 경고 규칙이 도입될 경우를 위한 예약 개념이며, 도입 전 별도 ADR과 권한 분리가 필요하다.

---

### 5.8 Decision Engine

Decision Engine은 최종 투자 제안을 구성한다.

#### 주요 책임

- 분석 결과 통합
- 추천 근거 요약
- 사용자 승인 요청
- 승인·거부 기록
- 실제 주문 결과 기록
- 전략과 Lot 연결
- Review 일정 등록

#### MVP 원칙

- 사용자의 명시적 승인 없이 주문 실행 금지
- 승인 후에도 실제 체결 결과를 별도로 기록
- 추천가와 체결가 차이를 기록
- 미체결·부분체결 상태 지원

#### 결정 계약

```ts
interface DecisionProposal {
  id: string;
  allocationProposalId: string;
  riskDecisionId: string;
  action:
    | 'BUY'
    | 'ACCUMULATE'
    | 'ENTER'
    | 'HOLD'
    | 'WAIT'
    | 'REDUCE'
    | 'EXIT'
    | 'SKIP'
    | 'CASH';
  status:
    | 'PENDING_APPROVAL'
    | 'MANUAL_REVIEW'
    | 'BLOCKED'
    | 'APPROVED'
    | 'REJECTED'
    | 'EXPIRED';
  approvedAmount: DecimalString;
  currency: CurrencyCode;
  expiresAt: string;
  reasons: string[];
  modelVersionIds: string[];
  snapshotIds: string[];
  userDecision?: {
    userId: string;
    approved: boolean;
    decidedAt: string;
  };
}
```

사용자는 `PENDING_APPROVAL` 제안을 승인하거나 거부할 수 있지만 금액을 상향하거나 Risk 결과를 완화할 수 없다. 승인 시점에 Proposal 만료, 가격 변동, Portfolio 잔여 용량을 다시 확인한다. `BLOCKED`, `REJECTED`, `EXPIRED`는 실행 상태로 전이할 수 없다.

금액·Stop·전략 수정은 기존 Decision의 승인으로 처리하지 않는다. 수정 요청과 원본을 함께 저장한 뒤 새 Allocation Proposal과 Risk Decision을 생성한다. 전략 변경은 독립 Evaluation부터 새 Lifecycle을 시작한다. `REQUIRE_MANUAL_REVIEW` 역시 원 Risk Decision을 덮어쓰지 않고 계보를 가진 새 Risk Decision으로만 해소하며, Portfolio 승인 금액을 늘릴 수 없다.

---

### 5.9 Learning Engine

Learning Engine은 각 전략의 성과와 모델 오류를 검토한다.

#### 내부 분리

```text
Learning Engine
├── Long-term Learning
├── Momentum Learning
├── Portfolio Learning
└── Risk Learning
```

#### Long-term Learning

- 리뷰 주기: 분기·연간
- 평가 항목:
  - 투자 논지 정확성
  - 실적 예상과 실제 결과
  - 밸류에이션 판단
  - 승격·강등 타이밍
  - 기회비용

#### Momentum Learning

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

#### Portfolio Learning

- 장기·단기 비중이 적절했는가?
- 전략 간 자금 이동이 성과를 악화시켰는가?
- 현금 보유 판단은 적절했는가?
- 집중 위험이 실제 손실에 미친 영향은 무엇인가?

#### 모델 변경 원칙

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

### 5.10 Report Engine

Report Engine은 각 Engine의 결과를 사람이 읽을 수 있는 형태로 변환한다.

#### 보고서 유형

- Daily Momentum Brief
- Weekly Investment OS Report
- Monthly Capital Allocation Report
- Quarterly Long-term Review
- Earnings Review
- Trade Review
- Model Evolution Report
- Annual Investment Review

#### 출력 형식

- Markdown
- Web
- JSON
- PDF
- Notification Summary

#### 원칙

보고서는 분석의 원본 데이터와 근거를 링크해야 한다.

---

### 5.11 Data Platform

Data Platform은 전체 시스템의 공통 기반이다.

#### 구성

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

#### 주요 책임

- 외부 데이터 수집
- 티커·통화·시간대 정규화
- 데이터 기준일 기록
- 출처와 원문 연결
- 중복 제거
- 결측·이상치 표시
- Point-in-time Snapshot 보존
- 모델 입력 데이터 재현 가능성 확보
- 모든 변경 Audit

#### 데이터 신뢰도

각 데이터에는 신뢰도를 표시한다.

```ts
type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
```

- HIGH: SEC, 기업 IR, 거래소
- MEDIUM: 신뢰도 높은 데이터 공급자
- LOW: 단일 언론 보도, 비공식 추정
- UNVERIFIED: 출처 미검증

신뢰도는 최신성이나 완전성을 대신하지 않는다. 각 Snapshot은 다음 품질 차원을 별도로 가진다.

```ts
interface DataQuality {
  confidence: DataConfidence;
  staleData: boolean;
  complete: boolean;
  anomalyFlags: string[];
  asOf: string;
  collectedAt: string;
  sourceId: string;
  sourceUrl?: string;
}
```

- 공식 출처라도 오래된 데이터는 `staleData=true`일 수 있다.
- 결측값을 0으로 대체하지 않고 결측 상태를 보존한다.
- 정정 공시는 기존 Snapshot을 덮어쓰지 않고 새 버전으로 저장한다.
- Provider 원본, 정규화 결과, Feature 계산 결과의 계보를 추적할 수 있어야 한다.
- 동일 데이터의 공급자가 충돌하면 우선순위 규칙과 선택 근거를 기록한다.

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

상위 계층은 하위 계층의 결과를 제한하거나 거부할 수 있지만 완화할 수는 없다. 특히 사용자 승인은 Risk 또는 Portfolio 제한을 해제하는 권한이 아니라, 이미 허용된 범위 안에서 실행 의사를 표시하는 단계다. 사용자의 거부는 항상 최종적이다.

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
Long-term: ACCUMULATE
Momentum: EXIT
```

결과:

- Long-term Lot은 별도 판단
- Momentum Lot은 청산
- 전체 기업 평가를 하나로 합치지 않음

---

## 7. 데이터 흐름

### 7.1 주간 Long-term 흐름

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

### 7.2 일간 Momentum 흐름

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

### 7.3 거래 종료 후 흐름

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

### 7.4 실적 발표 후 흐름

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
  averagePrice: DecimalString;
  quantity: DecimalString;

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
2. Momentum Lot 손절은 그 자체로 Long-term Lot의 Thesis나 Exit Policy를 변경하지 않는다.
3. Long-term Thesis 훼손은 Momentum 거래의 기술적 반등 가능성과 별개지만, Portfolio와 Risk는 기업 전체 노출을 함께 계산한다.
4. UI에서 종목 총수량과 전략별 수량을 동시에 표시한다.
5. 전략별 실현손익을 분리한다.

---

## 9. 상태 모델

아래 Diagram은 사람이 읽기 쉬운 표시 이름을 사용한다. API·코드·DB의 영속 Enum은 `UPPER_SNAKE_CASE`를 기준으로 한다.

### 9.1 Long-term Candidate 상태

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

정상 승격은 한 단계씩 진행하며, 승격 근거와 평가 ID를 기록한다. 어느 활성 단계에서든 다음 예외 상태로 이동할 수 있다.

```text
Weakened
Removed
Archived
```

- `Weakened`는 재검토 후 이전의 적절한 활성 단계로 복귀하거나 `Removed`로 이동한다.
- `Removed`는 신규 매수 후보에서 제외된 상태이며 `Archived`로만 종료한다. 재편입은 기존 이력을 되살리지 않고 새 Candidate Lifecycle을 생성한다.
- `Archived`는 종결 상태이며 변경하지 않는다.
- 상태를 건너뛴 수동 승격은 금지한다.

### 9.2 Momentum Setup 상태

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

- `Rejected`, `Expired`, `Invalidated`, `Cancelled`, `Reviewed`는 종결 상태다.
- `Approved` 이전에는 체결 기록을 생성할 수 없다.
- `Entered` 이후에는 `Cancelled`로 되돌리지 않고 실제 체결 상태에 따라 `Managing` 또는 청산 흐름으로 진행한다.
- 같은 Setup을 재시도하면 기존 상태를 되돌리지 않고 새 Setup ID를 생성한다.

### 9.3 Model Version 상태

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

- 한 전략·환경에는 동시에 하나의 `Active` 버전만 존재한다.
- 평가가 시작되면 종료까지 동일한 Model Version을 고정한다.
- `Active`를 교체할 때 기존 버전은 하나의 트랜잭션에서 `Deprecated`로 전환한다.
- 과거 기록은 새 버전으로 소급 갱신하지 않는다.

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

모든 Job은 `id`, `type`, `correlationId`, `idempotencyKey`, `attempt`, `createdAt`을 가진다. `PARTIAL`과 `FAILED`는 실패 Component, 오류 코드, 재시도 가능 여부를 기록한다. 동일 `idempotencyKey`의 성공 Job이 있으면 부작용을 다시 실행하지 않는다.

---

## 11. 이벤트 기반 아키텍처

초기 MVP는 Cron + DB 구조로 시작하되, 상태 변경과 Event 발행의 불일치를 막기 위해 Transactional Outbox를 사용한다. 이후 별도 Message Broker로 확장하더라도 도메인 Event 계약은 유지한다.

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

각 Event는 `eventId`, `eventType`, `aggregateId`, `occurredAt`, `correlationId`, `schemaVersion`, `payload`를 가진다. Consumer는 최소 한 번 전달을 전제로 `eventId` 기준 멱등 처리한다. Event Schema의 파괴적 변경은 금지하며 새 `schemaVersion`을 추가한다.

```text
Domain State Change + Outbox Insert
            ↓ same transaction
Outbox Publisher
            ↓ at-least-once
Idempotent Consumer
            ↓
Processed Event Record
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
7. Agent 출력은 신뢰하지 않는 외부 입력으로 취급하고 Schema, 범위, 출처, 프롬프트 버전을 검증한다.
8. Agent 실패나 타임아웃은 deterministic Risk Rule을 우회하는 근거가 될 수 없다.
9. 동일 입력 재현을 위해 Provider·Model·Prompt Version과 입력 문서 ID를 기록한다.
10. Agent가 생성한 설명과 결정적 계산 결과가 충돌하면 계산 결과를 우선하고 충돌을 품질 경고로 기록한다.

---

## 13. 저장소 및 패키지 구조

아래 구조는 목표 물리 구조다. 초기에는 `packages/core`처럼 여러 논리 모듈을 한 패키지에 둘 수 있지만, 공개 Export와 의존성 규칙으로 동일한 경계를 유지해야 한다. 폴더 수 자체는 아키텍처 준수 조건이 아니다.

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
- `agents`와 `data-sources`는 Domain 패키지에 의존할 수 있지만 Domain은 이들 Adapter에 의존하지 않는다.
- DB Row와 외부 Provider 응답을 Domain 타입으로 직접 노출하지 않고 Mapper를 둔다.
- 패키지 경계는 정적 의존성 검사와 테스트로 검증한다.

---

## 14. API 경계 초안

모든 API는 다음 공통 규칙을 따른다.

- 공개 경로는 `/api/v1`처럼 버전을 명시한다. 아래 경로의 `/api`는 논리 경계 표기이며 구현 시 버전 Prefix를 붙인다.
- 인증된 사용자와 `portfolioId`의 소유권을 서버에서 검증한다.
- 쓰기 요청은 `Idempotency-Key`, 모든 요청은 `X-Correlation-Id`를 지원한다.
- 응답은 `requestId`, 결과의 `asOf`, 사용한 `modelVersionIds`를 포함한다.
- 오류는 안정적인 `code`, 사람이 읽을 `message`, 재시도 가능 여부 `retryable`을 구조화한다.
- 금액은 문자열 Decimal과 `currency`, 시간은 UTC ISO 8601로 교환한다.
- 목록 조회는 Cursor Pagination을 사용한다.
- 승인·정책 변경·수동 수정 API는 Audit Log를 같은 트랜잭션에서 기록한다.

```ts
interface ApiError {
  requestId: string;
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}
```

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
POST /api/trade-plans/:id/validate
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

### Decision / Execution

```text
POST /api/decisions
GET  /api/decisions/:id
POST /api/decisions/:id/approve
POST /api/decisions/:id/reject
POST /api/executions/manual
GET  /api/executions/:id
```

`approve`는 오직 Decision 경계에 존재하며 Portfolio와 Risk를 통과한 `PENDING_APPROVAL` 객체에만 허용한다. Momentum Trade Plan 검증은 사용자 실행 승인이 아니다.

### Learning

```text
POST /api/reviews/trade
POST /api/reviews/investment
GET  /api/lessons
POST /api/model-change-proposals
```

### Data / Operations / Reports

```text
POST /api/jobs
GET  /api/jobs/:id
GET  /api/events
GET  /api/snapshots/:id
GET  /api/reports
POST /api/reports/generate
GET  /api/model-versions
POST /api/model-versions/:id/transition
```

Model Version의 `APPROVED`와 `ACTIVE` 전이는 권한을 분리할 수 있어야 하며, 직접 상태 값을 덮어쓰는 API는 제공하지 않는다.

---

## 15. 장애 및 실패 처리

실패 처리는 기본적으로 Fail Closed를 따른다. 읽기 전용 조회는 마지막 정상 Snapshot을 기준 시점과 품질 경고와 함께 제공할 수 있지만, 신규 자금 위험을 늘리는 동작은 필수 데이터와 검증이 정상일 때만 허용한다.

| 실패 영역 | 읽기/보고 | 신규 제안 | 승인/실행 기록 |
|---|---|---|---|
| 비핵심 데이터 일부 누락 | 경고와 함께 허용 | 감액 또는 수동 검토 | 재검증 필요 |
| 핵심 시세·Portfolio 상태 stale | 마지막 정상값 표시 | 금지 | 금지 |
| Risk Engine 또는 핵심 Risk Agent 실패 | 실패 상태 표시 | 금지 | 금지 |
| LLM 설명 생성 실패 | 구조화 결과만 표시 가능 | 결정적 계산이 완전할 때만 허용 | 기존 Risk 절차 유지 |
| DB Transaction 실패 | 이전 확정 상태 표시 | 저장 실패 처리 | 재시도 전 중복 확인 |

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

### 15.6 재시도와 복구

- 재시도는 지수 Backoff와 최대 횟수를 가지며 영구 오류를 무한 재시도하지 않는다.
- 외부 호출 성공 후 내부 저장 실패에 대비해 외부 응답 ID와 Idempotency Key를 보존한다.
- 부분 성공을 전체 성공으로 표시하지 않는다.
- 운영자가 재처리할 때 원본 입력, 모델 버전, 재처리 사유를 기록한다.
- Dead Letter 상태의 Job/Event는 자동 폐기하지 않고 수동 검토 대상으로 보존한다.

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
- Supabase Service Role Key와 외부 Provider Secret은 서버·Worker에서만 사용하며 로그와 Agent Prompt에 포함하지 않는다.
- RLS만 신뢰하지 않고 Service 계층에서도 Portfolio 소유권과 역할을 검증한다.
- Audit Log는 Append-only로 취급하며 수정·삭제는 운영 API에서 제공하지 않는다.
- 원본 재무 자료와 투자 기록의 보존·삭제 정책은 `08_Database.md`에서 정의한다.
- Prompt Injection 가능성이 있는 뉴스·공시 본문은 명령이 아닌 데이터로 격리한다.
- 로그와 오류 응답에 API Key, 계좌 식별자, 전체 자산 정보를 기록하지 않는다.

`Risk Override`는 5.7에서 설명한 향후 예약 개념이다. MVP에서는 Risk `DENY` Override API를 제공하지 않는다.

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

모든 구조화 로그는 `timestamp`, `level`, `service`, `requestId` 또는 `correlationId`, `event`, `outcome`을 포함한다. 민감정보는 수집 단계에서 제거한다.

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
- INV-001~INV-010 불변식
- Decimal 금액과 시간대 변환
- 멱등성 및 상태 전이 Guard

### Integration Test

- Data → Engine → Portfolio → Risk
- Earnings Event → Thesis Update
- Momentum Scan → Trade Plan
- Trade Close → Learning Record
- State Change → Outbox → Event Consumer
- User Approval → Audit Log
- Model Activation → 이전 Active Version 폐기
- RLS 사용자·Portfolio 격리

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

MVP 포함은 각 기능의 완전 자동화를 의미하지 않는다. 외부 데이터가 연결되지 않은 개발 환경에서는 Contract, 상태 전이, 저장 Schema, In-memory Adapter와 테스트로 구조 준수를 검증할 수 있다. 실제 운영 준비 완료는 Provider 연결, Migration 적용, 인증/RLS 및 E2E 검증까지 끝난 상태를 의미한다.

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
  id: string;
  schemaVersion: string;
  strategy: string;
  assetId: string;
  evaluatedAt: string;
  modelVersionId: string;
  snapshotIds: string[];

  score: number;
  action: string;
  confidence: number;

  rationale: string[];
  risks: string[];
  evidenceIds: string[];
}
```

Portfolio Engine과 Risk Engine은 공통 Envelope만 알며, 전략별 상세 Payload는 해당 Strategy Schema가 소유한다. 새 Engine은 INV-001~INV-010, Position Lot 분리, Portfolio/Risk/Decision 순서를 동일하게 지켜야 한다.

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

### ADR-006: Point-in-time 데이터와 재현성

**결정**

평가에 사용한 Snapshot ID, 데이터 기준 시점과 Model Version을 고정하고 과거 데이터를 덮어쓰지 않는다.

**이유**

- 미래 데이터 누출 방지
- 당시 판단 재현
- 데이터 정정과 모델 변경 영향 분리

### ADR-007: Transactional Outbox

**결정**

도메인 상태 변경과 Event 발행 요청을 같은 DB Transaction에 기록하고 Consumer는 멱등 처리한다.

**이유**

- DB 저장 성공·Event 발행 실패 간 불일치 방지
- 재시도와 장애 복구 단순화
- 향후 Message Broker 전환 시 계약 유지

### ADR-008: Fail Closed 투자 실행 경계

**결정**

핵심 데이터, Portfolio 상태 또는 Risk 검증이 불완전하면 신규 위험을 늘리는 제안과 실행을 차단한다.

**이유**

- 오래된 데이터와 부분 장애가 승인으로 오인되는 문제 방지
- 자동화 실패 시 장기 자산 보호
- 운영 결과의 설명 가능성 확보

---

## 22. 하위 문서 소유권과 확정 위치

아래 항목은 Architecture가 경계를 소유하고, 세부 정책·공식·Schema는 지정된 하위 문서가 소유한다. 모든 하위 문서는 현재 존재하며 구현 준비도와 열린 운영 Gate는 `13_Codex_Implementation.md`에서 추적한다.

### `02_Investment_Philosophy.md`

- Long-term / Momentum 목표 비중의 기준값과 변경 철학
- 자금 이동 허용 조건
- 손실 한도
- 현금의 정의
- 기회비용과 투자하지 않을 조건
- Human-in-the-loop 불변식 안에서 승인 만료·재확인 원칙

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

### `06_Learning_Engine.md`

- 전략별 성과 귀속과 Review 주기
- Lesson과 Model Change Proposal의 승인 기준
- 표본 부족·과최적화 방지 규칙

### `07_AI_Agents.md`

- Agent별 입력·출력 Schema와 도구 권한
- Timeout, 재시도, Fallback과 Prompt Version
- 비신뢰 문서 격리와 출처 검증

### `10_Report_System.md`

- 보고서별 독자, 생성 주기와 필수 근거
- 재생성·정정·버전 보존 정책

### `11_UI_UX.md`

- 사용자 승인·거부·만료·수동 검토 흐름
- 전략별 Lot과 통합 노출의 동시 표현
- 위험·데이터 품질 경고 우선순위

### `12_Roadmap.md` / `13_Codex_Implementation.md`

- 단계별 기능·운영 완료 기준
- Architecture 불변식과 테스트의 추적표
- 환경별 Adapter와 배포 절차

---

## 23. 문서 승인 및 구현 준수 기준

### 23.1 문서 승인 기준

이 Architecture 문서는 다음 조건을 만족할 때 기준 문서로 승인한다.

- Long-term과 Momentum의 책임이 분리되어 있다.
- Portfolio와 Risk의 권한이 명확하다.
- 동일 종목 다중 전략 처리 규칙이 있다.
- 데이터 흐름과 상태 전이가 정의되어 있다.
- Agent와 Engine의 차이가 설명되어 있다.
- MVP와 확장 범위가 구분되어 있다.
- 장애·감사·테스트 원칙이 포함되어 있다.
- 후속 문서가 참조할 공통 용어가 확정되어 있다.

### 23.2 구조 구현 완료 기준

`01_Architecture.md 기반 구현 완료`는 전체 제품 기능의 완성을 뜻하지 않는다. 다음 조건을 만족해 후속 Engine을 안전하게 추가할 수 있는 상태를 뜻한다.

- INV-001~INV-010을 Domain Contract와 자동 테스트로 검증한다.
- Evaluation → Portfolio → Risk → Decision의 단방향 흐름이 존재한다.
- Risk `DENY`와 사용자 승인 상태를 우회할 수 없다.
- Position Lot, Model Version, Job, Event, Snapshot, Audit의 상태와 저장 계약이 존재한다.
- DB Migration 또는 동등한 저장 Schema에 핵심 제약과 사용자 격리가 정의되어 있다.
- 외부 Provider와 영속 저장소를 교체 가능한 Adapter 경계로 분리한다.
- 타입 검사, Unit Test, 핵심 Workflow Integration Test와 Build가 통과한다.

### 23.3 제품·운영 완료 기준

전체 Investment OS의 제품 또는 운영 완료는 이 문서만으로 판정하지 않는다. `02~13` 상세 문서의 승인 기준, 실제 Provider 연결, 배포 환경, 보안/RLS, Replay와 E2E 검증이 모두 필요하다.

---

## 24. 공통 용어

| 용어 | 기준 정의 |
|---|---|
| Evaluation | 특정 Model Version과 Snapshot을 사용한 전략별 분석 결과 |
| Signal | Evaluation에서 파생된 관찰 또는 행동 후보이며 주문 명령이 아님 |
| Cross Signal | 독립된 Long-term·Momentum Evaluation의 관계 해석 |
| Allocation Proposal | Portfolio 제약 안에서 검토 가능한 금액 제안 |
| Risk Decision | Proposal에 대한 승인·감액·수동 검토·거부 판정 |
| Decision Proposal | Risk 결과까지 반영되어 사용자 결정을 기다리는 객체 |
| Execution Record | 사용자 승인 이후 수동 실행·미체결·부분체결·체결 사실을 기록한 객체 |
| Position Lot | 하나의 전략 목적과 Exit Policy를 공유하는 포지션 단위 |
| Snapshot | 출처와 기준 시점이 고정된 불변 입력 데이터 |
| Model Version | 점수·정책·Prompt 등 판단 규칙의 재현 가능한 버전 |
| Thesis | Long-term 보유 근거와 훼손 조건을 가진 버전형 논지 |
| Setup | Momentum 진입·무효화·청산 조건을 가진 단기 거래 가설 |
| Bucket | 전략별 자본과 현금을 격리해 관리하는 회계상 구획 |
| Hard Safety Rule | 어떤 추천이나 사용자 승인으로도 완화할 수 없는 안전 규칙 |

코드·DB·API와 후속 문서는 위 용어를 같은 의미로 사용한다. 동의어가 필요하면 표현 계층에서만 사용하고 Domain Contract 이름은 유지한다.

---

## 25. 문서 의존성과 변경 순서

상세 문서는 다음 의존 순서로 관리한다. 이 목록은 앞으로 작성할 문서 목록이 아니라 변경 영향 분석과 검토 순서를 뜻한다.

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

Architecture의 변경이 필요한 경우 하위 문서를 먼저 수정하지 않고 이 문서의 버전과 관련 ADR을 먼저 갱신한다. 문서별 구현 상태와 다음 실행 단계는 `13_Codex_Implementation.md`를 기준으로 판단한다.
