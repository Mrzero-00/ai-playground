> 친구들과 메시지와 사진을 묻고, 약속한 날 약속한 장소에 함께 모여 여는 위치 기반 소셜 캡슐 앱.

# 묻어두지

**지금 묻고, 그때 만나서 열자.**

`묻어두지`는 저장 서비스가 아니라 다음 만남을 실제 약속으로 만드는 앱입니다. 이 저장소에는 Expo SDK 57 기반 React Native 클릭형 프로토타입이 들어 있습니다.

## 현재 구현

Expo SDK 57 기반 로컬 프로토타입. 1차 범위(시간 잠금 타임캡슐)를 `design/` 의 스티커 캡슐 디자인으로 구현했다.

- 홈: 채우는 중 · 닫힘 · 오늘 열 수 있음 · 열림 상태별 캡슐 목록과 히어로 카드
- 캡슐 만들기: 이름 + 넣기 마감(1·3·7·14일)
- 캡슐에 넣기: 편지(180자)·사진·음성(60초)·동영상(30초), **한 사람당 5개까지 종류 무관**, 마감 전 수정·삭제
- 친구 초대: 시스템 공유창으로 초대 링크 전송
- 닫기: 닫는 날부터 30~180일 사이 여는 날짜·시간(30분 단위) 선택 후 봉인
- 기다리기: D-값, 멤버별 개수, 알림 예정일
- 열기: 여는 시각 이후 10초 공동 카운트다운 → 물건을 섞인 순서로 한 개씩 꺼내기 → 다음 캡슐 제안
- 캡슐 SVG 컴포넌트 `src/components/capsule.tsx` (닫힘·열림·묻힘), 원본 SVG는 `design/capsule/`

데이터는 앱 세션 안에서만 유지되는 로컬 샘플이다. 로그인, 초대 수락, 서버 봉인·시간 판정, 미디어 업로드, 알림은 V1에서 구현한다.

### 2차 · AR 실험 (개발 빌드 전용)

[ViroReact](https://viro-community.readme.io/) 3.0(`@reactvision/react-viro`, Expo SDK 57·RN 0.86 대응)으로 AR 심기·찾기를 실험 구현했다.

- `capsule/[id]/plant`: 바닥을 인식해 탭한 자리에 캡슐을 두고, 현재 GPS와 자리 이름을 저장한다(방장, 채우는 중일 때).
- `capsule/[id]/find`: 심은 자리에서 카메라를 들면 캡슐이 보이고, GPS 거리·정확도로 안/불확실/밖을 판정한다(`src/domain/pit.ts`). 판정은 안내용이며 서버가 최종이다.
- 웹에서는 AR 대신 GPS만 쓰는 대체 화면(`*.web.tsx`)이 뜬다. AR은 연출이지 잠금 조건이 아니다.
- **Expo Go에서는 동작하지 않는다.** `npx expo prebuild` 후 `npx expo run:ios` / `run:android` 개발 빌드가 필요하다(iOS 15.1+, ARKit; Android ARCore 지원 기기).
- 지오 앵커(위·경도에 고정)는 ReactVision Platform 키가 필요해 아직 붙이지 않았다. 지금은 GPS 반경 판정 + 카메라 앞 표시까지다.
- `map`: 우리 동네 지도. 심은 캡슐이 저장 좌표 위에 떠 있고 말풍선에 남은 시간이 매초 갱신된다. 네이티브는 `react-native-maps`(Google provider, 키는 `.env`), 웹은 MapLibre + OpenFreeMap 벡터 타일(`scripts/prepare-map-assets.mjs`가 설치 때 `public/maplibre/`로 복사). 2D/3D(쿼터뷰) 전환.
- `server/`: 로컬 API(Node `node:http` + `node:sqlite`, `pnpm server`, :8787). 계약은 `src/shared/capsule-api.ts` 하나이고, 닫힘·저절로 닫힘·열기·개수 제한 판정은 `src/domain/capsule.ts` 규칙을 그대로 가져다 서버가 최종 판정한다. 아래 "서버 API" 참고.

### 서버 API

기기 세션 토큰(`Authorization: Bearer`) 하나로 접근한다. 세션은 처음엔 익명이고, 소셜 로그인(`/auth/login`)을 하면 계정에 묶인다. 같은 계정의 세션들은 같은 캡슐을 보고, 한 캡슐 안에서는 멤버 하나로 합쳐진다(물건 5칸·방장 권한·이름 공유). 로그아웃하면 그 세션은 다시 익명이 되어 그 세션이 익명일 때 들어간 캡슐만 보인다. 오류는 `{ error: { code, message } }`, 캡슐 응답에는 늘 `serverNow`가 붙는다.

| 라우트 | 하는 일 |
| --- | --- |
| `POST /sessions` `{displayName}` | 기기 세션 발급(이름 1~12자, 없으면 `나`). 토큰은 해시만 저장 |
| `PATCH /sessions/me` `{displayName}` | 내 이름 바꾸기. 로그인 상태면 계정 이름이 바뀌어 모든 기기에 따라간다 |
| `POST /auth/login` `{provider, …}` | 소셜 로그인으로 이 세션을 계정에 묶기. `google`·`apple`은 `idToken`(애플은 첫 로그인 때 `fullName`), `kakao`는 `accessToken`, `dev`는 `name`. 검증 실패 `AUTH_FAILED`(401, 제공자 서버 불통은 502), 서버에 안 켜진 제공자는 `PROVIDER_DISABLED` |
| `GET /auth/me` | `{ account \| null, displayName, providers }` — 지금 계정과 이 서버에서 쓸 수 있는 로그인 방법 |
| `POST /auth/logout` | 이 세션만 계정에서 떼기 |
| `GET /capsules` | 내가 멤버인 캡슐 전부, 최신순 |
| `POST /capsules` `{title, mode, deadlineDays, openAt, location?}` | 만들기. 마감 1·3·7·14일, 여는 날은 30~180일·마감 뒤 |
| `POST /capsules/join` `{code}` | 초대 코드로 들어가기(소문자·하이픈 OK, 최대 8명, 혼자 캡슐·닫힌 캡슐 불가) |
| `GET /capsules/:id` | 캡슐 하나. 읽을 때마다 저절로 닫힘(마감 경과·전원 5개)을 판정 |
| `POST /capsules/:id/items` · `PATCH`/`DELETE …/items/:itemId` | 물건 넣기·고치기·빼기. 내 것만, 채우는 중에만, 한 사람 5개 |
| `POST /capsules/:id/seal` · `/open` · `/plant` | 닫기(방장) · 열기(여는 시각 이후 누구나) · 심을 자리 저장(방장) |
| `GET /capsules/:id/items/:itemId/media?m&exp&sig` | 사진·음성·동영상 파일. 10분짜리 서명 URL이라 `<img>`·`<video>`가 헤더 없이 쓴다 |
| `GET /health` | 살아 있는지 + 서버 시각 |

내용물은 채우는 중에는 내 것만, 닫힌 뒤에는 아무도, 열린 뒤에는 모두 본다. 업로드는 파일 앞 바이트로 형식을 확인한다(사진 JPEG·PNG·WebP 8MB, 음성 M4A·MP3·WAV·WebM 4MB, 동영상 MP4·MOV·WebM 40MB).

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | |
| `CAPSULE_DATABASE_PATH` | `.data/capsules.sqlite` | 예전 PoC(구덩이·모임·참석) 스키마 파일이면 비우고 새로 만든다. v2(로그인 이전) 파일은 캡슐을 그대로 두고 `users` 테이블과 `sessions.user_id` 열만 더한다 |
| `CORS_ORIGINS` | (없음) | localhost 외에 허용할 웹 주소, 쉼표 구분. 예: `https://mudeodooji.vercel.app` |
| `MEDIA_SIGNING_SECRET` | 부팅마다 랜덤 | 미디어 URL 서명 키. 비우면 서버를 다시 켤 때 이전 URL이 무효가 된다(앱이 캡슐을 다시 불러오면 새 URL을 받는다) |
| `GOOGLE_CLIENT_IDS` | (없음) | 구글 로그인을 켠다. 받아들일 OAuth 클라이언트 ID(iOS·Android·웹), 쉼표 구분. 서버가 `oauth2.googleapis.com/tokeninfo`로 ID 토큰을 확인하고 `aud`가 이 목록에 있어야 통과 |
| `APPLE_CLIENT_IDS` | (없음) | 애플 로그인을 켠다. 받아들일 번들 ID·Services ID, 쉼표 구분. Apple JWKS로 RS256 서명·`iss`·`aud`·`exp`를 확인 |
| `KAKAO_ENABLED` | (꺼짐) | `1`이면 카카오 로그인을 켠다. 서버 비밀은 필요 없고 `kapi.kakao.com/v2/user/me`로 액세스 토큰을 확인한다 |
| `DEV_LOGIN` | (꺼짐) | `1`이면 이름만으로 로그인하는 `dev` 제공자를 켠다. 로컬 테스트 전용, 공개 서버에서는 절대 켜지 않는다 |


## 문서 지도

- [제품 요구사항](docs/PRD.md): MVP 범위, 정책, 요구사항 ID와 출시 기준의 단일 기준
- [기술 아키텍처](docs/architecture.md): 상태 머신, 데이터·RLS, 서버 트랜잭션과 보안 경계
- [구현 계획](docs/IMPLEMENTATION_PLAN.md): Codex 작업 패킷, 순서, 테스트와 완료 보고 양식
- [에이전트 지침](AGENTS.md): Codex가 작업 전에 따라야 할 저장소 규칙

## 백엔드 연결 방식

앱 화면은 `src/state/capsule-store.tsx` 의 스토어만 보고, 스토어는 `CapsuleBackend`(`src/state/backend.ts`) 위에서 돈다.

- `EXPO_PUBLIC_API_URL` 이 있거나 localhost·Expo 개발 서버에서 열면 **원격 백엔드**(`src/state/remote-backend.ts` → `server/`)를 쓴다. 세션 토큰은 기기에만 저장하고, 사진·음성·동영상은 base64 로 올린다.
- 그 외(배포된 Vercel 웹)는 **로컬 백엔드**(`src/state/local-backend.ts`)로 시드 데이터를 보여 준다. 새로고침하면 사라진다. 서버 호스팅이 정해지면 Vercel 에 `EXPO_PUBLIC_API_URL`, 서버에 `CORS_ORIGINS` 만 넣으면 된다.
- 두 백엔드는 같은 계약(`src/shared/capsule-api.ts`)과 같은 도메인 규칙(`src/domain/capsule.ts`)을 따른다. 닫기 조건·저절로 닫힘·열 수 있는 시각은 백엔드가 판정한다.

## 실행

Expo SDK 57은 Node.js 22.13 이상이 필요합니다.

```bash
pnpm install          # 설치 때 웹 지도 모듈이 public/maplibre/ 로 복사된다
pnpm web              # 웹으로 화면 확인 (AR·지도 네이티브 모듈 제외)
pnpm start            # 개발 빌드용 Metro (Expo Go 불가)
pnpm server           # (선택) 로컬 API :8787
```

실기기에서 Expo Go로 QR 코드를 스캔하거나 다음 명령을 사용할 수 있습니다.

```bash
pnpm ios
pnpm android
pnpm web
```

사진·동영상 촬영과 음성 녹음은 iOS·Android 시뮬레이터가 아니라 실제 기기에서 확인해야 합니다. Node 22가 아니면 `nvm use 22` 후 실행합니다.

## 검증

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## 다음 구현 단위

구현 순서는 [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)를 따른다. 다음 시작점은 `WP-00 기준선과 CI`이며, 그다음 `WP-01 공유 계약과 Supabase 기반`으로 진행한다.
