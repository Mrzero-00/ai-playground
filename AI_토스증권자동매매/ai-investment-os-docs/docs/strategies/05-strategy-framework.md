# Strategy Framework

전략은 아키텍처와 분리해 버전 관리한다.

## Core

- 기간: 수개월~수년
- 가설 손절 중심
- 여러 날 분할 진입
- 사업 품질, 밸류에이션, 기회비용 평가

## Momentum

- 기간: 수일~수개월
- 실적 상향, 상대강도, 업종 순환
- 가격·시간·가설 손절 혼합

## Event

- 기간: 수분~3거래일
- FDA, 합병, 역합병, 스핀오프, 계약, 저유통주
- 가격과 시간 손절 필수
- 높은 갭, 낮은 유동성, 희석 위험을 강하게 감점

## 전략 버전

```text
strategy_type
version
status: draft | challenger | champion | retired
parameters
created_at
promoted_at
evaluation_summary
```

운영 중 Champion 전략은 자동으로 변경되지 않는다.
