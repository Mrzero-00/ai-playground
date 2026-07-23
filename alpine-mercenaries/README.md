> 실사풍 알프스 세계에서 무기가 역할을 결정하는 최대 5인 3인칭 협동 액션 RPG 프로젝트입니다.

# Alpine Mercenaries

가칭 **Alpine Mercenaries**는 하나의 용병 사무실에서 파티를 구성하고, 의뢰판을 통해 서로 다른 전투 지역으로 출발하는 세션형 3D 액션 RPG입니다.

## 현재 결과물

- 대화에서 확정한 게임 비전과 시스템 문서
- Steam 출시를 염두에 둔 기술·제작 로드맵
- Unreal Engine 제작 전환 계획과 네이티브 검증 기준
- 이전 브라우저 메커니즘 프로토타입(기록·참고 전용)

## 현재 개발 상태

2026년 7월 23일부터 브라우저 프로토타입의 기능 개발과 플레이 검증을 중단했습니다. 새 게임은 Unreal Engine에서 처음부터 다시 만들며, 브라우저 결과물을 제작판 코드로 이식하지 않습니다.

- 엔진: Unreal Engine 안정 정식 버전(Preview 제외)
- 기본 시점: 배틀그라운드 계열의 3인칭 숄더뷰
- 첫 검증: Third Person 네이티브 프로젝트에서 이동·카메라·충돌·애니메이션 확인
- 완료 판정: Unreal Editor Play-In-Editor, 자동화 테스트, 패키징 빌드만 사용

현재 Epic Games Launcher 설치까지 완료되었으며, Unreal Engine 다운로드를 위해 런처에서 Epic 계정 로그인이 필요합니다. 자세한 전환 절차는 [Unreal 전환 계획](docs/05-unreal-migration.md)을 참고합니다.

## 이전 웹 프로토타입

루트의 Vite + Three.js 코드는 과거 판정 실험을 보존하기 위한 자료입니다. 최종 그래픽 품질, 캐릭터 자세, 카메라, 조작감 또는 기능 완료 여부를 판단하는 테스트 대상으로 사용하지 않습니다.

## 문서

- [게임 비전](docs/00-game-vision.md)
- [게임플레이와 콘텐츠](docs/01-gameplay-and-content.md)
- [기술 아키텍처](docs/02-technical-architecture.md)
- [개발 로드맵](docs/03-development-roadmap.md)
- [Steam 출시 체크리스트](docs/04-steam-release-checklist.md)
- [Unreal 전환 계획](docs/05-unreal-migration.md)
