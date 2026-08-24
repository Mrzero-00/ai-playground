# 냥BTI 집사 MBTI 생활 궁합 설계

> **문서 상태: 재구성된 v0.1 작업본 (reconstructed working edition)**
> 최초 대화에서 생성된 canonical 궁합 설계 첨부파일을 현재 작업 환경에서 찾을 수 없어, 이 문서는 현재 실행 코드인 `data/human-mbti.ts`, `lib/compatibility.ts`, `types/nyangbti.ts`를 기준으로 역문서화했다. 원본이 복구되기 전까지 구현·QA 기준으로 사용할 수 있으나 최초 기획과 동일하다고 단정하면 안 된다.

## 1. 목적과 고지

집사의 사람 MBTI를 고양이의 4글자 냥BTI와 단순 테이블로 짝짓지 않는다. 집사 MBTI를 다섯 가지 생활 상호작용 프로필로 변환하고, 고양이의 실제 6개 연속 Trait으로부터 계산한 생활 요구와 비교한다.

```text
집사 MBTI
  → 5개 Interaction Profile

고양이 6개 Trait
  → 5개 Interaction Need

두 프로필의 거리
  → 궁합 점수 + 잘 맞는 점 + 조정점 + 생활 팁
```

이 결과는 재미와 생활 대화를 위한 콘텐츠이며 과학적 궁합, 사람의 심리검사 해석, 수의학적 진단이 아니다. 현재 결과 화면에도 이 고지를 표시한다.

집사가 `모름`을 선택하면 궁합 계산 함수를 호출하지 않고 결과를 `null`로 처리한다. 냥BTI Trait과 4글자 결과에는 영향을 주지 않는다.

## 2. Interaction Profile 차원

| 차원 | 의미 | 결과 제목 라벨 |
|---|---|---|
| `interaction` | 집사가 선호하는 교감의 양과 거리 | 교감의 거리 |
| `stimulation` | 놀이 강도와 새로운 자극을 제공하는 경향 | 놀이 자극 |
| `routine` | 예측 가능한 생활 리듬을 유지하는 경향 | 생활 리듬 |
| `independence` | 고양이의 혼자 있는 시간과 선택권을 허용하는 경향 | 혼자만의 시간 |
| `adaptability` | 고양이의 속도에 맞춰 환경과 돌봄을 조정하는 경향 | 변화에 맞추는 속도 |

모든 값은 0~100 범위의 제품 내부 휴리스틱이다.

## 3. 사람 MBTI 16개 프로필

`HUMAN_MBTI_CODES`는 다음 16개를 제공한다.

```text
ISTJ, ISFJ, INFJ, INTJ,
ISTP, ISFP, INFP, INTP,
ESTP, ESFP, ENFP, ENTP,
ESTJ, ESFJ, ENFJ, ENTJ
```

실제 프로필 값:

| MBTI | interaction | stimulation | routine | independence | adaptability |
|---|---:|---:|---:|---:|---:|
| ENFP | 85 | 90 | 35 | 40 | 85 |
| ENFJ | 85 | 70 | 75 | 15 | 50 |
| ENTP | 75 | 90 | 30 | 55 | 85 |
| ENTJ | 75 | 70 | 70 | 30 | 50 |
| ESFP | 85 | 55 | 55 | 40 | 65 |
| ESFJ | 85 | 35 | 95 | 15 | 30 |
| ESTP | 75 | 55 | 50 | 55 | 65 |
| ESTJ | 75 | 35 | 90 | 30 | 30 |
| INFP | 30 | 75 | 40 | 85 | 75 |
| INFJ | 30 | 55 | 80 | 60 | 40 |
| INTP | 20 | 75 | 35 | 100 | 75 |
| INTJ | 20 | 55 | 75 | 75 | 40 |
| ISFP | 30 | 40 | 60 | 85 | 55 |
| ISFJ | 30 | 20 | 100 | 60 | 20 |
| ISTP | 20 | 40 | 55 | 100 | 55 |
| ISTJ | 20 | 20 | 95 | 75 | 20 |

현재 값은 공식 MBTI 심리 이론이나 검증된 심리척도가 아니라, 제품 내 생활 스타일 표현을 위한 고정 매핑이다.

## 4. 고양이 Trait → Interaction Need

입력 Trait은 모두 0~100이다.

```text
interaction = round(
  sociability × 0.75
  + playfulness × 0.25
)

stimulation = round(
  playfulness × 0.55
  + activity × 0.30
  + boldness × 0.15
)

routine = round(
  sensitivity × 0.55
  + (100 - adaptability) × 0.35
  + (100 - playfulness) × 0.10
)

independence = round(
  (100 - sociability) × 0.55
  + sensitivity × 0.25
  + (100 - playfulness) × 0.20
)

adaptability = round(
  sensitivity × 0.45
  + (100 - adaptability) × 0.35
  + (100 - boldness) × 0.20
)
```

각 차원은 가중치 합이 1인 convex combination이므로 입력 Trait이 0~100이면 결과도 0~100이다. `Math.round`는 다섯 차원 각각에 먼저 적용되고, 그 정수 값으로 사람 프로필과의 거리를 계산한다.

## 5. 궁합 점수 공식

각 차원의 절대 차이:

```text
difference[d] = abs(human[d] - cat[d])
```

차원 가중치:

| 차원 | 가중치 |
|---|---:|
| interaction | 0.25 |
| stimulation | 0.25 |
| routine | 0.20 |
| independence | 0.15 |
| adaptability | 0.15 |

```text
weightedDistance =
  interactionDifference × 0.25
  + stimulationDifference × 0.25
  + routineDifference × 0.20
  + independenceDifference × 0.15
  + adaptabilityDifference × 0.15

score = round(clamp(100 - weightedDistance × 0.55, 45, 97))
```

최저 45, 최고 97로 제한해 지나치게 부정적인 점수와 과학적으로 완벽해 보이는 100점을 피한다.

## 6. 설명 문구 선택 규칙

차원 평가 순서는 다음과 같다.

```text
interaction → stimulation → routine → independence → adaptability
```

- 절대 차이가 가장 작은 차원을 `best`로 선택한다.
- 절대 차이가 가장 큰 차원을 `needsCare`로 선택한다.
- 동률일 때 JavaScript의 stable sort와 위 선언 순서에 따라 앞 차원이 선택된다.
- 현재 구현은 차이의 방향, 즉 집사 값이 더 높은지 낮은지를 조정 문구에 반영하지 않는다.

### 6.1 제목

```text
{best 차원의 화면 라벨}이 잘 통하는 우리
```

예: `혼자만의 시간이 잘 통하는 우리`

### 6.2 잘 맞는 점

| best | 문구 |
|---|---|
| interaction | `{고양이 이름}가 편안해하는 교감의 거리와 집사님의 표현 방식이 잘 맞아요.` |
| stimulation | `놀이의 속도와 새로움을 즐기는 정도가 비슷해 함께 재미를 찾기 좋아요.` |
| routine | `서로 기대하는 하루의 리듬이 비슷해 안정적인 생활을 만들기 좋아요.` |
| independence | `함께하는 시간과 각자 쉬는 시간의 균형이 자연스럽게 맞아요.` |
| adaptability | `변화가 생겼을 때 서로의 속도를 존중하며 조정하기 좋은 조합이에요.` |

### 6.3 맞춰주면 좋은 점

| needsCare | 문구 |
|---|---|
| interaction | `{고양이 이름}가 먼저 다가올 때 교감하고, 물러나면 잠시 기다려 주세요.` |
| stimulation | `놀이 강도는 {고양이 이름}의 호흡과 꼬리 움직임을 보며 한 단계씩 맞춰주세요.` |
| routine | `집사의 일정이 달라지는 날에도 식사와 휴식의 기준점은 지켜주세요.` |
| independence | `애정 표현 사이에 방해받지 않는 혼자만의 회복 시간을 넣어주세요.` |
| adaptability | `새로운 물건과 경험은 기존 환경 옆에서 작게 시작해 주세요.` |

고양이 이름 인자의 기본값은 `고양이`다.

## 7. 함께 지내는 팁 우선순위

팁은 궁합 차원이 아니라 고양이 Trait의 임계값을 아래 순서대로 검사한다. 먼저 만족한 규칙 하나만 반환한다.

| 순서 | 조건 | 문구 |
|---:|---|---|
| 1 | `sensitivity >= 68` | 새로운 놀이나 생활 변화는 한 번에 바꾸기보다 익숙한 것에 하나씩 더해보세요. |
| 2 | `playfulness >= 68 OR activity >= 68` | 매일 짧은 사냥 놀이를 여러 번 하고, 마지막에는 잡는 성공 경험과 휴식을 연결해 주세요. |
| 3 | `sociability <= 38` | 같은 공간에 조용히 머무르는 것부터 시작하면 스킨십보다 편안한 신뢰가 먼저 쌓여요. |
| 4 | `adaptability <= 38` | 식사와 놀이의 시간을 일정하게 두고 변화가 필요한 날은 냄새와 물건부터 미리 익혀주세요. |
| 5 | 위 조건 없음 | 하루 한 번은 고양이가 놀이·휴식·교감 중 원하는 것을 직접 고르게 해주세요. |

예를 들어 민감성 70이면서 놀이성 80인 고양이는 첫 번째 민감성 팁만 받는다.

## 8. Golden example

다음 Trait fixture는 현재 자동 테스트에서도 사용한다.

```text
sociability  62
boldness     41
activity     38
playfulness  71
adaptability 44
sensitivity  73
```

고양이 Interaction Need:

```text
interaction  64
stimulation  57
routine      63
independence 45
adaptability 64
```

집사 ENFP 프로필 `85 / 90 / 35 / 40 / 85`와 비교하면:

- 절대 차이: `21 / 33 / 28 / 5 / 21`
- weighted distance: `23`
- 궁합 점수: `87`
- best: `independence`
- needsCare: `stimulation`
- 팁: `sensitivity >= 68` 규칙

## 9. 현재 구현 불변조건과 엣지 케이스

- `calculateCompatibility`는 유효한 16개 `HumanMbti`만 받는다. `unknown`과 빈 문자열은 결과 페이지에서 미리 걸러 `null` 처리한다.
- `HUMAN_MBTI_PROFILES`에는 16개 코드가 모두 있어야 한다.
- Trait이 0~100이라는 전제 아래 고양이 요구 값은 0~100이고 최종 점수는 45~97이다.
- 동일 MBTI와 동일 Trait 입력은 항상 동일 결과를 반환한다.
- 같은 4글자 냥BTI라도 6개 Trait이 다르면 궁합 점수와 문구가 달라질 수 있다.
- 가장 가까운 차원과 가장 먼 차원이 동률이면 배열 선언 순서가 결과 문구를 결정한다.
- 현재 조정 문구는 차이의 부호를 보지 않는다. 예를 들어 집사의 자극이 너무 높은 경우와 너무 낮은 경우에 같은 stimulation 문구가 나온다.
- 호흡, 꼬리, 숨기, 식욕 등 안내는 관찰 가이드이며 상태를 진단하지 않는다.
- 사람 MBTI 프로필 값 자체는 검증된 심리척도가 아니므로 분석 데이터나 의료·상담 판단에 재사용하지 않는다.

## 10. 현재 자동 테스트

`lib/compatibility.test.ts`는 현재 다음을 검증한다.

1. sample Trait에 대해 16개 사람 MBTI 모두 결과를 반환한다.
2. 같은 입력을 두 번 계산하면 결과 객체가 완전히 같다.
3. 모든 점수가 45 이상 97 이하이다.

추가 권장 테스트:

- `HUMAN_MBTI_CODES`와 `HUMAN_MBTI_PROFILES`의 키가 정확히 일치하는지 검증.
- 모든 프로필 차원이 유한 숫자이며 0~100인지 검증.
- Trait 경계값 0과 100에서 변환된 다섯 요구 값이 0~100인지 검증.
- Golden example의 요구 값, 87점, best/needsCare, 팁을 fixture로 고정.
- 동률일 때 차원 우선순위를 명시적으로 검증.
- `unknown`일 때 UI가 계산을 호출하지 않고 궁합 없음 상태를 렌더링하는지 검증.
- 동일 4글자 냥BTI지만 다른 연속 Trait 두 세트가 다른 궁합 결과를 만드는지 검증.
- 향후 차이 방향별 문구를 도입한다면 양수·음수 gap을 각각 검증.

## 11. Canonical 원본 복구 시 마이그레이션 TODO

원본 궁합 설계 문서가 복구되면 다음을 수행한다.

1. 16개 사람 프로필 값, 고양이 요구 변환식, 차원 가중치, clamp 범위, 문구 규칙을 현재 코드와 항목별 diff한다.
2. 원본과 현재 작업본 중 어느 쪽을 채택할지 제품 결정 기록을 남긴다. 원본을 확인했다는 이유만으로 운영 데이터를 조용히 재해석하지 않는다.
3. 공식적으로 `compatibilityVersion`을 도입하고 결과·공유 데이터에 버전을 함께 저장한다.
4. 프로필 또는 공식을 바꿀 경우 기존 공유 점수를 재계산할지, 구버전으로 유지할지 정책을 정한다.
5. 차이의 방향을 반영한 조정 문구, 점수 분포, MBTI별 평균·편향, 극단값을 QA한다.
6. 냥BTI 질문/스코어링 버전과 궁합 버전을 독립적으로 관리한다.
7. 코드, 테스트, 본 문서를 같은 변경에서 갱신하고 원본 확인 전까지 `canonical` 표기를 사용하지 않는다.
