# 아키텍처

## V0.4 플레이테스트 런타임

```text
KeyboardVehicleInputSource ─┐
                            ├─ VehicleInputRouter ─ CubeCarController
TouchVehicleInputSource ────┘          │                    │
        │                              │                    ├─ Rigidbody
        ├─ ArrowSteeringInput          │                    └─ VehicleTelemetry
        └─ VirtualSteeringWheelInput   │                              ├─ FollowCamera
                                                                       ├─ ReplayRecorder
WeeklyTrackProvider ─ RaceSession ─ CheckpointProgress                 └─ Drift HUD
                         │
                         ├─ PlayerPrefsRaceRecordRepository
                         └─ ReplayRecorder ─ PlayerPrefsReplayRepository ─ GhostPlayback
```

- 입력은 `Update()`에서 샘플링합니다.
- 차량 물리는 고정된 `FixedUpdate()`에서 최신 입력 프레임을 소비합니다.
- Camera는 물리에 영향을 주지 않고 `LateUpdate()`에서 차량을 추적합니다.
- UI가 비활성화되거나 앱 포커스를 잃으면 모든 누름 상태를 초기화합니다.

## 코드 경계

### Input

- `VehicleInputFrame`: Steering `-1..1`, Throttle/Brake `0..1` 값 객체
- `IVehicleInputSource`: 키보드, 터치 등 입력 제공자 계약
- `ISteeringInput`: Arrow/Wheel을 교체하는 조향 계약
- `VehicleInputRouter`: 여러 입력을 한 프레임으로 합성하고 Brake 우선 규칙 적용

### Vehicle

- `CarTuning`: 조작감 수치만 보관하는 ScriptableObject
- `CubeCarController`: Rigidbody 이동, 제동, 조향, Brake 진입/Throttle 유지 Drift
- `VehicleTelemetrySnapshot`: Drift/Replay가 읽을 pose, 속도, slip, 입력
- `BlueRallyCarVisual`: `Resources/Vehicles/BlueRallyRC.fbx`를 플레이어와 Ghost에 같은 구조로 인스턴스화하고 런타임 Material을 적용
- `RcWheelVisualAnimator`: Rigidbody 속도로 네 바퀴를 회전시키고 입력값으로 앞바퀴를 조향하며 Ghost 이동 거리도 시각 회전으로 변환

### Race

- `WeeklyTrackManifest`: week/track/physics/lap 버전을 묶는 신뢰 단위
- `CheckpointProgress`: Unity 물리와 분리된 순서·Lap 판정 로직
- `RaceSession`: Countdown, monotonic Finish Time, Result, Restart 상태 머신
- `IRaceRecordRepository`: 로컬 PlayerPrefs와 이후 Supabase 구현을 교체하는 기록 경계
- `PlayerPrefsRaceRecordRepository`: 서버 연결 전 개인 Top 5 테스트 대체 저장소

### Replay

- `ReplayRecorder`: 10Hz pose/input 샘플링과 schema v1 직렬화
- `IReplayRepository`: 로컬 PlayerPrefs와 이후 Supabase Storage를 교체하는 Replay 경계
- `ReplayValidator`: 비정상 시간, 속도, 순간이동의 기본 거부 경계
- `GhostPlayback`: 저장 프레임 사이 위치/회전을 보간하는 무충돌 My Best Ghost

### Bootstrap/UI

- `PrototypeBootstrap`: 68% 미니 스케일의 Blue Rally FBX와 독립된 단일 충돌체, Technical Track, 13 Checkpoint, 같은 모델의 Ghost, 넓은 시야 Camera, 터치 UI를 조립
- `SafeAreaFitter`: 모바일 노치와 홈 인디케이터 영역 대응
- `SteeringModeController`: Arrow/Wheel UI와 입력 소스 전환

## V1 확장 경계

```text
WeeklyTrackProvider ─ RaceSession ─ CheckpointSequence ─ FinishTime
                                              │
VehicleTelemetry ─ ReplayRecorder ─ ReplayRepository ─ GhostPlayback
                                              │
                         Supabase Adapter / Apps in Toss Adapter
```

- Weekly Track: `weekId`, `trackId`, `trackVersion`, `physicsVersion`, `requiredLapCount`를 하나의 manifest로 받습니다.
- Race: 단조 증가 clock과 순서 기반 Checkpoint로 유효한 전체 Finish Time만 만듭니다.
- Replay/Ghost: 물리 재시뮬레이션 대신 timestamp + pose를 기록해 WebGL과 버전 차이에 강하게 만듭니다.
- Platform: Apps in Toss API는 `IPlatformServices`, 광고는 `IAdService` adapter 뒤에 둡니다.
- Backend: Supabase 호출은 repository/adapter에서만 하며 차량 코드에서 네트워크를 호출하지 않습니다.

## 보안 경계

- WebGL 결과물은 공개 클라이언트로 취급합니다.
- Supabase publishable/anon key만 사용할 수 있고 RLS를 필수로 적용합니다.
- `service_role`, Apps in Toss 배포 키, 서버 서명 키는 빌드에 포함하지 않습니다.
- 랭킹 반영은 클라이언트 값의 단순 insert가 아니라 서버 RPC/Edge Function 검증을 거칩니다.
