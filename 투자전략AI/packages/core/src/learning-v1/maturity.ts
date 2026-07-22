import type { OutcomeMaturityV1, ReviewManifestV1 } from "./types.js";

export function validateReviewManifestV1(manifest: ReviewManifestV1): ReviewManifestV1 {
  for (const [name, value] of Object.entries({
    id: manifest.id, userId: manifest.userId, modelVersionId: manifest.modelVersionId,
  })) if (!value.trim()) throw new Error(`Learning review manifest ${name} is required`);
  validateUnique(manifest.executionIds, "executionIds");
  validateUnique(manifest.lotIds, "lotIds");
  validateUnique(manifest.policyVersionIds, "policyVersionIds");
  validateUnique(manifest.decisionSnapshotIds, "decisionSnapshotIds");
  validateUnique(manifest.outcomeSnapshotIds, "outcomeSnapshotIds");
  validateUnique(manifest.decisionEvidenceIds, "decisionEvidenceIds");
  validateUnique(manifest.outcomeEvidenceIds, "outcomeEvidenceIds");
  validateUnique(manifest.counterfactualEvidenceIds, "counterfactualEvidenceIds");
  if (manifest.policyVersionIds.length === 0 || manifest.decisionSnapshotIds.length === 0 || manifest.outcomeSnapshotIds.length === 0) {
    throw new Error("Learning review manifest requires Policy and decision/outcome snapshots");
  }
  if (manifest.reviewType !== "SKIP" && !manifest.decisionId) throw new Error("Non-SKIP review requires decisionId");
  if (manifest.reviewType === "TRADE" && (manifest.executionIds.length === 0 || manifest.lotIds.length === 0)) {
    throw new Error("Trade review requires execution and Lot lineage");
  }
  const decisionAt = parseDate(manifest.decisionAt, "decisionAt");
  const outcomeAsOf = parseDate(manifest.outcomeAsOf, "outcomeAsOf");
  const reviewedAt = parseDate(manifest.reviewedAt, "reviewedAt");
  parseDate(manifest.minimumMaturityAt, "minimumMaturityAt");
  if (decisionAt > outcomeAsOf || outcomeAsOf > reviewedAt) throw new Error("Learning timeline must satisfy decisionAt <= outcomeAsOf <= reviewedAt");
  if (manifest.positionClosedAt !== undefined) {
    const closedAt = parseDate(manifest.positionClosedAt, "positionClosedAt");
    if (closedAt < decisionAt || closedAt > outcomeAsOf) throw new Error("positionClosedAt is outside the review timeline");
  }
  if (manifest.censoredReason !== undefined && !manifest.censoredReason.trim()) throw new Error("censoredReason cannot be blank");
  return structuredClone(manifest);
}

export function determineOutcomeMaturityV1(manifest: ReviewManifestV1): OutcomeMaturityV1 {
  validateReviewManifestV1(manifest);
  if (manifest.censoredReason) return "CENSORED";
  const matureAt = parseDate(manifest.minimumMaturityAt, "minimumMaturityAt");
  const outcomeAsOf = parseDate(manifest.outcomeAsOf, "outcomeAsOf");
  if (manifest.strategy === "MOMENTUM" && manifest.reviewType === "TRADE" && manifest.positionClosedAt) return "MATURE";
  if (outcomeAsOf >= matureAt) return "MATURE";
  if (manifest.outcomeSnapshotIds.length > 0 && outcomeAsOf > parseDate(manifest.decisionAt, "decisionAt")) return "PARTIALLY_MATURE";
  return "IMMATURE";
}

function validateUnique(values: string[], name: string): void {
  if (values.some((value) => !value.trim())) throw new Error(`${name} cannot contain blank ids`);
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`);
}
function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
