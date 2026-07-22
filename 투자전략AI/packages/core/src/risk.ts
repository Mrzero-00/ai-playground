import { assertCurrency, assertDecimal, compareDecimal, type DecimalString } from "./decimal.js";
import type { AllocationProposal } from "./portfolio.js";
import type { MomentumRegimeGate } from "./momentum-plan.js";
import type { BehavioralGate } from "./philosophy-policy.js";

export type RiskStatus =
  | "APPROVE"
  | "APPROVE_WITH_REDUCTION"
  | "REQUIRE_MANUAL_REVIEW"
  | "DENY";

export type RiskContext = {
  id: string;
  evaluatedAt: string;
  dataAsOf: string;
  riskPolicyVersionId: string;
  maxDataAgeMinutes: number;
  dailyDrawdownPercent: number;
  maxDailyDrawdownPercent: number;
  liquiditySufficient: boolean;
  criticalRiskCheckAvailable: boolean;
  eventRisk: boolean;
  stopLoss?: DecimalString;
  hardSafetyBreaches?: string[];
  leverageRequested?: boolean;
  nearTermFundsIntrusion?: boolean;
  behavioralGate?: BehavioralGate;
  momentumRegimeGate?: MomentumRegimeGate;
};

export type RiskDecision = {
  id: string;
  evaluatedAt: string;
  proposalId: string;
  riskPolicyVersionId: string;
  dataAsOf: string;
  status: RiskStatus;
  maxApprovedAmount?: DecimalString;
  riskFlags: string[];
  rationale: string;
  supersedesRiskDecisionId?: string;
  reviewedBy?: string;
  manualReviewEvidenceIds?: string[];
};

export function evaluateRisk(proposal: AllocationProposal, context: RiskContext): RiskDecision {
  const flags: string[] = [];
  if (!context.id.trim() || !context.riskPolicyVersionId.trim()) throw new Error("risk id and policy version are required");
  assertCurrency(proposal.currency);
  assertDecimal(proposal.approvedAmount, "approvedAmount");
  if (compareDecimal(proposal.approvedAmount, "0") <= 0) flags.push("INVALID_AMOUNT");
  const dataAge = new Date(context.evaluatedAt).getTime() - new Date(context.dataAsOf).getTime();
  if (!Number.isFinite(dataAge)) throw new RangeError("evaluatedAt and dataAsOf must be valid dates");
  const proposalExpiry = new Date(proposal.expiresAt).getTime();
  if (!Number.isFinite(proposalExpiry)) throw new RangeError("proposal expiresAt must be a valid date");
  if (new Date(context.evaluatedAt).getTime() > proposalExpiry) flags.push("PROPOSAL_EXPIRED");
  if (dataAge > context.maxDataAgeMinutes * 60_000) flags.push("STALE_DATA");
  if (!context.criticalRiskCheckAvailable) flags.push("RISK_CHECK_UNAVAILABLE");
  if (!context.liquiditySufficient) flags.push("INSUFFICIENT_LIQUIDITY");
  if (context.dailyDrawdownPercent >= context.maxDailyDrawdownPercent) flags.push("DRAWDOWN_LIMIT");
  if (proposal.strategy === "MOMENTUM" && context.stopLoss === undefined) flags.push("MISSING_STOP_LOSS");
  if (context.hardSafetyBreaches?.length) flags.push(...context.hardSafetyBreaches.map((breach) => `HARD_SAFETY:${breach}`));
  if (context.leverageRequested) flags.push("LEVERAGE_FORBIDDEN");
  if (context.nearTermFundsIntrusion) flags.push("NEAR_TERM_FUNDS_INTRUSION");
  if (context.behavioralGate?.status === "DENY_NEW_RISK") flags.push("BEHAVIORAL_DENY");
  if (context.momentumRegimeGate?.status === "DENY_NEW_RISK") flags.push("MARKET_REGIME_DENY");
  if (context.stopLoss !== undefined) {
    assertDecimal(context.stopLoss, "stopLoss");
    if (compareDecimal(context.stopLoss, "0") <= 0) flags.push("INVALID_STOP_LOSS");
  }

  const denyFlags = ["INVALID_AMOUNT", "INVALID_STOP_LOSS", "PROPOSAL_EXPIRED", "STALE_DATA", "RISK_CHECK_UNAVAILABLE", "INSUFFICIENT_LIQUIDITY", "DRAWDOWN_LIMIT", "MISSING_STOP_LOSS", "LEVERAGE_FORBIDDEN", "NEAR_TERM_FUNDS_INTRUSION", "BEHAVIORAL_DENY", "MARKET_REGIME_DENY"];
  const base = {
    id: context.id,
    evaluatedAt: context.evaluatedAt,
    proposalId: proposal.id,
    riskPolicyVersionId: context.riskPolicyVersionId,
    dataAsOf: context.dataAsOf,
  };
  if (proposal.status === "REJECTED" || flags.some((flag) => denyFlags.includes(flag) || flag.startsWith("HARD_SAFETY:"))) {
    return {
      ...base,
      status: "DENY",
      riskFlags: flags,
      rationale: "필수 위험 통제를 통과하지 못해 제안을 거부했습니다.",
    };
  }
  if (context.eventRisk) {
    return {
      ...base,
      status: "REQUIRE_MANUAL_REVIEW",
      riskFlags: ["EVENT_RISK"],
      rationale: "중요 이벤트 위험이 있어 수동 검토가 필요합니다.",
    };
  }
  if (context.behavioralGate?.status === "REQUIRE_MANUAL_REVIEW" || context.momentumRegimeGate?.status === "REQUIRE_MANUAL_REVIEW") {
    return {
      ...base,
      status: "REQUIRE_MANUAL_REVIEW",
      riskFlags: [
        ...(context.behavioralGate?.status === "REQUIRE_MANUAL_REVIEW" ? ["BEHAVIORAL_REVIEW"] : []),
        ...(context.momentumRegimeGate?.status === "REQUIRE_MANUAL_REVIEW" ? ["MARKET_REGIME_REVIEW"] : []),
      ],
      rationale: "투자 철학 정책에 따른 수동 검토가 필요합니다.",
    };
  }
  if (proposal.status === "WAIT") {
    return {
      ...base,
      status: "REQUIRE_MANUAL_REVIEW",
      riskFlags: ["PORTFOLIO_WAIT"],
      rationale: "Portfolio Engine이 대기를 요청해 사용자 승인 대상으로 만들 수 없습니다.",
    };
  }
  if (proposal.status === "REDUCED") {
    return {
      ...base,
      status: "APPROVE_WITH_REDUCTION",
      maxApprovedAmount: proposal.approvedAmount,
      riskFlags: [],
      rationale: "포트폴리오 한도 내 축소 금액만 승인합니다.",
    };
  }
  return {
    ...base,
    status: "APPROVE",
    maxApprovedAmount: proposal.approvedAmount,
    riskFlags: [],
    rationale: "현재 위험 한도 내에 있습니다.",
  };
}

export function resolveManualRiskReview(
  original: RiskDecision,
  proposal: AllocationProposal,
  input: {
    id: string;
    status: "APPROVE" | "APPROVE_WITH_REDUCTION" | "DENY";
    evaluatedAt: string;
    reviewedBy: string;
    rationale: string;
    evidenceIds: string[];
    maxApprovedAmount?: DecimalString;
  },
): RiskDecision {
  if (original.status !== "REQUIRE_MANUAL_REVIEW") {
    throw new Error("only REQUIRE_MANUAL_REVIEW can be resolved; Risk DENY is non-overridable");
  }
  if (original.proposalId !== proposal.id) throw new Error("manual review does not match allocation proposal");
  if (!input.id.trim() || input.id === original.id || !input.reviewedBy.trim() || !input.rationale.trim()) {
    throw new Error("manual review requires a new id, reviewer and rationale");
  }
  const reviewedAt = new Date(input.evaluatedAt).getTime();
  if (!Number.isFinite(reviewedAt) || reviewedAt < new Date(original.evaluatedAt).getTime()) {
    throw new Error("manual review time must be valid and after the original risk decision");
  }
  if (reviewedAt > new Date(proposal.expiresAt).getTime()) throw new Error("cannot resolve risk review after proposal expiry");
  if (input.evidenceIds.length === 0) throw new Error("manual risk review requires evidence");
  if ((proposal.status === "WAIT" || proposal.status === "REJECTED") && input.status !== "DENY") {
    throw new Error("Portfolio WAIT or REJECTED requires a new Allocation Proposal and cannot be manually approved");
  }
  const base = {
    id: input.id,
    evaluatedAt: input.evaluatedAt,
    proposalId: proposal.id,
    riskPolicyVersionId: original.riskPolicyVersionId,
    dataAsOf: original.dataAsOf,
    riskFlags: [...original.riskFlags],
    rationale: input.rationale,
    supersedesRiskDecisionId: original.id,
    reviewedBy: input.reviewedBy,
    manualReviewEvidenceIds: [...input.evidenceIds],
  };
  if (input.status === "DENY") return { ...base, status: "DENY" };
  const maxApprovedAmount = input.status === "APPROVE" ? proposal.approvedAmount : input.maxApprovedAmount;
  if (maxApprovedAmount === undefined) throw new Error("reduced manual approval requires maxApprovedAmount");
  assertDecimal(maxApprovedAmount, "maxApprovedAmount");
  if (compareDecimal(maxApprovedAmount, "0") <= 0 || compareDecimal(maxApprovedAmount, proposal.approvedAmount) > 0) {
    throw new Error("manual review cannot approve zero or exceed the Portfolio-approved amount");
  }
  if (input.status === "APPROVE_WITH_REDUCTION" && compareDecimal(maxApprovedAmount, proposal.approvedAmount) >= 0) {
    throw new Error("APPROVE_WITH_REDUCTION must reduce the Portfolio-approved amount");
  }
  return { ...base, status: input.status, maxApprovedAmount };
}
