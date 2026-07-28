# AI 집안일

> 집 프로필에 맞는 반복 집안일을 추천하고, 공동 집 구성원과 일정·수행 기록을 관리하는 앱인토스 미니앱

최종 제품 비전은 앱이 집안일의 기억·계획·분배·재조정을 맡아 사용자가 가사 실행에만 집중할 수 있게 하는 것입니다. 세부 방향은 [기획노동 자동화 로드맵](./docs/planning-labor-automation-roadmap.md)에 정리합니다.

현재는 24문항 보이지 않는 노동 테스트, 생활용품 소진일 예측, 구매 업무 자동 생성, 구성원별 실행 업무 자동 분배를 제공합니다.

앱인토스 WebView SDK 2.x 기반의 React + TypeScript 미니앱입니다.

개발과 출시 검수에는 [AI 집안일 앱인토스 개발 정책](./docs/apps-in-toss-policy.md)을 필수 기준으로 적용합니다.
토스앱 QR 테스트와 업로드 순서는 [집토리 토스앱 최종 테스트 실행서](./docs/apps-in-toss-toss-app-test.md)를 따릅니다.

## 개발

```bash
pnpm install
pnpm dev
```

브라우저에서는 `http://localhost:5173`으로 확인할 수 있습니다. API 주소를 설정하지 않은 로컬 개발은 의도적으로 로컬 저장 모드로 동작합니다. 토스 샌드박스 앱으로 테스트할 때는 앱인토스 개발자센터의 샌드박스 테스트 절차를 따르세요.

## 데이터 저장과 Vercel 테스트

Supabase와 Vercel API를 사용해 공동 집 데이터와 수행 기록을 저장합니다. 일반 브라우저에서는 서명된 익명 세션 쿠키, 앱인토스에서는 `getAnonymousKey`를 서버 내부 UUID로 변환해 사용합니다. 로컬 스토리지는 빠른 화면 표시와 API 장애 시 캐시 역할을 합니다. 공유 집은 집별 버전으로 충돌을 검사합니다.

설정 방법은 [Supabase + Vercel 연결 가이드](./docs/supabase-vercel-setup.md)를 참고하세요.

## 앱인토스 연결 전 수정할 값

`granite.config.ts`의 아래 값을 앱인토스 콘솔에 등록한 정보와 동일하게 맞춥니다.

- `appName`
- `brand.displayName`
- `brand.primaryColor`
- `brand.icon`

## 빌드

```bash
pnpm test        # 핵심 계산, API 검증, 전체 가이드 검사
pnpm typecheck   # 웹/API 타입 검사
pnpm build       # 웹 빌드 확인
pnpm ait:build   # 콘솔에 업로드할 .ait 번들 생성
pnpm ait:check   # 브랜드·CORS·로고·AIT 100MB 제한 검사
pnpm ops:check   # 배포된 운영 DB·세션·상태 API 확인
pnpm verify      # 테스트·타입·웹 빌드·AIT 생성을 순서대로 실행
```
