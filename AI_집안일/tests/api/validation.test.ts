import { describe, expect, it } from 'vitest';
import { assertValidAppData, normalizeInviteCode } from '../../api/_lib/validation';

describe('API 입력 검증', () => {
  it('초대 코드는 영문·숫자 6자리만 허용한다', () => {
    expect(normalizeInviteCode(' ab12cd ')).toBe('AB12CD');
    expect(() => normalizeInviteCode('abc')).toThrow('6자리');
  });

  it('과도한 수량과 잘못된 알림 시간을 거부한다', () => {
    const invalid = {
      version: 2,
      user: { id: 'user', displayName: '나', createdAt: new Date().toISOString() },
      homes: [],
      activeHomeId: null,
      notifications: { enabled: true, reminderHour: 99 },
    };
    expect(() => assertValidAppData(invalid)).toThrow('알림 설정');
  });
});
