import { describe, expect, it } from 'vitest';
import {
  buildProfileShareMessage,
  getProfileCategoryCounts,
  getProfileInsightsFromCategoryCounts,
  getProfileLevel,
  getProfileTendency,
  getProfileTendencyFromCategoryCounts,
} from './profileInsights';
import type { Home } from './types';

function sampleHome(): Home {
  return {
    id: 'home',
    name: '테스트 집',
    emoji: '🏠',
    inviteCode: 'ABC123',
    members: [],
    profile: null,
    chores: [
      {
        id: 'laundry',
        title: '세탁하기',
        category: 'laundry',
        recurrence: { interval: 1, unit: 'week' },
        createdAt: '2026-07-01T00:00:00.000Z',
        nextDueDate: '2026-07-02',
        isCustom: false,
        enabled: true,
      },
      {
        id: 'cleaning',
        title: '바닥 청소',
        category: 'cleaning',
        recurrence: { interval: 1, unit: 'week' },
        createdAt: '2026-07-01T00:00:00.000Z',
        nextDueDate: '2026-07-02',
        isCustom: false,
        enabled: true,
      },
    ],
    history: [
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `laundry-${index}`,
        choreId: 'laundry',
        choreTitle: '세탁하기',
        action: 'completed' as const,
        performedAt: `2026-07-0${index + 1}T09:00:00.000Z`,
        performedByUserId: 'me',
        performedByName: '나',
      })),
      {
        id: 'cleaning-1',
        choreId: 'cleaning',
        choreTitle: '바닥 청소',
        action: 'completed',
        performedAt: '2026-07-04T09:00:00.000Z',
        performedByUserId: 'me',
        performedByName: '나',
      },
    ],
    laborAssessments: [],
    supplies: [],
    createdAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('공유용 살림 프로필', () => {
  it('가장 많이 완료한 집안일 분류로 성향을 만든다', () => {
    expect(getProfileTendency([sampleHome()], 'me')).toMatchObject({
      category: 'laundry',
      name: '뽀송 요정',
      basis: '세탁·패브릭',
    });
  });

  it('집 스냅샷에서 서버 계산에 재사용할 카테고리별 완료 수를 만든다', () => {
    expect(getProfileCategoryCounts([sampleHome()], 'me')).toEqual({
      cleaning: 1,
      kitchen: 0,
      laundry: 3,
      living: 0,
      pet: 0,
      etc: 0,
    });
  });

  it('집안일이 삭제되거나 분류가 바뀌어도 완료 당시 분류를 유지한다', () => {
    const home = sampleHome();
    home.chores = [];
    home.history = [{
      id: 'deleted-kitchen-chore',
      choreId: 'deleted-chore',
      choreTitle: '저녁 준비',
      categorySnapshot: 'kitchen',
      action: 'completed',
      performedAt: '2026-07-04T09:00:00.000Z',
      performedByUserId: 'me',
      performedByName: '나',
    }];

    expect(getProfileCategoryCounts([home], 'me')).toMatchObject({ kitchen: 1 });
  });

  it('카테고리별 집계만으로 레벨과 성향을 같이 계산한다', () => {
    const insights = getProfileInsightsFromCategoryCounts({
      cleaning: 2,
      kitchen: 12,
    });

    expect(insights).toMatchObject({
      completedCount: 14,
      level: {
        level: 2,
        progress: 40,
        remaining: 6,
      },
      tendency: {
        category: 'kitchen',
        name: '우리 집 이모카세',
      },
      tendencySampleSize: 12,
      categoryCounts: {
        cleaning: 2,
        kitchen: 12,
        laundry: 0,
        living: 0,
        pet: 0,
        etc: 0,
      },
    });
  });

  it('잘못된 집계값을 보정하고 동률은 정해진 우선순위로 안정적으로 계산한다', () => {
    const insights = getProfileInsightsFromCategoryCounts({
      cleaning: 3.9,
      kitchen: 3,
      laundry: -2,
      living: Number.NaN,
    });

    expect(insights.completedCount).toBe(6);
    expect(insights.categoryCounts).toMatchObject({ cleaning: 3, kitchen: 3, laundry: 0, living: 0 });
    expect(getProfileTendencyFromCategoryCounts(insights.categoryCounts)).toMatchObject({
      category: 'cleaning',
      name: '먼지 사냥꾼',
    });
  });

  it('완료 기록이 없으면 시작형을 보여준다', () => {
    expect(getProfileTendency([sampleHome()], 'other')).toMatchObject({
      category: null,
      name: '살림 탐험가',
    });
  });

  it('한 영역의 기록이 3회 쌓이기 전에는 유형을 성급하게 정하지 않는다', () => {
    const home = sampleHome();
    home.history = home.history.slice(0, 2);
    expect(getProfileTendency([home], 'me')).toMatchObject({
      category: null,
      name: '살림 탐험가',
    });
  });

  it('요리와 주방 업무를 가장 많이 하면 이모카세 유형을 얻는다', () => {
    const home = sampleHome();
    home.chores.push({
      id: 'cooking',
      title: '한 끼 요리하고 식탁 차리기',
      category: 'kitchen',
      recurrence: { interval: 1, unit: 'day' },
      createdAt: '2026-07-01T00:00:00.000Z',
      nextDueDate: '2026-07-02',
      isCustom: false,
      enabled: true,
    });
    home.history.push(...Array.from({ length: 5 }, (_, index) => ({
      id: `cooking-${index}`,
      choreId: 'cooking',
      choreTitle: '한 끼 요리하고 식탁 차리기',
      action: 'completed' as const,
      performedAt: `2026-07-${String(index + 10).padStart(2, '0')}T09:00:00.000Z`,
      performedByUserId: 'me',
      performedByName: '나',
    })));

    expect(getProfileTendency([home], 'me')).toMatchObject({
      category: 'kitchen',
      name: '우리 집 이모카세',
      basis: '요리·주방',
    });
  });

  it('완료 횟수로 레벨과 다음 레벨까지 남은 횟수를 계산한다', () => {
    expect(getProfileLevel(24)).toEqual({
      level: 3,
      progress: 40,
      levelName: '부지런한 살림러',
      remaining: 6,
    });
  });

  it('공유 문구에는 공개 프로필만 담는다', () => {
    const tendency = getProfileTendency([sampleHome()], 'me');
    const message = buildProfileShareMessage({
      displayName: '집토리',
      level: 2,
      levelName: '집안일 새싹',
      tendency,
      completedCount: 14,
      shareUrl: 'https://example.com',
    });

    expect(message).toContain('LV.2 집안일 새싹');
    expect(message).toContain('뽀송 요정');
    expect(message).toContain('주특기: 세탁·패브릭');
    expect(message).toContain('https://example.com');
    expect(message).not.toContain('테스트 집');
    expect(message).not.toContain('ABC123');
  });
});
