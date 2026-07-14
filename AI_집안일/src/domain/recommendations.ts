import { toDateKey } from './date';
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
  { key: 'ventilation', title: '집 안 환기하기', category: 'living', recurrence: { interval: 1, unit: 'day' } },
  { key: 'waste', title: '분리수거 확인하기', category: 'living', recurrence: { interval: 3, unit: 'day' } },
  { key: 'bathroom', title: '화장실 청소', category: 'cleaning', recurrence: { interval: 1, unit: 'week' } },
  { key: 'floor', title: '바닥 청소', category: 'cleaning', recurrence: { interval: 1, unit: 'week' } },
  { key: 'dust', title: '가구와 선반 먼지 닦기', category: 'cleaning', recurrence: { interval: 1, unit: 'week' } },
  { key: 'towels', title: '수건 교체와 세탁', category: 'laundry', recurrence: { interval: 3, unit: 'day' } },
  { key: 'bedding', title: '침구 세탁', category: 'laundry', recurrence: { interval: 2, unit: 'week' } },
  { key: 'fridge-expiry', title: '냉장고 유통기한 확인', category: 'kitchen', recurrence: { interval: 1, unit: 'week' } },
  { key: 'microwave', title: '전자레인지 내부 청소', category: 'kitchen', recurrence: { interval: 2, unit: 'week' } },
  { key: 'drain', title: '배수구 점검과 청소', category: 'cleaning', recurrence: { interval: 1, unit: 'month' } },
  { key: 'washer', title: '세탁기 통 청소', category: 'laundry', recurrence: { interval: 1, unit: 'month' } },
  { key: 'fridge-deep', title: '냉장고 선반 청소', category: 'kitchen', recurrence: { interval: 1, unit: 'month' } },
  { key: 'supplies', title: '생활용품 재고 확인', category: 'living', recurrence: { interval: 1, unit: 'month' } },
  { key: 'seasonal', title: '계절 가전 필터 점검', category: 'living', recurrence: { interval: 3, unit: 'month' } },
  { key: 'detector', title: '화재감지기와 비상용품 점검', category: 'living', recurrence: { interval: 6, unit: 'month' } },
  {
    key: 'single-food-plan',
    title: '남은 식재료와 식사 계획 확인',
    category: 'kitchen',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.householdType === 'single',
  },
  {
    key: 'single-mail',
    title: '우편물과 택배 상자 정리',
    category: 'living',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.householdType === 'single',
  },
  {
    key: 'couple-shared-space',
    title: '함께 쓰는 공간 정리',
    category: 'living',
    recurrence: { interval: 3, unit: 'day' },
    matches: (profile) => profile.householdType === 'couple',
  },
  {
    key: 'couple-supplies',
    title: '공용 생필품 채우기',
    category: 'living',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.householdType === 'couple',
  },
  {
    key: 'shared-common-area',
    title: '공용 거실과 현관 정리',
    category: 'cleaning',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.householdType === 'shared',
  },
  {
    key: 'shared-fridge',
    title: '공용 냉장고 구역 정리',
    category: 'kitchen',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.householdType === 'shared',
  },
  {
    key: 'shared-consumables',
    title: '공용 소모품 분담 확인',
    category: 'living',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.householdType === 'shared',
  },
  {
    key: 'family-common-area',
    title: '가족 공용공간 정리',
    category: 'living',
    recurrence: { interval: 1, unit: 'day' },
    matches: (profile) => profile.householdType === 'family',
  },
  {
    key: 'family-toys',
    title: '아이 장난감과 학용품 정리',
    category: 'living',
    recurrence: { interval: 1, unit: 'day' },
    matches: (profile) => profile.householdType === 'family',
  },
  {
    key: 'family-bedding',
    title: '가족 침구 교체',
    category: 'laundry',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.householdType === 'family',
  },
  {
    key: 'family-medicine',
    title: '상비약 유효기간 점검',
    category: 'living',
    recurrence: { interval: 3, unit: 'month' },
    matches: (profile) => profile.householdType === 'family',
  },
  {
    key: 'pet-space',
    title: '반려동물 생활공간 청소',
    category: 'pet',
    recurrence: { interval: 1, unit: 'day' },
    matches: (profile) => profile.hasPets,
  },
  {
    key: 'dog-walk-items',
    title: '강아지 산책용품 정리',
    category: 'pet',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.petTypes.includes('dog'),
  },
  {
    key: 'dog-bedding',
    title: '강아지 방석과 담요 세탁',
    category: 'pet',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.petTypes.includes('dog'),
  },
  {
    key: 'dog-toys',
    title: '강아지 장난감 세척',
    category: 'pet',
    recurrence: { interval: 2, unit: 'week' },
    matches: (profile) => profile.petTypes.includes('dog'),
  },
  {
    key: 'cat-litter',
    title: '고양이 화장실 정리',
    category: 'pet',
    recurrence: { interval: 1, unit: 'day' },
    matches: (profile) => profile.petTypes.includes('cat'),
  },
  {
    key: 'cat-tower',
    title: '캣타워와 스크래처 털 청소',
    category: 'pet',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.petTypes.includes('cat'),
  },
  {
    key: 'cat-litter-deep',
    title: '고양이 화장실 전체 세척',
    category: 'pet',
    recurrence: { interval: 1, unit: 'month' },
    matches: (profile) => profile.petTypes.includes('cat'),
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
  const createdAt = new Date();
  const now = createdAt.toISOString();
  return templates
    .filter((template) => template.matches?.(profile) ?? true)
    .map((template, index) => {
      const dueDate = new Date(createdAt);
      const offset = template.recurrence.unit === 'day'
        ? index % template.recurrence.interval
        : template.recurrence.unit === 'week'
          ? index % 7
          : template.recurrence.unit === 'month'
            ? (index * 3) % 28
            : (index * 17) % 90;
      dueDate.setDate(dueDate.getDate() + offset);
      return ({
      id: `recommended-${template.key}`,
      title: template.title,
      category: template.category,
      recurrence: template.recurrence,
      createdAt: now,
      scheduleAnchorDate: toDateKey(dueDate),
      nextDueDate: toDateKey(dueDate),
      isCustom: false,
      enabled: true,
      });
    });
}
