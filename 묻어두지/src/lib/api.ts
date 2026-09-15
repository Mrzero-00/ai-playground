import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type {
  ApiErrorBody, CapsuleCreateResponse, CapsuleListResponse, CapsuleOpenResponse,
  CreateCapsuleInput, Eligibility, LocationFix,
} from '../shared/contracts';

function getBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8787`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost')}:8787`;
}

export const API_URL = getBaseUrl();
const TOKEN_KEY = 'mudeoduji.device-session.v1';
let tokenPromise: Promise<string> | null = null;

export class ApiError extends Error {
  constructor(public code: string, message: string, public eligibility?: Eligibility, public status?: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    const body = await response.json();
    if (!response.ok) {
      const error = body as ApiErrorBody;
      throw new ApiError(error.error?.code || 'UNKNOWN', error.error?.message || '요청을 처리하지 못했어요.', error.eligibility, response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('NETWORK', '개발 서버에 연결하지 못했어요. Mac과 같은 Wi-Fi인지, 서버가 켜져 있는지 확인해 주세요.');
  } finally {
    clearTimeout(timer);
  }
}

async function sessionToken(): Promise<string> {
  if (!tokenPromise) {
    tokenPromise = (async () => {
      const stored = Platform.OS === 'web'
        ? window.localStorage.getItem(TOKEN_KEY)
        : await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) return stored;
      const { token } = await request<{ token: string }>('/sessions', { method: 'POST', body: '{}' });
      if (Platform.OS === 'web') window.localStorage.setItem(TOKEN_KEY, token);
      else await SecureStore.setItemAsync(TOKEN_KEY, token);
      return token;
    })().catch(error => { tokenPromise = null; throw error; });
  }
  return tokenPromise;
}

async function authenticated<T>(path: string, body?: unknown, headers: Record<string, string> = {}, retry = true): Promise<T> {
  const token = await sessionToken();
  try {
    return await request<T>(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, ((path === '/capsules' && body !== undefined) || path.endsWith('/open')) ? 120_000 : 20_000);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.status !== 401 || !retry) throw cause;
    // The developer may have reset the local database. Re-register only after
    // an explicit authentication rejection; never reset on a network error.
    if (Platform.OS === 'web') window.localStorage.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
    tokenPromise = null;
    return authenticated<T>(path, body, headers, false);
  }
}

export const api = {
  health: () => request<{ ok: boolean; serverNow: string }>('/health'),
  list: () => authenticated<CapsuleListResponse>('/capsules'),
  create: (input: CreateCapsuleInput, requestKey: string) => authenticated<CapsuleCreateResponse>('/capsules', input, { 'Idempotency-Key': requestKey }),
  recover: (requestKey: string) => authenticated<CapsuleCreateResponse>(`/capsules/by-request/${encodeURIComponent(requestKey)}`),
  eligibility: (id: string, location: LocationFix) => authenticated<Eligibility>(`/capsules/${encodeURIComponent(id)}/eligibility`, { location }),
  open: (id: string, location: LocationFix) => authenticated<CapsuleOpenResponse>(`/capsules/${encodeURIComponent(id)}/open`, { location }),
};
