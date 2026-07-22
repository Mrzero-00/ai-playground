export type DomainEventType =
  | "MarketDataUpdated"
  | "FinancialStatementPublished"
  | "NewsDetected"
  | "EarningsReleased"
  | "EvidenceRecorded"
  | "ThesisRevised"
  | "LongTermEvaluationRequested"
  | "LongTermEvaluationCompleted"
  | "LongTermEvaluationBlocked"
  | "LongTermThesisAssessed"
  | "LongTermStageChangeProposed"
  | "LongTermStageChanged"
  | "LongTermReviewScheduled"
  | "LongTermHardRiskDetected"
  | "LongTermRankingRefreshRequested"
  | "MomentumSignalDetected"
  | "MomentumUniverseUpdated"
  | "MarketRegimeChanged"
  | "MomentumCandidateDetected"
  | "MomentumEvaluationCompleted"
  | "MomentumEvaluationBlocked"
  | "MomentumSetupValidated"
  | "MomentumTradePlanCreated"
  | "MomentumTradePlanExpired"
  | "MomentumSetupInvalidated"
  | "MomentumEntryReviewRequested"
  | "MomentumPositionReviewRequested"
  | "MomentumExitTriggered"
  | "MomentumTradeReviewed"
  | "MomentumRankingRefreshRequested"
  | "PortfolioLimitExceeded"
  | "RiskAlertRaised"
  | "DecisionApproved"
  | "DecisionModificationRequested"
  | "RiskManualReviewCompleted"
  | "OrderExecuted"
  | "PositionClosed"
  | "ReviewCompleted"
  | "LessonCreated"
  | "PerformanceAttributed"
  | "PhilosophyVersionActivated"
  | "ModelVersionActivated"
  | "ReportGenerated";

export type DomainEvent<T = unknown> = {
  id: string;
  type: DomainEventType;
  occurredAt: string;
  aggregateId: string;
  correlationId: string;
  schemaVersion: string;
  payload: T;
  modelVersionId?: string;
};

export function createDomainEvent<T>(event: DomainEvent<T>): DomainEvent<T> {
  if (!event.id.trim() || !event.aggregateId.trim() || !event.correlationId.trim() || !event.schemaVersion.trim()) {
    throw new Error("event id, aggregateId, correlationId and schemaVersion are required");
  }
  if (!Number.isFinite(new Date(event.occurredAt).getTime())) throw new Error("occurredAt must be a valid date");
  return structuredClone(event);
}

export type OutboxRecord = {
  id: string;
  event: DomainEvent;
  status: "PENDING" | "PUBLISHED" | "FAILED";
  createdAt: string;
  attempts: number;
  publishedAt?: string;
  lastError?: string;
};

export function createOutboxRecord(event: DomainEvent): OutboxRecord {
  return { id: event.id, event: structuredClone(event), status: "PENDING", createdAt: event.occurredAt, attempts: 0 };
}
