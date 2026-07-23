import { assertCurrency, assertDecimal, compareDecimal, multiplyDecimal, type DecimalString } from "../decimal.js";
import { executionStableHashV1 } from "./hash.js";
import type { AutomatedExecutionIntentInputV1, AutomatedExecutionIntentV1 } from "./types.js";

export function createAutomatedExecutionIntentV1(input: AutomatedExecutionIntentInputV1): AutomatedExecutionIntentV1 {
  validateIdentity(input);
  validateApproval(input);
  validateOrder(input);
  validateLineage(input);

  const canonical = {
    ...structuredClone(input),
    symbol: input.symbol.toUpperCase(),
    snapshotIds: [...input.snapshotIds].sort(),
    policyVersionIds: [...input.policyVersionIds].sort(),
    status: "CREATED" as const,
  };
  const idempotencyKey = executionStableHashV1({
    accountId: canonical.accountId,
    decisionId: canonical.decisionId,
    proposalId: canonical.proposalId,
    symbol: canonical.symbol,
    side: canonical.side,
    orderType: canonical.orderType,
    timeInForce: canonical.timeInForce,
    quantity: canonical.quantity,
    orderAmount: canonical.orderAmount,
    limitPrice: canonical.limitPrice,
  });
  const clientOrderId = `io-${idempotencyKey.slice(0, 32)}`;
  const withIdentity = { ...canonical, idempotencyKey, clientOrderId };
  return { ...withIdentity, resultHash: executionStableHashV1(withIdentity) };
}

function validateIdentity(input: AutomatedExecutionIntentInputV1): void {
  for (const [name, value] of Object.entries({
    id: input.id,
    userId: input.userId,
    portfolioId: input.portfolioId,
    accountId: input.accountId,
    decisionId: input.decisionId,
    proposalId: input.proposalId,
    riskDecisionId: input.riskDecisionId,
    portfolioSnapshotId: input.portfolioSnapshotId,
    approvedBy: input.approvedBy,
    symbol: input.symbol,
  })) {
    if (!value.trim()) throw new Error(`Execution intent ${name} is required`);
  }
  if (input.market === "KR" && !/^\d{6}$/.test(input.symbol)) throw new Error("KR execution symbol must be six digits");
  if (input.market === "US" && !/^[A-Za-z0-9.-]+$/.test(input.symbol)) throw new Error("US execution symbol is invalid");
  if ((input.market === "KR" && input.currency !== "KRW") || (input.market === "US" && input.currency !== "USD")) {
    throw new Error("Execution market and currency do not match");
  }
}

function validateApproval(input: AutomatedExecutionIntentInputV1): void {
  if (input.decisionStatus !== "APPROVED") throw new Error("Execution requires an approved decision");
  if (input.riskStatus !== "ALLOW" && input.riskStatus !== "REDUCE") throw new Error("Execution requires an executable risk decision");
  const dataAsOf = requireTime(input.dataAsOf, "dataAsOf");
  const approvedAt = requireTime(input.approvedAt, "approvedAt");
  const createdAt = requireTime(input.createdAt, "createdAt");
  const expiresAt = requireTime(input.expiresAt, "expiresAt");
  if (dataAsOf > approvedAt) throw new Error("Execution data cannot be newer than approval");
  if (approvedAt > createdAt) throw new Error("Execution intent cannot be created before approval");
  if (createdAt >= expiresAt) throw new Error("Execution intent must expire after creation");
}

function validateOrder(input: AutomatedExecutionIntentInputV1): void {
  assertCurrency(input.currency);
  assertPositive(input.approvedReferencePrice, "approvedReferencePrice");
  assertPositive(input.approvedNotional, "approvedNotional");
  const hasQuantity = input.quantity !== undefined;
  const hasAmount = input.orderAmount !== undefined;
  if (hasQuantity === hasAmount) throw new Error("Execution requires exactly one of quantity or orderAmount");
  if (input.quantity !== undefined) {
    assertPositive(input.quantity, "quantity");
    const fractional = input.quantity.includes(".") && !/^\d+\.0+$/.test(input.quantity);
    if (input.market === "KR" && fractional) throw new Error("KR execution quantity must be an integer");
    if (fractional && !(input.market === "US" && input.side === "SELL" && input.orderType === "MARKET")) {
      throw new Error("Fractional quantity is allowed only for US market sell orders");
    }
    const scale = input.quantity.split(".")[1]?.length ?? 0;
    if (scale > 6) throw new Error("Execution quantity supports at most six decimal places");
  }
  if (input.orderAmount !== undefined) {
    assertPositive(input.orderAmount, "orderAmount");
    if (input.market !== "US" || input.side !== "BUY" || input.orderType !== "MARKET") {
      throw new Error("Amount orders require a US market buy");
    }
    if (compareDecimal(input.orderAmount, input.approvedNotional) !== 0) {
      throw new Error("Amount order must equal its approved notional");
    }
  }
  if (input.orderType === "LIMIT") {
    if (input.limitPrice === undefined) throw new Error("Limit execution requires limitPrice");
    assertPositive(input.limitPrice, "limitPrice");
  } else if (input.limitPrice !== undefined) {
    throw new Error("Market execution cannot include limitPrice");
  }
  if (input.timeInForce === "CLS" && !(input.market === "US" && input.orderType === "LIMIT")) {
    throw new Error("CLS is supported only for US limit execution");
  }
  if (input.quantity !== undefined) {
    const referenceNotional = multiplyDecimal(input.quantity, input.approvedReferencePrice);
    if (compareDecimal(referenceNotional, input.approvedNotional) > 0) {
      throw new Error("Quantity order reference notional exceeds its approval");
    }
    if (input.orderType === "LIMIT") {
      const limitNotional = multiplyDecimal(input.quantity, input.limitPrice!);
      if (compareDecimal(limitNotional, input.approvedNotional) > 0) {
        throw new Error("Limit order notional exceeds its approval");
      }
    }
  }
}

export function calculateExecutionOrderNotionalV1(
  intent: Pick<AutomatedExecutionIntentV1, "orderAmount" | "quantity" | "orderType" | "limitPrice">,
  marketPrice: DecimalString,
): DecimalString {
  assertPositive(marketPrice, "marketPrice");
  if (intent.orderAmount !== undefined) return intent.orderAmount;
  if (intent.quantity === undefined) throw new Error("Execution quantity is required for quantity notional");
  const executionPrice = intent.orderType === "LIMIT" ? intent.limitPrice : marketPrice;
  if (executionPrice === undefined) throw new Error("Execution limit price is required for limit notional");
  return multiplyDecimal(intent.quantity, executionPrice);
}

function validateLineage(input: AutomatedExecutionIntentInputV1): void {
  if (input.snapshotIds.length === 0 || !input.snapshotIds.includes(input.portfolioSnapshotId)) {
    throw new Error("Execution intent must include its portfolio snapshot");
  }
  requireUnique(input.snapshotIds, "snapshotIds");
  if (input.policyVersionIds.length === 0) throw new Error("Execution intent requires policy versions");
  requireUnique(input.policyVersionIds, "policyVersionIds");
}

function assertPositive(value: string, label: string): void {
  assertDecimal(value, label);
  if (compareDecimal(value, "0") <= 0) throw new Error(`${label} must be positive`);
}

function requireTime(value: string, label: string): number {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`Execution ${label} must be a valid timestamp`);
  return time;
}

function requireUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length || values.some((value) => !value.trim())) {
    throw new Error(`Execution ${label} must contain unique non-empty values`);
  }
}
