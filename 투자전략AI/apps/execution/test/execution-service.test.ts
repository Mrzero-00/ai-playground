import assert from "node:assert/strict";
import test from "node:test";
import type {
  AutomatedExecutionIntentInputV1,
  BrokerOrderRequestV1,
  BrokerOrderV1,
  BrokerPortV1,
  ExecutionPreflightObservationV1,
  ExecutionRuntimeGateV1,
} from "@investment-os/core";
import { AutomatedExecutionServiceV1 } from "../src/execution-service.js";
import { PaperBrokerV1 } from "../src/paper-broker.js";

function intent(): AutomatedExecutionIntentInputV1 {
  return {
    id: "intent-1", userId: "user-1", portfolioId: "portfolio-1", accountId: "account-1", decisionId: "decision-1",
    proposalId: "proposal-1", riskDecisionId: "risk-1", portfolioSnapshotId: "snapshot-1", decisionStatus: "APPROVED",
    riskStatus: "ALLOW", approvedBy: "user-1", approvedAt: "2026-07-23T00:01:00Z", createdAt: "2026-07-23T00:02:00Z",
    expiresAt: "2026-07-23T00:30:00Z", dataAsOf: "2026-07-23T00:00:00Z", strategy: "CORE", symbol: "005930",
    market: "KR", side: "BUY", orderType: "LIMIT", timeInForce: "DAY", quantity: "1", limitPrice: "70000",
    approvedReferencePrice: "70000", approvedNotional: "70000", currency: "KRW", snapshotIds: ["snapshot-1"],
    policyVersionIds: ["policy-1"],
  };
}

function runtime(mode: ExecutionRuntimeGateV1["mode"]): ExecutionRuntimeGateV1 {
  return {
    mode, autoTradingEnabled: mode === "LIVE", liveTradingAcknowledged: mode === "LIVE", releaseEvidenceVerified: mode === "LIVE",
    accountAllowed: true, killSwitchOpen: false, maxSingleOrderNotional: "1000000", maxPriceDriftBps: 100, maxDataAgeSeconds: 600,
  };
}

function observation(): ExecutionPreflightObservationV1 {
  return { checkedAt: "2026-07-23T00:05:00Z", currentPrice: "70000", priceAsOf: "2026-07-23T00:04:59Z", marketOpen: true, stockRestricted: false, buyingPower: "1000000", existingOppositeOrder: false, reconciliationHealthy: true };
}

test("dry-run service validates but never invokes a broker", async () => {
  const broker = new CountingBroker();
  const result = await new AutomatedExecutionServiceV1({ runtime: runtime("DRY_RUN"), broker }).submit(intent(), observation());
  assert.equal(result.status, "DRY_RUN_VALIDATED");
  assert.equal(result.externalSubmissionAttempted, false);
  assert.equal(broker.createCalls, 0);
});

test("paper service submits through isolated simulator without external-attempt claim", async () => {
  const result = await new AutomatedExecutionServiceV1({ runtime: runtime("PAPER"), broker: new PaperBrokerV1() }).submit(intent(), observation());
  assert.equal(result.status, "SUBMITTED");
  assert.match(result.brokerOrderId!, /^paper-/);
  assert.equal(result.externalSubmissionAttempted, false);
});

test("concurrent identical submissions reserve once and replay the same result", async () => {
  const broker = new CountingBroker();
  const service = new AutomatedExecutionServiceV1({ runtime: runtime("LIVE"), broker });
  const [first, second] = await Promise.all([service.submit(intent(), observation()), service.submit(intent(), observation())]);
  assert.equal(broker.createCalls, 1);
  assert.equal(first.brokerOrderId, second.brokerOrderId);
  assert.equal([first.idempotentReplay, second.idempotentReplay].filter(Boolean).length, 1);
});

test("live network uncertainty becomes UNKNOWN and is not retried as a new order", async () => {
  const broker: BrokerPortV1 = {
    async createOrder() { throw Object.assign(new Error("timeout"), { outcomeUnknown: true as const }); },
    async getOrder() { throw new Error("unused"); },
    async cancelOrder() { throw new Error("unused"); },
  };
  const service = new AutomatedExecutionServiceV1({ runtime: runtime("LIVE"), broker });
  const first = await service.submit(intent(), observation());
  const replay = await service.submit(intent(), observation());
  assert.equal(first.status, "UNKNOWN");
  assert.equal(replay.status, "UNKNOWN");
  assert.equal(replay.idempotentReplay, true);
});

test("kill switch blocks before broker submission", async () => {
  const broker = new CountingBroker();
  const service = new AutomatedExecutionServiceV1({ runtime: { ...runtime("LIVE"), killSwitchOpen: true }, broker });
  const result = await service.submit(intent(), observation());
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockerCodes.includes("KILL_SWITCH_OPEN"));
  assert.equal(broker.createCalls, 0);
});

class CountingBroker implements BrokerPortV1 {
  createCalls = 0;
  async createOrder(order: BrokerOrderRequestV1): Promise<BrokerOrderV1> {
    this.createCalls += 1;
    await Promise.resolve();
    return { brokerOrderId: "broker-order-1", clientOrderId: order.clientOrderId, status: "PENDING", raw: order };
  }
  async getOrder(): Promise<BrokerOrderV1> { throw new Error("unused"); }
  async cancelOrder(): Promise<BrokerOrderV1> { throw new Error("unused"); }
}
