import {
  ACHIEVEMENTS,
  ALL_ITEM_SLOTS,
  BASE_ITEM_SLOTS,
  DAILY_QUESTS,
  ITEMS,
  WEEKLY_QUESTS,
  calculateRunRewards,
  getEnduranceBonus,
  getItemById,
  type Achievement,
  type ItemSlot,
  type Quest,
} from './game';
import type { CompletedRun } from './runTracking';

export type GroupQuestMode = 'group' | 'solo';

export interface AchievementProgress {
  achievement: Achievement;
  current: number;
  unlocked: boolean;
}

export interface GameState {
  version: 4;
  dailyDateKey: string;
  weeklyDateKey: string;
  monthlyDateKey: string;
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
  unlockedSlotIds: ItemSlot[];
  equippedItemIds: Partial<Record<ItemSlot, string>>;
  unlockedAchievementIds: string[];
  awardedEnduranceMilestones: number[];
  regionDistancesKm: Record<string, number>;
  runHistory: CompletedRun[];
  groupQuestMode: GroupQuestMode;
  monthlyGroupDistanceKm: number;
  monthlyPersonalDistanceKm: number;
  claimedGroupQuestMonthKeys: string[];
  seenFriendNotificationIds: string[];
}

export const MONTHLY_GROUP_TARGET_KM = 400;

export const DEFAULT_GAME_STATE: GameState = {
  version: 4,
  dailyDateKey: getDateKey(Date.now()),
  weeklyDateKey: getWeekKey(Date.now()),
  monthlyDateKey: getMonthKey(Date.now()),
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
  unlockedItemIds: [
    'round-eyes',
    'bean-nose',
    'soft-smile',
    'chestnut-ponytail',
    'mint-cap',
    'mint-hoodie',
    'navy-shorts',
    'orange-shoes',
  ],
  unlockedSlotIds: [...BASE_ITEM_SLOTS],
  equippedItemIds: {
    eyes: 'round-eyes',
    nose: 'bean-nose',
    mouth: 'soft-smile',
    hair: 'chestnut-ponytail',
    head: 'mint-cap',
    top: 'mint-hoodie',
    bottom: 'navy-shorts',
    shoes: 'orange-shoes',
  },
  unlockedAchievementIds: [],
  awardedEnduranceMilestones: [],
  regionDistancesKm: {},
  runHistory: [],
  groupQuestMode: 'group',
  monthlyGroupDistanceKm: 286.4,
  monthlyPersonalDistanceKm: 42.8,
  claimedGroupQuestMonthKeys: [],
  seenFriendNotificationIds: [],
};

export function applyCompletedRun(state: GameState, run: CompletedRun): GameState {
  state = rolloverGameState(state, run.finishedAt);
  const rewards = calculateRunRewards(run.distanceKm);
  const updatedRegions = { ...state.regionDistancesKm };

  for (const [region, distanceKm] of Object.entries(run.regionDistancesKm)) {
    updatedRegions[region] = roundTo((updatedRegions[region] ?? 0) + distanceKm, 2);
  }

  const levelProgress = applyExperience(state.level, state.experience, state.experienceToNextLevel, rewards.experience);
  const nextState: GameState = {
    ...state,
    ...levelProgress,
    totalDistanceKm: roundTo(state.totalDistanceKm + run.distanceKm, 2),
    totalRuns: state.totalRuns + 1,
    weeklyDistanceKm: roundTo(state.weeklyDistanceKm + run.distanceKm, 2),
    weeklyRuns: state.weeklyRuns + 1,
    styleCoins: state.styleCoins + rewards.styleCoins,
    dailyDistanceKm: roundTo(state.dailyDistanceKm + run.distanceKm, 2),
    dailyRuns: state.dailyRuns + 1,
    monthlyPersonalDistanceKm: roundTo(state.monthlyPersonalDistanceKm + run.distanceKm, 2),
    monthlyGroupDistanceKm: roundTo(state.monthlyGroupDistanceKm + run.distanceKm, 2),
    regionDistancesKm: updatedRegions,
    runHistory: [run, ...state.runHistory].slice(0, 30),
  };

  return syncAchievements(nextState);
}

export function purchaseItem(state: GameState, itemId: string): GameState {
  const item = getItemById(itemId);

  if (
    item == null ||
    item.source !== 'shop' ||
    !state.unlockedSlotIds.includes(item.slot) ||
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

  if (
    item == null ||
    !state.unlockedItemIds.includes(itemId) ||
    !state.unlockedSlotIds.includes(item.slot)
  ) {
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
    nextState = { ...nextState, styleCoins: nextState.styleCoins + 80 };
  }

  if (questId === 'daily-distance-3') {
    nextState = { ...nextState, styleCoins: nextState.styleCoins + 120 };
  }

  if (questId === 'weekly-distance') {
    nextState = {
      ...nextState,
      unlockedItemIds: [...new Set([...nextState.unlockedItemIds, 'weekly-bandana'])],
    };
  }

  if (questId === 'weekly-runs') {
    nextState = { ...nextState, styleCoins: nextState.styleCoins + 300 };
  }

  const allDailyClaimed = DAILY_QUESTS.every((quest) => nextState.claimedQuestIds.includes(quest.id));

  if (allDailyClaimed && nextState.lastDailyCompletionDate !== todayDateKey) {
    const nextStreak = isPreviousDate(nextState.lastDailyCompletionDate, todayDateKey)
      ? nextState.dailyStreak + 1
      : nextState.lastDailyCompletionDate == null
        ? nextState.dailyStreak + 1
        : 1;
    const newlyReachedMilestones = [7, 30, 100].filter(
      (days) => nextStreak >= days && !nextState.awardedEnduranceMilestones.includes(days)
    );
    const enduranceGain = getEnduranceBonus(nextStreak) - getEnduranceBonus(nextStreak - 1);

    nextState = {
      ...nextState,
      dailyStreak: nextStreak,
      endurance: nextState.endurance + Math.max(0, enduranceGain),
      lastDailyCompletionDate: todayDateKey,
      awardedEnduranceMilestones: [
        ...new Set([...nextState.awardedEnduranceMilestones, ...newlyReachedMilestones]),
      ],
    };
  }

  return syncAchievements(nextState);
}

export function selectGroupQuestMode(state: GameState, mode: GroupQuestMode): GameState {
  if (state.claimedGroupQuestMonthKeys.includes(state.monthlyDateKey)) {
    return state;
  }

  return { ...state, groupQuestMode: mode };
}

export function getMonthlyGroupQuestProgress(state: GameState): number {
  return state.groupQuestMode === 'solo' ? state.monthlyPersonalDistanceKm : state.monthlyGroupDistanceKm;
}

export function claimGroupQuestReward(state: GameState): GameState {
  if (
    state.claimedGroupQuestMonthKeys.includes(state.monthlyDateKey) ||
    getMonthlyGroupQuestProgress(state) < MONTHLY_GROUP_TARGET_KM
  ) {
    return state;
  }

  let nextState: GameState = {
    ...state,
    unlockedItemIds: [...new Set([...state.unlockedItemIds, 'monthly-comet-crown'])],
    claimedGroupQuestMonthKeys: [...state.claimedGroupQuestMonthKeys, state.monthlyDateKey],
  };

  if (state.groupQuestMode === 'solo') {
    nextState = syncAchievements(nextState);
  }

  return nextState;
}

export function markFriendNotificationsSeen(state: GameState, notificationIds: string[]): GameState {
  return {
    ...state,
    seenFriendNotificationIds: [...new Set([...state.seenFriendNotificationIds, ...notificationIds])],
  };
}

export function getAchievementProgress(state: GameState, achievement: Achievement): number {
  switch (achievement.metric) {
    case 'streak':
      return state.dailyStreak;
    case 'total-distance':
      return state.totalDistanceKm;
    case 'total-runs':
      return state.totalRuns;
    case 'region-distance':
      return state.regionDistancesKm[achievement.region ?? ''] ?? 0;
    case 'solo-group-distance':
      return state.groupQuestMode === 'solo' ? state.monthlyPersonalDistanceKm : 0;
  }
}

export function getAchievementsWithProgress(state: GameState): AchievementProgress[] {
  return ACHIEVEMENTS.map((achievement) => ({
    achievement,
    current: getAchievementProgress(state, achievement),
    unlocked: state.unlockedAchievementIds.includes(achievement.id),
  }));
}

export function syncAchievements(state: GameState): GameState {
  const completed = ACHIEVEMENTS.filter(
    (achievement) => getAchievementProgress(state, achievement) >= achievement.target
  );

  return {
    ...state,
    unlockedAchievementIds: [
      ...new Set([...state.unlockedAchievementIds, ...completed.map((achievement) => achievement.id)]),
    ],
    unlockedItemIds: [
      ...new Set([
        ...state.unlockedItemIds,
        ...completed.flatMap((achievement) =>
          achievement.rewardItemId == null ? [] : [achievement.rewardItemId]
        ),
      ]),
    ],
    unlockedSlotIds: [
      ...new Set([
        ...state.unlockedSlotIds,
        ...completed.flatMap((achievement) => (achievement.unlockSlot == null ? [] : [achievement.unlockSlot])),
      ]),
    ],
  };
}

export function getQuestWithProgress(state: GameState, quest: Quest): Quest {
  return { ...quest, current: getQuestCurrentValue(state, quest) };
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

export function getMonthKey(timestamp: number): string {
  return getDateKey(timestamp).slice(0, 7);
}

export function rolloverGameState(state: GameState, timestamp: number): GameState {
  const currentDailyKey = getDateKey(timestamp);
  const currentWeeklyKey = getWeekKey(timestamp);
  const currentMonthlyKey = getMonthKey(timestamp);
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

  if (state.monthlyDateKey !== currentMonthlyKey) {
    nextState = {
      ...nextState,
      monthlyDateKey: currentMonthlyKey,
      monthlyGroupDistanceKm: 0,
      monthlyPersonalDistanceKm: 0,
      groupQuestMode: 'group',
    };
  }

  return nextState;
}

export function migrateGameState(stored: Record<string, unknown>): GameState {
  const legacyGold = typeof stored.gold === 'number' ? stored.gold : DEFAULT_GAME_STATE.styleCoins;
  const validItemIds = Array.isArray(stored.unlockedItemIds)
    ? stored.unlockedItemIds.filter(
        (id): id is string => typeof id === 'string' && ITEMS.some((item) => item.id === id)
      )
    : [];
  const storedSlots = Array.isArray(stored.unlockedSlotIds)
    ? stored.unlockedSlotIds.filter(
        (slot): slot is ItemSlot =>
          typeof slot === 'string' &&
          ALL_ITEM_SLOTS.includes(slot as ItemSlot)
      )
    : [];
  const rawEquipped =
    stored.equippedItemIds != null && typeof stored.equippedItemIds === 'object'
      ? (stored.equippedItemIds as Record<string, unknown>)
      : {};
  const equippedItemIds: Partial<Record<ItemSlot, string>> = {
    ...DEFAULT_GAME_STATE.equippedItemIds,
  };

  for (const [slot, itemId] of Object.entries(rawEquipped)) {
    if (
      typeof itemId === 'string' &&
      ALL_ITEM_SLOTS.includes(slot as ItemSlot) &&
      getItemById(itemId)?.slot === slot
    ) {
      equippedItemIds[slot as ItemSlot] = itemId;
    }
  }

  const migrated = {
    ...DEFAULT_GAME_STATE,
    ...stored,
    version: 4,
    monthlyDateKey:
      typeof stored.monthlyDateKey === 'string' ? stored.monthlyDateKey : DEFAULT_GAME_STATE.monthlyDateKey,
    styleCoins: typeof stored.styleCoins === 'number' ? stored.styleCoins : legacyGold,
    unlockedItemIds: [
      ...new Set([...DEFAULT_GAME_STATE.unlockedItemIds, ...validItemIds]),
    ],
    unlockedSlotIds: [...new Set([...BASE_ITEM_SLOTS, ...storedSlots])],
    equippedItemIds,
    claimedQuestIds: Array.isArray(stored.claimedQuestIds)
      ? stored.claimedQuestIds.filter(
          (id): id is string =>
            typeof id === 'string' && [...DAILY_QUESTS, ...WEEKLY_QUESTS].some((quest) => quest.id === id)
        )
      : [],
    claimedGroupQuestMonthKeys: Array.isArray(stored.claimedGroupQuestMonthKeys)
      ? stored.claimedGroupQuestMonthKeys.filter((key): key is string => typeof key === 'string')
      : [],
    seenFriendNotificationIds: Array.isArray(stored.seenFriendNotificationIds)
      ? stored.seenFriendNotificationIds.filter((id): id is string => typeof id === 'string')
      : [],
  } as GameState;

  return syncAchievements(migrated);
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
  return current.getTime() - previous.getTime() === 86_400_000;
}

function roundTo(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
