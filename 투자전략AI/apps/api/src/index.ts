import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { allocateCapital, evaluateLongTerm, evaluateMomentum } from "@investment-os/core";

const port = Number(process.env.PORT ?? 4000);

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      return json(response, 200, { status: "ok", service: "investment-os-api" });
    }
    if (request.method !== "POST") return json(response, 404, { error: "not_found" });

    const body = await readBody(request);
    if (request.url === "/v1/evaluations/long-term") {
      return json(response, 200, evaluateLongTerm(body as Parameters<typeof evaluateLongTerm>[0]));
    }
    if (request.url === "/v1/evaluations/momentum") {
      return json(response, 200, evaluateMomentum(body as Parameters<typeof evaluateMomentum>[0]));
    }
    if (request.url === "/v1/portfolio/allocate") {
      const { capital } = body as { capital: number };
      return json(response, 200, allocateCapital(capital));
    }
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return json(response, 400, { error: "invalid_request", message });
  }
});

server.listen(port, () => {
  console.log(`Investment OS API listening on http://localhost:${port}`);
});

