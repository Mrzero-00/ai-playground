import { calculateRunRewards, findUnlockedRegionalAchievements, getEnduranceBonus, getItemById } from './game';

describe('퀘스트런 성장 규칙', () => {
  it('러닝 거리에 비례해 경험치와 전투 에너지를 계산한다', () => {
    expect(calculateRunRewards(3.25)).toEqual({
      experience: 325,
      battleEnergy: 390,
      questDistance: 3.25,
    });
  });

  it('음수 거리는 보상에 반영하지 않는다', () => {
    expect(calculateRunRewards(-1)).toEqual({
      experience: 0,
      battleEnergy: 0,
      questDistance: 0,
    });
  });

  it('연속 달성 마일스톤을 누적해 지구력을 올린다', () => {
    expect(getEnduranceBonus(6)).toBe(0);
    expect(getEnduranceBonus(7)).toBe(1);
    expect(getEnduranceBonus(30)).toBe(3);
    expect(getEnduranceBonus(100)).toBe(6);
  });

  it('지역에서 요구 거리를 채운 숨은 업적만 공개한다', () => {
    const achievements = findUnlockedRegionalAchievements({
      제주특별자치도: 5.4,
      서울특별시: 3,
    });

    expect(achievements.map((achievement) => achievement.id)).toEqual(['jeju-citrus-runner']);
  });

  it('지역 보상은 전투 성능과 무관한 꾸미기 아이템이다', () => {
    const item = getItemById('hallabong-hat');

    expect(item?.kind).toBe('cosmetic');
    expect(item?.power).toBe(0);
  });
});
