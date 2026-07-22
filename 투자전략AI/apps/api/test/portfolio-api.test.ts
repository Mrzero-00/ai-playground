import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import {
  DEFAULT_PORTFOLIO_POLICY_V1,
  type AllocationRequestV1,
  type PortfolioSnapshotV1,
} from "@investment-os/core";
import { server } from "../src/index.js";

function snapshot(): PortfolioSnapshotV1 {
  return {
    id: "api-portfolio-snapshot-1",
    portfolioId: "api-portfolio-1",
    userId: "api-user-1",
    baseCurrency: "USD",
    asOf: "2026-07-22T20:00:00Z",
    positions: [
      {
        lotId: "api-core-lot", companyId: "api-company-a", securityId: "api-security-a", strategy: "CORE",
        quantity: "70", marketPrice: "100", assetCurrency: "USD", fxRateToBase: "1",
        marketValueBase: "7000", costBasisBase: "6000", sectorCode: "SOFTWARE", industryCode: "APPLICATION_SOFTWARE",
        exposureTags: [{ dimension: "THEME", key: "AI_CAPEX", sensitivity: 0.5, confidence: 1, evidenceIds: ["api-exposure-1"] }],
        liquidityTier: "L1",
      },
      {
        lotId: "api-momentum-lot", companyId: "api-company-b", securityId: "api-security-b", strategy: "MOMENTUM",
        quantity: "50", marketPrice: "100", assetCurrency: "USD", fxRateToBase: "1",
        marketValueBase: "5000", costBasisBase: "5000", stopPrice: "95", gapScenarioLossPerUnitBase: "10",
        sectorCode: "SEMICONDUCTOR", industryCode: "CHIPS",
        exposureTags: [{ dimension: "THEME", key: "AI_CAPEX", sensitivity: 0.8, confidence: 1, evidenceIds: ["api-exposure-2"] }],
        liquidityTier: "L1",
      },
    ],
    cashBalances: [
      { id: "api-cash-long", currency: "USD", amount: "78000", fxRateToBase: "1", amountBase: "78000", owner: "LONG_TERM", available: true },
      { id: "api-cash-momentum", currency: "USD", amount: "10000", fxRateToBase: "1", amountBase: "10000", owner: "MOMENTUM", available: true },
    ],
    liabilitiesBase: "0",
    reservedCashBase: "0",
    fxSnapshotId: "api-fx-snapshot-1",
    marketSnapshotIds: ["api-market-snapshot-1"],
    complete: true,
    anomalyFlags: [],
  };
}

function requestBody(id: string, companyId = "api-company-c"): AllocationRequestV1 {
  return {
    id,
    portfolioId: "api-portfolio-1",
    userId: "api-user-1",
    generatedAt: "2026-07-22T20:05:00Z",
    expiresAt: "2026-07-22T20:20:00Z",
    mode: "SINGLE",
    strategy: "LONG_TERM",
    lotStrategy: "CORE",
    fundingBucket: "LONG_TERM",
    companyId,
    securityId: `${companyId}-security`,
    sectorCode: companyId === "api-company-c" ? "HEALTHCARE" : "CONSUMER",
    industryCode: companyId === "api-company-c" ? "MEDICAL_DEVICES" : "RETAIL",
    themeKeys: [companyId === "api-company-c" ? "AGING" : "PREMIUMIZATION"],
    action: "ACCUMULATE",
    requestedAmountBase: "5000",
    currentPrice: "100",
    assetCurrency: "USD",
    fxRateToBase: "1",
    sizingSignal: {
      kind: "LONG_TERM", evaluationId: `${companyId}-evaluation`, profile: "CORE", action: "ACCUMULATE",
      score: 85, confidence: 85, valuationClassification: "ATTRACTIVE", thesisStatus: "UNCHANGED", stage: "CORE",
    },
    portfolioSnapshot: snapshot(),
    policy: structuredClone(DEFAULT_PORTFOLIO_POLICY_V1),
    liquidity: { addv20Base: "100000000", liquidityTier: "L1", maximumExitDays: 5, lotSize: "1", fractionalSharesAllowed: false },
    snapshotIds: ["api-portfolio-snapshot-1", "api-market-snapshot-1", "api-fx-snapshot-1"],
  };
}

function post(origin: string, path: string, body: unknown, key: string): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key, "x-correlation-id": `correlation-${key}` },
    body: JSON.stringify(body),
  });
}

test("Portfolio v1 API persists proposals, batch allocation, rebalance and stress with audit events", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const origin = `http://127.0.0.1:${address.port}`;

  const proposalResponse = await post(origin, "/api/v1/allocations/proposals", requestBody("api-allocation-1"), "portfolio-proposal-1");
  assert.equal(proposalResponse.status, 201);
  const proposal = await proposalResponse.json() as { id: string; approvedAmount: string; resultHash: string };
  assert.equal(proposal.approvedAmount, "5000");
  assert.equal(proposal.resultHash.length, 64);
  assert.equal((await fetch(`${origin}/api/v1/allocations/proposals/${proposal.id}`)).status, 200);
  assert.equal((await fetch(`${origin}/api/v1/portfolios/api-portfolio-1`)).status, 200);
  assert.equal((await fetch(`${origin}/api/v1/portfolios/api-portfolio-1/exposures`)).status, 200);
  const openRiskResponse = await fetch(`${origin}/api/v1/portfolios/api-portfolio-1/open-risk`);
  assert.equal(openRiskResponse.status, 200);
  assert.equal((await openRiskResponse.json() as { openRiskWeight: number }).openRiskWeight, 0.005);

  const batchInput = {
    id: "api-capital-batch-1", portfolioId: "api-portfolio-1", userId: "api-user-1",
    generatedAt: "2026-07-22T20:05:00Z", dataAsOf: "2026-07-22T20:00:00Z",
    capitalSource: "SALARY", availableAmount: "6000", currency: "USD",
    requests: [requestBody("api-allocation-3", "api-company-d"), requestBody("api-allocation-2")],
    stressSummary: "BASELINE_WITHIN_LIMITS",
  };
  const batchResponse = await post(origin, "/api/v1/allocations/new-capital", batchInput, "portfolio-batch-1");
  assert.equal(batchResponse.status, 201);
  const batch = await batchResponse.json() as { id: string; proposals: Array<{ id: string }>; cashRetained: string; resultHash: string };
  assert.deepEqual(batch.proposals.map((item) => item.id), ["api-allocation-2", "api-allocation-3"]);
  assert.equal(batch.cashRetained, "0");
  assert.equal((await fetch(`${origin}/api/v1/allocations/new-capital/${batch.id}`)).status, 200);

  const rebalanceResponse = await post(origin, "/api/v1/portfolios/api-portfolio-1/rebalance", {
    id: "api-rebalance-1", portfolioId: "api-portfolio-1", userId: "api-user-1",
    generatedAt: "2026-07-22T20:05:00Z", trigger: "SCHEDULED_REVIEW",
    snapshot: snapshot(), policy: structuredClone(DEFAULT_PORTFOLIO_POLICY_V1),
  }, "portfolio-rebalance-1");
  assert.equal(rebalanceResponse.status, 201);
  const rebalance = await rebalanceResponse.json() as { id: string; automaticOrdersAllowed: boolean; resultHash: string };
  assert.equal(rebalance.automaticOrdersAllowed, false);
  assert.equal(rebalance.resultHash.length, 64);
  assert.equal((await fetch(`${origin}/api/v1/portfolio/rebalance-reviews/${rebalance.id}`)).status, 200);

  const stressResponse = await post(origin, "/api/v1/portfolios/api-portfolio-1/stress-tests", {
    id: "api-stress-1", snapshot: snapshot(), evaluatedAt: "2026-07-22T20:05:00Z",
    scenario: {
      id: "api-market-down-20", version: "v1", name: "Market -20",
      marketShockPercent: -0.2, sectorShocks: { SEMICONDUCTOR: -0.1 }, themeShocks: { AI_CAPEX: -0.1 },
      currencyShocks: {}, liquidityHaircut: 0.5, momentumGapMultiplier: 2, assumptions: ["market selloff"],
    },
  }, "portfolio-stress-1");
  assert.equal(stressResponse.status, 201);
  const stress = await stressResponse.json() as { id: string; resultHash: string };
  assert.equal(stress.resultHash.length, 64);
  assert.equal((await fetch(`${origin}/api/v1/portfolio/stress-results/${stress.id}`)).status, 200);

  const publish = await post(origin, "/api/v1/operations/outbox/publish", {}, "portfolio-publish-1");
  assert.equal(publish.status, 200);
  const batchEvents = await fetch(`${origin}/api/v1/events/${batch.id}`);
  assert.ok((await batchEvents.json() as Array<{ type: string }>).some((event) => event.type === "CapitalAllocationDecisionCreated"));
  const proposalAudit = await fetch(`${origin}/api/v1/audit/${proposal.id}`);
  assert.ok((await proposalAudit.json() as Array<{ action: string }>).some((record) => record.action === "PORTFOLIO_PROPOSAL_CREATED"));
});
