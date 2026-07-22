import type { DecimalString, SignedDecimalString } from "../decimal.js";
import type { EvaluationConfidence } from "../evidence.js";
import type { ThesisStatus } from "../thesis.js";
import type { LongTermCandidateState } from "../state-machine.js";

export type LongTermProfile = "CORE" | "FUTURE_CORE";
export type LongTermProfileSelection = LongTermProfile | "BOTH";

export type LongTermEvaluationMode =
  | "INITIAL_SCREEN"
  | "FULL_REVIEW"
  | "SCHEDULED_REFRESH"
  | "EARNINGS_REVIEW"
  | "EVENT_REVIEW"
  | "DRAWDOWN_REVIEW"
  | "HISTORICAL_REPLAY";

export type MetricAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "NOT_APPLICABLE"
  | "UNKNOWN"
  | "STALE"
  | "CONFLICTED";

export type FactorTrend = "IMPROVING" | "STABLE" | "DETERIORATING" | "UNKNOWN";

export type CoreFactorId =
  | "CORE_BUSINESS_DURABILITY"
  | "CORE_MOAT"
  | "CORE_GROWTH_DURABILITY"
  | "CORE_MANAGEMENT_CAPITAL"
  | "CORE_FINANCIAL_FCF"
  | "CORE_VALUATION"
  | "CORE_RISK_RESILIENCE";

export type FutureCoreFactorId =
  | "FC_MARKET_GROWTH"
  | "FC_PRODUCT_PROOF"
  | "FC_MOAT_FORMATION"
  | "FC_UNIT_ECONOMICS"
  | "FC_MANAGEMENT_EXECUTION"
  | "FC_SURVIVAL_DILUTION"
  | "FC_VALUATION_ASYMMETRY";

export type LongTermFactorId = CoreFactorId | FutureCoreFactorId;

export type FactorInput = {
  availability: MetricAvailability;
  score?: number;
  bearScore?: number;
  bullScore?: number;
  trend?: FactorTrend;
  evidenceIds: string[];
  counterEvidenceIds?: string[];
  explanation: string;
  warnings?: string[];
};

export type FactorResult = {
  factorId: LongTermFactorId;
  score?: number;
  bearScore?: number;
  bullScore?: number;
  status: "SCORED" | "BLOCKED" | "NOT_APPLICABLE";
  availability: MetricAvailability;
  weight: number;
  applicableWeight: number;
  trend: FactorTrend;
  supportingEvidenceIds: string[];
  counterEvidenceIds: string[];
  warnings: string[];
  explanation: string;
};

export type IndustryProfile = {
  id: string;
  version: string;
  industryCode: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  supportedProfiles: LongTermProfile[];
  notApplicableFactorIds: LongTermFactorId[];
  criticalFactorIds: LongTermFactorId[];
  minimumApplicableWeight: number;
  modelFitValidated: boolean;
  effectiveFrom: string;
};

export type ConfidenceInput = {
  evidenceCoverage: number;
  sourceQuality: number;
  modelFit: number;
  disagreement: number;
  companyOnlyMajorFactors?: boolean;
  observedQuarters: number;
  conglomerateSegmentsUnresolved?: boolean;
  criticalSourceConflict?: boolean;
};

export type GateContext = {
  identityResolved: boolean;
  dataQualitySufficient: boolean;
  accountingTrustworthy: boolean;
  financialSurvival: boolean;
  valuationAvailable: boolean;
  thesisComplete: boolean;
  policyVersionActive: boolean;
  hardRiskCodes?: string[];
  stressRunwayMonths?: number;
  priceConditionDefined?: boolean;
};

export type LongTermAction =
  | "ACCUMULATE"
  | "BUY_ON_WEAKNESS"
  | "HOLD"
  | "WATCH"
  | "REDUCE"
  | "EXIT"
  | "REVIEW_REQUIRED";

export type GateResult = {
  gateId: string;
  status: "PASSED" | "FAILED" | "REVIEW_REQUIRED" | "NOT_APPLICABLE";
  severity: "INFO" | "SOFT" | "HARD";
  reasonCode: string;
  evidenceIds: string[];
  explanation: string;
  blockedActions: LongTermAction[];
};

export type ValuationClassification = "ATTRACTIVE" | "FAIR" | "EXPENSIVE" | "EXTREME" | "UNKNOWN";
export type ValuationScenarioName = "BEAR" | "BASE" | "BULL";

export type ValuationScenario = {
  name: ValuationScenarioName;
  probability: number;
  enterpriseValue: DecimalString;
  equityValue: DecimalString;
  valuePerShare: DecimalString;
  expectedAnnualReturn5y?: SignedDecimalString;
  expectedAnnualReturn10y?: SignedDecimalString;
  evidenceIds: string[];
};

export type ValuationResult = {
  currency: string;
  marketPrice: DecimalString;
  marketPriceAsOf: string;
  classification: ValuationClassification;
  methods: Array<"DCF" | "REVERSE_DCF" | "RELATIVE_MULTIPLE" | "SUM_OF_PARTS" | "RESIDUAL_INCOME" | "RISK_ADJUSTED_NPV" | "NAV">;
  scenarios: ValuationScenario[];
  expectedReturnPositive: boolean;
  bearLossTolerable: boolean;
  sensitivityDrivers: string[];
  warnings?: string[];
};

export type ThesisAssumptionAssessment = {
  id: string;
  importance: "CRITICAL" | "HIGH" | "MEDIUM";
  previousStatus: "SUPPORTED" | "MIXED" | "UNSUPPORTED" | "NOT_TESTED";
  currentStatus: "SUPPORTED" | "MIXED" | "UNSUPPORTED" | "NOT_TESTED";
  evidenceIds: string[];
};

export type ThesisAssessmentInput = {
  thesisId?: string;
  replaced?: boolean;
  breakConditionTriggered?: boolean;
  assumptions: ThesisAssumptionAssessment[];
};

export type ThesisAssessment = {
  thesisId?: string;
  status: ThesisStatus;
  strengthenedAssumptionIds: string[];
  weakenedAssumptionIds: string[];
  breakConditionTriggered: boolean;
  explanation: string;
};

export type ScoreRange = {
  point: number;
  low: number;
  high: number;
  sensitivityDrivers: string[];
};

export type ProfileEvaluation = {
  profile: LongTermProfile;
  score: ScoreRange;
  factorResults: FactorResult[];
  eligibility: "ELIGIBLE" | "INELIGIBLE" | "REVIEW_REQUIRED";
  eligibilityReasons: string[];
  confidence: EvaluationConfidence;
  rankingTier: "A" | "B" | "C" | "D";
};

export type MaterialChange = {
  factorId: LongTermFactorId;
  previousScore: number;
  currentScore: number;
  delta: number;
};

export type LongTermEvaluationInput = {
  id: string;
  companyId: string;
  securityId: string;
  profile: LongTermProfileSelection;
  mode: LongTermEvaluationMode;
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  modelVersionId: string;
  philosophyVersionId: string;
  industryProfile: IndustryProfile;
  snapshotIds: string[];
  evidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  currentStage: LongTermCandidateState;
  factors: Partial<Record<LongTermFactorId, FactorInput>>;
  confidence: ConfidenceInput;
  gates: GateContext;
  valuation: ValuationResult;
  thesis: ThesisAssessmentInput;
  previousFactorScores?: Partial<Record<LongTermFactorId, number>>;
  nextReviewAt: string;
  reviewTriggers: string[];
};

export type LongTermEvaluationResult = {
  id: string;
  companyId: string;
  securityId: string;
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  mode: LongTermEvaluationMode;
  modelVersionId: string;
  philosophyVersionId: string;
  industryProfileVersionId: string;
  snapshotIds: string[];
  profiles: { core?: ProfileEvaluation; futureCore?: ProfileEvaluation };
  primaryProfile: LongTermProfile | "NONE";
  stageBefore: LongTermCandidateState;
  proposedStage: LongTermCandidateState;
  stageChangeRequiresHumanApproval: boolean;
  operationalStateChangeAllowed: boolean;
  action: LongTermAction;
  actionConstraints: string[];
  thesisAssessment: ThesisAssessment;
  gateResults: GateResult[];
  valuation: ValuationResult;
  confidence: EvaluationConfidence;
  permanentImpairmentRisk: number;
  riskScoreDirection: "HIGHER_IS_RISKIER";
  supportingEvidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  materialChanges: MaterialChange[];
  nextReviewAt: string;
  reviewTriggers: string[];
  explanation: {
    conclusion: string;
    strengths: string[];
    risks: string[];
    failedGates: string[];
    nextChecks: string[];
  };
  resultHash: string;
};
