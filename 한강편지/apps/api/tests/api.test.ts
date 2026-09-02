import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { HangangDatabase } from '../src/database.js';
import { AppError } from '../src/errors.js';
import { HangangLetterService } from '../src/service.js';
import type { RuntimeSettings } from '../src/types.js';

const settings: RuntimeSettings = {
  driftMinSeconds: 1,
  driftMaxSeconds: 1,
  landingTtlSeconds: 86_400,
  maxLandingSequence: 3,
  allowSimulatedLocation: true,
};

const databases: HangangDatabase[] = [];

function createService() {
  const database = new HangangDatabase(':memory:', settings, 'test-encryption-key');
  databases.push(database);
  return { database, service: new HangangLetterService(database) };
}

afterEach(() => {
  while (databases.length) databases.pop()?.close();
});

describe('한강에서 온 편지 API 도메인', () => {
  it('연락처와 링크가 포함된 편지를 거절한다', () => {
    const { service } = createService();
    assert.throws(
      () => service.createLetter('writer-a', { body: '연락해요 010-1234-5678', moodTag: '일상' }),
      (error: unknown) => error instanceof AppError && error.code === 'CONTENT_REJECTED',
    );
  });

  it('작성한 편지를 표류 상태로 저장하고 예정 시간 뒤 공원에 도착시킨다', () => {
    const { database, service } = createService();
    const created = service.createLetter('writer-b', { body: '모르는 누군가에게 보내는 편지', moodTag: '응원' });
    assert.equal(created.status, 'DRIFTING');
    database.runMaintenance(new Date(Date.now() + 2_000));
    const [landed] = service.listMyLetters('writer-b');
    assert.equal(landed?.status, 'LANDED');
    assert.ok(landed?.parkName);
  });

  it('동시에 발견해도 한 사람만 편지를 독점 획득한다', () => {
    const { service } = createService();
    const huntA = service.startHunt('finder-a', 'yeouido');
    const huntB = service.startHunt('finder-b', 'yeouido');
    const scanA = service.scanHunt('finder-a', huntA.huntId, { simulate: true });
    const scanB = service.scanHunt('finder-b', huntB.huntId, { simulate: true });
    assert.equal(scanA.detected, true);
    assert.equal(scanB.detected, true);

    const first = service.claimLetter('finder-a', {
      huntId: huntA.huntId,
      claimToken: scanA.claimToken,
      accuracy: 10,
    });
    assert.ok(first.letter.body.length > 0);

    assert.throws(
      () =>
        service.claimLetter('finder-b', {
          huntId: huntB.huntId,
          claimToken: scanB.claimToken,
          accuracy: 10,
        }),
      (error: unknown) => error instanceof AppError && error.code === 'LETTER_ALREADY_CLAIMED',
    );
  });
});
