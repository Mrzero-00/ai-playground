import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, publicError } from '../../../../_lib/http.js';
import { getOrCreateAnonymousUserId } from '../../../../_lib/session.js';
import { completeChore, normalizeUserHomeError, parseCompleteChoreInput, routeParam } from '../../../../_lib/userHome.js';

export function completeChoreHttpStatus(result: { alreadyCompleted: boolean; idempotentReplay: boolean }): 200 | 201 {
  return result.alreadyCompleted || result.idempotentReplay ? 200 : 201;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    const homeId = routeParam(req.query.homeId, '집 ID');
    const choreId = routeParam(req.query.choreId, '집안일 ID');
    const result = await completeChore(userId, homeId, choreId, parseCompleteChoreInput(req.body));
    return res.status(completeChoreHttpStatus(result)).json(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'INVALID_TOSS_KEY') {
      return res.status(401).json({ error: '사용자 정보를 확인하지 못했어요.', code: error.name });
    }
    const known = normalizeUserHomeError(error);
    if (known) return res.status(known.status).json({ error: known.message, code: known.code });
    return publicError(res, error, '집안일을 완료하지 못했어요.');
  }
}
