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

  it('주요 가전은 부위별 관리 업무로 나뉜다', () => {
    const titles = previewAllRecommendedChores().map((chore) => chore.title);
    expect(titles).toEqual(expect.arrayContaining([
      '세탁기 통 청소',
      '세탁기 세제함·고무패킹 청소',
      '세탁기 배수필터 청소',
      '건조기 필터 청소',
      '건조기 드럼·습도센서 닦기',
      '건조기 열교환기 점검',
      '식기세척기 필터·분사구 청소',
      '로봇청소기 브러시·센서 청소',
      '에어컨 필터 청소',
    ]));
  });

  it('요리와 식재료 관리 업무는 각각 알맞은 가이드를 제공한다', () => {
    const titles = previewAllRecommendedChores().map((chore) => chore.title);
    expect(titles).toEqual(expect.arrayContaining([
      '한 끼 요리하고 식탁 차리기',
      '식재료 손질·소분하기',
      '남은 음식 정리하고 보관하기',
    ]));
    expect(guideForChore('한 끼 요리하고 식탁 차리기')?.cautions.join(' ')).toContain('교차 오염');
    expect(guideForChore('남은 음식 정리하고 보관하기')?.steps.join(' ')).toContain('조리 날짜');
  });
});
