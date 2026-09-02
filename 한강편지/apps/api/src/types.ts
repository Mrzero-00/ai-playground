export type LetterStatus =
  | 'DRIFTING'
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

export interface ParkSummary {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  accent: string;
  status: 'ACTIVE' | 'PAUSED';
  inventoryCount: number;
  operatingNote: string;
}

export interface UserLetter {
  id: string;
  bodyPreview: string;
  moodTag: MoodTag | null;
  status: LetterStatus;
  createdAt: string;
  driftEndsAt: string | null;
  parkName: string | null;
  landingSequence: number;
  claimedAt: string | null;
}

export interface FoundLetter {
  id: string;
  body: string;
  moodTag: MoodTag | null;
  parkName: string;
  claimedAt: string;
}

export interface ScanResult {
  detected: boolean;
  claimToken?: string;
  tokenExpiresAt?: string;
  visualSeed?: number;
  reason?: 'NO_LETTER_DETECTED' | 'LOCATION_ACCURACY_LOW';
}

export interface ClaimResult {
  letter: FoundLetter;
}

export interface RuntimeSettings {
  driftMinSeconds: number;
  driftMaxSeconds: number;
  landingTtlSeconds: number;
  maxLandingSequence: number;
  allowSimulatedLocation: boolean;
}
