import { createHash } from "node:crypto";
import { assertScore } from "../scoring.js";
import type { LongTermCandidateState } from "../state-machine.js";
import { calculateConfidence, evaluateProfile, validateIndustryProfile } from "./profile.js";
import { evaluateLongTermGates, proposeLongTermStage, selectLongTermAction } from "./policy.js";
import { assessLongTermThesis } from "./thesis-assessment.js";
import type {
  FactorResult,
  LongTermEvaluationInput,
  LongTermEvaluationResult,
  LongTermFactorId,
  LongTermProfile,
  MaterialChange,
  ProfileEvaluation,
} from "./types.js";
import { validateLongTermValuation } from "./valuation.js";

export function evaluateLongTermV1(input: LongTermEvaluationInput): LongTermEvaluationResult {
  validateHeader(input);
  const industryProfile = validateIndustryProfile(input.industryProfile);
  const valuation = validateLongTermValuation(input.valuation, input.evaluatedAt);
  validateEvidenceLineage(input);
  validateFactorEvidence(input);
  const thesisAssessment = assessLongTermThesis(input.thesis);
  const selectedProfiles = profilesFor(input.profile);
  const hasCriticalUnavailableFactor = industryProfile.criticalFactorIds.some((factorId) => {
    const availability = input.factors[factorId]?.availability;
    return !availability || availability === "UNKNOWN" || availability === "STALE" || availability === "CONFLICTED";
  });
  const confidence = calculateConfidence(input.confidence, {
    hasCounterEvidence: input.counterEvidenceIds.length > 0,
    hasCriticalUnavailableFactor,
    industryProfileValidated: industryProfile.modelFitValidated,
  });
  const pointInTimeValid = isPointInTimeValid(input);
  const evidenceBalanced = input.evidenceIds.length > 0 && input.scoringEvidenceIds.length > 0 && input.counterEvidenceIds.length > 0;
  const thesisComplete = input.gates.thesisComplete && !!input.thesis.thesisId && input.thesis.assumptions.length > 0;
  const gateResults = evaluateLongTermGates({
    gates: input.gates,
    pointInTimeValid,
    evidenceBalanced,
    industryProfileValid: selectedProfiles.every((profile) => industryProfile.supportedProfiles.includes(profile)),
    thesisComplete,
    evidenceIds: input.evidenceIds,
  });
  const hardGateFailed = gateResults.some((gate) => gate.severity === "HARD" && gate.status !== "PASSED" && gate.status !== "NOT_APPLICABLE");

  const profiles: LongTermEvaluationResult["profiles"] = {};
  for (const profile of selectedProfiles) {
    const result = evaluateProfile({
      profile,
      factors: input.factors,
      industryProfile,
      confidence,
      currentStage: input.currentStage,
      thesisComplete,
      thesisBroken: thesisAssessment.status === "BROKEN",
      expectedReturnPositive: valuation.expectedReturnPositive,
      bearLossTolerable: valuation.bearLossTolerable,
      stressRunwayMonths: input.gates.stressRunwayMonths,
      observedQuarters: input.confidence.observedQuarters,
      hardGateFailed,
    });
    if (profile === "CORE") profiles.core = result;
    else profiles.futureCore = result;
  }

  const primaryProfile = selectPrimaryProfile(input.currentStage, profiles);
  const primaryEvaluation = primaryProfile === "CORE" ? profiles.core : primaryProfile === "FUTURE_CORE" ? profiles.futureCore : undefined;
  const stage = proposeLongTermStage({
    current: input.currentStage,
    mode: input.mode,
    thesisStatus: thesisAssessment.status,
    thesisComplete,
    hardGateFailed,
    core: profiles.core,
    futureCore: profiles.futureCore,
    observedQuarters: input.confidence.observedQuarters,
  });
  const action = selectLongTermAction({
    thesisStatus: thesisAssessment.status,
    valuation: valuation.classification,
    gateResults,
    priceConditionDefined: input.gates.priceConditionDefined ?? false,
    confidenceScore: confidence.score,
    profileEligibility: primaryEvaluation?.eligibility ?? "INELIGIBLE",
  });
  const materialChanges = calculateMaterialChanges(input.previousFactorScores, profiles);
  const allFactorResults = [...(profiles.core?.factorResults ?? []), ...(profiles.futureCore?.factorResults ?? [])];
  const permanentImpairmentRisk = calculatePermanentImpairmentRisk(allFactorResults, hardGateFailed);
  const failedGates = gateResults.filter((gate) => gate.status !== "PASSED" && gate.status !== "NOT_APPLICABLE").map((gate) => gate.reasonCode);
  const strengths = allFactorResults.filter((factor) => factor.score !== undefined).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3).map((factor) => `${factor.factorId}:${factor.score}`);
  const risks = [
    ...failedGates,
    ...allFactorResults.filter((factor) => factor.status === "BLOCKED" || (factor.score ?? 100) < 60).map((factor) => factor.factorId),
    ...(input.gates.hardRiskCodes ?? []),
  ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 5);
  const conclusion = buildConclusion(primaryProfile, profiles, thesisAssessment.status, action.action);

  const resultWithoutHash: Omit<LongTermEvaluationResult, "resultHash"> = {
    id: input.id,
    companyId: input.companyId,
    securityId: input.securityId,
    evaluatedAt: input.evaluatedAt,
    dataAsOf: input.dataAsOf,
    marketPriceAsOf: input.marketPriceAsOf,
    mode: input.mode,
    modelVersionId: input.modelVersionId,
    philosophyVersionId: input.philosophyVersionId,
    industryProfileVersionId: industryProfile.version,
    snapshotIds: [...input.snapshotIds],
    profiles,
    primaryProfile,
    stageBefore: input.currentStage,
    proposedStage: stage.proposed,
    stageChangeRequiresHumanApproval: stage.requiresHumanApproval,
    operationalStateChangeAllowed: stage.operationalStateChangeAllowed,
    action: action.action,
    actionConstraints: [...new Set([...action.constraints, ...(stage.requiresHumanApproval ? ["STAGE_CHANGE_HUMAN_APPROVAL_REQUIRED"] : [])])],
    thesisAssessment,
    gateResults,
    valuation,
    confidence,
    permanentImpairmentRisk,
    riskScoreDirection: "HIGHER_IS_RISKIER",
    supportingEvidenceIds: [...input.evidenceIds],
    scoringEvidenceIds: [...input.scoringEvidenceIds],
    counterEvidenceIds: [...input.counterEvidenceIds],
    materialChanges,
    nextReviewAt: input.nextReviewAt,
    reviewTriggers: [...input.reviewTriggers],
    explanation: {
      conclusion,
      strengths,
      risks,
      failedGates,
      nextChecks: [...input.reviewTriggers],
    },
  };
  return { ...resultWithoutHash, resultHash: stableHash(resultWithoutHash) };
}

export function replayLongTermEvaluation(input: LongTermEvaluationInput): LongTermEvaluationResult {
  return evaluateLongTermV1({ ...structuredClone(input), mode: "HISTORICAL_REPLAY" });
}

function validateHeader(input: LongTermEvaluationInput): void {
  for (const [name, value] of [
    ["id", input.id], ["companyId", input.companyId], ["securityId", input.securityId],
    ["modelVersionId", input.modelVersionId], ["philosophyVersionId", input.philosophyVersionId],
  ] as const) if (!value.trim()) throw new Error(`${name} is required`);
  const evaluatedAt = parseDate(input.evaluatedAt, "evaluatedAt");
  if (parseDate(input.dataAsOf, "dataAsOf") > evaluatedAt || parseDate(input.marketPriceAsOf, "marketPriceAsOf") > evaluatedAt) {
    throw new Error("evaluation inputs cannot be newer than evaluatedAt");
  }
  if (parseDate(input.nextReviewAt, "nextReviewAt") < evaluatedAt) throw new Error("nextReviewAt cannot be before evaluatedAt");
  if (parseDate(input.industryProfile.effectiveFrom, "industryProfile.effectiveFrom") > evaluatedAt) {
    throw new Error("industry profile cannot be effective after evaluatedAt");
  }
  if (input.snapshotIds.length === 0) throw new Error("long-term evaluation requires snapshots");
  if (input.reviewTriggers.length === 0) throw new Error("long-term evaluation requires review triggers");
  validateUnique(input.snapshotIds, "snapshotIds");
  validateUnique(input.reviewTriggers, "reviewTriggers");
}

function validateEvidenceLineage(input: LongTermEvaluationInput): void {
  validateUnique(input.evidenceIds, "evidenceIds");
  validateUnique(input.scoringEvidenceIds, "scoringEvidenceIds");
  validateUnique(input.counterEvidenceIds, "counterEvidenceIds");
  if (input.evidenceIds.length === 0 || input.scoringEvidenceIds.length === 0 || input.counterEvidenceIds.length === 0) {
    throw new Error("long-term evaluation requires supporting, scoring and counter evidence");
  }
  for (const id of [...input.scoringEvidenceIds, ...input.counterEvidenceIds]) {
    if (!input.evidenceIds.includes(id)) throw new Error(`evidence ${id} is not linked to the evaluation`);
  }
  for (const scenario of input.valuation.scenarios) {
    for (const id of scenario.evidenceIds) {
      if (!input.evidenceIds.includes(id)) throw new Error(`valuation evidence ${id} is not linked to the evaluation`);
    }
  }
}

function validateFactorEvidence(input: LongTermEvaluationInput): void {
  for (const [factorId, factor] of Object.entries(input.factors)) {
    if (!factor) continue;
    for (const evidenceId of factor.evidenceIds) {
      if (!input.scoringEvidenceIds.includes(evidenceId)) throw new Error(`${factorId} evidence ${evidenceId} is not score eligible`);
    }
    for (const evidenceId of factor.counterEvidenceIds ?? []) {
      if (!input.counterEvidenceIds.includes(evidenceId)) throw new Error(`${factorId} counter evidence ${evidenceId} is not linked`);
    }
  }
  for (const score of Object.values(input.previousFactorScores ?? {})) if (score !== undefined) assertScore("previousFactorScore", score);
}

function profilesFor(selection: LongTermEvaluationInput["profile"]): LongTermProfile[] {
  return selection === "BOTH" ? ["CORE", "FUTURE_CORE"] : [selection];
}

function selectPrimaryProfile(stage: LongTermCandidateState, profiles: LongTermEvaluationResult["profiles"]): LongTermProfile | "NONE" {
  if (stage === "CORE" && profiles.core) return "CORE";
  if (["FUTURE_CORE", "STRONG_CANDIDATE", "CANDIDATE", "WATCH", "UNIVERSE"].includes(stage) && profiles.futureCore) return "FUTURE_CORE";
  if (profiles.core?.eligibility === "ELIGIBLE") return "CORE";
  if (profiles.futureCore?.eligibility === "ELIGIBLE") return "FUTURE_CORE";
  return profiles.core ? "CORE" : profiles.futureCore ? "FUTURE_CORE" : "NONE";
}

function calculateMaterialChanges(previous: LongTermEvaluationInput["previousFactorScores"], profiles: LongTermEvaluationResult["profiles"]): MaterialChange[] {
  if (!previous) return [];
  return [...(profiles.core?.factorResults ?? []), ...(profiles.futureCore?.factorResults ?? [])]
    .filter((factor): factor is FactorResult & { score: number } => factor.score !== undefined && previous[factor.factorId] !== undefined)
    .map((factor) => ({
      factorId: factor.factorId,
      previousScore: previous[factor.factorId]!,
      currentScore: factor.score,
      delta: round2(factor.score - previous[factor.factorId]!),
    }))
    .filter((change) => Math.abs(change.delta) >= 5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function calculatePermanentImpairmentRisk(factors: FactorResult[], hardGateFailed: boolean): number {
  if (hardGateFailed) return 100;
  const resilience = factors.filter((factor) => factor.factorId === "CORE_RISK_RESILIENCE" || factor.factorId === "FC_SURVIVAL_DILUTION").map((factor) => factor.score).filter((score): score is number => score !== undefined);
  if (resilience.length === 0) return 100;
  return round2(100 - resilience.reduce((sum, score) => sum + score, 0) / resilience.length);
}

function buildConclusion(primary: LongTermProfile | "NONE", profiles: LongTermEvaluationResult["profiles"], thesisStatus: string, action: string): string {
  const profile = primary === "CORE" ? profiles.core : primary === "FUTURE_CORE" ? profiles.futureCore : undefined;
  return `${primary} profile score ${profile?.score.point ?? "N/A"}, confidence ${profile?.confidence.score ?? "N/A"}, thesis ${thesisStatus}; candidate action is ${action}.`;
}

function isPointInTimeValid(input: LongTermEvaluationInput): boolean {
  const evaluatedAt = parseDate(input.evaluatedAt, "evaluatedAt");
  return parseDate(input.dataAsOf, "dataAsOf") <= evaluatedAt
    && parseDate(input.marketPriceAsOf, "marketPriceAsOf") <= evaluatedAt
    && parseDate(input.valuation.marketPriceAsOf, "valuation.marketPriceAsOf") <= evaluatedAt;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateUnique(values: string[], name: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`);
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}

function round2(value: number): number { return Math.round(value * 100) / 100; }
