import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { server } from "../src/index.js";

function requestBody() {
  const factorIds = [
    "FC_MARKET_GROWTH", "FC_PRODUCT_PROOF", "FC_MOAT_FORMATION", "FC_UNIT_ECONOMICS",
    "FC_MANAGEMENT_EXECUTION", "FC_SURVIVAL_DILUTION", "FC_VALUATION_ASYMMETRY",
  ];
  const scoringEvidenceIds = factorIds.map((factor) => `evidence-${factor}`);
  return {
    id: "api-long-term-1",
    companyId: "api-company-1",
    securityId: "api-security-1",
    profile: "FUTURE_CORE",
    mode: "FULL_REVIEW",
    evaluatedAt: "2026-07-22T09:00:00Z",
    dataAsOf: "2026-07-21T20:00:00Z",
    marketPriceAsOf: "2026-07-21T20:00:00Z",
    modelVersionId: "long-model-v1",
    philosophyVersionId: "philosophy-v2.2.1",
    industryProfile: {
      id: "software-profile", version: "software-v1", industryCode: "SOFTWARE", name: "Software", status: "ACTIVE",
      supportedProfiles: ["FUTURE_CORE"], notApplicableFactorIds: [], criticalFactorIds: ["FC_SURVIVAL_DILUTION"],
      minimumApplicableWeight: 85, modelFitValidated: true, effectiveFrom: "2026-01-01T00:00:00Z",
    },
    snapshotIds: ["snapshot-1"],
    evidenceIds: [...scoringEvidenceIds, "counter-1", "valuation-bear", "valuation-base", "valuation-bull", "thesis-evidence"],
    scoringEvidenceIds,
    counterEvidenceIds: ["counter-1"],
    currentStage: "STRONG_CANDIDATE",
    factors: Object.fromEntries(factorIds.map((factor) => [factor, {
      availability: "AVAILABLE", score: 80, bearScore: 70, bullScore: 90, trend: "STABLE",
      evidenceIds: [`evidence-${factor}`], counterEvidenceIds: ["counter-1"], explanation: "supported",
    }])),
    confidence: { evidenceCoverage: 90, sourceQuality: 85, modelFit: 85, disagreement: 10, observedQuarters: 6 },
    gates: {
      identityResolved: true, dataQualitySufficient: true, accountingTrustworthy: true, financialSurvival: true,
      valuationAvailable: true, thesisComplete: true, policyVersionActive: true, stressRunwayMonths: 24,
    },
    valuation: {
      currency: "USD", marketPrice: "100", marketPriceAsOf: "2026-07-21T20:00:00Z", classification: "ATTRACTIVE",
      methods: ["DCF", "REVERSE_DCF"], expectedReturnPositive: true, bearLossTolerable: true,
      sensitivityDrivers: ["growth", "margin", "discount-rate"],
      scenarios: [
        { name: "BEAR", probability: 0.25, enterpriseValue: "700", equityValue: "600", valuePerShare: "75", evidenceIds: ["valuation-bear"] },
        { name: "BASE", probability: 0.5, enterpriseValue: "1200", equityValue: "1100", valuePerShare: "125", evidenceIds: ["valuation-base"] },
        { name: "BULL", probability: 0.25, enterpriseValue: "1800", equityValue: "1700", valuePerShare: "180", evidenceIds: ["valuation-bull"] },
      ],
    },
    thesis: {
      thesisId: "thesis-1",
      assumptions: [{ id: "assumption-1", importance: "CRITICAL", previousStatus: "SUPPORTED", currentStatus: "SUPPORTED", evidenceIds: ["thesis-evidence"] }],
    },
    nextReviewAt: "2026-08-22T09:00:00Z",
    reviewTriggers: ["EARNINGS_RELEASED"],
  };
}

test("long-term v1 API stores, reuses and ranks immutable evaluations", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const origin = `http://127.0.0.1:${address.port}`;
  const headers = {
    "content-type": "application/json",
    "idempotency-key": "long-term-create-1",
    "x-correlation-id": "long-term-correlation-1",
  };
  const body = JSON.stringify(requestBody());
  const first = await fetch(`${origin}/api/v1/long-term/evaluations`, { method: "POST", headers, body });
  const second = await fetch(`${origin}/api/v1/long-term/evaluations`, { method: "POST", headers, body });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  const created = await first.json() as { id: string; action: string; proposedStage: string; resultHash: string };
  assert.equal(created.action, "ACCUMULATE");
  assert.equal(created.proposedStage, "FUTURE_CORE");
  assert.equal(created.resultHash.length, 64);
  assert.deepEqual(await second.json(), created);

  const byId = await fetch(`${origin}/api/v1/long-term/evaluations/${created.id}`);
  assert.equal(byId.status, 200);
  assert.equal((await byId.json() as { id: string }).id, created.id);

  const latest = await fetch(`${origin}/api/v1/companies/api-company-1/long-term`);
  assert.equal(latest.status, 200);
  assert.equal((await latest.json() as { id: string }).id, created.id);

  const ranking = await fetch(`${origin}/api/v1/long-term/rankings?profile=FUTURE_CORE`);
  assert.equal(ranking.status, 200);
  const rankingBody = await ranking.json() as { items: Array<{ evaluationId: string }> };
  assert.equal(rankingBody.items[0]?.evaluationId, created.id);

  const dueReviews = await fetch(`${origin}/api/v1/long-term/reviews/due?asOf=2026-09-01T00:00:00Z`);
  assert.equal(dueReviews.status, 200);
  const dueBody = await dueReviews.json() as { items: Array<{ id: string }> };
  assert.equal(dueBody.items[0]?.id, created.id);

  const audit = await fetch(`${origin}/api/v1/audit/${created.id}`);
  assert.equal(audit.status, 200);
  const auditBody = await audit.json() as Array<{ action: string }>;
  assert.ok(auditBody.some((record) => record.action === "LONG_TERM_EVALUATED"));

  const publish = await fetch(`${origin}/api/v1/operations/outbox/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "publish-long-term-1" },
    body: "{}",
  });
  assert.equal(publish.status, 200);
  const events = await fetch(`${origin}/api/v1/events/${created.id}`);
  assert.equal(events.status, 200);
  const eventBody = await events.json() as Array<{ type: string }>;
  assert.ok(eventBody.some((event) => event.type === "LongTermEvaluationCompleted"));
});
