import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOrCreateAnonymousUserId } from './_lib/session';
import { loadState } from './_lib/state';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    const state = await loadState(userId);
    return res.status(200).json({ user: state.user });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Session initialization failed.' });
  }
}
