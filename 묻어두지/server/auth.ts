import { createPublicKey, verify, type JsonWebKeyInput } from 'node:crypto';

import type { AuthProvider } from '../src/shared/capsule-api';

/** Who a provider says the caller is. `name` is a hint for a first login only. */
export type VerifiedIdentity = { provider: AuthProvider; subject: string; name: string | null; avatarUrl: string | null };

type Jwk = Record<string, unknown> & { kid?: unknown };

export type AuthConfig = { googleClientIds: string[]; appleClientIds: string[]; kakao: boolean; dev: boolean };

export class AuthError extends Error {
  /** `network` = the provider could not be reached (502), otherwise the credential was rejected (401). */
  constructor(readonly kind: 'rejected' | 'network', message: string) {
    super(message);
  }
}

export const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
export const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
export const APPLE_ISSUER = 'https://appleid.apple.com';
export const KAKAO_ME_URL = 'https://kapi.kakao.com/v2/user/me';
const PROVIDER_TIMEOUT_MS = 8_000;
const JWKS_TTL_MS = 60 * 60 * 1000;

const rejected = (message = '로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요.') => new AuthError('rejected', message);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

export function parseList(value: string | undefined): string[] {
  return (value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function authConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return {
    googleClientIds: parseList(env.GOOGLE_CLIENT_IDS),
    appleClientIds: parseList(env.APPLE_CLIENT_IDS),
    kakao: env.KAKAO_ENABLED === '1',
    dev: env.DEV_LOGIN === '1',
  };
}

export function enabledProviders(config: AuthConfig): AuthProvider[] {
  const providers: AuthProvider[] = [];
  if (config.googleClientIds.length) providers.push('google');
  if (config.appleClientIds.length) providers.push('apple');
  if (config.kakao) providers.push('kakao');
  if (config.dev) providers.push('dev');
  return providers;
}

/** Talks to Google / Apple / Kakao. `fetchImpl` is injectable so tests never leave the machine. */
export function createVerifier(config: AuthConfig, fetchImpl: typeof fetch, now: () => number) {
  let appleKeys: { keys: Jwk[]; fetchedAt: number } | null = null;

  async function getJson(url: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
    } catch {
      throw new AuthError('network', '로그인 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }

  async function google(idToken: string): Promise<VerifiedIdentity> {
    const { status, body } = await getJson(`${GOOGLE_TOKENINFO_URL}?${new URLSearchParams({ id_token: idToken })}`);
    if (status !== 200 || !isRecord(body)) throw rejected('구글 로그인을 확인하지 못했어요. 다시 로그인해 주세요.');
    const subject = text(body.sub);
    if (typeof body.aud !== 'string' || !config.googleClientIds.includes(body.aud) || !subject) {
      throw rejected('이 앱용 구글 로그인이 아니에요. 다시 로그인해 주세요.');
    }
    return { provider: 'google', subject, name: text(body.name), avatarUrl: text(body.picture) };
  }

  async function appleKey(kid: string): Promise<Jwk | undefined> {
    const find = () => appleKeys?.keys.find((key) => key.kid === kid);
    if (appleKeys && now() - appleKeys.fetchedAt < JWKS_TTL_MS && find()) return find();
    const { status, body } = await getJson(APPLE_JWKS_URL);
    if (status !== 200 || !isRecord(body) || !Array.isArray(body.keys)) {
      throw new AuthError('network', '애플 로그인 서버에서 키를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    }
    appleKeys = { keys: body.keys.filter(isRecord) as Jwk[], fetchedAt: now() };
    return find();
  }

  async function apple(idToken: string): Promise<VerifiedIdentity> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw rejected('애플 로그인 토큰을 읽을 수 없어요.');
    const [headerPart, payloadPart, signaturePart] = parts;
    let header: unknown;
    let payload: unknown;
    try {
      header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    } catch {
      throw rejected('애플 로그인 토큰을 읽을 수 없어요.');
    }
    if (!isRecord(header) || !isRecord(payload) || header.alg !== 'RS256' || typeof header.kid !== 'string') {
      throw rejected('애플 로그인 토큰 형식이 올바르지 않아요.');
    }
    const jwk = await appleKey(header.kid);
    if (!jwk) throw rejected('애플 로그인 토큰의 서명 키를 찾지 못했어요.');
    let valid = false;
    try {
      const key = createPublicKey({ key: jwk as JsonWebKeyInput['key'], format: 'jwk' });
      valid = verify('RSA-SHA256', Buffer.from(`${headerPart}.${payloadPart}`), key, Buffer.from(signaturePart, 'base64url'));
    } catch {
      valid = false;
    }
    if (!valid) throw rejected('애플 로그인 서명이 올바르지 않아요.');
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.iss !== APPLE_ISSUER || !audiences.some((aud) => typeof aud === 'string' && config.appleClientIds.includes(aud))) {
      throw rejected('이 앱용 애플 로그인이 아니에요. 다시 로그인해 주세요.');
    }
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now()) throw rejected('애플 로그인이 만료됐어요. 다시 로그인해 주세요.');
    const subject = text(payload.sub);
    if (!subject) throw rejected('애플 로그인 토큰에 사용자 정보가 없어요.');
    return { provider: 'apple', subject, name: null, avatarUrl: null };
  }

  async function kakao(accessToken: string): Promise<VerifiedIdentity> {
    const { status, body } = await getJson(KAKAO_ME_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (status !== 200 || !isRecord(body)) throw rejected('카카오 로그인을 확인하지 못했어요. 다시 로그인해 주세요.');
    const id = body.id;
    if (!(typeof id === 'number' && Number.isSafeInteger(id)) && !text(id)) throw rejected('카카오 사용자 정보를 읽지 못했어요.');
    const account = isRecord(body.kakao_account) ? body.kakao_account : {};
    const profile = isRecord(account.profile) ? account.profile : {};
    return { provider: 'kakao', subject: String(id).trim(), name: text(profile.nickname), avatarUrl: text(profile.profile_image_url) };
  }

  return { google, apple, kakao };
}
