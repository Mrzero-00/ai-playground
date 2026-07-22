export type UiError = { title: string; recovery: string; severity: "INFO" | "CAUTION" | "CRITICAL" };

export function mapApiErrorToUi(code: string): UiError {
  if (code.includes("OWNERSHIP") || code === "FORBIDDEN") return { title: "접근할 수 없습니다", recovery: "이전 화면으로 돌아가세요.", severity: "CRITICAL" };
  if (code.includes("EXPIRED")) return { title: "제안이 만료되었습니다", recovery: "최신 데이터로 새 Proposal을 요청하세요.", severity: "CAUTION" };
  if (code.includes("POINT_IN_TIME") || code.includes("SOURCE_INCOMPLETE")) return { title: "데이터 계보를 확인할 수 없습니다", recovery: "누락된 Source가 갱신된 후 다시 검토하세요.", severity: "CRITICAL" };
  if (code.includes("BLOCKED") || code.includes("DENY")) return { title: "안전 규칙이 행동을 차단했습니다", recovery: "차단 이유와 해소 조건을 확인하세요.", severity: "CRITICAL" };
  if (code.includes("CONFLICT")) return { title: "검토 중 상태가 변경되었습니다", recovery: "최신 상태를 다시 불러오세요.", severity: "CAUTION" };
  return { title: "요청을 완료하지 못했습니다", recovery: "Request ID와 함께 다시 시도하세요.", severity: "CAUTION" };
}
