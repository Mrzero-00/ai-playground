# 냥BTI App in Toss 배포 기록

최종 갱신일: **2026-08-31 (Asia/Seoul)**

## 확정된 콘솔 정보

| 항목 | 값 |
| --- | --- |
| 워크스페이스 | 상일의플레이그라운드 |
| 표시명 | 고양이 MBTI |
| `appName` | `cat-mbti-00` |
| 카테고리 | 생활 > 콘텐츠 > 테스트 |
| 브랜드 색 | `#FF765F` |
| SDK/CLI | `@apps-in-toss/web-framework` 3.1.1 |
| 콘솔용 로고 후보 | `public/brand/nyangbti-logo-600.png` (600×600) |

`appName`은 콘솔에서 변경할 수 없는 식별자다. `apps-in-toss.config.ts`와 번들 파일명이 반드시 `cat-mbti-00`을 사용해야 한다.

## 로컬 배포 산출물

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

2026-08-31 검증 결과:

- ESLint 통과
- TypeScript 통과
- Vitest 10개 통과
- Next.js 5개 사용자 경로와 not-found가 모두 정적 생성
- `cat-mbti-00.ait` 생성
- 압축 해제 기준 61개 파일, 약 14.3MB로 100MB 제한 충족
- 네이티브 권한 선언 없음

`.ait`는 재생성 가능한 배포 산출물이므로 `.gitignore`에 포함한다.

## 콘솔 등록과 실제 기기 테스트

1. `앱 출시` → `등록하기`에서 `cat-mbti-00.ait`를 업로드한다.
2. 메모에 구현 범위와 검증 결과를 기록하고 버전을 등록한다.
3. 콘솔이 발급한 QR 또는 `intoss-private://...?_deploymentId=...` 스킴으로 토스 앱에서 연다.
4. 테스트 계정이 워크스페이스 멤버이고 만 19세 이상인지 확인한다.
5. 시작 → 프로필 → 30문항 → 결과 → 공유/재검사 전 과정을 iOS와 Android에서 확인한다.
6. 첫 화면 종료, 내부 뒤로가기, iOS 스와이프, Android 시스템 뒤로가기와 Safe Area를 확인한다.

공식 정책상 실제 토스 앱 테스트를 최소 1회 완료해야 검토 요청 버튼이 활성화된다.

## 검토 요청과 출시

QR 회귀 테스트가 끝난 뒤 비게임 체크리스트를 다시 점검하고 한 버전만 검토 요청한다. 승인되면 최종 회귀 테스트 후 콘솔의 `출시하기`를 누른다. 이 동작은 전체 사용자에게 즉시 반영되므로 담당자가 승인 결과와 출시 시점을 확인한 뒤 실행한다.

## 현재 진행 상태

- [x] 공식 운영·테스트·출시·비게임 가이드 최신 확인
- [x] 기존 콘솔 앱과 실제 `appName` 확인
- [x] SDK 3.1.1 설정과 정적 `.ait` 생성
- [x] 로컬 lint/typecheck/test/build 및 용량 검사
- [ ] 콘솔에 첫 번들 등록
- [ ] QR 실제 기기 테스트
- [ ] 검토 요청
- [ ] 승인 후 최종 출시

콘솔 업로드를 자동화한 환경에서는 `pnpm deploy`를 사용할 수 있다. API 키는 저장소나 명령 기록에 넣지 말고 `ait token add`가 관리하는 로컬 자격 증명을 사용한다.

## 필수 공식 문서

- [운영/테스트 가이드](https://developers-apps-in-toss.toss.im/guide/operation/toss)
- [토스앱 테스트하기](https://developers-apps-in-toss.toss.im/development/test/toss.html)
- [미니앱 출시](https://developers-apps-in-toss.toss.im/development/deploy.html)
- [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame.html)

정책, 검토 기간, SDK 버전과 테스트 Origin은 바뀔 수 있으므로 검토 요청 직전에 다시 확인한다.
