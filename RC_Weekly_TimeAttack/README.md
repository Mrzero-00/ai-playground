# RC Weekly Time Attack

> 매주 하나의 트랙에서 동일 성능의 RC카로 전체 Race Finish Time을 겨루는 Apps in Toss용 Unity WebGL 타임어택 게임

## 현재 상태

V0.1 차량 조작 프로토타입이 구현되어 있습니다.

- Cube Car와 가벼운 아케이드 물리
- Gas / Brake
- Arrow 조향과 입력 보간
- Steering Wheel 드래그 조향과 자동 센터 복귀
- 키보드 입력(화살표 또는 WASD)
- 모바일 Safe Area 대응 터치 UI
- 쿼터뷰 추적 Camera
- WebGL 포커스 이탈 시 입력 초기화
- V0.1 샌드박스를 코드로 구성하는 Bootstrap 씬
- Apps in Toss Unity SDK v3.0.3 고정

아직 구현하지 않은 핵심 기능은 Drift, Track/Checkpoint, 전체 Race Finish Timer, Replay/Ghost, Weekly Leaderboard, Supabase, 광고입니다. 순서는 [개발 TODO](docs/TODO.md)를 따릅니다.

## 기준 문서

- [제품 기획 V3](docs/PRODUCT_SPEC_V3.md)
- [아키텍처](docs/ARCHITECTURE.md)
- [Apps in Toss WebGL 준비](docs/APPINTOSS_WEBGL.md)

제품 규칙은 다음 네 가지를 최우선으로 봅니다.

1. 플레이어는 맵을 고르지 않고 매주 지정된 하나의 Weekly Track을 플레이합니다.
2. 재도전 횟수는 제한하지 않습니다.
3. 순위는 Best Lap이 아니라 전체 Race Finish Time으로 정합니다.
4. V1 수익 모델은 인앱 광고만 사용하며 주행 중에는 노출하지 않습니다.

## 요구 환경

- Unity 6.3 LTS `6000.3.13f1`
- Web Build Support 모듈
- Git(Unity Package Manager가 Apps in Toss SDK를 받는 데 사용)

현재 이 저장소를 만든 머신에는 Unity Editor가 설치되어 있지 않아 Unity 임포트와 WebGL 실빌드는 아직 실행하지 못했습니다. 코드는 Unity 프로젝트로 바로 열 수 있게 구성되어 있습니다.

## 실행

1. Unity Hub에서 Unity 6.3 LTS와 Web Build Support를 설치합니다.
2. Hub의 `Add project from disk`로 이 폴더를 엽니다.
3. 최초 실행 시 Package Manager가 의존성을 내려받을 때까지 기다립니다.
4. `Assets/_Project/Scenes/V01_Sandbox.unity`를 엽니다.
5. Play를 누릅니다.

씬이 보이지 않거나 깨졌다면 Unity 메뉴에서 `RC Time Attack > V0.1 > Rebuild Sandbox Scene`을 실행합니다.

## 조작

데스크톱:

- Gas: `↑` 또는 `W`
- Brake: `↓` 또는 `S`
- Steering: `←` / `→` 또는 `A` / `D`
- 입력 모드 전환: 화면 왼쪽 위 `MODE` 버튼

모바일/마우스:

- Arrow 모드: 왼쪽 아래 `◀`, `▶` 길게 누르기
- Wheel 모드: 왼쪽 아래 휠을 원을 그리듯 드래그
- 오른쪽 아래 `GAS`, `BRAKE` 길게 누르기

## Apps in Toss

SDK는 `Packages/manifest.json`에서 공식 릴리스 `v3.0.3`으로 고정했습니다. Unity에서 앱을 등록한 뒤 `Assets > Apps in Toss > Configuration`에서 실제 `appName`, 아이콘 URL, 배포 키를 로컬로 입력합니다. 자격 증명이 포함될 수 있는 `AITConfig.asset`은 Git에서 제외되어 있습니다.

SDK의 `AIT > Build & Package` 흐름을 사용하며, 별도 Vite 앱이나 자체 JavaScript 브리지는 만들지 않습니다.

## 폴더 구조

```text
Assets/_Project/
├── Scenes/                 # V0.1 시작 씬
├── Scripts/Runtime/
│   ├── Bootstrap/          # 프로토타입 월드/UI 조립
│   ├── Camera/             # 쿼터뷰 추적
│   ├── Input/              # 키보드/터치/조향 인터페이스
│   └── Vehicle/            # 차량 물리와 텔레메트리
├── Scripts/Editor/         # 씬 복구/생성 도구
└── Tests/EditMode/         # 순수 입력 로직 테스트
docs/                       # 기획, 구조, 개발 계획
Packages/                   # Unity와 Apps in Toss 패키지
ProjectSettings/            # Unity 버전과 시작 씬
```

## 설계 원칙

- 차량 물리는 플랫폼 SDK, Supabase, UI를 직접 참조하지 않습니다.
- 입력은 `IVehicleInputSource`와 `ISteeringInput` 뒤에 둡니다.
- Replay/Ghost는 차량의 `VehicleTelemetrySnapshot`을 소비합니다.
- Weekly Track과 Leaderboard는 서버가 정한 버전 정보를 신뢰 경계로 사용합니다.
- WebGL 클라이언트에는 Supabase `service_role` 키를 절대 넣지 않습니다.

