import type { ChoreCategory, Home } from './types';

export interface ProfileTendency {
  category: ChoreCategory | null;
  icon: string;
  name: string;
  description: string;
  basis: string | null;
}

export interface ProfileLevel {
  level: number;
  progress: number;
  levelName: string;
  remaining: number;
}

const tendencyOrder: ChoreCategory[] = ['cleaning', 'kitchen', 'laundry', 'living', 'pet', 'etc'];

const tendencies: Record<ChoreCategory, ProfileTendency> = {
  cleaning: {
    category: 'cleaning',
    icon: '🕵️',
    name: '먼지 사냥꾼',
    description: '숨어 있는 먼지와 어질러진 틈을 그냥 지나치지 않아요.',
    basis: '청소·정돈',
  },
  kitchen: {
    category: 'kitchen',
    icon: '🍳',
    name: '우리 집 이모카세',
    description: '요리부터 설거지까지 한 끼의 앞뒤를 야무지게 챙겨요.',
    basis: '요리·주방',
  },
  laundry: {
    category: 'laundry',
    icon: '🧺',
    name: '뽀송 요정',
    description: '옷과 침구를 포근하고 뽀송하게 되돌려 놓아요.',
    basis: '세탁·패브릭',
  },
  living: {
    category: 'living',
    icon: '🎛️',
    name: '살림 컨트롤타워',
    description: '우리 집의 일정과 필요한 일을 한발 먼저 챙겨요.',
    basis: '생활·관리',
  },
  pet: {
    category: 'pet',
    icon: '🐾',
    name: '수석 집사',
    description: '함께 사는 반려동물의 작은 변화까지 다정하게 살펴요.',
    basis: '반려동물 돌봄',
  },
  etc: {
    category: 'etc',
    icon: '🧰',
    name: '집안 해결사',
    description: '그때그때 필요한 일을 발견하고 척척 해결해요.',
    basis: '맞춤 집안일',
  },
};

const starterTendency: ProfileTendency = {
  category: null,
  icon: '🧭',
  name: '살림 탐험가',
  description: '집안일을 하나씩 완료하며 나만의 유형을 찾고 있어요.',
  basis: null,
};

export type ProfileTendencyKey = ChoreCategory | 'starter';

export function profileTendencyByKey(key: string | null | undefined): ProfileTendency {
  return key && key in tendencies ? tendencies[key as ChoreCategory] : starterTendency;
}

export function profileTendencyKey(tendency: ProfileTendency): ProfileTendencyKey {
  return tendency.category ?? 'starter';
}

export function getProfileTendency(homes: Home[], userId: string): ProfileTendency {
  const categoryCounts = new Map<ChoreCategory, number>();

  for (const home of homes) {
    const categoryByChoreId = new Map(home.chores.map((chore) => [chore.id, chore.category]));
    for (const history of home.history) {
      if (history.action !== 'completed' || history.performedByUserId !== userId) continue;
      const category = categoryByChoreId.get(history.choreId);
      if (category) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  let topCategory: ChoreCategory | null = null;
  let topCount = 0;
  for (const category of tendencyOrder) {
    const count = categoryCounts.get(category) ?? 0;
    if (count > topCount) {
      topCategory = category;
      topCount = count;
    }
  }

  return topCategory && topCount >= 3 ? tendencies[topCategory] : starterTendency;
}

export function getProfileLevel(completedCount: number): ProfileLevel {
  const safeCount = Math.max(0, Math.floor(completedCount));
  const level = Math.floor(safeCount / 10) + 1;
  return {
    level,
    progress: (safeCount % 10) * 10,
    levelName: level >= 10 ? '살림 마스터' : level >= 5 ? '생활 루틴 전문가' : level >= 3 ? '부지런한 살림러' : '집안일 새싹',
    remaining: 10 - (safeCount % 10),
  };
}

export function buildProfileShareMessage({
  displayName,
  level,
  levelName,
  tendency,
  completedCount,
  shareUrl,
}: {
  displayName: string;
  level: number;
  levelName: string;
  tendency: ProfileTendency;
  completedCount: number;
  shareUrl?: string | null;
}): string {
  const ownerLabel = displayName === '나' ? '나의' : `${displayName}님의`;
  return [
    `${tendency.icon} ${ownerLabel} 집토리 살림 프로필`,
    `LV.${level} ${levelName}`,
    `살림 유형: ${tendency.name}`,
    tendency.basis ? `주특기: ${tendency.basis}` : '',
    `지금까지 ${completedCount}개의 집안일을 완료했어요.`,
    '',
    shareUrl ?? '',
  ].filter(Boolean).join('\n');
}
