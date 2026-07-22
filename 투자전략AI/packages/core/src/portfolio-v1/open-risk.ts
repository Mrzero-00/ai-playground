import {
  assertDecimal,
  compareDecimal,
  maxDecimal,
  multiplyDecimal,
  subtractDecimal,
  type DecimalString,
} from "../decimal.js";
import type { PositionSnapshotV1 } from "./types.js";

export function calculatePositionOpenRisk(position: PositionSnapshotV1): DecimalString {
  if (position.strategy !== "MOMENTUM") return "0";
  if (position.stopPrice === undefined) throw new Error("Momentum position requires an active stop price");
  assertDecimal(position.stopPrice, "stopPrice");
  if (compareDecimal(position.stopPrice, "0") <= 0) throw new Error("Momentum stopPrice must be positive");
  const priceRiskAsset = compareDecimal(position.marketPrice, position.stopPrice) > 0
    ? subtractDecimal(position.marketPrice, position.stopPrice) : "0";
  assertDecimal(priceRiskAsset, "position price risk");
  const priceRiskBase = multiplyDecimal(priceRiskAsset, position.fxRateToBase);
  const scenarioRisk = position.gapScenarioLossPerUnitBase ?? "0";
  assertDecimal(scenarioRisk, "gapScenarioLossPerUnitBase");
  return multiplyDecimal(position.quantity, maxDecimal(priceRiskBase, scenarioRisk));
}
