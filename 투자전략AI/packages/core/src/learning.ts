export type Strategy = "long-term" | "momentum";

export type InvestmentDecision = {
  id: string;
  symbol: string;
  strategy: Strategy;
  score: number;
  rationale: string;
  modelVersion: string;
  decidedAt: string;
};

export type DecisionOutcome = {
  decisionId: string;
  returnPercent: number;
  lesson: string;
  measuredAt: string;
};

export interface LearningRepository {
  saveDecision(decision: InvestmentDecision): Promise<void>;
  saveOutcome(outcome: DecisionOutcome): Promise<void>;
  findDecision(id: string): Promise<InvestmentDecision | undefined>;
}

