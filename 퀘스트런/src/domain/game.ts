export type QuestKind = 'daily' | 'weekly' | 'streak';
export type QuestMetric = 'distance' | 'runs';
export type AvatarPreset = 'lumi' | 'mori';
export type ItemSlot =
  | 'eyes'
  | 'nose'
  | 'mouth'
  | 'hair'
  | 'head'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'glasses'
  | 'bag'
  | 'watch';
export type ItemRarity = '일반' | '희귀' | '영웅' | '지역 한정' | '월간 한정';
export type ItemSource = 'starter' | 'shop' | 'quest' | 'achievement' | 'group';
export type AchievementMetric =
  | 'streak'
  | 'total-distance'
  | 'total-runs'
  | 'region-distance'
  | 'solo-group-distance';

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

export interface Achievement {
  id: string;
  title: string;
  description: string;
  hint: string;
  metric: AchievementMetric;
  target: number;
  hidden?: boolean;
  region?: string;
  rewardItemId?: string;
  unlockSlot?: ItemSlot;
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

export interface RunnerGrowthStage {
  id: 'sprout' | 'steady' | 'trailblazer' | 'legend';
  title: string;
  minLevel: number;
  nextLevel: number | null;
  description: string;
}

export interface AvatarPresetDefinition {
  id: AvatarPreset;
  name: string;
  label: string;
  description: string;
  icon: string;
}

export const AVATAR_PRESETS: AvatarPresetDefinition[] = [
  {
    id: 'lumi',
    name: '루미',
    label: '여자 러너',
    description: '풍성한 웨이브 헤어의 새싹 러너',
    icon: '🌸',
  },
  {
    id: 'mori',
    name: '모리',
    label: '남자 러너',
    description: '트랙 재킷과 일자 쇼츠의 새싹 러너',
    icon: '🌿',
  },
];

export function getAvatarPresetDefinition(preset: AvatarPreset): AvatarPresetDefinition {
  return AVATAR_PRESETS.find((candidate) => candidate.id === preset) ?? AVATAR_PRESETS[0]!;
}

export const BASE_ITEM_SLOTS: ItemSlot[] = [
  'eyes',
  'nose',
  'mouth',
  'hair',
  'head',
  'top',
  'bottom',
  'shoes',
];
export const EXTRA_ITEM_SLOTS: ItemSlot[] = ['glasses', 'bag', 'watch'];
export const ALL_ITEM_SLOTS: ItemSlot[] = [...BASE_ITEM_SLOTS, ...EXTRA_ITEM_SLOTS];

export const SLOT_LABELS: Record<ItemSlot, string> = {
  eyes: '눈',
  nose: '코',
  mouth: '입',
  hair: '헤어스타일',
  head: '머리장식',
  top: '상의',
  bottom: '하의',
  shoes: '신발',
  glasses: '안경',
  bag: '가방',
  watch: '시계',
};

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

export const RUNNER_GROWTH_STAGES: RunnerGrowthStage[] = [
  {
    id: 'sprout',
    title: '새싹 러너',
    minLevel: 1,
    nextLevel: 10,
    description: '달리기의 즐거움을 발견하고 있어요.',
  },
  {
    id: 'steady',
    title: '꾸준한 러너',
    minLevel: 10,
    nextLevel: 25,
    description: '매일의 발걸음이 루미를 단단하게 만들어요.',
  },
  {
    id: 'trailblazer',
    title: '길을 여는 러너',
    minLevel: 25,
    nextLevel: 50,
    description: '새로운 길과 업적을 스스로 만들어 가요.',
  },
  {
    id: 'legend',
    title: '전설의 러너',
    minLevel: 50,
    nextLevel: null,
    description: '모든 러너가 기억하는 특별한 발자국이에요.',
  },
];

export const ITEMS: GameItem[] = [
  {
    id: 'round-eyes',
    name: '포근한 동그란 눈',
    slot: 'eyes',
    rarity: '일반',
    icon: '● ●',
    price: 0,
    description: '루미의 따뜻하고 순한 기본 눈매',
    source: 'starter',
  },
  {
    id: 'bean-nose',
    name: '작은 콩코',
    slot: 'nose',
    rarity: '일반',
    icon: '•',
    price: 0,
    description: '숲마을 친구처럼 작고 귀여운 기본 코',
    source: 'starter',
  },
  {
    id: 'soft-smile',
    name: '포근한 미소',
    slot: 'mouth',
    rarity: '일반',
    icon: '⌣',
    price: 0,
    description: '달리기 전에도 기분 좋아지는 기본 미소',
    source: 'starter',
  },
  {
    id: 'chestnut-ponytail',
    name: '밤색 기본 헤어',
    slot: 'hair',
    rarity: '일반',
    icon: '🤎',
    price: 0,
    description: '캐릭터 타입에 맞춰 웨이브 또는 쇼트 스타일로 바뀌는 기본 헤어',
    source: 'starter',
  },
  {
    id: 'mint-cap',
    name: '새싹 러닝 핀',
    slot: 'head',
    rarity: '일반',
    icon: '🌱',
    price: 0,
    description: '루미의 첫 러닝을 함께하는 산뜻한 기본 머리장식',
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
    id: 'navy-shorts',
    name: '네이비 러닝 쇼츠',
    slot: 'bottom',
    rarity: '일반',
    icon: '🩳',
    price: 0,
    description: '어떤 상의와도 잘 어울리는 기본 러닝 쇼츠',
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
    id: 'plum-twintail',
    name: '플럼 러너 헤어',
    slot: 'hair',
    rarity: '희귀',
    icon: '🎀',
    price: 460,
    description: '루미는 리본 트윈테일, 모리는 코랄 핀 쇼트 헤어로 연출되는 자주빛 스타일',
    source: 'shop',
  },
  {
    id: 'silver-wolf-hair',
    name: '실버 클라우드 울프컷',
    slot: 'hair',
    rarity: '영웅',
    icon: '🩶',
    price: 640,
    description: '남녀 캐릭터 모두에게 어울리는 은빛 레이어드 울프보브',
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
    id: 'berry-leggings',
    name: '베리 러닝 팬츠',
    slot: 'bottom',
    rarity: '희귀',
    icon: '🟣',
    price: 390,
    description: '루미는 레깅스, 모리는 일자 쇼츠로 바뀌는 보랏빛 러닝 팬츠',
    source: 'shop',
  },
  {
    id: 'midnight-track-pants',
    name: '미드나잇 트랙팬츠',
    slot: 'bottom',
    rarity: '영웅',
    icon: '🌌',
    price: 560,
    description: '민트 라인과 코랄 지퍼 포인트를 더한 남녀 공용 조거팬츠',
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
    id: 'mint-comet-shoes',
    name: '민트 코멧 러닝화',
    slot: 'shoes',
    rarity: '영웅',
    icon: '☄️',
    price: 620,
    description: '민트 혜성 문양과 코랄 밑창을 더한 남녀 공용 러닝화',
    source: 'shop',
  },
  {
    id: 'sparkle-eyes',
    name: '반짝이는 호기심 눈',
    slot: 'eyes',
    rarity: '희귀',
    icon: '✦ ✦',
    price: 220,
    description: '새로운 길을 발견했을 때처럼 반짝이는 눈',
    source: 'shop',
  },
  {
    id: 'smiley-eyes',
    name: '싱긋 웃는 눈',
    slot: 'eyes',
    rarity: '일반',
    icon: '⌒ ⌒',
    price: 280,
    description: '친구를 만나면 저절로 휘어지는 다정한 눈매',
    source: 'shop',
  },
  {
    id: 'sleepy-eyes',
    name: '나른한 새벽 눈',
    slot: 'eyes',
    rarity: '희귀',
    icon: '— —',
    price: 360,
    description: '이른 아침 러닝의 포근한 졸음을 담은 눈매',
    source: 'shop',
  },
  {
    id: 'peach-nose',
    name: '복숭아 세모코',
    slot: 'nose',
    rarity: '일반',
    icon: '▼',
    price: 160,
    description: '볼의 홍조와 잘 어울리는 작은 복숭아빛 코',
    source: 'shop',
  },
  {
    id: 'button-nose',
    name: '동글 단추코',
    slot: 'nose',
    rarity: '희귀',
    icon: '●',
    price: 240,
    description: '도토리 단추처럼 동그랗고 선명한 코',
    source: 'shop',
  },
  {
    id: 'leaf-nose',
    name: '새싹 잎코',
    slot: 'nose',
    rarity: '희귀',
    icon: '◆',
    price: 320,
    description: '루미의 새싹 정체성을 담은 초록빛 코',
    source: 'shop',
  },
  {
    id: 'cat-mouth',
    name: '말랑 고양이입',
    slot: 'mouth',
    rarity: '일반',
    icon: 'ω',
    price: 200,
    description: '장난스러운 표정을 만드는 말랑한 입모양',
    source: 'shop',
  },
  {
    id: 'open-smile',
    name: '활짝 웃는 입',
    slot: 'mouth',
    rarity: '희귀',
    icon: '▽',
    price: 280,
    description: '오늘의 러닝이 즐거웠다는 활짝 열린 미소',
    source: 'shop',
  },
  {
    id: 'surprised-mouth',
    name: '깜짝 동그란 입',
    slot: 'mouth',
    rarity: '희귀',
    icon: '○',
    price: 340,
    description: '새 업적을 발견한 순간의 귀여운 놀람',
    source: 'shop',
  },
  {
    id: 'daily-runner-glasses',
    name: '꾸준함 안경',
    slot: 'glasses',
    rarity: '영웅',
    icon: '🤓',
    price: 0,
    description: '일주일 동안 모든 일일 퀘스트를 마친 러너의 안경',
    source: 'achievement',
  },
  {
    id: 'record-backpack',
    name: '100km 기록 가방',
    slot: 'bag',
    rarity: '영웅',
    icon: '🎒',
    price: 0,
    description: '누적 100km의 추억을 가득 담은 기록 가방',
    source: 'achievement',
  },
  {
    id: 'seoul-moon-watch',
    name: '한강 달빛 시계',
    slot: 'watch',
    rarity: '지역 한정',
    icon: '⌚',
    price: 0,
    description: '서울에서 10km를 달린 러너만 착용하는 달빛 시계',
    source: 'achievement',
    region: '서울특별시',
  },
  {
    id: 'pink-sunglasses',
    name: '핑크 선글라스',
    slot: 'glasses',
    rarity: '희귀',
    icon: '🕶️',
    price: 420,
    description: '안경 슬롯을 해금한 러너를 위한 경쾌한 선글라스',
    source: 'shop',
  },
  {
    id: 'clover-backpack',
    name: '클로버 미니백',
    slot: 'bag',
    rarity: '희귀',
    icon: '🍀',
    price: 560,
    description: '행운을 등에 메고 달릴 수 있는 미니백',
    source: 'shop',
  },
  {
    id: 'pace-watch',
    name: '페이스 워치',
    slot: 'watch',
    rarity: '영웅',
    icon: '⏱️',
    price: 720,
    description: '오늘의 속도를 기억해 주는 러너 전용 시계',
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
    id: 'monthly-comet-crown',
    name: '월간 혜성 크라운',
    slot: 'head',
    rarity: '월간 한정',
    icon: '☄️',
    price: 0,
    description: '팀과 함께 월간 400km를 완주한 러너에게만 주어지는 크라운',
    source: 'group',
  },
  {
    id: 'solo-star-glasses',
    name: '솔로 스타 글라스',
    slot: 'glasses',
    rarity: '월간 한정',
    icon: '🌟',
    price: 0,
    description: '400km 그룹 퀘스트를 혼자 완주한 러너의 숨겨진 증표',
    source: 'achievement',
  },
];

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'seven-day-promise',
    title: '7일의 약속',
    description: '7일 연속으로 모든 일일 퀘스트를 완료했어요.',
    hint: '일일 퀘스트를 빠짐없이 이어가 보세요.',
    metric: 'streak',
    target: 7,
    rewardItemId: 'daily-runner-glasses',
    unlockSlot: 'glasses',
  },
  {
    id: 'hundred-km-memory',
    title: '100km의 기억',
    description: '누적 러닝 거리 100km를 달성했어요.',
    hint: '모든 러닝 기록의 거리가 차곡차곡 쌓여요.',
    metric: 'total-distance',
    target: 100,
    rewardItemId: 'record-backpack',
    unlockSlot: 'bag',
  },
  {
    id: 'jeju-citrus-runner',
    title: '제주의 상큼한 러너',
    description: '제주에서 누적 5km를 달렸어요.',
    hint: '바람과 귤 향기가 함께하는 섬에서 달려 보세요.',
    metric: 'region-distance',
    region: '제주특별자치도',
    target: 5,
    hidden: true,
    rewardItemId: 'hallabong-hat',
  },
  {
    id: 'seoul-river-night',
    title: '강을 따라 걷는 달빛',
    description: '서울에서 누적 10km를 달렸어요.',
    hint: '도시의 큰 강을 따라 충분히 달리면 빛이 보여요.',
    metric: 'region-distance',
    region: '서울특별시',
    target: 10,
    hidden: true,
    rewardItemId: 'seoul-moon-watch',
    unlockSlot: 'watch',
  },
  {
    id: 'solo-is-my-team',
    title: '혼자여도 한 팀',
    description: '월간 400km 그룹 퀘스트를 혼자 완주했어요.',
    hint: '함께하는 퀘스트에는 아무도 예상하지 못한 길도 있어요.',
    metric: 'solo-group-distance',
    target: 400,
    hidden: true,
    rewardItemId: 'solo-star-glasses',
    unlockSlot: 'glasses',
  },
];

// 이전 화면과 저장 데이터에서 사용하던 이름을 호환한다.
export const HIDDEN_ACHIEVEMENTS = ACHIEVEMENTS.filter((achievement) => achievement.hidden);

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

export function getRunnerGrowthStage(level: number): RunnerGrowthStage {
  return [...RUNNER_GROWTH_STAGES]
    .reverse()
    .find((stage) => level >= stage.minLevel) ?? RUNNER_GROWTH_STAGES[0]!;
}

export function findUnlockedRegionalAchievements(regionDistances: Record<string, number>): Achievement[] {
  return ACHIEVEMENTS.filter(
    (achievement) =>
      achievement.metric === 'region-distance' &&
      (regionDistances[achievement.region ?? ''] ?? 0) >= achievement.target
  );
}

export function getItemById(itemId: string): GameItem | undefined {
  return ITEMS.find((item) => item.id === itemId);
}

export function getItemsBySlot(slot: ItemSlot): GameItem[] {
  return ITEMS.filter((item) => item.slot === slot);
}
