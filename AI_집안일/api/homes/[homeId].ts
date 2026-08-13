import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, publicError } from '../_lib/http.js';
import { getOrCreateAnonymousUserId } from '../_lib/session.js';
import { getHome, normalizeUserHomeError, parseUpdateHomeInput, routeParam, updateHome } from '../_lib/userHome.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    const homeId = routeParam(req.query.homeId, '집 ID');
    const data = req.method === 'PATCH'
      ? await updateHome(userId, homeId, parseUpdateHomeInput(req.body))
      : await getHome(userId, homeId);
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'INVALID_TOSS_KEY') {
      return res.status(401).json({ error: '사용자 정보를 확인하지 못했어요.', code: error.name });
    }
    const known = normalizeUserHomeError(error);
    if (known) return res.status(known.status).json({ error: known.message, code: known.code });
    return publicError(res, error, req.method === 'PATCH' ? '집 정보를 변경하지 못했어요.' : '집 정보를 불러오지 못했어요.');
  }
}
