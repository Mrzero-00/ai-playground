import type { SignalFeatures } from '@trading/shared';
export {createEntryPlan} from './entry-plan.js';

export const dopamineStrategyV1 = Object.freeze({
  version: 'dopamine-v3', minThesisScore:8.5,minCatalystScore: 9, minRelativeVolume: 5,
  maxSpreadPercent: 2, maxPremarketGapPercent: 80, maxRiskPerTradePercent: 0.25,
});
export type StrategyCheck = { passed: boolean; reasons: string[] };

export function evaluateDopamineSignal(features: SignalFeatures): StrategyCheck {
  const reasons: string[] = [];
  if (features.catalystScore < dopamineStrategyV1.minCatalystScore) reasons.push('catalyst_score_below_minimum');
  if (features.relativeVolume < dopamineStrategyV1.minRelativeVolume) reasons.push('relative_volume_below_minimum');
  if (features.spreadPercent > dopamineStrategyV1.maxSpreadPercent) reasons.push('spread_above_maximum');
  if (features.premarketGapPercent > dopamineStrategyV1.maxPremarketGapPercent) reasons.push('premarket_gap_above_maximum');
  return { passed: reasons.length === 0, reasons };
}
