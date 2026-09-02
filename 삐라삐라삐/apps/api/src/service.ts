import { randomUUID } from 'node:crypto';
import { PpiraDatabase, SINGLE_FLYER_SKU } from './database.js';
import { AppError } from './errors.js';
import { verifyIapOrder } from './iap.js';
import { validateFlyerBody } from './content.js';
import type { Coordinates, MoodTag, RuntimeSettings } from './types.js';

const MOODS = new Set<MoodTag>(['위로', '응원', '고민', '감사', '일상']);

export class PpiraService {
  constructor(private readonly database: PpiraDatabase, private readonly settings: RuntimeSettings) {}

  createSession(rawUserKey: string) {
    const userId = this.database.normalizeUserKey(rawUserKey);
    this.database.ensureUser(userId);
    return { userId, sessionType: 'ANONYMOUS' as const };
  }

  listRegions() {
    return this.database.listRegions();
  }

  getWallet(rawUserKey: string) {
    return this.database.getWallet(this.userId(rawUserKey));
  }

  async grantPurchase(rawUserKey: string, payload: { orderId?: unknown; sku?: unknown; simulate?: unknown }) {
    const userId = this.userId(rawUserKey);
    const orderId = typeof payload.orderId === 'string' ? payload.orderId : '';
    const sku = typeof payload.sku === 'string' ? payload.sku : '';
    if (sku !== SINGLE_FLYER_SKU) throw new AppError('INVALID_PRODUCT', '구매 상품이 올바르지 않아요.');
    if (payload.simulate === true) {
      if (!this.settings.allowSimulatedPurchase) throw new AppError('SIMULATION_DISABLED', '운영 환경에서는 체험 결제를 사용할 수 없어요.', 403);
      return this.database.grantPurchase(userId, orderId || `local-${randomUUID()}`, sku, 'SIMULATED');
    }
    if (!orderId) throw new AppError('INVALID_ORDER', '주문 정보가 올바르지 않아요.');
    await verifyIapOrder(orderId, sku);
    return this.database.grantPurchase(userId, orderId, sku, 'VERIFIED');
  }

  createFlyer(rawUserKey: string, payload: { body?: unknown; moodTag?: unknown; regionId?: unknown }) {
    const userId = this.userId(rawUserKey);
    const body = validateFlyerBody(payload.body);
    const regionId = typeof payload.regionId === 'string' ? payload.regionId : '';
    if (!regionId) throw new AppError('INVALID_REGION', '삐라를 날릴 시·구를 선택해 주세요.');
    const moodTag = payload.moodTag == null ? null : String(payload.moodTag);
    if (moodTag && !MOODS.has(moodTag as MoodTag)) throw new AppError('INVALID_MOOD', '감정 태그가 올바르지 않아요.');
    return this.database.createFlyer(userId, regionId, body, moodTag as MoodTag | null);
  }

  listMyFlyers(rawUserKey: string) {
    return this.database.listUserFlyers(this.userId(rawUserKey));
  }

  listFoundFlyers(rawUserKey: string) {
    return this.database.listFoundFlyers(this.userId(rawUserKey));
  }

  startHunt(rawUserKey: string, regionId: unknown) {
    if (typeof regionId !== 'string' || !regionId) throw new AppError('INVALID_REGION', '탐색할 구를 선택해 주세요.');
    return this.database.startHunt(this.userId(rawUserKey), regionId);
  }

  scanHunt(rawUserKey: string, huntId: string, payload: { latitude?: unknown; longitude?: unknown; accuracy?: unknown; simulate?: unknown }) {
    return this.database.scanHunt(this.userId(rawUserKey), huntId, this.parseCoordinates(payload), payload.simulate === true);
  }

  claimFlyer(rawUserKey: string, payload: { huntId?: unknown; claimToken?: unknown; accuracy?: unknown }) {
    if (typeof payload.huntId !== 'string' || typeof payload.claimToken !== 'string') throw new AppError('INVALID_CLAIM', '발견 인증 정보가 올바르지 않아요.');
    const accuracy = Number(payload.accuracy ?? 999);
    return this.database.claimFlyer(this.userId(rawUserKey), payload.huntId, payload.claimToken, Number.isFinite(accuracy) ? accuracy : 999);
  }

  reportFlyer(rawUserKey: string, flyerId: string, reason: unknown) {
    if (typeof reason !== 'string' || reason.trim().length < 1) throw new AppError('INVALID_REPORT_REASON', '신고 사유를 선택해 주세요.');
    this.database.reportFlyer(this.userId(rawUserKey), flyerId, reason.trim());
    return { success: true };
  }

  private userId(rawUserKey: string): string {
    const userId = this.database.normalizeUserKey(rawUserKey);
    this.database.ensureUser(userId);
    return userId;
  }

  private parseCoordinates(payload: { latitude?: unknown; longitude?: unknown; accuracy?: unknown; simulate?: unknown }): Coordinates {
    if (payload.simulate === true) return { latitude: 0, longitude: 0, accuracy: 999 };
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    const accuracy = Number(payload.accuracy);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new AppError('INVALID_LOCATION', '현재 위치를 확인하지 못했어요.');
    }
    return { latitude, longitude, accuracy };
  }
}
