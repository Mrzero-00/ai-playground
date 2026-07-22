import {
  addDecimal,
  assertCurrency,
  assertDecimal,
  compareDecimal,
  decimalRatio,
  multiplyDecimal,
  multiplyDecimalByRatio,
  subtractDecimalFloorZero,
  type DecimalString,
} from "../decimal.js";
import { calculatePositionOpenRisk } from "./open-risk.js";
import type {
  ExposureSnapshotV1,
  PortfolioLedgerV1,
  PortfolioSnapshotV1,
  PortfolioWeightsV1,
  PositionSnapshotV1,
} from "./types.js";

export function buildPortfolioLedger(snapshot: PortfolioSnapshotV1): PortfolioLedgerV1 {
  validatePortfolioSnapshot(snapshot);
  let investedValueBase: DecimalString = "0";
  let longTermPositionValueBase: DecimalString = "0";
  let momentumPositionValueBase: DecimalString = "0";
  let futureCorePositionValueBase: DecimalString = "0";
  let momentumOpenRiskBase: DecimalString = "0";
  const momentumOpenRiskBySector: Record<string, DecimalString> = {};
  const momentumOpenRiskByTheme: Record<string, DecimalString> = {};
  const exposures: ExposureSnapshotV1 = { company: {}, sector: {}, industry: {}, theme: {}, currency: {} };

  for (const position of snapshot.positions) {
    investedValueBase = addDecimal(investedValueBase, position.marketValueBase);
    addExposure(exposures.company, position.companyId, position.marketValueBase);
    addExposure(exposures.sector, position.sectorCode, position.marketValueBase);
    addExposure(exposures.industry, position.industryCode, position.marketValueBase);
    addExposure(exposures.currency, position.assetCurrency, position.marketValueBase);
    for (const tag of position.exposureTags) {
      const lookThrough = multiplyDecimalByRatio(
        multiplyDecimalByRatio(position.marketValueBase, tag.sensitivity),
        tag.confidence,
      );
      addExposure(exposures.theme, tag.key, lookThrough);
    }
    if (position.strategy === "MOMENTUM") {
      momentumPositionValueBase = addDecimal(momentumPositionValueBase, position.marketValueBase);
      const positionOpenRisk = calculatePositionOpenRisk(position);
      momentumOpenRiskBase = addDecimal(momentumOpenRiskBase, positionOpenRisk);
      addExposure(momentumOpenRiskBySector, position.sectorCode, positionOpenRisk);
      for (const tag of position.exposureTags.filter((item) => item.dimension === "THEME")) {
        const lookThroughRisk = multiplyDecimalByRatio(multiplyDecimalByRatio(positionOpenRisk, tag.sensitivity), tag.confidence);
        addExposure(momentumOpenRiskByTheme, tag.key, lookThroughRisk);
      }
    } else {
      longTermPositionValueBase = addDecimal(longTermPositionValueBase, position.marketValueBase);
      if (position.strategy === "FUTURE_CORE") futureCorePositionValueBase = addDecimal(futureCorePositionValueBase, position.marketValueBase);
    }
  }

  let totalCashBase: DecimalString = "0";
  let availableLongTermCashBase: DecimalString = "0";
  let availableMomentumCashBase: DecimalString = "0";
  let availableCommonReserveBase: DecimalString = "0";
  let longTermCashBase: DecimalString = "0";
  let momentumCashBase: DecimalString = "0";
  let commonReserveBase: DecimalString = "0";
  for (const cash of snapshot.cashBalances) {
    totalCashBase = addDecimal(totalCashBase, cash.amountBase);
    if (cash.owner === "LONG_TERM") {
      longTermCashBase = addDecimal(longTermCashBase, cash.amountBase);
      if (cash.available) availableLongTermCashBase = addDecimal(availableLongTermCashBase, cash.amountBase);
    } else if (cash.owner === "MOMENTUM") {
      momentumCashBase = addDecimal(momentumCashBase, cash.amountBase);
      if (cash.available) availableMomentumCashBase = addDecimal(availableMomentumCashBase, cash.amountBase);
    } else {
      commonReserveBase = addDecimal(commonReserveBase, cash.amountBase);
      if (cash.available) availableCommonReserveBase = addDecimal(availableCommonReserveBase, cash.amountBase);
    }
  }
  const grossAssetValueBase = addDecimal(investedValueBase, totalCashBase);
  const nonInvestable = addDecimal(snapshot.liabilitiesBase, snapshot.reservedCashBase);
  if (compareDecimal(grossAssetValueBase, nonInvestable) <= 0) throw new Error("Portfolio investable NAV must be positive after liabilities and reserves");
  const investableNavBase = subtractDecimalFloorZero(grossAssetValueBase, nonInvestable);
  const weights = calculateWeights({
    nav: investableNavBase,
    invested: investedValueBase,
    cash: totalCashBase,
    longTerm: addDecimal(longTermPositionValueBase, longTermCashBase),
    momentum: addDecimal(momentumPositionValueBase, momentumCashBase),
    futureCore: futureCorePositionValueBase,
    commonReserve: commonReserveBase,
  });
  return {
    portfolioSnapshotId: snapshot.id,
    portfolioId: snapshot.portfolioId,
    baseCurrency: snapshot.baseCurrency,
    asOf: snapshot.asOf,
    grossAssetValueBase,
    investableNavBase,
    investedValueBase,
    totalCashBase,
    availableLongTermCashBase,
    availableMomentumCashBase,
    availableCommonReserveBase,
    longTermPositionValueBase,
    momentumPositionValueBase,
    futureCorePositionValueBase,
    momentumOpenRiskBase,
    momentumOpenRiskBySector,
    momentumOpenRiskByTheme,
    weights,
    exposures,
    warnings: [...snapshot.anomalyFlags],
  };
}

export function validatePortfolioSnapshot(snapshot: PortfolioSnapshotV1): PortfolioSnapshotV1 {
  for (const [name, value] of Object.entries({
    id: snapshot.id, portfolioId: snapshot.portfolioId, userId: snapshot.userId,
    fxSnapshotId: snapshot.fxSnapshotId,
  })) if (!value.trim()) throw new Error(`Portfolio snapshot ${name} is required`);
  assertCurrency(snapshot.baseCurrency);
  if (!Number.isFinite(new Date(snapshot.asOf).getTime())) throw new Error("Portfolio snapshot asOf must be valid");
  if (!snapshot.complete || snapshot.anomalyFlags.some((flag) => flag.startsWith("CRITICAL:"))) {
    throw new Error("Portfolio snapshot is incomplete or has critical anomalies");
  }
  if (snapshot.marketSnapshotIds.length === 0) throw new Error("Portfolio snapshot requires market snapshots");
  assertDecimal(snapshot.liabilitiesBase, "liabilitiesBase");
  assertDecimal(snapshot.reservedCashBase, "reservedCashBase");
  validateUnique(snapshot.positions.map((item) => item.lotId), "position lot ids");
  validateUnique(snapshot.cashBalances.map((item) => item.id), "cash balance ids");
  for (const position of snapshot.positions) validatePosition(position, snapshot.baseCurrency);
  for (const cash of snapshot.cashBalances) {
    if (!cash.id.trim()) throw new Error("cash balance id is required");
    assertCurrency(cash.currency);
    for (const [name, value] of Object.entries({ amount: cash.amount, fxRateToBase: cash.fxRateToBase, amountBase: cash.amountBase })) {
      assertDecimal(value, `cash.${name}`);
    }
    if (compareDecimal(cash.fxRateToBase, "0") <= 0) throw new Error("cash fxRateToBase must be positive");
    if (multiplyDecimal(cash.amount, cash.fxRateToBase) !== cash.amountBase) throw new Error("cash amountBase does not match amount × FX rate");
    if (cash.settlementDate !== undefined && !Number.isFinite(new Date(cash.settlementDate).getTime())) throw new Error("cash settlementDate must be valid");
  }
  return structuredClone(snapshot);
}

function validatePosition(position: PositionSnapshotV1, baseCurrency: string): void {
  for (const [name, value] of Object.entries({
    lotId: position.lotId, companyId: position.companyId, securityId: position.securityId,
    sectorCode: position.sectorCode, industryCode: position.industryCode,
  })) if (!value.trim()) throw new Error(`position ${name} is required`);
  assertCurrency(position.assetCurrency);
  for (const [name, value] of Object.entries({
    quantity: position.quantity, marketPrice: position.marketPrice, fxRateToBase: position.fxRateToBase,
    marketValueBase: position.marketValueBase, costBasisBase: position.costBasisBase,
  })) {
    assertDecimal(value, `position.${name}`);
    if (compareDecimal(value, "0") <= 0) throw new Error(`position ${name} must be positive`);
  }
  if (position.assetCurrency === baseCurrency && position.fxRateToBase !== "1") throw new Error("base-currency position FX rate must be 1");
  const expectedValue = multiplyDecimal(multiplyDecimal(position.quantity, position.marketPrice), position.fxRateToBase);
  if (expectedValue !== position.marketValueBase) throw new Error("position marketValueBase does not match quantity × price × FX rate");
  if (position.liquidityTier === "INELIGIBLE") throw new Error("open position cannot have INELIGIBLE liquidity without review");
  for (const tag of position.exposureTags) {
    if (!tag.key.trim() || tag.evidenceIds.length === 0) throw new Error("economic exposure requires key and evidence");
    for (const [name, value] of Object.entries({ sensitivity: tag.sensitivity, confidence: tag.confidence })) {
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`economic exposure ${name} must be between 0 and 1`);
    }
  }
}

function calculateWeights(input: Record<"nav" | "invested" | "cash" | "longTerm" | "momentum" | "futureCore" | "commonReserve", DecimalString>): PortfolioWeightsV1 {
  return {
    longTerm: decimalRatio(input.longTerm, input.nav),
    momentum: decimalRatio(input.momentum, input.nav),
    futureCore: decimalRatio(input.futureCore, input.nav),
    commonReserve: decimalRatio(input.commonReserve, input.nav),
    invested: decimalRatio(input.invested, input.nav),
    cash: decimalRatio(input.cash, input.nav),
  };
}

function addExposure(target: Record<string, DecimalString>, key: string, amount: DecimalString): void {
  target[key] = addDecimal(target[key] ?? "0", amount);
}

function validateUnique(values: string[], name: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${name} must be unique`);
}
