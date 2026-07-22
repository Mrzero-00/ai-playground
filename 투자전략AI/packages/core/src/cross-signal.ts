export type CrossSignalClassification =
  | "DUAL_HIGH_CONVICTION"
  | "LONG_TERM_ONLY"
  | "MOMENTUM_ONLY"
  | "AVOID";

export type CrossSignal = {
  companyId: string;
  evaluatedAt: string;
  longTermEvaluationId: string;
  momentumEvaluationId: string;
  scoringPolicyVersionId: string;
  longTermScore: number;
  momentumScore: number;
  classification: CrossSignalClassification;
  interpretation: string;
  portfolioNotes: string[];
};

const HIGH_SCORE = 75;

export function interpretCrossSignal(input: {
  companyId: string;
  evaluatedAt: string;
  longTermEvaluationId: string;
  momentumEvaluationId: string;
  scoringPolicyVersionId: string;
  longTermScore: number;
  momentumScore: number;
}): CrossSignal {
  if (!input.longTermEvaluationId.trim() || !input.momentumEvaluationId.trim() || !input.scoringPolicyVersionId.trim()) {
    throw new Error("both evaluation IDs and scoring policy version are required");
  }
  for (const [name, value] of [
    ["longTermScore", input.longTermScore],
    ["momentumScore", input.momentumScore],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new RangeError(`${name} must be between 0 and 100`);
    }
  }

  const longTermHigh = input.longTermScore >= HIGH_SCORE;
  const momentumHigh = input.momentumScore >= HIGH_SCORE;

  if (longTermHigh && momentumHigh) {
    return {
      ...input,
      classification: "DUAL_HIGH_CONVICTION",
      interpretation: "장기 투자 매력과 단기 추세가 모두 우호적입니다.",
      portfolioNotes: ["동일 종목을 보유하면 전략별 Position Lot을 분리해야 합니다."],
    };
  }
  if (longTermHigh) {
    return {
      ...input,
      classification: "LONG_TERM_ONLY",
      interpretation: "장기 투자 매력은 높지만 단기 추세는 불리합니다.",
      portfolioNotes: ["Momentum 진입 근거로 사용하지 마세요."],
    };
  }
  if (momentumHigh) {
    return {
      ...input,
      classification: "MOMENTUM_ONLY",
      interpretation: "단기 전술 거래만 허용되는 신호입니다.",
      portfolioNotes: ["손절된 Momentum Lot을 장기 투자로 전환할 수 없습니다."],
    };
  }
  return {
    ...input,
    classification: "AVOID",
    interpretation: "두 전략 모두 신규 진입 우선순위가 낮습니다.",
    portfolioNotes: [],
  };
}
