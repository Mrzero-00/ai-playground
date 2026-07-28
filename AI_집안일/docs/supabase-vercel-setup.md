# Supabase + Vercel 연결 가이드

현재 버전은 별도 로그인 화면 없이 익명 세션을 사용합니다. 일반 브라우저에서는 서명된 HttpOnly 쿠키를, 앱인토스에서는 `getAnonymousKey`를 사용합니다. Supabase 비밀키는 Vercel 서버 함수에서만 사용합니다.

## 1. Supabase 테이블 만들기

Supabase 대시보드의 **SQL Editor**에서 아래 파일 전체를 실행합니다.

- `supabase/migrations/202607140001_initial_schema.sql`
- `supabase/migrations/202607140002_labor_balance.sql`
- `supabase/migrations/202607280003_safe_shared_sync.sql`
- `supabase/migrations/202607280004_account_deletion.sql`

파일명 순서대로 실행합니다. 세 번째 마이그레이션은 추천 선택 저장, 맞춤 집안일 알림·아이콘, 집별 동기화 버전과 원자 저장 함수를 추가합니다. 네 번째는 서비스 탈퇴 시 개인 데이터 삭제와 공유 집 소유권 이전을 처리합니다.

이 스키마는 사용자, 집, 집 구성원, 집 프로필, 집안일, 수행 기록, 개인 설정을 분리해 저장합니다. 모든 테이블은 RLS를 켜고 브라우저용 `anon`/`authenticated` 권한을 제거했습니다. 데이터 접근은 서버의 Secret Key로만 수행합니다.

## 2. 로컬 환경변수

프로젝트 루트의 `.env.local`에 다음 값을 넣습니다.

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
SESSION_SECRET=AT_LEAST_32_RANDOM_CHARACTERS
ALLOWED_ORIGINS=http://localhost:5173,https://YOUR_APP.apps.tossmini.com,https://YOUR_APP.private-apps.tossmini.com
VITE_API_BASE_URL=http://localhost:3000
VITE_ENABLE_DEMO_DATA=false
VITE_TERMS_URL=https://YOUR_DOMAIN/terms
VITE_PRIVACY_URL=https://YOUR_DOMAIN/privacy
VITE_SUPPORT_URL=https://YOUR_DOMAIN/support
VITE_TOSS_SHOPPING_URL_TEMPLATE=
```

`SESSION_SECRET`은 Supabase에서 받는 값이 아니라 직접 만든 32자 이상의 임의 문자열입니다. `.env.local`은 Git에서 제외됩니다.

`VITE_API_BASE_URL`은 앱인토스 번들이 호출할 Vercel HTTPS 주소입니다. Vercel 자체 웹 배포에서는 비워 같은 출처의 `/api`를 사용할 수 있습니다. 토스 도메인에서 호출할 때는 HTTPS 주소와 정확한 `ALLOWED_ORIGINS`를 설정합니다.

`VITE_TOSS_SHOPPING_URL_TEMPLATE`은 제휴 승인을 받은 뒤에만 `{query}`를 포함한 HTTPS 템플릿을 입력합니다. 비워두면 구매 연결 버튼은 비활성화됩니다.

## 3. Vercel 환경변수

Vercel 프로젝트의 **Settings → Environment Variables**에 서버용 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `ALLOWED_ORIGINS`를 추가합니다. 약관·지원·구매 링크를 사용할 때는 해당 `VITE_` 변수도 빌드 환경에 추가합니다. Production, Preview, Development 중 사용할 환경을 선택한 뒤 재배포합니다.

브라우저에서 사용하는 Supabase Publishable/Anon Key는 현재 구조에 필요하지 않습니다. `SUPABASE_SECRET_KEY` 이름에 넣은 값은 절대 `VITE_` 접두사를 붙이지 않습니다.

## 4. 동작 확인

배포 URL을 열면 상단 집 선택 영역 아래 상태가 표시됩니다.

- `동기화됨`: API에서 데이터를 불러왔고 Supabase 저장이 가능함
- `저장 중`: 변경 내용을 서버로 보내는 중
- `로컬 저장 중`: API에 연결하지 못해 현재 브라우저에만 저장 중
- `동기화 오류`: 최근 서버 저장이 실패함

처음 연결할 때 Supabase에 집이 없고 기존 로컬 데이터가 있으면 로컬 데이터를 자동 업로드합니다. 이후 현재 선택한 집만 원자적으로 저장합니다. 다른 구성원이 먼저 저장해 서버 버전이 달라지면 `409 SYNC_CONFLICT`로 중단하며, 화면의 동기화 상태를 눌러 최신 내용을 다시 불러옵니다.

## API

- `GET /api/session`: 익명 세션 생성 및 현재 사용자 확인
- `GET /api/state`: 참여 중인 집 전체 상태 조회
- `PUT /api/state`: 집, 집안일, 기록, 설정 저장
- `POST /api/homes/join`: 초대 코드로 집 참여
- `DELETE /api/account`: 서비스 탈퇴와 개인 데이터 삭제

브라우저 쿠키는 삭제하거나 기기를 바꾸면 새 사용자가 됩니다. 앱인토스 안에서는 미니앱별 익명 키가 같은 사용자를 식별합니다. 토스 로그인은 첫 출시 범위에 포함하지 않습니다.

## 배포 직후 점검

1. `/api/session`과 `/api/state`가 JSON 200을 반환하는지 확인합니다.
2. 집을 만든 뒤 Supabase `homes.sync_revision`이 증가하는지 확인합니다.
3. 다른 브라우저에서 초대 코드로 참여하고 30초 이내 또는 창 재진입 시 변경이 보이는지 확인합니다.
4. 오래된 두 화면에서 동시에 수정했을 때 한쪽이 `동기화 오류`로 멈추는지 확인합니다.
5. 탈퇴 테스트 계정의 개인 기록이 삭제되고 공유 집의 다른 구성원 데이터가 유지되는지 확인합니다.
