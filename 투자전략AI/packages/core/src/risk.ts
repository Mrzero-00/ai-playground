import { assertCurrency, assertDecimal, compareDecimal, type DecimalString } from "./decimal.js";
import type { AllocationProposal } from "./portfolio.js";

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
  if (context.stopLoss !== undefined) {
    assertDecimal(context.stopLoss, "stopLoss");
    if (compareDecimal(context.stopLoss, "0") <= 0) flags.push("INVALID_STOP_LOSS");
  }

  const denyFlags = ["INVALID_AMOUNT", "INVALID_STOP_LOSS", "PROPOSAL_EXPIRED", "STALE_DATA", "RISK_CHECK_UNAVAILABLE", "INSUFFICIENT_LIQUIDITY", "DRAWDOWN_LIMIT", "MISSING_STOP_LOSS"];
  const base = {
    id: context.id,
    evaluatedAt: context.evaluatedAt,
    proposalId: proposal.id,
    riskPolicyVersionId: context.riskPolicyVersionId,
    dataAsOf: context.dataAsOf,
  };
  if (proposal.status === "REJECTED" || flags.some((flag) => denyFlags.includes(flag))) {
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
