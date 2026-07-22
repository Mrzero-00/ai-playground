import { agentStableHash } from "./hash.js";
import type { AgentDefinitionV1, AgentPlanV1, AgentPlanValidationV1 } from "./types.js";

export function validateAgentPlanV1(input: AgentPlanV1, definitions: AgentDefinitionV1[]): AgentPlanValidationV1 {
  if (!input.id.trim() || !input.userId.trim()) throw new Error("Agent Plan identity is required");
  const asOf = parseDate(input.asOf, "Agent Plan asOf");
  const createdAt = parseDate(input.createdAt, "Agent Plan createdAt");
  const deadlineAt = parseDate(input.deadlineAt, "Agent Plan deadlineAt");
  if (asOf > createdAt || deadlineAt <= createdAt) throw new Error("Agent Plan timeline is invalid");
  if (!Number.isInteger(input.maximumConcurrency) || input.maximumConcurrency < 1 || input.maximumConcurrency > 16) throw new Error("Agent Plan maximumConcurrency must be between 1 and 16");
  if (input.nodes.length === 0) throw new Error("Agent Plan requires nodes");
  const nodeIds = input.nodes.map((node) => node.id);
  if (nodeIds.some((id) => !id.trim()) || new Set(nodeIds).size !== nodeIds.length) throw new Error("Agent Plan node ids must be unique and non-blank");
  const nodes = new Map(input.nodes.map((node) => [node.id, node]));
  for (const node of input.nodes) {
    if (new Set(node.dependsOn).size !== node.dependsOn.length || node.dependsOn.includes(node.id)) throw new Error("Agent Plan dependencies must be unique and cannot reference self");
    for (const dependency of node.dependsOn) if (!nodes.has(dependency)) throw new Error(`Agent Plan dependency ${dependency} not found`);
    const definition = definitions.find((item) => item.id === node.agentDefinitionId && item.enabled);
    if (!definition) throw new Error(`Agent Plan Definition ${node.agentDefinitionId} not found or disabled`);
    if (!workflowScopes[input.workflow].includes(definition.strategyScope)) throw new Error("Agent Plan workflow and Definition Scope conflict");
  }
  const executionOrder: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error("Agent Plan contains a dependency cycle");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of nodes.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    executionOrder.push(id);
  };
  for (const id of [...nodeIds].sort()) visit(id);
  const withoutHash = { ...structuredClone(input), nodes: [...input.nodes].sort((left, right) => left.id.localeCompare(right.id)), executionOrder };
  return { ...withoutHash, resultHash: agentStableHash(withoutHash) };
}

const workflowScopes: Record<AgentPlanV1["workflow"], AgentDefinitionV1["strategyScope"][]> = {
  LONG_TERM_REVIEW: ["LONG_TERM", "REPORTING"],
  MOMENTUM_REVIEW: ["MOMENTUM", "RISK", "REPORTING"],
  LEARNING_REVIEW: ["LEARNING", "REPORTING"],
  REPORT_GENERATION: ["REPORTING"],
};

function parseDate(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`);
  return parsed;
}
