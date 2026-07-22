import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { DataDeletionRequestV1, DatabaseReconciliationResultV1 } from "@investment-os/core";
import { server } from "../src/index.js";

function post(origin: string, path: string, body: unknown, key: string): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": key,
      "x-correlation-id": `database-${key}`,
    },
    body: JSON.stringify(body),
  });
}

test("Database v1 API preserves governance, reconciliation, audit and outbox lineage", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const origin = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${origin}/api/v1/database/health`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json() as { contractVersion: string; latestMigration: string; operationalChecksRequired: string[] };
  assert.equal(health.contractVersion, "database-v1");
  assert.equal(health.latestMigration, "009_database_hardening_v1.sql");
  assert.ok(health.operationalChecksRequired.includes("RESTORE_DRILL"));

  const migrationsResponse = await fetch(`${origin}/api/v1/database/migrations`);
  assert.equal(migrationsResponse.status, 200);
  const migrations = await migrationsResponse.json() as { latest: string; items: string[] };
  assert.equal(migrations.latest, migrations.items.at(-1));

  const lineageResponse = await post(origin, "/api/v1/database/lineage/validate", { edges: [{
    id: "api-lineage-1", userId: "api-database-user", fromEntityType: "SNAPSHOT", fromEntityId: "snapshot-1",
    toEntityType: "EVALUATION", toEntityId: "evaluation-1", relation: "DERIVED_FROM",
    asOf: "2026-07-22T10:00:00Z", createdAt: "2026-07-22T10:01:00Z", evidenceIds: [],
  }] }, "lineage-1");
  assert.equal(lineageResponse.status, 200);
  assert.equal(((await lineageResponse.json()) as { edges: Array<{ resultHash: string }> }).edges[0]?.resultHash.length, 64);

  const retentionResponse = await post(origin, "/api/v1/database/retention/policies/validate", {
    id: "api-retention-1", userId: "api-database-user", version: "1", entityType: "report_cache",
    classification: "CACHE", retentionDays: 30, archiveAfterDays: 7, legalHoldSupported: false,
    hardDeleteAllowed: true, encrypted: true, approvedBy: "privacy-officer",
    approvedAt: "2026-07-22T10:00:00Z", effectiveFrom: "2026-07-23T00:00:00Z",
    secret: "must-not-cross-the-contract-boundary",
  }, "retention-1");
  assert.equal(retentionResponse.status, 200);
  assert.equal("secret" in ((await retentionResponse.json()) as Record<string, unknown>), false);

  const createResponse = await post(origin, "/api/v1/database/deletion-requests", {
    id: "api-deletion-1", userId: "api-database-user", requestedBy: "api-database-user",
    reason: "remove rebuildable report cache", requestedAt: "2026-07-22T11:00:00Z",
    targets: [{
      entityType: "REPORT_CACHE", entityId: "cache-1", classification: "CACHE",
      legalHold: false, reproducibilityRequired: false, requestedAction: "DELETE",
    }],
    secret: "must-not-be-persisted",
  }, "deletion-create-1");
  assert.equal(createResponse.status, 201);
  let deletion = await createResponse.json() as DataDeletionRequestV1;
  assert.equal(deletion.status, "REQUESTED");
  assert.equal("secret" in deletion, false);

  for (const transition of [
    { id: "api-deletion-2", nextStatus: "VERIFIED", transitionedAt: "2026-07-22T12:00:00Z", reviewedBy: "privacy-reviewer" },
    { id: "api-deletion-3", nextStatus: "PLANNED", transitionedAt: "2026-07-22T13:00:00Z", reviewedBy: "database-operator" },
    { id: "api-deletion-4", nextStatus: "EXECUTING", transitionedAt: "2026-07-22T14:00:00Z", reviewedBy: "database-operator" },
    { id: "api-deletion-5", nextStatus: "COMPLETED", transitionedAt: "2026-07-22T15:00:00Z", reviewedBy: "database-operator", completedCounts: { report_cache: 1 } },
  ]) {
    const transitionResponse = await post(origin, `/api/v1/database/deletion-requests/${deletion.id}/transitions`, transition, `transition-${transition.id}`);
    assert.equal(transitionResponse.status, 201);
    const next = await transitionResponse.json() as DataDeletionRequestV1;
    assert.equal(next.supersedesRequestId, deletion.id);
    deletion = next;
  }
  assert.equal(deletion.status, "COMPLETED");
  assert.deepEqual(deletion.completedCounts, { report_cache: 1 });
  assert.deepEqual(await (await fetch(`${origin}/api/v1/database/deletion-requests/${deletion.id}`)).json(), deletion);

  const branchResponse = await post(origin, "/api/v1/database/deletion-requests/api-deletion-1/transitions", {
    id: "api-deletion-branch", nextStatus: "REJECTED", transitionedAt: "2026-07-22T12:30:00Z", reviewedBy: "privacy-reviewer",
  }, "deletion-branch-1");
  assert.equal(branchResponse.status, 409);
  assert.equal(((await branchResponse.json()) as { error: { code: string } }).error.code, "DATABASE_LINEAGE_CONFLICT");

  const reconciliationResponse = await post(origin, "/api/v1/database/reconciliations/validate", {
    id: "api-reconciliation-1", userId: "api-database-user", scope: "PORTFOLIO",
    asOf: "2026-07-22T15:00:00Z", executedAt: "2026-07-22T15:01:00Z",
    checks: [
      { id: "nav", entityType: "PORTFOLIO", entityId: "portfolio-1", comparator: "EQUAL", actual: "100.000001", expected: "100.000001", critical: true, evidenceIds: ["snapshot-1"] },
      { id: "fill", entityType: "EXECUTION", entityId: "execution-1", comparator: "LESS_THAN_OR_EQUAL", actual: "11", expected: "10", critical: true, evidenceIds: ["execution-1"] },
    ],
  }, "reconciliation-1");
  assert.equal(reconciliationResponse.status, 201);
  const reconciliation = await reconciliationResponse.json() as DatabaseReconciliationResultV1;
  assert.equal(reconciliation.status, "BLOCKED");
  assert.equal(reconciliation.findings[0]?.severity, "CRITICAL");
  assert.deepEqual(await (await fetch(`${origin}/api/v1/database/reconciliations/${reconciliation.id}`)).json(), reconciliation);

  const publishResponse = await post(origin, "/api/v1/operations/outbox/publish", {}, "database-publish-1");
  assert.equal(publishResponse.status, 200);
  const deletionEvents = await (await fetch(`${origin}/api/v1/events/${deletion.id}`)).json() as Array<{ type: string }>;
  assert.ok(deletionEvents.some((event) => event.type === "DataDeletionTransitioned"));
  const reconciliationAudit = await (await fetch(`${origin}/api/v1/audit/${reconciliation.id}`)).json() as Array<{ action: string }>;
  assert.ok(reconciliationAudit.some((record) => record.action === "DATABASE_RECONCILIATION_COMPLETED"));
});
