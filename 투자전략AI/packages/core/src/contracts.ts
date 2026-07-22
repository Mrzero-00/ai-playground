import { assertDecimal, compareDecimal, type DecimalString } from "./decimal.js";
import { validateEvaluationConfidence, type EvaluationConfidence } from "./evidence.js";

export type LongTermEvaluationRecord = {
  id: string;
  companyId: string;
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  modelVersionId: string;
  snapshotIds: string[];
  coreScore?: number;
  futureCoreScore?: number;
  businessQualityScore: number;
  valuationScore: number;
  financialStrengthScore: number;
  growthDurabilityScore: number;
  riskScore: number;
  stage: "UNIVERSE" | "WATCH" | "CANDIDATE" | "STRONG_CANDIDATE" | "FUTURE_CORE" | "CORE" | "WEAKENED" | "REMOVED" | "ARCHIVED";
  action: "ACCUMULATE" | "BUY_ON_WEAKNESS" | "HOLD" | "WATCH" | "REDUCE" | "EXIT";
  thesisStatus: "STRENGTHENED" | "UNCHANGED" | "WEAKENED" | "BROKEN" | "REPLACED";
  thesisSummary: string;
  catalysts: string[];
  risks: string[];
  thesisBreakConditions: string[];
  evidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  confidence: EvaluationConfidence;
};

export type MomentumEvaluationRecord = {
  id: string;
  companyId: string;
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  modelVersionId: string;
  snapshotIds: string[];
  momentumScore: number;
  relativeStrengthScore: number;
  volumeScore: number;
  catalystScore: number;
  liquidityScore: number;
  setupQualityScore: number;
  riskScore: number;
  setupType: "BREAKOUT" | "PULLBACK" | "GAP_CONTINUATION" | "EARNINGS_MOMENTUM" | "SECTOR_ROTATION" | "SPECIAL_SITUATION";
  action: "ENTER" | "WAIT" | "AVOID" | "EXIT";
  entryZone?: { min: DecimalString; max: DecimalString };
  stopLoss?: DecimalString;
  target1?: DecimalString;
  target2?: DecimalString;
  maxHoldingDays?: number;
  invalidationConditions: string[];
  catalystSummary: string;
  evidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  confidence: EvaluationConfidence;
};

export function validateLongTermEvaluation(record: LongTermEvaluationRecord): LongTermEvaluationRecord {
  validateEvaluationLineage(record);
  if (!record.thesisSummary.trim() || record.thesisBreakConditions.length === 0) {
    throw new Error("Long-term evaluation requires a thesis and break conditions");
  }
  return structuredClone(record);
}

export function validateMomentumEvaluation(record: MomentumEvaluationRecord): MomentumEvaluationRecord {
  validateEvaluationLineage(record);
  if (record.action === "ENTER") {
    if (!record.entryZone) throw new Error("ENTER requires a valid entry zone");
    assertDecimal(record.entryZone.min, "entryZone.min");
    assertDecimal(record.entryZone.max, "entryZone.max");
    if (compareDecimal(record.entryZone.min, "0") <= 0 || compareDecimal(record.entryZone.max, record.entryZone.min) < 0) throw new Error("ENTER requires a valid entry zone");
    if (!record.stopLoss) throw new Error("ENTER requires stop loss below entry zone");
    assertDecimal(record.stopLoss, "stopLoss");
    if (compareDecimal(record.stopLoss, record.entryZone.min) >= 0) throw new Error("ENTER requires stop loss below entry zone");
    if (!record.maxHoldingDays || record.maxHoldingDays <= 0) throw new Error("ENTER requires max holding days");
  }
  return structuredClone(record);
}

function validateEvaluationLineage(record: {
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  modelVersionId: string;
  snapshotIds: string[];
  evidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  confidence: EvaluationConfidence;
}): void {
  const evaluatedAt = parseDate(record.evaluatedAt, "evaluatedAt");
  if (parseDate(record.dataAsOf, "dataAsOf") > evaluatedAt || parseDate(record.marketPriceAsOf, "marketPriceAsOf") > evaluatedAt) {
    throw new Error("evaluation inputs cannot be newer than evaluatedAt");
  }
  if (!record.modelVersionId.trim()) throw new Error("evaluation requires a model version");
  if (record.snapshotIds.length === 0) throw new Error("evaluation requires point-in-time snapshots");
  if (record.evidenceIds.length === 0 || record.scoringEvidenceIds.length === 0 || record.counterEvidenceIds.length === 0) {
    throw new Error("evaluation requires scoring, supporting and counter evidence");
  }
  if (record.scoringEvidenceIds.some((id) => !record.evidenceIds.includes(id))) {
    throw new Error("scoring evidence must be linked to the evaluation");
  }
  validateEvaluationConfidence(record.confidence);
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}
