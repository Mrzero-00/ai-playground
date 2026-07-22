import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateScorecardV1,
  explainScoreChangeV1,
  normalizeScoreV1,
  rankScorecardsV1,
  validateScoreModelV1,
  type FactorObservationV1,
  type ScoreModelInputV1,
} from "../src/index.js";

function modelInput(overrides: Partial<ScoreModelInputV1> = {}): ScoreModelInputV1 {
  return {
    id: "score-model-1", userId: "score-user-1", version: "core-1.0.0", scope: "LONG_TERM_CORE", status: "ACTIVE",
    factorDefinitions: [
      {
        id: "QUALITY", label: "Business quality", direction: "HIGHER_IS_BETTER", weightBasisPoints: 6000,
        critical: true, allowedNotApplicable: false, normalization: { kind: "LINEAR", floor: 0, ceiling: 10 },
        evidencePolicy: { minimumSourceTier: "A", minimumDistinctSources: 1, counterEvidenceRequired: true, pointInTimeRequired: true },
        effectiveFrom: "2026-07-22T00:00:00Z",
      },
      {
        id: "RISK", label: "Risk resilience", direction: "HIGHER_IS_WORSE", weightBasisPoints: 4000,
        critical: false, allowedNotApplicable: true, normalization: { kind: "LINEAR", floor: 0, ceiling: 10 },
        evidencePolicy: { minimumSourceTier: "B", minimumDistinctSources: 1, counterEvidenceRequired: false, pointInTimeRequired: true },
        partialScoreCap: 70, effectiveFrom: "2026-07-22T00:00:00Z",
      },
    ],
    minimumApplicableWeightBasisPoints: 6000,
    thresholds: [{ id: "CORE_ENTRY", minimumScore: 78, minimumConfidence: 75, purpose: "new Core entry" }],
    confidencePolicy: {
      weightsBasisPoints: { EVIDENCE_COVERAGE: 3500, SOURCE_QUALITY: 2500, FRESHNESS: 0, MODEL_FIT: 2500, AGREEMENT: 1500 },
      grades: { high: 80, medium: 65, low: 50 },
    },
    effectiveFrom: "2026-07-23T00:00:00Z", approvedBy: "score-reviewer", approvedAt: "2026-07-22T10:00:00Z",
    changeReason: "initial deterministic Core score model",
    ...overrides,
  };
}

function observations(quality = 8, risk = 2): FactorObservationV1[] {
  return [
    { factorId: "QUALITY", availability: "AVAILABLE", rawValue: quality, evidenceIds: ["evidence-quality"], counterEvidenceIds: ["evidence-counter"], observedAt: "2026-07-22T09:00:00Z", availableAt: "2026-07-22T10:00:00Z", explanation: "audited durability evidence" },
    { factorId: "RISK", availability: "AVAILABLE", rawValue: risk, evidenceIds: ["evidence-risk"], counterEvidenceIds: [], observedAt: "2026-07-22T09:00:00Z", availableAt: "2026-07-22T10:00:00Z", explanation: "low measured impairment risk" },
  ];
}

function scorecardInput(id: string, model = validateScoreModelV1(modelInput()), factorObservations = observations()) {
  return {
    id, userId: "score-user-1", subjectType: "COMPANY" as const, subjectId: `company-${id}`, mode: "OPERATIONAL" as const,
    model, philosophyVersionId: "philosophy-2.2.1", industryProfileVersionId: "software-1",
    observations: factorObservations,
    evidence: [
      { id: "evidence-quality", userId: "score-user-1", sourceId: "audited-filing", sourceTier: "A" as const, scoreEligible: true, observedAt: "2026-07-22T08:00:00Z", availableAt: "2026-07-22T09:00:00Z" },
      { id: "evidence-risk", userId: "score-user-1", sourceId: "market-data", sourceTier: "B" as const, scoreEligible: true, observedAt: "2026-07-22T08:00:00Z", availableAt: "2026-07-22T09:00:00Z" },
      { id: "evidence-counter", userId: "score-user-1", sourceId: "counter-research", sourceTier: "C" as const, scoreEligible: false, observedAt: "2026-07-22T08:00:00Z", availableAt: "2026-07-22T09:00:00Z" },
    ],
    confidence: { evidenceCoverage: 90, sourceQuality: 90, freshness: 70, modelFit: 80, disagreement: 10, caps: [] },
    snapshotIds: ["snapshot-2", "snapshot-1"], evidenceIds: ["evidence-risk", "evidence-counter", "evidence-quality"],
    asOf: "2026-07-22T12:00:00Z", evaluatedAt: "2026-07-22T12:01:00Z", codeVersion: "git-score-v1",
  };
}

test("Score Model validates exact basis-point weights, approval and deterministic hash", () => {
  const model = validateScoreModelV1(modelInput());
  assert.equal(model.modelHash.length, 64);
  assert.deepEqual(model.factorDefinitions.map((factor) => factor.id), ["QUALITY", "RISK"]);
  assert.throws(() => validateScoreModelV1(modelInput({ factorDefinitions: modelInput().factorDefinitions.map((factor) => ({ ...factor, weightBasisPoints: 4000 })) })), /10000/);
  assert.throws(() => validateScoreModelV1(modelInput({ factorDefinitions: modelInput().factorDefinitions.map((factor) => factor.id === "RISK" ? { ...factor, critical: true, allowedNotApplicable: true } : factor) })), /critical Factor/);
});

test("Normalization makes direction explicit and preserves target-band semantics", () => {
  assert.equal(normalizeScoreV1({ policy: { kind: "LINEAR", floor: 0, ceiling: 10 }, direction: "HIGHER_IS_BETTER", rawValue: 8 }).score, 80);
  assert.equal(normalizeScoreV1({ policy: { kind: "LINEAR", floor: 0, ceiling: 10 }, direction: "HIGHER_IS_WORSE", rawValue: 2 }).score, 80);
  assert.equal(normalizeScoreV1({ policy: { kind: "TARGET_BAND", lowerBoundary: 0, idealMin: 4, idealMax: 6, upperBoundary: 10 }, direction: "TARGET_IS_BEST", rawValue: 5 }).score, 100);
});

test("Scorecard keeps Score, Confidence and contribution deterministic", () => {
  const model = validateScoreModelV1(modelInput());
  const result = evaluateScorecardV1(scorecardInput("scorecard-1", model));
  assert.equal(result.status, "SCORED");
  assert.deepEqual(result.score, { point: 80, low: 80, high: 80, sensitivityDriverIds: ["QUALITY", "RISK"] });
  assert.equal(result.confidence.score, 87.5);
  assert.equal(result.confidence.grade, "HIGH");
  const reordered = evaluateScorecardV1({ ...scorecardInput("scorecard-1", model, observations().reverse()), snapshotIds: ["snapshot-1", "snapshot-2"], evidenceIds: ["evidence-quality", "evidence-risk", "evidence-counter"] });
  assert.equal(reordered.resultHash, result.resultHash);
});

test("UNKNOWN blocks without inventing a zero total score", () => {
  const unavailable = observations();
  unavailable[0] = { ...unavailable[0]!, availability: "UNKNOWN", rawValue: undefined } as never;
  const result = evaluateScorecardV1(scorecardInput("scorecard-blocked", undefined, unavailable));
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.score, undefined);
  assert.ok(result.blockerCodes.some((code) => code.includes("FACTOR_UNKNOWN")));
});

test("Evidence tier, distinct source and ownership are derived from the manifest", () => {
  const weak = scorecardInput("scorecard-weak-evidence");
  weak.evidence[0] = { ...weak.evidence[0]!, sourceTier: "D" };
  const blocked = evaluateScorecardV1(weak);
  assert.equal(blocked.status, "BLOCKED");
  assert.ok(blocked.blockerCodes.some((code) => code.includes("SCORING_EVIDENCE_INSUFFICIENT")));
  const crossOwner = scorecardInput("scorecard-cross-owner");
  crossOwner.evidence[0] = { ...crossOwner.evidence[0]!, userId: "other-user" };
  assert.throws(() => evaluateScorecardV1(crossOwner), /ownership mismatch/);
});

test("predeclared non-critical N/A reweights while critical N/A is rejected", () => {
  const notApplicable = observations();
  notApplicable[1] = { factorId: "RISK", availability: "NOT_APPLICABLE", evidenceIds: [], counterEvidenceIds: [], observedAt: "2026-07-22T09:00:00Z", availableAt: "2026-07-22T10:00:00Z", explanation: "not applicable by model" };
  const result = evaluateScorecardV1(scorecardInput("scorecard-na", undefined, notApplicable));
  assert.equal(result.status, "SCORED");
  assert.equal(result.score?.point, 80);
  assert.equal(result.factorResults.find((factor) => factor.factorId === "QUALITY")?.effectiveWeightBasisPoints, 10_000);
  const invalid = observations();
  invalid[0] = { factorId: "QUALITY", availability: "NOT_APPLICABLE", evidenceIds: [], counterEvidenceIds: [], observedAt: "2026-07-22T09:00:00Z", availableAt: "2026-07-22T10:00:00Z", explanation: "invalid critical N/A" };
  assert.throws(() => evaluateScorecardV1(scorecardInput("scorecard-critical-na", undefined, invalid)), /cannot be NOT_APPLICABLE/);
});

test("Ranking accepts only the same scope/model and excludes blocked values", () => {
  const model = validateScoreModelV1(modelInput());
  const high = evaluateScorecardV1(scorecardInput("high", model, observations(9, 1)));
  const low = evaluateScorecardV1(scorecardInput("low", model, observations(7, 3)));
  const blockedObservations = observations();
  blockedObservations[0] = { ...blockedObservations[0]!, availability: "STALE", rawValue: undefined } as never;
  const blocked = evaluateScorecardV1(scorecardInput("blocked", model, blockedObservations));
  const ranking = rankScorecardsV1([low, blocked, high]);
  assert.deepEqual(ranking.items.map((item) => item.scorecardId), ["high", "low"]);
  assert.equal(ranking.excluded[0]?.scorecardId, "blocked");
  const otherModel = validateScoreModelV1(modelInput({ id: "score-model-2", version: "core-2.0.0" }));
  assert.throws(() => rankScorecardsV1([high, evaluateScorecardV1(scorecardInput("other", otherModel))]), /same scope and model/);
});

test("Score change explains contribution delta only for comparable model versions", () => {
  const model = validateScoreModelV1(modelInput());
  const previous = evaluateScorecardV1({ ...scorecardInput("previous", model, observations(7, 3)), subjectId: "company-shared" });
  const current = evaluateScorecardV1({ ...scorecardInput("current", model, observations(8, 2)), subjectId: "company-shared" });
  const explanation = explainScoreChangeV1({ id: "change-1", userId: "score-user-1", previous, current, explainedAt: "2026-07-22T13:00:00Z" });
  assert.equal(explanation.comparisonStatus, "COMPARABLE");
  assert.equal(explanation.pointDelta, 10);
  assert.equal(explanation.resultHash.length, 64);
});
