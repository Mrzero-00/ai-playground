# 묻어두지

> 사진·편지·음성·영상을 실제 장소에 봉인하고, 약속한 시간이 지나 그 장소에서 AR로 꺼내는 모바일 타임캡슐 기능 검증 앱.

## 이번 버전

첫 실험은 **나 혼자 쓰는 캡슐 + 사진/편지/음성/영상 + 실제 위치 + AR**이다. iOS/Android 앱을 같은 코드로 만들었다. 브라우저는 화면·연결 확인용이며 실제 AR 봉인/개봉은 실행하지 않는다.

1. 사진·편지·음성·영상 중 하나 이상과 캡슐 이름, 장소 별명, 기다릴 시간을 정한다.
2. 현재 위치를 측정하고 AR로 바닥을 골라 봉인한다.
3. 서버는 봉인된 내용의 조회와 수정을 차단한다.
4. 개봉 시간이 지나면 같은 장소로 돌아와 AR에서 꺼낸다.

**15초·1분·5분** 테스트 시간이 포함되어 있다. 시간 판정은 휴대폰 시계가 아니라 서버 기준이다. 위치 허용 반경은 50m, 측정 오차는 25m 이하, 위치 측정 시각은 30초 이내여야 한다(봉인은 업로드 요청 도착 시점, 개봉은 조건 검사 시점 기준). 캡슐 좌표 근처에서 현재 인식한 평면에 새로 배치한다. 과거의 정확한 한 점에 AR 오브젝트를 복원하는 기능은 아니다.

## 담을 수 있는 내용

| 내용 | 기능 검증 범위 |
| --- | --- |
| 편지 | 최대 10,000자 |
| 사진 | 1장, 4MB 이하로 변환 |
| 음성 | 앱에서 최대 60초 녹음 또는 M4A·MP3·WAV 파일 1개 선택, 10MB 이하 |
| 영상 | 보관함에서 MP4·MOV 파일 1개 선택, 25MB 이하 |

네 가지를 함께 담거나 음성/영상만 담아도 된다. 녹음은 iOS/Android 개발 앱에서 지원하며 브라우저에서는 파일을 선택한다. 봉인 전에는 미리 듣기/보기가 가능하고 봉인 요청 이후에는 숨긴다. 개봉 조건을 통과한 응답으로만 재생 파일을 만든다. 개봉 화면을 벗어나거나 앱을 백그라운드로 보내면 재생을 멈추고 임시 파일 삭제를 시도한다. 사용자가 고른 원본 파일은 유지한다.

파일 확장자가 같아도 내부 코덱에 따라 기기 재생이 다를 수 있다. 첫 실기기 검증은 휴대폰으로 녹음한 M4A와 짧은 H.264 MP4로 진행한다. 파일은 로컬 검증 API에 Base64 JSON으로 전송하므로 업로드/개봉 요청에 최대 120초를 허용한다. 운영 단계에서는 비공개 객체 저장소와 스트리밍 방식으로 교체할 예정이다.

## 빠르게 시작하기

필수: Node 22.13 이상(Node 22 또는 24 LTS 권장), npm.

```sh
cd /Users/sonsang-il/Desktop/ai/묻어두지
npm install
npm run server
```

별도 터미널에서:

```sh
cd /Users/sonsang-il/Desktop/ai/묻어두지
npm start
```

- 서버: `http://localhost:8787`
- 웹 미리보기: `npm run web` → `http://localhost:8081`
- 환경 확인: `npm run doctor`
- 앱의 `LAB` 화면에서도 서버/현재 위치를 확인할 수 있다.

앱은 Expo 개발 서버 주소를 이용해 Mac의 API 주소를 자동으로 결정한다. 연결이 안 되면 `.env.example`을 `.env`로 복사하고 `EXPO_PUBLIC_API_URL=http://<Mac의 Wi-Fi IP>:8787`을 지정한 다음 Expo를 재시작한다. Mac과 휴대폰은 같은 Wi-Fi에 연결한다. VPN, 게스트 Wi-Fi의 기기 간 차단, 방화벽이 있으면 연결되지 않을 수 있다.

### 아이폰 실제 AR 실행

Expo Go에는 이 앱의 AR 모듈이 없다. **개발 빌드를 아이폰에 설치해야 한다.** 음성·영상 추가 전에 설치한 개발 앱은 새 네이티브 모듈과 마이크 권한을 반영하도록 다시 빌드한다.

필수: Xcode 26 이상, Ruby 3.3 이상, 실제 iPhone, 기기 개발자 모드, Xcode의 Apple 계정/개발 서명 설정.

```sh
npm run ios
```

`scripts/ios.sh`는 한글 원본 경로를 감지하면 `/private/tmp/mudeoduji-ios-<사용자>-<경로해시>/project`에 빌드용 복사본을 만든다. 원본의 `.env`를 함께 복사하고, 의존성이 없거나 package/lock 파일이 바뀌면 복사본에서 `npm ci`를 실행한다. 이어서 CocoaPods 호환 의존성을 복사본 `.build/` 아래에 설치하고 native project를 준비한 뒤 기기를 선택해 빌드한다. 서버와 캡슐 DB는 원본 폴더에서 계속 사용한다. 원본에서 `npm start`를 기본 8081 포트로 켜 둔다. iOS 설치 명령은 `--no-bundler`로 이 서버를 사용하므로 화면 코드 수정은 원본에서 바로 반영된다. 네이티브 설정이나 의존성을 바꾸면 `npm run ios`를 다시 실행해 복사본을 갱신한다. Mac에 Ruby 3.3이 없으면 먼저 설치해야 한다. 이 Mac에서는 Homebrew `ruby@3.3`을 사용한다. 스크립트는 해당 경로를 자동으로 찾는다.

아이폰을 USB로 연결하고 기기의 ‘이 컴퓨터 신뢰’와 개발자 모드를 설정한다. 서명 오류가 나면 Xcode에서 출력된 빌드 폴더의 `ios/*.xcworkspace`를 열고 **Signing & Capabilities → Team**을 본인의 개발 팀으로 설정한다. Apple 계정 로그인/기기 신뢰는 사용자가 직접 완료한다.

빌드/설치 없이 영문 경로 복사본 준비만 확인하려면:

```sh
npm run ios -- --prepare-only
```

출력된 경로가 실제 빌드 폴더다. 이 명령은 의존성을 설치하거나 native 컴파일을 수행하지 않는다. 원본 파일은 삭제하지 않으며, 생성물·캡슐 DB·의존성 폴더는 복사하지 않는다.

기기 설치 없이 native 컴파일만 확인하려면:

```sh
npm run ios:check
```

이 명령은 `CODE_SIGNING_ALLOWED=NO`로 빌드하며 **설치 가능한 서명된 앱 생성이나 실제 AR 동작을 의미하지 않는다.**

### Android

Android Studio, 해당 SDK/JDK, ARCore 지원 실기기와 USB 디버깅 설정이 필요하다.

```sh
npm run android
```

앱 내부 Google 지도를 사용하려면 `.env`에 `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`를 넣고 재빌드한다. 키가 없어도 위치 측정/거리 확인/AR 코드 테스트 경로는 사용할 수 있고, 장소 요약에서 외부 지도 앱을 열 수 있다. Android 실기기 동작은 별도 검증해야 한다.

## 검사

```sh
npm run check
npx expo export --platform all --output-dir dist --max-workers 2
npm run prebuild
```

자동 검사는 시간·거리·권한·저장·재전송 규칙을 확인한다. 카메라가 바닥을 안정적으로 인식하는지와 실제 GPS 오차는 자동 검사로 대체할 수 없다. [실기기 테스트 절차](docs/DEVICE_TEST.md), [검증 기록](docs/VERIFICATION.md)을 참고한다.

## 구성

| 영역 | 사용 기술 |
| --- | --- |
| 앱 | Expo 55 / React Native 0.83 / TypeScript |
| AR | ViroReact 2.57.3 → iOS ARKit / Android ARCore |
| 지도·위치 | react-native-maps / expo-location |
| 사진·영상 선택 | expo-image-picker / expo-image-manipulator |
| 녹음·재생 | expo-audio / expo-video |
| 음성 파일 선택 | expo-document-picker |
| 기기 인증 | 무작위 세션 토큰, iOS/Android SecureStore |
| 개발 API | Node HTTP / SQLite |

```text
App.tsx                       화면과 봉인/개봉 흐름
src/components/CapsuleAR.*     실기기 AR, 웹 미지원 안내
src/components/CapsuleMap.*    지도와 장소 요약
src/lib/                      API, 위치, 사진, 미디어 파일 관리
src/shared/contracts.ts       앱/서버의 타입과 거리 기준
server/                       로컬 API와 HTTP 통합 테스트
scripts/ios.sh                 아이폰 빌드/설치 준비
docs/                         현장 테스트 방법과 검증 기록
```

## 개발 서버와 봉인 규칙

현재 버전은 외부 클라우드 계정 없이 기능을 검증하기 위해 이 Mac에 저장한다. **Supabase는 아직 연결하지 않았다.** 정식 서비스 단계에서는 Supabase Auth/Postgres/PostGIS/private Storage 등으로 이전할 수 있다.

- SQLite 파일: `.data/capsules.sqlite`. 서버 재시작 후에도 유지된다.
- 사진·편지·음성·영상은 개발 서버 DB에 암호화 없이 저장된다. **테스트 자료만 사용한다.** 인터넷에 배포하지 않는다.
- 로그인 UI 대신 이 설치에 발급한 기기 세션으로 캡슐을 구분한다. 서버에는 토큰 해시만 저장한다. 웹 미리보기는 localStorage를 사용한다.
- 목록/메타데이터에는 내용·파일명·재생 URL을 반환하지 않는다. `/open`은 매 요청마다 소유권·서버 시각·현재 위치를 다시 확인한다. 예전에 열었어도 원격에서 재조회할 수 없다.
- 서버로 봉인 요청을 보내는 순간 작성 화면을 숨긴다. 응답이 유실되면 같은 `Idempotency-Key`로 상태를 복구해 중복 생성을 막는다.
- 사진·음성·영상 선택/녹음 시 만든 앱의 임시 파일은 성공적인 봉인 후 삭제를 시도한다. 사용자의 보관함/파일 원본은 건드리지 않는다.
- 좌표는 기기가 전달한 값이다. 기본 mock 플래그/시각/오차 검사는 있으나 악의적인 GPS/API 변조를 완전히 막는 인증은 아니다.
- 로컬 HTTP 통신을 위해 private LAN에만 iOS ATS 예외를 두었다. Android 개발 설정은 cleartext를 허용한다. 운영에서는 HTTPS로 교체하고 개발 예외를 제거해야 한다.
- 공동 참여, 선물, 푸시 알림, 원격 개봉, 장기 백업은 이 검증 버전에 포함하지 않는다.

### API 요약

`GET /health`, `POST /sessions` 외에는 Bearer 인증을 사용한다.

| 경로 | 역할 |
| --- | --- |
| `GET /capsules` | 내 캡슐 메타데이터 목록 |
| `POST /capsules` | 현재 위치에 즉시 봉인; Idempotency-Key로 재전송 복구 |
| `GET /capsules/by-request/:key` | 봉인 요청 결과 메타데이터 복구 |
| `POST /capsules/:id/eligibility` | 개봉 시간/위치 조건 확인; 내용 없음 |
| `POST /capsules/:id/open` | 조건을 다시 검사한 뒤 편지와 첨부 파일 반환 |

## 경로와 생성 파일

**원본 프로젝트 폴더는 `묻어두지`다.** 패키지 이름과 앱 식별자는 `mudeoduji`를 유지한다. React Native iOS prebuilt 의존성의 파일 URI 처리에서 한글 경로 오류가 재현되었으므로, iOS 빌드 스크립트는 별도의 실제 영문 경로 복사본에서 빌드한다. 심볼릭 링크만 만드는 방식으로는 우회되지 않는다.

`ios/`, `android/`, `.build/`, `.data/`, `.env`, `node_modules/`는 버전 관리에서 제외한다. 네이티브 설정의 기준은 `app.config.ts`이고 prebuild로 재생성한다.
