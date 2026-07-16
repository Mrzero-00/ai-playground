import type { DataQuality } from '@trading/shared';

export type NewsKind = 'company_news' | 'sec_filing';
export type NewsDocument = {
  id?: string;
  symbol?: string;
  title?: string;
  publishedAt?: string;
  kind?: NewsKind;
  content: string;
  quality: DataQuality;
};
export interface NewsProvider { latest(symbol:string):Promise<NewsDocument> }
export interface NewsFeedProvider extends NewsProvider { recent(symbol:string,since?:Date):Promise<NewsDocument[]> }
type FetchLike = typeof fetch;

export class MockNewsProvider implements NewsProvider {
  constructor(private readonly items:Record<string,NewsDocument>) {}
  async latest(symbol:string) { const item=this.items[symbol]; if(!item) throw new Error('Unknown mock symbol'); return structuredClone(item); }
}

type FinnhubNews = { id:number; category:string; datetime:number; headline:string; related:string; source:string; summary:string; url:string };
export class FinnhubNewsProvider implements NewsFeedProvider {
  constructor(private readonly apiKey:string,private readonly fetcher:FetchLike=fetch) { if(!apiKey)throw new Error('FINNHUB_API_KEY is required'); }
  async recent(symbol:string,since=new Date(Date.now()-24*60*60*1000)) {
    assertSymbol(symbol); const to=new Date();
    const url=new URL('https://finnhub.io/api/v1/company-news');
    url.searchParams.set('symbol',symbol.toUpperCase()); url.searchParams.set('from',dateOnly(since)); url.searchParams.set('to',dateOnly(to)); url.searchParams.set('token',this.apiKey);
    const response=await this.fetcher(url); if(!response.ok)throw new Error(`Finnhub news request failed (${response.status})`);
    const rows=await response.json() as FinnhubNews[]; const receivedAt=new Date().toISOString();
    return rows.filter(validFinnhubRow).map((row):NewsDocument=>{
      const publishedAt=new Date(row.datetime*1000).toISOString();
      return {id:`finnhub:${row.id}`,symbol:symbol.toUpperCase(),title:row.headline,publishedAt,kind:'company_news',content:[row.headline,row.summary].filter(Boolean).join('\n'),quality:{observedAt:publishedAt,receivedAt,source:`Finnhub:${row.source}`,sourceUrl:safeHttpUrl(row.url),verified:false,staleAfterSeconds:15*60}};
    }).sort((a,b)=>Date.parse(b.publishedAt??'')-Date.parse(a.publishedAt??''));
  }
  async latest(symbol:string){const rows=await this.recent(symbol);const item=rows[0];if(!item)throw new Error(`No recent Finnhub news for ${symbol}`);return item;}
}

type SecTickerRow={cik_str:number;ticker:string;title:string};
type SecSubmissions={filings:{recent:{accessionNumber:string[];filingDate:string[];acceptanceDateTime:string[];form:string[];primaryDocument:string[];primaryDocDescription:string[]}}};
export class SecEdgarNewsProvider implements NewsFeedProvider {
  private tickerMap:Map<string,number>|null=null;
  constructor(private readonly userAgent:string,private readonly fetcher:FetchLike=fetch) { if(!userAgent||!userAgent.includes('@'))throw new Error('SEC_USER_AGENT must include a contact email'); }
  async recent(symbol:string,since=new Date(Date.now()-7*24*60*60*1000)) {
    assertSymbol(symbol); const cik=await this.cikFor(symbol); if(cik===undefined)return [];
    const response=await this.fetcher(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`,{headers:this.headers()});
    if(!response.ok)throw new Error(`SEC submissions request failed (${response.status})`);
    const value=await response.json() as SecSubmissions; const r=value.filings.recent; const receivedAt=new Date().toISOString(); const docs:NewsDocument[]=[];
    for(let i=0;i<r.form.length;i++){
      const form=r.form[i]; if(!form||!['8-K','10-Q','10-K','6-K','20-F','40-F'].includes(form))continue;
      const accepted=parseSecDate(r.acceptanceDateTime[i]??r.filingDate[i]); if(!accepted||accepted<since)continue;
      const accession=r.accessionNumber[i]; const primary=r.primaryDocument[i]; if(!accession||!primary)continue;
      const accessionPlain=accession.replaceAll('-',''); const filingUrl=`https://www.sec.gov/Archives/edgar/data/${cik}/${accessionPlain}/${encodeURIComponent(primary)}`;
      const title=`${symbol.toUpperCase()} filed ${form}${r.primaryDocDescription[i]?`: ${r.primaryDocDescription[i]}`:''}`;
      docs.push({id:`sec:${accession}`,symbol:symbol.toUpperCase(),title,publishedAt:accepted.toISOString(),kind:'sec_filing',content:title,quality:{observedAt:accepted.toISOString(),receivedAt,source:'SEC EDGAR',sourceUrl:filingUrl,verified:true,staleAfterSeconds:24*60*60}});
    }
    return docs.sort((a,b)=>Date.parse(b.publishedAt??'')-Date.parse(a.publishedAt??''));
  }
  async latest(symbol:string){const rows=await this.recent(symbol);const item=rows[0];if(!item)throw new Error(`No recent SEC filing for ${symbol}`);return item;}
  private async cikFor(symbol:string){if(!this.tickerMap){const response=await this.fetcher('https://www.sec.gov/files/company_tickers.json',{headers:this.headers()});if(!response.ok)throw new Error(`SEC ticker map request failed (${response.status})`);const json=await response.json() as Record<string,SecTickerRow>;this.tickerMap=new Map(Object.values(json).map(row=>[row.ticker.toUpperCase(),row.cik_str]));}return this.tickerMap.get(symbol.toUpperCase());}
  private headers(){return {'user-agent':this.userAgent,'accept-encoding':'gzip, deflate','accept':'application/json'};}
}

export class CombinedNewsProvider implements NewsFeedProvider {
  constructor(private readonly providers:NewsFeedProvider[]) { if(providers.length===0)throw new Error('At least one news provider is required'); }
  async recent(symbol:string,since?:Date){const settled=await Promise.allSettled(this.providers.map(p=>p.recent(symbol,since)));const rows=settled.flatMap(v=>v.status==='fulfilled'?v.value:[]);if(rows.length===0&&settled.every(v=>v.status==='rejected'))throw new Error(`All news providers failed for ${symbol}`);return [...new Map(rows.map(row=>[row.id??`${row.quality.source}:${row.quality.sourceUrl}`,row])).values()].sort((a,b)=>Date.parse(b.publishedAt??b.quality.observedAt)-Date.parse(a.publishedAt??a.quality.observedAt));}
  async latest(symbol:string){const rows=await this.recent(symbol);const item=rows[0];if(!item)throw new Error(`No recent news for ${symbol}`);return item;}
}

export type RuleBasedNewsAssessment={direction:'positive'|'negative'|'neutral'|'blocked';score:number;tags:string[];reasons:string[];paperTradeEligible:boolean};
const positiveRules:Array<[string,RegExp]>=[['earnings_beat',/\b(beat(s|ing)?|above expectations|raises? guidance|record revenue|record profit)\b/i],['material_contract',/\b(awarded|wins?|signed)\b.{0,40}\b(contract|agreement|order)\b/i],['approval',/\b(approved|approval|clearance|authorized)\b/i],['buyback',/\b(share repurchase|stock buyback|buyback)\b/i]];
const negativeRules:Array<[string,RegExp]>=[['earnings_miss',/\b(miss(es|ed)?|below expectations|cuts? guidance|lowers? guidance)\b/i],['investigation',/\b(investigation|subpoena|fraud|restatement)\b/i],['bankruptcy',/\b(bankruptcy|chapter 11|going concern)\b/i],['dilution',/\b(secondary offering|public offering|at-the-market|convertible note|dilution|register(ed|s)? securities)\b/i]];
export function assessNews(document:NewsDocument,now=new Date()):RuleBasedNewsAssessment {
  const text=`${document.title??''}\n${document.content}`; const positives=positiveRules.filter(([,r])=>r.test(text)).map(([tag])=>tag);const negatives=negativeRules.filter(([,r])=>r.test(text)).map(([tag])=>tag);
  const ageSeconds=(now.getTime()-Date.parse(document.publishedAt??document.quality.observedAt))/1000;const reasons:string[]=[];
  if(!Number.isFinite(ageSeconds)||ageSeconds< -300)reasons.push('invalid_timestamp');
  if(ageSeconds>document.quality.staleAfterSeconds)reasons.push('stale');
  if(negatives.some(v=>v==='bankruptcy'||v==='dilution'||v==='investigation'))reasons.push('hard_risk_keyword');
  const score=Math.max(-10,Math.min(10,positives.length*3-negatives.length*4));
  const blocked=reasons.length>0; const direction=blocked?'blocked':score>=3?'positive':score<=-3?'negative':'neutral';
  return {direction,score,tags:[...positives,...negatives],reasons,paperTradeEligible:!blocked&&direction==='positive'&&Boolean(document.quality.sourceUrl)};
}

function assertSymbol(symbol:string){if(!/^[A-Za-z0-9.\-]+$/.test(symbol))throw new Error('Invalid symbol');}
function dateOnly(date:Date){return date.toISOString().slice(0,10);}
function safeHttpUrl(value:string){try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?url.toString():null}catch{return null}}
function validFinnhubRow(row:FinnhubNews){return Number.isSafeInteger(row.id)&&row.id>0&&Number.isFinite(row.datetime)&&row.datetime>0&&Boolean(row.headline);}
function parseSecDate(value:string|undefined){if(!value)return null;const normalized=/^\d{8}T\d{6}\.\d{3}Z$/.test(value)?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}.${value.slice(16)}`:value;const date=new Date(normalized);return Number.isNaN(date.getTime())?null:date;}
