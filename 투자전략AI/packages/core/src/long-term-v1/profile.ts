import { assertScore } from "../scoring.js";
import type { EvaluationConfidence } from "../evidence.js";
import type {
  ConfidenceInput,
  CoreFactorId,
  FactorInput,
  FactorResult,
  FutureCoreFactorId,
  IndustryProfile,
  LongTermFactorId,
  LongTermProfile,
  ProfileEvaluation,
  ScoreRange,
} from "./types.js";

export const CORE_FACTOR_WEIGHTS: Readonly<Record<CoreFactorId, number>> = {
  CORE_BUSINESS_DURABILITY: 20,
  CORE_MOAT: 15,
  CORE_GROWTH_DURABILITY: 15,
  CORE_MANAGEMENT_CAPITAL: 10,
  CORE_FINANCIAL_FCF: 15,
  CORE_VALUATION: 15,
  CORE_RISK_RESILIENCE: 10,
};

export const FUTURE_CORE_FACTOR_WEIGHTS: Readonly<Record<FutureCoreFactorId, number>> = {
  FC_MARKET_GROWTH: 20,
  FC_PRODUCT_PROOF: 15,
  FC_MOAT_FORMATION: 15,
  FC_UNIT_ECONOMICS: 15,
  FC_MANAGEMENT_EXECUTION: 10,
  FC_SURVIVAL_DILUTION: 15,
  FC_VALUATION_ASYMMETRY: 10,
};

const BLOCKING_AVAILABILITY = new Set(["UNKNOWN", "STALE", "CONFLICTED"]);

export function calculateConfidence(input: ConfidenceInput, context: {
  hasCounterEvidence: boolean;
  hasCriticalUnavailableFactor: boolean;
  industryProfileValidated: boolean;
}): EvaluationConfidence {
  for (const [name, value] of Object.entries({
    evidenceCoverage: input.evidenceCoverage,
    sourceQuality: input.sourceQuality,
    modelFit: input.modelFit,
    disagreement: input.disagreement,
  })) assertScore(name, value);
  if (!Number.isInteger(input.observedQuarters) || input.observedQuarters < 0) {
    throw new RangeError("observedQuarters must be a non-negative integer");
  }

  const unbounded = round2(
    input.evidenceCoverage * 0.35
      + input.sourceQuality * 0.25
      + input.modelFit * 0.25
      + (100 - input.disagreement) * 0.15,
  );
  const caps: number[] = [100];
  if (!context.hasCounterEvidence || context.hasCriticalUnavailableFactor || input.criticalSourceConflict) caps.push(49);
  if (input.companyOnlyMajorFactors || input.observedQuarters < 2 || !context.industryProfileValidated) caps.push(59);
  if (input.conglomerateSegmentsUnresolved) caps.push(64);

  return {
    score: Math.min(unbounded, ...caps),
    evidenceCoverage: input.evidenceCoverage,
    sourceQuality: input.sourceQuality,
    modelFit: input.modelFit,
    disagreement: input.disagreement,
  };
}

export function evaluateProfile(input: {
  profile: LongTermProfile;
  factors: Partial<Record<LongTermFactorId, FactorInput>>;
  industryProfile: IndustryProfile;
  confidence: EvaluationConfidence;
  currentStage: string;
  thesisComplete: boolean;
  thesisBroken: boolean;
  expectedReturnPositive: boolean;
  bearLossTolerable: boolean;
  stressRunwayMonths?: number | undefined;
  observedQuarters: number;
  hardGateFailed: boolean;
}): ProfileEvaluation {
  validateIndustryProfile(input.industryProfile);
  if (!input.industryProfile.supportedProfiles.includes(input.profile)) {
    throw new Error(`industry profile does not support ${input.profile}`);
  }
  const weights = input.profile === "CORE" ? CORE_FACTOR_WEIGHTS : FUTURE_CORE_FACTOR_WEIGHTS;
  const factorResults = Object.entries(weights).map(([factorId, weight]) => evaluateFactor(
    factorId as LongTermFactorId,
    weight,
    input.factors[factorId as LongTermFactorId],
    input.industryProfile,
  ));
  const applicableWeight = factorResults.reduce((sum, factor) => sum + factor.applicableWeight, 0);
  const blocked = factorResults.filter((factor) => factor.status === "BLOCKED");
  if (applicableWeight < input.industryProfile.minimumApplicableWeight) {
    blocked.push({
      factorId: factorResults[0]!.factorId,
      status: "BLOCKED",
      availability: "UNKNOWN",
      weight: 0,
      applicableWeight: 0,
      trend: "UNKNOWN",
      supportingEvidenceIds: [],
      counterEvidenceIds: [],
      warnings: ["MINIMUM_APPLICABLE_WEIGHT_NOT_MET"],
      explanation: "minimum applicable profile weight was not met",
    });
  }

  const score = calculateScoreRange(factorResults, applicableWeight);
  const eligibility = calculateEligibility({ ...input, factorResults, score, blocked: blocked.length > 0 });
  return {
    profile: input.profile,
    scoreStatus: blocked.length > 0 ? "BLOCKED" : "SCORED",
    score,
    factorResults,
    ...eligibility,
    confidence: { ...input.confidence },
    rankingTier: rankProfile(score.point, input.confidence.score, eligibility.eligibility),
  };
}

export function validateIndustryProfile(profile: IndustryProfile): IndustryProfile {
  for (const [name, value] of [["id", profile.id], ["version", profile.version], ["industryCode", profile.industryCode], ["name", profile.name]] as const) {
    if (!value.trim()) throw new Error(`industry profile ${name} is required`);
  }
  if (profile.status !== "ACTIVE") throw new Error("industry profile must be ACTIVE");
  if (profile.supportedProfiles.length === 0) throw new Error("industry profile requires a supported profile");
  if (!Number.isFinite(profile.minimumApplicableWeight) || profile.minimumApplicableWeight <= 0 || profile.minimumApplicableWeight > 100) {
    throw new RangeError("minimumApplicableWeight must be between 0 and 100");
  }
  if (!Number.isFinite(new Date(profile.effectiveFrom).getTime())) throw new Error("industry profile effectiveFrom must be valid");
  const known = new Set<LongTermFactorId>([
    ...Object.keys(CORE_FACTOR_WEIGHTS) as CoreFactorId[],
    ...Object.keys(FUTURE_CORE_FACTOR_WEIGHTS) as FutureCoreFactorId[],
  ]);
  for (const factorId of [...profile.notApplicableFactorIds, ...profile.criticalFactorIds]) {
    if (!known.has(factorId)) throw new Error(`unknown industry factor: ${factorId}`);
  }
  if (profile.criticalFactorIds.some((id) => profile.notApplicableFactorIds.includes(id))) {
    throw new Error("critical factors cannot be NOT_APPLICABLE");
  }
  return structuredClone(profile);
}

function evaluateFactor(
  factorId: LongTermFactorId,
  weight: number,
  factor: FactorInput | undefined,
  industryProfile: IndustryProfile,
): FactorResult {
  const declaredNotApplicable = industryProfile.notApplicableFactorIds.includes(factorId);
  if (!factor) {
    return result(factorId, weight, "UNKNOWN", "BLOCKED", 0, [], [], ["FACTOR_MISSING"], "factor input is missing");
  }
  validateUnique(factor.evidenceIds, `${factorId}.evidenceIds`);
  validateUnique(factor.counterEvidenceIds ?? [], `${factorId}.counterEvidenceIds`);
  if (!factor.explanation.trim()) throw new Error(`${factorId} explanation is required`);

  if (factor.availability === "NOT_APPLICABLE") {
    if (!declaredNotApplicable) throw new Error(`${factorId} is not declared NOT_APPLICABLE by the industry profile`);
    if (factor.score !== undefined) throw new Error(`${factorId} NOT_APPLICABLE cannot have a score`);
    return result(factorId, weight, factor.availability, "NOT_APPLICABLE", 0, factor.evidenceIds, factor.counterEvidenceIds ?? [], factor.warnings ?? [], factor.explanation);
  }
  if (declaredNotApplicable) throw new Error(`${factorId} must be NOT_APPLICABLE for the selected industry profile`);
  if (BLOCKING_AVAILABILITY.has(factor.availability)) {
    if (factor.score !== undefined) throw new Error(`${factorId} ${factor.availability} cannot have a score`);
    return result(factorId, weight, factor.availability, "BLOCKED", weight, factor.evidenceIds, factor.counterEvidenceIds ?? [], factor.warnings ?? [], factor.explanation);
  }
  if (factor.score === undefined) throw new Error(`${factorId} requires a score`);
  assertScore(factorId, factor.score);
  if (factor.bearScore !== undefined) assertScore(`${factorId}.bearScore`, factor.bearScore);
  if (factor.bullScore !== undefined) assertScore(`${factorId}.bullScore`, factor.bullScore);
  if (factor.bearScore !== undefined && factor.bearScore > factor.score) throw new Error(`${factorId} bearScore cannot exceed score`);
  if (factor.bullScore !== undefined && factor.bullScore < factor.score) throw new Error(`${factorId} bullScore cannot be below score`);
  if (factor.evidenceIds.length === 0) throw new Error(`${factorId} requires scoring evidence`);
  return result(factorId, weight, factor.availability, "SCORED", weight, factor.evidenceIds, factor.counterEvidenceIds ?? [], factor.warnings ?? [], factor.explanation, factor.score, factor.trend, factor.bearScore, factor.bullScore);
}

function calculateScoreRange(results: FactorResult[], applicableWeight: number): ScoreRange {
  if (applicableWeight <= 0 || results.some((factor) => factor.status === "BLOCKED")) {
    return { point: 0, low: 0, high: 0, sensitivityDrivers: results.filter((item) => item.status === "BLOCKED").map((item) => item.factorId) };
  }
  const point = round2(results.reduce((sum, factor) => sum + (factor.score ?? 0) * factor.applicableWeight, 0) / applicableWeight);
  const sensitivity = results
    .filter((factor) => factor.status === "SCORED")
    .map((factor) => ({
      id: factor.factorId,
      down: Math.max(0, (factor.score ?? 0) - (factor.bearScore ?? factor.score ?? 0)),
      up: Math.max(0, (factor.bullScore ?? factor.score ?? 0) - (factor.score ?? 0)),
      spread: (factor.bullScore ?? factor.score ?? 0) - (factor.bearScore ?? factor.score ?? 0),
    }))
    .sort((a, b) => b.spread - a.spread || a.id.localeCompare(b.id));
  const weightedDown = round2(sensitivity.reduce((sum, item) => {
    const weight = results.find((factor) => factor.factorId === item.id)?.applicableWeight ?? 0;
    return sum + item.down * weight;
  }, 0) / applicableWeight);
  const weightedUp = round2(sensitivity.reduce((sum, item) => {
    const weight = results.find((factor) => factor.factorId === item.id)?.applicableWeight ?? 0;
    return sum + item.up * weight;
  }, 0) / applicableWeight);
  return {
    point,
    low: round2(Math.max(0, point - weightedDown)),
    high: round2(Math.min(100, point + weightedUp)),
    sensitivityDrivers: sensitivity.slice(0, 3).map((item) => item.id),
  };
}

function calculateEligibility(input: {
  profile: LongTermProfile;
  factorResults: FactorResult[];
  score: ScoreRange;
  confidence: EvaluationConfidence;
  currentStage: string;
  thesisComplete: boolean;
  thesisBroken: boolean;
  expectedReturnPositive: boolean;
  bearLossTolerable: boolean;
  stressRunwayMonths?: number | undefined;
  observedQuarters: number;
  hardGateFailed: boolean;
  blocked: boolean;
}): Pick<ProfileEvaluation, "eligibility" | "eligibilityReasons"> {
  const reasons: string[] = [];
  if (input.hardGateFailed) reasons.push("HARD_GATE_FAILED");
  if (input.blocked) reasons.push("FACTOR_BLOCKED");
  if (!input.thesisComplete) reasons.push("THESIS_INCOMPLETE");
  if (input.thesisBroken) reasons.push("THESIS_BROKEN");
  if (!input.expectedReturnPositive) reasons.push("EXPECTED_RETURN_NOT_POSITIVE");
  if (!input.bearLossTolerable) reasons.push("BEAR_LOSS_NOT_TOLERABLE");

  const factor = (id: LongTermFactorId): number => input.factorResults.find((item) => item.factorId === id)?.score ?? 0;
  if (input.profile === "CORE") {
    const maintaining = input.currentStage === "CORE";
    if (input.score.point < (maintaining ? 70 : 78)) reasons.push("CORE_SCORE_BELOW_GATE");
    if (input.confidence.score < (maintaining ? 65 : 75)) reasons.push("CORE_CONFIDENCE_BELOW_GATE");
    if (factor("CORE_BUSINESS_DURABILITY") < (maintaining ? 65 : 75)) reasons.push("BUSINESS_DURABILITY_BELOW_GATE");
    if (factor("CORE_FINANCIAL_FCF") < (maintaining ? 60 : 70)) reasons.push("FINANCIAL_FCF_BELOW_GATE");
    if (factor("CORE_RISK_RESILIENCE") < (maintaining ? 50 : 60)) reasons.push("RISK_RESILIENCE_BELOW_GATE");
    if (!maintaining && input.observedQuarters < 8) reasons.push("CORE_OBSERVATION_PERIOD_INSUFFICIENT");
  } else {
    if (input.score.point < 75) reasons.push("FUTURE_CORE_SCORE_BELOW_GATE");
    if (input.confidence.score < 65) reasons.push("FUTURE_CORE_CONFIDENCE_BELOW_GATE");
    if (factor("FC_PRODUCT_PROOF") < 65) reasons.push("PRODUCT_PROOF_BELOW_GATE");
    if (factor("FC_SURVIVAL_DILUTION") < 65) reasons.push("SURVIVAL_DILUTION_BELOW_GATE");
    if ((input.stressRunwayMonths ?? 0) < 18) reasons.push("STRESS_RUNWAY_BELOW_18_MONTHS");
    if (input.observedQuarters < 4) reasons.push("FUTURE_CORE_OBSERVATION_PERIOD_INSUFFICIENT");
  }

  if (reasons.length === 0) return { eligibility: "ELIGIBLE", eligibilityReasons: [] };
  const reviewOnly = reasons.every((reason) => reason === "CORE_SCORE_BELOW_GATE" || reason === "CORE_CONFIDENCE_BELOW_GATE");
  return { eligibility: reviewOnly ? "REVIEW_REQUIRED" : "INELIGIBLE", eligibilityReasons: reasons };
}

function rankProfile(score: number, confidence: number, eligibility: ProfileEvaluation["eligibility"]): ProfileEvaluation["rankingTier"] {
  if (eligibility !== "ELIGIBLE") return score >= 60 ? "C" : "D";
  if (score >= 80 && confidence >= 80) return "A";
  if (score >= 70 && confidence >= 65) return "B";
  return "C";
}

function result(
  factorId: LongTermFactorId,
  weight: number,
  availability: FactorResult["availability"],
  status: FactorResult["status"],
  applicableWeight: number,
  supportingEvidenceIds: string[],
  counterEvidenceIds: string[],
  warnings: string[],
  explanation: string,
  score?: number,
  trend: FactorResult["trend"] = "UNKNOWN",
  bearScore?: number,
  bullScore?: number,
): FactorResult {
  return {
    factorId, weight, availability, status, applicableWeight,
    supportingEvidenceIds: [...supportingEvidenceIds], counterEvidenceIds: [...counterEvidenceIds],
    warnings: [...warnings], explanation, ...(score === undefined ? {} : { score }),
    ...(bearScore === undefined ? {} : { bearScore }), ...(bullScore === undefined ? {} : { bullScore }), trend,
  };
}

function validateUnique(values: string[], name: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`);
}

function round2(value: number): number { return Math.round(value * 100) / 100; }
