# Supabase + Vercel 연결 가이드

현재 테스트 버전은 별도 로그인 화면 없이 익명 세션을 사용합니다. 브라우저에는 서명된 HttpOnly 쿠키만 저장하고, Supabase 비밀키는 Vercel 서버 함수에서만 사용합니다.

## 1. Supabase 테이블 만들기

Supabase 대시보드의 **SQL Editor**에서 아래 파일 전체를 실행합니다.

- `supabase/migrations/202607140001_initial_schema.sql`

이 스키마는 사용자, 집, 집 구성원, 집 프로필, 집안일, 수행 기록, 개인 설정을 분리해 저장합니다. 모든 테이블은 RLS를 켜고 브라우저용 `anon`/`authenticated` 권한을 제거했습니다. 데이터 접근은 서버의 Secret Key로만 수행합니다.

## 2. 로컬 환경변수

프로젝트 루트의 `.env.local`에 다음 값을 넣습니다.

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
SESSION_SECRET=AT_LEAST_32_RANDOM_CHARACTERS
```

`SESSION_SECRET`은 Supabase에서 받는 값이 아니라 직접 만든 32자 이상의 임의 문자열입니다. `.env.local`은 Git에서 제외됩니다.

## 3. Vercel 환경변수

Vercel 프로젝트의 **Settings → Environment Variables**에도 같은 세 값을 추가합니다. Production, Preview, Development 중 사용할 환경을 선택한 뒤 재배포합니다.

브라우저에서 사용하는 Supabase Publishable/Anon Key는 현재 구조에 필요하지 않습니다. `SUPABASE_SECRET_KEY` 이름에 넣은 값은 절대 `VITE_` 접두사를 붙이지 않습니다.

## 4. 동작 확인

배포 URL을 열면 상단 집 선택 영역 아래 상태가 표시됩니다.

- `동기화됨`: API에서 데이터를 불러왔고 Supabase 저장이 가능함
- `저장 중`: 변경 내용을 서버로 보내는 중
- `로컬 저장 중`: API에 연결하지 못해 현재 브라우저에만 저장 중
- `동기화 오류`: 최근 서버 저장이 실패함

처음 연결할 때 Supabase에 집이 없고 기존 로컬 데이터가 있으면 로컬 데이터를 자동 업로드합니다. 이후 집 생성, 프로필, 집안일, 완료 기록, 설정이 Supabase와 동기화됩니다. 다른 브라우저에서 초대 코드를 입력하면 같은 집에 참여하고 공동 데이터를 조회할 수 있습니다.

## API

- `GET /api/session`: 익명 세션 생성 및 현재 사용자 확인
- `GET /api/state`: 참여 중인 집 전체 상태 조회
- `PUT /api/state`: 집, 집안일, 기록, 설정 저장
- `POST /api/homes/join`: 초대 코드로 집 참여

현재 익명 식별자는 브라우저 쿠키에 묶이므로 쿠키 삭제나 기기 변경 시 개인 식별자가 새로 만들어집니다. 앱인토스 로그인 연결 단계에서는 이 익명 사용자의 데이터를 토스 사용자 키로 이전해야 합니다.
