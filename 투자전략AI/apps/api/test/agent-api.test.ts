import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AgentOutputV1, AgentRunRequestV1, AgentRunV1 } from "@investment-os/core";
import { server } from "../src/index.js";

function request(id: string, key: string, overrides: Partial<AgentRunRequestV1> = {}): AgentRunRequestV1 {
  return {
    id,
    userId: "api-agent-user",
    agentDefinitionId: "fundamental-agent",
    agentDefinitionVersion: "1.0.0",
    strategyScope: "LONG_TERM",
    purpose: "Extract filing facts",
    asOf: "2026-07-22T10:00:00Z",
    requestedAt: "2026-07-22T10:01:00Z",
    correlationId: `correlation-${id}`,
    idempotencyKey: key,
    inputSnapshotIds: ["api-agent-snapshot-1"],
    evidenceIds: ["api-agent-evidence-1"],
    context: { companyId: "api-agent-company-1", deterministicResult: { revenueGrowthPercent: 12 } },
    requestedBy: { actorType: "USER", actorId: "api-agent-user" },
    ...overrides,
  };
}

function output(runId: string): AgentOutputV1 {
  return {
    schemaVersion: "1",
    runId,
    status: "COMPLETED",
    summary: "The filing supports the revenue growth Fact candidate.",
    claims: [{
      id: "api-agent-claim-1",
      kind: "FACT_CANDIDATE",
      subject: "api-agent-company-1",
      predicate: "revenueGrowthPercent",
      value: 12,
      unit: "PERCENT",
      evidenceRefs: [{ evidenceId: "api-agent-evidence-1", location: { page: 12, startOffset: 100, endOffset: 140 }, support: "SUPPORTS" }],
      confidence: "HIGH",
      uncertaintyReasons: [],
      deterministicKey: "revenueGrowthPercent",
    }],
    counterarguments: [{
      id: "api-agent-counter-1",
      kind: "COUNTERARGUMENT",
      subject: "api-agent-company-1",
      predicate: "growthQualityRisk",
      value: "Temporary pricing may contribute",
      evidenceRefs: [{ evidenceId: "api-agent-evidence-1", location: { section: "Revenue" }, support: "CONTEXT_ONLY" }],
      confidence: "MEDIUM",
      uncertaintyReasons: ["Volume decomposition is unavailable"],
    }],
    missingInformation: [],
    qualityFlags: [],
    proposedActions: [{ action: "NO_CHANGE", reasonCodes: ["FACT_EXTRACTION_ONLY"] }],
  };
}

function post(origin: string, path: string, body: unknown, key: string): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key, "x-correlation-id": `api-${key}` },
    body: JSON.stringify(body),
  });
}

test("Agent v1 API validates a plan and preserves Run, Validation, Replay, Audit and Outbox lineage", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const origin = `http://127.0.0.1:${address.port}`;

  const definitionsResponse = await fetch(`${origin}/api/v1/agents/definitions`);
  assert.equal(definitionsResponse.status, 200);
  const definitions = await definitionsResponse.json() as { items: Array<{ id: string; promptTemplateId: string }> };
  assert.ok(definitions.items.some((item) => item.id === "fundamental-agent"));
  const promptId = definitions.items.find((item) => item.id === "fundamental-agent")?.promptTemplateId;
  assert.equal((await fetch(`${origin}/api/v1/agents/prompts/${promptId}/versions`)).status, 200);

  const planResponse = await post(origin, "/api/v1/agents/plans/validate", {
    id: "api-agent-plan-1",
    userId: "api-agent-user",
    workflow: "LONG_TERM_REVIEW",
    asOf: "2026-07-22T10:00:00Z",
    nodes: [
      { id: "extract", agentDefinitionId: "fundamental-agent", dependsOn: [], required: true },
      { id: "report", agentDefinitionId: "report-composer-agent", dependsOn: ["extract"], required: false },
    ],
    maximumConcurrency: 2,
    deadlineAt: "2026-07-22T10:10:00Z",
    createdAt: "2026-07-22T10:01:00Z",
  }, "agent-plan-1");
  assert.equal(planResponse.status, 200);
  assert.deepEqual((await planResponse.json() as { executionOrder: string[] }).executionOrder, ["extract", "report"]);

  const createBody = {
    runId: "api-agent-run-1",
    manifestId: "api-agent-manifest-1",
    request: request("api-agent-request-1", "api-agent-domain-key-1"),
    provider: { providerId: "scripted", providerVersion: "1", modelId: "scripted-fixture", temperature: 0, seed: 1 },
    codeVersion: "api-agent-git-sha-1",
  };
  const first = await post(origin, "/api/v1/agents/runs", createBody, "agent-run-http-1");
  const repeated = await post(origin, "/api/v1/agents/runs", createBody, "agent-run-http-1");
  assert.equal(first.status, 201);
  assert.equal(repeated.status, 201);
  const run = await first.json() as AgentRunV1;
  assert.equal(run.status, "PENDING");
  assert.equal(run.manifest.manifestHash.length, 64);
  assert.deepEqual(await repeated.json(), run);

  const validationResponse = await post(origin, "/api/v1/agents/outputs/validate", {
    id: "api-agent-validation-1",
    runId: run.id,
    output: output(run.id),
    evidence: [{
      id: "api-agent-evidence-1", userId: "api-agent-user", sourceId: "official-filing", sourceTier: "A",
      observedAt: "2026-07-21T09:00:00Z", availableAt: "2026-07-21T10:00:00Z",
      contentHash: "a".repeat(64), maximumOffset: 10_000,
    }],
    deterministicFacts: { revenueGrowthPercent: 12 },
    validatedAt: "2026-07-22T10:02:00Z",
    policyVersion: "agent-validation-v1",
    finishedAt: "2026-07-22T10:03:00Z",
  }, "agent-output-1");
  assert.equal(validationResponse.status, 201);
  const completed = await validationResponse.json() as AgentRunV1;
  assert.equal(completed.status, "SUCCEEDED");
  assert.equal(completed.validation?.verdict, "ACCEPTED");
  assert.equal((await fetch(`${origin}/api/v1/agents/runs/${run.id}`)).status, 200);
  assert.equal((await fetch(`${origin}/api/v1/agents/runs/${run.id}/attempts`)).status, 200);

  const replayRequest = request("api-agent-request-replay", "api-agent-domain-key-replay", {
    requestedAt: "2026-07-22T11:00:00Z",
    replayOfRunId: run.id,
  });
  const replayResponse = await post(origin, "/api/v1/agents/replays", {
    runId: "api-agent-run-replay",
    manifestId: "api-agent-manifest-replay",
    request: replayRequest,
    provider: { providerId: "scripted", providerVersion: "1", modelId: "scripted-fixture-v2", temperature: 0 },
    codeVersion: "api-agent-git-sha-2",
  }, "agent-replay-1");
  assert.equal(replayResponse.status, 201);
  const replay = await replayResponse.json() as AgentRunV1;
  assert.equal(replay.request.replayOfRunId, run.id);

  const cancelResponse = await post(origin, `/api/v1/agents/runs/${replay.id}/cancel`, {
    finishedAt: "2026-07-22T11:01:00Z", actorId: "api-agent-user",
  }, "agent-cancel-1");
  assert.equal(cancelResponse.status, 201);
  assert.equal((await cancelResponse.json() as AgentRunV1).status, "CANCELLED");

  const publish = await post(origin, "/api/v1/operations/outbox/publish", {}, "agent-publish-1");
  assert.equal(publish.status, 200);
  const events = await fetch(`${origin}/api/v1/events/${run.id}`);
  assert.ok((await events.json() as Array<{ type: string }>).some((event) => event.type === "AgentOutputValidated"));
  const audit = await fetch(`${origin}/api/v1/audit/${run.id}`);
  const actions = (await audit.json() as Array<{ action: string }>).map((item) => item.action);
  assert.ok(actions.includes("AGENT_RUN_REQUESTED"));
  assert.ok(actions.includes("AGENT_OUTPUT_VALIDATED"));
});
