export type ScoreContract = {
  status: "SCORED" | "BLOCKED" | "UNAVAILABLE";
  score?: { point: number; low: number; high: number };
  confidence?: { score: number; grade: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED" };
  blockerCodes: string[];
  warningCodes?: string[];
};

export type ScoreViewModel = {
  status: ScoreContract["status"];
  scoreLabel: string;
  rangeLabel?: string;
  confidenceLabel: string;
  blockerCodes: string[];
  warningCodes: string[];
};

export function toScoreViewModel(input: ScoreContract): ScoreViewModel {
  if (input.status !== "SCORED") {
    return {
      status: input.status,
      scoreLabel: input.status === "BLOCKED" ? "산출 차단" : "산출 불가",
      confidenceLabel: "검증되지 않음",
      blockerCodes: [...input.blockerCodes],
      warningCodes: [...(input.warningCodes ?? [])],
    };
  }
  if (!input.score || !input.confidence) throw new Error("SCORED view requires score and confidence");
  return {
    status: input.status,
    scoreLabel: formatScore(input.score.point),
    rangeLabel: `${formatScore(input.score.low)}–${formatScore(input.score.high)}`,
    confidenceLabel: `${formatScore(input.confidence.score)} · ${input.confidence.grade}`,
    blockerCodes: [],
    warningCodes: [...(input.warningCodes ?? [])],
  };
}

export type DecisionContract = {
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "BLOCKED" | "EXPIRED";
  riskStatus: "ALLOW" | "REDUCE" | "REQUIRE_MANUAL_REVIEW" | "DENY";
  stale: boolean;
  expiresAt: string;
  now: string;
};

export type ApprovalViewModel = {
  canApprove: boolean;
  canReject: boolean;
  status: "READY" | "REVIEW" | "BLOCKED" | "EXPIRED" | "FINAL";
  reason: string;
};

export function deriveApprovalViewModel(input: DecisionContract): ApprovalViewModel {
  if (input.status === "APPROVED" || input.status === "REJECTED") return { canApprove: false, canReject: false, status: "FINAL", reason: "이미 최종 처리된 결정입니다." };
  if (input.status === "EXPIRED" || new Date(input.expiresAt).getTime() <= new Date(input.now).getTime()) return { canApprove: false, canReject: false, status: "EXPIRED", reason: "제안이 만료되어 새 Proposal이 필요합니다." };
  if (input.riskStatus === "DENY" || input.status === "BLOCKED") return { canApprove: false, canReject: false, status: "BLOCKED", reason: "Risk 또는 Hard Safety가 행동을 차단했습니다." };
  if (input.stale) return { canApprove: false, canReject: true, status: "BLOCKED", reason: "필수 데이터가 오래되어 승인할 수 없습니다." };
  if (input.riskStatus === "REQUIRE_MANUAL_REVIEW") return { canApprove: false, canReject: true, status: "REVIEW", reason: "추가 근거 검토와 새 Risk Decision이 필요합니다." };
  if (input.status !== "PENDING_APPROVAL") return { canApprove: false, canReject: false, status: "BLOCKED", reason: "승인 가능한 상태가 아닙니다." };
  return { canApprove: true, canReject: true, status: "READY", reason: "서버 재검증 후 승인할 수 있습니다." };
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
