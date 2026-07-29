# 퀘스트런 앱인토스 출시 가이드

## 배포 형태

퀘스트런은 React Native와 Granite로 만든 **앱인토스 비게임 미니앱**입니다.
Android APK나 iOS IPA를 직접 앱스토어에 올리는 독립 앱이 아니라, `ait build`가 생성한
`quest-run.ait` 안에 Android/iOS용 React Native 번들을 함께 패키징하고 이를 앱인토스
콘솔에 업로드하는 방식입니다.

- 앱 유형: 비게임 (`appType: general`)
- 앱 ID: `quest-run`
- 사용자 표시 이름: `퀘스트런`
- 스킴: `intoss://quest-run`
- 앱 내 기능 스킴: `intoss://quest-run/run`
- 런타임 권한: 위치 정보 (`geolocation`)
- 지원되는 앱인토스 환경: Android 7 이상, iOS 16 이상

## 1. 콘솔 앱 정보 등록

앱인토스 콘솔에 비게임 앱을 생성하고 앱 ID를 `quest-run`으로 등록합니다. 앱 ID는 등록 후
변경할 수 없으므로 `granite.config.ts`의 `appName`과 반드시 같아야 합니다.

다음 정보도 콘솔에 준비해야 합니다.

- 앱 이름: 퀘스트런
- 앱 로고: `assets/quest-run-app-icon-600.png`
- 브랜드 색상: `#16B87A`
- 고객문의 이메일
- 서비스 카테고리와 앱 설명
- 검색 키워드
- 개인정보 처리방침 URL
- 서비스 이용약관 URL

## 2. 브랜드 아이콘 URL 연결

`assets/quest-run-app-icon-600.png`는 600×600 PNG, 불투명 배경, 각진 외곽 형태로 준비되어
있습니다. 이 파일을 콘솔 앱 정보에 업로드한 뒤 이미지 링크를 복사합니다.

```bash
cp release.env.example .env.release
```

`.env.release`에 실제 콘솔 값만 입력합니다.

```bash
AIT_APP_NAME=quest-run
AIT_BRAND_ICON_URL=https://콘솔에서-복사한-이미지-주소
```

터미널에서 빌드할 때 변수를 내보냅니다.

```bash
set -a
source .env.release
set +a
```

`.env.release`는 Git에 포함하지 않습니다.

## 3. 출시용 번들 생성

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test --runInBand
pnpm release:build
```

`release:build`는 다음 항목을 자동으로 검사합니다.

- 콘솔 앱 ID와 `quest-run` 일치 여부
- 비게임 앱 타입 사용 여부
- 브랜드 아이콘 HTTPS URL 누락 여부
- `quest-run.ait` 생성 여부
- 압축 해제 기준 100MB 이하 여부

## 4. 샌드박스 테스트

최신 앱인토스 샌드박스 앱에서 다음 스킴으로 실행합니다.

```text
intoss://quest-run
```

Android와 iOS에서 각각 확인합니다.

- 홈 화면과 5개 플로팅 탭 정상 동작
- 러닝 시작 전 위치 정보 사용 안내 노출
- 동의 후에만 OS 위치 권한 요청
- 권한 거절 후에도 퀘스트·스타일·친구 기능 사용 가능
- 백그라운드 전환 시 러닝 일시정지
- 러닝 완료 시 거리·속도·페이스·경로·보상 저장
- 앱 재실행 후 러너 레벨과 보유 아이템 유지
- 상단 비게임 내비게이션의 로고·이름·뒤로가기·홈·더보기·닫기 동작

## 5. 콘솔 앱 내 기능 등록

비게임 앱은 앱 내 기능을 최소 1개 등록해야 합니다.

| 기능 이름 | 설명 | 피처 주소 |
| --- | --- | --- |
| 러닝 시작하기 | 위치 안내 확인 후 러닝 기록을 시작합니다. | `intoss://quest-run/run` |

콘솔 입력값에는 이모지를 사용하지 않습니다.

## 6. 토스앱 QR 테스트

CLI 토큰은 저장소나 `.env` 파일에 넣지 않고 `ait token` 명령으로 로컬 프로필에 저장합니다.

```bash
pnpm exec ait token add
pnpm release:upload
```

업로드 후 콘솔에서 발급된 `intoss-private://` 스킴 또는 QR 코드로 최신 토스앱에서
Android/iOS 최종 테스트를 진행합니다. 출시 검토 요청 전 최소 한 번 이상 QR 테스트를
완료해야 합니다.

## 7. 검토 요청과 출시

1. 콘솔에서 앱 정보와 앱 내 기능 검토를 완료합니다.
2. 업로드한 한 개 버전을 선택해 검토를 요청합니다.
3. 운영·디자인·기능·보안 검토 결과를 확인합니다.
4. 승인 후 콘솔의 `출시하기` 버튼을 눌러 공개합니다.

라이브 환경은 HTTPS만 허용합니다. 추후 친구·그룹 퀘스트 백엔드를 연결할 때 아래 Origin을
API CORS 허용 목록에 추가해야 합니다.

```text
https://quest-run.apps.tossmini.com
https://quest-run.private-apps.tossmini.com
```

## 공식 문서

- [React Native 시작하기](https://developers-apps-in-toss.toss.im/tutorials/react-native.html)
- [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame.html)
- [미니앱 브랜딩 가이드](https://developers-apps-in-toss.toss.im/design/miniapp-branding-guide.html)
- [토스앱 테스트하기](https://developers-apps-in-toss.toss.im/development/test/toss.html)
- [미니앱 출시](https://developers-apps-in-toss.toss.im/development/deploy.html)
- [앱 내 기능 등록](https://developers-apps-in-toss.toss.im/development/test/function.html)
