import { planningStableHash } from "./hash.js";
import type { ReleaseEvidenceBundleInputV1, ReleaseEvidenceBundleV1, RoadmapPlanV1, RoadmapReplayV1 } from "./types.js";

export function createReleaseEvidenceBundleV1(input: ReleaseEvidenceBundleInputV1, plan: RoadmapPlanV1): ReleaseEvidenceBundleV1 {
  if (input.userId !== plan.userId || input.planId !== plan.id) throw new Error("Release evidence ownership or plan mismatch");
  const milestone = plan.milestones.find((item) => item.id === input.milestoneId);
  if (!milestone) throw new Error("Release evidence milestone does not exist");
  if (milestone.status !== "READY" && milestone.status !== "RELEASED") throw new Error("Release evidence milestone is not ready");
  if (!/^[0-9a-f]{7,64}$/i.test(input.commitSha)) throw new Error("Release evidence commitSha is invalid");
  if (!Number.isInteger(input.openCriticalRiskCount) || input.openCriticalRiskCount < 0) throw new Error("openCriticalRiskCount must be a non-negative integer");
  const createdAt = Date.parse(input.createdAt);
  if (!Number.isFinite(createdAt)) throw new Error("Release evidence createdAt must be a valid timestamp");
  if (createdAt < Date.parse(plan.asOf)) throw new Error("Release evidence cannot predate the plan");
  const groups: Array<[string, string[]]> = [
    ["BUILD", input.buildArtifactRefs], ["CONTRACT", input.contractRefs], ["TEST", input.testEvidenceRefs],
    ["MIGRATION", input.migrationEvidenceRefs], ["SECURITY", input.securityEvidenceRefs], ["OPERATIONS", input.operationsEvidenceRefs], ["GATE", input.gateIds],
  ];
  const missingEvidenceGroups = groups.filter(([, refs]) => refs.map((ref) => ref.trim()).filter(Boolean).length === 0).map(([name]) => name);
  if (input.openCriticalRiskCount > 0) missingEvidenceGroups.push("CRITICAL_RISK_CLEARANCE");
  const unknownGate = input.gateIds.find((id) => !plan.gates.some((gate) => gate.id === id));
  if (unknownGate) throw new Error(`Release evidence gate ${unknownGate} does not exist`);
  const failedGate = input.gateIds.find((id) => plan.gates.find((gate) => gate.id === id)?.status !== "PASSED");
  if (failedGate) missingEvidenceGroups.push(`GATE_NOT_PASSED:${failedGate}`);
  const omittedGate = milestone.requiredGateIds.find((id) => !input.gateIds.includes(id));
  if (omittedGate) missingEvidenceGroups.push(`REQUIRED_GATE_MISSING:${omittedGate}`);
  const canonical = {
    ...input,
    buildArtifactRefs: sorted(input.buildArtifactRefs), contractRefs: sorted(input.contractRefs), testEvidenceRefs: sorted(input.testEvidenceRefs),
    migrationEvidenceRefs: sorted(input.migrationEvidenceRefs), securityEvidenceRefs: sorted(input.securityEvidenceRefs), operationsEvidenceRefs: sorted(input.operationsEvidenceRefs),
    gateIds: sorted(input.gateIds), status: missingEvidenceGroups.length === 0 ? "READY" as const : "BLOCKED" as const, missingEvidenceGroups: [...new Set(missingEvidenceGroups)].sort(),
  };
  return { ...canonical, resultHash: planningStableHash(canonical) };
}

export function replayRoadmapPlanV1(input: { id: string; userId: string; plan: RoadmapPlanV1; replayedAt: string }): RoadmapReplayV1 {
  const { id, userId, plan, replayedAt } = input;
  if (!id.trim()) throw new Error("Roadmap replay id is required");
  if (userId !== plan.userId) throw new Error("Roadmap replay ownership mismatch");
  if (!Number.isFinite(Date.parse(replayedAt))) throw new Error("Roadmap replayedAt must be a valid timestamp");
  const { resultHash: sourceResultHash, ...source } = plan;
  const replayResultHash = planningStableHash(source);
  const canonical = { id, userId, planId: plan.id, sourceResultHash, replayResultHash, matches: sourceResultHash === replayResultHash, replayedAt };
  return { ...canonical, resultHash: planningStableHash(canonical) };
}

function sorted(values: string[]): string[] {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  if (new Set(cleaned).size !== cleaned.length) throw new Error("Release evidence refs must be unique");
  return cleaned.sort();
}
