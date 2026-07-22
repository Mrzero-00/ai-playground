import { assertScore } from "../scoring.js";
import type { NormalizationPolicyV1, ScoreDirectionV1 } from "./types.js";

export function normalizeScoreV1(input: { policy: NormalizationPolicyV1; direction: ScoreDirectionV1; rawValue?: number; preNormalizedScore?: number }): { score: number; warningCodes: string[] } {
  const warnings: string[] = [];
  let score: number;
  if (input.policy.kind === "PRE_NORMALIZED") {
    if (input.preNormalizedScore === undefined) throw new Error("Scoring preNormalizedScore is required");
    assertScore("preNormalizedScore", input.preNormalizedScore);
    score = input.preNormalizedScore;
  } else {
    if (input.rawValue === undefined || !Number.isFinite(input.rawValue)) throw new Error("Scoring finite rawValue is required");
    if (input.policy.kind === "LINEAR") {
      if (!(input.policy.floor < input.policy.ceiling)) throw new Error("Scoring linear floor must be below ceiling");
      const unbounded = 100 * (input.rawValue - input.policy.floor) / (input.policy.ceiling - input.policy.floor);
      if (unbounded < 0 || unbounded > 100) warnings.push("OUTSIDE_CALIBRATION_RANGE");
      score = clamp(unbounded);
    } else if (input.policy.kind === "PIECEWISE") {
      validateAnchors(input.policy.anchors, input.direction);
      score = interpolate(input.rawValue, input.policy.anchors, warnings);
      return { score: round2(score), warningCodes: warnings };
    } else {
      const { lowerBoundary, idealMin, idealMax, upperBoundary } = input.policy;
      if (!(lowerBoundary < idealMin && idealMin <= idealMax && idealMax < upperBoundary)) throw new Error("Scoring target band boundaries are invalid");
      if (input.rawValue < lowerBoundary || input.rawValue > upperBoundary) warnings.push("OUTSIDE_TARGET_BOUNDARY");
      score = input.rawValue < idealMin
        ? 100 * (input.rawValue - lowerBoundary) / (idealMin - lowerBoundary)
        : input.rawValue <= idealMax ? 100 : 100 * (upperBoundary - input.rawValue) / (upperBoundary - idealMax);
      return { score: round2(clamp(score)), warningCodes: warnings };
    }
  }
  if (input.direction === "HIGHER_IS_WORSE") score = 100 - score;
  if (input.direction === "TARGET_IS_BEST") throw new Error("Scoring TARGET_IS_BEST requires TARGET_BAND normalization");
  return { score: round2(clamp(score)), warningCodes: warnings };
}

function validateAnchors(anchors: Array<{ raw: number; score: number }>, direction: ScoreDirectionV1): void {
  if (anchors.length < 2) throw new Error("Scoring piecewise normalization requires at least two anchors");
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]!;
    if (!Number.isFinite(anchor.raw)) throw new Error("Scoring anchor raw must be finite");
    assertScore("anchor.score", anchor.score);
    if (index === 0) continue;
    const previous = anchors[index - 1]!;
    if (anchor.raw <= previous.raw) throw new Error("Scoring anchors must have increasing raw values");
    if (direction === "HIGHER_IS_BETTER" && anchor.score < previous.score) throw new Error("Scoring anchors must be monotonic increasing");
    if (direction === "HIGHER_IS_WORSE" && anchor.score > previous.score) throw new Error("Scoring anchors must be monotonic decreasing");
  }
  if (direction === "TARGET_IS_BEST") throw new Error("Scoring TARGET_IS_BEST requires TARGET_BAND normalization");
}

function interpolate(raw: number, anchors: Array<{ raw: number; score: number }>, warnings: string[]): number {
  if (raw <= anchors[0]!.raw) { if (raw < anchors[0]!.raw) warnings.push("OUTSIDE_CALIBRATION_RANGE"); return anchors[0]!.score; }
  const last = anchors.at(-1)!;
  if (raw >= last.raw) { if (raw > last.raw) warnings.push("OUTSIDE_CALIBRATION_RANGE"); return last.score; }
  const upperIndex = anchors.findIndex((anchor) => anchor.raw >= raw);
  const lower = anchors[upperIndex - 1]!;
  const upper = anchors[upperIndex]!;
  return lower.score + (upper.score - lower.score) * (raw - lower.raw) / (upper.raw - lower.raw);
}

function clamp(value: number): number { return Math.max(0, Math.min(100, value)); }
function round2(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
