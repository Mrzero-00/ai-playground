export type PortfolioPolicy = {
  longTermTarget: number;
  momentumTarget: number;
  maxSinglePosition: number;
};

export type Allocation = {
  capital: number;
  longTerm: number;
  momentum: number;
  maxSinglePosition: number;
};

export type AllocationProposal = {
  id: string;
  portfolioId: string;
  generatedAt: string;
  expiresAt: string;
  strategy: "LONG_TERM" | "MOMENTUM";
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
  companyId?: string;
  requestedAmount: DecimalString;
  portfolioValue: DecimalString;
  currentStrategyValue: DecimalString;
  currentCompanyValue: DecimalString;
  currency: CurrencyCode;
  inputEvaluationIds: string[];
  snapshotIds: string[];
  policyVersionId: string;
};

export const defaultPortfolioPolicy: PortfolioPolicy = {
  longTermTarget: 0.85,
  momentumTarget: 0.15,
  maxSinglePosition: 0.1,
};

export function allocateCapital(
  capital: number,
  policy: PortfolioPolicy = defaultPortfolioPolicy,
): Allocation {
  if (!Number.isFinite(capital) || capital <= 0) throw new RangeError("capital must be positive");
  if (policy.longTermTarget < 0.8 || policy.longTermTarget > 0.9) {
    throw new RangeError("longTermTarget must be between 0.8 and 0.9");
  }
  if (Math.abs(policy.longTermTarget + policy.momentumTarget - 1) > 0.000_001) {
    throw new RangeError("strategy targets must sum to 1");
  }
  if (policy.maxSinglePosition <= 0 || policy.maxSinglePosition > 1) {
    throw new RangeError("maxSinglePosition must be between 0 and 1");
  }

  return {
    capital,
    longTerm: capital * policy.longTermTarget,
    momentum: capital * policy.momentumTarget,
    maxSinglePosition: capital * policy.maxSinglePosition,
  };
}

export function proposeAllocation(
  request: AllocationRequest,
  policy: PortfolioPolicy = defaultPortfolioPolicy,
): AllocationProposal {
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
  const strategyLimit = request.strategy === "LONG_TERM" ? policy.longTermTarget : policy.momentumTarget;
  const strategyCapacity = subtractDecimalFloorZero(multiplyDecimalByRatio(request.portfolioValue, strategyLimit), request.currentStrategyValue);
  const companyCapacity = subtractDecimalFloorZero(multiplyDecimalByRatio(request.portfolioValue, policy.maxSinglePosition), request.currentCompanyValue);
  const approvedAmount = minDecimal(request.requestedAmount, strategyCapacity, companyCapacity);
  const constraintsTriggered: string[] = [];
  if (compareDecimal(strategyCapacity, request.requestedAmount) < 0) constraintsTriggered.push("STRATEGY_BUCKET_LIMIT");
  if (compareDecimal(companyCapacity, request.requestedAmount) < 0) constraintsTriggered.push("COMPANY_WEIGHT_LIMIT");
  const status = compareDecimal(approvedAmount, "0") === 0
    ? "REJECTED"
    : compareDecimal(approvedAmount, request.requestedAmount) < 0 ? "REDUCED" : "APPROVED";

  return {
    id: request.id,
    portfolioId: request.portfolioId,
    generatedAt: request.generatedAt,
    expiresAt: request.expiresAt,
    strategy: request.strategy,
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
