import Fastify from'fastify';import{readFile}from'node:fs/promises';import{fileURLToPath}from'node:url';import type{Phase1Run}from'@investment-os/contracts';
const latestPath=fileURLToPath(new URL('../../../var/mvp/latest.json',import.meta.url));
export function buildApi(){const app=Fastify({logger:true});app.addHook('onSend',async(_request,reply,payload)=>{reply.header('access-control-allow-origin','*');return payload;});app.get('/health',async()=>({ok:true,mode:'phase1-mock-paper'}));app.get('/mvp/latest',async(_request,reply)=>{try{return JSON.parse(await readFile(latestPath,'utf8'))as Phase1Run}catch{return reply.code(404).send({error:'run_pnpm_mvp_first'})}});return app;}
if(process.env.NODE_ENV!=='test')await buildApi().listen({port:Number(process.env.PORT??4000),host:'127.0.0.1'});
