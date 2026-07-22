import { assertDecimal, compareDecimal, type DecimalString } from "./decimal.js";

export type LongTermEvaluationRecord = {
  id: string;
  companyId: string;
  evaluatedAt: string;
  modelVersionId: string;
  snapshotIds: string[];
  coreScore?: number;
  futureCoreScore?: number;
  businessQualityScore: number;
  valuationScore: number;
  financialStrengthScore: number;
  growthDurabilityScore: number;
  riskScore: number;
  stage: "UNIVERSE" | "WATCH" | "CANDIDATE" | "STRONG_CANDIDATE" | "FUTURE_CORE" | "CORE" | "REMOVED";
  action: "ACCUMULATE" | "BUY_ON_WEAKNESS" | "HOLD" | "WATCH" | "REDUCE" | "EXIT";
  thesisStatus: "STRENGTHENED" | "UNCHANGED" | "WEAKENED" | "BROKEN";
  thesisSummary: string;
  catalysts: string[];
  risks: string[];
  thesisBreakConditions: string[];
  evidenceIds: string[];
};

export type MomentumEvaluationRecord = {
  id: string;
  companyId: string;
  evaluatedAt: string;
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
};

export function validateMomentumEvaluation(record: MomentumEvaluationRecord): MomentumEvaluationRecord {
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
  if (record.evidenceIds.length === 0) throw new Error("evaluation requires evidence");
  return record;
}
