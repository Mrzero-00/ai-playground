# 냥BTI

30개의 일상 행동 문항으로 고양이의 6개 연속 성향을 계산하고, 이를 4축 냥BTI와 16개 결과 유형으로 보여주는 모바일 우선 MVP입니다. 집사의 사람 MBTI를 생활 상호작용 프로필로 변환해 고양이의 실제 Trait과 비교하는 재미용 궁합도 함께 제공합니다.

## 현재 상태

실행 가능한 Next.js 정적 웹 앱으로 구현되어 있습니다.

- Next.js App Router + TypeScript + SCSS
- Zustand `persist` 기반 프로필·응답·현재 문항 저장
- 시작 → 프로필 → 30문항 → 결과 라우트
- 6 Trait 정규화와 4축 냥BTI 변환
- 16개 유형별 이름·설명·주의점·관찰 신호·관리 팁
- 16개 사람 MBTI Interaction Profile과 생활 궁합
- Behavior Check와 비진단 안내
- Web Share API·클립보드 공유 fallback
- App in Toss 광고/WebView adapter 경계와 개발 placeholder
- 정적 내보내기(`output: "export"`)로 `out/` 생성
- Vitest 단위 테스트

## 실행 방법

Node.js 22와 pnpm 10을 권장합니다.

```bash
cd /Users/sonsang-il/Desktop/ai/냥BTI
pnpm install --frozen-lockfile
pnpm dev
```

브라우저에서 터미널에 표시된 로컬 주소를 엽니다. 기본값은 `http://localhost:3000`입니다.

## 검증

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build`가 성공하면 정적 배포 결과가 `out/`에 생성됩니다. App in Toss 연동 전 브라우저 MVP는 `pnpm dev`로 확인하는 것이 가장 간단합니다.

## 화면 흐름

| 경로 | 역할 |
| --- | --- |
| `/` | 서비스 소개, 새 테스트, 이어하기 |
| `/profile` | 이름, 생년월일, 품종, 성별, 중성화 여부, 집사 MBTI 입력 |
| `/questions` | 최근 4주 행동을 기준으로 30개 문항 응답 |
| `/result` | 캐릭터 Hero, 냥BTI, 4축, 6 Trait, 궁합, 관리, Behavior Check, 공유 |

직접 URL로 진입했을 때 필요한 저장 상태가 없으면 앞 단계로 돌려보냅니다. 프로필과 설문 상태는 현재 기기의 `localStorage`에만 저장됩니다.

## 계산 모델

문항은 `sociability`, `boldness`, `activity`, `playfulness`, `adaptability`, `sensitivity` 여섯 Trait을 유지합니다. 응답을 중앙값 기준으로 변환한 뒤 문항별 가중치를 적용하고 각 Trait의 이론적 최소·최대 범위로 0~100 정규화합니다.

4축은 결과 표현을 위한 엔터테인먼트 레이어입니다.

```text
E = sociability
N = boldness × 0.45 + adaptability × 0.35 + (100 - sensitivity) × 0.20
F = sociability × 0.50 + sensitivity × 0.30 + (100 - boldness) × 0.20
P = playfulness × 0.55 + activity × 0.30 + adaptability × 0.15
```

상세한 문항·가중치·정규화 규칙은 [`docs/nyangbti-question-scoring-dataset-v0.1.md`](docs/nyangbti-question-scoring-dataset-v0.1.md), 집사 궁합은 [`docs/guardian-mbti-compatibility-design.md`](docs/guardian-mbti-compatibility-design.md)를 참고하세요.

## 원본 자료 상태

이전 대화에서 생성된 네 개의 Markdown 첨부 본문과 16개 캐릭터 PNG 원본은 현재 파일 시스템에서 복구되지 않았습니다. `docs/`의 문서는 대화에서 확인된 기획 내용과 현재 실행 코드를 기준으로 만든 **재구성 작업본**입니다.

- 복구된 30개 문항 주제와 16개 유형명은 반영했습니다.
- 전체 원본 선택지·가중치가 없으므로 현재 스코어링은 내부적으로 일관된 MVP용 재구성 모델입니다.
- 현재 캐릭터 Hero는 텍스트를 포함하지 않는 CSS 캐릭터 fallback입니다.
- 원본 문서나 캐릭터 이미지가 확보되면 데이터·asset map을 대조해 교체해야 합니다.

이 모델은 수의행동학적 진단 도구나 사람 MBTI의 과학적 궁합 검사가 아닙니다.

## 문서

- [`docs/nyangbti-service-plan.md`](docs/nyangbti-service-plan.md) — 서비스 기획 복원판
- [`docs/nyangbti-development-guide.md`](docs/nyangbti-development-guide.md) — 구조와 개발 가이드
- [`docs/nyangbti-veterinary-questionnaire-reference.md`](docs/nyangbti-veterinary-questionnaire-reference.md) — 관찰·문항·Behavior Check 참고
- [`docs/nyangbti-question-scoring-dataset-v0.1.md`](docs/nyangbti-question-scoring-dataset-v0.1.md) — 현재 30문항과 스코어링
- [`docs/guardian-mbti-compatibility-design.md`](docs/guardian-mbti-compatibility-design.md) — 집사 궁합 설계
- [`docs/app-in-toss-checklist.md`](docs/app-in-toss-checklist.md) — 출시 전 공식 요구사항 체크리스트

## 구현하지 않은 항목

- 원본 16개 냥BTI 캐릭터 PNG 연결
- App in Toss SDK·Granite 설정과 `.ait` 번들 생성
- 토스 네이티브 내비게이션, `closeView()`, `backEvent`, `SafeAreaInsets` 실제 연결
- Toss Ads 실제 테스트/운영 ID 및 SDK 연결
- QR 테스트, 실제 기기 WebView QA, 심사·출시
- 수의행동 전문가 검토와 대규모 응답 분포 기반 튜닝

## App in Toss 연동 전 필수 확인

공식 [App in Toss 운영/테스트 가이드](https://developers-apps-in-toss.toss.im/guide/operation/toss)와 [`docs/app-in-toss-checklist.md`](docs/app-in-toss-checklist.md)를 실제 SDK 설치 직전과 검토 요청 직전에 다시 확인해야 합니다. SDK major, 패키지명, 최소 토스 앱 버전, QR 테스트 Origin, 광고 API와 심사 정책은 현재 문서의 값을 영구 고정값으로 사용하지 않습니다.

현재 코드는 SSR 없이 정적 내보내기되며, 광고와 WebView 기능은 UI에서 직접 SDK를 호출하지 않도록 adapter로 분리되어 있습니다.
