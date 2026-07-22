import { minDecimal, type CurrencyCode, type DecimalString } from "./decimal.js";
import type { AllocationProposal } from "./portfolio.js";
import type { RiskDecision } from "./risk.js";

export type DecisionProposal = {
  id: string;
  allocationProposalId: string;
  riskDecisionId: string;
  status: "PENDING_APPROVAL" | "MANUAL_REVIEW" | "BLOCKED" | "APPROVED" | "REJECTED" | "EXPIRED";
  approvedAmount: DecimalString;
  currency: CurrencyCode;
  expiresAt: string;
  reasons: string[];
  modelVersionIds: string[];
  snapshotIds: string[];
  userDecision?: { approved: boolean; decidedAt: string; userId: string };
};

export type ApprovalRevalidation = {
  checkedAt: string;
  proposalStillCurrent: boolean;
  portfolioCapacityConfirmed: boolean;
  priceWithinTolerance: boolean;
  dataFresh: boolean;
  riskStillValid: boolean;
};

export function composeDecision(
  id: string,
  allocation: AllocationProposal,
  risk: RiskDecision,
): DecisionProposal {
  if (risk.proposalId !== allocation.id) throw new Error("risk decision does not match allocation proposal");
  const base = {
    id,
    allocationProposalId: allocation.id,
    riskDecisionId: risk.id,
    currency: allocation.currency,
    expiresAt: allocation.expiresAt,
    modelVersionIds: [allocation.policyVersionId, risk.riskPolicyVersionId],
    snapshotIds: [...allocation.snapshotIds],
  };
  if (new Date(risk.evaluatedAt).getTime() > new Date(allocation.expiresAt).getTime()) {
    return { ...base, status: "EXPIRED", approvedAmount: "0", reasons: ["제안이 Risk 평가 전에 만료되었습니다."] };
  }
  if (risk.status === "DENY" || allocation.status === "REJECTED") {
    return { ...base, status: "BLOCKED", approvedAmount: "0", reasons: [risk.rationale] };
  }
  if (risk.status === "REQUIRE_MANUAL_REVIEW" || allocation.status === "WAIT") {
    return { ...base, status: "MANUAL_REVIEW", approvedAmount: "0", reasons: [risk.rationale] };
  }
  if (risk.maxApprovedAmount === undefined) throw new Error("approved risk decision requires maxApprovedAmount");
  return {
    ...base,
    status: "PENDING_APPROVAL",
    approvedAmount: minDecimal(risk.maxApprovedAmount, allocation.approvedAmount),
    reasons: [...allocation.reasons, risk.rationale],
  };
}

export function recordUserDecision(
  proposal: DecisionProposal,
  input: { approved: boolean; decidedAt: string; userId: string; revalidation?: ApprovalRevalidation },
): DecisionProposal {
  if (proposal.status !== "PENDING_APPROVAL") throw new Error("only pending proposals can be decided");
  if (!input.userId.trim()) throw new Error("userId is required for audit");
  if (!Number.isFinite(new Date(input.decidedAt).getTime())) throw new Error("decidedAt must be a valid date");
  if (!input.approved) {
    return { ...proposal, status: "REJECTED", userDecision: { approved: false, decidedAt: input.decidedAt, userId: input.userId } };
  }
  if (new Date(input.decidedAt).getTime() > new Date(proposal.expiresAt).getTime()) {
    return { ...proposal, status: "EXPIRED", approvedAmount: "0", reasons: [...proposal.reasons, "사용자 결정 전에 제안이 만료되었습니다."] };
  }
  const check = input.revalidation;
  if (!check) throw new Error("approval revalidation is required");
  const checkedAt = new Date(check.checkedAt).getTime();
  const decidedAt = new Date(input.decidedAt).getTime();
  if (!Number.isFinite(checkedAt) || checkedAt > decidedAt || checkedAt > new Date(proposal.expiresAt).getTime()) {
    throw new Error("approval revalidation time is invalid");
  }
  if (!check.proposalStillCurrent || !check.portfolioCapacityConfirmed || !check.priceWithinTolerance || !check.dataFresh || !check.riskStillValid) {
    throw new Error("approval revalidation failed");
  }
  return {
    ...proposal,
    status: "APPROVED",
    userDecision: { approved: true, decidedAt: input.decidedAt, userId: input.userId },
  };
}
