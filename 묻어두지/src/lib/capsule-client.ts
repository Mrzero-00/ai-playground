import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { Capsule, PlantedLocation } from '@/domain/capsule';
import { profile } from '@/lib/profile';
import type {
  AddItemInput,
  ApiErrorBody,
  CapsuleListResponse,
  CapsuleResponse,
  CreateCapsuleInput,
  ItemResponse,
  JoinResponse,
  SessionResponse,
  UpdateItemInput,
} from '@/shared/capsule-api';
import { BackendError } from '@/state/backend';

/**
 * 서버 주소. EXPO_PUBLIC_API_URL 이 있으면 그걸 쓴다.
 * 없으면 로컬 개발(localhost 웹, Expo 개발 서버)에서만 :8787 을 추정하고, 배포된 웹에서는 null → 로컬 백엔드로 돈다.
 */
export function resolveApiUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' ? `${window.location.protocol}//${host}:8787` : null;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host) return null;
  return `http://${host}:8787`;
}

export const API_URL = resolveApiUrl();
const TOKEN_KEY = 'mudeodooji.session.v2';
let tokenPromise: Promise<string> | null = null;

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  if (!API_URL) throw new BackendError('NETWORK', '서버 주소가 없어요.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...init.headers } });
    const body = (await response.json()) as T | ApiErrorBody;
    if (!response.ok) {
      const error = body as ApiErrorBody;
      throw new BackendError(error.error?.code ?? 'INTERNAL_ERROR', error.error?.message ?? '요청을 처리하지 못했어요.', response.status);
    }
    return body as T;
  } catch (cause) {
    if (cause instanceof BackendError) throw cause;
    throw new BackendError('NETWORK', '서버에 연결하지 못했어요. 인터넷과 서버 상태를 확인해 주세요.');
  } finally {
    clearTimeout(timer);
  }
}

async function sessionToken(): Promise<string> {
  if (!tokenPromise) {
    tokenPromise = (async () => {
      const stored = await profile.storage.read(TOKEN_KEY);
      if (stored) return stored;
      const displayName = await profile.displayName();
      const { token } = await request<SessionResponse>('/sessions', { method: 'POST', body: JSON.stringify({ displayName }) });
      await profile.storage.write(TOKEN_KEY, token);
      return token;
    })().catch((error) => {
      tokenPromise = null;
      throw error;
    });
  }
  return tokenPromise;
}

async function authenticated<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, retry = true): Promise<T> {
  const token = await sessionToken();
  try {
    return await request<T>(path, { method, headers: { Authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, body === undefined ? 20_000 : 120_000);
  } catch (cause) {
    if (!(cause instanceof BackendError) || cause.status !== 401 || !retry) throw cause;
    // 서버 DB 가 초기화됐을 때만(명시적 401) 세션을 다시 만든다. 네트워크 오류에는 절대 초기화하지 않는다.
    await profile.storage.write(TOKEN_KEY, null);
    tokenPromise = null;
    return authenticated<T>(method, path, body, false);
  }
}

/** 서버가 주는 상대 경로 media uri 를 절대 주소로 바꾼다. */
export function absolutize(capsule: Capsule): Capsule {
  if (!API_URL) return capsule;
  return { ...capsule, members: capsule.members.map((member) => ({ ...member, items: member.items.map((item) => (item.uri?.startsWith('/') ? { ...item, uri: `${API_URL}${item.uri}` } : item)) })) };
}

const path = (id: string, suffix = '') => `/capsules/${encodeURIComponent(id)}${suffix}`;

export const capsuleClient = {
  health: () => request<{ ok: boolean; serverNow: string }>('/health'),
  list: () => authenticated<CapsuleListResponse>('GET', '/capsules'),
  get: (id: string) => authenticated<CapsuleResponse>('GET', path(id)),
  create: (input: CreateCapsuleInput) => authenticated<CapsuleResponse>('POST', '/capsules', input),
  join: (code: string) => authenticated<JoinResponse>('POST', '/capsules/join', { code }),
  addItem: (id: string, input: AddItemInput) => authenticated<ItemResponse>('POST', path(id, '/items'), input),
  updateItem: (id: string, itemId: string, input: UpdateItemInput) => authenticated<ItemResponse>('PATCH', path(id, `/items/${encodeURIComponent(itemId)}`), input),
  removeItem: (id: string, itemId: string) => authenticated<ItemResponse>('DELETE', path(id, `/items/${encodeURIComponent(itemId)}`)),
  seal: (id: string) => authenticated<CapsuleResponse>('POST', path(id, '/seal'), {}),
  open: (id: string) => authenticated<CapsuleResponse>('POST', path(id, '/open'), {}),
  plant: (id: string, location: PlantedLocation) => authenticated<CapsuleResponse>('POST', path(id, '/plant'), { location }),
  setDisplayName: (displayName: string) => authenticated<{ displayName: string }>('PATCH', '/sessions/me', { displayName }),
};
