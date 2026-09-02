import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { PpiraDatabase } from './database.js';
import { AppError } from './errors.js';
import { PpiraService } from './service.js';
import type { RuntimeSettings } from './types.js';

const port = numberFromEnv('PORT', 4200);
const settings: RuntimeSettings = {
  flightMinSeconds: numberFromEnv('FLIGHT_MIN_SECONDS', process.env.NODE_ENV === 'production' ? 1_800 : 10),
  flightMaxSeconds: numberFromEnv('FLIGHT_MAX_SECONDS', process.env.NODE_ENV === 'production' ? 7_200 : 30),
  landingTtlSeconds: numberFromEnv('LANDING_TTL_SECONDS', 86_400),
  maxLandingSequence: numberFromEnv('MAX_LANDING_SEQUENCE', 3),
  allowSimulatedLocation: booleanFromEnv('ALLOW_SIMULATED_LOCATION', process.env.NODE_ENV !== 'production'),
  allowSimulatedPurchase: booleanFromEnv('ALLOW_SIMULATED_PURCHASE', process.env.NODE_ENV !== 'production'),
};
const databasePath = resolve(process.cwd(), process.env.DATABASE_PATH ?? '../../.data/ppira.db');
const database = new PpiraDatabase(databasePath, settings);
const service = new PpiraService(database, settings);
const allowedOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5174';

const server = createServer(async (request, response) => {
  setCors(response, request.headers.origin);
  if (request.method === 'OPTIONS') return void response.writeHead(204).end();

  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const method = request.method ?? 'GET';
    if (method === 'GET' && url.pathname === '/health') return sendJson(response, 200, { status: 'ok', service: 'ppira-api' });
    if (method === 'POST' && url.pathname === '/v1/session') {
      const body = await readJson(request);
      return sendJson(response, 201, service.createSession(String(body.userKey ?? '')));
    }
    if (method === 'GET' && url.pathname === '/v1/regions') return sendJson(response, 200, { regions: service.listRegions() });

    const userKey = requireUserKey(request);
    if (method === 'GET' && url.pathname === '/v1/wallet') return sendJson(response, 200, { wallet: service.getWallet(userKey) });
    if (method === 'POST' && url.pathname === '/v1/purchases/grant') return sendJson(response, 201, { wallet: await service.grantPurchase(userKey, await readJson(request)) });
    if (method === 'POST' && url.pathname === '/v1/flyers') return sendJson(response, 201, { flyer: service.createFlyer(userKey, await readJson(request)) });
    if (method === 'GET' && url.pathname === '/v1/me/flyers') return sendJson(response, 200, { flyers: service.listMyFlyers(userKey) });
    if (method === 'GET' && url.pathname === '/v1/found-flyers') return sendJson(response, 200, { flyers: service.listFoundFlyers(userKey) });
    if (method === 'POST' && url.pathname === '/v1/hunts') {
      const body = await readJson(request);
      return sendJson(response, 201, service.startHunt(userKey, body.regionId));
    }
    const scanMatch = url.pathname.match(/^\/v1\/hunts\/([^/]+)\/scan$/);
    if (method === 'POST' && scanMatch?.[1]) return sendJson(response, 200, service.scanHunt(userKey, scanMatch[1], await readJson(request)));
    if (method === 'POST' && url.pathname === '/v1/claims') return sendJson(response, 201, service.claimFlyer(userKey, await readJson(request)));
    const reportMatch = url.pathname.match(/^\/v1\/found-flyers\/([^/]+)\/reports$/);
    if (method === 'POST' && reportMatch?.[1]) {
      const body = await readJson(request);
      return sendJson(response, 201, service.reportFlyer(userKey, reportMatch[1], body.reason));
    }
    throw new AppError('NOT_FOUND', '요청한 기능을 찾을 수 없어요.', 404);
  } catch (error) {
    if (error instanceof AppError) return sendJson(response, error.status, { error: { code: error.code, message: error.message } });
    console.error('[api:error]', error instanceof Error ? error.message : 'Unknown error');
    return sendJson(response, 500, { error: { code: 'INTERNAL_ERROR', message: '잠시 후 다시 시도해 주세요.' } });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`[ppira-api] http://localhost:${port}`));
const shutdown = () => server.close(() => { database.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function numberFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanFromEnv(name: string, fallback: boolean): boolean {
  return process.env[name] == null ? fallback : process.env[name] === 'true';
}

function requireUserKey(request: IncomingMessage): string {
  const value = request.headers['x-user-key'];
  if (typeof value !== 'string' || !value) throw new AppError('USER_KEY_REQUIRED', '사용자 식별을 다시 시도해 주세요.', 401);
  return value;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 32_768) throw new AppError('PAYLOAD_TOO_LARGE', '요청 내용이 너무 커요.', 413);
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>; }
  catch { throw new AppError('INVALID_JSON', '요청 형식이 올바르지 않아요.'); }
}

function setCors(response: ServerResponse, origin: string | undefined): void {
  response.setHeader('Access-Control-Allow-Origin', origin === allowedOrigin ? origin : allowedOrigin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Key, X-Request-Id');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
