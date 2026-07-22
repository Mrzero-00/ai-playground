import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { MOMENTUM_FACTOR_WEIGHTS, type MomentumEvaluationInput, type MomentumFactorId } from "@investment-os/core";
import { server } from "../src/index.js";

function requestBody(): MomentumEvaluationInput {
  const factorIds = Object.keys(MOMENTUM_FACTOR_WEIGHTS) as MomentumFactorId[];
  const scoringEvidenceIds = factorIds.map((factor) => `api-evidence-${factor}`);
  return {
    id: "api-momentum-1",
    companyId: "api-momentum-company-1",
    securityId: "api-momentum-security-1",
    evaluatedAt: "2026-07-22T21:10:00Z",
    dataAsOf: "2026-07-22T20:00:00Z",
    marketPriceAsOf: "2026-07-22T21:00:00Z",
    mode: "SETUP_VALIDATION",
    modelVersionId: "api-momentum-model-v1",
    philosophyVersionId: "philosophy-v2.2.1",
    universePolicy: {
      id: "api-universe-1", version: "api-universe-v1", market: "US",
      allowedSecurityTypes: ["COMMON_STOCK", "ADR", "ETF"], minimumPrice: "5",
      minimumMarketCap: "300000000", minimumAddv20: "10000000", maximumMedianSpreadBps: 50,
      minimumListingSessions: 120, excludedVenues: ["OTC"], excludedRiskFlags: ["PUMP_RISK"],
      effectiveFrom: "2026-01-01T00:00:00Z",
    },
    universe: {
      securityType: "COMMON_STOCK", venue: "NASDAQ", price: "101", marketCap: "10000000000",
      addv20: "120000000", medianSpreadBps: 10, listingSessions: 1000, riskFlags: [],
      halted: false, delistingProcess: false, identityResolved: true, quoteSourcesConsistent: true,
      corporateActionsApplied: true, snapshotIds: ["api-snapshot-market"],
    },
    marketRegime: {
      regime: "RISK_ON_TREND", confidence: 90, permission: "ALLOW", riskMultiplier: 1,
      reasonCodes: ["TREND_BREADTH_ALIGNED"], snapshotIds: ["api-snapshot-regime"],
      evaluatedAt: "2026-07-22T20:30:00Z",
    },
    setupId: "api-setup-1",
    setupDefinition: {
      type: "BREAKOUT", version: "breakout-v1", requiredIndicators: ["ATR14", "VOLUME_RATIO50", "RS_COMPOSITE"],
      criticalFactorIds: ["MOM_PRICE_STRUCTURE", "MOM_LIQUIDITY_EXECUTION", "MOM_REWARD_RISK_TIMING"],
      allowedNotApplicableFactorIds: [], defaultHoldingSessions: { min: 5, max: 15 },
      allowedRegimes: ["RISK_ON_TREND", "RISK_ON_VOLATILE", "NEUTRAL_RANGE"], eventPolicy: "NO_KNOWN_EVENT",
    },
    setupMetrics: {
      baseSessions: 30, baseDepthPercent: 20, resistanceBreakConfirmed: true,
      breakoutVolumeRatio: 1.8, closeLocationPercent: 15, chaseDistanceAtr: 0.4,
    },
    triggerStatus: "TRIGGERED",
    detectedAt: "2026-07-22T20:30:00Z",
    invalidationConditions: ["close below breakout level"],
    factors: Object.fromEntries(factorIds.map((factor) => [factor, {
      availability: "AVAILABLE", score: 80, bearScore: 70, bullScore: 90,
      evidenceIds: [`api-evidence-${factor}`], counterEvidenceIds: ["api-counter-1"], explanation: "supported",
    }])),
    confidence: {
      evidenceCoverage: 90, sourceQuality: 85, dataFreshness: 95, modelFit: 85,
      disagreement: 10, hasCounterEvidence: true,
    },
    tradePlan: {
      id: "api-plan-1", revision: 1, companyId: "api-momentum-company-1",
      securityId: "api-momentum-security-1", evaluationId: "api-momentum-1", setupId: "api-setup-1",
      setupType: "BREAKOUT", marketRegime: "RISK_ON_TREND", currency: "USD",
      entryZoneMin: "100", entryZoneMax: "102", chaseLimit: "104", trigger: "volume-confirmed breakout",
      initialStop: "95", target1: "111", target2: "114", timeStopSessions: 10,
      referenceEntry: "101", unitRisk: "6", rewardRiskToTarget1: 1.67, rewardRiskToTarget2: 2.17,
      estimatedRoundTripCostR: 0.1, invalidationConditions: ["close below breakout level"],
      eventPolicy: "NO_KNOWN_EVENT", evidenceIds: ["api-evidence-MOM_PRICE_STRUCTURE"],
      counterEvidenceIds: ["api-counter-1"], snapshotIds: ["api-snapshot-market"],
      modelVersionId: "api-momentum-model-v1", generatedAt: "2026-07-22T21:00:00Z",
      expiresAt: "2026-07-23T21:00:00Z",
    },
    eventRisk: {
      calendarKnown: true, eventWithinPlanHorizon: false, binaryEvent: false,
      officialScheduleConsistent: true, policy: "NO_KNOWN_EVENT", manualReviewApproved: false, gapRiskScore: 20,
    },
    signalContext: {
      activePosition: false, stopOrInvalidationTriggered: false, marketDataFresh: true,
      corporateActionsApplied: true, behavioralPolicyClear: true,
    },
    currentPrice: "101",
    executionRisk: 20,
    snapshotIds: ["api-snapshot-market", "api-snapshot-regime"],
    evidenceIds: [...scoringEvidenceIds, "api-counter-1"],
    scoringEvidenceIds,
    counterEvidenceIds: ["api-counter-1"],
    nextReviewAt: "2026-07-23T13:00:00Z",
    expiresAt: "2026-07-23T21:00:00Z",
  };
}

test("Momentum v1 API persists immutable evaluations, plans, rankings and outbox events", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const origin = `http://127.0.0.1:${address.port}`;
  const input = requestBody();
  const headers = {
    "content-type": "application/json",
    "idempotency-key": "momentum-create-1",
    "x-correlation-id": "momentum-correlation-1",
  };
  const body = JSON.stringify(input);
  const first = await fetch(`${origin}/api/v1/momentum/evaluations`, { method: "POST", headers, body });
  const second = await fetch(`${origin}/api/v1/momentum/evaluations`, { method: "POST", headers, body });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  const created = await first.json() as { id: string; action: string; resultHash: string };
  assert.equal(created.action, "ENTER");
  assert.equal(created.resultHash.length, 64);
  assert.deepEqual(await second.json(), created);

  const byId = await fetch(`${origin}/api/v1/momentum/evaluations/${created.id}`);
  assert.equal(byId.status, 200);
  assert.equal((await byId.json() as { id: string }).id, created.id);
  const latest = await fetch(`${origin}/api/v1/companies/api-momentum-company-1/momentum`);
  assert.equal(latest.status, 200);
  assert.equal((await latest.json() as { id: string }).id, created.id);

  const ranking = await fetch(`${origin}/api/v1/momentum/rankings?modelVersionId=api-momentum-model-v1&universePolicyVersionId=api-universe-v1&session=2026-07-22`);
  assert.equal(ranking.status, 200);
  const rankingBody = await ranking.json() as { items: Array<{ evaluationId: string }> };
  assert.equal(rankingBody.items[0]?.evaluationId, created.id);
  const reviews = await fetch(`${origin}/api/v1/momentum/reviews/due?asOf=2026-07-24T00:00:00Z`);
  assert.equal(reviews.status, 200);
  assert.equal((await reviews.json() as { items: Array<{ id: string }> }).items[0]?.id, created.id);

  const planHeaders = { "content-type": "application/json", "idempotency-key": "momentum-plan-create-1" };
  const planCreate = await fetch(`${origin}/api/v1/momentum/plans`, {
    method: "POST", headers: planHeaders, body: JSON.stringify(input.tradePlan),
  });
  assert.equal(planCreate.status, 201);
  const plan = await planCreate.json() as { id: string; revision: number };
  assert.equal(plan.revision, 1);
  const planGet = await fetch(`${origin}/api/v1/momentum/plans/${plan.id}`);
  assert.equal(planGet.status, 200);
  const priceCheck = await fetch(`${origin}/api/v1/momentum/plans/${plan.id}/validate-price`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "momentum-plan-price-1" },
    body: JSON.stringify({ currentPrice: "105" }),
  });
  assert.equal(priceCheck.status, 200);
  assert.equal((await priceCheck.json() as { position: string }).position, "CHASED");

  const revision = {
    ...input.tradePlan!, id: "api-plan-2", revision: 2, supersedesPlanId: "api-plan-1",
    generatedAt: "2026-07-22T21:05:00Z", expiresAt: "2026-07-24T21:00:00Z",
  };
  const revise = await fetch(`${origin}/api/v1/momentum/plans/api-plan-1/revisions`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "momentum-plan-revision-1" },
    body: JSON.stringify(revision),
  });
  assert.equal(revise.status, 201);
  assert.equal((await revise.json() as { revision: number }).revision, 2);

  const audit = await fetch(`${origin}/api/v1/audit/${created.id}`);
  assert.equal(audit.status, 200);
  assert.ok((await audit.json() as Array<{ action: string }>).some((record) => record.action === "MOMENTUM_EVALUATED"));
  const publish = await fetch(`${origin}/api/v1/operations/outbox/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "publish-momentum-1" },
    body: "{}",
  });
  assert.equal(publish.status, 200);
  const events = await fetch(`${origin}/api/v1/events/${created.id}`);
  assert.equal(events.status, 200);
  assert.ok((await events.json() as Array<{ type: string }>).some((event) => event.type === "MomentumEvaluationCompleted"));

  const replayInput = { ...requestBody(), id: "api-momentum-replay-1" };
  replayInput.tradePlan = { ...replayInput.tradePlan!, id: "api-replay-plan-1", evaluationId: replayInput.id };
  const replay = await fetch(`${origin}/api/v1/momentum/replays`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "momentum-replay-1" },
    body: JSON.stringify(replayInput),
  });
  assert.equal(replay.status, 200);
  const replayBody = await replay.json() as { mode: string; operationalStateChangeAllowed: boolean };
  assert.equal(replayBody.mode, "HISTORICAL_REPLAY");
  assert.equal(replayBody.operationalStateChangeAllowed, false);
});
