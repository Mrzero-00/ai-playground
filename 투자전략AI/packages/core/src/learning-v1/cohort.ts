import { learningStableHash } from "./hash.js";
import type { CohortAnalysisInputV1, CohortAnalysisV1, LearningReviewV1 } from "./types.js";

export function analyzeLearningCohortV1(input: CohortAnalysisInputV1): CohortAnalysisV1 {
  if (!input.id.trim()) throw new Error("Learning cohort id is required");
  if (!Number.isFinite(new Date(input.analyzedAt).getTime())) throw new Error("Learning cohort analyzedAt must be valid");
  validatePolicy(input.policy);
  if (input.records.length === 0) throw new Error("Learning cohort requires review records");
  if (new Set(input.records.map((record) => record.review.id)).size !== input.records.length) throw new Error("Learning cohort review ids must be unique");
  const userIds = new Set(input.records.map((record) => record.review.userId));
  if (userIds.size !== 1) throw new Error("Learning cohort Reviews must have one owner");
  const userId = input.records[0]?.review.userId;
  if (!userId) throw new Error("Learning cohort owner is required");
  const periodStart = new Date(input.key.periodStart).getTime();
  const periodEnd = new Date(input.key.periodEnd).getTime();
  const analyzedAt = new Date(input.analyzedAt).getTime();
  if (!Number.isFinite(periodStart) || !Number.isFinite(periodEnd) || periodStart > periodEnd) throw new Error("Learning cohort period is invalid");
  if (periodEnd > analyzedAt) throw new Error("Learning cohort period cannot extend beyond analyzedAt");
  const companyCounts = new Map<string, number>();
  const regimes = new Set<string>();
  let matureCount = 0;
  let censoredCount = 0;
  let goodProcessCount = 0;
  let goodOutcomeCount = 0;
  let evidenceCoverageTotal = 0;
  for (const record of input.records) {
    validateRecord(record.review, record.manifest.id, input);
    const reviewedAt = new Date(record.review.reviewedAt).getTime();
    if (reviewedAt < periodStart || reviewedAt > periodEnd) throw new Error("Learning cohort review is outside period");
    if (!Number.isFinite(record.evidenceCoverage) || record.evidenceCoverage < 0 || record.evidenceCoverage > 1) throw new Error("evidenceCoverage must be between 0 and 1");
    evidenceCoverageTotal += record.evidenceCoverage;
    if (record.review.maturity === "MATURE") matureCount++;
    if (record.review.maturity === "CENSORED") censoredCount++;
    if (record.review.process.goodProcess) goodProcessCount++;
    if (record.review.outcomeExpectation.met) goodOutcomeCount++;
    if (record.manifest.companyId) companyCounts.set(record.manifest.companyId, (companyCounts.get(record.manifest.companyId) ?? 0) + 1);
    if (record.manifest.regime) regimes.add(record.manifest.regime);
  }
  const sampleSize = input.records.length;
  const evidenceCoverage = round(evidenceCoverageTotal / sampleSize);
  const maximumCompanyConcentration = round(Math.max(0, ...companyCounts.values()) / sampleSize);
  const blockerCodes: string[] = [];
  if (sampleSize < input.policy.minimumSampleSize) blockerCodes.push("MINIMUM_SAMPLE_SIZE_NOT_MET");
  if (matureCount / sampleSize < input.policy.minimumMaturityRatio) blockerCodes.push("MINIMUM_MATURITY_RATIO_NOT_MET");
  if (evidenceCoverage < input.policy.minimumEvidenceCoverage) blockerCodes.push("MINIMUM_EVIDENCE_COVERAGE_NOT_MET");
  if (regimes.size < input.policy.minimumRegimeCount) blockerCodes.push("MINIMUM_REGIME_COVERAGE_NOT_MET");
  if (maximumCompanyConcentration > input.policy.maximumCompanyConcentration) blockerCodes.push("COMPANY_CONCENTRATION_EXCEEDED");
  if (censoredCount / sampleSize > input.policy.maximumCensoredRatio) blockerCodes.push("CENSORED_RATIO_EXCEEDED");
  const withoutHash: Omit<CohortAnalysisV1, "resultHash"> = {
    id: input.id,
    userId,
    key: { ...structuredClone(input.key), policyVersionIds: [...input.key.policyVersionIds].sort() },
    reviewIds: input.records.map((record) => record.review.id).sort(),
    sampleSize,
    matureCount,
    censoredCount,
    goodProcessCount,
    goodOutcomeCount,
    evidenceCoverage,
    regimeCount: regimes.size,
    maximumCompanyConcentration,
    eligibleForLesson: blockerCodes.length === 0,
    blockerCodes,
    analyzedAt: input.analyzedAt,
  };
  return { ...withoutHash, resultHash: learningStableHash(withoutHash) };
}

function validateRecord(review: LearningReviewV1, manifestId: string, input: CohortAnalysisInputV1): void {
  if (review.manifestId !== manifestId) throw new Error("Learning cohort Review and Manifest do not match");
  if (review.strategy !== input.key.strategy || review.modelVersionId !== input.key.modelVersionId) throw new Error("Learning cohort Strategy or Model Version conflict");
  const manifest = input.records.find((record) => record.manifest.id === manifestId)?.manifest;
  if (!manifest || review.userId !== manifest.userId) throw new Error("Learning cohort Review and Manifest ownership conflict");
  if (JSON.stringify([...review.policyVersionIds].sort()) !== JSON.stringify([...input.key.policyVersionIds].sort())) throw new Error("Learning cohort Policy Version conflict");
}

function validatePolicy(policy: CohortAnalysisInputV1["policy"]): void {
  if (!Number.isInteger(policy.minimumSampleSize) || policy.minimumSampleSize <= 0) throw new Error("minimumSampleSize must be positive");
  if (!Number.isInteger(policy.minimumRegimeCount) || policy.minimumRegimeCount < 0) throw new Error("minimumRegimeCount must be non-negative");
  for (const [name, value] of Object.entries({
    minimumMaturityRatio: policy.minimumMaturityRatio,
    minimumEvidenceCoverage: policy.minimumEvidenceCoverage,
    maximumCompanyConcentration: policy.maximumCompanyConcentration,
    maximumCensoredRatio: policy.maximumCensoredRatio,
  })) if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`);
}
function round(value: number): number { return Math.round(value * 1_000_000_000) / 1_000_000_000; }
