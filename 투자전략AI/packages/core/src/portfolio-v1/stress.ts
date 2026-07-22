import { createHash } from "node:crypto";
import {
  addDecimal,
  assertDecimal,
  compareDecimal,
  decimalRatio,
  multiplyDecimal,
  multiplyDecimalByRatio,
  subtractDecimalFloorZero,
  type DecimalString,
  type SignedDecimalString,
} from "../decimal.js";
import { buildPortfolioLedger } from "./ledger.js";
import type { PortfolioSnapshotV1, PortfolioStressResultV1, PortfolioStressScenarioV1, StressContributionV1 } from "./types.js";

export function runPortfolioStressTestV1(input: {
  id: string;
  snapshot: PortfolioSnapshotV1;
  scenario: PortfolioStressScenarioV1;
  evaluatedAt: string;
}): PortfolioStressResultV1 {
  if (!input.id.trim() || !input.scenario.id.trim() || !input.scenario.version.trim() || !input.scenario.name.trim()) {
    throw new Error("stress test identity, version and name are required");
  }
  const evaluatedAt = parseDate(input.evaluatedAt, "evaluatedAt");
  if (parseDate(input.snapshot.asOf, "snapshot.asOf") > evaluatedAt) throw new Error("stress snapshot is future information");
  validateShock("marketShockPercent", input.scenario.marketShockPercent);
  for (const [key, value] of Object.entries(input.scenario.sectorShocks)) validateShock(`sectorShocks.${key}`, value);
  for (const [key, value] of Object.entries(input.scenario.themeShocks)) validateShock(`themeShocks.${key}`, value);
  for (const [key, value] of Object.entries(input.scenario.currencyShocks)) validateShock(`currencyShocks.${key}`, value);
  if (!Number.isFinite(input.scenario.liquidityHaircut) || input.scenario.liquidityHaircut < 0 || input.scenario.liquidityHaircut > 1) throw new Error("liquidityHaircut must be between 0 and 1");
  if (!Number.isFinite(input.scenario.momentumGapMultiplier) || input.scenario.momentumGapMultiplier < 1) throw new Error("momentumGapMultiplier must be at least 1");
  if (input.scenario.assumptions.length === 0) throw new Error("stress scenario requires assumptions");
  const ledger = buildPortfolioLedger(input.snapshot);
  const contributions: StressContributionV1[] = [];
  let totalLoss: DecimalString = "0";
  const bucketLossesUnsigned: Record<string, DecimalString> = { LONG_TERM: "0", MOMENTUM: "0" };
  for (const position of input.snapshot.positions) {
    const shocks = [
      input.scenario.marketShockPercent,
      input.scenario.sectorShocks[position.sectorCode] ?? 0,
      input.scenario.currencyShocks[position.assetCurrency] ?? 0,
      ...position.exposureTags.map((tag) => (input.scenario.themeShocks[tag.key] ?? 0) * tag.sensitivity * tag.confidence),
    ];
    let combinedShock = shocks.reduce((sum, shock) => sum + shock, 0);
    combinedShock = Math.max(-1, Math.min(0, combinedShock));
    let loss = multiplyDecimalByRatio(position.marketValueBase, Math.abs(combinedShock));
    if (position.strategy === "MOMENTUM" && position.gapScenarioLossPerUnitBase) {
      const multiplier = input.scenario.momentumGapMultiplier.toString();
      assertDecimal(multiplier, "momentumGapMultiplier");
      const gapLoss = multiplyDecimal(
        multiplyDecimal(position.gapScenarioLossPerUnitBase, position.quantity),
        multiplier,
      );
      if (compareDecimal(gapLoss, loss) > 0) loss = gapLoss;
    }
    totalLoss = addDecimal(totalLoss, loss);
    const bucket = position.strategy === "MOMENTUM" ? "MOMENTUM" : "LONG_TERM";
    bucketLossesUnsigned[bucket] = addDecimal(bucketLossesUnsigned[bucket]!, loss);
    contributions.push({ lotId: position.lotId, companyId: position.companyId, estimatedLossBase: loss });
  }
  contributions.sort((left, right) => compareDecimal(right.estimatedLossBase, left.estimatedLossBase) || left.lotId.localeCompare(right.lotId));
  const signedLoss = totalLoss === "0" ? "0" : `-${totalLoss}`;
  const bucketLosses: Record<string, SignedDecimalString> = Object.fromEntries(
    Object.entries(bucketLossesUnsigned).map(([key, value]) => [key, value === "0" ? "0" : `-${value}`]),
  );
  const cashAfterStressBase = subtractDecimalFloorZero(ledger.totalCashBase, multiplyDecimalByRatio(ledger.totalCashBase, input.scenario.liquidityHaircut));
  const breachedLimitIds: string[] = [];
  const lossPercent = decimalRatio(totalLoss, ledger.investableNavBase) * 100;
  if (lossPercent >= 20) breachedLimitIds.push("STRESS_LOSS_20_PERCENT");
  if (compareDecimal(cashAfterStressBase, input.snapshot.reservedCashBase) < 0) breachedLimitIds.push("STRESS_CASH_RESERVE");
  const withoutHash: Omit<PortfolioStressResultV1, "resultHash"> = {
    id: input.id,
    portfolioSnapshotId: input.snapshot.id,
    scenarioId: input.scenario.id,
    scenarioVersion: input.scenario.version,
    evaluatedAt: input.evaluatedAt,
    estimatedLossBase: signedLoss,
    estimatedLossPercent: round2(lossPercent),
    bucketLosses,
    topContributors: contributions.slice(0, 5),
    breachedLimitIds,
    cashAfterStressBase,
    forcedSaleRisk: breachedLimitIds.length > 0 || input.scenario.liquidityHaircut >= 0.5,
  };
  return { ...withoutHash, resultHash: stableHash(withoutHash) };
}

function validateShock(name: string, value: number): void {
  if (!Number.isFinite(value) || value < -1 || value > 0) throw new Error(`${name} must be between -1 and 0`);
}

function stableHash(value: unknown): string { return createHash("sha256").update(stableStringify(value)).digest("hex"); }
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
function round2(value: number): number { return Math.round(value * 100) / 100; }
