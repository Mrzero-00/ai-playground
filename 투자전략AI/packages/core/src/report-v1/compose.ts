import { reportStableHash } from "./hash.js";
import type {
  CanonicalReportV1,
  ReportGenerationInputV1,
  ReportQualityV1,
  ReportSectionV1,
  ReportSourceRefV1,
  ReportStatementV1,
} from "./types.js";

const MATERIALITY_ORDER = { PRIMARY: 0, SECONDARY: 1, CONTEXT: 2 } as const;
const RISK_INCREASING_ACTIONS = new Set(["APPROVE_EXISTING_PROPOSAL", "CREATE_NEW_PROPOSAL"]);

export function createCanonicalReportV1(input: ReportGenerationInputV1): CanonicalReportV1 {
  validateIdentityAndTime(input);
  if (input.template.status !== "ACTIVE") throw new Error("Report Template is not ACTIVE");
  if (input.template.userId !== input.request.userId) throw new Error("Report Template ownership mismatch");
  if (input.template.reportType !== input.request.reportType || input.template.version !== input.request.templateVersion) {
    throw new Error("Report Template version conflict");
  }
  if (input.template.locale !== input.request.locale) throw new Error("Report Template locale conflict");
  const requestedFormats = uniqueSorted(input.request.requestedFormats, "Report requestedFormats");
  if (requestedFormats.some((format) => !input.template.allowedFormats.includes(format))) throw new Error("Report requested format is not allowed by Template");

  const sourceManifest = normalizeSources(input.request.sourceRefs, input.request.userId, input.request.dataAsOf);
  const sourceIds = new Set(sourceManifest.map((source) => source.sourceId));
  const evidenceIds = new Set(sourceManifest.flatMap((source) => source.evidenceIds));
  const sections = normalizeSections(input.sections, sourceIds, evidenceIds, input.template.maxStatementCount);
  const presentSourceTypes = new Set(sourceManifest.map((source) => source.sourceType));
  const missingSourceTypes = input.template.requiredSourceTypes.filter((type) => !presentSourceTypes.has(type));
  const presentSectionTypes = new Set(sections.filter((section) => section.statements.length > 0).map((section) => section.kind));
  const missingSections = input.template.requiredSections.filter((kind) => !presentSectionTypes.has(kind));
  const staleIds = new Set(input.staleSourceIds ?? []);
  for (const id of staleIds) if (!sourceIds.has(id)) throw new Error("Report stale Source is not in manifest");

  const normalizedRecommendation = normalizeRecommendation(input.primaryRecommendation, sourceIds, input.generatedAt);
  const counterEvidencePresent = (sections.find((section) => section.kind === "COUNTER_EVIDENCE")?.statements.length ?? 0) > 0;
  const sourceCoverageBps = Math.round((input.template.requiredSourceTypes.length - missingSourceTypes.length)
    / input.template.requiredSourceTypes.length * 10_000);
  const blockerCodes = [
    ...missingSourceTypes.map((type) => `REPORT_REQUIRED_SOURCE_MISSING:${type}`),
    ...missingSections.map((kind) => `REPORT_REQUIRED_SECTION_MISSING:${kind}`),
  ];
  if (sourceCoverageBps < input.template.minimumCoverageBps) blockerCodes.push("REPORT_SOURCE_COVERAGE_INSUFFICIENT");
  const requiredStaleIds = sourceManifest.filter((source) => source.required && staleIds.has(source.sourceId)).map((source) => source.sourceId);
  if (requiredStaleIds.length > 0) blockerCodes.push(...requiredStaleIds.map((id) => `REPORT_REQUIRED_SOURCE_STALE:${id}`));
  if (RISK_INCREASING_ACTIONS.has(input.primaryRecommendation.action) && !counterEvidencePresent) blockerCodes.push("REPORT_COUNTER_EVIDENCE_REQUIRED");
  const status = blockerCodes.length === 0 ? "READY" as const : "BLOCKED" as const;
  const quality: ReportQualityV1 = {
    completeness: missingSourceTypes.length === 0 && missingSections.length === 0 ? "COMPLETE"
      : sourceCoverageBps >= input.template.minimumCoverageBps ? "PARTIAL" : "INSUFFICIENT",
    freshness: staleIds.size === 0 ? "FRESH" : staleIds.size === sourceManifest.length ? "STALE" : "MIXED",
    lineage: "VALID",
    sourceCoverageBps,
    counterEvidencePresent,
    primaryRecommendationCount: 1,
    pointInTimeValid: true,
  };
  const recommendation = status === "BLOCKED"
    ? { ...normalizedRecommendation, executable: false }
    : normalizedRecommendation;
  const warningCodes = [...new Set([
    ...(staleIds.size > 0 ? ["REPORT_SOURCE_STALE"] : []),
    ...sections.flatMap((section) => section.statements.flatMap((statement) => statement.warningCodes)),
  ])].sort();
  const base = {
    userId: input.request.userId,
    reportType: input.request.reportType,
    title: input.title.trim(),
    audience: input.request.audience,
    locale: input.request.locale,
    timezone: input.request.timezone,
    periodStart: input.request.periodStart,
    periodEnd: input.request.periodEnd,
    dataAsOf: input.request.dataAsOf,
    templateVersion: input.template.version,
    templateContentHash: input.template.contentHash,
    rendererVersion: input.request.rendererVersion,
    primaryRecommendation: recommendation,
    sections,
    quality,
    sourceManifest,
    warningCodes,
    blockerCodes: [...new Set(blockerCodes)].sort(),
  };
  return {
    id: input.id,
    userId: base.userId,
    requestId: input.request.id,
    reportType: base.reportType,
    status,
    revision: input.revision ?? 1,
    ...(input.supersedesReportId ? { supersedesReportId: input.supersedesReportId } : {}),
    title: base.title,
    audience: base.audience,
    locale: base.locale,
    timezone: base.timezone,
    periodStart: base.periodStart,
    periodEnd: base.periodEnd,
    dataAsOf: base.dataAsOf,
    generatedAt: input.generatedAt,
    templateVersion: base.templateVersion,
    templateContentHash: base.templateContentHash,
    rendererVersion: base.rendererVersion,
    primaryRecommendation: recommendation,
    sections,
    quality,
    sourceManifest,
    warningCodes,
    blockerCodes: base.blockerCodes,
    resultHash: reportStableHash(base),
  };
}

export function createReportRevisionV1(previous: CanonicalReportV1, input: ReportGenerationInputV1): CanonicalReportV1 {
  if (input.request.userId !== previous.userId || input.request.reportType !== previous.reportType) throw new Error("Report Revision ownership or type conflict");
  if (input.supersedesReportId !== previous.id || input.revision !== previous.revision + 1) throw new Error("Report Revision lineage conflict");
  return createCanonicalReportV1(input);
}

function validateIdentityAndTime(input: ReportGenerationInputV1): void {
  for (const [label, value] of [["Report id", input.id], ["Report title", input.title], ["Report Request id", input.request.id],
    ["Report userId", input.request.userId], ["Report requestedBy", input.request.requestedBy], ["Report idempotencyKey", input.request.idempotencyKey],
    ["Report correlationId", input.request.correlationId], ["Report timezone", input.request.timezone], ["Report rendererVersion", input.request.rendererVersion]] as const) {
    if (!value.trim()) throw new Error(`${label} is required`);
  }
  const periodStart = timestamp(input.request.periodStart, "Report periodStart");
  const periodEnd = timestamp(input.request.periodEnd, "Report periodEnd");
  const dataAsOf = timestamp(input.request.dataAsOf, "Report dataAsOf");
  const requestedAt = timestamp(input.request.requestedAt, "Report requestedAt");
  const generatedAt = timestamp(input.generatedAt, "Report generatedAt");
  if (periodStart > periodEnd || periodEnd > dataAsOf || dataAsOf > requestedAt || requestedAt > generatedAt) {
    throw new Error("Report requires periodStart <= periodEnd <= dataAsOf <= requestedAt <= generatedAt");
  }
  if (!Number.isInteger(input.revision ?? 1) || (input.revision ?? 1) < 1) throw new Error("Report revision must be a positive integer");
  if ((input.revision ?? 1) === 1 && input.supersedesReportId) throw new Error("Initial Report cannot supersede another Report");
  if ((input.revision ?? 1) > 1 && !input.supersedesReportId) throw new Error("Report Revision requires supersedesReportId");
}

function normalizeSources(sources: ReportSourceRefV1[], userId: string, dataAsOf: string): ReportSourceRefV1[] {
  if (sources.length === 0) throw new Error("Report requires Source Manifest");
  const ids = new Set<string>();
  return sources.map((source) => {
    if (!source.sourceId.trim() || !/^[0-9a-f]{64}$/.test(source.resultHash)) throw new Error("Report Source identity and 64-character resultHash are required");
    if (ids.has(source.sourceId)) throw new Error("Report Source ids must be unique");
    ids.add(source.sourceId);
    if (source.userId !== userId) throw new Error("Report Source ownership mismatch");
    if (!Number.isInteger(source.sourceRevision) || source.sourceRevision < 1) throw new Error("Report Source revision must be positive");
    const availableAt = timestamp(source.availableAt, "Report Source availableAt");
    const asOf = timestamp(source.asOf, "Report Source asOf");
    if (availableAt > timestamp(dataAsOf, "Report dataAsOf") || asOf > timestamp(dataAsOf, "Report dataAsOf")) {
      throw new Error("Report Source violates Point-in-time boundary");
    }
    return {
      ...structuredClone(source),
      modelVersionIds: uniqueSorted(source.modelVersionIds, "Report Source modelVersionIds"),
      policyVersionIds: uniqueSorted(source.policyVersionIds, "Report Source policyVersionIds"),
      snapshotIds: uniqueSorted(source.snapshotIds, "Report Source snapshotIds"),
      evidenceIds: uniqueSorted(source.evidenceIds, "Report Source evidenceIds"),
    };
  }).sort((left, right) => left.sourceType.localeCompare(right.sourceType) || left.sourceId.localeCompare(right.sourceId));
}

function normalizeSections(sections: ReportSectionV1[], sourceIds: Set<string>, evidenceIds: Set<string>, maxStatementCount: number): ReportSectionV1[] {
  const kinds = new Set<string>();
  const statementIds = new Set<string>();
  let statementCount = 0;
  const normalized = sections.map((section) => {
    if (kinds.has(section.kind)) throw new Error("Report Section kinds must be unique");
    kinds.add(section.kind);
    if (!section.heading.trim() || !Number.isInteger(section.order) || section.order < 1) throw new Error("Report Section heading and positive order are required");
    const statements = section.statements.map((statement) => normalizeStatement(statement, sourceIds, evidenceIds, statementIds))
      .sort((left, right) => MATERIALITY_ORDER[left.materiality] - MATERIALITY_ORDER[right.materiality] || left.id.localeCompare(right.id));
    statementCount += statements.length;
    return { ...structuredClone(section), heading: section.heading.trim(), statements };
  }).sort((left, right) => left.order - right.order || left.kind.localeCompare(right.kind));
  if (new Set(normalized.map((section) => section.order)).size !== normalized.length) throw new Error("Report Section order must be unique");
  if (statementCount > maxStatementCount) throw new Error("Report exceeds Template maxStatementCount");
  return normalized;
}

function normalizeStatement(statement: ReportStatementV1, sourceIds: Set<string>, evidenceManifestIds: Set<string>, ids: Set<string>): ReportStatementV1 {
  if (!statement.id.trim() || !statement.text.trim()) throw new Error("Report Statement identity and text are required");
  if (ids.has(statement.id)) throw new Error("Report Statement ids must be unique");
  ids.add(statement.id);
  const normalizedSourceIds = uniqueSorted(statement.sourceIds, "Report Statement sourceIds");
  if (statement.kind === "FACT" && normalizedSourceIds.length === 0) throw new Error("Report FACT requires Source");
  if (normalizedSourceIds.some((id) => !sourceIds.has(id))) throw new Error("Report Statement references Source outside manifest");
  const normalizedEvidenceIds = uniqueSorted(statement.evidenceIds, "Report Statement evidenceIds");
  if (normalizedEvidenceIds.some((id) => !evidenceManifestIds.has(id))) throw new Error("Report Statement references Evidence outside manifest");
  return {
    ...structuredClone(statement),
    text: statement.text.trim(),
    sourceIds: normalizedSourceIds,
    evidenceIds: normalizedEvidenceIds,
    warningCodes: uniqueSorted(statement.warningCodes, "Report Statement warningCodes"),
  };
}

function normalizeRecommendation(recommendation: ReportGenerationInputV1["primaryRecommendation"], sourceIds: Set<string>, generatedAt: string): ReportGenerationInputV1["primaryRecommendation"] {
  if (!recommendation.summary.trim()) throw new Error("Report primary Recommendation summary is required");
  const rationale = uniqueSorted(recommendation.rationaleSourceIds, "Report Recommendation rationaleSourceIds");
  if (rationale.length === 0 || rationale.some((id) => !sourceIds.has(id))) throw new Error("Report Recommendation requires manifest Sources");
  if (recommendation.executable && recommendation.action !== "APPROVE_EXISTING_PROPOSAL") {
    throw new Error("Report executable Recommendation may only reference an existing Proposal");
  }
  if (recommendation.executable && !recommendation.proposalId) throw new Error("Report executable Recommendation requires proposalId");
  if (recommendation.expiresAt && timestamp(recommendation.expiresAt, "Report Recommendation expiresAt") <= timestamp(generatedAt, "Report generatedAt")) {
    throw new Error("Report Recommendation Source expired");
  }
  return {
    ...structuredClone(recommendation),
    summary: recommendation.summary.trim(),
    rationaleSourceIds: rationale,
    conditions: uniqueSorted(recommendation.conditions, "Report Recommendation conditions"),
  };
}

function uniqueSorted<T extends string>(values: T[], label: string): T[] {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
  return [...values].sort();
}

function timestamp(value: string, label: string): number {
  const result = new Date(value).getTime();
  if (!Number.isFinite(result)) throw new Error(`${label} must be a valid date`);
  return result;
}
