# 00. Investment OS Vision

> 장기 복리와 제한된 전술 투자를 하나의 포트폴리오에서 안전하게 운영하고, 모든 판단을 재현 가능한 기록과 학습으로 연결하는 개인 투자 의사결정 운영체계

- 문서 버전: `v1.0.0`
- 명세 상태: `VISION BASELINE`
- 구현 준비도: `R1 FOUNDATION IMPLEMENTED / R2+ OPEN`
- 작성일: `2026-07-22`
- 최종 검토일: `2026-07-23`
- 문서 소유자: Product / Investment Governance
- 하위 문서: `01_Architecture.md`~`13_Codex_Implementation.md`

---

## 1. 존재 이유

Investment OS는 종목 추천 앱이 아니다. 투자 판단의 근거, 위험, 승인, 실행 결과와 회고를 같은 계보에서 관리하는 의사결정 시스템이다.

시스템은 다음 문제를 해결한다.

1. 장기투자와 단기 거래의 목적·평가·자금·청산 규칙이 섞이는 문제
2. 높은 점수나 강한 문장이 위험 한도와 사용자 승인을 우회하는 문제
3. 당시 알 수 없었던 정보로 과거 판단을 미화하는 문제
4. 좋은 결과를 좋은 과정으로, 나쁜 결과를 나쁜 과정으로 오해하는 문제
5. 데이터·모델·정책이 바뀌었을 때 과거 판단을 재현하지 못하는 문제

## 2. 목표 사용자와 핵심 결과

주 사용자는 자신의 투자 원칙을 명시적으로 운영하고 장기간 개선하려는 개인 투자자다. Reviewer와 Operator는 모델·데이터·운영 품질을 검토하지만 사용자의 투자 판단을 대신하지 않는다.

Investment OS가 제공해야 하는 핵심 결과는 다음과 같다.

- 장기 Core와 Future Core 후보의 독립 평가
- 제한된 위험 예산 안에서의 Momentum 기회 평가
- Portfolio와 Risk를 통과한 자본 배분 제안
- 근거·반대 근거·불확실성이 포함된 검토 보고서
- 명시적인 사용자 승인 또는 거부 기록
- 전략 Lot별 성과 귀속과 과정·결과 분리 회고
- 검증과 승인을 거친 Model·Policy의 통제된 진화

## 3. 제품 원칙

### 3.1 전략별 진실을 분리한다

Long-term과 Momentum은 동일 기업을 다르게 평가할 수 있다. Score, 상태, Evidence, Lot과 Exit Policy를 전략별로 유지하고 Portfolio에서만 총노출과 자본을 결합한다.

### 3.2 점수와 행동을 분리한다

Score는 기업 또는 Setup의 특성을 요약할 뿐 주문 명령이 아니다. 실제 행동은 Portfolio Capacity, Risk Decision, 데이터 신선도, Proposal 만료와 사용자 승인을 모두 통과해야 한다.

### 3.3 현금과 무행동을 정상 결과로 본다

`HOLD_CASH`, `NO_ACTION`, `WAIT_FOR_DATA`는 실패가 아니다. 근거가 부족하거나 위험 대비 기대값이 낮으면 행동하지 않는 것이 유효한 결정이다.

### 3.4 과거를 덮어쓰지 않는다

평가, Thesis, Proposal, Decision, Report와 Model은 불변 Revision으로 보존한다. 모든 결과는 당시 Snapshot, Evidence, Model, Policy와 코드 버전으로 재현할 수 있어야 한다.

### 3.5 AI의 역할을 제한한다

AI Agent는 근거 수집·구조화·반대 논거·설명 초안을 지원한다. 점수 확정, Risk 완화, 사용자 승인, Model 활성화와 주문 실행 권한을 갖지 않는다.

## 4. 절대 안전 원칙

다음 항목은 일정, 수익 기대 또는 사용자 요청으로 완화할 수 없다.

1. Hard Safety 위반과 Risk `DENY`는 Override하지 않는다.
2. 사용자의 명시적 승인 없이 투자 행동을 실행하지 않는다.
3. MVP와 현재 R1 범위에서는 자동 주문을 제공하지 않는다.
4. Long-term과 Momentum의 Score·Lot·Exit Policy를 합치지 않는다.
5. 필수 데이터가 누락·오래됨·충돌 상태면 신규 위험을 Fail-closed한다.
6. 금액·가격·수량 계산에 부동소수점 수를 사용하지 않는다.
7. Agent 출력이나 보고서 문장을 검증된 Domain Fact로 자동 승격하지 않는다.
8. 모델과 정책은 Historical Replay, Walk-forward, Shadow와 Human Approval 없이 활성화하지 않는다.

## 5. 비목표

Investment OS는 다음을 약속하거나 수행하지 않는다.

- 특정 수익률 또는 시장 대비 초과수익 보장
- 근거 없는 종목 추천과 매매 타이밍 단정
- 무인 자동매매와 Risk Override
- Long-term과 Momentum을 하나의 종합 점수로 합성
- 결과만 보고 과거 의사결정을 재작성
- 검증되지 않은 AI 문장을 투자 사실로 사용
- R1 코드 존재를 Production Ready로 표현

## 6. 성공 기준

제품 성공은 단기 수익률 하나로 판단하지 않는다.

| 영역 | 성공 기준 |
|---|---|
| 안전 | 승인 우회·Risk DENY 우회·자동 주문 0건 |
| 재현성 | 같은 입력·버전으로 같은 결과 Hash 재생성 |
| 설명 가능성 | 모든 행동 제안에 근거·반대 근거·위험·기준시각 표시 |
| 전략 격리 | Long-term·Momentum Score와 Lot 혼합 0건 |
| 데이터 품질 | Unknown·Stale·Conflict를 정상값이나 0점으로 처리하지 않음 |
| 학습 품질 | 단일 사례 자동 일반화와 승인 없는 Model 활성화 0건 |
| 운영 준비 | R0~R6 Gate와 외부 증거로 단계별 준비도 판정 |

## 7. 현재 범위와 진화 방향

현재 Repository는 Synthetic/Fixture 기반 R1 Foundation을 구현했다. 이는 도메인 계약, API·Schema 골격과 자동 테스트가 존재한다는 뜻이며 실데이터 운용 또는 Production Ready를 뜻하지 않는다.

다음 진화는 `12_Roadmap.md`와 `13_Codex_Implementation.md`의 Gate를 따른다.

```text
R1 Foundation
  -> Synthetic Walking Skeleton
  -> Preview Supabase / Auth / RLS
  -> Read-only Provider Shadow
  -> Shadow Validation
  -> Controlled User Pilot
  -> Production Readiness
```

## 8. 문서 체계

- `01_Architecture.md`: 시스템 경계와 안전 불변식
- `02_Investment_Philosophy.md`: 투자 정책과 판단 원칙
- `03`~`10`: Engine·Database·Scoring·Report 계약
- `11_UI_UX.md`: 안전한 검토 인터페이스
- `12_Roadmap.md`: 환경 승격과 Release Gate
- `13_Codex_Implementation.md`: 구현 증거와 열린 Gate

하위 문서는 이 Vision의 안전 원칙을 완화할 수 없다. Vision을 변경하려면 영향받는 Architecture, Philosophy, Roadmap과 구현 증거를 함께 검토한다.
