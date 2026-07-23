> 실사풍 알프스 세계에서 무기가 역할을 결정하는 최대 5인 3인칭 협동 액션 RPG 프로젝트입니다.

# Alpine Mercenaries

가칭 **Alpine Mercenaries**는 하나의 용병 사무실에서 파티를 구성하고, 의뢰판을 통해 서로 다른 전투 지역으로 출발하는 세션형 3D 액션 RPG입니다.

## 현재 결과물

- 대화에서 확정한 게임 비전과 시스템 문서
- Steam 출시를 염두에 둔 기술·제작 로드맵
- Unreal Engine 5.8 C++ 네이티브 프로젝트
- 프로젝트 고유 숄더 카메라와 이동 버티컬 슬라이스
- HP·스태미너·조건부 MP 자원 컴포넌트와 네이티브 HUD
- Unreal 에셋·게임플레이 자동화 검증 스크립트와 네이티브 수용 기준
- 이전 브라우저 메커니즘 프로토타입(기록·참고 전용)

## 현재 개발 상태

2026년 7월 23일부터 브라우저 프로토타입의 기능 개발과 플레이 검증을 중단했습니다. 새 게임은 Unreal Engine에서 처음부터 다시 만들며, 브라우저 결과물을 제작판 코드로 이식하지 않습니다.

- 엔진: Unreal Engine 5.8.0 정식 버전
- 프로젝트: `unreal/AlpineMercenaries/AlpineMercenaries.uproject`
- 기본 시점: 배틀그라운드 계열의 3인칭 숄더뷰
- 현재 검증: C++ 캐릭터에서 이동·카메라·충돌·애니메이션 확인
- 완료 판정: Unreal Editor Play-In-Editor, 자동화 테스트, 패키징 빌드만 사용

공식 Third Person 템플릿을 C++ 게임 모듈로 전환하고 프로젝트 고유 캐릭터, 플레이어 컨트롤러와 게임 모드를 기본 맵에 연결했다. Xcode 26.1.1, Metal 컴파일러와 macOS 26.1 SDK를 엔진이 정상 인식한다. 엔진 커맨드릿으로 173개 프로젝트 에셋과 기본 맵을 검사해 오류 0건·경고 0건을 확인했다.

Mac Development 전체 빌드·쿠킹·스테이징·패키징·아카이브도 통과했다. Apple Silicon용 자체 포함 `.app`의 콘텐츠 컨테이너와 코드 서명을 검사하고, 실제 네이티브 창에서 똑바로 선 캐릭터, 카메라 기준 전진과 좌·우 어깨 전환을 확인했다.

오른쪽 어깨 기본 시점, Q 어깨 전환, 기본 시점 복귀, 카메라 기준 이동, 걷기·조깅·질주·앉기 캡슐·앉은 이동·점프와 질주 FOV를 C++로 구현했다. 생성 스크립트로 만든 전용 앉기 대기·이동 애니메이션을 적용했다. 슬라이딩과 파쿠르는 전투 핵심 검증 이후로 연기했다. 자세한 상태는 [Unreal 전환 계획](docs/05-unreal-migration.md)을 참고한다.

캐릭터는 기본 HP 100과 스태미너 100을 가지며 걷기·조깅·질주·앉은 이동, 점프와 앉기 전환이 스태미너를 소비한다. 행동을 멈춘 뒤 지연 시간을 거쳐 회복하고, 스태미너가 부족하면 질주·점프·앉기 전환을 시작할 수 없다. MP는 기본적으로 비활성화되어 HUD에도 나타나지 않으며, 이후 마법 무기 장착 시스템이 `SetManaEnabled(true)`를 호출하면 활성화된다.

## Unreal 프로젝트 실행과 검증

Epic Games Launcher의 라이브러리에서 프로젝트를 열거나 다음 파일을 Unreal Editor 5.8로 연다.

```text
unreal/AlpineMercenaries/AlpineMercenaries.uproject
```

에셋과 참조 경로를 커맨드라인에서 다시 검사하려면 다음을 실행한다.

```bash
./scripts/verify-unreal-project.sh
```

이동 설정과 입력·게임 모드 연결 자동화 테스트는 다음을 실행한다.

```bash
./scripts/test-unreal-gameplay.sh
```

Mac Development 패키지를 처음부터 다시 만들려면 다음을 실행한다. 기본 아카이브 위치는 시스템 임시 폴더의 `AlpineMercenaries-Mac-Package/Mac/AlpineMercenaries.app`이다.

```bash
./scripts/build-unreal-mac.sh
```

세 검증·빌드 스크립트는 `/Applications/Xcode.app`의 전체 Xcode를 자동으로 선택한다. 시스템 전체 개발자 경로도 맞추려면 한 번만 `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`를 직접 실행한다.

기본 키보드·마우스 조작은 WASD 이동, 마우스 시점, `Left Shift` 질주, `Left Control` 걷기, `C` 앉기 전환, `Space` 점프, `Q` 좌·우 어깨 전환, `Home` 기본 숄더 시점 복귀다.

## 이전 웹 프로토타입

루트의 Vite + Three.js 코드는 과거 판정 실험을 보존하기 위한 자료입니다. 최종 그래픽 품질, 캐릭터 자세, 카메라, 조작감 또는 기능 완료 여부를 판단하는 테스트 대상으로 사용하지 않습니다.

## 문서

- [게임 비전](docs/00-game-vision.md)
- [게임플레이와 콘텐츠](docs/01-gameplay-and-content.md)
- [기술 아키텍처](docs/02-technical-architecture.md)
- [개발 로드맵](docs/03-development-roadmap.md)
- [Steam 출시 체크리스트](docs/04-steam-release-checklist.md)
- [Unreal 전환 계획](docs/05-unreal-migration.md)
