export type ReportTypeV1 =
  | "DAILY_MOMENTUM_BRIEF"
  | "WEEKLY_INVESTMENT_OS"
  | "MONTHLY_CAPITAL_ALLOCATION"
  | "QUARTERLY_LONG_TERM_REVIEW"
  | "EARNINGS_REVIEW"
  | "TRADE_REVIEW"
  | "MODEL_EVOLUTION"
  | "ANNUAL_INVESTMENT_REVIEW"
  | "DECISION_REPORT";

export type ReportFormatV1 = "JSON" | "MARKDOWN" | "WEB" | "PDF" | "NOTIFICATION";
export type ReportAudienceV1 = "USER" | "APPROVER" | "REVIEWER" | "OPERATOR";
export type ReportStatusV1 = "READY" | "BLOCKED";
export type StatementKindV1 = "FACT" | "ESTIMATE" | "INTERPRETATION" | "RECOMMENDATION";
export type SectionKindV1 =
  | "CONCLUSION"
  | "CHANGES"
  | "FACTS"
  | "ESTIMATES"
  | "INTERPRETATIONS"
  | "COUNTER_EVIDENCE"
  | "RISKS"
  | "ACTIONS"
  | "NEXT_REVIEW"
  | "SOURCES";

export type ReportSourceTypeV1 =
  | "LONG_TERM_EVALUATION"
  | "MOMENTUM_EVALUATION"
  | "MOMENTUM_PLAN"
  | "PORTFOLIO_SNAPSHOT"
  | "ALLOCATION_PROPOSAL"
  | "CAPITAL_ALLOCATION"
  | "RISK_DECISION"
  | "LEARNING_REVIEW"
  | "COHORT_ANALYSIS"
  | "LESSON"
  | "MODEL_CHANGE"
  | "MODEL_VALIDATION"
  | "SCORECARD"
  | "SCORE_CHANGE"
  | "EVIDENCE"
  | "SNAPSHOT";

export type ReportSourceRefV1 = {
  sourceType: ReportSourceTypeV1;
  sourceId: string;
  sourceRevision: number;
  userId: string;
  availableAt: string;
  asOf: string;
  resultHash: string;
  modelVersionIds: string[];
  policyVersionIds: string[];
  snapshotIds: string[];
  evidenceIds: string[];
  required: boolean;
};

export type ReportRequestV1 = {
  id: string;
  userId: string;
  reportType: ReportTypeV1;
  audience: ReportAudienceV1;
  locale: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  dataAsOf: string;
  requestedAt: string;
  requestedBy: string;
  templateVersion: string;
  rendererVersion: string;
  sourceRefs: ReportSourceRefV1[];
  requestedFormats: ReportFormatV1[];
  idempotencyKey: string;
  correlationId: string;
};

export type ReportTemplateInputV1 = {
  id: string;
  reportType: ReportTypeV1;
  version: string;
  status: "DRAFT" | "APPROVED" | "ACTIVE" | "DEPRECATED";
  locale: string;
  requiredSourceTypes: ReportSourceTypeV1[];
  requiredSections: SectionKindV1[];
  minimumCoverageBps: number;
  allowedFormats: ReportFormatV1[];
  maxStatementCount: number;
  approvedBy?: string;
  approvedAt?: string;
};

export type ReportTemplateV1 = ReportTemplateInputV1 & { contentHash: string };

export type ReportStatementV1 = {
  id: string;
  kind: StatementKindV1;
  text: string;
  sourceIds: string[];
  evidenceIds: string[];
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  materiality: "PRIMARY" | "SECONDARY" | "CONTEXT";
  warningCodes: string[];
};

export type ReportSectionV1 = {
  kind: SectionKindV1;
  heading: string;
  order: number;
  statements: ReportStatementV1[];
};

export type RecommendationActionV1 =
  | "REVIEW"
  | "APPROVE_EXISTING_PROPOSAL"
  | "REJECT_EXISTING_PROPOSAL"
  | "HOLD_CASH"
  | "NO_ACTION"
  | "WAIT_FOR_DATA"
  | "REDUCE_RISK"
  | "CREATE_NEW_PROPOSAL";

export type ReportRecommendationV1 = {
  action: RecommendationActionV1;
  summary: string;
  rationaleSourceIds: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  executable: boolean;
  proposalId?: string;
  expiresAt?: string;
  conditions: string[];
};

export type ReportQualityV1 = {
  completeness: "COMPLETE" | "PARTIAL" | "INSUFFICIENT";
  freshness: "FRESH" | "STALE" | "MIXED";
  lineage: "VALID" | "INVALID";
  sourceCoverageBps: number;
  counterEvidencePresent: boolean;
  primaryRecommendationCount: number;
  pointInTimeValid: boolean;
};

export type CanonicalReportV1 = {
  id: string;
  userId: string;
  requestId: string;
  reportType: ReportTypeV1;
  status: ReportStatusV1;
  revision: number;
  supersedesReportId?: string;
  title: string;
  audience: ReportAudienceV1;
  locale: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  dataAsOf: string;
  generatedAt: string;
  templateVersion: string;
  templateContentHash: string;
  rendererVersion: string;
  primaryRecommendation: ReportRecommendationV1;
  sections: ReportSectionV1[];
  quality: ReportQualityV1;
  sourceManifest: ReportSourceRefV1[];
  warningCodes: string[];
  blockerCodes: string[];
  resultHash: string;
};

export type ReportGenerationInputV1 = {
  id: string;
  request: ReportRequestV1;
  template: ReportTemplateV1;
  title: string;
  primaryRecommendation: ReportRecommendationV1;
  sections: ReportSectionV1[];
  generatedAt: string;
  revision?: number;
  supersedesReportId?: string;
  staleSourceIds?: string[];
};

export type ReportArtifactV1 = {
  id: string;
  userId: string;
  reportId: string;
  reportRevision: number;
  format: ReportFormatV1;
  rendererVersion: string;
  locale: string;
  content: string;
  contentType: string;
  contentHash: string;
  redactionPolicyVersion?: string;
  generatedAt: string;
};

export type ReportReplayResultV1 = {
  id: string;
  userId: string;
  replayOfReportId: string;
  replayedAt: string;
  sourceResultHash: string;
  replayResultHash: string;
  matches: boolean;
  artifactHashes: Partial<Record<ReportFormatV1, string>>;
  resultHash: string;
};
