import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { CanonicalReportV1, ReportGenerationInputV1, ReportReplayResultV1, ReportTemplateInputV1, ReportTemplateV1 } from "@investment-os/core";
import { server } from "../src/index.js";

function post(origin: string, path: string, body: unknown, key: string): Promise<Response> {
  return fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, "x-correlation-id": `report-${key}` }, body: JSON.stringify(body) });
}

const template: ReportTemplateInputV1 = {
  id: "api-report-template-1", reportType: "WEEKLY_INVESTMENT_OS", version: "1.0.0", status: "ACTIVE", locale: "ko-KR",
  requiredSourceTypes: ["PORTFOLIO_SNAPSHOT"], requiredSections: ["CONCLUSION", "COUNTER_EVIDENCE", "RISKS", "ACTIONS", "NEXT_REVIEW", "SOURCES"],
  minimumCoverageBps: 10_000, allowedFormats: ["JSON", "MARKDOWN", "NOTIFICATION", "PDF"], maxStatementCount: 20,
  approvedBy: "api-report-reviewer", approvedAt: "2026-07-12T00:00:00Z",
};

function generation(id: string): Omit<ReportGenerationInputV1, "template"> & { templateId: string } {
  const source = { sourceType: "PORTFOLIO_SNAPSHOT" as const, sourceId: "api-report-source-1", sourceRevision: 1, userId: "api-report-user", availableAt: "2026-07-20T00:00:00Z", asOf: "2026-07-19T23:00:00Z", resultHash: "c".repeat(64), modelVersionIds: [], policyVersionIds: ["portfolio-policy-1"], snapshotIds: ["portfolio-snapshot-1"], evidenceIds: [], required: true };
  const statement = (statementId: string, kind: "FACT" | "INTERPRETATION" | "RECOMMENDATION", text: string) => ({ id: statementId, kind, text, sourceIds: [source.sourceId], evidenceIds: [], materiality: "PRIMARY" as const, warningCodes: [] });
  return {
    id, templateId: template.id,
    request: { id: `request-${id}`, userId: "api-report-user", reportType: "WEEKLY_INVESTMENT_OS", audience: "USER", locale: "ko-KR", timezone: "Asia/Seoul", periodStart: "2026-07-13T00:00:00Z", periodEnd: "2026-07-19T23:00:00Z", dataAsOf: "2026-07-20T00:00:00Z", requestedAt: "2026-07-20T01:00:00Z", requestedBy: "api-report-user", templateVersion: "1.0.0", rendererVersion: "renderer-1", sourceRefs: [source], requestedFormats: ["JSON", "MARKDOWN", "NOTIFICATION", "PDF"], idempotencyKey: id, correlationId: `correlation-${id}` },
    title: "API Weekly Report", primaryRecommendation: { action: "REVIEW", summary: "Portfolio 상태 검토", rationaleSourceIds: [source.sourceId], confidence: "HIGH", executable: false, conditions: ["Next snapshot"] },
    sections: [
      { kind: "CONCLUSION", heading: "Conclusion", order: 1, statements: [statement("api-conclusion", "INTERPRETATION", "변경 없음")] },
      { kind: "COUNTER_EVIDENCE", heading: "Counter Evidence", order: 2, statements: [statement("api-counter", "FACT", "위험 한도 정상")] },
      { kind: "RISKS", heading: "Risks", order: 3, statements: [statement("api-risk", "INTERPRETATION", "집중도 관찰")] },
      { kind: "ACTIONS", heading: "Actions", order: 4, statements: [statement("api-action", "RECOMMENDATION", "검토만 수행")] },
      { kind: "NEXT_REVIEW", heading: "Next Review", order: 5, statements: [statement("api-next", "RECOMMENDATION", "다음 Snapshot") ] },
      { kind: "SOURCES", heading: "Sources", order: 6, statements: [statement("api-source", "FACT", "고정 Snapshot")] },
    ],
    generatedAt: "2026-07-20T01:01:00Z",
  };
}

test("Report v1 API persists Template, Canonical Report, partial Artifacts, Replay, Audit and Outbox", async (context) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  const origin = `http://127.0.0.1:${address.port}`;

  const templateResponse = await post(origin, "/api/v1/reports/templates/validate", template, "template-1");
  assert.equal(templateResponse.status, 201);
  const storedTemplate = await templateResponse.json() as ReportTemplateV1;
  assert.equal(storedTemplate.contentHash.length, 64);
  assert.deepEqual(await (await fetch(`${origin}/api/v1/reports/templates/${template.id}`)).json(), storedTemplate);

  const createResponse = await post(origin, "/api/v1/reports", generation("api-report-1"), "report-1");
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as { report: CanonicalReportV1; artifacts: Array<{ format: string; contentHash: string }>; failedFormats: Array<{ format: string }> };
  assert.equal(created.report.status, "READY");
  assert.deepEqual(created.artifacts.map((artifact) => artifact.format), ["JSON", "MARKDOWN", "NOTIFICATION"]);
  assert.deepEqual(created.failedFormats, [{ format: "PDF", code: "REPORT_PDF_RENDERER_UNAVAILABLE" }]);
  assert.deepEqual(await (await fetch(`${origin}/api/v1/reports/${created.report.id}`)).json(), created.report);
  const artifacts = await (await fetch(`${origin}/api/v1/reports/${created.report.id}/artifacts`)).json() as { items: unknown[] };
  assert.equal(artifacts.items.length, 3);

  const replayResponse = await post(origin, `/api/v1/reports/${created.report.id}/replays`, { id: "api-report-replay-1", userId: "api-report-user", formats: ["JSON", "MARKDOWN"], replayedAt: "2026-07-21T00:00:00Z" }, "replay-1");
  assert.equal(replayResponse.status, 201);
  const replay = await replayResponse.json() as ReportReplayResultV1;
  assert.equal(replay.matches, true);

  const publishResponse = await post(origin, "/api/v1/operations/outbox/publish", {}, "report-publish-1");
  assert.equal(publishResponse.status, 200);
  const events = await (await fetch(`${origin}/api/v1/events/${created.report.id}`)).json() as Array<{ type: string }>;
  assert.ok(events.some((event) => event.type === "ReportGenerated"));
  const audit = await (await fetch(`${origin}/api/v1/audit/${created.report.id}`)).json() as Array<{ action: string }>;
  assert.ok(audit.some((record) => record.action === "REPORT_GENERATED"));
});
