import type { AutomatedExecutionStatusV1 } from "./types.js";

const TRANSITIONS: Record<AutomatedExecutionStatusV1, AutomatedExecutionStatusV1[]> = {
  CREATED: ["PREFLIGHT_PASSED", "BLOCKED", "EXPIRED"],
  PREFLIGHT_PASSED: ["RESERVED", "BLOCKED", "EXPIRED"],
  BLOCKED: [],
  RESERVED: ["SUBMITTING", "BLOCKED", "EXPIRED"],
  SUBMITTING: ["SUBMITTED", "UNKNOWN", "REJECTED"],
  SUBMITTED: ["PARTIALLY_FILLED", "FILLED", "CANCEL_PENDING", "REJECTED", "EXPIRED"],
  UNKNOWN: ["SUBMITTED", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED"],
  PARTIALLY_FILLED: ["FILLED", "CANCEL_PENDING", "CANCELLED"],
  FILLED: [],
  CANCEL_PENDING: ["CANCELLED", "PARTIALLY_FILLED", "FILLED", "UNKNOWN"],
  CANCELLED: [],
  REJECTED: [],
  EXPIRED: [],
};

export function transitionAutomatedExecutionStatusV1(
  current: AutomatedExecutionStatusV1,
  next: AutomatedExecutionStatusV1,
): AutomatedExecutionStatusV1 {
  if (!TRANSITIONS[current].includes(next)) throw new Error(`Invalid automated execution transition ${current} -> ${next}`);
  return next;
}

export function isAutomatedExecutionTerminalV1(status: AutomatedExecutionStatusV1): boolean {
  return TRANSITIONS[status].length === 0;
}
