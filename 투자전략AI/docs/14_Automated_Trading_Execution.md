# 14. Automated Trading Execution

- 문서 버전: `v1.2.0`
- 작성일: `2026-07-23`
- 최종 검토일: `2026-07-23`
- 명세 상태: `R1 FOUNDATION IMPLEMENTED`
- 구현 준비도: `DRY_RUN/PAPER VERIFIED / TOSS ADAPTER CONTRACT VERIFIED / LIVE DISABLED`
- 선행 문서: `01_Architecture.md`, `02_Investment_Philosophy.md`, `05_Portfolio_Engine.md`, `08_Database.md`, `11_UI_UX.md`, `12_Roadmap.md`, `13_Codex_Implementation.md`
- 외부 기준: 토스증권 OpenAPI 공식 문서 `latest`, 조회 기준 `2026-07-23`
- 소유 경계: Investment OS와 분리된 Execution Service·Broker Adapter·Reconciliation Worker

---

## 1. 목적

이 문서는 Investment OS가 생성한 승인된 투자 결정을 실제 Broker 주문으로 안전하게 전달하고, 주문·체결·잔고를 다시 Portfolio 원장과 대사하는 자동매매 실행 계층을 정의한다.

자동매매는 분석 Engine에 주문 권한을 추가하는 기능이 아니다. 분석과 실행 사이에 독립된 신뢰 경계를 만들고, 다음 조건을 모두 증명한 경우에만 외부 주문을 허용하는 별도 시스템이다.

1. 어떤 Decision과 Portfolio Snapshot에서 주문이 파생되었는가?
2. 사용자는 정확히 어떤 대상·방향·수량·가격·만료를 승인했는가?
3. 승인 이후 가격·잔고·Risk·Policy가 변하지 않았는가?
4. 동일 요청이 재시도되어도 주문이 중복 생성되지 않는가?
5. Broker 응답을 잃어도 주문 상태를 안전하게 복구할 수 있는가?
6. 시스템 이상 시 신규 주문을 즉시 차단하고 기존 주문을 대사할 수 있는가?
7. 실제 체결이 Portfolio Lot과 현금 원장에 정확히 반영되는가?

이 문서의 자동매매는 **승인된 Decision을 자동으로 집행하는 것**을 의미한다. 모델·Agent·Portfolio Engine이 사용자 승인 없이 독자적으로 주문하는 것을 의미하지 않는다.

---

## 2. 선행 문서 충돌 검토

### 2.1 결론

01~13과 기획 충돌은 없다. 선행 문서는 MVP에서 자동 주문을 금지하면서 향후 별도 Phase와 실행 경계에서 추가하도록 명시한다. 14번은 그 별도 Phase를 구체화한다.

| 선행 계약 | 14번 적용 | 충돌 방지 방식 |
|---|---|---|
| [01 Architecture](01_Architecture.md) | Broker 주문은 Execution Service만 소유 | Domain/API/Web에서 Broker SDK import 금지 |
| [02 Philosophy](02_Investment_Philosophy.md) | 점수와 추천은 주문 명령이 아님 | 승인된 Decision 외 입력 거부 |
| [05 Portfolio](05_Portfolio_Engine.md) | Rebalance 결과는 주문이 아니라 제안 | 승인된 Rebalance Plan을 Order Intent로 변환 |
| [07 AI Agents](07_AI_Agents.md) | Agent는 주문 권한이 없음 | Capability에 Broker Credential·Order 권한 미부여 |
| [08 Database](08_Database.md) | 불변 계보와 RLS 유지 | Intent·Attempt·Order·Fill·Reconciliation 분리 저장 |
| [11 UI/UX](11_UI_UX.md) | 승인 의미를 명확히 표시 | LIVE 주문 승인에는 Re-auth와 최종 요약 요구 |
| [12 Roadmap](12_Roadmap.md) | R1과 운영 준비를 구분 | DRY_RUN→PAPER→LIVE 승격 Gate 사용 |
| [13 Implementation](13_Codex_Implementation.md) | 현재 R1 Baseline은 자동주문 비활성 | 14 Foundation 구현과 LIVE 준비를 별도 판정 |

### 2.2 변경되는 범위

기존 MVP 불변조건은 그대로 유지한다.

- `autoTradingEnabled=false`인 기존 R1 Baseline은 변경하지 않는다.
- 자동 주문은 별도 Process와 별도 Credential로만 실행한다.
- 기존 `recordExecution`은 체결 사실 기록 계약으로 유지한다.
- Analysis API가 Broker에 직접 접근하지 않는다.
- 사용자 승인 없는 주문은 LIVE에서도 금지한다.

### 2.3 향후 Architecture 개정이 필요한 경우

다음 기능은 이 문서만으로 허용할 수 없으며 01 Architecture와 02 Philosophy 개정, 별도 ADR, 강화된 사용자 동의가 필요하다.

- 사용자별 상시 위임 Mandate에 따른 무승인 주문
- 손절·익절 조건을 제외한 모델 자율 매수·매도
- Margin, Leverage, Short, Option 주문
- 다중 계좌 간 자금 이동
- AI Agent가 수량·가격·주문 시점을 최종 결정하는 기능

---

## 3. 목표와 비목표

### 3.1 목표

- Investment OS와 Broker 실행 권한을 Process·Package·Credential 수준에서 분리한다.
- 승인된 단일 Proposal 또는 Rebalance Plan을 결정론적 Order Intent로 변환한다.
- `OFF`, `DRY_RUN`, `PAPER`, `LIVE` 모드를 동일 계약으로 실행한다.
- 토스증권 OpenAPI를 Broker Adapter 뒤에 격리한다.
- 주문 전 잔고·매수가능금액·매도가능수량·시장시간·가격·제한종목을 재검증한다.
- `clientOrderId`와 내부 Idempotency Ledger로 중복 주문을 차단한다.
- 요청 타임아웃이나 응답 유실 시 재주문보다 주문 조회·대사를 먼저 수행한다.
- 부분체결·미체결·거부·정정·취소를 상태기계로 관리한다.
- Broker 주문과 체결을 Portfolio Lot·Cash·Decision·Audit 계보에 연결한다.
- Kill Switch와 Notional·빈도·일손실 한도를 서버와 Worker에서 강제한다.

### 3.2 비목표

- 수익률 극대화를 위한 무제한 최적화
- 승인되지 않은 포트폴리오 자율 변경
- Broker 응답을 Investment Thesis 또는 Score로 해석
- 주문 성공을 체결 성공으로 간주
- REST 응답만으로 잔고 원장을 확정
- Secret을 Client, Database, Log, Error Message에 저장
- 외부 API 가용성을 우회하기 위한 공격적 무한 재시도
- Broker별 차이를 Core Domain에 노출
- 조건주문을 사용한 무승인 전략 생성

---

## 4. 핵심 안전 불변조건

| ID | 불변조건 | 강제 위치 | 검증 증거 |
|---|---|---|---|
| EXE-INV-001 | `LIVE` 외 모드는 실제 주문 Endpoint를 호출하지 않는다. | Runtime Configuration, Broker Factory | Mode Test |
| EXE-INV-002 | 승인된 Decision 없이는 Order Intent를 제출할 수 없다. | Preflight Gate | Contract Test |
| EXE-INV-003 | Risk `DENY`, 만료, stale, 소유권 불일치 주문은 실행할 수 없다. | Preflight Gate | Safety Test |
| EXE-INV-004 | 승인 수량·금액을 늘리는 변환은 금지한다. | Intent Builder | Property Test |
| EXE-INV-005 | 동일 Intent는 Broker 주문을 최대 한 번 생성한다. | Idempotency Ledger, Broker Key | Race Test |
| EXE-INV-006 | 응답 불명 상태에서는 재주문하지 않고 조회·대사한다. | Attempt State Machine | Timeout Test |
| EXE-INV-007 | Kill Switch가 열리면 신규·정정 주문을 차단한다. | API, Worker, Adapter | Kill Switch Test |
| EXE-INV-008 | 취소는 안전상 필요할 때 Kill Switch 중에도 허용할 수 있다. | Cancel Policy | Incident Test |
| EXE-INV-009 | Agent·Web Client는 Broker Credential을 읽을 수 없다. | Deployment IAM | Secret Scan, IAM Review |
| EXE-INV-010 | 체결은 Broker 조회로 확인되기 전 Portfolio 원장에 반영하지 않는다. | Reconciliation | Reconciliation Test |
| EXE-INV-011 | Long-term·Momentum Lot은 주문과 체결에서도 분리한다. | Intent, Fill Allocation | Strategy Boundary Test |
| EXE-INV-012 | LIVE 승격은 자동화된 단일 Flag로 수행할 수 없다. | Multi-gate Configuration | Release Gate Test |
| EXE-INV-013 | 모든 외부 요청은 Account·Decision·Intent·Attempt 계보를 가진다. | Audit/Outbox | Lineage Test |
| EXE-INV-014 | Decimal 금액·가격·수량을 부동소수점으로 변환하지 않는다. | Contract/Adapter | Precision Test |
| EXE-INV-015 | Broker Error Message는 행동 결정에 사용하지 않고 Error Code를 사용한다. | Error Mapper | Error Contract Test |

---

## 5. 실행 모드와 승격

### 5.1 모드

| 모드 | 외부 주문 | 목적 | 기본값 |
|---|---|---|---|
| `OFF` | 없음 | 실행 서비스 완전 정지 | 운영 비상 상태 |
| `DRY_RUN` | 없음 | 계약·Gate·수량·Audit 검증 | 개발 기본값 |
| `PAPER` | 없음 | 체결 Simulator와 전체 흐름 검증 | Preview/Shadow |
| `LIVE` | 토스증권 | 승인된 실제 주문 집행 | 모든 Gate 통과 후 수동 승격 |

### 5.2 Fail-closed 설정

다음 조건 중 하나라도 충족하지 않으면 Runtime은 `LIVE`가 아니라 시작 실패 또는 `DRY_RUN`으로 종료해야 한다.

- `EXECUTION_MODE=LIVE`
- `AUTO_TRADING_ENABLED=true`
- `LIVE_TRADING_ACK`가 배포별 Challenge와 일치
- Account Allowlist에 대상 `accountSeq` 포함
- Kill Switch `OPEN=false`
- Release Evidence Bundle이 유효하고 만료되지 않음
- Credential Provider가 Client Secret을 안전하게 제공
- Reconciliation Lag가 Policy 한도 이내
- 실제 Auth/RLS와 승인 E2E가 통과

환경변수 하나만 변경해 LIVE가 되는 설계는 허용하지 않는다.

### 5.3 승격 단계

```text
R1 Foundation
  -> DRY_RUN Contract Replay
  -> PAPER Forward Run
  -> Read-only Toss Account Reconciliation
  -> Single-symbol / Minimum-notional LIVE Canary
  -> Bounded Multi-symbol Pilot
  -> Controlled Production
```

각 단계는 이전 단계의 Evidence Bundle을 참조하며 건너뛸 수 없다.

---

## 6. 시스템 경계

### 6.1 논리 구조

```text
Investment OS
  Evaluation -> Portfolio -> Risk -> Human Approval
                            |
                            v
                    Execution Handoff
==================== Trust Boundary ====================
Execution Service
  Intent Validator
  -> Preflight Gate
  -> Idempotency Ledger
  -> Order Orchestrator
  -> Broker Port
       |- Dry-run Adapter
       |- Paper Adapter
       `- Toss Adapter
  -> Order/Fill Reconciliation
  -> Portfolio Snapshot Import
```

### 6.2 배포 경계

| Component | Network 권한 | Secret 권한 | 주문 권한 |
|---|---|---|---|
| Core Domain | 없음 | 없음 | 없음 |
| Main API | Database·Execution Handoff | Broker Secret 없음 | 없음 |
| Web | Main API만 | 없음 | 없음 |
| Agent Worker | Provider만 | Broker Secret 없음 | 없음 |
| Execution Service | Broker API Allowlist | OAuth Client Secret | Gate 통과 요청만 |
| Reconciliation Worker | Broker 조회 API | OAuth Client Secret | 주문 생성 없음 |
| Operator | Control Plane | Secret 원문 없음 | Kill/Resume 승인 |

### 6.3 의존성 방향

```text
execution-domain <- execution-service -> broker-port <- toss-adapter
                                          ^
                                          `- paper-adapter
```

Toss DTO, OAuth, HTTP Status, Header 이름은 Adapter 밖으로 나오지 않는다.

---

## 7. End-to-End 실행 흐름

### 7.1 단일 주문

```text
1. Decision APPROVED
2. Transactional Outbox에 ExecutionRequested 기록
3. Execution Service가 Handoff 수신
4. Decision/Proposal/Risk/Snapshot/Policy 소유권 검증
5. Order Intent 불변 생성
6. Broker Account·시장·가격·주문가능 수량 재검증
7. 최종 Notional·Price Drift·Daily Limit 검증
8. Idempotency Reservation 획득
9. Broker 주문 제출
10. Broker Order ID와 Attempt 저장
11. 주문 상세 Polling·대사
12. Fill별 Execution Record·Lot·Cash 반영
13. Portfolio Snapshot 재생성
14. Completion Event·Report·사용자 알림
```

### 7.2 리밸런싱 Batch

Rebalance Review를 바로 주문 목록으로 취급하지 않는다.

```text
Rebalance Review
  -> Rebalance Proposal Revision
  -> Risk Decision
  -> Human-approved Rebalance Plan
  -> Deterministic Order Intent Batch
  -> Sell-first / Cash-aware Dependency DAG
  -> Per-order Preflight and Submission
  -> Fill-aware Remaining Plan Recalculation
  -> Final Reconciliation
```

Batch 일부가 실패하면 나머지를 무조건 계속하지 않는다. 각 Intent는 Dependency와 `continueOnFailure` 정책을 가지며, 예상 현금이나 매도 체결에 의존하는 매수는 선행 Fill 확인 전 제출할 수 없다.

---

## 8. Domain Contract

### 8.1 Execution Intent

```ts
type ExecutionMode = "OFF" | "DRY_RUN" | "PAPER" | "LIVE";
type OrderSide = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";
type TimeInForce = "DAY" | "CLS";

interface AutomatedExecutionIntentV1 {
  id: string;
  userId: string;
  portfolioId: string;
  accountId: string;
  decisionId: string;
  proposalId: string;
  riskDecisionId: string;
  portfolioSnapshotId: string;
  strategy: "CORE" | "FUTURE_CORE" | "MOMENTUM";
  symbol: string;
  market: "KR" | "US";
  side: OrderSide;
  orderType: OrderType;
  timeInForce: TimeInForce;
  quantity?: string;
  orderAmount?: string;
  limitPrice?: string;
  approvedReferencePrice: string;
  approvedNotional: string;
  currency: "KRW" | "USD";
  approvedAt: string;
  expiresAt: string;
  dataAsOf: string;
  snapshotIds: string[];
  policyVersionIds: string[];
  resultHash: string;
}
```

### 8.2 Preflight Snapshot

```ts
interface ExecutionPreflightV1 {
  intentId: string;
  checkedAt: string;
  priceAsOf: string;
  mode: ExecutionMode;
  killSwitchOpen: boolean;
  decisionApproved: boolean;
  ownershipValid: boolean;
  stale: boolean;
  marketOpen: boolean;
  priceDriftBps: number;
  orderNotional: string;
  buyingPower?: string;
  sellableQuantity?: string;
  existingOppositeOrder: boolean;
  reconciliationHealthy: boolean;
  blockerCodes: string[];
  warningCodes: string[];
  allowed: boolean;
  resultHash: string;
}
```

### 8.3 Broker Port

```ts
interface BrokerPortV1 {
  getAccounts(): Promise<BrokerAccountV1[]>;
  getHoldings(accountId: string): Promise<BrokerHoldingV1[]>;
  getBuyingPower(input: BuyingPowerQueryV1): Promise<string>;
  getSellableQuantity(input: SellableQuantityQueryV1): Promise<string>;
  createOrder(order: BrokerOrderRequestV1): Promise<BrokerOrderV1>;
  getOrder(accountId: string, brokerOrderId: string): Promise<BrokerOrderV1>;
  listOrders(query: BrokerOrderQueryV1): Promise<BrokerOrderV1[]>;
  modifyOrder(input: BrokerModifyOrderV1): Promise<BrokerOrderV1>;
  cancelOrder(accountId: string, brokerOrderId: string): Promise<BrokerOrderV1>;
}
```

Adapter 응답은 Broker 원문과 정규화된 계약을 함께 저장하되, Secret과 Authorization Header는 저장하지 않는다.

---

## 9. 상태기계

### 9.1 Intent 상태

```text
CREATED
  -> PREFLIGHT_PASSED
  -> RESERVED
  -> SUBMITTING
  -> SUBMITTED
  -> PARTIALLY_FILLED
  -> FILLED

CREATED/PREFLIGHT_PASSED -> BLOCKED
RESERVED/SUBMITTING -> UNKNOWN
SUBMITTED/PARTIALLY_FILLED -> CANCEL_PENDING -> CANCELLED
SUBMITTED/PARTIALLY_FILLED -> REJECTED | EXPIRED
UNKNOWN -> SUBMITTED | FILLED | REJECTED | CANCELLED via Reconciliation
```

### 9.2 금지 전이

- `BLOCKED`에서 직접 `SUBMITTING`으로 이동 금지
- `UNKNOWN`에서 새 주문 생성 금지
- `FILLED`, `CANCELLED`, `REJECTED` 종료 상태 변경 금지
- 원 Intent의 수량·가격 변경 금지
- 정정은 새 Attempt와 Broker Revision으로 기록
- 취소 후 재주문은 새 Intent Revision과 새 사용자 승인 필요

### 9.3 UNKNOWN 우선 처리

HTTP Timeout은 실패가 아니라 **결과 불명**이다. `UNKNOWN` 상태에서는 다음 순서만 허용한다.

1. 내부 `clientOrderId`로 저장된 Attempt 조회
2. Broker 주문 목록·상세 조회
3. Broker에 주문이 있으면 `SUBMITTED`로 복구
4. Broker에 없다는 확정 증거와 Idempotency 유효기간을 함께 확인
5. 재제출 정책 Gate를 통과한 경우에만 동일 키로 재시도

---

## 10. 주문 전 Preflight Gate

### 10.1 필수 Gate

| Gate | Block 조건 | Evidence |
|---|---|---|
| Mode | `OFF` 또는 LIVE 승격 불완전 | Runtime Config Hash |
| Decision | 미승인·거부·만료·승인자 없음 | Decision Revision |
| Ownership | User·Portfolio·Account 불일치 | Ownership Graph |
| Risk | `DENY`, Manual Review 미해소 | Risk Decision |
| Snapshot | stale·미래 데이터·계보 누락 | Snapshot Manifest |
| Price | 허용 Price Drift 초과 | Current Quote Snapshot |
| Market | 휴장·주문 불가 Session | Market Calendar Snapshot |
| Stock | 거래정지·경고·제한 | Stock Warning Snapshot |
| Cash | 매수가능금액 부족 | Buying Power Snapshot |
| Quantity | 매도가능수량 부족 | Sellable Quantity Snapshot |
| Pending | 반대 방향 미체결 주문 존재 | Broker Open Orders |
| Limit | 실제 제출 Notional이 승인액 또는 주문·종목·일간 한도 초과 | Execution Policy |
| Reconcile | 미확인 주문·잔고 Drift 존재 | Reconciliation Run |
| Kill | Global·Account·Portfolio·Symbol Switch Open | Kill Switch Revision |

### 10.2 가격 Drift

승인 시 기준 가격과 제출 직전 가격의 차이를 Basis Point로 계산한다.

```text
BUY drift bps  = max(0, current / approvedReference - 1) * 10,000
SELL drift bps = max(0, approvedReference / current - 1) * 10,000
```

허용치를 넘으면 수량을 조용히 줄이거나 시장가로 전환하지 않고 새 Proposal을 요구한다.

### 10.3 Notional 한도

최소한 다음 한도를 독립적으로 적용한다.

- 단일 주문 최대 금액
- 단일 종목 일간 순매수 금액
- Portfolio 일간 총주문 금액
- Momentum 일간 신규 Open Risk
- 전략 Bucket별 일간 Turnover
- 사용자 승인 금액
- Broker Buying Power

최종 허용 금액은 모든 한도의 최솟값이며 원 승인 금액을 넘을 수 없다.

- 금액 주문은 `orderAmount = approvedNotional`을 강제한다.
- 수량 주문은 `quantity × approvedReferencePrice <= approvedNotional`을 강제한다.
- 지정가는 `quantity × limitPrice`, 시장가는 제출 직전 `quantity × currentPrice`로 최종 Notional을 다시 계산한다.
- 재계산된 Notional이 승인액·단일주문 한도·Buying Power 중 하나라도 넘으면 수량을 임의 조정하지 않고 차단한다.

---

## 11. 토스증권 OpenAPI Adapter

### 11.1 공식 Source of Truth

- [OpenAPI Overview](https://openapi.tossinvest.com/openapi-docs/overview.md)
- [OpenAPI JSON](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json)
- [API Reference](https://openapi.tossinvest.com/openapi-docs/latest/api-reference/README.md)
- [Order API](https://openapi.tossinvest.com/openapi-docs/latest/api-reference/Apis/OrderApi.md)
- [OrderCreateRequest](https://openapi.tossinvest.com/openapi-docs/latest/api-reference/Models/OrderCreateRequest.md)

OpenAPI JSON을 Canonical Source로 사용하며 Markdown은 설계 검토와 구현 설명에 사용한다.

### 11.2 인증

- `POST /oauth2/token`
- OAuth 2.0 Client Credentials Grant
- 모든 요청: `Authorization: Bearer {access_token}`
- 계좌·자산·주문 요청: `X-Tossinvest-Account: {accountSeq}`
- API Server: `https://openapi.tossinvest.com`
- 허용 IP에 Execution Service의 고정 Egress IP 등록

Access Token은 만료 전에 단일 Flight로 갱신하고 Process Memory에만 보관한다. Client Secret과 Token을 Database·Audit·Application Log에 기록하지 않는다.

### 11.3 Endpoint Mapping

| Broker Port | Toss Endpoint | 용도 |
|---|---|---|
| Accounts | `GET /api/v1/accounts` | 허용 계좌 확인 |
| Holdings | `GET /api/v1/holdings` | Portfolio Snapshot·대사 |
| Create | `POST /api/v1/orders` | 주문 생성 |
| Modify | `POST /api/v1/orders/{orderId}/modify` | 승인 범위 내 정정 |
| Cancel | `POST /api/v1/orders/{orderId}/cancel` | 미체결 취소 |
| List | `GET /api/v1/orders` | Open/Closed 대사 |
| Detail | `GET /api/v1/orders/{orderId}` | 체결·상태 확인 |
| Buying Power | `GET /api/v1/buying-power` | 매수 전 검증 |
| Sellable Quantity | `GET /api/v1/sellable-quantity` | 매도 전 검증 |
| Commission | `GET /api/v1/commissions` | 비용 추정 |
| Price | `GET /api/v1/prices` | 제출 직전 가격 검증 |
| Warning | `GET /api/v1/stocks/{symbol}/warnings` | 제한종목 검증 |
| Calendar | `GET /api/v1/market-calendar/KR|US` | 시장 Session 검증 |

### 11.4 주문 생성 Mapping

토스 주문은 `quantity`와 `orderAmount` 중 정확히 하나만 사용한다.

| Intent | Toss Request |
|---|---|
| 내부 멱등 키 | `clientOrderId` |
| 종목 | `symbol` |
| 방향 | `side=BUY|SELL` |
| 지정가 | `orderType=LIMIT`, `price` 필수 |
| 시장가 | `orderType=MARKET`, `price` 금지 |
| 수량 주문 | `quantity` |
| 미국 금액 주문 | `orderAmount`, 정규장 MARKET 전용 |
| 유효조건 | `timeInForce=DAY|CLS` |
| 고액 확인 | 명시적 사용자 확인 근거가 있을 때만 `confirmHighValueOrder=true` |

`clientOrderId`는 최대 36자이며 토스증권의 멱등 보장 시간이 제한되어 있으므로 내부 영구 Idempotency Ledger를 함께 사용한다.

### 11.5 Rate Limit

공식 문서 기준 주문 그룹은 일반 시간 초당 최대 6회, 09:00~09:10 KST는 초당 최대 3회다. 수치는 변경될 수 있으므로 다음 응답 Header를 Runtime 기준으로 사용한다.

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

주문보다 조회·대사를 우선하는 별도 Token Bucket을 유지한다. Rate Limit 부족을 이유로 Preflight 검증을 생략하지 않는다.

---

## 12. Idempotency와 동시성

### 12.1 Key

```text
internalKey = sha256(
  accountId + decisionId + intentRevision + side + symbol + quantity/amount + price
)

clientOrderId = URL-safe prefix + truncated digest, max 36 chars
```

### 12.2 내부 Reservation

주문 제출 전 Database에서 `internalKey` Unique Reservation을 획득한다.

- 성공: 현재 Worker만 제출 가능
- 기존 `SUBMITTED/FILLED`: 기존 결과 반환
- 기존 `SUBMITTING/UNKNOWN`: 제출 금지, Reconciliation 요청
- 기존 `BLOCKED/REJECTED`: 원인 해소 후 새 Intent Revision 필요

### 12.3 Lease

Worker Crash를 고려해 Lease를 사용하되 Lease 만료가 재주문 허가를 의미하지 않는다. 만료된 `SUBMITTING`은 반드시 `UNKNOWN`으로 전환하고 Broker 대사 후 해소한다.

### 12.4 승인 Race

승인 후 다음 값이 바뀌면 기존 Intent를 폐기한다.

- Proposal 또는 Risk Revision
- Portfolio Snapshot
- 수량·금액·가격·Stop·전략
- Broker Account
- Execution Policy
- Kill Switch Revision

---

## 13. 오류 분류와 재시도

### 13.1 분류

| 종류 | 예 | 처리 |
|---|---|---|
| Contract | `invalid-request`, 잘못된 호가 | BLOCKED, 새 Intent |
| Authorization | `invalid-token`, `expired-token` | Token 1회 갱신 후 재시도 |
| Permission | `forbidden`, `account-restricted` | Kill Account, Operator Review |
| Business | 매수가능금액·매도가능수량 부족 | BLOCKED, 새 Snapshot |
| Market | 장 종료·가격 범위·거래 제한 | BLOCKED 또는 다음 Session 재승인 |
| Conflict | 이미 체결·취소·처리 중 | 주문 상세 대사 |
| Rate Limit | HTTP 429 | `Retry-After`와 Jitter |
| Transient | 주문 변경 HTTP 408·5xx·해석 불가 2xx | 즉시 UNKNOWN/Reconcile, 자동 재주문 금지 |
| Network Unknown | Timeout·Connection Reset | 즉시 UNKNOWN, 재주문 금지 |

### 13.2 재시도 Budget

- Token 발급: 지수 Backoff, 제한 횟수
- 읽기 API: `Retry-After` 우선, Jitter 포함
- 주문 생성: 동일 `clientOrderId`만 사용
- 주문 정정·취소: 상태 조회 후 재시도
- 최대 Budget 소진: Dead Letter가 아니라 Operator Queue와 Reconciliation로 이동

### 13.3 사용자 메시지

Broker 원문 Message를 그대로 노출하지 않는다. 정규화된 Code, 현재 상태, 재시도 여부, 사용자 행동, Broker Request ID를 표시한다.

---

## 14. Reconciliation

### 14.1 세 가지 원장

```text
Decision/Intent Ledger
Broker Order/Fill Ledger
Portfolio Lot/Cash Ledger
```

세 원장은 직접 덮어쓰지 않고 Reconciliation Result로 차이를 설명한다.

### 14.2 대사 주기

- 주문 제출 직후 상세 조회
- 미체결 주문은 상태별 적응형 Polling
- 장 시작 전 Open Order·Holdings 전체 대사
- 장 종료 후 Closed Order·Fill·Commission 대사
- 서비스 재시작 시 `SUBMITTING`, `UNKNOWN`, `PARTIALLY_FILLED` 우선 대사
- Operator 요청 시 Account 전체 대사

### 14.3 Drift Code

- `BROKER_ORDER_MISSING`
- `INTERNAL_ORDER_MISSING`
- `FILL_QUANTITY_MISMATCH`
- `FILL_PRICE_MISMATCH`
- `HOLDING_QUANTITY_MISMATCH`
- `CASH_BALANCE_MISMATCH`
- `COMMISSION_MISMATCH`
- `STRATEGY_LOT_UNALLOCATED`
- `UNKNOWN_ORDER_PRESENT`

Critical Drift가 하나라도 있으면 해당 Account 신규 주문을 차단한다.

### 14.4 Portfolio 반영

Broker Fill은 다음 순서로 반영한다.

1. Broker Order·Execution ID 중복 검사
2. 원 Intent·Decision·Strategy Lot 확인
3. 부분체결별 불변 Execution Record 생성
4. 수수료·환율·결제 예정 Cash 기록
5. Position Lot과 Portfolio Snapshot Revision 생성
6. Broker Holdings와 새 Snapshot 대사
7. Audit·Outbox Event 발행

---

## 15. Kill Switch와 운영 제어

### 15.1 Scope

| Scope | 효과 |
|---|---|
| GLOBAL | 모든 신규·정정 주문 차단 |
| BROKER | 해당 Broker 차단 |
| ACCOUNT | 해당 계좌 차단 |
| PORTFOLIO | 해당 Portfolio 차단 |
| STRATEGY | Long-term 또는 Momentum 신규 위험 차단 |
| SYMBOL | 해당 종목 차단 |

### 15.2 동작

- Kill Switch는 Database Revision과 In-memory Cache 모두에서 확인한다.
- Cache가 만료되거나 Control Plane 조회가 실패하면 신규 주문을 차단한다.
- `CANCEL_ONLY` 모드에서는 신규·정정은 금지하고 미체결 취소만 허용한다.
- 해제에는 원인·승인자·만료·Evidence가 필요하다.
- UI 표시만으로 제어하지 않는다.

### 15.3 자동 발동 조건

- 중복 주문 의심
- Critical Reconciliation Drift
- 예상 외 Account 또는 Symbol 주문 발견
- Daily Notional·Loss 한도 초과
- 오류율·UNKNOWN 상태 급증
- Token·권한 이상
- Broker 점검 또는 비정상 응답
- System Clock Drift

---

## 16. 보안과 개인정보

### 16.1 Secret

- Client ID와 Client Secret은 Secret Manager에서 Runtime에 주입
- `.env`는 Local DRY_RUN 전용이며 실제 Secret Commit 금지
- Access Token은 Process Memory에만 저장
- Log Scrubber가 `Authorization`, `client_secret`, Account Header를 제거
- Crash Dump와 APM Payload에 Request Header 수집 금지

### 16.2 Network

- 고정 Egress IP와 토스증권 허용 IP 등록
- Broker Domain Allowlist
- TLS 검증 비활성화 금지
- Web·Main API에서 Broker Endpoint 직접 접근 금지
- Execution Service Ingress는 Private Network와 Service Identity만 허용

### 16.3 Threat Model

| 위협 | 통제 |
|---|---|
| Prompt Injection이 주문 유도 | Agent 출력은 Decision이 아니며 Broker 권한 없음 |
| 승인 Payload 변조 | Server-side Canonical Hash 재계산 |
| Replay Attack | Intent Revision·Nonce·Idempotency Ledger |
| Credential 유출 | 분리 IAM·Secret Rotation·Redaction |
| SSRF | Broker Base URL 고정·User URL 입력 금지 |
| Insider 오주문 | Dual Control·Account/Notional Allowlist |
| Worker 중복 실행 | Unique Reservation·Lease·Reconciliation |
| Clock 조작 | NTP Drift Gate·Broker Session 확인 |

---

## 17. API와 Command

### 17.1 내부 Execution API

```text
POST /internal/v1/execution/intents
GET  /internal/v1/execution/intents/:id
POST /internal/v1/execution/intents/:id/preflight
POST /internal/v1/execution/intents/:id/submit
POST /internal/v1/execution/orders/:id/cancel
POST /internal/v1/execution/orders/:id/reconcile
POST /internal/v1/execution/accounts/:id/reconcile
GET  /internal/v1/execution/kill-switches
POST /internal/v1/execution/kill-switches/:scope/revisions
GET  /internal/v1/execution/health
```

외부 Web Client가 이 API를 직접 호출하지 않는다. Main API는 승인된 Handoff만 생성하고 Service Identity로 호출한다.

### 17.2 Submit Response

```json
{
  "intentId": "intent-...",
  "mode": "DRY_RUN",
  "status": "BLOCKED",
  "brokerOrderId": null,
  "externalSubmissionAttempted": false,
  "blockerCodes": ["LIVE_TRADING_DISABLED"],
  "resultHash": "sha256..."
}
```

`2xx`는 체결을 의미하지 않는다. 제출 수락, Broker 접수, 부분체결, 완전체결을 별도 상태로 표현한다.

---

## 18. Database

### 18.1 Tables

```text
broker_accounts
execution_policies
execution_intents
execution_preflights
execution_attempts
broker_orders
broker_order_revisions
broker_fills
execution_idempotency_keys
execution_kill_switches
execution_reconciliation_runs
execution_reconciliation_items
```

### 18.2 핵심 제약

- `(broker, broker_account_seq)` Unique, 내부 `broker_accounts.id`와 분리
- `execution_idempotency_keys.internal_key` Unique
- `(broker, broker_order_id)` Unique
- `(broker_order_id, broker_execution_id)` Unique
- Intent는 승인된 Decision·Proposal·Risk와 Composite Lineage FK
- Intent의 승인액·수량·가격·Portfolio·Policy·Account 관계는 Insert Trigger와 Check Constraint로 재검증
- Fill 수량 합의 주문 수량 초과는 Reconciliation 단계에서 Critical Drift로 차단
- 종료 상태 Order는 원본 Row Update 금지, Revision만 추가
- LIVE Intent는 유효한 Policy·Release Evidence·Account Allowlist 필요

### 18.3 RLS와 Service Role

사용자는 자신의 Intent·Order·Fill·Reconciliation 결과를 읽을 수 있다. 생성·상태 전이는 Execution Service 전용 Database Role이 수행한다. Service Role 사용 자체가 소유권 검증을 대체하지 않으며 모든 Insert에 `user_id` Composite FK를 적용한다.

### 18.4 Transactional Outbox

다음 상태 변경과 Event 발행은 같은 Transaction으로 저장한다.

- `ExecutionIntentCreated`
- `ExecutionPreflightBlocked`
- `BrokerOrderSubmissionStarted`
- `BrokerOrderSubmitted`
- `BrokerOrderStateObserved`
- `BrokerFillObserved`
- `ExecutionReconciliationFailed`
- `ExecutionKillSwitchOpened`
- `ExecutionCompleted`

---

## 19. Observability와 SLO

### 19.1 Metrics

- Intent 수와 상태별 체류 시간
- Preflight Blocker별 건수
- 주문 Submit Latency와 Error Rate
- UNKNOWN·중복 방지 발생 건수
- Broker Rate Limit Remaining
- Open Order와 Reconciliation Lag
- Fill 반영 지연
- Account·Portfolio Drift
- Kill Switch Scope와 지속 시간
- 일간 Notional·Turnover·Slippage

### 19.2 SLO 후보

| SLI | Pilot 목표 | 위반 시 |
|---|---|---|
| 중복 Broker 주문 | 0 | Global Kill |
| 미승인 주문 | 0 | Global Kill·Incident |
| Critical Drift | 0 unresolved | Account Kill |
| 주문 상태 대사 지연 | 99% Policy 이내 | 신규 주문 제한 |
| Audit 계보 누락 | 0 | Release 차단 |
| Secret Log 노출 | 0 | Credential Rotation |

SLO 수치는 PAPER와 Canary 측정 후 Policy Revision으로 확정한다.

### 19.3 Audit

Audit에는 Actor·Service Identity·Mode·Decision·Intent·Policy·Account Alias·Broker Request ID·결과 Code·Timestamp·Result Hash를 기록한다. Account 원문 식별자와 주문 세부 금액은 접근 통제된 Execution Store에만 보관한다.

---

## 20. 테스트 전략

### 20.1 Unit

- Intent Canonicalization과 Stable Hash
- 승인 수량·금액 상한
- Price Drift와 Notional Gate
- Decimal·시장별 수량·가격 규칙
- Error Mapping과 Retry 분류
- State Transition과 종료 상태 불변성
- `clientOrderId` 길이·문자·안정성

### 20.2 Contract

- Toss OAuth Request와 Token Cache
- `Authorization`, `X-Tossinvest-Account` Header
- Create/Modify/Cancel/List/Detail DTO Mapping
- Error Envelope와 Request ID
- 429 Header와 `Retry-After`
- Timeout을 UNKNOWN으로 분류

### 20.3 Integration

- Decision→Intent→Preflight→Paper Order→Fill→Portfolio Snapshot
- Transactional Outbox 중복 Delivery
- 두 Worker의 동시 Submit
- Process Crash 후 UNKNOWN Recovery
- Partial Fill 후 Cancel
- Rebalance Sell Dependency 후 Buy
- Broker Holdings Drift와 Account Kill

### 20.4 Security

- Secret Scan
- Header·Log Redaction
- SSRF와 Base URL Override 차단
- Service Identity·Account Ownership 위조
- 승인 Hash Tampering
- Prompt/Agent Output의 직접 Order 변환 차단

### 20.5 LIVE Canary

실계좌 검증은 최소 금액·단일 계좌·단일 종목·정규장·지정가·즉시 운영자 관찰 조건에서 수행한다. Canary도 사용자의 명시적 주문 승인과 Broker 약관·위험 고지를 요구한다.

---

## 21. Release Gate

### 21.1 Foundation Gate

- [x] Execution Domain·Broker Port·Mode Gate 구현
- [x] Toss Adapter Contract Test
- [x] Idempotency·UNKNOWN·Kill Switch Test
- [x] Migration·RLS·불변 Trigger 정의와 Manifest 연결
- [x] DRY_RUN·PAPER Service Flow 회귀 테스트
- [ ] Preview Supabase에 013 Migration 실제 적용

### 21.2 PAPER Gate

- [ ] Synthetic Walking Skeleton 통과
- [ ] 2개 시장·매수·매도·부분체결·취소 Scenario
- [ ] 재시작·중복 Event·Timeout Fault Injection
- [ ] Portfolio Reconciliation 100%
- [ ] 최소 20 Trading Session Forward Run

### 21.3 Read-only Broker Gate

- [ ] 토스증권 Client 등록·허용 IP·약관 확인
- [ ] 계좌·Holdings·Order 조회 연결
- [ ] Account Allowlist·Credential Rotation
- [ ] 실계좌 Snapshot과 내부 원장 대사
- [ ] Security·Privacy Review

### 21.4 LIVE Canary Gate

- [ ] 실제 Auth/RLS·Re-auth E2E
- [ ] Notional·Symbol·Session Allowlist
- [ ] Operator On-call·Runbook·Kill Drill
- [ ] Broker 장애·UNKNOWN 복구 Drill
- [ ] 사용자 명시 승인과 고액주문 확인 정책
- [ ] 다중 승인 Release Evidence

### 21.5 Production Gate

- [ ] Canary Exit Criteria 통과
- [ ] 중복·미승인·Critical Drift 0
- [ ] SLO·Alert·Incident Review 승인
- [ ] Backup/Restore와 Audit Export
- [ ] 법무·약관·세금·사용자 적합성 검토
- [ ] Rollback·Credential Revoke 검증

체크되지 않은 Gate가 있는 상태는 LIVE 준비 완료가 아니다.

---

## 22. 구현 순서

1. `automated-execution-v1` 순수 Domain과 안전 Gate
2. Broker Port와 In-memory DRY_RUN/PAPER Adapter
3. Toss OAuth·Account·Holdings·Order Adapter
4. 분리된 Execution Service와 Runtime Mode Guard
5. `013_automated_trading_execution_v1.sql`
6. API Contract·Fault Injection·Race Test
7. Main API의 승인된 Execution Handoff
8. Read-only Broker Reconciliation
9. PAPER Forward Run
10. LIVE Canary Evidence 승인

1~6은 Credential 없이 구현·검증할 수 있다. 7~10은 실제 환경과 사용자·운영자 승인이 필요하다.

---

## 23. Definition of Done

### 23.1 Foundation

- [x] Investment OS와 Execution Service가 Process·Credential 수준에서 분리되었는가?
- [x] `LIVE`가 기본 비활성이고 다중 Gate 없이는 시작되지 않는가?
- [x] 승인된 Decision 외 입력이 Broker Port에 도달하지 않는가?
- [x] 동일 Process에서 동일 Intent의 동시·반복 요청이 중복 주문을 만들지 않는가?
- [ ] Process 재시작·다중 Instance에서도 영속 Idempotency Reservation이 중복 주문을 막는가?
- [x] Timeout이 재주문이 아니라 UNKNOWN·대사로 이어지는가?
- [x] 토스 API DTO와 Error가 Adapter 밖으로 누출되지 않는가?
- [x] Order·Fill Schema가 Decision·Risk·Snapshot·Policy 계보를 강제하는가?

### 23.2 Portfolio Automation

- [ ] Rebalance Proposal이 Human Approval 전 주문으로 변환되지 않는가?
- [ ] Sell 체결 의존 Buy가 선행 Fill 전 제출되지 않는가?
- [ ] 부분체결 후 남은 계획이 현금·노출·Risk 기준으로 재검증되는가?
- [ ] Fill이 전략별 Lot과 Cash에 중복 없이 반영되는가?
- [ ] Critical Reconciliation Drift가 신규 주문을 차단하는가?

### 23.3 Operations

- [ ] Global·Account·Portfolio·Strategy·Symbol Kill이 서버와 Worker에서 강제되는가?
- [ ] Cancel-only Incident Mode가 검증되었는가?
- [ ] Secret·Token·Account Header가 Log와 Artifact에 없는가?
- [ ] Rate Limit·Broker 장애·Process Crash Runbook이 검증되었는가?
- [ ] LIVE 승격·해제·Rollback이 Audit와 Evidence Bundle로 남는가?

---

## 24. 현재 판정과 다음 단계

현재 Repository에는 실행 Foundation과 토스증권 Adapter 계약이 구현되었으며 실제 자동주문은 활성화하지 않는다.

- 설계·Foundation: `R1 VERIFIED`
- 실행 모드: `DRY_RUN DEFAULT / PAPER AVAILABLE / LIVE DISABLED`
- 토스 Credential: Repository에 없음
- 실제 주문 증거: 없음
- 구현 증거: Core 8개, Execution Service·Runtime·Toss Adapter 14개 테스트와 013 Migration
- 다음 단계: Preview Migration 적용 → PAPER Forward Run → 토스 Read-only 계좌 대사 → LIVE Canary 승인

Foundation 구현 완료 후에도 상태는 `DRY_RUN/PAPER READY`다. 실제 토스 계좌 연결과 LIVE는 Read-only Broker Gate와 LIVE Canary Gate를 별도로 통과해야 한다.
R1 Runtime은 환경변수가 모두 충족되어도 `R1_AUTHORITATIVE_EXECUTION_LEDGER_NOT_AVAILABLE` Hard Block으로 `LIVE` 시작을 거부한다. Main API의 승인 Handoff, 영속 Intent·Idempotency Repository, Reconciliation Worker가 구현·검증된 후 별도 Release에서만 이 상수를 제거한다.
