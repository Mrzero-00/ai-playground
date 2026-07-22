import type { ProcessAssessmentV1, ProcessDimensionResultV1 } from "./types.js";

export function assessLearningProcessV1(dimensions: ProcessDimensionResultV1[]): ProcessAssessmentV1 {
  if (dimensions.length === 0) throw new Error("Learning process assessment requires dimensions");
  if (new Set(dimensions.map((item) => item.dimension)).size !== dimensions.length) throw new Error("Learning process dimensions must be unique");
  let scoreSum = 0;
  let scoreCount = 0;
  const criticalFailureCodes: string[] = [];
  const normalized = dimensions.map((dimension) => {
    if (dimension.reasonCodes.length === 0) throw new Error(`Process dimension ${dimension.dimension} requires reason codes`);
    if (new Set(dimension.reasonCodes).size !== dimension.reasonCodes.length) throw new Error(`Process dimension ${dimension.dimension} reason codes must be unique`);
    if (new Set(dimension.evidenceIds).size !== dimension.evidenceIds.length) throw new Error(`Process dimension ${dimension.dimension} evidence ids must be unique`);
    if (dimension.status !== "NOT_APPLICABLE" && dimension.evidenceIds.length === 0) throw new Error(`Process dimension ${dimension.dimension} requires evidence`);
    if (dimension.score !== undefined && (!Number.isFinite(dimension.score) || dimension.score < 0 || dimension.score > 100)) {
      throw new Error(`Process dimension ${dimension.dimension} score must be between 0 and 100`);
    }
    if (dimension.status === "NOT_APPLICABLE") {
      if (dimension.score !== undefined) throw new Error("NOT_APPLICABLE process dimension cannot have score");
      if (dimension.critical) throw new Error("Critical process dimension cannot be NOT_APPLICABLE");
      return structuredClone(dimension);
    }
    const effectiveScore = dimension.score ?? defaultScore(dimension.status);
    scoreSum += effectiveScore;
    scoreCount++;
    if (dimension.critical && dimension.status !== "PASS") criticalFailureCodes.push(...dimension.reasonCodes);
    return { ...structuredClone(dimension), score: effectiveScore };
  });
  if (scoreCount === 0) throw new Error("Learning process assessment requires an applicable dimension");
  const score = Math.round(scoreSum / scoreCount * 1_000_000) / 1_000_000;
  return {
    goodProcess: criticalFailureCodes.length === 0 && score >= 70,
    score,
    criticalFailureCodes: [...new Set(criticalFailureCodes)].sort(),
    dimensions: normalized.sort((left, right) => left.dimension.localeCompare(right.dimension)),
  };
}

function defaultScore(status: ProcessDimensionResultV1["status"]): number {
  return status === "PASS" ? 100 : status === "PARTIAL" ? 50 : 0;
}
