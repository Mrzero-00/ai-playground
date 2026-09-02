# 삐라삐라삐 MVP

원하는 시·구를 선택해 익명 편지를 삐라처럼 날리고, 해당 지역의 누군가가 AR 탐색으로 발견하는 앱인토스 비게임 미니앱입니다.

## 핵심 기능

- 시·도 → 시·군·구 선택 후 500자 이내 익명 삐라 발송
- 지역 안의 안전 후보 좌표에 무작위 낙하, 사용자에게는 구별 재고만 노출
- 앱인토스 위치·카메라 API를 활용한 AR형 탐색
- 40m 내 발견 증표와 데이터베이스 트랜잭션으로 한 사람만 획득
- 24시간 미발견 시 같은 구 내 다른 안전 지점으로 최대 3회 재배치
- 연락처·SNS·정확한 주소·만남·협박·정치 선전·광고 기본 차단
- 신고 즉시 숨김, AES-256-GCM 본문 암호화, 원본 익명키 미저장

## BM

- 매일 한국 시간 0시에 무료 삐라 1장이 다시 생깁니다. 무료 장수는 누적되지 않습니다.
- 추가 삐라는 앱인토스 소모성 인앱결제 상품 “ppira_single_300”으로 1장당 300원입니다.
- 구매한 장수는 이월되고, 무료 장수를 먼저 소진합니다.
- 주문 ID 멱등성, 미결 주문 복원, mTLS 주문 상태 검증 모듈을 포함합니다.

## 프로젝트 구조

    삐라삐라삐/
    ├── apps/api/       Node.js API, 이용권·주문 장부
    ├── apps/web/       React, Vite, 앱인토스 WebView
    ├── docs/product/   기획안, PRD, 개발요구사항, 운영정책
    └── docs/API.md

## 로컬 실행

Node.js 22, pnpm 10 이상을 사용합니다.

    cp .env.example .env
    pnpm install
    pnpm dev

- 앱: http://localhost:5174
- API: http://localhost:4200/health
- 로컬에서는 “로컬 체험 위치” 버튼과 무과금 결제 시뮬레이션을 사용합니다.

## 검증과 빌드

    pnpm check
    pnpm ait:build

## 운영 전 필수 설정

1. 앱인토스 콘솔에 비게임 미니앱과 300원 소모품 상품을 등록합니다.
2. 콘솔 SKU를 코드의 “ppira_single_300”과 일치시킵니다.
3. IAP_MTLS_CERT_PATH와 IAP_MTLS_KEY_PATH를 설정하고 주문 검증을 샌드박스에서 확인합니다.
4. 운영에서 ALLOW_SIMULATED_LOCATION과 ALLOW_SIMULATED_PURCHASE를 false로 둡니다.
5. SQLite를 PostgreSQL/PostGIS로 전환하고 실제 안전 영역을 운영자 검수 후 등록합니다.

자세한 정책은 [PRD](docs/product/PRD.md)와 [개발요구사항 정의서](docs/product/개발요구사항_정의서.md)를 확인하세요.
