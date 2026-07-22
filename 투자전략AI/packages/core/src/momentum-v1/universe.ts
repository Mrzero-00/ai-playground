import { assertDecimal, compareDecimal } from "../decimal.js";
import { assertScore } from "../scoring.js";
import type {
  MarketRegimeEvaluation,
  MomentumUniverseInput,
  MomentumUniversePolicy,
  UniverseDecision,
} from "./types.js";

export const DEFAULT_US_MOMENTUM_UNIVERSE_POLICY: Readonly<MomentumUniversePolicy> = {
  id: "momentum-us-v1",
  version: "momentum-us-v1",
  market: "US",
  allowedSecurityTypes: ["COMMON_STOCK", "ADR", "ETF"],
  minimumPrice: "5",
  minimumMarketCap: "300000000",
  minimumAddv20: "10000000",
  maximumMedianSpreadBps: 50,
  minimumListingSessions: 120,
  excludedVenues: ["OTC"],
  excludedRiskFlags: ["PUMP_RISK", "REPEATED_REVERSE_SPLIT", "SETTLEMENT_RESTRICTED"],
  effectiveFrom: "2026-01-01T00:00:00Z",
};

export function evaluateMomentumUniverse(
  securityId: string,
  input: MomentumUniverseInput,
  policy: MomentumUniversePolicy,
): UniverseDecision {
  validateUniversePolicy(policy);
  if (!securityId.trim()) throw new Error("securityId is required for Universe evaluation");
  for (const [name, value] of Object.entries({ price: input.price, marketCap: input.marketCap, addv20: input.addv20 })) {
    assertDecimal(value, `universe.${name}`);
  }
  if (!Number.isFinite(input.medianSpreadBps) || input.medianSpreadBps < 0) throw new Error("medianSpreadBps must be non-negative");
  if (!Number.isInteger(input.listingSessions) || input.listingSessions < 0) throw new Error("listingSessions must be a non-negative integer");
  if (input.snapshotIds.length === 0) throw new Error("Universe decision requires snapshots");

  const reasonCodes: string[] = [];
  if (!policy.allowedSecurityTypes.includes(input.securityType)) reasonCodes.push("SECURITY_TYPE_NOT_ALLOWED");
  if (policy.excludedVenues.includes(input.venue)) reasonCodes.push("VENUE_EXCLUDED");
  if (input.securityType === "ETF" && input.leveragedOrInverseEtf) reasonCodes.push("LEVERAGED_OR_INVERSE_ETF");
  if (compareDecimal(input.price, policy.minimumPrice) < 0) reasonCodes.push("PRICE_BELOW_MINIMUM");
  if (compareDecimal(input.marketCap, policy.minimumMarketCap) < 0) reasonCodes.push("MARKET_CAP_BELOW_MINIMUM");
  if (compareDecimal(input.addv20, policy.minimumAddv20) < 0) reasonCodes.push("ADDV_BELOW_MINIMUM");
  if (input.medianSpreadBps > policy.maximumMedianSpreadBps) reasonCodes.push("SPREAD_ABOVE_MAXIMUM");
  if (input.listingSessions < policy.minimumListingSessions) reasonCodes.push("LISTING_HISTORY_INSUFFICIENT");
  if (input.riskFlags.some((flag) => policy.excludedRiskFlags.includes(flag))) reasonCodes.push("EXCLUDED_RISK_FLAG");
  if (input.halted) reasonCodes.push("SECURITY_HALTED");
  if (input.delistingProcess) reasonCodes.push("DELISTING_PROCESS");
  if (!input.identityResolved) reasonCodes.push("IDENTITY_UNRESOLVED");
  if (!input.quoteSourcesConsistent) reasonCodes.push("QUOTE_SOURCE_CONFLICT");
  if (!input.corporateActionsApplied) reasonCodes.push("CORPORATE_ACTION_NOT_APPLIED");

  const eligible = reasonCodes.length === 0;
  const addv = Number(input.addv20);
  const liquidityTier = !eligible ? "INELIGIBLE"
    : addv >= 100_000_000 && input.medianSpreadBps <= 15 ? "L1"
      : addv >= 30_000_000 && input.medianSpreadBps <= 30 ? "L2" : "L3";
  const maxParticipationRate = liquidityTier === "L1" ? 0.05 : liquidityTier === "L2" ? 0.03 : liquidityTier === "L3" ? 0.01 : undefined;
  return {
    securityId,
    eligible,
    reasonCodes,
    liquidityTier,
    ...(maxParticipationRate === undefined ? {} : { maxParticipationRate }),
    snapshotIds: [...input.snapshotIds],
    policyVersionId: policy.version,
  };
}

export function validateMarketRegimeEvaluation(value: MarketRegimeEvaluation, evaluatedAt: string): MarketRegimeEvaluation {
  assertScore("marketRegime.confidence", value.confidence);
  if (!Number.isFinite(value.riskMultiplier) || value.riskMultiplier < 0 || value.riskMultiplier > 1) {
    throw new Error("market regime riskMultiplier must be between 0 and 1");
  }
  if (value.snapshotIds.length === 0) throw new Error("market regime evaluation requires snapshots");
  const regimeTime = parseDate(value.evaluatedAt, "marketRegime.evaluatedAt");
  if (regimeTime > parseDate(evaluatedAt, "evaluatedAt")) throw new Error("market regime is future information");
  const expected = regimePolicy(value.regime);
  if (value.permission !== expected.permission || value.riskMultiplier !== expected.riskMultiplier) {
    throw new Error("market regime permission or multiplier conflicts with v1 policy");
  }
  return structuredClone(value);
}

export function regimePolicy(regime: MarketRegimeEvaluation["regime"]): Pick<MarketRegimeEvaluation, "permission" | "riskMultiplier"> {
  switch (regime) {
    case "RISK_ON_TREND": return { permission: "ALLOW", riskMultiplier: 1 };
    case "RISK_ON_VOLATILE": return { permission: "ALLOW_REDUCED", riskMultiplier: 0.6 };
    case "NEUTRAL_RANGE": return { permission: "ALLOW_REDUCED", riskMultiplier: 0.4 };
    case "RISK_OFF": return { permission: "REQUIRE_MANUAL_REVIEW", riskMultiplier: 0.2 };
    case "CRISIS":
    case "UNKNOWN": return { permission: "DENY_NEW_RISK", riskMultiplier: 0 };
  }
}

function validateUniversePolicy(policy: MomentumUniversePolicy): void {
  for (const [name, value] of Object.entries({ id: policy.id, version: policy.version, market: policy.market })) {
    if (!value.trim()) throw new Error(`Universe policy ${name} is required`);
  }
  for (const [name, value] of Object.entries({ minimumPrice: policy.minimumPrice, minimumMarketCap: policy.minimumMarketCap, minimumAddv20: policy.minimumAddv20 })) {
    assertDecimal(value, `Universe policy ${name}`);
    if (compareDecimal(value, "0") <= 0) throw new Error(`Universe policy ${name} must be positive`);
  }
  if (policy.allowedSecurityTypes.length === 0) throw new Error("Universe policy requires an allowed security type");
  if (!Number.isFinite(policy.maximumMedianSpreadBps) || policy.maximumMedianSpreadBps <= 0) throw new Error("maximumMedianSpreadBps must be positive");
  if (!Number.isInteger(policy.minimumListingSessions) || policy.minimumListingSessions <= 0) throw new Error("minimumListingSessions must be a positive integer");
  if (!Number.isFinite(new Date(policy.effectiveFrom).getTime())) throw new Error("Universe policy effectiveFrom must be valid");
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}
