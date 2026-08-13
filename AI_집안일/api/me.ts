import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, publicError } from './_lib/http.js';
import { getOrCreateAnonymousUserId } from './_lib/session.js';
import { getMe, normalizeUserHomeError, parseUpdateMeInput, updateMe } from './_lib/userHome.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    const data = req.method === 'PATCH'
      ? await updateMe(userId, parseUpdateMeInput(req.body))
      : await getMe(userId);
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'INVALID_TOSS_KEY') {
      return res.status(401).json({ error: '사용자 정보를 확인하지 못했어요.', code: error.name });
    }
    const known = normalizeUserHomeError(error);
    if (known) return res.status(known.status).json({ error: known.message, code: known.code });
    return publicError(res, error, req.method === 'PATCH' ? '사용자 정보를 변경하지 못했어요.' : '사용자 정보를 불러오지 못했어요.');
  }
}
