import Fastify from 'fastify';
import { TossInvestClient, tossInvestConfigFromEnv } from '@trading/broker';
import { InMemoryTradingRepository, type TradingRepository } from '@trading/db';

export function buildApi(repository:TradingRepository=new InMemoryTradingRepository(),broker?:TossInvestClient) {
  const app=Fastify({logger:true});
  app.get('/health',async()=>({ok:true})); app.get('/trades',async()=>repository.listTrades());
  app.get('/broker/status',async()=>({configured:Boolean(broker),accountConfigured:broker?.hasAccount??false,mode:broker?.mode??'unconfigured',orderEnabled:broker?.mode==='live'}));
  app.get<{Querystring:{symbols?:string}}>('/broker/prices',async(request,reply)=>{if(!broker)return reply.code(503).send({error:'broker_not_configured'});const symbols=request.query.symbols?.split(',').filter(Boolean)??[];if(symbols.length===0)return reply.code(400).send({error:'symbols_required'});return broker.prices(symbols);});
  return app;
}

if(process.env.NODE_ENV!=='test') { const config=tossInvestConfigFromEnv();const broker=config?new TossInvestClient(config):undefined;const app=buildApi(new InMemoryTradingRepository(),broker);await app.listen({port:Number(process.env.PORT??4000),host:'0.0.0.0'}); }
