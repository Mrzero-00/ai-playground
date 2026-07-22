import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { ScorecardResultV1, ScoreChangeExplanationV1, ScoreModelInputV1, ScoreModelV1, ScoreRankingResultV1 } from "@investment-os/core";
import { server } from "../src/index.js";

function post(origin: string, path: string, body: unknown, key: string): Promise<Response> {
  return fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, "x-correlation-id": `scoring-${key}` }, body: JSON.stringify(body) });
}

function model(overrides: Partial<ScoreModelInputV1> = {}): ScoreModelInputV1 {
  return {
    id: "api-score-model-1", userId: "api-score-user", version: "core-1.0.0", scope: "LONG_TERM_CORE", status: "DRAFT",
    factorDefinitions: [
      { id: "QUALITY", label: "Quality", direction: "HIGHER_IS_BETTER", weightBasisPoints: 6000, critical: true, allowedNotApplicable: false,
        normalization: { kind: "LINEAR", floor: 0, ceiling: 10 }, evidencePolicy: { minimumSourceTier: "A", minimumDistinctSources: 1, counterEvidenceRequired: true, pointInTimeRequired: true }, effectiveFrom: "2026-07-22T00:00:00Z" },
      { id: "RISK", label: "Risk resilience", direction: "HIGHER_IS_WORSE", weightBasisPoints: 4000, critical: false, allowedNotApplicable: true,
        normalization: { kind: "LINEAR", floor: 0, ceiling: 10 }, evidencePolicy: { minimumSourceTier: "B", minimumDistinctSources: 1, counterEvidenceRequired: false, pointInTimeRequired: true }, partialScoreCap: 70, effectiveFrom: "2026-07-22T00:00:00Z" },
    ],
    minimumApplicableWeightBasisPoints: 6000,
    thresholds: [{ id: "CORE_ENTRY", minimumScore: 78, minimumConfidence: 75, purpose: "new Core entry" }],
    confidencePolicy: { weightsBasisPoints: { EVIDENCE_COVERAGE: 3500, SOURCE_QUALITY: 2500, FRESHNESS: 0, MODEL_FIT: 2500, AGREEMENT: 1500 }, grades: { high: 80, medium: 65, low: 50 } },
    effectiveFrom: "2026-07-23T00:00:00Z", changeReason: "API scoring fixture", ...overrides,
  };
}

function scorecard(id: string, quality: number, risk: number, subjectId = "api-score-company") {
  return {
    id, userId: "api-score-user", subjectType: "COMPANY", subjectId, mode: "OPERATIONAL", modelId: "api-score-model-1",
    philosophyVersionId: "philosophy-2.2.1", industryProfileVersionId: "software-1",
    observations: [
      { factorId: "QUALITY", availability: "AVAILABLE", rawValue: quality, evidenceIds: ["api-quality"], counterEvidenceIds: ["api-counter"], observedAt: "2026-07-22T09:00:00Z", availableAt: "2026-07-22T10:00:00Z", explanation: "quality evidence" },
      { factorId: "RISK", availability: "AVAILABLE", rawValue: risk, evidenceIds: ["api-risk"], counterEvidenceIds: [], observedAt: "2026-07-22T09:00:00Z", availableAt: "2026-07-22T10:00:00Z", explanation: "risk evidence" },
    ],
    evidence: [
      { id: "api-quality", userId: "api-score-user", sourceId: "audited-filing", sourceTier: "A", scoreEligible: true, observedAt: "2026-07-22T08:00:00Z", availableAt: "2026-07-22T09:00:00Z" },
      { id: "api-risk", userId: "api-score-user", sourceId: "market-data", sourceTier: "B", scoreEligible: true, observedAt: "2026-07-22T08:00:00Z", availableAt: "2026-07-22T09:00:00Z" },
      { id: "api-counter", userId: "api-score-user", sourceId: "counter-research", sourceTier: "C", scoreEligible: false, observedAt: "2026-07-22T08:00:00Z", availableAt: "2026-07-22T09:00:00Z" },
    ],
    confidence: { evidenceCoverage: 90, sourceQuality: 90, freshness: 80, modelFit: 80, disagreement: 10, caps: [] },
    snapshotIds: ["api-snapshot"], evidenceIds: ["api-quality", "api-counter", "api-risk"], asOf: "2026-07-22T12:00:00Z", evaluatedAt: "2026-07-22T12:01:00Z", codeVersion: "api-score-git", secret: "must-not-persist",
  };
}

test("Scoring v1 API preserves Model, Scorecard, Ranking, Change, Audit and Outbox lineage", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const origin = `http://127.0.0.1:${address.port}`;

  const modelResponse = await post(origin, "/api/v1/scoring/models/validate", model(), "model-1");
  assert.equal(modelResponse.status, 201);
  let storedModel = await modelResponse.json() as ScoreModelV1;
  assert.equal(storedModel.modelHash.length, 64);
  const initialHash = storedModel.modelHash;
  for (const [nextStatus, transitionedAt] of [
    ["VALIDATING", "2026-07-22T10:01:00Z"], ["SHADOW", "2026-07-22T10:02:00Z"],
    ["APPROVED", "2026-07-22T10:03:00Z"], ["ACTIVE", "2026-07-22T10:04:00Z"],
  ] as const) {
    const transitionResponse = await post(origin, `/api/v1/scoring/models/${storedModel.id}/transitions`, { nextStatus, actorId: "api-score-reviewer", transitionedAt }, `model-${nextStatus}`);
    assert.equal(transitionResponse.status, 201);
    storedModel = await transitionResponse.json() as ScoreModelV1;
    assert.equal(storedModel.status, nextStatus);
    assert.equal(storedModel.modelHash, initialHash);
  }
  assert.deepEqual(await (await fetch(`${origin}/api/v1/scoring/models/${storedModel.id}`)).json(), storedModel);

  const previousResponse = await post(origin, "/api/v1/scoring/scorecards/evaluate", scorecard("api-scorecard-1", 7, 3), "scorecard-1");
  const currentResponse = await post(origin, "/api/v1/scoring/scorecards/evaluate", scorecard("api-scorecard-2", 9, 1), "scorecard-2");
  assert.equal(previousResponse.status, 201);
  assert.equal(currentResponse.status, 201);
  const previous = await previousResponse.json() as ScorecardResultV1;
  const current = await currentResponse.json() as ScorecardResultV1;
  assert.equal(previous.status, "SCORED");
  assert.ok((current.score?.point ?? 0) > (previous.score?.point ?? 0));
  assert.equal("secret" in current, false);
  assert.deepEqual(await (await fetch(`${origin}/api/v1/scoring/scorecards/${current.id}`)).json(), current);

  const rankingCandidateResponse = await post(origin, "/api/v1/scoring/scorecards/evaluate", scorecard("api-scorecard-ranking", 9, 1, "api-score-company-ranking"), "scorecard-ranking");
  assert.equal(rankingCandidateResponse.status, 201);
  const rankingCandidate = await rankingCandidateResponse.json() as ScorecardResultV1;
  const rankingResponse = await post(origin, "/api/v1/scoring/rankings/validate", { scorecardIds: [previous.id, rankingCandidate.id] }, "ranking-1");
  assert.equal(rankingResponse.status, 200);
  const ranking = await rankingResponse.json() as ScoreRankingResultV1;
  assert.deepEqual(ranking.items.map((item) => item.scorecardId), [rankingCandidate.id, previous.id]);

  const changeResponse = await post(origin, "/api/v1/scoring/changes/explain", {
    id: "api-score-change-1", userId: "api-score-user", previousScorecardId: previous.id, currentScorecardId: current.id, explainedAt: "2026-07-22T13:00:00Z",
  }, "change-1");
  assert.equal(changeResponse.status, 201);
  const change = await changeResponse.json() as ScoreChangeExplanationV1;
  assert.equal(change.comparisonStatus, "COMPARABLE");
  assert.equal(change.pointDelta, 20);

  const replayResponse = await post(origin, "/api/v1/scoring/replays", { ...scorecard("api-scorecard-replay", 9, 1), mode: "OPERATIONAL" }, "replay-1");
  assert.equal(replayResponse.status, 201);
  assert.equal(((await replayResponse.json()) as ScorecardResultV1).mode, "HISTORICAL_REPLAY");

  const nextModelResponse = await post(origin, "/api/v1/scoring/models/validate", model({
    id: "api-score-model-2", version: "core-1.1.0", supersedesModelVersionId: storedModel.id, effectiveFrom: "2026-07-24T00:00:00Z", changeReason: "validated successor",
  }), "model-2");
  assert.equal(nextModelResponse.status, 201);
  let nextModel = await nextModelResponse.json() as ScoreModelV1;
  for (const [nextStatus, transitionedAt] of [
    ["VALIDATING", "2026-07-22T14:01:00Z"], ["SHADOW", "2026-07-22T14:02:00Z"],
    ["APPROVED", "2026-07-22T14:03:00Z"], ["ACTIVE", "2026-07-22T14:04:00Z"],
  ] as const) {
    const transitionResponse = await post(origin, `/api/v1/scoring/models/${nextModel.id}/transitions`, { nextStatus, actorId: "api-score-reviewer", transitionedAt }, `model-2-${nextStatus}`);
    assert.equal(transitionResponse.status, 201);
    nextModel = await transitionResponse.json() as ScoreModelV1;
  }
  const deprecatedPrevious = await (await fetch(`${origin}/api/v1/scoring/models/${storedModel.id}`)).json() as ScoreModelV1;
  assert.equal(deprecatedPrevious.status, "DEPRECATED");

  const publishResponse = await post(origin, "/api/v1/operations/outbox/publish", {}, "score-publish-1");
  assert.equal(publishResponse.status, 200);
  const events = await (await fetch(`${origin}/api/v1/events/${current.id}`)).json() as Array<{ type: string }>;
  assert.ok(events.some((event) => event.type === "ScorecardEvaluated"));
  const audit = await (await fetch(`${origin}/api/v1/audit/${change.id}`)).json() as Array<{ action: string }>;
  assert.ok(audit.some((record) => record.action === "SCORING_CHANGE_EXPLAINED"));
});
