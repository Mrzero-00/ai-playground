import type { AuditRecord } from "./audit.js";
import type { DecisionProposal } from "./decision.js";
import type { DomainEvent, OutboxRecord } from "./event.js";
import type { ModelVersion } from "./model-version.js";
import type { PositionLot } from "./position-lot.js";
import type { DataSnapshot } from "./snapshot.js";

export interface InvestmentOsRepository {
  saveDecision(value: DecisionProposal): Promise<void>;
  findDecision(id: string): Promise<DecisionProposal | undefined>;
  saveLot(value: PositionLot): Promise<void>;
  listLots(portfolioId: string): Promise<PositionLot[]>;
  saveSnapshot(value: DataSnapshot): Promise<void>;
  findLatestSnapshot(companyId: string, kind: DataSnapshot["kind"]): Promise<DataSnapshot | undefined>;
  saveModelVersion(value: ModelVersion): Promise<void>;
  findActiveModel(strategy: ModelVersion["strategy"]): Promise<ModelVersion | undefined>;
  appendAudit(value: AuditRecord): Promise<void>;
  listAudit(entityId: string): Promise<AuditRecord[]>;
  listEvents(aggregateId: string): Promise<DomainEvent[]>;
  saveDecisionWithOutbox(decision: DecisionProposal, outbox?: OutboxRecord): Promise<void>;
  appendAuditWithOutbox(audit: AuditRecord, outbox?: OutboxRecord): Promise<void>;
  saveDecisionAuditWithOutbox(decision: DecisionProposal, audit: AuditRecord, outbox?: OutboxRecord): Promise<void>;
  saveModelAuditWithOutbox(model: ModelVersion, audit: AuditRecord, outbox?: OutboxRecord): Promise<void>;
  listPendingOutbox(): Promise<OutboxRecord[]>;
  markOutboxPublished(id: string, at: string): Promise<void>;
}

export class InMemoryInvestmentOsRepository implements InvestmentOsRepository {
  readonly decisions = new Map<string, DecisionProposal>();
  readonly lots = new Map<string, PositionLot>();
  readonly snapshots = new Map<string, DataSnapshot>();
  readonly models = new Map<string, ModelVersion>();
  readonly audit: AuditRecord[] = [];
  readonly events: DomainEvent[] = [];
  readonly outbox = new Map<string, OutboxRecord>();

  async saveDecision(value: DecisionProposal): Promise<void> { this.decisions.set(value.id, structuredClone(value)); }
  async findDecision(id: string): Promise<DecisionProposal | undefined> { return this.clone(this.decisions.get(id)); }
  async saveLot(value: PositionLot): Promise<void> { this.lots.set(value.id, structuredClone(value)); }
  async listLots(portfolioId: string): Promise<PositionLot[]> { return this.values(this.lots).filter((lot) => lot.portfolioId === portfolioId); }
  async saveSnapshot(value: DataSnapshot): Promise<void> { this.snapshots.set(value.id, structuredClone(value)); }
  async findLatestSnapshot(companyId: string, kind: DataSnapshot["kind"]): Promise<DataSnapshot | undefined> {
    return this.values(this.snapshots)
      .filter((snapshot) => snapshot.companyId === companyId && snapshot.kind === kind)
      .sort((a, b) => b.asOf.localeCompare(a.asOf))[0];
  }
  async saveModelVersion(value: ModelVersion): Promise<void> {
    if (value.status === "ACTIVE") {
      for (const model of this.models.values()) {
        if (model.strategy === value.strategy && model.status === "ACTIVE" && model.id !== value.id) {
          this.models.set(model.id, { ...model, status: "DEPRECATED" });
        }
      }
    }
    this.models.set(value.id, structuredClone(value));
  }
  async findActiveModel(strategy: ModelVersion["strategy"]): Promise<ModelVersion | undefined> {
    return this.clone([...this.models.values()].find((model) => model.strategy === strategy && model.status === "ACTIVE"));
  }
  async appendAudit(value: AuditRecord): Promise<void> { this.audit.push(structuredClone(value)); }
  async listAudit(entityId: string): Promise<AuditRecord[]> { return this.audit.filter((item) => item.entityId === entityId).map((item) => structuredClone(item)); }
  async listEvents(aggregateId: string): Promise<DomainEvent[]> { return this.events.filter((event) => event.aggregateId === aggregateId).map((event) => structuredClone(event)); }
  async saveDecisionWithOutbox(decision: DecisionProposal, outbox?: OutboxRecord): Promise<void> {
    this.decisions.set(decision.id, structuredClone(decision));
    if (outbox) this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async appendAuditWithOutbox(audit: AuditRecord, outbox?: OutboxRecord): Promise<void> {
    this.audit.push(structuredClone(audit));
    if (outbox) this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async saveDecisionAuditWithOutbox(decision: DecisionProposal, audit: AuditRecord, outbox?: OutboxRecord): Promise<void> {
    this.decisions.set(decision.id, structuredClone(decision));
    this.audit.push(structuredClone(audit));
    if (outbox) this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async saveModelAuditWithOutbox(model: ModelVersion, audit: AuditRecord, outbox?: OutboxRecord): Promise<void> {
    await this.saveModelVersion(model);
    this.audit.push(structuredClone(audit));
    if (outbox) this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async listPendingOutbox(): Promise<OutboxRecord[]> {
    return this.values(this.outbox).filter((record) => record.status === "PENDING");
  }
  async markOutboxPublished(id: string, at: string): Promise<void> {
    const record = this.outbox.get(id);
    if (!record) throw new Error("outbox record not found");
    if (record.status === "PUBLISHED") return;
    if (!this.events.some((event) => event.id === record.event.id)) this.events.push(structuredClone(record.event));
    this.outbox.set(id, { ...record, status: "PUBLISHED", publishedAt: at, attempts: record.attempts + 1 });
  }

  private clone<T>(value: T | undefined): T | undefined { return value === undefined ? undefined : structuredClone(value); }
  private values<T>(map: Map<string, T>): T[] { return [...map.values()].map((value) => structuredClone(value)); }
}
