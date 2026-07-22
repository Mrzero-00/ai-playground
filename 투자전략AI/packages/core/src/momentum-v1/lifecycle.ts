import { transitionMomentumSetup, type MomentumSetupState } from "../state-machine.js";

export type MomentumSetupTransitionV1 = {
  id: string;
  setupId: string;
  from: MomentumSetupState;
  to: MomentumSetupState;
  evaluationId: string;
  planId?: string;
  decisionId?: string;
  executionId?: string;
  reasonCode: string;
  evidenceIds: string[];
  modelVersionId: string;
  occurredAt: string;
  actor: { id: string; type: "SYSTEM" | "AI" | "HUMAN" | "SERVICE" };
};

export function validateMomentumSetupTransition(transition: MomentumSetupTransitionV1): MomentumSetupTransitionV1 {
  for (const [name, value] of Object.entries({
    id: transition.id, setupId: transition.setupId, evaluationId: transition.evaluationId,
    reasonCode: transition.reasonCode, modelVersionId: transition.modelVersionId, actorId: transition.actor.id,
  })) if (!value.trim()) throw new Error(`Momentum transition ${name} is required`);
  if (transition.evidenceIds.length === 0) throw new Error("Momentum transition requires evidence");
  if (!Number.isFinite(new Date(transition.occurredAt).getTime())) throw new Error("Momentum transition occurredAt must be valid");
  transitionMomentumSetup(transition.from, transition.to);
  if (transition.to === "PLANNED" && !transition.planId?.trim()) throw new Error("PLANNED transition requires planId");
  if (transition.to === "APPROVED") {
    if (transition.actor.type !== "HUMAN") throw new Error("APPROVED transition requires a human actor");
    if (!transition.planId?.trim() || !transition.decisionId?.trim()) throw new Error("APPROVED transition requires planId and decisionId");
  }
  if ((transition.to === "ENTERED" || transition.to === "CLOSED") && !transition.executionId?.trim()) {
    throw new Error(`${transition.to} transition requires executionId`);
  }
  return structuredClone(transition);
}

export type MomentumTradeReview = {
  id: string;
  setupId: string;
  evaluationId: string;
  planId: string;
  closedAt: string;
  reviewedAt: string;
  realizedRMultiple: number;
  maximumAdverseExcursionR: number;
  maximumFavorableExcursionR: number;
  planFollowed: boolean;
  processGrade: "A" | "B" | "C" | "D" | "F";
  outcome: "WIN" | "LOSS" | "FLAT";
  ruleViolations: string[];
  lessons: string[];
};

export function createMomentumTradeReview(input: MomentumTradeReview): MomentumTradeReview {
  for (const [name, value] of Object.entries({ id: input.id, setupId: input.setupId, evaluationId: input.evaluationId, planId: input.planId })) {
    if (!value.trim()) throw new Error(`Momentum review ${name} is required`);
  }
  const closedAt = parseDate(input.closedAt, "closedAt");
  const reviewedAt = parseDate(input.reviewedAt, "reviewedAt");
  if (reviewedAt < closedAt) throw new Error("review cannot precede position close");
  for (const [name, value] of Object.entries({
    realizedRMultiple: input.realizedRMultiple,
    maximumAdverseExcursionR: input.maximumAdverseExcursionR,
    maximumFavorableExcursionR: input.maximumFavorableExcursionR,
  })) if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  if (input.maximumAdverseExcursionR > 0) throw new Error("maximumAdverseExcursionR must be zero or negative");
  if (input.maximumFavorableExcursionR < 0) throw new Error("maximumFavorableExcursionR must be zero or positive");
  if (!input.planFollowed && input.ruleViolations.length === 0) throw new Error("a plan deviation requires a rule violation");
  const expectedOutcome = input.realizedRMultiple > 0.05 ? "WIN" : input.realizedRMultiple < -0.05 ? "LOSS" : "FLAT";
  if (input.outcome !== expectedOutcome) throw new Error("review outcome conflicts with realized R-multiple");
  return structuredClone(input);
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}
