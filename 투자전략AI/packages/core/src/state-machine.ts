export type LongTermCandidateState =
  | "UNIVERSE" | "WATCH" | "CANDIDATE" | "STRONG_CANDIDATE" | "FUTURE_CORE" | "CORE"
  | "WEAKENED" | "REMOVED" | "ARCHIVED";

export type MomentumSetupState =
  | "DETECTED" | "VALIDATED" | "PLANNED" | "APPROVED" | "ENTERED" | "MANAGING" | "CLOSED" | "REVIEWED"
  | "REJECTED" | "EXPIRED" | "INVALIDATED" | "CANCELLED";

const longTermProgression: LongTermCandidateState[] = ["UNIVERSE", "WATCH", "CANDIDATE", "STRONG_CANDIDATE", "FUTURE_CORE", "CORE"];
const longTermExceptional: LongTermCandidateState[] = ["WEAKENED", "REMOVED"];
const momentumProgression: MomentumSetupState[] = ["DETECTED", "VALIDATED", "PLANNED", "APPROVED", "ENTERED", "MANAGING", "CLOSED", "REVIEWED"];
const momentumTerminal: MomentumSetupState[] = ["REJECTED", "EXPIRED", "INVALIDATED", "CANCELLED"];

export function transitionLongTermCandidate(current: LongTermCandidateState, next: LongTermCandidateState): LongTermCandidateState {
  if (current === "ARCHIVED") throw new Error("archived candidate cannot transition");
  if (next === "ARCHIVED") {
    if (current === "REMOVED") return next;
    throw new Error(`invalid long-term transition: ${current} -> ${next}`);
  }
  if (longTermExceptional.includes(next)) return next;
  const currentIndex = longTermProgression.indexOf(current);
  const nextIndex = longTermProgression.indexOf(next);
  if (current === "WEAKENED" && next === "WATCH") return next;
  if (currentIndex < 0 || nextIndex !== currentIndex + 1) throw new Error(`invalid long-term transition: ${current} -> ${next}`);
  return next;
}

export function transitionMomentumSetup(current: MomentumSetupState, next: MomentumSetupState): MomentumSetupState {
  if (momentumTerminal.includes(current) || current === "REVIEWED") throw new Error(`terminal momentum state: ${current}`);
  if (momentumTerminal.includes(next)) return next;
  const currentIndex = momentumProgression.indexOf(current);
  const nextIndex = momentumProgression.indexOf(next);
  if (nextIndex !== currentIndex + 1) throw new Error(`invalid momentum transition: ${current} -> ${next}`);
  return next;
}
