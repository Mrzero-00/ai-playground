import {
  addDecimal,
  assertCurrency,
  assertDecimal,
  compareDecimal,
  subtractDecimalFloorZero,
  type CurrencyCode,
  type DecimalString,
} from "./decimal.js";
import type { InvestmentStrategy } from "./philosophy-policy.js";

export type CapitalSource = "SALARY" | "DIVIDEND" | "POSITION_EXIT" | "INTEREST" | "EXTERNAL_TRANSFER" | "TAX_REFUND";

export type CapitalAllocationItem = {
  id: string;
  strategy: Exclude<InvestmentStrategy, "CASH">;
  companyId: string;
  requestedAmount: DecimalString;
  approvedAmount: DecimalString;
  rationale: string;
  reductionOrRejectionReason?: string;
  nextReviewCondition: string;
};

export type CapitalAllocationDecision = {
  id: string;
  generatedAt: string;
  dataAsOf: string;
  capitalSource: CapitalSource;
  availableAmount: DecimalString;
  currency: CurrencyCode;
  currentWeights: Record<string, number>;
  targetWeights: Record<string, number>;
  projectedWeights: Record<string, number>;
  proposals: CapitalAllocationItem[];
  cashRetained: DecimalString;
  constraintsTriggered: string[];
  stressSummary: string;
  finalRecommendation: string;
  snapshotIds: string[];
  policyVersionId: string;
};

export function createCapitalAllocationDecision(
  input: Omit<CapitalAllocationDecision, "cashRetained">,
): CapitalAllocationDecision {
  if (!input.id.trim() || !input.policyVersionId.trim() || !input.finalRecommendation.trim() || !input.stressSummary.trim()) {
    throw new Error("allocation id, policy version, recommendation and stress summary are required");
  }
  const generatedAt = parseDate(input.generatedAt, "generatedAt");
  if (parseDate(input.dataAsOf, "dataAsOf") > generatedAt) throw new Error("allocation dataAsOf cannot be after generatedAt");
  assertCurrency(input.currency);
  assertDecimal(input.availableAmount, "availableAmount");
  if (compareDecimal(input.availableAmount, "0") <= 0) throw new Error("availableAmount must be positive");
  validateWeights("currentWeights", input.currentWeights, false);
  validateWeights("targetWeights", input.targetWeights, true);
  validateWeights("projectedWeights", input.projectedWeights, false);
  let allocated: DecimalString = "0";
  for (const proposal of input.proposals) {
    if (!proposal.id.trim() || !proposal.companyId.trim() || !proposal.rationale.trim() || !proposal.nextReviewCondition.trim()) {
      throw new Error("allocation items require identity, rationale and next review condition");
    }
    assertDecimal(proposal.requestedAmount, "requestedAmount");
    assertDecimal(proposal.approvedAmount, "approvedAmount");
    if (compareDecimal(proposal.requestedAmount, "0") <= 0) throw new Error("allocation item requestedAmount must be positive");
    if (compareDecimal(proposal.approvedAmount, proposal.requestedAmount) > 0) {
      throw new Error("allocation item cannot approve more than requested");
    }
    if (compareDecimal(proposal.approvedAmount, proposal.requestedAmount) < 0 && !proposal.reductionOrRejectionReason?.trim()) {
      throw new Error("reduced or rejected allocation items require a reason");
    }
    allocated = addDecimal(allocated, proposal.approvedAmount);
  }
  if (compareDecimal(allocated, input.availableAmount) > 0) throw new Error("approved allocations exceed available capital");
  if (input.snapshotIds.length === 0) throw new Error("allocation decision requires point-in-time snapshots");
  return {
    ...structuredClone(input),
    cashRetained: subtractDecimalFloorZero(input.availableAmount, allocated),
  };
}

function validateWeights(name: string, weights: Record<string, number>, exactTotal: boolean): void {
  const values = Object.values(weights);
  if (values.length === 0) throw new Error(`${name} cannot be empty`);
  for (const value of values) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} values must be between 0 and 1`);
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (exactTotal && Math.abs(total - 1) > 0.000_001) throw new Error(`${name} must sum to 1`);
  if (!exactTotal && total > 1.000_001) throw new Error(`${name} cannot exceed 1`);
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}
