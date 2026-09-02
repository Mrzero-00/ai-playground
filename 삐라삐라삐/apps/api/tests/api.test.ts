import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { PpiraDatabase, SINGLE_FLYER_SKU } from '../src/database.js';
import { AppError } from '../src/errors.js';
import { PpiraService } from '../src/service.js';
import type { RuntimeSettings } from '../src/types.js';

const settings: RuntimeSettings = {
  flightMinSeconds: 1,
  flightMaxSeconds: 1,
  landingTtlSeconds: 86_400,
  maxLandingSequence: 3,
  allowSimulatedLocation: true,
  allowSimulatedPurchase: true,
};
const databases: PpiraDatabase[] = [];

function createService() {
  const database = new PpiraDatabase(':memory:', settings, 'test-encryption-key');
  databases.push(database);
  return { database, service: new PpiraService(database, settings) };
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
});

describe('삐라삐라삐 API 도메인', () => {
  it('연락처·정치 선전·협박 표현을 거절한다', () => {
    const { service } = createService();
    assert.throws(
      () => service.createFlyer('writer-a', { regionId: 'seoul-mapo', body: '기호 2번을 찍어주세요', moodTag: '일상' }),
      (error: unknown) => error instanceof AppError && error.code === 'CONTENT_REJECTED',
    );
  });

  it('매일 무료 1장을 먼저 사용하고 두 번째 발송을 차단한다', () => {
    const { service } = createService();
    service.createFlyer('writer-b', { regionId: 'seoul-mapo', body: '마포구에 보내는 첫 번째 마음', moodTag: '응원' });
    assert.equal(service.getWallet('writer-b').dailyFreeRemaining, 0);
    assert.throws(
      () => service.createFlyer('writer-b', { regionId: 'seoul-songpa', body: '두 번째 마음', moodTag: '일상' }),
      (error: unknown) => error instanceof AppError && error.code === 'NO_FLYER_CREDIT',
    );
  });

  it('300원 소모성 상품을 멱등 지급하고 구매 장수로 발송한다', () => {
    const { database, service } = createService();
    const userId = database.normalizeUserKey('writer-c');
    database.ensureUser(userId);
    database.grantPurchase(userId, 'order-001', SINGLE_FLYER_SKU, 'SIMULATED');
    database.grantPurchase(userId, 'order-001', SINGLE_FLYER_SKU, 'SIMULATED');
    assert.equal(service.getWallet('writer-c').purchasedCredits, 1);
    service.createFlyer('writer-c', { regionId: 'busan-haeundae', body: '무료 장수를 먼저 사용해요', moodTag: '일상' });
    service.createFlyer('writer-c', { regionId: 'busan-suyeong', body: '구매한 장수로 날려요', moodTag: '감사' });
    assert.equal(service.getWallet('writer-c').availableTotal, 0);
  });

  it('선택한 시·구 안에만 삐라를 내려앉힌다', () => {
    const { database, service } = createService();
    const now = new Date('2026-09-02T01:00:00.000Z');
    const userId = database.normalizeUserKey('writer-d');
    database.ensureUser(userId);
    database.createFlyer(userId, 'incheon-yeonsu', '인천 연수구에 보내는 마음', '응원', now);
    database.runMaintenance(new Date(now.getTime() + 2_000));
    const [landed] = service.listMyFlyers('writer-d');
    assert.equal(landed?.status, 'LANDED');
    assert.equal(landed?.targetRegionName, '인천광역시 연수구');
  });

  it('동시에 발견해도 한 사람만 삐라를 획득한다', () => {
    const { service } = createService();
    const huntA = service.startHunt('finder-a', 'seoul-mapo');
    const huntB = service.startHunt('finder-b', 'seoul-mapo');
    const scanA = service.scanHunt('finder-a', huntA.huntId, { simulate: true });
    const scanB = service.scanHunt('finder-b', huntB.huntId, { simulate: true });
    assert.equal(scanA.detected, true);
    assert.equal(scanB.detected, true);
    const first = service.claimFlyer('finder-a', { huntId: huntA.huntId, claimToken: scanA.claimToken, accuracy: 10 });
    assert.ok(first.flyer.body.length > 0);
    assert.throws(
      () => service.claimFlyer('finder-b', { huntId: huntB.huntId, claimToken: scanB.claimToken, accuracy: 10 }),
      (error: unknown) => error instanceof AppError && error.code === 'FLYER_ALREADY_CLAIMED',
    );
  });
});
