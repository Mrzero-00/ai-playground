import {
  addDecimal,
  assertCurrency,
  assertDecimal,
  compareDecimal,
  decimalRatio,
  minDecimal,
  multiplyDecimalByRatio,
  subtractDecimalFloorZero,
  type CurrencyCode,
  type DecimalString,
} from "./decimal.js";
import type { DecisionAction } from "./philosophy-policy.js";

type AllocationAction = Extract<DecisionAction, "BUY" | "ACCUMULATE" | "ENTER">;

export type PortfolioPolicy = {
  longTermTarget: number;
  longTermHardMax: number;
  momentumTarget: number;
  momentumHardMax: number;
  futureCoreHardMax: number;
  futureCoreMaxSinglePosition: number;
  maxSinglePosition: number;
  leverageAllowed: false;
};

export type Allocation = {
  capital: number;
  longTerm: number;
  momentum: number;
  maxSinglePosition: number;
};

export type DecimalAllocation = {
  capital: DecimalString;
  currency: CurrencyCode;
  longTerm: DecimalString;
  momentum: DecimalString;
  maxSinglePosition: DecimalString;
};

export type AllocationProposal = {
  id: string;
  portfolioId: string;
  generatedAt: string;
  expiresAt: string;
  strategy: "LONG_TERM" | "MOMENTUM";
  action: AllocationAction;
  lotStrategy?: "CORE" | "FUTURE_CORE" | "MOMENTUM";
  companyId?: string;
  requestedAmount: DecimalString;
  approvedAmount: DecimalString;
  currency: CurrencyCode;
  currentStrategyWeight: number;
  projectedStrategyWeight: number;
  currentCompanyWeight: number;
  projectedCompanyWeight: number;
  status: "APPROVED" | "REDUCED" | "WAIT" | "REJECTED";
  reasons: string[];
  constraintsTriggered: string[];
  inputEvaluationIds: string[];
  snapshotIds: string[];
  policyVersionId: string;
};

export type AllocationRequest = {
  id: string;
  portfolioId: string;
  generatedAt: string;
  expiresAt: string;
  strategy: "LONG_TERM" | "MOMENTUM";
  action?: AllocationAction;
  lotStrategy?: "CORE" | "FUTURE_CORE" | "MOMENTUM";
  companyId?: string;
  requestedAmount: DecimalString;
  portfolioValue: DecimalString;
  currentStrategyValue: DecimalString;
  currentCompanyValue: DecimalString;
  currentFutureCoreValue?: DecimalString;
  currency: CurrencyCode;
  inputEvaluationIds: string[];
  snapshotIds: string[];
  policyVersionId: string;
};

export const defaultPortfolioPolicy: PortfolioPolicy = {
  longTermTarget: 0.85,
  longTermHardMax: 0.9,
  momentumTarget: 0.15,
  momentumHardMax: 0.2,
  futureCoreHardMax: 0.2,
  futureCoreMaxSinglePosition: 0.06,
  maxSinglePosition: 0.1,
  leverageAllowed: false,
};

export function allocateCapital(
  capital: number,
  policy: PortfolioPolicy = defaultPortfolioPolicy,
): Allocation {
  if (!Number.isFinite(capital) || capital <= 0) throw new RangeError("capital must be positive");
  validatePortfolioPolicy(policy);

  return {
    capital,
    longTerm: capital * policy.longTermTarget,
    momentum: capital * policy.momentumTarget,
    maxSinglePosition: capital * policy.maxSinglePosition,
  };
}

export function allocateCapitalDecimal(
  capital: DecimalString,
  currency: CurrencyCode,
  policy: PortfolioPolicy = defaultPortfolioPolicy,
): DecimalAllocation {
  validatePortfolioPolicy(policy);
  assertDecimal(capital, "capital");
  assertCurrency(currency);
  if (compareDecimal(capital, "0") <= 0) throw new RangeError("capital must be positive");
  return {
    capital,
    currency,
    longTerm: multiplyDecimalByRatio(capital, policy.longTermTarget),
    momentum: multiplyDecimalByRatio(capital, policy.momentumTarget),
    maxSinglePosition: multiplyDecimalByRatio(capital, policy.maxSinglePosition),
  };
}

export function proposeAllocation(
  request: AllocationRequest,
  policy: PortfolioPolicy = defaultPortfolioPolicy,
): AllocationProposal {
  validatePortfolioPolicy(policy);
  assertDecimal(request.portfolioValue, "portfolioValue");
  assertDecimal(request.requestedAmount, "requestedAmount");
  assertDecimal(request.currentStrategyValue, "currentStrategyValue");
  assertDecimal(request.currentCompanyValue, "currentCompanyValue");
  assertCurrency(request.currency);
  if (compareDecimal(request.portfolioValue, "0") <= 0 || compareDecimal(request.requestedAmount, "0") <= 0) {
    throw new RangeError("portfolioValue and requestedAmount must be positive");
  }
  const generatedAt = new Date(request.generatedAt).getTime();
  const expiresAt = new Date(request.expiresAt).getTime();
  if (!Number.isFinite(generatedAt) || !Number.isFinite(expiresAt) || expiresAt <= generatedAt) {
    throw new RangeError("expiresAt must be after generatedAt");
  }
  if (!request.portfolioId.trim() || !request.policyVersionId.trim()) throw new Error("portfolioId and policyVersionId are required");
  const action: AllocationAction = request.action ?? (request.strategy === "MOMENTUM" ? "ENTER" : "BUY");
  if (request.strategy === "MOMENTUM" && action !== "ENTER") throw new Error("Momentum allocation action must be ENTER");
  if (request.strategy === "LONG_TERM" && action === "ENTER") throw new Error("Long-term allocation action cannot be ENTER");
  if (request.lotStrategy === "MOMENTUM" && request.strategy !== "MOMENTUM") throw new Error("Momentum Lot must use the Momentum Bucket");
  if ((request.lotStrategy === "CORE" || request.lotStrategy === "FUTURE_CORE") && request.strategy !== "LONG_TERM") {
    throw new Error("Core and Future Core Lots must use the Long-term Bucket");
  }
  const strategyLimit = request.strategy === "LONG_TERM" ? policy.longTermHardMax : policy.momentumHardMax;
  const strategyCapacity = subtractDecimalFloorZero(multiplyDecimalByRatio(request.portfolioValue, strategyLimit), request.currentStrategyValue);
  const companyLimit = request.lotStrategy === "FUTURE_CORE" ? policy.futureCoreMaxSinglePosition : policy.maxSinglePosition;
  const companyCapacity = subtractDecimalFloorZero(multiplyDecimalByRatio(request.portfolioValue, companyLimit), request.currentCompanyValue);
  let futureCoreCapacity = request.requestedAmount;
  if (request.lotStrategy === "FUTURE_CORE") {
    if (request.currentFutureCoreValue === undefined) throw new Error("Future Core allocation requires currentFutureCoreValue");
    assertDecimal(request.currentFutureCoreValue, "currentFutureCoreValue");
    futureCoreCapacity = subtractDecimalFloorZero(
      multiplyDecimalByRatio(request.portfolioValue, policy.futureCoreHardMax),
      request.currentFutureCoreValue,
    );
  }
  const approvedAmount = minDecimal(request.requestedAmount, strategyCapacity, companyCapacity, futureCoreCapacity);
  const constraintsTriggered: string[] = [];
  if (compareDecimal(strategyCapacity, request.requestedAmount) < 0) constraintsTriggered.push("STRATEGY_BUCKET_LIMIT");
  if (compareDecimal(companyCapacity, request.requestedAmount) < 0) constraintsTriggered.push("COMPANY_WEIGHT_LIMIT");
  if (compareDecimal(futureCoreCapacity, request.requestedAmount) < 0) constraintsTriggered.push("FUTURE_CORE_LIMIT");
  const status = compareDecimal(approvedAmount, "0") === 0
    ? "REJECTED"
    : compareDecimal(approvedAmount, request.requestedAmount) < 0 ? "REDUCED" : "APPROVED";

  return {
    id: request.id,
    portfolioId: request.portfolioId,
    generatedAt: request.generatedAt,
    expiresAt: request.expiresAt,
    strategy: request.strategy,
    action,
    ...(request.lotStrategy === undefined ? {} : { lotStrategy: request.lotStrategy }),
    ...(request.companyId === undefined ? {} : { companyId: request.companyId }),
    requestedAmount: request.requestedAmount,
    approvedAmount,
    currency: request.currency,
    currentStrategyWeight: decimalRatio(request.currentStrategyValue, request.portfolioValue),
    projectedStrategyWeight: decimalRatio(addDecimal(request.currentStrategyValue, approvedAmount), request.portfolioValue),
    currentCompanyWeight: decimalRatio(request.currentCompanyValue, request.portfolioValue),
    projectedCompanyWeight: decimalRatio(addDecimal(request.currentCompanyValue, approvedAmount), request.portfolioValue),
    status,
    reasons: status === "APPROVED" ? ["포트폴리오 정책 범위 내입니다."] : ["포트폴리오 한도로 요청 금액을 승인할 수 없습니다."],
    constraintsTriggered,
    inputEvaluationIds: [...request.inputEvaluationIds],
    snapshotIds: [...request.snapshotIds],
    policyVersionId: request.policyVersionId,
  };
}

export function validatePortfolioPolicy(policy: PortfolioPolicy): PortfolioPolicy {
  for (const [name, value] of [
    ["longTermTarget", policy.longTermTarget], ["longTermHardMax", policy.longTermHardMax],
    ["momentumTarget", policy.momentumTarget], ["momentumHardMax", policy.momentumHardMax],
    ["futureCoreHardMax", policy.futureCoreHardMax], ["futureCoreMaxSinglePosition", policy.futureCoreMaxSinglePosition],
    ["maxSinglePosition", policy.maxSinglePosition],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0 || value > 1) throw new RangeError(`${name} must be between 0 and 1`);
  }
  if (policy.longTermTarget < 0.8 || policy.longTermTarget > 0.9) throw new RangeError("longTermTarget must be between 0.8 and 0.9");
  if (policy.momentumTarget < 0.1 || policy.momentumTarget > 0.2) throw new RangeError("momentumTarget must be between 0.1 and 0.2");
  if (policy.longTermTarget > policy.longTermHardMax || policy.momentumTarget > policy.momentumHardMax) {
    throw new RangeError("strategy target cannot exceed its hard maximum");
  }
  if (Math.abs(policy.longTermTarget + policy.momentumTarget - 1) > 0.000_001) throw new RangeError("strategy targets must sum to 1");
  if (policy.futureCoreMaxSinglePosition > policy.futureCoreHardMax) {
    throw new RangeError("Future Core single-position maximum cannot exceed its Bucket maximum");
  }
  if (policy.leverageAllowed !== false) throw new Error("MVP Portfolio Policy forbids leverage");
  return structuredClone(policy);
}
