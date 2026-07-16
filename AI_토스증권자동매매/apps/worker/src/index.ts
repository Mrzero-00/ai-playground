import type { TradingRepository } from '@trading/db';
import { evaluateTrade } from '@trading/evaluator';
import { PaperBrokerProvider } from '@trading/execution';
import type { MarketDataProvider } from '@trading/market-data';
import { isFresh, type RegimeAssessment } from '@trading/market-regime';
import type { NewsProvider } from '@trading/news';
import { assessPriceReflection } from '@trading/price-reflection';
import { RiskEngine } from '@trading/risk';
import { createEntryPlan, evaluateDopamineSignal } from '@trading/strategy';
import type { ThesisAnalyzer } from '@trading/thesis';
import { Worker } from 'bullmq';

export type WorkflowDependencies = { market:MarketDataProvider; news:NewsProvider; analyzer:ThesisAnalyzer; repository:TradingRepository; risk:RiskEngine; regime:RegimeAssessment; now?:string };

export async function runPaperTradingWorkflow(symbol:string,d:WorkflowDependencies) {
  const news=await d.news.latest(symbol); const now=d.now??new Date().toISOString();
  if(!isFresh(news.quality,now)) return {entered:false,reason:'news_unverified_or_stale' as const};
  const thesis=await d.analyzer.analyze(symbol,news.content,news.quality); const features=await d.market.getFeatures(symbol);
  features.catalystScore=thesis.thesisScore; features.llmConfidence=thesis.confidence; features.marketRegime=d.regime.regime;
  await d.repository.saveSignal(features);
  const ticks=[]; for await(const tick of d.market.getTicks(symbol)) ticks.push(tick); const entry=ticks[0]; if(!entry) throw new Error('No market ticks');
  const reflection=assessPriceReflection(thesis,features); const plan=createEntryPlan(features,reflection,entry.price,entry.at);
  await d.repository.saveDecisionContext(thesis,reflection,plan,news,d.regime.regime);
  const strategy=evaluateDopamineSignal(features);
  if(plan.entryType==='no_entry'||plan.entryMin===null||plan.entryMax===null||plan.stopLoss===null||plan.target1===null||plan.target2===null||plan.timeStopMinutes===null) return {entered:false,reason:'no_valid_entry_plan' as const,thesis,reflection,plan};
  const risk=d.risk.evaluate({equity:100_000,dailyPnl:0,weeklyPnl:0,consecutiveLosses:0,minutesSinceLastLoss:999,openPositions:0,entryPrice:entry.price,stopPrice:plan.stopLoss,dollarVolume:5_000_000,spreadPercent:features.spreadPercent,gapPercent:features.premarketGapPercent,killSwitchActive:false,regimeRiskMultiplier:d.regime.riskMultiplier,dataFresh:d.regime.tradingAllowed&&isFresh(news.quality,now),estimatedRoundTripCostPercent:features.spreadPercent+0.15,expectedGrossEdgePercent:((plan.target1/entry.price)-1)*100});
  if(!strategy.passed||!risk.approved||thesis.thesisScore<8.5||thesis.confidence<0.7) return {entered:false,reason:'decision_gate_rejected' as const,thesis,reflection,plan,risk};
  const broker=new PaperBrokerProvider(d.repository);
  let position=await broker.submit({symbol,strategyVersionId:'00000000-0000-0000-0000-000000000001',signalAt:features.observedAt,entryMin:plan.entryMin,entryMax:plan.entryMax,stopLoss:plan.stopLoss,target1:plan.target1,target2:plan.target2,quantity:risk.quantity,expiresAt:plan.expiresAt,timeStopMinutes:plan.timeStopMinutes},entry);
  for(const tick of ticks.slice(1)) position=(await broker.onTick(tick))??position;
  let evaluation=null;
  if(position.trade.pnlAmount!==null) { evaluation=evaluateTrade(position.trade,thesis,{thesisStillValid:position.trade.exitReason!=='thesis_invalidated',entryWithinPlan:true,stopHonored:true,dataWasFresh:true,thesisScoreAfter:thesis.thesisScore}); await d.repository.saveEvaluation(evaluation); }
  return {entered:true,thesis,reflection,plan,risk,trade:position.trade,evaluation,audit:position.state.audit};
}

export function startPaperTradingWorker(redisUrl:string,dependencies:WorkflowDependencies) { const url=new URL(redisUrl); return new Worker<{symbol:string}>('paper-trading',async job=>runPaperTradingWorkflow(job.data.symbol,dependencies),{connection:{host:url.hostname,port:Number(url.port||6379),username:url.username,password:url.password}}); }
