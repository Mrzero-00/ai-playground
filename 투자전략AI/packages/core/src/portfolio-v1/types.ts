import type { CurrencyCode, DecimalString, SignedDecimalString } from "../decimal.js";
import type { CapitalSource } from "../capital-allocation.js";

export type AllocationLimit = {
  target: number;
  softMin: number;
  softMax: number;
  hardMax: number;
};

export type PortfolioPolicyV1 = {
  id: string;
  version: string;
  baseCurrency: CurrencyCode;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  effectiveFrom: string;
  longTerm: AllocationLimit;
  momentum: AllocationLimit;
  futureCore: AllocationLimit;
  commonReserveTarget: number;
  corePositionHardMax: number;
  futureCorePositionHardMax: number;
  companyGrossHardMax: number;
  sectorGrossHardMax: number;
  industryGrossHardMax: number;
  themeGrossHardMax: number;
  momentumBaseRiskPerTrade: number;
  momentumMaxRiskPerTrade: number;
  momentumOpenRiskHardMax: number;
  momentumSectorOpenRiskHardMax: number;
  momentumThemeOpenRiskHardMax: number;
  liquidityParticipationByTier: Record<"L1" | "L2" | "L3" | "INELIGIBLE", number>;
  minimumEconomicAmountBase: DecimalString;
  proposalTtlMinutes: number;
  leverageAllowed: false;
};

export type EconomicExposure = {
  dimension: "THEME" | "CUSTOMER" | "SUPPLIER" | "MACRO" | "REGULATORY";
  key: string;
  sensitivity: number;
  confidence: number;
  evidenceIds: string[];
};

export type PositionSnapshotV1 = {
  lotId: string;
  companyId: string;
  securityId: string;
  strategy: "CORE" | "FUTURE_CORE" | "MOMENTUM";
  quantity: DecimalString;
  marketPrice: DecimalString;
  assetCurrency: CurrencyCode;
  fxRateToBase: DecimalString;
  marketValueBase: DecimalString;
  costBasisBase: DecimalString;
  stopPrice?: DecimalString;
  gapScenarioLossPerUnitBase?: DecimalString;
  sectorCode: string;
  industryCode: string;
  exposureTags: EconomicExposure[];
  liquidityTier: "L1" | "L2" | "L3" | "INELIGIBLE";
};

export type CashBalanceV1 = {
  id: string;
  currency: CurrencyCode;
  amount: DecimalString;
  fxRateToBase: DecimalString;
  amountBase: DecimalString;
  owner: "LONG_TERM" | "MOMENTUM" | "COMMON_RESERVE";
  available: boolean;
  settlementDate?: string;
};

export type PortfolioSnapshotV1 = {
  id: string;
  portfolioId: string;
  userId: string;
  baseCurrency: CurrencyCode;
  asOf: string;
  positions: PositionSnapshotV1[];
  cashBalances: CashBalanceV1[];
  liabilitiesBase: DecimalString;
  reservedCashBase: DecimalString;
  fxSnapshotId: string;
  marketSnapshotIds: string[];
  complete: boolean;
  anomalyFlags: string[];
};

export type PortfolioWeightsV1 = {
  longTerm: number;
  momentum: number;
  futureCore: number;
  commonReserve: number;
  invested: number;
  cash: number;
};

export type ExposureSnapshotV1 = {
  company: Record<string, DecimalString>;
  sector: Record<string, DecimalString>;
  industry: Record<string, DecimalString>;
  theme: Record<string, DecimalString>;
  currency: Record<string, DecimalString>;
};

export type PortfolioLedgerV1 = {
  portfolioSnapshotId: string;
  portfolioId: string;
  baseCurrency: CurrencyCode;
  asOf: string;
  grossAssetValueBase: DecimalString;
  investableNavBase: DecimalString;
  investedValueBase: DecimalString;
  totalCashBase: DecimalString;
  availableLongTermCashBase: DecimalString;
  availableMomentumCashBase: DecimalString;
  availableCommonReserveBase: DecimalString;
  longTermPositionValueBase: DecimalString;
  momentumPositionValueBase: DecimalString;
  futureCorePositionValueBase: DecimalString;
  momentumOpenRiskBase: DecimalString;
  weights: PortfolioWeightsV1;
  exposures: ExposureSnapshotV1;
  warnings: string[];
};

export type LongTermSizingSignalV1 = {
  kind: "LONG_TERM";
  evaluationId: string;
  profile: "CORE" | "FUTURE_CORE";
  action: "ACCUMULATE" | "BUY_ON_WEAKNESS" | "HOLD" | "WATCH" | "REVIEW_REQUIRED" | "EXIT";
  score: number;
  confidence: number;
  valuationClassification: string;
  thesisStatus: string;
  stage: string;
};

export type MomentumSizingSignalV1 = {
  kind: "MOMENTUM";
  evaluationId: string;
  setupId: string;
  action: "ENTER" | "WAIT" | "AVOID" | "REVIEW_REQUIRED" | "EXIT";
  score: number;
  confidence: number;
  marketRegimeMultiplier: number;
  liquidityTier: "L1" | "L2" | "L3" | "INELIGIBLE";
  tradePlanId?: string;
};

export type MomentumRiskPlanInput = {
  tradePlanId: string;
  referenceEntry: DecimalString;
  initialStop: DecimalString;
  gapScenarioLossPerUnitBase?: DecimalString;
  estimatedCostPerUnitBase: DecimalString;
  drawdownMultiplier: number;
  eventPolicyValid: boolean;
  expiresAt: string;
};

export type LiquidityCapacityInputV1 = {
  addv20Base: DecimalString;
  liquidityTier: "L1" | "L2" | "L3" | "INELIGIBLE";
  maximumExitDays: number;
  lotSize: DecimalString;
  fractionalSharesAllowed: boolean;
};

export type AllocationRequestV1 = {
  id: string;
  portfolioId: string;
  userId: string;
  generatedAt: string;
  expiresAt: string;
  mode: "SINGLE" | "NEW_CAPITAL" | "REBALANCE" | "HISTORICAL_REPLAY";
  strategy: "LONG_TERM" | "MOMENTUM";
  lotStrategy: "CORE" | "FUTURE_CORE" | "MOMENTUM";
  fundingBucket: "LONG_TERM" | "MOMENTUM";
  companyId: string;
  securityId: string;
  sectorCode: string;
  industryCode: string;
  themeKeys: string[];
  action: "BUY" | "ACCUMULATE" | "ENTER";
  requestedAmountBase?: DecimalString;
  requestedRiskAmountBase?: DecimalString;
  currentPrice: DecimalString;
  assetCurrency: CurrencyCode;
  fxRateToBase: DecimalString;
  sizingSignal: LongTermSizingSignalV1 | MomentumSizingSignalV1;
  momentumRiskPlan?: MomentumRiskPlanInput;
  portfolioSnapshot: PortfolioSnapshotV1;
  policy: PortfolioPolicyV1;
  liquidity: LiquidityCapacityInputV1;
  snapshotIds: string[];
};

export type CapacityStatus = "AVAILABLE" | "LIMITED" | "EXHAUSTED" | "UNKNOWN";

export type CapacityResultV1 = {
  capacityId: string;
  status: CapacityStatus;
  maximumAdditionalAmount: DecimalString;
  currentValue: DecimalString;
  projectedValue: DecimalString;
  hardLimitValue: DecimalString;
  reasonCode: string;
};

export type ExposureChangeV1 = {
  dimension: "COMPANY" | "SECTOR" | "INDUSTRY" | "THEME";
  key: string;
  currentAmountBase: DecimalString;
  projectedAmountBase: DecimalString;
  projectedWeight: number;
};

export type DrawdownState = "NORMAL" | "CAUTION" | "REDUCED_RISK" | "PAUSE" | "REVIEW_REQUIRED";

export type PortfolioRiskHandoffV1 = {
  portfolioValueBase: DecimalString;
  approvedAmountBase: DecimalString;
  currentCompanyExposureBase: DecimalString;
  projectedCompanyExposureBase: DecimalString;
  currentMomentumOpenRiskBase: DecimalString;
  projectedMomentumOpenRiskBase: DecimalString;
  drawdownState: DrawdownState;
  stressResultIds: string[];
  requiresManualReview: boolean;
  flags: string[];
};

export type AllocationProposalV1 = {
  id: string;
  portfolioId: string;
  companyId: string;
  securityId: string;
  generatedAt: string;
  expiresAt: string;
  mode: AllocationRequestV1["mode"];
  strategy: "LONG_TERM" | "MOMENTUM";
  lotStrategy: "CORE" | "FUTURE_CORE" | "MOMENTUM";
  action: "BUY" | "ACCUMULATE" | "ENTER";
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  requestedAmount: DecimalString;
  approvedAmount: DecimalString;
  executableQuantity: DecimalString;
  referencePrice: DecimalString;
  allowedRiskAmount?: DecimalString;
  scenarioLossPerUnit?: DecimalString;
  projectedOpenRisk?: DecimalString;
  status: "APPROVED" | "REDUCED" | "WAIT" | "REJECTED";
  capacities: CapacityResultV1[];
  currentWeights: PortfolioWeightsV1;
  projectedWeights: PortfolioWeightsV1;
  exposureChanges: ExposureChangeV1[];
  constraintsTriggered: string[];
  reasons: string[];
  riskHandoff: PortfolioRiskHandoffV1;
  evaluationId: string;
  tradePlanId?: string;
  portfolioSnapshotId: string;
  snapshotIds: string[];
  policyVersionId: string;
  operationalStateChangeAllowed: boolean;
  resultHash: string;
};

export type PortfolioStressScenarioV1 = {
  id: string;
  version: string;
  name: string;
  marketShockPercent: number;
  sectorShocks: Record<string, number>;
  themeShocks: Record<string, number>;
  currencyShocks: Record<string, number>;
  liquidityHaircut: number;
  momentumGapMultiplier: number;
  assumptions: string[];
};

export type StressContributionV1 = {
  lotId: string;
  companyId: string;
  estimatedLossBase: DecimalString;
};

export type PortfolioStressResultV1 = {
  id: string;
  portfolioSnapshotId: string;
  scenarioId: string;
  scenarioVersion: string;
  evaluatedAt: string;
  estimatedLossBase: SignedDecimalString;
  estimatedLossPercent: number;
  bucketLosses: Record<string, SignedDecimalString>;
  topContributors: StressContributionV1[];
  breachedLimitIds: string[];
  cashAfterStressBase: DecimalString;
  forcedSaleRisk: boolean;
  resultHash: string;
};

export type CapitalAllocationBatchInputV1 = {
  id: string;
  portfolioId: string;
  userId: string;
  generatedAt: string;
  dataAsOf: string;
  capitalSource: CapitalSource;
  availableAmount: DecimalString;
  currency: CurrencyCode;
  requests: AllocationRequestV1[];
  stressSummary: string;
};

export type CapitalAllocationDecisionV1 = {
  id: string;
  portfolioId: string;
  userId: string;
  generatedAt: string;
  dataAsOf: string;
  capitalSource: CapitalSource;
  availableAmount: DecimalString;
  currency: CurrencyCode;
  currentWeights: PortfolioWeightsV1;
  targetWeights: PortfolioWeightsV1;
  projectedWeights: PortfolioWeightsV1;
  proposals: AllocationProposalV1[];
  cashRetained: DecimalString;
  constraintsTriggered: string[];
  stressSummary: string;
  finalRecommendation: string;
  snapshotIds: string[];
  portfolioSnapshotId: string;
  policyVersionId: string;
  resultHash: string;
};

export type RebalanceActionV1 =
  | "NEW_MONEY_TO_UNDERWEIGHT"
  | "FREEZE_NEW_RISK"
  | "REDUCE_POSITION"
  | "TRANSFER_CASH"
  | "REVIEW_REQUIRED"
  | "NO_ACTION";

export type RebalanceActionItemV1 = {
  action: RebalanceActionV1;
  scope: "PORTFOLIO" | "BUCKET" | "COMPANY" | "SECTOR" | "INDUSTRY" | "THEME" | "MOMENTUM_RISK";
  key: string;
  priority: number;
  currentValue: DecimalString;
  limitValue?: DecimalString;
  reasonCode: string;
  automaticExecutionAllowed: false;
};

export type PortfolioRebalanceInputV1 = {
  id: string;
  portfolioId: string;
  userId: string;
  generatedAt: string;
  trigger: "NEW_CAPITAL" | "SCHEDULED_REVIEW" | "LIMIT_BREACH" | "THESIS_CHANGE" | "POSITION_CLOSED" | "FX_MOVE";
  snapshot: PortfolioSnapshotV1;
  policy: PortfolioPolicyV1;
};

export type PortfolioRebalanceReviewV1 = {
  id: string;
  portfolioId: string;
  userId: string;
  generatedAt: string;
  dataAsOf: string;
  trigger: PortfolioRebalanceInputV1["trigger"];
  portfolioSnapshotId: string;
  policyVersionId: string;
  currentWeights: PortfolioWeightsV1;
  actions: RebalanceActionItemV1[];
  requiresManualReview: boolean;
  automaticOrdersAllowed: false;
  summary: string;
  resultHash: string;
};
