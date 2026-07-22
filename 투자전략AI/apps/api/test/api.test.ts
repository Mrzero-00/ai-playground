import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { server } from "../src/index.js";

test("v1 decision endpoint is idempotent and returns request tracing", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");

  const requestBody = {
    decisionId: "api-decision-1",
    allocation: {
      id: "api-allocation-1", portfolioId: "portfolio-1", generatedAt: "2026-07-22T00:00:00Z",
      expiresAt: "2026-07-22T01:00:00Z", strategy: "LONG_TERM", requestedAmount: "100.10",
      approvedAmount: "100.10", currency: "USD", currentStrategyWeight: 0, projectedStrategyWeight: 0.01,
      currentCompanyWeight: 0, projectedCompanyWeight: 0.01, status: "APPROVED", reasons: [],
      constraintsTriggered: [], inputEvaluationIds: ["evaluation-1"], snapshotIds: ["snapshot-1"],
      policyVersionId: "portfolio-policy-1",
    },
    risk: {
      id: "api-risk-1", evaluatedAt: "2026-07-22T00:01:00Z", proposalId: "api-allocation-1",
      riskPolicyVersionId: "risk-policy-1", dataAsOf: "2026-07-22T00:00:00Z", status: "APPROVE",
      maxApprovedAmount: "100.10", riskFlags: [], rationale: "ok",
    },
  };
  const url = `http://127.0.0.1:${address.port}/api/v1/decisions`;
  const headers = {
    "content-type": "application/json",
    "idempotency-key": "api-create-1",
    "x-correlation-id": "api-correlation-1",
  };
  const first = await fetch(url, { method: "POST", headers, body: JSON.stringify(requestBody) });
  const second = await fetch(url, { method: "POST", headers, body: JSON.stringify(requestBody) });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(first.headers.get("x-correlation-id"), "api-correlation-1");
  assert.ok(first.headers.get("x-request-id"));
  assert.deepEqual(await second.json(), await first.json());
});
