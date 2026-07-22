import { agentStableHash } from "./hash.js";
import type {
  AgentClaimV1,
  AgentEvidenceDescriptorV1,
  AgentOutputValidationInputV1,
  AgentValidationFindingV1,
  AgentValidationResultV1,
} from "./types.js";

const forbiddenKeys = /^(approved|approval|order|execute|activateModel|overrideRisk|positionQuantity|approvedAmount|policyWeights?)$/i;
const sensitiveKeys = /api.?key|secret|password|access.?token|account.?number|email/i;
const injectionPatterns = [
  /ignore (all |the )?(previous|system) instructions/i,
  /reveal (the )?(system prompt|secret|api key)/i,
  /execute (this |the )?(tool|command|sql|shell)/i,
  /BEGIN (SYSTEM|DEVELOPER) MESSAGE/i,
];

export function validateAgentOutputV1(input: AgentOutputValidationInputV1): AgentValidationResultV1 {
  input = { ...input, output: normalizeAgentOutputV1(input.output) };
  if (!input.id.trim() || !input.policyVersion.trim()) throw new Error("Agent Validation identity and policyVersion are required");
  const validatedAt = parseDate(input.validatedAt, "Agent Validation validatedAt");
  if (validatedAt < parseDate(input.run.createdAt, "Agent Run createdAt")) throw new Error("Agent Validation cannot precede its Run");
  if (terminalStatuses.has(input.run.status)) throw new Error("Terminal Agent Run output is immutable");
  const findings: AgentValidationFindingV1[] = [];
  if (input.output.schemaVersion !== input.run.manifest.outputSchemaVersion) add(findings, "OUTPUT_SCHEMA_VERSION_CONFLICT", "CRITICAL", "schemaVersion", "Output Schema Version does not match Run Manifest");
  if (input.output.runId !== input.run.id) add(findings, "OUTPUT_RUN_LINEAGE_CONFLICT", "CRITICAL", "runId", "Output runId does not match Agent Run");
  if (!input.output.summary.trim() || input.output.summary.length > 8_000) add(findings, "OUTPUT_SUMMARY_INVALID", "ERROR", "summary", "Summary must be non-blank and within 8,000 characters");
  findForbiddenAuthority(input.output, "$", findings, 0);
  findInjection(input.output, "$", findings, 0);
  const evidence = validateEvidenceCatalog(input.evidence, input.run.userId, input.run.manifest.asOf, input.run.manifest.evidenceIds, findings);
  const allClaims = [...input.output.claims, ...input.output.counterarguments];
  const claimIds = allClaims.map((claim) => claim.id);
  if (claimIds.some((id) => !id.trim()) || new Set(claimIds).size !== claimIds.length) add(findings, "CLAIM_ID_INVALID", "ERROR", "claims", "Claim ids must be unique and non-blank");
  const rejectedClaimIds = new Set<string>();
  for (const [index, claim] of input.output.claims.entries()) validateClaim(claim, `claims[${index}]`, false, input, evidence, findings, rejectedClaimIds);
  for (const [index, claim] of input.output.counterarguments.entries()) validateClaim(claim, `counterarguments[${index}]`, true, input, evidence, findings, rejectedClaimIds);
  for (const [index, item] of input.output.missingInformation.entries()) {
    if (!item.code.trim() || !item.description.trim() || item.suggestedEvidenceKinds.some((kind) => !kind.trim())) add(findings, "MISSING_INFORMATION_INVALID", "ERROR", `missingInformation[${index}]`, "Missing Information requires code, description and valid Evidence kinds");
  }
  for (const [index, item] of input.output.proposedActions.entries()) if (item.reasonCodes.length === 0 || item.reasonCodes.some((code) => !code.trim())) add(findings, "PROPOSED_ACTION_REASON_REQUIRED", "ERROR", `proposedActions[${index}]`, "Proposed Action requires reason codes");
  if (input.output.missingInformation.some((item) => item.critical) && input.output.status !== "BLOCKED") add(findings, "CRITICAL_INFORMATION_NOT_BLOCKED", "CRITICAL", "status", "Critical missing information requires BLOCKED output");
  const hasRejecting = findings.some((finding) => finding.severity === "ERROR" || finding.severity === "CRITICAL");
  const hasWarning = findings.some((finding) => finding.severity === "WARNING");
  const verdict: AgentValidationResultV1["verdict"] = hasRejecting ? "REJECTED" : hasWarning ? "ACCEPTED_WITH_WARNINGS" : "ACCEPTED";
  if (findings.some((finding) => finding.severity === "CRITICAL")) for (const id of claimIds) if (id) rejectedClaimIds.add(id);
  const acceptedClaimIds = claimIds.filter((id) => id && !rejectedClaimIds.has(id)).sort();
  const withoutHash: Omit<AgentValidationResultV1, "resultHash"> = {
    id: input.id,
    runId: input.run.id,
    userId: input.run.userId,
    verdict,
    findings: findings.sort((left, right) => left.code.localeCompare(right.code) || (left.path ?? "").localeCompare(right.path ?? "")),
    acceptedClaimIds,
    rejectedClaimIds: [...rejectedClaimIds].sort(),
    validatedAt: input.validatedAt,
    policyVersion: input.policyVersion,
  };
  return { ...withoutHash, resultHash: agentStableHash(withoutHash) };
}

export function normalizeAgentOutputV1(value: unknown): AgentOutputValidationInputV1["output"] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Agent Output Schema requires an object");
  const output = value as AgentOutputValidationInputV1["output"];
  if (output.schemaVersion !== "1" || typeof output.runId !== "string" || typeof output.summary !== "string" || !["COMPLETED", "PARTIAL", "BLOCKED"].includes(output.status)) throw new Error("Agent Output Schema metadata is invalid");
  if (![output.claims, output.counterarguments, output.missingInformation, output.qualityFlags, output.proposedActions].every(Array.isArray)) throw new Error("Agent Output Schema collections must be arrays");
  for (const claim of [...output.claims, ...output.counterarguments]) {
    if (claim === null || typeof claim !== "object" || typeof claim.id !== "string" || typeof claim.subject !== "string" || typeof claim.predicate !== "string"
      || !["string", "number", "boolean"].includes(typeof claim.value) || !["FACT_CANDIDATE", "ESTIMATE", "INTERPRETATION", "HYPOTHESIS", "COUNTERARGUMENT"].includes(claim.kind)
      || !["HIGH", "MEDIUM", "LOW", "UNVERIFIED"].includes(claim.confidence) || !Array.isArray(claim.evidenceRefs) || !Array.isArray(claim.uncertaintyReasons)
      || claim.uncertaintyReasons.some((reason) => typeof reason !== "string")) throw new Error("Agent Output Schema Claim is invalid");
    for (const ref of claim.evidenceRefs) if (ref === null || typeof ref !== "object" || typeof ref.evidenceId !== "string"
      || !["SUPPORTS", "CONTRADICTS", "CONTEXT_ONLY"].includes(ref.support) || ref.location === null || typeof ref.location !== "object" || Array.isArray(ref.location)) throw new Error("Agent Output Schema Evidence Reference is invalid");
  }
  for (const item of output.missingInformation) if (item === null || typeof item !== "object" || typeof item.code !== "string" || typeof item.description !== "string" || typeof item.critical !== "boolean" || !Array.isArray(item.suggestedEvidenceKinds) || item.suggestedEvidenceKinds.some((kind) => typeof kind !== "string")) throw new Error("Agent Output Schema Missing Information is invalid");
  if (output.qualityFlags.some((flag) => typeof flag !== "string")) throw new Error("Agent Output Schema Quality Flags are invalid");
  for (const item of output.proposedActions) if (item === null || typeof item !== "object" || !["REQUEST_EVIDENCE", "REQUEST_REVIEW", "RERUN_DETERMINISTIC_ENGINE", "NO_CHANGE"].includes(item.action) || !Array.isArray(item.reasonCodes) || item.reasonCodes.some((code) => typeof code !== "string")) throw new Error("Agent Output Schema Proposed Action is invalid");
  const normalizeClaim = (claim: AgentClaimV1): AgentClaimV1 => ({
    ...structuredClone(claim),
    evidenceRefs: [...claim.evidenceRefs].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId) || left.support.localeCompare(right.support) || JSON.stringify(left.location).localeCompare(JSON.stringify(right.location))),
    uncertaintyReasons: [...claim.uncertaintyReasons].sort(),
  });
  return {
    ...structuredClone(output),
    claims: output.claims.map(normalizeClaim).sort((left, right) => left.id.localeCompare(right.id)),
    counterarguments: output.counterarguments.map(normalizeClaim).sort((left, right) => left.id.localeCompare(right.id)),
    missingInformation: output.missingInformation.map((item) => ({ ...structuredClone(item), suggestedEvidenceKinds: [...item.suggestedEvidenceKinds].sort() })).sort((left, right) => left.code.localeCompare(right.code)),
    qualityFlags: [...output.qualityFlags].sort(),
    proposedActions: output.proposedActions.map((item) => ({ ...structuredClone(item), reasonCodes: [...item.reasonCodes].sort() })).sort((left, right) => left.action.localeCompare(right.action)),
  };
}

function validateClaim(
  claim: AgentClaimV1,
  path: string,
  counterargument: boolean,
  input: AgentOutputValidationInputV1,
  evidence: Map<string, AgentEvidenceDescriptorV1>,
  findings: AgentValidationFindingV1[],
  rejected: Set<string>,
): void {
  const reject = (code: string, severity: AgentValidationFindingV1["severity"], message: string, evidenceIds: string[] = []): void => {
    add(findings, code, severity, path, message, evidenceIds);
    if (severity === "ERROR" || severity === "CRITICAL") rejected.add(claim.id);
  };
  if (!claim.id.trim() || !claim.subject.trim() || !claim.predicate.trim() || typeof claim.value === "string" && !claim.value.trim()) reject("CLAIM_REQUIRED_FIELD_MISSING", "ERROR", "Claim identity, subject, predicate and value are required");
  if (typeof claim.value === "number" && !Number.isFinite(claim.value)) reject("CLAIM_VALUE_NOT_FINITE", "ERROR", "Claim number must be finite");
  if (counterargument && claim.kind !== "COUNTERARGUMENT" || !counterargument && claim.kind === "COUNTERARGUMENT") reject("CLAIM_KIND_SECTION_CONFLICT", "ERROR", "Claim kind does not match its Output section");
  if (claim.evidenceRefs.length === 0 && (claim.kind === "FACT_CANDIDATE" || claim.kind === "ESTIMATE" || claim.kind === "COUNTERARGUMENT")) reject("CLAIM_EVIDENCE_REQUIRED", "ERROR", "Evidence-bound Claim requires Evidence");
  if (claim.kind === "FACT_CANDIDATE" && !claim.evidenceRefs.some((ref) => ref.support === "SUPPORTS")) reject("FACT_SUPPORT_REQUIRED", "ERROR", "Fact Candidate requires supporting Evidence");
  if (claim.kind === "ESTIMATE" && (!claim.unit?.trim() || claim.uncertaintyReasons.length === 0)) reject("ESTIMATE_METHOD_INCOMPLETE", "ERROR", "Estimate requires unit and uncertainty reasons");
  if (claim.kind === "HYPOTHESIS" && claim.uncertaintyReasons.length === 0) reject("HYPOTHESIS_FALSIFICATION_MISSING", "ERROR", "Hypothesis requires uncertainty or falsification conditions");
  if (new Set(claim.evidenceRefs.map((ref) => `${ref.evidenceId}:${JSON.stringify(ref.location)}:${ref.support}`)).size !== claim.evidenceRefs.length) reject("CLAIM_EVIDENCE_DUPLICATED", "ERROR", "Claim Evidence references must be unique");
  for (const ref of claim.evidenceRefs) {
    const descriptor = evidence.get(ref.evidenceId);
    if (!descriptor) {
      reject("CLAIM_EVIDENCE_NOT_AVAILABLE", "CRITICAL", `Evidence ${ref.evidenceId} is not available to this Run`, [ref.evidenceId]);
      continue;
    }
    if (!validLocation(ref.location, descriptor.maximumOffset)) reject("CLAIM_EVIDENCE_LOCATION_INVALID", "ERROR", "Evidence location is invalid", [ref.evidenceId]);
  }
  if (claim.confidence === "HIGH") {
    const supporting = claim.evidenceRefs.filter((ref) => ref.support === "SUPPORTS").map((ref) => evidence.get(ref.evidenceId));
    if (supporting.length === 0 || supporting.some((item) => !item || !["A", "B", "C"].includes(item.sourceTier))) reject("HIGH_CONFIDENCE_SOURCE_INELIGIBLE", "ERROR", "HIGH Confidence requires verified A-C supporting Evidence");
  }
  if (claim.deterministicKey !== undefined) {
    if (!(claim.deterministicKey in input.deterministicFacts)) reject("DETERMINISTIC_RESULT_NOT_FOUND", "ERROR", "Referenced deterministic result was not provided");
    else if (input.deterministicFacts[claim.deterministicKey] !== claim.value) reject("DETERMINISTIC_CONFLICT", input.run.criticality === "REQUIRED_FOR_RISK" ? "CRITICAL" : "ERROR", "Agent Claim conflicts with deterministic result");
  }
  if (claim.periodStart !== undefined || claim.periodEnd !== undefined) {
    const start = claim.periodStart === undefined ? undefined : parseDate(claim.periodStart, "Claim periodStart");
    const end = claim.periodEnd === undefined ? undefined : parseDate(claim.periodEnd, "Claim periodEnd");
    if (start !== undefined && end !== undefined && start > end || end !== undefined && end > parseDate(input.run.manifest.asOf, "Run asOf")) reject("CLAIM_PERIOD_INVALID", "CRITICAL", "Claim period is invalid or after Run asOf");
  }
}

function validateEvidenceCatalog(values: AgentEvidenceDescriptorV1[], userId: string, asOf: string, allowedIds: string[], findings: AgentValidationFindingV1[]): Map<string, AgentEvidenceDescriptorV1> {
  const allowed = new Set(allowedIds);
  const result = new Map<string, AgentEvidenceDescriptorV1>();
  const asOfTime = parseDate(asOf, "Agent Run asOf");
  for (const [index, item] of values.entries()) {
    const path = `evidence[${index}]`;
    if (result.has(item.id)) add(findings, "EVIDENCE_DUPLICATED", "ERROR", path, "Evidence Descriptor id is duplicated", [item.id]);
    if (!allowed.has(item.id)) add(findings, "EVIDENCE_NOT_IN_MANIFEST", "CRITICAL", path, "Evidence is not declared in Run Manifest", [item.id]);
    if (item.userId !== userId) add(findings, "EVIDENCE_OWNERSHIP_MISMATCH", "CRITICAL", path, "Evidence owner does not match Agent Run", [item.id]);
    const observedAt = parseDateFinding(item.observedAt, "EVIDENCE_TIME_INVALID", path, findings, item.id);
    const availableAt = parseDateFinding(item.availableAt, "EVIDENCE_TIME_INVALID", path, findings, item.id);
    if (observedAt !== undefined && availableAt !== undefined && (observedAt > availableAt || availableAt > asOfTime)) add(findings, "EVIDENCE_POINT_IN_TIME_VIOLATION", "CRITICAL", path, "Evidence must satisfy observedAt <= availableAt <= Run asOf", [item.id]);
    if (!/^[0-9a-f]{64}$/.test(item.contentHash)) add(findings, "EVIDENCE_HASH_INVALID", "ERROR", path, "Evidence contentHash must be SHA-256", [item.id]);
    result.set(item.id, structuredClone(item));
  }
  for (const id of allowed) if (!result.has(id)) add(findings, "MANIFEST_EVIDENCE_MISSING", "ERROR", "evidence", "Run Manifest Evidence was not provided", [id]);
  return result;
}

function findForbiddenAuthority(value: unknown, path: string, findings: AgentValidationFindingV1[], depth: number): void {
  if (depth > 20) { add(findings, "OUTPUT_DEPTH_EXCEEDED", "CRITICAL", path, "Output exceeds maximum depth"); return; }
  if (Array.isArray(value)) value.forEach((entry, index) => findForbiddenAuthority(entry, `${path}[${index}]`, findings, depth + 1));
  else if (value !== null && typeof value === "object") for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenKeys.test(key)) add(findings, "FORBIDDEN_AUTHORITY_FIELD", "CRITICAL", `${path}.${key}`, "Agent Output contains a forbidden authority field");
    if (sensitiveKeys.test(key)) add(findings, "SENSITIVE_OUTPUT_FIELD", "CRITICAL", `${path}.${key}`, "Agent Output contains a forbidden sensitive field");
    findForbiddenAuthority(entry, `${path}.${key}`, findings, depth + 1);
  }
}

function findInjection(value: unknown, path: string, findings: AgentValidationFindingV1[], depth: number): void {
  if (depth > 20) return;
  if (typeof value === "string" && injectionPatterns.some((pattern) => pattern.test(value))) add(findings, "PROMPT_INJECTION_CONTENT_DETECTED", "CRITICAL", path, "Agent Output contains instruction-injection content");
  else if (Array.isArray(value)) value.forEach((entry, index) => findInjection(entry, `${path}[${index}]`, findings, depth + 1));
  else if (value !== null && typeof value === "object") for (const [key, entry] of Object.entries(value as Record<string, unknown>)) findInjection(entry, `${path}.${key}`, findings, depth + 1);
}

function validLocation(location: AgentClaimV1["evidenceRefs"][number]["location"], maximumOffset?: number): boolean {
  if (location.page === undefined && location.section === undefined && location.startOffset === undefined) return false;
  if (location.page !== undefined && (!Number.isInteger(location.page) || location.page < 1)) return false;
  if (location.section !== undefined && !location.section.trim()) return false;
  if (location.startOffset !== undefined && (!Number.isInteger(location.startOffset) || location.startOffset < 0)) return false;
  if (location.endOffset !== undefined && (!Number.isInteger(location.endOffset) || location.startOffset === undefined || location.endOffset <= location.startOffset || maximumOffset !== undefined && location.endOffset > maximumOffset)) return false;
  return true;
}

function add(findings: AgentValidationFindingV1[], code: string, severity: AgentValidationFindingV1["severity"], path: string, message: string, evidenceIds: string[] = []): void {
  findings.push({ code, severity, path, message, evidenceIds: [...new Set(evidenceIds)].sort() });
}

function parseDateFinding(value: string, code: string, path: string, findings: AgentValidationFindingV1[], evidenceId: string): number | undefined {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) { add(findings, code, "ERROR", path, "Evidence time must be valid", [evidenceId]); return undefined; }
  return parsed;
}

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`);
  return parsed;
}

const terminalStatuses = new Set(["SUCCEEDED", "PARTIAL", "BLOCKED", "FAILED", "TIMED_OUT", "CANCELLED"]);
