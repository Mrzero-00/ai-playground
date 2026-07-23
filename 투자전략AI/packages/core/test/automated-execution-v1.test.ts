import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAdversePriceDriftBps,
  createAutomatedExecutionIntentV1,
  evaluateExecutionPreflightV1,
  isAutomatedExecutionTerminalV1,
  transitionAutomatedExecutionStatusV1,
  type AutomatedExecutionIntentInputV1,
  type ExecutionPreflightObservationV1,
  type ExecutionRuntimeGateV1,
} from "../src/index.js";

function intentInput(overrides: Partial<AutomatedExecutionIntentInputV1> = {}): AutomatedExecutionIntentInputV1 {
  return {
    id: "intent-1",
    userId: "user-1",
    portfolioId: "portfolio-1",
    accountId: "account-1",
    decisionId: "decision-1",
    proposalId: "proposal-1",
    riskDecisionId: "risk-1",
    portfolioSnapshotId: "snapshot-1",
    decisionStatus: "APPROVED",
    riskStatus: "ALLOW",
    approvedBy: "user-1",
    approvedAt: "2026-07-23T00:01:00Z",
    createdAt: "2026-07-23T00:02:00Z",
    expiresAt: "2026-07-23T00:30:00Z",
    dataAsOf: "2026-07-23T00:00:00Z",
    strategy: "CORE",
    symbol: "005930",
    market: "KR",
    side: "BUY",
    orderType: "LIMIT",
    timeInForce: "DAY",
    quantity: "2",
    limitPrice: "70000",
    approvedReferencePrice: "70000",
    approvedNotional: "140000",
    currency: "KRW",
    snapshotIds: ["market-1", "snapshot-1"],
    policyVersionIds: ["execution-policy-1", "portfolio-policy-1"],
    ...overrides,
  };
}

function runtime(overrides: Partial<ExecutionRuntimeGateV1> = {}): ExecutionRuntimeGateV1 {
  return {
    mode: "DRY_RUN",
    autoTradingEnabled: false,
    liveTradingAcknowledged: false,
    releaseEvidenceVerified: false,
    accountAllowed: true,
    killSwitchOpen: false,
    maxSingleOrderNotional: "1000000",
    maxPriceDriftBps: 100,
    maxDataAgeSeconds: 600,
    ...overrides,
  };
}

function observation(overrides: Partial<ExecutionPreflightObservationV1> = {}): ExecutionPreflightObservationV1 {
  return {
    checkedAt: "2026-07-23T00:05:00Z",
    currentPrice: "70050",
    priceAsOf: "2026-07-23T00:04:59Z",
    marketOpen: true,
    stockRestricted: false,
    buyingPower: "500000",
    existingOppositeOrder: false,
    reconciliationHealthy: true,
    ...overrides,
  };
}

test("approved intent produces stable lineage and Toss-compatible client order id", () => {
  const first = createAutomatedExecutionIntentV1(intentInput());
  const second = createAutomatedExecutionIntentV1(intentInput({ snapshotIds: ["snapshot-1", "market-1"], policyVersionIds: ["portfolio-policy-1", "execution-policy-1"] }));
  assert.equal(first.resultHash, second.resultHash);
  assert.equal(first.clientOrderId.length, 35);
  assert.match(first.clientOrderId, /^io-[a-f0-9]{32}$/);
  assert.equal(first.status, "CREATED");
});

test("order contract rejects amount/quantity ambiguity and market price leakage", () => {
  assert.throws(() => createAutomatedExecutionIntentV1(intentInput({ orderAmount: "140000" })), /exactly one/);
  assert.throws(() => createAutomatedExecutionIntentV1(intentInput({ orderType: "MARKET", limitPrice: "70000" })), /cannot include/);
  assert.throws(() => createAutomatedExecutionIntentV1(intentInput({ quantity: "1.5" })), /KR execution quantity/);
  assert.throws(() => createAutomatedExecutionIntentV1(intentInput({ approvedNotional: "100" })), /reference notional/);
  assert.throws(() => createAutomatedExecutionIntentV1(intentInput({ limitPrice: "80000" })), /Limit order notional/);
});

test("US amount order is limited to market buys and CLS is limited to US limits", () => {
  const amount = createAutomatedExecutionIntentV1(intentInput({
    symbol: "AAPL", market: "US", currency: "USD", side: "BUY", orderType: "MARKET", quantity: undefined,
    orderAmount: "100.00", limitPrice: undefined, approvedReferencePrice: "200", approvedNotional: "100",
  }));
  assert.equal(amount.orderAmount, "100.00");
  assert.throws(() => createAutomatedExecutionIntentV1(intentInput({ timeInForce: "CLS" })), /CLS/);
});

test("dry run passes safety checks but never permits external submission", () => {
  const result = evaluateExecutionPreflightV1(createAutomatedExecutionIntentV1(intentInput()), runtime(), observation());
  assert.equal(result.allowed, true);
  assert.equal(result.orderNotional, "140000");
  assert.equal(result.externalSubmissionAllowed, false);
  assert.deepEqual(result.warningCodes, ["DRY_RUN_NO_EXTERNAL_SUBMISSION"]);
});

test("live execution requires enablement, acknowledgement and release evidence", () => {
  const blocked = evaluateExecutionPreflightV1(createAutomatedExecutionIntentV1(intentInput()), runtime({ mode: "LIVE" }), observation());
  assert.equal(blocked.allowed, false);
  assert.deepEqual(blocked.blockerCodes.filter((code) => code.startsWith("LIVE")), [
    "LIVE_ACKNOWLEDGEMENT_MISSING", "LIVE_RELEASE_EVIDENCE_MISSING", "LIVE_TRADING_DISABLED",
  ]);
  const allowed = evaluateExecutionPreflightV1(createAutomatedExecutionIntentV1(intentInput()), runtime({
    mode: "LIVE", autoTradingEnabled: true, liveTradingAcknowledged: true, releaseEvidenceVerified: true,
  }), observation());
  assert.equal(allowed.externalSubmissionAllowed, true);
});

test("preflight fails closed on stale data, kill switch, drift, cash and reconciliation", () => {
  const result = evaluateExecutionPreflightV1(
    createAutomatedExecutionIntentV1(intentInput({ orderType: "MARKET", limitPrice: undefined, approvedNotional: "142000" })),
    runtime({ mode: "PAPER", killSwitchOpen: true, maxDataAgeSeconds: 60, maxPriceDriftBps: 10 }),
    observation({ currentPrice: "72000", buyingPower: "100", reconciliationHealthy: false }),
  );
  assert.equal(result.allowed, false);
  for (const code of ["KILL_SWITCH_OPEN", "EXECUTION_DATA_STALE", "PRICE_DRIFT_EXCEEDED", "INSUFFICIENT_BUYING_POWER", "RECONCILIATION_UNHEALTHY"]) {
    assert.ok(result.blockerCodes.includes(code), code);
  }
  assert.ok(result.blockerCodes.includes("ORDER_NOTIONAL_EXCEEDS_APPROVAL"));
});

test("sell preflight requires broker-confirmed sellable quantity", () => {
  const intent = createAutomatedExecutionIntentV1(intentInput({ side: "SELL" }));
  const missing = evaluateExecutionPreflightV1(intent, runtime(), observation({ buyingPower: undefined }));
  assert.ok(missing.blockerCodes.includes("SELLABLE_QUANTITY_UNAVAILABLE"));
  const enough = evaluateExecutionPreflightV1(intent, runtime(), observation({ buyingPower: undefined, sellableQuantity: "2" }));
  assert.equal(enough.allowed, true);
});

test("adverse price drift and execution state transitions are directional and fail closed", () => {
  assert.equal(calculateAdversePriceDriftBps("BUY", "100", "101"), 100);
  assert.equal(calculateAdversePriceDriftBps("BUY", "100", "99"), 0);
  assert.equal(calculateAdversePriceDriftBps("SELL", "100", "99"), 101);
  assert.equal(transitionAutomatedExecutionStatusV1("CREATED", "PREFLIGHT_PASSED"), "PREFLIGHT_PASSED");
  assert.throws(() => transitionAutomatedExecutionStatusV1("CREATED", "SUBMITTED"), /Invalid/);
  assert.equal(isAutomatedExecutionTerminalV1("FILLED"), true);
  assert.equal(isAutomatedExecutionTerminalV1("UNKNOWN"), false);
});
