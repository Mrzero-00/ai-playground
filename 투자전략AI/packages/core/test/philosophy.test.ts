import assert from "node:assert/strict";
import test from "node:test";
import {
  assessDecisionReview,
  attributePerformance,
  createCapitalAllocationDecision,
  createDecisionJournalEntry,
  createInvestmentLesson,
  defaultPhilosophyPolicy,
  evaluateBehavioralGate,
  evaluateMomentumRegimeGate,
  evaluateRisk,
  generateDecisionReport,
  proposeAllocation,
  requestDecisionModification,
  requestStopRevision,
  resolveManualRiskReview,
  reviseLongTermThesis,
  routeApprovalIntent,
  transitionPhilosophyChange,
  validateEvidence,
  validateEvaluationEvidence,
  validateLongTermThesis,
  validateMomentumTradePlan,
  validatePhilosophyPolicy,
  type LongTermThesis,
  type MomentumTradePlan,
  type PhilosophyChange,
  type PhilosophyPolicy,
} from "../src/index.js";

const thesis: LongTermThesis = {
  id: "thesis-1",
  companyId: "company-1",
  version: "1.0.0",
  strategy: "CORE",
  status: "UNCHANGED",
  summary: "반복 매출과 높은 전환 비용이 장기 잉여현금흐름 성장을 만든다는 논지입니다.",
  returnSources: ["FUNDAMENTAL_COMPOUNDING", "SHAREHOLDER_YIELD"],
  keyAssumptions: [{
    id: "assumption-1",
    statement: "순매출 유지율이 장기적으로 유지됩니다.",
    evidenceType: "FACT",
    importance: "CRITICAL",
    currentStatus: "SUPPORTED",
    observableMetrics: ["net_revenue_retention"],
    nextReviewAt: "2026-10-25T00:00:00Z",
    evidenceIds: ["evidence-1"],
  }],
  milestones: [{ id: "milestone-1", statement: "FCF margin 25%", evidenceIds: ["evidence-1"] }],
  catalysts: ["신제품 확장"],
  risks: ["고객 집중"],
  breakConditions: [{ id: "break-1", statement: "핵심 고객 이탈이 지속됩니다.", observableMetrics: ["churn"] }],
  valuationRange: { currency: "USD", low: "80", base: "100", high: "130", asOf: "2026-07-21T20:00:00Z" },
  expectedHorizon: "5Y",
  reviewSchedule: ["2026-10-25T00:00:00Z"],
  evidenceIds: ["evidence-1"],
  counterEvidenceIds: ["evidence-bear"],
  snapshotIds: ["snapshot-1"],
  modelVersionId: "model-long-1",
  dataAsOf: "2026-07-21T20:00:00Z",
  createdAt: "2026-07-22T00:00:00Z",
};

const momentumPlan: MomentumTradePlan = {
  id: "plan-1",
  companyId: "company-1",
  setupId: "setup-1",
  setupType: "BREAKOUT",
  marketRegime: "RISK_ON_TREND",
  entryPlan: {
    currency: "USD",
    entryZoneMin: "100.10",
    entryZoneMax: "102.25",
    trigger: "저항 돌파와 거래량 확인",
    chaseLimit: "104",
    initialStop: "95.50",
    target1: "112",
    target2: "120",
    timeStopDays: 10,
  },
  catalystSummary: "공식 실적과 가이던스 상향",
  invalidationConditions: ["종가 기준 돌파선 이탈"],
  evidenceIds: ["evidence-1"],
  counterEvidenceIds: ["evidence-bear"],
  snapshotIds: ["snapshot-1"],
  modelVersionId: "model-momentum-1",
  dataAsOf: "2026-07-21T20:00:00Z",
  generatedAt: "2026-07-22T00:00:00Z",
  expiresAt: "2026-07-22T01:00:00Z",
  eventRisk: false,
};

test("02 policy keeps the 85/15 default and forbids Risk DENY override", () => {
  assert.deepEqual(validatePhilosophyPolicy(defaultPhilosophyPolicy), defaultPhilosophyPolicy);
  assert.throws(() => validatePhilosophyPolicy({
    ...defaultPhilosophyPolicy,
    userCanOverrideRiskDeny: true,
  } as unknown as PhilosophyPolicy), /cannot be user-overridden/);
});

test("evidence hierarchy prevents weak or anonymous sources from driving scores", () => {
  const official = validateEvidence({
    id: "evidence-1", type: "FACT", sourceTier: "A", sourceId: "sec", statement: "Revenue was 100",
    asOf: "2026-07-21T00:00:00Z", collectedAt: "2026-07-22T00:00:00Z", scoreEligible: true,
  });
  const social = validateEvidence({
    id: "evidence-bear", type: "HYPOTHESIS", sourceTier: "E", sourceId: "social", statement: "Demand may weaken",
    asOf: "2026-07-21T00:00:00Z", collectedAt: "2026-07-22T00:00:00Z", scoreEligible: false,
  });
  assert.equal(validateEvaluationEvidence({
    evidenceIds: [official.id, social.id], scoringEvidenceIds: [official.id], evidence: [official, social],
  }).length, 2);
  assert.throws(() => validateEvidence({ ...social, scoreEligible: true }), /cannot be used directly for scoring/);
  assert.throws(() => validateEvaluationEvidence({
    evidenceIds: [official.id, social.id], scoringEvidenceIds: [social.id], evidence: [official, social],
  }), /not eligible for scoring/);
});

test("Long-term thesis is point-in-time, has a bear case and revises immutably", () => {
  const original = validateLongTermThesis(thesis);
  const revised = reviseLongTermThesis(original, {
    id: "thesis-2",
    version: "1.1.0",
    createdAt: "2026-07-23T00:00:00Z",
    dataAsOf: "2026-07-22T20:00:00Z",
    reason: "신규 공식 실적을 반영합니다.",
    changes: { status: "STRENGTHENED", evidenceIds: ["evidence-1", "evidence-2"] },
  });
  assert.equal(original.status, "UNCHANGED");
  assert.equal(revised.status, "STRENGTHENED");
  assert.equal(revised.supersedesThesisId, original.id);
  assert.throws(() => validateLongTermThesis({ ...thesis, counterEvidenceIds: [] }), /counter evidence/);
});

test("Momentum plan requires Decimal prices and blocks unapproved stop widening", () => {
  assert.deepEqual(validateMomentumTradePlan(momentumPlan), momentumPlan);
  assert.throws(() => requestStopRevision({
    plan: momentumPlan, proposedStop: "90", reason: "손실 확정을 미룹니다.",
  }), /widening.*forbidden/);
  const correction = requestStopRevision({
    plan: momentumPlan,
    proposedStop: "94",
    reason: "주식 분할 조정을 반영합니다.",
    exceptionType: "CORPORATE_ACTION",
  });
  assert.equal(correction.requiresRiskRevalidation, true);
  assert.equal(evaluateMomentumRegimeGate("CRISIS").status, "DENY_NEW_RISK");
});

test("behavioral safety denies revenge risk and reviews FOMO", () => {
  assert.equal(evaluateBehavioralGate({
    strategy: "MOMENTUM", action: "ENTER", emotionalState: "REVENGE_RISK",
  }).status, "DENY_NEW_RISK");
  assert.equal(evaluateBehavioralGate({
    strategy: "MOMENTUM", action: "ENTER", emotionalState: "FOMO_RISK",
  }).status, "REQUIRE_MANUAL_REVIEW");
});

test("Decision Journal enforces thesis/setup lineage and counter evidence", () => {
  const entry = createDecisionJournalEntry({
    id: "journal-1",
    decisionId: "decision-1",
    companyId: "company-1",
    strategy: "CORE",
    action: "BUY",
    expectedHorizon: "5Y",
    expectedReturnSources: ["FUNDAMENTAL_COMPOUNDING"],
    thesisId: "thesis-1",
    positionSize: { amount: "1000.25", currency: "USD", portfolioWeight: 0.01 },
    assumptions: ["고객 유지"],
    riskSummary: "고객 집중 위험",
    executionConditions: ["가격 105 이하"],
    exitConditions: ["Thesis Break"],
    emotionalState: "CALM",
    evidenceIds: ["evidence-1"],
    counterEvidenceIds: ["evidence-bear"],
    snapshotIds: ["snapshot-1"],
    modelVersionIds: ["model-1"],
    dataAsOf: "2026-07-21T20:00:00Z",
    recordedAt: "2026-07-22T00:00:00Z",
    reviewAt: "2026-10-25T00:00:00Z",
    recordType: "ORIGINAL",
  });
  assert.equal(entry.thesisId, "thesis-1");
  assert.throws(() => createDecisionJournalEntry({ ...entry, thesisId: undefined }), /thesisId/);
});

test("modified approval creates a new proposal request instead of mutating approval", () => {
  const request = requestDecisionModification({
    id: "modification-1",
    originalDecisionId: "decision-1",
    originalStrategy: "MOMENTUM",
    requestedStrategy: "CORE",
    requestedAmount: "500",
    requestedCurrency: "USD",
    requestedAt: "2026-07-22T00:10:00Z",
    requestedBy: "user-1",
    reason: "전략과 금액을 변경하고 싶습니다.",
  });
  assert.equal(request.status, "REQUIRES_NEW_PROPOSAL");
  assert.equal(request.requiresIndependentEvaluation, true);
  assert.equal(routeApprovalIntent({ type: "APPROVED_WITH_MODIFICATION", modificationRequestId: request.id }), "NEW_PROPOSAL_REQUIRED");
});

test("monthly allocation retains unallocated cash with exact Decimal arithmetic", () => {
  const decision = createCapitalAllocationDecision({
    id: "monthly-1",
    generatedAt: "2026-07-22T00:00:00Z",
    dataAsOf: "2026-07-21T20:00:00Z",
    capitalSource: "SALARY",
    availableAmount: "9007199254740993.10",
    currency: "USD",
    currentWeights: { LONG_TERM: 0.8, MOMENTUM: 0.1, CASH: 0.1 },
    targetWeights: { LONG_TERM: 0.85, MOMENTUM: 0.15 },
    projectedWeights: { LONG_TERM: 0.81, MOMENTUM: 0.1, CASH: 0.09 },
    proposals: [{
      id: "item-1", strategy: "CORE", companyId: "company-1", requestedAmount: "0.10", approvedAmount: "0.10",
      rationale: "Core 목표 비중 보완", nextReviewCondition: "다음 분기 실적",
    }],
    constraintsTriggered: [],
    stressSummary: "기존 Hard Limit 이내",
    finalRecommendation: "Core에 0.10을 배분하고 나머지는 현금으로 유지합니다.",
    snapshotIds: ["snapshot-1"],
    policyVersionId: "portfolio-policy-1",
  });
  assert.equal(decision.cashRetained, "9007199254740993");
});

test("manual risk review can resolve REVIEW but can never override DENY or Portfolio capacity", () => {
  const proposal = proposeAllocation({
    id: "allocation-review",
    portfolioId: "portfolio-1",
    generatedAt: "2026-07-22T00:00:00Z",
    expiresAt: "2026-07-22T01:00:00Z",
    strategy: "LONG_TERM",
    action: "BUY",
    lotStrategy: "CORE",
    companyId: "company-1",
    requestedAmount: "100",
    portfolioValue: "10000",
    currentStrategyValue: "0",
    currentCompanyValue: "0",
    currency: "USD",
    inputEvaluationIds: ["evaluation-1"],
    snapshotIds: ["snapshot-1"],
    policyVersionId: "portfolio-policy-1",
  });
  const review = evaluateRisk(proposal, {
    id: "risk-review",
    evaluatedAt: "2026-07-22T00:01:00Z",
    dataAsOf: "2026-07-22T00:00:00Z",
    riskPolicyVersionId: "risk-policy-1",
    maxDataAgeMinutes: 60,
    dailyDrawdownPercent: 0,
    maxDailyDrawdownPercent: 3,
    liquiditySufficient: true,
    criticalRiskCheckAvailable: true,
    eventRisk: true,
  });
  assert.equal(review.status, "REQUIRE_MANUAL_REVIEW");
  assert.equal(resolveManualRiskReview(review, proposal, {
    id: "risk-reviewed", status: "APPROVE", evaluatedAt: "2026-07-22T00:02:00Z", reviewedBy: "user-1",
    rationale: "이벤트 노출을 검토했습니다.", evidenceIds: ["evidence-1"],
  }).maxApprovedAmount, "100");
  assert.throws(() => resolveManualRiskReview({ ...review, status: "DENY" }, proposal, {
    id: "risk-overridden", status: "APPROVE", evaluatedAt: "2026-07-22T00:02:00Z", reviewedBy: "user-1",
    rationale: "강제 승인", evidenceIds: ["evidence-1"],
  }), /non-overridable/);
});

test("Future Core allocation uses separate Bucket and position hard limits", () => {
  const proposal = proposeAllocation({
    id: "allocation-future-core",
    portfolioId: "portfolio-1",
    generatedAt: "2026-07-22T00:00:00Z",
    expiresAt: "2026-07-22T01:00:00Z",
    strategy: "LONG_TERM",
    action: "ACCUMULATE",
    lotStrategy: "FUTURE_CORE",
    companyId: "company-1",
    requestedAmount: "50",
    portfolioValue: "1000",
    currentStrategyValue: "850",
    currentCompanyValue: "40",
    currentFutureCoreValue: "190",
    currency: "USD",
    inputEvaluationIds: ["evaluation-1"],
    snapshotIds: ["snapshot-1"],
    policyVersionId: "portfolio-policy-1",
  });
  assert.equal(proposal.approvedAmount, "10");
  assert.deepEqual(proposal.constraintsTriggered, ["COMPANY_WEIGHT_LIMIT", "FUTURE_CORE_LIMIT"]);
});

test("performance attribution keeps strategy Lots and signed P&L separate", () => {
  const result = attributePerformance([
    {
      id: "performance-1", lotId: "lot-momentum", companyId: "company-1", strategy: "MOMENTUM", currency: "USD",
      realizedPnl: "-10", fees: "1", fxPnl: "0.5", measuredAt: "2026-07-22T00:00:00Z",
      decisionId: "decision-1", modelVersionIds: ["model-1"],
    },
    {
      id: "performance-2", lotId: "lot-core", companyId: "company-1", strategy: "CORE", currency: "USD",
      realizedPnl: "5", fees: "0.2", fxPnl: "0", measuredAt: "2026-07-22T00:00:00Z",
      decisionId: "decision-2", modelVersionIds: ["model-2"],
    },
  ]);
  assert.equal(result.find((item) => item.strategy === "MOMENTUM")?.netPnl, "-10.5");
  assert.equal(result.find((item) => item.strategy === "CORE")?.netPnl, "4.8");
});

test("learning separates process quality from outcome and cannot auto-activate changes", () => {
  const review = assessDecisionReview({
    id: "review-1", decisionId: "decision-1", strategy: "MOMENTUM", realizedPnl: "10", currency: "USD",
    holdingDays: 2, dataQualityScore: 80, ruleCompliant: false, positionSizeCompliant: true,
    executionCompliant: false, emotionalState: "FOMO_RISK", psychologyNotes: "Stop 미준수",
    evidenceIds: ["evidence-1"], reviewedAt: "2026-07-22T00:00:00Z",
  });
  assert.equal(review.classification, "BAD_PROCESS_GOOD_OUTCOME");
  assert.throws(() => createInvestmentLesson({
    id: "lesson-1", title: "변경 없음", type: "NO_CHANGE", strategy: "MOMENTUM",
    originalAssumption: "기존 규칙", observedOutcome: "표본 손실", processAssessment: "준수",
    modelAssessment: "정상 분산", proposedChange: "즉시 임계치 변경", confidence: 50, sampleSize: 1,
    evidenceIds: ["evidence-1"], decisionReviewIds: ["review-1"], createdAt: "2026-07-22T00:00:00Z",
  }), /cannot propose/);
});

test("decision report separates facts, interpretation, counter evidence and one priority action", () => {
  const report = generateDecisionReport({
    id: "report-1", type: "WEEKLY_OS", generatedAt: "2026-07-22T00:00:00Z",
    dataAsOf: "2026-07-21T20:00:00Z", title: "Weekly Decision", conclusion: "신규 위험을 늘리지 않습니다.",
    changes: ["Momentum Regime이 Risk-off로 전환"], facts: ["지수 종가가 200일선 아래입니다."],
    estimates: ["변동성 확대 가능성"], interpretations: ["신규 진입 기대값이 낮아졌습니다."],
    recommendation: "현금을 유지합니다.", confidence: "MEDIUM", counterEvidence: ["일부 리더 종목은 상대강도를 유지합니다."],
    risks: ["급반등 기회비용"], actions: ["기존 Stop 유지"], nextReviewConditions: ["Regime 재평가"],
    evidenceIds: ["evidence-1"], modelVersionIds: ["model-1"],
  });
  assert.ok(report.markdown.indexOf("## Facts") < report.markdown.indexOf("## Interpretations"));
  assert.match(report.markdown, /## Counter Evidence/);
  assert.match(report.markdown, /## Priority Recommendation/);
});

test("Hard Safety philosophy changes require an Architecture revision", () => {
  const draft: PhilosophyChange = {
    id: "change-1", fromVersion: "2.2", toVersion: "2.3", section: "HARD_SAFETY",
    previousPolicy: "No leverage", newPolicy: "Conditional leverage", rationale: "검토 목적",
    effectiveFrom: "2026-08-01T00:00:00Z", evidenceIds: ["evidence-1"], status: "DRAFT", proposedBy: "user-1",
  };
  const review = transitionPhilosophyChange(draft, "IN_REVIEW", { actorId: "user-1", at: "2026-07-22T00:00:00Z" });
  assert.throws(() => transitionPhilosophyChange(review, "APPROVED", {
    actorId: "reviewer-1", at: "2026-07-23T00:00:00Z",
  }), /Architecture revision/);
  assert.equal(transitionPhilosophyChange({ ...review, architectureRevisionId: "ADR-010" }, "APPROVED", {
    actorId: "reviewer-1", at: "2026-07-23T00:00:00Z",
  }).approvedBy, "reviewer-1");
});
