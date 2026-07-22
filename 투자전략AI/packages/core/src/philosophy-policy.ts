export type InvestmentStrategy = "CORE" | "FUTURE_CORE" | "MOMENTUM" | "CASH";

export type DecisionAction =
  | "BUY"
  | "ACCUMULATE"
  | "ENTER"
  | "HOLD"
  | "WAIT"
  | "REDUCE"
  | "EXIT"
  | "SKIP"
  | "CASH";

export type EmotionalState =
  | "CALM"
  | "EXCITED"
  | "FEARFUL"
  | "FRUSTRATED"
  | "REVENGE_RISK"
  | "FOMO_RISK"
  | "FATIGUED";

export type ReturnSource =
  | "FUNDAMENTAL_COMPOUNDING"
  | "VALUATION_NORMALIZATION"
  | "FUTURE_CORE_SCALE_UP"
  | "MOMENTUM_CONTINUATION"
  | "CATALYST_REPRICING"
  | "SHAREHOLDER_YIELD"
  | "CASH_YIELD";

export type PhilosophyPolicy = {
  version: string;
  longTerm: { target: number; softMin: number; hardMax: number };
  momentum: { target: number; softMin: number; hardMax: number };
  coreTarget: number;
  futureCoreTarget: number;
  futureCoreHardMax: number;
  commonReserveTarget: number;
  leverageAllowed: boolean;
  marginAllowed: boolean;
  nakedOptionsAllowed: boolean;
  userCanOverrideRiskDeny: false;
};

export const defaultPhilosophyPolicy: PhilosophyPolicy = {
  version: "2.2.1",
  longTerm: { target: 0.85, softMin: 0.8, hardMax: 0.9 },
  momentum: { target: 0.15, softMin: 0.1, hardMax: 0.2 },
  coreTarget: 0.7,
  futureCoreTarget: 0.15,
  futureCoreHardMax: 0.2,
  commonReserveTarget: 0,
  leverageAllowed: false,
  marginAllowed: false,
  nakedOptionsAllowed: false,
  userCanOverrideRiskDeny: false,
};

export function isRiskIncreasingAction(action: DecisionAction): boolean {
  return action === "BUY" || action === "ACCUMULATE" || action === "ENTER";
}

export function validatePhilosophyPolicy(policy: PhilosophyPolicy): PhilosophyPolicy {
  if (!policy.version.trim()) throw new Error("philosophy policy version is required");
  assertRatio("longTerm.target", policy.longTerm.target);
  assertRatio("longTerm.softMin", policy.longTerm.softMin);
  assertRatio("longTerm.hardMax", policy.longTerm.hardMax);
  assertRatio("momentum.target", policy.momentum.target);
  assertRatio("momentum.softMin", policy.momentum.softMin);
  assertRatio("momentum.hardMax", policy.momentum.hardMax);
  assertRatio("coreTarget", policy.coreTarget);
  assertRatio("futureCoreTarget", policy.futureCoreTarget);
  assertRatio("futureCoreHardMax", policy.futureCoreHardMax);
  assertRatio("commonReserveTarget", policy.commonReserveTarget);
  if (policy.longTerm.target < 0.8 || policy.longTerm.target > 0.9) {
    throw new RangeError("long-term target must be between 80% and 90%");
  }
  if (policy.momentum.target < 0.1 || policy.momentum.target > 0.2) {
    throw new RangeError("momentum target must be between 10% and 20%");
  }
  if (policy.longTerm.softMin > policy.longTerm.target || policy.longTerm.target > policy.longTerm.hardMax) {
    throw new RangeError("long-term limits must satisfy softMin <= target <= hardMax");
  }
  if (policy.momentum.softMin > policy.momentum.target || policy.momentum.target > policy.momentum.hardMax) {
    throw new RangeError("momentum limits must satisfy softMin <= target <= hardMax");
  }
  if (policy.coreTarget + policy.futureCoreTarget > policy.longTerm.target + 0.000_001) {
    throw new RangeError("Core and Future Core targets cannot exceed the long-term target");
  }
  if (policy.futureCoreTarget > policy.futureCoreHardMax) {
    throw new RangeError("Future Core target cannot exceed its hard maximum");
  }
  if (Math.abs(policy.longTerm.target + policy.momentum.target + policy.commonReserveTarget - 1) > 0.000_001) {
    throw new RangeError("strategy targets and common reserve must sum to 100%");
  }
  if (policy.leverageAllowed || policy.marginAllowed || policy.nakedOptionsAllowed) {
    throw new Error("MVP philosophy forbids leverage, margin and naked options");
  }
  if (policy.userCanOverrideRiskDeny !== false) throw new Error("Risk DENY cannot be user-overridden");
  return structuredClone(policy);
}

export type BehavioralGate = {
  status: "ALLOW" | "REQUIRE_MANUAL_REVIEW" | "DENY_NEW_RISK";
  reasons: string[];
  controls: string[];
};

export function evaluateBehavioralGate(input: {
  strategy: InvestmentStrategy;
  action: DecisionAction;
  emotionalState: EmotionalState;
  hardRiskReductionEvent?: boolean;
}): BehavioralGate {
  if (!isRiskIncreasingAction(input.action)) {
    if (input.emotionalState === "FEARFUL" && input.action === "EXIT" && !input.hardRiskReductionEvent) {
      return {
        status: "REQUIRE_MANUAL_REVIEW",
        reasons: ["공포 상태의 장기 전량 청산은 Cooling Period 검토가 필요합니다."],
        controls: ["COOLING_PERIOD", "THESIS_BREAK_REVIEW"],
      };
    }
    return { status: "ALLOW", reasons: [], controls: [] };
  }
  if (input.strategy === "MOMENTUM" && input.emotionalState === "REVENGE_RISK") {
    return {
      status: "DENY_NEW_RISK",
      reasons: ["Revenge Trading 위험 상태에서는 신규 Momentum 위험을 늘릴 수 없습니다."],
      controls: ["COOLDOWN", "LOSS_LIMIT_REVIEW"],
    };
  }
  if (input.emotionalState === "FOMO_RISK") {
    return {
      status: "REQUIRE_MANUAL_REVIEW",
      reasons: ["FOMO 위험 상태에서는 Entry Zone과 Chase Limit을 다시 확인해야 합니다."],
      controls: ["CHASE_LIMIT_REVALIDATION", "DEFER_OPTION"],
    };
  }
  if (input.emotionalState === "FATIGUED") {
    return {
      status: "REQUIRE_MANUAL_REVIEW",
      reasons: ["피로 상태의 신규 위험 증가는 수동 재검토가 필요합니다."],
      controls: ["SECOND_REVIEWER", "DEFER_OPTION"],
    };
  }
  return { status: "ALLOW", reasons: [], controls: [] };
}

function assertRatio(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} must be between 0 and 1`);
}

export type PhilosophyChangeStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "ACTIVE" | "RETIRED";

export type PhilosophyChange = {
  id: string;
  fromVersion: string;
  toVersion: string;
  section: string;
  previousPolicy: string;
  newPolicy: string;
  rationale: string;
  effectiveFrom: string;
  evidenceIds: string[];
  status: PhilosophyChangeStatus;
  proposedBy: string;
  approvedBy?: string;
  architectureRevisionId?: string;
};

const philosophyTransitions: Record<PhilosophyChangeStatus, PhilosophyChangeStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["ACTIVE"],
  ACTIVE: ["RETIRED"],
  RETIRED: [],
};

export function transitionPhilosophyChange(
  change: PhilosophyChange,
  next: PhilosophyChangeStatus,
  input: { actorId: string; at: string },
): PhilosophyChange {
  if (!change.id.trim() || !change.fromVersion.trim() || !change.toVersion.trim() || !change.section.trim()) {
    throw new Error("philosophy change identity and versions are required");
  }
  if (change.fromVersion === change.toVersion) throw new Error("philosophy change requires a new version");
  if (!change.previousPolicy.trim() || !change.newPolicy.trim() || !change.rationale.trim() || !change.proposedBy.trim()) {
    throw new Error("philosophy change requires before, after, rationale and proposer");
  }
  if (change.evidenceIds.length === 0) throw new Error("philosophy change requires evidence");
  const transitionedAt = new Date(input.at).getTime();
  const effectiveFrom = new Date(change.effectiveFrom).getTime();
  if (!input.actorId.trim() || !Number.isFinite(transitionedAt) || !Number.isFinite(effectiveFrom)) {
    throw new Error("transition actor, time and effective date are required");
  }
  if (!philosophyTransitions[change.status].includes(next)) {
    throw new Error(`invalid philosophy transition: ${change.status} -> ${next}`);
  }
  const hardSafetyChange = change.section === "HARD_SAFETY" || change.section.startsWith("INV-");
  if (hardSafetyChange && next === "APPROVED" && !change.architectureRevisionId?.trim()) {
    throw new Error("Hard Safety changes require an Architecture revision or ADR");
  }
  if (next === "ACTIVE" && transitionedAt < effectiveFrom) throw new Error("philosophy change cannot activate before effectiveFrom");
  return {
    ...structuredClone(change),
    status: next,
    ...(next === "APPROVED" ? { approvedBy: input.actorId } : {}),
  };
}
