import type { SignedDecimalString } from "../decimal.js";

export type DataLineageRelationV1 = "DERIVED_FROM" | "USED_INPUT" | "SUPERSEDES" | "VALIDATES" | "EXPLAINS" | "CORRECTS";

export type DataLineageEdgeV1 = {
  id: string;
  userId: string;
  fromEntityType: string;
  fromEntityId: string;
  toEntityType: string;
  toEntityId: string;
  relation: DataLineageRelationV1;
  asOf: string;
  createdAt: string;
  evidenceIds: string[];
  resultHash: string;
};

export type DataLineageEdgeInputV1 = Omit<DataLineageEdgeV1, "resultHash">;

export type RetentionClassificationV1 = "LEGAL_AUDIT" | "REPRODUCIBILITY" | "OPERATIONAL" | "SENSITIVE_RAW" | "CACHE";

export type DataRetentionPolicyV1 = {
  id: string;
  userId: string;
  version: string;
  entityType: string;
  classification: RetentionClassificationV1;
  retentionDays: number;
  archiveAfterDays?: number;
  legalHoldSupported: boolean;
  hardDeleteAllowed: boolean;
  encrypted: boolean;
  approvedBy: string;
  approvedAt: string;
  effectiveFrom: string;
  resultHash: string;
};

export type DataRetentionPolicyInputV1 = Omit<DataRetentionPolicyV1, "resultHash">;

export type DataDeletionTargetV1 = {
  entityType: string;
  entityId: string;
  classification: RetentionClassificationV1;
  legalHold: boolean;
  reproducibilityRequired: boolean;
  requestedAction: "DELETE" | "ANONYMIZE" | "ARCHIVE";
};

export type DataDeletionRequestStatusV1 = "REQUESTED" | "VERIFIED" | "PLANNED" | "EXECUTING" | "COMPLETED" | "REJECTED" | "BLOCKED";

export type DataDeletionRequestV1 = {
  id: string;
  userId: string;
  requestedBy: string;
  reason: string;
  targets: DataDeletionTargetV1[];
  status: DataDeletionRequestStatusV1;
  blockerCodes: string[];
  requestedAt: string;
  transitionedAt: string;
  supersedesRequestId?: string;
  reviewedBy?: string;
  completedCounts?: Record<string, number>;
  resultHash: string;
};

export type DataDeletionRequestInputV1 = {
  id: string;
  userId: string;
  requestedBy: string;
  reason: string;
  targets: DataDeletionTargetV1[];
  requestedAt: string;
};

export type DataDeletionTransitionInputV1 = {
  id: string;
  previous: DataDeletionRequestV1;
  nextStatus: Exclude<DataDeletionRequestStatusV1, "REQUESTED">;
  transitionedAt: string;
  reviewedBy: string;
  blockerCodes?: string[];
  completedCounts?: Record<string, number>;
};

export type ReconciliationCheckInputV1 = {
  id: string;
  entityType: string;
  entityId: string;
  comparator: "EQUAL" | "LESS_THAN_OR_EQUAL" | "GREATER_THAN_OR_EQUAL";
  actual: SignedDecimalString;
  expected: SignedDecimalString;
  critical: boolean;
  evidenceIds: string[];
};

export type DatabaseReconciliationInputV1 = {
  id: string;
  userId: string;
  scope: "PORTFOLIO" | "PERFORMANCE" | "EVENT" | "AGENT" | "CUSTOM";
  asOf: string;
  executedAt: string;
  checks: ReconciliationCheckInputV1[];
};

export type DatabaseReconciliationResultV1 = DatabaseReconciliationInputV1 & {
  status: "PASSED" | "FAILED" | "BLOCKED";
  findings: Array<{
    checkId: string;
    code: string;
    severity: "WARNING" | "CRITICAL";
    actual: SignedDecimalString;
    expected: SignedDecimalString;
    entityType: string;
    entityId: string;
    evidenceIds: string[];
  }>;
  resultHash: string;
};
