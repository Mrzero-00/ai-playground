# 묻어두지 MVP 아키텍처

## 제품 경계

첫 MVP는 `한 달 뒤 우리 예언` 한 가지 놀이만 검증한다.

- 2~8명 비공개 그룹
- 텍스트와 사진 1장
- 최소 30일 잠금
- 장소 반경 150m와 필요 인원 확인
- 기여 마감, 봉인, 대기, 공동 공개, 다음 구덩이 생성
- 위치는 앱을 사용하는 동안에만 확인하고 실시간 이동 경로는 저장하지 않음

음성·영상, 결제, 공개 피드, NFC, AI 작성, 여러 놀이 유형은 초대 수락률과 현장 공개 성공률을 검증한 뒤 추가한다.

## 권장 구성

```text
Expo React Native 앱
  ├─ Expo Router: 앱 화면과 딥링크
  ├─ expo-camera: 사진 촬영과 공개 당일 QR 보조 인증
  ├─ expo-location: 장소 등록과 foreground 체크인
  ├─ react-native-maps + Google Maps: 플랫폼 제한 키로 장소 핀 렌더링
  └─ expo-notifications + Expo Push Service: 공개 알림

초대 웹(MVP 필수 Next.js 앱)
  └─ /i/:token 초대 미리보기, 수락, 첫 기여, 앱 설치 연결

Supabase
  ├─ Auth: 이메일 OTP부터 시작
  └─ Postgres + PostGIS: 그룹, 장소, 반경 판정, 상태 머신과 제한 RPC

Google Cloud Run
  ├─ provider-api: Supabase JWT 검증, Places 검색, 사용자별 rate limit
  ├─ media-api: Supabase JWT 검증, 업로드 준비·완료와 job enqueue
  ├─ ops-api/media-review-api: IAP 운영 조치·격리본 단기 열람
  ├─ image/media-ops/media-retention worker: 처리·격리·물리 삭제
  ├─ state/notification/deletion worker: 상태 전이·알림·DB 삭제
  └─ signature-updater/restore-controller Job: signature 발행·격리 복원 통제

Cloud Scheduler + Cloud Tasks + Secret Manager + VPC/Cloud NAT
  └─ 예약·재시도 OIDC 호출, workload identity·비밀, provider-api 고정 outbound IP

Google Cloud Storage
  └─ public access prevention + uniform access의 raw/final/quarantine private bucket

Google Cloud Vision SafeSearch
  └─ adult/racy/violence 안전 검사; 원본과 결과를 분석 로그에 남기지 않음

Sentry Release Health
  └─ crash-free session; Session Replay 비활성화와 전송 전 PII scrub
```

앱과 초대 웹은 화면 컴포넌트를 억지로 공유하지 않는다. 도메인 타입, API 계약, 검증 스키마, 디자인 토큰만 공유한다.

## 서버가 가져야 하는 권한

클라이언트 시간과 클라이언트가 계산한 상태를 잠금 해제 근거로 사용하지 않는다.

- 서버 시간을 기준으로 `draft → collecting → sealed → opened`를 전환한다.
- `unlockable`은 영속 상태로 저장하지 않고 `sealed && server_now >= reveal_at`으로 계산한다.
- 공개 시각, 기여 마감, 필요 인원, 장소 좌표와 반경은 서버 제약으로 검증한다.
- 봉인 후에는 작성자 본인도 본문과 미디어 경로를 읽을 수 없게 RLS를 적용한다.
- 10초 카운트다운이 끝나 pit과 공개 세션이 모두 `opened`가 된 뒤에만 private Google Cloud Storage 객체의 5분 signed URL을 발급한다.
- 사용자의 현재 좌표 원문은 원칙적으로 저장하지 않고 체크인 성공 여부, 거리, 정확도만 짧게 보관한다.
- 푸시 알림은 편의 기능일 뿐 공개 상태의 원본 데이터로 사용하지 않는다.

## 핵심 테이블

- Supabase `auth.users` + `profiles`
- `pits`
- `pit_members`
- `invites`
- `invite_sessions`
- `app_handoffs`
- `contributions`
- `media_objects`, `upload_intents`, `media_processing_jobs`, `media_ops_jobs`
- `opening_sessions`
- `checkins`
- `notification_jobs`, `notification_deliveries`
- `device_tokens`
- `user_blocks`
- `content_safety_checks`
- `deletion_requests`
- `operator_profiles`, `review_sessions`, `security_state`
- `location_usage_records`
- `reports`
- `audit_events`
- `analytics_events`

초대 토큰은 충분히 긴 난수로 만들고 DB에는 해시만 저장한다. 초대 링크의 미리보기에는 콘텐츠, 정확한 좌표, 전체 이름을 넣지 않는다.

Maps SDK 키는 iOS bundle ID와 Android package/SHA-1로 각각 제한한다. Places API (New)는 모바일 앱이나 hosted Supabase Edge Function에서 직접 호출하지 않는다. `provider-api` Cloud Run 서비스가 Supabase JWT를 검증하고 사용자별 rate limit을 적용해 호출한다. 서비스의 모든 outbound traffic은 VPC와 예약 IP를 가진 Cloud NAT로 보내며, 별도 Places 키는 API와 이 고정 IP로 제한해 Secret Manager에 둔다. 검색 후보는 화면에 일시 표시하고 저장하지 않는다. 선택 후에는 허용된 `place_id`, 사용자가 지도에서 확정한 좌표와 직접 확인·입력한 `venue_label`만 저장하며, 검색·지도 화면의 Google Maps attribution을 숨기지 않는다.

Cloud Run은 Supabase 대체 백엔드가 아니다. 사용자 요청은 `provider-api`, `media-api`만 Supabase JWT와 rate limit으로 받는다. `apps/ops-web`, `ops-api`, `media-review-api`는 직접 Cloud Run IAP Preview를 쓰지 않고 외부 HTTPS Load Balancer의 IAP 뒤에 둔다. 초기 운영자 IdP는 조직 관리형 Google Cloud Identity/Workspace 계정과 전용 operator group으로 고정하고 조직 정책에서 2-Step Verification을 강제한다. Cloud Run ingress는 load balancer 경로로 제한하고 IAP service agent만 Invoker를 받는다. `image-worker`, `media-ops-worker`, `media-retention-worker`, `state-worker`, `notification-worker`, `deletion-worker`는 public invocation을 거부하고 audience가 고정된 전용 Cloud Tasks 또는 Cloud Scheduler caller의 OIDC와 Cloud Run Invoker만 받는다. `signature-updater`, `restore-controller`는 Cloud Run Job으로 실행한다. 장기 service-account JSON과 Supabase service role은 소스·이미지·클라이언트에 넣지 않고 Secret Manager와 workload identity를 사용한다. 요청 ID와 job ID만 양쪽 관측성에 연결한다.

Cloud Run은 Supabase service-role key를 사용하지 않는다. `provider_gateway`, `media_gateway`, `ops_gateway`, `media_reviewer`, `media_worker`, `media_ops_worker`, `media_retention_worker`, `state_worker`, `notification_worker`, `deletion_worker`, `restore_controller`를 각각 `NOINHERIT` Postgres 역할로 만들고 테이블 권한 없이 `CONNECT`, 대상 schema `USAGE`, 아래 allowlist의 security-definer 함수 `EXECUTE`만 부여한다. 함수는 `PUBLIC` 실행을 revoke하고 빈 `search_path`와 fully-qualified table 이름을 사용한다. TLS Supavisor 연결 자격은 역할별로 Secret Manager에 저장하고 90일마다 회전한다. Supabase Edge Function은 MVP의 예약·관리 작업에 사용하지 않으며 앱과 웹은 사용자 JWT/RLS가 적용되는 공개 RPC만 호출한다.

- `provider_gateway`: `consume_place_rate_limit`
- `media_gateway`: `create_upload_intent`, `consume_upload_intent`, `enqueue_media_job`, `authorize_media_download`
- `ops_gateway`: `map_iap_operator`, `list_report_queue`, `get_report_context`, `create_media_ops_job`, `restrict_account`, `resolve_report`, `set_quarantine_expiry`
- `media_reviewer`: `authorize_quarantine_review`, `consume_review_session`, `record_review_access`
- `media_worker`: `claim_media_job`, `renew_media_lease`, `authorize_media_promotion`, `finish_media_promotion`, `fail_media_job`, `enqueue_candidate_deletion`
- `media_ops_worker`: `claim_media_ops_job`, `finish_quarantine`, `finish_restore`, `finish_violation_delete`
- `media_retention_worker`: `claim_media_deletion`, `finish_media_deletion`, `list_orphan_candidates`
- `state_worker`: `seal_due_pits`, `cancel_insufficient_pits`, `expire_opening_sessions`, `finalize_open`, `archive_due_pits`, `expire_unopened_pits`, `expire_invite_sessions`, `expire_app_handoffs`, `expire_upload_intents`, `expire_review_sessions`
- `notification_worker`: `claim_notification_delivery`, `finish_notification_delivery`, `remove_invalid_device_token`, `purge_stale_device_tokens`
- `deletion_worker`: `claim_deletion_request`, `apply_account_deletion`, `apply_contribution_deletion`, `apply_membership_deletion`, `purge_pit`, `transfer_owner`, `purge_abandoned_profiles`, `purge_invite_artifacts`, `purge_upload_intents`, `purge_finished_media_jobs`, `purge_notification_metadata`, `purge_completed_deletion_requests`, `purge_consent_records`, `purge_review_sessions`, `purge_expired_safety_checks`, `purge_expired_reports_and_audits`, `purge_expired_analytics_events`
- `restore_controller`: `begin_restore`, `replay_deletion_ledger`, `reconcile_overdue_restored_data`, `verify_restore_gate`, `finish_restore`

모든 함수는 검증된 사용자/작업 ID, 상태, 서버 시각과 idempotency key를 다시 검사하고 감사 이벤트를 남긴다. 각 역할이 allowlist 밖의 table·sequence·function을 읽거나 실행하면 테스트에서 실패해야 한다.

ops-api와 media-review-api는 `x-goog-iap-jwt-assertion`만 신뢰한다. IAP JWKS의 현재·회전 key를 cache/refresh하며 JWT header의 `alg=ES256`, 유효한 `kid`와 signature, 30초 clock skew 안의 `iat`·`exp`, `iss=https://cloud.google.com/iap`, 각 외부 Load Balancer backend service의 정확한 `/projects/{PROJECT_NUMBER}/global/backendServices/{SERVICE_ID}` audience를 검증한 뒤 `sub`의 HMAC을 `operator_profiles.iap_subject_hash`에 매핑한다. unsigned `x-goog-authenticated-user-*` header는 identity 근거로 사용하지 않는다. 애플리케이션은 존재하지 않는 범용 MFA claim을 기대하지 않는다. 대신 release gate가 Google Admin의 operator 조직 단위 2-Step Verification 강제 정책과 모든 active operator의 등록 증거를 확인한다. 프로필은 `safety_reviewer|safety_admin`, `active`, 권한 만료 시각을 가지며 직접 table 조회는 거부한다. reviewer는 안전한 신고 대기열·격리·복구·일반 종결만, admin은 계정 제한·법적 보존 만료 변경까지 할 수 있다. ops-api의 상태 변경은 GET을 사용하지 않으며 정확한 ops-web HTTPS Origin, `Sec-Fetch-Site: same-origin`, IAP subject에 서버 측 해시로 묶인 만료 짧은 CSRF token의 `X-CSRF-Token` header를 모두 요구한다. 허용 Origin은 단일 상수 allowlist이고 Origin/Fetch Metadata/token이 없거나 불일치하면 DB 함수 호출 전에 거부한다. 모든 조치는 `report_id`, 비어 있지 않은 사유, request ID가 있어야 `media_ops_jobs` 또는 감사 이벤트를 만들고, 운영 웹이나 운영자에게 DB/GCS 직접 권한을 주지 않는다.

반응과 별도 점수·게임 테이블은 V1.1 이후에 추가한다. MVP 공개 결과는 `pits.opened_at`과 `opening_sessions`로 표현한다.

## 저장소 경계

현재 Expo 앱을 옮기지 않고 기능 경계를 추가한다.

```text
묻어두지/
├─ src/                    # Expo 모바일 앱
├─ apps/invite-web/        # Next.js 초대 미리보기·가입·첫 기여
├─ apps/ops-web/           # IAP 뒤 신고 대기열·사유 기반 검수
├─ packages/contracts/     # API 타입, 검증 스키마, 오류·이벤트 계약
├─ services/provider-api/  # Cloud Run Places 인증 프록시
├─ services/media-api/     # Cloud Run 업로드 준비·완료와 queue
├─ services/ops-api/       # IAP 운영자 대기열·조치 gateway
├─ services/media-review-api/ # Cloud Run 운영자 격리본 access API
├─ services/image-worker/  # Cloud Run private 이미지 처리 worker
├─ services/media-ops-worker/ # 격리·복구·위반 확정 copy/delete
├─ services/media-retention-worker/ # TTL·고아 객체 물리 삭제
├─ services/state-worker/  # 봉인·공개·만료 상태 전이
├─ services/notification-worker/ # Expo Push 전달
├─ services/deletion-worker/ # 계정·기여·멤버십·pit DB 삭제
├─ jobs/signature-updater/ # 검증된 ClamAV DB bundle 발행
├─ jobs/restore-controller/ # deletion ledger·overdue TTL 복원 gate
├─ content-policy/         # 사람이 승인한 버전별 차단어 규칙
├─ infra/gcp/              # Cloud Run, Tasks, VPC, NAT, IAM 선언
└─ supabase/
   ├─ migrations/          # 스키마, PostGIS, RLS, DB 함수
   └─ tests/               # 역할별 권한과 상태 전이 테스트
```

모바일과 웹은 UI 컴포넌트를 공유하지 않는다. 도메인 계약, 검증 스키마와 디자인 토큰만 공유한다.

## 도메인 상태

### 구덩이

```text
DRAFT -> COLLECTING -> SEALED -> OPENED -> ARCHIVED
   └───────────────> CANCELLED ───────────────┐
                         SEALED -> EXPIRED ───┼-> PURGE_PENDING -> DELETED
```

- `DRAFT → COLLECTING`: 방장이 발행한다. 공개 시각, 장소, 반경, 필요 인원, 마감은 이후 잠근다.
- `COLLECTING → SEALED`: 서버 마감 시각에 활동 멤버 2명과 제출 기여 2개 이상을 확인한 뒤 전환한다. 미달이면 `CANCELLED`로 전환한다.
- `SEALED → OPENED`: 정족수 충족 때가 아니라 10초 카운트다운 종료 후 `finalize_open`이 공개 세션과 함께 전환한다.
- `SEALED → EXPIRED`: 공개 예정 시각 후 90일 동안 열지 못한 경우 전환한다.
- `OPENED → ARCHIVED`: 공개 후 30일 보존이 끝나 콘텐츠를 삭제한 뒤 전환한다.
- `CANCELLED|EXPIRED → PURGE_PENDING → DELETED`: 재실행 가능한 삭제 작업이 DB·GCS media·초대·정확한 장소를 제거한다.
- 봉인 전 취소만 허용한다. 계정·본인 기여 삭제는 상태와 관계없이 처리한다.

### 멤버와 기여

```text
member:       INVITED -> ACCEPTED -> LEFT | REMOVED
contribution: EDITING -> SUBMITTED -> SEALED -> REVEALED
                  └──────── delete request ─────────> DELETED
              SUBMITTED | SEALED | REVEALED -> QUARANTINED
                                                  ├─ cleared -> prior state
                                                  └─ confirmed / expired -> DELETED
```

봉인 시 `ACCEPTED` 멤버 스냅샷과 정족수를 고정한다. 탈퇴·계정 삭제로 자격 멤버가 줄면 PRD 7.4의 복구 규칙을 적용한다.

`QUARANTINED`는 삭제가 아니다. `quarantined_from_state`를 보존하고 멤버 접근을 차단한다. 기각 시 현재 pit이 `COLLECTING`이면 `SUBMITTED`, `SEALED`이면 `SEALED`, `OPENED`이고 보존기한 안이면 `REVEALED`로 복원한다. pit이 `ARCHIVED|EXPIRED|PURGE_PENDING|DELETED`이거나 보존기한이 지났으면 복원하지 않고 `DELETED`로 전환한다.

### 공개 세션

```text
ACTIVE -> COUNTDOWN -> OPENED
   └────────────────> EXPIRED
```

- `check_in`은 pit 행을 잠그고 `expires_at<=server_now`인 `ACTIVE` 세션을 먼저 `EXPIRED`로 바꾼 다음, partial unique constraint 아래 15분 유효 세션을 생성하거나 기존 `ACTIVE|COUNTDOWN` 세션을 재사용한다.
- `(opening_session_id, member_id)`는 유일하다.
- 모든 체크인의 `expires_at`은 세션의 `expires_at`과 동일하다.
- 정족수는 `ACTIVE.expires_at>server_now`일 때만 충족할 수 있다. 충족 트랜잭션은 참석자와 GPS/QR 방식을 별도 snapshot으로 고정하고 세션만 `COUNTDOWN`으로 바꾼다. `countdown_ends_at = server_now + 10 seconds`, `expires_at = greatest(expires_at, countdown_ends_at)`로 기록하며 pit은 `SEALED`로 남는다.
- `COUNTDOWN`은 새 체크인을 받지 않고 active TTL로 만료되지 않는다. 카운트다운 종료 후 멱등 `finalize_open`이 지연 실행되더라도 고정한 참석 집합을 사용해 세션과 pit을 함께 `OPENED`로 바꾼다.
- 재연결한 클라이언트는 서버 시각 기준 남은 카운트다운에 합류한다.
- 한 번 정상 공개된 뒤에는 활성 멤버가 장소 밖에서도 30일 동안 다시 볼 수 있다.
- `open_reason`은 `NORMAL|SOLO_RECOVERY`이며 후자는 북극성 지표에서 제외한다.

## 데이터 모델 기준

### `profiles`

- `id` = `auth.users.id`
- `nickname`, `age_gate_confirmed_at`, `status`
- 전역 로그아웃 판정용 `tokens_invalid_before`
- 계정 삭제 처리용 `deletion_requested_at`, `deleted_at`

`security_state`는 단조 증가 `global_tokens_invalid_before`, `restore_mode`, `restore_run_id`를 가진다. `logout_all`은 개인 `profiles.tokens_invalid_before=server_now`를 먼저 기록한 뒤 사용자의 Supabase `signOut(scope=global)`을 호출한다. 사용자 JWT를 받는 앱·초대 웹의 RLS/RPC와 provider/media API 함수만 JWT 서명·issuer·audience·expiry, profile active 상태, `session_id`가 실제 `auth.sessions`의 같은 subject이고 그 `created_at`이 개인·global epoch보다 늦은지 검사한다. 이 user-session helper는 `PUBLIC` 실행을 revoke한다. provider/media API도 JWKS 검증 뒤 `sub`, `iat`, `session_id`를 넘겨 같은 검사를 반복한다. ops/media-review 함수는 IAP identity와 operator role, private worker/restore 함수는 전용 NOINHERIT role·OIDC/OAuth caller·job state/idempotency로 인증하며 end-user `auth.sessions`를 요구하지 않는다. 따라서 Auth signOut 호출이 실패하거나 이전 refresh token이 새 JWT를 발급해도 같은 과거 session은 private 사용자 요청에 사용할 수 없고, 이미 발급된 미디어 URL만 최대 5분 남는다.

### `pits`

- `owner_id`, `state`, `campaign_type`; `owner_id`는 `PURGE_PENDING|DELETED`에서만 null을 허용하는 CHECK 적용
- `title`, `reveal_at`, `timezone`, `contribution_deadline`
- `venue geography(Point, 4326)`, 사용자 확인 `venue_label`, nullable `source_place_id`, `radius_m`
- `quorum_type`, `required_count`, `member_snapshot_count`
- `sealed_at`, `opened_at`, `open_reason`, `retention_expires_at`, `unopened_retention_expires_at`, `version`

`radius_m`은 V1에서 `CHECK (radius_m = 150)`로 고정한다. 정확한 `venue`는 활성 멤버 전용 view와 서버 판정 함수에서만 사용하며, 초대 미리보기·분석·로그에는 `venue_label`의 구·동 수준 값만 반환한다. UI는 지도 핀을 보여주되 원시 위·경도 숫자는 표시하지 않는다.

### `pit_members`

- `pit_id`, `user_id`, `role`, `status`
- `joined_at`, `left_at`, `sealed_eligibility`
- `(pit_id, user_id)` unique

### `invites`

- `pit_id`, `token_hash`, `max_uses`, `use_count`
- `expires_at`, `revoked_at`, `created_by`
- 원문 토큰은 한 번만 반환하고 URL·로그·분석에서 제거한다.

### `invite_sessions`

- 최초 `/i/:token` 요청에서 토큰 해시를 검증한 뒤 무작위 `session_id`를 `HttpOnly; Secure; SameSite=Lax` 쿠키로 설정한다.
- 토큰의 유효 여부와 관계없이 토큰 없는 `/i`로 303 redirect하고 모든 응답에 `Referrer-Policy: no-referrer`, `Cache-Control: no-store`를 적용한다. 오류는 토큰 없는 단기 코드로 표시한다.
- Next.js, CDN과 APM은 원문 요청 URL을 수집하지 않고 route template `/i/:token`과 request ID만 기록한다.
- 세션은 invite, 만료 시각, revoke version에 묶이며 링크 회전·폐기와 기여 마감 때 무효화된다. 토큰 검증만으로 사용 횟수를 올리지 않고 실제 `accept_invite`에서 원자적으로 올린다.

공유 초대 `/i/*`는 AASA의 Universal Link와 Android intent filter에서 제외해 설치된 앱도 항상 웹 교환을 거친다. 참여 수락 뒤 웹은 `create_app_handoff`로 128비트 이상, 60초, 1회용 코드를 만들고 `app_handoffs`에 해시만 저장한다. 연결 대상 `/app/h/*`만 Universal/App Link로 앱에 연다. 앱은 사용자·멤버십을 재검증해 `consume_app_handoff`를 호출하고 코드를 메모리에서 지운 뒤 tokenless pit route로 `replace`한다. 앱이 열리지 않아 fallback 웹이 응답해도 `no-referrer`, `no-store`를 적용하며 CDN·서버·APM은 query와 원문 path를 수집하지 않고 `/app/h/:code` route template만 기록한다.

### `contributions`와 `media_objects`

- 기여는 `(pit_id, author_id)` unique다.
- `contributions`: `text`, `state`, `quarantined_from_state`, `submitted_at`, `sealed_at`, `quarantined_at`, `deleted_at`
- `media_objects`: private object key, MIME, byte, dimension, checksum, upload 상태
- EXIF를 제거하고 decode/re-encode한 파생 이미지만 최종 객체로 승격한다.
- 미완료 임시 업로드와 고아 객체는 24시간 내 정리한다.

### `media_processing_jobs`

- `media_object_id`, `state`, `attempt_count`, `next_attempt_at`, `last_error_code`, `media_generation`, `lease_id`, `lease_expires_at`, `created_at`, `finished_at`
- 상태는 `queued -> processing -> promoting -> succeeded | retryable_failed | terminal_failed | canceled`이며 object마다 활성 job 하나만 허용한다.
- claim은 row lock 아래 새 `lease_id`와 120초 `lease_expires_at`을 발급하고 processing→promoting 전 lease를 한 번 갱신한다. finish는 현재 lease와 `media_generation`이 모두 일치해야 한다.
- reconciler는 Cloud Tasks 생성이 누락된 `queued|retryable_failed`뿐 아니라 lease가 만료된 `processing|promoting`도 다시 claim 가능하게 만든다. stale promoting의 candidate는 `{generation}/{lease_id}` immutable key라 DB에 연결하지 않고 24시간 고아 정리 대상으로 남기며, 새 lease는 새 key를 사용한다.
- image-worker는 job ID와 `media_generation` fencing token으로 멱등 처리한다. 최대 3회 지수 backoff 후 `terminal_failed`로 바꾸며 삭제·탈퇴·취소·마감은 generation을 올리고 job을 `canceled`로 만든다.

### `opening_sessions`와 `checkins`

- 공개 세션은 `pit_id`, `state`, `started_at`, `expires_at`, `countdown_ends_at`, `opened_at`을 가진다.
- 체크인은 `session_id`, `member_id`, `method`, `result`, `distance_m`, `accuracy_m`, `expires_at`을 가진다.
- 현재 위치 위·경도 원문은 DB에 저장하지 않는다.

### 알림·운영

- 알림은 예약·시도·성공·실패와 dedupe key를 분리해 기록한다.
- 신고는 대상, 사유, 상태와 처리 SLA를 기록하되 일반 운영 목록에 원문 콘텐츠를 노출하지 않는다.
- 감사 이벤트는 행위자, 대상, 이전·다음 상태, 서버 시각, request ID를 기록하고 콘텐츠·좌표를 제외한다.
- 위치 이용 확인 기록은 사용자, 목적, 동의 버전, 이용 시각과 결과만 최소 6개월 보존하며 현재 좌표를 포함하지 않는다.
- 차단은 `(blocker_id, blocked_id)` unique이며 새 멤버십 수락과 직접 알림에만 강제한다. 기존 구덩이 정족수는 자동 변경하지 않는다.
- 격리 객체는 일반 media 경로와 분리된 private quarantine prefix에 두고 기본 30일 안에 복구 또는 삭제한다. 법적 보존은 사유와 최대 1년의 만료 시각이 있는 경우만 허용한다.
- 콘텐츠 안전 검사에는 provider 결과·규칙 버전·결정·시각만 남기고 원문과 object key는 넣지 않는다. 90일 후 삭제하되 신고로 전환된 조치 메타데이터는 신고 기록의 1년 보존을 따른다.

## RLS와 RPC 권한 행렬

| 행위 | 인증 멤버 | 방장 추가 권한 | 비멤버·anon | 운영자 |
|---|---|---|---|---|
| 구덩이·안전한 장소 라벨 읽기 | 본인 구덩이만 SELECT | 동일 | 직접 SELECT 거부 | 제한된 메타데이터 |
| 정확한 장소 핀 읽기 | 본인 구덩이 전용 view | 동일 | 거부 | 사유 기반 |
| 초대 미리보기 | 해당 없음 | 해당 없음 | `exchange_invite` 후 초대 세션으로 safe DTO만 | 해당 없음 |
| 초대 수락 | `accept_invite` RPC만 | 링크 회전·폐기는 RPC만 | 직접 INSERT/UPDATE 거부 | 거부 |
| pit 발행·취소 | 직접 상태 UPDATE 거부 | `publish_pit`, `cancel_pit` RPC만 | 거부 | break-glass만 |
| collecting 기여 | 본인 것만 RPC로 작성·수정·삭제 | 다른 멤버 본문 접근 불가 | 거부 | 기본 거부 |
| sealed 기여 본문·object key | 모두 거부 | 모두 거부 | 거부 | 기본 거부 |
| opened 기여 본문 | 활성 멤버만 SELECT | 동일 | 거부 | 신고 사유 기반 |
| 체크인·QR | `check_in`, `redeem_qr` RPC만 | 동일 | 거부 | override 미지원 |
| countdown·open | 클라이언트 UPDATE 거부 | 동일 | 거부 | `finalize_open` 서버 작업만 |
| signed URL 발급 | `opened` 멤버만 media-api access endpoint | 동일 | 거부 | signed URL 미사용; IAP·IdP MFA·사유를 검증한 media-review-api proxy만 격리 조사 |
| 신고 INSERT | 본인 신고 RPC | 동일 | 거부 | 상태 처리 RPC |
| 차단·삭제 요청 | 본인 대상 RPC | 소유 pit도 동일 삭제 규칙 | 거부 | 대기열·감사 처리 |
| 현재 좌표 원문 | 저장하지 않음 | 저장하지 않음 | 저장하지 않음 | 저장하지 않음 |

운영자 접근은 service role을 UI에 직접 노출하지 않고 별도 서버 함수, 사유 입력과 감사 로그를 거친다.

모든 private 테이블의 클라이언트 직접 `INSERT|UPDATE|DELETE`는 기본 거부한다. 아래 표에 적힌 view/RPC/worker만 예외다.

| 자원 | 클라이언트 읽기 | 허용 변경 경로 | worker·운영자 |
|---|---|---|---|
| `profiles` | 본인과 공동 구덩이의 안전한 프로필 view | 본인 `update_profile`, `request_account_deletion` RPC | 인증 삭제 worker; 운영자는 제한 메타데이터만 |
| `pits` | 활성 멤버용 DTO와 장소 전용 view | 방장 `publish_pit`, `cancel_pit` RPC | 상태·보존 worker; break-glass는 사유·감사 필수 |
| `pit_members` | 활성 멤버가 닉네임·역할·기여 여부 view 조회 | `accept_invite`, `leave_pit`, 봉인 전 `remove_member` RPC | 계정 삭제·소유권 이전 worker |
| `invites`, `invite_sessions`, `app_handoffs` | 방장은 안전한 상태 view, anon은 교환된 초대 세션의 preview DTO만 | `exchange_invite`, `accept_invite`, `rotate_invite`, `revoke_invite`, `create_app_handoff`, `consume_app_handoff` RPC | 만료 worker; 원문 토큰·handoff 조회 불가 |
| `contributions` | collecting 작성자 본인, opened 활성 멤버용 상태 기반 view | `submit_contribution`, `delete_contribution` RPC | 안전 격리 worker; 운영 원문 조회는 사유·감사 필수 |
| `media_objects` | object key 직접 SELECT 거부; 작성자는 처리 상태, opened 멤버는 access API만 호출 | media-api와 전용 DB 함수, `delete_contribution` RPC | 검사·정규화 worker와 generation 조건부 media-retention-worker |
| `media_processing_jobs` | 작성자는 원문 없는 처리 상태 DTO만 | media-api `complete_upload`가 생성, 클라이언트 직접 변경 거부 | Cloud Tasks dispatcher와 image-worker만 상태 전이 |
| `media_ops_jobs` | 직접 조회·변경 없음 | 클라이언트 변경 거부 | ops-api의 감사된 RPC만 생성, media-ops-worker만 claim·완료 |
| `opening_sessions`, `checkins` | 활성 멤버가 좌표 없는 상태 DTO 조회 | `check_in`, `redeem_qr` RPC | `finalize_open`, 만료 worker; 운영 override 없음 |
| `notification_jobs`, `notification_deliveries` | 직접 조회 없음 | 클라이언트 변경 없음 | 예약·전달 worker만 쓰기, 운영자는 전달 메타데이터만 |
| `device_tokens` | 본인 마스킹 목록 view | `register_device`, `unregister_device` RPC | 전달 오류·90일 미사용 정리 worker |
| `user_blocks` | 차단자가 본인 목록 view | `block_user`, `unblock_user` RPC | 서버가 초대·알림에서만 판정; 운영자 직접 변경 없음 |
| `content_safety_checks` | 직접 조회 없음; 작성자는 결과 코드 DTO만 | 클라이언트 변경 없음 | 안전 검사 worker만 쓰기, 원문·object key 로그 금지 |
| `deletion_requests` | 요청자가 본인 상태 DTO 조회 | 계정·기여 삭제 요청 RPC | 삭제·백업 만료 worker, 제한 운영자 |
| `location_usage_records` | 직접 조회·변경 없음 | 판정 RPC가 최소 기록 생성 | 위치정보 관리자만 법정 범위 조회 |
| `reports` | 신고자가 본인 상태 DTO 조회 | `create_report` RPC | ops-api allowlist의 대기열·조치 RPC와 사유·감사 로그 |
| `audit_events` | 클라이언트 조회·변경 없음 | security-definer RPC·worker만 append | 제한 운영자만 사유 기반 읽기 |
| `analytics_events` | 클라이언트 직접 조회·변경 없음 | 버전 검증 event ingest RPC만 append | 제품 분석자는 집계 view만, 13개월 purge는 deletion-worker |
| `operator_profiles`, `review_sessions` | 클라이언트 직접 조회·변경 없음 | IAP identity를 검증한 ops/media-review API만 전용 RPC | 권한 관리자는 별도 승인 절차, review session은 60초·1회용 |
| `security_state` | 인증 사용자 RLS/RPC는 session epoch+restore gate, session이 없는 anon safe RPC는 restore gate만 판정 | 클라이언트 변경 없음 | restore-controller만 `begin_restore`/`finish_restore`, epoch 되돌리기 거부 |

`archive_due_pits`, `expire_unopened_pits`는 `state_worker`만, `purge_pit`, `transfer_owner`는 `deletion_worker`만 실행한다. role별로 위 allowlist 밖의 직접 `SELECT|INSERT|UPDATE|DELETE`와 함수 실행이 실패하는 DB 테스트를 둔다.

### private GCS media 정책

- raw, final, quarantine bucket은 public access prevention과 uniform bucket-level access를 강제하고 Cloud CDN을 붙이지 않는다. 최종 객체 metadata는 `Cache-Control: private, no-store, max-age=0`으로 고정한다.
- 세 bucket 모두 생성 시 `softDeletePolicy.retentionDurationSeconds=0`으로 soft delete를 명시적으로 끄고 Object Versioning도 비활성화한다. Bucket/Object Retention Lock과 object legal hold는 설정하지 않는다. 법적 보존은 GCS의 숨은 삭제본이 아니라 접근이 차단된 별도 live quarantine 객체와 DB `expires_at`으로만 구현한다. 개인정보 삭제를 우선하므로 삭제된 미디어 byte의 운영 실수 복구는 제공하지 않으며 DB 백업에도 미디어 byte를 넣지 않는다.
- 클라이언트에 upload signed URL이나 GCS 자격을 발급하지 않는다. media-api가 10분 만료·1회용 DB upload intent를 만들고, 최대 10MB body를 인증된 `PUT /upload-intents/:id`로 받아 raw bucket에 streaming한다. intent claim은 원자적이며 성공·실패 뒤 재사용할 수 없다.
- raw·sanitized·quarantine 객체는 클라이언트가 직접 list/read하지 못한다. `opened` 상태와 활성 멤버를 전용 DB 함수로 확인한 media-api만 final 객체의 V4 GET signed URL을 정확히 300초로 발급한다.
- media-api service account는 raw object create와 final object GET 서명만, image-worker account는 raw read/delete, sanitized create/delete와 final create만 할 수 있다. media-ops-worker만 final source get/rewrite/delete, quarantine create/get/delete와 복구 시 final create를 할 수 있고 list·URL 서명 권한은 받지 않는다. copy/delete API에는 job의 정확한 generation precondition을 요구하고 IAM Condition/managed folder는 object prefix를 제한한다. media-retention-worker는 세 bucket에서 generation-qualified object delete와 고아 정리에 필요한 최소 object metadata list만 허용하고 object read/download·create·copy·서명 권한은 받지 않는다. 사용자용 media-api의 URL 서명 계정은 `signBlob`을 자기 계정에만 가지며 운영 검수는 GCS signed URL을 사용하지 않는다.
- media-review-api는 ops-web·ops-api와 path를 공유하지 않는 전용 hostname(예: `review.ops.mudeodooji.example`)에만 라우팅한다. 이 host에는 media-review-api 외 다른 backend를 두지 않는다. IAP Google identity와 2SV 강제 증거가 있는 활성 운영 역할, `report_id`, 열람 사유를 `authorize_quarantine_review`에서 검증해 60초·1회용 review secret의 해시와 `issued_to_operator_hash`를 저장한다. 원문 secret은 Domain 속성이 없는 host-only `__Host-review_session` cookie(`Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=60`)로 설정하고 같은 전용 host의 tokenless `/review/content`로 303 redirect한다. cookie 소비 때 현재 검증된 IAP subject HMAC이 `issued_to_operator_hash`와 일치하는지, 역할과 정확한 quarantine object generation이 유효한지 다시 검증하고 `no-store`로 proxy stream한 뒤 즉시 폐기한다. service account에는 quarantine object get만 주며 list·signBlob·final/raw 접근은 거부한다. 발급·소비·완료/중단을 감사 이벤트에 연결하고 secret·object key는 응답 본문·URL·로그에서 제거한다.
- media-ops-worker는 `media_ops_worker` `NOINHERIT` DB role의 격리·복구·위반 확정 함수만 실행한다. 운영자는 GCS IAM을 직접 받지 않고 사유·감사 로그가 필수인 처리 RPC로 job을 만들며, worker는 final→quarantine 또는 quarantine→final copy의 checksum과 generation을 확인하고 source를 삭제한 뒤에만 DB 전이를 확정한다. 실패하면 새 사용자 접근을 차단한 상태로 재시도한다.
- media-retention-worker는 `media_retention_worker` `NOINHERIT` DB role의 만료·삭제 대상 조회/확정 함수만 호출한다. DB row의 object generation과 GCS generation이 일치할 때만 삭제하고, generation 불일치·보존 미만·live quarantine은 실패 폐쇄한다. 삭제 뒤 DB tombstone을 확정하며 재시도는 멱등이다.
- anon, 비멤버, 탈퇴 멤버, 봉인 멤버의 list/read, upload intent 재사용·만료·10MB 초과, 카운트다운 전 download, URL 300초 만료, `no-store` header, 격리 후 기존 path 404를 GCS 통합 테스트로 검증한다. 인프라 drift test는 soft delete 0초, versioning off, retention policy·legal hold 없음과 각 service account의 허용/거부 행렬을 확인한다.

ClamAV signature는 사용자 media bucket과 분리된 private `av-signatures` 설정 bucket에 둔다. 예약 `signature-updater` Cloud Run Job이 6시간마다 공식 FreshClam DB를 받아 내장 서명·무결성을 검증하고, checksum·발행 시각·generation이 있는 immutable bundle과 `current.json` manifest를 generation precondition으로 원자 교체한다. updater account는 이 bucket만 create/update하고 media bucket에는 접근하지 못한다. image-worker는 manifest와 지정 bundle만 read해 ephemeral `/tmp/signatures.next`에서 checksum을 확인한 뒤 같은 인스턴스의 `/tmp/signatures`로 원자 rename한다. manifest 또는 bundle이 24시간보다 오래됐거나 불일치하면 사진 처리를 fail-closed한다.

## 서버 트랜잭션

다음 동작은 DB 함수 또는 동일한 트랜잭션 경계에서 수행한다.

1. **초대 수락:** 토큰 검증, 정원 잠금, 중복 멤버 확인, 사용 횟수 증가
2. **기여 제출:** 멤버·마감 검증, idempotency key 확인, 처리 완료 미디어 승격
3. **봉인:** 서버 시각과 최소 멤버·기여 검증, 스냅샷, 상태 전이, 알림 생성
4. **공개 세션 시작·체크인:** pit 잠금, 지난 ACTIVE 만료, 멤버·공개 시각 검증, 활성 세션 생성/재사용, PostGIS 거리 판정, 고정 세션 TTL 저장
5. **카운트다운 시작:** 세션 만료 전 정족수 잠금, 참석 집합 고정, 세션만 `COUNTDOWN`, `countdown_ends_at`과 연장된 `expires_at` 기록
6. **공개 확정:** 종료 시각 재검증 후 세션과 pit을 함께 `OPENED`, `opened_at`과 `open_reason` 기록
7. **미디어 접근:** media-api가 전용 DB 함수로 `opened` 멤버를 재검증한 뒤 GCS V4 300초·`no-store` signed URL 발급
8. **삭제:** 새 접근 차단, GCS 객체 삭제, 기여 tombstone, 소유권 이전과 정족수 재계산. 후계자가 없으면 owner를 null로 만들고 pit을 `PURGE_PENDING`으로 전환

각 동작은 idempotency key, unique constraint와 상태 버전을 사용해 중복 탭과 동시 요청에 안전해야 한다.

## 위치 판정 계약

클라이언트와 서버는 같은 세 가지 결과를 사용한다.

```text
accuracy가 null 또는 80m 초과       -> UNCERTAIN
distance + accuracy <= radius       -> INSIDE
distance - accuracy > radius        -> OUTSIDE
그 외                                -> UNCERTAIN
```

서버는 요청으로 받은 현재 좌표를 PostGIS 판정 후 버린다. 응답과 DB에는 결과, 거리, 정확도, 체크인 만료 시각만 남긴다.

## 미디어 수명

1. 클라이언트가 Cloud Run media-api에 Supabase JWT와 upload-intent 요청을 보낸다.
2. media-api는 JWT를 검증하고 `media_gateway` DB 함수로 멤버·마감·용량을 확인해 10분·1회용 intent를 만든다. 이어지는 PUT body는 10MB에서 중단하며 GCS raw bucket으로 streaming하고 intent를 소비한다.
3. upload 완료는 `media_processing_jobs`를 멱등 생성하고 Cloud Tasks에 image-worker 작업을 넣는다. enqueue 실패는 DB job reconciler가 복구한다.
4. Cloud Tasks OIDC로만 호출되는 image-worker는 원본의 MIME signature와 ClamAV 결과를 확인하고 pinned libvips/libheif로 decode한다. 단일 정지 이미지, 각 변 12,000px 이하, 총 5천만 pixel 이하만 허용해 압축 폭탄을 막는다. 런타임과 엔진 버전은 container digest로 고정한다. 공식 FreshClam signature DB는 별도 예약 작업이 6시간마다 갱신해 checksum과 시각을 기록하고, 24시간보다 오래됐거나 서명·무결성 검증이 실패하면 image-worker는 사진을 fail-closed로 거부한다.
5. auto-rotate 후 긴 변 4,096px 이하 sRGB JPEG로 재인코딩하고 metadata를 모두 제거한다. PNG alpha는 고정 배경색으로 합성하며 품질을 단계 조정해 4MB 이하로 만든다. 이 private 검사용 JPEG만 Google Cloud Vision SafeSearch에 전송한다.
6. SafeSearch 통과 뒤 `authorize_media_promotion(job_id, generation, checksum)`이 media·contribution·member·pit 행을 잠근다. job이 현재 generation이고, 기여가 삭제되지 않았으며 멤버가 active이고, pit이 `collecting`이고 마감 전일 때만 `promoting` lease를 발급한다.
7. worker는 검사용 임시본을 generation과 lease ID가 포함된 immutable final candidate key로 복사한 뒤 `finish_media_promotion`에서 같은 조건과 lease를 다시 확인해 DB에 연결한다. 중간에 삭제·탈퇴·취소·마감이 generation을 올렸거나 finish가 거부되면 candidate를 접근 불가 상태로 두고 `enqueue_candidate_deletion`으로 정확한 GCS generation의 media-retention task를 즉시 만든다. image-worker는 final delete 권한을 갖지 않는다. task 누락 reconciler와 24시간 sweeper가 미연결 candidate를 제거하며 DB에 연결되지 않은 객체는 어떤 access API도 서명하지 않는다.
8. 최대 3회 실패하면 사진을 `terminal_failed`로 표시하고 사진 없이 제출 또는 새 업로드만 허용한다. 같은 job 재실행은 파생본을 중복 생성하지 않는다.
9. 기여 마감 작업은 pending/promoting media job을 `canceled`로 만들고 generation을 올린 뒤, 완료 사진만 봉인하고 텍스트는 사진 없이 봉인할 수 있다. 원본·검사용·미연결 final은 삭제한다.
10. 봉인 중에는 모든 사용자에게 object key와 signed URL을 숨긴다.
11. 공개 후 30일이 지나면 media-retention-worker가 generation을 확인해 파생본을 물리 삭제하고 기여를 tombstone 또는 집계 정보로 바꾼다.
12. 미공개 sealed 콘텐츠는 공개 예정 시각 후 90일에 media-retention-worker가 정확한 장소와 미디어를 함께 물리 삭제한다.

작성자·계정 삭제는 위 일반 보존 시각보다 우선한다. 운영 격리는 새 접근과 URL 발급을 즉시 차단하고 final 객체를 quarantine에 checksum 검증 복사한 뒤 기존 path를 삭제한다. 이미 발급된 URL은 기존 path 삭제 뒤 404가 되고 늦어도 5분 안에 만료된다. 삭제 확인 전에 GCS 객체 삭제를 먼저 시도하며, 실패하더라도 기존 signed URL의 최대 수명은 5분이다.

## 예약 작업

| 실행 주체 | 호출과 인증 | 책임 | 금지 권한 |
|---|---|---|---|
| `state-worker` | 분 단위 Cloud Scheduler와 countdown Cloud Tasks의 전용 OIDC audience | 기여 마감·자동 봉인/취소, 공개 세션 만료, `finalize_open`, 30/90일 상태 만료와 알림 outbox 생성 | table 직접 접근, GCS, Expo Push, 삭제 ledger |
| `notification-worker` | outbox dispatcher Cloud Scheduler/Tasks의 별도 OIDC audience | 봉인 직후·공개 7일/1일/당일·보존 30일/7일/1일 전 알림 claim/전달, 무효 push token 제거 | 콘텐츠/정확한 장소 읽기, 상태 전이, GCS |
| `deletion-worker` | deletion outbox 전용 OIDC audience | 계정·기여·멤버십·pit DB 삭제, 소유권 이전, 외부 deletion ledger append, 보조 metadata TTL·백업 만료 추적 | ledger read/list, media byte 읽기·서명·직접 GCS 삭제 |
| `media-retention-worker` | deletion/orphan/TTL Cloud Tasks의 별도 OIDC audience | generation 조건부 raw/final/quarantine 물리 삭제와 24시간 고아 정리 | object read/download/create/copy/sign, 범위 밖 DB 함수 |
| `media-ops-worker` | 감사된 운영 조치가 만든 Cloud Tasks의 별도 OIDC audience | 격리·복구·위반 확정 copy/delete | public 호출, list/sign, 운영 결정 생성 |
| `signature-updater` | 6시간 Cloud Scheduler가 실행하는 Cloud Run Job 전용 실행 역할 | FreshClam bundle 검증·발행 | 사용자 DB와 media bucket 접근 |
| `restore-controller` | break-glass 복원 계정이 OAuth로 해당 Cloud Run Job만 실행 | 외부 ledger read/replay, overdue TTL 재조정, 부정 검증 결과와 traffic gate 승인 자료 생성 | 평시 실행, 사용자 media read/sign, notification 전달 |

Cloud Run 서비스 target은 서로 다른 caller service account와 고정 OIDC audience를 쓰고 대상 서비스의 Invoker만 부여한다. `signature-updater` Job은 별도 Scheduler account가 OAuth access token으로 Cloud Run Jobs API의 해당 Job `:run`만 호출한다. `restore-controller` Job은 평시 권한이 없는 break-glass 복원 account가 승인 시간창에 OAuth로 이 Job만 호출한다. 두 account는 다른 Job·서비스 Invoker를 받지 않는다. worker runtime의 Postgres 역할은 앞의 RPC allowlist만 실행하며 Supabase service role을 쓰지 않는다. 예약 작업은 dedupe key와 DB outbox를 사용해 재실행돼도 상태와 알림을 중복 생성하지 않는다. countdown 진입 트랜잭션은 exact-time `finalize_open` task를 함께 만들고, 분 단위 state-worker scan이 누락 task를 복구한다.

media-retention-worker는 raw/final/quarantine에서 삭제 대상 generation만 지우며 read/download/sign 권한이 없다. bucket 설정 drift가 발견되면 외부 업로드를 즉시 차단한다. soft delete를 0으로 되돌린 뒤에도 기존 soft-deleted 객체는 이전 보존기간 동안 남을 수 있으므로, 세 bucket은 첫 외부 콘텐츠 전에 설정·빈 bucket 상태를 증명하고 이후 drift를 release gate에서 계속 검사한다.

계정 삭제 요청은 새 세션과 signed URL 발급을 즉시 차단하고 활성 시스템 데이터를 7일 안에 제거·익명화한다. 소유한 `COLLECTING` 구덩이는 취소한다. `SEALED|OPENED`는 다른 활성 멤버가 있으면 가장 먼저 가입한 멤버에게 소유권을 넘긴 뒤 PRD 7.4의 정족수 복구 규칙을 적용하고, 없으면 owner를 null로 바꾸고 즉시 `PURGE_PENDING`으로 보내 모든 기여를 삭제한다. 백업 잔존분은 30일 안에 만료한다.

계정·기여·멤버십·pit 삭제는 saga로 실행한다. 요청 RPC가 새 읽기와 URL 발급을 차단하고 deletion outbox를 만든다. deletion-worker가 외부 ledger append를 확인한 뒤 exact-generation media deletion을 enqueue하고, media-retention-worker의 물리 삭제 완료가 기록된 대상만 DB tombstone·익명화·소유권 전이를 확정한다. 각 단계는 같은 deletion request ID로 멱등 재개하며 ledger append나 GCS 삭제가 실패하면 접근 차단을 유지한 채 완료로 표시하지 않는다.

삭제 요청을 처리할 때 앱 DB 백업 경계 밖의 전용 private GCS `deletion-ledger` bucket에 `scope(account|contribution|membership|pit)`, `HMAC(stable_subject_id, versioned key)`, 요청 시각, 만료 시각만 immutable event object로 기록한다. 이 bucket은 public access prevention·uniform access, soft delete 0초, Object Versioning off와 잠긴 45일 bucket retention/lifecycle을 사용한다. deletion-worker는 무작위 event key에 create만 가능하고 read/list/update/delete는 못 한다. restore-controller account만 break-glass 실행 중 read/list할 수 있고 create/update/delete는 못 한다. 원문 ID·이메일·콘텐츠는 넣지 않는다. HMAC key version과 검증용 과거 key는 해당 ledger 만료까지 Secret Manager에 보존한다. deletion-worker runtime account는 enabled current key version만 `secretAccessor`로 읽고, restore-controller runtime account는 승인된 break-glass 실행 시간창에만 ledger가 참조하는 만료 전 과거 key versions를 읽는다. 다른 worker·Scheduler/Tasks caller·운영자는 어떤 HMAC key version도 읽지 못하며 current key를 disable하기 전 해당 버전 ledger의 45일 만료를 확인한다. ledger append 실패 시 원 삭제 요청을 완료로 표시하지 않는다.

DB 복원은 provider recovery/maintenance network gate 아래 격리된 환경에서 다음 순서를 고정한다.

1. Supabase Auth/PostgREST/RPC를 포함한 사용자 endpoint, 앱·웹·Cloud Run ingress, 일반 Scheduler/queue와 notification delivery를 닫은 상태에서 restore-controller가 `begin_restore(run_id)`를 실행한다. 이 함수는 `restore_mode=true`, 예측 불가능한 `restore_run_id`, `global_tokens_invalid_before=restore_started_at`을 한 트랜잭션으로 단조 갱신한다.
2. 모든 사용자 RLS/RPC, anon 초대 교환, provider/media API는 `restore_mode=true`면 새 session도 실패 폐쇄한다. ops 경로와 일반 worker claim도 거부한다. restore-controller가 전용 restore-runner OIDC caller와 queue로 만든 task만 `restore_run_id`를 담아 state/deletion/media-retention worker에 도달하고, 각 함수는 현재 run ID와 restore 전용 job type을 일치시킨다. notification-worker는 복원 lane에 포함하지 않는다.
3. 복원된 각 scope의 stable ID를 ledger와 HMAC 대조해 account는 계정·토큰, contribution은 해당 기여·media, membership은 해당 접근·기여, pit은 전체 pit 데이터를 멱등 재삭제한다.
4. 복원 시점과 현재 서버 시각을 비교해 만료된 invite session/handoff/upload intent/review session, collecting 마감·부족 인원 취소, opening session, 취소 24시간 purge, 임시·고아 media 24시간, opened 30일, unopened 90일, push token 90일과 30일·90일·1년·13개월 보조 metadata purge를 notification 전송 없이 restore lane으로 모두 재실행한다.
5. media-retention task를 완료하고 역할별 부정 조회로 삭제·만료된 본문, 정확한 장소, object path, signed URL이 없고 범위 밖 데이터가 과삭제되지 않았음을 확인한다. gate 중 새 로그인 session의 direct PostgREST/RPC 거부와 run ID가 없거나 다른 restore task 거부도 증명한다.
6. 기존 signed URL의 최대 300초가 지났고 복원 release record가 승인되면 `finish_restore(run_id)`가 global epoch를 완료 시각으로 다시 전진시키고 restore mode/run ID를 원자적으로 닫는다. 그 뒤 새 로그인, 일반 worker, 외부 traffic 순으로 연다.

일반 참여자의 `leave_pit`도 같은 경계를 사용한다. `COLLECTING` 참여자는 본인 기여를 삭제한 뒤 `LEFT`가 되며, 방장은 구덩이를 취소해야 떠날 수 있다. `SEALED|OPENED` 참여자는 본인 기여와 접근을 삭제하고 정족수를 재계산한다. 방장이 떠날 때는 후계자에게 이전하고 후계자가 없으면 `PURGE_PENDING`으로 전환한다.

## 관측성과 금지 로그

- API 요청, 상태 전이, 예약 작업을 request ID와 pit ID로 연결한다.
- 콘텐츠 본문, 파일 내용, 정확한 장소, 현재 좌표, 초대 토큰, signed URL은 로그·APM·분석에 넣지 않는다.
- 거리와 정확도는 버킷 또는 제한된 숫자로만 보존한다.
- 알림 도달 실패는 제품 상태가 아니라 별도 전달 상태로 측정한다.
- 북극성 지표에는 서로 다른 2명 이상, 같은 공개 세션, 최소 1명 GPS 검증을 만족한 공개만 포함한다.
- Sentry는 Session Replay를 끄고 `beforeSend`에서 제목·본문·장소·토큰·signed URL·이메일을 제거한다. 사용자 ID는 회전 가명값만 보내고 오류·세션 데이터는 30일 보존한다.

## 외부 파일럿 전 승인 게이트

- Google Maps/Places 정책·attribution과 API 키 제한 검토
- Google Cloud Vision SafeSearch 데이터 처리 계약과 하위 처리자 고지 승인
- Cloud Run·Cloud Storage와 Sentry의 DPA, 처리 리전, 하위 처리자·보존 고지 승인
- Cloud Run provider-api의 고정 outbound IP 관측값과 Places key restriction 일치 확인
- media-api의 JWT·rate limit, media-review-api의 IAP Google identity·조직 2SV 강제 증거·사유 감사, 모든 private worker의 OIDC audience 교차 호출·DB/GCS IAM 거부 테스트 통과
- 세 media bucket의 soft delete 0초·versioning/retention off와 빈 bucket 초기 상태, 외부 삭제 ledger 복원 차단 리허설 통과
- image-worker의 10MB HEIC/JPEG/PNG 처리·악성/압축 폭탄·EXIF 제거·stale lease 재시도와 signature bundle 원자 교체 spike 통과
- Expo Push Service 전달 실패·토큰 삭제 runbook 확인
- Sentry Session Replay 비활성화와 전송 전 개인정보 scrub 샘플 감사
- 위치기반서비스 신고·약관과 위치 취급대장 최소 6개월 보존 범위의 전문가 승인

결정 결과는 PRD의 `OD-*`와 이 문서를 한 변경에서 함께 갱신한다.

## 위치 실패 대응 순서

1. 고정밀 위치 재측정과 GPS 정확도 표시
2. 반경 150m 판정
3. 현장 GPS 확인에 성공한 참여자가 보여주는 짧은 수명의 일회용 서버 서명 QR
4. 설정을 바꾸지 않고 90일 안에 새 현장 공개 시도 일정 공유

MVP는 위치 위조 방지 시스템이 아니라 친한 관계의 소셜 신뢰 모델을 전제로 한다.

## 일정 보정

실사용자는 최소 30일을 기다려야 하므로 기준 일정은 16주다. WP-07A 관측성·접근성 트랙을 WP-00~06과 병렬로 진행하고, 이들 작업과 내부 E2E 공개 리허설·외부 승인 게이트를 8주 말까지 마친 뒤 WP-07B에서 첫 파일럿 구덩이를 생성한다. 9~12주차에는 이미 동작하는 공개 경로를 하드닝하며 13주차부터 실제 공개를 관찰한다. 개발·QA 환경에서만 공개 시각을 단축하는 feature flag를 허용한다. 상세 일정과 게이트는 PRD 13~14장을 따른다.
