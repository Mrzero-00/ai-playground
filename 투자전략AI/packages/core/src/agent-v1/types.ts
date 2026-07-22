export type AgentStrategyScopeV1 = "LONG_TERM" | "MOMENTUM" | "PORTFOLIO" | "RISK" | "LEARNING" | "REPORTING";
export type AgentCriticalityV1 = "ADVISORY" | "REQUIRED_FOR_ANALYSIS" | "REQUIRED_FOR_RISK";
export type AgentRunStatusV1 = "PENDING" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "BLOCKED" | "FAILED" | "TIMED_OUT" | "CANCELLED";

export type ToolCapabilityGrantV1 = {
  id: string;
  capability: string;
  version: string;
  mode: "READ_ONLY";
  allowedResourceKinds: string[];
  allowedSourceIds: string[];
  maximumCalls: number;
  timeoutMs: number;
  maximumResponseBytes: number;
  validFrom: string;
  validUntil?: string;
};

export type AgentDefinitionV1 = {
  id: string;
  version: string;
  purpose: string;
  strategyScope: AgentStrategyScopeV1;
  criticality: AgentCriticalityV1;
  promptTemplateId: string;
  promptVersion: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  allowedCapabilities: ToolCapabilityGrantV1[];
  maximumAttempts: number;
  timeoutMs: number;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  fallbackAgentDefinitionId?: string;
  enabled: boolean;
};

export type PromptTemplateV1 = {
  id: string;
  version: string;
  strategyScope: AgentStrategyScopeV1;
  systemPolicy: string;
  taskTemplate: string;
  outputSchemaVersion: string;
  requiredVariables: string[];
  forbiddenContentClasses: string[];
  status: "DRAFT" | "EVALUATING" | "APPROVED" | "ACTIVE" | "DEPRECATED";
  effectiveFrom: string;
  approvedBy?: string;
  approvedAt?: string;
  templateHash: string;
};

export type AgentRunRequestV1 = {
  id: string;
  userId: string;
  agentDefinitionId: string;
  agentDefinitionVersion: string;
  strategyScope: AgentStrategyScopeV1;
  purpose: string;
  asOf: string;
  requestedAt: string;
  correlationId: string;
  idempotencyKey: string;
  inputSnapshotIds: string[];
  evidenceIds: string[];
  context: Record<string, unknown>;
  requestedBy: { actorType: "USER" | "SYSTEM" | "SCHEDULER"; actorId: string };
  replayOfRunId?: string;
};

export type AgentProviderSelectionV1 = {
  providerId: string;
  providerVersion: string;
  modelId: string;
  modelRevision?: string;
  temperature: number;
  seed?: number;
};

export type AgentRunManifestV1 = {
  id: string;
  requestId: string;
  userId: string;
  agentDefinitionId: string;
  agentDefinitionVersion: string;
  providerId: string;
  providerVersion: string;
  modelId: string;
  modelRevision?: string;
  promptTemplateId: string;
  promptVersion: string;
  renderedPromptHash: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  inputSnapshotIds: string[];
  evidenceIds: string[];
  capabilityGrantIds: string[];
  asOf: string;
  codeVersion: string;
  temperature: number;
  seed?: number;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  createdAt: string;
  manifestHash: string;
};

export type AgentClaimKindV1 = "FACT_CANDIDATE" | "ESTIMATE" | "INTERPRETATION" | "HYPOTHESIS" | "COUNTERARGUMENT";

export type AgentClaimV1 = {
  id: string;
  kind: AgentClaimKindV1;
  subject: string;
  predicate: string;
  value: string | number | boolean;
  unit?: string;
  periodStart?: string;
  periodEnd?: string;
  evidenceRefs: Array<{
    evidenceId: string;
    location: { page?: number; section?: string; startOffset?: number; endOffset?: number };
    support: "SUPPORTS" | "CONTRADICTS" | "CONTEXT_ONLY";
  }>;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  uncertaintyReasons: string[];
  deterministicKey?: string;
};

export type AgentOutputV1 = {
  schemaVersion: "1";
  runId: string;
  status: "COMPLETED" | "PARTIAL" | "BLOCKED";
  summary: string;
  claims: AgentClaimV1[];
  counterarguments: AgentClaimV1[];
  missingInformation: Array<{
    code: string;
    description: string;
    critical: boolean;
    suggestedEvidenceKinds: string[];
  }>;
  qualityFlags: string[];
  proposedActions: Array<{
    action: "REQUEST_EVIDENCE" | "REQUEST_REVIEW" | "RERUN_DETERMINISTIC_ENGINE" | "NO_CHANGE";
    reasonCodes: string[];
  }>;
};

export type AgentEvidenceDescriptorV1 = {
  id: string;
  userId: string;
  sourceId: string;
  sourceTier: "A" | "B" | "C" | "D" | "E" | "F";
  observedAt: string;
  availableAt: string;
  contentHash: string;
  maximumOffset?: number;
};

export type AgentValidationFindingV1 = {
  code: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  path?: string;
  message: string;
  evidenceIds: string[];
};

export type AgentValidationResultV1 = {
  id: string;
  runId: string;
  userId: string;
  verdict: "ACCEPTED" | "ACCEPTED_WITH_WARNINGS" | "REJECTED";
  findings: AgentValidationFindingV1[];
  acceptedClaimIds: string[];
  rejectedClaimIds: string[];
  validatedAt: string;
  policyVersion: string;
  resultHash: string;
};

export type AgentRunV1 = {
  id: string;
  userId: string;
  request: AgentRunRequestV1;
  manifest: AgentRunManifestV1;
  criticality: AgentCriticalityV1;
  status: AgentRunStatusV1;
  attempt: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  output?: AgentOutputV1;
  validation?: AgentValidationResultV1;
  failureCodes: string[];
  resultHash: string;
};

export type AgentPlanV1 = {
  id: string;
  userId: string;
  workflow: "LONG_TERM_REVIEW" | "MOMENTUM_REVIEW" | "LEARNING_REVIEW" | "REPORT_GENERATION";
  asOf: string;
  nodes: Array<{ id: string; agentDefinitionId: string; dependsOn: string[]; required: boolean }>;
  maximumConcurrency: number;
  deadlineAt: string;
  createdAt: string;
};

export type AgentPlanValidationV1 = AgentPlanV1 & { executionOrder: string[]; resultHash: string };

export type AgentOutputValidationInputV1 = {
  id: string;
  run: AgentRunV1;
  output: AgentOutputV1;
  evidence: AgentEvidenceDescriptorV1[];
  deterministicFacts: Record<string, string | number | boolean>;
  validatedAt: string;
  policyVersion: string;
};

export type AgentRunPreparationInputV1 = {
  runId: string;
  manifestId: string;
  request: AgentRunRequestV1;
  definition: AgentDefinitionV1;
  prompt: PromptTemplateV1;
  provider: AgentProviderSelectionV1;
  codeVersion: string;
};
