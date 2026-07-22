import { planningStableHash } from "./hash.js";
import type { ReadinessLevelV1, RoadmapMilestoneInputV1, RoadmapPlanInputV1, RoadmapPlanV1 } from "./types.js";

const READINESS: ReadinessLevelV1[] = ["R0", "R1", "R2", "R3", "R4", "R5", "R6"];
const DEPENDENCY_READY = new Set(["READY", "RELEASED"]);

export function validateRoadmapPlanV1(input: RoadmapPlanInputV1): RoadmapPlanV1 {
  if (!input.id.trim() || !input.userId.trim()) throw new Error("Roadmap plan id and userId are required");
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("Roadmap plan version must be a positive integer");
  if (!Number.isFinite(Date.parse(input.asOf))) throw new Error("Roadmap plan asOf must be a valid timestamp");
  if (input.milestones.length === 0) throw new Error("Roadmap plan requires at least one milestone");
  requireUnique(input.milestones.map((item) => item.id), "Roadmap milestone ids");
  requireUnique(input.gates.map((item) => item.id), "Roadmap gate ids");
  if (input.gates.some((gate) => gate.userId !== input.userId)) throw new Error("Roadmap gate ownership mismatch");

  const milestoneById = new Map(input.milestones.map((item) => [item.id, item]));
  const gateById = new Map(input.gates.map((item) => [item.id, item]));
  const milestones = input.milestones.map((milestone) => validateMilestone(milestone, milestoneById, gateById));
  assertAcyclic(milestones);

  for (const milestone of milestones) {
    const dependenciesReady = milestone.dependencyIds.every((id) => DEPENDENCY_READY.has(milestoneById.get(id)!.status));
    const gatesPassed = milestone.requiredGateIds.every((id) => gateById.get(id)!.status === "PASSED");
    if ((milestone.status === "READY" || milestone.status === "RELEASED") && !dependenciesReady) {
      throw new Error(`Milestone ${milestone.id} cannot be ${milestone.status} before dependencies are ready`);
    }
    if (milestone.status === "RELEASED" && !gatesPassed) {
      throw new Error(`Milestone ${milestone.id} cannot be RELEASED before required gates pass`);
    }
  }

  const active = milestones.filter((item) => item.status !== "CANCELLED");
  const achieved = active.filter((item) => item.status === "READY" || item.status === "RELEASED");
  const readiness = achieved.length === 0 ? "R0" : READINESS[Math.max(...achieved.map((item) => READINESS.indexOf(item.readinessTarget)))]!;
  const blockerCodes = [...new Set([
    ...input.gates.flatMap((gate) => gate.blockerCodes),
    ...milestones.filter((item) => item.status === "BLOCKED").map((item) => `MILESTONE_BLOCKED:${item.id}`),
  ])].sort();
  const canonical = { ...input, milestones: [...milestones].sort((a, b) => a.id.localeCompare(b.id)), gates: [...input.gates].sort((a, b) => a.id.localeCompare(b.id)), readiness, blockerCodes };
  return { ...canonical, resultHash: planningStableHash(canonical) };
}

export function createRoadmapPlanRevisionV1(previous: RoadmapPlanV1, next: RoadmapPlanInputV1): RoadmapPlanV1 {
  if (previous.userId !== next.userId) throw new Error("Roadmap revision ownership mismatch");
  if (next.version !== previous.version + 1) throw new Error("Roadmap revision must increment version by one");
  if (next.supersedesPlanId !== previous.id) throw new Error("Roadmap revision lineage conflict");
  if (Date.parse(next.asOf) < Date.parse(previous.asOf)) throw new Error("Roadmap revision cannot move asOf backward");
  return validateRoadmapPlanV1(next);
}

function validateMilestone(milestone: RoadmapMilestoneInputV1, milestones: Map<string, RoadmapMilestoneInputV1>, gates: Map<string, unknown>): RoadmapMilestoneInputV1 {
  if (!milestone.id.trim() || !milestone.title.trim()) throw new Error("Milestone id and title are required");
  if (!Number.isInteger(milestone.version) || milestone.version < 1) throw new Error(`Milestone ${milestone.id} version must be positive`);
  if (milestone.dependencyIds.includes(milestone.id)) throw new Error(`Milestone ${milestone.id} cannot depend on itself`);
  requireUnique(milestone.dependencyIds, `Milestone ${milestone.id} dependencies`);
  requireUnique(milestone.requiredGateIds, `Milestone ${milestone.id} gates`);
  requireUnique(milestone.ownerIds, `Milestone ${milestone.id} owners`);
  requireUnique(milestone.scopeRefs, `Milestone ${milestone.id} scopeRefs`);
  if (milestone.ownerIds.length === 0 || milestone.scopeRefs.length === 0) throw new Error(`Milestone ${milestone.id} requires owner and scope`);
  for (const id of milestone.dependencyIds) if (!milestones.has(id)) throw new Error(`Milestone ${milestone.id} dependency ${id} does not exist`);
  for (const id of milestone.requiredGateIds) if (!gates.has(id)) throw new Error(`Milestone ${milestone.id} gate ${id} does not exist`);
  if (milestone.targetWindow) {
    const start = Date.parse(milestone.targetWindow.start);
    const end = Date.parse(milestone.targetWindow.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error(`Milestone ${milestone.id} target window is invalid`);
  }
  return {
    ...milestone,
    dependencyIds: [...milestone.dependencyIds].sort(),
    requiredGateIds: [...milestone.requiredGateIds].sort(),
    ownerIds: [...milestone.ownerIds].sort(),
    scopeRefs: [...milestone.scopeRefs].sort(),
  };
}

function assertAcyclic(milestones: RoadmapMilestoneInputV1[]): void {
  const dependencies = new Map(milestones.map((item) => [item.id, item.dependencyIds]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) throw new Error(`Roadmap dependency cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of dependencies.keys()) visit(id);
}

function requireUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}
