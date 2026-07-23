import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createAutomatedExecutionIntentV1, type AutomatedExecutionIntentInputV1, type ExecutionPreflightObservationV1 } from "@investment-os/core";
import { AutomatedExecutionServiceV1 } from "./execution-service.js";
import { PaperBrokerV1 } from "./paper-broker.js";
import { loadExecutionRuntimeConfig } from "./runtime-config.js";
import { TossBrokerClientV1 } from "./toss-client.js";

const config = loadExecutionRuntimeConfig();
const toss = config.toss ? new TossBrokerClientV1(config.toss) : undefined;
const broker = config.runtimeGate.mode === "PAPER" ? new PaperBrokerV1() : config.runtimeGate.mode === "LIVE" ? toss : undefined;
const service = new AutomatedExecutionServiceV1({ runtime: config.runtimeGate, ...(broker ? { broker } : {}) });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, {
        status: "ok",
        mode: config.runtimeGate.mode,
        liveTradingEnabled: config.runtimeGate.mode === "LIVE" && config.runtimeGate.autoTradingEnabled,
        killSwitchOpen: config.runtimeGate.killSwitchOpen,
      });
    }
    authorize(request);
    const submit = url.pathname.match(/^\/internal\/v1\/execution\/intents\/([^/]+)\/submit$/);
    if (request.method === "POST" && submit) {
      const body = await readJson(request) as { intent?: AutomatedExecutionIntentInputV1; observation?: ExecutionPreflightObservationV1 };
      if (!body.intent || body.intent.id !== decodeURIComponent(submit[1]!)) throw new Error("Execution intent path and body do not match");
      const canonicalIntent = createAutomatedExecutionIntentV1(body.intent);
      const observation = config.runtimeGate.mode === "LIVE"
        ? await toss!.collectPreflight(canonicalIntent, new Date().toISOString(), config.reconciliationHealthy)
        : body.observation;
      if (!observation) throw new Error("DRY_RUN/PAPER submission requires a preflight observation");
      return json(response, 200, await service.submit(body.intent, observation));
    }
    return json(response, 404, { error: { code: "NOT_FOUND" } });
  } catch (error) {
    return json(response, 400, { error: { code: "EXECUTION_REQUEST_REJECTED", message: error instanceof Error ? error.message : String(error) } });
  }
});

server.listen(config.port, config.host, () => {
  process.stdout.write(`Execution service listening on http://${config.host}:${config.port} (${config.runtimeGate.mode})\n`);
});

function authorize(request: IncomingMessage): void {
  const token = request.headers["x-execution-service-token"];
  if (typeof token !== "string" || !constantTimeTextEqual(token, config.serviceToken)) throw new Error("Execution service authorization failed");
}

function constantTimeTextEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Execution request body is too large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}
