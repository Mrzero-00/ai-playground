import type { CurrencyCode, DecimalString, SignedDecimalString } from "../decimal.js";

export type LearningStrategyV1 = "CORE" | "FUTURE_CORE" | "MOMENTUM" | "PORTFOLIO" | "RISK";
export type ReviewTypeV1 = "DECISION" | "TRADE" | "SKIP" | "RISK" | "PORTFOLIO" | "INCIDENT";
export type OutcomeMaturityV1 = "IMMATURE" | "PARTIALLY_MATURE" | "MATURE" | "CENSORED";

export type ReviewManifestV1 = {
  id: string;
  userId: string;
  reviewType: ReviewTypeV1;
  strategy: LearningStrategyV1;
  companyId?: string;
  decisionId?: string;
  evaluationId?: string;
  proposalId?: string;
  riskDecisionId?: string;
  executionIds: string[];
  lotIds: string[];
  modelVersionId: string;
  policyVersionIds: string[];
  decisionSnapshotIds: string[];
  outcomeSnapshotIds: string[];
  decisionEvidenceIds: string[];
  outcomeEvidenceIds: string[];
  counterfactualEvidenceIds: string[];
  decisionAt: string;
  outcomeAsOf: string;
  reviewedAt: string;
  minimumMaturityAt: string;
  positionClosedAt?: string;
  regime?: string;
  setupType?: string;
  industryCode?: string;
  stage?: string;
  liquidityTier?: string;
  eventPolicy?: string;
  censoredReason?: string;
};

export type ProcessDimensionV1 =
  | "DATA_QUALITY"
  | "EVIDENCE_DISCIPLINE"
  | "STRATEGY_RULE_COMPLIANCE"
  | "PORTFOLIO_SIZING"
  | "RISK_COMPLIANCE"
  | "HUMAN_APPROVAL"
  | "EXECUTION_QUALITY"
  | "PSYCHOLOGY_DISCIPLINE";

export type ProcessDimensionResultV1 = {
  dimension: ProcessDimensionV1;
  status: "PASS" | "FAIL" | "PARTIAL" | "NOT_APPLICABLE" | "UNKNOWN";
  score?: number;
  reasonCodes: string[];
  evidenceIds: string[];
  critical: boolean;
};

export type ProcessAssessmentV1 = {
  goodProcess: boolean;
  score: number;
  criticalFailureCodes: string[];
  dimensions: ProcessDimensionResultV1[];
};

export type OutcomeAttributionInputV1 = {
  id: string;
  reviewManifestId: string;
  baseCurrency: CurrencyCode;
  pricePnlBase: SignedDecimalString;
  dividendPnlBase: SignedDecimalString;
  fxPnlBase: SignedDecimalString;
  feesBase: DecimalString;
  taxesBase: DecimalString;
  slippageBase: SignedDecimalString;
  investedCapitalBase?: DecimalString;
  initialPlannedRiskBase?: DecimalString;
  maePercent?: number;
  mfePercent?: number;
  holdingSessions?: number;
};

export type OutcomeAttributionV1 = OutcomeAttributionInputV1 & {
  grossPnlBase: SignedDecimalString;
  netPnlBase: SignedDecimalString;
  returnPercent?: number;
  rMultiple?: number;
  resultHash: string;
};

export type DecisionQualityClassificationV1 =
  | "GOOD_PROCESS_GOOD_OUTCOME"
  | "GOOD_PROCESS_BAD_OUTCOME"
  | "BAD_PROCESS_GOOD_OUTCOME"
  | "BAD_PROCESS_BAD_OUTCOME"
  | "INCOMPLETE_PROCESS"
  | "IMMATURE_OUTCOME";

export type LearningReviewInputV1 = {
  id: string;
  manifest: ReviewManifestV1;
  processDimensions: ProcessDimensionResultV1[];
  outcome?: OutcomeAttributionInputV1;
  outcomeExpectation: {
    met: boolean;
    reasonCodes: string[];
    evidenceIds: string[];
  };
  reviewerId: string;
  notes: string;
  codeVersion: string;
};

export type LearningReviewV1 = {
  id: string;
  userId: string;
  manifestId: string;
  strategy: LearningStrategyV1;
  reviewType: ReviewTypeV1;
  modelVersionId: string;
  policyVersionIds: string[];
  maturity: OutcomeMaturityV1;
  process: ProcessAssessmentV1;
  outcome?: OutcomeAttributionV1;
  outcomeExpectation: LearningReviewInputV1["outcomeExpectation"];
  classification: DecisionQualityClassificationV1;
  reviewerId: string;
  notes: string;
  reviewedAt: string;
  codeVersion: string;
  resultHash: string;
};

export type CohortKeyV1 = {
  strategy: LearningStrategyV1;
  modelVersionId: string;
  policyVersionIds: string[];
  marketRegime?: string;
  setupType?: string;
  industryCode?: string;
  stage?: string;
  liquidityTier?: string;
  eventPolicy?: string;
  periodStart: string;
  periodEnd: string;
};

export type CohortAnalysisPolicyV1 = {
  minimumSampleSize: number;
  minimumMaturityRatio: number;
  minimumEvidenceCoverage: number;
  minimumRegimeCount: number;
  maximumCompanyConcentration: number;
  maximumCensoredRatio: number;
};

export type CohortAnalysisV1 = {
  id: string;
  userId: string;
  key: CohortKeyV1;
  reviewIds: string[];
  sampleSize: number;
  matureCount: number;
  censoredCount: number;
  goodProcessCount: number;
  goodOutcomeCount: number;
  evidenceCoverage: number;
  regimeCount: number;
  maximumCompanyConcentration: number;
  eligibleForLesson: boolean;
  blockerCodes: string[];
  analyzedAt: string;
  resultHash: string;
};

export type CohortAnalysisInputV1 = {
  id: string;
  key: CohortKeyV1;
  policy: CohortAnalysisPolicyV1;
  records: Array<{ review: LearningReviewV1; manifest: ReviewManifestV1; evidenceCoverage: number }>;
  analyzedAt: string;
};

export type LessonTypeV1 = "DATA" | "MODEL" | "EXECUTION" | "RISK" | "PSYCHOLOGY" | "PORTFOLIO" | "NO_CHANGE";

export type LessonCandidateInputV1 = {
  id: string;
  userId: string;
  type: LessonTypeV1;
  strategy: LearningStrategyV1;
  title: string;
  originalAssumption: string;
  observedPattern: string;
  alternativeExplanations: string[];
  supportingReviewIds: string[];
  contradictingReviewIds: string[];
  evidenceIds: string[];
  cohort: CohortAnalysisV1;
  confidence: number;
  generatedAt: string;
};

export type LessonCandidateV1 = Omit<LessonCandidateInputV1, "cohort"> & {
  cohortAnalysisId: string;
  cohortKey: CohortKeyV1;
  sampleSize: number;
  status: "CANDIDATE" | "BLOCKED" | "READY_FOR_REVIEW";
  blockerCodes: string[];
  resultHash: string;
};

export type InvestmentLessonV1 = {
  id: string;
  candidateId: string;
  userId: string;
  type: LessonTypeV1;
  strategy: LearningStrategyV1;
  title: string;
  processAssessment: string;
  outcomeAssessment: string;
  modelAssessment: string;
  recommendedAction: "NO_CHANGE" | "DATA_FIX" | "PROCESS_FIX" | "MODEL_HYPOTHESIS" | "POLICY_REVIEW" | "ARCHITECTURE_REVIEW";
  status: "APPROVED" | "REJECTED" | "SUPERSEDED";
  approvedBy: string;
  approvedAt: string;
  supersedesLessonId?: string;
  evidenceIds: string[];
  reviewIds: string[];
  resultHash: string;
};

export type ApproveLessonInputV1 = {
  id: string;
  candidate: LessonCandidateV1;
  status: "APPROVED" | "REJECTED";
  processAssessment: string;
  outcomeAssessment: string;
  modelAssessment: string;
  recommendedAction: InvestmentLessonV1["recommendedAction"];
  approvedBy: string;
  approvedAt: string;
  supersedesLessonId?: string;
};

export type ModelFamilyV1 = "LONG_TERM" | "MOMENTUM" | "PORTFOLIO" | "RISK";
export type ModelChangeStatusV1 = "HYPOTHESIS" | "VALIDATING" | "REJECTED" | "READY_FOR_APPROVAL" | "APPROVED" | "ACTIVATED" | "ROLLED_BACK";

export type ModelChangeProposalInputV1 = {
  id: string;
  userId: string;
  lessonIds: string[];
  targetModelFamily: ModelFamilyV1;
  championModelVersionId: string;
  challengerModelVersionId: string;
  problem: string;
  hypothesis: string;
  proposedChange: string;
  expectedBenefit: string;
  possibleSideEffects: string[];
  rollbackPlan: string;
  primaryMetric: string;
  primaryMetricDirection: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  guardrailMetrics: string[];
  createdAt: string;
};

export type ModelChangeProposalV1 = ModelChangeProposalInputV1 & {
  status: ModelChangeStatusV1;
  requiresHistoricalReplay: true;
  requiresWalkForward: true;
  requiresShadowMode: true;
  requiresHumanApproval: true;
  supersedesProposalId?: string;
  validationResultId?: string;
  approvedBy?: string;
  approvedAt?: string;
  resultHash: string;
};

export type ValidationStageResultV1 = {
  stage: "HISTORICAL_REPLAY" | "WALK_FORWARD" | "SHADOW";
  datasetManifestId: string;
  championMetric: number;
  challengerMetric: number;
  guardrails: Record<string, "PASS" | "WARN" | "FAIL" | "UNKNOWN">;
  pointInTimeValid: boolean;
  operationalStateChangeAllowed: false;
  sampleSize: number;
  resultHash: string;
};

export type ModelValidationResultV1 = {
  id: string;
  userId: string;
  proposalId: string;
  evaluatedAt: string;
  codeVersion: string;
  stages: ValidationStageResultV1[];
  verdict: "PASS" | "PASS_WITH_GUARDRAILS" | "INSUFFICIENT_EVIDENCE" | "FAIL" | "BLOCKED";
  blockerCodes: string[];
  resultHash: string;
};

export type ModelValidationInputV1 = {
  id: string;
  proposal: ModelChangeProposalV1;
  evaluatedAt: string;
  codeVersion: string;
  minimumSampleSize: number;
  stages: ValidationStageResultV1[];
};

export type ModelChangeTransitionInputV1 = {
  id: string;
  previous: ModelChangeProposalV1;
  nextStatus: Exclude<ModelChangeStatusV1, "HYPOTHESIS" | "ACTIVATED" | "ROLLED_BACK">;
  transitionedAt: string;
  validationResult?: ModelValidationResultV1;
  approvedBy?: string;
};
