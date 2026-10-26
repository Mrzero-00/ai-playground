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
- `server/`: 로컬 PoC API(Node `node:http` + `node:sqlite`, `pnpm server`, :8787). 시각·반경 150m·정확도 판정, 불변 봉인, 멱등 재시도, 공동 캡슐 참석 확인을 서버 쪽에서 구현해 두었다(`pnpm test`가 서버 통합 테스트 60개를 함께 돌린다). **앱 화면은 아직 이 서버에 연결돼 있지 않다.** 계약(`src/shared/contracts.ts`)이 편지+사진 1장 기준이라, 1인당 5개 물건 모델로 계약을 넓힌 뒤 `src/lib/api.ts`로 붙인다.


## 문서 지도

- [제품 요구사항](docs/PRD.md): MVP 범위, 정책, 요구사항 ID와 출시 기준의 단일 기준
- [기술 아키텍처](docs/architecture.md): 상태 머신, 데이터·RLS, 서버 트랜잭션과 보안 경계
- [구현 계획](docs/IMPLEMENTATION_PLAN.md): Codex 작업 패킷, 순서, 테스트와 완료 보고 양식
- [에이전트 지침](AGENTS.md): Codex가 작업 전에 따라야 할 저장소 규칙

## 실행

Expo SDK 57은 Node.js 22.13 이상이 필요합니다.

```bash
pnpm install          # 설치 때 웹 지도 모듈이 public/maplibre/ 로 복사된다
pnpm web              # 웹으로 화면 확인 (AR·지도 네이티브 모듈 제외)
pnpm start            # 개발 빌드용 Metro (Expo Go 불가)
pnpm server           # (선택) 로컬 PoC API :8787 — 아직 앱 화면과 연결 전
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
