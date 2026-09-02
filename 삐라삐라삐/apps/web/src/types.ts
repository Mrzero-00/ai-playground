export type MoodTag = '위로' | '응원' | '고민' | '감사' | '일상';
export type FlyerStatus = 'FLYING' | 'LANDED' | 'RELOCATING' | 'CLAIMED' | 'EXPIRED' | 'HIDDEN';

export interface Region {
  id: string;
  city: string;
  district: string;
  displayName: string;
  latitude: number;
  longitude: number;
  accent: string;
  status: 'ACTIVE' | 'PAUSED';
  inventoryCount: number;
  operatingNote: string;
}

export interface UserFlyer {
  id: string;
  bodyPreview: string;
  moodTag: MoodTag | null;
  status: FlyerStatus;
  createdAt: string;
  flightEndsAt: string | null;
  targetRegionName: string;
  landingSequence: number;
  claimedAt: string | null;
}

export interface FoundFlyer {
  id: string;
  body: string;
  moodTag: MoodTag | null;
  regionName: string;
  claimedAt: string;
}

export interface Wallet {
  dailyFreeRemaining: 0 | 1;
  purchasedCredits: number;
  availableTotal: number;
  nextFreeAt: string;
  product: { sku: string; displayName: string; price: number; displayPrice: string };
}

export interface AppLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}
