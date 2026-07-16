# Decision Engine

Decision Engine은 자연어 확신이 아니라 명시적 조건으로 진입 후보를 만든다.

## 예시 조건

```ts
const canEnter =
  thesisScore >= 8.5 &&
  evidenceQuality >= 0.8 &&
  uncertaintyScore <= 0.35 &&
  priceReflection !== 'overpriced' &&
  expectedValueAfterCosts > 0 &&
  riskDecision.approved;
```

## 기대값

```text
목표1 확률 × 목표1 수익
+ 목표2 확률 × 목표2 수익
- 손절 확률 × 손절 손실
- 수수료
- 예상 슬리피지
```

초기 Phase에서는 ML 확률 대신 보수적인 고정 가정과 규칙을 사용한다.
데이터가 쌓인 후 모델 예측으로 대체한다.
