# AI_집안일 알림 구현 계획

작성 기준: 2026-07-14, 앱인토스 공식 개발자 문서 및 WebView SDK 2.x

## 결론

앱인토스에서 백그라운드 알림은 토스의 **푸시(Push)** 와 **알림(Inbox)** 으로 구현할 수 있다. 푸시는 앱을 열지 않은 상태에서 보이는 OS 알림이고, 알림은 토스 앱 우측 상단 종 아이콘에서 확인하는 메시지다.

공식 WebView SDK 문서에서 확인되는 클라이언트 기능은 알림을 기기에 직접 예약하는 로컬 알림 API가 아니라, 기능성 메시지 수신 동의를 요청하는 `requestNotificationAgreement`다. 실제 개인별 메시지 발송은 앱인토스 콘솔의 기능성 캠페인 또는 mTLS가 적용된 파트너 서버에서 수행한다.

따라서 로그인과 백엔드가 없는 현재 MVP에서는 집안일 일정과 알림 시각을 기기에 저장하고, 앱을 열었을 때 오늘/기한이 지난 일을 강조하는 **인앱 리마인더**까지 안정적으로 제공한다. 토스 푸시는 콘솔과 사용자 식별 및 서버 준비 후 연동한다.

## 구현 가능 범위

### 지금 가능한 범위

- 사용자가 집안일별 알림 사용 여부와 희망 시각을 설정
- 일간·주간·월간·연간 반복 규칙으로 다음 수행일 계산
- 브라우저 저장소에 일정과 설정을 보존
- 앱 실행·재진입 시 오늘 할 일, 임박한 일, 기한이 지난 일을 표시
- 앱 내부 배너·배지·토스트 형태로 알림 표시
- 알림 기능이 준비 중임을 명확히 안내하고 실제 OS 알림처럼 오인시키지 않기

### 콘솔만으로 가능한 범위

기능성 캠페인의 **토스에게 발송 요청하기**는 서버 없이 일회성 또는 정기 발송을 설정할 수 있다. 정기 발송은 공식 문서 기준 매일 또는 매주 특정 요일·시각을 지원한다. 다만 동일 캠페인 기준 발송이므로 사용자마다 서로 다른 집안일, 주기, 마감 시각을 동적으로 계산하는 용도에는 제한적이다.

예를 들어 모든 동의 사용자에게 매일 같은 시각에 “오늘의 집안일을 확인해요.” 같은 메시지를 보내는 운영은 검토할 수 있지만, 메시지의 서비스 이용 유도 성격에 따라 기능성이 아닌 광고성 분류가 적용될 수 있다. 최종 문구와 유형은 콘솔 검수를 기준으로 한다.

### 서버 연동 후 가능한 범위

- 사용자별 다음 알림 시각을 서버에 저장
- 스케줄러가 도래한 일정과 수신 동의를 확인
- 해당 사용자의 `userKey`로 기능성 메시지 API 호출
- 푸시/Inbox 클릭 시 해당 집안일 또는 오늘 할 일 화면으로 딥링크
- 발송 성공·실패 및 중복 발송 방지 기록

개별 집안일 알림은 사용자가 특정 시점의 메시지를 받기로 선택하는 기능이므로, 보수적으로 알림 동의문이 필요한 기능성 메시지로 설계한다. 실제 허용 여부와 문구는 앱인토스 검수 결과를 따른다.

## 필요한 콘솔 설정

1. 앱인토스 콘솔에서 미니앱 정보와 이동 URL을 확정한다.
2. `스마트 발송 > 알림 동의문`에서 집안일 리마인더의 발송 조건·시점을 설명하는 동의문을 만든다.
3. 기능성 캠페인을 생성하고 동의문을 연결한다.
4. 제목·본문·클릭 이동 URL을 등록하고 문구 검수를 요청한다.
5. 승인 후 템플릿 코드(`templateSetCode`, SDK 동의 요청에서는 `templateCode`)를 확보한다.
6. 서버 없이 공통 리마인더를 운영한다면 `토스에게 발송 요청하기`에서 일회성 또는 매일·매주 반복을 설정한다.

공식 가이드의 기능성 메시지 작성 제한은 제목 7자 이내, 본문 25자 이내이며, 검수 승인 후 발송할 수 있다. 소재 검수에는 영업일 기준 1~2일이 걸릴 수 있어 발송 예정일 최소 3영업일 전 등록이 권장된다.

## 필요한 서버 설정

개인별 알림 API 발송 단계에서는 다음이 필요하다.

- 콘솔에서 서버용 mTLS 인증서와 키 발급 및 안전한 보관
- 파트너 서버에서 `https://apps-in-toss-api.toss.im`으로 통신
- 앱인토스 API 목적지 IP/443 방화벽 허용
- 사용자별 Toss `userKey` 확보 및 내부 사용자·집안일 일정과 연결
- 서버 스케줄러, 타임존(기본 Asia/Seoul), 재시도, 중복 방지 키, 발송 로그 구현
- 인증서 만료 전 교체 절차 수립

현재 로그인/사용자 식별을 뒤로 미룬 상태에서는 사용자별 `userKey`와 서버 일정의 안정적인 연결이 없으므로 개인화 푸시 발송을 먼저 구현하지 않는다.

## 관련 SDK와 API

### WebView SDK

- `requestNotificationAgreement(params)`: WebView SDK v2.5.0 이상. 콘솔의 기능성 캠페인 템플릿 코드를 받아 토스의 알림 수신 동의 UI를 연다.
- 결과: `newAgreement`, `alreadyAgreed`, `agreementRejected`
- 반환되는 cleanup 함수는 `onEvent` 또는 `onError` 처리 뒤 반드시 호출한다.
- 실행 환경: Toss App, Sandbox App. 일반 웹 브라우저용 알림 API가 아니다.

### 서버 API

Base URL: `https://apps-in-toss-api.toss.im`

- 테스트 발송: `POST /api-partner/v1/apps-in-toss/messenger/send-test-message`
- 1인 발송: `POST /api-partner/v1/apps-in-toss/messenger/send-message`
- 대량 발송: `POST /api-partner/v1/apps-in-toss/messenger/send-bulk-message`

1인 발송은 `x-toss-user-key` 헤더와 `templateSetCode`, 템플릿 변수용 `context`가 필요하며, 공식 문서 기준 userKey별 분당 최대 10회다. 테스트 발송에는 업로드 번들의 `deploymentId`도 필요하다. 대량 발송은 50건 이상에 사용하며 요청당 최대 2,500건이다.

## 단계별 적용안

### MVP 1 — 현재 구현

- 집안일별 반복 일정과 알림 시각 저장
- 홈에서 오늘/임박/지연 항목 계산
- 앱이 열릴 때 인앱 알림 표시
- 설정 화면에 “토스 푸시는 출시 준비 후 제공” 상태 표시

### MVP 2 — 앱인토스 콘솔 준비 후

- 알림 동의문 및 기능성 캠페인 검수
- `requestNotificationAgreement` 연동
- 공통 일간/주간 메시지가 정책상 승인되는 경우 콘솔 정기 발송 시험

### MVP 3 — 사용자 식별·백엔드 도입 후

- 사용자별 일정 서버 동기화
- 매분 또는 작업 큐 기반 스케줄러
- 기능성 메시지 API를 통한 개인화 알림
- 딥링크, 발송 이력, 재시도 및 수신 거부 반영

## 공식 출처

- [스마트 발송 소개와 콘솔 설정](https://developers-apps-in-toss.toss.im/smart-message/intro.html)
- [기능성 메시지 발송 API 및 알림 동의 연동](https://developers-apps-in-toss.toss.im/smart-message/develop.html)
- [`requestNotificationAgreement` WebView SDK 레퍼런스](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EC%9D%B8%ED%84%B0%EB%A0%89%EC%85%98/requestNotificationAgreement.html)
- [mTLS 기반 앱인토스 API 연동 절차](https://developers-apps-in-toss.toss.im/development/integration-process.html)
- [앱인토스 FAQ — 스마트 발송 검수 안내](https://developers-apps-in-toss.toss.im/faq.html)
