import { reportStableHash } from "./hash.js";
import type { CanonicalReportV1, ReportArtifactV1, ReportFormatV1, ReportReplayResultV1 } from "./types.js";

const CONTENT_TYPES: Record<ReportFormatV1, string> = {
  JSON: "application/json",
  MARKDOWN: "text/markdown",
  WEB: "application/json",
  PDF: "application/pdf",
  NOTIFICATION: "text/plain",
};

export function renderReportArtifactV1(
  report: CanonicalReportV1,
  format: ReportFormatV1,
  options: { id?: string; generatedAt?: string; redactionPolicyVersion?: string } = {},
): ReportArtifactV1 {
  if (format === "PDF") throw new Error("Report PDF Renderer is not configured");
  const content = format === "JSON" || format === "WEB" ? JSON.stringify(report)
    : format === "MARKDOWN" ? renderMarkdown(report)
      : renderNotification(report);
  const generatedAt = options.generatedAt ?? report.generatedAt;
  return {
    id: options.id ?? `${report.id}:${format.toLowerCase()}`,
    userId: report.userId,
    reportId: report.id,
    reportRevision: report.revision,
    format,
    rendererVersion: report.rendererVersion,
    locale: report.locale,
    content,
    contentType: CONTENT_TYPES[format],
    contentHash: reportStableHash({ format, rendererVersion: report.rendererVersion, locale: report.locale, content, redactionPolicyVersion: options.redactionPolicyVersion }),
    ...(options.redactionPolicyVersion ? { redactionPolicyVersion: options.redactionPolicyVersion } : {}),
    generatedAt,
  };
}

export function replayReportV1(input: { id: string; report: CanonicalReportV1; formats: ReportFormatV1[]; replayedAt: string }): ReportReplayResultV1 {
  if (!input.id.trim()) throw new Error("Report Replay id is required");
  if (!Number.isFinite(new Date(input.replayedAt).getTime())) throw new Error("Report Replay replayedAt must be valid");
  const artifactHashes: Partial<Record<ReportFormatV1, string>> = {};
  for (const format of [...new Set(input.formats)].sort()) {
    if (format === "PDF") continue;
    artifactHashes[format] = renderReportArtifactV1(input.report, format).contentHash;
  }
  const replayResultHash = reportStableHash(canonicalHashInput(input.report));
  const base = {
    userId: input.report.userId,
    replayOfReportId: input.report.id,
    sourceResultHash: input.report.resultHash,
    replayResultHash,
    matches: replayResultHash === input.report.resultHash,
    artifactHashes,
  };
  return { id: input.id, ...base, replayedAt: input.replayedAt, resultHash: reportStableHash(base) };
}

function canonicalHashInput(report: CanonicalReportV1): unknown {
  return {
    userId: report.userId,
    reportType: report.reportType,
    title: report.title,
    audience: report.audience,
    locale: report.locale,
    timezone: report.timezone,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    dataAsOf: report.dataAsOf,
    templateVersion: report.templateVersion,
    templateContentHash: report.templateContentHash,
    rendererVersion: report.rendererVersion,
    primaryRecommendation: report.primaryRecommendation,
    sections: report.sections,
    quality: report.quality,
    sourceManifest: report.sourceManifest,
    warningCodes: report.warningCodes,
    blockerCodes: report.blockerCodes,
  };
}

function renderMarkdown(report: CanonicalReportV1): string {
  const lines = [
    `# ${escapeMarkdown(report.title)}`,
    "",
    `Status: ${report.status}`,
    `Data as of: ${report.dataAsOf}`,
    `Generated: ${report.generatedAt}`,
    `Confidence: ${report.primaryRecommendation.confidence}`,
    "",
    "## Priority Recommendation",
    "",
    `- ${escapeMarkdown(report.primaryRecommendation.summary)}`,
  ];
  if (report.blockerCodes.length > 0) lines.push("", "## Blockers", "", ...report.blockerCodes.map((code) => `- ${escapeMarkdown(code)}`));
  for (const section of report.sections) {
    lines.push("", `## ${escapeMarkdown(section.heading)}`, "");
    if (section.statements.length === 0) lines.push("- None");
    for (const statement of section.statements) {
      const sources = statement.sourceIds.length > 0 ? ` [Sources: ${statement.sourceIds.map((id) => `\`${escapeCode(id)}\``).join(", ")}]` : "";
      lines.push(`- **${statement.kind}**: ${escapeMarkdown(statement.text)}${sources}`);
    }
  }
  lines.push("", "## Source Manifest", "", ...report.sourceManifest.map((source) => `- ${source.sourceType}: \`${escapeCode(source.sourceId)}\` @ ${source.asOf}`));
  return lines.join("\n");
}

function renderNotification(report: CanonicalReportV1): string {
  const warning = report.blockerCodes[0] ?? report.warningCodes[0];
  const parts = [report.title, report.primaryRecommendation.summary, warning ? `Warning: ${warning}` : undefined, `Report: ${report.id}`].filter(Boolean) as string[];
  const content = parts.join("\n");
  return content.length <= 500 ? content : `${content.slice(0, 497).trimEnd()}...`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!<>|]/g, "\\$&");
}

function escapeCode(value: string): string {
  return value.replace(/`/g, "'").replace(/[\r\n]/g, " ");
}
