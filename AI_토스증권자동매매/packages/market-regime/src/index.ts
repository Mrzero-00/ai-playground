import type { DataQuality, MarketRegime } from '@trading/shared';
export type MarketSnapshot={vix:number;indexAbove200Day:boolean;advanceDeclineRatio:number;marketDollarVolumeRatio:number;gapHoldRate:number;quality:DataQuality};
export type RegimeAssessment={regime:MarketRegime;riskMultiplier:number;tradingAllowed:boolean;reasons:string[]};
export function isFresh(q:DataQuality,now:string){return q.verified&&(Date.parse(now)-Date.parse(q.observedAt))/1000<=q.staleAfterSeconds;}
export function assessMarketRegime(s:MarketSnapshot,now=new Date().toISOString()):RegimeAssessment {
  if(!isFresh(s.quality,now)) return {regime:'unknown',riskMultiplier:0,tradingAllowed:false,reasons:['market_data_unverified_or_stale']};
  if(s.marketDollarVolumeRatio<0.45) return {regime:'low_liquidity',riskMultiplier:0,tradingAllowed:false,reasons:['market_liquidity_too_low']};
  if(s.vix>=40||s.advanceDeclineRatio<0.25) return {regime:'panic',riskMultiplier:0,tradingAllowed:false,reasons:['panic_conditions']};
  if(s.vix>=28||(!s.indexAbove200Day&&s.advanceDeclineRatio<0.7)) return {regime:'risk_off',riskMultiplier:0.25,tradingAllowed:true,reasons:['risk_reduced']};
  if(s.indexAbove200Day&&s.vix<20&&s.advanceDeclineRatio>1.2) return {regime:'risk_on',riskMultiplier:1,tradingAllowed:true,reasons:[]};
  return {regime:'neutral',riskMultiplier:0.5,tradingAllowed:true,reasons:['neutral_market_half_risk']};
}
