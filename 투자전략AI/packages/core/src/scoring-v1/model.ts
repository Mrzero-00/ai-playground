import { assertScore } from "../scoring.js";
import { scoringStableHash } from "./hash.js";
import { normalizeScoreV1 } from "./normalization.js";
import type { FactorDefinitionV1, ScoreModelInputV1, ScoreModelV1 } from "./types.js";

export function validateScoreModelV1(input: ScoreModelInputV1): ScoreModelV1 {
  for (const [name, value] of Object.entries({ id: input.id, userId: input.userId, version: input.version, changeReason: input.changeReason })) if (!value.trim()) throw new Error(`Scoring Model ${name} is required`);
  parseDate(input.effectiveFrom, "Scoring Model effectiveFrom");
  if (input.factorDefinitions.length === 0) throw new Error("Scoring Model requires factors");
  if (new Set(input.factorDefinitions.map((factor) => factor.id)).size !== input.factorDefinitions.length) throw new Error("Scoring Model factor ids must be unique");
  const factors = input.factorDefinitions.map(validateFactor).sort((left, right) => left.id.localeCompare(right.id));
  if (factors.reduce((sum, factor) => sum + factor.weightBasisPoints, 0) !== 10_000) throw new Error("Scoring Model weights must sum to 10000 basis points");
  if (!Number.isInteger(input.minimumApplicableWeightBasisPoints) || input.minimumApplicableWeightBasisPoints < 1 || input.minimumApplicableWeightBasisPoints > 10_000) throw new Error("Scoring Model minimum applicable weight is invalid");
  if (new Set(input.thresholds.map((threshold) => threshold.id)).size !== input.thresholds.length) throw new Error("Scoring Model threshold ids must be unique");
  const thresholds = input.thresholds.map((threshold) => {
    if (!threshold.id.trim() || !threshold.purpose.trim()) throw new Error("Scoring Model threshold identity is required");
    assertScore("threshold.minimumScore", threshold.minimumScore);
    assertScore("threshold.minimumConfidence", threshold.minimumConfidence);
    return { id: threshold.id, minimumScore: threshold.minimumScore, minimumConfidence: threshold.minimumConfidence, purpose: threshold.purpose };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const confidenceWeights = input.confidencePolicy.weightsBasisPoints;
  if (Object.values(confidenceWeights).some((weight) => !Number.isInteger(weight) || weight < 0) || Object.values(confidenceWeights).reduce((sum, weight) => sum + weight, 0) !== 10_000) throw new Error("Scoring Confidence weights must sum to 10000 basis points");
  const { high, medium, low } = input.confidencePolicy.grades;
  [high, medium, low].forEach((value) => assertScore("confidence grade", value));
  if (!(high > medium && medium > low)) throw new Error("Scoring Confidence grades must be strictly descending");
  if (["APPROVED", "ACTIVE", "DEPRECATED"].includes(input.status)) {
    if (!input.approvedBy?.trim() || !input.approvedAt) throw new Error("Scoring approved Model requires approver and approvedAt");
    if (parseDate(input.approvedAt, "Scoring Model approvedAt") > parseDate(input.effectiveFrom, "Scoring Model effectiveFrom")) throw new Error("Scoring Model approval must not follow effectiveFrom");
  }
  const withoutHash: Omit<ScoreModelV1, "modelHash"> = {
    id: input.id, userId: input.userId, version: input.version, scope: input.scope, status: input.status,
    factorDefinitions: factors, minimumApplicableWeightBasisPoints: input.minimumApplicableWeightBasisPoints,
    thresholds, confidencePolicy: {
      weightsBasisPoints: {
        EVIDENCE_COVERAGE: confidenceWeights.EVIDENCE_COVERAGE,
        SOURCE_QUALITY: confidenceWeights.SOURCE_QUALITY,
        FRESHNESS: confidenceWeights.FRESHNESS,
        MODEL_FIT: confidenceWeights.MODEL_FIT,
        AGREEMENT: confidenceWeights.AGREEMENT,
      },
      grades: { high, medium, low },
    }, effectiveFrom: input.effectiveFrom,
    ...(input.approvedBy === undefined ? {} : { approvedBy: input.approvedBy }),
    ...(input.approvedAt === undefined ? {} : { approvedAt: input.approvedAt }),
    ...(input.supersedesModelVersionId === undefined ? {} : { supersedesModelVersionId: input.supersedesModelVersionId }),
    changeReason: input.changeReason,
  };
  return { ...withoutHash, modelHash: scoringStableHash(withoutHash) };
}

function validateFactor(factor: FactorDefinitionV1): FactorDefinitionV1 {
  if (!factor.id.trim() || !factor.label.trim()) throw new Error("Scoring Factor identity is required");
  if (!Number.isInteger(factor.weightBasisPoints) || factor.weightBasisPoints <= 0 || factor.weightBasisPoints > 10_000) throw new Error("Scoring Factor weight is invalid");
  if (factor.critical && factor.allowedNotApplicable) throw new Error("Scoring critical Factor cannot allow NOT_APPLICABLE");
  if (!Number.isInteger(factor.evidencePolicy.minimumDistinctSources) || factor.evidencePolicy.minimumDistinctSources < 1) throw new Error("Scoring Factor requires at least one distinct source");
  if (factor.evidencePolicy.pointInTimeRequired !== true) throw new Error("Scoring Factor must require point-in-time evidence");
  if (factor.evidencePolicy.maximumAgeSeconds !== undefined && (!Number.isInteger(factor.evidencePolicy.maximumAgeSeconds) || factor.evidencePolicy.maximumAgeSeconds <= 0)) throw new Error("Scoring maximum evidence age is invalid");
  if (factor.partialScoreCap !== undefined) assertScore("partialScoreCap", factor.partialScoreCap);
  parseDate(factor.effectiveFrom, "Scoring Factor effectiveFrom");
  const probe = factor.normalization.kind === "PRE_NORMALIZED" ? { preNormalizedScore: 50 } : { rawValue: factor.normalization.kind === "TARGET_BAND" ? factor.normalization.idealMin : factor.normalization.kind === "LINEAR" ? factor.normalization.floor : factor.normalization.anchors[0]?.raw ?? 0 };
  normalizeScoreV1({ policy: factor.normalization, direction: factor.direction, ...probe });
  const normalization = factor.normalization.kind === "PRE_NORMALIZED" ? { kind: "PRE_NORMALIZED" as const }
    : factor.normalization.kind === "LINEAR" ? { kind: "LINEAR" as const, floor: factor.normalization.floor, ceiling: factor.normalization.ceiling }
      : factor.normalization.kind === "PIECEWISE" ? { kind: "PIECEWISE" as const, anchors: factor.normalization.anchors.map((anchor) => ({ raw: anchor.raw, score: anchor.score })) }
        : { kind: "TARGET_BAND" as const, lowerBoundary: factor.normalization.lowerBoundary, idealMin: factor.normalization.idealMin, idealMax: factor.normalization.idealMax, upperBoundary: factor.normalization.upperBoundary };
  return {
    id: factor.id, label: factor.label, direction: factor.direction, weightBasisPoints: factor.weightBasisPoints,
    critical: factor.critical, allowedNotApplicable: factor.allowedNotApplicable, normalization,
    evidencePolicy: {
      minimumSourceTier: factor.evidencePolicy.minimumSourceTier,
      minimumDistinctSources: factor.evidencePolicy.minimumDistinctSources,
      counterEvidenceRequired: factor.evidencePolicy.counterEvidenceRequired,
      ...(factor.evidencePolicy.maximumAgeSeconds === undefined ? {} : { maximumAgeSeconds: factor.evidencePolicy.maximumAgeSeconds }),
      pointInTimeRequired: true,
    },
    ...(factor.partialScoreCap === undefined ? {} : { partialScoreCap: factor.partialScoreCap }),
    effectiveFrom: factor.effectiveFrom,
  };
}

function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
