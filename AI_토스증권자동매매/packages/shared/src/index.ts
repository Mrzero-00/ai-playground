export type StrategyType = 'core' | 'momentum' | 'dopamine';
export type MarketRegime = 'risk_on' | 'neutral' | 'risk_off' | 'panic' | 'event_driven' | 'low_liquidity' | 'unknown';
export type DataQuality = { observedAt:string; receivedAt:string; source:string; sourceUrl:string|null; verified:boolean; staleAfterSeconds:number };
export type InvestmentThesis = {
  symbol:string; thesisType:'revenue_growth'|'margin_expansion'|'market_expansion'|'regulatory_catalyst'|'capital_structure'|'short_squeeze'|'liquidity_event'|'other';
  thesisScore:number; confidence:number; futureValueDrivers:string[]; expectedImpactWindow:'intraday'|'days'|'weeks'|'months'|'years';
  verifiedFacts:string[]; inferences:string[]; unknowns:string[]; assumptions:string[]; invalidationConditions:string[];
  dilutionRisks:string[]; hiddenRisks:string[]; estimatedMateriality:{revenueImpactPercent:number|null;earningsImpactPercent:number|null;marketCapImpactPercent:number|null};
};
export type PriceReflectionAssessment = { symbol:string; reflectionLevel:'underpriced'|'fair'|'overpriced'|'unknown'; reflectedPercent:number|null; entryAllowed:boolean; reasons:string[]; chaseRisk:number; dilutionPressure:number; liquidityRisk:number };
export type EntryPlan = { symbol:string; entryType:'limit_pullback'|'breakout'|'vwap_reclaim'|'opening_range'|'no_entry'; entryMin:number|null;entryMax:number|null;stopLoss:number|null;target1:number|null;target2:number|null;timeStopMinutes:number|null;maxHoldingMinutes:number|null;invalidationPrice:number|null;expiresAt:string;riskRewardTarget1:number|null;riskRewardTarget2:number|null };
export type TradeOutcomeType='good_thesis_good_execution'|'good_thesis_bad_execution'|'bad_thesis_good_execution'|'bad_thesis_lucky_profit'|'good_process_bad_outcome'|'bad_process_good_outcome';
export type TradeEvaluation={tradeId:string;profitable:boolean;thesisCorrect:boolean;executionCorrect:boolean;riskControlCorrect:boolean;outcomeType:TradeOutcomeType;thesisScoreBefore:number;thesisScoreAfter:number;executionIssues:string[];thesisIssues:string[];riskIssues:string[];lessons:string[]};

export type SignalFeatures = {
  symbol: string;
  observedAt: string;
  marketCap: number | null;
  floatShares: number | null;
  shortInterestPercent: number | null;
  relativeVolume: number;
  premarketGapPercent: number;
  intradayChangePercent: number;
  spreadPercent: number;
  vwapDistancePercent: number;
  catalystType: string;
  catalystScore: number;
  llmConfidence: number;
  marketRegime: MarketRegime;
  sectorRelativeStrength: number | null;
};

export type PriceTick = { symbol: string; price: number; at: string };
export type TradeExitReason = 'stop' | 'time_stop' | 'thesis_invalidated' | 'target_1' | 'target_2' | 'manual';

export type TradeRecord = {
  id: string;
  strategyVersionId: string;
  symbol: string;
  strategyType: StrategyType;
  signalAt: string;
  entryAt: string;
  exitAt: string | null;
  plannedEntryMin: number;
  plannedEntryMax: number;
  actualEntryPrice: number;
  actualExitPrice: number | null;
  quantity: number;
  stopLoss: number;
  target1: number;
  target2: number;
  pnlAmount: number | null;
  pnlPercent: number | null;
  exitReason: TradeExitReason | null;
};

export type FinalDecisionInput = {
  llmCatalystScore: number;
  llmConfidence: number;
  mlTarget1HitProbability: number | null;
  mlStopFirstProbability: number | null;
  ruleEnginePassed: boolean;
};

export function shouldEnter(input: FinalDecisionInput): boolean {
  if (!input.ruleEnginePassed || input.llmCatalystScore < 9 || input.llmConfidence < 0.7) return false;
  if (input.mlTarget1HitProbability !== null && input.mlTarget1HitProbability < 0.65) return false;
  if (input.mlStopFirstProbability !== null && input.mlStopFirstProbability > 0.35) return false;
  return true;
}
