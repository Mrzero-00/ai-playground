import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppData } from '../src/domain/types.js';
import { applyCors, publicError } from './_lib/http.js';
import { LegacyStateError } from './_lib/legacyState.js';
import { getOrCreateAnonymousUserId } from './_lib/session.js';
import { loadState, saveState } from './_lib/state.js';
import { normalizeUserHomeError } from './_lib/userHome.js';
import { assertValidAppData, InputValidationError } from './_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;
  try {
    const userId = getOrCreateAnonymousUserId(req, res);
    if (req.method === 'GET') return res.status(200).json(await loadState(userId));
    if (req.method === 'PUT') {
      assertValidAppData(req.body);
      return res.status(200).json(await saveState(userId, req.body as AppData));
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'State request failed.';
    if (error instanceof InputValidationError) return res.status(400).json({ error: error.message, code: error.name });
    if (error instanceof LegacyStateError) {
      const status = error.code === 'ACCOUNT_INACTIVE'
        ? 403
        : error.code === 'CHORE_NOT_FOUND'
          ? 404
          : error.code === 'LEGACY_HISTORY_IMPORT_REQUIRED'
            ? 409
            : 400;
      return res.status(status).json({ error: error.message, code: error.code });
    }
    if (error instanceof Error && error.name === 'SYNC_CONFLICT') return res.status(409).json({ error: error.message, code: error.name });
    if (error instanceof Error && error.name === 'INVALID_TOSS_KEY') return res.status(401).json({ error: '사용자 정보를 확인하지 못했어요.', code: error.name });
    const known = normalizeUserHomeError(error);
    if (known) return res.status(known.status).json({ error: known.message, code: known.code });
    if (message.includes('not a member')) return res.status(403).json({ error: '이 집에 접근할 권한이 없어요.', code: 'HOME_FORBIDDEN' });
    return publicError(res, error, '동기화 서버에 잠시 문제가 생겼어요.');
  }
}
