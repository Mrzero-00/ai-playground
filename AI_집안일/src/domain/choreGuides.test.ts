import { describe, expect, it } from 'vitest';
import { guideForChore } from './choreGuides';
import { previewAllRecommendedChores } from './recommendations';

describe('집안일 가이드', () => {
  it('추천되는 모든 업무에 준비물·순서·주의사항이 있다', () => {
    const chores = previewAllRecommendedChores();
    const missing = chores.filter((chore) => !guideForChore(chore.title)).map((chore) => chore.title);
    expect(missing).toEqual([]);

    for (const chore of chores) {
      const guide = guideForChore(chore.title);
      expect(guide?.supplies.length, chore.title).toBeGreaterThanOrEqual(2);
      expect(guide?.steps.length, chore.title).toBeGreaterThanOrEqual(4);
      expect(guide?.cautions.length, chore.title).toBeGreaterThanOrEqual(2);
    }
  });

  it('고양이 화장실 가이드는 모래 보충과 안전 주의를 포함한다', () => {
    const guide = guideForChore('고양이 화장실 정리');
    expect(guide?.supplies.join(' ')).toContain('고양이 모래');
    expect(guide?.steps.join(' ')).toContain('모래를 보충');
    expect(guide?.cautions.join(' ')).toContain('임신');
  });
});
