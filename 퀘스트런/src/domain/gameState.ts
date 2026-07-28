import {
  ADVENTURE_STAGES,
  DAILY_QUESTS,
  HIDDEN_ACHIEVEMENTS,
  WEEKLY_QUESTS,
  calculateRunRewards,
  getAdventureStageById,
  getAdventureStageState,
  getEnduranceBonus,
  type Quest,
} from './game';
import type { CompletedRun } from './runTracking';

export interface GameState {
  version: 1;
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
  gold: number;
  battleEnergy: number;
  dailyDistanceKm: number;
  dailyRuns: number;
  dailyBattles: number;
  claimedQuestIds: string[];
  clearedAdventureStageIds: string[];
  unlockedItemIds: string[];
  unlockedAchievementIds: string[];
  awardedEnduranceMilestones: number[];
  regionDistancesKm: Record<string, number>;
  runHistory: CompletedRun[];
}

export const DEFAULT_GAME_STATE: GameState = {
  version: 1,
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
  gold: 1_240,
  battleEnergy: 840,
  dailyDistanceKm: 0.65,
  dailyRuns: 0,
  dailyBattles: 0,
  claimedQuestIds: [],
  clearedAdventureStageIds: ['forest-1', 'forest-2'],
  unlockedItemIds: ['wood-sword', 'leaf-jacket', 'swift-shoes'],
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
    battleEnergy: state.battleEnergy + rewards.battleEnergy,
    dailyDistanceKm: roundTo(state.dailyDistanceKm + run.distanceKm, 2),
    dailyRuns: state.dailyRuns + 1,
    regionDistancesKm: updatedRegions,
    unlockedAchievementIds,
    unlockedItemIds,
    runHistory: [run, ...state.runHistory].slice(0, 30),
  };
}

export function spendBattleEnergy(state: GameState, amount: number): GameState {
  return {
    ...state,
    battleEnergy: Math.max(0, state.battleEnergy - Math.max(0, amount)),
  };
}

export function registerBattleWin(state: GameState, timestamp = Date.now()): GameState {
  state = rolloverGameState(state, timestamp);

  return {
    ...state,
    dailyBattles: state.dailyBattles + 1,
    unlockedItemIds: [...new Set([...state.unlockedItemIds, 'forest-gloves'])],
  };
}

export function completeAdventureStage(state: GameState, stageId: string, timestamp = Date.now()): GameState {
  state = rolloverGameState(state, timestamp);
  const stage = getAdventureStageById(stageId);

  if (
    stage == null ||
    getAdventureStageState(state.clearedAdventureStageIds, stageId) !== 'current' ||
    state.battleEnergy < stage.energyCost
  ) {
    return state;
  }

  const unlockedItemIds =
    stage.rewardItemId == null ? state.unlockedItemIds : [...new Set([...state.unlockedItemIds, stage.rewardItemId])];

  return {
    ...state,
    battleEnergy: state.battleEnergy - stage.energyCost,
    dailyBattles: state.dailyBattles + 1,
    gold: state.gold + stage.goldReward,
    clearedAdventureStageIds: [...state.clearedAdventureStageIds, stageId],
    unlockedItemIds,
  };
}

export function getCurrentAdventureStage(state: GameState) {
  return ADVENTURE_STAGES.find(
    (stage) => getAdventureStageState(state.clearedAdventureStageIds, stage.id) === 'current'
  );
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
      battleEnergy: nextState.battleEnergy + 80,
    };
  }

  if (questId === 'daily-battle') {
    nextState = {
      ...nextState,
      unlockedItemIds: [...new Set([...nextState.unlockedItemIds, 'wood-shield'])],
    };
  }

  if (questId === 'weekly-distance') {
    nextState = {
      ...nextState,
      unlockedItemIds: [...new Set([...nextState.unlockedItemIds, 'trail-blade'])],
    };
  }

  if (questId === 'weekly-runs') {
    nextState = {
      ...nextState,
      gold: nextState.gold + 500,
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

  if (quest == null) {
    return false;
  }

  return getQuestCurrentValue(state, quest) >= quest.target;
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
      dailyBattles: 0,
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

function getQuestCurrentValue(state: GameState, quest: Quest): number {
  if (quest.kind === 'daily') {
    if (quest.metric === 'distance') {
      return state.dailyDistanceKm;
    }
    if (quest.metric === 'runs') {
      return state.dailyRuns;
    }
    if (quest.metric === 'battle') {
      return state.dailyBattles;
    }
  }

  if (quest.kind === 'weekly') {
    if (quest.metric === 'distance') {
      return state.weeklyDistanceKm;
    }
    if (quest.metric === 'runs') {
      return state.weeklyRuns;
    }
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
    nextTarget += 200;
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

  const previousDate = new Date(`${previousDateKey}T00:00:00`);
  const currentDate = new Date(`${currentDateKey}T00:00:00`);
  const dayInMilliseconds = 24 * 60 * 60 * 1000;
  return Math.round((currentDate.getTime() - previousDate.getTime()) / dayInMilliseconds) === 1;
}

function roundTo(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
