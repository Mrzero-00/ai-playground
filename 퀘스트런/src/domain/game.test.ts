import {
  calculateRunRewards,
  findUnlockedRegionalAchievements,
  getEnduranceBonus,
  getItemById,
  getItemsBySlot,
} from './game';

describe('퀘스트런 성장 규칙', () => {
  it('러닝 거리에 비례해 경험치와 꾸미기 코인을 계산한다', () => {
    expect(calculateRunRewards(3.25)).toEqual({
      experience: 325,
      styleCoins: 130,
      questDistance: 3.25,
    });
  });

  it('음수 거리는 보상에 반영하지 않는다', () => {
    expect(calculateRunRewards(-1)).toEqual({
      experience: 0,
      styleCoins: 0,
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

  it('지역 보상은 코인으로 살 수 없는 꾸미기 아이템이다', () => {
    const item = getItemById('hallabong-hat');

    expect(item?.source).toBe('achievement');
    expect(item?.price).toBe(0);
    expect(item?.slot).toBe('head');
  });

  it('슬롯별로 착용 가능한 아이템을 분류한다', () => {
    const headItems = getItemsBySlot('head');

    expect(headItems).toContainEqual(expect.objectContaining({ id: 'mint-cap' }));
    expect(headItems.every((item) => item.slot === 'head')).toBe(true);
  });

  it('눈·코·입을 각각 독립된 꾸미기 슬롯으로 제공한다', () => {
    expect(getItemsBySlot('eyes')).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'round-eyes' }), expect.objectContaining({ id: 'sparkle-eyes' })])
    );
    expect(getItemsBySlot('nose')).toContainEqual(expect.objectContaining({ id: 'bean-nose' }));
    expect(getItemsBySlot('mouth')).toContainEqual(expect.objectContaining({ id: 'soft-smile' }));
  });
});
