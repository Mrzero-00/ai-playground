# V0.4 실제 게임 플레이테스트

## 목표

이번 테스트는 한 번의 전체 Race를 완주한 뒤 기록을 줄이기 위해 즉시 다시 플레이하고 싶은지 확인한다. 서버 순위가 아니라 차량 조작, Drift, Finish Time, My Best Ghost의 게임성을 검증한다.

## 준비

1. Unity Hub에서 Unity `6000.3.13f1`과 Web Build Support를 설치한다.
2. 프로젝트 폴더를 Unity Hub의 `Add project from disk`로 연다.
3. Package Manager가 Apps in Toss SDK와 Input System을 모두 가져올 때까지 기다린다.
4. Console의 빨간 컴파일 오류가 0개인지 확인한다.
5. `Assets/_Project/Scenes/V01_Sandbox.unity`를 열고 Play를 누른다.

## 1회차 완주

1. 차량이 코스와 방호벽에 비해 작은 미니 RC카 크기로 보이는지 확인한다.
2. 파란 차체, 어두운 캐노피, 노란 포인트, 5-spoke 휠, 범퍼와 리어 윙이 누락 없이 표시되는지 확인한다.
3. Gas 주행 중 네 바퀴가 회전하고 Steering 입력에 따라 앞바퀴만 좌우로 꺾이는지 확인한다.
4. 노출된 타이어를 포함한 외형과 실제 벽 충돌 위치가 자연스럽게 일치하는지 확인한다.
5. 3초 Countdown 동안 차량이 움직이지 않는지 확인한다.
6. `GO!` 뒤 Gas를 눌러 오른쪽으로 출발한다.
7. 바닥 중앙선을 따라 파란 라인을 `CP 1 → 2 → ... → 13` 순서대로 통과한다.
8. 출발 지점의 노란 Finish 라인으로 돌아온다.
9. 결과가 `FINISH` 또는 `NEW BEST`와 `mm:ss.mmm` 전체 Race Time으로 표시되는지 확인한다.
10. 오른쪽 `LOCAL TOP 5`의 1위에 같은 기록이 저장되는지 확인한다.

## Drift 확인

1. 직선에서 약 30km/h 이상 속도를 낸다.
2. 코너 진입 때 Steering과 Brake를 같이 누른다.
3. HUD가 `DRIFT n°`로 바뀌고 후미가 미끄러지는지 확인한다.
4. Brake를 놓고 Gas와 Steering으로 Drift가 잠시 유지되는지 확인한다.
5. 반대 방향 Steering으로 차체가 다시 정렬되는지 확인한다.

## Technical Track 난이도 확인

1. 좁은 하단 직선 뒤 오른쪽 연속 코너에서 벽 충돌 없이 CP4까지 통과한다.
2. 중앙 섬 사이의 CP5~CP7 구간에서 Brake Drift와 카운터 조향을 사용한다.
3. 상단 CP8~CP12 시케인에서 다음 Checkpoint 라벨과 중앙선을 놓치지 않는지 확인한다.
4. 좌측 헤어핀을 돌아 CP13과 Finish를 역방향 통과하지 않고 완주한다.
5. 코스를 익힌 두 번째 주행에서 첫 기록보다 단축할 여지가 있는지 평가한다.

## 재도전과 Ghost

1. 결과 화면의 `RESTART [R]` 버튼 또는 키보드 `R`을 누른다.
2. 횟수 제한이나 광고 없이 바로 Countdown이 다시 시작되는지 확인한다.
3. 두 번째 주행에 하늘색 My Best Ghost가 표시되는지 확인한다.
4. Ghost가 플레이어 차량과 같은 FBX·미니카 크기이며 바퀴가 회전하고, 충돌하지 않은 채 저장된 주행을 부드럽게 따라가는지 확인한다.
5. 더 빠르게 완주하면 `NEW BEST`가 표시되고 다음 재도전 Ghost가 갱신되는지 확인한다.

## 실패 조건

- CP를 건너뛰었는데 Finish가 인정된다.
- 개별 Lap 또는 Checkpoint 시간이 순위 기록으로 저장된다.
- Brake를 길게 눌렀을 때 후진한다.
- 재도전에 횟수 제한이 생긴다.
- Ghost가 플레이어 차량과 충돌한다.
- 앱 포커스를 잃었다가 돌아왔을 때 Gas/Brake가 계속 눌린 상태다.

## 자동 테스트

Unity에서 `Window > General > Test Runner > EditMode > Run All`을 실행한다. 다음 순수 로직을 확인한다.

- 입력 범위와 Brake 우선순위
- Steering Wheel 각도 경계
- Checkpoint 순서와 multi-lap 상태 전이
- 전체 Finish Time 표시 형식
- Replay 최대 속도와 순간이동 검증

첫 주행 상태부터 다시 확인하려면 Play Mode를 종료한 뒤 `RC Time Attack > Playtest > Clear Local Records`를 실행한다. 이 메뉴는 현재 Playtest Track의 로컬 Top 5와 My Best Ghost만 삭제한다.

## WebGL / Apps in Toss 후속 확인

Editor 완주가 확인된 다음 WebGL Development Build를 만들고 브라우저에서 같은 시나리오를 반복한다. 이후 Apps in Toss 콘솔의 실제 `appName`과 배포 설정을 입력하고 SDK의 `AIT > Build & Package`로 `.ait`를 생성해 QR 실기기 테스트를 진행한다.
