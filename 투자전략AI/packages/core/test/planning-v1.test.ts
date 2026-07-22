import assert from "node:assert/strict";
import test from "node:test";
import {
  createReleaseEvidenceBundleV1,
  createRoadmapPlanRevisionV1,
  evaluateRoadmapGateV1,
  replayRoadmapPlanV1,
  validateRoadmapPlanV1,
  type RoadmapCheckInputV1,
  type RoadmapGateV1,
  type RoadmapPlanInputV1,
} from "../src/index.js";

function check(overrides: Partial<RoadmapCheckInputV1> = {}): RoadmapCheckInputV1 {
  return {
    id: "test", category: "QUALITY", required: true, waivable: true, status: "PASSED",
    evidenceRefs: ["ci://test/1"], evaluatedAt: "2026-07-22T00:00:00Z", evaluatorId: "ci", ...overrides,
  };
}

function gate(id = "gate-ci", checks: RoadmapCheckInputV1[] = [check()]): RoadmapGateV1 {
  return evaluateRoadmapGateV1({ id, userId: "user-1", name: id, environment: "CI", evaluatedAt: "2026-07-22T01:00:00Z", checks });
}

function planInput(gates: RoadmapGateV1[] = [gate()]): RoadmapPlanInputV1 {
  return {
    id: "plan-1", userId: "user-1", version: 1, asOf: "2026-07-22T02:00:00Z", gates,
    milestones: [
      { id: "baseline", version: 1, title: "Contract baseline", readinessTarget: "R1", status: "RELEASED", dependencyIds: [], requiredGateIds: ["gate-ci"], ownerIds: ["platform"], scopeRefs: ["docs/01"] },
      { id: "preview", version: 1, title: "Persistent preview", readinessTarget: "R2", status: "IN_PROGRESS", dependencyIds: ["baseline"], requiredGateIds: [], ownerIds: ["data"], scopeRefs: ["docs/08"] },
    ],
  };
}

test("gate evaluation is deterministic and input ordering does not affect hash", () => {
  const first = gate("gate-order", [check({ id: "b", evidenceRefs: ["z", "a"] }), check({ id: "a", required: false, evidenceRefs: ["x"] })]);
  const second = gate("gate-order", [check({ id: "a", required: false, evidenceRefs: ["x"] }), check({ id: "b", evidenceRefs: ["a", "z"] })]);
  assert.equal(first.status, "PASSED");
  assert.equal(first.resultHash, second.resultHash);
});

test("required blocked check wins over failed and preserves blocker codes", () => {
  const result = gate("gate-blocked", [
    check({ id: "failed", status: "FAILED", blockerCode: "TEST_FAILED", evidenceRefs: [] }),
    check({ id: "missing", status: "BLOCKED", blockerCode: "EVIDENCE_MISSING", evidenceRefs: [] }),
  ]);
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.blockerCodes, ["EVIDENCE_MISSING", "TEST_FAILED"]);
});

test("safety-style non-waivable checks and expired waivers fail closed", () => {
  assert.throws(() => gate("gate-waive", [check({ status: "WAIVED", waivable: false, expiresAt: "2026-08-01T00:00:00Z" })]), /not waivable/);
  assert.throws(() => gate("gate-expired", [check({ status: "WAIVED", expiresAt: "2026-07-22T00:30:00Z" })]), /expired/);
  assert.throws(() => gate("gate-no-evidence", [check({ status: "WAIVED", expiresAt: "2026-08-01T00:00:00Z", evidenceRefs: [] })]), /requires evidence/);
});

test("roadmap plan validates dependencies, required gates and stable hash", () => {
  const first = validateRoadmapPlanV1(planInput());
  const reordered = planInput();
  reordered.milestones.reverse();
  const second = validateRoadmapPlanV1(reordered);
  assert.equal(first.readiness, "R1");
  assert.equal(first.resultHash, second.resultHash);
  assert.throws(() => validateRoadmapPlanV1({ ...planInput(), milestones: [{ ...planInput().milestones[0]!, dependencyIds: ["missing"] }] }), /does not exist/);
  const forged = planInput();
  forged.gates[0] = { ...forged.gates[0]!, status: "FAILED" };
  assert.throws(() => validateRoadmapPlanV1(forged), /integrity conflict/);
  const futureGate = planInput();
  futureGate.gates[0] = evaluateRoadmapGateV1({ id: "gate-ci", userId: "user-1", name: "future", environment: "CI", evaluatedAt: "2026-07-23T01:00:00Z", checks: [check({ evaluatedAt: "2026-07-23T00:00:00Z" })] });
  assert.throws(() => validateRoadmapPlanV1(futureGate), /after plan asOf/);
});

test("dependency cycles and premature release are rejected", () => {
  const cyclic = planInput();
  cyclic.milestones[0] = { ...cyclic.milestones[0]!, status: "IN_PROGRESS", dependencyIds: ["preview"] };
  assert.throws(() => validateRoadmapPlanV1(cyclic), /cycle/);
  const failed = gate("gate-ci", [check({ status: "FAILED", blockerCode: "CI_RED", evidenceRefs: [] })]);
  assert.throws(() => validateRoadmapPlanV1(planInput([failed])), /before required gates pass/);
});

test("plan revision is linear, owned and monotonic in time", () => {
  const previous = validateRoadmapPlanV1(planInput());
  const next = planInput();
  next.id = "plan-2";
  next.version = 2;
  next.supersedesPlanId = previous.id;
  next.asOf = "2026-07-23T00:00:00Z";
  assert.equal(createRoadmapPlanRevisionV1(previous, next).version, 2);
  assert.throws(() => createRoadmapPlanRevisionV1(previous, { ...next, version: 3 }), /increment/);
});

test("release evidence is ready only with all evidence groups, passed gates and no critical risk", () => {
  const plan = validateRoadmapPlanV1(planInput());
  const base = {
    id: "bundle-1", userId: "user-1", planId: plan.id, milestoneId: "baseline", commitSha: "abcdef1",
    buildArtifactRefs: ["artifact://build"], contractRefs: ["docs://12"], testEvidenceRefs: ["ci://tests"], migrationEvidenceRefs: ["ci://migration"],
    securityEvidenceRefs: ["review://security"], operationsEvidenceRefs: ["runbook://restore"], gateIds: ["gate-ci"], openCriticalRiskCount: 0, createdAt: "2026-07-22T03:00:00Z",
  };
  assert.equal(createReleaseEvidenceBundleV1(base, plan).status, "READY");
  const blocked = createReleaseEvidenceBundleV1({ ...base, id: "bundle-2", operationsEvidenceRefs: [], openCriticalRiskCount: 1 }, plan);
  assert.equal(blocked.status, "BLOCKED");
  assert.deepEqual(blocked.missingEvidenceGroups, ["CRITICAL_RISK_CLEARANCE", "OPERATIONS"]);
  assert.throws(() => createReleaseEvidenceBundleV1({ ...base, milestoneId: "preview" }, plan), /not ready/);
  const omitted = createReleaseEvidenceBundleV1({ ...base, id: "bundle-3", gateIds: [] }, plan);
  assert.ok(omitted.missingEvidenceGroups.includes("REQUIRED_GATE_MISSING:gate-ci"));
});

test("roadmap replay recomputes the frozen result hash", () => {
  const plan = validateRoadmapPlanV1(planInput());
  const replay = replayRoadmapPlanV1({ id: "replay-1", userId: "user-1", plan, replayedAt: "2026-07-24T00:00:00Z" });
  assert.equal(replay.matches, true);
  assert.equal(replay.replayResultHash, plan.resultHash);
});
