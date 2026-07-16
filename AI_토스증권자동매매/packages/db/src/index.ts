import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DataQuality,EntryPlan,InvestmentThesis,MarketRegime,PriceReflectionAssessment,SignalFeatures, TradeEvaluation,TradeRecord } from '@trading/shared';

export interface TradingRepository {
  saveSignal(features: SignalFeatures): Promise<void>;
  saveTrade(trade: TradeRecord): Promise<void>;
  saveDecisionContext(thesis:InvestmentThesis,reflection:PriceReflectionAssessment,plan:EntryPlan,source:{content:string;quality:DataQuality},regime:MarketRegime):Promise<void>;
  saveEvaluation(evaluation:TradeEvaluation):Promise<void>;
  listTrades(): Promise<TradeRecord[]>;
}
export class InMemoryTradingRepository implements TradingRepository {
  readonly signals: SignalFeatures[] = []; readonly trades: TradeRecord[] = [];readonly contexts:Array<{thesis:InvestmentThesis;reflection:PriceReflectionAssessment;plan:EntryPlan;source:{content:string;quality:DataQuality};regime:MarketRegime}>=[];readonly evaluations:TradeEvaluation[]=[];
  async saveSignal(features: SignalFeatures) { this.signals.push(structuredClone(features)); }
  async saveTrade(trade: TradeRecord) { const i = this.trades.findIndex((t) => t.id === trade.id); if (i >= 0) this.trades[i] = structuredClone(trade); else this.trades.push(structuredClone(trade)); }
  async saveDecisionContext(thesis:InvestmentThesis,reflection:PriceReflectionAssessment,plan:EntryPlan,source:{content:string;quality:DataQuality},regime:MarketRegime){this.contexts.push(structuredClone({thesis,reflection,plan,source,regime}));}
  async saveEvaluation(evaluation:TradeEvaluation){this.evaluations.push(structuredClone(evaluation));}
  async listTrades() { return structuredClone(this.trades); }
}
export class SupabaseTradingRepository implements TradingRepository {
  private readonly db: SupabaseClient;
  constructor(url: string, serviceRoleKey: string) { this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } }); }
  async saveSignal(f: SignalFeatures) {
    const { data, error } = await this.db.from('signals').insert({ symbol: f.symbol, strategy_type: 'dopamine', status: 'analyzed', observed_at: f.observedAt }).select('id').single();
    if (error) throw error; const { error: featureError } = await this.db.from('signal_features').insert({ signal_id: data.id, features: f, observed_at: f.observedAt }); if (featureError) throw featureError;
  }
  async saveTrade(t: TradeRecord) { const { error } = await this.db.from('trades').upsert({ id:t.id,strategy_version_id:t.strategyVersionId,symbol:t.symbol,strategy_type:t.strategyType,signal_at:t.signalAt,entry_at:t.entryAt,exit_at:t.exitAt,planned_entry_min:t.plannedEntryMin,planned_entry_max:t.plannedEntryMax,actual_entry_price:t.actualEntryPrice,actual_exit_price:t.actualExitPrice,quantity:t.quantity,stop_loss:t.stopLoss,target_1:t.target1,target_2:t.target2,pnl_amount:t.pnlAmount,pnl_percent:t.pnlPercent,exit_reason:t.exitReason }); if (error) throw error; }
  async saveDecisionContext(thesis:InvestmentThesis,reflection:PriceReflectionAssessment,plan:EntryPlan,source:{content:string;quality:DataQuality},regime:MarketRegime){const{data,error}=await this.db.from('theses').insert({symbol:thesis.symbol,thesis_type:thesis.thesisType,score:thesis.thesisScore,confidence:thesis.confidence,payload:thesis,source_content:source.content,source_quality:source.quality,market_regime:regime}).select('id').single();if(error)throw error;const{error:e}=await this.db.from('price_reflections').insert({thesis_id:data.id,symbol:thesis.symbol,payload:reflection});if(e)throw e;const{error:p}=await this.db.from('entry_plans').insert({thesis_id:data.id,symbol:thesis.symbol,payload:plan});if(p)throw p;}
  async saveEvaluation(evaluation:TradeEvaluation){const{error}=await this.db.from('trade_evaluations').upsert({trade_id:evaluation.tradeId,payload:evaluation,outcome_type:evaluation.outcomeType});if(error)throw error;}
  async listTrades() { const { data, error } = await this.db.from('trades').select('*').order('created_at', { ascending: false }); if (error) throw error; return (data ?? []).map((t) => ({id:t.id,strategyVersionId:t.strategy_version_id,symbol:t.symbol,strategyType:t.strategy_type,signalAt:t.signal_at,entryAt:t.entry_at,exitAt:t.exit_at,plannedEntryMin:Number(t.planned_entry_min),plannedEntryMax:Number(t.planned_entry_max),actualEntryPrice:Number(t.actual_entry_price),actualExitPrice:t.actual_exit_price===null?null:Number(t.actual_exit_price),quantity:t.quantity,stopLoss:Number(t.stop_loss),target1:Number(t.target_1),target2:Number(t.target_2),pnlAmount:t.pnl_amount===null?null:Number(t.pnl_amount),pnlPercent:t.pnl_percent===null?null:Number(t.pnl_percent),exitReason:t.exit_reason})) as TradeRecord[]; }
}
