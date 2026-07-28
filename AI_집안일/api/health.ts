import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, publicError } from './_lib/http.js';
import { getSupabaseAdmin } from './_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { error } = await getSupabaseAdmin().from('app_users').select('id').limit(1);
    if (error) throw error;
    return res.status(200).json({
      ok: true,
      service: 'jiptori-api',
      database: 'reachable',
    });
  } catch (error) {
    return publicError(res, error, '운영 데이터베이스 연결을 확인해 주세요.', 503);
  }
}
