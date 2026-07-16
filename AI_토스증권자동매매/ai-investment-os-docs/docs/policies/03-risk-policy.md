# Risk Policy

Risk Gate는 LLM과 분리된 결정론적 코드다.

## 초기 Paper Policy

```ts
export const riskPolicy = {
  maxRiskPerTradePercent: 0.25,
  maxDailyLossPercent: 1,
  maxWeeklyLossPercent: 3,
  maxOpenPositions: 3,
  maxStrategyExposurePercent: 10,
  minDollarVolume: 5_000_000,
  maxSpreadPercent: 2,
  maxConsecutiveLosses: 3,
  cooldownMinutesAfterLoss: 60,
  leverageAllowed: false,
} as const;
```

## 자동 거부 조건

- 공식 또는 1차 출처 없음
- 핵심 데이터가 오래됨
- 시세 데이터 지연
- 스프레드 한도 초과
- 거래대금 부족
- 일간/주간 손실 한도 초과
- 연속 손실 한도 초과
- 주문·DB·브로커 상태 불일치
- 거래정지
- 상장폐지 위험 급증
- 계약이 비구속적인데 확정 계약처럼 평가됨
- 대규모 희석 위험 미해결
- Research Committee 불확실성 한도 초과

## 손절 분류

### 가격 손절
진입 구조와 시장 미시구조가 깨졌을 때.

### 시간 손절
예상된 시간 안에 모멘텀이 발생하지 않을 때.

### 가설 손절
계약 취소, 가이던스 하향, 희석 등 투자 논리가 무너졌을 때.

## 우선순위

Risk Gate와 다른 시스템이 충돌하면 Risk Gate가 항상 이긴다.
