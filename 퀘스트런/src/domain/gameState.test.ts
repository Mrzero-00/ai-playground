import {
  DEFAULT_GAME_STATE,
  applyCompletedRun,
  claimQuestReward,
  getDailyQuests,
  getDateKey,
  getWeekKey,
  registerBattleWin,
  spendBattleEnergy,
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
  it('완료한 러닝을 성장과 퀘스트에 반영한다', () => {
    const next = applyCompletedRun(BASE_STATE, RUN);

    expect(next.totalDistanceKm).toBe(44.3);
    expect(next.dailyDistanceKm).toBe(2.15);
    expect(next.dailyRuns).toBe(1);
    expect(next.battleEnergy).toBe(1_020);
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

  it('전투 에너지와 일일 전투 진행도를 갱신한다', () => {
    const spent = spendBattleEnergy(BASE_STATE, 120);
    const won = registerBattleWin(spent, TEST_NOW);

    expect(won.battleEnergy).toBe(720);
    expect(won.dailyBattles).toBe(1);
  });

  it('일일 퀘스트 완료값을 현재 게임 상태에서 계산한다', () => {
    const state = applyCompletedRun(BASE_STATE, RUN);
    const quests = getDailyQuests(state);

    expect(quests.find((quest) => quest.id === 'daily-distance')?.current).toBe(2.15);
    expect(quests.find((quest) => quest.id === 'daily-run')?.current).toBe(1);
  });

  it('7일째 일일 퀘스트를 모두 받으면 지구력이 오른다', () => {
    const completed = {
      ...BASE_STATE,
      dailyDistanceKm: 1,
      dailyRuns: 1,
      dailyBattles: 1,
    };
    const first = claimQuestReward(completed, 'daily-distance', '2026-07-28');
    const second = claimQuestReward(first, 'daily-run', '2026-07-28');
    const third = claimQuestReward(second, 'daily-battle', '2026-07-28');

    expect(third.dailyStreak).toBe(7);
    expect(third.endurance).toBe(4);
    expect(third.awardedEnduranceMilestones).toContain(7);
  });

  it('전투 일일 퀘스트 보상으로 나무 방패를 해금한다', () => {
    const completed = {
      ...BASE_STATE,
      dailyBattles: 1,
    };
    const next = claimQuestReward(completed, 'daily-battle', '2026-07-28');

    expect(next.unlockedItemIds).toContain('wood-shield');
  });

  it('주간 러닝 횟수 퀘스트 보상으로 골드를 지급한다', () => {
    const completed = {
      ...BASE_STATE,
      weeklyRuns: 3,
    };
    const next = claimQuestReward(completed, 'weekly-runs', '2026-07-28');

    expect(next.gold).toBe(BASE_STATE.gold + 500);
  });
});
