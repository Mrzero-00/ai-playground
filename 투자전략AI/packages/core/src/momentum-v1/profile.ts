import { assertScore } from "../scoring.js";
import type { EvaluationConfidence } from "../evidence.js";
import type {
  MomentumConfidenceInput,
  MomentumFactorId,
  MomentumFactorInput,
  MomentumFactorResult,
  MomentumScoreRange,
  MomentumSetupDefinition,
} from "./types.js";

export const MOMENTUM_FACTOR_WEIGHTS: Readonly<Record<MomentumFactorId, number>> = {
  MOM_RELATIVE_STRENGTH: 20,
  MOM_SECTOR_LEADERSHIP: 10,
  MOM_PRICE_STRUCTURE: 20,
  MOM_VOLUME_CONFIRMATION: 15,
  MOM_CATALYST_QUALITY: 15,
  MOM_LIQUIDITY_EXECUTION: 10,
  MOM_REWARD_RISK_TIMING: 10,
};

const BLOCKING_AVAILABILITY = new Set(["UNKNOWN", "STALE", "CONFLICTED"]);

export function evaluateMomentumFactors(input: {
  factors: Partial<Record<MomentumFactorId, MomentumFactorInput>>;
  setupDefinition: MomentumSetupDefinition;
}): { factorResults: MomentumFactorResult[]; score: MomentumScoreRange; blocked: boolean } {
  validateSetupDefinition(input.setupDefinition);
  const factorResults = (Object.entries(MOMENTUM_FACTOR_WEIGHTS) as Array<[MomentumFactorId, number]>).map(
    ([factorId, weight]) => evaluateFactor(factorId, weight, input.factors[factorId], input.setupDefinition),
  );
  const applicableWeight = factorResults.reduce((sum, result) => sum + result.applicableWeight, 0);
  const blocked = factorResults.some((result) => result.status === "BLOCKED") || applicableWeight < 90;
  return { factorResults, score: calculateMomentumScoreRange(factorResults, applicableWeight, blocked), blocked };
}

export function calculateMomentumConfidence(input: MomentumConfidenceInput, regimeKnown: boolean): EvaluationConfidence {
  for (const [name, value] of Object.entries({
    evidenceCoverage: input.evidenceCoverage,
    sourceQuality: input.sourceQuality,
    dataFreshness: input.dataFreshness,
    modelFit: input.modelFit,
    disagreement: input.disagreement,
  })) assertScore(name, value);

  const scoreBeforeCaps = round2(
    input.evidenceCoverage * 0.3
      + input.sourceQuality * 0.2
      + input.dataFreshness * 0.2
      + input.modelFit * 0.2
      + (100 - input.disagreement) * 0.1,
  );
  const caps = [100];
  if (!input.hasCounterEvidence || !regimeKnown || input.criticalBarOrQuoteConflict) caps.push(49);
  if (input.companyOnlyCatalyst || input.listingHistoryInsufficient || input.shadowSetupDefinition) caps.push(59);
  if (input.volumePartial || input.sectorBenchmarkUnfit) caps.push(64);
  return {
    score: Math.min(scoreBeforeCaps, ...caps),
    evidenceCoverage: input.evidenceCoverage,
    sourceQuality: input.sourceQuality,
    modelFit: input.modelFit,
    disagreement: input.disagreement,
  };
}

export function validateSetupDefinition(definition: MomentumSetupDefinition): MomentumSetupDefinition {
  if (!definition.version.trim()) throw new Error("setup definition version is required");
  if (definition.requiredIndicators.length === 0) throw new Error("setup definition requires indicators");
  if (definition.criticalFactorIds.length === 0) throw new Error("setup definition requires critical factors");
  if (definition.defaultHoldingSessions.min <= 0
    || definition.defaultHoldingSessions.max < definition.defaultHoldingSessions.min
    || !Number.isInteger(definition.defaultHoldingSessions.min)
    || !Number.isInteger(definition.defaultHoldingSessions.max)) {
    throw new Error("setup holding session range is invalid");
  }
  if (definition.allowedRegimes.length === 0) throw new Error("setup definition requires an allowed regime");
  if (!definition.eventPolicy.trim()) throw new Error("setup definition event policy is required");
  validateUnique(definition.requiredIndicators, "requiredIndicators");
  validateUnique(definition.criticalFactorIds, "criticalFactorIds");
  validateUnique(definition.allowedNotApplicableFactorIds, "allowedNotApplicableFactorIds");
  if (definition.criticalFactorIds.some((id) => definition.allowedNotApplicableFactorIds.includes(id))) {
    throw new Error("critical Momentum factors cannot be NOT_APPLICABLE");
  }
  return structuredClone(definition);
}

function evaluateFactor(
  factorId: MomentumFactorId,
  weight: number,
  factor: MomentumFactorInput | undefined,
  definition: MomentumSetupDefinition,
): MomentumFactorResult {
  if (!factor) return blockedFactor(factorId, weight, "UNKNOWN", "FACTOR_MISSING", "factor input is missing");
  if (!factor.explanation.trim()) throw new Error(`${factorId} explanation is required`);
  validateUnique(factor.evidenceIds, `${factorId}.evidenceIds`);
  validateUnique(factor.counterEvidenceIds ?? [], `${factorId}.counterEvidenceIds`);

  if (factor.availability === "NOT_APPLICABLE") {
    if (!definition.allowedNotApplicableFactorIds.includes(factorId)) {
      throw new Error(`${factorId} is not declared NOT_APPLICABLE by the setup definition`);
    }
    if (factor.score !== undefined || factor.bearScore !== undefined || factor.bullScore !== undefined) {
      throw new Error(`${factorId} NOT_APPLICABLE cannot have scores`);
    }
    return {
      factorId, status: "NOT_APPLICABLE", availability: factor.availability, weight, applicableWeight: 0,
      supportingEvidenceIds: [...factor.evidenceIds], counterEvidenceIds: [...(factor.counterEvidenceIds ?? [])],
      explanation: factor.explanation, warnings: [...(factor.warnings ?? [])],
    };
  }
  if (definition.allowedNotApplicableFactorIds.includes(factorId)) {
    throw new Error(`${factorId} must be NOT_APPLICABLE for the selected setup definition`);
  }
  if (BLOCKING_AVAILABILITY.has(factor.availability)) {
    if (factor.score !== undefined || factor.bearScore !== undefined || factor.bullScore !== undefined) {
      throw new Error(`${factorId} ${factor.availability} cannot have scores`);
    }
    return blockedFactor(factorId, weight, factor.availability, `FACTOR_${factor.availability}`, factor.explanation, factor);
  }
  if (factor.score === undefined) throw new Error(`${factorId} requires a score`);
  assertScore(factorId, factor.score);
  if (factor.bearScore !== undefined) assertScore(`${factorId}.bearScore`, factor.bearScore);
  if (factor.bullScore !== undefined) assertScore(`${factorId}.bullScore`, factor.bullScore);
  if (factor.bearScore !== undefined && factor.bearScore > factor.score) throw new Error(`${factorId} bearScore cannot exceed score`);
  if (factor.bullScore !== undefined && factor.bullScore < factor.score) throw new Error(`${factorId} bullScore cannot be below score`);
  if (factor.evidenceIds.length === 0) throw new Error(`${factorId} requires scoring evidence`);
  return {
    factorId, status: "SCORED", availability: factor.availability, score: factor.score,
    ...(factor.bearScore === undefined ? {} : { bearScore: factor.bearScore }),
    ...(factor.bullScore === undefined ? {} : { bullScore: factor.bullScore }),
    weight, applicableWeight: weight, supportingEvidenceIds: [...factor.evidenceIds],
    counterEvidenceIds: [...(factor.counterEvidenceIds ?? [])], explanation: factor.explanation,
    warnings: [...(factor.warnings ?? [])],
  };
}

function blockedFactor(
  factorId: MomentumFactorId,
  weight: number,
  availability: MomentumFactorInput["availability"],
  warning: string,
  explanation: string,
  input?: MomentumFactorInput,
): MomentumFactorResult {
  return {
    factorId, status: "BLOCKED", availability, weight, applicableWeight: weight,
    supportingEvidenceIds: [...(input?.evidenceIds ?? [])],
    counterEvidenceIds: [...(input?.counterEvidenceIds ?? [])],
    explanation, warnings: [...(input?.warnings ?? []), warning],
  };
}

function calculateMomentumScoreRange(results: MomentumFactorResult[], applicableWeight: number, blocked: boolean): MomentumScoreRange {
  if (blocked || applicableWeight <= 0) {
    return {
      point: 0, low: 0, high: 0,
      sensitivityDrivers: results.filter((result) => result.status === "BLOCKED").map((result) => result.factorId),
    };
  }
  const point = round2(results.reduce((sum, result) => sum + (result.score ?? 0) * result.applicableWeight, 0) / applicableWeight);
  const contributions = results.filter((result) => result.status === "SCORED").map((result) => ({
    id: result.factorId,
    weight: result.applicableWeight,
    down: Math.max(0, (result.score ?? 0) - (result.bearScore ?? result.score ?? 0)),
    up: Math.max(0, (result.bullScore ?? result.score ?? 0) - (result.score ?? 0)),
    spread: (result.bullScore ?? result.score ?? 0) - (result.bearScore ?? result.score ?? 0),
  })).sort((left, right) => right.spread - left.spread || left.id.localeCompare(right.id));
  const down = contributions.reduce((sum, item) => sum + item.down * item.weight, 0) / applicableWeight;
  const up = contributions.reduce((sum, item) => sum + item.up * item.weight, 0) / applicableWeight;
  return {
    point,
    low: round2(Math.max(0, point - down)),
    high: round2(Math.min(100, point + up)),
    sensitivityDrivers: contributions.slice(0, 3).map((item) => item.id),
  };
}

function validateUnique(values: readonly string[], name: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`);
}

function round2(value: number): number { return Math.round(value * 100) / 100; }
