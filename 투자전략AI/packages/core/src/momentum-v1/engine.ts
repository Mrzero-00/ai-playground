import { createHash } from "node:crypto";
import { assertDecimal, compareDecimal } from "../decimal.js";
import { assertScore } from "../scoring.js";
import { calculateCatalystFreshness } from "./indicators.js";
import { calculateMomentumConfidence, evaluateMomentumFactors } from "./profile.js";
import { evaluateMomentumSetup } from "./setup.js";
import { classifyMomentumPrice, validateMomentumTradePlanV1, type MomentumPricePosition } from "./trade-plan.js";
import { evaluateMomentumUniverse, validateMarketRegimeEvaluation } from "./universe.js";
import type {
  MomentumAction,
  MomentumEvaluationInput,
  MomentumEvaluationResultV1,
  MomentumFactorId,
  MomentumFactorResult,
  MomentumGateResult,
  MomentumTradePlanV1,
} from "./types.js";

const ENTER_BLOCKED: MomentumAction[] = ["ENTER"];
const ALL_NEW_RISK_ACTIONS: MomentumAction[] = ["ENTER", "WAIT"];

export function evaluateMomentumV1(input: MomentumEvaluationInput): MomentumEvaluationResultV1 {
  validateEvaluationIdentity(input);
  validatePointInTime(input);
  validateEvidenceLineage(input);
  assertDecimal(input.currentPrice, "currentPrice");
  if (compareDecimal(input.currentPrice, "0") <= 0) throw new Error("currentPrice must be positive");
  assertScore("executionRisk", input.executionRisk);
  assertScore("gapRiskScore", input.eventRisk.gapRiskScore);

  const universeDecision = evaluateMomentumUniverse(input.securityId, input.universe, input.universePolicy);
  const marketRegime = validateMarketRegimeEvaluation(input.marketRegime, input.evaluatedAt);
  const { factorResults, score, blocked: factorsBlocked } = evaluateMomentumFactors({
    factors: input.factors,
    setupDefinition: input.setupDefinition,
  });
  const confidence = calculateMomentumConfidence(input.confidence, marketRegime.regime !== "UNKNOWN");
  const setup = evaluateMomentumSetup({
    setupId: input.setupId,
    definition: input.setupDefinition,
    metrics: input.setupMetrics,
    detectedAt: input.detectedAt,
    triggerStatus: input.triggerStatus,
    invalidationConditions: input.invalidationConditions,
  });
  const catalystState = validateCatalyst(input);
  const tradePlan = input.tradePlan === undefined ? undefined : validateTradePlanForEvaluation(input, input.tradePlan);
  const pricePosition = tradePlan === undefined ? undefined : classifyMomentumPrice(tradePlan, input.currentPrice);
  const eventPolicyValid = validateEventRisk(input);
  const gateResults = buildGates({
    input, universeEligible: universeDecision.eligible, factorsBlocked, score: score.point,
    confidence: confidence.score, factorResults, setupStatus: setup.status, catalystValid: catalystState.valid,
    tradePlan, pricePosition, eventPolicyValid,
  });
  const action = decideAction({ input, gateResults, score: score.point, confidence: confidence.score, setupStatus: setup.status, pricePosition, tradePlan });
  const actionConstraints = buildActionConstraints(input, action, pricePosition);
  const operationalStateChangeAllowed = input.mode !== "HISTORICAL_REPLAY";
  const failedGates = gateResults.filter((gate) => gate.status === "FAILED" || gate.status === "REVIEW_REQUIRED").map((gate) => gate.reasonCode);
  const resultWithoutHash: Omit<MomentumEvaluationResultV1, "resultHash"> = {
    id: input.id,
    companyId: input.companyId,
    securityId: input.securityId,
    evaluatedAt: input.evaluatedAt,
    dataAsOf: input.dataAsOf,
    marketPriceAsOf: input.marketPriceAsOf,
    mode: input.mode,
    modelVersionId: input.modelVersionId,
    philosophyVersionId: input.philosophyVersionId,
    universePolicyVersionId: input.universePolicy.version,
    setupDefinitionVersion: input.setupDefinition.version,
    snapshotIds: [...input.snapshotIds],
    marketRegime,
    universeDecision,
    setup,
    score,
    factorResults,
    confidence,
    action,
    actionConstraints,
    gateResults,
    ...(tradePlan === undefined ? {} : { tradePlan }),
    executionRisk: input.executionRisk,
    gapRisk: input.eventRisk.gapRiskScore,
    riskScoreDirection: "HIGHER_IS_RISKIER",
    evidenceIds: [...input.evidenceIds],
    scoringEvidenceIds: [...input.scoringEvidenceIds],
    counterEvidenceIds: [...input.counterEvidenceIds],
    nextReviewAt: input.nextReviewAt,
    expiresAt: input.expiresAt,
    operationalStateChangeAllowed,
    explanation: {
      conclusion: `Momentum score ${score.point}, confidence ${confidence.score}; action is ${action}.`,
      strengths: factorResults.filter((factor) => (factor.score ?? 0) >= 75).map((factor) => factor.factorId),
      risks: [...failedGates, ...setup.warnings, ...catalystState.warnings],
      failedGates,
      nextChecks: buildNextChecks(action, failedGates, pricePosition),
    },
    momentumScore: score.point,
    relativeStrengthScore: factorScore(factorResults, "MOM_RELATIVE_STRENGTH"),
    volumeScore: factorScore(factorResults, "MOM_VOLUME_CONFIRMATION"),
    catalystScore: factorScore(factorResults, "MOM_CATALYST_QUALITY"),
    liquidityScore: factorScore(factorResults, "MOM_LIQUIDITY_EXECUTION"),
    setupQualityScore: factorScore(factorResults, "MOM_PRICE_STRUCTURE"),
    riskScore: input.executionRisk,
  };
  return { ...resultWithoutHash, resultHash: stableHash(resultWithoutHash) };
}

export function replayMomentumEvaluation(input: MomentumEvaluationInput): MomentumEvaluationResultV1 {
  return evaluateMomentumV1({ ...structuredClone(input), mode: "HISTORICAL_REPLAY" });
}

function validateEvaluationIdentity(input: MomentumEvaluationInput): void {
  for (const [name, value] of Object.entries({
    id: input.id, companyId: input.companyId, securityId: input.securityId, modelVersionId: input.modelVersionId,
    philosophyVersionId: input.philosophyVersionId, setupId: input.setupId,
  })) if (!value.trim()) throw new Error(`Momentum evaluation ${name} is required`);
  for (const [name, values] of Object.entries({
    snapshotIds: input.snapshotIds, evidenceIds: input.evidenceIds,
    scoringEvidenceIds: input.scoringEvidenceIds, counterEvidenceIds: input.counterEvidenceIds,
  })) {
    if (values.length === 0) throw new Error(`Momentum evaluation ${name} is required`);
    if (new Set(values).size !== values.length) throw new Error(`Momentum evaluation ${name} must be unique`);
  }
  if (input.invalidationConditions.length === 0) throw new Error("Momentum evaluation requires invalidation conditions");
  const evaluatedAt = parseDate(input.evaluatedAt, "evaluatedAt");
  const expiresAt = parseDate(input.expiresAt, "expiresAt");
  const nextReviewAt = parseDate(input.nextReviewAt, "nextReviewAt");
  if (expiresAt <= evaluatedAt) throw new Error("Momentum signal must expire after evaluation");
  if (nextReviewAt <= evaluatedAt) throw new Error("Momentum nextReviewAt must be after evaluation");
}

function validatePointInTime(input: MomentumEvaluationInput): void {
  const evaluatedAt = parseDate(input.evaluatedAt, "evaluatedAt");
  for (const [name, value] of Object.entries({
    dataAsOf: input.dataAsOf,
    marketPriceAsOf: input.marketPriceAsOf,
    detectedAt: input.detectedAt,
    universePolicyEffectiveFrom: input.universePolicy.effectiveFrom,
  })) if (parseDate(value, name) > evaluatedAt) throw new Error(`${name} cannot be newer than evaluatedAt`);
}

function validateEvidenceLineage(input: MomentumEvaluationInput): void {
  for (const id of input.scoringEvidenceIds) if (!input.evidenceIds.includes(id)) throw new Error(`scoring evidence ${id} is not linked to the evaluation`);
  for (const id of input.counterEvidenceIds) if (!input.evidenceIds.includes(id)) throw new Error(`counter evidence ${id} is not linked to the evaluation`);
  for (const [factorId, factor] of Object.entries(input.factors)) {
    if (!factor) continue;
    for (const id of factor.evidenceIds) if (!input.scoringEvidenceIds.includes(id)) throw new Error(`${factorId} evidence ${id} is not score eligible`);
    for (const id of factor.counterEvidenceIds ?? []) if (!input.counterEvidenceIds.includes(id)) throw new Error(`${factorId} counter evidence ${id} is not linked`);
  }
}

function validateCatalyst(input: MomentumEvaluationInput): { valid: boolean; warnings: string[] } {
  const catalystRequired = input.setupDefinition.type === "EARNINGS_MOMENTUM"
    || input.setupDefinition.type === "GAP_CONTINUATION"
    || input.setupDefinition.type === "SPECIAL_SITUATION";
  if (!input.catalyst) return { valid: !catalystRequired, warnings: catalystRequired ? ["CATALYST_MISSING"] : [] };
  if (input.catalyst.companyId !== input.companyId) throw new Error("catalyst companyId does not match evaluation");
  for (const id of input.catalyst.evidenceIds) if (!input.evidenceIds.includes(id)) throw new Error(`catalyst evidence ${id} is not linked`);
  for (const id of input.catalyst.counterEvidenceIds) if (!input.counterEvidenceIds.includes(id)) throw new Error(`catalyst counter evidence ${id} is not linked`);
  const freshness = calculateCatalystFreshness(input.catalyst, input.evaluatedAt);
  const officialEnough = input.catalyst.type === "TECHNICAL_ONLY" || input.catalyst.official;
  return {
    valid: freshness >= 0.25 && officialEnough,
    warnings: [...(freshness < 0.25 ? ["CATALYST_STALE"] : []), ...(!officialEnough ? ["CATALYST_NOT_OFFICIAL"] : [])],
  };
}

function validateTradePlanForEvaluation(input: MomentumEvaluationInput, plan: MomentumTradePlanV1): MomentumTradePlanV1 {
  const validated = validateMomentumTradePlanV1(plan);
  if (plan.companyId !== input.companyId || plan.securityId !== input.securityId || plan.evaluationId !== input.id || plan.setupId !== input.setupId) {
    throw new Error("trade plan identity does not match Momentum evaluation");
  }
  if (plan.setupType !== input.setupDefinition.type || plan.modelVersionId !== input.modelVersionId) throw new Error("trade plan model or setup version context does not match evaluation");
  if (input.marketRegime.regime === "UNKNOWN" || plan.marketRegime !== input.marketRegime.regime) throw new Error("trade plan market regime does not match evaluation");
  if (plan.eventPolicy !== input.eventRisk.policy) throw new Error("trade plan event policy does not match event risk assessment");
  if (parseDate(plan.generatedAt, "tradePlan.generatedAt") > parseDate(input.evaluatedAt, "evaluatedAt")) throw new Error("trade plan is future information");
  for (const id of plan.evidenceIds) if (!input.evidenceIds.includes(id)) throw new Error(`trade plan evidence ${id} is not linked`);
  for (const id of plan.counterEvidenceIds) if (!input.counterEvidenceIds.includes(id)) throw new Error(`trade plan counter evidence ${id} is not linked`);
  for (const id of plan.snapshotIds) if (!input.snapshotIds.includes(id)) throw new Error(`trade plan snapshot ${id} is not linked`);
  return validated;
}

function validateEventRisk(input: MomentumEvaluationInput): boolean {
  const event = input.eventRisk;
  if (event.gapScenario) {
    for (const [name, value] of Object.entries({
      baseStopLoss: event.gapScenario.baseStopLoss,
      adverseGapPrice: event.gapScenario.adverseGapPrice,
      scenarioLossPerUnit: event.gapScenario.scenarioLossPerUnit,
    })) {
      assertDecimal(value, `eventRisk.gapScenario.${name}`);
      if (compareDecimal(value, "0") <= 0) throw new Error(`eventRisk.gapScenario.${name} must be positive`);
    }
    if (!event.gapScenario.source.trim()) throw new Error("gap risk scenario source is required");
  }
  if (!event.calendarKnown || !event.officialScheduleConsistent) return false;
  if (event.binaryEvent && !event.gapScenario) return false;
  if (event.eventWithinPlanHorizon && event.policy === "NO_KNOWN_EVENT") return false;
  if ((event.policy === "HOLD_WITH_SCENARIO_APPROVAL" || event.policy === "EVENT_IS_SETUP") && !event.manualReviewApproved) return false;
  return true;
}

function buildGates(context: {
  input: MomentumEvaluationInput;
  universeEligible: boolean;
  factorsBlocked: boolean;
  score: number;
  confidence: number;
  factorResults: MomentumFactorResult[];
  setupStatus: "ELIGIBLE" | "CONDITIONAL" | "INELIGIBLE";
  catalystValid: boolean;
  tradePlan: MomentumTradePlanV1 | undefined;
  pricePosition: MomentumPricePosition | undefined;
  eventPolicyValid: boolean;
}): MomentumGateResult[] {
  const { input } = context;
  const regimeAllowed = input.marketRegime.permission === "ALLOW" || input.marketRegime.permission === "ALLOW_REDUCED";
  const regimeReview = input.marketRegime.permission === "REQUIRE_MANUAL_REVIEW";
  const factor = (id: MomentumFactorId): number => factorScore(context.factorResults, id);
  return [
    gate("POINT_IN_TIME_VALID", true, "HARD", "POINT_IN_TIME_VALID", "all inputs were available by evaluation time"),
    gate("UNIVERSE_ELIGIBLE", context.universeEligible, "HARD", context.universeEligible ? "UNIVERSE_ELIGIBLE" : "UNIVERSE_INELIGIBLE", "security must pass the versioned Universe policy"),
    gate("MARKET_DATA_FRESH", input.signalContext.marketDataFresh, "HARD", input.signalContext.marketDataFresh ? "MARKET_DATA_FRESH" : "MARKET_DATA_STALE", "market data must be fresh"),
    gate("CORPORATE_ACTIONS_APPLIED", input.signalContext.corporateActionsApplied && input.universe.corporateActionsApplied, "HARD", input.signalContext.corporateActionsApplied && input.universe.corporateActionsApplied ? "CORPORATE_ACTIONS_APPLIED" : "CORPORATE_ACTIONS_MISSING", "corporate actions must be applied"),
    regimeReview
      ? reviewGate("REGIME_PERMISSION", "REGIME_MANUAL_REVIEW", "Risk-off requires manual review")
      : gate("REGIME_PERMISSION", regimeAllowed, "HARD", regimeAllowed ? "REGIME_ALLOWED" : "REGIME_DENIED", "market regime must permit new risk"),
    gate("FACTOR_INPUT_COMPLETE", !context.factorsBlocked, "HARD", context.factorsBlocked ? "FACTOR_INPUT_BLOCKED" : "FACTOR_INPUT_COMPLETE", "critical factor data cannot be missing or stale"),
    gate("SCORE_ELIGIBLE", context.score >= 75 && context.confidence >= 70, "SOFT", context.score >= 75 && context.confidence >= 70 ? "SCORE_CONFIDENCE_ELIGIBLE" : "SCORE_OR_CONFIDENCE_BELOW_GATE", "score and confidence must meet entry thresholds"),
    gate("LIQUIDITY_SUFFICIENT", factor("MOM_LIQUIDITY_EXECUTION") >= 65, "HARD", factor("MOM_LIQUIDITY_EXECUTION") >= 65 ? "LIQUIDITY_SUFFICIENT" : "LIQUIDITY_INSUFFICIENT", "liquidity score must be at least 65"),
    gate("SETUP_VALID", context.setupStatus === "ELIGIBLE" && factor("MOM_PRICE_STRUCTURE") >= 70, "HARD", context.setupStatus === "ELIGIBLE" && factor("MOM_PRICE_STRUCTURE") >= 70 ? "SETUP_VALID" : "SETUP_INVALID_OR_CONDITIONAL", "setup and price structure must be eligible"),
    gate("CATALYST_VALID", context.catalystValid, "SOFT", context.catalystValid ? "CATALYST_VALID" : "CATALYST_INVALID", "required catalyst must be official and fresh"),
    gate("TRADE_PLAN_COMPLETE", context.tradePlan !== undefined, "HARD", context.tradePlan ? "TRADE_PLAN_COMPLETE" : "TRADE_PLAN_MISSING", "entry requires a complete immutable trade plan"),
    gate("REWARD_RISK_SUFFICIENT", factor("MOM_REWARD_RISK_TIMING") >= 65, "HARD", factor("MOM_REWARD_RISK_TIMING") >= 65 ? "REWARD_RISK_SUFFICIENT" : "REWARD_RISK_INSUFFICIENT", "reward/risk timing score must be at least 65"),
    gate("CHASE_LIMIT_VALID", context.pricePosition !== "CHASED", "HARD", context.pricePosition === "CHASED" ? "CHASE_LIMIT_EXCEEDED" : "CHASE_LIMIT_VALID", "current price cannot exceed chase limit"),
    gate("EVENT_POLICY_VALID", context.eventPolicyValid, "HARD", context.eventPolicyValid ? "EVENT_POLICY_VALID" : "EVENT_POLICY_INVALID", "event and gap risk require a complete policy"),
    gate("BEHAVIORAL_POLICY_CLEAR", input.signalContext.behavioralPolicyClear, "HARD", input.signalContext.behavioralPolicyClear ? "BEHAVIORAL_POLICY_CLEAR" : "BEHAVIORAL_POLICY_REVIEW", "behavioral policy must permit a new decision"),
    gate("SIGNAL_NOT_EXPIRED", parseDate(input.expiresAt, "expiresAt") > parseDate(input.evaluatedAt, "evaluatedAt"), "HARD", "SIGNAL_NOT_EXPIRED", "signal must be valid at evaluation time"),
  ];
}

function decideAction(context: {
  input: MomentumEvaluationInput;
  gateResults: MomentumGateResult[];
  score: number;
  confidence: number;
  setupStatus: "ELIGIBLE" | "CONDITIONAL" | "INELIGIBLE";
  pricePosition: MomentumPricePosition | undefined;
  tradePlan: MomentumTradePlanV1 | undefined;
}): MomentumAction {
  if (context.input.signalContext.activePosition && context.input.signalContext.stopOrInvalidationTriggered) return "EXIT";
  if (context.input.setupDefinition.type === "SPECIAL_SITUATION" && !context.input.eventRisk.manualReviewApproved) return "REVIEW_REQUIRED";
  if (context.input.marketRegime.permission === "REQUIRE_MANUAL_REVIEW" || !context.input.signalContext.behavioralPolicyClear) return "REVIEW_REQUIRED";
  const hardFailed = context.gateResults.some((gate) => gate.severity === "HARD" && gate.status === "FAILED");
  if (hardFailed || context.pricePosition === "CHASED" || context.setupStatus === "INELIGIBLE") return "AVOID";
  if (context.score < 65 || context.confidence < 50) return "AVOID";
  if (context.score < 75 || context.confidence < 70 || context.setupStatus !== "ELIGIBLE" || context.tradePlan === undefined) return "WAIT";
  if (context.pricePosition !== "IN_ENTRY_ZONE" || context.input.triggerStatus !== "TRIGGERED") return "WAIT";
  return "ENTER";
}

function buildActionConstraints(input: MomentumEvaluationInput, action: MomentumAction, pricePosition?: MomentumPricePosition): string[] {
  const constraints: string[] = [];
  if (input.marketRegime.permission === "ALLOW_REDUCED") constraints.push(`REGIME_RISK_MULTIPLIER_${input.marketRegime.riskMultiplier}`);
  if (action === "ENTER") constraints.push("PORTFOLIO_RISK_APPROVAL_REQUIRED", "HUMAN_APPROVAL_REQUIRED");
  if (pricePosition === "BELOW_ENTRY") constraints.push("WAIT_FOR_ENTRY_ZONE");
  if (pricePosition === "ABOVE_ENTRY_BELOW_CHASE") constraints.push("DO_NOT_CHASE_WAIT_FOR_RESET");
  if (pricePosition === "CHASED") constraints.push("CHASE_ENTRY_FORBIDDEN");
  if (input.mode === "HISTORICAL_REPLAY") constraints.push("OPERATIONAL_STATE_CHANGE_FORBIDDEN");
  return constraints;
}

function buildNextChecks(action: MomentumAction, failedGates: string[], pricePosition?: MomentumPricePosition): string[] {
  if (action === "ENTER") return ["portfolio capacity", "risk approval", "human approval", "price revalidation before order"];
  if (action === "EXIT") return ["execution liquidity", "gap-through-stop handling", "trade review scheduling"];
  return [...failedGates, ...(pricePosition === "BELOW_ENTRY" ? ["entry trigger"] : []), ...(pricePosition === "CHASED" ? ["new base or pullback"] : [])];
}

function gate(gateId: string, passed: boolean, severity: MomentumGateResult["severity"], reasonCode: string, explanation: string): MomentumGateResult {
  return {
    gateId,
    status: passed ? "PASSED" : "FAILED",
    severity,
    reasonCode,
    evidenceIds: [],
    blockedActions: passed ? [] : severity === "HARD" ? ALL_NEW_RISK_ACTIONS : ENTER_BLOCKED,
    explanation,
  };
}

function reviewGate(gateId: string, reasonCode: string, explanation: string): MomentumGateResult {
  return { gateId, status: "REVIEW_REQUIRED", severity: "HARD", reasonCode, evidenceIds: [], blockedActions: ENTER_BLOCKED, explanation };
}

function factorScore(results: MomentumFactorResult[], factorId: MomentumFactorId): number {
  return results.find((factor) => factor.factorId === factorId)?.score ?? 0;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}
