import { reportStableHash } from "./hash.js";
import type { ReportTemplateInputV1, ReportTemplateTransitionInputV1, ReportTemplateV1 } from "./types.js";

export function validateReportTemplateV1(input: ReportTemplateInputV1): ReportTemplateV1 {
  requireText(input.id, "Report Template id");
  requireText(input.userId, "Report Template userId");
  requireText(input.version, "Report Template version");
  requireText(input.locale, "Report Template locale");
  unique(input.requiredSourceTypes, "Report Template requiredSourceTypes");
  unique(input.requiredSections, "Report Template requiredSections");
  unique(input.allowedFormats, "Report Template allowedFormats");
  if (input.requiredSourceTypes.length === 0) throw new Error("Report Template requires source types");
  if (input.requiredSections.length === 0) throw new Error("Report Template requires sections");
  if (input.allowedFormats.length === 0) throw new Error("Report Template requires allowed formats");
  if (!Number.isInteger(input.minimumCoverageBps) || input.minimumCoverageBps < 0 || input.minimumCoverageBps > 10_000) {
    throw new Error("Report Template minimumCoverageBps must be between 0 and 10000");
  }
  if (!Number.isInteger(input.maxStatementCount) || input.maxStatementCount < input.requiredSections.length || input.maxStatementCount > 1000) {
    throw new Error("Report Template maxStatementCount is invalid");
  }
  if (input.status === "DRAFT" && (input.approvedBy || input.approvedAt)) throw new Error("DRAFT Report Template cannot be approved");
  if (input.status !== "DRAFT" && (!input.approvedBy?.trim() || !input.approvedAt)) throw new Error("Approved Report Template requires reviewer and approval time");
  if (input.approvedAt && !Number.isFinite(new Date(input.approvedAt).getTime())) throw new Error("Report Template approvedAt must be a valid date");
  const configuration = {
    id: input.id,
    userId: input.userId,
    reportType: input.reportType,
    version: input.version,
    locale: input.locale,
    requiredSourceTypes: [...input.requiredSourceTypes].sort(),
    requiredSections: [...input.requiredSections],
    minimumCoverageBps: input.minimumCoverageBps,
    allowedFormats: [...input.allowedFormats].sort(),
    maxStatementCount: input.maxStatementCount,
  };
  return {
    ...structuredClone(input),
    ...configuration,
    ...(input.approvedBy ? { approvedBy: input.approvedBy } : {}),
    ...(input.approvedAt ? { approvedAt: input.approvedAt } : {}),
    contentHash: reportStableHash(configuration),
  };
}

export function transitionReportTemplateV1(input: ReportTemplateTransitionInputV1): ReportTemplateV1 {
  requireText(input.actorId, "Report Template transition actorId");
  if (!Number.isFinite(new Date(input.transitionedAt).getTime())) throw new Error("Report Template transitionedAt must be a valid date");
  const allowed: Record<ReportTemplateV1["status"], ReportTemplateV1["status"][]> = {
    DRAFT: ["APPROVED"], APPROVED: ["ACTIVE"], ACTIVE: ["DEPRECATED"], DEPRECATED: [],
  };
  if (!allowed[input.previous.status].includes(input.nextStatus)) throw new Error(`Report Template invalid transition ${input.previous.status} -> ${input.nextStatus}`);
  const transitioned = {
    ...structuredClone(input.previous),
    status: input.nextStatus,
    ...(input.nextStatus === "APPROVED" ? { approvedBy: input.actorId, approvedAt: input.transitionedAt } : {}),
  };
  return validateReportTemplateV1(transitioned);
}

function requireText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}
