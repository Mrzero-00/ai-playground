import {
  addDecimal,
  assertDecimal,
  compareDecimal,
  divideDecimalFloor,
  maxDecimal,
  minDecimal,
  multiplyDecimal,
  multiplyDecimalByRatio,
  subtractDecimal,
  subtractDecimalFloorZero,
  type DecimalString,
} from "../decimal.js";
import { assertScore } from "../scoring.js";
import type {
  AllocationRequestV1,
  LiquidityCapacityInputV1,
  MomentumRiskPlanInput,
  MomentumSizingSignalV1,
  PortfolioLedgerV1,
  PortfolioPolicyV1,
} from "./types.js";

export type MomentumSizingResultV1 = {
  referencePriceBase: DecimalString;
  scenarioLossPerUnitBase: DecimalString;
  allowedRiskAmountBase: DecimalString;
  openRiskRemainingBase: DecimalString;
  rawQuantity: DecimalString;
  executableRiskQuantity: DecimalString;
  riskNotionalBase: DecimalString;
  projectedOpenRiskBase: DecimalString;
};

export function calculateMomentumSizingV1(input: {
  request: AllocationRequestV1;
  ledger: PortfolioLedgerV1;
  policy: PortfolioPolicyV1;
  signal: MomentumSizingSignalV1;
  plan: MomentumRiskPlanInput;
}): MomentumSizingResultV1 {
  const { request, ledger, policy, signal, plan } = input;
  if (signal.action !== "ENTER" || signal.tradePlanId !== plan.tradePlanId) throw new Error("Momentum sizing requires an ENTER evaluation and matching trade plan");
  assertScore("Momentum score", signal.score);
  assertScore("Momentum confidence", signal.confidence);
  validateMultiplier("marketRegimeMultiplier", signal.marketRegimeMultiplier);
  validateMultiplier("drawdownMultiplier", plan.drawdownMultiplier);
  if (!plan.eventPolicyValid) throw new Error("Momentum sizing requires a valid event policy");
  if (new Date(plan.expiresAt).getTime() <= new Date(request.generatedAt).getTime()) throw new Error("Momentum trade plan is expired");
  for (const [name, value] of Object.entries({
    referenceEntry: plan.referenceEntry,
    initialStop: plan.initialStop,
    estimatedCostPerUnitBase: plan.estimatedCostPerUnitBase,
    fxRateToBase: request.fxRateToBase,
  })) {
    assertDecimal(value, name);
    if (name !== "estimatedCostPerUnitBase" && compareDecimal(value, "0") <= 0) throw new Error(`${name} must be positive`);
  }
  if (compareDecimal(plan.initialStop, plan.referenceEntry) >= 0) throw new Error("Momentum initial stop must be below reference entry");
  const stopRiskAsset = subtractDecimal(plan.referenceEntry, plan.initialStop);
  assertDecimal(stopRiskAsset, "stop risk per unit");
  const stopRiskBase = multiplyDecimal(stopRiskAsset, request.fxRateToBase);
  const costAdjustedStopRisk = addNonNegative(stopRiskBase, plan.estimatedCostPerUnitBase);
  const gapRisk = plan.gapScenarioLossPerUnitBase ?? "0";
  assertDecimal(gapRisk, "gapScenarioLossPerUnitBase");
  const scenarioLossPerUnitBase = maxDecimal(costAdjustedStopRisk, gapRisk);
  if (compareDecimal(scenarioLossPerUnitBase, "0") <= 0) throw new Error("Momentum scenario loss per unit must be positive");

  let allowedRiskAmountBase = multiplyDecimalByRatio(ledger.investableNavBase, policy.momentumBaseRiskPerTrade);
  allowedRiskAmountBase = multiplyDecimalByRatio(allowedRiskAmountBase, qualityMultiplier(signal.score, signal.confidence));
  allowedRiskAmountBase = multiplyDecimalByRatio(allowedRiskAmountBase, signal.marketRegimeMultiplier);
  allowedRiskAmountBase = multiplyDecimalByRatio(allowedRiskAmountBase, plan.drawdownMultiplier);
  allowedRiskAmountBase = multiplyDecimalByRatio(allowedRiskAmountBase, liquidityRiskMultiplier(signal.liquidityTier));
  const maxTradeRisk = multiplyDecimalByRatio(ledger.investableNavBase, policy.momentumMaxRiskPerTrade);
  const openRiskHardMax = multiplyDecimalByRatio(ledger.investableNavBase, policy.momentumOpenRiskHardMax);
  const openRiskRemainingBase = subtractDecimalFloorZero(openRiskHardMax, ledger.momentumOpenRiskBase);
  const requestedRisk = request.requestedRiskAmountBase ?? allowedRiskAmountBase;
  assertDecimal(requestedRisk, "requestedRiskAmountBase");
  allowedRiskAmountBase = minDecimal(allowedRiskAmountBase, maxTradeRisk, openRiskRemainingBase, requestedRisk);

  const rawQuantity = divideDecimalFloor(allowedRiskAmountBase, scenarioLossPerUnitBase, 6);
  const executableRiskQuantity = floorToLot(rawQuantity, request.liquidity);
  const referencePriceBase = multiplyDecimal(plan.referenceEntry, request.fxRateToBase);
  const riskNotionalBase = multiplyDecimal(executableRiskQuantity, referencePriceBase);
  const projectedOpenRiskBase = addNonNegative(
    ledger.momentumOpenRiskBase,
    multiplyDecimal(executableRiskQuantity, scenarioLossPerUnitBase),
  );
  return {
    referencePriceBase,
    scenarioLossPerUnitBase,
    allowedRiskAmountBase,
    openRiskRemainingBase,
    rawQuantity,
    executableRiskQuantity,
    riskNotionalBase,
    projectedOpenRiskBase,
  };
}

export function liquidityNotionalCapacity(input: LiquidityCapacityInputV1, policy: PortfolioPolicyV1): DecimalString {
  assertDecimal(input.addv20Base, "addv20Base");
  assertDecimal(input.lotSize, "lotSize");
  if (compareDecimal(input.addv20Base, "0") <= 0 || compareDecimal(input.lotSize, "0") <= 0) throw new Error("liquidity ADDV and lotSize must be positive");
  if (!Number.isInteger(input.maximumExitDays) || input.maximumExitDays <= 0) throw new Error("maximumExitDays must be a positive integer");
  const rate = policy.liquidityParticipationByTier[input.liquidityTier];
  let capacity = multiplyDecimalByRatio(input.addv20Base, rate);
  for (let day = 1; day < input.maximumExitDays; day++) capacity = addNonNegative(capacity, multiplyDecimalByRatio(input.addv20Base, rate));
  return capacity;
}

export function floorToLot(quantity: DecimalString, liquidity: LiquidityCapacityInputV1): DecimalString {
  assertDecimal(quantity, "quantity");
  const precision = liquidity.fractionalSharesAllowed ? 6 : 0;
  const normalized = divideDecimalFloor(quantity, "1", precision);
  const lotCount = divideDecimalFloor(normalized, liquidity.lotSize, 0);
  return multiplyDecimal(lotCount, liquidity.lotSize);
}

function qualityMultiplier(score: number, confidence: number): number {
  if (score >= 85 && confidence >= 80) return 1;
  if (score >= 75 && confidence >= 80) return 0.75;
  if (score >= 75 && confidence >= 70) return 0.6;
  return 0;
}

function liquidityRiskMultiplier(tier: MomentumSizingSignalV1["liquidityTier"]): number {
  return tier === "L1" ? 1 : tier === "L2" ? 0.8 : tier === "L3" ? 0.5 : 0;
}

function validateMultiplier(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`);
}

function addNonNegative(left: DecimalString, right: DecimalString): DecimalString {
  return addDecimal(left, right);
}
