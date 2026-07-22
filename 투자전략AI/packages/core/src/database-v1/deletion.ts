import { databaseStableHash } from "./hash.js";
import type { DataDeletionRequestInputV1, DataDeletionRequestV1, DataDeletionTransitionInputV1 } from "./types.js";

export function createDataDeletionRequestV1(input: DataDeletionRequestInputV1): DataDeletionRequestV1 {
  for (const [name, value] of Object.entries({ id: input.id, userId: input.userId, requestedBy: input.requestedBy, reason: input.reason })) if (!value.trim()) throw new Error(`Deletion Request ${name} is required`);
  parseDate(input.requestedAt, "Deletion Request requestedAt");
  if (input.requestedBy !== input.userId) throw new Error("Deletion Request owner and requester must match");
  if (input.targets.length === 0) throw new Error("Deletion Request requires targets");
  const targetKeys = input.targets.map((target) => `${target.entityType}:${target.entityId}`);
  if (new Set(targetKeys).size !== targetKeys.length) throw new Error("Deletion Request targets must be unique");
  const blockerCodes: string[] = [];
  for (const target of input.targets) {
    if (!target.entityType.trim() || !target.entityId.trim()) throw new Error("Deletion Request target identity is required");
    if (target.legalHold) blockerCodes.push(`LEGAL_HOLD:${target.entityType}:${target.entityId}`);
    if (target.reproducibilityRequired && target.requestedAction === "DELETE") blockerCodes.push(`REPRODUCIBILITY_REQUIRED:${target.entityType}:${target.entityId}`);
    if (target.classification === "LEGAL_AUDIT" && target.requestedAction === "DELETE") blockerCodes.push(`LEGAL_AUDIT_DELETE_FORBIDDEN:${target.entityType}:${target.entityId}`);
  }
  const withoutHash: Omit<DataDeletionRequestV1, "resultHash"> = {
    id: input.id,
    userId: input.userId,
    requestedBy: input.requestedBy,
    reason: input.reason,
    targets: input.targets.map((target) => ({
      entityType: target.entityType,
      entityId: target.entityId,
      classification: target.classification,
      legalHold: target.legalHold,
      reproducibilityRequired: target.reproducibilityRequired,
      requestedAction: target.requestedAction,
    })).sort((left, right) => `${left.entityType}:${left.entityId}`.localeCompare(`${right.entityType}:${right.entityId}`)),
    status: blockerCodes.length > 0 ? "BLOCKED" : "REQUESTED",
    blockerCodes: [...new Set(blockerCodes)].sort(),
    requestedAt: input.requestedAt,
    transitionedAt: input.requestedAt,
  };
  return { ...withoutHash, resultHash: databaseStableHash(withoutHash) };
}

export function transitionDataDeletionRequestV1(input: DataDeletionTransitionInputV1): DataDeletionRequestV1 {
  if (!input.id.trim() || input.id === input.previous.id || !input.reviewedBy.trim()) throw new Error("Deletion Request transition requires new id and reviewer");
  const { resultHash: previousHash, ...previousWithoutHash } = input.previous;
  if (previousHash !== databaseStableHash(previousWithoutHash)) throw new Error("Deletion Request previous revision hash is invalid");
  const transitionedAt = parseDate(input.transitionedAt, "Deletion Request transitionedAt");
  if (transitionedAt <= parseDate(input.previous.transitionedAt, "previous transitionedAt")) throw new Error("Deletion Request transition time must be after the previous revision");
  if (!allowed[input.previous.status].includes(input.nextStatus)) throw new Error(`Invalid Deletion Request transition ${input.previous.status} -> ${input.nextStatus}`);
  const blockerCodes = [...new Set(input.blockerCodes ?? [])].sort();
  if (input.nextStatus === "BLOCKED" && blockerCodes.length === 0) throw new Error("Blocked Deletion Request requires blocker codes");
  if (input.nextStatus !== "BLOCKED" && blockerCodes.length > 0) throw new Error("Only Blocked Deletion Request can have transition blockers");
  if (input.nextStatus === "COMPLETED") {
    if (!input.completedCounts || Object.keys(input.completedCounts).length === 0) throw new Error("Completed Deletion Request requires counts");
    for (const value of Object.values(input.completedCounts)) if (!Number.isInteger(value) || value < 0) throw new Error("Deletion completion counts must be non-negative integers");
  }
  const { resultHash: _previousResultHash, ...previousData } = structuredClone(input.previous);
  const withoutHash: Omit<DataDeletionRequestV1, "resultHash"> = {
    ...previousData, id: input.id, status: input.nextStatus, blockerCodes,
    transitionedAt: input.transitionedAt, supersedesRequestId: input.previous.id, reviewedBy: input.reviewedBy,
    ...(input.completedCounts === undefined ? {} : { completedCounts: Object.fromEntries(Object.entries(input.completedCounts).sort(([left], [right]) => left.localeCompare(right))) }),
  };
  return { ...withoutHash, resultHash: databaseStableHash(withoutHash) };
}

const allowed: Record<DataDeletionRequestV1["status"], DataDeletionTransitionInputV1["nextStatus"][]> = {
  REQUESTED: ["VERIFIED", "REJECTED", "BLOCKED"], VERIFIED: ["PLANNED", "REJECTED", "BLOCKED"],
  PLANNED: ["EXECUTING", "BLOCKED"], EXECUTING: ["COMPLETED", "BLOCKED"],
  COMPLETED: [], REJECTED: [], BLOCKED: [],
};

function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
