import {
  assertCurrency,
  assertDecimal,
  compareDecimal,
  decimalRatio,
  subtractDecimal,
} from "../decimal.js";
import type { MomentumTradePlanV1 } from "./types.js";

export type MomentumPricePosition = "BELOW_ENTRY" | "IN_ENTRY_ZONE" | "ABOVE_ENTRY_BELOW_CHASE" | "CHASED";

export function validateMomentumTradePlanV1(plan: MomentumTradePlanV1): MomentumTradePlanV1 {
  for (const [name, value] of Object.entries({
    id: plan.id, companyId: plan.companyId, securityId: plan.securityId, evaluationId: plan.evaluationId,
    setupId: plan.setupId, trigger: plan.trigger, modelVersionId: plan.modelVersionId,
  })) if (!value.trim()) throw new Error(`trade plan ${name} is required`);
  if (!Number.isInteger(plan.revision) || plan.revision <= 0) throw new Error("trade plan revision must be a positive integer");
  assertCurrency(plan.currency);
  for (const [name, value] of Object.entries({
    entryZoneMin: plan.entryZoneMin, entryZoneMax: plan.entryZoneMax, chaseLimit: plan.chaseLimit,
    initialStop: plan.initialStop, referenceEntry: plan.referenceEntry, unitRisk: plan.unitRisk,
  })) assertPositiveDecimal(value, name);
  for (const [name, value] of Object.entries({ target1: plan.target1, target2: plan.target2 })) {
    if (value !== undefined) assertPositiveDecimal(value, name);
  }
  if (compareDecimal(plan.initialStop, plan.entryZoneMin) >= 0) throw new Error("initial stop must be below entryZoneMin");
  if (compareDecimal(plan.entryZoneMin, plan.referenceEntry) > 0 || compareDecimal(plan.referenceEntry, plan.entryZoneMax) > 0) {
    throw new Error("referenceEntry must be inside the entry zone");
  }
  if (compareDecimal(plan.entryZoneMin, plan.entryZoneMax) > 0) throw new Error("entryZoneMin cannot exceed entryZoneMax");
  if (compareDecimal(plan.entryZoneMax, plan.chaseLimit) > 0) throw new Error("chaseLimit cannot be below entryZoneMax");
  if (plan.target1 !== undefined && compareDecimal(plan.target1, plan.referenceEntry) <= 0) throw new Error("target1 must be above referenceEntry");
  if (plan.target2 !== undefined && compareDecimal(plan.target2, plan.referenceEntry) <= 0) throw new Error("target2 must be above referenceEntry");
  if (plan.target1 !== undefined && plan.target2 !== undefined && compareDecimal(plan.target1, plan.target2) > 0) {
    throw new Error("target1 cannot exceed target2");
  }
  if (plan.target1 === undefined && !plan.trailingStopRule?.trim()) throw new Error("trade plan requires target1 or a trailing stop rule");
  if (!Number.isInteger(plan.timeStopSessions) || plan.timeStopSessions <= 0) throw new Error("timeStopSessions must be a positive integer");
  if (!Number.isFinite(plan.estimatedRoundTripCostR) || plan.estimatedRoundTripCostR < 0) throw new Error("estimatedRoundTripCostR must be non-negative");
  if (plan.invalidationConditions.length === 0) throw new Error("trade plan requires invalidation conditions");
  if (plan.evidenceIds.length === 0 || plan.counterEvidenceIds.length === 0 || plan.snapshotIds.length === 0) {
    throw new Error("trade plan requires evidence, counter evidence and snapshots");
  }

  const calculatedRisk = subtractDecimal(plan.referenceEntry, plan.initialStop);
  assertDecimal(calculatedRisk, "calculated unit risk");
  if (compareDecimal(calculatedRisk, plan.unitRisk) !== 0) throw new Error("unitRisk does not match referenceEntry - initialStop");
  const target1Rr = plan.target1 === undefined ? undefined : rewardRisk(plan.target1, plan.referenceEntry, plan.unitRisk);
  const target2Rr = plan.target2 === undefined ? undefined : rewardRisk(plan.target2, plan.referenceEntry, plan.unitRisk);
  validateDeclaredRatio("rewardRiskToTarget1", plan.rewardRiskToTarget1, target1Rr);
  validateDeclaredRatio("rewardRiskToTarget2", plan.rewardRiskToTarget2, target2Rr);
  if (target1Rr !== undefined && target1Rr - plan.estimatedRoundTripCostR < 1.5) throw new Error("target1 reward/risk must be at least 1.5 after cost");
  const finalRr = target2Rr ?? target1Rr;
  if (finalRr !== undefined && finalRr - plan.estimatedRoundTripCostR < 2) throw new Error("final reward/risk must be at least 2.0 after cost");
  const generatedAt = parseDate(plan.generatedAt, "tradePlan.generatedAt");
  const expiresAt = parseDate(plan.expiresAt, "tradePlan.expiresAt");
  if (expiresAt <= generatedAt) throw new Error("trade plan must expire after generation");
  if (plan.supersedesPlanId !== undefined && !plan.supersedesPlanId.trim()) throw new Error("supersedesPlanId cannot be blank");
  return structuredClone(plan);
}

export function classifyMomentumPrice(plan: MomentumTradePlanV1, currentPrice: string): MomentumPricePosition {
  validateMomentumTradePlanV1(plan);
  assertPositiveDecimal(currentPrice, "currentPrice");
  if (compareDecimal(currentPrice, plan.entryZoneMin) < 0) return "BELOW_ENTRY";
  if (compareDecimal(currentPrice, plan.entryZoneMax) <= 0) return "IN_ENTRY_ZONE";
  if (compareDecimal(currentPrice, plan.chaseLimit) <= 0) return "ABOVE_ENTRY_BELOW_CHASE";
  return "CHASED";
}

function rewardRisk(target: string, referenceEntry: string, unitRisk: string): number {
  const reward = subtractDecimal(target, referenceEntry);
  assertDecimal(reward, "target reward");
  return round2(decimalRatio(reward, unitRisk));
}

function validateDeclaredRatio(name: string, declared: number | undefined, calculated: number | undefined): void {
  if (calculated === undefined) {
    if (declared !== undefined) throw new Error(`${name} cannot be supplied without its target`);
    return;
  }
  if (declared === undefined || !Number.isFinite(declared) || Math.abs(declared - calculated) > 0.01) {
    throw new Error(`${name} does not match plan prices`);
  }
}

function assertPositiveDecimal(value: string, name: string): void {
  assertDecimal(value, name);
  if (compareDecimal(value, "0") <= 0) throw new Error(`${name} must be positive`);
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a valid date`);
  return parsed;
}

function round2(value: number): number { return Math.round(value * 100) / 100; }
