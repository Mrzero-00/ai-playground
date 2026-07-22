import { assertCurrency, assertDecimal, compareDecimal } from "../decimal.js";
import type { AllocationLimit, DrawdownState, PortfolioPolicyV1 } from "./types.js";

export const DEFAULT_PORTFOLIO_POLICY_V1: Readonly<PortfolioPolicyV1> = {
  id: "portfolio-policy-v1",
  version: "portfolio-v1",
  baseCurrency: "USD",
  status: "ACTIVE",
  effectiveFrom: "2026-01-01T00:00:00Z",
  longTerm: { target: 0.85, softMin: 0.8, softMax: 0.9, hardMax: 0.9 },
  momentum: { target: 0.15, softMin: 0.1, softMax: 0.2, hardMax: 0.2 },
  futureCore: { target: 0.15, softMin: 0.05, softMax: 0.18, hardMax: 0.2 },
  commonReserveTarget: 0,
  corePositionHardMax: 0.1,
  futureCorePositionHardMax: 0.06,
  companyGrossHardMax: 0.1,
  sectorGrossHardMax: 0.3,
  industryGrossHardMax: 0.2,
  themeGrossHardMax: 0.25,
  momentumBaseRiskPerTrade: 0.005,
  momentumMaxRiskPerTrade: 0.0075,
  momentumOpenRiskHardMax: 0.02,
  momentumSectorOpenRiskHardMax: 0.0075,
  momentumThemeOpenRiskHardMax: 0.01,
  liquidityParticipationByTier: { L1: 0.05, L2: 0.03, L3: 0.01, INELIGIBLE: 0 },
  minimumEconomicAmountBase: "25",
  proposalTtlMinutes: 15,
  leverageAllowed: false,
};

export function validatePortfolioPolicyV1(policy: PortfolioPolicyV1): PortfolioPolicyV1 {
  for (const [name, value] of Object.entries({ id: policy.id, version: policy.version })) {
    if (!value.trim()) throw new Error(`Portfolio policy ${name} is required`);
  }
  assertCurrency(policy.baseCurrency);
  if (policy.status !== "ACTIVE") throw new Error("Portfolio policy must be ACTIVE");
  if (!Number.isFinite(new Date(policy.effectiveFrom).getTime())) throw new Error("Portfolio policy effectiveFrom must be valid");
  validateLimit("longTerm", policy.longTerm);
  validateLimit("momentum", policy.momentum);
  validateLimit("futureCore", policy.futureCore);
  for (const [name, value] of Object.entries({
    commonReserveTarget: policy.commonReserveTarget,
    corePositionHardMax: policy.corePositionHardMax,
    futureCorePositionHardMax: policy.futureCorePositionHardMax,
    companyGrossHardMax: policy.companyGrossHardMax,
    sectorGrossHardMax: policy.sectorGrossHardMax,
    industryGrossHardMax: policy.industryGrossHardMax,
    themeGrossHardMax: policy.themeGrossHardMax,
    momentumBaseRiskPerTrade: policy.momentumBaseRiskPerTrade,
    momentumMaxRiskPerTrade: policy.momentumMaxRiskPerTrade,
    momentumOpenRiskHardMax: policy.momentumOpenRiskHardMax,
    momentumSectorOpenRiskHardMax: policy.momentumSectorOpenRiskHardMax,
    momentumThemeOpenRiskHardMax: policy.momentumThemeOpenRiskHardMax,
  })) validateRatio(name, value, name === "commonReserveTarget");
  for (const [tier, rate] of Object.entries(policy.liquidityParticipationByTier)) validateRatio(`liquidityParticipationByTier.${tier}`, rate, true);
  if (Math.abs(policy.longTerm.target + policy.momentum.target + policy.commonReserveTarget - 1) > 0.000001) {
    throw new Error("Portfolio targets plus common reserve must sum to 1");
  }
  if (policy.longTerm.hardMax + policy.momentum.hardMax + policy.commonReserveTarget > 1.100001) {
    throw new Error("Portfolio hard maxima and reserve allow excessive overlapping capacity");
  }
  if (policy.futureCore.hardMax > policy.longTerm.hardMax) throw new Error("Future Core hard max cannot exceed Long-term hard max");
  if (policy.futureCorePositionHardMax > policy.companyGrossHardMax) throw new Error("Future Core position max cannot exceed company gross max");
  if (policy.corePositionHardMax > policy.companyGrossHardMax) throw new Error("Core position max cannot exceed company gross max");
  if (policy.momentumBaseRiskPerTrade > policy.momentumMaxRiskPerTrade
    || policy.momentumMaxRiskPerTrade > policy.momentumOpenRiskHardMax) {
    throw new Error("Momentum risk limits must be ordered base <= max trade <= open risk");
  }
  assertDecimal(policy.minimumEconomicAmountBase, "minimumEconomicAmountBase");
  if (compareDecimal(policy.minimumEconomicAmountBase, "0") <= 0) throw new Error("minimumEconomicAmountBase must be positive");
  if (!Number.isInteger(policy.proposalTtlMinutes) || policy.proposalTtlMinutes <= 0) throw new Error("proposalTtlMinutes must be a positive integer");
  if (policy.leverageAllowed !== false) throw new Error("Portfolio v1 forbids leverage");
  return structuredClone(policy);
}

export function momentumDrawdownMultiplier(drawdownPercent: number): { state: DrawdownState; multiplier: number } {
  if (!Number.isFinite(drawdownPercent) || drawdownPercent < 0) throw new Error("drawdownPercent must be non-negative");
  if (drawdownPercent >= 10) return { state: "REVIEW_REQUIRED", multiplier: 0 };
  if (drawdownPercent >= 8) return { state: "PAUSE", multiplier: 0 };
  if (drawdownPercent >= 5) return { state: "REDUCED_RISK", multiplier: 0.5 };
  if (drawdownPercent >= 3) return { state: "CAUTION", multiplier: 0.75 };
  return { state: "NORMAL", multiplier: 1 };
}

function validateLimit(name: string, limit: AllocationLimit): void {
  for (const [key, value] of Object.entries(limit)) validateRatio(`${name}.${key}`, value, key === "softMin");
  if (!(limit.softMin <= limit.target && limit.target <= limit.softMax && limit.softMax <= limit.hardMax)) {
    throw new Error(`${name} limit must satisfy softMin <= target <= softMax <= hardMax`);
  }
}

function validateRatio(name: string, value: number, zeroAllowed: boolean): void {
  if (!Number.isFinite(value) || value < (zeroAllowed ? 0 : Number.EPSILON) || value > 1) {
    throw new RangeError(`${name} must be ${zeroAllowed ? "between 0 and 1" : "greater than 0 and at most 1"}`);
  }
}
