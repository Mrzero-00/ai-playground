import { reportStableHash } from "./hash.js";
import type { ReportTemplateInputV1, ReportTemplateV1 } from "./types.js";

export function validateReportTemplateV1(input: ReportTemplateInputV1): ReportTemplateV1 {
  requireText(input.id, "Report Template id");
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
  if (input.status !== "DRAFT" && (!input.approvedBy?.trim() || !input.approvedAt)) throw new Error("Approved Report Template requires reviewer and approval time");
  if (input.approvedAt && !Number.isFinite(new Date(input.approvedAt).getTime())) throw new Error("Report Template approvedAt must be a valid date");
  const configuration = {
    id: input.id,
    reportType: input.reportType,
    version: input.version,
    locale: input.locale,
    requiredSourceTypes: [...input.requiredSourceTypes].sort(),
    requiredSections: [...input.requiredSections],
    minimumCoverageBps: input.minimumCoverageBps,
    allowedFormats: [...input.allowedFormats].sort(),
    maxStatementCount: input.maxStatementCount,
    ...(input.approvedBy ? { approvedBy: input.approvedBy } : {}),
    ...(input.approvedAt ? { approvedAt: input.approvedAt } : {}),
  };
  return { ...structuredClone(input), ...configuration, contentHash: reportStableHash(configuration) };
}

function requireText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}
