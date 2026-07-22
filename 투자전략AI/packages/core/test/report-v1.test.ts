import assert from "node:assert/strict";
import test from "node:test";
import {
  createCanonicalReportV1,
  createReportRevisionV1,
  renderReportArtifactV1,
  replayReportV1,
  validateReportTemplateV1,
  type ReportGenerationInputV1,
  type ReportTemplateInputV1,
} from "../src/index.js";

function templateInput(overrides: Partial<ReportTemplateInputV1> = {}): ReportTemplateInputV1 {
  return {
    id: "report-template-weekly-1", reportType: "WEEKLY_INVESTMENT_OS", version: "1.0.0", status: "ACTIVE", locale: "ko-KR",
    requiredSourceTypes: ["PORTFOLIO_SNAPSHOT", "SCORE_CHANGE"], requiredSections: ["CONCLUSION", "COUNTER_EVIDENCE", "RISKS", "ACTIONS", "NEXT_REVIEW", "SOURCES"],
    minimumCoverageBps: 10_000, allowedFormats: ["JSON", "MARKDOWN", "NOTIFICATION", "PDF"], maxStatementCount: 30, ...overrides,
    approvedBy: "report-template-reviewer", approvedAt: "2026-07-12T00:00:00Z",
  };
}

function generation(overrides: Partial<ReportGenerationInputV1> = {}): ReportGenerationInputV1 {
  const template = validateReportTemplateV1(templateInput());
  return {
    id: "report-1",
    request: {
      id: "report-request-1", userId: "report-user-1", reportType: "WEEKLY_INVESTMENT_OS", audience: "USER", locale: "ko-KR", timezone: "Asia/Seoul",
      periodStart: "2026-07-13T00:00:00Z", periodEnd: "2026-07-19T23:59:59Z", dataAsOf: "2026-07-20T00:00:00Z", requestedAt: "2026-07-20T01:00:00Z",
      requestedBy: "report-user-1", templateVersion: "1.0.0", rendererVersion: "report-renderer-1",
      sourceRefs: [
        { sourceType: "SCORE_CHANGE", sourceId: "score-change-1", sourceRevision: 1, userId: "report-user-1", availableAt: "2026-07-19T11:00:00Z", asOf: "2026-07-19T10:00:00Z", resultHash: "b".repeat(64), modelVersionIds: ["score-model-1"], policyVersionIds: [], snapshotIds: ["snapshot-market"], evidenceIds: ["evidence-score"], required: true },
        { sourceType: "PORTFOLIO_SNAPSHOT", sourceId: "portfolio-snapshot-1", sourceRevision: 1, userId: "report-user-1", availableAt: "2026-07-19T10:00:00Z", asOf: "2026-07-19T09:00:00Z", resultHash: "a".repeat(64), modelVersionIds: [], policyVersionIds: ["portfolio-policy-1"], snapshotIds: ["snapshot-fx", "snapshot-market"], evidenceIds: [], required: true },
      ],
      requestedFormats: ["MARKDOWN", "JSON", "NOTIFICATION"], idempotencyKey: "weekly-2026-07-20", correlationId: "correlation-report-1",
    },
    template,
    title: "Weekly Investment OS",
    primaryRecommendation: { action: "REVIEW", summary: "Core thesis change를 우선 검토", rationaleSourceIds: ["score-change-1"], confidence: "MEDIUM", executable: false, conditions: ["Review evidence"] },
    sections: [
      { kind: "SOURCES", heading: "Sources", order: 6, statements: [{ id: "source-1", kind: "FACT", text: "두 Source를 고정했다.", sourceIds: ["score-change-1", "portfolio-snapshot-1"], evidenceIds: [], materiality: "CONTEXT", warningCodes: [] }] },
      { kind: "CONCLUSION", heading: "Conclusion", order: 1, statements: [{ id: "conclusion-1", kind: "INTERPRETATION", text: "우선 검토가 필요하다.", sourceIds: ["score-change-1"], evidenceIds: ["evidence-score"], confidence: "MEDIUM", materiality: "PRIMARY", warningCodes: [] }] },
      { kind: "COUNTER_EVIDENCE", heading: "Counter Evidence", order: 2, statements: [{ id: "counter-1", kind: "FACT", text: "Portfolio 위험은 한도 안이다.", sourceIds: ["portfolio-snapshot-1"], evidenceIds: [], materiality: "PRIMARY", warningCodes: [] }] },
      { kind: "RISKS", heading: "Risks", order: 3, statements: [{ id: "risk-1", kind: "INTERPRETATION", text: "Score 변화 원인을 확인해야 한다.", sourceIds: ["score-change-1"], evidenceIds: [], materiality: "PRIMARY", warningCodes: [] }] },
      { kind: "ACTIONS", heading: "Actions", order: 4, statements: [{ id: "action-1", kind: "RECOMMENDATION", text: "검토만 수행한다.", sourceIds: ["score-change-1"], evidenceIds: [], materiality: "PRIMARY", warningCodes: [] }] },
      { kind: "NEXT_REVIEW", heading: "Next Review", order: 5, statements: [{ id: "review-1", kind: "RECOMMENDATION", text: "다음 Evidence 공개 시 재검토한다.", sourceIds: ["score-change-1"], evidenceIds: [], materiality: "PRIMARY", warningCodes: [] }] },
    ],
    generatedAt: "2026-07-20T01:01:00Z",
    ...overrides,
  };
}

test("Report Template validates immutable configuration and stable hash", () => {
  const template = validateReportTemplateV1(templateInput());
  assert.equal(template.contentHash.length, 64);
  assert.throws(() => validateReportTemplateV1(templateInput({ minimumCoverageBps: 10_001 })), /between 0 and 10000/);
  assert.throws(() => validateReportTemplateV1(templateInput({ requiredSections: ["RISKS", "RISKS"] })), /unique/);
});

test("Canonical Report freezes lineage, normalizes order and is deterministic", () => {
  const input = generation();
  const report = createCanonicalReportV1(input);
  assert.equal(report.status, "READY");
  assert.deepEqual(report.sourceManifest.map((source) => source.sourceId), ["portfolio-snapshot-1", "score-change-1"]);
  assert.deepEqual(report.sections.map((section) => section.kind), ["CONCLUSION", "COUNTER_EVIDENCE", "RISKS", "ACTIONS", "NEXT_REVIEW", "SOURCES"]);
  const reordered = createCanonicalReportV1({ ...input, request: { ...input.request, sourceRefs: [...input.request.sourceRefs].reverse(), requestedFormats: [...input.request.requestedFormats].reverse() }, sections: [...input.sections].reverse() });
  assert.equal(reordered.resultHash, report.resultHash);
});

test("Report rejects cross-owner and future Sources", () => {
  const crossOwner = generation();
  crossOwner.request.sourceRefs[0] = { ...crossOwner.request.sourceRefs[0]!, userId: "other-user" };
  assert.throws(() => createCanonicalReportV1(crossOwner), /ownership mismatch/);
  const future = generation();
  future.request.sourceRefs[0] = { ...future.request.sourceRefs[0]!, availableAt: "2026-07-21T00:00:00Z" };
  assert.throws(() => createCanonicalReportV1(future), /Point-in-time/);
});

test("Missing required Source creates a non-executable BLOCKED Report instead of inventing facts", () => {
  const input = generation();
  input.request.sourceRefs = input.request.sourceRefs.filter((source) => source.sourceType !== "SCORE_CHANGE");
  input.primaryRecommendation = { ...input.primaryRecommendation, rationaleSourceIds: ["portfolio-snapshot-1"], executable: true, action: "APPROVE_EXISTING_PROPOSAL", proposalId: "proposal-1" };
  input.sections = input.sections.map((section) => ({ ...section, statements: section.statements.map((statement) => ({ ...statement, sourceIds: ["portfolio-snapshot-1"] })) }));
  const report = createCanonicalReportV1(input);
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.primaryRecommendation.executable, false);
  assert.ok(report.blockerCodes.includes("REPORT_REQUIRED_SOURCE_MISSING:SCORE_CHANGE"));
});

test("Risk-increasing Recommendation requires counter evidence", () => {
  const input = generation();
  input.primaryRecommendation = { action: "APPROVE_EXISTING_PROPOSAL", summary: "기존 제안 검토", rationaleSourceIds: ["portfolio-snapshot-1"], confidence: "HIGH", executable: true, proposalId: "proposal-1", conditions: [] };
  input.sections = input.sections.filter((section) => section.kind !== "COUNTER_EVIDENCE");
  const report = createCanonicalReportV1(input);
  assert.equal(report.status, "BLOCKED");
  assert.ok(report.blockerCodes.includes("REPORT_COUNTER_EVIDENCE_REQUIRED"));
});

test("Published Report revisions form a linear immutable chain", () => {
  const previous = createCanonicalReportV1(generation());
  const revisionInput = generation({ id: "report-2", revision: 2, supersedesReportId: previous.id, generatedAt: "2026-07-20T02:00:00Z" });
  revisionInput.request = { ...revisionInput.request, id: "report-request-2", requestedAt: "2026-07-20T01:30:00Z", idempotencyKey: "weekly-2026-07-20-correction" };
  const revision = createReportRevisionV1(previous, revisionInput);
  assert.equal(revision.revision, 2);
  assert.equal(revision.supersedesReportId, previous.id);
  assert.throws(() => createReportRevisionV1(previous, { ...revisionInput, revision: 3 }), /lineage conflict/);
});

test("Markdown escapes untrusted content and Artifact rendering is stable", () => {
  const input = generation({ title: "Weekly <script>alert(1)</script>" });
  const report = createCanonicalReportV1(input);
  const first = renderReportArtifactV1(report, "MARKDOWN");
  const second = renderReportArtifactV1(report, "MARKDOWN");
  assert.equal(first.contentHash, second.contentHash);
  assert.doesNotMatch(first.content, /<script>/);
  assert.match(first.content, /\\<script\\>/);
  assert.throws(() => renderReportArtifactV1(report, "PDF"), /not configured/);
});

test("Report Replay reproduces canonical and artifact hashes without a new revision", () => {
  const report = createCanonicalReportV1(generation());
  const replay = replayReportV1({ id: "report-replay-1", report, formats: ["MARKDOWN", "JSON"], replayedAt: "2026-07-21T00:00:00Z" });
  assert.equal(replay.matches, true);
  assert.equal(replay.replayResultHash, report.resultHash);
  assert.equal(replay.artifactHashes.MARKDOWN?.length, 64);
});
