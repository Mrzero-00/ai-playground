export type ScoreBreakdown<T extends string> = {
  total: number;
  components: Record<T, number>;
};

export function assertScore(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be a finite number between 0 and 100`);
  }
}

export function weightedScore<T extends string>(
  values: Record<T, number>,
  weights: Record<T, number>,
): ScoreBreakdown<T> {
  const keys = Object.keys(values) as T[];
  for (const key of keys) assertScore(key, values[key]);

  const weightTotal = keys.reduce((sum, key) => sum + weights[key], 0);
  if (Math.abs(weightTotal - 1) > 0.000_001) {
    throw new RangeError("weights must sum to 1");
  }

  const total = keys.reduce((sum, key) => sum + values[key] * weights[key], 0);
  return { total: Math.round(total * 100) / 100, components: { ...values } };
}

