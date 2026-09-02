import type { AppLocation, FoundFlyer, MoodTag, Region, UserFlyer, Wallet } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface ApiErrorPayload { error?: { code?: string; message?: string } }

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

export class ApiClient {
  constructor(private readonly userKey: string) {}

  async createSession() {
    return request<{ userId: string; sessionType: 'ANONYMOUS' }>('/v1/session', {
      method: 'POST', body: JSON.stringify({ userKey: this.userKey }),
    });
  }

  async getRegions() {
    const result = await request<{ regions: Region[] }>('/v1/regions');
    return result.regions;
  }

  async getWallet() {
    const result = await this.authRequest<{ wallet: Wallet }>('/v1/wallet');
    return result.wallet;
  }

  async grantPurchase(orderId: string, sku: string, simulate = false) {
    const result = await this.authRequest<{ wallet: Wallet }>('/v1/purchases/grant', {
      method: 'POST', body: JSON.stringify({ orderId, sku, simulate }),
    });
    return result.wallet;
  }

  async createFlyer(body: string, moodTag: MoodTag | null, regionId: string) {
    const result = await this.authRequest<{ flyer: UserFlyer }>('/v1/flyers', {
      method: 'POST', body: JSON.stringify({ body, moodTag, regionId }),
    });
    return result.flyer;
  }

  async getMyFlyers() {
    const result = await this.authRequest<{ flyers: UserFlyer[] }>('/v1/me/flyers');
    return result.flyers;
  }

  async getFoundFlyers() {
    const result = await this.authRequest<{ flyers: FoundFlyer[] }>('/v1/found-flyers');
    return result.flyers;
  }

  async startHunt(regionId: string) {
    return this.authRequest<{ huntId: string; expiresAt: string }>('/v1/hunts', {
      method: 'POST', body: JSON.stringify({ regionId }),
    });
  }

  async scanHunt(huntId: string, location: AppLocation | null, simulate = false) {
    return this.authRequest<{
      detected: boolean; claimToken?: string; tokenExpiresAt?: string; visualSeed?: number;
      reason?: 'NO_FLYER_DETECTED' | 'LOCATION_ACCURACY_LOW';
    }>(`/v1/hunts/${huntId}/scan`, {
      method: 'POST', body: JSON.stringify(simulate ? { simulate: true } : location),
    });
  }

  async claimFlyer(huntId: string, claimToken: string, accuracy: number) {
    return this.authRequest<{ flyer: FoundFlyer }>('/v1/claims', {
      method: 'POST', body: JSON.stringify({ huntId, claimToken, accuracy }),
    });
  }

  async reportFlyer(flyerId: string, reason: string) {
    return this.authRequest<{ success: true }>(`/v1/found-flyers/${flyerId}/reports`, {
      method: 'POST', body: JSON.stringify({ reason }),
    });
  }

  private authRequest<T>(path: string, init: RequestInit = {}) {
    return request<T>(path, { ...init, headers: { ...init.headers, 'X-User-Key': this.userKey } });
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init, headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new ApiError(payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? '잠시 후 다시 시도해 주세요.', response.status);
  }
  return (await response.json()) as T;
}
