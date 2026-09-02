import type { AppLocation, FoundLetter, MoodTag, Park, UserLetter } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface ApiErrorPayload {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export class ApiClient {
  constructor(private readonly userKey: string) {}

  async createSession() {
    return request<{ userId: string; sessionType: 'ANONYMOUS' }>('/v1/session', {
      method: 'POST',
      body: JSON.stringify({ userKey: this.userKey }),
    });
  }

  async getParks() {
    const result = await request<{ parks: Park[] }>('/v1/parks');
    return result.parks;
  }

  async createLetter(body: string, moodTag: MoodTag | null) {
    const result = await this.authRequest<{ letter: UserLetter }>('/v1/letters', {
      method: 'POST',
      body: JSON.stringify({ body, moodTag }),
    });
    return result.letter;
  }

  async getMyLetters() {
    const result = await this.authRequest<{ letters: UserLetter[] }>('/v1/me/letters');
    return result.letters;
  }

  async getFoundLetters() {
    const result = await this.authRequest<{ letters: FoundLetter[] }>('/v1/found-letters');
    return result.letters;
  }

  async startHunt(parkId: string) {
    return this.authRequest<{ huntId: string; expiresAt: string }>('/v1/hunts', {
      method: 'POST',
      body: JSON.stringify({ parkId }),
    });
  }

  async scanHunt(huntId: string, location: AppLocation | null, simulate = false) {
    return this.authRequest<{
      detected: boolean;
      claimToken?: string;
      tokenExpiresAt?: string;
      visualSeed?: number;
      reason?: 'NO_LETTER_DETECTED' | 'LOCATION_ACCURACY_LOW';
    }>(`/v1/hunts/${huntId}/scan`, {
      method: 'POST',
      body: JSON.stringify(simulate ? { simulate: true } : location),
    });
  }

  async claimLetter(huntId: string, claimToken: string, accuracy: number) {
    return this.authRequest<{ letter: FoundLetter }>('/v1/claims', {
      method: 'POST',
      body: JSON.stringify({ huntId, claimToken, accuracy }),
    });
  }

  async reportLetter(letterId: string, reason: string) {
    return this.authRequest<{ success: true }>(`/v1/found-letters/${letterId}/reports`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  private authRequest<T>(path: string, init: RequestInit = {}) {
    return request<T>(path, {
      ...init,
      headers: {
        ...init.headers,
        'X-User-Key': this.userKey,
      },
    });
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new ApiError(
      payload.error?.code ?? 'REQUEST_FAILED',
      payload.error?.message ?? '잠시 후 다시 시도해 주세요.',
      response.status,
    );
  }
  return (await response.json()) as T;
}
