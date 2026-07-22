import { agentStableHash } from "./hash.js";
import { validateAgentDefinitionV1, validatePromptTemplateV1 } from "./definition.js";
import { normalizeAgentOutputV1 } from "./validation.js";
import type { AgentRunManifestV1, AgentRunPreparationInputV1, AgentRunRequestV1, AgentRunV1 } from "./types.js";

export function prepareAgentRunV1(input: AgentRunPreparationInputV1): AgentRunV1 {
  const definition = validateAgentDefinitionV1(input.definition);
  const prompt = validatePromptTemplateV1(input.prompt);
  validateRequest(input.request);
  if (!definition.enabled) throw new Error("Agent Definition is disabled");
  if (input.request.agentDefinitionId !== definition.id || input.request.agentDefinitionVersion !== definition.version) throw new Error("Agent Definition version conflict");
  if (input.request.strategyScope !== definition.strategyScope || prompt.strategyScope !== definition.strategyScope) throw new Error("Agent Strategy Scope conflict");
  if (prompt.id !== definition.promptTemplateId || prompt.version !== definition.promptVersion || prompt.outputSchemaVersion !== definition.outputSchemaVersion) throw new Error("Agent Prompt version conflict");
  if (prompt.status !== "ACTIVE") throw new Error("Agent Prompt must be ACTIVE");
  if (new Date(prompt.effectiveFrom).getTime() > new Date(input.request.requestedAt).getTime()) throw new Error("Agent Prompt is not effective at requestedAt");
  if (prompt.approvedAt && new Date(prompt.approvedAt).getTime() > new Date(input.request.requestedAt).getTime()) throw new Error("Agent Prompt approval is after requestedAt");
  if (!input.runId.trim() || !input.manifestId.trim() || input.runId === input.manifestId || !input.codeVersion.trim()) throw new Error("Agent Run, Manifest and codeVersion identities are required");
  validateProvider(input.provider);
  const renderedPromptHash = agentStableHash({
    systemPolicy: prompt.systemPolicy,
    taskTemplate: prompt.taskTemplate,
    purpose: input.request.purpose,
    asOf: input.request.asOf,
    evidenceIds: [...input.request.evidenceIds].sort(),
    inputSnapshotIds: [...input.request.inputSnapshotIds].sort(),
    context: input.request.context,
  });
  const withoutManifestHash: Omit<AgentRunManifestV1, "manifestHash"> = {
    id: input.manifestId,
    requestId: input.request.id,
    userId: input.request.userId,
    agentDefinitionId: definition.id,
    agentDefinitionVersion: definition.version,
    providerId: input.provider.providerId,
    providerVersion: input.provider.providerVersion,
    modelId: input.provider.modelId,
    ...(input.provider.modelRevision === undefined ? {} : { modelRevision: input.provider.modelRevision }),
    promptTemplateId: prompt.id,
    promptVersion: prompt.version,
    renderedPromptHash,
    inputSchemaVersion: definition.inputSchemaVersion,
    outputSchemaVersion: definition.outputSchemaVersion,
    inputSnapshotIds: [...input.request.inputSnapshotIds].sort(),
    evidenceIds: [...input.request.evidenceIds].sort(),
    capabilityGrantIds: definition.allowedCapabilities.map((grant) => grant.id).sort(),
    asOf: input.request.asOf,
    codeVersion: input.codeVersion,
    temperature: input.provider.temperature,
    ...(input.provider.seed === undefined ? {} : { seed: input.provider.seed }),
    maximumInputTokens: definition.maximumInputTokens,
    maximumOutputTokens: definition.maximumOutputTokens,
    createdAt: input.request.requestedAt,
  };
  const manifest: AgentRunManifestV1 = { ...withoutManifestHash, manifestHash: agentStableHash(withoutManifestHash) };
  const withoutHash: Omit<AgentRunV1, "resultHash"> = {
    id: input.runId,
    userId: input.request.userId,
    request: structuredClone(input.request),
    manifest,
    criticality: definition.criticality,
    status: "PENDING",
    attempt: 0,
    createdAt: input.request.requestedAt,
    failureCodes: [],
  };
  return { ...withoutHash, resultHash: agentStableHash(withoutHash) };
}

export function startAgentRunV1(run: AgentRunV1, startedAt: string): AgentRunV1 {
  if (run.status !== "PENDING") throw new Error("Only PENDING Agent Run can start");
  const started = parseDate(startedAt, "Agent Run startedAt");
  if (started < parseDate(run.createdAt, "Agent Run createdAt")) throw new Error("Agent Run startedAt cannot precede createdAt");
  const withoutHash: Omit<AgentRunV1, "resultHash"> = {
    ...structuredClone(run), status: "RUNNING", attempt: run.attempt + 1, startedAt,
  };
  return { ...withoutHash, resultHash: agentStableHash(withoutHash) };
}

export function cancelAgentRunV1(run: AgentRunV1, finishedAt: string): AgentRunV1 {
  if (terminalStatuses.has(run.status)) throw new Error("Terminal Agent Run cannot be cancelled");
  return finish(run, "CANCELLED", finishedAt, ["CANCELLED"]);
}

export function failAgentRunV1(run: AgentRunV1, input: { status: "FAILED" | "TIMED_OUT" | "BLOCKED"; finishedAt: string; failureCodes: string[] }): AgentRunV1 {
  if (input.failureCodes.length === 0) throw new Error("Failed Agent Run requires failure codes");
  return finish(run, input.status, input.finishedAt, input.failureCodes);
}

export function finishAgentRunV1(run: AgentRunV1, input: { output: AgentRunV1["output"]; validation: NonNullable<AgentRunV1["validation"]>; finishedAt: string }): AgentRunV1 {
  if (!input.output || input.output.runId !== run.id || input.validation.runId !== run.id) throw new Error("Agent Run output lineage conflict");
  const output = normalizeAgentOutputV1(input.output);
  const status: AgentRunV1["status"] = input.validation.verdict === "REJECTED" || output.status === "BLOCKED"
    ? "BLOCKED" : input.validation.verdict === "ACCEPTED_WITH_WARNINGS" || output.status === "PARTIAL" ? "PARTIAL" : "SUCCEEDED";
  const failureCodes = input.validation.findings.filter((finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL").map((finding) => finding.code);
  if (status === "BLOCKED" && failureCodes.length === 0) failureCodes.push("OUTPUT_SELF_BLOCKED");
  if (new Date(input.finishedAt).getTime() < new Date(input.validation.validatedAt).getTime()) throw new Error("Agent Run finishedAt cannot precede validation");
  const base = run.status === "PENDING" ? startAgentRunV1(run, run.createdAt) : run;
  return finish(base, status, input.finishedAt, failureCodes, output, input.validation);
}

const terminalStatuses = new Set<AgentRunV1["status"]>(["SUCCEEDED", "PARTIAL", "BLOCKED", "FAILED", "TIMED_OUT", "CANCELLED"]);

function finish(run: AgentRunV1, status: AgentRunV1["status"], finishedAt: string, failureCodes: string[], output?: AgentRunV1["output"], validation?: AgentRunV1["validation"]): AgentRunV1 {
  if (terminalStatuses.has(run.status)) throw new Error("Terminal Agent Run is immutable");
  const finished = parseDate(finishedAt, "Agent Run finishedAt");
  const lowerBound = parseDate(run.startedAt ?? run.createdAt, "Agent Run start");
  if (finished < lowerBound) throw new Error("Agent Run finishedAt cannot precede start");
  const withoutHash: Omit<AgentRunV1, "resultHash"> = {
    ...structuredClone(run), status, finishedAt, failureCodes: [...new Set(failureCodes)].sort(),
    ...(output === undefined ? {} : { output: structuredClone(output) }),
    ...(validation === undefined ? {} : { validation: structuredClone(validation) }),
  };
  return { ...withoutHash, resultHash: agentStableHash(withoutHash) };
}

function validateRequest(request: AgentRunRequestV1): void {
  for (const [name, value] of Object.entries({ id: request.id, userId: request.userId, agentDefinitionId: request.agentDefinitionId, agentDefinitionVersion: request.agentDefinitionVersion, purpose: request.purpose, correlationId: request.correlationId, idempotencyKey: request.idempotencyKey, actorId: request.requestedBy.actorId })) {
    if (!value.trim()) throw new Error(`Agent Run Request ${name} is required`);
  }
  const asOf = parseDate(request.asOf, "Agent Run asOf");
  const requestedAt = parseDate(request.requestedAt, "Agent Run requestedAt");
  if (asOf > requestedAt) throw new Error("Agent Run asOf cannot be after requestedAt");
  if (request.requestedBy.actorType === "USER" && request.requestedBy.actorId !== request.userId) throw new Error("Agent Run USER actor must match owner");
  validateIds(request.inputSnapshotIds, "inputSnapshotIds", false);
  validateIds(request.evidenceIds, "evidenceIds", true);
  validateContext(request.context);
}

function validateProvider(provider: AgentRunPreparationInputV1["provider"]): void {
  if (!provider.providerId.trim() || !provider.providerVersion.trim() || !provider.modelId.trim()) throw new Error("Agent Provider identity is required");
  if (!Number.isFinite(provider.temperature) || provider.temperature < 0 || provider.temperature > 2) throw new Error("Agent Provider temperature is outside 0..2");
  if (provider.seed !== undefined && !Number.isInteger(provider.seed)) throw new Error("Agent Provider seed must be an integer");
}

function validateIds(values: string[], name: string, required: boolean): void {
  if (required && values.length === 0) throw new Error(`Agent Run ${name} is required`);
  if (values.some((value) => !value.trim()) || new Set(values).size !== values.length) throw new Error(`Agent Run ${name} must contain unique non-blank ids`);
}

function validateContext(value: unknown, depth = 0): void {
  if (depth > 12) throw new Error("Agent Context exceeds maximum depth");
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Agent Context cannot contain non-finite numbers");
  if (Array.isArray(value)) {
    if (value.length > 500) throw new Error("Agent Context array is too large");
    for (const entry of value) validateContext(entry, depth + 1);
  } else if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 500) throw new Error("Agent Context object is too large");
    for (const [key, entry] of entries) {
      if (/api.?key|secret|password|access.?token|account.?number|email/i.test(key)) throw new Error("Agent Context contains a forbidden sensitive field");
      validateContext(entry, depth + 1);
    }
  }
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`);
  return parsed;
}
