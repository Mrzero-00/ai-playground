import { createHash } from "node:crypto";
import {
  addDecimal,
  assertCurrency,
  assertDecimal,
  compareDecimal,
  decimalRatio,
  divideDecimalFloor,
  minDecimal,
  multiplyDecimal,
  multiplyDecimalByRatio,
  subtractDecimalFloorZero,
  type DecimalString,
} from "../decimal.js";
import { assertScore } from "../scoring.js";
import { projectExposureChanges } from "./exposure.js";
import { buildPortfolioLedger } from "./ledger.js";
import { validatePortfolioPolicyV1 } from "./policy.js";
import { calculateMomentumSizingV1, floorToLot, liquidityNotionalCapacity, type MomentumSizingResultV1 } from "./sizing.js";
import type {
  AllocationProposalV1,
  AllocationRequestV1,
  CapacityResultV1,
  CapacityStatus,
  DrawdownState,
  PortfolioLedgerV1,
  PortfolioWeightsV1,
} from "./types.js";

export function proposeAllocationV1(request: AllocationRequestV1): AllocationProposalV1 {
  validateRequest(request);
  const policy = validatePortfolioPolicyV1(request.policy);
  const ledger = buildPortfolioLedger(request.portfolioSnapshot);
  if (ledger.portfolioId !== request.portfolioId || request.portfolioSnapshot.userId !== request.userId) {
    throw new Error("Portfolio ownership does not match allocation request");
  }
  if (ledger.baseCurrency !== policy.baseCurrency) throw new Error("Portfolio snapshot and policy base currency conflict");
  const referencePriceBase = multiplyDecimal(request.currentPrice, request.fxRateToBase);
  const eligibility = evaluateEligibility(request);
  let momentumSizing: MomentumSizingResultV1 | undefined;
  if (request.strategy === "MOMENTUM" && eligibility.eligible) {
    momentumSizing = calculateMomentumSizingV1({
      request,
      ledger,
      policy,
      signal: request.sizingSignal.kind === "MOMENTUM" ? request.sizingSignal : fail("Momentum request requires Momentum sizing signal"),
      plan: request.momentumRiskPlan ?? fail("Momentum request requires risk plan"),
    });
  }
  const requestedAmount = calculateRequestedAmount(request, momentumSizing);
  const capacities = buildCapacities(request, ledger, requestedAmount, momentumSizing);
  const maximumApproved = minDecimal(...capacities.map((capacity) => capacity.maximumAdditionalAmount));
  const preliminary = eligibility.eligible ? maximumApproved : "0";
  const quantity = calculateExecutableQuantity(request, preliminary, momentumSizing, referencePriceBase);
  const approvedAmount = multiplyDecimal(quantity, momentumSizing?.referencePriceBase ?? referencePriceBase);
  const economicallyViable = compareDecimal(approvedAmount, policy.minimumEconomicAmountBase) >= 0;
  const effectiveAmount = economicallyViable ? approvedAmount : "0";
  updateCapacityProjections(capacities, effectiveAmount);
  const status = !eligibility.eligible ? eligibility.review ? "WAIT" : "REJECTED"
    : compareDecimal(effectiveAmount, "0") === 0 ? (compareDecimal(maximumApproved, "0") === 0 ? "REJECTED" : "WAIT")
      : compareDecimal(effectiveAmount, requestedAmount) < 0 ? "REDUCED" : "APPROVED";
  const constraintsTriggered = capacities.filter((capacity) => capacity.status !== "AVAILABLE").map((capacity) => capacity.reasonCode);
  if (!economicallyViable && compareDecimal(maximumApproved, "0") > 0) constraintsTriggered.push("BELOW_MINIMUM_ECONOMIC_SIZE");
  const exposureChanges = projectExposureChanges({
    ledger,
    companyId: request.companyId,
    sectorCode: request.sectorCode,
    industryCode: request.industryCode,
    themeKeys: request.themeKeys,
    additionalAmountBase: effectiveAmount,
  });
  const projectedWeights = calculateProjectedWeights(request, ledger, effectiveAmount);
  const scenarioRisk = momentumSizing === undefined ? undefined : multiplyDecimal(quantity, momentumSizing.scenarioLossPerUnitBase);
  const projectedOpenRisk = scenarioRisk === undefined ? ledger.momentumOpenRiskBase : addDecimal(ledger.momentumOpenRiskBase, scenarioRisk);
  const drawdownState = inferDrawdownState(request.momentumRiskPlan?.drawdownMultiplier);
  const withoutHash: Omit<AllocationProposalV1, "resultHash"> = {
    id: request.id,
    portfolioId: request.portfolioId,
    companyId: request.companyId,
    securityId: request.securityId,
    generatedAt: request.generatedAt,
    expiresAt: request.expiresAt,
    mode: request.mode,
    strategy: request.strategy,
    lotStrategy: request.lotStrategy,
    action: request.action,
    currency: ledger.baseCurrency,
    baseCurrency: ledger.baseCurrency,
    requestedAmount,
    approvedAmount: effectiveAmount,
    executableQuantity: quantity,
    referencePrice: momentumSizing?.referencePriceBase ?? referencePriceBase,
    ...(momentumSizing === undefined ? {} : {
      allowedRiskAmount: momentumSizing.allowedRiskAmountBase,
      scenarioLossPerUnit: momentumSizing.scenarioLossPerUnitBase,
      projectedOpenRisk,
    }),
    status,
    capacities,
    currentWeights: { ...ledger.weights },
    projectedWeights,
    exposureChanges,
    constraintsTriggered: [...new Set(constraintsTriggered)],
    reasons: buildReasons(status, eligibility.reasons, constraintsTriggered),
    riskHandoff: {
      portfolioValueBase: ledger.investableNavBase,
      approvedAmountBase: effectiveAmount,
      currentCompanyExposureBase: ledger.exposures.company[request.companyId] ?? "0",
      projectedCompanyExposureBase: addDecimal(ledger.exposures.company[request.companyId] ?? "0", effectiveAmount),
      currentMomentumOpenRiskBase: ledger.momentumOpenRiskBase,
      projectedMomentumOpenRiskBase: projectedOpenRisk,
      drawdownState,
      stressResultIds: [],
      requiresManualReview: eligibility.review || exposureChanges.some((change) => change.projectedWeight >= 0.9 * hardLimitFor(change.dimension, policy)),
      flags: [...new Set(constraintsTriggered)],
    },
    evaluationId: request.sizingSignal.evaluationId,
    ...(request.momentumRiskPlan === undefined ? {} : { tradePlanId: request.momentumRiskPlan.tradePlanId }),
    portfolioSnapshotId: request.portfolioSnapshot.id,
    snapshotIds: [...request.snapshotIds],
    policyVersionId: policy.version,
    operationalStateChangeAllowed: request.mode !== "HISTORICAL_REPLAY",
  };
  return { ...withoutHash, resultHash: stableHash(withoutHash) };
}

export function replayAllocationV1(request: AllocationRequestV1): AllocationProposalV1 {
  return proposeAllocationV1({ ...structuredClone(request), mode: "HISTORICAL_REPLAY" });
}

function validateRequest(request: AllocationRequestV1): void {
  for (const [name, value] of Object.entries({
    id: request.id, portfolioId: request.portfolioId, userId: request.userId,
    companyId: request.companyId, securityId: request.securityId, sectorCode: request.sectorCode, industryCode: request.industryCode,
  })) if (!value.trim()) throw new Error(`Allocation request ${name} is required`);
  const generatedAt = parseDate(request.generatedAt, "generatedAt");
  const expiresAt = parseDate(request.expiresAt, "expiresAt");
  if (expiresAt <= generatedAt) throw new Error("Allocation proposal must expire after generation");
  if (parseDate(request.portfolioSnapshot.asOf, "portfolioSnapshot.asOf") > generatedAt) throw new Error("Portfolio snapshot is future information");
  if (parseDate(request.policy.effectiveFrom, "policy.effectiveFrom") > generatedAt) throw new Error("Portfolio policy is not yet effective");
  assertCurrency(request.assetCurrency);
  assertDecimal(request.currentPrice, "currentPrice");
  assertDecimal(request.fxRateToBase, "fxRateToBase");
  if (compareDecimal(request.currentPrice, "0") <= 0 || compareDecimal(request.fxRateToBase, "0") <= 0) throw new Error("price and FX rate must be positive");
  if (request.assetCurrency === request.policy.baseCurrency && request.fxRateToBase !== "1") throw new Error("base-currency request FX rate must be 1");
  if (request.snapshotIds.length === 0 || !request.snapshotIds.includes(request.portfolioSnapshot.id)) throw new Error("Allocation request must link the Portfolio snapshot");
  if (new Set(request.snapshotIds).size !== request.snapshotIds.length) throw new Error("Allocation request snapshotIds must be unique");
  if (new Set(request.themeKeys).size !== request.themeKeys.length) throw new Error("Allocation request themeKeys must be unique");
  if (request.strategy === "MOMENTUM") {
    if (request.lotStrategy !== "MOMENTUM" || request.fundingBucket !== "MOMENTUM" || request.action !== "ENTER" || request.sizingSignal.kind !== "MOMENTUM") {
      throw new Error("Momentum allocation must use Momentum Lot, Bucket, ENTER action and signal");
    }
  } else if (request.lotStrategy === "MOMENTUM" || request.fundingBucket !== "LONG_TERM" || request.action === "ENTER" || request.sizingSignal.kind !== "LONG_TERM") {
    throw new Error("Long-term allocation must use Core/Future Core Lot, Long-term Bucket and signal");
  }
  if (request.lotStrategy === "CORE" && request.sizingSignal.kind === "LONG_TERM" && request.sizingSignal.profile !== "CORE") throw new Error("Core Lot requires Core evaluation profile");
  if (request.lotStrategy === "FUTURE_CORE" && request.sizingSignal.kind === "LONG_TERM" && request.sizingSignal.profile !== "FUTURE_CORE") throw new Error("Future Core Lot requires Future Core evaluation profile");
  if (request.requestedAmountBase !== undefined) {
    assertDecimal(request.requestedAmountBase, "requestedAmountBase");
    if (compareDecimal(request.requestedAmountBase, "0") <= 0) throw new Error("requestedAmountBase must be positive");
  }
  if (request.requestedRiskAmountBase !== undefined) {
    assertDecimal(request.requestedRiskAmountBase, "requestedRiskAmountBase");
    if (compareDecimal(request.requestedRiskAmountBase, "0") <= 0) throw new Error("requestedRiskAmountBase must be positive");
  }
}

function evaluateEligibility(request: AllocationRequestV1): { eligible: boolean; review: boolean; reasons: string[] } {
  const signal = request.sizingSignal;
  assertScore("sizing score", signal.score);
  assertScore("sizing confidence", signal.confidence);
  if (signal.kind === "MOMENTUM") {
    if (signal.action === "REVIEW_REQUIRED") return { eligible: false, review: true, reasons: ["MOMENTUM_REVIEW_REQUIRED"] };
    if (signal.action !== "ENTER") return { eligible: false, review: false, reasons: [`MOMENTUM_ACTION_${signal.action}`] };
    if (!signal.tradePlanId) return { eligible: false, review: false, reasons: ["MOMENTUM_TRADE_PLAN_MISSING"] };
  } else {
    if (signal.action === "REVIEW_REQUIRED") return { eligible: false, review: true, reasons: ["LONG_TERM_REVIEW_REQUIRED"] };
    if (signal.action !== "ACCUMULATE" && signal.action !== "BUY_ON_WEAKNESS") return { eligible: false, review: false, reasons: [`LONG_TERM_ACTION_${signal.action}`] };
    if (signal.thesisStatus === "BROKEN") return { eligible: false, review: false, reasons: ["THESIS_BROKEN"] };
  }
  return { eligible: true, review: false, reasons: [] };
}

function calculateRequestedAmount(request: AllocationRequestV1, momentum?: MomentumSizingResultV1): DecimalString {
  if (request.strategy === "LONG_TERM") return request.requestedAmountBase ?? fail("Long-term allocation requires requestedAmountBase");
  const riskAmount = momentum?.riskNotionalBase ?? "0";
  return request.requestedAmountBase === undefined ? riskAmount : minDecimal(request.requestedAmountBase, riskAmount);
}

function buildCapacities(
  request: AllocationRequestV1,
  ledger: PortfolioLedgerV1,
  requested: DecimalString,
  momentum: MomentumSizingResultV1 | undefined,
): CapacityResultV1[] {
  const { policy } = request;
  const nav = ledger.investableNavBase;
  const cash = request.fundingBucket === "LONG_TERM" ? ledger.availableLongTermCashBase : ledger.availableMomentumCashBase;
  const strategyCurrent = request.strategy === "LONG_TERM" ? ledger.longTermPositionValueBase : ledger.momentumPositionValueBase;
  const strategyLimit = request.strategy === "LONG_TERM" ? policy.longTerm.hardMax : policy.momentum.hardMax;
  const currentCompany = ledger.exposures.company[request.companyId] ?? "0";
  const currentSector = ledger.exposures.sector[request.sectorCode] ?? "0";
  const currentIndustry = ledger.exposures.industry[request.industryCode] ?? "0";
  const sameLotStrategyValue = request.portfolioSnapshot.positions
    .filter((position) => position.companyId === request.companyId && position.strategy === request.lotStrategy)
    .reduce((sum, position) => addDecimal(sum, position.marketValueBase), "0" as DecimalString);
  const positionLimitRatio = request.lotStrategy === "FUTURE_CORE" ? policy.futureCorePositionHardMax : policy.corePositionHardMax;
  const capacities = [
    capacity("REQUESTED", requested, "0", requested, requested, "REQUEST_CAP"),
    capacity("CASH", cash, "0", cash, requested, "CASH_CAPACITY"),
    ratioCapacity("STRATEGY_BUCKET", nav, strategyLimit, strategyCurrent, requested, "STRATEGY_BUCKET_LIMIT"),
    ratioCapacity("COMPANY_GROSS", nav, policy.companyGrossHardMax, currentCompany, requested, "COMPANY_GROSS_LIMIT"),
    ratioCapacity("SECTOR_GROSS", nav, policy.sectorGrossHardMax, currentSector, requested, "SECTOR_GROSS_LIMIT"),
    ratioCapacity("INDUSTRY_GROSS", nav, policy.industryGrossHardMax, currentIndustry, requested, "INDUSTRY_GROSS_LIMIT"),
    ratioCapacity("POSITION", nav, positionLimitRatio, sameLotStrategyValue, requested, "POSITION_LIMIT"),
    capacity("LIQUIDITY", liquidityNotionalCapacity(request.liquidity, policy), "0", liquidityNotionalCapacity(request.liquidity, policy), requested, "LIQUIDITY_CAPACITY"),
  ];
  if (request.lotStrategy === "FUTURE_CORE") {
    capacities.push(ratioCapacity("FUTURE_CORE", nav, policy.futureCore.hardMax, ledger.futureCorePositionValueBase, requested, "FUTURE_CORE_LIMIT"));
  }
  for (const theme of request.themeKeys) {
    capacities.push(ratioCapacity(`THEME:${theme}`, nav, policy.themeGrossHardMax, ledger.exposures.theme[theme] ?? "0", requested, `THEME_LIMIT:${theme}`));
  }
  if (request.strategy === "MOMENTUM") {
    capacities.push(capacity(
      "MOMENTUM_RISK_NOTIONAL",
      momentum?.riskNotionalBase ?? "0",
      "0",
      momentum?.riskNotionalBase ?? "0",
      requested,
      "MOMENTUM_OPEN_RISK_LIMIT",
    ));
  }
  return capacities;
}

function ratioCapacity(
  id: string,
  nav: DecimalString,
  ratio: number,
  current: DecimalString,
  requested: DecimalString,
  reason: string,
): CapacityResultV1 {
  const hard = multiplyDecimalByRatio(nav, ratio);
  return capacity(id, subtractDecimalFloorZero(hard, current), current, hard, requested, reason);
}

function capacity(
  id: string,
  maximum: DecimalString,
  current: DecimalString,
  hard: DecimalString,
  requested: DecimalString,
  reason: string,
): CapacityResultV1 {
  const status: CapacityStatus = compareDecimal(maximum, "0") === 0 ? "EXHAUSTED"
    : compareDecimal(maximum, requested) < 0 ? "LIMITED" : "AVAILABLE";
  return {
    capacityId: id,
    status,
    maximumAdditionalAmount: maximum,
    currentValue: current,
    projectedValue: addDecimal(current, minDecimal(maximum, requested)),
    hardLimitValue: hard,
    reasonCode: reason,
  };
}

function calculateExecutableQuantity(
  request: AllocationRequestV1,
  maximumAmount: DecimalString,
  momentum: MomentumSizingResultV1 | undefined,
  referencePriceBase: DecimalString,
): DecimalString {
  const price = momentum?.referencePriceBase ?? referencePriceBase;
  const amountQuantity = floorToLot(divideDecimalFloor(maximumAmount, price, 6), request.liquidity);
  return momentum === undefined ? amountQuantity : minQuantity(amountQuantity, momentum.executableRiskQuantity);
}

function minQuantity(left: DecimalString, right: DecimalString): DecimalString {
  return compareDecimal(left, right) <= 0 ? left : right;
}

function updateCapacityProjections(capacities: CapacityResultV1[], approved: DecimalString): void {
  for (const capacityItem of capacities) capacityItem.projectedValue = addDecimal(capacityItem.currentValue, approved);
}

function calculateProjectedWeights(request: AllocationRequestV1, ledger: PortfolioLedgerV1, amount: DecimalString): PortfolioWeightsV1 {
  const invested = addDecimal(ledger.investedValueBase, amount);
  const cash = subtractDecimalFloorZero(ledger.totalCashBase, amount);
  const futureCore = request.lotStrategy === "FUTURE_CORE"
    ? addDecimal(ledger.futureCorePositionValueBase, amount) : ledger.futureCorePositionValueBase;
  return {
    longTerm: ledger.weights.longTerm,
    momentum: ledger.weights.momentum,
    futureCore: decimalRatio(futureCore, ledger.investableNavBase),
    commonReserve: ledger.weights.commonReserve,
    invested: decimalRatio(invested, ledger.investableNavBase),
    cash: decimalRatio(cash, ledger.investableNavBase),
  };
}

function buildReasons(status: AllocationProposalV1["status"], eligibility: string[], constraints: string[]): string[] {
  if (eligibility.length > 0) return eligibility;
  if (status === "APPROVED") return ["PORTFOLIO_CAPACITY_AVAILABLE", "RISK_REVIEW_REQUIRED"];
  if (status === "REDUCED") return ["PORTFOLIO_CAPACITY_REDUCED", ...new Set(constraints)];
  if (status === "WAIT") return ["PORTFOLIO_REVIEW_OR_ECONOMIC_SIZE_REQUIRED", ...new Set(constraints)];
  return ["PORTFOLIO_CAPACITY_EXHAUSTED", ...new Set(constraints)];
}

function inferDrawdownState(multiplier: number | undefined): DrawdownState {
  if (multiplier === undefined || multiplier === 1) return "NORMAL";
  if (multiplier >= 0.75) return "CAUTION";
  if (multiplier > 0) return "REDUCED_RISK";
  return "PAUSE";
}

function hardLimitFor(dimension: "COMPANY" | "SECTOR" | "INDUSTRY" | "THEME", policy: AllocationRequestV1["policy"]): number {
  return dimension === "COMPANY" ? policy.companyGrossHardMax
    : dimension === "SECTOR" ? policy.sectorGrossHardMax
      : dimension === "INDUSTRY" ? policy.industryGrossHardMax : policy.themeGrossHardMax;
}

function stableHash(value: unknown): string { return createHash("sha256").update(stableStringify(value)).digest("hex"); }
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
function fail(message: string): never { throw new Error(message); }
