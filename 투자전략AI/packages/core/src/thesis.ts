import { assertCurrency, assertDecimal, compareDecimal, type CurrencyCode, type DecimalString } from "./decimal.js";
import type { EvidenceType } from "./evidence.js";
import type { ReturnSource } from "./philosophy-policy.js";

export type ThesisStatus = "STRENGTHENED" | "UNCHANGED" | "WEAKENED" | "BROKEN" | "REPLACED";

export type ThesisAssumption = {
  id: string;
  statement: string;
  evidenceType: Extract<EvidenceType, "FACT" | "INFERENCE" | "HYPOTHESIS">;
  importance: "CRITICAL" | "HIGH" | "MEDIUM";
  currentStatus: "SUPPORTED" | "MIXED" | "UNSUPPORTED";
  observableMetrics: string[];
  nextReviewAt: string;
  evidenceIds: string[];
};

export type ThesisMilestone = {
  id: string;
  statement: string;
  dueAt?: string;
  evidenceIds: string[];
};

export type ThesisBreakCondition = {
  id: string;
  statement: string;
  observableMetrics: string[];
};

export type ValuationRange = {
  currency: CurrencyCode;
  low: DecimalString;
  base: DecimalString;
  high: DecimalString;
  asOf: string;
};

export type LongTermThesis = {
  id: string;
  companyId: string;
  version: string;
  strategy: "CORE" | "FUTURE_CORE";
  status: ThesisStatus;
  summary: string;
  returnSources: ReturnSource[];
  keyAssumptions: ThesisAssumption[];
  milestones: ThesisMilestone[];
  catalysts: string[];
  risks: string[];
  breakConditions: ThesisBreakCondition[];
  valuationRange: ValuationRange;
  expectedHorizon: string;
  reviewSchedule: string[];
  evidenceIds: string[];
  counterEvidenceIds: string[];
  snapshotIds: string[];
  modelVersionId: string;
  dataAsOf: string;
  createdAt: string;
  supersedesThesisId?: string;
  revisionReason?: string;
};

export function validateLongTermThesis(thesis: LongTermThesis): LongTermThesis {
  for (const [name, value] of [
    ["id", thesis.id], ["companyId", thesis.companyId], ["version", thesis.version],
    ["summary", thesis.summary], ["modelVersionId", thesis.modelVersionId], ["expectedHorizon", thesis.expectedHorizon],
  ] as const) {
    if (!value.trim()) throw new Error(`${name} is required`);
  }
  const dataAsOf = parseDate(thesis.dataAsOf, "dataAsOf");
  const createdAt = parseDate(thesis.createdAt, "createdAt");
  if (dataAsOf > createdAt) throw new Error("thesis dataAsOf cannot be after createdAt");
  if (thesis.returnSources.length === 0) throw new Error("thesis requires at least one return source");
  if (thesis.keyAssumptions.length === 0 || thesis.keyAssumptions.length > 7) {
    throw new Error("thesis requires a limited set of 1 to 7 key assumptions");
  }
  if (thesis.breakConditions.length === 0) throw new Error("thesis requires break conditions");
  if (thesis.risks.length === 0) throw new Error("thesis requires risks");
  if (thesis.evidenceIds.length === 0 || thesis.counterEvidenceIds.length === 0) {
    throw new Error("thesis requires supporting and counter evidence");
  }
  if (thesis.snapshotIds.length === 0) throw new Error("thesis requires point-in-time snapshots");
  validateUnique("returnSources", thesis.returnSources);
  validateUnique("evidenceIds", thesis.evidenceIds);
  validateUnique("counterEvidenceIds", thesis.counterEvidenceIds);
  validateUnique("snapshotIds", thesis.snapshotIds);
  for (const assumption of thesis.keyAssumptions) validateAssumption(assumption, createdAt);
  for (const condition of thesis.breakConditions) {
    if (!condition.id.trim() || !condition.statement.trim() || condition.observableMetrics.length === 0) {
      throw new Error("each thesis break condition requires an id, statement and observable metric");
    }
  }
  for (const reviewAt of thesis.reviewSchedule) {
    if (parseDate(reviewAt, "reviewSchedule") < createdAt) throw new Error("review schedule cannot be before thesis creation");
  }
  if (thesis.reviewSchedule.length === 0) throw new Error("thesis requires a review schedule");
  validateValuationRange(thesis.valuationRange, createdAt);
  if (thesis.supersedesThesisId && !thesis.revisionReason?.trim()) {
    throw new Error("thesis revision requires a reason");
  }
  return structuredClone(thesis);
}

export function reviseLongTermThesis(
  original: LongTermThesis,
  input: {
    id: string;
    version: string;
    createdAt: string;
    dataAsOf: string;
    reason: string;
    changes: Partial<Pick<LongTermThesis,
      "status" | "summary" | "returnSources" | "keyAssumptions" | "milestones" | "catalysts" | "risks" |
      "breakConditions" | "valuationRange" | "expectedHorizon" | "reviewSchedule" | "evidenceIds" |
      "counterEvidenceIds" | "snapshotIds" | "modelVersionId">>;
  },
): LongTermThesis {
  validateLongTermThesis(original);
  if (!input.reason.trim()) throw new Error("thesis revision reason is required");
  if (input.id === original.id) throw new Error("thesis revisions require a new id");
  if (input.version === original.version) throw new Error("thesis revisions require a new version");
  const revised: LongTermThesis = {
    ...structuredClone(original),
    ...structuredClone(input.changes),
    id: input.id,
    version: input.version,
    createdAt: input.createdAt,
    dataAsOf: input.dataAsOf,
    supersedesThesisId: original.id,
    revisionReason: input.reason,
  };
  return validateLongTermThesis(revised);
}

function validateValuationRange(range: ValuationRange, createdAt: number): void {
  assertCurrency(range.currency);
  assertDecimal(range.low, "valuationRange.low");
  assertDecimal(range.base, "valuationRange.base");
  assertDecimal(range.high, "valuationRange.high");
  if (parseDate(range.asOf, "valuationRange.asOf") > createdAt) throw new Error("valuation range cannot be newer than thesis creation");
  if (compareDecimal(range.low, range.base) > 0 || compareDecimal(range.base, range.high) > 0) {
    throw new Error("valuation range must satisfy low <= base <= high");
  }
}

function validateAssumption(assumption: ThesisAssumption, createdAt: number): void {
  if (!assumption.id.trim() || !assumption.statement.trim()) throw new Error("thesis assumption id and statement are required");
  if (assumption.observableMetrics.length === 0) throw new Error("thesis assumptions require observable metrics");
  if (assumption.evidenceIds.length === 0) throw new Error("thesis assumptions require evidence");
  if (parseDate(assumption.nextReviewAt, "assumption nextReviewAt") < createdAt) {
    throw new Error("assumption review cannot be before thesis creation");
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
