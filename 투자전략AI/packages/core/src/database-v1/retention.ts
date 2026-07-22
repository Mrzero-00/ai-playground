import { databaseStableHash } from "./hash.js";
import type { DataRetentionPolicyInputV1, DataRetentionPolicyV1 } from "./types.js";

export function createDataRetentionPolicyV1(input: DataRetentionPolicyInputV1): DataRetentionPolicyV1 {
  for (const [name, value] of Object.entries({ id: input.id, userId: input.userId, version: input.version, entityType: input.entityType, approvedBy: input.approvedBy })) if (!value.trim()) throw new Error(`Retention Policy ${name} is required`);
  if (!Number.isInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 36_500) throw new Error("Retention Policy retentionDays must be between 1 and 36500");
  if (input.archiveAfterDays !== undefined && (!Number.isInteger(input.archiveAfterDays) || input.archiveAfterDays < 1 || input.archiveAfterDays >= input.retentionDays)) throw new Error("Retention Policy archiveAfterDays must be positive and before retention");
  const approvedAt = parseDate(input.approvedAt, "Retention Policy approvedAt");
  const effectiveFrom = parseDate(input.effectiveFrom, "Retention Policy effectiveFrom");
  if (approvedAt > effectiveFrom) throw new Error("Retention Policy must be approved before effectiveFrom");
  if ((input.classification === "LEGAL_AUDIT" || input.classification === "REPRODUCIBILITY") && input.hardDeleteAllowed) throw new Error("Legal/Audit or Reproducibility data cannot allow hard delete");
  if (input.classification === "SENSITIVE_RAW" && (!input.encrypted || input.retentionDays > 365)) throw new Error("Sensitive Raw data must be encrypted and retained for at most 365 days");
  if (input.classification === "CACHE" && input.legalHoldSupported) throw new Error("Cache Retention Policy cannot claim legal hold support");
  const withoutHash: Omit<DataRetentionPolicyV1, "resultHash"> = {
    id: input.id,
    userId: input.userId,
    version: input.version,
    entityType: input.entityType,
    classification: input.classification,
    retentionDays: input.retentionDays,
    ...(input.archiveAfterDays === undefined ? {} : { archiveAfterDays: input.archiveAfterDays }),
    legalHoldSupported: input.legalHoldSupported,
    hardDeleteAllowed: input.hardDeleteAllowed,
    encrypted: input.encrypted,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    effectiveFrom: input.effectiveFrom,
  };
  return { ...withoutHash, resultHash: databaseStableHash(withoutHash) };
}

function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
