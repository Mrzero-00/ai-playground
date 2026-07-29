import {
  DEFAULT_GAME_STATE,
  MONTHLY_GROUP_TARGET_KM,
  applyCompletedRun,
  claimGroupQuestReward,
  claimQuestReward,
  equipItem,
  getAchievementProgress,
  getDailyQuests,
  getDateKey,
  getMonthKey,
  getMonthlyGroupQuestProgress,
  getWeekKey,
  markFriendNotificationsSeen,
  migrateGameState,
  purchaseItem,
  rolloverGameState,
  selectGroupQuestMode,
  syncAchievements,
} from './gameState';
import { ACHIEVEMENTS } from './game';
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
    expect(next.monthlyPersonalDistanceKm).toBe(44.3);
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
    expect(third.unlockedAchievementIds).toContain('seven-day-promise');
    expect(third.unlockedSlotIds).toContain('glasses');
    expect(third.unlockedItemIds).toContain('daily-runner-glasses');
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

    expect(migrated.version).toBe(3);
    expect(migrated.styleCoins).toBe(777);
    expect(migrated.unlockedItemIds).toEqual(
      expect.arrayContaining(['mint-cap', 'mint-hoodie', 'navy-shorts', 'orange-shoes'])
    );
    expect(migrated.unlockedSlotIds).toEqual(expect.arrayContaining(['head', 'top', 'bottom', 'shoes']));
  });

  it('누적 100km 업적으로 가방 슬롯과 기록 가방을 해금한다', () => {
    const state = syncAchievements({
      ...BASE_STATE,
      totalDistanceKm: 100,
    });

    expect(state.unlockedAchievementIds).toContain('hundred-km-memory');
    expect(state.unlockedSlotIds).toContain('bag');
    expect(state.unlockedItemIds).toContain('record-backpack');
  });

  it('월간 그룹 퀘스트는 팀 거리와 개인 거리를 모드에 맞게 보여준다', () => {
    const groupState = {
      ...BASE_STATE,
      monthlyGroupDistanceKm: 310,
      monthlyPersonalDistanceKm: 55,
    };
    const soloState = selectGroupQuestMode(groupState, 'solo');

    expect(getMonthlyGroupQuestProgress(groupState)).toBe(310);
    expect(getMonthlyGroupQuestProgress(soloState)).toBe(55);
  });

  it('그룹 400km를 달성하면 월간 한정 크라운을 받는다', () => {
    const completed = {
      ...BASE_STATE,
      monthlyGroupDistanceKm: MONTHLY_GROUP_TARGET_KM,
    };
    const claimed = claimGroupQuestReward(completed);

    expect(claimed.unlockedItemIds).toContain('monthly-comet-crown');
    expect(claimed.claimedGroupQuestMonthKeys).toContain(completed.monthlyDateKey);
  });

  it('혼자 월간 400km를 달성하면 숨은 업적과 전용 안경을 얻는다', () => {
    const solo = selectGroupQuestMode(
      {
        ...BASE_STATE,
        monthlyPersonalDistanceKm: MONTHLY_GROUP_TARGET_KM,
      },
      'solo'
    );
    const claimed = claimGroupQuestReward(solo);

    expect(claimed.unlockedAchievementIds).toContain('solo-is-my-team');
    expect(claimed.unlockedItemIds).toContain('solo-star-glasses');
    expect(claimed.unlockedSlotIds).toContain('glasses');
  });

  it('친구 알림을 확인한 상태를 중복 없이 저장한다', () => {
    const first = markFriendNotificationsSeen(BASE_STATE, ['notice-1', 'notice-2']);
    const second = markFriendNotificationsSeen(first, ['notice-2']);

    expect(second.seenFriendNotificationIds).toEqual(['notice-1', 'notice-2']);
  });

  it('월이 바뀌면 그룹 퀘스트 진행도를 초기화한다', () => {
    const august = new Date('2026-08-01T09:00:00+09:00').getTime();
    const migrated = migrateGameState({
      ...BASE_STATE,
      monthlyDateKey: getMonthKey(TEST_NOW),
      monthlyGroupDistanceKm: 399,
      monthlyPersonalDistanceKm: 99,
    });
    const rolled = rolloverGameState(migrated, august);

    expect(rolled).toEqual(
      expect.objectContaining({
        monthlyDateKey: '2026-08',
        monthlyGroupDistanceKm: 0,
        monthlyPersonalDistanceKm: 0,
      })
    );
  });

  it('서울 지역 업적 진행도를 지역 누적으로 계산한다', () => {
    const achievement = ACHIEVEMENTS.find((candidate) => candidate.id === 'seoul-river-night')!;
    const state = { ...BASE_STATE, regionDistancesKm: { 서울특별시: 7.5 } };

    expect(getAchievementProgress(state, achievement)).toBe(7.5);
  });
});
