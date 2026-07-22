export type LotStrategy = "CORE" | "FUTURE_CORE" | "MOMENTUM";
export type ExitPolicy = "THESIS_BREAK" | "VALUATION" | "STOP_LOSS" | "TARGET" | "TIME_STOP";

export type PositionLot = {
  id: string;
  portfolioId: string;
  companyId: string;
  strategy: LotStrategy;
  openedAt: string;
  averagePrice: DecimalString;
  quantity: DecimalString;
  currency: CurrencyCode;
  thesisId?: string;
  momentumSetupId?: string;
  exitPolicy: ExitPolicy;
  status: "OPEN" | "PARTIALLY_CLOSED" | "CLOSED";
};

export function validatePositionLot(lot: PositionLot): PositionLot {
  assertDecimal(lot.averagePrice, "averagePrice");
  assertDecimal(lot.quantity, "quantity");
  assertCurrency(lot.currency);
  if (compareDecimal(lot.averagePrice, "0") <= 0 || compareDecimal(lot.quantity, "0") <= 0) throw new RangeError("price and quantity must be positive");
  if (lot.strategy === "MOMENTUM") {
    if (!lot.momentumSetupId) throw new Error("Momentum Lot requires momentumSetupId");
    if (!(["STOP_LOSS", "TARGET", "TIME_STOP"] as ExitPolicy[]).includes(lot.exitPolicy)) {
      throw new Error("Momentum Lot requires a tactical exit policy");
    }
  } else if (!lot.thesisId) {
    throw new Error("Long-term Lot requires thesisId");
  }
  return lot;
}
import { assertCurrency, assertDecimal, compareDecimal, type CurrencyCode, type DecimalString } from "./decimal.js";
