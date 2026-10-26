> 친구들과 메시지와 사진을 묻고, 약속한 날 약속한 장소에 함께 모여 여는 위치 기반 소셜 캡슐 앱.

# 묻어두지

**지금 묻고, 그때 만나서 열자.**

`묻어두지`는 저장 서비스가 아니라 다음 만남을 실제 약속으로 만드는 앱입니다. 이 저장소에는 Expo SDK 57 기반 React Native 클릭형 프로토타입이 들어 있습니다.

## 현재 구현

- 브랜드 홈: 서버에 봉인된 구덩이 목록, 공개 가능한 구덩이를 맨 앞에
- **동네 지도**(`/map`): 포켓몬고처럼 기울어진 파스텔 지도 위에 캡슐이 떠 있고, 말풍선에 남은 시간이 매초 갱신. 네이티브는 Google 지도 커스텀 스타일, 웹은 MapLibre + OpenFreeMap 벡터 타일
- **어디에든 묻기**: 만들기에서 지도를 눌러 핀을 찍거나 현재 위치를 쓴다. 묻을 때는 그 자리에 없어도 된다. 사진 한 장 + 180자
- **지도에서 눌러 꺼내기**(`/open/[id]`): 서버가 시간·반경 150m·GPS 정확도를 판정하고, 통과하면 카메라 AR 에 캡슐이 나타나 `캡슐 열기`. 미충족이면 왜 안 되는지(며칠 남음 / 몇 m 떨어짐 / 오차 큼)를 보여준다
- 로컬 PoC 서버(`server/`): 기기 세션, 불변 봉인, 멱등 재시도, 공동 캡슐 참석 확인. SQLite 한 파일
- iOS, Android, web 라우팅. 웹은 화면 확인용 — 묻기까지만 되고 AR 은 실기기 개발 빌드

로그인, 초대 웹, 정족수·QR, Supabase 는 아직 없습니다. 운영 아키텍처와 보안 경계는 [docs/architecture.md](docs/architecture.md)에 정리했습니다. 2026-10-26 이식 기록은 [docs/AR_PORT.md](docs/AR_PORT.md)에 있습니다.

## 문서 지도

- [제품 요구사항](docs/PRD.md): MVP 범위, 정책, 요구사항 ID와 출시 기준의 단일 기준
- [기술 아키텍처](docs/architecture.md): 상태 머신, 데이터·RLS, 서버 트랜잭션과 보안 경계
- [구현 계획](docs/IMPLEMENTATION_PLAN.md): Codex 작업 패킷, 순서, 테스트와 완료 보고 양식
- [에이전트 지침](AGENTS.md): Codex가 작업 전에 따라야 할 저장소 규칙

## 실행

Expo SDK 57은 Node.js 22.13 이상이 필요합니다. 설치하면 웹용 MapLibre 모듈이 `public/maplibre/` 에 복사됩니다.

```bash
pnpm install
pnpm server        # 터미널 1: 로컬 PoC API (:8787)
pnpm start         # 터미널 2: Metro (개발 빌드용)
```

AR 과 지도는 네이티브 모듈이라 **Expo Go 로는 안 되고 개발 빌드가 필요합니다.** iPhone 을 연결하고:

```bash
cp .env.example .env   # Google 지도 키(선택), API 주소
pnpm ios               # expo run:ios --device
pnpm android           # expo run:android --device
pnpm web               # 브라우저 화면 확인용
```

Google Maps 키가 없으면 iOS 는 Apple 기본 지도(스타일 없음), Android 는 지도 대신 링크를 보여줍니다. ARKit/ARCore 는 시뮬레이터에서 동작하지 않습니다.

## 검증

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## 다음 구현 단위

구현 순서는 [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)를 따른다. 다음 시작점은 `WP-00 기준선과 CI`이며, 그다음 `WP-01 공유 계약과 Supabase 기반`으로 진행한다.
