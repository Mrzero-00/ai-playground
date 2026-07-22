import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateCapital,
  addDecimal,
  composeDecision,
  evaluateLongTerm,
  evaluateMomentum,
  evaluateRisk,
  interpretCrossSignal,
  proposeAllocation,
  recordUserDecision,
  validatePositionLot,
} from "../src/index.js";

const allocationContext = {
  portfolioId: "portfolio-1",
  generatedAt: "2026-07-22T00:00:00Z",
  expiresAt: "2026-07-22T02:00:00Z",
  currency: "USD",
  inputEvaluationIds: ["evaluation-1"],
  snapshotIds: ["snapshot-1"],
  policyVersionId: "portfolio-policy-1",
} as const;

const safeRiskContext = {
  id: "risk-1",
  evaluatedAt: "2026-07-22T00:01:00Z",
  dataAsOf: "2026-07-22T00:00:00Z",
  riskPolicyVersionId: "risk-policy-1",
  maxDataAgeMinutes: 60,
  dailyDrawdownPercent: 0,
  maxDailyDrawdownPercent: 3,
  liquiditySufficient: true,
  criticalRiskCheckAvailable: true,
  eventRisk: false,
} as const;

test("long-term and momentum use independent inputs and outputs", () => {
  const longTerm = evaluateLongTerm({
    businessQuality: 90, valuation: 70, moat: 90, freeCashFlow: 85,
    opportunityCost: 70, portfolioFit: 80,
  });
  const momentum = evaluateMomentum({
    relativeStrength: 90, volume: 80, sectorRotation: 70, catalyst: 90, riskReward: 80,
  });

  assert.equal(longTerm.strategy, "long-term");
  assert.equal(longTerm.total, 83);
  assert.equal(longTerm.classification, "core");
  assert.equal(momentum.strategy, "momentum");
  assert.equal(momentum.total, 83);
  assert.equal(momentum.signal, "enter");
});

test("default portfolio follows the 85/15 policy", () => {
  assert.deepEqual(allocateCapital(1_000_000), {
    capital: 1_000_000,
    longTerm: 850_000,
    momentum: 150_000,
    maxSinglePosition: 100_000,
  });
});

test("money arithmetic preserves decimal precision without floating point", () => {
  assert.equal(addDecimal("9007199254740993.01", "0.09"), "9007199254740993.1");
  assert.throws(() => addDecimal("1e3", "1"), /plain decimal string/);
});

test("scores outside 0..100 are rejected", () => {
  assert.throws(() => evaluateMomentum({
    relativeStrength: 101, volume: 80, sectorRotation: 70, catalyst: 90, riskReward: 80,
  }), RangeError);
});

test("cross signal never merges the two strategy scores", () => {
  const signal = interpretCrossSignal({
    companyId: "ORCL", evaluatedAt: "2026-07-22T00:00:00Z", longTermEvaluationId: "long-1",
    momentumEvaluationId: "momentum-1", scoringPolicyVersionId: "cross-policy-1", longTermScore: 55, momentumScore: 90,
  });
  assert.equal(signal.classification, "MOMENTUM_ONLY");
  assert.match(signal.portfolioNotes[0] ?? "", /장기 투자로 전환할 수 없습니다/);
});

test("portfolio reduces an allocation at strategy and company limits", () => {
  const proposal = proposeAllocation({
    ...allocationContext, id: "allocation-1", strategy: "MOMENTUM", companyId: "ORCL",
    requestedAmount: "120000", portfolioValue: "1000000", currentStrategyValue: "100000", currentCompanyValue: "70000",
  });
  assert.equal(proposal.status, "REDUCED");
  assert.equal(proposal.approvedAmount, "30000");
  assert.deepEqual(proposal.constraintsTriggered, ["STRATEGY_BUCKET_LIMIT", "COMPANY_WEIGHT_LIMIT"]);
});

test("risk veto overrides an otherwise approved proposal", () => {
  const proposal = proposeAllocation({
    ...allocationContext, id: "allocation-2", strategy: "MOMENTUM",
    requestedAmount: "10000", portfolioValue: "1000000", currentStrategyValue: "0", currentCompanyValue: "0",
  });
  const risk = evaluateRisk(proposal, {
    ...safeRiskContext,
    evaluatedAt: "2026-07-22T01:00:00Z", dataAsOf: "2026-07-21T00:00:00Z", maxDataAgeMinutes: 60,
    stopLoss: "90",
  });
  const decision = composeDecision("decision-1", proposal, risk);
  assert.equal(risk.status, "DENY");
  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.approvedAmount, "0");
});

test("safe proposal still requires an explicit audited user approval", () => {
  const proposal = proposeAllocation({
    ...allocationContext, id: "allocation-3", strategy: "LONG_TERM",
    requestedAmount: "10000", portfolioValue: "1000000", currentStrategyValue: "0", currentCompanyValue: "0",
  });
  const risk = evaluateRisk(proposal, safeRiskContext);
  const pending = composeDecision("decision-2", proposal, risk);
  assert.equal(pending.status, "PENDING_APPROVAL");
  assert.equal(recordUserDecision(pending, {
    approved: true,
    decidedAt: "2026-07-22T00:02:00Z",
    userId: "user-1",
    revalidation: {
      checkedAt: "2026-07-22T00:02:00Z", proposalStillCurrent: true, portfolioCapacityConfirmed: true,
      priceWithinTolerance: true, dataFresh: true, riskStillValid: true,
    },
  }).status, "APPROVED");
});

test("expired proposal is denied before user approval", () => {
  const proposal = proposeAllocation({
    ...allocationContext, id: "allocation-expired", strategy: "LONG_TERM", expiresAt: "2026-07-22T00:05:00Z",
    requestedAmount: "100", portfolioValue: "10000", currentStrategyValue: "0", currentCompanyValue: "0",
  });
  const risk = evaluateRisk(proposal, { ...safeRiskContext, id: "risk-expired", evaluatedAt: "2026-07-22T00:06:00Z" });
  assert.equal(risk.status, "DENY");
  assert.ok(risk.riskFlags.includes("PROPOSAL_EXPIRED"));
});

test("approval cannot bypass mandatory revalidation", () => {
  const proposal = proposeAllocation({
    ...allocationContext, id: "allocation-revalidate", strategy: "LONG_TERM",
    requestedAmount: "100", portfolioValue: "10000", currentStrategyValue: "0", currentCompanyValue: "0",
  });
  const pending = composeDecision("decision-revalidate", proposal, evaluateRisk(proposal, safeRiskContext));
  assert.throws(() => recordUserDecision(pending, {
    approved: true, decidedAt: "2026-07-22T00:02:00Z", userId: "user-1",
  }), /revalidation is required/);
});

test("Risk decision cannot increase Portfolio approved amount", () => {
  const proposal = proposeAllocation({
    ...allocationContext, id: "allocation-cap", strategy: "LONG_TERM",
    requestedAmount: "100", portfolioValue: "10000", currentStrategyValue: "0", currentCompanyValue: "0",
  });
  const risk = { ...evaluateRisk(proposal, safeRiskContext), maxApprovedAmount: "999" };
  assert.equal(composeDecision("decision-cap", proposal, risk).approvedAmount, "100");
});

test("Momentum Position Lot cannot use a long-term exit policy", () => {
  assert.throws(() => validatePositionLot({
    id: "lot-1", portfolioId: "p-1", companyId: "ORCL", strategy: "MOMENTUM",
    openedAt: "2026-07-22T00:00:00Z", averagePrice: "100", quantity: "10", currency: "USD",
    momentumSetupId: "setup-1", exitPolicy: "THESIS_BREAK", status: "OPEN",
  }), /tactical exit policy/);
});
