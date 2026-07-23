import { assertDecimal, compareDecimal, decimalRatio } from "../decimal.js";
import { executionStableHashV1 } from "./hash.js";
import { calculateExecutionOrderNotionalV1 } from "./intent.js";
import type {
  AutomatedExecutionIntentV1,
  ExecutionPreflightObservationV1,
  ExecutionPreflightV1,
  ExecutionRuntimeGateV1,
} from "./types.js";

export function evaluateExecutionPreflightV1(
  intent: AutomatedExecutionIntentV1,
  runtime: ExecutionRuntimeGateV1,
  observation: ExecutionPreflightObservationV1,
): ExecutionPreflightV1 {
  validateRuntime(runtime);
  validateObservation(observation);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checkedAt = Date.parse(observation.checkedAt);
  const expiresAt = Date.parse(intent.expiresAt);
  const dataAsOf = Date.parse(intent.dataAsOf);
  const priceAsOf = Date.parse(observation.priceAsOf);
  const ageSeconds = Math.max(0, (checkedAt - dataAsOf) / 1_000);
  const priceAgeSeconds = Math.max(0, (checkedAt - priceAsOf) / 1_000);
  const stale = ageSeconds > runtime.maxDataAgeSeconds;
  const priceDriftBps = calculateAdversePriceDriftBps(intent.side, intent.approvedReferencePrice, observation.currentPrice);
  const orderNotional = calculateExecutionOrderNotionalV1(intent, observation.currentPrice);

  if (runtime.mode === "OFF") blockers.push("EXECUTION_MODE_OFF");
  if (runtime.killSwitchOpen) blockers.push("KILL_SWITCH_OPEN");
  if (!runtime.accountAllowed) blockers.push("ACCOUNT_NOT_ALLOWED");
  if (checkedAt >= expiresAt) blockers.push("INTENT_EXPIRED");
  if (stale) blockers.push("EXECUTION_DATA_STALE");
  if (priceAsOf > checkedAt) blockers.push("PRICE_DATA_FROM_FUTURE");
  if (priceAgeSeconds > runtime.maxDataAgeSeconds) blockers.push("PRICE_DATA_STALE");
  if (!observation.marketOpen) blockers.push("MARKET_CLOSED");
  if (observation.stockRestricted) blockers.push("STOCK_RESTRICTED");
  if (observation.existingOppositeOrder) blockers.push("OPPOSITE_OPEN_ORDER_EXISTS");
  if (!observation.reconciliationHealthy) blockers.push("RECONCILIATION_UNHEALTHY");
  if (priceDriftBps > runtime.maxPriceDriftBps) blockers.push("PRICE_DRIFT_EXCEEDED");
  if (compareDecimal(orderNotional, intent.approvedNotional) > 0) blockers.push("ORDER_NOTIONAL_EXCEEDS_APPROVAL");
  if (compareDecimal(intent.approvedNotional, runtime.maxSingleOrderNotional) > 0) blockers.push("SINGLE_ORDER_NOTIONAL_EXCEEDED");
  if (compareDecimal(orderNotional, runtime.maxSingleOrderNotional) > 0) blockers.push("SINGLE_ORDER_NOTIONAL_EXCEEDED");

  if (intent.side === "BUY") {
    if (observation.buyingPower === undefined) blockers.push("BUYING_POWER_UNAVAILABLE");
    else if (compareDecimal(observation.buyingPower, orderNotional) < 0) blockers.push("INSUFFICIENT_BUYING_POWER");
  } else {
    if (intent.quantity === undefined) blockers.push("SELL_QUANTITY_REQUIRED");
    else if (observation.sellableQuantity === undefined) blockers.push("SELLABLE_QUANTITY_UNAVAILABLE");
    else if (compareDecimal(observation.sellableQuantity, intent.quantity) < 0) blockers.push("INSUFFICIENT_SELLABLE_QUANTITY");
  }

  if (runtime.mode === "LIVE") {
    if (!runtime.autoTradingEnabled) blockers.push("LIVE_TRADING_DISABLED");
    if (!runtime.liveTradingAcknowledged) blockers.push("LIVE_ACKNOWLEDGEMENT_MISSING");
    if (!runtime.releaseEvidenceVerified) blockers.push("LIVE_RELEASE_EVIDENCE_MISSING");
  } else if (runtime.mode === "DRY_RUN") {
    warnings.push("DRY_RUN_NO_EXTERNAL_SUBMISSION");
  } else if (runtime.mode === "PAPER") {
    warnings.push("PAPER_NO_EXTERNAL_SUBMISSION");
  }

  const blockerCodes = [...new Set(blockers)].sort();
  const warningCodes = [...new Set(warnings)].sort();
  const allowed = blockerCodes.length === 0;
  const canonical = {
    intentId: intent.id,
    checkedAt: observation.checkedAt,
    mode: runtime.mode,
    killSwitchOpen: runtime.killSwitchOpen,
    decisionApproved: true as const,
    ownershipValid: runtime.accountAllowed,
    stale,
    marketOpen: observation.marketOpen,
    priceAsOf: observation.priceAsOf,
    priceDriftBps,
    orderNotional,
    ...(observation.buyingPower === undefined ? {} : { buyingPower: observation.buyingPower }),
    ...(observation.sellableQuantity === undefined ? {} : { sellableQuantity: observation.sellableQuantity }),
    existingOppositeOrder: observation.existingOppositeOrder,
    reconciliationHealthy: observation.reconciliationHealthy,
    blockerCodes,
    warningCodes,
    allowed,
    externalSubmissionAllowed: allowed && runtime.mode === "LIVE",
  };
  return { ...canonical, resultHash: executionStableHashV1(canonical) };
}

export function calculateAdversePriceDriftBps(
  side: "BUY" | "SELL",
  approvedReferencePrice: string,
  currentPrice: string,
): number {
  assertDecimal(approvedReferencePrice, "approvedReferencePrice");
  assertDecimal(currentPrice, "currentPrice");
  if (compareDecimal(approvedReferencePrice, "0") <= 0 || compareDecimal(currentPrice, "0") <= 0) {
    throw new Error("Execution prices must be positive");
  }
  const ratio = side === "BUY"
    ? decimalRatio(currentPrice, approvedReferencePrice) - 1
    : decimalRatio(approvedReferencePrice, currentPrice) - 1;
  return Math.max(0, Math.round(ratio * 10_000));
}

function validateRuntime(runtime: ExecutionRuntimeGateV1): void {
  assertDecimal(runtime.maxSingleOrderNotional, "maxSingleOrderNotional");
  if (compareDecimal(runtime.maxSingleOrderNotional, "0") <= 0) throw new Error("Execution max notional must be positive");
  if (!Number.isInteger(runtime.maxPriceDriftBps) || runtime.maxPriceDriftBps < 0) throw new Error("Execution max price drift must be a non-negative integer");
  if (!Number.isInteger(runtime.maxDataAgeSeconds) || runtime.maxDataAgeSeconds <= 0) throw new Error("Execution max data age must be positive");
}

function validateObservation(observation: ExecutionPreflightObservationV1): void {
  if (!Number.isFinite(Date.parse(observation.checkedAt))) throw new Error("Execution checkedAt must be valid");
  if (!Number.isFinite(Date.parse(observation.priceAsOf))) throw new Error("Execution priceAsOf must be valid");
  assertDecimal(observation.currentPrice, "currentPrice");
  if (compareDecimal(observation.currentPrice, "0") <= 0) throw new Error("Execution currentPrice must be positive");
  if (observation.buyingPower !== undefined) assertDecimal(observation.buyingPower, "buyingPower");
  if (observation.sellableQuantity !== undefined) assertDecimal(observation.sellableQuantity, "sellableQuantity");
}
