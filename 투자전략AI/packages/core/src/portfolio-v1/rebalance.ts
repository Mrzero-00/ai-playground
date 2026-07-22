import { createHash } from "node:crypto";
import { compareDecimal, multiplyDecimalByRatio, type DecimalString } from "../decimal.js";
import { buildPortfolioLedger } from "./ledger.js";
import { validatePortfolioPolicyV1 } from "./policy.js";
import type { PortfolioRebalanceInputV1, PortfolioRebalanceReviewV1, RebalanceActionItemV1 } from "./types.js";

export function assessPortfolioRebalanceV1(input: PortfolioRebalanceInputV1): PortfolioRebalanceReviewV1 {
  validateInput(input);
  const policy = validatePortfolioPolicyV1(input.policy);
  const ledger = buildPortfolioLedger(input.snapshot);
  if (input.snapshot.portfolioId !== input.portfolioId || input.snapshot.userId !== input.userId) throw new Error("Rebalance ownership mismatch");
  if (input.snapshot.baseCurrency !== policy.baseCurrency) throw new Error("Rebalance snapshot and policy currency conflict");
  const actions: RebalanceActionItemV1[] = [];

  addBucketActions(actions, "LONG_TERM", ledger.weights.longTerm, policy.longTerm, ledger.investableNavBase);
  addBucketActions(actions, "MOMENTUM", ledger.weights.momentum, policy.momentum, ledger.investableNavBase);
  if (ledger.weights.futureCore > policy.futureCore.hardMax) {
    actions.push(action("REVIEW_REQUIRED", "BUCKET", "FUTURE_CORE", 2, ledger.futureCorePositionValueBase,
      multiplyDecimalByRatio(ledger.investableNavBase, policy.futureCore.hardMax), "FUTURE_CORE_HARD_LIMIT_EXCEEDED"));
  }
  addExposureBreaches(actions, "COMPANY", ledger.exposures.company, policy.companyGrossHardMax, ledger.investableNavBase);
  addExposureBreaches(actions, "SECTOR", ledger.exposures.sector, policy.sectorGrossHardMax, ledger.investableNavBase);
  addExposureBreaches(actions, "INDUSTRY", ledger.exposures.industry, policy.industryGrossHardMax, ledger.investableNavBase);
  addExposureBreaches(actions, "THEME", ledger.exposures.theme, policy.themeGrossHardMax, ledger.investableNavBase);
  const momentumRiskHard = multiplyDecimalByRatio(ledger.investableNavBase, policy.momentumOpenRiskHardMax);
  if (compareDecimal(ledger.momentumOpenRiskBase, momentumRiskHard) > 0) {
    actions.push(action("FREEZE_NEW_RISK", "MOMENTUM_RISK", "OPEN_RISK", 1, ledger.momentumOpenRiskBase, momentumRiskHard, "MOMENTUM_OPEN_RISK_HARD_LIMIT_EXCEEDED"));
    actions.push(action("REVIEW_REQUIRED", "MOMENTUM_RISK", "OPEN_RISK", 2, ledger.momentumOpenRiskBase, momentumRiskHard, "MOMENTUM_POSITION_REVIEW_REQUIRED"));
  }
  if (actions.length === 0) actions.push(action("NO_ACTION", "PORTFOLIO", input.portfolioId, 99, ledger.investableNavBase, undefined, "PORTFOLIO_WITHIN_POLICY"));
  actions.sort((left, right) => left.priority - right.priority || left.scope.localeCompare(right.scope) || left.key.localeCompare(right.key) || left.action.localeCompare(right.action));
  const requiresManualReview = actions.some((item) => item.action === "REDUCE_POSITION" || item.action === "REVIEW_REQUIRED" || item.action === "FREEZE_NEW_RISK");
  const withoutHash: Omit<PortfolioRebalanceReviewV1, "resultHash"> = {
    id: input.id,
    portfolioId: input.portfolioId,
    userId: input.userId,
    generatedAt: input.generatedAt,
    dataAsOf: input.snapshot.asOf,
    trigger: input.trigger,
    portfolioSnapshotId: input.snapshot.id,
    policyVersionId: policy.version,
    currentWeights: { ...ledger.weights },
    actions,
    requiresManualReview,
    automaticOrdersAllowed: false,
    summary: requiresManualReview ? "POLICY_BREACH_OR_CONCENTRATION_REQUIRES_RISK_REVIEW" : actions[0]?.action === "NO_ACTION" ? "PORTFOLIO_WITHIN_POLICY" : "DIRECT_NEW_MONEY_TO_UNDERWEIGHT_BUCKET",
  };
  return { ...withoutHash, resultHash: stableHash(withoutHash) };
}

function validateInput(input: PortfolioRebalanceInputV1): void {
  for (const [name, value] of Object.entries({ id: input.id, portfolioId: input.portfolioId, userId: input.userId })) {
    if (!value.trim()) throw new Error(`Rebalance ${name} is required`);
  }
  const generatedAt = new Date(input.generatedAt).getTime();
  if (!Number.isFinite(generatedAt)) throw new Error("Rebalance generatedAt must be valid");
  if (new Date(input.snapshot.asOf).getTime() > generatedAt) throw new Error("Rebalance snapshot cannot contain future information");
}

function addBucketActions(
  actions: RebalanceActionItemV1[],
  key: "LONG_TERM" | "MOMENTUM",
  currentWeight: number,
  limit: { softMin: number; softMax: number; hardMax: number },
  nav: DecimalString,
): void {
  const current = multiplyDecimalByRatio(nav, currentWeight);
  if (currentWeight > limit.hardMax) {
    const hard = multiplyDecimalByRatio(nav, limit.hardMax);
    actions.push(action("FREEZE_NEW_RISK", "BUCKET", key, 1, current, hard, `${key}_HARD_MAX_EXCEEDED`));
    actions.push(action("REVIEW_REQUIRED", "BUCKET", key, 2, current, hard, `${key}_REDUCTION_REVIEW_REQUIRED`));
  } else if (currentWeight < limit.softMin) {
    actions.push(action("NEW_MONEY_TO_UNDERWEIGHT", "BUCKET", key, 5, current, multiplyDecimalByRatio(nav, limit.softMin), `${key}_BELOW_SOFT_MIN`));
  } else if (currentWeight > limit.softMax) {
    actions.push(action("REVIEW_REQUIRED", "BUCKET", key, 6, current, multiplyDecimalByRatio(nav, limit.softMax), `${key}_ABOVE_SOFT_MAX`));
  }
}

function addExposureBreaches(
  actions: RebalanceActionItemV1[],
  scope: "COMPANY" | "SECTOR" | "INDUSTRY" | "THEME",
  exposures: Record<string, DecimalString>,
  limitRatio: number,
  nav: DecimalString,
): void {
  const hard = multiplyDecimalByRatio(nav, limitRatio);
  for (const [key, current] of Object.entries(exposures).sort(([left], [right]) => left.localeCompare(right))) {
    if (compareDecimal(current, hard) <= 0) continue;
    actions.push(action("FREEZE_NEW_RISK", scope, key, 1, current, hard, `${scope}_HARD_LIMIT_EXCEEDED`));
    actions.push(action("REDUCE_POSITION", scope, key, 3, current, hard, `${scope}_REDUCTION_REVIEW_REQUIRED`));
  }
}

function action(
  actionName: RebalanceActionItemV1["action"],
  scope: RebalanceActionItemV1["scope"],
  key: string,
  priority: number,
  currentValue: DecimalString,
  limitValue: DecimalString | undefined,
  reasonCode: string,
): RebalanceActionItemV1 {
  return { action: actionName, scope, key, priority, currentValue, ...(limitValue === undefined ? {} : { limitValue }), reasonCode, automaticExecutionAllowed: false };
}

function stableHash(value: unknown): string { return createHash("sha256").update(stableStringify(value)).digest("hex"); }
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
