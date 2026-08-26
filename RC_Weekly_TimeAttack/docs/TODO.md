# 개발 TODO

## V0.1 — Vehicle Control

- [x] Unity 6 프로젝트 골격
- [x] Cube Car와 Rigidbody 기반 아케이드 이동
- [x] Gas와 최고 속도 제한
- [x] Brake와 후진 방지
- [x] Arrow 조향 보간
- [x] Steering Wheel 연속 입력과 센터 복귀
- [x] 키보드 + 터치 입력 라우팅
- [x] 쿼터뷰 Follow Camera
- [x] Safe Area UI와 포커스 이탈 입력 초기화
- [x] V0.1 샌드박스 Bootstrap 씬
- [x] EditMode 입력 단위 테스트 작성
- [ ] Unity 6.3 LTS 설치 후 최초 임포트 오류 0건 확인
- [ ] Editor Play Mode에서 조작감 1차 튜닝
- [ ] WebGL Development Build 실행
- [ ] 실제 모바일 브라우저와 토스 앱에서 터치 확인

V0.1 완료 판정: Plane 위 Cube Car가 Gas/Brake로 가감속하고 Arrow 또는 Wheel로 조향하며 Camera가 안정적으로 추적하고 WebGL 빌드가 실행된다.

## V0.2 — Drift Physics

- [x] 전방/횡방향 속도 분리
- [x] 속도 + Steering + Brake 기반 Drift 진입
- [x] Grip / Side Grip / Slip 튜닝
- [x] Throttle Drift 유지
- [x] Counter Steering
- [x] Drift 상태 텔레메트리와 디버그 HUD
- [ ] 30/60/120fps 물리 결과 비교

## V0.3 — Weekly Track / Race

- [x] `WeeklyTrackManifest`와 `IWeeklyTrackProvider`
- [x] 맵 선택 UI 없는 단일 로컬 Weekly Track provider
- [x] Start / 순서 기반 Checkpoint / Finish
- [x] 전체 Race Finish Timer
- [x] 무제한 즉시 재도전
- [x] `trackVersion`, `physicsVersion`, required lap 고정
- [x] Best Finish Time과 로컬 Top 5 저장
- [x] 단순 타원에서 헤어핀·시케인·13 Checkpoint Technical Track으로 난이도 상향
- [x] Cube 시각 모델을 휠·서스펜션·범퍼·윙이 있는 RC 버기로 개선
- [x] 차량 외형·충돌체 68% 축소와 미니 RC카 Camera 프레이밍 적용
- [x] 12,584 triangles Blue Rally RC 스포츠 쿠페 FBX와 6개 단색 Material 제작
- [x] 차체·캐노피·램프·Aero·Wing·Detail·4개 Wheel 분리
- [x] 플레이어 휠 회전/앞바퀴 조향과 Ghost 휠 회전 연결
- [x] 문서 원본의 잔여 `BEST LAP` 표현을 정정한 플레이테스트 부록 작성
- [ ] 서버 지정 Weekly Track manifest 수신

## V0.4 — Replay / Ghost

- [x] 10Hz pose/input frame 기록
- [x] Replay 직렬화 버전 정의
- [x] My Best 로컬 저장/재생
- [x] Ghost interpolation
- [x] Ghost collider 미생성으로 충돌 차단
- [x] 최대 속도, 순간이동, Checkpoint skip 기본 검증
- [ ] Supabase Storage Replay 업로드/다운로드

## V0.5 — Supabase

- [ ] 개발/운영 Supabase 프로젝트 결정
- [ ] WebGL용 `UnityWebRequest` REST/RPC 경계
- [ ] `weekly_seasons`, `tracks`, `race_records`, `weekly_best_records` migration
- [ ] Storage replay 경로와 보존 정책
- [ ] RLS와 publishable/anon key 정책
- [ ] 기록 제출 Edge Function/RPC
- [ ] 운영/개발 CORS origin 등록
- [ ] `service_role` 클라이언트 미포함 검증

## V0.6 — Apps in Toss

- [x] Unity SDK `v3.0.3` 패키지 고정
- [ ] 콘솔 `appName` 확정
- [ ] `Assets > Apps in Toss > Configuration` 로컬 설정
- [ ] Visibility pause와 audio pause adapter
- [ ] Safe Area SDK adapter 검토
- [ ] 서버 시간과 사용자 키 연동
- [ ] Game Center 낮은 기록 우선 정책 재확인
- [ ] `.ait` Build & Package
- [ ] QR 실기기 테스트
- [ ] 압축 해제 크기 100MB 이하 확인

## V0.7 — Weekly Competition / Ads

- [x] 게임성 테스트용 개인 로컬 Top 5
- [ ] Weekly Leaderboard와 Top %
- [ ] 전주 마감 및 과거 순위 보존
- [ ] My Rank + 1 Ghost
- [ ] 결과/로비 광고 위치 설계
- [ ] 광고 빈도 제한
- [ ] 주행 중 광고 미노출 자동 확인

## 출시 전 결정 필요

- [ ] 게임명과 Apps in Toss `appName`
- [ ] 가로 화면 기준 해상도와 최소 지원 기기
- [ ] 첫 Weekly Track과 required lap 수
- [ ] 차량 물리 버전 정책
- [ ] 동률 처리 규칙
- [ ] 기록 무효화/긴급 패치 정책
- [ ] 개인정보/이용약관/운영 정책

## 현재 플레이테스트 판정

- [x] 코드상 Start → CP1~CP6 → Finish → Result → Restart 루프 연결
- [x] 첫 Best Replay 저장 후 다음 시도 Ghost 로드 구조 연결
- [x] 잘못된 Checkpoint 순서와 조기 Finish 거부 단위 테스트 작성
- [x] 전체 Finish Time 포맷 및 Replay 속도/순간이동 검증 테스트 작성
- [ ] Unity Console 컴파일 오류 0건 확인
- [ ] Editor Play Mode에서 실제 1회 완주
- [ ] 두 번째 시도에서 My Best Ghost 표시 확인
- [ ] WebGL Development Build 브라우저 완주
- [ ] Apps in Toss `.ait` QR 실기기 완주
