export type QuestKind = 'daily' | 'weekly' | 'streak';
export type QuestMetric = 'distance' | 'runs' | 'battle' | 'dailyPerfect';
export type ItemKind = 'weapon' | 'armor' | 'shoes' | 'cosmetic';
export type ItemRarity = '일반' | '희귀' | '영웅' | '지역 한정';

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  description: string;
  metric: QuestMetric;
  current: number;
  target: number;
  rewardLabel: string;
  rewardIcon: string;
}

export interface GameItem {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: ItemRarity;
  icon: string;
  power: number;
  description: string;
  region?: string;
  unlocked: boolean;
}

export interface HiddenAchievement {
  id: string;
  title: string;
  hiddenTitle: string;
  hiddenHint: string;
  region: string;
  requiredDistanceKm: number;
  rewardItemId: string;
  unlocked: boolean;
}

export interface RunRewards {
  experience: number;
  battleEnergy: number;
  questDistance: number;
}

export interface EnduranceMilestone {
  days: number;
  bonus: number;
  title: string;
}

export interface AdventureStage {
  id: string;
  number: number;
  name: string;
  monsterName: string;
  monsterIcon: string;
  monsterHp: number;
  autoDamage: number;
  energyCost: number;
  goldReward: number;
  rewardItemId?: string;
  isBoss?: boolean;
}

export type AdventureStageState = 'cleared' | 'current' | 'locked';

export const ADVENTURE_STAGES: AdventureStage[] = [
  {
    id: 'forest-1',
    number: 1,
    name: '새싹 오솔길',
    monsterName: '초록 슬라임',
    monsterIcon: '🟢',
    monsterHp: 90,
    autoDamage: 30,
    energyCost: 60,
    goldReward: 35,
  },
  {
    id: 'forest-2',
    number: 2,
    name: '버섯 언덕',
    monsterName: '버섯 도적',
    monsterIcon: '🍄',
    monsterHp: 120,
    autoDamage: 30,
    energyCost: 72,
    goldReward: 45,
  },
  {
    id: 'forest-3',
    number: 3,
    name: '야생의 길',
    monsterName: '숲 그림자 늑대',
    monsterIcon: '🐺',
    monsterHp: 150,
    autoDamage: 30,
    energyCost: 84,
    goldReward: 55,
    rewardItemId: 'wolf-band',
  },
  {
    id: 'forest-4',
    number: 4,
    name: '휘감긴 뿌리',
    monsterName: '뿌리 정령',
    monsterIcon: '🌱',
    monsterHp: 180,
    autoDamage: 36,
    energyCost: 96,
    goldReward: 65,
  },
  {
    id: 'forest-5',
    number: 5,
    name: '이끼 바위터',
    monsterName: '이끼 골렘',
    monsterIcon: '🗿',
    monsterHp: 240,
    autoDamage: 40,
    energyCost: 120,
    goldReward: 90,
    rewardItemId: 'forest-gloves',
    isBoss: true,
  },
  {
    id: 'forest-6',
    number: 6,
    name: '달빛 동굴',
    monsterName: '밤날개 박쥐',
    monsterIcon: '🦇',
    monsterHp: 270,
    autoDamage: 45,
    energyCost: 132,
    goldReward: 100,
  },
  {
    id: 'forest-7',
    number: 7,
    name: '독안개 늪',
    monsterName: '독안개 마녀',
    monsterIcon: '🧙',
    monsterHp: 300,
    autoDamage: 50,
    energyCost: 144,
    goldReward: 120,
    rewardItemId: 'moss-cape',
  },
  {
    id: 'forest-8',
    number: 8,
    name: '고대 나무길',
    monsterName: '고대 나무정령',
    monsterIcon: '🌳',
    monsterHp: 360,
    autoDamage: 60,
    energyCost: 156,
    goldReward: 140,
  },
  {
    id: 'forest-9',
    number: 9,
    name: '수호자의 둥지',
    monsterName: '숲의 수호룡',
    monsterIcon: '🐉',
    monsterHp: 480,
    autoDamage: 60,
    energyCost: 180,
    goldReward: 250,
    rewardItemId: 'forest-crown',
    isBoss: true,
  },
];

export const DAILY_QUESTS: Quest[] = [
  {
    id: 'daily-distance',
    kind: 'daily',
    title: '가볍게 몸풀기',
    description: '오늘 1km 이상 달리기',
    metric: 'distance',
    current: 0.65,
    target: 1,
    rewardLabel: '120 XP',
    rewardIcon: '✦',
  },
  {
    id: 'daily-run',
    kind: 'daily',
    title: '모험의 첫걸음',
    description: '러닝 1회 완료하기',
    metric: 'runs',
    current: 0,
    target: 1,
    rewardLabel: '전투 에너지 80',
    rewardIcon: '⚡',
  },
  {
    id: 'daily-battle',
    kind: 'daily',
    title: '오늘의 사냥',
    description: '몬스터 1회 처치하기',
    metric: 'battle',
    current: 0,
    target: 1,
    rewardLabel: '나무 상자',
    rewardIcon: '▣',
  },
];

export const WEEKLY_QUESTS: Quest[] = [
  {
    id: 'weekly-distance',
    kind: 'weekly',
    title: '이번 주 원정',
    description: '이번 주 누적 10km 달리기',
    metric: 'distance',
    current: 6.4,
    target: 10,
    rewardLabel: '희귀 장비 상자',
    rewardIcon: '◆',
  },
  {
    id: 'weekly-runs',
    kind: 'weekly',
    title: '꾸준한 발걸음',
    description: '이번 주 러닝 3회 완료하기',
    metric: 'runs',
    current: 2,
    target: 3,
    rewardLabel: '500 골드',
    rewardIcon: '●',
  },
];

export const ENDURANCE_MILESTONES: EnduranceMilestone[] = [
  { days: 7, bonus: 1, title: '일주일의 약속' },
  { days: 30, bonus: 2, title: '한 달의 습관' },
  { days: 100, bonus: 3, title: '백일의 러너' },
];

export const ITEMS: GameItem[] = [
  {
    id: 'wood-sword',
    name: '단단한 목검',
    kind: 'weapon',
    rarity: '일반',
    icon: '⚔',
    power: 12,
    description: '첫 모험을 함께하는 가벼운 목검',
    unlocked: true,
  },
  {
    id: 'leaf-jacket',
    name: '새싹 바람막이',
    kind: 'armor',
    rarity: '희귀',
    icon: '♜',
    power: 18,
    description: '숲의 바람을 닮은 초보 모험가 재킷',
    unlocked: true,
  },
  {
    id: 'swift-shoes',
    name: '바람 러닝화',
    kind: 'shoes',
    rarity: '희귀',
    icon: '◒',
    power: 8,
    description: '발걸음이 가벼워지는 모험용 러닝화',
    unlocked: true,
  },
  {
    id: 'forest-gloves',
    name: '숲빛 장갑',
    kind: 'armor',
    rarity: '희귀',
    icon: '🧤',
    power: 16,
    description: '이끼 골렘을 처음 처치하고 얻는 숲의 장갑',
    unlocked: false,
  },
  {
    id: 'wolf-band',
    name: '그림자 늑대 머리띠',
    kind: 'armor',
    rarity: '희귀',
    icon: '🐺',
    power: 11,
    description: '초록숨 숲 3단계 자동사냥 보상',
    unlocked: false,
  },
  {
    id: 'moss-cape',
    name: '이끼빛 망토',
    kind: 'armor',
    rarity: '영웅',
    icon: '🧥',
    power: 22,
    description: '독안개 늪을 돌파한 모험가의 망토',
    unlocked: false,
  },
  {
    id: 'forest-crown',
    name: '숲의 수호관',
    kind: 'armor',
    rarity: '영웅',
    icon: '👑',
    power: 32,
    description: '초록숨 숲의 마지막 수호룡을 처치한 증표',
    unlocked: false,
  },
  {
    id: 'wood-shield',
    name: '연습용 나무 방패',
    kind: 'armor',
    rarity: '일반',
    icon: '🛡️',
    power: 10,
    description: '오늘의 사냥 퀘스트 보상으로 받는 단단한 나무 방패',
    unlocked: false,
  },
  {
    id: 'trail-blade',
    name: '원정대의 검',
    kind: 'weapon',
    rarity: '영웅',
    icon: '🗡️',
    power: 24,
    description: '주간 10km 원정을 완수한 러너에게 주어지는 검',
    unlocked: false,
  },
  {
    id: 'hallabong-hat',
    name: '한라봉 모자',
    kind: 'cosmetic',
    rarity: '지역 한정',
    icon: '🍊',
    power: 0,
    description: '제주에서 달린 러너만 발견할 수 있는 꾸미기 아이템',
    region: '제주특별자치도',
    unlocked: false,
  },
  {
    id: 'seoul-moon-pin',
    name: '한강 달빛 핀',
    kind: 'cosmetic',
    rarity: '지역 한정',
    icon: '🌙',
    power: 0,
    description: '서울의 강변을 오래 달린 러너를 위한 장식',
    region: '서울특별시',
    unlocked: false,
  },
];

export const HIDDEN_ACHIEVEMENTS: HiddenAchievement[] = [
  {
    id: 'jeju-citrus-runner',
    title: '제주의 상큼한 러너',
    hiddenTitle: '???',
    hiddenHint: '바람과 귤 향기가 함께하는 섬에서 발견할 수 있어요.',
    region: '제주특별자치도',
    requiredDistanceKm: 5,
    rewardItemId: 'hallabong-hat',
    unlocked: false,
  },
  {
    id: 'seoul-river-night',
    title: '강을 따라 걷는 달빛',
    hiddenTitle: '???',
    hiddenHint: '도시의 큰 강을 따라 충분히 달리면 빛이 보여요.',
    region: '서울특별시',
    requiredDistanceKm: 10,
    rewardItemId: 'seoul-moon-pin',
    unlocked: false,
  },
];

export function calculateRunRewards(distanceKm: number): RunRewards {
  const safeDistance = Math.max(0, distanceKm);

  return {
    experience: Math.floor(safeDistance * 100),
    battleEnergy: Math.floor(safeDistance * 120),
    questDistance: Math.round(safeDistance * 100) / 100,
  };
}

export function getEnduranceBonus(streakDays: number): number {
  return ENDURANCE_MILESTONES.reduce((total, milestone) => {
    return streakDays >= milestone.days ? total + milestone.bonus : total;
  }, 0);
}

export function getAdventureStageState(clearedStageIds: string[], stageId: string): AdventureStageState {
  if (clearedStageIds.includes(stageId)) {
    return 'cleared';
  }

  const firstUnclearedStage = ADVENTURE_STAGES.find((stage) => !clearedStageIds.includes(stage.id));
  return firstUnclearedStage?.id === stageId ? 'current' : 'locked';
}

export function getAdventureStageById(stageId: string): AdventureStage | undefined {
  return ADVENTURE_STAGES.find((stage) => stage.id === stageId);
}

export function findUnlockedRegionalAchievements(regionDistances: Record<string, number>): HiddenAchievement[] {
  return HIDDEN_ACHIEVEMENTS.filter((achievement) => {
    return (regionDistances[achievement.region] ?? 0) >= achievement.requiredDistanceKm;
  });
}

export function getItemById(itemId: string): GameItem | undefined {
  return ITEMS.find((item) => item.id === itemId);
}
