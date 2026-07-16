import {appendFile,mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TossInvestClient,tossInvestConfigFromEnv,type TossPrice} from '@trading/broker';
import {assessNews,CombinedNewsProvider,FinnhubNewsProvider,SecEdgarNewsProvider,type NewsDocument} from '@trading/news';

type Position={symbol:string;newsId:string;sourceUrl:string|null;openedAt:string;entryPrice:number;quantity:number;stopPrice:number;targetPrice:number;expiresAt:string;entryCommission:number};
type ClosedTrade=Position&{closedAt:string;exitPrice:number;exitReason:'stop'|'target'|'time';exitCommission:number;pnl:number};
type PaperState={version:1;equity:number;realizedPnl:number;day:string;dailyPnl:number;seenNewsIds:string[];positions:Position[];closedTrades:ClosedTrade[]};
type PaperConfig={startingEquity:number;riskPerTradePercent:number;dailyLossLimitPercent:number;maxPositions:number;slippageBps:number;commissionPerOrder:number;holdingMinutes:number};

const root=fileURLToPath(new URL('../../../',import.meta.url));
const statePath=resolve(root,process.env.PAPER_STATE_PATH??'var/paper/state.json');
const eventPath=resolve(root,process.env.PAPER_EVENT_LOG_PATH??'var/paper/events.jsonl');
const config:PaperConfig={startingEquity:positive('PAPER_STARTING_EQUITY',100_000),riskPerTradePercent:bounded('PAPER_RISK_PER_TRADE_PERCENT',0.25,0.01,0.5),dailyLossLimitPercent:bounded('PAPER_DAILY_LOSS_LIMIT_PERCENT',1,0.1,2),maxPositions:Math.floor(bounded('PAPER_MAX_POSITIONS',3,1,10)),slippageBps:bounded('PAPER_SLIPPAGE_BPS',5,0,100),commissionPerOrder:bounded('PAPER_COMMISSION_PER_ORDER',1,0,100),holdingMinutes:bounded('PAPER_HOLDING_MINUTES',360,5,1440)};

async function main(){
  const toss=tossInvestConfigFromEnv();if(!toss)throw new Error('Toss Invest credentials are required');
  const finnhub=process.env.FINNHUB_API_KEY;const secAgent=process.env.SEC_USER_AGENT;if(!finnhub||!secAgent)throw new Error('FINNHUB_API_KEY and SEC_USER_AGENT are required');
  const symbols=(process.env.WATCHLIST??process.env.SHADOW_SYMBOLS??'AAPL').split(',').map(v=>v.trim().toUpperCase()).filter(v=>/^[A-Z0-9.\-]+$/.test(v));if(!symbols.length)throw new Error('WATCHLIST has no valid symbols');
  const {liveConfirmation:ignoredLiveConfirmation,...safeToss}=toss;void ignoredLiveConfirmation;
  const priceClient=new TossInvestClient({...safeToss,mode:'read_only'});
  const news=new CombinedNewsProvider([new FinnhubNewsProvider(finnhub),new SecEdgarNewsProvider(secAgent)]);
  const pollMs=Math.max(15,positive('PAPER_POLL_SECONDS',30))*1000;const newsMs=Math.max(60,positive('PAPER_NEWS_POLL_SECONDS',300))*1000;const durationMs=Math.max(1,positive('PAPER_DURATION_DAYS',21))*86_400_000;
  await mkdir(dirname(statePath),{recursive:true});await mkdir(dirname(eventPath),{recursive:true});let state=await loadState();let nextNewsAt=0;let stopped=false;process.on('SIGINT',()=>{stopped=true});process.on('SIGTERM',()=>{stopped=true});
  await log({event:'paper_started',symbols,orders:false,brokerMode:'read_only',openai:false,durationDays:durationMs/86_400_000});const endAt=Date.now()+durationMs;
  while(!stopped&&Date.now()<endAt){try{
    rollDay(state);const prices=await priceClient.prices(symbols);const bySymbol=new Map(prices.map(p=>[p.symbol.toUpperCase(),p]));await processExits(state,bySymbol);
    if(Date.now()>=nextNewsAt){await processNews(state,symbols,news,bySymbol);nextNewsAt=Date.now()+newsMs;}
    await saveState(state);
  }catch(error){await log({event:'paper_error',message:error instanceof Error?error.message:'unknown_error'});}if(process.env.PAPER_ONCE==='true')break;await new Promise(r=>setTimeout(r,pollMs));}
  await log({event:'paper_stopped',equity:round(state.equity),realizedPnl:round(state.realizedPnl),positions:state.positions.length,trades:state.closedTrades.length});
}

async function processNews(state:PaperState,symbols:string[],provider:CombinedNewsProvider,prices:Map<string,TossPrice>){
  for(const symbol of symbols){let rows:NewsDocument[];try{rows=await provider.recent(symbol,new Date(Date.now()-24*60*60*1000));}catch(error){await log({event:'news_fetch_failed',symbol,message:error instanceof Error?error.message:'unknown_error'});continue;}
    for(const item of rows.slice(0,20).reverse()){const id=item.id??`${item.quality.source}:${item.quality.sourceUrl}`;if(state.seenNewsIds.includes(id))continue;state.seenNewsIds.push(id);const assessment=assessNews(item);await log({event:'news_assessed',symbol,id,title:item.title,source:item.quality.source,verified:item.quality.verified,assessment});
      const tick=prices.get(symbol);if(assessment.paperTradeEligible&&tick)await tryOpen(state,item,id,Number(tick.lastPrice));
    }
  }
  state.seenNewsIds=state.seenNewsIds.slice(-10_000);
}

async function tryOpen(state:PaperState,item:NewsDocument,newsId:string,marketPrice:number){
  const symbol=item.symbol??'';if(!symbol||!Number.isFinite(marketPrice)||marketPrice<=0||state.positions.some(p=>p.symbol===symbol)||state.positions.length>=config.maxPositions)return;
  if(state.dailyPnl<=-(state.equity-state.dailyPnl)*config.dailyLossLimitPercent/100){await log({event:'entry_blocked',symbol,reason:'daily_loss_limit'});return;}
  const entry=marketPrice*(1+config.slippageBps/10_000);const stop=entry*0.98;const riskBudget=state.equity*config.riskPerTradePercent/100;const quantity=Math.floor(riskBudget/(entry-stop));if(quantity<1){await log({event:'entry_blocked',symbol,reason:'insufficient_risk_budget'});return;}
  const now=new Date();const position:Position={symbol,newsId,sourceUrl:item.quality.sourceUrl,openedAt:now.toISOString(),entryPrice:round(entry),quantity,stopPrice:round(stop),targetPrice:round(entry*1.03),expiresAt:new Date(now.getTime()+config.holdingMinutes*60_000).toISOString(),entryCommission:config.commissionPerOrder};state.positions.push(position);state.equity-=config.commissionPerOrder;state.realizedPnl-=config.commissionPerOrder;state.dailyPnl-=config.commissionPerOrder;await log({event:'paper_entry',...position,orders:false});
}

async function processExits(state:PaperState,prices:Map<string,TossPrice>){for(const p of [...state.positions]){const tick=prices.get(p.symbol);const market=tick?Number(tick.lastPrice):NaN;if(!Number.isFinite(market)||market<=0)continue;const reason=market<=p.stopPrice?'stop':market>=p.targetPrice?'target':Date.now()>=Date.parse(p.expiresAt)?'time':null;if(!reason)continue;const exit=market*(1-config.slippageBps/10_000);const pnl=(exit-p.entryPrice)*p.quantity-config.commissionPerOrder;const closed:ClosedTrade={...p,closedAt:new Date().toISOString(),exitPrice:round(exit),exitReason:reason,exitCommission:config.commissionPerOrder,pnl:round(pnl)};state.positions=state.positions.filter(v=>v!==p);state.closedTrades.push(closed);state.equity+=pnl;state.realizedPnl+=pnl;state.dailyPnl+=pnl;await log({event:'paper_exit',...closed,orders:false});}}

async function loadState():Promise<PaperState>{try{const value=JSON.parse(await readFile(statePath,'utf8')) as PaperState;if(value.version===1)return value;}catch{}return{version:1,equity:config.startingEquity,realizedPnl:0,day:dayKey(),dailyPnl:0,seenNewsIds:[],positions:[],closedTrades:[]};}
async function saveState(state:PaperState){const temp=`${statePath}.tmp`;await writeFile(temp,JSON.stringify(state,null,2));await rename(temp,statePath);}
async function log(value:Record<string,unknown>){const row={recordedAt:new Date().toISOString(),mode:'paper',orderSubmissionEnabled:false,...value};await appendFile(eventPath,`${JSON.stringify(row)}\n`);if(value.event==='paper_started'||value.event==='paper_stopped'||value.event==='paper_entry'||value.event==='paper_exit')console.log(JSON.stringify(row));}
function rollDay(state:PaperState){const today=dayKey();if(state.day!==today){state.day=today;state.dailyPnl=0;}}
function dayKey(){return new Date().toISOString().slice(0,10);}
function positive(name:string,fallback:number){const n=Number(process.env[name]??fallback);return Number.isFinite(n)&&n>0?n:fallback;}
function bounded(name:string,fallback:number,min:number,max:number){return Math.min(max,Math.max(min,positive(name,fallback)));}
function round(n:number){return Math.round(n*100)/100;}

if(process.env.NODE_ENV!=='test')await main();
