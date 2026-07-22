import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeLearningCohortV1,
  approveInvestmentLessonV1,
  assessLearningProcessV1,
  buildOutcomeAttributionV1,
  createLearningReviewV1,
  createLessonCandidateV1,
  createModelChangeProposalV1,
  determineOutcomeMaturityV1,
  evaluateModelValidationV1,
  transitionModelChangeProposalV1,
  type LearningReviewV1,
  type ProcessDimensionResultV1,
  type ReviewManifestV1,
  type ValidationStageResultV1,
} from "../src/index.js";

function manifest(overrides: Partial<ReviewManifestV1> = {}): ReviewManifestV1 {
  return {
    id: "manifest-1",
    userId: "user-1",
    reviewType: "TRADE",
    strategy: "MOMENTUM",
    companyId: "company-1",
    decisionId: "decision-1",
    evaluationId: "evaluation-1",
    proposalId: "proposal-1",
    riskDecisionId: "risk-1",
    executionIds: ["execution-1"],
    lotIds: ["lot-1"],
    modelVersionId: "momentum-model-v1",
    policyVersionIds: ["portfolio-v1", "risk-v1"],
    decisionSnapshotIds: ["decision-snapshot-1"],
    outcomeSnapshotIds: ["outcome-snapshot-1"],
    decisionEvidenceIds: ["decision-evidence-1"],
    outcomeEvidenceIds: ["outcome-evidence-1"],
    counterfactualEvidenceIds: ["counter-evidence-1"],
    decisionAt: "2026-07-01T10:00:00Z",
    outcomeAsOf: "2026-07-10T10:00:00Z",
    reviewedAt: "2026-07-11T10:00:00Z",
    minimumMaturityAt: "2026-07-20T10:00:00Z",
    positionClosedAt: "2026-07-10T09:00:00Z",
    regime: "RISK_ON_TREND",
    setupType: "BREAKOUT",
    liquidityTier: "L1",
    eventPolicy: "NO_KNOWN_EVENT",
    ...overrides,
  };
}

function dimensions(overrides: Partial<ProcessDimensionResultV1>[] = []): ProcessDimensionResultV1[] {
  const values: ProcessDimensionResultV1[] = [
    { dimension: "STRATEGY_RULE_COMPLIANCE", status: "PASS", score: 100, reasonCodes: ["RULES_FOLLOWED"], evidenceIds: ["process-e-1"], critical: true },
    { dimension: "EXECUTION_QUALITY", status: "PASS", score: 90, reasonCodes: ["EXECUTION_WITHIN_PLAN"], evidenceIds: ["process-e-2"], critical: false },
  ];
  return values.map((value, index) => ({ ...value, ...(overrides[index] ?? {}) }));
}

function outcome(id = "outcome-1", manifestId = "manifest-1") {
  return buildOutcomeAttributionV1({
    id,
    reviewManifestId: manifestId,
    baseCurrency: "USD",
    pricePnlBase: "-80.25",
    dividendPnlBase: "0",
    fxPnlBase: "5.25",
    feesBase: "2.5",
    taxesBase: "1",
    slippageBase: "-1.25",
    investedCapitalBase: "1000",
    initialPlannedRiskBase: "100",
    maePercent: -12,
    mfePercent: 4,
    holdingSessions: 7,
  });
}

function review(id = "review-1", manifestValue = manifest(), expectationMet = false): LearningReviewV1 {
  return createLearningReviewV1({
    id,
    manifest: manifestValue,
    processDimensions: dimensions(),
    outcome: outcome(`outcome-${id}`, manifestValue.id),
    outcomeExpectation: { met: expectationMet, reasonCodes: [expectationMet ? "EXPECTATION_MET" : "GAP_LOSS_WITHIN_SCENARIO"], evidenceIds: ["outcome-evidence-1"] },
    reviewerId: "reviewer-1",
    notes: "Structured review",
    codeVersion: "git-sha-1",
  });
}

test("Momentum closed trade is mature while future information is rejected", () => {
  assert.equal(determineOutcomeMaturityV1(manifest()), "MATURE");
  assert.throws(() => determineOutcomeMaturityV1(manifest({ outcomeAsOf: "2026-06-30T10:00:00Z" })), /timeline/);
});

test("process quality is independent from profitable or losing outcomes", () => {
  const good = assessLearningProcessV1(dimensions());
  const bad = assessLearningProcessV1(dimensions([{ status: "FAIL", score: 0, reasonCodes: ["STOP_IGNORED"] }]));
  assert.equal(good.goodProcess, true);
  assert.equal(bad.goodProcess, false);
  assert.ok(bad.criticalFailureCodes.includes("STOP_IGNORED"));
});

test("outcome attribution reconciles signed Decimal components, costs and R-multiple", () => {
  const result = outcome();
  assert.equal(result.grossPnlBase, "-75");
  assert.equal(result.netPnlBase, "-78.5");
  assert.equal(result.returnPercent, -7.85);
  assert.equal(result.rMultiple, -0.785);
  assert.equal(result.resultHash.length, 64);
});

test("good process and bad outcome remain a distinct immutable Review classification", () => {
  const result = review();
  assert.equal(result.classification, "GOOD_PROCESS_BAD_OUTCOME");
  assert.equal(result.process.goodProcess, true);
  assert.equal(result.resultHash.length, 64);
});

test("a profitable rule violation remains bad process and good outcome", () => {
  const result = createLearningReviewV1({
    id: "review-bad-process",
    manifest: manifest(),
    processDimensions: dimensions([{ status: "FAIL", score: 0, reasonCodes: ["STOP_IGNORED"] }]),
    outcome: outcome(),
    outcomeExpectation: { met: true, reasonCodes: ["PROFITABLE_BY_LUCK"], evidenceIds: ["outcome-evidence-1"] },
    reviewerId: "reviewer-1", notes: "Profit cannot excuse violation", codeVersion: "git-sha-1",
  });
  assert.equal(result.classification, "BAD_PROCESS_GOOD_OUTCOME");
});

test("cohort gates control Lesson eligibility and preserve strategy/model lineage", () => {
  const manifest2 = manifest({ id: "manifest-2", decisionId: "decision-2", companyId: "company-2", regime: "NEUTRAL_RANGE" });
  const review1 = review();
  const review2 = review("review-2", manifest2, true);
  const analysis = analyzeLearningCohortV1({
    id: "cohort-1",
    key: {
      strategy: "MOMENTUM", modelVersionId: "momentum-model-v1", policyVersionIds: ["portfolio-v1", "risk-v1"],
      periodStart: "2026-07-01T00:00:00Z", periodEnd: "2026-07-22T09:00:00Z",
    },
    policy: {
      minimumSampleSize: 2, minimumMaturityRatio: 1, minimumEvidenceCoverage: 0.8,
      minimumRegimeCount: 2, maximumCompanyConcentration: 0.5, maximumCensoredRatio: 0,
    },
    records: [
      { review: review1, manifest: manifest(), evidenceCoverage: 1 },
      { review: review2, manifest: manifest2, evidenceCoverage: 0.9 },
    ],
    analyzedAt: "2026-07-22T10:00:00Z",
  });
  assert.equal(analysis.eligibleForLesson, true);
  assert.equal(analysis.regimeCount, 2);
  assert.equal(analysis.resultHash.length, 64);
});

test("No-change Lesson requires counter-review and cannot recommend model mutation", () => {
  const manifest2 = manifest({ id: "manifest-2", decisionId: "decision-2", companyId: "company-2", regime: "NEUTRAL_RANGE" });
  const analysis = analyzeLearningCohortV1({
    id: "cohort-lesson", key: { strategy: "MOMENTUM", modelVersionId: "momentum-model-v1", policyVersionIds: ["portfolio-v1", "risk-v1"], periodStart: "2026-07-01T00:00:00Z", periodEnd: "2026-07-22T09:00:00Z" },
    policy: { minimumSampleSize: 2, minimumMaturityRatio: 1, minimumEvidenceCoverage: 0.8, minimumRegimeCount: 2, maximumCompanyConcentration: 0.5, maximumCensoredRatio: 0 },
    records: [{ review: review(), manifest: manifest(), evidenceCoverage: 1 }, { review: review("review-2", manifest2, true), manifest: manifest2, evidenceCoverage: 1 }],
    analyzedAt: "2026-07-22T10:00:00Z",
  });
  const candidate = createLessonCandidateV1({
    id: "lesson-candidate-1", userId: "user-1", type: "NO_CHANGE", strategy: "MOMENTUM",
    title: "Gap loss stayed inside prior scenario", originalAssumption: "Occasional gap losses are expected",
    observedPattern: "Process stayed compliant across mixed outcomes", alternativeExplanations: ["Regime noise"],
    supportingReviewIds: ["review-1"], contradictingReviewIds: ["review-2"], evidenceIds: ["lesson-evidence-1"],
    cohort: analysis, confidence: 80, generatedAt: "2026-07-22T11:00:00Z",
  });
  assert.equal(candidate.status, "READY_FOR_REVIEW");
  assert.throws(() => createLessonCandidateV1({
    id: "lesson-candidate-outside", userId: "user-1", type: "MODEL", strategy: "MOMENTUM",
    title: "Outside cohort", originalAssumption: "x", observedPattern: "x", alternativeExplanations: ["noise"],
    supportingReviewIds: ["review-outside"], contradictingReviewIds: ["review-2"], evidenceIds: ["lesson-evidence-2"],
    cohort: analysis, confidence: 80, generatedAt: "2026-07-22T11:00:00Z",
  }), /belong to its Cohort/);
  const lesson = approveInvestmentLessonV1({
    id: "lesson-1", candidate, status: "APPROVED", processAssessment: "Compliant",
    outcomeAssessment: "Within expected distribution", modelAssessment: "No defect found",
    recommendedAction: "NO_CHANGE", approvedBy: "human-reviewer", approvedAt: "2026-07-22T12:00:00Z",
  });
  assert.equal(lesson.recommendedAction, "NO_CHANGE");
  assert.throws(() => approveInvestmentLessonV1({
    id: "lesson-2", candidate, status: "APPROVED", processAssessment: "x", outcomeAssessment: "x",
    modelAssessment: "x", recommendedAction: "MODEL_HYPOTHESIS", approvedBy: "human", approvedAt: "2026-07-22T12:00:00Z",
  }), /NO_CHANGE/);
});

function stages(overrides: Partial<ValidationStageResultV1> = {}): ValidationStageResultV1[] {
  return (["HISTORICAL_REPLAY", "WALK_FORWARD", "SHADOW"] as const).map((stage, index) => ({
    stage, datasetManifestId: `dataset-${index}`, championMetric: 1, challengerMetric: 1.2,
    guardrails: { maxDrawdown: "PASS" }, pointInTimeValid: true, operationalStateChangeAllowed: false,
    sampleSize: 100, resultHash: `${index + 1}`.repeat(64), ...overrides,
  }));
}

test("model changes require all validation stages and a separate human approval revision", () => {
  const hypothesis = createModelChangeProposalV1({
    id: "model-change-1", userId: "user-1", lessonIds: ["lesson-1"], targetModelFamily: "MOMENTUM",
    championModelVersionId: "model-v1", challengerModelVersionId: "model-v2", problem: "High slippage",
    hypothesis: "Liquidity filter improves expectancy", proposedChange: "Raise minimum ADDV", expectedBenefit: "Lower slippage",
    possibleSideEffects: ["Fewer candidates"], rollbackPlan: "Reactivate model-v1", primaryMetric: "expectancyR",
    primaryMetricDirection: "HIGHER_IS_BETTER", guardrailMetrics: ["maxDrawdown"], createdAt: "2026-07-22T10:00:00Z",
  });
  assert.throws(() => evaluateModelValidationV1({
    id: "validation-before-transition", proposal: hypothesis, evaluatedAt: "2026-07-22T10:30:00Z",
    codeVersion: "git-sha-2", minimumSampleSize: 50, stages: stages(),
  }), /VALIDATING/);
  const validating = transitionModelChangeProposalV1({ id: "model-change-2", previous: hypothesis, nextStatus: "VALIDATING", transitionedAt: "2026-07-22T11:00:00Z" });
  const validation = evaluateModelValidationV1({
    id: "validation-1", proposal: validating, evaluatedAt: "2026-07-22T12:00:00Z", codeVersion: "git-sha-2", minimumSampleSize: 50, stages: stages(),
  });
  assert.equal(validation.verdict, "PASS");
  const ready = transitionModelChangeProposalV1({ id: "model-change-3", previous: validating, nextStatus: "READY_FOR_APPROVAL", transitionedAt: "2026-07-22T13:00:00Z", validationResult: validation });
  assert.throws(() => transitionModelChangeProposalV1({ id: "model-change-4", previous: ready, nextStatus: "APPROVED", transitionedAt: "2026-07-22T14:00:00Z" }), /human approver/);
  const approved = transitionModelChangeProposalV1({ id: "model-change-4", previous: ready, nextStatus: "APPROVED", transitionedAt: "2026-07-22T14:00:00Z", approvedBy: "model-committee" });
  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.requiresHumanApproval, true);
});

test("point-in-time or tail guardrail failures block an otherwise better Challenger", () => {
  const hypothesis = createModelChangeProposalV1({
    id: "model-change-tail", userId: "user-1", lessonIds: ["lesson-1"], targetModelFamily: "RISK",
    championModelVersionId: "risk-v1", challengerModelVersionId: "risk-v2", problem: "False positives",
    hypothesis: "New rule helps", proposedChange: "Adjust warning", expectedBenefit: "Fewer reviews",
    possibleSideEffects: ["Tail loss"], rollbackPlan: "Restore risk-v1", primaryMetric: "precision",
    primaryMetricDirection: "HIGHER_IS_BETTER", guardrailMetrics: ["maxDrawdown"], createdAt: "2026-07-22T10:00:00Z",
  });
  const proposal = transitionModelChangeProposalV1({
    id: "model-change-tail-validating", previous: hypothesis, nextStatus: "VALIDATING", transitionedAt: "2026-07-22T11:00:00Z",
  });
  const result = evaluateModelValidationV1({
    id: "validation-tail", proposal, evaluatedAt: "2026-07-22T12:00:00Z", codeVersion: "git-sha-2", minimumSampleSize: 50,
    stages: stages({ guardrails: { maxDrawdown: "FAIL" } }),
  });
  assert.equal(result.verdict, "FAIL");
  assert.ok(result.blockerCodes.some((code) => code.includes("GUARDRAIL_FAILED")));
});
