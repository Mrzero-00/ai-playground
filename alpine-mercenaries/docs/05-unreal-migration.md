# Unreal Engine 전환 계획

## 결정

Alpine Mercenaries의 제작과 테스트는 Unreal Engine으로 통일한다. 기존 Vite + Three.js 프로토타입은 삭제하지 않고 설계 기록으로만 보존하며, 새 프로젝트는 코드를 옮기지 않고 Unreal Engine에서 처음부터 만든다.

## 엔진 선택 이유

- 사실적인 인물, 장비와 알프스 자연환경을 목표로 하는 렌더링 파이프라인
- 캐릭터 애니메이션, 물리, 충돌과 몬스터 부위 판정 도구
- Blueprint를 이용한 빠른 전투 반복과 C++를 이용한 장기 구조화
- Windows 패키징과 Steam 세션 연동을 고려한 제작 경로

## 현재 개발기 점검

- 하드웨어: Apple M4 Mac mini, 메모리 24GB
- 저장 공간: Unreal 설치와 초기 프로젝트를 진행할 여유 공간 확인
- Epic Games Launcher: 설치와 계정 로그인 완료
- Unreal Engine: 5.8.0 정식 버전 설치 완료, `/Users/Shared/Epic Games/UE_5.8`
- 네이티브 프로젝트: 공식 Third Person 템플릿을 C++ 런타임 모듈로 전환 완료
- Git 대용량 파일: Git LFS 3.7.1 활성화
- Xcode: 26.1.1 전체 앱 설치 완료, Metal 컴파일러와 macOS 26.1 SDK 확인
- Xcode 선택: 저장소 스크립트가 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`를 자동 사용

24GB 메모리에서도 작은 버티컬 슬라이스는 진행할 수 있지만 대규모 Nanite 환경, 고해상도 텍스처와 에디터 동시 도구 사용은 메모리 압박을 측정하며 제한한다. 최종 Windows Shipping 빌드는 별도의 Windows 실기기에서 검증한다.

## 전환 순서

1. Epic Games Launcher 로그인과 Unreal Engine 5.8.0 설치를 완료한다. 완료.
2. `unreal/AlpineMercenaries`에 Third Person Blueprint 템플릿 프로젝트를 만든다. 완료.
3. 기본 맵과 프로젝트 에셋 참조를 엔진 커맨드릿으로 검사한다. 완료.
4. Xcode 26.1.1 전체 앱을 설치하고 `DEVELOPER_DIR` 개발자 경로를 확인한다. 완료. UE 5.8과 호환되지 않는 26.4는 사용하지 않는다.
5. 프로젝트를 Unreal Editor에서 열고 기본 맵을 Play-In-Editor로 검증한다. 미완료.
6. 배틀그라운드형 숄더 카메라를 프로젝트 고유 카메라로 구현한다. 완료.
7. 걷기, 질주, 앉기 캡슐·전용 애니메이션과 점프를 구현한다. 완료. 파쿠르와 슬라이딩은 후순위로 연기.
8. 네이티브 개발 빌드·패키징과 게임플레이 자동화 테스트를 실행한다. 완료.
9. 관련 파일만 커밋하고 GitHub에 푸시한다.

## 2026-07-23 네이티브 부트스트랩 검증

- 엔진 시작과 프로젝트 로드: 통과
- `/Game/ThirdPerson/Lvl_ThirdPerson` 맵 검사: 오류 0건, 경고 0건
- 프로젝트 에셋 Data Validation: 171개 검사, 오류 0건, 경고 0건
- 캐릭터 메시, 애니메이션, Enhanced Input과 레벨 프로토타이핑 참조: 로드 통과
- Xcode 26.1.1, Metal과 macOS 26.1 SDK: Unreal이 유효한 Mac 툴체인으로 인식
- Mac Development BuildCookRun: 빌드·쿠킹 587개 패키지·스테이징·Pak·패키징·아카이브 통과
- 자체 포함 앱: 858MB, Apple Silicon arm64, 게임 콘텐츠 컨테이너 포함, 코드 서명 검증 통과
- 네이티브 실행: `/Game/ThirdPerson/Lvl_ThirdPerson` 로드, 기본 게임 모드와 Enhanced Input 초기화 통과
- 시각 검사: 캐릭터가 눕거나 기울지 않고 정상 자세로 생성되며 기본 3인칭 추적 카메라 표시
- 당시 미검증: Play-In-Editor 조작, 프로젝트 고유 이동, 질주·앉기·파쿠르, 게임플레이 자동화

반복 에셋 검증 명령은 `scripts/verify-unreal-project.sh`, 전체 Mac 패키징 명령은 `scripts/build-unreal-mac.sh`다. 기본 설치 위치가 다르면 `AM_UNREAL_EDITOR_CMD` 또는 `AM_UNREAL_RUN_UAT`에 절대 경로를 지정한다. 패키지 아카이브 위치는 `AM_UNREAL_ARCHIVE_DIR`로 바꿀 수 있다.

Xcode 버전 기준은 [Epic의 UE 5.8 macOS 개발 요구사항](https://dev.epicgames.com/documentation/en-us/unreal-engine/macos-development-requirements-for-unreal-engine)을 따른다. 공식 표의 최소 버전은 16.4, 권장 버전은 26.1.1이며 26.4는 호환되지 않는다.

## 2026-07-23 네이티브 이동 버티컬 슬라이스 검증

- C++ 런타임: `AlpineMercenaries` 게임·에디터 타깃과 모듈 컴파일 통과
- 기본 게임 흐름: `AlpineGameMode`, `AlpinePlayerController`, `AlpineMercenaryCharacter`를 기본 맵에 연결
- 카메라: 오른쪽 어깨 기본값, Q 좌·우 전환, 충돌·위치·회전 지연과 질주 FOV 적용
- 이동: 카메라 기준 WASD, 걷기 220cm/s, 조깅 450cm/s, 질주 650cm/s, 앉기 200cm/s와 점프 적용
- 자원: 복제 가능한 HP·스태미너·조건부 MP 컴포넌트, 행동별 소비·지연 회복과 네이티브 HUD 적용
- 자동화: `AlpineMercenaries.Locomotion.Configuration`, `AlpineMercenaries.Vitals.Resources` 테스트 통과
- 에셋: 173개 Data Validation 오류 0건·경고 0건
- 패키지: Mac Development 전체 BuildCookRun과 코드 서명 검증 통과
- 네이티브 실행: Metal/Apple M4 렌더러 초기화, 기본 맵 로드, HP·스태미너 HUD와 W 이동 중 스태미너 100→67 감소를 실제 창에서 확인
- 앉기 애니메이션: 생성 스크립트와 전용 대기·전진 애니메이션을 적용하고 네이티브 창에서 자세 확인
- 남은 작업: 게임패드 실기기와 Play-In-Editor 수동 검증. 낮은 장애물 넘기·파쿠르·슬라이딩은 전투 핵심 이후의 후순위 백로그

반복 게임플레이 설정 검증 명령은 `scripts/test-unreal-gameplay.sh`다.

## 2026-07-23 네이티브 무기 기반 검증

- 공통 시스템: `AlpineWeaponComponent`가 장착 무기, 역할, 행동 상태, 스태미너, 재사용 대기시간과 히트 수를 관리
- 검과 방패: 기본 근접 스윕과 전방 가드 영역·유지 스태미너 구현
- 활: 카메라 방향 원거리 라인 트레이스, 정밀 조준 카메라와 피해 증폭 구현
- 대검: 넓은 근접 스윕과 유지형 충전·다음 공격 피해 증폭 구현
- 입력: 숫자 `1`~`3` 교체, 좌클릭 기본 공격, 우클릭 역할 행동과 게임패드 대응
- 네트워크 기반: 서버 RPC와 장착·행동 상태 복제 필드 추가
- 표현: 캐릭터 손 뼈에 부착되는 기능 검증용 임시 무기 외형과 HUD 상태 표시
- 자동화: `AlpineMercenaries.Weapons.Foundation`을 포함한 3개 테스트를 GUI 없이 통과

## 다음 구현 순서

기본 이동과 공통 무기 기반, 검방·활·대검의 시작 행동을 완료했다. 다음은 첫 몬스터의 이동·표적·HP·자세·부위 상태, 몬스터의 휘두르기·돌진·브레스, 방향 방어와 아군 보호 모션, 활의 부위별 약점 공격 순서로 진행한다. 뒤 단계 기능을 먼저 넣어 앞 단계의 미완료 상태를 가리지 않는다.

파쿠르와 슬라이딩은 삭제하지 않고 전투 핵심 뒤로 연기한다. 실제 전투 맵에서 지형 기믹의 필요성이 확인되면 낮은 장애물 넘기, 창문 통과, 턱 오르기와 슬라이딩을 독립된 이동 확장 단계로 구현한다.

## 첫 네이티브 수용 기준

- 캐릭터 캡슐과 메시 방향이 일치하며 눕거나 기울어진 채 생성되지 않는다.
- 카메라는 캐릭터 뒤 어깨에 위치하고 마우스로 회전한다.
- 이동 방향은 카메라의 수평 방향을 기준으로 계산한다.
- 걷기, 달리기, 앉기와 점프 사이의 캡슐 높이 및 애니메이션이 일치한다.
- 바닥, 경사, 계단과 낮은 장애물에서 충돌이 안정적이다.
- 에디터 재생 종료 후 오류가 남지 않는다.
- 개발 빌드가 성공하고 자동화 테스트 결과가 기록된다.

현재 앉기 캡슐과 카메라 높이, 전용 앉기 대기·이동 포즈가 함께 전환된다.

## 사용하지 않는 완료 판정

- 브라우저 화면 캡처
- Vite 개발 서버 또는 웹 빌드 성공
- Three.js 캐릭터와 카메라 동작
- 최종 품질을 나타내지 않는 원시 도형 장면의 외관

웹 프로토타입의 소스는 요구사항을 추적할 때만 참고하며, 이후 기능 완료 보고에는 포함하지 않는다.
