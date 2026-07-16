import {MarketCandidateSchema,type MarketCandidate} from '@investment-os/contracts';
export interface DiscoveryProvider{scan(asOf:string):Promise<MarketCandidate[]>}
export class MockDiscoveryProvider implements DiscoveryProvider{private readonly candidates:MarketCandidate[];constructor(candidates:MarketCandidate[]){this.candidates=candidates;}async scan(asOf:string){return this.candidates.filter(v=>Date.parse(v.observedAt)<=Date.parse(asOf)).map(v=>MarketCandidateSchema.parse(structuredClone(v)));}}
export function rankCandidates(rows:MarketCandidate[]){return [...rows].filter(v=>v.dollarVolume>=5_000_000&&v.relativeVolume>=2&&(v.spreadPercent??Infinity)<=2).sort((a,b)=>(b.relativeVolume*2+b.changePercent)-(a.relativeVolume*2+a.changePercent));}
