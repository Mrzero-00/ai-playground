import { weightedScore, type ScoreBreakdown } from "./scoring.js";

export type LongTermFactor =
  | "businessQuality"
  | "valuation"
  | "moat"
  | "freeCashFlow"
  | "opportunityCost"
  | "portfolioFit";

export type LongTermInput = Record<LongTermFactor, number>;
export type LongTermEvaluation = ScoreBreakdown<LongTermFactor> & {
  strategy: "long-term";
  classification: "core" | "future-core" | "watch";
};

const weights: Record<LongTermFactor, number> = {
  businessQuality: 0.25,
  valuation: 0.15,
  moat: 0.2,
  freeCashFlow: 0.2,
  opportunityCost: 0.1,
  portfolioFit: 0.1,
};

export function evaluateLongTerm(input: LongTermInput): LongTermEvaluation {
  const score = weightedScore(input, weights);
  return {
    strategy: "long-term",
    ...score,
    classification: score.total >= 80 ? "core" : score.total >= 65 ? "future-core" : "watch",
  };
}

