import { describe, expect, it } from 'vitest';
import { isCoreRecommendation, previewAllRecommendedChores, recommendationPriority } from './recommendations';
import type { HomeProfile } from './types';

const profile: HomeProfile = {
  householdType: 'single',
  housingTenure: 'monthly-rent',
  memberCount: 1,
  hasPets: false,
  petTypes: [],
  childAges: [],
  roomCount: 1,
  bathroomCount: 1,
  completed: true,
};

describe('요리 집안일 추천', () => {
  it('한 끼 요리는 기본 업무로 바로 추가한다', () => {
    expect(isCoreRecommendation('recommended-cook-meal')).toBe(true);
  });

  it('선택형 요리 업무가 일반 생활 추천보다 먼저 보인다', () => {
    const chores = previewAllRecommendedChores();
    const ingredientPrep = chores.find((chore) => chore.id === 'recommended-ingredient-prep');
    const generalRoutine = chores.find((chore) => chore.id === 'recommended-dust');

    expect(ingredientPrep).toBeDefined();
    expect(generalRoutine).toBeDefined();
    expect(recommendationPriority(ingredientPrep!, profile)).toBeLessThan(recommendationPriority(generalRoutine!, profile));
  });
});
