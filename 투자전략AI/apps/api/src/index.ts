import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import {
  allocateCapital,
  allocateCapitalDecimal,
  allocateNewCapitalV1,
  assessPortfolioRebalanceV1,
  buildPortfolioLedger,
  assessDecisionReview,
  attributePerformance,
  composeDecision,
  createCapitalAllocationDecision,
  createAuditRecord,
  createDecisionJournalEntry,
  createInvestmentLesson,
  createDomainEvent,
  createOutboxRecord,
  evaluateLongTerm,
  evaluateLongTermV1,
  evaluateMomentum,
  evaluateMomentumV1,
  evaluateRisk,
  interpretCrossSignal,
  inspectSnapshot,
  generateMarkdownReport,
  generateDecisionReport,
  InMemoryInvestmentOsRepository,
  OutboxPublisher,
  proposeAllocation,
  proposeAllocationV1,
  requestDecisionModification,
  resolveManualRiskReview,
  replayLongTermEvaluation,
  replayMomentumEvaluation,
  replayAllocationV1,
  runPortfolioStressTestV1,
  runMomentumScan,
  validateEvidence,
  validateEvaluationEvidence,
  validateLongTermThesis,
  validateMomentumTradePlan,
  validateMomentumTradePlanV1,
  classifyMomentumPrice,
  validatePhilosophyPolicy,
  validatePortfolioPolicyV1,
  DecisionWorkflow,
  decimalRatio,
  type AllocationProposal,
  type RiskDecision,
  type LongTermEvaluationInput,
  type LongTermEvaluationResult,
  type MomentumEvaluationInput,
  type MomentumEvaluationResultV1,
  type MomentumScanInput,
  type MomentumTradePlanV1,
  type AllocationRequestV1,
  type CapitalAllocationBatchInputV1,
  type PortfolioRebalanceInputV1,
  type PortfolioPolicyV1,
  type PortfolioStressScenarioV1,
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
    if (path === "/v1/evaluations/long-term") {
      return json(response, 200, evaluateLongTerm(body as Parameters<typeof evaluateLongTerm>[0]));
    }
    if (path === "/api/long-term/evaluations") {
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => ({
        status: 200,
        body: replayLongTermEvaluation(body as LongTermEvaluationInput),
      }));
    }
    if (path === "/api/momentum/scans") {
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => ({
        status: 200,
        body: replayMomentumEvaluation(body as MomentumEvaluationInput),
      }));
    }
    if (path === "/api/momentum/plans") {
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => ({ status: 200, body: replayAllocationV1(body as AllocationRequestV1) }));
    }
    if (path === "/api/allocations/new-capital") {
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => {
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
      return idempotentJson(request, response, path, body, async () => ({
        status: 201,
        body: requestDecisionModification(body as Parameters<typeof requestDecisionModification>[0]),
      }));
    }
    if (path === "/api/allocations/monthly") {
      return idempotentJson(request, response, path, body, async () => ({
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
      return idempotentJson(request, response, path, body, async () => ({
        status: 201,
        body: resolveManualRiskReview(input.original, input.proposal, input.resolution),
      }));
    }
    if (path === "/api/reviews/assess") {
      return idempotentJson(request, response, path, body, async () => ({
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
      return idempotentJson(request, response, path, body, async () => ({
        status: 201,
        body: await decisionWorkflow.create({ ...input, correlationId }),
      }));
    }
    if (path === "/api/workflows/decisions/decide") {
      const input = body as Omit<Parameters<DecisionWorkflow["decide"]>[0], "correlationId">;
      return idempotentJson(request, response, path, body, async () => ({
        status: 200,
        body: await decisionWorkflow.decide({ ...input, correlationId }),
      }));
    }
    const decisionAction = path.match(/^\/api\/decisions\/([^/]+)\/(approve|reject)$/);
    if (decisionAction) {
      const input = body as Omit<Parameters<DecisionWorkflow["decide"]>[0], "decisionId" | "approved" | "correlationId">;
      return idempotentJson(request, response, path, body, async () => ({
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
      return idempotentJson(request, response, path, body, async () => ({
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
  if (/already exists|immutable/i.test(message)) return { status: 409, code: "EVALUATION_ALREADY_EXISTS", retryable: false };
  if (/Portfolio ownership/i.test(message)) return { status: 403, code: "PORTFOLIO_OWNERSHIP_MISMATCH", retryable: false };
  if (/Portfolio snapshot id already exists|snapshot.*conflict/i.test(message)) return { status: 409, code: "PORTFOLIO_SNAPSHOT_CONFLICT", retryable: false };
  if (/Portfolio snapshot is incomplete|market snapshots|active stop|FX rate|marketValueBase|amountBase/i.test(message)) return { status: 422, code: "PORTFOLIO_SNAPSHOT_INCOMPLETE", retryable: false };
  if (/Allocation proposal must expire|proposal.*expired/i.test(message)) return { status: 410, code: "ALLOCATION_PROPOSAL_EXPIRED", retryable: false };
  if (/Portfolio policy|targets plus common reserve|hard max|risk limits/i.test(message)) return { status: 409, code: "POLICY_VERSION_CONFLICT", retryable: false };
  if (/Momentum trade plan not found|superseded Momentum trade plan not found/i.test(message)) return { status: 404, code: "MOMENTUM_PLAN_NOT_FOUND", retryable: false };
  if (/market regime permission|trade plan model|model or setup version/i.test(message)) return { status: 409, code: "MODEL_VERSION_CONFLICT", retryable: false };
  if (/policy version|POLICY_VERSION/i.test(message)) return { status: 409, code: "POLICY_VERSION_CONFLICT", retryable: false };
  if (/newer than evaluatedAt|point.in.time|future information/i.test(message)) return { status: 422, code: "POINT_IN_TIME_VIOLATION", retryable: false };
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
