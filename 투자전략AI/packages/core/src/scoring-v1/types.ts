export type ScoreScopeV1 = "LONG_TERM_CORE" | "LONG_TERM_FUTURE_CORE" | "MOMENTUM_SETUP";
export type ScoreDirectionV1 = "HIGHER_IS_BETTER" | "HIGHER_IS_WORSE" | "TARGET_IS_BEST";
export type MetricAvailabilityV1 = "AVAILABLE" | "PARTIAL" | "NOT_APPLICABLE" | "UNKNOWN" | "STALE" | "CONFLICTED";
export type ScoreStatusV1 = "SCORED" | "BLOCKED" | "UNAVAILABLE";
export type ScoreEvaluationModeV1 = "OPERATIONAL" | "SHADOW" | "HISTORICAL_REPLAY";
export type ScoreModelStatusV1 = "DRAFT" | "VALIDATING" | "SHADOW" | "APPROVED" | "ACTIVE" | "DEPRECATED" | "REJECTED";

export type NormalizationPolicyV1 =
  | { kind: "PRE_NORMALIZED" }
  | { kind: "LINEAR"; floor: number; ceiling: number }
  | { kind: "PIECEWISE"; anchors: Array<{ raw: number; score: number }> }
  | { kind: "TARGET_BAND"; lowerBoundary: number; idealMin: number; idealMax: number; upperBoundary: number };

export type EvidencePolicyV1 = {
  minimumSourceTier: "A" | "B" | "C";
  minimumDistinctSources: number;
  counterEvidenceRequired: boolean;
  maximumAgeSeconds?: number;
  pointInTimeRequired: true;
};

export type FactorDefinitionV1 = {
  id: string;
  label: string;
  direction: ScoreDirectionV1;
  weightBasisPoints: number;
  critical: boolean;
  allowedNotApplicable: boolean;
  normalization: NormalizationPolicyV1;
  evidencePolicy: EvidencePolicyV1;
  partialScoreCap?: number;
  effectiveFrom: string;
};

export type ScoreThresholdV1 = { id: string; minimumScore: number; minimumConfidence: number; purpose: string };
export type ConfidenceDimensionV1 = "EVIDENCE_COVERAGE" | "SOURCE_QUALITY" | "FRESHNESS" | "MODEL_FIT" | "AGREEMENT";
export type ConfidencePolicyV1 = { weightsBasisPoints: Record<ConfidenceDimensionV1, number>; grades: { high: number; medium: number; low: number } };

export type ScoreModelV1 = {
  id: string;
  userId: string;
  version: string;
  scope: ScoreScopeV1;
  status: ScoreModelStatusV1;
  factorDefinitions: FactorDefinitionV1[];
  minimumApplicableWeightBasisPoints: number;
  thresholds: ScoreThresholdV1[];
  confidencePolicy: ConfidencePolicyV1;
  effectiveFrom: string;
  approvedBy?: string;
  approvedAt?: string;
  supersedesModelVersionId?: string;
  changeReason: string;
  modelHash: string;
};

export type ScoreModelInputV1 = Omit<ScoreModelV1, "modelHash">;

export type FactorObservationV1 = {
  factorId: string;
  availability: MetricAvailabilityV1;
  rawValue?: number;
  preNormalizedScore?: number;
  bearScore?: number;
  bullScore?: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  observedAt: string;
  availableAt: string;
  explanation: string;
};

export type ScoringEvidenceV1 = {
  id: string;
  userId: string;
  sourceId: string;
  sourceTier: "A" | "B" | "C" | "D" | "E" | "F";
  scoreEligible: boolean;
  observedAt: string;
  availableAt: string;
};

export type ConfidenceInputV1 = {
  evidenceCoverage: number;
  sourceQuality: number;
  freshness: number;
  modelFit: number;
  disagreement: number;
  caps: Array<{ code: string; maximum: number }>;
};

export type ConfidenceResultV1 = {
  score: number;
  grade: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  dimensions: Omit<ConfidenceInputV1, "caps">;
  appliedCaps: Array<{ code: string; maximum: number }>;
  warningCodes: string[];
};

export type FactorScoreResultV1 = {
  factorId: string;
  status: "SCORED" | "BLOCKED" | "NOT_APPLICABLE";
  availability: MetricAvailabilityV1;
  direction: ScoreDirectionV1;
  score?: number;
  low?: number;
  high?: number;
  originalWeightBasisPoints: number;
  effectiveWeightBasisPoints: number;
  contribution?: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  warningCodes: string[];
  explanation: string;
};

export type ScoreRangeV1 = { point: number; low: number; high: number; sensitivityDriverIds: string[] };

export type ScorecardInputV1 = {
  id: string;
  userId: string;
  subjectType: "COMPANY" | "SECURITY" | "SETUP" | "REVIEW_COHORT";
  subjectId: string;
  mode: ScoreEvaluationModeV1;
  model: ScoreModelV1;
  philosophyVersionId: string;
  industryProfileVersionId?: string;
  setupDefinitionVersion?: string;
  observations: FactorObservationV1[];
  evidence: ScoringEvidenceV1[];
  confidence: ConfidenceInputV1;
  snapshotIds: string[];
  evidenceIds: string[];
  asOf: string;
  evaluatedAt: string;
  codeVersion: string;
  subjectAvailable?: boolean;
  unavailableReasonCode?: string;
};

export type ScorecardResultV1 = {
  id: string;
  userId: string;
  subjectType: ScorecardInputV1["subjectType"];
  subjectId: string;
  scope: ScoreScopeV1;
  mode: ScoreEvaluationModeV1;
  status: ScoreStatusV1;
  score?: ScoreRangeV1;
  confidence: ConfidenceResultV1;
  factorResults: FactorScoreResultV1[];
  blockerCodes: string[];
  modelVersionId: string;
  philosophyVersionId: string;
  industryProfileVersionId?: string;
  setupDefinitionVersion?: string;
  snapshotIds: string[];
  evidenceIds: string[];
  asOf: string;
  evaluatedAt: string;
  codeVersion: string;
  resultHash: string;
};

export type ScoreRankingResultV1 = {
  scope: ScoreScopeV1;
  modelVersionId: string;
  philosophyVersionId: string;
  items: Array<{ rank: number; scorecardId: string; subjectId: string; score: ScoreRangeV1; confidence: number }>;
  excluded: Array<{ scorecardId: string; status: ScoreStatusV1; blockerCodes: string[] }>;
  resultHash: string;
};

export type FactorContributionDeltaV1 = { factorId: string; previousContribution?: number; currentContribution?: number; contributionDelta?: number; reasonCodes: string[] };
export type ScoreChangeExplanationV1 = {
  id: string;
  userId: string;
  previousScorecardId: string;
  currentScorecardId: string;
  comparisonStatus: "COMPARABLE" | "MODEL_CHANGED" | "NOT_COMPARABLE";
  pointDelta?: number;
  confidenceDelta: number;
  factorDeltas: FactorContributionDeltaV1[];
  reasonCodes: string[];
  explainedAt: string;
  resultHash: string;
};
