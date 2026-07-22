import type { AuditRecord } from "./audit.js";
import type { DecisionProposal } from "./decision.js";
import type { DomainEvent, OutboxRecord } from "./event.js";
import type { ModelVersion } from "./model-version.js";
import type { PositionLot } from "./position-lot.js";
import type { DataSnapshot } from "./snapshot.js";
import type { LongTermEvaluationResult } from "./long-term-v1/types.js";
import type { MomentumEvaluationResultV1, MomentumTradePlanV1 } from "./momentum-v1/types.js";

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
  saveLongTermEvaluationWithOutbox(value: LongTermEvaluationResult, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findLongTermEvaluation(id: string): Promise<LongTermEvaluationResult | undefined>;
  findLatestLongTermEvaluation(companyId: string): Promise<LongTermEvaluationResult | undefined>;
  listLongTermEvaluations(): Promise<LongTermEvaluationResult[]>;
  saveMomentumEvaluationWithOutbox(value: MomentumEvaluationResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findMomentumEvaluation(id: string): Promise<MomentumEvaluationResultV1 | undefined>;
  findLatestMomentumEvaluation(companyId: string): Promise<MomentumEvaluationResultV1 | undefined>;
  listMomentumEvaluations(): Promise<MomentumEvaluationResultV1[]>;
  saveMomentumTradePlanWithOutbox(value: MomentumTradePlanV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findMomentumTradePlan(id: string): Promise<MomentumTradePlanV1 | undefined>;
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
  readonly longTermEvaluations = new Map<string, LongTermEvaluationResult>();
  readonly momentumEvaluations = new Map<string, MomentumEvaluationResultV1>();
  readonly momentumTradePlans = new Map<string, MomentumTradePlanV1>();

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
  async saveLongTermEvaluationWithOutbox(value: LongTermEvaluationResult, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.longTermEvaluations.has(value.id)) throw new Error("long-term evaluation already exists and is immutable");
    this.longTermEvaluations.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findLongTermEvaluation(id: string): Promise<LongTermEvaluationResult | undefined> {
    return this.clone(this.longTermEvaluations.get(id));
  }
  async findLatestLongTermEvaluation(companyId: string): Promise<LongTermEvaluationResult | undefined> {
    return this.values(this.longTermEvaluations)
      .filter((evaluation) => evaluation.companyId === companyId)
      .sort((left, right) => right.evaluatedAt.localeCompare(left.evaluatedAt))[0];
  }
  async listLongTermEvaluations(): Promise<LongTermEvaluationResult[]> {
    return this.values(this.longTermEvaluations).sort((left, right) => right.evaluatedAt.localeCompare(left.evaluatedAt));
  }
  async saveMomentumEvaluationWithOutbox(value: MomentumEvaluationResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.momentumEvaluations.has(value.id)) throw new Error("Momentum evaluation already exists and is immutable");
    this.momentumEvaluations.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findMomentumEvaluation(id: string): Promise<MomentumEvaluationResultV1 | undefined> {
    return this.clone(this.momentumEvaluations.get(id));
  }
  async findLatestMomentumEvaluation(companyId: string): Promise<MomentumEvaluationResultV1 | undefined> {
    return this.values(this.momentumEvaluations)
      .filter((evaluation) => evaluation.companyId === companyId)
      .sort((left, right) => right.evaluatedAt.localeCompare(left.evaluatedAt))[0];
  }
  async listMomentumEvaluations(): Promise<MomentumEvaluationResultV1[]> {
    return this.values(this.momentumEvaluations).sort((left, right) => right.evaluatedAt.localeCompare(left.evaluatedAt));
  }
  async saveMomentumTradePlanWithOutbox(value: MomentumTradePlanV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.momentumTradePlans.has(value.id)) throw new Error("Momentum trade plan already exists and is immutable");
    if (value.supersedesPlanId) {
      const previous = this.momentumTradePlans.get(value.supersedesPlanId);
      if (!previous) throw new Error("superseded Momentum trade plan not found");
      if (previous.setupId !== value.setupId || value.revision !== previous.revision + 1) throw new Error("Momentum trade plan revision chain is invalid");
    } else if (value.revision !== 1) {
      throw new Error("initial Momentum trade plan revision must be 1");
    }
    this.momentumTradePlans.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findMomentumTradePlan(id: string): Promise<MomentumTradePlanV1 | undefined> {
    return this.clone(this.momentumTradePlans.get(id));
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
