import type { VercelRequest, VercelResponse } from '@vercel/node';

function allowedOrigins(): Set<string> {
  const configured = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (process.env.VERCEL_URL) configured.push(`https://${process.env.VERCEL_URL}`);
  return new Set(configured);
}

export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.replace(/\/+$/, '') : '';
  if (origin) {
    if (!allowedOrigins().has(origin)) {
      res.status(403).json({ error: '허용되지 않은 앱에서 보낸 요청이에요.', code: 'ORIGIN_NOT_ALLOWED' });
      return false;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Jiptori-User-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }
  return true;
}

export function publicError(res: VercelResponse, error: unknown, fallback: string, status = 500) {
  console.error(error);
  return res.status(status).json({ error: fallback, code: 'SERVER_ERROR' });
}
