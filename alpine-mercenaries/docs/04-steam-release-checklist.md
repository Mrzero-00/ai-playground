# Steam 출시 체크리스트

마지막 확인일: 2026-07-23

이 문서는 계획용이며 실제 등록 시 Steamworks의 최신 계약과 체크리스트를 다시 확인한다.

## 현재 공식 요구사항 요약

- 신규 앱마다 Steam Direct 비용 100 USD 또는 지역 통화 상당액이 필요하다. 해당 비용은 제품이 Steam 상점과 인앱 구매에서 조정 총수익 1,000 USD 이상을 달성한 뒤 회수 가능하다.
- 신규 제품은 출시 전 Coming Soon 페이지를 최소 2주 공개해야 한다.
- 상점 페이지와 게임 빌드는 Valve 검토를 받아야 한다. 공식 문서는 보통 3~5영업일이 걸리며 변경 대응을 위해 최소 7영업일 전에 제출할 것을 안내한다.
- Steamworks SDK는 콘텐츠 업로드에 필요하며, Steam 기능 통합 자체는 선택 범위가 있다.
- 빌드는 SteamPipe로 업로드하고 비공개 베타 브랜치에서 검증한 뒤 기본 브랜치로 전환할 수 있다.

## 계정과 행정

- [ ] 개인 또는 법인 명의 결정
- [ ] Steamworks 파트너 가입
- [ ] 디지털 서류, 세금과 지급 정보 완료
- [ ] 앱 비용 결제와 App ID 발급
- [ ] 게임 명칭과 상표 충돌 조사
- [ ] 개인정보 처리방침과 이용약관 준비

## 제품

- [ ] Windows 실행 파일과 필수 런타임 패키징
- [ ] 최초 실행, 종료, 해상도, 전체 화면 검증
- [ ] 키보드·마우스와 게임패드 표기 일치
- [ ] 오프라인/서버 장애 시 명확한 안내
- [ ] 저장 데이터 버전과 복구 정책
- [ ] 크래시 수집과 개인정보 동의 범위 점검
- [ ] 최소·권장 사양 실측

## 온라인

- [ ] Steam 로그인과 권한 실패 처리
- [ ] 친구 초대, 공개·비공개 1~5인 로비
- [ ] NAT와 연결 실패 안내
- [ ] 재접속과 호스트 이탈 처리
- [ ] 거래·아이템 서버 장애 시 원자적 롤백
- [ ] 치트, 봇, 신고와 제재 운영 도구

## 상점 페이지

- [ ] 최종 로고와 캡슐 이미지
- [ ] 실제 빌드에서 촬영한 스크린샷
- [ ] 실제 게임플레이 영상
- [ ] 출시 시 제공되는 기능만 명확하게 설명
- [ ] 지원 언어와 자막·음성 범위 표시
- [ ] Early Access를 사용할 경우 현재 내용과 향후 계획 구분
- [ ] Coming Soon 페이지 최소 공개 기간 확보

## 배포

- [ ] Steamworks SDK와 업로드 계정 권한 설정
- [ ] SteamPipe App/Depot 빌드 스크립트
- [ ] 개발, QA, 공개 브랜치 분리
- [ ] 설치·업데이트·삭제 후 재설치 검증
- [ ] 패치 크기를 고려해 지역·기능별 패키지 분리
- [ ] 상점 페이지와 빌드 검토 제출
- [ ] 승인 후 출시 버튼과 공개 시점 운영 계획

## 공식 참고 자료

- [Steam Direct Fee](https://partner.steamgames.com/doc/gettingstarted/appfee?language=english)
- [Coming Soon](https://partner.steamgames.com/doc/store/coming_soon?language=english)
- [Steam Review Process](https://partner.steamgames.com/doc/store/review_process?language=english)
- [Steamworks SDK](https://partner.steamgames.com/doc/sdk)
- [Uploading to Steam](https://partner.steamgames.com/doc/sdk/uploading?l=english)
- [Unreal Online Subsystem Steam](https://dev.epicgames.com/documentation/unreal-engine/online-subsystem-steam-interface-in-unreal-engine?lang=en-US)
- [Unreal Engine EULA](https://www.unrealengine.com/eula/unreal)

Unreal Engine 라이선스는 변경될 수 있다. 현재 공식 EULA는 로열티 제품이 직접 발생시킨 총수익이 1,000,000 USD를 넘기 전에는 로열티 납부 의무가 발생하지 않는다고 설명하지만, 출시 계약 시점에 최신 Royalty Addendum을 다시 검토해야 한다.
