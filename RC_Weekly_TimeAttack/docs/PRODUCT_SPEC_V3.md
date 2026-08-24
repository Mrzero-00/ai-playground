# RC카 타임어택 레이싱 게임 V2 — AppInToss 배포 기준 기획 및 개발 가이드

## 1. 프로젝트 개요

본 프로젝트는 동일한 성능의 RC카를 조종하여 매주 지정되는 하나의 트랙에서 가장 빠른 Finish Time을 경쟁하는 **쿼터뷰 기반 모바일 타임어택 레이싱 게임**이다.

V1에서는 실시간 멀티플레이를 제외하고 다음 경쟁 구조에 집중한다.

- Weekly Time Attack
- Best Finish Time
- Weekly Leaderboard
- Ghost
- Replay

차량 파츠, 강화, 능력치 성장 등의 RPG 요소는 사용하지 않는다.

모든 플레이어가 동일한 차량 성능을 사용하며, 기록 차이는 다음 요소에서 발생한다.

- 조작 실력
- 코너 진입 속도
- 브레이킹 타이밍
- 레이싱 라인
- 스티어링 정확도
- 드리프트 컨트롤

핵심 목표:

> "한 판만 더 하면 기록을 줄일 수 있을 것 같은 게임"

---

# 2. AppInToss 적용 방향

본 프로젝트의 주요 플랫폼은 **Apps in Toss(AppInToss)** 로 설정한다.

Unity 프로젝트를 네이티브 iOS/Android 앱으로 직접 배포하는 것이 아니라 다음 구조를 사용한다.

```text
Unity
↓
Unity WebGL Build
↓
Apps in Toss Unity SDK
↓
Toss App
```

따라서 본 프로젝트의 핵심 기술 방향은 다음과 같다.

```text
Unity 6
+
C#
+
Unity WebGL
+
Apps in Toss Unity SDK
```

---

# 3. 최종 권장 기술 스택

## Game Engine

```text
Unity 6
```

## Language

```text
C#
```

## Build Target

```text
Unity WebGL
```

## Platform SDK

```text
Apps in Toss Unity SDK
```

## Backend

```text
Supabase
```

## Database

```text
PostgreSQL
```

## Ghost / Replay Storage

```text
Supabase Storage
```

## Leaderboard

우선순위:

```text
Apps in Toss Game Center
```

필요한 경우 보조적으로 Supabase Leaderboard를 사용할 수 있다.

---

# 4. 전체 아키텍처

```text
Toss App
│
└── RC Racing Mini App
      │
      ├── Unity WebGL
      │     ├── Vehicle Physics
      │     ├── Steering Input
      │     ├── Gas / Brake
      │     ├── Drift
      │     ├── Finish Timer
      │     ├── Checkpoint
      │     ├── Replay Recording
      │     └── Ghost Playback
      │
      ├── Apps in Toss Unity SDK
      │     ├── Game Center
      │     ├── Platform Integration
      │     └── 향후 Toss 기능 연동
      │
      └── Supabase
            ├── Profile
            ├── Track Metadata
            ├── Race History
            ├── Replay Metadata
            └── Ghost Replay Files
```

---

# 5. Next.js / React 중간 레이어

본 프로젝트에서는 다음 구조를 기본적으로 사용하지 않는다.

```text
Next.js
↓
iframe
↓
Unity WebGL
```

RC카 게임의 핵심은 UI 페이지가 아니라 다음 기능이다.

- Game Loop
- Physics
- Input
- Camera
- Replay
- Ghost
- Mobile Rendering

따라서 Unity를 중심으로 프로젝트를 구성한다.

권장 구조:

```text
Unity WebGL
↓
Apps in Toss Unity SDK
↓
Toss
```

Next.js 또는 React를 중간에 두는 구조는 특별한 이유가 있을 때만 검토한다.

---

# 6. 게임 핵심 컨셉

게임은 완전한 Top View가 아닌 **쿼터뷰 시점**을 사용한다.

카메라는 차량보다 높은 위치에서 약 35~50도 정도 내려다보며 차량을 추적한다.

```text
        CAMERA
           ↘

    ┌─────────────┐
    │             │
    │      🚗     │
    │             │
    │       ╲     │
    │        ╲    │
    └─────────────┘
```

카메라는 차량의 진행 방향을 부드럽게 따라간다.

목표:

- 미니카 트랙을 위에서 바라보는 느낌
- 직접 차량을 운전하는 감각
- 작은 모바일 화면에서도 트랙 전체 흐름을 파악하기 쉬운 UI

---

# 7. 차량 시스템

모든 차량은 동일한 성능을 사용한다.

다음과 같은 능력치 차이는 사용하지 않는다.

- 최고속도 차이
- 가속력 차이
- 브레이크 성능 차이
- 타이어 차이
- 차량 파츠
- 강화
- 차량 레벨

게임의 경쟁력은 **플레이어 실력**에서 발생한다.

---

# 8. 기본 조작

차량 조작은 다음 세 가지로 제한한다.

```text
Steering
Throttle
Brake
```

즉:

- 핸들
- 엑셀
- 브레이크

드리프트 버튼은 별도로 제공하지 않는다.

드리프트는 입력 조합으로 발생한다.

---

# 9. 조향 모드

두 개의 조향 모드를 제공한다.

```text
Arrow Mode
Steering Wheel Mode
```

두 모드는 최고 속도나 차량 성능에 차이를 두지 않는다.

차이는 입력 정밀도에서 발생한다.

---

# 10. Arrow Mode

초보자를 위한 조향 방식이다.

```text
◀      ▶
```

입력:

```text
LEFT   = -1
CENTER = 0
RIGHT  = +1
```

단, 실제 차량 조향은 즉각적으로 -1 또는 +1로 전환하지 않고 보간한다.

```csharp
currentSteering = Mathf.Lerp(
    currentSteering,
    targetSteering,
    deltaTime * steeringSpeed
);
```

특징:

- 학습 난이도가 낮음
- 직선 안정성이 높음
- 모바일에서 조작하기 쉬움
- 코너 진입이 쉬움
- 정밀한 레이싱 라인에는 한계 존재

---

# 11. Steering Wheel Mode

숙련자를 위한 조향 방식이다.

화면에 스티어링 휠 UI를 제공하고 사용자가 직접 회전시킨다.

```text
        ╭────────╮
      ╱            ╲
     │      ◯       │
      ╲            ╱
        ╰────────╯
```

입력 범위:

```text
-1.0 ~ 1.0
```

권장 초기 최대 회전 범위:

```text
-90° ~ +90°
```

예:

```csharp
float steering = Mathf.Clamp(
    wheelRotation / maxWheelRotation,
    -1f,
    1f
);
```

손가락을 놓으면 일정 속도로 중앙 복귀한다.

```csharp
steering = Mathf.Lerp(
    steering,
    0f,
    deltaTime * steeringReturnSpeed
);
```

특징:

- 높은 조작 난이도
- 정밀한 레이싱 라인
- 세밀한 Drift 조절
- 카운터 스티어 가능
- 최상위 기록의 잠재력이 높음

---

# 12. 조작 밸런스 원칙

Arrow Mode에 인위적인 패널티를 주지 않는다.

금지 예:

```text
Arrow 최고속도 80
Steering 최고속도 100
```

대신 입력 방식 자체에서 자연스러운 Skill Gap을 만든다.

```text
Arrow
LEFT / RIGHT / CENTER

Steering
-0.12
-0.24
-0.36
-0.47
...
```

Steering Wheel은 더 어렵지만 숙련될수록 더 정확한 주행이 가능하도록 한다.

핵심:

```text
Easy to Learn
Hard to Master
```

---

# 13. Drift 시스템

별도의 Drift 버튼은 사용하지 않는다.

Drift는 다음 조건 조합으로 발생한다.

```text
Speed
+
Steering
+
Brake
+
Throttle
```

예:

```text
코너 진입
↓
Brake
↓
Steering
↓
Rear Slip
↓
Throttle 조절
↓
Drift 유지
```

초기 구현 예:

```csharp
bool isDrifting =
    speed > driftMinSpeed &&
    Mathf.Abs(steering) > steeringThreshold &&
    brake > brakeThreshold;

float grip = isDrifting
    ? normalGrip * driftGripRatio
    : normalGrip;
```

현실적인 차량 시뮬레이션보다 **재미있는 아케이드 RC카 물리**를 우선한다.

---

# 14. V1 게임 방식

V1에서는 실시간 멀티플레이를 제외한다.

실시간 멀티플레이는 다음 기능을 요구한다.

```text
Realtime Server
Physics Synchronization
Client Prediction
Interpolation
Server Reconciliation
Latency Handling
Collision Sync
Matchmaking
Disconnect Handling
Cheat Prevention
```

초기 개발 난이도가 지나치게 올라가기 때문에 제외한다.

대신:

```text
Time Attack
+
Leaderboard
+
Ghost
```

를 핵심 경쟁 시스템으로 사용한다.

---

# 15. Weekly Time Attack

매주 지정된 하나의 Track만 플레이할 수 있다.

플레이어는 해당 주 동안 횟수 제한 없이 계속 재도전할 수 있으며, 랭킹에는 그 주에 기록한 가장 빠른 **전체 Race Finish Time**이 반영된다.

```text
Weekly Track
↓
Race Start
↓
지정된 전체 Lap / Course 완주
↓
Finish Time 계산
↓
기존 Weekly Best와 비교
↓
더 빠르면 Leaderboard 갱신
↓
즉시 재도전 가능
```

# 16. Lap 시스템

한 번의 Race에서 여러 Lap을 주행할 수 있지만, **Leaderboard 기준은 개별 Lap 기록이 아니라 전체 Race의 Finish Time**이다.

예:

```text
Lap 1
00:35.481

Lap 2
00:34.812

Lap 3
00:34.291
```

최종 결과:

```text
BEST LAP
00:34.291
```

---

# 17. Checkpoint

모든 트랙에는 Checkpoint를 배치한다.

```text
START
↓
CP1
↓
CP2
↓
CP3
↓
FINISH
```

Checkpoint를 순서대로 통과하지 않으면 Lap을 인정하지 않는다.

이를 통해 다음 문제를 방지한다.

- Shortcut
- Finish 반복 통과
- Reverse Goal
- Track 이탈
- 비정상적인 위치 이동

---

# 18. Leaderboard 전략

V1에서는 **Apps in Toss Game Center** 활용을 우선 검토한다.

기본 구조:

```text
Race Finish
↓
Finish Time 계산
↓
Score 변환
↓
Apps in Toss Game Center
↓
Leaderboard
```

단, 레이싱 게임은 일반 점수 게임과 다르게:

```text
낮은 Finish Time = 좋은 기록
```

이라는 특징이 있다.

따라서 구현 전에 반드시 Apps in Toss 공식 Game Center 설정에서 다음 항목을 확인한다.

- Score 정렬 방향
- 낮은 값 우선 정렬 지원 여부
- Score 포맷
- 기록 갱신 정책

필요한 경우 점수를 변환한다.

예:

```text
score = BASE_SCORE - finishTimeMs
```

단, 정확한 변환 공식은 실제 Game Center 정렬 정책 확인 이후 결정한다.

---

# 19. Supabase의 역할

Apps in Toss Game Center를 사용하더라도 Supabase는 유지한다.

Game Center:

```text
Ranking
Score
Leaderboard
```

Supabase:

```text
Ghost
Replay
Track Metadata
Race History
Custom Profile Data
Replay Metadata
```

권장 역할 분리:

```text
Unity
├── Apps in Toss Game Center
│     └── Leaderboard
│
└── Supabase
      ├── Ghost
      ├── Replay
      ├── Track
      └── Race History
```

---

# 20. Ghost 시스템

Ghost는 V1 핵심 기능이다.

플레이어가 과거에 주행한 차량 데이터를 재생하여 반투명 차량으로 표시한다.

```text
        GHOST
          👻🚗
             ╲
              ╲
               🚗
               ME
```

Ghost에는 충돌을 적용하지 않는다.

```text
Physics Collision = OFF
```

Ghost는 순수한 비교 대상이다.

---

# 21. Ghost 종류

초기:

```text
My Best
```

확장:

```text
World #1
Friend Best
Previous Best
My Rank + 1 Player
```

특히 추천 기능:

```text
현재 #438
↓
#437 플레이어 Ghost 다운로드
↓
Ghost와 레이스
↓
기록 단축
↓
랭킹 상승
```

실시간 멀티플레이 없이도 경쟁감을 만들 수 있다.

---

# 22. Replay 시스템

Ghost 구현을 위해 Replay 데이터를 저장한다.

초기 기록 주기:

```text
10 ~ 20Hz
```

예:

```csharp
public struct ReplayFrame
{
    public float time;

    public Vector3 position;
    public Quaternion rotation;

    public float steering;
    public float throttle;
    public float brake;
}
```

60초 게임을 10Hz로 저장하면:

```text
60 sec × 10
=
600 Frames
```

Ghost 재생에서는 저장된 프레임을 그대로 순간 이동시키지 않고 interpolation을 사용한다.

---

# 23. Replay와 치팅 검증

Replay 시스템은 다음 두 역할을 담당한다.

```text
Replay
├── Ghost Playback
└── Cheat Validation
```

향후 검사할 수 있는 항목:

```text
Maximum Speed 초과
Impossible Acceleration
Teleport
Checkpoint Skip
Wall Penetration
Impossible Rotation
```

V1 초기에는 완벽한 서버 시뮬레이션 검증까지 구현하지 않는다.

대신 Replay 구조를 초기부터 남겨두어 이후 확장 가능하도록 한다.

---

# 24. AppInToss WebGL 성능 전략

본 프로젝트는 Unity Native가 아니라 WebGL로 실행되므로 성능과 메모리를 초기부터 관리한다.

목표:

```text
60 FPS
```

단, 모바일 WebView 환경을 고려해 실제 기기 성능 테스트를 지속적으로 수행한다.

---

# 25. 그래픽 스타일 권장

권장:

```text
Stylized
Low-poly
Mini RC Car
Arcade
```

비추천:

```text
Photorealistic
High-poly
Heavy Post Processing
Large Texture
```

본 게임은 리얼리즘보다:

```text
Visibility
Performance
Control Feel
```

이 중요하다.

---

# 26. WebGL 최적화 원칙

초기부터 다음 요소를 제한한다.

- 고해상도 Texture
- 복잡한 Shader
- 다수의 실시간 Shadow
- 과도한 Particle
- Heavy Post Processing
- 많은 Dynamic Light
- 많은 Physics Object
- 불필요한 Mesh Collider

권장:

- Baked Lighting 적극 활용
- Simple Material
- Object Pooling
- Texture Atlas
- 낮은 Draw Call
- 가벼운 Particle
- 최소한의 Realtime Shadow

---

# 27. 메모리 관리

WebGL에서는 메모리 사용량이 중요하다.

관리 대상:

```text
Texture
Audio
Mesh
Replay Data
Track Assets
Particle
Shader Variants
```

한 번에 모든 트랙 리소스를 로드하지 않는다.

권장:

```text
Lobby
↓
Weekly Track 확인
↓
필요 Track Asset Load
↓
Race
↓
Race 종료
↓
필요 없는 Asset Unload
```

---

# 28. 로딩 전략

초기 로딩 시간을 가능한 줄인다.

초기 다운로드에 포함할 것:

```text
Core Game
UI
Base Car
Essential Shader
Minimal Audio
```

트랙별 리소스는 가능한 경우 분리한다.

목표:

```text
첫 진입 속도
>
초기 모든 콘텐츠 로딩
```

---

# 29. Game Server

V1에서는 Dedicated Game Server가 필요하지 않다.

게임 플레이:

```text
Unity Client Local Physics
```

서버:

```text
Result
Ranking
Ghost
Replay
Metadata
```

만 담당한다.

---

# 30. Race Result 구조

예:

```csharp
public class RaceResult
{
    public string weekId;

    public string trackId;

    public int finishTimeMs;

    public string controlType;

    public string replayPath;
}
```

예시 데이터:

```json
{
  "weekId": "2026-W34",
  "trackId": "track-01",
  "finishTimeMs": 102651,
  "controlType": "steering",
  "replayPath": "replays/user-123/track-01.json"
}
```

---

# 31. Supabase Database 예시

## tracks

```text
id
name
version
is_active
created_at
```

## race_records

```text
id
user_id
week_id
track_id
finish_time_ms
control_type
replay_path
created_at
```

## weekly_best_records

```text
user_id
week_id
track_id
best_finish_time_ms
replay_path
updated_at
```

---

# 32. Track Version 관리

게임 물리 또는 트랙 구조가 변경되면 기존 기록과 직접 비교하면 안 될 수 있다.

따라서 Track 또는 Physics Version을 기록한다.

예:

```text
track-01-v1
track-01-v2
```

또는:

```text
trackVersion
physicsVersion
```

이를 Race Record에 포함한다.

예:

```csharp
public class RaceResult
{
    public string trackId;
    public int trackVersion;
    public int physicsVersion;
    public int finishTimeMs;
}
```

이 구조는 향후 공정한 Leaderboard 운영에 매우 중요하다.

---

# 33. 개발 난이도

현재 프로젝트 범위에서는 서버 인프라보다 차량 물리와 조작감이 더 어렵다.

난이도 순서:

```text
1. Vehicle Control
2. Drift Physics
3. Mobile Steering UX
4. Camera Feel
5. Replay / Ghost
6. WebGL Optimization
7. Lap / Checkpoint
8. Leaderboard
9. Supabase
```

---

# 34. 개발 머신 요구사항

프로젝트 자체가 대규모 오픈월드 게임이 아니므로 초고사양 머신은 필요하지 않다.

주요 개발 대상:

```text
1 Track
1 Player Car
1~2 Ghost
Simple Environment
Limited Particle
```

따라서 일반적인 최신 개발 머신으로 충분하다.

실제 중요한 것은 개발 머신보다 **타깃 모바일 기기에서 WebGL 성능을 지속적으로 확인하는 것**이다.

---

# 35. Prototype 전략

처음부터 완성 그래픽을 만들지 않는다.

첫 Prototype:

```text
Plane
+
Cube Car
+
Simple Wall
+
Arrow
+
Steering Wheel
+
Gas
+
Brake
+
Drift
+
Finish Timer
```

이 상태에서 게임성을 먼저 검증한다.

검증 질문:

> "기록을 0.1초 줄이기 위해 다시 한 판 하고 싶은가?"

YES가 나오기 전에는 다음 작업을 미룬다.

- 차량 디자인
- 트랙 디자인 고도화
- Leaderboard
- Ghost Download
- 광고
- 결제
- 프로필 시스템

---

# 36. 개발 Phase

## V0.1 — Vehicle Control

구현:

```text
Cube Car
Gas
Brake
Arrow
Steering Wheel
Camera
```

목표:

```text
운전 자체가 재미있는가?
```

---

## V0.2 — Drift Physics

구현:

```text
Grip
Side Grip
Slip
Brake Drift
Throttle Drift
Counter Steering
```

목표:

```text
연습을 통해 코너 속도가 개선되는가?
```

---

## V0.3 — Track / Lap

구현:

```text
Track
Start
Checkpoint
Finish
Finish Timer
Best Finish Time
```

---

## V0.4 — Replay / Ghost

구현:

```text
Replay Recording
Replay Playback
My Best Ghost
Interpolation
```

---

## V0.5 — Supabase Integration

구현:

```text
Profile
Race Record
Best Record
Replay Upload
Replay Download
```

---

## V0.6 — Apps in Toss Integration

구현:

```text
Apps in Toss Unity SDK
WebGL Packaging
Game Center 검토
Leaderboard 연결
실제 Toss 환경 테스트
```

---

## V0.7 — Competitive Features

구현:

```text
Weekly Ranking
Top %
Weekly Best Record
Ghost Selection
My Rank + 1 Ghost
```

---

# 37. V1.0

정식 초기 릴리스 목표.

```text
Weekly Track Rotation
Arrow Mode
Steering Wheel Mode
Gas
Brake
Drift
Time Attack
Finish Timer
Checkpoint
Best Finish Time
Ghost
Replay
Weekly Leaderboard
Player Record
```

플랫폼:

```text
Apps in Toss
```

---

# 38. Weekly Track / Weekly Season 운영

플레이어는 맵을 직접 선택하지 않는다.

매주 하나의 **Weekly Track**이 지정되며 모든 플레이어가 동일한 조건에서 경쟁한다.

```text
월요일
↓
새 Weekly Track 공개
↓
모든 플레이어 동일 Track 플레이
↓
횟수 제한 없이 재도전
↓
개인 Best Finish Time 갱신
↓
Weekly Leaderboard 갱신
↓
다음 월요일
↓
지난 주 순위 확정
↓
새 Track / 새 Week 시작
```

이 구조의 목적은 플레이어를 여러 맵의 Leaderboard로 분산시키지 않고 매주 하나의 경쟁에 집중시키는 것이다.

## Weekly Leaderboard

랭킹 기준은 **Best Lap이 아니라 전체 레이스의 Finish Time**이다.

예:

```text
WEEK 2026-34
TRACK: HAIRPIN CIRCUIT

1. PLAYER_A    01:42.418
2. PLAYER_B    01:42.651
3. PLAYER_C    01:43.782

MY BEST
01:45.231

WORLD #438
TOP 3.2%
```

낮은 Finish Time이 더 좋은 기록이다.

## 플레이 횟수

V1에서는 플레이 횟수 제한을 두지 않는다.

```text
Attempts = Unlimited
```

플레이어는 해당 주 동안 원하는 만큼 계속 재도전할 수 있다.

서버/Leaderboard에는 해당 플레이어의 가장 좋은 유효 Finish Time을 반영한다.

```text
Attempt #1  01:51.200
Attempt #2  01:48.430
Attempt #3  01:46.020
Attempt #4  01:46.900

Weekly Best = 01:46.020
```

## 주간 마감

매주 월요일 새로운 Weekly Season을 시작하기 전에 이전 주 Leaderboard를 확정한다.

확정된 결과는 과거 기록으로 보존한다.

권장 식별자:

```text
weekId = "2026-W34"
trackId = "hairpin-01"
trackVersion = 2
physicsVersion = 3
```

Weekly Season 데이터 예:

```text
week_id
track_id
track_version
physics_version
starts_at
ends_at
status
```

`status` 예:

```text
scheduled
active
finalized
```

## 공정성

주간 경쟁 도중 Track 또는 Physics가 변경되면 기록의 공정성이 깨질 수 있다.

따라서 하나의 Week가 시작된 뒤에는 가능한 다음 요소를 고정한다.

```text
Track Version
Physics Version
Vehicle Spec
Checkpoint Layout
Required Lap Count
```

긴급 수정이 필요한 경우 해당 Week의 기록 무효화 또는 별도 Version Leaderboard 정책을 검토한다.

---

# 39. BM — 인앱 광고

V1의 수익 모델은 **인앱 광고만 사용한다.**

다음 BM은 V1에서 제외한다.

```text
차량 판매
파츠 판매
능력치 판매
유료 Boost
Pay-to-Win
구독
```

광고가 실제 주행과 기록 경쟁을 방해하지 않는 것이 중요하다.

권장 광고 노출 지점:

```text
Race Result
재도전 사이
Weekly Ranking 확인 이후
Lobby
```

비추천:

```text
Race 진행 중
코너 진입 중
Lap 진행 중
조작 중
```

특히 무제한 재도전이 핵심 루프이므로 매 Race 종료마다 강제 광고를 노출해 흐름을 끊는 방식은 피한다.

광고 빈도와 포맷은 실제 Apps in Toss 광고 정책 및 심사 가이드를 구현 시점에 다시 확인한다.

---

# 40. 향후 Apps in Toss 확장

V1 이후 다음 기능들을 검토할 수 있다.

```text
Toss Login
Game Analytics
Sentry
Ads
Event Tracking
User Engagement
```

광고를 적용하더라도 주행 중 광고는 피한다.

권장 위치:

```text
Race Result
Track Selection
Lobby
```

비추천:

```text
Race 중간
Lap 중간
Driving 중
```

---

# 41. 향후 실시간 멀티플레이

V1에서는 제외한다.

확장 순서:

```text
V1
Time Attack + Leaderboard + Ghost

↓

V2
Friend Ghost Challenge

↓

V3
Realtime 1 vs 1

↓

V4
3~5 Player Realtime Race
```

실시간 멀티플레이는 충분한 플레이어 수와 게임성이 검증된 이후 진행한다.

---

# 42. 핵심 개발 원칙

1. 그래픽보다 차량 조작감을 먼저 만든다.
2. 모든 차량은 동일한 성능을 유지한다.
3. Arrow는 쉽고 Steering Wheel은 정밀하게 만든다.
4. Steering Wheel에 인위적인 성능 보너스를 주지 않는다.
5. 별도의 Drift 버튼을 만들지 않는다.
6. Gas + Brake + Steering으로 Drift가 발생하게 한다.
7. 기록 향상 자체를 성장 시스템으로 사용한다.
8. V1에서 실시간 멀티플레이는 제외한다.
9. Time Attack + Ghost + Leaderboard에 집중한다.
10. Replay 시스템은 초기부터 설계한다.
11. Apps in Toss의 공식 Unity 경로를 우선한다.
12. Unity WebGL 성능을 항상 모바일 WebView 기준으로 검증한다.
13. Leaderboard 기록에는 Track/Physics Version을 포함한다.
14. 첫 Prototype이 재미있지 않으면 콘텐츠를 추가하지 않는다.
15. 플레이어는 Track을 선택하지 않고 매주 동일한 Weekly Track에서 경쟁한다.
16. 랭킹 기준은 Lap Time이 아니라 전체 Race Finish Time이다.
17. V1에서는 재도전 횟수를 제한하지 않는다.
18. BM은 인앱 광고만 사용하며 주행 중에는 광고를 노출하지 않는다.

---

# 43. 최종 권장 아키텍처

```text
                 Toss App
                    │
                    ▼
          Apps in Toss Unity SDK
                    │
                    ▼
             Unity WebGL
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
Vehicle / Game Logic      Platform Features
Physics                   Game Center
Input                     Toss Integration
Drift
Lap
Ghost
Replay
        │
        ▼
     Supabase
        │
 ┌──────┼───────────┐
 ▼      ▼           ▼
Track  Replay      Race History
Data   Storage
```

---

# 44. 최종 V3 정의

> **Unity WebGL 기반으로 Apps in Toss에서 실행되며, 동일한 성능의 RC카를 조작해 매주 지정되는 하나의 트랙에서 Finish Time을 반복 갱신하고 Ghost와 Weekly Leaderboard를 통해 다른 플레이어와 비동기 경쟁하는 쿼터뷰 모바일 타임어택 레이싱 게임.**

최종 기술 스택:

```text
Unity 6
C#
Unity WebGL
Apps in Toss Unity SDK
Apps in Toss Game Center
Supabase
PostgreSQL
Supabase Storage
```

핵심 Gameplay:

```text
Steering
Gas
Brake
Drift
Time Attack
```

핵심 Competition:

```text
Best Finish Time
Ghost
Replay
Weekly Leaderboard
```

핵심 방향:

```text
Easy to Learn
Hard to Master

Skill > Vehicle Spec

Gameplay > Graphics

Async Competition > Realtime Multiplayer
```
