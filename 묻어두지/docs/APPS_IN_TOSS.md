# 앱인토스 배포 가능성 검토 (2026-10-26)

## 결론

**지금의 묻어두지는 앱인토스로 내보낼 수 없다.** 플랫폼이 AR을 제공하지 않고, 서드파티
네이티브 모듈을 넣을 수도 없기 때문이다. 이름을 바꾸는 수준이 아니라 제품의 핵심을
바꾸는 결정이 필요하다.

공식 문서의 문장 그대로다.

> 서드파티 네이티브 모듈을 임의로 추가해 번들링할 수는 없어요.

ViroReact·expo-camera·react-native-maps는 모두 서드파티 네이티브 모듈이다. 앱인토스가
대신 제공하는 카메라 API는 `Device.openCamera` 하나이고, 이것은 **토스 기본 카메라를 열어
찍은 사진 한 장을 돌려주는** API다.

```ts
Device.openCamera(options?: OpenCameraOptions): Promise<ImageResponse>;
type ImageResponse = { id: string; dataUri: string };
```

실시간 카메라 화면이 없으므로 그 위에 3D를 얹는 AR은 성립하지 않는다. ARKit/ARCore 연동
API도, WebXR 지원도 문서에 없다.

## 앱인토스가 주는 것

`Device` 도메인 전체: `getAlbumItems`, `getContacts`, `getLocation`, `getPhotos`,
`openCamera`, `locale`, `openURL`, `os`, `subscribeLocation`, `triggerHaptic`.

그 밖의 도메인: `Storage`, `TossAuth`, `TossPay`, `Share`, `Analytics`, `IAP`,
`Notification`, `Game`, `Promotion`, `User`, `Screen`, `File`(PDF 보기·파일 저장).

**지도 컴포넌트는 없다.** 위치는 좌표로만 받는다.

## 묻어두지가 쓰는 것과의 대조

| 지금 쓰는 것 | 쓰임 | 앱인토스 |
| --- | --- | --- |
| `@reactvision/react-viro` | AR 봉인·개봉 | ✗ 대체 수단 없음 |
| `expo-camera` | AR 카메라 화면 | ✗ `openCamera`는 촬영 결과만 |
| `expo-location` | 위치 측정·거리 판정 | ○ `getLocation` · `subscribeLocation` |
| `expo-image-picker` | 사진·영상 선택 | △ 사진만 (`getPhotos`, `getAlbumItems`) |
| `expo-audio` | 60초 녹음 | ✗ 녹음 API 없음 |
| `expo-video` | 영상 재생 | ✗ 영상 API 없음 |
| `expo-file-system` | 재생용 임시 파일 | ✗ `File`은 PDF 보기·저장만 |
| `expo-secure-store` | 기기 세션 토큰 | △ `Storage`로 대체 (보안 수준 다름) |
| `react-native-maps` · `maplibre-gl` | 지도 홈 | ✗ 지도 컴포넌트 없음 |
| `react-native-svg` · `safe-area-context` | 캡슐 그림·레이아웃 | 문서에 지원 목록 없음 · 확인 필요 |

같은 저장소의 퀘스트런은 실제로 출시한 앱인토스 RN 미니앱인데, 의존성이
`@apps-in-toss/framework`, `@granite-js/*`, `react-native`, `brick-module` 넷뿐이다.
쓸 수 있는 표면이 그만큼 좁다는 뜻이다.

남는 것은 **편지(텍스트) + 사진 + 위치 + 시간**이다. 봉인·개봉 조건과 공동 캡슐 참석
로직은 서버에 있으니 그대로 쓸 수 있다. 사라지는 것은 AR, 지도, 음성, 영상이다.

## "미니앱으로 알리고 앱으로 보내기"는 막혀 있다

이 우회로를 먼저 떠올리기 쉬운데, 정책이 정면으로 금지한다.

> 앱인토스의 핵심 가치는 '앱 설치 없이 토스 앱 안에서 간편하게 이용'이에요.

설치 유도 문구, 배너, 앱마켓 링크, 설치 혜택 안내가 모두 금지다. 콘솔에 적은 기능은
미니앱 안에서 끝나야 하고, 어기면 수정 요청 → 미노출 → 등록·운영 제한으로 간다.
미니앱을 독립 앱의 입구로 쓸 수 없다.

## 선택지

**1. 독립 앱으로 간다 (AR을 지킨다)**
App Store·Play에 직접 올린다. 지금 코드가 그대로 간다. 묻어두지의 정체성이 "실제
장소에서 AR로 꺼낸다"이므로 이 길이 제품에 가장 정직하다. 대신 설치 장벽을 그대로 진다.

**2. 앱인토스용 별도 제품을 만든다 (AR을 버린다)**
편지·사진·위치·시간만 남긴 Granite 미니앱을 새로 쓴다. 서버와 봉인·개봉 규칙은
재사용한다. 화면은 전부 다시 만들어야 한다. "그 장소에 가야 열린다"는 약속은 지켜지지만
"AR로 꺼낸다"는 경험은 없어진다. 이 경우 묻어두지의 매력이 남는지를 먼저 판단해야 한다.

**3. 웹 미니앱 + 유사 AR (미확인, 권하지 않음)**
앱인토스에는 `@apps-in-toss/web-framework` 경로도 있다(냥BTI·집토리가 쓴다). 웹뷰 안이라
`getUserMedia`로 카메라 화면을 띄우고 기기 방향만으로 캡슐을 얹는 연출은 이론상 가능하다.
다만 **토스 웹뷰에서 `getUserMedia`가 열리는지 확인되지 않았고**, 열리더라도 평면 인식이
없는 "유사 AR"이다. 이 저장소의 `CLAUDE.md`는 AR이 아닌 것을 AR 검증으로 표현하지 말라고
정해 두었으므로, 이 길을 택한다면 제품 문구부터 다시 써야 한다.

**권고: 1번.** AR이 이 제품의 전부다. 앱인토스는 AR을 줄 수 없고, 입구로 쓰는 것도
막혀 있다. 2번은 "같은 이름의 다른 제품"을 하나 더 운영하는 일이라, AR 검증을 끝내고
제품이 선 뒤에 따로 판단할 문제다.

## 출처

- [React Native 시작하기](https://developers-apps-in-toss.toss.im/documentation/react-native.md) — 서드파티 네이티브 모듈 금지
- [Device.openCamera](https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/device/device.opencamera.md) — 촬영 결과만 반환
- [권한 API](https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/permissions.md) — AR·실시간 카메라 스트림 없음
- [서비스 오픈 정책](https://developers-apps-in-toss.toss.im/intro/guide.md) — 자사 앱 설치 유도 금지, 미니앱 내 완결
- [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame.html)
- 같은 저장소: `퀘스트런/docs/apps-in-toss-release.md`(RN 경로), `AI_집안일/docs/apps-in-toss-policy.md`(정책 정리)
