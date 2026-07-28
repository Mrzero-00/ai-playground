import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, publicError } from './_lib/http.js';
import { getOrCreateAnonymousUserId } from './_lib/session.js';
import { loadState } from './_lib/state.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    const state = await loadState(userId);
    return res.status(200).json({ user: state.user });
  } catch (error) {
    if (error instanceof Error && error.name === 'INVALID_TOSS_KEY') return res.status(401).json({ error: '사용자 정보를 확인하지 못했어요.', code: error.name });
    return publicError(res, error, '사용자 정보를 불러오지 못했어요.');
  }
}
