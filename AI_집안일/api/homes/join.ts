import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, publicError } from '../_lib/http.js';
import { getOrCreateAnonymousUserId } from '../_lib/session.js';
import { joinHome } from '../_lib/state.js';
import { InputValidationError, normalizeInviteCode } from '../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    const inviteCode = normalizeInviteCode(req.body?.inviteCode);
    return res.status(200).json(await joinHome(userId, inviteCode));
  } catch (error) {
    if (error instanceof InputValidationError) return res.status(400).json({ error: error.message, code: error.name });
    if (error instanceof Error && error.name === 'INVALID_TOSS_KEY') return res.status(401).json({ error: '사용자 정보를 확인하지 못했어요.', code: error.name });
    const message = error instanceof Error ? error.message : '집 참여에 실패했어요.';
    if (message.includes('찾을 수 없어요')) return res.status(404).json({ error: message, code: 'HOME_NOT_FOUND' });
    return publicError(res, error, '집 참여에 실패했어요.');
  }
}
