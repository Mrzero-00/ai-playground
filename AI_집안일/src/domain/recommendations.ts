import { toDateKey } from './date';
import type { Chore, ChoreCategory, HomeProfile, Recurrence } from './types';

interface ChoreTemplate {
  key: string;
  title: string;
  category: ChoreCategory;
  icon?: string;
  recurrence: Recurrence;
  matches?: (profile: HomeProfile) => boolean;
}

const templates: ChoreTemplate[] = [
  { key: 'dishes', title: '설거지와 싱크대 정리', category: 'kitchen', recurrence: { interval: 1, unit: 'day' } },
  { key: 'cook-meal', title: '한 끼 요리하고 식탁 차리기', category: 'kitchen', icon: '🍳', recurrence: { interval: 1, unit: 'day' } },
  { key: 'ingredient-prep', title: '식재료 손질·소분하기', category: 'kitchen', icon: '🥕', recurrence: { interval: 1, unit: 'week' } },
  { key: 'leftover-storage', title: '남은 음식 정리하고 보관하기', category: 'kitchen', icon: '🥡', recurrence: { interval: 3, unit: 'day' } },
  { key: 'ventilation', title: '집 안 환기하기', category: 'living', recurrence: { interval: 1, unit: 'day' } },
  { key: 'waste', title: '분리수거 확인하기', category: 'living', recurrence: { interval: 3, unit: 'day' } },
  { key: 'bathroom', title: '화장실 청소', category: 'cleaning', recurrence: { interval: 1, unit: 'week' } },
  { key: 'floor', title: '바닥 청소', category: 'cleaning', recurrence: { interval: 1, unit: 'week' } },
  { key: 'dust', title: '가구와 선반 먼지 닦기', category: 'cleaning', recurrence: { interval: 1, unit: 'week' } },
  { key: 'towels', title: '수건 교체와 세탁', category: 'laundry', recurrence: { interval: 3, unit: 'day' } },
  { key: 'bedding', title: '침구 세탁', category: 'laundry', recurrence: { interval: 2, unit: 'week' } },
  { key: 'fridge-expiry', title: '냉장고 유통기한 확인', category: 'kitchen', recurrence: { interval: 1, unit: 'week' } },
  { key: 'microwave', title: '전자레인지 내부 청소', category: 'kitchen', icon: '📻', recurrence: { interval: 2, unit: 'week' } },
  { key: 'drain', title: '배수구 점검과 청소', category: 'cleaning', recurrence: { interval: 1, unit: 'month' } },
  { key: 'washer', title: '세탁기 통 청소', category: 'laundry', icon: '🫧', recurrence: { interval: 1, unit: 'month' } },
  { key: 'washer-drawer-gasket', title: '세탁기 세제함·고무패킹 청소', category: 'laundry', icon: '🧼', recurrence: { interval: 2, unit: 'week' } },
  { key: 'washer-drain-filter', title: '세탁기 배수필터 청소', category: 'laundry', icon: '🌀', recurrence: { interval: 1, unit: 'month' } },
  { key: 'dryer-filter', title: '건조기 필터 청소', category: 'laundry', icon: '🧺', recurrence: { interval: 1, unit: 'week' } },
  { key: 'dryer-drum-sensor', title: '건조기 드럼·습도센서 닦기', category: 'laundry', icon: '♨️', recurrence: { interval: 1, unit: 'month' } },
  { key: 'dryer-condenser', title: '건조기 열교환기 점검', category: 'laundry', icon: '🌬️', recurrence: { interval: 1, unit: 'month' } },
  { key: 'dishwasher-filter', title: '식기세척기 필터·분사구 청소', category: 'kitchen', icon: '🍽️', recurrence: { interval: 1, unit: 'month' } },
  { key: 'range-hood-filter', title: '주방 후드 기름필터 청소', category: 'kitchen', icon: '🍳', recurrence: { interval: 1, unit: 'month' } },
  { key: 'vacuum-filter', title: '청소기 먼지통·필터 청소', category: 'cleaning', icon: '🧹', recurrence: { interval: 2, unit: 'week' } },
  { key: 'robot-vacuum', title: '로봇청소기 브러시·센서 청소', category: 'cleaning', icon: '🤖', recurrence: { interval: 1, unit: 'week' } },
  { key: 'air-purifier-filter', title: '공기청정기 프리필터 청소', category: 'living', icon: '🌿', recurrence: { interval: 2, unit: 'week' } },
  { key: 'air-conditioner-filter', title: '에어컨 필터 청소', category: 'living', icon: '❄️', recurrence: { interval: 1, unit: 'month' } },
  { key: 'dehumidifier-care', title: '제습기 물통·필터 청소', category: 'living', icon: '💧', recurrence: { interval: 1, unit: 'week' } },
  { key: 'fridge-deep', title: '냉장고 선반 청소', category: 'kitchen', recurrence: { interval: 1, unit: 'month' } },
  { key: 'seasonal', title: '계절 가전 필터 점검', category: 'living', recurrence: { interval: 3, unit: 'month' } },
  { key: 'detector', title: '화재감지기와 비상용품 점검', category: 'living', recurrence: { interval: 6, unit: 'month' } },
  { key: 'rent-condition-log', title: '집 상태와 수리 필요 항목 기록', category: 'living', recurrence: { interval: 3, unit: 'month' }, matches: (p) => p.housingTenure === 'monthly-rent' || p.housingTenure === 'jeonse' },
  { key: 'rent-contract-check', title: '임대차 계약·보증 관련 일정 확인', category: 'living', recurrence: { interval: 3, unit: 'month' }, matches: (p) => p.housingTenure === 'monthly-rent' || p.housingTenure === 'jeonse' },
  { key: 'monthly-rent-payment', title: '월세 납부와 관리비 내역 확인', category: 'living', recurrence: { interval: 1, unit: 'month' }, matches: (p) => p.housingTenure === 'monthly-rent' },
  { key: 'jeonse-rights-check', title: '전세 보증과 계약 갱신 일정 확인', category: 'living', recurrence: { interval: 3, unit: 'month' }, matches: (p) => p.housingTenure === 'jeonse' },
  { key: 'owned-maintenance-budget', title: '주택 수선 항목과 관리 예산 점검', category: 'living', recurrence: { interval: 3, unit: 'month' }, matches: (p) => p.housingTenure === 'owned' },
  { key: 'owned-exterior-check', title: '창호·벽면·누수 흔적 점검', category: 'living', recurrence: { interval: 6, unit: 'month' }, matches: (p) => p.housingTenure === 'owned' },
  {
    key: 'single-food-plan',
    title: '남은 식재료와 식사 계획 확인',
    category: 'kitchen',
    recurrence: { interval: 1, unit: 'week' },
    matches: (profile) => profile.householdType === 'single',
  },
  { key: 'baby-feeding-items', title: '아기 수유용품 세척과 건조', category: 'kitchen', recurrence: { interval: 1, unit: 'day' }, matches: (p) => (p.childAges ?? []).some((age) => age < 2) },
  { key: 'baby-changing-area', title: '기저귀 교환 공간 정리와 소독', category: 'cleaning', recurrence: { interval: 1, unit: 'day' }, matches: (p) => (p.childAges ?? []).some((age) => age < 3) },
  { key: 'baby-laundry', title: '영유아 의류와 침구 세탁', category: 'laundry', recurrence: { interval: 2, unit: 'day' }, matches: (p) => (p.childAges ?? []).some((age) => age < 3) },
  { key: 'baby-floor-safety', title: '바닥 이물질과 삼킴 위험 물건 확인', category: 'living', recurrence: { interval: 1, unit: 'day' }, matches: (p) => (p.childAges ?? []).some((age) => age < 4) },
  { key: 'toddler-toys', title: '유아 장난감 세척과 파손 확인', category: 'living', recurrence: { interval: 1, unit: 'week' }, matches: (p) => (p.childAges ?? []).some((age) => age >= 2 && age < 7) },
  { key: 'child-bag', title: '아이 가방·준비물과 알림장 확인', category: 'living', recurrence: { interval: 1, unit: 'day' }, matches: (p) => (p.childAges ?? []).some((age) => age >= 5 && age < 14) },
  { key: 'child-desk', title: '아이 책상과 학용품 정리', category: 'living', recurrence: { interval: 1, unit: 'week' }, matches: (p) => (p.childAges ?? []).some((age) => age >= 7 && age < 19) },
  { key: 'child-clothes-size', title: '아이 옷·신발 사이즈와 계절옷 점검', category: 'laundry', recurrence: { interval: 3, unit: 'month' }, matches: (p) => (p.childAges ?? []).some((age) => age < 19) },
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
    matches: (profile) => (profile.childAges ?? []).length > 0,
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
  { key: 'dog-walk', title: '강아지 산책과 배변 봉투 챙기기', category: 'pet', recurrence: { interval: 1, unit: 'day' }, matches: (profile) => profile.petTypes.includes('dog') },
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
  { key: 'cat-water', title: '고양이 물그릇 세척과 물 교체', category: 'pet', recurrence: { interval: 1, unit: 'day' }, matches: (profile) => profile.petTypes.includes('cat') },
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
  { key: 'multi-pet-supplies', title: '반려동물별 사료와 소모품 재고 확인', category: 'pet', recurrence: { interval: 1, unit: 'week' }, matches: (p) => Object.values(p.petCounts ?? {}).reduce<number>((sum, count) => sum + (count ?? 0), 0) >= 2 },
  { key: 'fish-water', title: '어항 수질과 수온 확인', category: 'pet', recurrence: { interval: 1, unit: 'day' }, matches: (p) => p.petTypes.includes('fish') },
  { key: 'fish-tank', title: '어항 부분 환수와 여과기 점검', category: 'pet', recurrence: { interval: 1, unit: 'week' }, matches: (p) => p.petTypes.includes('fish') },
  { key: 'bird-cage', title: '새장 바닥과 모이통 청소', category: 'pet', recurrence: { interval: 2, unit: 'day' }, matches: (p) => p.petTypes.includes('bird') },
  { key: 'bird-enrichment', title: '횃대와 장난감 상태 확인', category: 'pet', recurrence: { interval: 1, unit: 'week' }, matches: (p) => p.petTypes.includes('bird') },
  { key: 'small-animal-bedding', title: '소동물 깔짚 오염 구역 정리', category: 'pet', recurrence: { interval: 2, unit: 'day' }, matches: (p) => p.petTypes.includes('small-animal') },
  { key: 'small-animal-cage', title: '소동물 케이지 전체 청소', category: 'pet', recurrence: { interval: 1, unit: 'week' }, matches: (p) => p.petTypes.includes('small-animal') },
  { key: 'reptile-enclosure', title: '파충류 사육장 온도·습도 확인', category: 'pet', recurrence: { interval: 1, unit: 'day' }, matches: (p) => p.petTypes.includes('reptile') },
  { key: 'reptile-deep-clean', title: '파충류 사육장과 급수 용기 청소', category: 'pet', recurrence: { interval: 1, unit: 'week' }, matches: (p) => p.petTypes.includes('reptile') },
  {
    key: 'family-laundry',
    title: '가족 빨래 정리',
    category: 'laundry',
    recurrence: { interval: 2, unit: 'day' },
    matches: (profile) => profile.memberCount >= 3,
  },
];

const coreTemplateIds = new Set([
  'recommended-dishes',
  'recommended-cook-meal',
  'recommended-ventilation',
  'recommended-waste',
  'recommended-bathroom',
  'recommended-floor',
  'recommended-towels',
  'recommended-bedding',
  'recommended-fridge-expiry',
]);

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
      icon: template.icon,
      recurrence: template.recurrence,
      createdAt: now,
      scheduleAnchorDate: toDateKey(dueDate),
      nextDueDate: toDateKey(dueDate),
      isCustom: false,
      enabled: true,
      });
    });
}

/** 로컬 가이드 QA에서 프로필 조건과 무관하게 전체 템플릿을 확인한다. */
export function previewAllRecommendedChores(): Chore[] {
  const createdAt = new Date();
  const now = createdAt.toISOString();
  const dueDate = toDateKey(createdAt);
  return templates.map((template) => ({
    id: `recommended-${template.key}`,
    title: template.title,
    category: template.category,
    icon: template.icon,
    recurrence: template.recurrence,
    createdAt: now,
    scheduleAnchorDate: dueDate,
    nextDueDate: dueDate,
    isCustom: false,
    enabled: true,
  }));
}

export function isCoreRecommendation(choreId: string): boolean {
  return coreTemplateIds.has(choreId);
}

export function recommendationPriority(chore: Chore, profile: HomeProfile): number {
  const id = chore.id;
  if ((profile.childAges ?? []).length && /(baby|child|toddler|family-toys)/.test(id)) return 0;
  if (profile.hasPets && /(pet|dog|cat|fish|bird|animal|reptile)/.test(id)) return 0;
  if (profile.housingTenure === 'monthly-rent' && /(rent-condition|rent-contract|monthly-rent)/.test(id)) return 1;
  if (profile.housingTenure === 'jeonse' && /(rent-condition|rent-contract|jeonse)/.test(id)) return 1;
  if (profile.housingTenure === 'owned' && /owned/.test(id)) return 1;
  if (/(washer|dryer|dishwasher|range-hood|vacuum|air-purifier|air-conditioner|dehumidifier|microwave|fridge-deep|seasonal)/.test(id)) return 1;
  if (/(ingredient-prep|leftover-storage)/.test(id)) return 1;
  if (id.includes(profile.householdType)) return 3;
  return 4;
}
