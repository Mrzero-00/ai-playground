import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PORTFOLIO_POLICY_V1,
  allocateNewCapitalV1,
  assessPortfolioRebalanceV1,
  buildPortfolioLedger,
  divideDecimalFloor,
  momentumDrawdownMultiplier,
  multiplyDecimal,
  proposeAllocationV1,
  replayAllocationV1,
  runPortfolioStressTestV1,
  validatePortfolioPolicyV1,
  type AllocationRequestV1,
  type PortfolioSnapshotV1,
} from "../src/index.js";

function snapshot(): PortfolioSnapshotV1 {
  return {
    id: "portfolio-snapshot-1",
    portfolioId: "portfolio-1",
    userId: "user-1",
    baseCurrency: "USD",
    asOf: "2026-07-22T20:00:00Z",
    positions: [
      {
        lotId: "core-lot-a", companyId: "company-a", securityId: "security-a", strategy: "CORE",
        quantity: "70", marketPrice: "100", assetCurrency: "USD", fxRateToBase: "1",
        marketValueBase: "7000", costBasisBase: "6000", sectorCode: "SOFTWARE", industryCode: "APPLICATION_SOFTWARE",
        exposureTags: [{ dimension: "THEME", key: "AI_CAPEX", sensitivity: 0.5, confidence: 1, evidenceIds: ["e-1"] }],
        liquidityTier: "L1",
      },
      {
        lotId: "momentum-lot-b", companyId: "company-b", securityId: "security-b", strategy: "MOMENTUM",
        quantity: "50", marketPrice: "100", assetCurrency: "USD", fxRateToBase: "1",
        marketValueBase: "5000", costBasisBase: "5000", stopPrice: "95", gapScenarioLossPerUnitBase: "10",
        sectorCode: "SEMICONDUCTOR", industryCode: "CHIPS",
        exposureTags: [{ dimension: "THEME", key: "AI_CAPEX", sensitivity: 0.8, confidence: 1, evidenceIds: ["e-2"] }],
        liquidityTier: "L1",
      },
    ],
    cashBalances: [
      { id: "cash-long", currency: "USD", amount: "78000", fxRateToBase: "1", amountBase: "78000", owner: "LONG_TERM", available: true },
      { id: "cash-momentum", currency: "USD", amount: "10000", fxRateToBase: "1", amountBase: "10000", owner: "MOMENTUM", available: true },
    ],
    liabilitiesBase: "0",
    reservedCashBase: "0",
    fxSnapshotId: "fx-snapshot-1",
    marketSnapshotIds: ["market-snapshot-1"],
    complete: true,
    anomalyFlags: [],
  };
}

function longTermRequest(overrides: Partial<AllocationRequestV1> = {}): AllocationRequestV1 {
  return {
    id: "allocation-v1-1",
    portfolioId: "portfolio-1",
    userId: "user-1",
    generatedAt: "2026-07-22T20:05:00Z",
    expiresAt: "2026-07-22T20:20:00Z",
    mode: "SINGLE",
    strategy: "LONG_TERM",
    lotStrategy: "CORE",
    fundingBucket: "LONG_TERM",
    companyId: "company-c",
    securityId: "security-c",
    sectorCode: "HEALTHCARE",
    industryCode: "MEDICAL_DEVICES",
    themeKeys: ["AGING"],
    action: "ACCUMULATE",
    requestedAmountBase: "5000",
    currentPrice: "100",
    assetCurrency: "USD",
    fxRateToBase: "1",
    sizingSignal: {
      kind: "LONG_TERM", evaluationId: "long-evaluation-1", profile: "CORE", action: "ACCUMULATE",
      score: 85, confidence: 85, valuationClassification: "ATTRACTIVE", thesisStatus: "UNCHANGED", stage: "CORE",
    },
    portfolioSnapshot: snapshot(),
    policy: structuredClone(DEFAULT_PORTFOLIO_POLICY_V1),
    liquidity: { addv20Base: "100000000", liquidityTier: "L1", maximumExitDays: 5, lotSize: "1", fractionalSharesAllowed: false },
    snapshotIds: ["portfolio-snapshot-1", "market-snapshot-1", "fx-snapshot-1"],
    ...overrides,
  };
}

function momentumRequest(overrides: Partial<AllocationRequestV1> = {}): AllocationRequestV1 {
  return {
    ...longTermRequest(),
    id: "allocation-momentum-1",
    strategy: "MOMENTUM",
    lotStrategy: "MOMENTUM",
    fundingBucket: "MOMENTUM",
    action: "ENTER",
    requestedAmountBase: undefined,
    requestedRiskAmountBase: "500",
    sizingSignal: {
      kind: "MOMENTUM", evaluationId: "momentum-evaluation-1", setupId: "setup-1", action: "ENTER",
      score: 90, confidence: 90, marketRegimeMultiplier: 1, liquidityTier: "L1", tradePlanId: "plan-1",
    },
    momentumRiskPlan: {
      tradePlanId: "plan-1", referenceEntry: "100", initialStop: "95", gapScenarioLossPerUnitBase: "10",
      estimatedCostPerUnitBase: "1", drawdownMultiplier: 1, eventPolicyValid: true,
      expiresAt: "2026-07-23T20:00:00Z",
    },
    ...overrides,
  };
}

test("Portfolio v1 reconciles NAV, 85/15 buckets, look-through exposure and open risk", () => {
  const ledger = buildPortfolioLedger(snapshot());
  assert.equal(ledger.investableNavBase, "100000");
  assert.equal(ledger.weights.longTerm, 0.85);
  assert.equal(ledger.weights.momentum, 0.15);
  assert.equal(ledger.weights.invested, 0.12);
  assert.equal(ledger.momentumOpenRiskBase, "500");
  assert.equal(ledger.momentumOpenRiskBySector.SEMICONDUCTOR, "500");
  assert.equal(ledger.momentumOpenRiskByTheme.AI_CAPEX, "400");
  assert.equal(ledger.exposures.theme.AI_CAPEX, "7500");
});

test("Core proposal uses the smallest Decimal capacity and remains a Risk-review candidate", () => {
  const result = proposeAllocationV1(longTermRequest());
  assert.equal(result.status, "APPROVED");
  assert.equal(result.approvedAmount, "5000");
  assert.equal(result.executableQuantity, "50");
  assert.equal(result.currentWeights.longTerm, 0.85);
  assert.equal(result.projectedWeights.longTerm, 0.85);
  assert.ok(result.reasons.includes("RISK_REVIEW_REQUIRED"));
  assert.equal(result.resultHash.length, 64);
});

test("cross-strategy company gross exposure caps a Dual High Momentum Lot", () => {
  const request = momentumRequest({ companyId: "company-a", securityId: "security-a", sectorCode: "SOFTWARE", industryCode: "APPLICATION_SOFTWARE" });
  const result = proposeAllocationV1(request);
  assert.equal(result.status, "REDUCED");
  assert.equal(result.approvedAmount, "3000");
  assert.equal(result.executableQuantity, "30");
  assert.ok(result.constraintsTriggered.includes("COMPANY_GROSS_LIMIT"));
  assert.equal(result.riskHandoff.projectedCompanyExposureBase, "10000");
});

test("Momentum quantity is derived from gap loss instead of requested notional", () => {
  const result = proposeAllocationV1(momentumRequest());
  assert.equal(result.allowedRiskAmount, "500");
  assert.equal(result.scenarioLossPerUnit, "10");
  assert.equal(result.executableQuantity, "50");
  assert.equal(result.approvedAmount, "5000");
  assert.equal(result.projectedOpenRisk, "1000");
});

test("Momentum sector and theme open-risk budgets reduce correlated new risk", () => {
  const result = proposeAllocationV1(momentumRequest({
    companyId: "company-c",
    securityId: "security-c",
    sectorCode: "SEMICONDUCTOR",
    industryCode: "CHIP_DESIGN",
    themeKeys: ["AI_CAPEX"],
  }));
  assert.equal(result.status, "REDUCED");
  assert.equal(result.allowedRiskAmount, "250");
  assert.equal(result.approvedAmount, "2500");
  assert.ok(result.constraintsTriggered.includes("MOMENTUM_SECTOR_OPEN_RISK_LIMIT"));
});

test("foreign-currency hard capacity is enforced without capping base currency", () => {
  const portfolio = snapshot();
  portfolio.positions[0] = {
    ...portfolio.positions[0]!,
    quantity: "600",
    marketPrice: "50",
    assetCurrency: "EUR",
    fxRateToBase: "2",
    marketValueBase: "60000",
    costBasisBase: "55000",
  };
  portfolio.cashBalances[0]!.amount = "25000";
  portfolio.cashBalances[0]!.amountBase = "25000";
  const result = proposeAllocationV1(longTermRequest({
    requestedAmountBase: "10000",
    currentPrice: "50",
    assetCurrency: "EUR",
    fxRateToBase: "2",
    portfolioSnapshot: portfolio,
  }));
  assert.equal(result.status, "REDUCED");
  assert.equal(result.approvedAmount, "5000");
  assert.ok(result.constraintsTriggered.includes("CURRENCY_GROSS_LIMIT"));
  assert.equal(result.riskHandoff.requiresManualReview, true);
});

test("Crisis or drawdown pause creates zero new Momentum risk without changing score", () => {
  const request = momentumRequest();
  if (request.sizingSignal.kind !== "MOMENTUM") throw new Error("fixture mismatch");
  request.sizingSignal.marketRegimeMultiplier = 0;
  const result = proposeAllocationV1(request);
  assert.equal(request.sizingSignal.score, 90);
  assert.equal(result.approvedAmount, "0");
  assert.equal(result.status, "REJECTED");
  assert.ok(result.constraintsTriggered.includes("MOMENTUM_TRADE_RISK_LIMIT"));
});

test("Future Core position and sub-bucket hard limits reduce an otherwise eligible request", () => {
  const portfolio = snapshot();
  portfolio.positions.push({
    lotId: "future-c", companyId: "company-c", securityId: "security-c", strategy: "FUTURE_CORE",
    quantity: "55", marketPrice: "100", assetCurrency: "USD", fxRateToBase: "1", marketValueBase: "5500",
    costBasisBase: "5000", sectorCode: "HEALTHCARE", industryCode: "MEDICAL_DEVICES", exposureTags: [], liquidityTier: "L1",
  });
  portfolio.cashBalances[0]!.amount = "72500";
  portfolio.cashBalances[0]!.amountBase = "72500";
  const request = longTermRequest({
    lotStrategy: "FUTURE_CORE",
    requestedAmountBase: "2000",
    portfolioSnapshot: portfolio,
    sizingSignal: {
      kind: "LONG_TERM", evaluationId: "future-evaluation-1", profile: "FUTURE_CORE", action: "ACCUMULATE",
      score: 82, confidence: 75, valuationClassification: "ATTRACTIVE", thesisStatus: "UNCHANGED", stage: "FUTURE_CORE",
    },
  });
  const result = proposeAllocationV1(request);
  assert.equal(result.approvedAmount, "500");
  assert.ok(result.constraintsTriggered.includes("POSITION_LIMIT"));
});

test("ineligible strategy action keeps cash instead of forcing an allocation", () => {
  const request = longTermRequest();
  if (request.sizingSignal.kind !== "LONG_TERM") throw new Error("fixture mismatch");
  request.sizingSignal.action = "WATCH";
  const result = proposeAllocationV1(request);
  assert.equal(result.status, "REJECTED");
  assert.equal(result.approvedAmount, "0");
  assert.ok(result.reasons.includes("LONG_TERM_ACTION_WATCH"));
});

test("snapshot validation rejects duplicate Lots, incorrect FX values and missing Momentum stops", () => {
  const duplicate = snapshot();
  duplicate.positions.push(structuredClone(duplicate.positions[0]!));
  assert.throws(() => buildPortfolioLedger(duplicate), /lot ids must be unique/);
  const wrongFx = snapshot();
  wrongFx.cashBalances[0]!.amountBase = "1";
  assert.throws(() => buildPortfolioLedger(wrongFx), /does not match amount/);
  const missingStop = snapshot();
  delete missingStop.positions[1]!.stopPrice;
  assert.throws(() => buildPortfolioLedger(missingStop), /active stop/);
});

test("policy and drawdown states enforce ordered hard limits and monotonic reduction", () => {
  assert.equal(validatePortfolioPolicyV1(structuredClone(DEFAULT_PORTFOLIO_POLICY_V1)).version, "portfolio-v1");
  const invalid = structuredClone(DEFAULT_PORTFOLIO_POLICY_V1);
  invalid.momentum.target = 0.25;
  assert.throws(() => validatePortfolioPolicyV1(invalid), /target/);
  assert.deepEqual(momentumDrawdownMultiplier(2), { state: "NORMAL", multiplier: 1 });
  assert.deepEqual(momentumDrawdownMultiplier(6), { state: "REDUCED_RISK", multiplier: 0.5 });
  assert.deepEqual(momentumDrawdownMultiplier(9), { state: "PAUSE", multiplier: 0 });
});

test("stress scenario separates bucket losses and identifies the top contributor", () => {
  const result = runPortfolioStressTestV1({
    id: "stress-1",
    snapshot: snapshot(),
    evaluatedAt: "2026-07-22T20:05:00Z",
    scenario: {
      id: "market-down-20", version: "v1", name: "Market -20",
      marketShockPercent: -0.2, sectorShocks: { SEMICONDUCTOR: -0.1 }, themeShocks: { AI_CAPEX: -0.1 },
      currencyShocks: {}, liquidityHaircut: 0.5, momentumGapMultiplier: 2,
      assumptions: ["market-wide selloff", "liquidity halves"],
    },
  });
  assert.ok(result.estimatedLossPercent > 0);
  assert.equal(result.topContributors[0]?.lotId, "momentum-lot-b");
  assert.equal(result.resultHash.length, 64);
});

test("historical replay is deterministic and cannot mutate operational state", () => {
  const first = replayAllocationV1(longTermRequest());
  const second = replayAllocationV1({ ...longTermRequest(), untrustedScore: 999 } as AllocationRequestV1);
  assert.equal(first.resultHash, second.resultHash);
  assert.equal(first.operationalStateChangeAllowed, false);
  assert.equal(divideDecimalFloor("10", "3", 2), "3.33");
  assert.equal(multiplyDecimal("1.25", "2.4"), "3");
});

test("new capital batch uses a stable order and never exceeds shared cash", () => {
  const second = longTermRequest({
    id: "allocation-v1-2",
    companyId: "company-d",
    securityId: "security-d",
    sectorCode: "CONSUMER",
    industryCode: "RETAIL",
    themeKeys: ["PREMIUMIZATION"],
  });
  const decision = allocateNewCapitalV1({
    id: "capital-batch-1",
    portfolioId: "portfolio-1",
    userId: "user-1",
    generatedAt: "2026-07-22T20:05:00Z",
    dataAsOf: "2026-07-22T20:00:00Z",
    capitalSource: "SALARY",
    availableAmount: "6000",
    currency: "USD",
    requests: [second, longTermRequest()],
    stressSummary: "BASELINE_WITHIN_LIMITS",
  });
  assert.deepEqual(decision.proposals.map((proposal) => proposal.id), ["allocation-v1-1", "allocation-v1-2"]);
  assert.deepEqual(decision.proposals.map((proposal) => proposal.approvedAmount), ["5000", "1000"]);
  assert.equal(decision.cashRetained, "0");
  assert.equal(decision.resultHash.length, 64);
});

test("rebalance review never creates orders and surfaces concentration breaches", () => {
  const concentrated = snapshot();
  concentrated.positions[0]!.quantity = "110";
  concentrated.positions[0]!.marketValueBase = "11000";
  concentrated.cashBalances[0]!.amount = "74000";
  concentrated.cashBalances[0]!.amountBase = "74000";
  const review = assessPortfolioRebalanceV1({
    id: "rebalance-1",
    portfolioId: "portfolio-1",
    userId: "user-1",
    generatedAt: "2026-07-22T20:05:00Z",
    trigger: "LIMIT_BREACH",
    snapshot: concentrated,
    policy: structuredClone(DEFAULT_PORTFOLIO_POLICY_V1),
  });
  assert.equal(review.automaticOrdersAllowed, false);
  assert.equal(review.requiresManualReview, true);
  assert.ok(review.actions.some((item) => item.scope === "COMPANY" && item.action === "REDUCE_POSITION"));
  assert.equal(review.resultHash.length, 64);
});
