# AR 이식 기록 (2026-10-26)

같은 저장소의 AR 프로토타입(`codex/mudeoduji-soft-ui` 브랜치, Expo 55 · ViroReact 2.57 · npm)에서
이 앱(Expo 57 · pnpm)으로 지도·AR·서버·개봉 조건을 옮겼다. 이 앱의 크림색 홈 디자인은 그대로 두고,
지도와 AR 은 별도 화면으로 붙였다. 요구는 세 가지였다.

1. **지도를 포켓몬고처럼** — 실사 OSM 타일 대신 파스텔 단색 땅, 크림색 길, 상자 모양 건물, 라벨 최소.
   카메라는 pitch 55°·bearing −28° 쿼터뷰(`src/lib/map-presentation.ts`). 네이티브는 Google 지도 JSON 스타일
   (`src/constants/map-style.ts`), 웹은 MapLibre 벡터 스타일(`src/lib/map-style.web.ts`, OpenFreeMap 타일, 키 없음).
2. **다른 지역에도 심기** — 만들기 → `지도에서 자리 고르기`(`app/pick-spot.tsx`). 서버 계약을 `location`(선택한 좌표)과
   `fix`(만든 사람의 현재 위치)로 나눴다. `fix` 는 모의 위치·오래된 측정만 거르고 거리는 보지 않으며 저장하지 않는다.
   묻을 때 AR 은 없다 — 현장에 없으니까.
3. **지도에서 캡슐을 누르면 AR** — `app/open/[id].tsx`. 서버 `eligibility` → 통과면 `CapsuleAR`(Viro 3.0.3) 에서
   바닥을 고르고 `캡슐 열기` → `/open` → 내용 화면. 미충족이면 AR 화면 안에 사유를 띄운다.

## 서버 판정 (PRD 반영)

- 반경 150m 고정 (PIT-01). 프로토타입의 50m 를 버렸다.
- 거리와 정확도를 함께 판정 (CHK-02): `거리+오차 ≤ 150` 안, `거리−오차 > 150` 밖, 사이는 `UNCERTAIN_LOCATION`(실패 아님, 재측정).
  오차 80m 초과는 `INACCURATE_LOCATION`. 앱의 `src/domain/pit.ts#classifyRevealRadius` 를 서버가 그대로 쓴다.
- 그 외 프로토타입 규칙 유지: 서버 시각, 30초 신선도, 모의 위치 거부, 불변 봉인, 멱등 키, 공동 캡슐 전원 참석(20초 TTL).

## 검증

- `pnpm check`: 타입·린트(React Compiler 규칙 포함)·단위 8 + 서버 통합 60 통과.
- `pnpm build:web`: 9개 라우트 내보내기.
- `scripts/web-smoke.cjs`: 서버에 캡슐 3개(서울 2, 부산 1)를 심고 393×852 로 홈 → 지도(쿼터뷰·캡슐 3개) → 캡슐 탭 → 웹 안내
  → 새 구덩이 → 지도 핀 → 봉인 → 상세까지. 봉인된 좌표가 현재 위치가 아니라 찍은 핀인지 서버에서 확인.
- `expo prebuild --platform all`: Info.plist 권한 문구 전부 한국어, ViroReact pod 연결, Android `com.google.ar.core=optional`.

**실기기 AR 은 미검증이다.** 연결된 iPhone/Android 가 없고 ARKit 은 시뮬레이터에서 돌지 않는다. 다음 순서:
① Xcode > Settings > Components 에서 iOS 26.x 설치 → ② iPhone 연결·개발자 모드 → ③ `pnpm server` + `pnpm ios`
→ ④ 묻기(지도 핀) → 15초 테스트 → 지도에서 캡슐 탭 → 바닥 인식 → `캡슐 열기`. Google 지도 키는 `.env` 에.

## 알려진 한계

- 같은 좌표의 캡슐은 서로 겹친다(자동 묶음 없음). 확대하거나 목록에서 고른다.
- 웹 지도는 OpenFreeMap 공용 타일을 쓴다. 자동 테스트에서 지도를 반복 이동·확대하지 않는다.
- 사진·편지만 옮겼다. 프로토타입의 음성·영상·모임 화면은 서버에만 남아 있고 앱 화면은 없다.
- 운영 서버(Supabase)는 다음 단계. `docs/architecture.md` 가 기준이다.
