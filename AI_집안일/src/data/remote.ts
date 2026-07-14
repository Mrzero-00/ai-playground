import type { AppData } from '../domain/types';

async function requestState(path: string, init?: RequestInit): Promise<AppData> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => ({})) as AppData | { error?: string };
  if (!response.ok) {
    throw new Error('error' in payload && payload.error ? payload.error : '서버 데이터를 불러오지 못했어요.');
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
