# Product Spec V3 플레이테스트 부록

원본 `PRODUCT_SPEC_V3.md`는 변경 이력을 보존하기 위해 그대로 유지한다. 원본 16절 예시의 `BEST LAP 00:34.291` 표기는 현재 제품 규칙과 충돌하므로 다음과 같이 해석하고 구현한다.

```text
Lap 1  00:35.481
Lap 2  00:34.812
Lap 3  00:34.291

RACE FINISH TIME  01:44.584
```

Weekly Leaderboard에는 개별 Lap이 아니라 지정된 모든 Lap을 완료한 전체 `Race Finish Time`만 제출한다. 현재 로컬 플레이테스트 트랙은 `requiredLapCount = 1`이므로 한 바퀴 전체 시간이 기록되며, 이후 Lap 수가 늘어나도 동일한 합산 규칙을 사용한다.
