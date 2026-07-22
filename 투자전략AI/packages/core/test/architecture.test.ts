import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuditRecord,
  DecisionWorkflow,
  finishJob,
  generateMarkdownReport,
  InMemoryInvestmentOsRepository,
  inspectSnapshot,
  OutboxPublisher,
  ModelVersionWorkflow,
  recordExecution,
  resolveIdempotentJob,
  startJob,
  transitionModelVersion,
  transitionLongTermCandidate,
  transitionMomentumSetup,
  validateMomentumEvaluation,
  type AnalysisJob,
  type ModelVersion,
} from "../src/index.js";

test("model versions require controlled forward transitions", () => {
  const draft: ModelVersion = {
    id: "model-1", strategy: "RISK", version: "1.0.0", status: "DRAFT",
    parameters: {}, createdAt: "2026-07-22T00:00:00Z",
  };
  assert.throws(() => transitionModelVersion(draft, "ACTIVE", { actorId: "user-1", at: "2026-07-22T00:00:00Z" }), /invalid model transition/);
  const testing = transitionModelVersion(draft, "TESTING", { actorId: "user-1", at: "2026-07-22T00:00:00Z" });
  const approved = transitionModelVersion(testing, "APPROVED", { actorId: "user-1", at: "2026-07-22T00:00:00Z" });
  assert.equal(approved.approvedBy, "user-1");
});

test("candidate and setup states cannot skip required gates", () => {
  assert.equal(transitionLongTermCandidate("WATCH", "CANDIDATE"), "CANDIDATE");
  assert.throws(() => transitionLongTermCandidate("WATCH", "CORE"), /invalid long-term transition/);
  assert.throws(() => transitionLongTermCandidate("CORE", "ARCHIVED"), /invalid long-term transition/);
  assert.equal(transitionLongTermCandidate("CORE", "REMOVED"), "REMOVED");
  assert.equal(transitionLongTermCandidate("REMOVED", "ARCHIVED"), "ARCHIVED");
  assert.equal(transitionMomentumSetup("PLANNED", "APPROVED"), "APPROVED");
  assert.throws(() => transitionMomentumSetup("PLANNED", "ENTERED"), /invalid momentum transition/);
});

test("Momentum ENTER requires entry, stop and time-stop controls", () => {
  assert.throws(() => validateMomentumEvaluation({
    id: "evaluation-1", companyId: "company-1", evaluatedAt: "2026-07-22T00:00:00Z",
    dataAsOf: "2026-07-21T00:00:00Z", marketPriceAsOf: "2026-07-21T20:00:00Z",
    modelVersionId: "model-1", snapshotIds: ["snapshot-1"],
    momentumScore: 90, relativeStrengthScore: 90, volumeScore: 90, catalystScore: 90,
    liquidityScore: 90, setupQualityScore: 90, riskScore: 10, setupType: "BREAKOUT", action: "ENTER",
    invalidationConditions: [], catalystSummary: "earnings", evidenceIds: ["evidence-1", "evidence-bear"],
    scoringEvidenceIds: ["evidence-1"], counterEvidenceIds: ["evidence-bear"],
    confidence: { score: 80, evidenceCoverage: 75, sourceQuality: 90, modelFit: 80, disagreement: 20 },
  }), /entry zone/);
});

test("activating a model deprecates the previous active version", async () => {
  const repository = new InMemoryInvestmentOsRepository();
  const base = { strategy: "MOMENTUM" as const, status: "ACTIVE" as const, parameters: {}, createdAt: "2026-07-22T00:00:00Z" };
  await repository.saveModelVersion({ ...base, id: "old", version: "1" });
  await repository.saveModelVersion({ ...base, id: "new", version: "2" });
  assert.equal((await repository.findActiveModel("MOMENTUM"))?.id, "new");
  assert.equal(repository.models.get("old")?.status, "DEPRECATED");
});

test("model activation records audit and outbox event", async () => {
  const repository = new InMemoryInvestmentOsRepository();
  const workflow = new ModelVersionWorkflow(repository);
  const active = await workflow.transition({
    model: {
      id: "model-approved", strategy: "RISK", version: "2.0.0", status: "APPROVED",
      parameters: {}, createdAt: "2026-07-22T00:00:00Z", approvedBy: "reviewer-1",
    },
    next: "ACTIVE", actorId: "reviewer-1", at: "2026-07-22T00:01:00Z", auditId: "audit-model-1",
    correlationId: "correlation-model-1",
  });
  assert.equal(active.status, "ACTIVE");
  assert.equal((await repository.listAudit(active.id)).length, 1);
  assert.equal((await repository.listPendingOutbox())[0]?.event.type, "ModelVersionActivated");
});

test("partial jobs expose failed components", () => {
  const pending: AnalysisJob = {
    id: "job-1", type: "MOMENTUM_SCAN", correlationId: "correlation-1", idempotencyKey: "momentum:2026-07-22",
    status: "PENDING", createdAt: "2026-07-22T00:00:00Z", failures: [], attempt: 0,
  };
  const running = startJob(pending, "2026-07-22T00:01:00Z");
  const partial = finishJob(running, { at: "2026-07-22T00:02:00Z", failures: [{ component: "risk-agent", code: "TIMEOUT", retryable: true }] });
  assert.equal(partial.status, "PARTIAL");
  assert.equal(partial.attempt, 1);
});

test("successful jobs are reused by idempotency key", () => {
  const completed: AnalysisJob = {
    id: "job-old", type: "REPORT", correlationId: "correlation-old", idempotencyKey: "weekly:2026-30",
    status: "SUCCEEDED", createdAt: "2026-07-22T00:00:00Z", failures: [], attempt: 1,
  };
  const candidate: AnalysisJob = { ...completed, id: "job-new", correlationId: "correlation-new", status: "PENDING", attempt: 0 };
  assert.deepEqual(resolveIdempotentJob(candidate, [completed]), { job: completed, reused: true });
});

test("snapshots are point-in-time and report staleness", () => {
  const result = inspectSnapshot({
    id: "snap-1", companyId: "company-1", kind: "MARKET", asOf: "2026-07-22T00:00:00Z",
    collectedAt: "2026-07-22T00:01:00Z", sourceId: "exchange", confidence: "HIGH", complete: true,
    anomalyFlags: [], data: { price: 100 },
  }, "2026-07-22T02:00:00Z", 60);
  assert.equal(result.staleData, true);
  assert.equal(result.ageMinutes, 120);
});

test("execution records preserve partial fills and slippage", () => {
  const execution = recordExecution({
    id: "decision-1", allocationProposalId: "allocation-1", riskDecisionId: "risk-1", action: "BUY", status: "APPROVED",
    approvedAmount: "1000", currency: "USD", expiresAt: "2026-07-22T01:00:00Z", reasons: [],
    modelVersionIds: ["portfolio-policy-1", "risk-policy-1"], snapshotIds: ["snapshot-1"],
    userDecision: { approved: true, decidedAt: "2026-07-22T00:00:00Z", userId: "user-1" },
  }, {
    id: "execution-1", decisionId: "decision-1", lotId: "lot-1", requestedQuantity: "10",
    filledQuantity: "5", recommendedPrice: "100", averageFillPrice: "101", currency: "USD", status: "PARTIALLY_FILLED",
    executedAt: "2026-07-22T00:00:00Z",
  });
  assert.equal(execution.slippagePercent, 1);
});

test("execution cannot bypass user approval", () => {
  assert.throws(() => recordExecution({
    id: "decision-pending", allocationProposalId: "allocation-1", riskDecisionId: "risk-1", action: "BUY", status: "PENDING_APPROVAL",
    approvedAmount: "1000", currency: "USD", expiresAt: "2026-07-22T01:00:00Z", reasons: [],
    modelVersionIds: [], snapshotIds: [],
  }, {
    id: "execution-2", decisionId: "decision-pending", lotId: "lot-1", requestedQuantity: "10",
    filledQuantity: "10", recommendedPrice: "100", averageFillPrice: "100", currency: "USD", status: "FILLED",
    executedAt: "2026-07-22T00:00:00Z",
  }), /requires an approved decision/);
});

test("Risk override audit always requires a reason", () => {
  assert.throws(() => createAuditRecord({
    id: "audit-1", occurredAt: "2026-07-22T00:00:00Z", actorId: "user-1",
    action: "RISK_OVERRIDDEN", entityType: "RiskDecision", entityId: "risk-1", metadata: {},
  }), /requires a reason/);
});

test("reports retain evidence and model version references", () => {
  const report = generateMarkdownReport({
    id: "report-1", type: "WEEKLY_OS", generatedAt: "2026-07-22T00:00:00Z", title: "Weekly OS",
    sections: [{ heading: "Risk", body: "No breach", evidenceIds: ["snapshot-1"] }], modelVersionIds: ["model-1"],
  });
  assert.match(report.markdown, /snapshot-1/);
  assert.deepEqual(report.modelVersionIds, ["model-1"]);
});

test("decision workflow persists approval audit and domain event", async () => {
  const repository = new InMemoryInvestmentOsRepository();
  const workflow = new DecisionWorkflow(repository);
  const decision = await workflow.create({
    decisionId: "decision-1",
    correlationId: "correlation-1",
    allocation: {
      id: "allocation-1", portfolioId: "portfolio-1", generatedAt: "2026-07-22T00:00:00Z", expiresAt: "2026-07-22T01:00:00Z",
      strategy: "LONG_TERM", action: "BUY", requestedAmount: "100", approvedAmount: "100", currency: "USD",
      currentStrategyWeight: 0, projectedStrategyWeight: 0.01, currentCompanyWeight: 0, projectedCompanyWeight: 0.01,
      status: "APPROVED", reasons: [], constraintsTriggered: [], inputEvaluationIds: ["evaluation-1"],
      snapshotIds: ["snapshot-1"], policyVersionId: "portfolio-policy-1",
    },
    risk: {
      id: "risk-1", evaluatedAt: "2026-07-22T00:00:00Z", proposalId: "allocation-1",
      riskPolicyVersionId: "risk-policy-1", dataAsOf: "2026-07-22T00:00:00Z", status: "APPROVE",
      maxApprovedAmount: "100", riskFlags: [], rationale: "ok",
    },
  });
  assert.equal(decision.status, "PENDING_APPROVAL");
  const approved = await workflow.decide({
    decisionId: decision.id, approved: true, decidedAt: "2026-07-22T00:01:00Z", userId: "user-1",
    auditId: "audit-1", correlationId: "correlation-1",
    revalidation: {
      checkedAt: "2026-07-22T00:01:00Z", proposalStillCurrent: true, portfolioCapacityConfirmed: true,
      priceWithinTolerance: true, dataFresh: true, riskStillValid: true,
    },
  });
  assert.deepEqual(approved.userDecision, { approved: true, decidedAt: "2026-07-22T00:01:00Z", userId: "user-1" });
  assert.equal((await repository.listAudit(decision.id)).length, 1);
  assert.equal((await repository.listEvents(decision.id)).length, 0);
  assert.equal((await repository.listPendingOutbox()).length, 1);
  assert.equal(await new OutboxPublisher(repository).publishPending("2026-07-22T00:01:01Z"), 1);
  assert.equal((await repository.listEvents(decision.id))[0]?.type, "DecisionApproved");
  assert.equal(await new OutboxPublisher(repository).publishPending("2026-07-22T00:01:02Z"), 0);
});
