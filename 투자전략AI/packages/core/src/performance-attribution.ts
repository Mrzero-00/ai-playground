import {
  addDecimal,
  addSignedDecimal,
  assertCurrency,
  assertDecimal,
  assertSignedDecimal,
  subtractDecimal,
  type CurrencyCode,
  type DecimalString,
  type SignedDecimalString,
} from "./decimal.js";
import type { LotStrategy } from "./position-lot.js";

export type PerformanceRecord = {
  id: string;
  lotId: string;
  companyId: string;
  strategy: LotStrategy;
  currency: CurrencyCode;
  realizedPnl: SignedDecimalString;
  fees: DecimalString;
  fxPnl: SignedDecimalString;
  measuredAt: string;
  decisionId: string;
  modelVersionIds: string[];
};

export type StrategyPerformanceAttribution = {
  strategy: LotStrategy;
  currency: CurrencyCode;
  grossPnl: SignedDecimalString;
  fees: DecimalString;
  fxPnl: SignedDecimalString;
  netPnl: SignedDecimalString;
  recordIds: string[];
};

export function attributePerformance(records: PerformanceRecord[]): StrategyPerformanceAttribution[] {
  const seen = new Set<string>();
  const totals = new Map<string, StrategyPerformanceAttribution>();
  for (const record of records) {
    if (!record.id.trim() || !record.lotId.trim() || !record.companyId.trim() || !record.decisionId.trim()) {
      throw new Error("performance records require identity and decision lineage");
    }
    if (seen.has(record.id)) throw new Error(`duplicate performance record ${record.id}`);
    seen.add(record.id);
    assertCurrency(record.currency);
    assertSignedDecimal(record.realizedPnl, "realizedPnl");
    assertSignedDecimal(record.fxPnl, "fxPnl");
    assertDecimal(record.fees, "fees");
    if (!Number.isFinite(new Date(record.measuredAt).getTime())) throw new Error("measuredAt must be a valid date");
    if (record.modelVersionIds.length === 0) throw new Error("performance records require model versions");
    const key = `${record.strategy}:${record.currency}`;
    const current = totals.get(key) ?? {
      strategy: record.strategy,
      currency: record.currency,
      grossPnl: "0",
      fees: "0",
      fxPnl: "0",
      netPnl: "0",
      recordIds: [],
    };
    const grossPnl = addSignedDecimal(current.grossPnl, record.realizedPnl);
    const fees = addDecimal(current.fees, record.fees);
    const fxPnl = addSignedDecimal(current.fxPnl, record.fxPnl);
    const netBeforeFees = addSignedDecimal(grossPnl, fxPnl);
    totals.set(key, {
      ...current,
      grossPnl,
      fees,
      fxPnl,
      netPnl: addSignedDecimal(netBeforeFees, subtractDecimal("0", fees)),
      recordIds: [...current.recordIds, record.id],
    });
  }
  return [...totals.values()]
    .sort((left, right) => `${left.strategy}:${left.currency}`.localeCompare(`${right.strategy}:${right.currency}`))
    .map((value) => structuredClone(value));
}
