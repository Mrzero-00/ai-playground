import type { CurrencyCode, DecimalString } from "../decimal.js";

export type ExecutionModeV1 = "OFF" | "DRY_RUN" | "PAPER" | "LIVE";
export type ExecutionStrategyV1 = "CORE" | "FUTURE_CORE" | "MOMENTUM";
export type ExecutionOrderSideV1 = "BUY" | "SELL";
export type ExecutionOrderTypeV1 = "MARKET" | "LIMIT";
export type ExecutionTimeInForceV1 = "DAY" | "CLS";
export type AutomatedExecutionStatusV1 =
  | "CREATED"
  | "PREFLIGHT_PASSED"
  | "BLOCKED"
  | "RESERVED"
  | "SUBMITTING"
  | "SUBMITTED"
  | "UNKNOWN"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCEL_PENDING"
  | "CANCELLED"
  | "REJECTED"
  | "EXPIRED";

export type AutomatedExecutionIntentInputV1 = {
  id: string;
  userId: string;
  portfolioId: string;
  accountId: string;
  decisionId: string;
  proposalId: string;
  riskDecisionId: string;
  portfolioSnapshotId: string;
  decisionStatus: "APPROVED";
  riskStatus: "ALLOW" | "REDUCE";
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
  expiresAt: string;
  dataAsOf: string;
  strategy: ExecutionStrategyV1;
  symbol: string;
  market: "KR" | "US";
  side: ExecutionOrderSideV1;
  orderType: ExecutionOrderTypeV1;
  timeInForce: ExecutionTimeInForceV1;
  quantity?: DecimalString;
  orderAmount?: DecimalString;
  limitPrice?: DecimalString;
  approvedReferencePrice: DecimalString;
  approvedNotional: DecimalString;
  currency: CurrencyCode;
  snapshotIds: string[];
  policyVersionIds: string[];
};

export type AutomatedExecutionIntentV1 = AutomatedExecutionIntentInputV1 & {
  status: "CREATED";
  idempotencyKey: string;
  clientOrderId: string;
  resultHash: string;
};

export type ExecutionRuntimeGateV1 = {
  mode: ExecutionModeV1;
  autoTradingEnabled: boolean;
  liveTradingAcknowledged: boolean;
  releaseEvidenceVerified: boolean;
  accountAllowed: boolean;
  killSwitchOpen: boolean;
  maxSingleOrderNotional: DecimalString;
  maxPriceDriftBps: number;
  maxDataAgeSeconds: number;
};

export type ExecutionPreflightObservationV1 = {
  checkedAt: string;
  currentPrice: DecimalString;
  priceAsOf: string;
  marketOpen: boolean;
  stockRestricted: boolean;
  buyingPower?: DecimalString;
  sellableQuantity?: DecimalString;
  existingOppositeOrder: boolean;
  reconciliationHealthy: boolean;
};

export type ExecutionPreflightV1 = {
  intentId: string;
  checkedAt: string;
  mode: ExecutionModeV1;
  killSwitchOpen: boolean;
  decisionApproved: true;
  ownershipValid: boolean;
  stale: boolean;
  marketOpen: boolean;
  priceAsOf: string;
  priceDriftBps: number;
  orderNotional: DecimalString;
  buyingPower?: DecimalString;
  sellableQuantity?: DecimalString;
  existingOppositeOrder: boolean;
  reconciliationHealthy: boolean;
  blockerCodes: string[];
  warningCodes: string[];
  allowed: boolean;
  externalSubmissionAllowed: boolean;
  resultHash: string;
};

export type BrokerOrderRequestV1 = {
  accountId: string;
  clientOrderId: string;
  symbol: string;
  side: ExecutionOrderSideV1;
  orderType: ExecutionOrderTypeV1;
  timeInForce: ExecutionTimeInForceV1;
  quantity?: DecimalString;
  orderAmount?: DecimalString;
  price?: DecimalString;
  confirmHighValueOrder: boolean;
};

export type BrokerOrderV1 = {
  brokerOrderId: string;
  clientOrderId?: string;
  status: string;
  raw: unknown;
};

export interface BrokerPortV1 {
  createOrder(order: BrokerOrderRequestV1): Promise<BrokerOrderV1>;
  getOrder(accountId: string, brokerOrderId: string): Promise<BrokerOrderV1>;
  cancelOrder(accountId: string, brokerOrderId: string): Promise<BrokerOrderV1>;
}

export type ExecutionSubmissionResultV1 = {
  intentId: string;
  mode: ExecutionModeV1;
  status: "BLOCKED" | "DRY_RUN_VALIDATED" | "SUBMITTED" | "UNKNOWN";
  brokerOrderId?: string;
  externalSubmissionAttempted: boolean;
  blockerCodes: string[];
  warningCodes: string[];
  idempotentReplay: boolean;
  resultHash: string;
};
