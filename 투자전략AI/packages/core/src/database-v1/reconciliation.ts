import { assertSignedDecimal, compareSignedDecimal } from "../decimal.js";
import { databaseStableHash } from "./hash.js";
import type { DatabaseReconciliationInputV1, DatabaseReconciliationResultV1 } from "./types.js";

export function runDatabaseReconciliationV1(input: DatabaseReconciliationInputV1): DatabaseReconciliationResultV1 {
  if (!input.id.trim() || !input.userId.trim()) throw new Error("Database Reconciliation identity is required");
  const asOf = parseDate(input.asOf, "Database Reconciliation asOf");
  const executedAt = parseDate(input.executedAt, "Database Reconciliation executedAt");
  if (asOf > executedAt) throw new Error("Database Reconciliation asOf cannot be after executedAt");
  if (input.checks.length === 0) throw new Error("Database Reconciliation requires checks");
  if (new Set(input.checks.map((check) => check.id)).size !== input.checks.length) throw new Error("Database Reconciliation check ids must be unique");
  const findings: DatabaseReconciliationResultV1["findings"] = [];
  const checks = input.checks
    .map((check) => ({ ...structuredClone(check), evidenceIds: [...check.evidenceIds].sort() }))
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const check of checks) {
    if (!check.id.trim() || !check.entityType.trim() || !check.entityId.trim()) throw new Error("Reconciliation Check identity is required");
    assertSignedDecimal(check.actual, "Reconciliation actual");
    assertSignedDecimal(check.expected, "Reconciliation expected");
    if (check.evidenceIds.some((id) => !id.trim()) || new Set(check.evidenceIds).size !== check.evidenceIds.length) throw new Error("Reconciliation evidenceIds must be unique and non-blank");
    const comparison = compareSignedDecimal(check.actual, check.expected);
    const passed = check.comparator === "EQUAL" ? comparison === 0 : check.comparator === "LESS_THAN_OR_EQUAL" ? comparison <= 0 : comparison >= 0;
    if (!passed) findings.push({
      checkId: check.id, code: `RECONCILIATION_${check.comparator}_FAILED`, severity: check.critical ? "CRITICAL" : "WARNING",
      actual: check.actual, expected: check.expected, entityType: check.entityType, entityId: check.entityId,
      evidenceIds: [...check.evidenceIds],
    });
  }
  const status: DatabaseReconciliationResultV1["status"] = findings.some((finding) => finding.severity === "CRITICAL") ? "BLOCKED" : findings.length > 0 ? "FAILED" : "PASSED";
  const withoutHash: Omit<DatabaseReconciliationResultV1, "resultHash"> = {
    id: input.id,
    userId: input.userId,
    scope: input.scope,
    asOf: input.asOf,
    executedAt: input.executedAt,
    checks,
    status,
    findings,
  };
  return { ...withoutHash, resultHash: databaseStableHash(withoutHash) };
}

function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
