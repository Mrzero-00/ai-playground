import type { ThesisStatus } from "../thesis.js";
import type { LongTermCandidateState } from "../state-machine.js";
import type {
  GateContext,
  GateResult,
  LongTermAction,
  LongTermEvaluationMode,
  ProfileEvaluation,
  ValuationClassification,
} from "./types.js";

const EXPANSION_ACTIONS: LongTermAction[] = ["ACCUMULATE", "BUY_ON_WEAKNESS"];

export function evaluateLongTermGates(input: {
  gates: GateContext;
  pointInTimeValid: boolean;
  evidenceBalanced: boolean;
  industryProfileValid: boolean;
  thesisComplete: boolean;
  evidenceIds: string[];
}): GateResult[] {
  const hardRisk = (input.gates.hardRiskCodes ?? []).length > 0;
  return [
    gate("IDENTITY_RESOLVED", input.gates.identityResolved, "IDENTITY_UNRESOLVED", "company and security identity must be resolved", input.evidenceIds),
    gate("POINT_IN_TIME_VALID", input.pointInTimeValid, "POINT_IN_TIME_VIOLATION", "evaluation inputs cannot contain future information", input.evidenceIds),
    gate("DATA_QUALITY_SUFFICIENT", input.gates.dataQualitySufficient, "DATA_QUALITY_INSUFFICIENT", "critical data must be complete and fresh", input.evidenceIds),
    gate("EVIDENCE_BALANCED", input.evidenceBalanced, "INSUFFICIENT_COUNTER_EVIDENCE", "supporting, scoring and counter evidence are required", input.evidenceIds),
    gate("ACCOUNTING_TRUST", input.gates.accountingTrustworthy, "ACCOUNTING_TRUST_FAILED", "material accounting issues require manual review", input.evidenceIds),
    gate("FINANCIAL_SURVIVAL", input.gates.financialSurvival, "FINANCIAL_SURVIVAL_FAILED", "financial survival must be demonstrated", input.evidenceIds),
    gate("VALUATION_AVAILABLE", input.gates.valuationAvailable, "VALUATION_INPUT_INCOMPLETE", "valuation is required for expansion actions", input.evidenceIds),
    gate("THESIS_COMPLETE", input.thesisComplete && input.gates.thesisComplete, "THESIS_INCOMPLETE", "candidate stages require a complete thesis", input.evidenceIds),
    gate("INDUSTRY_PROFILE_VALID", input.industryProfileValid, "INDUSTRY_PROFILE_NOT_SUPPORTED", "an active compatible industry profile is required", input.evidenceIds),
    gate("POLICY_VERSION_ACTIVE", input.gates.policyVersionActive, "POLICY_VERSION_CONFLICT", "the requested policy version must be active", input.evidenceIds),
    {
      gateId: "HARD_RISK_CLEAR",
      status: hardRisk ? "REVIEW_REQUIRED" : "PASSED",
      severity: "HARD",
      reasonCode: hardRisk ? input.gates.hardRiskCodes!.join(",") : "HARD_RISK_CLEAR",
      evidenceIds: [...input.evidenceIds],
      explanation: hardRisk ? "one or more hard-risk conditions require human review" : "no hard-risk condition was supplied",
      blockedActions: hardRisk ? [...EXPANSION_ACTIONS] : [],
    },
  ];
}

export function selectLongTermAction(input: {
  thesisStatus: ThesisStatus;
  valuation: ValuationClassification;
  gateResults: GateResult[];
  priceConditionDefined: boolean;
  confidenceScore: number;
  profileEligibility: ProfileEvaluation["eligibility"];
}): { action: LongTermAction; constraints: string[] } {
  const failedHardGates = input.gateResults.filter((gate) => gate.severity === "HARD" && gate.status !== "PASSED" && gate.status !== "NOT_APPLICABLE");
  if (failedHardGates.length > 0) {
    return { action: "REVIEW_REQUIRED", constraints: [...new Set(failedHardGates.map((gate) => gate.reasonCode))] };
  }
  if (input.thesisStatus === "BROKEN") return { action: "EXIT", constraints: ["HUMAN_APPROVAL_REQUIRED", "PORTFOLIO_RISK_REVIEW_REQUIRED"] };
  if (input.thesisStatus === "REPLACED") return { action: "REVIEW_REQUIRED", constraints: ["NEW_THESIS_APPROVAL_REQUIRED"] };
  if (input.thesisStatus === "WEAKENED") return { action: "REDUCE", constraints: ["EXPANSION_BLOCKED", "HUMAN_APPROVAL_REQUIRED"] };
  if (input.profileEligibility !== "ELIGIBLE") return { action: "WATCH", constraints: ["PROFILE_NOT_ELIGIBLE", "EXPANSION_BLOCKED"] };
  if (input.confidenceScore < 50 || input.valuation === "UNKNOWN") return { action: "WATCH", constraints: ["INSUFFICIENT_CONFIDENCE_OR_VALUATION"] };
  if (input.valuation === "EXTREME") return { action: "REDUCE", constraints: ["HUMAN_APPROVAL_REQUIRED", "PORTFOLIO_RISK_REVIEW_REQUIRED"] };
  if (input.valuation === "EXPENSIVE") return { action: "HOLD", constraints: ["NEW_BUY_BLOCKED_BY_VALUATION"] };
  if (input.valuation === "FAIR") return { action: "HOLD", constraints: ["PORTFOLIO_REVIEW_REQUIRED"] };
  if (input.priceConditionDefined) return { action: "BUY_ON_WEAKNESS", constraints: ["PRICE_CONDITION_RECHECK_REQUIRED", "PORTFOLIO_RISK_REVIEW_REQUIRED"] };
  return { action: "ACCUMULATE", constraints: ["PORTFOLIO_RISK_REVIEW_REQUIRED", "HUMAN_APPROVAL_REQUIRED"] };
}

export function proposeLongTermStage(input: {
  current: LongTermCandidateState;
  mode: LongTermEvaluationMode;
  thesisStatus: ThesisStatus;
  thesisComplete: boolean;
  hardGateFailed: boolean;
  core?: ProfileEvaluation | undefined;
  futureCore?: ProfileEvaluation | undefined;
  observedQuarters: number;
}): { proposed: LongTermCandidateState; requiresHumanApproval: boolean; operationalStateChangeAllowed: boolean } {
  const operationalStateChangeAllowed = input.mode !== "HISTORICAL_REPLAY";
  if (input.current === "ARCHIVED") return { proposed: "ARCHIVED", requiresHumanApproval: false, operationalStateChangeAllowed };
  if (input.thesisStatus === "BROKEN" || input.hardGateFailed) {
    const proposed = input.current === "UNIVERSE" || input.current === "WATCH" ? input.current : "WEAKENED";
    return { proposed, requiresHumanApproval: proposed !== input.current, operationalStateChangeAllowed };
  }
  if (!operationalStateChangeAllowed) return { proposed: input.current, requiresHumanApproval: false, operationalStateChangeAllowed };

  let proposed = input.current;
  if (input.current === "UNIVERSE") proposed = "WATCH";
  else if (input.current === "WATCH" && input.thesisComplete && input.mode !== "INITIAL_SCREEN") proposed = "CANDIDATE";
  else if (input.current === "CANDIDATE" && qualifiesStrongCandidate(input.futureCore, input.observedQuarters)) proposed = "STRONG_CANDIDATE";
  else if (input.current === "STRONG_CANDIDATE" && input.futureCore?.eligibility === "ELIGIBLE") proposed = "FUTURE_CORE";
  else if (input.current === "FUTURE_CORE" && input.core?.eligibility === "ELIGIBLE" && input.observedQuarters >= 8) proposed = "CORE";
  else if (input.current === "WEAKENED" && input.thesisStatus !== "WEAKENED") proposed = "WATCH";

  const requiresHumanApproval = proposed !== input.current && ["FUTURE_CORE", "CORE", "REMOVED", "ARCHIVED"].includes(proposed);
  return { proposed, requiresHumanApproval, operationalStateChangeAllowed };
}

function qualifiesStrongCandidate(evaluation: ProfileEvaluation | undefined, observedQuarters: number): boolean {
  if (!evaluation || observedQuarters < 2 || evaluation.score.point < 68 || evaluation.confidence.score < 55) return false;
  const product = evaluation.factorResults.find((factor) => factor.factorId === "FC_PRODUCT_PROOF")?.score ?? 0;
  const survival = evaluation.factorResults.find((factor) => factor.factorId === "FC_SURVIVAL_DILUTION")?.score ?? 0;
  return product >= 55 && survival >= 55;
}

function gate(id: string, passed: boolean, failureCode: string, explanation: string, evidenceIds: string[]): GateResult {
  return {
    gateId: id,
    status: passed ? "PASSED" : "FAILED",
    severity: "HARD",
    reasonCode: passed ? `${id}_PASSED` : failureCode,
    evidenceIds: [...evidenceIds],
    explanation,
    blockedActions: passed ? [] : [...EXPANSION_ACTIONS],
  };
}
