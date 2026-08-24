# 냥BTI App in Toss 출시 체크리스트

최종 확인일: **2026-08-24 (Asia/Seoul)**

이 문서는 공식 App in Toss 개발자센터의 현재 내용을 냥BTI 비게임 WebView에 맞춰 정리한 실무 체크리스트다. 정책·SDK·최소 토스 앱 버전은 수시로 바뀔 수 있다.

> **필수 TODO:** 실제 SDK 설치 전과 검토 요청 직전에 아래 공식 문서를 다시 열어 최신 요구사항, SDK major, 패키지명, 최소 토스 앱 버전, 광고 테스트 ID, Origin을 재확인한다. 이 문서의 날짜나 버전 값을 장기 고정값으로 사용하지 않는다.

## 1. 필수 공식 자료

- [사용자가 지정한 운영/테스트 URL](https://developers-apps-in-toss.toss.im/guide/operation/toss) — 이전 경로일 수 있으므로 현재 문서로의 이동 여부를 확인한다.
- [토스앱 테스트하기](https://developers-apps-in-toss.toss.im/development/test/toss.html)
- [미니앱 출시](https://developers-apps-in-toss.toss.im/development/deploy.html)
- [비게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-nongame.html)
- [서비스 오픈 정책](https://developers-apps-in-toss.toss.im/intro/guide)
- [기존 웹 프로젝트에 SDK 연동하기](https://developers-apps-in-toss.toss.im/tutorials/webview)
- [WebView 설정](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/Config)
- [내비게이션 바 설정](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/UI/NavigationBar)
- [뒤로가기 이벤트](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B4%EB%B2%A4%ED%8A%B8%20%EC%A0%9C%EC%96%B4/back-event)
- [화면 닫기](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/closeView)
- [Safe Area](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%ED%99%94%EB%A9%B4%20%EC%A0%9C%EC%96%B4/safe-area)
- [WebView 속성](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%86%8D%EC%84%B1%20%EC%A0%9C%EC%96%B4/webview-props)
- [인앱 광고 소개](https://developers-apps-in-toss.toss.im/ads/intro.html)
- [광고 개발·정책](https://developers-apps-in-toss.toss.im/ads/develop.html)
- [배너 광고(WebView)](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/BannerAd)
- [통합 전면형·보상형 광고](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/IntegratedAd)

## 2. 빌드 방식과 정적 실행

- [x] `next.config.ts`에 `output: "export"`가 적용되어 있다.
- [x] 이미지 최적화 서버에 의존하지 않도록 정적 이미지 설정을 사용한다.
- [x] 모든 App Router 경로가 빌드 시 정적 페이지로 확정된다.
- [x] 요청 시점 서버 데이터, 서버 액션, Route Handler, SSR API를 사용하지 않는다.
- [x] `pnpm build`가 `out/`을 생성한다. 2026-08-24 빌드 기준 약 14MB다.
- [ ] App in Toss 테스트 환경에서 새로고침·직접 URL 진입이 정상인지 확인한다.
- [ ] App in Toss SDK/CLI를 설치하고 현재 공식 방식으로 `.ait` 번들을 생성한다.
- [ ] `.ait` 번들의 **압축 해제 기준 용량이 100MB 이하**인지 측정한다.
- [ ] 실행에 꼭 필요한 자산만 번들에 포함하고 큰 이미지·영상·사운드는 CDN 또는 지연 로딩으로 분리한다.

비게임 출시 가이드는 SSR을 허용하지 않고 CSR 또는 SSG를 요구한다. Next.js를 유지하더라도 서버 런타임 없이 완결되는 정적 앱이어야 한다.

## 3. 콘솔과 SDK 설정

- [ ] 콘솔에 냥BTI 미니앱을 등록하고 발급된 정확한 `appName`을 사용한다.
- [ ] `granite.config.ts`의 국문 표시명, 로고 URL, 브랜드 색을 콘솔 값과 일치시킨다.
- [ ] WebView 유형을 비게임용 `partner`로 설정한다.
- [ ] 실제 도입 시점의 최신 SDK major와 마이그레이션 공지를 확인한다.
- [ ] SDK 기능별 문서의 최소 버전은 패키지 전체의 최신 권장 버전과 같다고 가정하지 않는다.
- [ ] 권한은 실제 필요한 항목만 선언한다. 현재 냥BTI MVP는 기본 설문 흐름에 네이티브 권한이 필요하지 않다.

현재 공식 출시 문서는 SDK 3.x Origin도 별도로 안내하지만 일부 API 문서는 기능별 1.x/2.x 최소 버전을 표시한다. 통합 시 공식 설치 가이드와 릴리즈 노트를 함께 확인한다.

## 4. 내비게이션과 뒤로가기

- [ ] App in Toss 비게임 내비게이션 바를 사용한다.
- [ ] `navigationBar.withBackButton`을 켜고 모든 내부 화면에서 정상 동작하는지 확인한다.
- [ ] 콘솔에 등록한 국문 앱 이름과 로고가 내비게이션에 표시된다.
- [ ] 홈 버튼을 사용할 경우 첫 화면으로 이동하며 커스텀 기능과 중복시키지 않는다.
- [ ] 우측 액세서리 버튼은 최대 1개이며 모노톤 아이콘만 사용한다.
- [ ] 더보기 메뉴의 신고·공유 등 토스 공통 기능이 열린다.
- [ ] 토스 네이티브 뒤로가기와 자체 `AppHeader` 뒤로가기 버튼을 동시에 노출하지 않는다.
- [ ] `/profile`, 문항 중간, 마지막 문항, `/result`에서 뒤로가기 흐름을 각각 검증한다.
- [ ] 첫 화면에서 뒤로가기를 누르면 미니앱이 종료된다.
- [ ] 앱 스킴 또는 하위 경로로 직접 진입한 뒤에도 뒤로가기가 정상 동작한다.
- [ ] iOS 스와이프 뒤로가기와 Android 시스템 뒤로가기의 동작을 실제 기기에서 확인한다.

`graniteEvent.addEventListener('backEvent', ...)`를 등록하면 기본 뒤로가기가 차단된다. 커스텀 구독을 사용할 때는 반드시 다음 화면 동작을 직접 실행하고, `onError`를 처리하며, 컴포넌트 언마운트 시 구독을 해제한다. 첫 화면 종료는 공식 `closeView()`를 사용한다.

## 5. Safe Area와 모바일 WebView

- [x] viewport에 `viewport-fit=cover`, `maximum-scale=1`이 설정되어 있다.
- [ ] `SafeAreaInsets.get()`으로 최초 상·우·하·좌 여백을 읽는다.
- [ ] `SafeAreaInsets.subscribe()`로 화면 모드와 inset 변경을 반영한다.
- [ ] inset 값을 CSS 변수로 전달해 상단 UI와 하단 고정 CTA에 적용한다.
- [ ] iPhone Dynamic Island, 노치, Android 카메라 홀, 하단 홈 인디케이터를 침범하지 않는다.
- [ ] 320px 폭, 긴 고양이 이름, 큰 글자, 키보드 표시 상태에서 UI가 잘리지 않는다.
- [ ] 지도처럼 필수인 경우가 아니므로 핀치 줌을 비활성화한다.
- [ ] 라이트 모드에서 모든 텍스트·버튼 대비를 확인한다.
- [ ] 스크롤·터치·화면 전환 반응이 2초 이상 지연되지 않는다.

현재 Safe Area 권장 API는 WebView SDK 1.4.7부터 제공되는 `SafeAreaInsets.get()`과 `subscribe()`다. 이전 `getSafeAreaInsets()`는 1.4.7부터 deprecated다.

## 6. 보안과 서비스 정책

- [ ] `eval`, 원격에서 받은 코드 실행, 동적 스크립트 주입을 사용하지 않는다.
- [ ] `window.location.replace` 등으로 브라우저 히스토리를 조작해 외부 자사 사이트로 보내지 않는다.
- [ ] 모든 API는 HTTPS, WebSocket은 WSS만 사용한다.
- [ ] 민감 정보가 추가되면 클라이언트 저장을 피하고 서버 저장 시 암호화한다.
- [ ] 미니앱의 핵심 기능은 외부 사이트에 의존하지 않고 앱 안에서 완결된다.
- [ ] 자사 앱 설치, 외부 결제, 불필요한 외부 랜딩을 유도하지 않는다.
- [ ] 로그인 기능을 추가한다면 허용된 토스 로그인만 사용한다.
- [ ] 개인정보·권한을 추가하기 전에 고지와 동의, 거부 fallback을 구현한다.
- [ ] 냥BTI와 집사 궁합을 과학적 검사 또는 수의학적 진단으로 표현하지 않는다.
- [ ] Behavior Check가 질병을 확정하지 않고 지속되는 변화에 전문가 상담을 안내한다.
- [ ] 시작 직후 바텀시트나 강제 행동 유도 UI를 자동으로 띄우지 않는다.
- [ ] CTA 문구만 보고도 다음 동작을 예측할 수 있다.

## 7. QR 테스트와 딥링크

- [ ] `.ait`를 콘솔에 업로드한 뒤 테스트를 최소 1회 완료한다. 완료 전에는 검토 요청 버튼이 활성화되지 않는다.
- [ ] QR 테스트 기기가 토스에 로그인되어 있다.
- [ ] 테스트 계정이 해당 워크스페이스 멤버다.
- [ ] QR 테스트 사용자가 만 19세 이상이다.
- [ ] 업로드마다 새로 발급되는 `deploymentId`를 사용한다.
- [ ] 출시 전에는 QR의 테스트 스킴과 필수 `_deploymentId` 파라미터를 사용한다.
- [ ] 정식 `intoss://` 스킴은 출시 후에만 접근 가능하다는 전제로 테스트한다.
- [ ] path와 query를 붙일 때 query 값을 URL 인코딩한다.
- [ ] 프로필, 문항, 결과 직접 진입과 잘못된 상태의 복구 흐름을 시험한다.

## 8. 테스트/라이브 Origin과 네트워크

- [ ] 배포할 SDK major를 확정한 뒤 서버 CORS 허용 목록을 설정한다.
- [ ] QR 테스트와 실제 라이브 환경에서 각각 API를 호출한다.
- [ ] 로그인·세션 유지, 외부 리소스, CDN, 공유, 광고를 실제 토스 앱에서 재검증한다.
- [ ] 네트워크 실패 시 재시도 또는 사용자 안내가 있고 빈 화면에 머물지 않는다.

2026-08-24 확인 기준 현재 공식 출시 문서의 Origin:

| 환경 | Origin |
| --- | --- |
| 라이브 | `https://<appName>.apps.tossmini.com` |
| QR 테스트 | `https://<appName>.private-apps.tossmini.com` |

개발자센터의 경로와 안내가 개편될 수 있으므로 이 값은 실제 연동 직전에 다시 확인한다.

## 9. Toss Ads adapter와 수명주기

- [x] 광고 UI와 SDK 호출 사이에 adapter 경계가 있다.
- [x] 현재 adapter는 네트워크 요청을 만들지 않는 placeholder다.
- [x] 운영 빌드의 미지원 환경에서는 placeholder와 빈 광고 높이를 남기지 않는다.
- [ ] 콘솔에 사업자·정산 정보를 등록하고 검토를 완료한다.
- [ ] 광고 그룹을 생성하고 발급까지의 대기 시간을 고려해 공식 광고 그룹 ID를 준비한다.
- [ ] 외부 광고 네트워크를 직접 연동하지 않고 App in Toss가 허용하는 전면형·보상형·배너만 사용한다.
- [ ] 개발과 검수에는 반드시 공식 테스트 광고 ID만 사용한다.
- [ ] 일반 브라우저와 미지원 토스 앱에서는 안전한 `noop`으로 동작한다.
- [ ] `isSupported()`와 토스 앱 버전을 모두 확인한다.

### 배너

- [ ] `TossAds.initialize` 완료 뒤 `attachBanner`를 호출한다.
- [ ] 라우트 이탈과 컴포넌트 언마운트에서 반환된 `destroy()` 또는 `destroyAll()`로 제거한다.
- [ ] 배너는 스크롤 가능한 결과 화면의 명확한 빈 영역에만 둔다.
- [ ] 콘텐츠나 CTA와 겹치지 않고 광고임을 명확히 표시한다.
- [ ] 클릭 후 뒤로가기가 정상이며 설문·공유 흐름을 막지 않는다.

확인 당시 배너 광고 문서 기준은 WebView SDK 1.11.0, 토스 앱 5.241.0 이상이다. 5.241.0 미만에서는 빈 화면이 생길 수 있으므로 반드시 지원 여부 fallback을 둔다.

### 전면형·보상형

- [ ] 통합 광고 SDK를 우선 사용한다.
- [ ] `load → loaded 이벤트 → show → 다음 load` 순서를 지킨다.
- [ ] 노출 시점보다 앞선 안정적인 화면에서 미리 로드한다.
- [ ] 시작, 인트로, 로딩, 모달, 예측하기 어려운 순간에 노출하지 않는다.
- [ ] 광고 종료 뒤 원래 결과 화면으로 정상 복귀한다.

현재 광고 개발 문서는 Toss Ads와 Google AdMob을 하나의 통합 SDK로 다루는 인앱 광고 2.0 ver2를 안내한다. 실제 연동 시점의 공식 패키지·지원 버전·테스트 ID와 `isSupported()` 방식을 다시 확인한다.

### 금지 사항

- [ ] SDK 클릭·노출 이벤트 또는 호출 순서를 변조하지 않는다.
- [ ] 자동 클릭, 자동 새로고침, 강제 리다이렉션을 넣지 않는다.
- [ ] 광고를 위해 뒤로가기를 차단하거나 dead-end 화면을 만들지 않는다.
- [ ] 광고 색상, 크기, CTA, 라벨을 임의로 바꾸지 않는다.
- [ ] 광고 클릭 보상 문구나 참여 유도 이벤트를 붙이지 않는다.
- [ ] 다른 콘텐츠 뒤에 숨기거나 위에 겹치지 않는다.

## 10. 검토 요청과 출시

- [ ] 비게임 출시 가이드의 공통·기능별 항목을 모두 점검한다.
- [ ] 콘솔에 등록한 “앱 내 기능”이 실제 미니앱에서 모두 완결되고 스킴으로 열린다.
- [ ] 한 번에 한 버전만 검토 요청한다.
- [ ] 수정이 필요하면 검토를 취소하고 새 `.ait`를 올린 뒤 다시 요청한다.
- [ ] 반려 사유를 해결한 새 번들로 재검토를 요청한다.
- [ ] 검토 소요기간을 고정 일정으로 가정하지 않고 제출 당시 콘솔과 최신 가이드를 확인한다.
- [ ] 승인 후 `출시하기`가 전체 사용자에게 즉시 반영됨을 인지하고 최종 회귀 테스트를 마친다.
- [ ] 새 버전과 롤백도 즉시 반영되므로 이전 안정 번들을 보존한다.

공식 페이지의 검토 기간 표기가 페이지와 시점에 따라 다르며, 현재 출시 문서는 보통 영업일 최대 3일, 카테고리에 따라 7일 이상 걸릴 수 있다고 안내한다. 일정 산정 전 다시 확인한다.

## 11. 출시 후 운영

- [ ] 주요 오류와 크래시 로그를 수집한다.
- [ ] API 응답 지연·실패율과 외부 이미지/CDN 실패를 모니터링한다.
- [ ] Sentry 등 모니터링 도구 도입 시 개인정보와 전송 데이터를 검토한다.
- [ ] 내비게이션의 신고 기능과 콘솔 신고 내역을 확인한다.
- [ ] 긴급 오류 발생 시 롤백 가능한 이전 버전을 유지한다.
- [ ] 정책 변경과 사후 검수 요청에 대응할 담당자와 고객 문의 채널을 준비한다.
- [ ] 출시 후에도 공식 릴리즈 노트와 광고 정책을 정기적으로 재확인한다.
