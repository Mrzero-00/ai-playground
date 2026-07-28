import {
  DAILY_QUESTS,
  HIDDEN_ACHIEVEMENTS,
  ITEMS,
  WEEKLY_QUESTS,
  calculateRunRewards,
  getEnduranceBonus,
  getItemById,
  type ItemSlot,
  type Quest,
} from './game';
import type { CompletedRun } from './runTracking';

export interface GameState {
  version: 2;
  dailyDateKey: string;
  weeklyDateKey: string;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  endurance: number;
  dailyStreak: number;
  lastDailyCompletionDate: string | null;
  totalDistanceKm: number;
  totalRuns: number;
  weeklyDistanceKm: number;
  weeklyRuns: number;
  styleCoins: number;
  dailyDistanceKm: number;
  dailyRuns: number;
  claimedQuestIds: string[];
  unlockedItemIds: string[];
  equippedItemIds: Partial<Record<ItemSlot, string>>;
  unlockedAchievementIds: string[];
  awardedEnduranceMilestones: number[];
  regionDistancesKm: Record<string, number>;
  runHistory: CompletedRun[];
}

export const DEFAULT_GAME_STATE: GameState = {
  version: 2,
  dailyDateKey: getDateKey(Date.now()),
  weeklyDateKey: getWeekKey(Date.now()),
  level: 7,
  experience: 650,
  experienceToNextLevel: 1_000,
  endurance: 3,
  dailyStreak: 6,
  lastDailyCompletionDate: null,
  totalDistanceKm: 42.8,
  totalRuns: 12,
  weeklyDistanceKm: 6.4,
  weeklyRuns: 2,
  styleCoins: 1_240,
  dailyDistanceKm: 0.65,
  dailyRuns: 0,
  claimedQuestIds: [],
  unlockedItemIds: ['mint-cap', 'mint-hoodie', 'orange-shoes'],
  equippedItemIds: {
    head: 'mint-cap',
    top: 'mint-hoodie',
    shoes: 'orange-shoes',
  },
  unlockedAchievementIds: [],
  awardedEnduranceMilestones: [],
  regionDistancesKm: {},
  runHistory: [],
};

export function applyCompletedRun(state: GameState, run: CompletedRun): GameState {
  state = rolloverGameState(state, run.finishedAt);
  const rewards = calculateRunRewards(run.distanceKm);
  const updatedRegions = { ...state.regionDistancesKm };

  for (const [region, distanceKm] of Object.entries(run.regionDistancesKm)) {
    updatedRegions[region] = roundTo((updatedRegions[region] ?? 0) + distanceKm, 2);
  }

  const unlockedAchievements = HIDDEN_ACHIEVEMENTS.filter(
    (achievement) => (updatedRegions[achievement.region] ?? 0) >= achievement.requiredDistanceKm
  );
  const unlockedAchievementIds = [
    ...new Set([...state.unlockedAchievementIds, ...unlockedAchievements.map((achievement) => achievement.id)]),
  ];
  const unlockedItemIds = [
    ...new Set([...state.unlockedItemIds, ...unlockedAchievements.map((achievement) => achievement.rewardItemId)]),
  ];
  const levelProgress = applyExperience(state.level, state.experience, state.experienceToNextLevel, rewards.experience);

  return {
    ...state,
    ...levelProgress,
    totalDistanceKm: roundTo(state.totalDistanceKm + run.distanceKm, 2),
    totalRuns: state.totalRuns + 1,
    weeklyDistanceKm: roundTo(state.weeklyDistanceKm + run.distanceKm, 2),
    weeklyRuns: state.weeklyRuns + 1,
    styleCoins: state.styleCoins + rewards.styleCoins,
    dailyDistanceKm: roundTo(state.dailyDistanceKm + run.distanceKm, 2),
    dailyRuns: state.dailyRuns + 1,
    regionDistancesKm: updatedRegions,
    unlockedAchievementIds,
    unlockedItemIds,
    runHistory: [run, ...state.runHistory].slice(0, 30),
  };
}

export function purchaseItem(state: GameState, itemId: string): GameState {
  const item = getItemById(itemId);

  if (
    item == null ||
    item.source !== 'shop' ||
    state.unlockedItemIds.includes(item.id) ||
    state.styleCoins < item.price
  ) {
    return state;
  }

  return {
    ...state,
    styleCoins: state.styleCoins - item.price,
    unlockedItemIds: [...state.unlockedItemIds, item.id],
  };
}

export function equipItem(state: GameState, itemId: string): GameState {
  const item = getItemById(itemId);

  if (item == null || !state.unlockedItemIds.includes(itemId)) {
    return state;
  }

  return {
    ...state,
    equippedItemIds: {
      ...state.equippedItemIds,
      [item.slot]: item.id,
    },
  };
}

export function claimQuestReward(state: GameState, questId: string, todayDateKey: string): GameState {
  state = rolloverGameState(state, new Date(`${todayDateKey}T12:00:00`).getTime());

  if (state.claimedQuestIds.includes(questId) || !isQuestComplete(state, questId)) {
    return state;
  }

  let nextState: GameState = {
    ...state,
    claimedQuestIds: [...state.claimedQuestIds, questId],
  };

  if (questId === 'daily-distance') {
    nextState = {
      ...nextState,
      ...applyExperience(nextState.level, nextState.experience, nextState.experienceToNextLevel, 120),
    };
  }

  if (questId === 'daily-run') {
    nextState = {
      ...nextState,
      styleCoins: nextState.styleCoins + 80,
    };
  }

  if (questId === 'daily-distance-3') {
    nextState = {
      ...nextState,
      styleCoins: nextState.styleCoins + 120,
    };
  }

  if (questId === 'weekly-distance') {
    nextState = {
      ...nextState,
      unlockedItemIds: [...new Set([...nextState.unlockedItemIds, 'weekly-bandana'])],
    };
  }

  if (questId === 'weekly-runs') {
    nextState = {
      ...nextState,
      styleCoins: nextState.styleCoins + 300,
    };
  }

  const allDailyClaimed = DAILY_QUESTS.every((quest) => nextState.claimedQuestIds.includes(quest.id));

  if (!allDailyClaimed || nextState.lastDailyCompletionDate === todayDateKey) {
    return nextState;
  }

  const nextStreak = isPreviousDate(nextState.lastDailyCompletionDate, todayDateKey)
    ? nextState.dailyStreak + 1
    : nextState.lastDailyCompletionDate == null
      ? nextState.dailyStreak + 1
      : 1;
  const newlyReachedMilestones = [7, 30, 100].filter(
    (days) => nextStreak >= days && !nextState.awardedEnduranceMilestones.includes(days)
  );
  const enduranceGain = getEnduranceBonus(nextStreak) - getEnduranceBonus(nextStreak - 1);

  return {
    ...nextState,
    dailyStreak: nextStreak,
    endurance: nextState.endurance + Math.max(0, enduranceGain),
    lastDailyCompletionDate: todayDateKey,
    awardedEnduranceMilestones: [...new Set([...nextState.awardedEnduranceMilestones, ...newlyReachedMilestones])],
  };
}

export function getQuestWithProgress(state: GameState, quest: Quest): Quest {
  const current = getQuestCurrentValue(state, quest);
  return { ...quest, current };
}

export function getDailyQuests(state: GameState): Quest[] {
  return DAILY_QUESTS.map((quest) => getQuestWithProgress(state, quest));
}

export function getWeeklyQuests(state: GameState): Quest[] {
  return WEEKLY_QUESTS.map((quest) => getQuestWithProgress(state, quest));
}

export function isQuestComplete(state: GameState, questId: string): boolean {
  const quest = [...DAILY_QUESTS, ...WEEKLY_QUESTS].find((candidate) => candidate.id === questId);
  return quest != null && getQuestCurrentValue(state, quest) >= quest.target;
}

export function getDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekKey(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  return getDateKey(monday.getTime());
}

export function rolloverGameState(state: GameState, timestamp: number): GameState {
  const currentDailyKey = getDateKey(timestamp);
  const currentWeeklyKey = getWeekKey(timestamp);
  let nextState = state;

  if (state.dailyDateKey !== currentDailyKey) {
    const dailyQuestIds = new Set(DAILY_QUESTS.map((quest) => quest.id));
    nextState = {
      ...nextState,
      dailyDateKey: currentDailyKey,
      dailyDistanceKm: 0,
      dailyRuns: 0,
      claimedQuestIds: nextState.claimedQuestIds.filter((questId) => !dailyQuestIds.has(questId)),
    };
  }

  if (state.weeklyDateKey !== currentWeeklyKey) {
    const weeklyQuestIds = new Set(WEEKLY_QUESTS.map((quest) => quest.id));
    nextState = {
      ...nextState,
      weeklyDateKey: currentWeeklyKey,
      weeklyDistanceKm: 0,
      weeklyRuns: 0,
      claimedQuestIds: nextState.claimedQuestIds.filter((questId) => !weeklyQuestIds.has(questId)),
    };
  }

  return nextState;
}

export function migrateGameState(stored: Record<string, unknown>): GameState {
  const legacyGold = typeof stored.gold === 'number' ? stored.gold : DEFAULT_GAME_STATE.styleCoins;
  const unlockedItemIds = Array.isArray(stored.unlockedItemIds)
    ? stored.unlockedItemIds.filter(
        (id): id is string => typeof id === 'string' && ITEMS.some((item) => item.id === id)
      )
    : [];

  return {
    ...DEFAULT_GAME_STATE,
    ...stored,
    version: 2,
    styleCoins: typeof stored.styleCoins === 'number' ? stored.styleCoins : legacyGold,
    unlockedItemIds: [...new Set([...DEFAULT_GAME_STATE.unlockedItemIds, ...unlockedItemIds])],
    equippedItemIds:
      stored.version === 2 && stored.equippedItemIds != null
        ? (stored.equippedItemIds as Partial<Record<ItemSlot, string>>)
        : DEFAULT_GAME_STATE.equippedItemIds,
    claimedQuestIds: Array.isArray(stored.claimedQuestIds)
      ? stored.claimedQuestIds.filter(
          (id): id is string =>
            typeof id === 'string' && [...DAILY_QUESTS, ...WEEKLY_QUESTS].some((quest) => quest.id === id)
        )
      : [],
  } as GameState;
}

function getQuestCurrentValue(state: GameState, quest: Quest): number {
  if (quest.kind === 'daily') {
    return quest.metric === 'distance' ? state.dailyDistanceKm : state.dailyRuns;
  }

  if (quest.kind === 'weekly') {
    return quest.metric === 'distance' ? state.weeklyDistanceKm : state.weeklyRuns;
  }

  return quest.current;
}

function applyExperience(
  level: number,
  experience: number,
  experienceToNextLevel: number,
  gainedExperience: number
): Pick<GameState, 'level' | 'experience' | 'experienceToNextLevel'> {
  let nextLevel = level;
  let nextExperience = experience + gainedExperience;
  let nextTarget = experienceToNextLevel;

  while (nextExperience >= nextTarget) {
    nextExperience -= nextTarget;
    nextLevel += 1;
    nextTarget = Math.floor(nextTarget * 1.18);
  }

  return {
    level: nextLevel,
    experience: nextExperience,
    experienceToNextLevel: nextTarget,
  };
}

function isPreviousDate(previousDateKey: string | null, currentDateKey: string): boolean {
  if (previousDateKey == null) {
    return false;
  }

  const previous = new Date(`${previousDateKey}T12:00:00`);
  const current = new Date(`${currentDateKey}T12:00:00`);
  return Math.round((current.getTime() - previous.getTime()) / 86_400_000) === 1;
}

function roundTo(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
