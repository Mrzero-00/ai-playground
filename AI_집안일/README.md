# AI 집안일

> 집 프로필에 맞는 반복 집안일을 추천하고, 공동 집 구성원과 일정·수행 기록을 관리하는 앱인토스 미니앱

앱인토스 WebView SDK 2.x 기반의 React + TypeScript 미니앱입니다.

개발과 출시 검수에는 [AI 집안일 앱인토스 개발 정책](./docs/apps-in-toss-policy.md)을 필수 기준으로 적용합니다.

## 개발

```bash
pnpm install
pnpm dev
```

브라우저에서는 `http://localhost:5173`으로 확인할 수 있습니다. 토스 샌드박스 앱으로 테스트할 때는 앱인토스 개발자센터의 샌드박스 테스트 절차를 따르세요.

## 데이터 저장과 Vercel 테스트

Supabase와 Vercel API를 사용해 공동 집 데이터와 수행 기록을 저장합니다. 로그인 화면 대신 서명된 익명 세션 쿠키를 사용하며, 로컬 스토리지는 빠른 화면 표시와 API 장애 시 캐시 역할을 합니다.

설정 방법은 [Supabase + Vercel 연결 가이드](./docs/supabase-vercel-setup.md)를 참고하세요.

## 앱인토스 연결 전 수정할 값

`granite.config.ts`의 아래 값을 앱인토스 콘솔에 등록한 정보와 동일하게 맞춥니다.

- `appName`
- `brand.displayName`
- `brand.primaryColor`
- `brand.icon`

## 빌드

```bash
pnpm build       # 웹 빌드 확인
pnpm ait:build   # 콘솔에 업로드할 .ait 번들 생성
```
