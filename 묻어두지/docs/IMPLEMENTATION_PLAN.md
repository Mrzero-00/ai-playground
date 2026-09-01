# 묻어두지 MVP 구현 계획

이 문서는 [PRD.md](PRD.md)를 Codex가 독립적으로 실행·검증 가능한 작업 단위로 나눈다. 제품 요구의 최종 기준은 PRD이며 기술 경계는 [architecture.md](architecture.md)를 따른다.

## 1. 작업 원칙

1. 한 작업은 하나의 사용자 가치 또는 하나의 기반 위험만 다룬다.
2. 모든 작업은 관련 PRD 요구사항 ID, 변경 파일, 테스트, 완료 증거를 남긴다.
3. 클라이언트 화면보다 서버 권한·상태 전이·RLS를 먼저 만든다.
4. 정상 흐름과 권한 거부·재시도·동시성 실패를 같은 작업에서 구현한다.
5. private 콘텐츠와 정확한 위치는 fixture, 로그, 스크린샷에 넣지 않는다.
6. 하나의 작업 작성자와 완료 검증자는 분리한다.

## 2. 기준 저장소 구조

현재 Expo 앱을 이동하지 않고 다음 경계를 추가한다.

```text
묻어두지/
├─ src/                    # Expo React Native 앱
├─ apps/invite-web/        # Next.js 모바일 초대 웹
├─ apps/ops-web/           # IAP 뒤 신고 대기열·검수 도구
├─ packages/contracts/     # API 타입, 검증 스키마, 이벤트 스키마
├─ services/provider-api/  # Cloud Run Places 인증 프록시
├─ services/media-api/     # Cloud Run 업로드 준비·완료와 queue
├─ services/ops-api/       # IAP 운영자 대기열·조치 gateway
├─ services/media-review-api/ # IAP 운영자 격리본 access API
├─ services/image-worker/  # Cloud Run private 이미지 처리 worker
├─ services/media-ops-worker/ # 격리·복구·위반 확정
├─ services/media-retention-worker/ # TTL·고아 media 삭제
├─ services/state-worker/  # 봉인·공개·만료 상태 전이
├─ services/notification-worker/ # Expo Push 전달
├─ services/deletion-worker/ # 계정·기여·멤버십·pit 삭제
├─ jobs/signature-updater/ # ClamAV signature bundle 발행
├─ jobs/restore-controller/ # deletion ledger·overdue TTL 복원 gate
├─ content-policy/         # 승인된 버전별 텍스트 차단 규칙
├─ infra/gcp/              # Cloud Run, Tasks, VPC/NAT, IAM
├─ supabase/
│  ├─ migrations/          # Postgres/PostGIS/RLS
│  └─ tests/               # RLS와 상태 전이 테스트
├─ docs/
└─ tests/
```

모바일과 웹은 화면 컴포넌트를 공유하지 않는다. 계약, 검증 스키마와 디자인 토큰만 공유한다.

## 3. 작업 패킷 공통 양식

Codex에 작업을 맡길 때 아래 항목을 채운다.

```markdown
## 목적
[사용자에게 생기는 결과]

## 관련 요구사항
[PRD ID]

## 범위
- 포함:
- 제외:

## 변경 예상 파일
- [구체적인 경로]

## 인수 조건
- Given / When / Then 형식의 관찰 가능한 결과

## 검증
- 단위:
- 통합:
- E2E 또는 수동:

## 위험과 롤백
- 위험:
- 되돌리는 방법:
```

## 4. 순차 구현 계획

### WP-00. 기준선과 CI

**목적:** 모든 후속 작업이 같은 문서와 자동 검증을 사용한다.

- 관련 요구: AN-01~04, NFR-01~11
- 작업:
  - Node 22, pnpm, Expo SDK 버전을 CI에 고정한다.
  - typecheck, lint, unit test, Expo web/iOS/Android export 작업을 만든다.
  - PR 템플릿에 PRD ID, 테스트 증거, 개인정보 영향 항목을 넣는다.
  - staging과 production 환경 변수를 분리하고 예시 파일에는 비밀을 넣지 않는다.
  - Maps SDK의 iOS/Android 플랫폼 제한 키와 Cloud Run Places 프록시의 API·고정 egress IP 제한 키를 분리하고, Expo Push Service와 Google Cloud Vision SafeSearch까지 비용 경보·개인정보 계약 체크리스트를 만든다.
  - `infra/gcp`에 Cloud Run/Job, Cloud Scheduler/Tasks, Direct VPC egress, 예약 IP·Cloud NAT, public access prevention·uniform access GCS bucket, service account 최소 권한과 Secret Manager 경계를 선언한다. raw/final/quarantine bucket은 soft delete 0초, Object Versioning off, Retention Lock·legal hold 미사용으로 생성한다.
  - public 호출이 불가능한 media-retention-worker와 전용 service account/`NOINHERIT` DB role을 만든다. 세 bucket의 generation-qualified delete와 고아 정리용 최소 metadata list만 허용하고 read/download/create/copy/sign은 거부한다.
  - public 호출이 불가능한 media-ops-worker와 전용 Cloud Tasks OIDC caller/service account/`NOINHERIT` DB role을 만든다. final↔quarantine의 generation 고정 copy·source delete에 필요한 최소 object 권한만 허용하고 list·URL sign과 다른 DB 함수는 거부한다.
  - state/notification/deletion worker를 서로 다른 OIDC caller, Cloud Run service account와 `NOINHERIT` DB role로 배포하고 architecture allowlist 밖 table·function·GCS 접근을 거부한다. Supabase Edge service role로 예약 작업을 실행하지 않는다.
  - 외부 HTTPS Load Balancer IAP 뒤에 ops-web/ops-api/media-review-api를 두고 Cloud Run 직접 IAP Preview는 사용하지 않는다. 조직 관리형 Google Cloud Identity/Workspace operator group에 2-Step Verification을 강제하고, ingress와 Invoker를 LB/IAP service agent로 제한한다. 각 backend는 `x-goog-iap-jwt-assertion`의 ES256 signature·JWKS `kid` rotation/cache, `iat`·`exp`·issuer와 해당 LB backend service의 정확한 audience를 검증하며 unsigned identity header를 거부한다.
  - ops-api에 전용 `ops_gateway` DB role을 부여해 IAP subject→활성 operator role 매핑, 안전한 신고 대기열, media ops job 생성, 계정 제한·신고 종결·법적 보존 만료 함수만 실행하게 한다. 상태 변경은 GET을 금지하고 단일 ops-web HTTPS Origin, `Sec-Fetch-Site: same-origin`, IAP subject에 서버 측으로 묶인 단기 CSRF token의 `X-CSRF-Token` header가 모두 일치해야 DB 함수를 호출한다.
  - media-review-api에 전용 `media_reviewer` DB role과 quarantine GET만 부여한다. ops-web·ops-api와 공유하지 않는 전용 review hostname에는 이 API만 라우팅한다. 앱은 범용 MFA claim을 검사하지 않고 release gate가 조직 2SV 강제 정책·active operator 등록 증거를 확인한다. 60초·1회용 review secret은 Domain 없는 host-only `__Host-review_session` Secure·HttpOnly·SameSite=Strict cookie로만 전달하고, 소비 시 현재 IAP subject와 발급 대상 subject를 다시 일치시킨 뒤 `no-store` proxy stream한다. raw/final/list/signBlob과 사유·report 없는 요청은 거부한다.
  - provider-api가 관측한 outbound IP와 Places key allowlist가 일치하는 staging smoke test를 만든다. hosted Supabase Edge의 egress IP를 이 용도로 사용하지 않는다.
  - 2 vCPU·2GiB·concurrency 1·60초 timeout 기준 image-worker 기술 spike에서 10MB 경계 HEIC/JPEG/PNG, 손상 파일, 12,000px/5천만 pixel 경계와 압축 폭탄 fixture를 pinned libvips/libheif/ClamAV container로 처리하고 30초 내 JPEG 정규화·EXIF 제거 또는 안전한 실패를 확인한다.
  - 별도 signature-updater Cloud Run Job이 FreshClam DB를 6시간마다 갱신·무결성 확인해 private 설정 bucket에 immutable bundle과 generation-guarded manifest로 발행하게 한다. 전용 Scheduler account는 OAuth token으로 Jobs API의 이 Job `:run`만 호출하고 다른 Job·서비스 호출은 거부한다. image-worker는 bundle을 ephemeral 경로에 checksum 검증·원자 교체하고 age가 24시간을 넘거나 검증이 실패하면 fail-closed한다.
  - private GCS deletion-ledger bucket을 uniform/PAP, soft delete 0, versioning off, 잠긴 45일 retention으로 만든다. 평시 deletion-worker는 immutable event create만, 별도 restore-controller Job은 break-glass read/list만 허용한다. Secret Manager에서 deletion-worker runtime은 enabled current HMAC key version만, restore-controller runtime은 승인된 break-glass 시간창에 ledger가 참조하는 만료 전 key versions만 읽게 하고 다른 worker·caller·운영자는 모두 거부한다.
  - Sentry를 crash 공급자로 고정하고 Session Replay 비활성화, 30일 보존, beforeSend PII scrub와 source map 비밀 처리를 체크리스트에 넣는다.
  - 버전된 분석 이벤트 계약과 PII 금지 검사를 먼저 만든다.
  - 위치기반서비스 법률 검토 결과를 기록할 외부 파일럿 차단 게이트를 만든다.
- 완료 조건:
  - 새 checkout에서 한 명령으로 검증이 실행된다.
  - 비밀 키 탐지와 생성물 제외가 동작한다.
  - Maps SDK 키는 앱 플랫폼·번들 ID/서명으로 제한되고 Places 키는 API·Cloud Run 예약 IP로 제한되며 외부 파일럿 게이트가 CI 또는 release checklist에서 확인된다.
  - image-worker spike의 성공·거부·timeout·cleanup 증거와 container digest가 기록된다.
  - 모든 Cloud Run service/Job이 Supabase service-role key 없이 전용 `NOINHERIT` Postgres role의 허용 함수만 실행하고 다른 table·function 접근은 실패한다.
  - 인프라 drift test가 세 media bucket의 soft delete 0초, versioning off, retention policy·legal hold 없음과 architecture에 정의한 service account별 IAM/OIDC 허용·거부 행렬을 검증한다. 첫 외부 콘텐츠 전 bucket이 비어 있음도 증명한다.

### WP-01. 공유 계약과 Supabase 기반

**목적:** 서버 권위 상태 머신과 권한 모델의 바닥을 만든다.

- 관련 요구: ACC-04~06, PIT-01~05, CON-02, SEAL-01~03, CHK-04, REV-01~03, SAFE-01, SAFE-03, NFR-05~07, NFR-11
- 작업:
  - `packages/contracts`에 ID, 상태 enum, 입력 검증, 오류 코드와 이벤트 스키마를 정의한다.
  - PostGIS와 pits/members/invites/invite-sessions/app-handoffs/contributions/media/upload-intents/media-processing/media-ops/opening/checkins/notification/blocks/reports/deletion/location-usage/operator-profiles/review-sessions/security-state/analytics-events 테이블 migration을 만든다.
  - architecture의 모든 private 자원별 읽기·쓰기·RPC·worker 행렬을 default-deny RLS로 적용한다. anon은 테이블 직접 SELECT 없이 교환된 초대 세션의 safe DTO만 호출한다.
  - pit 잠금 안에서 지난 active 세션을 먼저 만료시키는 첫 GPS 세션, 참석 집합을 고정하는 정족수→COUNTDOWN, 종료 후 `finalize_open`의 2단계 공개 전이를 만든다.
  - 계정·기여 삭제 상태, `quarantined`와 복구 전이, 탈퇴, 소유권 이전, 후계자 0명인 pit의 `PURGE_PENDING`, 유효 정족수 재계산, `solo_recovery`, 미공개 90일 만료를 schema에 선반영한다.
  - 개인 `tokens_invalid_before`, 단조 증가 `security_state.global_tokens_invalid_before`와 Supabase global signOut을 구현한다. 사용자 JWT를 받는 앱·초대 웹 RLS/RPC와 provider/media 사용자 함수만 JWT `session_id`의 실제 `auth.sessions` subject·created_at, epoch와 계정 active 상태를 확인한다. ops/media-review 함수와 private worker/restore 함수는 각각 IAP 운영자 identity 또는 전용 OIDC/OAuth caller·`NOINHERIT` role·job 상태로 인증하며 end-user session을 요구하지 않는다.
  - 상태 전이 함수에 서버 시각, 멱등성 키, 감사·분석 이벤트를 적용한다.
  - 가짜 멤버·다른 멤버·봉인 상태 부정 테스트를 먼저 작성한다.
  - 각 private 테이블의 직접 CRUD 거부와 허용 RPC·architecture의 전용 worker role만 성공하는 행렬 테스트를 만든다.
  - Cloud Run 전용 Postgres 역할에는 CONNECT·schema USAGE·허용 security-definer 함수 EXECUTE만 부여하고 table 접근과 다른 함수 실행 거부를 테스트한다.
- 완료 조건:
  - 비멤버의 모든 private 조회가 실패한다.
  - 봉인 후 작성자도 본문과 GCS object key를 조회할 수 없다.
  - 중복 상태 전이 요청이 레코드를 중복 생성하지 않는다.
  - 정족수 충족 뒤 카운트다운 종료 전까지 pit은 sealed이고 본문·signed URL 접근이 실패한다.
  - 전역 로그아웃 직후 기존 access token으로 앱 API, provider-api, media-api와 새 signed URL을 호출하면 모두 실패한다.

### WP-02. 인증과 초대 웹

**목적:** 앱 설치 전 초대 확인부터 안전한 가입까지 완결한다.

- 관련 요구: ACC-01~06, INV-01~07
- 작업:
  - 이메일 OTP 인증과 프로필 온보딩을 만든다.
  - `apps/invite-web`에 최소 정보 미리보기, 로그인, 참여 수락을 구현한다.
  - 초대 토큰 생성·해시·폐기·만료와 정원 동시성 제약을 구현한다.
  - 최초 토큰 요청을 HttpOnly 초대 세션으로 교환하고 토큰 없는 URL로 303 redirect한다. `no-referrer`, `no-store`, CDN·Next.js·APM route redaction을 자동 검증한다.
  - 공유 `/i/*`를 Universal/App Link에서 제외해 설치 여부와 무관하게 웹에서 교환하고, 수락 후 60초·1회용 `/app/h/*` handoff만 앱과 연결한다. handoff의 브라우저 fallback에도 `no-referrer`·`no-store`와 CDN·서버·APM route-template redaction을 적용한다.
  - 로그아웃과 계정 삭제 요청을 연결한다.
  - 구덩이 상태와 역할별 탈퇴·취소·소유권 이전 UX를 연결한다.
  - `invite_preview_opened`, `invite_accepted` 이벤트를 PII 없이 연결한다.
- 완료 조건:
  - 앱 미설치 사용자가 모바일 웹에서 인증과 멤버십 수락을 완료한다.
  - 만료·취소·정원 초과·중복 수락이 각각 올바른 오류로 보인다.
  - 비멤버는 정확한 장소를 볼 수 없다.
  - 앱 설치/미설치 iOS·Android에서 공유 초대가 모두 웹의 tokenless URL로 교환되고 raw token이 앱 로그·분석·저장에 없다.
  - 실제 카카오톡 unfurl·클릭에서 민감 정보가 없는 미리보기와 tokenless redirect가 동작하고, 수락 뒤 handoff만 설치 앱으로 열린다.

### WP-03. 구덩이 생성과 기여

**목적:** V0 로컬 흐름을 실제 다중 사용자 데이터로 교체한다.

- 관련 요구: PIT-01~05, INV-06, CON-01~05, SAFE-00~01
- 작업:
  - 생성 폼을 공유 검증 스키마와 서버 mutation에 연결한다.
  - `react-native-maps` Google provider는 플랫폼 제한 키로 렌더링하고, Places 검색은 Supabase JWT·rate limit을 검증하는 Cloud Run provider-api와 별도 고정-IP 제한 키로 구현한다.
  - Places 후보는 저장하지 않고 허용된 `place_id`, 사용자가 확정한 핀·직접 확인한 장소 라벨만 저장하며 attribution을 검증한다.
  - 모바일 앱과 `apps/invite-web` 양쪽에 같은 계약을 쓰는 텍스트·사진 기여 UI를 구현한다.
  - raw upload intent 발급 전 이용 규칙 동의를 확인하고, raw 임시 수신 뒤 MIME/악성 파일/금칙어·Google Cloud Vision SafeSearch를 통과해야만 사진을 기여에 연결·봉인하도록 구현한다.
  - Supabase JWT·rate limit을 검증하는 Cloud Run media-api가 10분·1회용 DB upload intent로 최대 10MB를 private GCS에 streaming하도록 구현한다. 클라이언트에 storage upload URL이나 자격을 주지 않는다.
  - Cloud Tasks OIDC만 허용하는 private image-worker로 job outbox·MIME/ClamAV/decode 검사·auto-rotate·sRGB JPEG 재인코딩·EXIF 제거를 구현하고, 위치 메타데이터가 없는 4MB 이하 검사용 임시본만 SafeSearch에 전송한다.
  - media job은 최대 3회 멱등 재시도하고 enqueue 누락 reconciler, terminal failure, 성공·실패 24시간 cleanup을 구현한다.
  - media job의 120초 `lease_id`·`lease_expires_at`과 generation fencing을 구현한다. stale processing/promoting을 재claim하되 lease별 immutable final candidate를 사용하고 이전 candidate는 접근 불가 고아로 정리한다.
  - promotion 전·후 media generation fencing과 DB row lock으로 삭제·탈퇴·취소·마감 뒤 final 재생성을 차단한다.
  - final candidate copy 뒤 finish가 거부되면 image-worker가 삭제하지 않고 정확한 GCS generation의 `enqueue_candidate_deletion` outbox를 만들며 media-retention-worker가 물리 삭제하게 한다.
  - 업로드 멱등성, 진행률, 취소, 재시도를 구현한다.
  - 본인 기여 삭제 UI와 GCS 우선 삭제 RPC를 연결한다.
  - media-retention-worker가 DB의 object generation과 일치하는 대상만 멱등 삭제하고, raw/final/quarantine TTL과 미연결 final 24시간 정리를 수행하게 한다.
  - publish/contribution/safety/deletion 이벤트를 PII 없이 연결한다.
  - 로컬 prototype store와 하드코딩된 샘플을 fixture 경계로 격리한다.
- 완료 조건:
  - 정책 경계값을 앱과 서버가 동일하게 처리한다.
  - 다른 멤버 기여를 추측·조회할 수 없다.
  - 실패한 업로드를 재시도해도 중복 객체가 남지 않는다.
  - SafeSearch 장애 시 원본을 보존하지 않고 사진 없이 제출 또는 재시도를 선택한다.
  - Google 요청 fixture와 네트워크 캡처에 EXIF·GPS 메타데이터가 없고 원본 객체가 외부로 전송되지 않았음을 자동 검증한다.
  - worker 중단·중복 task·Cloud Tasks enqueue 실패에도 job과 최종 객체가 하나만 남고 raw·sanitized 임시 객체가 24시간 뒤 0개다.
  - claim 직후와 final copy 직후 crash를 각각 재현해 stale lease가 재claim되고 이전 candidate가 연결되지 않으며 현재 lease만 finish한다.
  - upload intent 만료·재사용·동시 PUT·10MB 초과가 거부되고 중단 upload의 부분 객체가 정리된다.
  - promotion 단계와 삭제·탈퇴·취소·마감을 동시에 실행해도 DB에 미디어가 다시 연결되지 않고 미연결 final은 접근 불가 후 24시간 안에 0개다.
  - media-retention-worker는 generation 불일치·보존 미만·live quarantine을 삭제하지 않고, read/download/sign 시도는 IAM에서 실패한다.

### WP-04. 마감, 봉인, 대기와 알림

**목적:** 30일 기다림의 약속을 서버가 보장한다.

- 관련 요구: SEAL-01~03, WAIT-01~05
- 작업:
  - 전용 Scheduler/Tasks OIDC와 `state_worker` RPC allowlist로 기여 마감·자동 봉인/취소·30/90일 상태 만료를 구현한다.
  - 봉인 RLS와 대기 화면을 연결한다.
  - 별도 `notification_worker`와 DB outbox로 봉인 직후와 공개 7일·1일 전·당일 알림, 보존 고지와 토큰 정리를 구현한다. `purge_stale_device_tokens`는 마지막 확인 90일 미만 token을 보존하고 90일 경계부터 삭제하며 notification-worker allowlist 밖 변경은 거부한다.
  - 기기 캘린더 추가와 권한 거부 시 수동 일정 복사 경로를 구현한다.
  - 멤버 또는 기여가 2개 미만인 구덩이의 자동 취소와 24시간 삭제, 재생성 CTA를 구현한다.
  - 마감 시 pending/promoting 사진 job을 cancel하고 generation을 올린 뒤 완료 사진만 봉인하며, 텍스트 기여는 사진 없이 유지한다.
  - 공개 후 30일·미공개 90일 만료와 30일·7일·1일 전 고지를 구현한다.
  - state-worker의 invite session/handoff/upload intent/review session 논리 만료와 deletion-worker의 임시 profile, invite/upload/media job/notification/deletion/consent/review/safety/report/audit/analytics metadata 보존기한별 purge RPC를 구현한다.
  - seal/cancel/notification 이벤트를 PII 없이 연결한다.
- 완료 조건:
  - 운영자·클라이언트 시간 변경으로 봉인이 우회되지 않는다.
  - 알림 실패가 상태 전이를 막지 않는다.
  - state-worker와 notification-worker의 OIDC audience 교차 호출, allowlist 밖 RPC/table, GCS 접근이 모두 실패한다.
  - 캘린더 권한을 거부해도 날짜·장소·제목을 수동 복사해 일정을 만들 수 있다.
  - 봉인 콘텐츠가 API, GCS, 알림 어디에도 노출되지 않는다.
  - sealed 구덩이는 공개 예정 시각 후 90일까지 재시도 가능하고 그 이후 정확한 장소와 콘텐츠가 삭제된다.
  - 24시간·30일·90일·1년 보조 데이터 경계 테스트에서 기한 전 보존, 기한 후 purge와 allowlist 밖 삭제 거부가 확인된다.

### WP-05. 현장 체크인과 공동 공개

**목적:** 날짜·장소·인원 조건을 만족한 그룹이 실패 없이 함께 연다.

- 관련 요구: CHK-01~06, REV-01~04
- 작업:
  - 원좌표를 저장하지 않는 PostGIS 판정 RPC를 만든다.
  - 정확도 포함 inside/outside/uncertain 판정을 앱과 서버에서 검증한다.
  - pit 잠금 안에서 지난 active 세션을 만료시킨 뒤 첫 GPS 기준 고정 15분 세션과 체크인을 만들고, countdown 진입 시 참석 집합 고정·TTL 경계 규칙을 구현한다.
  - 60초 일회용 QR과 최소 1명 GPS 표시를 구현한다.
  - 정족수→COUNTDOWN 트랜잭션이 exact-time Cloud Task를 생성하고 `state-worker`만 카운트다운 종료→OPENED를 실행하게 한다. 분 단위 reconciler가 누락 task를 복구한다.
  - final GCS 객체에 `private, no-store, max-age=0`을 강제하고 CDN 없이 300초 V4 signed URL과 순차 공개를 구현한다.
  - 공개 마지막 화면에서 이전 멤버·장소의 개별 복사 여부를 선택해 다음 구덩이를 발행하는 흐름을 구현하되 콘텐츠는 복사하지 않는다.
  - 위치 불확실, 권한 거부, 인원 부족, 설정을 바꾸지 않는 다음 시도 공유 UX를 만든다.
  - checkin/countdown/open/solo_recovery 이벤트를 PII 없이 연결한다.
- 완료 조건:
  - 동시 공개 요청에도 공개 세션이 하나만 생긴다.
  - 카운트다운 전 signed URL이 발급되지 않고 `finalize_open` 재시도에도 pit과 세션이 한 번만 열린다.
  - 비멤버·만료 URL·봉인 상태에서 미디어 접근이 실패한다.
  - URL은 300초 뒤 실패하고 응답은 `no-store`이며 격리 후 기존 object path가 404다.
  - 실제 iOS·Android 기기에서 위치 성공·불확실·거부를 검증한다.

### WP-06. 외부 파일럿 안전 게이트

**목적:** 사적인 콘텐츠를 운영할 최소 안전장치를 갖춘다.

- 관련 요구: ACC-02~04, SAFE-00~03, OPS-01~03
- 작업:
  - 기여 삭제와 계정 삭제의 E2E, 소유권 이전, 백업 만료 추적을 완성한다.
  - 멤버 차단을 초대 수락·알림·공개 숨김에 연결한다.
  - 신고 접수, 대기열, 복구 가능한 `quarantined` 상태, 격리 보존·복구·삭제와 감사 로그를 구현한다. 운영 처리 RPC가 job을 만들고 Cloud Tasks OIDC 전용 media-ops-worker가 generation·checksum을 확인해 final↔quarantine copy와 source delete를 수행하게 한다.
  - `apps/ops-web`과 ops-api를 구현한다. 검증한 IAP subject를 active `safety_reviewer|safety_admin`에 매핑하고 최소 대기열, job 생성, 계정 제한, 신고 종결과 만료 있는 법적 보존 RPC만 역할·사유·감사와 함께 실행한다. 모든 변경 요청은 exact ops Origin·same-origin Fetch Metadata·IAP subject-bound 단기 CSRF header를 검증하고 GET 변경을 거부한다.
  - media-review-api는 다른 운영 backend와 공유하지 않는 전용 review hostname에서 활성 운영 역할·report·사유를 확인해 60초·1회용 secret을 Domain 없는 host-only `__Host-review_session` cookie로 설정한다. tokenless route는 현재 IAP subject와 발급 대상 subject가 일치할 때만 정확한 quarantine generation을 `no-store` proxy stream하며 실제 열람을 감사한다.
  - 운영 역할에 최소 권한을 적용한다.
  - 삭제·격리·복구 runbook과 사용자 상태 화면을 만든다.
  - 이용약관, 개인정보 처리방침, 금지 콘텐츠, 공개 운영 연락처를 배포한다.
  - 제품 오너·안전 검토자가 승인한 버전·체크섬의 `content-policy/blocked-terms.ko.json`과 NFKC·소문자·zero-width·공백 정규화 엔진을 배포한다. 에이전트가 실제 차단어를 만들지 않는다.
  - Google Maps·Cloud Run·Cloud Storage·Cloud Vision과 Sentry의 DPA·처리 리전·하위 처리자·보존 고지, 위치기반서비스 전문가 승인 증거를 release gate에 연결한다.
  - GCS bucket 설정과 삭제 전용 worker IAM drift를 release gate에 연결하고 drift 시 외부 업로드를 차단한다.
  - 앱 DB 밖의 append-only deletion-ledger와 break-glass restore-controller Job을 구현한다. ledger에는 `account|contribution|membership|pit` scope, stable subject ID의 versioned HMAC과 시각만 45일 보존한다. current key로 만든 ledger와 과거 key version ledger를 모두 재현해 restore-controller의 승인 시간창·version별 secret access와 HMAC replay를 검증하고 다른 worker/caller의 모든 key 접근을 거부한다. `begin_restore(run_id)`는 `security_state.restore_mode=true`, 예측 불가능한 `restore_run_id`, global session epoch를 원자적으로 설정한다. 복원 중에는 새 session까지 포함한 앱·초대 웹 RLS/RPC, anon 초대 교환, provider/media API, ops와 일반 Scheduler/Tasks/worker claim·notification을 실패 폐쇄한다. restore-controller가 전용 caller/queue로 만든 동일 run ID의 state/deletion/media-retention restore task만 허용해 ledger replay, invite/handoff/upload/review session, 마감·취소 24시간, opening session, media 24시간, opened 30일, unopened 90일, push token 90일과 모든 보조 metadata overdue purge를 알림 없이 끝낸다. 부정 조회와 media 삭제를 검증한 뒤 `finish_restore(run_id)`가 epoch를 다시 전진시키고 restore mode를 닫기 전에는 일반 API·worker traffic을 열지 않는다.
- 완료 조건:
  - 삭제 요청 데이터가 7일 내 제거되는 자동 작업과 증거가 있다.
  - 기여·계정·30/90일 TTL·24시간 고아 정리 E2E에서 generation이 일치하는 GCS 객체가 live, versioned, soft-deleted 사본 없이 제거되고 DB tombstone과 감사 상태가 일치한다.
  - 백업 복원 리허설에서 account/contribution/membership/pit ledger 항목을 각각 재적용해 삭제 데이터가 부활하지 않고 범위 밖 데이터는 과삭제되지 않으며, 완료 전 direct PostgREST/RPC를 포함한 사용자·anon·ops·일반 worker 트래픽이 차단된다.
  - 과거 snapshot 복원 리허설에서 restore mode 동안 기존 access token, 이전 refresh session으로 갱신한 token과 새 로그인 session이 모두 거부된다. run ID가 없거나 다른 일반·복원 task는 거부되고, 동일 run ID의 restore-controller-origin state/deletion/media-retention task만 허용된다. 모든 overdue TTL과 media 삭제를 현재 서버 시각으로 재적용하고 본문·정확한 장소·object path·signed URL 부정 조회와 기존 URL 300초 만료가 통과한 뒤 `finish_restore`가 epoch를 재전진시켜야 새 로그인·일반 worker·traffic gate가 열린다.
  - 운영자 콘텐츠 조회는 사유와 감사 로그 없이 불가능하다.
  - review secret은 응답 body/URL에 없고 전용 review hostname의 Domain 없는 host-only Secure·HttpOnly·SameSite=Strict cookie로만 전달된다. 1회 소비 또는 60초 뒤 만료되고, 다른 IAP subject·다른 hostname의 소비는 거부된다. stream은 `no-store`이며 raw/final/list/signBlob과 사유·report 없는 요청을 거부한다.
  - ops-api는 누락·위조 signature·알 수 없는 `kid`·stale key cache·미래 `iat`·만료·다른 backend audience·잘못된 issuer의 IAP JWT와 unsigned identity header만 있는 요청을 거부한다. 유효한 JWT에서도 inactive/unknown subject, reviewer의 admin 작업, 사유 없는 job·종결, GET 변경과 Origin·Fetch Metadata·subject-bound CSRF header가 없거나 불일치한 요청을 DB 호출 전에 거부하고 모든 허용 조치를 감사한다.
  - 격리 콘텐츠는 공개 세션에서 대체 카드로 보인다.
  - 격리 뒤 새 signed URL은 거부되고 기존 URL은 5분 안에 만료된다. 신고 기각 시 현재 pit이 opened면 sealed가 아니라 revealed로 복구된다.
  - 운영자에게 직접 GCS IAM이 없고 media-ops-worker의 list·URL sign·범위 밖 object 접근과 허용되지 않은 DB 함수 실행이 실패한다.
  - 신고 기각 시 보존기한 안의 콘텐츠만 이전 상태로 복구되고, 위반 확정은 24시간 안에 물리 삭제되며, 미결 30일 초과는 만료 있는 법적 보존 없이는 실패한다.
  - 이 WP가 승인되기 전에는 내부 테스트 계정 외의 콘텐츠 업로드를 허용하지 않는다.

### WP-07. 분석·관측성 트랙과 파일럿 준비

**목적:** 가설을 판단할 수 있고 장애를 추적할 수 있는 빌드를 만든다.

- 관련 요구: AN-01~04, NFR-01~11
- 작업:
  - **WP-07A(병렬):** WP-00 직후 이벤트 계약·PII CI, API p95·오류율, 예약 작업·GCS 고아 객체 경보와 Sentry 기본 구성을 시작하고 각 WP의 이벤트가 합쳐질 때 대시보드를 누적 완성한다.
  - **WP-07A(병렬):** NFR-01 핵심 endpoint별 유효 요청/계약상 성공(2xx·초대 303)/예상 4xx 분모 계약과 NFR-02의 80ms RTT·10/5Mbps·1% loss, 20명·10분 부하 profile을 코드로 고정한다.
  - **WP-07A(병렬):** 서로 다른 pit의 countdown 100개를 동시에 끝내 30초 내 정확히 한 번만 opened가 되는 NFR-11 부하 시나리오를 만든다.
  - **WP-07A(병렬):** Sentry Release Health로 지원 OS의 crash-free session 최근 28일 대시보드와 원시 표본 건수를 만든다. 첫 파일럿 전에는 staging smoke로 수집·계산 계약을 검증하고 production 28일 목표 달성 주장은 하지 않는다. Session Replay를 끄고 event scrub 샘플을 감사한다.
  - **WP-07A(병렬):** iOS VoiceOver·Android TalkBack, 44pt 터치 대상, 글자 200% 핵심 흐름 접근성 감사를 각 완성 화면에 누적 수행한다.
  - **WP-07B(후행):** WP-00~06과 외부 승인 게이트의 증거를 한 release record에 모으고 앱 심사·지원·위치·콘텐츠 안전 runbook 체크리스트를 완료한다.
  - **WP-07B(후행):** 모든 차단 게이트 통과 뒤에만 10팀 실제 30일 파일럿을 생성한다.
- 완료 조건:
  - PRD 14장의 기능·보안·운영 출시 게이트 증거가 한 문서에 모인다.
  - Sev-1 모의 사고와 DB 복구 리허설이 완료된다.
  - 콘텐츠 본문과 정확한 좌표가 분석·로그에 없음을 샘플 감사한다.
  - 첫 파일럿 전에는 NFR-03 crash 수집 계약·staging 원시 표본과 NFR-04 양 플랫폼 접근성 감사 증거가 있다. production 최근 28일 목표는 실제 파일럿 시작 뒤 측정해 공개 베타 확대 gate에서 판정한다.
  - 첫 파일럿 전에는 NFR-01 endpoint별 분자·분모와 예상 4xx 분리 계측의 staging 결과·원시 건수, NFR-02 20명·10분 profile과 NFR-11 100세션 부하 결과가 release record에 첨부된다. production 최근 28일 NFR-01은 실제 파일럿 시작 뒤 공개 베타 확대 gate에서 판정한다.
  - WP-07A 관측성은 WP-00 이후 병렬로 완성되고, WP-00~06·WP-07A와 외부 승인 게이트가 모두 통과한 뒤에만 WP-07B가 실제 10팀을 온보딩한다.

## 5. 테스트 전략

### 단위 테스트

- 날짜 경계, 정족수, 위치+정확도 분류
- 입력 검증, 파일 정책, 이벤트 스키마
- 초대 토큰 만료와 권한 오류 매핑

### DB·RLS 통합 테스트

- 방장, 작성자, 다른 멤버, 비멤버, 탈퇴 멤버, 운영자 역할별 접근
- collecting/sealed(공개 시각 전·카운트다운 중·후)/opened/expired 상태별 본문·미디어 접근
- 정원 동시 수락, 중복 기여, 중복 봉인·카운트다운·공개
- 직접 INSERT/UPDATE 거부와 허용된 RPC별 역할 테스트

### API 통합 테스트

- OTP와 초대 수락
- 업로드 준비→완료→실패 정리
- upload intent 10분 만료·1회 소비·동시 PUT·10MB 초과·중단 cleanup
- Cloud Tasks enqueue 누락·중복·3회 실패와 media job reconciler
- media claim 직후·final copy 직후 crash, 120초 lease 만료·재claim, stale candidate 24시간 cleanup
- media promotion과 삭제·탈퇴·취소·마감 동시성, generation fencing, 미연결 final cleanup
- finish 거부 뒤 exact-generation candidate deletion outbox, image-worker final delete 거부와 retention-worker 삭제
- 고정 공개 세션 TTL, 만료 정리 후 새 세션 생성, 만료 1초 전 정족수→countdown 완료, QR 재사용·만료와 정족수
- 카운트다운 전 접근 거부와 finalize 재실행
- signed URL 발급·만료
- ops/media-review API의 IAP ES256/JWKS rotation, `iat`·`exp`·issuer·backend별 exact audience 검증, unsigned identity header 거부와 subject 매핑
- ops-api의 조직 2SV gate, reviewer/admin 권한·사유·대기열·job/제한/종결 allowlist와 GET mutation·cross-site Origin·누락/타 subject CSRF token 거부
- media-review-api의 Secure·HttpOnly·SameSite=Strict cookie, 60초·1회용 quarantine proxy stream·감사와 raw/final/list/signBlob 거부
- final object `no-store`, CDN 미사용, 격리 뒤 기존 URL 404
- 삭제와 신고 격리, soft-deleted/versioned 사본 부재
- media-retention-worker의 generation 일치/불일치 삭제와 read/download/create/copy/sign IAM 거부
- state/notification/deletion worker의 OIDC audience 교차 호출과 RPC/table/GCS allowlist 거부
- invite session/handoff/upload intent/review session과 profile/media/notification/deletion/consent/safety/report/audit/analytics metadata의 기한 전 보존·기한 후 purge
- `purge_stale_device_tokens`가 마지막 확인 90일 미만 token은 보존하고 90일 경계부터 삭제하며 allowlist 밖 token 변경을 거부
- current/과거 HMAC key version별 deletion-ledger replay, break-glass 시간창 밖 restore-controller와 다른 worker/caller의 Secret Manager 접근 거부
- 탈퇴 시점별 기여 삭제·소유권 이전·후계자 0명 purge
- 격리→복구와 격리→물리 삭제, 법적 보존 만료

### E2E

- 방장 1명과 참여자 2명이 서로 다른 기기·인증 세션에서 하나의 `opening_session`으로 전체 흐름 완료
- 앱 미설치 참여자의 모바일 웹 가입·기여
- 앱 설치 상태에서도 `/i/*` 웹 교환→수락→1회용 `/app/h/*` handoff
- 권한 거부→설정 복귀, GPS 불확실→재측정, 인원 부족→다음 시도 공유
- 계정 삭제→collecting 취소 또는 sealed 소유권 이전·정족수 재계산
- 공개 후 30일과 미공개 90일 삭제
- 공개 마지막 화면→멤버·장소 선택 복사→다음 구덩이 발행
- 네트워크 중단 중 업로드·봉인·공개 재시도
- 과거 DB snapshot 복원→`begin_restore` mode/run ID·global epoch→기존·갱신·신규 사용자 session과 direct PostgREST/RPC 거부→동일 run ID restore lane만 state/deletion/media-retention 허용→scope별 deletion ledger·모든 overdue TTL/media 삭제→부정 조회·300초 대기→`finish_restore` epoch 재전진→traffic open
- 전용 review hostname의 host-only cookie→같은 IAP subject 1회 열람 성공→다른 subject·host 재사용 거부

### 성능·신뢰성 테스트

- NFR-01의 일곱 핵심 API를 endpoint·결과 코드별로 집계하고 유효 요청의 계약상 성공(2xx·초대 교환 303)과 예상 4xx를 분리한다.
- 80ms RTT, down 10Mbps, up 5Mbps, 1% packet loss에서 가상 사용자 20명이 10분 동안 비미디어 핵심 흐름을 실행해 API·첫 데이터 p95를 측정한다.
- 서로 다른 pit 100개의 countdown 종료를 동시에 발생시켜 전부 30초 안에 정확히 한 번 opened가 되고 조기 공개·중복 전이가 0건인지 검증한다.

### 실기기·운영 검증

- iOS와 Android 실제 기기 카메라·위치
- 실내·실외·경계 150m에서 정확도 판정
- 푸시 비허용·토큰 만료·앱 재설치
- 실제 카카오톡 unfurl·초대 클릭과 tokenless redirect
- 캘린더 거부 fallback, VoiceOver·TalkBack, 200% 글자, 44pt 터치 대상
- 예약 작업 재실행과 DB 복구, GCS bucket/IAM drift 검사

## 6. 병렬화 가능 범위

```text
WP-00 -> WP-01 -> WP-02 -> WP-03 -> WP-04
WP-01 + WP-02 + WP-03 + WP-04 -> WP-05
WP-01 + WP-02 + WP-03 + WP-04 + WP-05 -> WP-06
WP-00 -> WP-07A 관측성·접근성 트랙
WP-00~06 + WP-07A + 외부 승인 게이트 -> WP-07B 파일럿 온보딩
```

- WP-00 이후 `contracts/schema/RLS`와 `invite-web UI`의 화면 골격은 병렬 가능하다.
- WP-01의 계약이 확정된 뒤 모바일 생성 UI와 웹 초대 UI를 병렬 구현할 수 있다.
- 상태 전이, RLS, signed URL은 한 담당 영역으로 유지한다.
- 작성과 완료 검증은 같은 에이전트가 승인하지 않는다.
- WP-05는 WP-01~04 완료 전 시작하지 않는다.
- WP-06은 WP-01~05 완료 전 완료 판정을 내리지 않는다. 신고·정책 UI 골격은 앞서 만들 수 있지만 공개 격리·삭제 E2E까지 통과해야 한다.
- WP-07A는 각 WP와 병렬로 진행한다. 외부 파일럿은 WP-00~06·WP-07A와 모든 외부 승인 게이트 완료 전 시작하지 않는다.

## 7. 각 작업 완료 보고 형식

```markdown
- 완료한 PRD ID:
- 변경 파일:
- 사용자에게 보이는 결과:
- 실행한 검증과 결과:
- 남은 위험 또는 미검증:
- 다음에 시작 가능한 WP:
```

“구현 완료”만으로 작업을 닫지 않는다. 실행 가능한 증거와 남은 제한을 함께 기록한다.
