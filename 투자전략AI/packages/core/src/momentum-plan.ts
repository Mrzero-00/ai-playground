import { assertCurrency, assertDecimal, compareDecimal, type CurrencyCode, type DecimalString } from "./decimal.js";

export type MarketRegime = "RISK_ON_TREND" | "RISK_ON_VOLATILE" | "NEUTRAL_RANGE" | "RISK_OFF" | "CRISIS";

export type MomentumSetupType =
  | "BREAKOUT"
  | "PULLBACK"
  | "GAP_CONTINUATION"
  | "EARNINGS_MOMENTUM"
  | "SECTOR_ROTATION"
  | "SPECIAL_SITUATION";

export type EntryPlan = {
  currency: CurrencyCode;
  entryZoneMin: DecimalString;
  entryZoneMax: DecimalString;
  trigger: string;
  chaseLimit: DecimalString;
  initialStop: DecimalString;
  target1?: DecimalString;
  target2?: DecimalString;
  trailingStopRule?: string;
  timeStopDays: number;
};

export type MomentumTradePlan = {
  id: string;
  companyId: string;
  setupId: string;
  setupType: MomentumSetupType;
  marketRegime: MarketRegime;
  entryPlan: EntryPlan;
  catalystSummary: string;
  invalidationConditions: string[];
  evidenceIds: string[];
  counterEvidenceIds: string[];
  snapshotIds: string[];
  modelVersionId: string;
  dataAsOf: string;
  generatedAt: string;
  expiresAt: string;
  eventRisk: boolean;
};

export type MomentumRegimeGate = {
  status: "ALLOW" | "ALLOW_REDUCED" | "REQUIRE_MANUAL_REVIEW" | "DENY_NEW_RISK";
  sizeMultiplier: number;
  reasons: string[];
};

export function validateEntryPlan(plan: EntryPlan): EntryPlan {
  assertCurrency(plan.currency);
  for (const [name, value] of [
    ["entryZoneMin", plan.entryZoneMin], ["entryZoneMax", plan.entryZoneMax], ["chaseLimit", plan.chaseLimit],
    ["initialStop", plan.initialStop],
  ] as const) {
    assertDecimal(value, name);
    if (compareDecimal(value, "0") <= 0) throw new RangeError(`${name} must be positive`);
  }
  if (!plan.trigger.trim()) throw new Error("entry trigger is required");
  if (compareDecimal(plan.entryZoneMin, plan.entryZoneMax) > 0) throw new Error("entry zone minimum cannot exceed maximum");
  if (compareDecimal(plan.initialStop, plan.entryZoneMin) >= 0) throw new Error("initial stop must be below the entry zone");
  if (compareDecimal(plan.chaseLimit, plan.entryZoneMax) < 0) throw new Error("chase limit cannot be below the entry zone maximum");
  if (!Number.isInteger(plan.timeStopDays) || plan.timeStopDays <= 0) throw new Error("time stop days must be a positive integer");
  for (const [name, value] of [["target1", plan.target1], ["target2", plan.target2]] as const) {
    if (value === undefined) continue;
    assertDecimal(value, name);
    if (compareDecimal(value, plan.entryZoneMin) <= 0) throw new Error(`${name} must be above the entry zone`);
  }
  if (plan.target1 && plan.target2 && compareDecimal(plan.target1, plan.target2) > 0) {
    throw new Error("target1 cannot exceed target2");
  }
  if (plan.target1 === undefined && !plan.trailingStopRule?.trim()) {
    throw new Error("entry plan requires a target or trailing stop rule");
  }
  return structuredClone(plan);
}

export function validateMomentumTradePlan(plan: MomentumTradePlan): MomentumTradePlan {
  for (const [name, value] of [
    ["id", plan.id], ["companyId", plan.companyId], ["setupId", plan.setupId],
    ["catalystSummary", plan.catalystSummary], ["modelVersionId", plan.modelVersionId],
  ] as const) {
    if (!value.trim()) throw new Error(`${name} is required`);
  }
  validateEntryPlan(plan.entryPlan);
  const dataAsOf = parseDate(plan.dataAsOf, "dataAsOf");
  const generatedAt = parseDate(plan.generatedAt, "generatedAt");
  const expiresAt = parseDate(plan.expiresAt, "expiresAt");
  if (dataAsOf > generatedAt) throw new Error("trade plan dataAsOf cannot be after generatedAt");
  if (expiresAt <= generatedAt) throw new Error("trade plan must expire after generation");
  if (plan.invalidationConditions.length === 0) throw new Error("Momentum plan requires invalidation conditions");
  if (plan.evidenceIds.length === 0 || plan.counterEvidenceIds.length === 0) {
    throw new Error("Momentum plan requires supporting and counter evidence");
  }
  if (plan.snapshotIds.length === 0) throw new Error("Momentum plan requires point-in-time snapshots");
  return structuredClone(plan);
}

export function evaluateMomentumRegimeGate(regime: MarketRegime): MomentumRegimeGate {
  switch (regime) {
    case "RISK_ON_TREND":
      return { status: "ALLOW", sizeMultiplier: 1, reasons: [] };
    case "RISK_ON_VOLATILE":
      return { status: "ALLOW_REDUCED", sizeMultiplier: 0.6, reasons: ["변동성 확대 구간이므로 위험 크기를 축소합니다."] };
    case "NEUTRAL_RANGE":
      return { status: "ALLOW_REDUCED", sizeMultiplier: 0.4, reasons: ["박스권에서는 선별된 Setup만 축소 허용합니다."] };
    case "RISK_OFF":
      return { status: "REQUIRE_MANUAL_REVIEW", sizeMultiplier: 0.2, reasons: ["Risk-off 신규 진입은 예외적 상대강도 검토가 필요합니다."] };
    case "CRISIS":
      return { status: "DENY_NEW_RISK", sizeMultiplier: 0, reasons: ["Crisis 기본 정책은 신규 Momentum 위험을 금지합니다."] };
  }
}

export type StopRevision = {
  previousStop: DecimalString;
  proposedStop: DecimalString;
  reason: string;
  exceptionType?: "CORPORATE_ACTION" | "DATA_CORRECTION" | "PREDEFINED_VOLATILITY_MODEL";
  requiresRiskRevalidation: true;
};

export function requestStopRevision(input: {
  plan: MomentumTradePlan;
  proposedStop: DecimalString;
  reason: string;
  exceptionType?: StopRevision["exceptionType"];
}): StopRevision {
  validateMomentumTradePlan(input.plan);
  assertDecimal(input.proposedStop, "proposedStop");
  if (compareDecimal(input.proposedStop, "0") <= 0) throw new Error("revised stop must be positive");
  if (!input.reason.trim()) throw new Error("stop revision requires a reason");
  if (compareDecimal(input.proposedStop, input.plan.entryPlan.entryZoneMin) >= 0) {
    throw new Error("revised stop must remain below the entry zone");
  }
  const widensRisk = compareDecimal(input.proposedStop, input.plan.entryPlan.initialStop) < 0;
  if (widensRisk && !input.exceptionType) throw new Error("widening a Momentum stop is forbidden without a policy exception");
  return {
    previousStop: input.plan.entryPlan.initialStop,
    proposedStop: input.proposedStop,
    reason: input.reason,
    ...(input.exceptionType === undefined ? {} : { exceptionType: input.exceptionType }),
    requiresRiskRevalidation: true,
  };
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}
