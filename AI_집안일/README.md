# AI 집안일

> 집 프로필에 맞는 반복 집안일을 추천하고, 공동 집 구성원과 일정·수행 기록을 관리하는 앱인토스 미니앱

앱인토스 WebView SDK 2.x 기반의 React + TypeScript 미니앱입니다.

## 개발

```bash
pnpm install
pnpm dev
```

브라우저에서는 `http://localhost:5173`으로 확인할 수 있습니다. 토스 샌드박스 앱으로 테스트할 때는 앱인토스 개발자센터의 샌드박스 테스트 절차를 따르세요.

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
