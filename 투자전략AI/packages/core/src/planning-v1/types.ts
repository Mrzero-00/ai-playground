export type ReadinessLevelV1 = "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6";
export type MilestoneStatusV1 = "PLANNED" | "IN_PROGRESS" | "AT_RISK" | "BLOCKED" | "READY" | "RELEASED" | "CANCELLED";
export type GateStatusV1 = "PENDING" | "PASSED" | "FAILED" | "BLOCKED";
export type CheckStatusV1 = "PASSED" | "FAILED" | "BLOCKED" | "WAIVED";
export type CheckCategoryV1 = "PRODUCT" | "DOMAIN" | "DATA" | "SECURITY" | "QUALITY" | "OPERATIONS" | "MODEL_RISK";

export type RoadmapCheckInputV1 = {
  id: string;
  category: CheckCategoryV1;
  required: boolean;
  waivable: boolean;
  status: CheckStatusV1;
  evidenceRefs: string[];
  evaluatedAt: string;
  evaluatorId: string;
  expiresAt?: string;
  blockerCode?: string;
};

export type RoadmapCheckV1 = RoadmapCheckInputV1 & { evidenceRefs: string[] };

export type RoadmapGateInputV1 = {
  id: string;
  userId: string;
  name: string;
  environment: "CI" | "PREVIEW" | "INTEGRATED" | "SHADOW" | "PILOT" | "PRODUCTION";
  evaluatedAt: string;
  checks: RoadmapCheckInputV1[];
};

export type RoadmapGateV1 = Omit<RoadmapGateInputV1, "checks"> & {
  checks: RoadmapCheckV1[];
  status: GateStatusV1;
  blockerCodes: string[];
  resultHash: string;
};

export type RoadmapMilestoneInputV1 = {
  id: string;
  version: number;
  title: string;
  readinessTarget: ReadinessLevelV1;
  status: MilestoneStatusV1;
  dependencyIds: string[];
  requiredGateIds: string[];
  ownerIds: string[];
  scopeRefs: string[];
  targetWindow?: { start: string; end: string };
};

export type RoadmapPlanInputV1 = {
  id: string;
  userId: string;
  version: number;
  asOf: string;
  milestones: RoadmapMilestoneInputV1[];
  gates: RoadmapGateV1[];
  supersedesPlanId?: string;
};

export type RoadmapPlanV1 = RoadmapPlanInputV1 & {
  milestones: RoadmapMilestoneInputV1[];
  readiness: ReadinessLevelV1;
  blockerCodes: string[];
  resultHash: string;
};

export type ReleaseEvidenceBundleInputV1 = {
  id: string;
  userId: string;
  planId: string;
  milestoneId: string;
  commitSha: string;
  buildArtifactRefs: string[];
  contractRefs: string[];
  testEvidenceRefs: string[];
  migrationEvidenceRefs: string[];
  securityEvidenceRefs: string[];
  operationsEvidenceRefs: string[];
  gateIds: string[];
  openCriticalRiskCount: number;
  createdAt: string;
};

export type ReleaseEvidenceBundleV1 = ReleaseEvidenceBundleInputV1 & {
  status: "READY" | "BLOCKED";
  missingEvidenceGroups: string[];
  resultHash: string;
};

export type RoadmapReplayV1 = {
  id: string;
  userId: string;
  planId: string;
  sourceResultHash: string;
  replayResultHash: string;
  matches: boolean;
  replayedAt: string;
  resultHash: string;
};
