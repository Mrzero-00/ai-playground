export type FlyerStatus =
  | 'FLYING'
  | 'LANDED'
  | 'RELOCATING'
  | 'CLAIMED'
  | 'EXPIRED'
  | 'HIDDEN'
  | 'REMOVED';

export type MoodTag = '위로' | '응원' | '고민' | '감사' | '일상';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface RegionSummary {
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

export interface WalletSummary {
  dailyFreeRemaining: 0 | 1;
  purchasedCredits: number;
  availableTotal: number;
  nextFreeAt: string;
  product: { sku: string; displayName: string; price: number; displayPrice: string };
}

export interface ScanResult {
  detected: boolean;
  claimToken?: string;
  tokenExpiresAt?: string;
  visualSeed?: number;
  reason?: 'NO_FLYER_DETECTED' | 'LOCATION_ACCURACY_LOW';
}

export interface ClaimResult {
  flyer: FoundFlyer;
}

export interface RuntimeSettings {
  flightMinSeconds: number;
  flightMaxSeconds: number;
  landingTtlSeconds: number;
  maxLandingSequence: number;
  allowSimulatedLocation: boolean;
  allowSimulatedPurchase: boolean;
}
