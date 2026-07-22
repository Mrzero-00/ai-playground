export type EvidenceType =
  | "FACT"
  | "CONSENSUS_ESTIMATE"
  | "MANAGEMENT_GUIDANCE"
  | "MODEL_ESTIMATE"
  | "INFERENCE"
  | "HYPOTHESIS";

export type EvidenceSourceTier = "A" | "B" | "C" | "D" | "E" | "F";

export type EvidenceRecord = {
  id: string;
  type: EvidenceType;
  sourceTier: EvidenceSourceTier;
  sourceId: string;
  statement: string;
  asOf: string;
  collectedAt: string;
  scoreEligible: boolean;
  sourceUrl?: string;
  snapshotId?: string;
};

export type EvaluationConfidence = {
  score: number;
  evidenceCoverage: number;
  sourceQuality: number;
  modelFit: number;
  disagreement: number;
};

export function validateEvidence(record: EvidenceRecord): EvidenceRecord {
  if (!record.id.trim() || !record.sourceId.trim() || !record.statement.trim()) {
    throw new Error("evidence id, sourceId and statement are required");
  }
  const asOf = parseDate(record.asOf, "evidence asOf");
  const collectedAt = parseDate(record.collectedAt, "evidence collectedAt");
  if (asOf > collectedAt) throw new Error("evidence asOf cannot be after collectedAt");
  if (record.scoreEligible && !(record.sourceTier === "A" || record.sourceTier === "B" || record.sourceTier === "C")) {
    throw new Error(`source tier ${record.sourceTier} cannot be used directly for scoring`);
  }
  if (record.sourceTier === "D" && !(record.type === "INFERENCE" || record.type === "HYPOTHESIS")) {
    throw new Error("source tier D must be tagged as INFERENCE or HYPOTHESIS");
  }
  if ((record.sourceTier === "E" || record.sourceTier === "F") && record.type === "FACT") {
    throw new Error(`source tier ${record.sourceTier} cannot establish a FACT`);
  }
  return structuredClone(record);
}

export function validateEvaluationEvidence(input: {
  evidenceIds: string[];
  scoringEvidenceIds: string[];
  evidence: EvidenceRecord[];
}): EvidenceRecord[] {
  if (input.evidenceIds.length === 0) throw new Error("evaluation requires evidence");
  if (new Set(input.evidenceIds).size !== input.evidenceIds.length) throw new Error("evidenceIds must be unique");
  if (new Set(input.scoringEvidenceIds).size !== input.scoringEvidenceIds.length) throw new Error("scoringEvidenceIds must be unique");
  if (new Set(input.evidence.map((record) => record.id)).size !== input.evidence.length) throw new Error("provided evidence records must have unique ids");
  const records = new Map(input.evidence.map((record) => [record.id, validateEvidence(record)]));
  const selected = input.evidenceIds.map((id) => {
    const record = records.get(id);
    if (!record) throw new Error(`evidence ${id} was not provided`);
    return record;
  });
  for (const id of input.scoringEvidenceIds) {
    if (!input.evidenceIds.includes(id)) throw new Error(`scoring evidence ${id} is not linked to the evaluation`);
    const record = records.get(id);
    if (!record?.scoreEligible) throw new Error(`evidence ${id} is not eligible for scoring`);
  }
  return selected.map((record) => structuredClone(record));
}

export function validateEvaluationConfidence(confidence: EvaluationConfidence): EvaluationConfidence {
  for (const [name, value] of Object.entries(confidence)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError(`${name} must be between 0 and 100`);
  }
  return structuredClone(confidence);
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}
