import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppData } from '../src/domain/types.js';
import { getOrCreateAnonymousUserId } from './_lib/session.js';
import { loadState, saveState } from './_lib/state.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    if (req.method === 'GET') return res.status(200).json(await loadState(userId));
    if (req.method === 'PUT') return res.status(200).json(await saveState(userId, req.body as AppData));
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'State request failed.';
    return res.status(message.includes('not a member') ? 403 : 500).json({ error: message });
  }
}
