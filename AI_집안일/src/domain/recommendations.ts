import { todayKey } from './date';
import type { Chore, ChoreCategory, HomeProfile, Recurrence } from './types';

interface ChoreTemplate {
  key: string;
  title: string;
  category: ChoreCategory;
  recurrence: Recurrence;
  matches?: (profile: HomeProfile) => boolean;
}

const templates: ChoreTemplate[] = [
  { key: 'dishes', title: '설거지와 싱크대 정리', category: 'kitchen', recurrence: { interval: 1, unit: 'day' } },
  { key: 'waste', title: '분리수거 확인하기', category: 'living', recurrence: { interval: 1, unit: 'week' } },
  { key: 'bathroom', title: '화장실 청소', category: 'cleaning', recurrence: { interval: 1, unit: 'week' } },
  { key: 'floor', title: '바닥 청소', category: 'cleaning', recurrence: { interval: 1, unit: 'week' } },
  { key: 'bedding', title: '침구 세탁', category: 'laundry', recurrence: { interval: 2, unit: 'week' } },
  { key: 'drain', title: '배수구 점검과 청소', category: 'cleaning', recurrence: { interval: 1, unit: 'month' } },
  { key: 'washer', title: '세탁기 통 청소', category: 'laundry', recurrence: { interval: 1, unit: 'month' } },
  { key: 'seasonal', title: '계절 가전 필터 점검', category: 'living', recurrence: { interval: 3, unit: 'month' } },
  {
    key: 'pet-space',
    title: '반려동물 생활공간 청소',
    category: 'pet',
    recurrence: { interval: 1, unit: 'day' },
    matches: (profile) => profile.hasPets,
  },
  {
    key: 'pet-bowl',
    title: '반려동물 식기 세척',
    category: 'pet',
    recurrence: { interval: 1, unit: 'day' },
    matches: (profile) => profile.hasPets,
  },
  {
    key: 'pet-hair',
    title: '반려동물 털 청소',
    category: 'pet',
    recurrence: { interval: 3, unit: 'day' },
    matches: (profile) => profile.hasPets,
  },
  {
    key: 'family-laundry',
    title: '가족 빨래 정리',
    category: 'laundry',
    recurrence: { interval: 2, unit: 'day' },
    matches: (profile) => profile.memberCount >= 3,
  },
];

export function recommendedChores(profile: HomeProfile): Chore[] {
  const now = new Date().toISOString();
  return templates
    .filter((template) => template.matches?.(profile) ?? true)
    .map((template) => ({
      id: `recommended-${template.key}`,
      title: template.title,
      category: template.category,
      recurrence: template.recurrence,
      createdAt: now,
      nextDueDate: todayKey(),
      isCustom: false,
      enabled: true,
    }));
}
