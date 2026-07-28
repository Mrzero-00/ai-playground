import type { AppData } from '../domain/types';
import { getTossAnonymousKey } from './tossIdentity';

const DEFAULT_PRODUCTION_API_URL = 'https://jiptori.vercel.app';

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  return import.meta.env.PROD ? DEFAULT_PRODUCTION_API_URL : '';
}

async function requestState(path: string, init?: RequestInit): Promise<AppData> {
  const configuredBaseUrl = apiBaseUrl();
  if (import.meta.env.DEV && !configuredBaseUrl) {
    throw new Error('로컬 모드로 사용 중이에요. 공유 동기화가 필요하면 VITE_API_BASE_URL을 설정해 주세요.');
  }
  const tossUserKey = await getTossAnonymousKey();
  const response = await fetch(`${configuredBaseUrl ?? ''}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(tossUserKey ? { 'X-Jiptori-User-Key': tossUserKey } : {}),
      ...init?.headers,
    },
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('동기화 서버 응답 형식이 올바르지 않아요.');
  }
  const payload = await response.json().catch(() => ({})) as AppData | { error?: string; code?: string };
  if (!response.ok) {
    const error = new Error('error' in payload && payload.error ? payload.error : '서버 데이터를 불러오지 못했어요.');
    if ('code' in payload && payload.code) error.name = payload.code;
    throw error;
  }
  return payload as AppData;
}

export function loadRemoteState(): Promise<AppData> {
  return requestState('/api/state');
}

export function saveRemoteState(data: AppData): Promise<AppData> {
  return requestState('/api/state', { method: 'PUT', body: JSON.stringify(data) });
}

export function joinRemoteHome(inviteCode: string): Promise<AppData> {
  return requestState('/api/homes/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
  });
}

export async function deleteRemoteAccount(): Promise<void> {
  const configuredBaseUrl = apiBaseUrl();
  if (import.meta.env.DEV && !configuredBaseUrl) {
    throw new Error('서버에 연결된 상태에서만 전체 데이터를 삭제할 수 있어요.');
  }
  const tossUserKey = await getTossAnonymousKey();
  const response = await fetch(`${configuredBaseUrl ?? ''}/api/account`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(tossUserKey ? { 'X-Jiptori-User-Key': tossUserKey } : {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? '데이터를 삭제하지 못했어요.');
}
