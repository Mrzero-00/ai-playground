import { assertCurrency, assertDecimal, compareDecimal, decimalRatio, type CurrencyCode, type DecimalString } from "./decimal.js";
import type { DecisionProposal } from "./decision.js";

export type ExecutionStatus = "PENDING" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED";

export type ExecutionRecord = {
  id: string;
  decisionId: string;
  lotId: string;
  requestedQuantity: DecimalString;
  filledQuantity: DecimalString;
  recommendedPrice: DecimalString;
  averageFillPrice?: DecimalString;
  currency: CurrencyCode;
  status: ExecutionStatus;
  executedAt: string;
};

export function recordExecution(decision: DecisionProposal, record: ExecutionRecord): ExecutionRecord & { slippagePercent?: number } {
  if (decision.status !== "APPROVED") throw new Error("execution requires an approved decision");
  if (record.decisionId !== decision.id) throw new Error("execution does not match decision");
  if (record.currency !== decision.currency) throw new Error("execution currency does not match decision");
  const executedAt = new Date(record.executedAt).getTime();
  const decidedAt = new Date(decision.userDecision?.decidedAt ?? "").getTime();
  if (!Number.isFinite(executedAt) || !Number.isFinite(decidedAt) || executedAt < decidedAt) {
    throw new Error("execution time must be after user approval");
  }
  assertDecimal(record.requestedQuantity, "requestedQuantity");
  assertDecimal(record.filledQuantity, "filledQuantity");
  assertDecimal(record.recommendedPrice, "recommendedPrice");
  if (record.averageFillPrice !== undefined) assertDecimal(record.averageFillPrice, "averageFillPrice");
  assertCurrency(record.currency);
  if (compareDecimal(record.requestedQuantity, "0") <= 0 || compareDecimal(record.filledQuantity, record.requestedQuantity) > 0) {
    throw new RangeError("invalid execution quantities");
  }
  if (record.status === "FILLED" && compareDecimal(record.filledQuantity, record.requestedQuantity) !== 0) throw new Error("filled execution must fill all quantity");
  if (compareDecimal(record.filledQuantity, "0") > 0 && !record.averageFillPrice) throw new Error("fill price is required for executions");
  const slippagePercent = record.averageFillPrice === undefined
    ? undefined
    : Math.round((decimalRatio(record.averageFillPrice, record.recommendedPrice) - 1) * 100 * 1_000_000_000) / 1_000_000_000;
  return { ...record, ...(slippagePercent === undefined ? {} : { slippagePercent }) };
}
