import {
  addSignedDecimal,
  assertCurrency,
  assertDecimal,
  assertSignedDecimal,
  compareDecimal,
  signedDecimalRatio,
  subtractDecimal,
} from "../decimal.js";
import { learningStableHash } from "./hash.js";
import type { OutcomeAttributionInputV1, OutcomeAttributionV1 } from "./types.js";

export function buildOutcomeAttributionV1(input: OutcomeAttributionInputV1): OutcomeAttributionV1 {
  if (!input.id.trim() || !input.reviewManifestId.trim()) throw new Error("Outcome attribution identity is required");
  assertCurrency(input.baseCurrency);
  for (const [name, value] of Object.entries({
    pricePnlBase: input.pricePnlBase,
    dividendPnlBase: input.dividendPnlBase,
    fxPnlBase: input.fxPnlBase,
    slippageBase: input.slippageBase,
  })) assertSignedDecimal(value, name);
  assertDecimal(input.feesBase, "feesBase");
  assertDecimal(input.taxesBase, "taxesBase");
  const grossPnlBase = addSignedDecimal(addSignedDecimal(input.pricePnlBase, input.dividendPnlBase), input.fxPnlBase);
  const totalDeductions = addSignedDecimal(subtractDecimal("0", input.feesBase), subtractDecimal("0", input.taxesBase));
  const netPnlBase = addSignedDecimal(grossPnlBase, totalDeductions);
  if (input.holdingSessions !== undefined && (!Number.isInteger(input.holdingSessions) || input.holdingSessions < 0)) {
    throw new Error("holdingSessions must be a non-negative integer");
  }
  validatePercent("maePercent", input.maePercent, true);
  validatePercent("mfePercent", input.mfePercent, false);
  let returnPercent: number | undefined;
  if (input.investedCapitalBase !== undefined) {
    assertDecimal(input.investedCapitalBase, "investedCapitalBase");
    if (compareDecimal(input.investedCapitalBase, "0") <= 0) throw new Error("investedCapitalBase must be positive");
    returnPercent = round(signedDecimalRatio(netPnlBase, input.investedCapitalBase) * 100);
  }
  let rMultiple: number | undefined;
  if (input.initialPlannedRiskBase !== undefined) {
    assertDecimal(input.initialPlannedRiskBase, "initialPlannedRiskBase");
    if (compareDecimal(input.initialPlannedRiskBase, "0") <= 0) throw new Error("initialPlannedRiskBase must be positive");
    rMultiple = round(signedDecimalRatio(netPnlBase, input.initialPlannedRiskBase));
  }
  const withoutHash: Omit<OutcomeAttributionV1, "resultHash"> = {
    ...structuredClone(input), grossPnlBase, netPnlBase,
    ...(returnPercent === undefined ? {} : { returnPercent }),
    ...(rMultiple === undefined ? {} : { rMultiple }),
  };
  return { ...withoutHash, resultHash: learningStableHash(withoutHash) };
}

function validatePercent(name: string, value: number | undefined, negative: boolean): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || negative && value > 0 || !negative && value < 0) {
    throw new Error(`${name} has an invalid direction or value`);
  }
}
function round(value: number): number { return Math.round(value * 1_000_000_000) / 1_000_000_000; }
