# 02. Investment Philosophy — Chapter Index

> Long-term, Future Core, Momentum, Capital Allocation, Risk, Decision, Psychology, Learning을 하나의 일관된 정책 체계로 정의한다.

- 문서 버전: v2.2.1
- 작성일: 2026-07-22
- 최종 검토일: 2026-07-23
- 명세 상태: Draft for Review
- 구현 준비도: R1 Foundation Implemented / Policy Approval Open
- 상위 문서: [`../01_Architecture.md`](../01_Architecture.md)
- 통합본: [`../02_Investment_Philosophy.md`](../02_Investment_Philosophy.md)

## Canonical source policy

`docs/02_Investment_Philosophy.md`가 유일한 정본이다. 이 디렉터리의 5개 Part는 읽기 편의를 위한 동기화 사본이며 독립적으로 수정하지 않는다. 문서 품질 검증기는 제목 수준과 Part 사이 구분선을 정규화한 뒤 통합본과 각 Part가 정확히 같은지 검사한다.

## Parts

1. [Foundations, Objectives, and Governance](02-1_Foundations_Objectives_and_Governance.md)
2. [Long-term, Core, and Future Core](02-2_LongTerm_Core_and_FutureCore.md)
3. [Momentum and Tactical Investing](02-3_Momentum_and_Tactical_Investing.md)
4. [Capital Allocation, Portfolio, and Risk](02-4_Capital_Allocation_Portfolio_and_Risk.md)
5. [Decision Process, Psychology, Learning, and Templates](02-5_Decision_Process_Psychology_Learning_and_Templates.md)

## Core policy snapshot

- Long-term Bucket 기본 범위: 80~90%
- Momentum Bucket 기본 범위: 10~20%
- 동일 기업이라도 전략별 Position Lot을 분리한다.
- Momentum 손실 포지션을 Long-term으로 자동 전환하지 않는다.
- 평단과 손익은 기업 매력도 점수에 직접 반영하지 않는다.
- 기업 매력도와 실제 자금 배분은 별도의 Decision이다.
- 모든 추천은 Portfolio와 Risk 검증 및 사용자 승인을 거친다.
- 모델은 자동 학습한다고 가정하지 않고 Version과 Lesson으로 진화시킨다.

## Architecture compatibility

- `01_Architecture.md`가 상위 계약이다.
- Hard Safety와 Risk `DENY`는 MVP에서 Override할 수 없다.
- 수정 승인은 새 Proposal·Portfolio·Risk 재검증을 요구한다.
- 금액·가격·수량은 Decimal 문자열과 통화를 함께 저장한다.
