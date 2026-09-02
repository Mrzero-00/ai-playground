import { HangangDatabase } from './database.js';
import { AppError } from './errors.js';
import { validateLetterBody } from './content.js';
import type { Coordinates, MoodTag } from './types.js';

const MOODS = new Set<MoodTag>(['위로', '응원', '고민', '감사', '일상']);

export class HangangLetterService {
  constructor(private readonly database: HangangDatabase) {}

  createSession(rawUserKey: string) {
    const userId = this.database.normalizeUserKey(rawUserKey);
    this.database.ensureUser(userId);
    return { userId, sessionType: 'ANONYMOUS' as const };
  }

  listParks() {
    return this.database.listParks();
  }

  createLetter(rawUserKey: string, payload: { body?: unknown; moodTag?: unknown }) {
    const userId = this.userId(rawUserKey);
    const body = validateLetterBody(payload.body);
    const moodTag = payload.moodTag == null ? null : String(payload.moodTag);
    if (moodTag && !MOODS.has(moodTag as MoodTag)) {
      throw new AppError('INVALID_MOOD', '감정 태그가 올바르지 않아요.');
    }
    return this.database.createLetter(userId, body, moodTag as MoodTag | null);
  }

  listMyLetters(rawUserKey: string) {
    return this.database.listUserLetters(this.userId(rawUserKey));
  }

  listFoundLetters(rawUserKey: string) {
    return this.database.listFoundLetters(this.userId(rawUserKey));
  }

  startHunt(rawUserKey: string, parkId: unknown) {
    if (typeof parkId !== 'string' || !parkId) {
      throw new AppError('INVALID_PARK', '탐색할 공원을 선택해 주세요.');
    }
    return this.database.startHunt(this.userId(rawUserKey), parkId);
  }

  scanHunt(
    rawUserKey: string,
    huntId: string,
    payload: { latitude?: unknown; longitude?: unknown; accuracy?: unknown; simulate?: unknown },
  ) {
    const coordinates = this.parseCoordinates(payload);
    return this.database.scanHunt(
      this.userId(rawUserKey),
      huntId,
      coordinates,
      payload.simulate === true,
    );
  }

  claimLetter(
    rawUserKey: string,
    payload: { huntId?: unknown; claimToken?: unknown; accuracy?: unknown },
  ) {
    if (typeof payload.huntId !== 'string' || typeof payload.claimToken !== 'string') {
      throw new AppError('INVALID_CLAIM', '발견 인증 정보가 올바르지 않아요.');
    }
    const accuracy = Number(payload.accuracy ?? 999);
    return this.database.claimLetter(
      this.userId(rawUserKey),
      payload.huntId,
      payload.claimToken,
      Number.isFinite(accuracy) ? accuracy : 999,
    );
  }

  reportLetter(rawUserKey: string, letterId: string, reason: unknown) {
    if (typeof reason !== 'string' || reason.trim().length < 1) {
      throw new AppError('INVALID_REPORT_REASON', '신고 사유를 선택해 주세요.');
    }
    this.database.reportLetter(this.userId(rawUserKey), letterId, reason.trim());
    return { success: true };
  }

  private userId(rawUserKey: string): string {
    const userId = this.database.normalizeUserKey(rawUserKey);
    this.database.ensureUser(userId);
    return userId;
  }

  private parseCoordinates(payload: {
    latitude?: unknown;
    longitude?: unknown;
    accuracy?: unknown;
    simulate?: unknown;
  }): Coordinates {
    if (payload.simulate === true) {
      return { latitude: 0, longitude: 0, accuracy: 999 };
    }
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    const accuracy = Number(payload.accuracy);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(accuracy) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new AppError('INVALID_LOCATION', '현재 위치를 확인하지 못했어요.');
    }
    return { latitude, longitude, accuracy };
  }
}
