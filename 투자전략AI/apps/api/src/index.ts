import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import {
  allocateCapital,
  allocateCapitalDecimal,
  allocateNewCapitalV1,
  agentStableHash,
  analyzeLearningCohortV1,
  approveInvestmentLessonV1,
  assessPortfolioRebalanceV1,
  buildPortfolioLedger,
  assessDecisionReview,
  attributePerformance,
  composeDecision,
  createCapitalAllocationDecision,
  createAuditRecord,
  createDecisionJournalEntry,
  createDataDeletionRequestV1,
  createDataLineageEdgeV1,
  createDataRetentionPolicyV1,
  createInvestmentLesson,
  createLearningReviewV1,
  createLessonCandidateV1,
  createModelChangeProposalV1,
  createDomainEvent,
  createOutboxRecord,
  evaluateLongTerm,
  evaluateLongTermV1,
  evaluateMomentum,
  evaluateMomentumV1,
  evaluateModelValidationV1,
  finishAgentRunV1,
  evaluateRisk,
  interpretCrossSignal,
  inspectSnapshot,
  generateMarkdownReport,
  generateDecisionReport,
  createCanonicalReportV1,
  createReportRevisionV1,
  renderReportArtifactV1,
  replayReportV1,
  validateReportTemplateV1,
  InMemoryInvestmentOsRepository,
  OutboxPublisher,
  prepareAgentRunV1,
  proposeAllocation,
  proposeAllocationV1,
  requestDecisionModification,
  resolveManualRiskReview,
  replayLongTermEvaluation,
  replayMomentumEvaluation,
  replayAllocationV1,
  runPortfolioStressTestV1,
  runDatabaseReconciliationV1,
  evaluateScorecardV1,
  explainScoreChangeV1,
  rankScorecardsV1,
  validateScoreModelV1,
  transitionScoreModelV1,
  runMomentumScan,
  transitionModelChangeProposalV1,
  transitionDataDeletionRequestV1,
  validateDataLineageGraphV1,
  cancelAgentRunV1,
  validateAgentDefinitionV1,
  validateAgentOutputV1,
  validateAgentPlanV1,
  validateEvidence,
  validateEvaluationEvidence,
  validateLongTermThesis,
  validateMomentumTradePlan,
  validateMomentumTradePlanV1,
  classifyMomentumPrice,
  validatePhilosophyPolicy,
  validatePortfolioPolicyV1,
  DEFAULT_AGENT_DEFINITIONS_V1,
  DEFAULT_PROMPT_TEMPLATES_V1,
  DecisionWorkflow,
  decimalRatio,
  type AllocationProposal,
  type AgentDefinitionV1,
  type AgentOutputValidationInputV1,
  type AgentPlanV1,
  type AgentProviderSelectionV1,
  type AgentRunRequestV1,
  type RiskDecision,
  type LongTermEvaluationInput,
  type LongTermEvaluationResult,
  type MomentumEvaluationInput,
  type MomentumEvaluationResultV1,
  type MomentumScanInput,
  type MomentumTradePlanV1,
  type AllocationRequestV1,
  type ApproveLessonInputV1,
  type CapitalAllocationBatchInputV1,
  type CohortAnalysisInputV1,
  type DataDeletionRequestInputV1,
  type DataDeletionTransitionInputV1,
  type DataLineageEdgeInputV1,
  type DataRetentionPolicyInputV1,
  type DatabaseReconciliationInputV1,
  type ScorecardInputV1,
  type ScoreModelInputV1,
  type ScoreModelV1,
  type LearningReviewInputV1,
  type LessonCandidateInputV1,
  type ModelChangeProposalInputV1,
  type ModelChangeTransitionInputV1,
  type ModelValidationInputV1,
  type PortfolioRebalanceInputV1,
  type PortfolioPolicyV1,
  type PortfolioStressScenarioV1,
  type ReportFormatV1,
  type ReportGenerationInputV1,
  type ReportTemplateInputV1,
} from "@investment-os/core";

const port = Number(process.env.PORT ?? 4000);
const repository = new InMemoryInvestmentOsRepository();
const decisionWorkflow = new DecisionWorkflow(repository);
const outboxPublisher = new OutboxPublisher(repository);
const idempotencyCache = new Map<string, { fingerprint: string; status: number; body: unknown }>();

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function idempotentJson(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  body: unknown,
  operation: () => Promise<{ status: number; body: unknown }>,
): Promise<void> {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || !key.trim()) throw new Error("Idempotency-Key header is required");
  const cacheKey = `${request.method}:${path}:${key}`;
  const fingerprint = JSON.stringify(body);
  const cached = idempotencyCache.get(cacheKey);
  if (cached) {
    if (cached.fingerprint !== fingerprint) {
      json(response, 409, { error: { code: "IDEMPOTENCY_CONFLICT", message: "Idempotency-Key was reused with a different request", retryable: false } });
      return;
    }
    json(response, cached.status, cached.body);
    return;
  }
  const result = await operation();
  idempotencyCache.set(cacheKey, { fingerprint, ...result });
  json(response, result.status, result.body);
}

export const server = createServer(async (request, response) => {
  try {
    const requestId = randomUUID();
    const correlationHeader = request.headers["x-correlation-id"];
    const correlationId = typeof correlationHeader === "string" && correlationHeader.trim() ? correlationHeader : requestId;
    response.setHeader("x-request-id", requestId);
    response.setHeader("x-correlation-id", correlationId);
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const path = url.pathname.startsWith("/api/v1/") ? url.pathname.replace("/api/v1/", "/api/") : url.pathname;
    if (request.method === "GET" && path === "/health") {
      return json(response, 200, { requestId, status: "ok", service: "investment-os-api" });
    }
    if (request.method === "GET" && path.startsWith("/api/decisions/")) {
      const id = decodeURIComponent(path.slice("/api/decisions/".length));
      const decision = await repository.findDecision(id);
      return decision ? json(response, 200, decision) : json(response, 404, { error: "not_found" });
    }
    if (request.method === "GET" && path.startsWith("/api/audit/")) {
      const id = decodeURIComponent(path.slice("/api/audit/".length));
      return json(response, 200, await repository.listAudit(id));
    }
    if (request.method === "GET" && path.startsWith("/api/events/")) {
      const id = decodeURIComponent(path.slice("/api/events/".length));
      return json(response, 200, await repository.listEvents(id));
    }
    if (request.method === "GET" && path.startsWith("/api/long-term/evaluations/")) {
      const id = decodeURIComponent(path.slice("/api/long-term/evaluations/".length));
      const evaluation = await repository.findLongTermEvaluation(id);
      return evaluation ? json(response, 200, evaluation) : json(response, 404, { requestId, error: { code: "EVALUATION_NOT_FOUND", message: "long-term evaluation not found", retryable: false } });
    }
    const companyLongTerm = request.method === "GET" ? path.match(/^\/api\/companies\/([^/]+)\/long-term$/) : null;
    if (companyLongTerm) {
      const evaluation = await repository.findLatestLongTermEvaluation(decodeURIComponent(companyLongTerm[1] ?? ""));
      return evaluation ? json(response, 200, evaluation) : json(response, 404, { requestId, error: { code: "EVALUATION_NOT_FOUND", message: "company long-term evaluation not found", retryable: false } });
    }
    if (request.method === "GET" && path === "/api/long-term/rankings") {
      const profile = url.searchParams.get("profile");
      if (profile !== "CORE" && profile !== "FUTURE_CORE") throw new Error("profile must be CORE or FUTURE_CORE");
      const allEvaluations = await repository.listLongTermEvaluations();
      const modelVersionId = url.searchParams.get("modelVersionId") ?? allEvaluations[0]?.modelVersionId;
      const evaluations = allEvaluations.filter((evaluation) => evaluation.modelVersionId === modelVersionId);
      const latestByCompany = new Map<string, LongTermEvaluationResult>();
      for (const evaluation of evaluations) if (!latestByCompany.has(evaluation.companyId)) latestByCompany.set(evaluation.companyId, evaluation);
      const ranked = [...latestByCompany.values()]
        .map((evaluation) => ({
          evaluationId: evaluation.id,
          companyId: evaluation.companyId,
          profile,
          result: profile === "CORE" ? evaluation.profiles.core : evaluation.profiles.futureCore,
          action: evaluation.action,
          proposedStage: evaluation.proposedStage,
        }))
        .filter((item) => item.result?.eligibility === "ELIGIBLE")
        .sort((left, right) => (right.result?.score.point ?? 0) - (left.result?.score.point ?? 0)
          || (right.result?.confidence.score ?? 0) - (left.result?.confidence.score ?? 0)
          || left.companyId.localeCompare(right.companyId));
      return json(response, 200, { profile, modelVersionId, items: ranked });
    }
    if (request.method === "GET" && path === "/api/long-term/reviews/due") {
      const asOf = url.searchParams.get("asOf") ?? new Date().toISOString();
      const asOfTime = new Date(asOf).getTime();
      if (!Number.isFinite(asOfTime)) throw new Error("asOf must be a valid date");
      const evaluations = await repository.listLongTermEvaluations();
      const due = evaluations
        .filter((evaluation) => evaluation.mode !== "HISTORICAL_REPLAY" && new Date(evaluation.nextReviewAt).getTime() <= asOfTime)
        .sort((left, right) => left.nextReviewAt.localeCompare(right.nextReviewAt));
      return json(response, 200, { asOf, items: due });
    }
    if (request.method === "GET" && path.startsWith("/api/momentum/scans/")) {
      const id = decodeURIComponent(path.slice("/api/momentum/scans/".length));
      const scan = await repository.findMomentumScan(id);
      return scan ? json(response, 200, scan) : json(response, 404, {
        requestId,
        error: { code: "MOMENTUM_SCAN_NOT_FOUND", message: "Momentum scan not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/momentum/evaluations/")) {
      const id = decodeURIComponent(path.slice("/api/momentum/evaluations/".length));
      const evaluation = await repository.findMomentumEvaluation(id);
      return evaluation ? json(response, 200, evaluation) : json(response, 404, {
        requestId,
        error: { code: "MOMENTUM_EVALUATION_NOT_FOUND", message: "Momentum evaluation not found", retryable: false },
      });
    }
    const companyMomentum = request.method === "GET" ? path.match(/^\/api\/companies\/([^/]+)\/momentum$/) : null;
    if (companyMomentum) {
      const evaluation = await repository.findLatestMomentumEvaluation(decodeURIComponent(companyMomentum[1] ?? ""));
      return evaluation ? json(response, 200, evaluation) : json(response, 404, {
        requestId,
        error: { code: "MOMENTUM_EVALUATION_NOT_FOUND", message: "company Momentum evaluation not found", retryable: false },
      });
    }
    if (request.method === "GET" && path === "/api/momentum/rankings") {
      const allEvaluations = await repository.listMomentumEvaluations();
      const modelVersionId = url.searchParams.get("modelVersionId") ?? allEvaluations[0]?.modelVersionId;
      const universePolicyVersionId = url.searchParams.get("universePolicyVersionId") ?? allEvaluations[0]?.universePolicyVersionId;
      const session = url.searchParams.get("session") ?? allEvaluations[0]?.marketPriceAsOf.slice(0, 10);
      const latestBySecurity = new Map<string, MomentumEvaluationResultV1>();
      for (const evaluation of allEvaluations) {
        if (evaluation.modelVersionId !== modelVersionId
          || evaluation.universePolicyVersionId !== universePolicyVersionId
          || evaluation.marketPriceAsOf.slice(0, 10) !== session
          || (evaluation.action !== "ENTER" && evaluation.action !== "WAIT")) continue;
        if (!latestBySecurity.has(evaluation.securityId)) latestBySecurity.set(evaluation.securityId, evaluation);
      }
      const items = [...latestBySecurity.values()]
        .sort((left, right) => right.score.point - left.score.point
          || right.confidence.score - left.confidence.score
          || left.securityId.localeCompare(right.securityId))
        .map((evaluation) => ({
          evaluationId: evaluation.id,
          companyId: evaluation.companyId,
          securityId: evaluation.securityId,
          setupId: evaluation.setup.setupId,
          setupType: evaluation.setup.setupType,
          action: evaluation.action,
          score: evaluation.score,
          confidence: evaluation.confidence,
          marketRegime: evaluation.marketRegime.regime,
          expiresAt: evaluation.expiresAt,
        }));
      return json(response, 200, { modelVersionId, universePolicyVersionId, session, items });
    }
    if (request.method === "GET" && path === "/api/momentum/reviews/due") {
      const asOf = url.searchParams.get("asOf") ?? new Date().toISOString();
      const asOfTime = new Date(asOf).getTime();
      if (!Number.isFinite(asOfTime)) throw new Error("asOf must be a valid date");
      const evaluations = await repository.listMomentumEvaluations();
      const items = evaluations
        .filter((evaluation) => evaluation.mode !== "HISTORICAL_REPLAY" && new Date(evaluation.nextReviewAt).getTime() <= asOfTime)
        .sort((left, right) => left.nextReviewAt.localeCompare(right.nextReviewAt));
      return json(response, 200, { asOf, items });
    }
    if (request.method === "GET" && path.startsWith("/api/momentum/plans/")) {
      const id = decodeURIComponent(path.slice("/api/momentum/plans/".length));
      const plan = await repository.findMomentumTradePlan(id);
      return plan ? json(response, 200, plan) : json(response, 404, {
        requestId,
        error: { code: "MOMENTUM_PLAN_NOT_FOUND", message: "Momentum trade plan not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/allocations/proposals/")) {
      const id = decodeURIComponent(path.slice("/api/allocations/proposals/".length));
      const proposal = await repository.findPortfolioProposal(id);
      return proposal ? json(response, 200, proposal) : json(response, 404, {
        requestId,
        error: { code: "ALLOCATION_PROPOSAL_NOT_FOUND", message: "allocation proposal not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/portfolio/stress-results/")) {
      const id = decodeURIComponent(path.slice("/api/portfolio/stress-results/".length));
      const result = await repository.findPortfolioStress(id);
      return result ? json(response, 200, result) : json(response, 404, {
        requestId,
        error: { code: "PORTFOLIO_STRESS_NOT_FOUND", message: "Portfolio stress result not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/allocations/new-capital/")) {
      const id = decodeURIComponent(path.slice("/api/allocations/new-capital/".length));
      const decision = await repository.findCapitalAllocation(id);
      return decision ? json(response, 200, decision) : json(response, 404, {
        requestId,
        error: { code: "CAPITAL_ALLOCATION_NOT_FOUND", message: "Capital allocation decision not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/portfolio/rebalance-reviews/")) {
      const id = decodeURIComponent(path.slice("/api/portfolio/rebalance-reviews/".length));
      const review = await repository.findPortfolioRebalance(id);
      return review ? json(response, 200, review) : json(response, 404, {
        requestId,
        error: { code: "PORTFOLIO_REBALANCE_NOT_FOUND", message: "Portfolio rebalance review not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/learning/reviews/")) {
      const id = decodeURIComponent(path.slice("/api/learning/reviews/".length));
      const review = await repository.findLearningReview(id);
      return review ? json(response, 200, review) : json(response, 404, {
        requestId, error: { code: "LEARNING_REVIEW_NOT_FOUND", message: "Learning Review not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/learning/lessons/")) {
      const id = decodeURIComponent(path.slice("/api/learning/lessons/".length));
      const lesson = await repository.findInvestmentLesson(id);
      return lesson ? json(response, 200, lesson) : json(response, 404, {
        requestId, error: { code: "LEARNING_LESSON_NOT_FOUND", message: "Investment Lesson not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/learning/cohorts/")) {
      const id = decodeURIComponent(path.slice("/api/learning/cohorts/".length));
      const cohort = await repository.findLearningCohort(id);
      return cohort ? json(response, 200, cohort) : json(response, 404, {
        requestId, error: { code: "LEARNING_COHORT_NOT_FOUND", message: "Learning Cohort not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/learning/model-changes/")) {
      const id = decodeURIComponent(path.slice("/api/learning/model-changes/".length));
      const modelChange = await repository.findModelChange(id);
      return modelChange ? json(response, 200, modelChange) : json(response, 404, {
        requestId, error: { code: "MODEL_CHANGE_NOT_FOUND", message: "Model Change Proposal not found", retryable: false },
      });
    }
    if (request.method === "GET" && path.startsWith("/api/learning/validations/")) {
      const id = decodeURIComponent(path.slice("/api/learning/validations/".length));
      const validation = await repository.findModelValidation(id);
      return validation ? json(response, 200, validation) : json(response, 404, {
        requestId, error: { code: "MODEL_VALIDATION_NOT_FOUND", message: "Model Validation Result not found", retryable: false },
      });
    }
    if (request.method === "GET" && path === "/api/agents/definitions") {
      return json(response, 200, { items: DEFAULT_AGENT_DEFINITIONS_V1 });
    }
    const promptVersions = request.method === "GET" ? path.match(/^\/api\/agents\/prompts\/([^/]+)\/versions$/) : null;
    if (promptVersions) {
      const id = decodeURIComponent(promptVersions[1] ?? "");
      return json(response, 200, { items: DEFAULT_PROMPT_TEMPLATES_V1.filter((prompt) => prompt.id === id).map((prompt) => ({
        id: prompt.id, version: prompt.version, strategyScope: prompt.strategyScope,
        outputSchemaVersion: prompt.outputSchemaVersion, status: prompt.status,
        effectiveFrom: prompt.effectiveFrom, approvedBy: prompt.approvedBy, approvedAt: prompt.approvedAt,
        templateHash: prompt.templateHash,
      })) });
    }
    const agentRunAttempts = request.method === "GET" ? path.match(/^\/api\/agents\/runs\/([^/]+)\/attempts$/) : null;
    if (agentRunAttempts) {
      const run = await repository.findAgentRun(decodeURIComponent(agentRunAttempts[1] ?? ""));
      return run ? json(response, 200, { items: [{ attempt: run.attempt, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, failureCodes: run.failureCodes }] })
        : json(response, 404, { requestId, error: { code: "AGENT_RUN_NOT_FOUND", message: "Agent Run not found", retryable: false } });
    }
    if (request.method === "GET" && path.startsWith("/api/agents/runs/")) {
      const id = decodeURIComponent(path.slice("/api/agents/runs/".length));
      const run = await repository.findAgentRun(id);
      return run ? json(response, 200, run) : json(response, 404, {
        requestId, error: { code: "AGENT_RUN_NOT_FOUND", message: "Agent Run not found", retryable: false },
      });
    }
    if (request.method === "GET" && path === "/api/database/health") {
      return json(response, 200, {
        requestId, status: "ok", adapter: "IN_MEMORY", contractVersion: "database-v1",
        latestMigration: "011_report_system_v1.sql", operationalChecksRequired: ["SUPABASE_CONNECTIVITY", "RLS_E2E", "PITR", "RESTORE_DRILL"],
      });
    }
    if (request.method === "GET" && path === "/api/database/migrations") {
      return json(response, 200, { latest: "011_report_system_v1.sql", items: [
        "001_investment_os_mvp.sql", "002_architecture_v2_2.sql", "003_investment_philosophy_v2_2_1.sql",
        "004_long_term_engine_v1.sql", "005_momentum_engine_v1.sql", "006_portfolio_engine_v1.sql",
        "007_learning_engine_v1.sql", "008_agent_orchestration_v1.sql", "009_database_hardening_v1.sql",
        "010_scoring_system_v1.sql", "011_report_system_v1.sql",
      ] });
    }
    if (request.method === "GET" && path.startsWith("/api/database/deletion-requests/")) {
      const id = decodeURIComponent(path.slice("/api/database/deletion-requests/".length));
      const deletionRequest = await repository.findDataDeletionRequest(id);
      return deletionRequest ? json(response, 200, deletionRequest) : json(response, 404, { requestId, error: { code: "DATABASE_RESOURCE_NOT_FOUND", message: "Data Deletion Request not found", retryable: false } });
    }
    if (request.method === "GET" && path.startsWith("/api/database/reconciliations/")) {
      const id = decodeURIComponent(path.slice("/api/database/reconciliations/".length));
      const result = await repository.findDatabaseReconciliation(id);
      return result ? json(response, 200, result) : json(response, 404, { requestId, error: { code: "DATABASE_RESOURCE_NOT_FOUND", message: "Database Reconciliation not found", retryable: false } });
    }
    if (request.method === "GET" && path.startsWith("/api/scoring/models/")) {
      const id = decodeURIComponent(path.slice("/api/scoring/models/".length));
      const model = await repository.findScoreModel(id);
      return model ? json(response, 200, model) : json(response, 404, { requestId, error: { code: "SCORING_RESOURCE_NOT_FOUND", message: "Scoring Model not found", retryable: false } });
    }
    if (request.method === "GET" && path.startsWith("/api/scoring/scorecards/")) {
      const id = decodeURIComponent(path.slice("/api/scoring/scorecards/".length));
      const scorecard = await repository.findScorecard(id);
      return scorecard ? json(response, 200, scorecard) : json(response, 404, { requestId, error: { code: "SCORING_RESOURCE_NOT_FOUND", message: "Scoring Scorecard not found", retryable: false } });
    }
    if (request.method === "GET" && path.startsWith("/api/scoring/changes/")) {
      const id = decodeURIComponent(path.slice("/api/scoring/changes/".length));
      const change = await repository.findScoreChange(id);
      return change ? json(response, 200, change) : json(response, 404, { requestId, error: { code: "SCORING_RESOURCE_NOT_FOUND", message: "Scoring Change not found", retryable: false } });
    }
    if (request.method === "GET" && path.startsWith("/api/reports/templates/")) {
      const id = decodeURIComponent(path.slice("/api/reports/templates/".length));
      const template = await repository.findReportTemplate(id);
      return template ? json(response, 200, template) : json(response, 404, { requestId, error: { code: "REPORT_RESOURCE_NOT_FOUND", message: "Report Template not found", retryable: false } });
    }
    const reportArtifact = request.method === "GET" ? path.match(/^\/api\/reports\/([^/]+)\/artifacts\/([^/]+)$/) : null;
    if (reportArtifact) {
      const reportId = decodeURIComponent(reportArtifact[1] ?? "");
      const format = decodeURIComponent(reportArtifact[2] ?? "").toUpperCase();
      const artifact = (await repository.listReportArtifacts(reportId)).find((item) => item.format === format);
      return artifact ? json(response, 200, artifact) : json(response, 404, { requestId, error: { code: "REPORT_RESOURCE_NOT_FOUND", message: "Report Artifact not found", retryable: false } });
    }
    const reportArtifacts = request.method === "GET" ? path.match(/^\/api\/reports\/([^/]+)\/artifacts$/) : null;
    if (reportArtifacts) {
      const reportId = decodeURIComponent(reportArtifacts[1] ?? "");
      const report = await repository.findReport(reportId);
      return report ? json(response, 200, { items: await repository.listReportArtifacts(reportId) }) : json(response, 404, { requestId, error: { code: "REPORT_RESOURCE_NOT_FOUND", message: "Report not found", retryable: false } });
    }
    const reportView = request.method === "GET" ? path.match(/^\/api\/reports\/([^/]+)$/) : null;
    if (reportView) {
      const report = await repository.findReport(decodeURIComponent(reportView[1] ?? ""));
      return report ? json(response, 200, report) : json(response, 404, { requestId, error: { code: "REPORT_RESOURCE_NOT_FOUND", message: "Report not found", retryable: false } });
    }
    const portfolioExposure = request.method === "GET" ? path.match(/^\/api\/portfolios\/([^/]+)\/exposures$/) : null;
    if (portfolioExposure) {
      const portfolioId = decodeURIComponent(portfolioExposure[1] ?? "");
      const snapshot = await repository.findLatestPortfolioSnapshot(portfolioId);
      if (!snapshot) return json(response, 404, { requestId, error: { code: "PORTFOLIO_NOT_FOUND", message: "Portfolio snapshot not found", retryable: false } });
      const ledger = buildPortfolioLedger(snapshot);
      return json(response, 200, { portfolioId, portfolioSnapshotId: snapshot.id, asOf: snapshot.asOf, exposures: ledger.exposures, weights: ledger.weights });
    }
    const portfolioOpenRisk = request.method === "GET" ? path.match(/^\/api\/portfolios\/([^/]+)\/open-risk$/) : null;
    if (portfolioOpenRisk) {
      const portfolioId = decodeURIComponent(portfolioOpenRisk[1] ?? "");
      const snapshot = await repository.findLatestPortfolioSnapshot(portfolioId);
      if (!snapshot) return json(response, 404, { requestId, error: { code: "PORTFOLIO_NOT_FOUND", message: "Portfolio snapshot not found", retryable: false } });
      const ledger = buildPortfolioLedger(snapshot);
      return json(response, 200, {
        portfolioId, portfolioSnapshotId: snapshot.id, asOf: snapshot.asOf,
        momentumOpenRiskBase: ledger.momentumOpenRiskBase,
        momentumOpenRiskBySector: ledger.momentumOpenRiskBySector,
        momentumOpenRiskByTheme: ledger.momentumOpenRiskByTheme,
        portfolioValueBase: ledger.investableNavBase,
        openRiskWeight: decimalRatio(ledger.momentumOpenRiskBase, ledger.investableNavBase),
      });
    }
    const portfolioView = request.method === "GET" ? path.match(/^\/api\/portfolios\/([^/]+)$/) : null;
    if (portfolioView) {
      const portfolioId = decodeURIComponent(portfolioView[1] ?? "");
      const snapshot = await repository.findLatestPortfolioSnapshot(portfolioId);
      if (!snapshot) return json(response, 404, { requestId, error: { code: "PORTFOLIO_NOT_FOUND", message: "Portfolio snapshot not found", retryable: false } });
      return json(response, 200, { snapshot, ledger: buildPortfolioLedger(snapshot) });
    }
    if (request.method !== "POST") return json(response, 404, { error: "not_found" });

    const body = await readBody(request);
    if (path === "/api/reports/templates/validate") {
      return await idempotentJson(request, response, path, body, async () => {
        const template = validateReportTemplateV1(body as ReportTemplateInputV1);
        const occurredAt = new Date().toISOString();
        const event = createDomainEvent({ id: randomUUID(), type: "ReportTemplateValidated", occurredAt, aggregateId: template.id, correlationId, schemaVersion: "1",
          payload: { templateId: template.id, reportType: template.reportType, version: template.version, status: template.status, contentHash: template.contentHash } });
        const audit = createAuditRecord({ id: randomUUID(), occurredAt, actorId: "report-template-validator-v1", action: "REPORT_TEMPLATE_VALIDATED",
          entityType: "ReportTemplateV1", entityId: template.id, reason: template.status, after: template,
          metadata: { reportType: template.reportType, version: template.version, status: template.status, contentHash: template.contentHash, correlationId } });
        await repository.saveReportTemplateWithOutbox(template, audit, createOutboxRecord(event));
        return { status: 201, body: template };
      });
    }
    if (path === "/api/reports") {
      return await idempotentJson(request, response, path, body, async () => {
        const raw = body as Omit<ReportGenerationInputV1, "template"> & { templateId: string };
        const template = await repository.findReportTemplate(raw.templateId);
        if (!template) throw new Error("Report Template not found");
        const report = createCanonicalReportV1({ ...raw, template });
        const artifacts = [];
        const failedFormats: Array<{ format: ReportFormatV1; code: string }> = [];
        for (const format of raw.request.requestedFormats) {
          try { artifacts.push(renderReportArtifactV1(report, format)); }
          catch { failedFormats.push({ format, code: `REPORT_${format}_RENDERER_UNAVAILABLE` }); }
        }
        const eventType = report.status === "BLOCKED" ? "ReportGenerationBlocked" : "ReportGenerated";
        const event = createDomainEvent({ id: randomUUID(), type: eventType, occurredAt: report.generatedAt, aggregateId: report.id, correlationId, schemaVersion: "1",
          payload: { reportId: report.id, reportType: report.reportType, status: report.status, revision: report.revision, artifactFormats: artifacts.map((artifact) => artifact.format), failedFormats, resultHash: report.resultHash } });
        const audit = createAuditRecord({ id: randomUUID(), occurredAt: report.generatedAt, actorId: report.userId, action: "REPORT_GENERATED",
          entityType: "CanonicalReportV1", entityId: report.id, reason: report.status, after: report,
          metadata: { reportType: report.reportType, status: report.status, revision: report.revision, artifactCount: artifacts.length, resultHash: report.resultHash, correlationId } });
        await repository.saveReportWithArtifactsWithOutbox(report, artifacts, audit, createOutboxRecord(event));
        return { status: 201, body: { report, artifacts, failedFormats } };
      });
    }
    const reportRevision = path.match(/^\/api\/reports\/([^/]+)\/revisions$/);
    if (reportRevision) {
      return await idempotentJson(request, response, path, body, async () => {
        const previous = await repository.findReport(decodeURIComponent(reportRevision[1] ?? ""));
        if (!previous) throw new Error("Report previous Revision not found");
        const raw = body as Omit<ReportGenerationInputV1, "template" | "revision" | "supersedesReportId"> & { templateId: string };
        const template = await repository.findReportTemplate(raw.templateId);
        if (!template) throw new Error("Report Template not found");
        const report = createReportRevisionV1(previous, { ...raw, template, revision: previous.revision + 1, supersedesReportId: previous.id });
        const artifacts = raw.request.requestedFormats.filter((format) => format !== "PDF").map((format) => renderReportArtifactV1(report, format));
        const event = createDomainEvent({ id: randomUUID(), type: "ReportSuperseded", occurredAt: report.generatedAt, aggregateId: report.id, correlationId, schemaVersion: "1",
          payload: { reportId: report.id, supersedesReportId: previous.id, revision: report.revision, status: report.status, resultHash: report.resultHash } });
        const audit = createAuditRecord({ id: randomUUID(), occurredAt: report.generatedAt, actorId: report.userId, action: "REPORT_REVISED",
          entityType: "CanonicalReportV1", entityId: report.id, reason: `Revision ${previous.revision} -> ${report.revision}`, before: previous, after: report,
          metadata: { reportType: report.reportType, revision: report.revision, previousId: previous.id, resultHash: report.resultHash, correlationId } });
        await repository.saveReportWithArtifactsWithOutbox(report, artifacts, audit, createOutboxRecord(event));
        return { status: 201, body: { report, artifacts } };
      });
    }
    const reportReplay = path.match(/^\/api\/reports\/([^/]+)\/replays$/);
    if (reportReplay) {
      return await idempotentJson(request, response, path, body, async () => {
        const report = await repository.findReport(decodeURIComponent(reportReplay[1] ?? ""));
        if (!report) throw new Error("Report not found");
        const input = body as { id: string; userId: string; formats: ReportFormatV1[]; replayedAt: string };
        if (input.userId !== report.userId) throw new Error("Report ownership mismatch");
        const replay = replayReportV1({ id: input.id, report, formats: input.formats, replayedAt: input.replayedAt });
        const event = createDomainEvent({ id: randomUUID(), type: "ReportGenerated", occurredAt: replay.replayedAt, aggregateId: replay.id, correlationId, schemaVersion: "1",
          payload: { replayId: replay.id, replayOfReportId: replay.replayOfReportId, matches: replay.matches, resultHash: replay.resultHash } });
        const audit = createAuditRecord({ id: randomUUID(), occurredAt: replay.replayedAt, actorId: replay.userId, action: "REPORT_REPLAY_COMPLETED",
          entityType: "ReportReplayResultV1", entityId: replay.id, reason: replay.matches ? "MATCH" : "MISMATCH", after: replay,
          metadata: { replayOfReportId: replay.replayOfReportId, matches: replay.matches, resultHash: replay.resultHash, correlationId } });
        await repository.saveReportReplayWithOutbox(replay, audit, createOutboxRecord(event));
        return { status: 201, body: replay };
      });
    }
    if (path === "/api/scoring/models/validate") {
      return await idempotentJson(request, response, path, body, async () => {
        const model = validateScoreModelV1(body as ScoreModelInputV1);
        const occurredAt = model.approvedAt ?? model.effectiveFrom;
        const event = createDomainEvent({
          id: randomUUID(), type: "ScoringModelValidated", occurredAt, aggregateId: model.id,
          correlationId, schemaVersion: "1", modelVersionId: model.version,
          payload: { modelId: model.id, version: model.version, scope: model.scope, status: model.status, factorCount: model.factorDefinitions.length, modelHash: model.modelHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt, actorId: model.approvedBy ?? model.userId,
          action: "SCORING_MODEL_VALIDATED", entityType: "ScoreModelV1", entityId: model.id,
          reason: model.changeReason, after: model, metadata: { scope: model.scope, version: model.version, status: model.status, modelHash: model.modelHash, correlationId },
        });
        await repository.saveScoreModelWithOutbox(model, audit, createOutboxRecord(event));
        return { status: 201, body: model };
      });
    }
    const scoreModelTransition = path.match(/^\/api\/scoring\/models\/([^/]+)\/transitions$/);
    if (scoreModelTransition) {
      return await idempotentJson(request, response, path, body, async () => {
        const previous = await repository.findScoreModel(decodeURIComponent(scoreModelTransition[1] ?? ""));
        if (!previous) throw new Error("Scoring Model not found");
        const input = body as { nextStatus: ScoreModelV1["status"]; actorId: string; transitionedAt: string };
        const model = transitionScoreModelV1({ previous, nextStatus: input.nextStatus, actorId: input.actorId, transitionedAt: input.transitionedAt });
        const event = createDomainEvent({ id: randomUUID(), type: "ScoringModelTransitioned", occurredAt: input.transitionedAt, aggregateId: model.id, correlationId, schemaVersion: "1", modelVersionId: model.version,
          payload: { modelId: model.id, version: model.version, scope: model.scope, from: previous.status, to: model.status, modelHash: model.modelHash } });
        const audit = createAuditRecord({ id: randomUUID(), occurredAt: input.transitionedAt, actorId: input.actorId,
          action: "SCORING_MODEL_TRANSITIONED", entityType: "ScoreModelV1", entityId: model.id, reason: `${previous.status} -> ${model.status}`, before: previous, after: model,
          metadata: { scope: model.scope, version: model.version, from: previous.status, to: model.status, modelHash: model.modelHash, correlationId } });
        await repository.updateScoreModelWithOutbox(model, audit, createOutboxRecord(event));
        return { status: 201, body: model };
      });
    }
    if (path === "/api/scoring/scorecards/evaluate" || path === "/api/scoring/replays") {
      return await idempotentJson(request, response, path, body, async () => {
        const raw = body as Omit<ScorecardInputV1, "model"> & { modelId: string };
        const model = await repository.findScoreModel(raw.modelId);
        if (!model) throw new Error("Scoring Model not found");
        const { modelId: _modelId, ...scorecardInput } = raw;
        const result = evaluateScorecardV1({ ...scorecardInput, model, mode: path === "/api/scoring/replays" ? "HISTORICAL_REPLAY" : scorecardInput.mode });
        const replay = path === "/api/scoring/replays";
        const event = createDomainEvent({
          id: randomUUID(), type: replay ? "ScoringReplayCompleted" : result.status === "SCORED" ? "ScorecardEvaluated" : "ScorecardBlocked",
          occurredAt: result.evaluatedAt, aggregateId: result.id, correlationId, schemaVersion: "1", modelVersionId: result.modelVersionId,
          payload: { scorecardId: result.id, scope: result.scope, status: result.status, score: result.score?.point, confidence: result.confidence.score, blockerCodes: result.blockerCodes, resultHash: result.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: result.evaluatedAt, actorId: result.userId,
          action: replay ? "SCORING_REPLAY_COMPLETED" : "SCORING_SCORECARD_EVALUATED", entityType: "ScorecardResultV1", entityId: result.id,
          reason: result.status, after: result, metadata: { scope: result.scope, modelVersionId: result.modelVersionId, status: result.status, resultHash: result.resultHash, correlationId },
        });
        await repository.saveScorecardWithOutbox(result, audit, createOutboxRecord(event));
        return { status: 201, body: result };
      });
    }
    if (path === "/api/scoring/rankings/validate") {
      const input = body as { scorecardIds: string[] };
      if (!Array.isArray(input.scorecardIds) || input.scorecardIds.length === 0) throw new Error("Scoring Ranking requires scorecardIds");
      const scorecards = await Promise.all(input.scorecardIds.map((id) => repository.findScorecard(id)));
      if (scorecards.some((item) => !item)) throw new Error("Scoring Scorecard not found");
      return json(response, 200, rankScorecardsV1(scorecards as NonNullable<(typeof scorecards)[number]>[]));
    }
    if (path === "/api/scoring/changes/explain") {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as { id: string; userId: string; previousScorecardId: string; currentScorecardId: string; explainedAt: string };
        const [previous, current] = await Promise.all([repository.findScorecard(input.previousScorecardId), repository.findScorecard(input.currentScorecardId)]);
        if (!previous || !current) throw new Error("Scoring Scorecard not found");
        const result = explainScoreChangeV1({ id: input.id, userId: input.userId, previous, current, explainedAt: input.explainedAt });
        const event = createDomainEvent({ id: randomUUID(), type: "ScoreChangeExplained", occurredAt: result.explainedAt, aggregateId: result.id, correlationId, schemaVersion: "1", payload: { changeId: result.id, comparisonStatus: result.comparisonStatus, pointDelta: result.pointDelta, confidenceDelta: result.confidenceDelta, resultHash: result.resultHash } });
        const audit = createAuditRecord({ id: randomUUID(), occurredAt: result.explainedAt, actorId: result.userId, action: "SCORING_CHANGE_EXPLAINED", entityType: "ScoreChangeExplanationV1", entityId: result.id, reason: result.comparisonStatus, after: result, metadata: { previousScorecardId: result.previousScorecardId, currentScorecardId: result.currentScorecardId, comparisonStatus: result.comparisonStatus, resultHash: result.resultHash, correlationId } });
        await repository.saveScoreChangeWithOutbox(result, audit, createOutboxRecord(event));
        return { status: 201, body: result };
      });
    }
    if (path === "/api/database/lineage/validate") {
      const input = body as { edges: DataLineageEdgeInputV1[] };
      if (!Array.isArray(input.edges)) throw new Error("Data Lineage edges must be an array");
      return json(response, 200, { edges: validateDataLineageGraphV1(input.edges.map(createDataLineageEdgeV1)) });
    }
    if (path === "/api/database/retention/policies/validate") {
      return json(response, 200, createDataRetentionPolicyV1(body as DataRetentionPolicyInputV1));
    }
    if (path === "/api/database/reconciliations/validate") {
      return await idempotentJson(request, response, path, body, async () => {
        const result = runDatabaseReconciliationV1(body as DatabaseReconciliationInputV1);
        const event = createDomainEvent({
          id: randomUUID(), type: "DatabaseReconciliationCompleted", occurredAt: result.executedAt,
          aggregateId: result.id, correlationId, schemaVersion: "1",
          payload: { reconciliationId: result.id, scope: result.scope, status: result.status, findingCount: result.findings.length, resultHash: result.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: result.executedAt, actorId: "database-reconciler-v1",
          action: "DATABASE_RECONCILIATION_COMPLETED", entityType: "DatabaseReconciliationResultV1", entityId: result.id,
          reason: result.status, after: result, metadata: { scope: result.scope, findingCount: result.findings.length, resultHash: result.resultHash, correlationId },
        });
        await repository.saveDatabaseReconciliationWithOutbox(result, audit, createOutboxRecord(event));
        return { status: 201, body: result };
      });
    }
    if (path === "/api/database/deletion-requests") {
      return await idempotentJson(request, response, path, body, async () => {
        const deletionRequest = createDataDeletionRequestV1(body as DataDeletionRequestInputV1);
        const event = createDomainEvent({
          id: randomUUID(), type: "DataDeletionRequested", occurredAt: deletionRequest.requestedAt,
          aggregateId: deletionRequest.id, correlationId, schemaVersion: "1",
          payload: { deletionRequestId: deletionRequest.id, status: deletionRequest.status, targetCount: deletionRequest.targets.length, blockerCodes: deletionRequest.blockerCodes, resultHash: deletionRequest.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: deletionRequest.requestedAt, actorId: deletionRequest.requestedBy,
          action: "DATA_DELETION_REQUESTED", entityType: "DataDeletionRequestV1", entityId: deletionRequest.id,
          reason: deletionRequest.reason, after: deletionRequest,
          metadata: { status: deletionRequest.status, targetCount: deletionRequest.targets.length, resultHash: deletionRequest.resultHash, correlationId },
        });
        await repository.saveDataDeletionRequestWithOutbox(deletionRequest, audit, createOutboxRecord(event));
        return { status: 201, body: deletionRequest };
      });
    }
    const deletionTransition = path.match(/^\/api\/database\/deletion-requests\/([^/]+)\/transitions$/);
    if (deletionTransition) {
      return await idempotentJson(request, response, path, body, async () => {
        const previous = await repository.findDataDeletionRequest(decodeURIComponent(deletionTransition[1] ?? ""));
        if (!previous) throw new Error("Data Deletion Request not found");
        const raw = body as Omit<DataDeletionTransitionInputV1, "previous">;
        const transitioned = transitionDataDeletionRequestV1({ ...raw, previous });
        const event = createDomainEvent({
          id: randomUUID(), type: "DataDeletionTransitioned", occurredAt: transitioned.transitionedAt,
          aggregateId: transitioned.id, correlationId, schemaVersion: "1",
          payload: { deletionRequestId: transitioned.id, supersedesRequestId: previous.id, status: transitioned.status, blockerCodes: transitioned.blockerCodes, resultHash: transitioned.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: transitioned.transitionedAt, actorId: transitioned.reviewedBy ?? "database-operator",
          action: "DATA_DELETION_TRANSITIONED", entityType: "DataDeletionRequestV1", entityId: transitioned.id,
          reason: `${previous.status} -> ${transitioned.status}`, before: previous, after: transitioned,
          metadata: { previousId: previous.id, from: previous.status, to: transitioned.status, resultHash: transitioned.resultHash, correlationId },
        });
        await repository.saveDataDeletionRequestWithOutbox(transitioned, audit, createOutboxRecord(event));
        return { status: 201, body: transitioned };
      });
    }
    if (path === "/api/agents/definitions/validate") {
      return json(response, 200, validateAgentDefinitionV1(body as AgentDefinitionV1, DEFAULT_AGENT_DEFINITIONS_V1));
    }
    if (path === "/api/agents/plans/validate") {
      return json(response, 200, validateAgentPlanV1(body as AgentPlanV1, DEFAULT_AGENT_DEFINITIONS_V1));
    }
    if (path === "/api/agents/runs" || path === "/api/agents/replays") {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as { runId: string; manifestId: string; request: AgentRunRequestV1; provider: AgentProviderSelectionV1; codeVersion: string };
        if (input.provider.providerId !== "scripted" || input.provider.providerVersion !== "1") throw new Error("Agent Provider is not enabled in MVP runtime");
        const definition = DEFAULT_AGENT_DEFINITIONS_V1.find((item) => item.id === input.request.agentDefinitionId && item.version === input.request.agentDefinitionVersion);
        if (!definition) throw new Error("Agent Definition not found");
        const prompt = DEFAULT_PROMPT_TEMPLATES_V1.find((item) => item.id === definition.promptTemplateId && item.version === definition.promptVersion);
        if (!prompt) throw new Error("Agent Prompt not found");
        if (path === "/api/agents/replays") {
          if (!input.request.replayOfRunId) throw new Error("Agent Replay requires replayOfRunId");
          const previous = await repository.findAgentRun(input.request.replayOfRunId);
          if (!previous) throw new Error("Agent Replay source Run not found");
          if (previous.userId !== input.request.userId) throw new Error("Agent Replay ownership conflict");
          const previousInputs = { strategyScope: previous.request.strategyScope, asOf: previous.request.asOf, inputSnapshotIds: previous.request.inputSnapshotIds, evidenceIds: previous.request.evidenceIds, context: previous.request.context };
          const replayInputs = { strategyScope: input.request.strategyScope, asOf: input.request.asOf, inputSnapshotIds: input.request.inputSnapshotIds, evidenceIds: input.request.evidenceIds, context: input.request.context };
          if (agentStableHash(previousInputs) !== agentStableHash(replayInputs)) throw new Error("Agent Replay input lineage conflict");
        } else if (input.request.replayOfRunId) throw new Error("Agent Run replayOfRunId is only allowed on Replay API");
        const run = prepareAgentRunV1({ ...input, definition, prompt });
        const existing = await repository.findAgentRunByIdempotencyKey(run.userId, run.request.idempotencyKey);
        if (existing) {
          if (existing.request.id !== run.request.id || existing.manifest.manifestHash !== run.manifest.manifestHash) throw new Error("Agent Run idempotency conflict");
          return { status: 201, body: existing };
        }
        const event = createDomainEvent({
          id: randomUUID(), type: "AgentRunRequested", occurredAt: run.createdAt,
          aggregateId: run.id, correlationId, schemaVersion: "1",
          payload: { runId: run.id, agentDefinitionId: run.manifest.agentDefinitionId, agentDefinitionVersion: run.manifest.agentDefinitionVersion, strategyScope: run.request.strategyScope, manifestHash: run.manifest.manifestHash, replayOfRunId: run.request.replayOfRunId },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: run.createdAt, actorId: run.request.requestedBy.actorId,
          action: "AGENT_RUN_REQUESTED", entityType: "AgentRunV1", entityId: run.id,
          reason: run.request.purpose, after: run,
          metadata: { agentDefinitionId: run.manifest.agentDefinitionId, agentDefinitionVersion: run.manifest.agentDefinitionVersion, providerId: run.manifest.providerId, modelId: run.manifest.modelId, manifestHash: run.manifest.manifestHash, correlationId },
        });
        await repository.saveAgentRunWithOutbox(run, audit, createOutboxRecord(event));
        return { status: 201, body: run };
      });
    }
    if (path === "/api/agents/outputs/validate") {
      return await idempotentJson(request, response, path, body, async () => {
        const raw = body as Omit<AgentOutputValidationInputV1, "run"> & { runId: string; finishedAt: string };
        const run = await repository.findAgentRun(raw.runId);
        if (!run) throw new Error("Agent Run not found");
        const validation = validateAgentOutputV1({
          id: raw.id, run, output: raw.output, evidence: raw.evidence,
          deterministicFacts: raw.deterministicFacts, validatedAt: raw.validatedAt, policyVersion: raw.policyVersion,
        });
        const completed = finishAgentRunV1(run, { output: raw.output, validation, finishedAt: raw.finishedAt });
        const event = createDomainEvent({
          id: randomUUID(), type: validation.verdict === "REJECTED" ? "AgentOutputRejected" : "AgentOutputValidated",
          occurredAt: raw.finishedAt, aggregateId: completed.id, correlationId, schemaVersion: "1",
          payload: { runId: completed.id, status: completed.status, validationId: validation.id, verdict: validation.verdict, acceptedClaimIds: validation.acceptedClaimIds, rejectedClaimIds: validation.rejectedClaimIds, resultHash: completed.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: raw.finishedAt, actorId: "agent-orchestrator-v1",
          action: "AGENT_OUTPUT_VALIDATED", entityType: "AgentRunV1", entityId: completed.id,
          reason: validation.verdict, before: run, after: completed,
          metadata: { validationId: validation.id, verdict: validation.verdict, resultHash: validation.resultHash, manifestHash: run.manifest.manifestHash, correlationId },
        });
        await repository.updateAgentRunWithOutbox(completed, audit, createOutboxRecord(event));
        return { status: 201, body: completed };
      });
    }
    const agentRunCancel = path.match(/^\/api\/agents\/runs\/([^/]+)\/cancel$/);
    if (agentRunCancel) {
      return await idempotentJson(request, response, path, body, async () => {
        const run = await repository.findAgentRun(decodeURIComponent(agentRunCancel[1] ?? ""));
        if (!run) throw new Error("Agent Run not found");
        const input = body as { finishedAt: string; actorId: string };
        if (!input.actorId.trim()) throw new Error("Agent Run cancellation actor is required");
        const cancelled = cancelAgentRunV1(run, input.finishedAt);
        const event = createDomainEvent({ id: randomUUID(), type: "AgentRunCancelled", occurredAt: input.finishedAt, aggregateId: run.id, correlationId, schemaVersion: "1", payload: { runId: run.id, status: cancelled.status, resultHash: cancelled.resultHash } });
        const audit = createAuditRecord({ id: randomUUID(), occurredAt: input.finishedAt, actorId: input.actorId, action: "AGENT_RUN_CANCELLED", entityType: "AgentRunV1", entityId: run.id, reason: "CANCELLED", before: run, after: cancelled, metadata: { resultHash: cancelled.resultHash, correlationId } });
        await repository.updateAgentRunWithOutbox(cancelled, audit, createOutboxRecord(event));
        return { status: 201, body: cancelled };
      });
    }
    if (path === "/v1/evaluations/long-term") {
      return json(response, 200, evaluateLongTerm(body as Parameters<typeof evaluateLongTerm>[0]));
    }
    if (path === "/api/long-term/evaluations") {
      return await idempotentJson(request, response, path, body, async () => {
        const result = evaluateLongTermV1(body as LongTermEvaluationInput);
        const event = createDomainEvent({
          id: randomUUID(),
          type: "LongTermEvaluationCompleted",
          occurredAt: result.evaluatedAt,
          aggregateId: result.id,
          correlationId,
          schemaVersion: "1",
          modelVersionId: result.modelVersionId,
          payload: {
            evaluationId: result.id,
            companyId: result.companyId,
            primaryProfile: result.primaryProfile,
            stageBefore: result.stageBefore,
            proposedStage: result.proposedStage,
            action: result.action,
            coreScore: result.profiles.core?.score.point,
            futureCoreScore: result.profiles.futureCore?.score.point,
            confidenceScore: result.confidence.score,
            thesisStatus: result.thesisAssessment.status,
            hardRisk: result.gateResults.some((gate) => gate.gateId === "HARD_RISK_CLEAR" && gate.status !== "PASSED"),
            nextReviewAt: result.nextReviewAt,
          },
        });
        const audit = createAuditRecord({
          id: randomUUID(),
          occurredAt: result.evaluatedAt,
          actorId: "long-term-engine",
          action: "LONG_TERM_EVALUATED",
          entityType: "LongTermEvaluation",
          entityId: result.id,
          reason: `Long-term ${result.mode} completed`,
          after: result,
          metadata: {
            modelVersionId: result.modelVersionId,
            philosophyVersionId: result.philosophyVersionId,
            resultHash: result.resultHash,
            correlationId,
          },
        });
        await repository.saveLongTermEvaluationWithOutbox(result, audit, createOutboxRecord(event));
        return { status: 201, body: result };
      });
    }
    if (path === "/api/long-term/replays") {
      return await idempotentJson(request, response, path, body, async () => ({
        status: 200,
        body: replayLongTermEvaluation(body as LongTermEvaluationInput),
      }));
    }
    if (path === "/api/momentum/scans") {
      return await idempotentJson(request, response, path, body, async () => {
        const scan = runMomentumScan(body as MomentumScanInput);
        const event = createDomainEvent({
          id: randomUUID(), type: "MomentumUniverseUpdated", occurredAt: scan.createdAt,
          aggregateId: scan.id, correlationId, schemaVersion: "1", modelVersionId: scan.modelVersionId,
          payload: {
            scanId: scan.id, session: scan.session, status: scan.status,
            requestedCount: scan.requestedCount, succeededCount: scan.succeededCount,
            failedCount: scan.failedCount, universePolicyVersionId: scan.universePolicyVersionId,
          },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: scan.createdAt, actorId: "momentum-scanner-v1",
          action: "MOMENTUM_SCAN_COMPLETED", entityType: "MomentumScan", entityId: scan.id,
          reason: `Momentum scan ${scan.status.toLowerCase()} for ${scan.session}`, after: scan,
          metadata: {
            modelVersionId: scan.modelVersionId, universePolicyVersionId: scan.universePolicyVersionId,
            resultHash: scan.resultHash, correlationId,
          },
        });
        await repository.saveMomentumScanWithOutbox(scan, audit, createOutboxRecord(event));
        return { status: 201, body: scan };
      });
    }
    if (path === "/api/momentum/evaluations") {
      return await idempotentJson(request, response, path, body, async () => {
        const result = evaluateMomentumV1(body as MomentumEvaluationInput);
        const event = createDomainEvent({
          id: randomUUID(),
          type: "MomentumEvaluationCompleted",
          occurredAt: result.evaluatedAt,
          aggregateId: result.id,
          correlationId,
          schemaVersion: "1",
          modelVersionId: result.modelVersionId,
          payload: {
            evaluationId: result.id,
            companyId: result.companyId,
            securityId: result.securityId,
            setupId: result.setup.setupId,
            setupType: result.setup.setupType,
            score: result.score,
            confidence: result.confidence.score,
            regime: result.marketRegime.regime,
            action: result.action,
            planId: result.tradePlan?.id,
            expiresAt: result.expiresAt,
            universePolicyVersionId: result.universePolicyVersionId,
            setupDefinitionVersion: result.setupDefinitionVersion,
            nextReviewAt: result.nextReviewAt,
          },
        });
        const audit = createAuditRecord({
          id: randomUUID(),
          occurredAt: result.evaluatedAt,
          actorId: "momentum-engine-v1",
          action: "MOMENTUM_EVALUATED",
          entityType: "MomentumEvaluation",
          entityId: result.id,
          reason: `Momentum ${result.mode} completed with action ${result.action}`,
          after: result,
          metadata: {
            modelVersionId: result.modelVersionId,
            philosophyVersionId: result.philosophyVersionId,
            universePolicyVersionId: result.universePolicyVersionId,
            setupDefinitionVersion: result.setupDefinitionVersion,
            resultHash: result.resultHash,
            correlationId,
          },
        });
        await repository.saveMomentumEvaluationWithOutbox(result, audit, createOutboxRecord(event));
        return { status: 201, body: result };
      });
    }
    if (path === "/api/momentum/replays") {
      return await idempotentJson(request, response, path, body, async () => ({
        status: 200,
        body: replayMomentumEvaluation(body as MomentumEvaluationInput),
      }));
    }
    if (path === "/api/momentum/plans") {
      return await idempotentJson(request, response, path, body, async () => {
        const plan = validateMomentumTradePlanV1(body as MomentumTradePlanV1);
        const event = createDomainEvent({
          id: randomUUID(), type: "MomentumTradePlanCreated", occurredAt: plan.generatedAt,
          aggregateId: plan.id, correlationId, schemaVersion: "1", modelVersionId: plan.modelVersionId,
          payload: { planId: plan.id, setupId: plan.setupId, evaluationId: plan.evaluationId, revision: plan.revision, expiresAt: plan.expiresAt },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: plan.generatedAt, actorId: "momentum-engine-v1",
          action: "MOMENTUM_PLAN_CREATED", entityType: "MomentumTradePlan", entityId: plan.id,
          reason: `Momentum plan revision ${plan.revision} created`, after: plan,
          metadata: { modelVersionId: plan.modelVersionId, correlationId },
        });
        await repository.saveMomentumTradePlanWithOutbox(plan, audit, createOutboxRecord(event));
        return { status: 201, body: plan };
      });
    }
    const planRevision = path.match(/^\/api\/momentum\/plans\/([^/]+)\/revisions$/);
    if (planRevision) {
      const previousId = decodeURIComponent(planRevision[1] ?? "");
      return await idempotentJson(request, response, path, body, async () => {
        const plan = validateMomentumTradePlanV1(body as MomentumTradePlanV1);
        if (plan.supersedesPlanId !== previousId) throw new Error("plan revision supersedesPlanId must match path");
        const event = createDomainEvent({
          id: randomUUID(), type: "MomentumTradePlanCreated", occurredAt: plan.generatedAt,
          aggregateId: plan.id, correlationId, schemaVersion: "1", modelVersionId: plan.modelVersionId,
          payload: { planId: plan.id, setupId: plan.setupId, evaluationId: plan.evaluationId, revision: plan.revision, supersedesPlanId: previousId },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: plan.generatedAt, actorId: "momentum-engine-v1",
          action: "MOMENTUM_PLAN_REVISED", entityType: "MomentumTradePlan", entityId: plan.id,
          reason: `Momentum plan revision ${plan.revision} supersedes ${previousId}`, after: plan,
          metadata: { modelVersionId: plan.modelVersionId, correlationId, supersedesPlanId: previousId },
        });
        await repository.saveMomentumTradePlanWithOutbox(plan, audit, createOutboxRecord(event));
        return { status: 201, body: plan };
      });
    }
    const planPriceValidation = path.match(/^\/api\/momentum\/plans\/([^/]+)\/validate-price$/);
    if (planPriceValidation) {
      return await idempotentJson(request, response, path, body, async () => {
        const planId = decodeURIComponent(planPriceValidation[1] ?? "");
        const plan = await repository.findMomentumTradePlan(planId);
        if (!plan) throw new Error("Momentum trade plan not found");
        const { currentPrice } = body as { currentPrice: string };
        return { status: 200, body: { planId, currentPrice, position: classifyMomentumPrice(plan, currentPrice), expiresAt: plan.expiresAt } };
      });
    }
    if (path === "/v1/evaluations/momentum") {
      return json(response, 200, evaluateMomentum(body as Parameters<typeof evaluateMomentum>[0]));
    }
    if (path === "/v1/portfolio/allocate") {
      const { capital } = body as { capital: number };
      return json(response, 200, allocateCapital(capital));
    }
    if (path === "/api/portfolio/allocate") {
      const input = body as { capital: string; currency: string };
      return json(response, 200, allocateCapitalDecimal(input.capital, input.currency));
    }
    if (path === "/api/portfolio/policies/validate") {
      return json(response, 200, validatePortfolioPolicyV1(body as PortfolioPolicyV1));
    }
    if (path === "/api/allocations/proposals") {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as AllocationRequestV1;
        const proposal = proposeAllocationV1(input);
        const eventType = proposal.status === "REDUCED" ? "AllocationProposalReduced"
          : proposal.status === "REJECTED" ? "AllocationProposalRejected" : "AllocationProposalCreated";
        const event = createDomainEvent({
          id: randomUUID(), type: eventType, occurredAt: proposal.generatedAt,
          aggregateId: proposal.id, correlationId, schemaVersion: "1",
          payload: {
            proposalId: proposal.id, portfolioId: proposal.portfolioId, companyId: proposal.companyId,
            strategy: proposal.strategy, lotStrategy: proposal.lotStrategy, status: proposal.status,
            requestedAmount: proposal.requestedAmount, approvedAmount: proposal.approvedAmount,
            constraintsTriggered: proposal.constraintsTriggered, policyVersionId: proposal.policyVersionId,
            expiresAt: proposal.expiresAt,
          },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: proposal.generatedAt, actorId: "portfolio-engine-v1",
          action: "PORTFOLIO_PROPOSAL_CREATED", entityType: "AllocationProposalV1", entityId: proposal.id,
          reason: `Portfolio proposal ${proposal.status.toLowerCase()}`, after: proposal,
          metadata: {
            portfolioId: proposal.portfolioId, policyVersionId: proposal.policyVersionId,
            portfolioSnapshotId: proposal.portfolioSnapshotId, resultHash: proposal.resultHash, correlationId,
          },
        });
        await repository.savePortfolioProposalWithOutbox(proposal, input.portfolioSnapshot, audit, createOutboxRecord(event));
        return { status: 201, body: proposal };
      });
    }
    if (path === "/api/allocations/replays") {
      return await idempotentJson(request, response, path, body, async () => ({ status: 200, body: replayAllocationV1(body as AllocationRequestV1) }));
    }
    if (path === "/api/allocations/new-capital") {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as CapitalAllocationBatchInputV1;
        const decision = allocateNewCapitalV1(input);
        const event = createDomainEvent({
          id: randomUUID(), type: "CapitalAllocationDecisionCreated", occurredAt: decision.generatedAt,
          aggregateId: decision.id, correlationId, schemaVersion: "1",
          payload: {
            decisionId: decision.id, portfolioId: decision.portfolioId,
            availableAmount: decision.availableAmount, cashRetained: decision.cashRetained,
            proposalIds: decision.proposals.map((proposal) => proposal.id),
            policyVersionId: decision.policyVersionId, resultHash: decision.resultHash,
          },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: decision.generatedAt, actorId: "portfolio-engine-v1",
          action: "PORTFOLIO_CAPITAL_ALLOCATED", entityType: "CapitalAllocationDecisionV1", entityId: decision.id,
          reason: decision.finalRecommendation, after: decision,
          metadata: { portfolioId: decision.portfolioId, policyVersionId: decision.policyVersionId, portfolioSnapshotId: decision.portfolioSnapshotId, resultHash: decision.resultHash, correlationId },
        });
        await repository.saveCapitalAllocationWithOutbox(decision, input.requests[0]!.portfolioSnapshot, audit, createOutboxRecord(event));
        return { status: 201, body: decision };
      });
    }
    const portfolioRebalance = path.match(/^\/api\/portfolios\/([^/]+)\/rebalance$/);
    if (portfolioRebalance) {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as PortfolioRebalanceInputV1;
        const portfolioId = decodeURIComponent(portfolioRebalance[1] ?? "");
        if (input.portfolioId !== portfolioId || input.snapshot.portfolioId !== portfolioId) throw new Error("Portfolio rebalance path and body do not match");
        const review = assessPortfolioRebalanceV1(input);
        const event = createDomainEvent({
          id: randomUUID(), type: review.requiresManualReview ? "PortfolioReviewRequired" : "PortfolioRebalanceReviewed",
          occurredAt: review.generatedAt, aggregateId: review.id, correlationId, schemaVersion: "1",
          payload: {
            reviewId: review.id, portfolioId, trigger: review.trigger,
            requiresManualReview: review.requiresManualReview,
            reasonCodes: review.actions.map((action) => action.reasonCode), resultHash: review.resultHash,
          },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: review.generatedAt, actorId: "portfolio-engine-v1",
          action: "PORTFOLIO_REBALANCE_REVIEWED", entityType: "PortfolioRebalanceReviewV1", entityId: review.id,
          reason: review.summary, after: review,
          metadata: { portfolioId, policyVersionId: review.policyVersionId, portfolioSnapshotId: review.portfolioSnapshotId, resultHash: review.resultHash, correlationId },
        });
        await repository.savePortfolioRebalanceWithOutbox(review, input.snapshot, audit, createOutboxRecord(event));
        return { status: 201, body: review };
      });
    }
    const portfolioStress = path.match(/^\/api\/portfolios\/([^/]+)\/stress-tests$/);
    if (portfolioStress) {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as {
          id: string;
          snapshot: AllocationRequestV1["portfolioSnapshot"];
          scenario: PortfolioStressScenarioV1;
          evaluatedAt: string;
        };
        const portfolioId = decodeURIComponent(portfolioStress[1] ?? "");
        if (input.snapshot.portfolioId !== portfolioId) throw new Error("Portfolio stress path and snapshot do not match");
        const result = runPortfolioStressTestV1(input);
        const event = createDomainEvent({
          id: randomUUID(), type: "PortfolioStressCompleted", occurredAt: result.evaluatedAt,
          aggregateId: result.id, correlationId, schemaVersion: "1",
          payload: {
            stressResultId: result.id, portfolioId, scenarioId: result.scenarioId,
            estimatedLossPercent: result.estimatedLossPercent, breachedLimitIds: result.breachedLimitIds,
            forcedSaleRisk: result.forcedSaleRisk,
          },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: result.evaluatedAt, actorId: "portfolio-engine-v1",
          action: "PORTFOLIO_STRESS_COMPLETED", entityType: "PortfolioStressResult", entityId: result.id,
          reason: `Portfolio stress scenario ${result.scenarioId} completed`, after: result,
          metadata: { portfolioId, scenarioVersion: result.scenarioVersion, resultHash: result.resultHash, correlationId },
        });
        await repository.savePortfolioStressWithOutbox(result, audit, createOutboxRecord(event));
        return { status: 201, body: result };
      });
    }
    if (path === "/api/learning/reviews") {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as LearningReviewInputV1;
        const review = createLearningReviewV1(input);
        const event = createDomainEvent({
          id: randomUUID(), type: "LearningReviewCompleted", occurredAt: review.reviewedAt,
          aggregateId: review.id, correlationId, schemaVersion: "1", modelVersionId: review.modelVersionId,
          payload: {
            reviewId: review.id, manifestId: review.manifestId, strategy: review.strategy,
            classification: review.classification, maturity: review.maturity, resultHash: review.resultHash,
          },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: review.reviewedAt, actorId: review.reviewerId,
          action: "LEARNING_REVIEW_CREATED", entityType: "LearningReviewV1", entityId: review.id,
          reason: review.classification, after: review,
          metadata: { manifestId: review.manifestId, modelVersionId: review.modelVersionId, resultHash: review.resultHash, correlationId },
        });
        await repository.saveLearningReviewWithOutbox(review, input.manifest, review.outcome, audit, createOutboxRecord(event));
        return { status: 201, body: review };
      });
    }
    if (path === "/api/learning/cohorts/analyze") {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as CohortAnalysisInputV1;
        const records = await Promise.all(input.records.map(async (record) => {
          const [review, manifest] = await Promise.all([
            repository.findLearningReview(record.review.id),
            repository.findLearningManifest(record.manifest.id),
          ]);
          if (!review || !manifest || review.manifestId !== manifest.id) throw new Error("Learning Cohort source Review or Manifest not found");
          if (review.resultHash !== record.review.resultHash) throw new Error("Learning Cohort Review lineage conflict");
          return { review, manifest, evidenceCoverage: record.evidenceCoverage };
        }));
        const cohort = analyzeLearningCohortV1({ ...input, records });
        const event = createDomainEvent({
          id: randomUUID(), type: "LearningCohortAnalyzed", occurredAt: cohort.analyzedAt,
          aggregateId: cohort.id, correlationId, schemaVersion: "1", modelVersionId: cohort.key.modelVersionId,
          payload: { cohortId: cohort.id, strategy: cohort.key.strategy, sampleSize: cohort.sampleSize, eligibleForLesson: cohort.eligibleForLesson, blockerCodes: cohort.blockerCodes, resultHash: cohort.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: cohort.analyzedAt, actorId: "learning-engine-v1",
          action: "LEARNING_COHORT_ANALYZED", entityType: "CohortAnalysisV1", entityId: cohort.id,
          reason: cohort.eligibleForLesson ? "ELIGIBLE_FOR_LESSON" : "BLOCKED",
          after: cohort, metadata: { sampleSize: cohort.sampleSize, resultHash: cohort.resultHash, correlationId },
        });
        await repository.saveLearningCohortWithOutbox(cohort, audit, createOutboxRecord(event));
        return { status: 201, body: cohort };
      });
    }
    if (path === "/api/learning/lessons/candidates") {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as LessonCandidateInputV1;
        const storedCohort = await repository.findLearningCohort(input.cohort.id);
        if (!storedCohort || storedCohort.resultHash !== input.cohort.resultHash) throw new Error("Lesson Candidate Cohort lineage conflict");
        const candidate = createLessonCandidateV1({ ...input, cohort: storedCohort });
        const event = createDomainEvent({
          id: randomUUID(), type: "LessonCandidateCreated", occurredAt: candidate.generatedAt,
          aggregateId: candidate.id, correlationId, schemaVersion: "1",
          payload: { candidateId: candidate.id, strategy: candidate.strategy, type: candidate.type, status: candidate.status, sampleSize: candidate.sampleSize, resultHash: candidate.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: candidate.generatedAt, actorId: "learning-engine-v1",
          action: "LESSON_CANDIDATE_CREATED", entityType: "LessonCandidateV1", entityId: candidate.id,
          reason: candidate.status, after: candidate,
          metadata: { cohortAnalysisId: candidate.cohortAnalysisId, sampleSize: candidate.sampleSize, resultHash: candidate.resultHash, correlationId },
        });
        await repository.saveLessonCandidateWithOutbox(candidate, audit, createOutboxRecord(event));
        return { status: 201, body: candidate };
      });
    }
    const lessonApproval = path.match(/^\/api\/learning\/lessons\/([^/]+)\/approve$/);
    if (lessonApproval) {
      return await idempotentJson(request, response, path, body, async () => {
        const candidateId = decodeURIComponent(lessonApproval[1] ?? "");
        const candidate = await repository.findLessonCandidate(candidateId);
        if (!candidate) throw new Error("Lesson Candidate not found");
        const input = body as Omit<ApproveLessonInputV1, "candidate">;
        const lesson = approveInvestmentLessonV1({ ...input, candidate });
        const event = createDomainEvent({
          id: randomUUID(), type: lesson.status === "APPROVED" ? "LessonApproved" : "LessonRejected",
          occurredAt: lesson.approvedAt, aggregateId: lesson.id, correlationId, schemaVersion: "1",
          payload: { lessonId: lesson.id, candidateId, status: lesson.status, recommendedAction: lesson.recommendedAction, resultHash: lesson.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: lesson.approvedAt, actorId: lesson.approvedBy,
          action: "INVESTMENT_LESSON_REVIEWED", entityType: "InvestmentLessonV1", entityId: lesson.id,
          reason: lesson.status, after: lesson,
          metadata: { candidateId, recommendedAction: lesson.recommendedAction, resultHash: lesson.resultHash, correlationId },
        });
        await repository.saveInvestmentLessonWithOutbox(lesson, audit, createOutboxRecord(event));
        return { status: 201, body: lesson };
      });
    }
    if (path === "/api/learning/model-changes") {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as ModelChangeProposalInputV1;
        const lessons = await Promise.all(input.lessonIds.map((id) => repository.findInvestmentLesson(id)));
        if (lessons.some((lesson) => !lesson || lesson.status !== "APPROVED")) throw new Error("Model Change requires approved Investment Lessons");
        if (lessons.some((lesson) => lesson?.userId !== input.userId)) throw new Error("Model Change Lesson ownership conflict");
        const proposal = createModelChangeProposalV1(input);
        const event = createDomainEvent({
          id: randomUUID(), type: "ModelChangeProposed", occurredAt: proposal.createdAt,
          aggregateId: proposal.id, correlationId, schemaVersion: "1", modelVersionId: proposal.challengerModelVersionId,
          payload: { proposalId: proposal.id, targetModelFamily: proposal.targetModelFamily, championModelVersionId: proposal.championModelVersionId, challengerModelVersionId: proposal.challengerModelVersionId, status: proposal.status, resultHash: proposal.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: proposal.createdAt, actorId: "learning-engine-v1",
          action: "MODEL_CHANGE_PROPOSED", entityType: "ModelChangeProposalV1", entityId: proposal.id,
          reason: proposal.hypothesis, after: proposal,
          metadata: { championModelVersionId: proposal.championModelVersionId, challengerModelVersionId: proposal.challengerModelVersionId, resultHash: proposal.resultHash, correlationId },
        });
        await repository.saveModelChangeWithOutbox(proposal, audit, createOutboxRecord(event));
        return { status: 201, body: proposal };
      });
    }
    if (path === "/api/learning/validations") {
      return await idempotentJson(request, response, path, body, async () => {
        const input = body as ModelValidationInputV1;
        const storedProposal = await repository.findModelChange(input.proposal.id);
        if (!storedProposal || storedProposal.resultHash !== input.proposal.resultHash) throw new Error("Model validation Proposal lineage conflict");
        const validation = evaluateModelValidationV1({ ...input, proposal: storedProposal });
        const event = createDomainEvent({
          id: randomUUID(), type: validation.verdict === "PASS" || validation.verdict === "PASS_WITH_GUARDRAILS" ? "ModelValidationCompleted" : "ModelValidationFailed",
          occurredAt: validation.evaluatedAt, aggregateId: validation.id, correlationId, schemaVersion: "1",
          payload: { validationId: validation.id, proposalId: validation.proposalId, verdict: validation.verdict, blockerCodes: validation.blockerCodes, resultHash: validation.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: validation.evaluatedAt, actorId: "learning-engine-v1",
          action: "MODEL_VALIDATION_COMPLETED", entityType: "ModelValidationResultV1", entityId: validation.id,
          reason: validation.verdict, after: validation,
          metadata: { proposalId: validation.proposalId, verdict: validation.verdict, resultHash: validation.resultHash, correlationId },
        });
        await repository.saveModelValidationWithOutbox(validation, audit, createOutboxRecord(event));
        return { status: 201, body: validation };
      });
    }
    const modelChangeTransition = path.match(/^\/api\/learning\/model-changes\/([^/]+)\/transitions$/);
    const modelChangeApproval = path.match(/^\/api\/learning\/model-changes\/([^/]+)\/approve$/);
    if (modelChangeTransition || modelChangeApproval) {
      return await idempotentJson(request, response, path, body, async () => {
        const previousId = decodeURIComponent((modelChangeTransition ?? modelChangeApproval)?.[1] ?? "");
        const previous = await repository.findModelChange(previousId);
        if (!previous) throw new Error("Model Change Proposal not found");
        const raw = body as Omit<ModelChangeTransitionInputV1, "previous" | "validationResult"> & { validationResultId?: string };
        const nextStatus = modelChangeApproval ? "APPROVED" as const : raw.nextStatus;
        const validationResult = raw.validationResultId ? await repository.findModelValidation(raw.validationResultId) : undefined;
        const transitioned = transitionModelChangeProposalV1({
          id: raw.id, previous, nextStatus, transitionedAt: raw.transitionedAt,
          ...(validationResult === undefined ? {} : { validationResult }),
          ...(raw.approvedBy === undefined ? {} : { approvedBy: raw.approvedBy }),
        });
        const eventType = transitioned.status === "READY_FOR_APPROVAL" ? "ModelChangeReadyForApproval"
          : transitioned.status === "APPROVED" ? "ModelChangeApproved"
            : transitioned.status === "REJECTED" ? "ModelChangeRejected" : "ModelValidationStarted";
        const event = createDomainEvent({
          id: randomUUID(), type: eventType, occurredAt: transitioned.createdAt,
          aggregateId: transitioned.id, correlationId, schemaVersion: "1", modelVersionId: transitioned.challengerModelVersionId,
          payload: { proposalId: transitioned.id, supersedesProposalId: previous.id, status: transitioned.status, validationResultId: transitioned.validationResultId, resultHash: transitioned.resultHash },
        });
        const audit = createAuditRecord({
          id: randomUUID(), occurredAt: transitioned.createdAt, actorId: transitioned.approvedBy ?? "learning-engine-v1",
          action: "MODEL_CHANGE_TRANSITIONED", entityType: "ModelChangeProposalV1", entityId: transitioned.id,
          reason: `${previous.status} -> ${transitioned.status}`, before: previous, after: transitioned,
          metadata: { previousId: previous.id, from: previous.status, to: transitioned.status, resultHash: transitioned.resultHash, correlationId },
        });
        await repository.saveModelChangeWithOutbox(transitioned, audit, createOutboxRecord(event));
        return { status: 201, body: transitioned };
      });
    }
    if (path === "/api/philosophy/policies/validate") {
      return json(response, 200, validatePhilosophyPolicy(body as Parameters<typeof validatePhilosophyPolicy>[0]));
    }
    if (path === "/api/evidence/validate") {
      return json(response, 200, validateEvidence(body as Parameters<typeof validateEvidence>[0]));
    }
    if (path === "/api/evidence/sets/validate") {
      return json(response, 200, validateEvaluationEvidence(body as Parameters<typeof validateEvaluationEvidence>[0]));
    }
    if (path === "/api/theses/validate") {
      return json(response, 200, validateLongTermThesis(body as Parameters<typeof validateLongTermThesis>[0]));
    }
    if (path === "/api/momentum/plans/validate") {
      return json(response, 200, validateMomentumTradePlan(body as Parameters<typeof validateMomentumTradePlan>[0]));
    }
    if (path === "/api/decisions/journal/validate") {
      return json(response, 200, createDecisionJournalEntry(body as Parameters<typeof createDecisionJournalEntry>[0]));
    }
    if (path === "/api/decisions/modifications/request") {
      return await idempotentJson(request, response, path, body, async () => ({
        status: 201,
        body: requestDecisionModification(body as Parameters<typeof requestDecisionModification>[0]),
      }));
    }
    if (path === "/api/allocations/monthly") {
      return await idempotentJson(request, response, path, body, async () => ({
        status: 201,
        body: createCapitalAllocationDecision(body as Parameters<typeof createCapitalAllocationDecision>[0]),
      }));
    }
    if (path === "/api/risk/manual-review/resolve") {
      const input = body as {
        original: Parameters<typeof resolveManualRiskReview>[0];
        proposal: Parameters<typeof resolveManualRiskReview>[1];
        resolution: Parameters<typeof resolveManualRiskReview>[2];
      };
      return await idempotentJson(request, response, path, body, async () => ({
        status: 201,
        body: resolveManualRiskReview(input.original, input.proposal, input.resolution),
      }));
    }
    if (path === "/api/reviews/assess") {
      return await idempotentJson(request, response, path, body, async () => ({
        status: 201,
        body: assessDecisionReview(body as Parameters<typeof assessDecisionReview>[0]),
      }));
    }
    if (path === "/api/lessons/validate") {
      return json(response, 200, createInvestmentLesson(body as Parameters<typeof createInvestmentLesson>[0]));
    }
    if (path === "/api/performance/attribute") {
      return json(response, 200, attributePerformance(body as Parameters<typeof attributePerformance>[0]));
    }
    if (path === "/api/cross-signals") {
      return json(response, 200, interpretCrossSignal(body as Parameters<typeof interpretCrossSignal>[0]));
    }
    if (path === "/api/allocations/propose") {
      return json(response, 200, proposeAllocation(body as Parameters<typeof proposeAllocation>[0]));
    }
    if (path === "/api/risk/evaluate") {
      const input = body as { proposal: AllocationProposal; context: Parameters<typeof evaluateRisk>[1] };
      return json(response, 200, evaluateRisk(input.proposal, input.context));
    }
    if (path === "/api/decisions/compose") {
      const input = body as { id: string; allocation: AllocationProposal; risk: RiskDecision };
      return json(response, 200, composeDecision(input.id, input.allocation, input.risk));
    }
    if (path === "/api/decisions" || path === "/api/workflows/decisions/create") {
      const input = body as { decisionId: string; allocation: AllocationProposal; risk: RiskDecision };
      return await idempotentJson(request, response, path, body, async () => ({
        status: 201,
        body: await decisionWorkflow.create({ ...input, correlationId }),
      }));
    }
    if (path === "/api/workflows/decisions/decide") {
      const input = body as Omit<Parameters<DecisionWorkflow["decide"]>[0], "correlationId">;
      return await idempotentJson(request, response, path, body, async () => ({
        status: 200,
        body: await decisionWorkflow.decide({ ...input, correlationId }),
      }));
    }
    const decisionAction = path.match(/^\/api\/decisions\/([^/]+)\/(approve|reject)$/);
    if (decisionAction) {
      const input = body as Omit<Parameters<DecisionWorkflow["decide"]>[0], "decisionId" | "approved" | "correlationId">;
      return await idempotentJson(request, response, path, body, async () => ({
        status: 200,
        body: await decisionWorkflow.decide({
          ...input,
          decisionId: decodeURIComponent(decisionAction[1] ?? ""),
          approved: decisionAction[2] === "approve",
          correlationId,
        }),
      }));
    }
    if (path === "/api/operations/outbox/publish") {
      return await idempotentJson(request, response, path, body, async () => ({
        status: 200,
        body: { published: await outboxPublisher.publishPending(new Date().toISOString()) },
      }));
    }
    if (path === "/api/snapshots/inspect") {
      const input = body as { snapshot: Parameters<typeof inspectSnapshot>[0]; now: string; maxAgeMinutes: number };
      return json(response, 200, inspectSnapshot(input.snapshot, input.now, input.maxAgeMinutes));
    }
    if (path === "/api/reports/generate") {
      return json(response, 201, generateMarkdownReport(body as Parameters<typeof generateMarkdownReport>[0]));
    }
    if (path === "/api/reports/decision") {
      return json(response, 201, generateDecisionReport(body as Parameters<typeof generateDecisionReport>[0]));
    }
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const requestId = response.getHeader("x-request-id") ?? "unknown";
    const correlationId = response.getHeader("x-correlation-id") ?? requestId;
    const mapped = mapApiError(message);
    return json(response, mapped.status, { requestId, correlationId, error: { code: mapped.code, message, retryable: mapped.retryable } });
  }
});

function mapApiError(message: string): { status: number; code: string; retryable: boolean } {
  if (/Scoring.*ownership/i.test(message)) return { status: 403, code: "SCORING_OWNERSHIP_MISMATCH", retryable: false };
  if (/Scoring (Model|Scorecard|Change).*not found/i.test(message)) return { status: 404, code: "SCORING_RESOURCE_NOT_FOUND", retryable: false };
  if (/Scoring.*already exists.*immutable/i.test(message)) return { status: 409, code: "SCORING_RECORD_IMMUTABLE", retryable: false };
  if (/Scoring.*(version conflict|same scope and model)/i.test(message)) return { status: 409, code: "SCORING_VERSION_CONFLICT", retryable: false };
  if (/Scoring Model is not (ACTIVE|eligible)/i.test(message)) return { status: 423, code: "SCORING_MODEL_NOT_ACTIVE", retryable: false };
  if (/Scoring/i.test(message)) return { status: 400, code: "INVALID_SCORING_CONTRACT", retryable: false };
  if (/Data Deletion Request ownership|Database.*ownership|Data Lineage.*ownership/i.test(message)) return { status: 403, code: "DATABASE_OWNERSHIP_MISMATCH", retryable: false };
  if (/Data Deletion Request not found|previous revision not found|Database Reconciliation not found/i.test(message)) return { status: 404, code: "DATABASE_RESOURCE_NOT_FOUND", retryable: false };
  if (/Data Lineage.*cycle|Data Lineage.*self-reference|Data Deletion Request.*branch conflict/i.test(message)) return { status: 409, code: "DATABASE_LINEAGE_CONFLICT", retryable: false };
  if (/Database Reconciliation.*(immutable|already exists)|Data Deletion Request.*(immutable|already exists)/i.test(message)) return { status: 409, code: "DATABASE_RECORD_IMMUTABLE", retryable: false };
  if (/Data Lineage|Retention Policy|Data Deletion|Database Reconciliation|Reconciliation Check/i.test(message)) return { status: 400, code: "INVALID_DATABASE_CONTRACT", retryable: false };
  if (/Agent Run idempotency conflict|Agent Run already exists for idempotency key/i.test(message)) return { status: 409, code: "AGENT_IDEMPOTENCY_CONFLICT", retryable: false };
  if (/Agent.*ownership/i.test(message)) return { status: 403, code: "AGENT_OWNERSHIP_MISMATCH", retryable: false };
  if (/Agent Definition not found|Agent Prompt not found|Agent Run not found|Agent Replay source Run not found/i.test(message)) return { status: 404, code: "AGENT_RESOURCE_NOT_FOUND", retryable: false };
  if (/Agent.*version conflict|Agent Prompt.*conflict|Agent Provider is not enabled/i.test(message)) return { status: 409, code: "AGENT_VERSION_CONFLICT", retryable: false };
  if (/Agent Context.*too large|maximum depth|maximum bytes/i.test(message)) return { status: 413, code: "AGENT_CONTEXT_TOO_LARGE", retryable: false };
  if (/Terminal Agent Run|Agent Run already exists|Agent Run lineage/i.test(message)) return { status: 409, code: "AGENT_RUN_IMMUTABLE", retryable: false };
  if (/Agent Replay input lineage|Agent.*Point.in.time|Agent Run asOf/i.test(message)) return { status: 422, code: "AGENT_OUTPUT_REJECTED", retryable: false };
  if (/Agent Output Schema/i.test(message)) return { status: 422, code: "AGENT_OUTPUT_REJECTED", retryable: false };
  if (/already exists|immutable/i.test(message)) return { status: 409, code: "EVALUATION_ALREADY_EXISTS", retryable: false };
  if (/Learning.*ownership|Lesson.*ownership|Model.*ownership/i.test(message)) return { status: 403, code: "LEARNING_OWNERSHIP_MISMATCH", retryable: false };
  if (/Learning Review not found|Learning Cohort not found|Lesson Candidate not found|Investment Lesson not found|Model Change Proposal not found|Model Validation Result not found/i.test(message)) return { status: 404, code: "LEARNING_RESOURCE_NOT_FOUND", retryable: false };
  if (/Learning.*lineage conflict|Lesson.*lineage conflict|Model.*lineage conflict/i.test(message)) return { status: 409, code: "LEARNING_LINEAGE_CONFLICT", retryable: false };
  if (/maturity|immature|minimumMaturityAt/i.test(message)) return { status: 422, code: "OUTCOME_NOT_MATURE", retryable: false };
  if (/newer than evaluatedAt|point.in.time|future information/i.test(message)) return { status: 422, code: "POINT_IN_TIME_VIOLATION", retryable: false };
  if (/guardrail.*fail|Failed validation cannot/i.test(message)) return { status: 423, code: "MODEL_CHANGE_BLOCKED", retryable: false };
  if (/cohort|sampleSize|evidence coverage|regime count|company concentration|censored/i.test(message)) return { status: 422, code: "INSUFFICIENT_LEARNING_EVIDENCE", retryable: false };
  if (/Lesson|contradicting|alternative explanation|recommended action/i.test(message)) return { status: 422, code: "INSUFFICIENT_LEARNING_EVIDENCE", retryable: false };
  if (/validation|Historical Replay|Walk-forward|Shadow stage/i.test(message)) return { status: 422, code: "INSUFFICIENT_MODEL_VALIDATION", retryable: false };
  if (/Portfolio ownership/i.test(message)) return { status: 403, code: "PORTFOLIO_OWNERSHIP_MISMATCH", retryable: false };
  if (/Portfolio snapshot id already exists|snapshot.*conflict/i.test(message)) return { status: 409, code: "PORTFOLIO_SNAPSHOT_CONFLICT", retryable: false };
  if (/Portfolio snapshot is incomplete|market snapshots|active stop|FX rate|marketValueBase|amountBase/i.test(message)) return { status: 422, code: "PORTFOLIO_SNAPSHOT_INCOMPLETE", retryable: false };
  if (/Allocation proposal must expire|proposal.*expired/i.test(message)) return { status: 410, code: "ALLOCATION_PROPOSAL_EXPIRED", retryable: false };
  if (/Portfolio policy|targets plus common reserve|hard max|risk limits/i.test(message)) return { status: 409, code: "POLICY_VERSION_CONFLICT", retryable: false };
  if (/Momentum trade plan not found|superseded Momentum trade plan not found/i.test(message)) return { status: 404, code: "MOMENTUM_PLAN_NOT_FOUND", retryable: false };
  if (/market regime permission|trade plan model|model or setup version/i.test(message)) return { status: 409, code: "MODEL_VERSION_CONFLICT", retryable: false };
  if (/policy version|POLICY_VERSION/i.test(message)) return { status: 409, code: "POLICY_VERSION_CONFLICT", retryable: false };
  if (/Universe|security halted|listingSessions|medianSpreadBps/i.test(message)) return { status: 422, code: "UNIVERSE_INELIGIBLE", retryable: false };
  if (/trade plan|entryZone|initial stop|chaseLimit|reward\/risk|unitRisk|target/i.test(message)) return { status: 422, code: "TRADE_PLAN_INVALID", retryable: false };
  if (/Momentum setup|setup definition|setupId|catalyst|event risk|gap risk/i.test(message)) return { status: 422, code: "SETUP_INPUT_INCOMPLETE", retryable: false };
  if (/industry profile|industry factor/i.test(message)) return { status: 422, code: "INDUSTRY_PROFILE_NOT_SUPPORTED", retryable: false };
  if (/valuation|scenario|marketPrice/i.test(message)) return { status: 422, code: "VALUATION_INPUT_INCOMPLETE", retryable: false };
  if (/evidence|thesis|factor|confidence|score/i.test(message)) return { status: 422, code: "INSUFFICIENT_EVALUATION_INPUT", retryable: false };
  return { status: 400, code: "INVALID_REQUEST", retryable: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, () => {
    console.log(`Investment OS API listening on http://localhost:${port}`);
  });
}
