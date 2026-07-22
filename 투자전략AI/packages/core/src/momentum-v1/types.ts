import type { DecimalString, CurrencyCode } from "../decimal.js";
import type { EvaluationConfidence, EvidenceSourceTier } from "../evidence.js";
import type { MarketRegime, MomentumSetupType } from "../momentum-plan.js";

export type MomentumEvaluationMode =
  | "UNIVERSE_SCAN"
  | "SETUP_DETECTION"
  | "SETUP_VALIDATION"
  | "PRICE_REFRESH"
  | "EVENT_REVIEW"
  | "POSITION_REVIEW"
  | "HISTORICAL_REPLAY";

export type MomentumMetricAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "NOT_APPLICABLE"
  | "UNKNOWN"
  | "STALE"
  | "CONFLICTED";

export type MomentumFactorId =
  | "MOM_RELATIVE_STRENGTH"
  | "MOM_SECTOR_LEADERSHIP"
  | "MOM_PRICE_STRUCTURE"
  | "MOM_VOLUME_CONFIRMATION"
  | "MOM_CATALYST_QUALITY"
  | "MOM_LIQUIDITY_EXECUTION"
  | "MOM_REWARD_RISK_TIMING";

export type MomentumFactorInput = {
  availability: MomentumMetricAvailability;
  score?: number;
  bearScore?: number;
  bullScore?: number;
  evidenceIds: string[];
  counterEvidenceIds?: string[];
  explanation: string;
  warnings?: string[];
};

export type MomentumFactorResult = {
  factorId: MomentumFactorId;
  status: "SCORED" | "BLOCKED" | "NOT_APPLICABLE";
  availability: MomentumMetricAvailability;
  score?: number;
  bearScore?: number;
  bullScore?: number;
  weight: number;
  applicableWeight: number;
  supportingEvidenceIds: string[];
  counterEvidenceIds: string[];
  explanation: string;
  warnings: string[];
};

export type MomentumScoreRange = {
  point: number;
  low: number;
  high: number;
  sensitivityDrivers: MomentumFactorId[];
};

export type MomentumUniversePolicy = {
  id: string;
  version: string;
  market: string;
  allowedSecurityTypes: Array<"COMMON_STOCK" | "ADR" | "ETF">;
  minimumPrice: DecimalString;
  minimumMarketCap: DecimalString;
  minimumAddv20: DecimalString;
  maximumMedianSpreadBps: number;
  minimumListingSessions: number;
  excludedVenues: string[];
  excludedRiskFlags: string[];
  effectiveFrom: string;
};

export type MomentumUniverseInput = {
  securityType: "COMMON_STOCK" | "ADR" | "ETF";
  venue: string;
  price: DecimalString;
  marketCap: DecimalString;
  addv20: DecimalString;
  medianSpreadBps: number;
  listingSessions: number;
  riskFlags: string[];
  leveragedOrInverseEtf?: boolean;
  halted: boolean;
  delistingProcess: boolean;
  identityResolved: boolean;
  quoteSourcesConsistent: boolean;
  corporateActionsApplied: boolean;
  snapshotIds: string[];
};

export type UniverseDecision = {
  securityId: string;
  eligible: boolean;
  reasonCodes: string[];
  liquidityTier: "L1" | "L2" | "L3" | "INELIGIBLE";
  maxParticipationRate?: number;
  snapshotIds: string[];
  policyVersionId: string;
};

export type MarketRegimeEvaluation = {
  regime: MarketRegime | "UNKNOWN";
  confidence: number;
  permission: "ALLOW" | "ALLOW_REDUCED" | "REQUIRE_MANUAL_REVIEW" | "DENY_NEW_RISK";
  riskMultiplier: number;
  reasonCodes: string[];
  snapshotIds: string[];
  evaluatedAt: string;
};

export type MomentumConfidenceInput = {
  evidenceCoverage: number;
  sourceQuality: number;
  dataFreshness: number;
  modelFit: number;
  disagreement: number;
  hasCounterEvidence: boolean;
  criticalBarOrQuoteConflict?: boolean;
  companyOnlyCatalyst?: boolean;
  listingHistoryInsufficient?: boolean;
  shadowSetupDefinition?: boolean;
  volumePartial?: boolean;
  sectorBenchmarkUnfit?: boolean;
};

export type MomentumSetupMetrics = {
  baseSessions?: number;
  baseDepthPercent?: number;
  resistanceBreakConfirmed?: boolean;
  breakoutVolumeRatio?: number;
  closeLocationPercent?: number;
  chaseDistanceAtr?: number;
  uptrend20And50?: boolean;
  pullbackSessions?: number;
  pullbackDepthAtr?: number;
  pullbackVolumeContracted?: boolean;
  supportReactionConfirmed?: boolean;
  officialEarningsCatalyst?: boolean;
  officialCatalyst?: boolean;
  earningsQualityVerified?: boolean;
  estimateRevisionConfirmed?: boolean;
  gapPercent?: number;
  openingRangeHeld?: boolean;
  gapHeld?: boolean;
  gapSizeAtr?: number;
  sectorRelativeStrengthTurnedUp?: boolean;
  sectorBreadthImproving?: boolean;
  multipleLeadersConfirmed?: boolean;
  candidateIsSectorLeader?: boolean;
  legalTermsVerified?: boolean;
  binaryScenarioComplete?: boolean;
  manualReviewApproved?: boolean;
};

export type MomentumSetupDefinition = {
  type: MomentumSetupType;
  version: string;
  requiredIndicators: string[];
  criticalFactorIds: MomentumFactorId[];
  allowedNotApplicableFactorIds: MomentumFactorId[];
  defaultHoldingSessions: { min: number; max: number };
  allowedRegimes: MarketRegime[];
  eventPolicy: string;
};

export type MomentumTriggerStatus = "NOT_TRIGGERED" | "TRIGGERED" | "CHASED" | "INVALIDATED";

export type MomentumSetupEvaluation = {
  setupId: string;
  setupType: MomentumSetupType;
  status: "ELIGIBLE" | "CONDITIONAL" | "INELIGIBLE";
  detectedAt: string;
  triggerStatus: MomentumTriggerStatus;
  holdingHorizon: { minSessions: number; maxSessions: number };
  invalidationConditions: string[];
  reasonCodes: string[];
  warnings: string[];
};

export type MomentumCatalystType =
  | "EARNINGS_SURPRISE"
  | "GUIDANCE_CHANGE"
  | "ESTIMATE_REVISION"
  | "PRODUCT_LAUNCH"
  | "REGULATORY_DECISION"
  | "MAJOR_CONTRACT"
  | "SUPPLY_DEMAND_SHOCK"
  | "POLICY_CHANGE"
  | "CAPITAL_RETURN"
  | "INDEX_INCLUSION"
  | "MANAGEMENT_CHANGE"
  | "TECHNICAL_ONLY";

export type MomentumCatalyst = {
  id: string;
  companyId: string;
  type: MomentumCatalystType;
  occurredAt: string;
  availableAt: string;
  sourceTier: EvidenceSourceTier;
  official: boolean;
  summary: string;
  expectedDuration: "INTRADAY" | "DAYS" | "WEEKS" | "MONTHS";
  halfLifeHours: number;
  estimateRevisionObserved: boolean;
  priceReactionPercent: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
};

export type EventHoldingPolicy =
  | "EXIT_BEFORE_EVENT"
  | "REDUCE_BEFORE_EVENT"
  | "HOLD_WITH_SCENARIO_APPROVAL"
  | "EVENT_IS_SETUP"
  | "NO_KNOWN_EVENT";

export type GapRiskScenario = {
  baseStopLoss: DecimalString;
  adverseGapPrice: DecimalString;
  scenarioLossPerUnit: DecimalString;
  probabilityBand: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  source: string;
};

export type MomentumEventRiskInput = {
  calendarKnown: boolean;
  eventWithinPlanHorizon: boolean;
  binaryEvent: boolean;
  officialScheduleConsistent: boolean;
  policy: EventHoldingPolicy;
  gapScenario?: GapRiskScenario;
  manualReviewApproved: boolean;
  gapRiskScore: number;
};

export type MomentumTradePlanV1 = {
  id: string;
  revision: number;
  companyId: string;
  securityId: string;
  evaluationId: string;
  setupId: string;
  setupType: MomentumSetupType;
  marketRegime: MarketRegime;
  currency: CurrencyCode;
  entryZoneMin: DecimalString;
  entryZoneMax: DecimalString;
  chaseLimit: DecimalString;
  trigger: string;
  initialStop: DecimalString;
  target1?: DecimalString;
  target2?: DecimalString;
  trailingStopRule?: string;
  timeStopSessions: number;
  referenceEntry: DecimalString;
  unitRisk: DecimalString;
  rewardRiskToTarget1?: number;
  rewardRiskToTarget2?: number;
  estimatedRoundTripCostR: number;
  invalidationConditions: string[];
  eventPolicy: EventHoldingPolicy;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  snapshotIds: string[];
  modelVersionId: string;
  generatedAt: string;
  expiresAt: string;
  supersedesPlanId?: string;
};

export type MomentumAction = "ENTER" | "WAIT" | "AVOID" | "EXIT" | "REVIEW_REQUIRED";

export type MomentumGateResult = {
  gateId: string;
  status: "PASSED" | "FAILED" | "REVIEW_REQUIRED" | "NOT_APPLICABLE";
  severity: "INFO" | "SOFT" | "HARD";
  reasonCode: string;
  evidenceIds: string[];
  blockedActions: MomentumAction[];
  explanation: string;
};

export type MomentumSignalContext = {
  activePosition: boolean;
  stopOrInvalidationTriggered: boolean;
  marketDataFresh: boolean;
  corporateActionsApplied: boolean;
  behavioralPolicyClear: boolean;
};

export type MomentumEvaluationInput = {
  id: string;
  companyId: string;
  securityId: string;
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  mode: MomentumEvaluationMode;
  modelVersionId: string;
  philosophyVersionId: string;
  universePolicy: MomentumUniversePolicy;
  universe: MomentumUniverseInput;
  marketRegime: MarketRegimeEvaluation;
  setupId: string;
  setupDefinition: MomentumSetupDefinition;
  setupMetrics: MomentumSetupMetrics;
  triggerStatus: MomentumTriggerStatus;
  detectedAt: string;
  invalidationConditions: string[];
  factors: Partial<Record<MomentumFactorId, MomentumFactorInput>>;
  confidence: MomentumConfidenceInput;
  catalyst?: MomentumCatalyst;
  tradePlan?: MomentumTradePlanV1;
  eventRisk: MomentumEventRiskInput;
  signalContext: MomentumSignalContext;
  currentPrice: DecimalString;
  executionRisk: number;
  snapshotIds: string[];
  evidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  nextReviewAt: string;
  expiresAt: string;
};

export type MomentumExplanation = {
  conclusion: string;
  strengths: string[];
  risks: string[];
  failedGates: string[];
  nextChecks: string[];
};

export type MomentumEvaluationResultV1 = {
  id: string;
  companyId: string;
  securityId: string;
  evaluatedAt: string;
  dataAsOf: string;
  marketPriceAsOf: string;
  mode: MomentumEvaluationMode;
  modelVersionId: string;
  philosophyVersionId: string;
  universePolicyVersionId: string;
  setupDefinitionVersion: string;
  snapshotIds: string[];
  marketRegime: MarketRegimeEvaluation;
  universeDecision: UniverseDecision;
  setup: MomentumSetupEvaluation;
  score: MomentumScoreRange;
  factorResults: MomentumFactorResult[];
  confidence: EvaluationConfidence;
  action: MomentumAction;
  actionConstraints: string[];
  gateResults: MomentumGateResult[];
  tradePlan?: MomentumTradePlanV1;
  executionRisk: number;
  gapRisk: number;
  riskScoreDirection: "HIGHER_IS_RISKIER";
  evidenceIds: string[];
  scoringEvidenceIds: string[];
  counterEvidenceIds: string[];
  nextReviewAt: string;
  expiresAt: string;
  operationalStateChangeAllowed: boolean;
  explanation: MomentumExplanation;
  resultHash: string;
  momentumScore: number;
  relativeStrengthScore: number;
  volumeScore: number;
  catalystScore: number;
  liquidityScore: number;
  setupQualityScore: number;
  riskScore: number;
};

export type MomentumScanInput = {
  id: string;
  session: string;
  modelVersionId: string;
  universePolicyVersionId: string;
  createdAt: string;
  evaluations: MomentumEvaluationInput[];
};

export type MomentumScanFailure = {
  evaluationId: string;
  companyId: string;
  securityId: string;
  code: "INVALID_INPUT" | "POINT_IN_TIME_VIOLATION" | "VERSION_CONFLICT";
  message: string;
};

export type MomentumScanResult = {
  id: string;
  session: string;
  modelVersionId: string;
  universePolicyVersionId: string;
  createdAt: string;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  items: MomentumEvaluationResultV1[];
  failures: MomentumScanFailure[];
  resultHash: string;
};
