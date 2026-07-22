export type ModelVersionStatus = "DRAFT" | "TESTING" | "APPROVED" | "ACTIVE" | "DEPRECATED" | "ARCHIVED";

export type ModelVersion = {
  id: string;
  strategy: "LONG_TERM" | "MOMENTUM" | "PORTFOLIO" | "RISK";
  version: string;
  status: ModelVersionStatus;
  parameters: Record<string, unknown>;
  createdAt: string;
  approvedBy?: string;
  activatedAt?: string;
};

const transitions: Record<ModelVersionStatus, ModelVersionStatus[]> = {
  DRAFT: ["TESTING", "ARCHIVED"],
  TESTING: ["APPROVED", "DRAFT", "ARCHIVED"],
  APPROVED: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["DEPRECATED"],
  DEPRECATED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function transitionModelVersion(
  model: ModelVersion,
  next: ModelVersionStatus,
  input: { actorId: string; at: string },
): ModelVersion {
  if (!transitions[model.status].includes(next)) throw new Error(`invalid model transition: ${model.status} -> ${next}`);
  if ((next === "APPROVED" || next === "ACTIVE") && !input.actorId.trim()) throw new Error("human actor is required");
  return {
    ...model,
    status: next,
    ...(next === "APPROVED" ? { approvedBy: input.actorId } : {}),
    ...(next === "ACTIVE" ? { activatedAt: input.at } : {}),
  };
}
