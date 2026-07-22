import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type {
  CohortAnalysisV1,
  InvestmentLessonV1,
  LearningReviewInputV1,
  LearningReviewV1,
  LessonCandidateV1,
  ModelChangeProposalV1,
  ModelValidationResultV1,
  ReviewManifestV1,
} from "@investment-os/core";
import { server } from "../src/index.js";

function manifest(index: number): ReviewManifestV1 {
  return {
    id: `api-learning-manifest-${index}`,
    userId: "api-learning-user",
    reviewType: "TRADE",
    strategy: "MOMENTUM",
    companyId: `api-learning-company-${index}`,
    decisionId: `api-learning-decision-${index}`,
    evaluationId: `api-learning-evaluation-${index}`,
    proposalId: `api-learning-proposal-${index}`,
    riskDecisionId: `api-learning-risk-${index}`,
    executionIds: [`api-learning-execution-${index}`],
    lotIds: [`api-learning-lot-${index}`],
    modelVersionId: "api-learning-model-v1",
    policyVersionIds: ["portfolio-policy-v1", "risk-policy-v1"],
    decisionSnapshotIds: [`api-learning-decision-snapshot-${index}`],
    outcomeSnapshotIds: [`api-learning-outcome-snapshot-${index}`],
    decisionEvidenceIds: [`api-learning-decision-evidence-${index}`],
    outcomeEvidenceIds: [`api-learning-outcome-evidence-${index}`],
    counterfactualEvidenceIds: [`api-learning-counter-evidence-${index}`],
    decisionAt: `2026-07-0${index}T10:00:00Z`,
    outcomeAsOf: `2026-07-1${index}T10:00:00Z`,
    reviewedAt: `2026-07-1${index}T11:00:00Z`,
    minimumMaturityAt: "2026-07-20T10:00:00Z",
    positionClosedAt: `2026-07-1${index}T09:00:00Z`,
    regime: index === 1 ? "RISK_ON_TREND" : "NEUTRAL_RANGE",
    setupType: "BREAKOUT",
    liquidityTier: "L1",
    eventPolicy: "NO_KNOWN_EVENT",
  };
}

function reviewInput(index: number): LearningReviewInputV1 {
  const reviewManifest = manifest(index);
  return {
    id: `api-learning-review-${index}`,
    manifest: reviewManifest,
    processDimensions: [
      {
        dimension: "STRATEGY_RULE_COMPLIANCE",
        status: "PASS",
        score: 100,
        reasonCodes: ["RULES_FOLLOWED"],
        evidenceIds: [`api-learning-process-evidence-${index}`],
        critical: true,
      },
      {
        dimension: "EXECUTION_QUALITY",
        status: "PASS",
        score: 90,
        reasonCodes: ["EXECUTION_WITHIN_PLAN"],
        evidenceIds: [`api-learning-execution-evidence-${index}`],
        critical: false,
      },
    ],
    outcome: {
      id: `api-learning-outcome-${index}`,
      reviewManifestId: reviewManifest.id,
      baseCurrency: "USD",
      pricePnlBase: index === 1 ? "120" : "-80",
      dividendPnlBase: "0",
      fxPnlBase: "0",
      feesBase: "2",
      taxesBase: "1",
      slippageBase: "-1",
      investedCapitalBase: "1000",
      initialPlannedRiskBase: "100",
      maePercent: -10,
      mfePercent: 15,
      holdingSessions: 7,
    },
    outcomeExpectation: {
      met: index === 1,
      reasonCodes: [index === 1 ? "EXPECTATION_MET" : "EXPECTED_DISTRIBUTION_LOSS"],
      evidenceIds: [`api-learning-outcome-evidence-${index}`],
    },
    reviewerId: "api-learning-reviewer",
    notes: "Structured point-in-time review",
    codeVersion: "api-learning-git-sha",
  };
}

function post(origin: string, path: string, body: unknown, key: string): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": key,
      "x-correlation-id": `correlation-${key}`,
    },
    body: JSON.stringify(body),
  });
}

test("Learning v1 API preserves Review-to-Lesson-to-approved-Model-Change lineage", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const origin = `http://127.0.0.1:${address.port}`;

  const reviews: LearningReviewV1[] = [];
  for (const index of [1, 2]) {
    const response = await post(origin, "/api/v1/learning/reviews", reviewInput(index), `learning-review-${index}`);
    assert.equal(response.status, 201);
    const review = await response.json() as LearningReviewV1;
    assert.equal(review.maturity, "MATURE");
    assert.equal(review.outcome?.netPnlBase, index === 1 ? "117" : "-83");
    assert.equal(review.resultHash.length, 64);
    reviews.push(review);
    assert.equal((await fetch(`${origin}/api/v1/learning/reviews/${review.id}`)).status, 200);
  }

  const cohortResponse = await post(origin, "/api/v1/learning/cohorts/analyze", {
    id: "api-learning-cohort-1",
    key: {
      strategy: "MOMENTUM",
      modelVersionId: "api-learning-model-v1",
      policyVersionIds: ["portfolio-policy-v1", "risk-policy-v1"],
      periodStart: "2026-07-01T00:00:00Z",
      periodEnd: "2026-07-22T09:00:00Z",
    },
    policy: {
      minimumSampleSize: 2,
      minimumMaturityRatio: 1,
      minimumEvidenceCoverage: 0.9,
      minimumRegimeCount: 2,
      maximumCompanyConcentration: 0.5,
      maximumCensoredRatio: 0,
    },
    records: reviews.map((review, index) => ({ review, manifest: manifest(index + 1), evidenceCoverage: 1 })),
    analyzedAt: "2026-07-22T10:00:00Z",
  }, "learning-cohort-1");
  assert.equal(cohortResponse.status, 201);
  const cohort = await cohortResponse.json() as CohortAnalysisV1;
  assert.equal(cohort.userId, "api-learning-user");
  assert.equal(cohort.eligibleForLesson, true);
  assert.equal((await fetch(`${origin}/api/v1/learning/cohorts/${cohort.id}`)).status, 200);

  const candidateResponse = await post(origin, "/api/v1/learning/lessons/candidates", {
    id: "api-learning-candidate-1",
    userId: "api-learning-user",
    type: "MODEL",
    strategy: "MOMENTUM",
    title: "Liquidity filter hypothesis",
    originalAssumption: "Current filter controls slippage",
    observedPattern: "Losses cluster near the liquidity boundary",
    alternativeExplanations: ["Regime noise", "Event-day spread widening"],
    supportingReviewIds: [reviews[1]?.id],
    contradictingReviewIds: [reviews[0]?.id],
    evidenceIds: ["api-learning-lesson-evidence-1"],
    cohort,
    confidence: 80,
    generatedAt: "2026-07-22T11:00:00Z",
  }, "learning-candidate-1");
  assert.equal(candidateResponse.status, 201);
  const candidate = await candidateResponse.json() as LessonCandidateV1;
  assert.equal(candidate.status, "READY_FOR_REVIEW");

  const lessonResponse = await post(origin, `/api/v1/learning/lessons/${candidate.id}/approve`, {
    id: "api-learning-lesson-1",
    status: "APPROVED",
    processAssessment: "Process remained compliant",
    outcomeAssessment: "Mixed outcomes warrant controlled testing",
    modelAssessment: "Liquidity threshold is a testable hypothesis",
    recommendedAction: "MODEL_HYPOTHESIS",
    approvedBy: "api-learning-human",
    approvedAt: "2026-07-22T12:00:00Z",
  }, "learning-lesson-1");
  assert.equal(lessonResponse.status, 201);
  const lesson = await lessonResponse.json() as InvestmentLessonV1;
  assert.equal(lesson.status, "APPROVED");
  assert.equal((await fetch(`${origin}/api/v1/learning/lessons/${lesson.id}`)).status, 200);

  const proposalResponse = await post(origin, "/api/v1/learning/model-changes", {
    id: "api-learning-model-change-1",
    userId: "api-learning-user",
    lessonIds: [lesson.id],
    targetModelFamily: "MOMENTUM",
    championModelVersionId: "api-learning-model-v1",
    challengerModelVersionId: "api-learning-model-v2",
    problem: "High slippage around the minimum liquidity boundary",
    hypothesis: "A stricter filter improves net expectancy",
    proposedChange: "Raise minimum ADDV threshold",
    expectedBenefit: "Lower realized slippage",
    possibleSideEffects: ["Fewer candidates"],
    rollbackPlan: "Restore api-learning-model-v1",
    primaryMetric: "netExpectancyR",
    primaryMetricDirection: "HIGHER_IS_BETTER",
    guardrailMetrics: ["maxDrawdown"],
    createdAt: "2026-07-22T13:00:00Z",
  }, "learning-model-change-1");
  assert.equal(proposalResponse.status, 201);
  const hypothesis = await proposalResponse.json() as ModelChangeProposalV1;

  const validatingResponse = await post(origin, `/api/v1/learning/model-changes/${hypothesis.id}/transitions`, {
    id: "api-learning-model-change-2",
    nextStatus: "VALIDATING",
    transitionedAt: "2026-07-22T14:00:00Z",
  }, "learning-model-change-2");
  assert.equal(validatingResponse.status, 201);
  const validating = await validatingResponse.json() as ModelChangeProposalV1;

  const stages = (["HISTORICAL_REPLAY", "WALK_FORWARD", "SHADOW"] as const).map((stage, index) => ({
    stage,
    datasetManifestId: `api-learning-dataset-${index}`,
    championMetric: 1,
    challengerMetric: 1.2,
    guardrails: { maxDrawdown: "PASS" as const },
    pointInTimeValid: true,
    operationalStateChangeAllowed: false as const,
    sampleSize: 100,
    resultHash: `${index + 1}`.repeat(64),
  }));
  const validationResponse = await post(origin, "/api/v1/learning/validations", {
    id: "api-learning-validation-1",
    proposal: validating,
    evaluatedAt: "2026-07-22T15:00:00Z",
    codeVersion: "api-learning-git-sha-2",
    minimumSampleSize: 50,
    stages,
  }, "learning-validation-1");
  assert.equal(validationResponse.status, 201);
  const validation = await validationResponse.json() as ModelValidationResultV1;
  assert.equal(validation.verdict, "PASS");
  assert.equal(validation.userId, "api-learning-user");

  const readyResponse = await post(origin, `/api/v1/learning/model-changes/${validating.id}/transitions`, {
    id: "api-learning-model-change-3",
    nextStatus: "READY_FOR_APPROVAL",
    transitionedAt: "2026-07-22T16:00:00Z",
    validationResultId: validation.id,
  }, "learning-model-change-3");
  assert.equal(readyResponse.status, 201);
  const ready = await readyResponse.json() as ModelChangeProposalV1;

  const approvalResponse = await post(origin, `/api/v1/learning/model-changes/${ready.id}/approve`, {
    id: "api-learning-model-change-4",
    transitionedAt: "2026-07-22T17:00:00Z",
    approvedBy: "api-learning-model-committee",
  }, "learning-model-change-4");
  assert.equal(approvalResponse.status, 201);
  const approved = await approvalResponse.json() as ModelChangeProposalV1;
  assert.equal(approved.status, "APPROVED");
  assert.equal((await fetch(`${origin}/api/v1/learning/model-changes/${approved.id}`)).status, 200);

  const publish = await post(origin, "/api/v1/operations/outbox/publish", {}, "learning-publish-1");
  assert.equal(publish.status, 200);
  const events = await fetch(`${origin}/api/v1/events/${approved.id}`);
  assert.ok((await events.json() as Array<{ type: string }>).some((event) => event.type === "ModelChangeApproved"));
  const audit = await fetch(`${origin}/api/v1/audit/${cohort.id}`);
  assert.ok((await audit.json() as Array<{ action: string }>).some((record) => record.action === "LEARNING_COHORT_ANALYZED"));
});
