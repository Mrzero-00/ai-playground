export type QuestKind = 'daily' | 'weekly' | 'streak';
export type QuestMetric = 'distance' | 'runs';
export type ItemSlot = 'head' | 'top' | 'shoes' | 'accessory';
export type ItemRarity = '일반' | '희귀' | '영웅' | '지역 한정';
export type ItemSource = 'starter' | 'shop' | 'quest' | 'achievement';

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
  slot: ItemSlot;
  rarity: ItemRarity;
  icon: string;
  price: number;
  description: string;
  source: ItemSource;
  region?: string;
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
  styleCoins: number;
  questDistance: number;
}

export interface EnduranceMilestone {
  days: number;
  bonus: number;
  title: string;
}

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
    title: '오늘의 첫 러닝',
    description: '러닝 1회 완료하기',
    metric: 'runs',
    current: 0,
    target: 1,
    rewardLabel: '러닝 코인 80',
    rewardIcon: '●',
  },
  {
    id: 'daily-distance-3',
    kind: 'daily',
    title: '조금 더 멀리',
    description: '오늘 누적 3km 달리기',
    metric: 'distance',
    current: 0.65,
    target: 3,
    rewardLabel: '러닝 코인 120',
    rewardIcon: '●',
  },
];

export const WEEKLY_QUESTS: Quest[] = [
  {
    id: 'weekly-distance',
    kind: 'weekly',
    title: '이번 주 10km',
    description: '이번 주 누적 10km 달리기',
    metric: 'distance',
    current: 6.4,
    target: 10,
    rewardLabel: '주간 완주 반다나',
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
    rewardLabel: '러닝 코인 300',
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
    id: 'mint-cap',
    name: '민트 러닝 캡',
    slot: 'head',
    rarity: '일반',
    icon: '🧢',
    price: 0,
    description: '루미의 첫 러닝을 함께하는 산뜻한 기본 모자',
    source: 'starter',
  },
  {
    id: 'mint-hoodie',
    name: '민트 후디',
    slot: 'top',
    rarity: '일반',
    icon: '👕',
    price: 0,
    description: '가볍고 편안한 기본 러닝 후디',
    source: 'starter',
  },
  {
    id: 'orange-shoes',
    name: '오렌지 러닝화',
    slot: 'shoes',
    rarity: '일반',
    icon: '👟',
    price: 0,
    description: '통통 튀는 색감의 기본 러닝화',
    source: 'starter',
  },
  {
    id: 'sunny-visor',
    name: '햇살 바이저',
    slot: 'head',
    rarity: '일반',
    icon: '☀️',
    price: 180,
    description: '맑은 날의 러닝을 닮은 노란 바이저',
    source: 'shop',
  },
  {
    id: 'cherry-headphones',
    name: '체리 헤드폰',
    slot: 'head',
    rarity: '희귀',
    icon: '🎧',
    price: 360,
    description: '달리는 리듬을 더 신나게 만들어 주는 헤드폰',
    source: 'shop',
  },
  {
    id: 'cloud-hoodie',
    name: '구름 후디',
    slot: 'top',
    rarity: '희귀',
    icon: '☁️',
    price: 420,
    description: '새벽 구름처럼 포근한 하늘색 러닝 후디',
    source: 'shop',
  },
  {
    id: 'sunset-windbreaker',
    name: '노을 바람막이',
    slot: 'top',
    rarity: '영웅',
    icon: '🌅',
    price: 680,
    description: '노을빛 그라데이션을 담은 특별한 바람막이',
    source: 'shop',
  },
  {
    id: 'star-sneakers',
    name: '별빛 스니커즈',
    slot: 'shoes',
    rarity: '희귀',
    icon: '✨',
    price: 520,
    description: '움직일 때마다 작은 별빛이 반짝이는 러닝화',
    source: 'shop',
  },
  {
    id: 'clover-pin',
    name: '행운의 클로버 핀',
    slot: 'accessory',
    rarity: '일반',
    icon: '🍀',
    price: 140,
    description: '매일의 러닝에 작은 행운을 더하는 핀',
    source: 'shop',
  },
  {
    id: 'rainbow-trail',
    name: '무지개 발자국',
    slot: 'accessory',
    rarity: '영웅',
    icon: '🌈',
    price: 900,
    description: '달린 자리에 무지개빛 추억을 남기는 장식',
    source: 'shop',
  },
  {
    id: 'weekly-bandana',
    name: '주간 완주 반다나',
    slot: 'head',
    rarity: '희귀',
    icon: '🎗️',
    price: 0,
    description: '한 주에 10km를 달린 러너만 받는 완주 기념품',
    source: 'quest',
  },
  {
    id: 'hallabong-hat',
    name: '한라봉 모자',
    slot: 'head',
    rarity: '지역 한정',
    icon: '🍊',
    price: 0,
    description: '제주에서 달린 러너만 발견할 수 있는 꾸미기 아이템',
    source: 'achievement',
    region: '제주특별자치도',
  },
  {
    id: 'seoul-moon-pin',
    name: '한강 달빛 핀',
    slot: 'accessory',
    rarity: '지역 한정',
    icon: '🌙',
    price: 0,
    description: '서울의 강변을 오래 달린 러너를 위한 장식',
    source: 'achievement',
    region: '서울특별시',
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
    styleCoins: Math.floor(safeDistance * 40),
    questDistance: Math.round(safeDistance * 100) / 100,
  };
}

export function getEnduranceBonus(streakDays: number): number {
  return ENDURANCE_MILESTONES.reduce((total, milestone) => {
    return streakDays >= milestone.days ? total + milestone.bonus : total;
  }, 0);
}

export function findUnlockedRegionalAchievements(regionDistances: Record<string, number>): HiddenAchievement[] {
  return HIDDEN_ACHIEVEMENTS.filter((achievement) => {
    return (regionDistances[achievement.region] ?? 0) >= achievement.requiredDistanceKm;
  });
}

export function getItemById(itemId: string): GameItem | undefined {
  return ITEMS.find((item) => item.id === itemId);
}

export function getItemsBySlot(slot: ItemSlot): GameItem[] {
  return ITEMS.filter((item) => item.slot === slot);
}
