import { assertCurrency, assertSignedDecimal, compareSignedDecimal, type CurrencyCode, type SignedDecimalString } from "./decimal.js";
import type { EmotionalState } from "./philosophy-policy.js";

export type Strategy = "long-term" | "momentum";

export type InvestmentDecision = {
  id: string;
  symbol: string;
  strategy: Strategy;
  score: number;
  rationale: string;
  modelVersionId: string;
  snapshotIds: string[];
  decidedAt: string;
};

export type DecisionOutcome = {
  decisionId: string;
  returnPercent: number;
  lesson: string;
  measuredAt: string;
};

export interface LearningRepository {
  saveDecision(decision: InvestmentDecision): Promise<void>;
  saveOutcome(outcome: DecisionOutcome): Promise<void>;
  findDecision(id: string): Promise<InvestmentDecision | undefined>;
}

export type LessonStrategy = "LONG_TERM" | "FUTURE_CORE" | "MOMENTUM" | "PORTFOLIO" | "RISK";

export type LessonType = "DATA" | "MODEL" | "EXECUTION" | "RISK" | "PSYCHOLOGY" | "PORTFOLIO" | "NO_CHANGE";

export type InvestmentLesson = {
  id: string;
  title: string;
  type: LessonType;
  strategy: LessonStrategy;
  originalAssumption: string;
  observedOutcome: string;
  processAssessment: string;
  modelAssessment: string;
  proposedChange?: string;
  confidence: number;
  sampleSize: number;
  evidenceIds: string[];
  decisionReviewIds: string[];
  createdAt: string;
};

export function createInvestmentLesson(lesson: InvestmentLesson): InvestmentLesson {
  for (const [name, value] of [
    ["id", lesson.id], ["title", lesson.title], ["originalAssumption", lesson.originalAssumption],
    ["observedOutcome", lesson.observedOutcome], ["processAssessment", lesson.processAssessment],
    ["modelAssessment", lesson.modelAssessment],
  ] as const) {
    if (!value.trim()) throw new Error(`${name} is required`);
  }
  if (!Number.isFinite(lesson.confidence) || lesson.confidence < 0 || lesson.confidence > 100) {
    throw new RangeError("lesson confidence must be between 0 and 100");
  }
  if (!Number.isInteger(lesson.sampleSize) || lesson.sampleSize <= 0) throw new Error("lesson sampleSize must be a positive integer");
  if (lesson.evidenceIds.length === 0 || lesson.decisionReviewIds.length === 0) {
    throw new Error("lesson requires evidence and decision reviews");
  }
  if (lesson.type === "NO_CHANGE" && lesson.proposedChange?.trim()) throw new Error("NO_CHANGE lessons cannot propose a model change");
  if (!Number.isFinite(new Date(lesson.createdAt).getTime())) throw new Error("lesson createdAt must be a valid date");
  return structuredClone(lesson);
}

export type DecisionQualityClassification =
  | "GOOD_PROCESS_GOOD_OUTCOME"
  | "GOOD_PROCESS_BAD_OUTCOME"
  | "BAD_PROCESS_GOOD_OUTCOME"
  | "BAD_PROCESS_BAD_OUTCOME";

export type DecisionReview = {
  id: string;
  decisionId: string;
  strategy: LessonStrategy;
  realizedPnl: SignedDecimalString;
  currency: CurrencyCode;
  rMultiple?: number;
  holdingDays: number;
  dataQualityScore: number;
  ruleCompliant: boolean;
  positionSizeCompliant: boolean;
  executionCompliant: boolean;
  emotionalState: EmotionalState;
  psychologyNotes: string;
  evidenceIds: string[];
  reviewedAt: string;
  classification: DecisionQualityClassification;
};

export function assessDecisionReview(
  input: Omit<DecisionReview, "classification">,
): DecisionReview {
  if (!input.id.trim() || !input.decisionId.trim()) throw new Error("review id and decisionId are required");
  assertSignedDecimal(input.realizedPnl, "realizedPnl");
  assertCurrency(input.currency);
  if (input.rMultiple !== undefined && !Number.isFinite(input.rMultiple)) throw new Error("rMultiple must be finite");
  if (!Number.isInteger(input.holdingDays) || input.holdingDays < 0) throw new Error("holdingDays must be a non-negative integer");
  if (!Number.isFinite(input.dataQualityScore) || input.dataQualityScore < 0 || input.dataQualityScore > 100) {
    throw new Error("dataQualityScore must be between 0 and 100");
  }
  if (input.evidenceIds.length === 0) throw new Error("decision review requires evidence");
  if (!Number.isFinite(new Date(input.reviewedAt).getTime())) throw new Error("reviewedAt must be a valid date");
  const goodProcess = input.ruleCompliant && input.positionSizeCompliant && input.executionCompliant && input.dataQualityScore >= 70;
  const goodOutcome = compareSignedDecimal(input.realizedPnl, "0") >= 0;
  const classification: DecisionQualityClassification = goodProcess
    ? goodOutcome ? "GOOD_PROCESS_GOOD_OUTCOME" : "GOOD_PROCESS_BAD_OUTCOME"
    : goodOutcome ? "BAD_PROCESS_GOOD_OUTCOME" : "BAD_PROCESS_BAD_OUTCOME";
  return { ...structuredClone(input), classification };
}

export type ModelChangeProposal = {
  id: string;
  lessonId: string;
  problem: string;
  hypothesis: string;
  proposedChange: string;
  expectedBenefit: string;
  possibleSideEffects: string[];
  rollbackPlan: string;
  status: "HYPOTHESIS";
  requiresHistoricalReplay: true;
  requiresShadowMode: true;
  requiresHumanApproval: true;
};

export function proposeModelChange(input: Omit<ModelChangeProposal,
  "status" | "requiresHistoricalReplay" | "requiresShadowMode" | "requiresHumanApproval">): ModelChangeProposal {
  for (const [name, value] of [
    ["id", input.id], ["lessonId", input.lessonId], ["problem", input.problem], ["hypothesis", input.hypothesis],
    ["proposedChange", input.proposedChange], ["expectedBenefit", input.expectedBenefit], ["rollbackPlan", input.rollbackPlan],
  ] as const) {
    if (!value.trim()) throw new Error(`${name} is required`);
  }
  return {
    ...structuredClone(input),
    status: "HYPOTHESIS",
    requiresHistoricalReplay: true,
    requiresShadowMode: true,
    requiresHumanApproval: true,
  };
}
