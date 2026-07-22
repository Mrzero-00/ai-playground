import type { ThesisAssessment, ThesisAssessmentInput, ThesisAssumptionAssessment } from "./types.js";

const STATUS_RANK: Record<ThesisAssumptionAssessment["currentStatus"], number> = {
  NOT_TESTED: 0,
  UNSUPPORTED: 1,
  MIXED: 2,
  SUPPORTED: 3,
};

export function assessLongTermThesis(input: ThesisAssessmentInput): ThesisAssessment {
  validateAssumptions(input.assumptions);
  const strengthened = input.assumptions
    .filter((assumption) => STATUS_RANK[assumption.currentStatus] > STATUS_RANK[assumption.previousStatus])
    .map((assumption) => assumption.id);
  const weakened = input.assumptions
    .filter((assumption) => STATUS_RANK[assumption.currentStatus] < STATUS_RANK[assumption.previousStatus])
    .map((assumption) => assumption.id);

  if (input.replaced) return output(input, "REPLACED", strengthened, weakened, "business changes require a replacement thesis");
  if (input.breakConditionTriggered) return output(input, "BROKEN", strengthened, weakened, "a pre-defined thesis break condition was triggered");
  const criticalUnsupported = input.assumptions.some((assumption) => assumption.importance === "CRITICAL" && assumption.currentStatus === "UNSUPPORTED");
  if (criticalUnsupported || weakened.length > 0) {
    return output(input, "WEAKENED", strengthened, weakened, criticalUnsupported ? "a critical assumption is unsupported" : "one or more material assumptions weakened");
  }
  if (strengthened.length > 0) return output(input, "STRENGTHENED", strengthened, weakened, "new evidence strengthened one or more assumptions");
  return output(input, "UNCHANGED", strengthened, weakened, "no material thesis assumption changed");
}

function validateAssumptions(assumptions: ThesisAssumptionAssessment[]): void {
  if (assumptions.length === 0 || assumptions.length > 7) throw new Error("thesis assessment requires 1 to 7 assumptions");
  if (new Set(assumptions.map((assumption) => assumption.id)).size !== assumptions.length) throw new Error("thesis assumption ids must be unique");
  for (const assumption of assumptions) {
    if (!assumption.id.trim()) throw new Error("thesis assumption id is required");
    if (assumption.evidenceIds.length === 0) throw new Error(`thesis assumption ${assumption.id} requires evidence`);
  }
}

function output(
  input: ThesisAssessmentInput,
  status: ThesisAssessment["status"],
  strengthenedAssumptionIds: string[],
  weakenedAssumptionIds: string[],
  explanation: string,
): ThesisAssessment {
  return {
    ...(input.thesisId ? { thesisId: input.thesisId } : {}),
    status,
    strengthenedAssumptionIds,
    weakenedAssumptionIds,
    breakConditionTriggered: input.breakConditionTriggered ?? false,
    explanation,
  };
}
