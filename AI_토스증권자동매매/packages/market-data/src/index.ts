import type { PriceTick, SignalFeatures } from '@trading/shared';
export interface MarketDataProvider { getFeatures(symbol:string):Promise<SignalFeatures>; getTicks(symbol:string):AsyncIterable<PriceTick> }
export class MockMarketDataProvider implements MarketDataProvider {
  constructor(private readonly features:SignalFeatures, private readonly ticks:PriceTick[]) {}
  async getFeatures(symbol:string) { if(symbol!==this.features.symbol) throw new Error('Unknown mock symbol'); return structuredClone(this.features); }
  async *getTicks(symbol:string) { for(const tick of this.ticks) if(tick.symbol===symbol) yield structuredClone(tick); }
}
