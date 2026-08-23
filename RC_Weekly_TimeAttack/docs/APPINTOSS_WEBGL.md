# Apps in Toss WebGL 준비

## 현재 고정값

- Unity: 6.3 LTS 계열
- Apps in Toss Unity SDK: `release/v3.0.3`
- Build Target: WebGL
- SDK 지원 범위에 포함된 Unity: 6000.0 / 6000.2 / 6000.3

Unity 6000.4 이상은 현재 SDK 공식 지원 목록에 없으므로 이 프로젝트에서는 6000.3을 사용합니다.

## 최초 설정

1. Unity Hub에서 Unity 6.3 LTS와 Web Build Support를 설치합니다.
2. 프로젝트를 열어 Package Manager가 Git 패키지를 설치하게 합니다.
3. Apps in Toss 콘솔에서 앱을 등록합니다.
4. Unity 메뉴 `Assets > Apps in Toss > Configuration`을 엽니다.
5. 콘솔과 동일한 `appName`, Display Name, Primary Color, Icon URL을 입력합니다.
6. 실제 게임 씬이 Build Profiles에 포함되었는지 확인합니다.

`appName`은 등록 후 변경할 수 없으므로 확정 전 임의 값을 커밋하지 않습니다. 설정 에셋에는 배포 정보가 들어갈 수 있어 저장소에서 제외했습니다.

## 빌드

SDK의 공식 흐름을 사용합니다.

```text
Unity WebGL
    ↓
webgl/
    ↓
Granite / Vite 패키징
    ↓
ait-build/dist/*.ait
```

Unity 메뉴의 `AIT > Build & Package`를 사용합니다. SDK가 WebGL 템플릿, Wasm, 압축, stripping, 메모리, 스레딩 설정을 빌드 프로필에 맞게 구성하므로 V0.1에서 별도 Vite 앱이나 자체 `.jslib` 브리지를 만들지 않습니다.

## WebGL 제약

- 일반 C# 스레드와 raw `System.Net` 소켓에 의존하지 않습니다.
- Supabase는 `UnityWebRequest` 기반 REST/RPC 또는 검증된 Web 브리지를 사용합니다.
- 운영 통신은 HTTPS/WSS만 사용합니다.
- 앱 비가시화/백그라운드 진입 시 입력과 오디오를 정지합니다.
- Safe Area와 가로 화면을 실제 토스 앱에서 확인합니다.
- 생성된 `.ait` 압축 해제 크기를 100MB 이하로 관리합니다.

Supabase 운영 origin 후보:

```text
https://<appName>.apps.tossmini.com
https://<appName>.private-apps.tossmini.com
```

## 배포 전 체크

- [ ] `appName`과 콘솔 값 일치
- [ ] 아이콘 URL과 Publish 키 입력
- [ ] 시작 씬 Build Profile 등록
- [ ] 앱 비가시화 시 입력/오디오 정지
- [ ] 실제 Toss QR 테스트 1회 이상
- [ ] `.ait` 용량 제한 확인
- [ ] Supabase CORS와 RLS 확인
- [ ] WebGL 빌드에 비밀 키가 없는지 검사

## 공식 자료

- https://developers-apps-in-toss.toss.im/unity/sdk/getting-started.html
- https://developers-apps-in-toss.toss.im/unity/sdk/build-process.html
- https://developers-apps-in-toss.toss.im/unity/sdk/build-profiles.html
- https://developers-apps-in-toss.toss.im/unity/sdk/build-customization.html
- https://developers-apps-in-toss.toss.im/checklist/app-game.html
- https://github.com/toss/apps-in-toss-unity-sdk/releases

