import assert from "node:assert/strict";
import test from "node:test";
import {
  CORE_FACTOR_WEIGHTS,
  FUTURE_CORE_FACTOR_WEIGHTS,
  assessLongTermThesis,
  evaluateLongTermV1,
  replayLongTermEvaluation,
  validateLongTermValuation,
  type FactorInput,
  type LongTermEvaluationInput,
  type LongTermFactorId,
} from "../src/index.js";

const coreFactors = Object.keys(CORE_FACTOR_WEIGHTS) as LongTermFactorId[];
const futureCoreFactors = Object.keys(FUTURE_CORE_FACTOR_WEIGHTS) as LongTermFactorId[];
const allFactors = [...coreFactors, ...futureCoreFactors];

function fixture(overrides: Partial<LongTermEvaluationInput> = {}): LongTermEvaluationInput {
  const scoringEvidenceIds = allFactors.map((factor) => `evidence-${factor}`);
  const factors = Object.fromEntries(allFactors.map((factor) => [factor, {
    availability: "AVAILABLE",
    score: 80,
    bearScore: 70,
    bullScore: 90,
    trend: "STABLE",
    evidenceIds: [`evidence-${factor}`],
    counterEvidenceIds: ["counter-1"],
    explanation: `${factor} is supported by point-in-time evidence`,
  } satisfies FactorInput])) as Partial<Record<LongTermFactorId, FactorInput>>;
  return {
    id: "long-v1-1",
    companyId: "company-1",
    securityId: "security-1",
    profile: "BOTH",
    mode: "FULL_REVIEW",
    evaluatedAt: "2026-07-22T09:00:00Z",
    dataAsOf: "2026-07-21T20:00:00Z",
    marketPriceAsOf: "2026-07-21T20:00:00Z",
    modelVersionId: "long-term-model-v1",
    philosophyVersionId: "philosophy-v2.2.1",
    industryProfile: {
      id: "software-profile",
      version: "software-v1",
      industryCode: "SOFTWARE",
      name: "Software",
      status: "ACTIVE",
      supportedProfiles: ["CORE", "FUTURE_CORE"],
      notApplicableFactorIds: [],
      criticalFactorIds: ["CORE_BUSINESS_DURABILITY", "FC_SURVIVAL_DILUTION"],
      minimumApplicableWeight: 85,
      modelFitValidated: true,
      effectiveFrom: "2026-01-01T00:00:00Z",
    },
    snapshotIds: ["snapshot-market", "snapshot-financial"],
    evidenceIds: [...scoringEvidenceIds, "counter-1", "valuation-bear", "valuation-base", "valuation-bull", "thesis-evidence"],
    scoringEvidenceIds,
    counterEvidenceIds: ["counter-1"],
    currentStage: "STRONG_CANDIDATE",
    factors,
    confidence: {
      evidenceCoverage: 90,
      sourceQuality: 80,
      modelFit: 85,
      disagreement: 10,
      observedQuarters: 8,
    },
    gates: {
      identityResolved: true,
      dataQualitySufficient: true,
      accountingTrustworthy: true,
      financialSurvival: true,
      valuationAvailable: true,
      thesisComplete: true,
      policyVersionActive: true,
      stressRunwayMonths: 24,
    },
    valuation: {
      currency: "USD",
      marketPrice: "100",
      marketPriceAsOf: "2026-07-21T20:00:00Z",
      classification: "ATTRACTIVE",
      methods: ["DCF", "REVERSE_DCF"],
      scenarios: [
        { name: "BEAR", probability: 0.25, enterpriseValue: "700", equityValue: "600", valuePerShare: "75", evidenceIds: ["valuation-bear"] },
        { name: "BASE", probability: 0.5, enterpriseValue: "1200", equityValue: "1100", valuePerShare: "125", evidenceIds: ["valuation-base"] },
        { name: "BULL", probability: 0.25, enterpriseValue: "1800", equityValue: "1700", valuePerShare: "180", evidenceIds: ["valuation-bull"] },
      ],
      expectedReturnPositive: true,
      bearLossTolerable: true,
      sensitivityDrivers: ["revenue-growth", "operating-margin", "discount-rate"],
    },
    thesis: {
      thesisId: "thesis-1",
      assumptions: [{
        id: "assumption-1", importance: "CRITICAL", previousStatus: "SUPPORTED", currentStatus: "SUPPORTED", evidenceIds: ["thesis-evidence"],
      }],
    },
    previousFactorScores: Object.fromEntries(allFactors.map((factor) => [factor, 75])),
    nextReviewAt: "2026-08-22T09:00:00Z",
    reviewTriggers: ["EARNINGS_RELEASED", "HARD_RISK_DETECTED"],
    ...overrides,
  };
}

test("Long-term v1 evaluates Core and Future Core as independent profiles", () => {
  assert.equal(Object.values(CORE_FACTOR_WEIGHTS).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(Object.values(FUTURE_CORE_FACTOR_WEIGHTS).reduce((sum, value) => sum + value, 0), 100);
  const result = evaluateLongTermV1(fixture());
  assert.equal(result.profiles.core?.score.point, 80);
  assert.equal(result.profiles.futureCore?.score.point, 80);
  assert.equal(result.profiles.core?.eligibility, "ELIGIBLE");
  assert.equal(result.profiles.futureCore?.eligibility, "ELIGIBLE");
  assert.equal(result.primaryProfile, "FUTURE_CORE");
  assert.equal(result.proposedStage, "FUTURE_CORE");
  assert.equal(result.stageChangeRequiresHumanApproval, true);
  assert.equal(result.action, "ACCUMULATE");
  assert.equal(result.permanentImpairmentRisk, 20);
  assert.equal(result.riskScoreDirection, "HIGHER_IS_RISKIER");
  assert.equal(result.resultHash.length, 64);
});

test("portfolio context cannot contaminate the long-term attractiveness score", () => {
  const base = fixture();
  const withUntrustedExtraField = { ...fixture(), portfolioFit: 0, opportunityCost: 0 } as LongTermEvaluationInput;
  assert.equal(evaluateLongTermV1(base).resultHash, evaluateLongTermV1(withUntrustedExtraField).resultHash);
});

test("NOT_APPLICABLE is reweighted only when the industry profile declares it", () => {
  const input = fixture({ profile: "CORE", currentStage: "CORE" });
  input.industryProfile.notApplicableFactorIds = ["CORE_MANAGEMENT_CAPITAL"];
  input.factors.CORE_MANAGEMENT_CAPITAL = {
    availability: "NOT_APPLICABLE", evidenceIds: [], explanation: "not applicable for this profile",
  };
  const result = evaluateLongTermV1(input);
  assert.equal(result.profiles.core?.score.point, 80);
  assert.equal(result.profiles.core?.factorResults.find((factor) => factor.factorId === "CORE_MANAGEMENT_CAPITAL")?.status, "NOT_APPLICABLE");

  const invalid = fixture({ profile: "CORE" });
  invalid.factors.CORE_MANAGEMENT_CAPITAL = input.factors.CORE_MANAGEMENT_CAPITAL;
  assert.throws(() => evaluateLongTermV1(invalid), /not declared NOT_APPLICABLE/);
});

test("unknown factor blocks profile eligibility instead of becoming a neutral score", () => {
  const input = fixture({ profile: "FUTURE_CORE" });
  input.factors.FC_UNIT_ECONOMICS = {
    availability: "UNKNOWN", evidenceIds: [], explanation: "unit economics were not disclosed",
  };
  const result = evaluateLongTermV1(input);
  assert.equal(result.profiles.futureCore?.score.point, 0);
  assert.equal(result.profiles.futureCore?.eligibility, "INELIGIBLE");
  assert.equal(result.action, "WATCH");
  assert.ok(result.actionConstraints.includes("EXPANSION_BLOCKED"));
});

test("hard risk fails closed and prevents expansion regardless of score", () => {
  const input = fixture();
  input.gates.accountingTrustworthy = false;
  input.gates.hardRiskCodes = ["MATERIAL_RESTATEMENT"];
  const result = evaluateLongTermV1(input);
  assert.equal(result.action, "REVIEW_REQUIRED");
  assert.equal(result.proposedStage, "WEAKENED");
  assert.equal(result.permanentImpairmentRisk, 100);
  assert.ok(result.explanation.failedGates.includes("ACCOUNTING_TRUST_FAILED"));
});

test("a pre-defined thesis break produces EXIT review without using price direction", () => {
  const input = fixture();
  input.thesis.breakConditionTriggered = true;
  input.valuation.classification = "ATTRACTIVE";
  const result = evaluateLongTermV1(input);
  assert.equal(result.thesisAssessment.status, "BROKEN");
  assert.equal(result.action, "EXIT");
  assert.equal(result.proposedStage, "WEAKENED");
});

test("historical replay never proposes an operational state change", () => {
  const result = replayLongTermEvaluation(fixture());
  assert.equal(result.mode, "HISTORICAL_REPLAY");
  assert.equal(result.operationalStateChangeAllowed, false);
  assert.equal(result.proposedStage, result.stageBefore);
});

test("valuation enforces multiple methods, scenario order and probability mass", () => {
  const input = fixture().valuation;
  assert.equal(validateLongTermValuation(input).classification, "ATTRACTIVE");
  const invalid = structuredClone(input);
  invalid.scenarios[0]!.probability = 0.4;
  assert.throws(() => validateLongTermValuation(invalid), /probabilities must sum to 1/);
  const singleMethod = { ...structuredClone(input), methods: ["RELATIVE_MULTIPLE"] as typeof input.methods };
  assert.throws(() => validateLongTermValuation(singleMethod), /at least two methods/);
});

test("thesis assessment distinguishes strengthening, weakening and break", () => {
  const strengthened = assessLongTermThesis({
    thesisId: "t-1", assumptions: [{ id: "a-1", importance: "HIGH", previousStatus: "MIXED", currentStatus: "SUPPORTED", evidenceIds: ["e-1"] }],
  });
  assert.equal(strengthened.status, "STRENGTHENED");
  const weakened = assessLongTermThesis({
    thesisId: "t-1", assumptions: [{ id: "a-1", importance: "CRITICAL", previousStatus: "SUPPORTED", currentStatus: "UNSUPPORTED", evidenceIds: ["e-1"] }],
  });
  assert.equal(weakened.status, "WEAKENED");
  assert.equal(assessLongTermThesis({ ...fixture().thesis, breakConditionTriggered: true }).status, "BROKEN");
});

test("point-in-time and evidence lineage violations are rejected", () => {
  assert.throws(() => evaluateLongTermV1(fixture({ dataAsOf: "2026-07-23T00:00:00Z" })), /cannot be newer/);
  const input = fixture();
  input.factors.CORE_MOAT!.evidenceIds = ["unlinked-evidence"];
  assert.throws(() => evaluateLongTermV1(input), /not score eligible/);
});
