import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataDeletionRequestV1,
  createDataLineageEdgeV1,
  createDataRetentionPolicyV1,
  runDatabaseReconciliationV1,
  transitionDataDeletionRequestV1,
  validateDataLineageGraphV1,
} from "../src/index.js";

test("Data Lineage is point-in-time, deterministic and rejects derivation cycles", () => {
  const first = createDataLineageEdgeV1({
    id: "lineage-1", userId: "user-1", fromEntityType: "SNAPSHOT", fromEntityId: "snapshot-1",
    toEntityType: "EVALUATION", toEntityId: "evaluation-1", relation: "DERIVED_FROM",
    asOf: "2026-07-22T10:00:00Z", createdAt: "2026-07-22T10:01:00Z", evidenceIds: [],
  });
  const second = createDataLineageEdgeV1({
    id: "lineage-2", userId: "user-1", fromEntityType: "EVALUATION", fromEntityId: "evaluation-1",
    toEntityType: "REPORT", toEntityId: "report-1", relation: "DERIVED_FROM",
    asOf: "2026-07-22T10:00:00Z", createdAt: "2026-07-22T10:02:00Z", evidenceIds: [],
  });
  assert.equal(first.resultHash.length, 64);
  assert.equal(validateDataLineageGraphV1([first, second]).length, 2);
  const cycle = createDataLineageEdgeV1({
    id: "lineage-3", userId: "user-1", fromEntityType: "REPORT", fromEntityId: "report-1",
    toEntityType: "SNAPSHOT", toEntityId: "snapshot-1", relation: "DERIVED_FROM",
    asOf: "2026-07-22T10:00:00Z", createdAt: "2026-07-22T10:03:00Z", evidenceIds: [],
  });
  assert.throws(() => validateDataLineageGraphV1([first, second, cycle]), /cycle/);
});

test("Retention Policies protect legal/reproducibility records and minimize sensitive raw data", () => {
  const policy = createDataRetentionPolicyV1({
    id: "retention-1", userId: "user-1", version: "1", entityType: "agent_raw_outputs",
    classification: "SENSITIVE_RAW", retentionDays: 30, archiveAfterDays: 7,
    legalHoldSupported: true, hardDeleteAllowed: true, encrypted: true,
    approvedBy: "privacy-officer", approvedAt: "2026-07-22T10:00:00Z", effectiveFrom: "2026-07-23T00:00:00Z",
  });
  assert.equal(policy.resultHash.length, 64);
  const { resultHash: _resultHash, ...policyInput } = policy;
  assert.throws(() => createDataRetentionPolicyV1({
    ...policyInput, id: "retention-bad", classification: "LEGAL_AUDIT", hardDeleteAllowed: true,
  }), /cannot allow hard delete/);
});

test("Deletion Requests fail closed for legal hold and reproducibility inputs", () => {
  const request = createDataDeletionRequestV1({
    id: "deletion-blocked", userId: "user-1", requestedBy: "user-1", reason: "privacy request",
    requestedAt: "2026-07-22T10:00:00Z", targets: [{
      entityType: "EVALUATION", entityId: "evaluation-1", classification: "REPRODUCIBILITY",
      legalHold: false, reproducibilityRequired: true, requestedAction: "DELETE",
    }],
  });
  assert.equal(request.status, "BLOCKED");
  assert.ok(request.blockerCodes[0]?.startsWith("REPRODUCIBILITY_REQUIRED"));
  assert.throws(() => transitionDataDeletionRequestV1({
    id: "deletion-illegal", previous: request, nextStatus: "VERIFIED", transitionedAt: "2026-07-22T11:00:00Z", reviewedBy: "reviewer",
  }), /Invalid/);
});

test("Deletion Workflow uses immutable revisions and requires completion counts", () => {
  const requested = createDataDeletionRequestV1({
    id: "deletion-1", userId: "user-1", requestedBy: "user-1", reason: "remove rebuildable cache",
    requestedAt: "2026-07-22T10:00:00Z", targets: [{
      entityType: "REPORT_CACHE", entityId: "cache-1", classification: "CACHE",
      legalHold: false, reproducibilityRequired: false, requestedAction: "DELETE",
    }],
  });
  const verified = transitionDataDeletionRequestV1({ id: "deletion-2", previous: requested, nextStatus: "VERIFIED", transitionedAt: "2026-07-22T11:00:00Z", reviewedBy: "privacy-reviewer" });
  assert.throws(() => transitionDataDeletionRequestV1({
    id: "deletion-tampered", previous: { ...requested, reason: "changed after hashing" }, nextStatus: "VERIFIED",
    transitionedAt: "2026-07-22T11:00:00Z", reviewedBy: "privacy-reviewer",
  }), /hash is invalid/);
  assert.throws(() => transitionDataDeletionRequestV1({
    id: "deletion-same-time", previous: requested, nextStatus: "VERIFIED",
    transitionedAt: requested.transitionedAt, reviewedBy: "privacy-reviewer",
  }), /after the previous revision/);
  const planned = transitionDataDeletionRequestV1({ id: "deletion-3", previous: verified, nextStatus: "PLANNED", transitionedAt: "2026-07-22T12:00:00Z", reviewedBy: "operator" });
  const executing = transitionDataDeletionRequestV1({ id: "deletion-4", previous: planned, nextStatus: "EXECUTING", transitionedAt: "2026-07-22T13:00:00Z", reviewedBy: "operator" });
  assert.throws(() => transitionDataDeletionRequestV1({ id: "deletion-5", previous: executing, nextStatus: "COMPLETED", transitionedAt: "2026-07-22T14:00:00Z", reviewedBy: "operator" }), /counts/);
  const completed = transitionDataDeletionRequestV1({ id: "deletion-5", previous: executing, nextStatus: "COMPLETED", transitionedAt: "2026-07-22T14:00:00Z", reviewedBy: "operator", completedCounts: { report_cache: 1 } });
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.supersedesRequestId, executing.id);
});

test("Decimal Reconciliation blocks critical mismatches without floating-point arithmetic", () => {
  const result = runDatabaseReconciliationV1({
    id: "reconciliation-1", userId: "user-1", scope: "PORTFOLIO",
    asOf: "2026-07-22T10:00:00Z", executedAt: "2026-07-22T10:01:00Z",
    checks: [
      { id: "nav", entityType: "PORTFOLIO", entityId: "portfolio-1", comparator: "EQUAL", actual: "10000.000001", expected: "10000.000001", critical: true, evidenceIds: ["snapshot-1"] },
      { id: "fill", entityType: "EXECUTION", entityId: "execution-1", comparator: "LESS_THAN_OR_EQUAL", actual: "11", expected: "10", critical: true, evidenceIds: ["execution-1"] },
    ],
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.findings[0]?.checkId, "fill");
  assert.equal(result.resultHash.length, 64);
  const reordered = runDatabaseReconciliationV1({
    id: result.id, userId: result.userId, scope: result.scope, asOf: result.asOf, executedAt: result.executedAt,
    checks: [...result.checks].reverse().map((check) => ({ ...check, evidenceIds: [...check.evidenceIds].reverse() })),
  });
  assert.equal(reordered.resultHash, result.resultHash);
});
