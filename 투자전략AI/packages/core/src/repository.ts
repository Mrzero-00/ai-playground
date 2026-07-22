import type { AuditRecord } from "./audit.js";
import type { DecisionProposal } from "./decision.js";
import type { DomainEvent, OutboxRecord } from "./event.js";
import type { ModelVersion } from "./model-version.js";
import type { PositionLot } from "./position-lot.js";
import type { DataSnapshot } from "./snapshot.js";
import type { LongTermEvaluationResult } from "./long-term-v1/types.js";
import type { MomentumEvaluationResultV1, MomentumScanResult, MomentumTradePlanV1 } from "./momentum-v1/types.js";
import type { AgentRunV1, AgentValidationResultV1 } from "./agent-v1/types.js";
import type { DataDeletionRequestV1, DatabaseReconciliationResultV1 } from "./database-v1/types.js";
import type { ScorecardResultV1, ScoreChangeExplanationV1, ScoreModelV1 } from "./scoring-v1/types.js";
import type { CanonicalReportV1, ReportArtifactV1, ReportReplayResultV1, ReportTemplateV1 } from "./report-v1/types.js";
import type { ReleaseEvidenceBundleV1, RoadmapPlanV1, RoadmapReplayV1 } from "./planning-v1/types.js";
import type {
  InvestmentLessonV1,
  LearningReviewV1,
  CohortAnalysisV1,
  LessonCandidateV1,
  ModelChangeProposalV1,
  ModelValidationResultV1,
  OutcomeAttributionV1,
  ReviewManifestV1,
} from "./learning-v1/types.js";
import type {
  AllocationProposalV1,
  CapitalAllocationDecisionV1,
  PortfolioRebalanceReviewV1,
  PortfolioSnapshotV1,
  PortfolioStressResultV1,
} from "./portfolio-v1/types.js";

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
  saveMomentumScanWithOutbox(value: MomentumScanResult, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findMomentumScan(id: string): Promise<MomentumScanResult | undefined>;
  savePortfolioProposalWithOutbox(value: AllocationProposalV1, snapshot: PortfolioSnapshotV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findPortfolioProposal(id: string): Promise<AllocationProposalV1 | undefined>;
  findLatestPortfolioSnapshot(portfolioId: string): Promise<PortfolioSnapshotV1 | undefined>;
  savePortfolioStressWithOutbox(value: PortfolioStressResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findPortfolioStress(id: string): Promise<PortfolioStressResultV1 | undefined>;
  saveCapitalAllocationWithOutbox(value: CapitalAllocationDecisionV1, snapshot: PortfolioSnapshotV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findCapitalAllocation(id: string): Promise<CapitalAllocationDecisionV1 | undefined>;
  savePortfolioRebalanceWithOutbox(value: PortfolioRebalanceReviewV1, snapshot: PortfolioSnapshotV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findPortfolioRebalance(id: string): Promise<PortfolioRebalanceReviewV1 | undefined>;
  saveLearningReviewWithOutbox(value: LearningReviewV1, manifest: ReviewManifestV1, outcome: OutcomeAttributionV1 | undefined, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findLearningReview(id: string): Promise<LearningReviewV1 | undefined>;
  findLearningManifest(id: string): Promise<ReviewManifestV1 | undefined>;
  saveLearningCohortWithOutbox(value: CohortAnalysisV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findLearningCohort(id: string): Promise<CohortAnalysisV1 | undefined>;
  saveLessonCandidateWithOutbox(value: LessonCandidateV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findLessonCandidate(id: string): Promise<LessonCandidateV1 | undefined>;
  saveInvestmentLessonWithOutbox(value: InvestmentLessonV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findInvestmentLesson(id: string): Promise<InvestmentLessonV1 | undefined>;
  saveModelChangeWithOutbox(value: ModelChangeProposalV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findModelChange(id: string): Promise<ModelChangeProposalV1 | undefined>;
  saveModelValidationWithOutbox(value: ModelValidationResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findModelValidation(id: string): Promise<ModelValidationResultV1 | undefined>;
  saveAgentRunWithOutbox(value: AgentRunV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  updateAgentRunWithOutbox(value: AgentRunV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findAgentRun(id: string): Promise<AgentRunV1 | undefined>;
  findAgentRunByIdempotencyKey(userId: string, key: string): Promise<AgentRunV1 | undefined>;
  findAgentValidation(id: string): Promise<AgentValidationResultV1 | undefined>;
  saveDataDeletionRequestWithOutbox(value: DataDeletionRequestV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findDataDeletionRequest(id: string): Promise<DataDeletionRequestV1 | undefined>;
  saveDatabaseReconciliationWithOutbox(value: DatabaseReconciliationResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findDatabaseReconciliation(id: string): Promise<DatabaseReconciliationResultV1 | undefined>;
  saveScoreModelWithOutbox(value: ScoreModelV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  updateScoreModelWithOutbox(value: ScoreModelV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findScoreModel(id: string): Promise<ScoreModelV1 | undefined>;
  saveScorecardWithOutbox(value: ScorecardResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findScorecard(id: string): Promise<ScorecardResultV1 | undefined>;
  saveScoreChangeWithOutbox(value: ScoreChangeExplanationV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findScoreChange(id: string): Promise<ScoreChangeExplanationV1 | undefined>;
  saveReportTemplateWithOutbox(value: ReportTemplateV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  updateReportTemplateWithOutbox(value: ReportTemplateV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findReportTemplate(id: string): Promise<ReportTemplateV1 | undefined>;
  saveReportWithArtifactsWithOutbox(value: CanonicalReportV1, artifacts: ReportArtifactV1[], audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findReport(id: string): Promise<CanonicalReportV1 | undefined>;
  listReportArtifacts(reportId: string): Promise<ReportArtifactV1[]>;
  saveReportReplayWithOutbox(value: ReportReplayResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findReportReplay(id: string): Promise<ReportReplayResultV1 | undefined>;
  saveRoadmapPlanWithOutbox(value: RoadmapPlanV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findRoadmapPlan(id: string): Promise<RoadmapPlanV1 | undefined>;
  saveReleaseEvidenceWithOutbox(value: ReleaseEvidenceBundleV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findReleaseEvidence(id: string): Promise<ReleaseEvidenceBundleV1 | undefined>;
  saveRoadmapReplayWithOutbox(value: RoadmapReplayV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void>;
  findRoadmapReplay(id: string): Promise<RoadmapReplayV1 | undefined>;
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
  readonly momentumScans = new Map<string, MomentumScanResult>();
  readonly portfolioProposalsV1 = new Map<string, AllocationProposalV1>();
  readonly portfolioSnapshotsV1 = new Map<string, PortfolioSnapshotV1>();
  readonly portfolioStressResultsV1 = new Map<string, PortfolioStressResultV1>();
  readonly capitalAllocationsV1 = new Map<string, CapitalAllocationDecisionV1>();
  readonly portfolioRebalancesV1 = new Map<string, PortfolioRebalanceReviewV1>();
  readonly learningReviewsV1 = new Map<string, LearningReviewV1>();
  readonly learningCohortsV1 = new Map<string, CohortAnalysisV1>();
  readonly learningManifestsV1 = new Map<string, ReviewManifestV1>();
  readonly learningOutcomesV1 = new Map<string, OutcomeAttributionV1>();
  readonly lessonCandidatesV1 = new Map<string, LessonCandidateV1>();
  readonly investmentLessonsV1 = new Map<string, InvestmentLessonV1>();
  readonly modelChangesV1 = new Map<string, ModelChangeProposalV1>();
  readonly modelValidationsV1 = new Map<string, ModelValidationResultV1>();
  readonly agentRunsV1 = new Map<string, AgentRunV1>();
  readonly agentValidationsV1 = new Map<string, AgentValidationResultV1>();
  readonly dataDeletionRequestsV1 = new Map<string, DataDeletionRequestV1>();
  readonly databaseReconciliationsV1 = new Map<string, DatabaseReconciliationResultV1>();
  readonly scoreModelsV1 = new Map<string, ScoreModelV1>();
  readonly scorecardsV1 = new Map<string, ScorecardResultV1>();
  readonly scoreChangesV1 = new Map<string, ScoreChangeExplanationV1>();
  readonly reportTemplatesV1 = new Map<string, ReportTemplateV1>();
  readonly reportsV1 = new Map<string, CanonicalReportV1>();
  readonly reportArtifactsV1 = new Map<string, ReportArtifactV1>();
  readonly reportReplaysV1 = new Map<string, ReportReplayResultV1>();
  readonly roadmapPlansV1 = new Map<string, RoadmapPlanV1>();
  readonly releaseEvidenceV1 = new Map<string, ReleaseEvidenceBundleV1>();
  readonly roadmapReplaysV1 = new Map<string, RoadmapReplayV1>();

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
  async saveMomentumScanWithOutbox(value: MomentumScanResult, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.momentumScans.has(value.id)) throw new Error("Momentum scan already exists and is immutable");
    this.momentumScans.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findMomentumScan(id: string): Promise<MomentumScanResult | undefined> {
    return this.clone(this.momentumScans.get(id));
  }
  async savePortfolioProposalWithOutbox(value: AllocationProposalV1, snapshot: PortfolioSnapshotV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.portfolioProposalsV1.has(value.id)) throw new Error("Portfolio allocation proposal already exists and is immutable");
    const existingSnapshot = this.portfolioSnapshotsV1.get(snapshot.id);
    if (existingSnapshot && JSON.stringify(existingSnapshot) !== JSON.stringify(snapshot)) throw new Error("Portfolio snapshot id already exists with different content");
    this.portfolioSnapshotsV1.set(snapshot.id, structuredClone(snapshot));
    this.portfolioProposalsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findPortfolioProposal(id: string): Promise<AllocationProposalV1 | undefined> {
    return this.clone(this.portfolioProposalsV1.get(id));
  }
  async findLatestPortfolioSnapshot(portfolioId: string): Promise<PortfolioSnapshotV1 | undefined> {
    return this.values(this.portfolioSnapshotsV1)
      .filter((snapshot) => snapshot.portfolioId === portfolioId)
      .sort((left, right) => right.asOf.localeCompare(left.asOf))[0];
  }
  async savePortfolioStressWithOutbox(value: PortfolioStressResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.portfolioStressResultsV1.has(value.id)) throw new Error("Portfolio stress result already exists and is immutable");
    this.portfolioStressResultsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findPortfolioStress(id: string): Promise<PortfolioStressResultV1 | undefined> {
    return this.clone(this.portfolioStressResultsV1.get(id));
  }
  async saveCapitalAllocationWithOutbox(value: CapitalAllocationDecisionV1, snapshot: PortfolioSnapshotV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.capitalAllocationsV1.has(value.id)) throw new Error("Capital allocation decision already exists and is immutable");
    if (value.proposals.some((proposal) => this.portfolioProposalsV1.has(proposal.id))) {
      throw new Error("Portfolio allocation proposal already exists and is immutable");
    }
    this.savePortfolioSnapshot(snapshot);
    for (const proposal of value.proposals) {
      this.portfolioProposalsV1.set(proposal.id, structuredClone(proposal));
    }
    this.capitalAllocationsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findCapitalAllocation(id: string): Promise<CapitalAllocationDecisionV1 | undefined> {
    return this.clone(this.capitalAllocationsV1.get(id));
  }
  async savePortfolioRebalanceWithOutbox(value: PortfolioRebalanceReviewV1, snapshot: PortfolioSnapshotV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.portfolioRebalancesV1.has(value.id)) throw new Error("Portfolio rebalance review already exists and is immutable");
    this.savePortfolioSnapshot(snapshot);
    this.portfolioRebalancesV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findPortfolioRebalance(id: string): Promise<PortfolioRebalanceReviewV1 | undefined> {
    return this.clone(this.portfolioRebalancesV1.get(id));
  }
  async saveLearningReviewWithOutbox(value: LearningReviewV1, manifest: ReviewManifestV1, outcome: OutcomeAttributionV1 | undefined, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.learningReviewsV1.has(value.id) || this.learningManifestsV1.has(manifest.id)) throw new Error("Learning Review or Manifest already exists and is immutable");
    if (outcome && this.learningOutcomesV1.has(outcome.id)) throw new Error("Learning Outcome already exists and is immutable");
    this.learningManifestsV1.set(manifest.id, structuredClone(manifest));
    if (outcome) this.learningOutcomesV1.set(outcome.id, structuredClone(outcome));
    this.learningReviewsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findLearningReview(id: string): Promise<LearningReviewV1 | undefined> { return this.clone(this.learningReviewsV1.get(id)); }
  async findLearningManifest(id: string): Promise<ReviewManifestV1 | undefined> { return this.clone(this.learningManifestsV1.get(id)); }
  async saveLearningCohortWithOutbox(value: CohortAnalysisV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.learningCohortsV1.has(value.id)) throw new Error("Learning Cohort already exists and is immutable");
    this.learningCohortsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findLearningCohort(id: string): Promise<CohortAnalysisV1 | undefined> { return this.clone(this.learningCohortsV1.get(id)); }
  async saveLessonCandidateWithOutbox(value: LessonCandidateV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.lessonCandidatesV1.has(value.id)) throw new Error("Lesson Candidate already exists and is immutable");
    this.lessonCandidatesV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findLessonCandidate(id: string): Promise<LessonCandidateV1 | undefined> { return this.clone(this.lessonCandidatesV1.get(id)); }
  async saveInvestmentLessonWithOutbox(value: InvestmentLessonV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.investmentLessonsV1.has(value.id)) throw new Error("Investment Lesson already exists and is immutable");
    this.investmentLessonsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findInvestmentLesson(id: string): Promise<InvestmentLessonV1 | undefined> { return this.clone(this.investmentLessonsV1.get(id)); }
  async saveModelChangeWithOutbox(value: ModelChangeProposalV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.modelChangesV1.has(value.id)) throw new Error("Model Change Proposal already exists and is immutable");
    this.modelChangesV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findModelChange(id: string): Promise<ModelChangeProposalV1 | undefined> { return this.clone(this.modelChangesV1.get(id)); }
  async saveModelValidationWithOutbox(value: ModelValidationResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.modelValidationsV1.has(value.id)) throw new Error("Model Validation Result already exists and is immutable");
    this.modelValidationsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findModelValidation(id: string): Promise<ModelValidationResultV1 | undefined> { return this.clone(this.modelValidationsV1.get(id)); }
  async saveAgentRunWithOutbox(value: AgentRunV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.agentRunsV1.has(value.id)) throw new Error("Agent Run already exists");
    const existing = await this.findAgentRunByIdempotencyKey(value.userId, value.request.idempotencyKey);
    if (existing) {
      if (existing.request.id !== value.request.id || existing.manifest.manifestHash !== value.manifest.manifestHash) throw new Error("Agent Run idempotency conflict");
      throw new Error("Agent Run already exists for idempotency key");
    }
    this.agentRunsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async updateAgentRunWithOutbox(value: AgentRunV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    const existing = this.agentRunsV1.get(value.id);
    if (!existing) throw new Error("Agent Run not found");
    if (["SUCCEEDED", "PARTIAL", "BLOCKED", "FAILED", "TIMED_OUT", "CANCELLED"].includes(existing.status)) throw new Error("Terminal Agent Run is immutable");
    if (existing.userId !== value.userId || existing.manifest.manifestHash !== value.manifest.manifestHash || existing.request.id !== value.request.id) throw new Error("Agent Run lineage or ownership conflict");
    this.agentRunsV1.set(value.id, structuredClone(value));
    if (value.validation) this.agentValidationsV1.set(value.validation.id, structuredClone(value.validation));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findAgentRun(id: string): Promise<AgentRunV1 | undefined> { return this.clone(this.agentRunsV1.get(id)); }
  async findAgentRunByIdempotencyKey(userId: string, key: string): Promise<AgentRunV1 | undefined> {
    return this.clone([...this.agentRunsV1.values()].find((run) => run.userId === userId && run.request.idempotencyKey === key));
  }
  async findAgentValidation(id: string): Promise<AgentValidationResultV1 | undefined> { return this.clone(this.agentValidationsV1.get(id)); }
  async saveDataDeletionRequestWithOutbox(value: DataDeletionRequestV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.dataDeletionRequestsV1.has(value.id)) throw new Error("Data Deletion Request already exists and is immutable");
    if (value.supersedesRequestId) {
      const previous = this.dataDeletionRequestsV1.get(value.supersedesRequestId);
      if (!previous) throw new Error("Data Deletion Request previous revision not found");
      if (previous.userId !== value.userId) throw new Error("Data Deletion Request ownership conflict");
      if ([...this.dataDeletionRequestsV1.values()].some((request) => request.supersedesRequestId === previous.id)) {
        throw new Error("Data Deletion Request revision branch conflict");
      }
    }
    this.dataDeletionRequestsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findDataDeletionRequest(id: string): Promise<DataDeletionRequestV1 | undefined> { return this.clone(this.dataDeletionRequestsV1.get(id)); }
  async saveDatabaseReconciliationWithOutbox(value: DatabaseReconciliationResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.databaseReconciliationsV1.has(value.id)) throw new Error("Database Reconciliation already exists and is immutable");
    this.databaseReconciliationsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findDatabaseReconciliation(id: string): Promise<DatabaseReconciliationResultV1 | undefined> { return this.clone(this.databaseReconciliationsV1.get(id)); }
  async saveScoreModelWithOutbox(value: ScoreModelV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.scoreModelsV1.has(value.id)) throw new Error("Scoring Model already exists and is immutable");
    if (value.status !== "DRAFT") throw new Error("Scoring Model registration must start as DRAFT");
    if (value.supersedesModelVersionId) {
      const previous = this.scoreModelsV1.get(value.supersedesModelVersionId);
      if (!previous) throw new Error("Scoring Model superseded version not found");
      if (previous.userId !== value.userId || previous.scope !== value.scope) throw new Error("Scoring Model superseded ownership or scope mismatch");
    }
    this.scoreModelsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async updateScoreModelWithOutbox(value: ScoreModelV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    const previous = this.scoreModelsV1.get(value.id);
    if (!previous) throw new Error("Scoring Model not found");
    if (previous.userId !== value.userId) throw new Error("Scoring Model ownership mismatch");
    if (previous.modelHash !== value.modelHash || previous.version !== value.version || previous.scope !== value.scope) throw new Error("Scoring Model immutable configuration conflict");
    if (value.status === "ACTIVE") {
      for (const [id, model] of this.scoreModelsV1.entries()) {
        if (id !== value.id && model.userId === value.userId && model.scope === value.scope && model.status === "ACTIVE") this.scoreModelsV1.set(id, { ...model, status: "DEPRECATED" });
      }
    }
    this.scoreModelsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findScoreModel(id: string): Promise<ScoreModelV1 | undefined> { return this.clone(this.scoreModelsV1.get(id)); }
  async saveScorecardWithOutbox(value: ScorecardResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.scorecardsV1.has(value.id)) throw new Error("Scoring Scorecard already exists and is immutable");
    this.scorecardsV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findScorecard(id: string): Promise<ScorecardResultV1 | undefined> { return this.clone(this.scorecardsV1.get(id)); }
  async saveScoreChangeWithOutbox(value: ScoreChangeExplanationV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.scoreChangesV1.has(value.id)) throw new Error("Scoring Change already exists and is immutable");
    this.scoreChangesV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findScoreChange(id: string): Promise<ScoreChangeExplanationV1 | undefined> { return this.clone(this.scoreChangesV1.get(id)); }
  async saveReportTemplateWithOutbox(value: ReportTemplateV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.reportTemplatesV1.has(value.id)) throw new Error("Report Template already exists and is immutable");
    if (value.status !== "DRAFT") throw new Error("Report Template registration must start as DRAFT");
    this.reportTemplatesV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async updateReportTemplateWithOutbox(value: ReportTemplateV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    const previous = this.reportTemplatesV1.get(value.id);
    if (!previous) throw new Error("Report Template not found");
    if (previous.userId !== value.userId) throw new Error("Report Template ownership mismatch");
    if (previous.contentHash !== value.contentHash || previous.version !== value.version || previous.reportType !== value.reportType || previous.locale !== value.locale) {
      throw new Error("Report Template immutable configuration conflict");
    }
    if (value.status === "ACTIVE") {
      for (const [id, template] of this.reportTemplatesV1.entries()) {
        if (id !== value.id && template.userId === value.userId && template.reportType === value.reportType && template.locale === value.locale && template.status === "ACTIVE") {
          this.reportTemplatesV1.set(id, { ...template, status: "DEPRECATED" });
        }
      }
    }
    this.reportTemplatesV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findReportTemplate(id: string): Promise<ReportTemplateV1 | undefined> { return this.clone(this.reportTemplatesV1.get(id)); }
  async saveReportWithArtifactsWithOutbox(value: CanonicalReportV1, artifacts: ReportArtifactV1[], audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.reportsV1.has(value.id)) throw new Error("Report already exists and is immutable");
    if (value.supersedesReportId) {
      const previous = this.reportsV1.get(value.supersedesReportId);
      if (!previous) throw new Error("Report previous Revision not found");
      if (previous.userId !== value.userId || previous.reportType !== value.reportType) throw new Error("Report Revision ownership or type conflict");
      if (value.revision !== previous.revision + 1) throw new Error("Report Revision lineage conflict");
      if ([...this.reportsV1.values()].some((report) => report.supersedesReportId === previous.id)) throw new Error("Report Revision branch conflict");
    } else if (value.revision !== 1) {
      throw new Error("Initial Report revision must be 1");
    }
    for (const artifact of artifacts) {
      if (artifact.reportId !== value.id || artifact.userId !== value.userId || artifact.reportRevision !== value.revision) throw new Error("Report Artifact lineage conflict");
      if (this.reportArtifactsV1.has(artifact.id)) throw new Error("Report Artifact already exists and is immutable");
    }
    this.reportsV1.set(value.id, structuredClone(value));
    for (const artifact of artifacts) this.reportArtifactsV1.set(artifact.id, structuredClone(artifact));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findReport(id: string): Promise<CanonicalReportV1 | undefined> { return this.clone(this.reportsV1.get(id)); }
  async listReportArtifacts(reportId: string): Promise<ReportArtifactV1[]> {
    return this.values(this.reportArtifactsV1).filter((artifact) => artifact.reportId === reportId).sort((left, right) => left.format.localeCompare(right.format));
  }
  async saveReportReplayWithOutbox(value: ReportReplayResultV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.reportReplaysV1.has(value.id)) throw new Error("Report Replay already exists and is immutable");
    this.reportReplaysV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findReportReplay(id: string): Promise<ReportReplayResultV1 | undefined> { return this.clone(this.reportReplaysV1.get(id)); }
  async saveRoadmapPlanWithOutbox(value: RoadmapPlanV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.roadmapPlansV1.has(value.id)) throw new Error("Roadmap Plan already exists and is immutable");
    if (value.supersedesPlanId) {
      const previous = this.roadmapPlansV1.get(value.supersedesPlanId);
      if (!previous) throw new Error("Roadmap previous Revision not found");
      if (previous.userId !== value.userId || value.version !== previous.version + 1) throw new Error("Roadmap Revision lineage conflict");
      if ([...this.roadmapPlansV1.values()].some((plan) => plan.supersedesPlanId === previous.id)) throw new Error("Roadmap Revision branch conflict");
    } else if (value.version !== 1) throw new Error("Initial Roadmap Plan version must be 1");
    this.roadmapPlansV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findRoadmapPlan(id: string): Promise<RoadmapPlanV1 | undefined> { return this.clone(this.roadmapPlansV1.get(id)); }
  async saveReleaseEvidenceWithOutbox(value: ReleaseEvidenceBundleV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.releaseEvidenceV1.has(value.id)) throw new Error("Release Evidence already exists and is immutable");
    const plan = this.roadmapPlansV1.get(value.planId);
    if (!plan || plan.userId !== value.userId) throw new Error("Release Evidence Roadmap lineage conflict");
    this.releaseEvidenceV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findReleaseEvidence(id: string): Promise<ReleaseEvidenceBundleV1 | undefined> { return this.clone(this.releaseEvidenceV1.get(id)); }
  async saveRoadmapReplayWithOutbox(value: RoadmapReplayV1, audit: AuditRecord, outbox: OutboxRecord): Promise<void> {
    if (this.roadmapReplaysV1.has(value.id)) throw new Error("Roadmap Replay already exists and is immutable");
    if (!this.roadmapPlansV1.has(value.planId)) throw new Error("Roadmap Replay source Plan not found");
    this.roadmapReplaysV1.set(value.id, structuredClone(value));
    this.audit.push(structuredClone(audit));
    this.outbox.set(outbox.id, structuredClone(outbox));
  }
  async findRoadmapReplay(id: string): Promise<RoadmapReplayV1 | undefined> { return this.clone(this.roadmapReplaysV1.get(id)); }
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
  private savePortfolioSnapshot(snapshot: PortfolioSnapshotV1): void {
    const existing = this.portfolioSnapshotsV1.get(snapshot.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(snapshot)) throw new Error("Portfolio snapshot id already exists with different content");
    this.portfolioSnapshotsV1.set(snapshot.id, structuredClone(snapshot));
  }
}
