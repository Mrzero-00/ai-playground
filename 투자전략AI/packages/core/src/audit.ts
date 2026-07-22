export type AuditAction =
  | "MODEL_VERSION_CHANGED"
  | "SCORE_OVERRIDDEN"
  | "PORTFOLIO_LIMIT_CHANGED"
  | "RISK_OVERRIDDEN"
  | "RISK_MANUAL_REVIEWED"
  | "USER_DECISION_RECORDED"
  | "DECISION_AMENDMENT_REQUESTED"
  | "DECISION_JOURNAL_AMENDED"
  | "THESIS_REVISED"
  | "LONG_TERM_EVALUATED"
  | "LONG_TERM_STAGE_CHANGED"
  | "MOMENTUM_EVALUATED"
  | "MOMENTUM_PLAN_CREATED"
  | "MOMENTUM_PLAN_REVISED"
  | "PHILOSOPHY_VERSION_CHANGED"
  | "TRADE_RECORD_CHANGED"
  | "REPORT_REGENERATED"
  | "DATA_SOURCE_CHANGED";

export type AuditRecord = {
  id: string;
  occurredAt: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  metadata: Record<string, string | number | boolean | null>;
};

export function createAuditRecord(record: AuditRecord): AuditRecord {
  if (!record.actorId.trim()) throw new Error("actorId is required");
  if (record.action === "RISK_OVERRIDDEN" && !record.reason?.trim()) {
    throw new Error("Risk override requires a reason");
  }
  if (!Number.isFinite(new Date(record.occurredAt).getTime())) throw new Error("occurredAt must be a valid date");
  return structuredClone(record);
}
