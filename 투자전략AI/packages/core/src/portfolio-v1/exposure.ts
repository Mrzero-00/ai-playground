import { addDecimal, decimalRatio, type DecimalString } from "../decimal.js";
import type { ExposureChangeV1, PortfolioLedgerV1 } from "./types.js";

export function projectExposureChanges(input: {
  ledger: PortfolioLedgerV1;
  companyId: string;
  sectorCode: string;
  industryCode: string;
  themeKeys: string[];
  additionalAmountBase: DecimalString;
}): ExposureChangeV1[] {
  const changes: ExposureChangeV1[] = [];
  addChange(changes, input.ledger, "COMPANY", input.companyId, input.ledger.exposures.company[input.companyId] ?? "0", input.additionalAmountBase);
  addChange(changes, input.ledger, "SECTOR", input.sectorCode, input.ledger.exposures.sector[input.sectorCode] ?? "0", input.additionalAmountBase);
  addChange(changes, input.ledger, "INDUSTRY", input.industryCode, input.ledger.exposures.industry[input.industryCode] ?? "0", input.additionalAmountBase);
  for (const theme of [...new Set(input.themeKeys)].sort()) {
    addChange(changes, input.ledger, "THEME", theme, input.ledger.exposures.theme[theme] ?? "0", input.additionalAmountBase);
  }
  return changes;
}

function addChange(
  changes: ExposureChangeV1[],
  ledger: PortfolioLedgerV1,
  dimension: ExposureChangeV1["dimension"],
  key: string,
  current: DecimalString,
  additional: DecimalString,
): void {
  const projected = addDecimal(current, additional);
  changes.push({
    dimension,
    key,
    currentAmountBase: current,
    projectedAmountBase: projected,
    projectedWeight: decimalRatio(projected, ledger.investableNavBase),
  });
}
