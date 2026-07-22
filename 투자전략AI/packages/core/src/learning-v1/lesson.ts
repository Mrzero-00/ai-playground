import { learningStableHash } from "./hash.js";
import type { ApproveLessonInputV1, InvestmentLessonV1, LessonCandidateInputV1, LessonCandidateV1 } from "./types.js";

export function createLessonCandidateV1(input: LessonCandidateInputV1): LessonCandidateV1 {
  for (const [name, value] of Object.entries({
    id: input.id, userId: input.userId, title: input.title,
    originalAssumption: input.originalAssumption, observedPattern: input.observedPattern,
  })) if (!value.trim()) throw new Error(`Lesson candidate ${name} is required`);
  if (!Number.isFinite(new Date(input.generatedAt).getTime())) throw new Error("Lesson candidate generatedAt must be valid");
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 100) throw new Error("Lesson confidence must be between 0 and 100");
  if (input.alternativeExplanations.length === 0) throw new Error("Lesson candidate requires alternative explanations");
  if (input.supportingReviewIds.length === 0 || input.evidenceIds.length === 0) throw new Error("Lesson candidate requires supporting Reviews and Evidence");
  validateUnique(input.alternativeExplanations, "alternativeExplanations");
  validateUnique(input.supportingReviewIds, "supportingReviewIds");
  validateUnique(input.contradictingReviewIds, "contradictingReviewIds");
  validateUnique(input.evidenceIds, "evidenceIds");
  if (input.supportingReviewIds.some((id) => input.contradictingReviewIds.includes(id))) throw new Error("A Review cannot both support and contradict a Lesson");
  if (input.strategy !== input.cohort.key.strategy) throw new Error("Lesson candidate Strategy must match its Cohort");
  if (input.userId !== input.cohort.userId) throw new Error("Lesson candidate ownership must match its Cohort");
  const cohortReviewIds = new Set(input.cohort.reviewIds);
  if ([...input.supportingReviewIds, ...input.contradictingReviewIds].some((id) => !cohortReviewIds.has(id))) {
    throw new Error("Lesson candidate Reviews must belong to its Cohort");
  }
  const blockers = [...input.cohort.blockerCodes];
  if (input.confidence < 60) blockers.push("LESSON_CONFIDENCE_TOO_LOW");
  const status: LessonCandidateV1["status"] = blockers.length > 0 ? "BLOCKED"
    : input.contradictingReviewIds.length === 0 ? "CANDIDATE" : "READY_FOR_REVIEW";
  const withoutHash: Omit<LessonCandidateV1, "resultHash"> = {
    id: input.id,
    userId: input.userId,
    type: input.type,
    strategy: input.strategy,
    title: input.title,
    originalAssumption: input.originalAssumption,
    observedPattern: input.observedPattern,
    alternativeExplanations: [...input.alternativeExplanations],
    supportingReviewIds: [...input.supportingReviewIds].sort(),
    contradictingReviewIds: [...input.contradictingReviewIds].sort(),
    evidenceIds: [...input.evidenceIds].sort(),
    cohortAnalysisId: input.cohort.id,
    cohortKey: structuredClone(input.cohort.key),
    sampleSize: input.cohort.sampleSize,
    confidence: input.confidence,
    generatedAt: input.generatedAt,
    status,
    blockerCodes: [...new Set(blockers)].sort(),
  };
  return { ...withoutHash, resultHash: learningStableHash(withoutHash) };
}

export function approveInvestmentLessonV1(input: ApproveLessonInputV1): InvestmentLessonV1 {
  for (const [name, value] of Object.entries({
    id: input.id, processAssessment: input.processAssessment, outcomeAssessment: input.outcomeAssessment,
    modelAssessment: input.modelAssessment, approvedBy: input.approvedBy,
  })) if (!value.trim()) throw new Error(`Investment Lesson ${name} is required`);
  if (input.id === input.candidate.id) throw new Error("Investment Lesson requires a new immutable id");
  if (input.candidate.status !== "READY_FOR_REVIEW") throw new Error("Only READY_FOR_REVIEW Lesson candidate can be resolved");
  if (!Number.isFinite(new Date(input.approvedAt).getTime()) || new Date(input.approvedAt).getTime() < new Date(input.candidate.generatedAt).getTime()) {
    throw new Error("Lesson approval time must be after candidate generation");
  }
  if (input.candidate.type === "NO_CHANGE" && input.recommendedAction !== "NO_CHANGE") throw new Error("NO_CHANGE Lesson cannot recommend a change");
  if (input.candidate.type !== "NO_CHANGE" && input.recommendedAction === "NO_CHANGE") {
    throw new Error("Change Lesson must state an actionable recommendation or use NO_CHANGE type");
  }
  const withoutHash: Omit<InvestmentLessonV1, "resultHash"> = {
    id: input.id,
    candidateId: input.candidate.id,
    userId: input.candidate.userId,
    type: input.candidate.type,
    strategy: input.candidate.strategy,
    title: input.candidate.title,
    processAssessment: input.processAssessment,
    outcomeAssessment: input.outcomeAssessment,
    modelAssessment: input.modelAssessment,
    recommendedAction: input.recommendedAction,
    status: input.status,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    ...(input.supersedesLessonId === undefined ? {} : { supersedesLessonId: input.supersedesLessonId }),
    evidenceIds: [...input.candidate.evidenceIds],
    reviewIds: [...new Set([...input.candidate.supportingReviewIds, ...input.candidate.contradictingReviewIds])].sort(),
  };
  return { ...withoutHash, resultHash: learningStableHash(withoutHash) };
}

function validateUnique(values: string[], name: string): void {
  if (values.some((value) => !value.trim())) throw new Error(`${name} cannot contain blank values`);
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`);
}
