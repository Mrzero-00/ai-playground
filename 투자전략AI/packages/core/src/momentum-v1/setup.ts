import type {
  MomentumSetupDefinition,
  MomentumSetupEvaluation,
  MomentumSetupMetrics,
  MomentumTriggerStatus,
} from "./types.js";

export function evaluateMomentumSetup(input: {
  setupId: string;
  definition: MomentumSetupDefinition;
  metrics: MomentumSetupMetrics;
  detectedAt: string;
  triggerStatus: MomentumTriggerStatus;
  invalidationConditions: string[];
}): MomentumSetupEvaluation {
  if (!input.setupId.trim()) throw new Error("setupId is required");
  if (!Number.isFinite(new Date(input.detectedAt).getTime())) throw new Error("detectedAt must be valid");
  if (input.invalidationConditions.length === 0) throw new Error("Momentum setup requires invalidation conditions");
  const reasonCodes = validateRules(input.definition.type, input.metrics);
  if (input.triggerStatus === "INVALIDATED") reasonCodes.push("SETUP_INVALIDATED");
  if (input.triggerStatus === "CHASED") reasonCodes.push("CHASE_LIMIT_EXCEEDED");
  const hardReasons = new Set([
    "BREAKOUT_BASE_TOO_SHORT", "BREAKOUT_BASE_TOO_DEEP", "BREAKOUT_NOT_CONFIRMED",
    "PULLBACK_TREND_MISSING", "PULLBACK_RANGE_INVALID", "EARNINGS_CATALYST_NOT_OFFICIAL",
    "EARNINGS_QUALITY_UNVERIFIED", "GAP_CATALYST_NOT_OFFICIAL", "GAP_TOO_SMALL",
    "SECTOR_RS_NOT_CONFIRMED", "SECTOR_BREADTH_NOT_CONFIRMED", "SPECIAL_TERMS_UNVERIFIED",
    "SPECIAL_BINARY_SCENARIO_MISSING", "SETUP_INVALIDATED",
  ]);
  const status = reasonCodes.some((reason) => hardReasons.has(reason)) ? "INELIGIBLE"
    : reasonCodes.length > 0 || input.triggerStatus !== "TRIGGERED" ? "CONDITIONAL" : "ELIGIBLE";
  return {
    setupId: input.setupId,
    setupType: input.definition.type,
    status,
    detectedAt: input.detectedAt,
    triggerStatus: input.triggerStatus,
    holdingHorizon: {
      minSessions: input.definition.defaultHoldingSessions.min,
      maxSessions: input.definition.defaultHoldingSessions.max,
    },
    invalidationConditions: [...input.invalidationConditions],
    reasonCodes,
    warnings: reasonCodes.filter((reason) => !hardReasons.has(reason)),
  };
}

function validateRules(type: MomentumSetupDefinition["type"], metrics: MomentumSetupMetrics): string[] {
  const reasons: string[] = [];
  switch (type) {
    case "BREAKOUT":
      if ((metrics.baseSessions ?? 0) < 20) reasons.push("BREAKOUT_BASE_TOO_SHORT");
      if ((metrics.baseDepthPercent ?? 100) > 35) reasons.push("BREAKOUT_BASE_TOO_DEEP");
      if (!metrics.resistanceBreakConfirmed) reasons.push("BREAKOUT_NOT_CONFIRMED");
      if ((metrics.breakoutVolumeRatio ?? 0) < 1.5) reasons.push("BREAKOUT_VOLUME_WEAK");
      if ((metrics.closeLocationPercent ?? 100) > 30) reasons.push("BREAKOUT_CLOSE_WEAK");
      if ((metrics.chaseDistanceAtr ?? Number.POSITIVE_INFINITY) > 1) reasons.push("BREAKOUT_EXTENDED");
      break;
    case "PULLBACK":
      if (!metrics.uptrend20And50) reasons.push("PULLBACK_TREND_MISSING");
      if ((metrics.pullbackSessions ?? 0) < 2 || (metrics.pullbackSessions ?? 99) > 10) reasons.push("PULLBACK_RANGE_INVALID");
      if ((metrics.pullbackDepthAtr ?? 0) < 0.5 || (metrics.pullbackDepthAtr ?? 99) > 2) reasons.push("PULLBACK_DEPTH_INVALID");
      if (!metrics.pullbackVolumeContracted) reasons.push("PULLBACK_VOLUME_NOT_CONTRACTED");
      if (!metrics.supportReactionConfirmed) reasons.push("PULLBACK_TRIGGER_UNCONFIRMED");
      break;
    case "EARNINGS_MOMENTUM":
      if (!metrics.officialEarningsCatalyst) reasons.push("EARNINGS_CATALYST_NOT_OFFICIAL");
      if (!metrics.earningsQualityVerified) reasons.push("EARNINGS_QUALITY_UNVERIFIED");
      if (!metrics.estimateRevisionConfirmed) reasons.push("ESTIMATE_REVISION_UNCONFIRMED");
      if (!metrics.gapHeld) reasons.push("EARNINGS_GAP_NOT_HELD");
      break;
    case "GAP_CONTINUATION":
      if (!metrics.officialEarningsCatalyst) reasons.push("GAP_CATALYST_NOT_OFFICIAL");
      if ((metrics.gapPercent ?? 0) < 2) reasons.push("GAP_TOO_SMALL");
      if (!metrics.openingRangeHeld) reasons.push("OPENING_RANGE_NOT_HELD");
      if ((metrics.gapSizeAtr ?? Number.POSITIVE_INFINITY) > 3) reasons.push("GAP_OVEREXTENDED");
      break;
    case "SECTOR_ROTATION":
      if (!metrics.sectorRelativeStrengthTurnedUp) reasons.push("SECTOR_RS_NOT_CONFIRMED");
      if (!metrics.sectorBreadthImproving) reasons.push("SECTOR_BREADTH_NOT_CONFIRMED");
      if (!metrics.multipleLeadersConfirmed) reasons.push("SECTOR_SINGLE_NAME_EFFECT");
      if (!metrics.candidateIsSectorLeader) reasons.push("CANDIDATE_NOT_SECTOR_LEADER");
      break;
    case "SPECIAL_SITUATION":
      if (!metrics.legalTermsVerified) reasons.push("SPECIAL_TERMS_UNVERIFIED");
      if (!metrics.binaryScenarioComplete) reasons.push("SPECIAL_BINARY_SCENARIO_MISSING");
      if (!metrics.manualReviewApproved) reasons.push("SPECIAL_MANUAL_REVIEW_REQUIRED");
      break;
  }
  return reasons;
}
