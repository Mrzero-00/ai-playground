import { assertCurrency, assertDecimal, assertSignedDecimal, compareDecimal } from "../decimal.js";
import type { ValuationResult, ValuationScenarioName } from "./types.js";

const REQUIRED_SCENARIOS: ValuationScenarioName[] = ["BEAR", "BASE", "BULL"];

export function validateLongTermValuation(value: ValuationResult, evaluatedAt?: string): ValuationResult {
  assertCurrency(value.currency);
  assertDecimal(value.marketPrice, "valuation.marketPrice");
  if (compareDecimal(value.marketPrice, "0") <= 0) throw new RangeError("valuation marketPrice must be positive");
  const marketPriceAsOf = parseDate(value.marketPriceAsOf, "valuation.marketPriceAsOf");
  if (evaluatedAt && marketPriceAsOf > parseDate(evaluatedAt, "evaluatedAt")) {
    throw new Error("valuation market price cannot be newer than evaluatedAt");
  }
  if (new Set(value.methods).size !== value.methods.length) throw new Error("valuation methods must be unique");
  if (value.methods.length < 2) throw new Error("long-term valuation requires at least two methods");
  if (value.methods.every((method) => method === "RELATIVE_MULTIPLE")) {
    throw new Error("relative multiple cannot be the only valuation method");
  }
  if (value.sensitivityDrivers.length === 0) throw new Error("valuation requires sensitivity drivers");
  if (new Set(value.sensitivityDrivers).size !== value.sensitivityDrivers.length) throw new Error("valuation sensitivity drivers must be unique");
  if (value.scenarios.length !== REQUIRED_SCENARIOS.length) throw new Error("valuation requires BEAR, BASE and BULL scenarios");
  if (new Set(value.scenarios.map((scenario) => scenario.name)).size !== value.scenarios.length) {
    throw new Error("valuation scenarios must be unique");
  }
  for (const required of REQUIRED_SCENARIOS) {
    if (!value.scenarios.some((scenario) => scenario.name === required)) throw new Error(`valuation scenario ${required} is required`);
  }
  const probabilityTotal = value.scenarios.reduce((sum, scenario) => sum + scenario.probability, 0);
  if (Math.abs(probabilityTotal - 1) > 0.000_001) throw new RangeError("valuation scenario probabilities must sum to 1");
  for (const scenario of value.scenarios) {
    if (!Number.isFinite(scenario.probability) || scenario.probability <= 0 || scenario.probability >= 1) {
      throw new RangeError(`${scenario.name} probability must be between 0 and 1`);
    }
    assertDecimal(scenario.enterpriseValue, `${scenario.name}.enterpriseValue`);
    assertDecimal(scenario.equityValue, `${scenario.name}.equityValue`);
    assertDecimal(scenario.valuePerShare, `${scenario.name}.valuePerShare`);
    if (scenario.expectedAnnualReturn5y !== undefined) assertSignedDecimal(scenario.expectedAnnualReturn5y, `${scenario.name}.expectedAnnualReturn5y`);
    if (scenario.expectedAnnualReturn10y !== undefined) assertSignedDecimal(scenario.expectedAnnualReturn10y, `${scenario.name}.expectedAnnualReturn10y`);
    if (scenario.evidenceIds.length === 0) throw new Error(`${scenario.name} scenario requires evidence`);
    if (new Set(scenario.evidenceIds).size !== scenario.evidenceIds.length) throw new Error(`${scenario.name} evidenceIds must be unique`);
  }
  const bear = value.scenarios.find((scenario) => scenario.name === "BEAR")!;
  const base = value.scenarios.find((scenario) => scenario.name === "BASE")!;
  const bull = value.scenarios.find((scenario) => scenario.name === "BULL")!;
  if (compareDecimal(bear.valuePerShare, base.valuePerShare) > 0 || compareDecimal(base.valuePerShare, bull.valuePerShare) > 0) {
    throw new Error("valuation scenarios must satisfy BEAR <= BASE <= BULL");
  }
  if (value.classification === "UNKNOWN" && value.expectedReturnPositive) {
    throw new Error("UNKNOWN valuation cannot claim a positive expected return");
  }
  return structuredClone(value);
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}
