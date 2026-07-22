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
  | "MOMENTUM_SCAN_COMPLETED"
  | "PORTFOLIO_PROPOSAL_CREATED"
  | "PORTFOLIO_STRESS_COMPLETED"
  | "PORTFOLIO_CAPITAL_ALLOCATED"
  | "PORTFOLIO_REBALANCE_REVIEWED"
  | "LEARNING_REVIEW_CREATED"
  | "LEARNING_COHORT_ANALYZED"
  | "LESSON_CANDIDATE_CREATED"
  | "INVESTMENT_LESSON_REVIEWED"
  | "MODEL_CHANGE_PROPOSED"
  | "MODEL_VALIDATION_COMPLETED"
  | "MODEL_CHANGE_TRANSITIONED"
  | "AGENT_RUN_REQUESTED"
  | "AGENT_OUTPUT_VALIDATED"
  | "AGENT_RUN_CANCELLED"
  | "DATA_DELETION_REQUESTED"
  | "DATA_DELETION_TRANSITIONED"
  | "DATABASE_RECONCILIATION_COMPLETED"
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
