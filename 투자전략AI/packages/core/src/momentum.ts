import { weightedScore, type ScoreBreakdown } from "./scoring.js";

export type MomentumFactor =
  | "relativeStrength"
  | "volume"
  | "sectorRotation"
  | "catalyst"
  | "riskReward";

export type MomentumInput = Record<MomentumFactor, number>;
export type MomentumEvaluation = ScoreBreakdown<MomentumFactor> & {
  strategy: "momentum";
  signal: "enter" | "watch" | "avoid";
};

const weights: Record<MomentumFactor, number> = {
  relativeStrength: 0.3,
  volume: 0.2,
  sectorRotation: 0.15,
  catalyst: 0.15,
  riskReward: 0.2,
};

export function evaluateMomentum(input: MomentumInput): MomentumEvaluation {
  const score = weightedScore(input, weights);
  return {
    strategy: "momentum",
    ...score,
    signal: score.total >= 75 ? "enter" : score.total >= 60 ? "watch" : "avoid",
  };
}

