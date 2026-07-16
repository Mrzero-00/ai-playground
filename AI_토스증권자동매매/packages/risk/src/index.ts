export type RiskLimits = {
  maxRiskPerTradePercent: number; maxDailyLossPercent: number; maxOpenPositions: number;
  maxWeeklyLossPercent:number;maxConsecutiveLosses:number;cooldownMinutesAfterLoss:number;maxPositionPercent: number; minDollarVolume: number; maxSpreadPercent: number; maxGapPercent: number;
};
export type RiskInput = {
  equity: number; dailyPnl: number; openPositions: number; entryPrice: number; stopPrice: number;
  dollarVolume: number; spreadPercent: number; gapPercent: number; killSwitchActive: boolean;
  weeklyPnl:number;consecutiveLosses:number;minutesSinceLastLoss:number;regimeRiskMultiplier:number;dataFresh:boolean;estimatedRoundTripCostPercent:number;expectedGrossEdgePercent:number;
};
export type RiskDecision = { approved: boolean; quantity: number; riskAmount: number; reasons: string[] };

export const defaultRiskLimits: RiskLimits = {
  maxRiskPerTradePercent: 0.25, maxDailyLossPercent: 1, maxWeeklyLossPercent:3,maxConsecutiveLosses:3,cooldownMinutesAfterLoss:60,maxOpenPositions: 3,
  maxPositionPercent: 10, minDollarVolume: 5_000_000, maxSpreadPercent: 2, maxGapPercent: 80,
};

export class RiskEngine {
  constructor(private readonly limits: RiskLimits = defaultRiskLimits) {}
  evaluate(input: RiskInput): RiskDecision {
    const reasons: string[] = [];
    const perShareRisk = input.entryPrice - input.stopPrice;
    if (input.killSwitchActive) reasons.push('kill_switch_active');
    if(!input.dataFresh)reasons.push('stale_or_unverified_data');
    if(input.regimeRiskMultiplier<=0)reasons.push('market_regime_blocks_trading');
    if (input.dailyPnl <= -(input.equity * this.limits.maxDailyLossPercent / 100)) reasons.push('daily_loss_limit_reached');
    if(input.weeklyPnl<=-(input.equity*this.limits.maxWeeklyLossPercent/100))reasons.push('weekly_loss_limit_reached');
    if(input.consecutiveLosses>=this.limits.maxConsecutiveLosses)reasons.push('consecutive_loss_limit_reached');
    if(input.consecutiveLosses>0&&input.minutesSinceLastLoss<this.limits.cooldownMinutesAfterLoss)reasons.push('post_loss_cooldown');
    if(input.expectedGrossEdgePercent<=input.estimatedRoundTripCostPercent)reasons.push('expected_edge_does_not_cover_costs');
    if (input.openPositions >= this.limits.maxOpenPositions) reasons.push('max_open_positions_reached');
    if (input.dollarVolume < this.limits.minDollarVolume) reasons.push('insufficient_liquidity');
    if (input.spreadPercent > this.limits.maxSpreadPercent) reasons.push('spread_too_wide');
    if (input.gapPercent > this.limits.maxGapPercent) reasons.push('gap_chase_limit');
    if (perShareRisk <= 0) reasons.push('invalid_stop_price');
    const riskBudget = input.equity * this.limits.maxRiskPerTradePercent / 100*Math.min(1,input.regimeRiskMultiplier);
    const maxByRisk = perShareRisk > 0 ? Math.floor(riskBudget / perShareRisk) : 0;
    const maxByPosition = Math.floor((input.equity * this.limits.maxPositionPercent / 100) / input.entryPrice);
    const quantity = Math.max(0, Math.min(maxByRisk, maxByPosition));
    if (quantity === 0) reasons.push('position_size_is_zero');
    return { approved: reasons.length === 0, quantity: reasons.length ? 0 : quantity, riskAmount: reasons.length ? 0 : quantity * perShareRisk, reasons };
  }
}
