import {
  DEFAULT_GAME_STATE,
  applyCompletedRun,
  claimQuestReward,
  equipItem,
  getDailyQuests,
  getDateKey,
  getWeekKey,
  migrateGameState,
  purchaseItem,
} from './gameState';
import type { CompletedRun } from './runTracking';

const TEST_NOW = new Date('2026-07-28T09:00:00+09:00').getTime();
const BASE_STATE = {
  ...DEFAULT_GAME_STATE,
  dailyDateKey: getDateKey(TEST_NOW),
  weeklyDateKey: getWeekKey(TEST_NOW),
};
const RUN: CompletedRun = {
  id: 'run-test',
  startedAt: TEST_NOW,
  finishedAt: TEST_NOW + 600_000,
  elapsedSeconds: 600,
  distanceKm: 1.5,
  averagePaceSecondsPerKm: 400,
  regionDistancesKm: { 제주특별자치도: 1.5 },
};

describe('게임 상태', () => {
  it('완료한 러닝을 레벨과 꾸미기 코인에 반영한다', () => {
    const next = applyCompletedRun(BASE_STATE, RUN);

    expect(next.totalDistanceKm).toBe(44.3);
    expect(next.dailyDistanceKm).toBe(2.15);
    expect(next.dailyRuns).toBe(1);
    expect(next.styleCoins).toBe(1_300);
    expect(next.runHistory).toHaveLength(1);
  });

  it('제주 누적 5km 달성 시 한라봉 모자를 해금한다', () => {
    const state = {
      ...BASE_STATE,
      regionDistancesKm: { 제주특별자치도: 4 },
    };
    const next = applyCompletedRun(state, RUN);

    expect(next.unlockedAchievementIds).toContain('jeju-citrus-runner');
    expect(next.unlockedItemIds).toContain('hallabong-hat');
  });

  it('러닝 코인으로 상점 아이템을 구매한다', () => {
    const next = purchaseItem(BASE_STATE, 'sunny-visor');

    expect(next.styleCoins).toBe(BASE_STATE.styleCoins - 180);
    expect(next.unlockedItemIds).toContain('sunny-visor');
  });

  it('코인이 부족하면 아이템을 구매하지 않는다', () => {
    const state = { ...BASE_STATE, styleCoins: 10 };
    const next = purchaseItem(state, 'sunny-visor');

    expect(next).toBe(state);
  });

  it('보유한 아이템을 슬롯에 착용한다', () => {
    const purchased = purchaseItem(BASE_STATE, 'sunny-visor');
    const equipped = equipItem(purchased, 'sunny-visor');

    expect(equipped.equippedItemIds.head).toBe('sunny-visor');
  });

  it('보유하지 않은 아이템은 착용할 수 없다', () => {
    expect(equipItem(BASE_STATE, 'rainbow-trail')).toBe(BASE_STATE);
  });

  it('일일 퀘스트 완료값을 현재 게임 상태에서 계산한다', () => {
    const state = applyCompletedRun(BASE_STATE, RUN);
    const quests = getDailyQuests(state);

    expect(quests.find((quest) => quest.id === 'daily-distance')?.current).toBe(2.15);
    expect(quests.find((quest) => quest.id === 'daily-run')?.current).toBe(1);
    expect(quests.find((quest) => quest.id === 'daily-distance-3')?.current).toBe(2.15);
  });

  it('7일째 일일 퀘스트를 모두 받으면 지구력이 오른다', () => {
    const completed = {
      ...BASE_STATE,
      dailyDistanceKm: 3,
      dailyRuns: 1,
    };
    const first = claimQuestReward(completed, 'daily-distance', '2026-07-28');
    const second = claimQuestReward(first, 'daily-run', '2026-07-28');
    const third = claimQuestReward(second, 'daily-distance-3', '2026-07-28');

    expect(third.dailyStreak).toBe(7);
    expect(third.endurance).toBe(4);
    expect(third.awardedEnduranceMilestones).toContain(7);
  });

  it('주간 거리 퀘스트로 한정 반다나를 얻는다', () => {
    const completed = {
      ...BASE_STATE,
      weeklyDistanceKm: 10,
    };
    const next = claimQuestReward(completed, 'weekly-distance', '2026-07-28');

    expect(next.unlockedItemIds).toContain('weekly-bandana');
  });

  it('주간 러닝 횟수 퀘스트 보상으로 꾸미기 코인을 지급한다', () => {
    const completed = {
      ...BASE_STATE,
      weeklyRuns: 3,
    };
    const next = claimQuestReward(completed, 'weekly-runs', '2026-07-28');

    expect(next.styleCoins).toBe(BASE_STATE.styleCoins + 300);
  });

  it('기존 골드 저장값을 꾸미기 코인으로 마이그레이션한다', () => {
    const migrated = migrateGameState({ version: 1, gold: 777, unlockedItemIds: [] });

    expect(migrated.version).toBe(2);
    expect(migrated.styleCoins).toBe(777);
    expect(migrated.unlockedItemIds).toEqual(expect.arrayContaining(['mint-cap', 'mint-hoodie', 'orange-shoes']));
  });
});
