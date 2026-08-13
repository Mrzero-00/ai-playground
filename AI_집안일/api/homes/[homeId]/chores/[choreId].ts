import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, publicError } from '../../../_lib/http.js';
import { getOrCreateAnonymousUserId } from '../../../_lib/session.js';
import { assignChore, normalizeUserHomeError, parseAssignChoreInput, routeParam } from '../../../_lib/userHome.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    const homeId = routeParam(req.query.homeId, '집 ID');
    const choreId = routeParam(req.query.choreId, '집안일 ID');
    return res.status(200).json(await assignChore(userId, homeId, choreId, parseAssignChoreInput(req.body)));
  } catch (error) {
    if (error instanceof Error && error.name === 'INVALID_TOSS_KEY') {
      return res.status(401).json({ error: '사용자 정보를 확인하지 못했어요.', code: error.name });
    }
    const known = normalizeUserHomeError(error);
    if (known) return res.status(known.status).json({ error: known.message, code: known.code });
    return publicError(res, error, '집안일 담당자를 변경하지 못했어요.');
  }
}
