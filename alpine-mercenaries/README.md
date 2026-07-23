> 실사풍 알프스 세계에서 무기가 역할을 결정하는 최대 5인 3인칭 협동 액션 RPG 프로젝트입니다.

# Alpine Mercenaries

가칭 **Alpine Mercenaries**는 하나의 용병 사무실에서 파티를 구성하고, 의뢰판을 통해 서로 다른 전투 지역으로 출발하는 세션형 3D 액션 RPG입니다.

## 현재 결과물

- 대화에서 확정한 게임 비전과 시스템 문서
- Steam 출시를 염두에 둔 기술·제작 로드맵
- Unreal Engine 5.8 Third Person 네이티브 프로젝트
- Unreal 에셋 검증 스크립트와 네이티브 수용 기준
- 이전 브라우저 메커니즘 프로토타입(기록·참고 전용)

## 현재 개발 상태

2026년 7월 23일부터 브라우저 프로토타입의 기능 개발과 플레이 검증을 중단했습니다. 새 게임은 Unreal Engine에서 처음부터 다시 만들며, 브라우저 결과물을 제작판 코드로 이식하지 않습니다.

- 엔진: Unreal Engine 5.8.0 정식 버전
- 프로젝트: `unreal/AlpineMercenaries/AlpineMercenaries.uproject`
- 기본 시점: 배틀그라운드 계열의 3인칭 숄더뷰
- 첫 검증: Third Person 네이티브 프로젝트에서 이동·카메라·충돌·애니메이션 확인
- 완료 판정: Unreal Editor Play-In-Editor, 자동화 테스트, 패키징 빌드만 사용

Epic Games Launcher 로그인과 Unreal Engine 5.8 설치, 공식 Third Person Blueprint 템플릿 기반 프로젝트 생성을 완료했다. Xcode 26.1.1, Metal 컴파일러와 macOS 26.1 SDK를 엔진이 정상 인식한다. 엔진 커맨드릿으로 171개 프로젝트 에셋과 기본 맵을 검사해 오류 0건·경고 0건을 확인했다.

Mac Development 전체 빌드·쿠킹·스테이징·패키징·아카이브도 통과했다. 결과물은 Apple Silicon용 자체 포함 `.app`이며, 게임 콘텐츠 컨테이너와 코드 서명을 검사하고 실제 네이티브 창에서 Third Person 맵 로드와 똑바로 선 캐릭터를 확인했다.

이 단계는 엔진 부트스트랩 검증이다. 배틀그라운드형 숄더 카메라, 질주, 앉기와 파쿠르는 아직 프로젝트 고유 기능으로 구현되지 않았으므로 기본 템플릿 플레이를 해당 기능의 완료로 간주하지 않는다. 자세한 상태는 [Unreal 전환 계획](docs/05-unreal-migration.md)을 참고한다.

## Unreal 프로젝트 실행과 검증

Epic Games Launcher의 라이브러리에서 프로젝트를 열거나 다음 파일을 Unreal Editor 5.8로 연다.

```text
unreal/AlpineMercenaries/AlpineMercenaries.uproject
```

에셋과 참조 경로를 커맨드라인에서 다시 검사하려면 다음을 실행한다.

```bash
./scripts/verify-unreal-project.sh
```

Mac Development 패키지를 처음부터 다시 만들려면 다음을 실행한다. 기본 아카이브 위치는 시스템 임시 폴더의 `AlpineMercenaries-Mac-Package/Mac/AlpineMercenaries.app`이다.

```bash
./scripts/build-unreal-mac.sh
```

두 스크립트는 `/Applications/Xcode.app`의 전체 Xcode를 자동으로 선택한다. 시스템 전체 개발자 경로도 맞추려면 한 번만 `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`를 직접 실행한다.

## 이전 웹 프로토타입

루트의 Vite + Three.js 코드는 과거 판정 실험을 보존하기 위한 자료입니다. 최종 그래픽 품질, 캐릭터 자세, 카메라, 조작감 또는 기능 완료 여부를 판단하는 테스트 대상으로 사용하지 않습니다.

## 문서

- [게임 비전](docs/00-game-vision.md)
- [게임플레이와 콘텐츠](docs/01-gameplay-and-content.md)
- [기술 아키텍처](docs/02-technical-architecture.md)
- [개발 로드맵](docs/03-development-roadmap.md)
- [Steam 출시 체크리스트](docs/04-steam-release-checklist.md)
- [Unreal 전환 계획](docs/05-unreal-migration.md)
