import { planningStableHash } from "./hash.js";
import type { RoadmapCheckV1, RoadmapGateInputV1, RoadmapGateV1 } from "./types.js";

export function evaluateRoadmapGateV1(input: RoadmapGateInputV1): RoadmapGateV1 {
  requireText(input.id, "gate id");
  requireText(input.userId, "gate userId");
  requireText(input.name, "gate name");
  const gateTime = requireTime(input.evaluatedAt, "gate evaluatedAt");
  if (input.checks.length === 0) throw new Error("Roadmap gate requires at least one check");
  requireUnique(input.checks.map((check) => check.id), "Roadmap check ids");

  const checks = input.checks.map((check): RoadmapCheckV1 => {
    requireText(check.id, "check id");
    requireText(check.evaluatorId, "check evaluatorId");
    const evaluatedAt = requireTime(check.evaluatedAt, "check evaluatedAt");
    if (evaluatedAt > gateTime) throw new Error(`Roadmap check ${check.id} was evaluated after the gate`);
    const evidenceRefs = sortedUnique(check.evidenceRefs, `check ${check.id} evidenceRefs`);
    if ((check.status === "PASSED" || check.status === "WAIVED") && evidenceRefs.length === 0) {
      throw new Error(`Roadmap check ${check.id} requires evidence`);
    }
    if (check.status === "WAIVED") {
      if (!check.waivable) throw new Error(`Roadmap check ${check.id} is not waivable`);
      const expiresAt = requireTime(check.expiresAt, `check ${check.id} waiver expiresAt`);
      if (expiresAt <= gateTime) throw new Error(`Roadmap check ${check.id} waiver is expired`);
    }
    if ((check.status === "FAILED" || check.status === "BLOCKED") && !check.blockerCode?.trim()) {
      throw new Error(`Roadmap check ${check.id} requires blockerCode`);
    }
    return { ...check, evidenceRefs };
  }).sort((left, right) => left.id.localeCompare(right.id));

  const required = checks.filter((check) => check.required);
  const blocked = required.filter((check) => check.status === "BLOCKED");
  const failed = required.filter((check) => check.status === "FAILED");
  const pending = required.filter((check) => !["PASSED", "WAIVED", "FAILED", "BLOCKED"].includes(check.status));
  const status: RoadmapGateV1["status"] = blocked.length > 0 ? "BLOCKED" : failed.length > 0 ? "FAILED" : pending.length > 0 ? "PENDING" : "PASSED";
  const blockerCodes = sortedUnique([...blocked, ...failed].map((check) => check.blockerCode!), "gate blockerCodes");
  const canonical = { ...input, checks, status, blockerCodes };
  return { ...canonical, resultHash: planningStableHash(canonical) };
}

function requireTime(value: string | undefined, label: string): number {
  if (!value) throw new Error(`${label} is required`);
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`${label} must be a valid timestamp`);
  return time;
}

function requireText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function requireUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}

function sortedUnique(values: string[], label: string): string[] {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  requireUnique(cleaned, label);
  return cleaned.sort((left, right) => left.localeCompare(right));
}
