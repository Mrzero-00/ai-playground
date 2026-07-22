import { createAuditRecord } from "./audit.js";
import { createDomainEvent, createOutboxRecord } from "./event.js";
import { transitionModelVersion, type ModelVersion, type ModelVersionStatus } from "./model-version.js";
import type { InvestmentOsRepository } from "./repository.js";

export class ModelVersionWorkflow {
  constructor(private readonly repository: InvestmentOsRepository) {}

  async transition(input: {
    model: ModelVersion;
    next: ModelVersionStatus;
    actorId: string;
    at: string;
    auditId: string;
    correlationId: string;
  }): Promise<ModelVersion> {
    const updated = transitionModelVersion(input.model, input.next, { actorId: input.actorId, at: input.at });
    const audit = createAuditRecord({
      id: input.auditId,
      occurredAt: input.at,
      actorId: input.actorId,
      action: "MODEL_VERSION_CHANGED",
      entityType: "ModelVersion",
      entityId: input.model.id,
      before: input.model,
      after: updated,
      metadata: { from: input.model.status, to: updated.status },
    });
    const event = updated.status === "ACTIVE" ? createOutboxRecord(createDomainEvent({
      id: `${updated.id}:activated:${updated.version}`,
      type: "ModelVersionActivated",
      occurredAt: input.at,
      aggregateId: updated.id,
      correlationId: input.correlationId,
      schemaVersion: "1",
      modelVersionId: updated.id,
      payload: { strategy: updated.strategy, version: updated.version },
    })) : undefined;
    await this.repository.saveModelAuditWithOutbox(updated, audit, event);
    return updated;
  }
}
