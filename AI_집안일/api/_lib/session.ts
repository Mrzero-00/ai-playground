import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COOKIE_NAME = 'ai_housework_session';
const MAX_AGE = 60 * 60 * 24 * 365;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function userIdFromTossKey(key: string): string {
  const hex = createHmac('sha256', sessionSecret()).update(`toss:${key}`).digest('hex');
  const versioned = `${hex.slice(0, 12)}4${hex.slice(13, 16)}a${hex.slice(17, 32)}`;
  return `${versioned.slice(0, 8)}-${versioned.slice(8, 12)}-${versioned.slice(12, 16)}-${versioned.slice(16, 20)}-${versioned.slice(20, 32)}`;
}

function parseCookies(header?: string): Record<string, string> {
  return Object.fromEntries((header ?? '').split(';').map((part) => part.trim()).filter((part) => part.includes('=')).map((part) => {
    const separator = part.indexOf('=');
    return [decodeURIComponent(part.slice(0, separator)), decodeURIComponent(part.slice(separator + 1))];
  }));
}

function verify(cookieValue?: string): string | null {
  if (!cookieValue) return null;
  const [userId, signature] = cookieValue.split('.');
  if (!userId || !signature) return null;
  const expected = Buffer.from(sign(userId));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return /^[0-9a-f-]{36}$/i.test(userId) ? userId : null;
}

export function getOrCreateAnonymousUserId(req: VercelRequest, res: VercelResponse): string {
  const tossUserKey = req.headers['x-jiptori-user-key'];
  if (tossUserKey !== undefined) {
    if (typeof tossUserKey !== 'string' || !/^[A-Za-z0-9_-]{20,512}$/.test(tossUserKey)) {
      const error = new Error('INVALID_TOSS_KEY');
      error.name = 'INVALID_TOSS_KEY';
      throw error;
    }
    return userIdFromTossKey(tossUserKey);
  }
  const existing = verify(parseCookies(req.headers.cookie)[COOKIE_NAME]);
  if (existing) return existing;
  const userId = randomUUID();
  const secure = process.env.VERCEL === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${userId}.${sign(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`);
  return userId;
}

export function clearAnonymousSession(res: VercelResponse): void {
  const secure = process.env.VERCEL === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}
