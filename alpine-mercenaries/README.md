> 실사풍 알프스 세계에서 무기가 역할을 결정하는 최대 5인 쿼터뷰 협동 액션 RPG 프로젝트입니다.

# Alpine Mercenaries

가칭 **Alpine Mercenaries**는 하나의 용병 사무실에서 파티를 구성하고, 의뢰판을 통해 서로 다른 전투 지역으로 출발하는 세션형 3D 액션 RPG입니다.

## 현재 결과물

- 대화에서 확정한 게임 비전과 시스템 문서
- Steam 출시를 염두에 둔 기술·제작 로드맵
- 브라우저에서 실행되는 3D 메커니즘 프로토타입
- 쿼터뷰 이동, 달리기, 앉기, 점프, 낮은 장애물 넘기
- 용병 사무실의 의뢰판과 알프스 전투 맵 전환
- 검과 방패의 방향 방어 및 아군 보호
- 활의 보스 부위 조준

프로토타입은 게임의 최종 그래픽 품질을 나타내지 않습니다. 제작판은 Unreal Engine 기반을 목표로 하며, 현재 버전은 조작과 전투 규칙을 빠르게 검증하기 위한 샌드박스입니다.

## 실행

```bash
pnpm install
pnpm dev
```

개발 중 전투 장면을 바로 열려면 `http://localhost:5173/?scene=mission`을 사용합니다.

배포 빌드 확인:

```bash
pnpm test
pnpm check
pnpm build
pnpm preview
```

## 조작

- `WASD`: 이동
- `Shift`: 전력 질주
- `Ctrl`: 앉기
- `Space`: 점프 / 낮은 장애물 넘기
- `E`: 의뢰판 상호작용
- `1`: 검과 방패
- `2`: 활
- `마우스`: 바라보기 및 조준
- `우클릭`: 방패 들기 / 활 정밀 조준
- `좌클릭`: 근접 공격 / 활 발사
- `F`: 방패를 든 상태에서 완벽 쳐내기
- `R`: 쓰러진 뒤 다시 시작
- `H`: 전투 지역에서 용병 사무실로 복귀

## 문서

- [게임 비전](docs/00-game-vision.md)
- [게임플레이와 콘텐츠](docs/01-gameplay-and-content.md)
- [기술 아키텍처](docs/02-technical-architecture.md)
- [개발 로드맵](docs/03-development-roadmap.md)
- [Steam 출시 체크리스트](docs/04-steam-release-checklist.md)
