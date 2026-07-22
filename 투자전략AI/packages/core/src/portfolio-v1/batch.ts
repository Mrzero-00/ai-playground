import { createHash } from "node:crypto";
import {
  addDecimal,
  assertCurrency,
  assertDecimal,
  compareDecimal,
  decimalRatio,
  minDecimal,
  multiplyDecimalByRatio,
  subtractDecimalFloorZero,
  type DecimalString,
} from "../decimal.js";
import { buildPortfolioLedger } from "./ledger.js";
import { validatePortfolioPolicyV1 } from "./policy.js";
import { proposeAllocationV1 } from "./engine.js";
import type {
  AllocationRequestV1,
  CapitalAllocationBatchInputV1,
  CapitalAllocationDecisionV1,
  PortfolioLedgerV1,
  PortfolioWeightsV1,
} from "./types.js";

type RunningCapacity = {
  company: Record<string, DecimalString>;
  sector: Record<string, DecimalString>;
  industry: Record<string, DecimalString>;
  theme: Record<string, DecimalString>;
  position: Record<string, DecimalString>;
  strategy: Record<"LONG_TERM" | "MOMENTUM", DecimalString>;
  futureCore: DecimalString;
  momentumRisk: DecimalString;
};

export function allocateNewCapitalV1(input: CapitalAllocationBatchInputV1): CapitalAllocationDecisionV1 {
  validateBatchInput(input);
  const first = input.requests[0]!;
  const snapshot = first.portfolioSnapshot;
  const policy = validatePortfolioPolicyV1(first.policy);
  const ledger = buildPortfolioLedger(snapshot);
  const running = emptyRunningCapacity();
  let remaining = input.availableAmount;
  const proposals = [] as CapitalAllocationDecisionV1["proposals"];
  const constraints = new Set<string>();

  for (const original of stableCandidateOrder(input.requests, ledger)) {
    if (compareDecimal(remaining, "0") === 0) {
      constraints.add("NEW_CAPITAL_EXHAUSTED");
      break;
    }
    const globalAmountCapacity = globalNotionalCapacity(original, ledger, running, remaining);
    if (compareDecimal(globalAmountCapacity, "0") === 0) {
      constraints.add(`BATCH_CAPACITY_EXHAUSTED:${original.id}`);
      continue;
    }
    const request = structuredClone(original);
    request.mode = "NEW_CAPITAL";
    request.requestedAmountBase = request.requestedAmountBase === undefined
      ? globalAmountCapacity : minDecimal(request.requestedAmountBase, globalAmountCapacity);
    if (request.strategy === "MOMENTUM") {
      const openRiskHard = multiplyDecimalByRatio(ledger.investableNavBase, policy.momentumOpenRiskHardMax);
      const remainingRisk = subtractDecimalFloorZero(
        subtractDecimalFloorZero(openRiskHard, ledger.momentumOpenRiskBase),
        running.momentumRisk,
      );
      request.requestedRiskAmountBase = request.requestedRiskAmountBase === undefined
        ? remainingRisk : minDecimal(request.requestedRiskAmountBase, remainingRisk);
      if (compareDecimal(request.requestedRiskAmountBase, "0") === 0) {
        constraints.add("MOMENTUM_OPEN_RISK_LIMIT");
        continue;
      }
    }
    const proposal = proposeAllocationV1(request);
    proposals.push(proposal);
    for (const reason of proposal.constraintsTriggered) constraints.add(reason);
    remaining = subtractDecimalFloorZero(remaining, proposal.approvedAmount);
    applyApprovedCapacity(running, request, proposal.approvedAmount, proposal.projectedOpenRisk, ledger.momentumOpenRiskBase);
  }

  const allocated = subtractDecimalFloorZero(input.availableAmount, remaining);
  const projectedWeights = projectBatchWeights(ledger, proposals);
  const withoutHash: Omit<CapitalAllocationDecisionV1, "resultHash"> = {
    id: input.id,
    portfolioId: input.portfolioId,
    userId: input.userId,
    generatedAt: input.generatedAt,
    dataAsOf: input.dataAsOf,
    capitalSource: input.capitalSource,
    availableAmount: input.availableAmount,
    currency: input.currency,
    currentWeights: { ...ledger.weights },
    targetWeights: targetWeights(policy),
    projectedWeights,
    proposals,
    cashRetained: remaining,
    constraintsTriggered: [...constraints].sort(),
    stressSummary: input.stressSummary,
    finalRecommendation: compareDecimal(allocated, "0") === 0
      ? "KEEP_CASH_UNTIL_ELIGIBLE_CAPACITY_EXISTS"
      : compareDecimal(remaining, "0") > 0 ? "ALLOCATE_APPROVED_AND_RETAIN_RESIDUAL_CASH" : "ALLOCATE_APPROVED_WITHIN_CAPACITY",
    snapshotIds: [...new Set(input.requests.flatMap((request) => request.snapshotIds))].sort(),
    portfolioSnapshotId: snapshot.id,
    policyVersionId: policy.version,
  };
  return { ...withoutHash, resultHash: stableHash(withoutHash) };
}

function validateBatchInput(input: CapitalAllocationBatchInputV1): void {
  for (const [name, value] of Object.entries({ id: input.id, portfolioId: input.portfolioId, userId: input.userId, stressSummary: input.stressSummary })) {
    if (!value.trim()) throw new Error(`Capital allocation batch ${name} is required`);
  }
  const generatedAt = parseDate(input.generatedAt, "generatedAt");
  if (parseDate(input.dataAsOf, "dataAsOf") > generatedAt) throw new Error("Capital allocation dataAsOf cannot be after generatedAt");
  assertCurrency(input.currency);
  assertDecimal(input.availableAmount, "availableAmount");
  if (compareDecimal(input.availableAmount, "0") <= 0) throw new Error("availableAmount must be positive");
  if (input.requests.length === 0) throw new Error("Capital allocation batch requires candidates");
  if (new Set(input.requests.map((request) => request.id)).size !== input.requests.length) throw new Error("Capital allocation candidate ids must be unique");
  const first = input.requests[0]!;
  const canonicalSnapshot = JSON.stringify(first.portfolioSnapshot);
  for (const request of input.requests) {
    if (request.portfolioId !== input.portfolioId || request.userId !== input.userId) throw new Error("Capital allocation candidate ownership mismatch");
    if (request.portfolioSnapshot.id !== first.portfolioSnapshot.id || JSON.stringify(request.portfolioSnapshot) !== canonicalSnapshot) {
      throw new Error("Capital allocation candidates must use the same immutable Portfolio snapshot");
    }
    if (request.policy.version !== first.policy.version || JSON.stringify(request.policy) !== JSON.stringify(first.policy)) {
      throw new Error("Capital allocation candidates must use the same Portfolio policy version");
    }
    if (request.policy.baseCurrency !== input.currency || request.portfolioSnapshot.baseCurrency !== input.currency) {
      throw new Error("Capital allocation currency must match Portfolio base currency");
    }
    if (request.portfolioSnapshot.asOf !== input.dataAsOf) throw new Error("Capital allocation dataAsOf must equal Portfolio snapshot asOf");
  }
  const ledger = buildPortfolioLedger(first.portfolioSnapshot);
  const availableCash = addDecimal(ledger.availableLongTermCashBase, ledger.availableMomentumCashBase);
  if (compareDecimal(input.availableAmount, availableCash) > 0) throw new Error("availableAmount exceeds confirmed available Portfolio cash");
}

function stableCandidateOrder(requests: AllocationRequestV1[], ledger: PortfolioLedgerV1): AllocationRequestV1[] {
  return [...requests].sort((left, right) => {
    const leftTarget = left.strategy === "LONG_TERM" ? left.policy.longTerm.target : left.policy.momentum.target;
    const rightTarget = right.strategy === "LONG_TERM" ? right.policy.longTerm.target : right.policy.momentum.target;
    const leftCurrent = left.strategy === "LONG_TERM" ? ledger.weights.longTerm : ledger.weights.momentum;
    const rightCurrent = right.strategy === "LONG_TERM" ? ledger.weights.longTerm : ledger.weights.momentum;
    const underweight = (rightTarget - rightCurrent) - (leftTarget - leftCurrent);
    if (Math.abs(underweight) > 1e-12) return underweight;
    if (right.sizingSignal.confidence !== left.sizingSignal.confidence) return right.sizingSignal.confidence - left.sizingSignal.confidence;
    if (right.sizingSignal.score !== left.sizingSignal.score) return right.sizingSignal.score - left.sizingSignal.score;
    const leftConcentration = decimalRatio(ledger.exposures.company[left.companyId] ?? "0", ledger.investableNavBase);
    const rightConcentration = decimalRatio(ledger.exposures.company[right.companyId] ?? "0", ledger.investableNavBase);
    if (leftConcentration !== rightConcentration) return leftConcentration - rightConcentration;
    return left.id.localeCompare(right.id);
  });
}

function globalNotionalCapacity(
  request: AllocationRequestV1,
  ledger: PortfolioLedgerV1,
  running: RunningCapacity,
  remaining: DecimalString,
): DecimalString {
  const policy = request.policy;
  const nav = ledger.investableNavBase;
  const capacities: DecimalString[] = [remaining];
  const strategyCurrent = request.strategy === "LONG_TERM" ? ledger.longTermPositionValueBase : ledger.momentumPositionValueBase;
  capacities.push(residualRatio(nav, request.strategy === "LONG_TERM" ? policy.longTerm.hardMax : policy.momentum.hardMax, strategyCurrent, running.strategy[request.strategy]));
  capacities.push(residualRatio(nav, policy.companyGrossHardMax, ledger.exposures.company[request.companyId] ?? "0", running.company[request.companyId] ?? "0"));
  capacities.push(residualRatio(nav, policy.sectorGrossHardMax, ledger.exposures.sector[request.sectorCode] ?? "0", running.sector[request.sectorCode] ?? "0"));
  capacities.push(residualRatio(nav, policy.industryGrossHardMax, ledger.exposures.industry[request.industryCode] ?? "0", running.industry[request.industryCode] ?? "0"));
  const positionKey = `${request.companyId}:${request.lotStrategy}`;
  const positionCurrent = request.portfolioSnapshot.positions
    .filter((position) => position.companyId === request.companyId && position.strategy === request.lotStrategy)
    .reduce((sum, position) => addDecimal(sum, position.marketValueBase), "0" as DecimalString);
  capacities.push(residualRatio(nav, request.lotStrategy === "FUTURE_CORE" ? policy.futureCorePositionHardMax : policy.corePositionHardMax, positionCurrent, running.position[positionKey] ?? "0"));
  if (request.lotStrategy === "FUTURE_CORE") capacities.push(residualRatio(nav, policy.futureCore.hardMax, ledger.futureCorePositionValueBase, running.futureCore));
  for (const theme of request.themeKeys) capacities.push(residualRatio(nav, policy.themeGrossHardMax, ledger.exposures.theme[theme] ?? "0", running.theme[theme] ?? "0"));
  return minDecimal(...capacities);
}

function residualRatio(nav: DecimalString, ratio: number, current: DecimalString, consumed: DecimalString): DecimalString {
  return subtractDecimalFloorZero(subtractDecimalFloorZero(multiplyDecimalByRatio(nav, ratio), current), consumed);
}

function applyApprovedCapacity(
  running: RunningCapacity,
  request: AllocationRequestV1,
  approved: DecimalString,
  projectedOpenRisk: DecimalString | undefined,
  initialOpenRisk: DecimalString,
): void {
  addTo(running.company, request.companyId, approved);
  addTo(running.sector, request.sectorCode, approved);
  addTo(running.industry, request.industryCode, approved);
  for (const theme of request.themeKeys) addTo(running.theme, theme, approved);
  addTo(running.position, `${request.companyId}:${request.lotStrategy}`, approved);
  running.strategy[request.strategy] = addDecimal(running.strategy[request.strategy], approved);
  if (request.lotStrategy === "FUTURE_CORE") running.futureCore = addDecimal(running.futureCore, approved);
  if (projectedOpenRisk !== undefined) running.momentumRisk = addDecimal(running.momentumRisk, subtractDecimalFloorZero(projectedOpenRisk, initialOpenRisk));
}

function projectBatchWeights(
  ledger: PortfolioLedgerV1,
  proposals: CapitalAllocationDecisionV1["proposals"],
): PortfolioWeightsV1 {
  let totalApproved: DecimalString = "0";
  let futureCoreApproved: DecimalString = "0";
  for (const proposal of proposals) {
    totalApproved = addDecimal(totalApproved, proposal.approvedAmount);
    if (proposal.lotStrategy === "FUTURE_CORE") futureCoreApproved = addDecimal(futureCoreApproved, proposal.approvedAmount);
  }
  return {
    longTerm: ledger.weights.longTerm,
    momentum: ledger.weights.momentum,
    futureCore: decimalRatio(addDecimal(ledger.futureCorePositionValueBase, futureCoreApproved), ledger.investableNavBase),
    commonReserve: ledger.weights.commonReserve,
    invested: decimalRatio(addDecimal(ledger.investedValueBase, totalApproved), ledger.investableNavBase),
    cash: decimalRatio(subtractDecimalFloorZero(ledger.totalCashBase, totalApproved), ledger.investableNavBase),
  };
}

function targetWeights(policy: AllocationRequestV1["policy"]): PortfolioWeightsV1 {
  return {
    longTerm: policy.longTerm.target,
    momentum: policy.momentum.target,
    futureCore: policy.futureCore.target,
    commonReserve: policy.commonReserveTarget,
    invested: 1 - policy.commonReserveTarget,
    cash: policy.commonReserveTarget,
  };
}

function emptyRunningCapacity(): RunningCapacity {
  return { company: {}, sector: {}, industry: {}, theme: {}, position: {}, strategy: { LONG_TERM: "0", MOMENTUM: "0" }, futureCore: "0", momentumRisk: "0" };
}

function addTo(target: Record<string, DecimalString>, key: string, value: DecimalString): void {
  target[key] = addDecimal(target[key] ?? "0", value);
}

function stableHash(value: unknown): string { return createHash("sha256").update(stableStringify(value)).digest("hex"); }
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
