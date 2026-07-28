import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, publicError } from './_lib/http.js';
import { clearAnonymousSession, getOrCreateAnonymousUserId } from './_lib/session.js';
import { getSupabaseAdmin } from './_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    const { error } = await getSupabaseAdmin().rpc('delete_user_account', { p_user_id: userId });
    if (error) throw error;
    clearAnonymousSession(res);
    return res.status(200).json({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.name === 'INVALID_TOSS_KEY') {
      return res.status(401).json({ error: '사용자 정보를 확인하지 못했어요.', code: error.name });
    }
    return publicError(res, error, '데이터를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}
