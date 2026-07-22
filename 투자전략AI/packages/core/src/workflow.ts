import { createAuditRecord } from "./audit.js";
import { composeDecision, recordUserDecision, type ApprovalRevalidation, type DecisionProposal } from "./decision.js";
import { createDomainEvent, createOutboxRecord } from "./event.js";
import type { AllocationProposal } from "./portfolio.js";
import type { InvestmentOsRepository } from "./repository.js";
import type { RiskDecision } from "./risk.js";

export class DecisionWorkflow {
  constructor(private readonly repository: InvestmentOsRepository) {}

  async create(input: {
    decisionId: string;
    correlationId: string;
    allocation: AllocationProposal;
    risk: RiskDecision;
  }): Promise<DecisionProposal> {
    const decision = composeDecision(input.decisionId, input.allocation, input.risk);
    if (input.risk.status === "DENY") {
      const event = createDomainEvent({
        id: `${input.decisionId}:risk-denied`,
        type: "RiskAlertRaised",
        occurredAt: input.risk.evaluatedAt,
        aggregateId: input.decisionId,
        correlationId: input.correlationId,
        schemaVersion: "1",
        payload: { flags: input.risk.riskFlags, rationale: input.risk.rationale },
        modelVersionId: input.risk.riskPolicyVersionId,
      });
      await this.repository.saveDecisionWithOutbox(decision, createOutboxRecord(event));
    } else {
      await this.repository.saveDecisionWithOutbox(decision);
    }
    return decision;
  }

  async decide(input: {
    decisionId: string;
    approved: boolean;
    decidedAt: string;
    userId: string;
    auditId: string;
    correlationId: string;
    revalidation?: ApprovalRevalidation;
  }): Promise<DecisionProposal> {
    const existing = await this.repository.findDecision(input.decisionId);
    if (!existing) throw new Error("decision not found");
    const updated = recordUserDecision(existing, {
      approved: input.approved,
      decidedAt: input.decidedAt,
      userId: input.userId,
      ...(input.revalidation === undefined ? {} : { revalidation: input.revalidation }),
    });
    const audit = createAuditRecord({
      id: input.auditId,
      occurredAt: input.decidedAt,
      actorId: input.userId,
      action: "USER_DECISION_RECORDED",
      entityType: "DecisionProposal",
      entityId: input.decisionId,
      before: existing,
      after: updated,
      metadata: { requestedApproval: input.approved, outcome: updated.status },
    });
    if (updated.status === "APPROVED") {
      const event = createDomainEvent({
        id: `${input.decisionId}:approved`,
        type: "DecisionApproved",
        occurredAt: input.decidedAt,
        aggregateId: input.decisionId,
        correlationId: input.correlationId,
        schemaVersion: "1",
        payload: { userId: input.userId, approvedAmount: updated.approvedAmount },
      });
      await this.repository.saveDecisionAuditWithOutbox(updated, audit, createOutboxRecord(event));
    } else {
      await this.repository.saveDecisionAuditWithOutbox(updated, audit);
    }
    return updated;
  }
}
