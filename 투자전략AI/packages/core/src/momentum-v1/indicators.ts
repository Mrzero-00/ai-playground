import { assertDecimal, type DecimalString } from "../decimal.js";
import type { MomentumCatalyst } from "./types.js";

export type MomentumPriceBar = {
  session: string;
  open: DecimalString;
  high: DecimalString;
  low: DecimalString;
  close: DecimalString;
  volume: DecimalString;
  adjustmentFactor: DecimalString;
  adjusted: boolean;
};

export type RelativeStrengthComposite = {
  score: number;
  relativeReturns: { sessions20: number; sessions60: number; sessions120: number; sessions250: number };
  observations: number;
};

export function calculateAverageTrueRange(bars: MomentumPriceBar[], period = 14): number {
  if (!Number.isInteger(period) || period <= 0) throw new Error("ATR period must be a positive integer");
  if (bars.length < period + 1) throw new Error("ATR requires period + 1 bars");
  validateBars(bars);
  const trueRanges: number[] = [];
  for (let index = 1; index < bars.length; index++) {
    const current = bars[index]!;
    const previous = bars[index - 1]!;
    const high = decimalNumber(current.high);
    const low = decimalNumber(current.low);
    const previousClose = decimalNumber(previous.close);
    trueRanges.push(Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose)));
  }
  const selected = trueRanges.slice(-period);
  return round6(selected.reduce((sum, value) => sum + value, 0) / selected.length);
}

export function calculateRelativeStrengthComposite(
  securityCloses: DecimalString[],
  benchmarkCloses: DecimalString[],
): RelativeStrengthComposite {
  if (securityCloses.length !== benchmarkCloses.length) throw new Error("relative strength series must be aligned");
  if (securityCloses.length < 251) throw new Error("relative strength composite requires 251 sessions");
  securityCloses.forEach((value, index) => assertPositiveDecimal(value, `securityCloses[${index}]`));
  benchmarkCloses.forEach((value, index) => assertPositiveDecimal(value, `benchmarkCloses[${index}]`));
  const relativeReturns = {
    sessions20: excessReturn(securityCloses, benchmarkCloses, 20),
    sessions60: excessReturn(securityCloses, benchmarkCloses, 60),
    sessions120: excessReturn(securityCloses, benchmarkCloses, 120),
    sessions250: excessReturn(securityCloses, benchmarkCloses, 250),
  };
  const weightedExcess = relativeReturns.sessions20 * 0.15
    + relativeReturns.sessions60 * 0.25
    + relativeReturns.sessions120 * 0.3
    + relativeReturns.sessions250 * 0.3;
  return {
    score: round2(Math.max(0, Math.min(100, 50 + weightedExcess * 2))),
    relativeReturns,
    observations: securityCloses.length,
  };
}

export function calculateVolumeRatio(volumes: DecimalString[], lookback = 50): number {
  if (!Number.isInteger(lookback) || lookback <= 0) throw new Error("volume lookback must be a positive integer");
  if (volumes.length < lookback + 1) throw new Error("volume ratio requires lookback history plus the current session");
  volumes.forEach((value, index) => assertPositiveDecimal(value, `volumes[${index}]`));
  const current = decimalNumber(volumes[volumes.length - 1]!);
  const baseline = volumes.slice(-(lookback + 1), -1).reduce((sum, value) => sum + decimalNumber(value), 0) / lookback;
  if (baseline <= 0) throw new Error("volume baseline must be positive");
  return round2(current / baseline);
}

export function calculateCatalystFreshness(catalyst: MomentumCatalyst, evaluatedAt: string): number {
  if (!catalyst.id.trim() || !catalyst.companyId.trim() || !catalyst.summary.trim()) throw new Error("catalyst identity and summary are required");
  if (!Number.isFinite(catalyst.halfLifeHours) || catalyst.halfLifeHours <= 0) throw new Error("catalyst halfLifeHours must be positive");
  if (catalyst.evidenceIds.length === 0) throw new Error("catalyst requires evidence");
  const occurredAt = parseDate(catalyst.occurredAt, "catalyst.occurredAt");
  const availableAt = parseDate(catalyst.availableAt, "catalyst.availableAt");
  const evaluated = parseDate(evaluatedAt, "evaluatedAt");
  if (occurredAt > availableAt) throw new Error("catalyst cannot be available before it occurred");
  if (availableAt > evaluated) throw new Error("catalyst is future information for this evaluation");
  if (catalyst.type !== "TECHNICAL_ONLY" && catalyst.sourceTier !== "A" && catalyst.sourceTier !== "B" && catalyst.sourceTier !== "C") {
    throw new Error("fact-based catalyst requires source tier A-C");
  }
  const elapsedHours = (evaluated - availableAt) / 3_600_000;
  return round6(2 ** (-elapsedHours / catalyst.halfLifeHours));
}

function validateBars(bars: MomentumPriceBar[]): void {
  let previousSession = "";
  for (const [index, bar] of bars.entries()) {
    if (!Number.isFinite(new Date(bar.session).getTime())) throw new Error(`bars[${index}].session must be valid`);
    if (previousSession && bar.session <= previousSession) throw new Error("bars must be strictly ordered by session");
    previousSession = bar.session;
    for (const [name, value] of Object.entries({ open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume, adjustmentFactor: bar.adjustmentFactor })) {
      assertPositiveDecimal(value, `bars[${index}].${name}`);
    }
    if (decimalNumber(bar.low) > Math.min(decimalNumber(bar.open), decimalNumber(bar.close))
      || decimalNumber(bar.high) < Math.max(decimalNumber(bar.open), decimalNumber(bar.close))
      || decimalNumber(bar.low) > decimalNumber(bar.high)) {
      throw new Error(`bars[${index}] has an invalid OHLC relationship`);
    }
    if (!bar.adjusted || bar.adjustmentFactor === "0") throw new Error("ATR requires corporate-action-adjusted bars");
  }
}

function excessReturn(security: DecimalString[], benchmark: DecimalString[], sessions: number): number {
  const end = security.length - 1;
  const securityReturn = (decimalNumber(security[end]!) / decimalNumber(security[end - sessions]!) - 1) * 100;
  const benchmarkReturn = (decimalNumber(benchmark[end]!) / decimalNumber(benchmark[end - sessions]!) - 1) * 100;
  return round2(securityReturn - benchmarkReturn);
}

function assertPositiveDecimal(value: string, name: string): void {
  assertDecimal(value, name);
  if (decimalNumber(value) <= 0) throw new Error(`${name} must be positive`);
}

function decimalNumber(value: DecimalString): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("decimal is outside supported indicator range");
  return parsed;
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}

function round2(value: number): number { return Math.round(value * 100) / 100; }
function round6(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
