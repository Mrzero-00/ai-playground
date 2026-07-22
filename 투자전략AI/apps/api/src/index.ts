import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import {
  allocateCapital,
  composeDecision,
  evaluateLongTerm,
  evaluateMomentum,
  evaluateRisk,
  interpretCrossSignal,
  inspectSnapshot,
  generateMarkdownReport,
  InMemoryInvestmentOsRepository,
  OutboxPublisher,
  proposeAllocation,
  DecisionWorkflow,
  type AllocationProposal,
  type RiskDecision,
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
    if (request.method !== "POST") return json(response, 404, { error: "not_found" });

    const body = await readBody(request);
    if (path === "/v1/evaluations/long-term") {
      return json(response, 200, evaluateLongTerm(body as Parameters<typeof evaluateLongTerm>[0]));
    }
    if (path === "/v1/evaluations/momentum") {
      return json(response, 200, evaluateMomentum(body as Parameters<typeof evaluateMomentum>[0]));
    }
    if (path === "/v1/portfolio/allocate") {
      const { capital } = body as { capital: number };
      return json(response, 200, allocateCapital(capital));
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
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const requestId = response.getHeader("x-request-id") ?? "unknown";
    return json(response, 400, { requestId, error: { code: "INVALID_REQUEST", message, retryable: false } });
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, () => {
    console.log(`Investment OS API listening on http://localhost:${port}`);
  });
}
