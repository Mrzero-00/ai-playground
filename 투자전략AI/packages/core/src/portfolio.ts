export type PortfolioPolicy = {
  longTermTarget: number;
  momentumTarget: number;
  maxSinglePosition: number;
};

export type Allocation = {
  capital: number;
  longTerm: number;
  momentum: number;
  maxSinglePosition: number;
};

export const defaultPortfolioPolicy: PortfolioPolicy = {
  longTermTarget: 0.85,
  momentumTarget: 0.15,
  maxSinglePosition: 0.1,
};

export function allocateCapital(
  capital: number,
  policy: PortfolioPolicy = defaultPortfolioPolicy,
): Allocation {
  if (!Number.isFinite(capital) || capital <= 0) throw new RangeError("capital must be positive");
  if (policy.longTermTarget < 0.8 || policy.longTermTarget > 0.9) {
    throw new RangeError("longTermTarget must be between 0.8 and 0.9");
  }
  if (Math.abs(policy.longTermTarget + policy.momentumTarget - 1) > 0.000_001) {
    throw new RangeError("strategy targets must sum to 1");
  }
  if (policy.maxSinglePosition <= 0 || policy.maxSinglePosition > 1) {
    throw new RangeError("maxSinglePosition must be between 0 and 1");
  }

  return {
    capital,
    longTerm: capital * policy.longTermTarget,
    momentum: capital * policy.momentumTarget,
    maxSinglePosition: capital * policy.maxSinglePosition,
  };
}

