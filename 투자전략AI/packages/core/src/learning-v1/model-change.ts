import { learningStableHash } from "./hash.js";
import type {
  ModelChangeProposalInputV1,
  ModelChangeProposalV1,
  ModelChangeTransitionInputV1,
  ModelValidationInputV1,
  ModelValidationResultV1,
  ValidationStageResultV1,
} from "./types.js";

export function createModelChangeProposalV1(input: ModelChangeProposalInputV1): ModelChangeProposalV1 {
  for (const [name, value] of Object.entries({
    id: input.id, userId: input.userId, championModelVersionId: input.championModelVersionId,
    challengerModelVersionId: input.challengerModelVersionId, problem: input.problem,
    hypothesis: input.hypothesis, proposedChange: input.proposedChange, expectedBenefit: input.expectedBenefit,
    rollbackPlan: input.rollbackPlan, primaryMetric: input.primaryMetric,
  })) if (!value.trim()) throw new Error(`Model change ${name} is required`);
  if (!Number.isFinite(new Date(input.createdAt).getTime())) throw new Error("Model change createdAt must be valid");
  if (input.championModelVersionId === input.challengerModelVersionId) throw new Error("Champion and Challenger Model Versions must differ");
  validateUnique(input.lessonIds, "lessonIds", true);
  validateUnique(input.possibleSideEffects, "possibleSideEffects", true);
  validateUnique(input.guardrailMetrics, "guardrailMetrics", true);
  const withoutHash: Omit<ModelChangeProposalV1, "resultHash"> = {
    ...structuredClone(input),
    lessonIds: [...input.lessonIds].sort(),
    guardrailMetrics: [...input.guardrailMetrics].sort(),
    status: "HYPOTHESIS",
    requiresHistoricalReplay: true,
    requiresWalkForward: true,
    requiresShadowMode: true,
    requiresHumanApproval: true,
  };
  return { ...withoutHash, resultHash: learningStableHash(withoutHash) };
}

export function evaluateModelValidationV1(input: ModelValidationInputV1): ModelValidationResultV1 {
  if (!input.id.trim() || !input.codeVersion.trim()) throw new Error("Model validation id and codeVersion are required");
  if (!Number.isFinite(new Date(input.evaluatedAt).getTime())) throw new Error("Model validation evaluatedAt must be valid");
  if (!Number.isInteger(input.minimumSampleSize) || input.minimumSampleSize <= 0) throw new Error("minimumSampleSize must be positive");
  const requiredStages: ValidationStageResultV1["stage"][] = ["HISTORICAL_REPLAY", "WALK_FORWARD", "SHADOW"];
  if (input.stages.length !== requiredStages.length || new Set(input.stages.map((stage) => stage.stage)).size !== requiredStages.length) {
    throw new Error("Model validation requires one Historical Replay, Walk-forward and Shadow stage");
  }
  const blockerCodes: string[] = [];
  let warning = false;
  for (const stage of input.stages) {
    validateStage(stage, input.proposal);
    if (!stage.pointInTimeValid) blockerCodes.push(`POINT_IN_TIME_INVALID:${stage.stage}`);
    if (stage.sampleSize < input.minimumSampleSize) blockerCodes.push(`INSUFFICIENT_SAMPLE:${stage.stage}`);
    if (!improved(stage, input.proposal.primaryMetricDirection)) blockerCodes.push(`PRIMARY_METRIC_NOT_IMPROVED:${stage.stage}`);
    for (const [metric, status] of Object.entries(stage.guardrails)) {
      if (status === "FAIL") blockerCodes.push(`GUARDRAIL_FAILED:${stage.stage}:${metric}`);
      if (status === "UNKNOWN") blockerCodes.push(`GUARDRAIL_UNKNOWN:${stage.stage}:${metric}`);
      if (status === "WARN") warning = true;
    }
  }
  const pointInTimeBlocked = blockerCodes.some((code) => code.startsWith("POINT_IN_TIME_INVALID") || code.startsWith("GUARDRAIL_UNKNOWN"));
  const insufficient = blockerCodes.length > 0 && blockerCodes.every((code) => code.startsWith("INSUFFICIENT_SAMPLE"));
  const verdict: ModelValidationResultV1["verdict"] = blockerCodes.length === 0
    ? warning ? "PASS_WITH_GUARDRAILS" : "PASS"
    : pointInTimeBlocked ? "BLOCKED" : insufficient ? "INSUFFICIENT_EVIDENCE" : "FAIL";
  const normalizedStages = [...input.stages].sort((left, right) => requiredStages.indexOf(left.stage) - requiredStages.indexOf(right.stage));
  const withoutHash: Omit<ModelValidationResultV1, "resultHash"> = {
    id: input.id,
    userId: input.proposal.userId,
    proposalId: input.proposal.id,
    evaluatedAt: input.evaluatedAt,
    codeVersion: input.codeVersion,
    stages: structuredClone(normalizedStages),
    verdict,
    blockerCodes: [...new Set(blockerCodes)].sort(),
  };
  return { ...withoutHash, resultHash: learningStableHash(withoutHash) };
}

export function transitionModelChangeProposalV1(input: ModelChangeTransitionInputV1): ModelChangeProposalV1 {
  if (!input.id.trim() || input.id === input.previous.id) throw new Error("Model change transition requires a new immutable id");
  if (!Number.isFinite(new Date(input.transitionedAt).getTime()) || new Date(input.transitionedAt).getTime() < new Date(input.previous.createdAt).getTime()) {
    throw new Error("Model change transition time must be valid and monotonic");
  }
  const allowed = allowedTransitions[input.previous.status];
  if (!allowed.includes(input.nextStatus)) throw new Error(`Invalid Model change transition ${input.previous.status} -> ${input.nextStatus}`);
  if (input.nextStatus === "READY_FOR_APPROVAL") {
    if (!input.validationResult || input.validationResult.proposalId !== input.previous.id) throw new Error("READY_FOR_APPROVAL requires matching validation result");
    if (input.validationResult.verdict !== "PASS" && input.validationResult.verdict !== "PASS_WITH_GUARDRAILS") throw new Error("Failed validation cannot become approval-ready");
  }
  if (input.nextStatus === "REJECTED" && input.previous.status === "VALIDATING" && !input.validationResult) throw new Error("Validation rejection requires result");
  if (input.nextStatus === "APPROVED" && !input.approvedBy?.trim()) throw new Error("Model change approval requires human approver");
  const withoutHash: Omit<ModelChangeProposalV1, "resultHash"> = {
    ...structuredClone(input.previous),
    id: input.id,
    status: input.nextStatus,
    createdAt: input.transitionedAt,
    supersedesProposalId: input.previous.id,
    ...(input.validationResult === undefined ? {} : { validationResultId: input.validationResult.id }),
    ...(input.nextStatus === "APPROVED" ? { approvedBy: input.approvedBy!, approvedAt: input.transitionedAt } : {}),
  };
  return { ...withoutHash, resultHash: learningStableHash(withoutHash) };
}

const allowedTransitions: Record<ModelChangeProposalV1["status"], Array<ModelChangeTransitionInputV1["nextStatus"]>> = {
  HYPOTHESIS: ["VALIDATING", "REJECTED"],
  VALIDATING: ["READY_FOR_APPROVAL", "REJECTED"],
  READY_FOR_APPROVAL: ["APPROVED", "REJECTED"],
  REJECTED: [],
  APPROVED: [],
  ACTIVATED: [],
  ROLLED_BACK: [],
};

function validateStage(stage: ValidationStageResultV1, proposal: ModelChangeProposalV1): void {
  if (!stage.datasetManifestId.trim() || !stage.resultHash.match(/^[0-9a-f]{64}$/)) throw new Error("Validation stage requires Dataset Manifest and Result Hash");
  if (!Number.isFinite(stage.championMetric) || !Number.isFinite(stage.challengerMetric)) throw new Error("Validation stage metrics must be finite");
  if (!Number.isInteger(stage.sampleSize) || stage.sampleSize <= 0) throw new Error("Validation stage sampleSize must be positive");
  if (stage.operationalStateChangeAllowed !== false) throw new Error("Validation stage cannot change operational state");
  for (const metric of proposal.guardrailMetrics) if (!(metric in stage.guardrails)) throw new Error(`Validation stage missing guardrail ${metric}`);
}
function improved(stage: ValidationStageResultV1, direction: ModelChangeProposalV1["primaryMetricDirection"]): boolean {
  return direction === "HIGHER_IS_BETTER" ? stage.challengerMetric > stage.championMetric : stage.challengerMetric < stage.championMetric;
}
function validateUnique(values: string[], name: string, required: boolean): void {
  if (required && values.length === 0) throw new Error(`${name} is required`);
  if (values.some((value) => !value.trim())) throw new Error(`${name} cannot contain blank values`);
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`);
}
