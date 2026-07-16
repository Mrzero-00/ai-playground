import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TossInvestClient, tossInvestConfigFromEnv, type TossPrice } from '@trading/broker';

export type ShadowSnapshot = { recordedAt:string; latencyMs:number; prices:TossPrice[]; staleSymbols:string[]; mode:'shadow'; orderSubmissionEnabled:false };

export async function collectShadowSnapshot(client:TossInvestClient,symbols:string[],now=()=>new Date()):Promise<ShadowSnapshot> {
  const started=Date.now(); const prices=await client.prices(symbols); const current=now();
  return {recordedAt:current.toISOString(),latencyMs:Date.now()-started,prices,staleSymbols:prices.filter(p=>current.getTime()-Date.parse(p.timestamp)>120_000).map(p=>p.symbol),mode:'shadow',orderSubmissionEnabled:false};
}

async function main() {
  const config=tossInvestConfigFromEnv(); if(!config)throw new Error('TOSS_INVEST_CLIENT_ID and TOSS_INVEST_CLIENT_SECRET are required');
  const client=new TossInvestClient({...config,mode:'read_only'});
  const symbols=(process.env.SHADOW_SYMBOLS??'AAPL').split(',').map(v=>v.trim()).filter(v=>/^[A-Za-z0-9.\-]+$/.test(v));
  if(symbols.length===0)throw new Error('SHADOW_SYMBOLS has no valid symbol');
  const interval=Math.max(5,Number(process.env.SHADOW_POLL_SECONDS??30))*1000;
  const duration=Math.max(1,Number(process.env.SHADOW_DURATION_DAYS??21))*86_400_000;
  const projectRoot=fileURLToPath(new URL('../../../',import.meta.url));
  const logPath=resolve(projectRoot,process.env.SHADOW_LOG_PATH??'var/shadow/snapshots.jsonl');
  await mkdir(dirname(logPath),{recursive:true});
  const accounts=await client.accounts();
  console.log(JSON.stringify({event:'shadow_started',symbols,durationDays:duration/86_400_000,accountSeqs:accounts.map(a=>a.accountSeq),mode:'read_only',orders:false}));
  let stopped=false; const stop=()=>{stopped=true}; process.on('SIGINT',stop); process.on('SIGTERM',stop); const endAt=Date.now()+duration;
  while(!stopped&&Date.now()<endAt) {
    try { const snapshot=await collectShadowSnapshot(client,symbols); await appendFile(logPath,`${JSON.stringify(snapshot)}\n`); if(snapshot.staleSymbols.length)console.error(JSON.stringify({event:'stale_market_data',symbols:snapshot.staleSymbols})); }
    catch(error) { const event={recordedAt:new Date().toISOString(),mode:'shadow',orderSubmissionEnabled:false,error:error instanceof Error?error.message:'unknown_error'}; await appendFile(logPath,`${JSON.stringify(event)}\n`); console.error(JSON.stringify(event)); }
    if(process.env.SHADOW_ONCE==='true')break; await new Promise(resolveTimeout=>setTimeout(resolveTimeout,interval));
  }
  console.log(JSON.stringify({event:'shadow_stopped'}));
}

if(process.env.NODE_ENV!=='test')await main();
