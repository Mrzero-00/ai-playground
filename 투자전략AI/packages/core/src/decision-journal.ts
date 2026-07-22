import { assertCurrency, assertDecimal, compareDecimal, type CurrencyCode, type DecimalString } from "./decimal.js";
import {
  evaluateBehavioralGate,
  isRiskIncreasingAction,
  type DecisionAction,
  type EmotionalState,
  type InvestmentStrategy,
  type ReturnSource,
} from "./philosophy-policy.js";

export type JournalPositionSize = {
  amount: DecimalString;
  currency: CurrencyCode;
  portfolioWeight: number;
};

export type DecisionJournalEntry = {
  id: string;
  decisionId: string;
  companyId?: string;
  strategy: InvestmentStrategy;
  action: DecisionAction;
  expectedHorizon: string;
  expectedReturnSources: ReturnSource[];
  thesisId?: string;
  momentumSetupId?: string;
  positionSize?: JournalPositionSize;
  assumptions: string[];
  riskSummary: string;
  executionConditions: string[];
  exitConditions: string[];
  emotionalState: EmotionalState;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  snapshotIds: string[];
  modelVersionIds: string[];
  dataAsOf: string;
  recordedAt: string;
  reviewAt: string;
  recordType: "ORIGINAL" | "AMENDMENT";
  originalEntryId?: string;
  supersedesEntryId?: string;
  amendmentReason?: string;
};

export function createDecisionJournalEntry(entry: DecisionJournalEntry): DecisionJournalEntry {
  for (const [name, value] of [
    ["id", entry.id], ["decisionId", entry.decisionId], ["expectedHorizon", entry.expectedHorizon],
    ["riskSummary", entry.riskSummary],
  ] as const) {
    if (!value.trim()) throw new Error(`${name} is required`);
  }
  assertActionMatchesStrategy(entry.strategy, entry.action);
  const recordedAt = parseDate(entry.recordedAt, "recordedAt");
  if (parseDate(entry.dataAsOf, "dataAsOf") > recordedAt) throw new Error("journal dataAsOf cannot be after recordedAt");
  if (parseDate(entry.reviewAt, "reviewAt") < recordedAt) throw new Error("reviewAt cannot be before recordedAt");
  if (isRiskIncreasingAction(entry.action)) {
    if (!entry.companyId?.trim()) throw new Error("risk-increasing decisions require a companyId");
    if (!entry.positionSize) throw new Error("risk-increasing decisions require a position size");
    validatePositionSize(entry.positionSize);
    if (entry.evidenceIds.length === 0 || entry.counterEvidenceIds.length === 0) {
      throw new Error("risk-increasing decisions require supporting and counter evidence");
    }
    if (entry.snapshotIds.length === 0 || entry.modelVersionIds.length === 0) {
      throw new Error("risk-increasing decisions require snapshots and model versions");
    }
    const behavior = evaluateBehavioralGate({
      strategy: entry.strategy,
      action: entry.action,
      emotionalState: entry.emotionalState,
    });
    if (behavior.status === "DENY_NEW_RISK") throw new Error(behavior.reasons[0] ?? "behavioral gate denied new risk");
  }
  if ((entry.strategy === "CORE" || entry.strategy === "FUTURE_CORE") && isRiskIncreasingAction(entry.action) && !entry.thesisId?.trim()) {
    throw new Error("Long-term risk-increasing decisions require a thesisId");
  }
  if (entry.strategy === "MOMENTUM" && entry.action === "ENTER" && !entry.momentumSetupId?.trim()) {
    throw new Error("Momentum ENTER decisions require a momentumSetupId");
  }
  if (entry.recordType === "ORIGINAL" && (entry.originalEntryId || entry.supersedesEntryId || entry.amendmentReason)) {
    throw new Error("original journal entries cannot reference an amendment");
  }
  if (entry.recordType === "AMENDMENT" && (!entry.originalEntryId || !entry.supersedesEntryId || !entry.amendmentReason?.trim())) {
    throw new Error("journal amendments require original, superseded entry and reason");
  }
  validateUnique("evidenceIds", entry.evidenceIds);
  validateUnique("counterEvidenceIds", entry.counterEvidenceIds);
  validateUnique("snapshotIds", entry.snapshotIds);
  validateUnique("modelVersionIds", entry.modelVersionIds);
  return structuredClone(entry);
}

export function amendDecisionJournalEntry(
  previous: DecisionJournalEntry,
  input: {
    id: string;
    recordedAt: string;
    reason: string;
    changes: Partial<Pick<DecisionJournalEntry,
      "action" | "expectedHorizon" | "expectedReturnSources" | "positionSize" | "assumptions" | "riskSummary" |
      "executionConditions" | "exitConditions" | "emotionalState" | "evidenceIds" | "counterEvidenceIds" |
      "snapshotIds" | "modelVersionIds" | "dataAsOf" | "reviewAt">>;
  },
): DecisionJournalEntry {
  createDecisionJournalEntry(previous);
  if (!input.reason.trim()) throw new Error("journal amendment reason is required");
  if (input.id === previous.id) throw new Error("journal amendments require a new id");
  const revised: DecisionJournalEntry = {
    ...structuredClone(previous),
    ...structuredClone(input.changes),
    id: input.id,
    recordedAt: input.recordedAt,
    recordType: "AMENDMENT",
    originalEntryId: previous.originalEntryId ?? previous.id,
    supersedesEntryId: previous.id,
    amendmentReason: input.reason,
  };
  return createDecisionJournalEntry(revised);
}

export type DecisionModificationRequest = {
  id: string;
  originalDecisionId: string;
  requestedAt: string;
  requestedBy: string;
  reason: string;
  requestedStrategy?: InvestmentStrategy;
  requestedAmount?: DecimalString;
  requestedCurrency?: CurrencyCode;
  requestedStop?: DecimalString;
  status: "REQUIRES_NEW_PROPOSAL";
  requiresIndependentEvaluation: boolean;
  requiresPortfolioRevalidation: true;
  requiresRiskRevalidation: true;
};

export function requestDecisionModification(input: Omit<DecisionModificationRequest,
  "status" | "requiresIndependentEvaluation" | "requiresPortfolioRevalidation" | "requiresRiskRevalidation"> & {
    originalStrategy: InvestmentStrategy;
  }): DecisionModificationRequest {
  if (!input.id.trim() || !input.originalDecisionId.trim() || !input.requestedBy.trim() || !input.reason.trim()) {
    throw new Error("modification id, decision, requester and reason are required");
  }
  parseDate(input.requestedAt, "requestedAt");
  if (input.requestedAmount === undefined && input.requestedStop === undefined && input.requestedStrategy === undefined) {
    throw new Error("modification request must change at least one field");
  }
  if (input.requestedAmount !== undefined) {
    assertDecimal(input.requestedAmount, "requestedAmount");
    if (compareDecimal(input.requestedAmount, "0") <= 0 || input.requestedCurrency === undefined) {
      throw new Error("modified amount must be positive and include currency");
    }
    assertCurrency(input.requestedCurrency);
  }
  if (input.requestedAmount === undefined && input.requestedCurrency !== undefined) {
    throw new Error("requestedCurrency cannot be changed without requestedAmount");
  }
  if (input.requestedStop !== undefined) {
    assertDecimal(input.requestedStop, "requestedStop");
    if (compareDecimal(input.requestedStop, "0") <= 0) throw new Error("modified stop must be positive");
  }
  return {
    id: input.id,
    originalDecisionId: input.originalDecisionId,
    requestedAt: input.requestedAt,
    requestedBy: input.requestedBy,
    reason: input.reason,
    ...(input.requestedStrategy === undefined ? {} : { requestedStrategy: input.requestedStrategy }),
    ...(input.requestedAmount === undefined ? {} : { requestedAmount: input.requestedAmount }),
    ...(input.requestedCurrency === undefined ? {} : { requestedCurrency: input.requestedCurrency }),
    ...(input.requestedStop === undefined ? {} : { requestedStop: input.requestedStop }),
    status: "REQUIRES_NEW_PROPOSAL",
    requiresIndependentEvaluation: input.requestedStrategy !== undefined && input.requestedStrategy !== input.originalStrategy,
    requiresPortfolioRevalidation: true,
    requiresRiskRevalidation: true,
  };
}

export type ApprovalType = "APPROVED_AS_PROPOSED" | "APPROVED_WITH_MODIFICATION" | "REJECTED" | "DEFERRED";

export function routeApprovalIntent(input: {
  type: ApprovalType;
  modificationRequestId?: string;
}): "PROCEED_TO_REVALIDATION" | "NEW_PROPOSAL_REQUIRED" | "REJECT" | "KEEP_PENDING_UNTIL_EXPIRY" {
  if (input.type === "APPROVED_AS_PROPOSED") return "PROCEED_TO_REVALIDATION";
  if (input.type === "APPROVED_WITH_MODIFICATION") {
    if (!input.modificationRequestId?.trim()) throw new Error("modified approval requires a modification request");
    return "NEW_PROPOSAL_REQUIRED";
  }
  return input.type === "REJECTED" ? "REJECT" : "KEEP_PENDING_UNTIL_EXPIRY";
}

function assertActionMatchesStrategy(strategy: InvestmentStrategy, action: DecisionAction): void {
  const allowed: Record<InvestmentStrategy, DecisionAction[]> = {
    CORE: ["BUY", "ACCUMULATE", "HOLD", "WAIT", "REDUCE", "EXIT", "SKIP"],
    FUTURE_CORE: ["BUY", "ACCUMULATE", "HOLD", "WAIT", "REDUCE", "EXIT", "SKIP"],
    MOMENTUM: ["ENTER", "HOLD", "WAIT", "REDUCE", "EXIT", "SKIP"],
    CASH: ["CASH", "WAIT"],
  };
  if (!allowed[strategy].includes(action)) throw new Error(`${action} is not valid for ${strategy}`);
}

function validatePositionSize(size: JournalPositionSize): void {
  assertDecimal(size.amount, "positionSize.amount");
  assertCurrency(size.currency);
  if (compareDecimal(size.amount, "0") <= 0) throw new Error("position size amount must be positive");
  if (!Number.isFinite(size.portfolioWeight) || size.portfolioWeight <= 0 || size.portfolioWeight > 1) {
    throw new Error("position size weight must be between 0 and 1");
  }
}

function validateUnique(name: string, values: readonly string[]): void {
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`);
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}
