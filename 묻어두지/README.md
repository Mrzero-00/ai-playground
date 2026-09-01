> 친구들과 메시지와 사진을 묻고, 약속한 날 약속한 장소에 함께 모여 여는 위치 기반 소셜 캡슐 앱.

# 묻어두지

**지금 묻고, 그때 만나서 열자.**

`묻어두지`는 저장 서비스가 아니라 다음 만남을 실제 약속으로 만드는 앱입니다. 이 저장소에는 Expo SDK 57 기반 React Native 클릭형 프로토타입이 들어 있습니다.

## 현재 구현

- 브랜드 홈과 대기 중인 구덩이 목록
- `한 달 뒤 우리 예언` 구덩이 생성 흐름
- foreground 위치 권한 요청과 현재 장소 등록
- 카메라 권한 요청, 사진 촬영, 예언 작성
- 대기 화면과 참여 진행 상태
- 망원한강공원 기준 150m 현장 체크인 데모
- 생성 값과 촬영 기여를 현재 앱 세션에서 유지하는 로컬 프로토타입 상태
- iOS, Android, web 라우팅

현재 데이터는 제품 흐름을 확인하기 위한 로컬 샘플이며 앱을 종료하면 사라집니다. 로그인, 초대, 영구 저장, 서버 시간 잠금, 공동 공개는 Supabase와 제한된 Cloud Run 작업 계층을 연결하는 V1에서 구현합니다. 운영 아키텍처와 보안 경계는 [docs/architecture.md](docs/architecture.md)에 정리했습니다.

## 문서 지도

- [제품 요구사항](docs/PRD.md): MVP 범위, 정책, 요구사항 ID와 출시 기준의 단일 기준
- [기술 아키텍처](docs/architecture.md): 상태 머신, 데이터·RLS, 서버 트랜잭션과 보안 경계
- [구현 계획](docs/IMPLEMENTATION_PLAN.md): Codex 작업 패킷, 순서, 테스트와 완료 보고 양식
- [에이전트 지침](AGENTS.md): Codex가 작업 전에 따라야 할 저장소 규칙

## 실행

Expo SDK 57은 Node.js 22.13 이상이 필요합니다.

```bash
pnpm install
pnpm start
```

실기기에서 Expo Go로 QR 코드를 스캔하거나 다음 명령을 사용할 수 있습니다.

```bash
pnpm ios
pnpm android
pnpm web
```

카메라는 iOS·Android 시뮬레이터가 아니라 실제 기기에서 확인해야 합니다.

## 검증

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## 다음 구현 단위

구현 순서는 [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)를 따른다. 다음 시작점은 `WP-00 기준선과 CI`이며, 그다음 `WP-01 공유 계약과 Supabase 기반`으로 진행한다.
