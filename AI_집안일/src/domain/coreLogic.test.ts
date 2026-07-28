import { describe, expect, it } from 'vitest';
import { calculateHomeAnalytics } from './analytics';
import { addRecurrence } from './date';
import { supplyProjection } from './supplies';
import type { Chore, ChoreHistory, SupplyItem } from './types';

describe('날짜와 생활용품 계산', () => {
  it('월말 반복 날짜를 다음 달 마지막 날에 맞춘다', () => {
    expect(addRecurrence('2026-01-31', { interval: 1, unit: 'month' })).toBe('2026-02-28');
    expect(addRecurrence('2024-01-31', { interval: 1, unit: 'month' })).toBe('2024-02-29');
  });

  it('안전 재고와 사전 확인일을 반영한다', () => {
    const item: SupplyItem = {
      id: 'paper',
      name: '휴지',
      unit: '롤',
      purchaseDate: '2026-07-01',
      purchaseQuantity: 12,
      weeklyUsage: 3,
      safetyStock: 3,
      reminderDaysBefore: 7,
      updatedAt: '2026-07-01T00:00:00.000Z',
    };
    expect(supplyProjection(item)).toEqual({
      daysUntilSafetyStock: 21,
      expectedPurchaseDate: '2026-07-22',
      checkDate: '2026-07-15',
    });
  });
});

describe('리포트 연속 달성', () => {
  it('월이 바뀌어도 연속 완료 일수를 유지한다', () => {
    const chore: Chore = {
      id: 'daily',
      title: '매일 할 일',
      category: 'living',
      recurrence: { interval: 1, unit: 'day' },
      createdAt: '2026-06-29T00:00:00.000Z',
      scheduleAnchorDate: '2026-06-29',
      nextDueDate: '2026-07-03',
      isCustom: true,
      enabled: true,
    };
    const dates = ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02'];
    const history: ChoreHistory[] = dates.map((date) => ({
      id: `history-${date}`,
      choreId: chore.id,
      choreTitle: chore.title,
      action: 'completed',
      performedAt: `${date}T09:00:00.000Z`,
      scheduledFor: date,
      performedByUserId: 'user',
      performedByName: '나',
    }));
    const result = calculateHomeAnalytics([chore], history, [], new Date('2026-07-02T12:00:00'));
    expect(result.currentStreak).toBe(4);
  });
});
