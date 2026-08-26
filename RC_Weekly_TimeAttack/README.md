# RC Weekly Time Attack

> 매주 하나의 트랙에서 동일 성능의 RC카로 전체 Race Finish Time을 겨루는 Apps in Toss용 Unity WebGL 타임어택 게임

## 현재 상태

V0.4 로컬 플레이테스트 수직 슬라이스가 구현되어 있습니다.

- 14,080 triangles의 파란 랠리 쿠페 FBX와 차체·캐노피·램프·범퍼·윙·4개 휠 분리 구조
- 주행 속도 기반 휠 회전과 입력 기반 앞바퀴 조향 애니메이션
- 코스 대비 약 68% 크기의 시각 모델·충돌체와 넓어진 Camera 시야를 적용한 미니카 스케일
- 단일 공정 충돌체를 사용하는 가벼운 아케이드 물리
- Gas / Brake
- Arrow 조향과 입력 보간
- Steering Wheel 드래그 조향과 자동 센터 복귀
- 키보드 입력(화살표 또는 WASD)
- 모바일 Safe Area 대응 터치 UI
- 쿼터뷰 추적 Camera
- WebGL 포커스 이탈 시 입력 초기화
- 브레이크 진입과 스로틀 유지가 가능한 아케이드 Drift
- 헤어핀·연속 코너·좁은 시케인이 있는 1랩 Technical Weekly Track과 Checkpoint 13개
- 3초 Countdown, 전체 Race Finish Time, Best Finish Time
- `R` 또는 화면 버튼을 이용한 횟수 제한 없는 즉시 재도전
- 로컬 Top 5 기록 저장
- 10Hz Replay 기록과 My Best Ghost 보간 재생
- 기본 속도/순간이동 Replay 검증
- 플레이테스트 월드 전체를 코드로 구성하는 Bootstrap 씬
- Apps in Toss Unity SDK v3.0.3 고정

실제 서버 Weekly Leaderboard, Supabase 기록 제출, 다른 플레이어 Ghost, 광고는 아직 연결하지 않았습니다. 계정 없이 게임성을 먼저 검증할 수 있도록 현재 단계에서는 같은 저장소 키를 쓰는 로컬 기록으로 대체합니다. 자세한 순서는 [개발 TODO](docs/TODO.md)를 따릅니다.

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

차량 FBX는 Blender `5.2.1 LTS`에서 생성 및 재임포트 검증했습니다. 폴리 수와 파츠 구조는 [파란 랠리 RC 구현 문서](docs/implementation/BLUE_RALLY_RC.md)에서 확인할 수 있습니다.

## 실행

1. Unity Hub에서 Unity 6.3 LTS와 Web Build Support를 설치합니다.
2. Hub의 `Add project from disk`로 이 폴더를 엽니다.
3. 최초 실행 시 Package Manager가 의존성을 내려받을 때까지 기다립니다.
4. `Assets/_Project/Scenes/V01_Sandbox.unity`를 엽니다.
5. Play를 누릅니다.

씬이 보이지 않거나 깨졌다면 Unity 메뉴에서 `RC Time Attack > Playtest > Rebuild Sandbox Scene`을 실행합니다.

처음 실행하면 3초 카운트다운 뒤 레이스가 시작됩니다. 바닥 중앙선을 따라 파란 체크포인트를 `CP 1 → CP 13` 순서대로 통과한 다음, 출발 지점의 노란 Finish 라인으로 돌아오면 전체 완주 시간이 기록됩니다. 자세한 검증 순서는 [플레이테스트 가이드](docs/PLAYTEST.md)를 참고합니다.

## 조작

데스크톱:

- Gas: `↑` 또는 `W`
- Brake: `↓` 또는 `S`
- Steering: `←` / `→` 또는 `A` / `D`
- 입력 모드 전환: 화면 왼쪽 위 `MODE` 버튼
- 즉시 재도전: `R` 또는 화면 오른쪽 위 `RESTART`

모바일/마우스:

- Arrow 모드: 왼쪽 아래 `◀`, `▶` 길게 누르기
- Wheel 모드: 왼쪽 아래 휠을 원을 그리듯 드래그
- 오른쪽 아래 `GAS`, `BRAKE` 길게 누르기

Drift는 별도 버튼 없이 속도가 붙은 상태에서 Steering과 Brake를 함께 입력해 진입합니다. 차가 미끄러지기 시작하면 Brake를 놓고 Gas와 Steering으로 유지하며, 반대 방향 Steering으로 카운터 조향할 수 있습니다.

첫 완주 기록은 My Best Replay로 저장됩니다. 다음 재도전부터 하늘색 Ghost가 같은 시간축으로 재생되며 충돌하지 않습니다.

차량 크기와 충돌 판정이 함께 축소된 `arcade-v03-mini` 물리 버전부터는 이전 버전의 로컬 기록과 Ghost를 불러오지 않습니다. 같은 코스에서도 통과 가능한 폭이 달라져 기록 조건을 공정하게 분리하기 위한 동작입니다.

## Apps in Toss

SDK는 `Packages/manifest.json`에서 공식 릴리스 `v3.0.3`으로 고정했습니다. Unity에서 앱을 등록한 뒤 `Assets > Apps in Toss > Configuration`에서 실제 `appName`, 아이콘 URL, 배포 키를 로컬로 입력합니다. 자격 증명이 포함될 수 있는 `AITConfig.asset`은 Git에서 제외되어 있습니다.

SDK의 `AIT > Build & Package` 흐름을 사용하며, 별도 Vite 앱이나 자체 JavaScript 브리지는 만들지 않습니다.

## 폴더 구조

```text
Assets/_Project/
├── Resources/Vehicles/     # 런타임에 로드하는 Blue Rally RC FBX
├── Scenes/                 # 플레이테스트 시작 씬
├── Scripts/Runtime/
│   ├── Bootstrap/          # RC 버기와 Technical Track/UI 조립
│   ├── Camera/             # 쿼터뷰 추적
│   ├── Input/              # 키보드/터치/조향 인터페이스
│   ├── Race/               # Weekly Track, Checkpoint, Timer, 기록
│   ├── Replay/             # 10Hz 기록, 검증, My Best Ghost
│   └── Vehicle/            # 차량/Drift 물리와 텔레메트리
├── Scripts/Editor/         # 씬 복구/생성 도구
└── Tests/EditMode/         # 순수 입력 로직 테스트
ArtSource/Vehicles/         # Blender 원본과 모델 리포트
Tools/Blender/              # FBX 재생성 및 재임포트 검증 스크립트
docs/                       # 기획, 구조, 개발 계획
Packages/                   # Unity와 Apps in Toss 패키지
ProjectSettings/            # Unity 버전과 시작 씬
```

## 설계 원칙

- 차량 물리는 플랫폼 SDK, Supabase, UI를 직접 참조하지 않습니다.
- 입력은 `IVehicleInputSource`와 `ISteeringInput` 뒤에 둡니다.
- Replay/Ghost는 차량의 `VehicleTelemetrySnapshot`을 소비하며 물리 차량과 충돌하지 않습니다.
- Weekly Track과 Leaderboard는 서버가 정한 버전 정보를 신뢰 경계로 사용합니다.
- WebGL 클라이언트에는 Supabase `service_role` 키를 절대 넣지 않습니다.
