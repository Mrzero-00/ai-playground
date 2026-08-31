# 냥BTI 개발 가이드

이 문서는 현재 MVP 코드의 구조와 계산 경계를 설명하고, 이후 App in Toss 연동 시 지켜야 할 구현 방향을 정리한다.

## 1. 기술 스택과 실행 모델

- Next.js App Router + TypeScript
- SCSS (`sass`)
- Zustand `persist`로 프로필·응답·현재 문항 저장
- Vitest로 점수 및 궁합 순수 함수 테스트
- 모바일 우선 단일 열 UI
- 정적 내보내기(SSG/CSR)

`next.config.ts`는 다음 원칙을 유지한다.

- `output: "export"`: App in Toss 비게임 출시 기준상 SSR을 사용하지 않는다.
- `images.unoptimized: true`: 정적 내보내기에서 별도 이미지 최적화 서버에 의존하지 않는다.
- 서버 액션, Route Handler, 동적 서버 렌더링, 요청 시점 쿠키·헤더 의존 기능을 추가하지 않는다.
- 동적 경로를 추가한다면 빌드 시 모든 경로를 확정하거나 `generateStaticParams`를 제공한다.

개발 중에는 `pnpm dev`를 사용한다. `pnpm build` 후 정적 결과는 `out/`에 생성되며, `next start`가 아니라 정적 파일 서버 또는 App in Toss 빌드 과정으로 확인한다.

## 2. 화면과 라우트

| 경로 | 역할 | 진입 조건 |
| --- | --- | --- |
| `/` | 서비스 소개, 이어하기, 초기화 | 없음 |
| `/profile` | 고양이 정보와 집사 MBTI 입력 | 없음 |
| `/questions` | 30개 행동 문항 진행 | 저장된 고양이 이름 필요 |
| `/result` | 냥BTI, 6 Trait, 집사 궁합, 관리 안내, 공유 | 프로필과 30개 응답 필요 |

각 화면은 클라이언트 컴포넌트로 동작한다. Zustand 저장소가 복원되기 전 잘못된 리다이렉트나 화면 깜빡임이 생기지 않도록 `useStoreHydration`과 `HydrationScreen`을 거친다.

현재 `AppHeader`는 일반 브라우저용 자체 헤더다. App in Toss SDK를 붙이면 네이티브 비게임 내비게이션과 중복되지 않도록 다음 중 하나로 정리한다.

1. 토스 런타임에서는 자체 뒤로가기 UI를 숨기고 네이티브 내비게이션을 사용한다.
2. 일반 브라우저에서만 `AppHeader`를 유지한다.

## 3. 상태와 저장 경계

`store/useNyangBtiStore.ts`의 영속 상태는 다음 세 값만 포함한다.

- `profile`: 이름, 생년월일, 품종, 성별, 중성화 여부, 집사 MBTI
- `answers`: 문항 ID별 0~4 응답
- `questionIndex`: 현재 문항 위치

저장 키는 `nyangbti-survey-v1`, 스키마 버전은 `1`이다. `hasHydrated`는 런타임 상태이며 저장하지 않는다.

변경 시 원칙:

- 저장 구조가 바뀌면 persist 버전을 올리고 마이그레이션을 작성한다.
- 생년월일 등 프로필은 결과 문구 보조 정보이며 현재 Trait 점수에는 사용하지 않는다.
- 건강 정보, 로그인 토큰, 결제 정보 등 민감 정보는 `localStorage`에 넣지 않는다.
- 결과 자체를 저장할 필요는 없다. 같은 입력으로 언제든 결정적으로 다시 계산한다.

## 4. 문항과 Trait 점수

문항 데이터의 단일 소스는 `data/questions.ts`다. 30문항은 아래 6개 연속 Trait을 계산한다.

- `sociability`
- `boldness`
- `activity`
- `playfulness`
- `adaptability`
- `sensitivity`

응답은 0~4이며 중앙값은 2다. `lib/scoring.ts`의 Trait 계산 순서는 다음과 같다.

1. 각 응답을 `answer - 2`로 -2~2 범위에 중심화한다.
2. 문항별 Trait 가중치를 곱해 원점수에 합산한다.
3. 각 Trait의 이론적 최소·최대값을 `±2 × abs(weight)`로 누적한다.
4. `(raw - min) / (max - min) × 100`으로 0~100 정규화한다.
5. 0~100으로 제한하고 소수 첫째 자리까지 반올림한다.

누락 응답은 계산 함수 내부에서 중립값 2로 처리하지만, 결과 화면은 30문항 완료 전 접근을 차단한다. 계산 함수의 안전장치와 제품 진입 조건을 혼동하지 않는다.

Trait 표시 단계는 다음과 같다.

- 40 미만: 낮음
- 40 이상 65 미만: 중간
- 65 이상: 높음

## 5. 4축과 냥BTI 코드

6 Trait을 그대로 보존하면서 결과용 4축을 파생한다.

```text
E = sociability
N = boldness × 0.45 + adaptability × 0.35 + (100 - sensitivity) × 0.20
F = sociability × 0.50 + sensitivity × 0.30 + (100 - boldness) × 0.20
P = playfulness × 0.55 + activity × 0.30 + adaptability × 0.15
```

각 값이 50 이상이면 앞 글자(E/N/F/P), 50 미만이면 반대 글자(I/S/T/J)를 선택한다. 경향 강도는 `50 + abs(axisScore - 50)`이며 다음 단계로 표시한다.

- 75 이상: 높음
- 61 이상 75 미만: 중간
- 61 미만: 낮음

최종 코드는 `EI + NS + TF + JP` 순서다. 유형명·설명·주의점·관찰 신호·관리 문구는 `data/type-content.ts`에서 코드별로 가져온다. 4글자 유형은 설명용 레이어이고, 추천 관리와 궁합의 기반 데이터는 6개 연속 Trait이다.

## 6. 집사 MBTI 생활 궁합

`data/human-mbti.ts`는 사람 MBTI 16개를 다음 5개 생활 상호작용 값으로 변환한다.

- 교감 정도(`interaction`)
- 놀이 자극(`stimulation`)
- 생활 규칙성(`routine`)
- 독립 시간(`independence`)
- 변화 대응(`adaptability`)

`lib/compatibility.ts`는 고양이의 6 Trait을 같은 5개 요구 프로필로 변환한 뒤 가중 절대거리를 계산한다. 점수는 결정적이며 45~97 범위로 제한한다. 가장 가까운 차원은 잘 맞는 점, 가장 먼 차원은 조정 팁을 만드는 데 사용한다.

궁합은 엔터테인먼트 콘텐츠다. 다음 원칙을 유지한다.

- 과학적 궁합, 심리검사, 수의학적 진단으로 표현하지 않는다.
- `잘 모르겠어요`를 선택해도 냥BTI 결과를 볼 수 있다.
- 같은 냥BTI 코드라도 6 Trait 값이 다르면 궁합 결과가 달라질 수 있다.
- 점수를 건강·입양·치료·행동 교정 의사결정에 사용하지 않는다.

## 7. 결과 화면 경계

결과 화면은 다음 순서로 구성한다.

1. 캐릭터 Hero와 HTML 텍스트 기반 코드·유형명
2. 네 가지 냥BTI 축
3. 여섯 가지 실제 Trait
4. 성향 특징
5. 집사 생활 궁합 또는 MBTI 모름 안내
6. 광고 슬롯
7. 조심할 부분과 관찰 신호
8. 놀이·환경·생활·관계 관리 팁
9. Behavior Check
10. 공유와 재시작

캐릭터 이미지는 배경이 투명한 캐릭터 자산으로만 사용한다. 유형명, 점수, 설명, 고지 문구는 이미지에 넣지 않고 HTML로 렌더링해 접근성과 수정 가능성을 유지한다.

Behavior Check는 냥BTI 점수와 분리한다. 사용자가 최근 변화 신호를 선택하면 기록과 전문가 상담을 권하되 질병명을 추정하거나 진단하지 않는다.

## 8. 광고와 WebView 어댑터

외부 SDK를 UI와 계산 코드에 직접 섞지 않는다.

### 광고

- `adapters/ads/types.ts`: 배치와 adapter 계약
- `adapters/ads/placeholder.ts`: 일반 브라우저용 무동작 구현
- `components/AdSlot.tsx`: 마운트와 정리 수명주기

실제 연동 때 `TossAdsAdapter`를 추가하고 런타임·앱 버전·`isSupported()` 결과에 따라 선택한다. 개발 placeholder는 실제 광고처럼 보이거나 클릭을 유도하면 안 되며, 운영 빌드의 미지원 환경에서는 빈 레이아웃을 남기지 않고 슬롯을 숨긴다.

### WebView

`adapters/webview.ts`는 닫기와 뒤로가기 구독 경계다. 현재 브라우저 구현은 `window.history.back()`만 사용한다. 실제 SDK 연동 시 다음을 이 adapter 안에 둔다.

- `closeView()`
- `graniteEvent`의 `backEvent` 구독과 해제
- 첫 화면에서는 종료, 내부 화면에서는 라우터 뒤로가기
- Safe Area 최초 조회와 변경 구독
- 토스 런타임 여부 및 지원 버전 판별

## 9. 검증 흐름

로컬 검증은 아래 순서로 실행한다.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

자동 테스트의 최소 보장 범위:

- 모든 중립 응답에서 6 Trait이 50
- Trait이 항상 0~100
- 최종 코드와 각 축의 선택 글자가 일치
- 16개 집사 MBTI 궁합 결과가 결정적이며 45~97

추가해야 할 테스트:

- 각 Trait의 정방향·역방향 문항 단조성
- 정확히 50, 61, 75점인 축 단계 경계
- 부분 저장 후 새로고침과 hydrate
- 프로필·문항·결과 직접 URL 접근 가드
- 공유 API 성공·취소·미지원 fallback
- 광고 adapter 마운트 실패와 cleanup
- 토스 뒤로가기: 중간 문항, 첫 문항, 결과, 딥링크 진입
- Dynamic Island와 하단 홈 인디케이터 Safe Area

## 10. 구현 TODO

- [x] 의존성을 `latest`가 아닌 검증된 버전으로 고정하고 lockfile을 생성한다.
- [ ] 원본 v0.1 문항·가중치 문서와 `data/questions.ts`를 항목별로 대조한다.
- [ ] 16개 캐릭터 이미지가 확보되면 코드별 asset map을 추가하고 용량·대체 텍스트를 검수한다.
- [ ] 실제 기기에서 날짜 입력, 키보드, 스크롤, 고정 CTA, 320px 폭을 점검한다.
- [ ] App in Toss 최신 SDK와 CLI를 도입하고 `.ait` 번들 빌드를 구성한다.
- [ ] `granite.config.ts`에 콘솔과 동일한 앱 ID·국문명·로고·브랜드 색·비게임 내비게이션을 설정한다.
- [ ] 토스 런타임에서 자체 `AppHeader` 뒤로가기를 숨겨 네이티브 내비게이션과 중복되지 않게 한다.
- [ ] `SafeAreaInsets.get()`/`subscribe()` 결과를 CSS 변수에 연결한다.
- [ ] `TossAdsAdapter`를 구현하되 테스트 ID와 실제 ID를 환경별로 분리한다.
- [ ] 토스 공유 링크 SDK 적용 여부를 결정하고 현재 Web Share/클립보드 fallback을 유지한다.
- [ ] App in Toss QR 테스트, CORS, 딥링크, 뒤로가기, 광고 복귀를 실제 토스 앱에서 검증한다.
- [ ] 출시 직전에 `app-in-toss-checklist.md`의 공식 링크와 최소 버전을 다시 확인한다.
