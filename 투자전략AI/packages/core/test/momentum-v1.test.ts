import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_US_MOMENTUM_UNIVERSE_POLICY,
  MOMENTUM_FACTOR_WEIGHTS,
  calculateAverageTrueRange,
  calculateCatalystFreshness,
  calculateRelativeStrengthComposite,
  createMomentumTradeReview,
  evaluateMomentumV1,
  replayMomentumEvaluation,
  runMomentumScan,
  validateMomentumSetupTransition,
  validateMomentumTradePlanV1,
  type MomentumEvaluationInput,
  type MomentumFactorId,
  type MomentumFactorInput,
  type MomentumPriceBar,
} from "../src/index.js";

const factorIds = Object.keys(MOMENTUM_FACTOR_WEIGHTS) as MomentumFactorId[];

function fixture(overrides: Partial<MomentumEvaluationInput> = {}): MomentumEvaluationInput {
  const scoringEvidenceIds = factorIds.map((factor) => `evidence-${factor}`);
  const factors = Object.fromEntries(factorIds.map((factor) => [factor, {
    availability: "AVAILABLE",
    score: 80,
    bearScore: 70,
    bullScore: 90,
    evidenceIds: [`evidence-${factor}`],
    counterEvidenceIds: ["counter-1"],
    explanation: `${factor} is supported by point-in-time evidence`,
  } satisfies MomentumFactorInput])) as Partial<Record<MomentumFactorId, MomentumFactorInput>>;
  const input: MomentumEvaluationInput = {
    id: "momentum-v1-1",
    companyId: "company-1",
    securityId: "security-1",
    evaluatedAt: "2026-07-22T21:10:00Z",
    dataAsOf: "2026-07-22T20:00:00Z",
    marketPriceAsOf: "2026-07-22T21:00:00Z",
    mode: "SETUP_VALIDATION",
    modelVersionId: "momentum-model-v1",
    philosophyVersionId: "philosophy-v2.2.1",
    universePolicy: structuredClone(DEFAULT_US_MOMENTUM_UNIVERSE_POLICY),
    universe: {
      securityType: "COMMON_STOCK",
      venue: "NASDAQ",
      price: "101",
      marketCap: "10000000000",
      addv20: "120000000",
      medianSpreadBps: 10,
      listingSessions: 1000,
      riskFlags: [],
      halted: false,
      delistingProcess: false,
      identityResolved: true,
      quoteSourcesConsistent: true,
      corporateActionsApplied: true,
      snapshotIds: ["snapshot-market"],
    },
    marketRegime: {
      regime: "RISK_ON_TREND",
      confidence: 90,
      permission: "ALLOW",
      riskMultiplier: 1,
      reasonCodes: ["TREND_BREADTH_ALIGNED"],
      snapshotIds: ["snapshot-regime"],
      evaluatedAt: "2026-07-22T20:30:00Z",
    },
    setupId: "setup-1",
    setupDefinition: {
      type: "BREAKOUT",
      version: "breakout-v1",
      requiredIndicators: ["ATR14", "VOLUME_RATIO50", "RS_COMPOSITE"],
      criticalFactorIds: ["MOM_PRICE_STRUCTURE", "MOM_LIQUIDITY_EXECUTION", "MOM_REWARD_RISK_TIMING"],
      allowedNotApplicableFactorIds: [],
      defaultHoldingSessions: { min: 5, max: 15 },
      allowedRegimes: ["RISK_ON_TREND", "RISK_ON_VOLATILE", "NEUTRAL_RANGE"],
      eventPolicy: "NO_KNOWN_EVENT",
    },
    setupMetrics: {
      baseSessions: 30,
      baseDepthPercent: 20,
      resistanceBreakConfirmed: true,
      breakoutVolumeRatio: 1.8,
      closeLocationPercent: 15,
      chaseDistanceAtr: 0.4,
    },
    triggerStatus: "TRIGGERED",
    detectedAt: "2026-07-22T20:30:00Z",
    invalidationConditions: ["close below breakout level"],
    factors,
    confidence: {
      evidenceCoverage: 90,
      sourceQuality: 85,
      dataFreshness: 95,
      modelFit: 85,
      disagreement: 10,
      hasCounterEvidence: true,
    },
    tradePlan: {
      id: "plan-1",
      revision: 1,
      companyId: "company-1",
      securityId: "security-1",
      evaluationId: "momentum-v1-1",
      setupId: "setup-1",
      setupType: "BREAKOUT",
      marketRegime: "RISK_ON_TREND",
      currency: "USD",
      entryZoneMin: "100",
      entryZoneMax: "102",
      chaseLimit: "104",
      trigger: "trade above breakout level with volume confirmation",
      initialStop: "95",
      target1: "111",
      target2: "114",
      timeStopSessions: 10,
      referenceEntry: "101",
      unitRisk: "6",
      rewardRiskToTarget1: 1.67,
      rewardRiskToTarget2: 2.17,
      estimatedRoundTripCostR: 0.1,
      invalidationConditions: ["close below breakout level"],
      eventPolicy: "NO_KNOWN_EVENT",
      evidenceIds: ["evidence-MOM_PRICE_STRUCTURE"],
      counterEvidenceIds: ["counter-1"],
      snapshotIds: ["snapshot-market"],
      modelVersionId: "momentum-model-v1",
      generatedAt: "2026-07-22T21:00:00Z",
      expiresAt: "2026-07-23T21:00:00Z",
    },
    eventRisk: {
      calendarKnown: true,
      eventWithinPlanHorizon: false,
      binaryEvent: false,
      officialScheduleConsistent: true,
      policy: "NO_KNOWN_EVENT",
      manualReviewApproved: false,
      gapRiskScore: 20,
    },
    signalContext: {
      activePosition: false,
      stopOrInvalidationTriggered: false,
      marketDataFresh: true,
      corporateActionsApplied: true,
      behavioralPolicyClear: true,
    },
    currentPrice: "101",
    executionRisk: 20,
    snapshotIds: ["snapshot-market", "snapshot-regime"],
    evidenceIds: [...scoringEvidenceIds, "counter-1"],
    scoringEvidenceIds,
    counterEvidenceIds: ["counter-1"],
    nextReviewAt: "2026-07-23T13:00:00Z",
    expiresAt: "2026-07-23T21:00:00Z",
  };
  return { ...input, ...overrides };
}

test("Momentum v1 keeps seven-factor setup quality independent and produces an entry candidate", () => {
  assert.equal(Object.values(MOMENTUM_FACTOR_WEIGHTS).reduce((sum, value) => sum + value, 0), 100);
  const result = evaluateMomentumV1(fixture());
  assert.equal(result.score.point, 80);
  assert.equal(result.action, "ENTER");
  assert.equal(result.marketRegime.riskMultiplier, 1);
  assert.deepEqual(result.actionConstraints, ["PORTFOLIO_RISK_APPROVAL_REQUIRED", "HUMAN_APPROVAL_REQUIRED"]);
  assert.equal(result.riskScoreDirection, "HIGHER_IS_RISKIER");
  assert.equal(result.resultHash.length, 64);
});

test("market regime changes permission without contaminating Momentum score", () => {
  const riskOn = evaluateMomentumV1(fixture());
  const crisisInput = fixture();
  crisisInput.marketRegime = {
    ...crisisInput.marketRegime,
    regime: "CRISIS",
    permission: "DENY_NEW_RISK",
    riskMultiplier: 0,
    reasonCodes: ["MARKET_DISLOCATION"],
  };
  crisisInput.tradePlan = { ...crisisInput.tradePlan!, marketRegime: "CRISIS" };
  const crisis = evaluateMomentumV1(crisisInput);
  assert.equal(crisis.score.point, riskOn.score.point);
  assert.equal(crisis.action, "AVOID");
  assert.equal(crisis.marketRegime.riskMultiplier, 0);
});

test("NOT_APPLICABLE reweights only when predeclared while UNKNOWN fails closed", () => {
  const allowed = fixture();
  allowed.setupDefinition.allowedNotApplicableFactorIds = ["MOM_SECTOR_LEADERSHIP"];
  allowed.factors.MOM_SECTOR_LEADERSHIP = {
    availability: "NOT_APPLICABLE", evidenceIds: [], explanation: "broad instrument has no sector benchmark",
  };
  assert.equal(evaluateMomentumV1(allowed).score.point, 80);

  const availableDespitePermission = fixture();
  availableDespitePermission.setupDefinition.allowedNotApplicableFactorIds = ["MOM_SECTOR_LEADERSHIP"];
  assert.equal(evaluateMomentumV1(availableDespitePermission).score.point, 80);

  const unknown = fixture();
  unknown.factors.MOM_VOLUME_CONFIRMATION = {
    availability: "UNKNOWN", evidenceIds: [], explanation: "volume feed unavailable",
  };
  const blocked = evaluateMomentumV1(unknown);
  assert.equal(blocked.score.point, 0);
  assert.equal(blocked.action, "AVOID");
  assert.ok(blocked.explanation.failedGates.includes("FACTOR_INPUT_BLOCKED"));
});

test("Momentum scan isolates invalid candidates and compares only one version and session", () => {
  const valid = fixture();
  const invalid = fixture({ id: "momentum-v1-invalid", companyId: "company-2", securityId: "security-2" });
  invalid.tradePlan = { ...invalid.tradePlan!, id: "plan-invalid", evaluationId: invalid.id, companyId: invalid.companyId, securityId: invalid.securityId };
  invalid.marketPriceAsOf = "2026-07-21T21:00:00Z";
  const result = runMomentumScan({
    id: "scan-1", session: "2026-07-22", modelVersionId: "momentum-model-v1",
    universePolicyVersionId: "momentum-us-v1", createdAt: "2026-07-22T21:15:00Z",
    evaluations: [valid, invalid],
  });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.succeededCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.failures[0]?.code, "VERSION_CONFLICT");
  assert.equal(result.resultHash.length, 64);
});

test("Universe and corporate-action failures cannot be overridden by high scores", () => {
  const input = fixture();
  input.universe.halted = true;
  const result = evaluateMomentumV1(input);
  assert.equal(result.universeDecision.eligible, false);
  assert.ok(result.universeDecision.reasonCodes.includes("SECURITY_HALTED"));
  assert.equal(result.action, "AVOID");
});

test("chase limit and incomplete price positioning prevent FOMO entry", () => {
  const chased = evaluateMomentumV1(fixture({ currentPrice: "105" }));
  assert.equal(chased.action, "AVOID");
  assert.ok(chased.actionConstraints.includes("CHASE_ENTRY_FORBIDDEN"));
  const early = evaluateMomentumV1(fixture({ currentPrice: "99" }));
  assert.equal(early.action, "WAIT");
  assert.ok(early.actionConstraints.includes("WAIT_FOR_ENTRY_ZONE"));
});

test("trade plans enforce price relationships, unit risk and cost-adjusted reward/risk", () => {
  assert.equal(validateMomentumTradePlanV1(fixture().tradePlan!).unitRisk, "6");
  const invalid = structuredClone(fixture().tradePlan!);
  invalid.initialStop = "100";
  assert.throws(() => validateMomentumTradePlanV1(invalid), /initial stop/);
  const poorReward = structuredClone(fixture().tradePlan!);
  poorReward.target1 = "108";
  poorReward.target2 = "110";
  poorReward.rewardRiskToTarget1 = 1.17;
  poorReward.rewardRiskToTarget2 = 1.5;
  assert.throws(() => validateMomentumTradePlanV1(poorReward), /reward\/risk/);
});

test("binary event policy fails closed without a gap scenario and approval", () => {
  const input = fixture();
  input.eventRisk = {
    calendarKnown: true,
    eventWithinPlanHorizon: true,
    binaryEvent: true,
    officialScheduleConsistent: true,
    policy: "HOLD_WITH_SCENARIO_APPROVAL",
    manualReviewApproved: false,
    gapRiskScore: 80,
  };
  input.tradePlan = { ...input.tradePlan!, eventPolicy: "HOLD_WITH_SCENARIO_APPROVAL" };
  const result = evaluateMomentumV1(input);
  assert.equal(result.action, "AVOID");
  assert.ok(result.explanation.failedGates.includes("EVENT_POLICY_INVALID"));
});

test("active setup invalidation exits independently of entry score", () => {
  const input = fixture();
  input.signalContext.activePosition = true;
  input.signalContext.stopOrInvalidationTriggered = true;
  assert.equal(evaluateMomentumV1(input).action, "EXIT");
});

test("historical replay is deterministic and cannot change operational state", () => {
  const base = fixture();
  const first = replayMomentumEvaluation(base);
  const second = replayMomentumEvaluation({ ...fixture(), untrustedPortfolioFit: 0 } as MomentumEvaluationInput);
  assert.equal(first.resultHash, second.resultHash);
  assert.equal(first.mode, "HISTORICAL_REPLAY");
  assert.equal(first.operationalStateChangeAllowed, false);
  assert.ok(first.actionConstraints.includes("OPERATIONAL_STATE_CHANGE_FORBIDDEN"));
});

test("catalyst half-life rejects future knowledge and decays deterministically", () => {
  const catalyst = {
    id: "catalyst-1", companyId: "company-1", type: "EARNINGS_SURPRISE" as const,
    occurredAt: "2026-07-22T12:00:00Z", availableAt: "2026-07-22T13:00:00Z", sourceTier: "A" as const,
    official: true, summary: "earnings beat", expectedDuration: "DAYS" as const, halfLifeHours: 24,
    estimateRevisionObserved: true, priceReactionPercent: 5, evidenceIds: ["e-1"], counterEvidenceIds: ["c-1"],
  };
  assert.equal(calculateCatalystFreshness(catalyst, "2026-07-23T13:00:00Z"), 0.5);
  assert.throws(() => calculateCatalystFreshness(catalyst, "2026-07-22T12:30:00Z"), /future information/);
});

test("indicator helpers require adjusted ordered bars and aligned point-in-time series", () => {
  const bars: MomentumPriceBar[] = Array.from({ length: 15 }, (_, index) => ({
    session: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    open: `${100 + index}`, high: `${102 + index}`, low: `${99 + index}`, close: `${101 + index}`,
    volume: "1000000", adjustmentFactor: "1", adjusted: true,
  }));
  assert.equal(calculateAverageTrueRange(bars, 14), 3);
  const security = Array.from({ length: 251 }, (_, index) => `${100 + index}`);
  const benchmark = Array.from({ length: 251 }, (_, index) => `${100 + index * 0.5}`);
  const rs = calculateRelativeStrengthComposite(security, benchmark);
  assert.ok(rs.score > 50);
  bars[5]!.adjusted = false;
  assert.throws(() => calculateAverageTrueRange(bars, 14), /adjusted bars/);
});

test("lifecycle approval is human-only and trade review separates process from outcome", () => {
  assert.throws(() => validateMomentumSetupTransition({
    id: "transition-1", setupId: "setup-1", from: "PLANNED", to: "APPROVED",
    evaluationId: "evaluation-1", planId: "plan-1", decisionId: "decision-1", reasonCode: "APPROVE",
    evidenceIds: ["e-1"], modelVersionId: "model-1", occurredAt: "2026-07-22T21:00:00Z",
    actor: { id: "engine", type: "AI" },
  }), /human actor/);
  const review = createMomentumTradeReview({
    id: "review-1", setupId: "setup-1", evaluationId: "evaluation-1", planId: "plan-1",
    closedAt: "2026-07-25T20:00:00Z", reviewedAt: "2026-07-26T10:00:00Z",
    realizedRMultiple: -1, maximumAdverseExcursionR: -1.2, maximumFavorableExcursionR: 0.4,
    planFollowed: true, processGrade: "A", outcome: "LOSS", ruleViolations: [], lessons: ["valid loss"],
  });
  assert.equal(review.processGrade, "A");
  assert.equal(review.outcome, "LOSS");
});
