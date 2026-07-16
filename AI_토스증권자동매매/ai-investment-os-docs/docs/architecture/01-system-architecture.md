# System Architecture

## 최종 구조

```text
Data Plane
    ↓
Discovery Engine
    ↓
Evidence Bundle / Evidence Graph
    ↓
Research Committee
    ├─ Bull Analyst
    ├─ Bear Analyst
    ├─ Market Analyst
    └─ Skeptic
    ↓
Decision Engine
    ↓
Risk Gate
    ↓
Execution Engine
    ↓
Trade Journal
    ↓
Post-Trade Evaluator
    ↓
Counterfactual Engine
    ↓
Strategy Lab
    ↓
Memory System
```

## 역할 분리

### Data Plane
시세, 뉴스, SEC, 실적, 옵션, 공매도, ETF, 거시 데이터를 수집·정규화한다.

### Discovery Engine
전체 시장을 깊게 분석하지 않고 이상 징후를 찾아 후보를 줄인다.

### Evidence Bundle
후보별로 당시 사용 가능했던 자료만 묶는다. 미래 정보 혼입을 금지한다.

### Research Committee
서로 다른 관점이 독립적으로 가설을 평가하고 반박한다.

### Decision Engine
AI 의견을 받아도 정해진 조건과 기대값 계산으로만 진입 후보를 생성한다.

### Risk Gate
거래를 추천하지 않는다. 승인 또는 거부만 한다. 모든 컴포넌트보다 우선한다.

### Execution Engine
전략별 주문 방식, 부분 익절, 시간 손절, 체결 복구를 담당한다.

### Evaluator
손익과 별도로 가설·타이밍·실행·리스크 품질을 평가한다.

### Strategy Lab
운영 전략을 직접 바꾸지 않고 후보 전략을 별도 환경에서 검증한다.

### Memory System
개별 사건, 일반 규칙, 시장 국면을 분리해 기억한다.

## 배포 권장안

```text
apps/web       Next.js App Router
apps/api       Fastify API
apps/worker    BullMQ workers
apps/ml        Python ML service, Phase 4 이후

Redis          Queue / Lock / Cache
Supabase       PostgreSQL / Auth
Object Storage 원문 문서 저장
```

실시간 시세가 필요한 단계에서는 항상 실행되는 Worker 서버를 사용한다.
