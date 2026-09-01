# 냥BTI

30개의 일상 행동 문항으로 고양이의 6개 연속 성향을 계산하고, 이를 4축 냥BTI와 16개 결과 유형으로 보여주는 모바일 우선 MVP입니다. 집사와 고양이의 생활 궁합, 여러 고양이끼리의 생활 궁합, 공유받은 고양이와 내 고양이의 궁합도 제공합니다.

## 현재 상태

브라우저에서 처음부터 끝까지 실행 가능한 Next.js 정적 웹 앱입니다.

- Next.js App Router + TypeScript + SCSS
- Zustand `persist` 기반 프로필·응답·현재 문항 저장과 문항/스코어 버전 migration
- 시작 → 프로필 → 30문항 → 스코어링 → 결과 흐름
- 6 Trait 정규화와 4축 냥BTI 변환
- 16개 유형별 카툰 캐릭터와 6개 연속 Trait 기반 동적 설명·주의점·관찰 신호·관리 팁
- 16개 사람 MBTI Interaction Profile과 연속 Trait 기반 생활 궁합
- 여러 고양이 프로필·검사 결과 관리와 고양이 간 생활 조화 리포트
- 엔터테인먼트·비진단·비합사판정 안내
- 앱인토스 공식 딥링크 결과 공유와 공유받은 고양이 궁합
- App in Toss Safe Area·공유·광고/WebView adapter
- 정적 내보내기(`output: "export"`)와 자동 검증 워크플로

캐릭터 이미지는 사용자가 제공한 스타일 참고 자료를 바탕으로 새로 만든 16종 손그림 카툰입니다. 이미지에는 결과 문구를 넣지 않았고, 모든 결과 텍스트는 HTML로 렌더링합니다.

## 실행 방법

Node.js 22와 pnpm 10을 권장합니다.

```bash
cd 냥BTI
pnpm install --frozen-lockfile
pnpm exec next dev -p 5173
```

터미널에 표시된 주소를 브라우저에서 엽니다. 이 프로젝트의 로컬 확인 주소는 `http://localhost:5173`을 사용합니다.

## 검증

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build`가 성공하면 App in Toss 번들 준비에 사용할 정적 결과가 `out/`에 생성됩니다.

## 화면 흐름

| 경로 | 역할 |
| --- | --- |
| `/` | 서비스 소개, 새 테스트, 이어하기 |
| `/profile` | 이름, 생년월일, 품종, 성별, 중성화 여부, 집사 MBTI 입력 |
| `/questions` | 최근 4주 행동을 기준으로 30개 문항 응답 |
| `/result` | 캐릭터 Hero, 냥BTI, 4축, 6 Trait, 집사·고양이 궁합, 관리, 공유 진입 |
| `/harmony` | 완료된 두 고양이의 생활 조화, 개별·공통 관리 팁 |
| `/share` | 링크 수신자용 공유 결과와 고양이 간 생활 궁합 진입 |

직접 URL로 진입했을 때 필요한 저장 상태가 없으면 앞 단계로 돌려보냅니다. 프로필과 설문 상태는 현재 기기의 `localStorage`에만 저장됩니다. 문항이나 계산식 버전이 달라지면 이전 답변은 자동 초기화하고 프로필만 유지합니다.

## 계산 모델

내부에는 `sociability`, `boldness`, `activity`, `playfulness`, `adaptability`, `sensitivity` 여섯 Trait을 연속값으로 유지합니다. 응답을 중앙값 기준으로 변환한 뒤 문항별 가중치를 적용하고, 각 Trait의 이론적 최소·최대 범위로 0~100 정규화합니다.

4축은 결과 표현을 위한 엔터테인먼트 레이어입니다.

```text
E = sociability
N = boldness × 0.45 + adaptability × 0.35 + (100 - sensitivity) × 0.20
F = sociability × 0.50 + sensitivity × 0.30 + (100 - boldness) × 0.20
P = playfulness × 0.55 + activity × 0.30 + adaptability × 0.15
```

상세 규칙은 [`docs/nyangbti-question-scoring-dataset-v0.1.md`](docs/nyangbti-question-scoring-dataset-v0.1.md), 집사 궁합은 [`docs/guardian-mbti-compatibility-design.md`](docs/guardian-mbti-compatibility-design.md)를 참고하세요.

고양이 MBTI 유형은 캐릭터를 위한 요약 레이어입니다. 결과 요약, 강점, 주의점, 관찰 신호와 관리 팁은 실제 6개 연속 점수에서 생성하며, 중립에 가까운 축이 많을 때는 한 유형을 강하게 단정하지 않고 균형형으로 표시합니다.

## 자료 상태와 주의사항

이전 대화에서 작성된 원본 Markdown 첨부 본문은 현재 파일 시스템에서 복구되지 않아 `docs/`에 실행 코드 기준 재구성 작업본을 정리했습니다. 현재 30문항과 가중치는 내부적으로 일관된 MVP용 재구성 모델이며, 실제 출시 전 수의행동 전문가 검토와 응답 분포 기반 보정이 필요합니다.

냥BTI와 집사 궁합은 수의행동학적 진단 도구나 사람 MBTI의 과학적 궁합 검사가 아닙니다. 결과 화면에도 같은 고지를 표시합니다.

## 문서

- [`docs/nyangbti-service-plan.md`](docs/nyangbti-service-plan.md) — 서비스 기획 복원판
- [`docs/nyangbti-development-guide.md`](docs/nyangbti-development-guide.md) — 구조와 개발 가이드
- [`docs/nyangbti-veterinary-questionnaire-reference.md`](docs/nyangbti-veterinary-questionnaire-reference.md) — 관찰·문항·Behavior Check 참고
- [`docs/nyangbti-question-scoring-dataset-v0.1.md`](docs/nyangbti-question-scoring-dataset-v0.1.md) — 30문항과 스코어링
- [`docs/guardian-mbti-compatibility-design.md`](docs/guardian-mbti-compatibility-design.md) — 집사 궁합 설계
- [`docs/content-context-audit.md`](docs/content-context-audit.md) — 설문부터 결과·궁합까지 설명 문맥 전수 점검 기록
- [`docs/content-copy-catalog.md`](docs/content-copy-catalog.md) — 화면·설문·결과·궁합의 전체 사용자 노출 문구 모음
- [`docs/character-asset-guide.md`](docs/character-asset-guide.md) — 16종 카툰 자산과 생성 프롬프트
- [`docs/app-in-toss-checklist.md`](docs/app-in-toss-checklist.md) — 출시 전 공식 요구사항 체크리스트
- [`docs/user-guide.md`](docs/user-guide.md) — 사용자용 기능·결과·공유 안내
- [`docs/app-in-toss-listing-copy.md`](docs/app-in-toss-listing-copy.md) — 콘솔 등록용 소개와 주요 기능 문구
- [`docs/remaining-tasks.md`](docs/remaining-tasks.md) — 사용자 승인·실기기·외부 검토가 필요한 잔여 작업

## 남은 작업

핵심 기능과 정적 웹 빌드 검증은 완료했습니다. App in Toss 업로드 후보가 되려면 콘솔 등록, 실제 `appName`과 아이콘 URL 입력, `.ait` 생성, 배포 기준 커밋/태그, 실제 기기 QR 테스트가 더 필요합니다. 광고를 사용할 때만 사업자·정산 등록과 운영 광고 ID가 추가로 필요합니다. 전체 목록은 [`docs/remaining-tasks.md`](docs/remaining-tasks.md)에 분리했습니다.

## App in Toss 연동 전 필수 확인

사용자가 지정한 공식 [App in Toss 운영/테스트 가이드](https://developers-apps-in-toss.toss.im/guide/operation/toss)와 현재 개발자센터의 [토스앱 테스트하기](https://developers-apps-in-toss.toss.im/development/test/toss.html), [미니앱 출시](https://developers-apps-in-toss.toss.im/development/deploy.html), [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame.html)를 SDK 설치 직전과 검토 요청 직전에 다시 확인해야 합니다.

SDK major, 패키지명, 최소 토스 앱 버전, QR 테스트 Origin, 광고 API와 심사 정책은 이 저장소의 값을 영구 고정값으로 사용하지 않습니다. 현재 광고 placeholder는 개발 환경에서만 보이며, 운영 빌드의 미지원 환경에서는 빈 광고 영역을 남기지 않습니다.
