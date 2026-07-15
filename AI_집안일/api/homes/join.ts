import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOrCreateAnonymousUserId } from '../_lib/session.js';
import { joinHome } from '../_lib/state.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    const inviteCode = typeof req.body?.inviteCode === 'string' ? req.body.inviteCode : '';
    if (!inviteCode) return res.status(400).json({ error: '초대 코드를 입력해 주세요.' });
    return res.status(200).json(await joinHome(userId, inviteCode));
  } catch (error) {
    const message = error instanceof Error ? error.message : '집 참여에 실패했어요.';
    return res.status(message.includes('찾을 수 없어요') ? 404 : 500).json({ error: message });
  }
}
