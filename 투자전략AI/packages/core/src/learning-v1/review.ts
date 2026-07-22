import { learningStableHash } from "./hash.js";
import { determineOutcomeMaturityV1, validateReviewManifestV1 } from "./maturity.js";
import { buildOutcomeAttributionV1 } from "./outcome.js";
import { assessLearningProcessV1 } from "./process.js";
import type { DecisionQualityClassificationV1, LearningReviewInputV1, LearningReviewV1 } from "./types.js";

export function createLearningReviewV1(input: LearningReviewInputV1): LearningReviewV1 {
  if (!input.id.trim() || !input.reviewerId.trim() || !input.notes.trim() || !input.codeVersion.trim()) {
    throw new Error("Learning review id, reviewer, notes and codeVersion are required");
  }
  const manifest = validateReviewManifestV1(input.manifest);
  if (input.id === manifest.id) throw new Error("Learning review and manifest ids must differ");
  if (input.outcomeExpectation.reasonCodes.length === 0 || input.outcomeExpectation.evidenceIds.length === 0) {
    throw new Error("Learning outcome expectation requires reasons and evidence");
  }
  if (new Set(input.outcomeExpectation.evidenceIds).size !== input.outcomeExpectation.evidenceIds.length) throw new Error("Outcome expectation evidence ids must be unique");
  const maturity = determineOutcomeMaturityV1(manifest);
  if (input.outcome && input.outcome.reviewManifestId !== manifest.id) throw new Error("Outcome attribution does not match review manifest");
  if ((maturity === "MATURE" || maturity === "CENSORED") && !input.outcome && manifest.reviewType !== "SKIP") {
    throw new Error("Mature non-SKIP review requires outcome attribution");
  }
  const outcome = input.outcome === undefined ? undefined : buildOutcomeAttributionV1(input.outcome);
  const process = assessLearningProcessV1(input.processDimensions);
  const classification = classify(process.goodProcess, input.outcomeExpectation.met, maturity, process.criticalFailureCodes.length > 0);
  const withoutHash: Omit<LearningReviewV1, "resultHash"> = {
    id: input.id,
    userId: manifest.userId,
    manifestId: manifest.id,
    strategy: manifest.strategy,
    reviewType: manifest.reviewType,
    modelVersionId: manifest.modelVersionId,
    policyVersionIds: [...manifest.policyVersionIds].sort(),
    maturity,
    process,
    ...(outcome === undefined ? {} : { outcome }),
    outcomeExpectation: structuredClone(input.outcomeExpectation),
    classification,
    reviewerId: input.reviewerId,
    notes: input.notes,
    reviewedAt: manifest.reviewedAt,
    codeVersion: input.codeVersion,
  };
  return { ...withoutHash, resultHash: learningStableHash(withoutHash) };
}

function classify(goodProcess: boolean, goodOutcome: boolean, maturity: LearningReviewV1["maturity"], criticalFailure: boolean): DecisionQualityClassificationV1 {
  if (maturity === "IMMATURE" || maturity === "PARTIALLY_MATURE") return "IMMATURE_OUTCOME";
  if (criticalFailure) return goodOutcome ? "BAD_PROCESS_GOOD_OUTCOME" : "BAD_PROCESS_BAD_OUTCOME";
  return goodProcess
    ? goodOutcome ? "GOOD_PROCESS_GOOD_OUTCOME" : "GOOD_PROCESS_BAD_OUTCOME"
    : goodOutcome ? "BAD_PROCESS_GOOD_OUTCOME" : "BAD_PROCESS_BAD_OUTCOME";
}
