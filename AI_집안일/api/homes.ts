import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, publicError } from './_lib/http.js';
import { getOrCreateAnonymousUserId } from './_lib/session.js';
import { createHome, listHomes, normalizeUserHomeError, parseCreateHomeInput } from './_lib/userHome.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    if (req.method === 'GET') return res.status(200).json({ homes: await listHomes(userId) });
    return res.status(201).json(await createHome(userId, parseCreateHomeInput(req.body)));
  } catch (error) {
    if (error instanceof Error && error.name === 'INVALID_TOSS_KEY') {
      return res.status(401).json({ error: '사용자 정보를 확인하지 못했어요.', code: error.name });
    }
    const known = normalizeUserHomeError(error);
    if (known) return res.status(known.status).json({ error: known.message, code: known.code });
    return publicError(res, error, req.method === 'POST' ? '집을 만들지 못했어요.' : '집 목록을 불러오지 못했어요.');
  }
}
