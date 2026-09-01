# 묻어두지 에이전트 작업 지침

## 단일 기준 문서

작업 전에 범위에 맞는 문서를 읽는다.

1. 제품 행동과 우선순위: `docs/PRD.md`
2. 기술 경계와 권한: `docs/architecture.md`
3. 작업 순서와 검증: `docs/IMPLEMENTATION_PLAN.md`
4. 실행과 현재 상태: `README.md`

문서가 충돌하면 위 순서를 따른다. 임의로 해석하지 말고 요구사항 ID와 결정 기록을 먼저 갱신한다.

## 현재 단계

현재 코드는 Expo SDK 57 기반 V0 클릭형 프로토타입이다. 로컬 상태, 하드코딩된 멤버와 장소, 클라이언트 거리 판정을 실제 서버 기능으로 설명하지 않는다.

V1의 기준 범위는 다음과 같다.

- 만 18세 이상, 2~8명 비공개 그룹
- `한 달 뒤 우리 예언` 한 가지 놀이
- 텍스트 180자와 선택 사진 한 장
- 30~180일 서버 시간 잠금
- 모바일 초대 웹, foreground 위치, 공동 공개
- 삭제·신고·분석·운영 최소 기능

음성, 영상, 결제, 공개 피드, 여러 놀이, background location은 범위 밖이다.

## Expo와 도구 버전

Expo는 빠르게 바뀐다. Expo API를 작성하거나 수정하기 전에 반드시 정확한 [SDK 57 문서](https://docs.expo.dev/versions/v57.0.0/)를 확인한다.

- Node.js 22.13 이상
- pnpm 8.15.6
- Expo SDK 57 / React Native 0.86 / React 19
- Expo Router 57

다른 메이저 버전의 예시를 그대로 사용하지 않는다. 의존성은 `expo install` 호환 버전을 우선한다.

## 불변 제품·보안 규칙

- 클라이언트 시간과 상태는 안내용이며 서버가 최종 판정한다.
- 모든 private DB 테이블은 default-deny RLS를 사용하고 GCS는 public access prevention·uniform IAM·CDN 미사용을 강제한다.
- raw/final/quarantine GCS bucket은 soft delete 0초, Object Versioning off, Retention Lock·legal hold 미사용을 유지한다. 법적 보존은 만료가 있는 live quarantine 객체로만 구현한다.
- media-retention-worker만 generation 조건부 삭제와 최소 metadata list 권한을 가지며 read/download/create/copy/sign 권한은 받지 않는다.
- 격리·복구는 감사된 job과 private media-ops-worker만 수행한다. 운영자에게 직접 GCS 권한을 주지 않고 worker에도 list·URL sign 권한을 주지 않는다.
- 격리본 열람은 다른 운영 backend와 공유하지 않는 전용 review hostname에서 외부 LB IAP Google identity·조직 강제 2SV·활성 운영 역할·report·사유를 적용한 media-review-api의 60초·1회용 host-only cookie proxy stream만 사용한다. IAP의 ES256 signature·회전 JWKS·`iat`·`exp`·issuer·backend별 exact audience를 검증하고 unsigned identity header를 신뢰하지 않는다. 소비 시 현재 IAP subject가 발급 대상과 일치해야 하며 GCS URL과 object key를 반환하지 않는다.
- 운영 웹·ops/media-review API는 외부 HTTPS Load Balancer IAP 경로를 사용한다. ops-api만 IAP subject를 운영 역할에 매핑해 신고 job·계정 제한·종결 allowlist를 실행한다. 상태 변경은 GET을 금지하고 exact ops Origin·same-origin Fetch Metadata·IAP subject-bound 단기 CSRF header가 모두 일치해야 한다.
- 예약 상태·알림·삭제 worker는 서로 다른 OIDC caller와 `NOINHERIT` DB 역할의 allowlist 함수만 실행한다. Supabase service role이나 Edge Function 우회 자격을 사용하지 않는다.
- DB 복원 시 `begin_restore`가 restore mode/run ID와 global session epoch를 원자적으로 설정해 새 session·direct PostgREST/RPC를 포함한 user/anon 접근, ops와 일반 worker를 실패 폐쇄한다. 동일 run ID의 restore-controller-origin state/deletion/media-retention lane만 deletion ledger·모든 overdue TTL/media 삭제를 수행하고, 부정 조회와 300초 대기를 통과한 뒤 `finish_restore`가 epoch를 재전진시키기 전에는 외부 traffic을 열지 않는다.
- deletion-ledger HMAC은 deletion-worker가 current key version만 읽고, restore-controller가 승인된 break-glass 시간창에 만료 전 과거 versions만 읽는다. 다른 worker·caller·운영자의 Secret Manager 접근은 금지한다.
- 봉인 후 작성자도 콘텐츠 본문, object path, thumbnail과 signed URL을 볼 수 없다.
- service role key와 운영자 비밀은 앱·웹 번들에 넣지 않는다.
- 현재 위치 원문은 판정 후 저장하지 않으며 로그·분석에도 보내지 않는다.
- background/always location 권한을 추가하지 않는다.
- 콘텐츠 본문, 사진, 정확한 장소, 초대 토큰을 로그·분석·fixture에 넣지 않는다.
- 계정 및 본인 콘텐츠 삭제권은 봉인 규칙보다 우선한다.
- 이미 봉인된 콘텐츠를 결제나 알림 실패 때문에 열 수 없게 만들지 않는다.
- 정족수 충족은 공개 세션만 countdown으로 바꾸며 pit은 sealed로 유지한다. 종료 시각 이후 `finalize_open`만 둘을 함께 opened로 바꾼다.
- 공개 콘텐츠는 30일, 열지 못한 sealed 콘텐츠는 공개 예정 시각 후 90일까지만 보존한다.

## 확정 외부 서비스

- 지도 렌더링: `react-native-maps` Google provider + iOS/Android 플랫폼 제한 키
- 장소 검색: Supabase JWT·rate limit을 검증하고 VPC/Cloud NAT 고정 egress를 쓰는 Cloud Run provider-api + 별도 Google Places API 키
- 푸시: `expo-notifications` + Expo Push Service
- 이미지 안전: Google Cloud Vision SafeSearch
- 이미지 처리: Cloud Run media-api + Cloud Tasks OIDC 전용 image-worker의 pinned 컨테이너
- 운영·예약 작업: IAP media-review-api와 private media-ops/state/notification/deletion/retention worker의 분리된 OIDC·DB 역할
- 미디어 저장: private Google Cloud Storage, media-api streaming upload와 300초 `no-store` download URL
- crash: Sentry Release Health, Session Replay 금지와 전송 전 PII scrub

외부 파일럿 전에 각 서비스의 API 키 제한, attribution, 개인정보·하위 처리자 고지와 위치기반서비스 전문가 검토가 승인되어야 한다. 에이전트가 다른 공급자로 임의 교체하지 않는다.

## 구현 규칙

- 작업 설명, PR, 테스트 이름에 관련 PRD ID를 남긴다.
- 공유 입력 검증과 오류 코드는 `packages/contracts`를 기준으로 한다.
- DB 변경은 새 migration으로만 추가하고 이미 공유된 migration을 고쳐 쓰지 않는다.
- 초대 수락, 기여 제출, 봉인, 공개는 멱등성과 동시성 테스트를 포함한다.
- 정상 흐름과 권한 거부·네트워크 재시도·만료·중복 요청을 함께 구현한다.
- 모바일과 초대 웹의 화면 컴포넌트는 공유하지 않는다. 계약·검증·토큰만 공유한다.
- 화면 문구에서 구현되지 않은 보안·보존·암호화 수준을 약속하지 않는다.
- 공유 `/i/*`를 앱 링크에 연결하지 않는다. 웹 수락 뒤 1회용 `/app/h/*` handoff만 앱으로 연다.
- 실제 텍스트 차단어를 에이전트가 만들지 않는다. 승인 버전과 체크섬이 있는 `content-policy`만 구현한다.

## 검증

현재 앱 기본 검증:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

네이티브 설정 또는 라우팅 변경은 iOS·Android·web export까지 확인한다. 카메라, 위치, 딥링크, 푸시는 실제 기기 증거 없이 완료로 표시하지 않는다.

백엔드가 추가되면 역할별 RLS 부정 테스트와 상태 전이 통합 테스트를 필수 검증에 포함한다.

## 완료 보고

완료 보고에는 다음을 포함한다.

- 완료한 PRD ID
- 변경 파일과 사용자에게 보이는 결과
- 실행한 검증과 결과
- 남아 있는 제한 또는 실기기 미검증
- 다음에 시작 가능한 구현 계획 작업 패킷

작성자와 완료 검증자는 분리한다.
