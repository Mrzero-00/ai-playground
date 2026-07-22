# Investment OS

> 장기 복리 투자와 모멘텀 투자를 독립적으로 평가하고 포트폴리오에서 통합하는 AI 투자 의사결정 시스템입니다.

장기 복리 투자와 모멘텀 투자를 독립적으로 평가하고, 포트폴리오 엔진에서만 결합하는 의사결정 시스템입니다.

## 시작하기

```bash
pnpm install
pnpm test
pnpm dev
```

API 기본 주소는 `http://localhost:4000`입니다.

- `GET /health`: 상태 확인
- `POST /v1/evaluations/long-term`: 장기 투자 평가
- `POST /v1/evaluations/momentum`: 모멘텀 평가
- `POST /v1/portfolio/allocate`: 전략 간 자본 배분

예시 요청은 [docs/api-examples.md](docs/api-examples.md)를 참고하세요. 원본 명세는 `investment-os-spec/`에 보존되어 있습니다.

## 구조

```text
apps/api                 HTTP 진입점
packages/core            순수 도메인 로직
  long-term              장기 투자 점수
  momentum               모멘텀 점수
  portfolio              전략 배분 및 위험 한도
  learning               결정/결과 기록 계약
investment-os-spec       원본 제품 명세
```

점수 함수는 입력이 같으면 결과도 같은 순수 함수입니다. 데이터 수집, 저장소, AI 에이전트는 이후 어댑터로 추가합니다.
