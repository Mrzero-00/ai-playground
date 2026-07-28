import type { VercelRequest, VercelResponse } from '@vercel/node';
import { profileShareDataFromUrl, profileShareOrigin, renderProfileShareHtml } from './_lib/profileShare.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const origin = profileShareOrigin(req.headers);
  const requestUrl = new URL(req.url ?? '/share/profile', origin);
  const data = profileShareDataFromUrl(requestUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  return res.status(200).send(renderProfileShareHtml(data, origin));
}
