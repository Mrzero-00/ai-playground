import { databaseStableHash } from "./hash.js";
import type { DataLineageEdgeInputV1, DataLineageEdgeV1 } from "./types.js";

export function createDataLineageEdgeV1(input: DataLineageEdgeInputV1): DataLineageEdgeV1 {
  for (const [name, value] of Object.entries({ id: input.id, userId: input.userId, fromEntityType: input.fromEntityType, fromEntityId: input.fromEntityId, toEntityType: input.toEntityType, toEntityId: input.toEntityId })) {
    if (!value.trim()) throw new Error(`Data Lineage ${name} is required`);
  }
  if (input.fromEntityType === input.toEntityType && input.fromEntityId === input.toEntityId) throw new Error("Data Lineage cannot self-reference");
  const asOf = parseDate(input.asOf, "Data Lineage asOf");
  const createdAt = parseDate(input.createdAt, "Data Lineage createdAt");
  if (asOf > createdAt) throw new Error("Data Lineage asOf cannot be after createdAt");
  validateIds(input.evidenceIds, "Data Lineage evidenceIds", input.relation === "EXPLAINS" || input.relation === "VALIDATES");
  const withoutHash = { ...structuredClone(input), evidenceIds: [...input.evidenceIds].sort() };
  return { ...withoutHash, resultHash: databaseStableHash(withoutHash) };
}

export function validateDataLineageGraphV1(edges: DataLineageEdgeV1[]): DataLineageEdgeV1[] {
  if (new Set(edges.map((edge) => edge.id)).size !== edges.length) throw new Error("Data Lineage edge ids must be unique");
  const derived = edges.filter((edge) => edge.relation === "DERIVED_FROM" || edge.relation === "SUPERSEDES" || edge.relation === "CORRECTS");
  const adjacency = new Map<string, string[]>();
  for (const edge of derived) {
    const from = key(edge.fromEntityType, edge.fromEntityId);
    const to = key(edge.toEntityType, edge.toEntityId);
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): void => {
    if (visiting.has(node)) throw new Error("Data Lineage graph contains a cycle");
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) visit(next);
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of adjacency.keys()) visit(node);
  return edges.map((edge) => structuredClone(edge));
}

function key(type: string, id: string): string { return `${type}:${id}`; }
function validateIds(values: string[], name: string, required: boolean): void {
  if (required && values.length === 0) throw new Error(`${name} is required`);
  if (values.some((value) => !value.trim()) || new Set(values).size !== values.length) throw new Error(`${name} must contain unique non-blank ids`);
}
function parseDate(value: string, name: string): number { const parsed = new Date(value).getTime(); if (!Number.isFinite(parsed)) throw new Error(`${name} must be valid`); return parsed; }
