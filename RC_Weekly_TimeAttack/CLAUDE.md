# RC Weekly Time Attack 프로젝트 컨텍스트

## 목표

Unity 6 + C# + WebGL + Apps in Toss Unity SDK + Supabase 방향의 모바일 RC카 주간 타임어택 게임을 개발한다.

## 변경 불가 제품 규칙

- 매주 월요일 서버가 지정한 하나의 트랙만 제공한다.
- 모든 플레이어는 같은 차량 성능, 트랙 버전, 물리 버전을 사용한다.
- 플레이 횟수는 무제한이다.
- 주간 랭킹은 개별 Lap이 아니라 전체 Race Finish Time의 개인 최고 기록으로 정한다.
- V1 BM은 인앱 광고만 사용하고 주행 중에는 광고를 노출하지 않는다.
- V1에 실시간 멀티플레이를 넣지 않는다.

## 개발 규칙

- `docs/PRODUCT_SPEC_V3.md`를 제품 기준 문서로 사용한다.
- 차량/레이스 도메인에서 Apps in Toss 또는 Supabase SDK 타입을 직접 참조하지 않는다.
- 입력은 `IVehicleInputSource`, 조향은 `ISteeringInput` 경계를 유지한다.
- 프레임 입력은 `Update`, 물리 적용은 `FixedUpdate`, 카메라는 `LateUpdate`에서 처리한다.
- 모바일 WebGL을 우선하며 Safe Area, 포커스 이탈, 메모리, 단일 스레드 제약을 고려한다.
- 생성된 `Library`, `webgl`, `ait-build`, `.ait` 파일을 커밋하지 않는다.
- 비밀 키와 Supabase `service_role` 키를 클라이언트나 저장소에 넣지 않는다.

## 현재 범위

V0.4 로컬 플레이테스트 수직 슬라이스까지 구현되어 있다. 코스 대비 68% 크기의 14,080 triangles 파란 랠리 쿠페 FBX, 분리형 회전 휠, Drift, 13 Checkpoint Technical Weekly Track, 전체 Race Finish Time, 무제한 재도전, 개인 Top 5, My Best Replay/Ghost가 로컬에서 연결된다. 단일 공정 충돌체는 시각 FBX와 분리하며 현재 기록 경계는 `arcade-v03-mini` 물리 버전이다. Supabase 서버 기록, 실제 Weekly Leaderboard, 다른 플레이어 Ghost, 광고, Apps in Toss API 호출은 `docs/TODO.md` 순서로 추가한다.
