import { assertScore } from "../scoring.js";
import { scoringStableHash } from "./hash.js";
import { validateScoreModelV1 } from "./model.js";
import { normalizeScoreV1 } from "./normalization.js";
import type { ConfidenceInputV1, ConfidenceResultV1, FactorObservationV1, FactorScoreResultV1, ScorecardInputV1, ScorecardResultV1, ScoringEvidenceV1 } from "./types.js";

const BLOCKING = new Set(["UNKNOWN", "STALE", "CONFLICTED"]);

export function evaluateScorecardV1(input: ScorecardInputV1): ScorecardResultV1 {
  for (const [name, value] of Object.entries({ id: input.id, userId: input.userId, subjectId: input.subjectId, philosophyVersionId: input.philosophyVersionId, codeVersion: input.codeVersion })) if (!value.trim()) throw new Error(`Scoring Scorecard ${name} is required`);
  const model = validateScoreModelV1(stripModelHash(input.model));
  if (model.modelHash !== input.model.modelHash) throw new Error("Scoring Model hash is invalid");
  if (model.userId !== input.userId) throw new Error("Scoring ownership mismatch");
  if (input.mode === "OPERATIONAL" && model.status !== "ACTIVE") throw new Error("Scoring Model is not ACTIVE");
  if (input.mode === "SHADOW" && model.status !== "SHADOW" && model.status !== "ACTIVE") throw new Error("Scoring Model is not eligible for SHADOW");
  const asOf = parseDate(input.asOf, "Scoring Scorecard asOf");
  const evaluatedAt = parseDate(input.evaluatedAt, "Scoring Scorecard evaluatedAt");
  if (asOf > evaluatedAt) throw new Error("Scoring Scorecard asOf cannot be after evaluatedAt");
  validateIds(input.snapshotIds, "Scoring snapshotIds", true);
  validateIds(input.evidenceIds, "Scoring evidenceIds", true);
  const evidence = validateEvidenceManifest(input);
  const confidence = calculateConfidenceV1(input.confidence, model.confidencePolicy);
  if (input.subjectAvailable === false) return unavailable(input, model.version, confidence);
  if (new Set(input.observations.map((observation) => observation.factorId)).size !== input.observations.length) throw new Error("Scoring observations must have unique factor ids");
  const observations = new Map(input.observations.map((observation) => [observation.factorId, observation]));
  for (const observation of input.observations) if (!model.factorDefinitions.some((factor) => factor.id === observation.factorId)) throw new Error(`Scoring unknown Factor observation ${observation.factorId}`);
  const preliminary = model.factorDefinitions.map((factor) => evaluateFactor(factor, observations.get(factor.id), input, evidence));
  const applicableWeight = preliminary.filter((factor) => factor.status === "SCORED").reduce((sum, factor) => sum + factor.originalWeightBasisPoints, 0);
  const blockerCodes = preliminary.flatMap((factor) => factor.status === "BLOCKED" ? factor.warningCodes.map((code) => `${factor.factorId}:${code}`) : []);
  if (applicableWeight < model.minimumApplicableWeightBasisPoints) blockerCodes.push("MINIMUM_APPLICABLE_WEIGHT_NOT_MET");
  const blocked = blockerCodes.length > 0;
  const factorResults = preliminary.map((factor) => {
    if (factor.status !== "SCORED" || blocked) return factor;
    const effectiveWeightBasisPoints = round4(factor.originalWeightBasisPoints * 10_000 / applicableWeight);
    return { ...factor, effectiveWeightBasisPoints, contribution: round4((factor.score ?? 0) * factor.originalWeightBasisPoints / applicableWeight) };
  });
  const score = blocked ? undefined : calculateRange(factorResults);
  const withoutHash: Omit<ScorecardResultV1, "resultHash"> = {
    id: input.id, userId: input.userId, subjectType: input.subjectType, subjectId: input.subjectId,
    scope: model.scope, mode: input.mode, status: blocked ? "BLOCKED" : "SCORED",
    ...(score === undefined ? {} : { score }), confidence, factorResults,
    blockerCodes: [...new Set(blockerCodes)].sort(), modelVersionId: model.version,
    philosophyVersionId: input.philosophyVersionId,
    ...(input.industryProfileVersionId === undefined ? {} : { industryProfileVersionId: input.industryProfileVersionId }),
    ...(input.setupDefinitionVersion === undefined ? {} : { setupDefinitionVersion: input.setupDefinitionVersion }),
    snapshotIds: [...input.snapshotIds].sort(), evidenceIds: [...input.evidenceIds].sort(),
    asOf: input.asOf, evaluatedAt: input.evaluatedAt, codeVersion: input.codeVersion,
  };
  return { ...withoutHash, resultHash: scoringStableHash(withoutHash) };
}

function evaluateFactor(factor: ScorecardInputV1["model"]["factorDefinitions"][number], observation: FactorObservationV1 | undefined, input: ScorecardInputV1, evidence: Map<string, ScoringEvidenceV1>): FactorScoreResultV1 {
  if (!observation) return blockedFactor(factor, "UNKNOWN", ["FACTOR_MISSING"], "factor input is missing");
  if (!observation.explanation.trim()) throw new Error(`Scoring Factor ${factor.id} explanation is required`);
  validateIds(observation.evidenceIds, `Scoring ${factor.id} evidenceIds`, false);
  validateIds(observation.counterEvidenceIds, `Scoring ${factor.id} counterEvidenceIds`, false);
  if (observation.evidenceIds.some((id) => !input.evidenceIds.includes(id)) || observation.counterEvidenceIds.some((id) => !input.evidenceIds.includes(id))) throw new Error(`Scoring Factor ${factor.id} evidence must belong to Scorecard`);
  const observedAt = parseDate(observation.observedAt, `Scoring ${factor.id} observedAt`);
  const availableAt = parseDate(observation.availableAt, `Scoring ${factor.id} availableAt`);
  if (observedAt > availableAt || availableAt > parseDate(input.asOf, "Scoring asOf")) throw new Error(`Scoring Factor ${factor.id} violates point-in-time`);
  if (observation.availability === "NOT_APPLICABLE") {
    if (!factor.allowedNotApplicable || factor.critical) throw new Error(`Scoring Factor ${factor.id} cannot be NOT_APPLICABLE`);
    if ([observation.rawValue, observation.preNormalizedScore, observation.bearScore, observation.bullScore].some((value) => value !== undefined)) throw new Error(`Scoring Factor ${factor.id} NOT_APPLICABLE cannot have values`);
    return baseFactor(factor, observation, "NOT_APPLICABLE", 0, []);
  }
  if (BLOCKING.has(observation.availability)) return blockedFactor(factor, observation.availability, [`FACTOR_${observation.availability}`], observation.explanation, observation);
  const scoringEvidence = observation.evidenceIds.map((id) => evidence.get(id)!);
  const tierLimit = tierRank(factor.evidencePolicy.minimumSourceTier);
  if (scoringEvidence.length === 0
    || scoringEvidence.some((item) => !item.scoreEligible || tierRank(item.sourceTier) > tierLimit)
    || new Set(scoringEvidence.map((item) => item.sourceId)).size < factor.evidencePolicy.minimumDistinctSources) {
    return blockedFactor(factor, observation.availability, ["SCORING_EVIDENCE_INSUFFICIENT"], observation.explanation, observation);
  }
  if (factor.evidencePolicy.maximumAgeSeconds !== undefined && scoringEvidence.some((item) => parseDate(input.asOf, "Scoring asOf") - parseDate(item.availableAt, "Scoring Evidence availableAt") > factor.evidencePolicy.maximumAgeSeconds! * 1000)) {
    return blockedFactor(factor, observation.availability, ["SCORING_EVIDENCE_STALE"], observation.explanation, observation);
  }
  if (factor.evidencePolicy.counterEvidenceRequired && observation.counterEvidenceIds.length === 0) return blockedFactor(factor, observation.availability, ["COUNTER_EVIDENCE_REQUIRED"], observation.explanation, observation);
  const normalized = normalizeScoreV1({
    policy: factor.normalization,
    direction: factor.direction,
    ...(observation.rawValue === undefined ? {} : { rawValue: observation.rawValue }),
    ...(observation.preNormalizedScore === undefined ? {} : { preNormalizedScore: observation.preNormalizedScore }),
  });
  let point = normalized.score;
  const warnings = [...normalized.warningCodes];
  if (observation.availability === "PARTIAL") {
    if (factor.partialScoreCap === undefined) return blockedFactor(factor, observation.availability, ["PARTIAL_NOT_ALLOWED"], observation.explanation, observation);
    point = Math.min(point, factor.partialScoreCap);
    warnings.push("PARTIAL_SCORE_CAPPED");
  }
  const low = observation.bearScore ?? point;
  const high = observation.bullScore ?? point;
  [low, high].forEach((value) => assertScore(`Scoring ${factor.id} range`, value));
  if (low > point || high < point) throw new Error(`Scoring Factor ${factor.id} requires low <= point <= high`);
  return { ...baseFactor(factor, observation, "SCORED", 0, warnings), score: point, low, high };
}

function baseFactor(factor: ScorecardInputV1["model"]["factorDefinitions"][number], observation: FactorObservationV1, status: FactorScoreResultV1["status"], effectiveWeightBasisPoints: number, warningCodes: string[]): FactorScoreResultV1 {
  return { factorId: factor.id, status, availability: observation.availability, direction: factor.direction,
    originalWeightBasisPoints: factor.weightBasisPoints, effectiveWeightBasisPoints,
    evidenceIds: [...observation.evidenceIds].sort(), counterEvidenceIds: [...observation.counterEvidenceIds].sort(),
    warningCodes: [...new Set(warningCodes)].sort(), explanation: observation.explanation };
}

function blockedFactor(factor: ScorecardInputV1["model"]["factorDefinitions"][number], availability: FactorObservationV1["availability"], warnings: string[], explanation: string, observation?: FactorObservationV1): FactorScoreResultV1 {
  return { factorId: factor.id, status: "BLOCKED", availability, direction: factor.direction, originalWeightBasisPoints: factor.weightBasisPoints,
    effectiveWeightBasisPoints: 0, evidenceIds: [...(observation?.evidenceIds ?? [])].sort(), counterEvidenceIds: [...(observation?.counterEvidenceIds ?? [])].sort(),
    warningCodes: [...new Set(warnings)].sort(), explanation };
}

export function calculateConfidenceV1(input: ConfidenceInputV1, policy: ScorecardInputV1["model"]["confidencePolicy"]): ConfidenceResultV1 {
  const dimensions = { evidenceCoverage: input.evidenceCoverage, sourceQuality: input.sourceQuality, freshness: input.freshness, modelFit: input.modelFit, disagreement: input.disagreement };
  Object.entries(dimensions).forEach(([name, value]) => assertScore(`Scoring Confidence ${name}`, value));
  const weights = policy.weightsBasisPoints;
  const base = round2((input.evidenceCoverage * weights.EVIDENCE_COVERAGE + input.sourceQuality * weights.SOURCE_QUALITY + input.freshness * weights.FRESHNESS + input.modelFit * weights.MODEL_FIT + (100 - input.disagreement) * weights.AGREEMENT) / 10_000);
  const caps = input.caps.map((cap) => { if (!cap.code.trim()) throw new Error("Scoring Confidence cap code is required"); assertScore("Scoring Confidence cap", cap.maximum); return { code: cap.code, maximum: cap.maximum }; }).sort((left, right) => left.maximum - right.maximum || left.code.localeCompare(right.code));
  const score = Math.min(base, ...caps.map((cap) => cap.maximum), 100);
  const { high, medium, low } = policy.grades;
  const grade = score >= high ? "HIGH" : score >= medium ? "MEDIUM" : score >= low ? "LOW" : "UNVERIFIED";
  return { score, grade, dimensions, appliedCaps: caps, warningCodes: caps.map((cap) => cap.code) };
}

function calculateRange(factors: FactorScoreResultV1[]): NonNullable<ScorecardResultV1["score"]> {
  const scored = factors.filter((factor) => factor.status === "SCORED");
  const point = round2(scored.reduce((sum, factor) => sum + (factor.contribution ?? 0), 0));
  const low = round2(scored.reduce((sum, factor) => sum + (factor.low ?? factor.score ?? 0) * factor.effectiveWeightBasisPoints / 10_000, 0));
  const high = round2(scored.reduce((sum, factor) => sum + (factor.high ?? factor.score ?? 0) * factor.effectiveWeightBasisPoints / 10_000, 0));
  const sensitivityDriverIds = scored.map((factor) => ({ id: factor.factorId, spreadContribution: ((factor.high ?? 0) - (factor.low ?? 0)) * factor.effectiveWeightBasisPoints / 10_000 })).sort((left, right) => right.spreadContribution - left.spreadContribution || left.id.localeCompare(right.id)).slice(0, 3).map((item) => item.id);
  return { point, low, high, sensitivityDriverIds };
}

function unavailable(input: ScorecardInputV1, modelVersionId: string, confidence: ConfidenceResultV1): ScorecardResultV1 {
  if (!input.unavailableReasonCode?.trim()) throw new Error("Scoring unavailable Scorecard requires reason code");
  const withoutHash: Omit<ScorecardResultV1, "resultHash"> = { id: input.id, userId: input.userId, subjectType: input.subjectType, subjectId: input.subjectId, scope: input.model.scope,
    mode: input.mode, status: "UNAVAILABLE", confidence, factorResults: [], blockerCodes: [input.unavailableReasonCode], modelVersionId,
    philosophyVersionId: input.philosophyVersionId, snapshotIds: [...input.snapshotIds].sort(), evidenceIds: [...input.evidenceIds].sort(), asOf: input.asOf, evaluatedAt: input.evaluatedAt, codeVersion: input.codeVersion,
    ...(input.industryProfileVersionId === undefined ? {} : { industryProfileVersionId: input.industryProfileVersionId }), ...(input.setupDefinitionVersion === undefined ? {} : { setupDefinitionVersion: input.setupDefinitionVersion }) };
  return { ...withoutHash, resultHash: scoringStableHash(withoutHash) };
}

function validateEvidenceManifest(input: ScorecardInputV1): Map<string, ScoringEvidenceV1> {
  if (new Set(input.evidence.map((item) => item.id)).size !== input.evidence.length) throw new Error("Scoring Evidence ids must be unique");
  const records = new Map(input.evidence.map((item) => [item.id, item]));
  const asOf = parseDate(input.asOf, "Scoring Scorecard asOf");
  for (const id of input.evidenceIds) if (!records.has(id)) throw new Error(`Scoring Evidence ${id} was not provided`);
  for (const item of input.evidence) {
    if (!item.id.trim() || !item.sourceId.trim()) throw new Error("Scoring Evidence identity is required");
    if (item.userId !== input.userId) throw new Error("Scoring Evidence ownership mismatch");
    const observedAt = parseDate(item.observedAt, "Scoring Evidence observedAt");
    const availableAt = parseDate(item.availableAt, "Scoring Evidence availableAt");
    if (observedAt > availableAt || availableAt > asOf) throw new Error("Scoring Evidence violates point-in-time");
  }
  return records;
}

function stripModelHash(model: ScorecardInputV1["model"]): Omit<ScorecardInputV1["model"], "modelHash"> { const { modelHash: _modelHash, ...withoutHash } = model; return withoutHash; }
function validateIds(values: string[], name: string, required: boolean): void { if (required && values.length === 0) throw new Error(`${name} is required`); if (values.some((value) => !value.trim()) || new Set(values).size !== values.length) throw new Error(`${name} must contain unique non-blank ids`); }
function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
function round2(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
function round4(value: number): number { return Math.round((value + Number.EPSILON) * 10_000) / 10_000; }
function tierRank(tier: ScoringEvidenceV1["sourceTier"]): number { return ({ A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 })[tier]; }
