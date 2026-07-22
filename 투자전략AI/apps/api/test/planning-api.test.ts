import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { server } from "../src/index.js";

test("Roadmap API persists an immutable plan, release evidence and deterministic replay", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const base = `http://127.0.0.1:${address.port}/api/v1/roadmap`;
  const post = (path: string, key: string, body: unknown) => fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body),
  });

  const gateInput = {
    id: "gate-api-ci", userId: "roadmap-api-user", name: "CI", environment: "CI", evaluatedAt: "2026-07-22T01:00:00Z",
    checks: [{ id: "tests", category: "QUALITY", required: true, waivable: false, status: "PASSED", evidenceRefs: ["ci://tests/128"], evaluatedAt: "2026-07-22T00:30:00Z", evaluatorId: "ci" }],
  };
  const gateResponse = await post("/gates/evaluate", "gate-api-1", gateInput);
  assert.equal(gateResponse.status, 200);
  const gate = await gateResponse.json() as { id: string; status: string; resultHash: string };
  assert.equal(gate.status, "PASSED");

  const planInput = {
    id: "roadmap-plan-api-1", userId: "roadmap-api-user", version: 1, asOf: "2026-07-22T02:00:00Z", gates: [{ ...gateInput, ...gate }],
    milestones: [{ id: "foundation", version: 1, title: "Foundation", readinessTarget: "R1", status: "RELEASED", dependencyIds: [], requiredGateIds: [gate.id], ownerIds: ["engineering"], scopeRefs: ["docs/12"] }],
  };
  const planResponse = await post("/plans/validate", "plan-api-1", planInput);
  assert.equal(planResponse.status, 201);
  const plan = await planResponse.json() as { id: string; readiness: string; resultHash: string };
  assert.equal(plan.readiness, "R1");

  const stored = await fetch(`${base}/plans/${plan.id}`);
  assert.equal(stored.status, 200);
  assert.equal((await stored.json() as { resultHash: string }).resultHash, plan.resultHash);

  const evidenceResponse = await post("/release-evidence", "release-api-1", {
    id: "release-api-1", userId: "roadmap-api-user", planId: plan.id, milestoneId: "foundation", commitSha: "abcdef1",
    buildArtifactRefs: ["artifact://build"], contractRefs: ["docs://12"], testEvidenceRefs: ["ci://tests"], migrationEvidenceRefs: ["ci://migration"],
    securityEvidenceRefs: ["review://security"], operationsEvidenceRefs: ["runbook://restore"], gateIds: [gate.id], openCriticalRiskCount: 0, createdAt: "2026-07-22T03:00:00Z",
  });
  assert.equal(evidenceResponse.status, 201);
  assert.equal((await evidenceResponse.json() as { status: string }).status, "READY");

  const replayResponse = await post(`/plans/${plan.id}/replays`, "replay-api-1", { id: "roadmap-replay-api-1", userId: "roadmap-api-user", replayedAt: "2026-07-22T04:00:00Z" });
  assert.equal(replayResponse.status, 201);
  assert.equal((await replayResponse.json() as { matches: boolean }).matches, true);

  const audit = await fetch(`http://127.0.0.1:${address.port}/api/v1/audit/${plan.id}`);
  assert.equal(audit.status, 200);
  assert.equal((await audit.json() as unknown[]).length, 1);
});

test("Roadmap API rejects a released milestone when a required gate failed", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/roadmap/plans/validate`, {
    method: "POST", headers: { "content-type": "application/json", "idempotency-key": "blocked-plan-api-1" }, body: JSON.stringify({
      id: "blocked-plan-api", userId: "blocked-user", version: 1, asOf: "2026-07-22T02:00:00Z",
      gates: [{ id: "failed-gate", userId: "blocked-user", name: "Failed", environment: "CI", evaluatedAt: "2026-07-22T01:00:00Z", status: "FAILED", blockerCodes: ["CI_RED"], resultHash: "a".repeat(64), checks: [] }],
      milestones: [{ id: "blocked", version: 1, title: "Blocked", readinessTarget: "R1", status: "RELEASED", dependencyIds: [], requiredGateIds: ["failed-gate"], ownerIds: ["engineering"], scopeRefs: ["docs/12"] }],
    }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json() as { error: { message: string } }).error.message, /required gates/);
});
