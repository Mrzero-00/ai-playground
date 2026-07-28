import { describe, expect, it } from 'vitest';
import {
  buildProfileShareUrls,
  normalizeProfileShareData,
  profileShareDataFromSearchParams,
  profileShareMeta,
} from './profileShare';

describe('프로필 OG 공유 데이터', () => {
  it('공유 URL에는 공개 프로필 정보만 담는다', () => {
    const data = normalizeProfileShareData({
      displayName: '집토리',
      completedCount: 25,
      tendencyKey: 'kitchen',
    });
    const { pageUrl, ogImageUrl } = buildProfileShareUrls('https://jiptori.vercel.app', data);

    expect(pageUrl).toBe('https://jiptori.vercel.app/share/profile?n=%EC%A7%91%ED%86%A0%EB%A6%AC&c=25&t=kitchen');
    expect(ogImageUrl).toContain('/api/profile-og?');
    expect(pageUrl).not.toContain('home');
    expect(pageUrl).not.toContain('invite');
  });

  it('잘못된 값은 안전한 범위와 기본 유형으로 정리한다', () => {
    const data = profileShareDataFromSearchParams(new URLSearchParams({
      n: '<script>alert(1)</script>',
      c: '999999',
      t: 'unknown',
    }));

    expect(data.displayName).toHaveLength(15);
    expect(data.completedCount).toBe(9999);
    expect(data.tendency.name).toBe('살림 탐험가');
  });

  it('OG 제목과 설명에 레벨·유형·완료 수가 포함된다', () => {
    const data = normalizeProfileShareData({
      displayName: '지수',
      completedCount: 25,
      tendencyKey: 'kitchen',
    });

    expect(profileShareMeta(data)).toMatchObject({
      title: '지수님의 살림 유형은 🍳 우리 집 이모카세',
      description: 'LV.3 부지런한 살림러 · 집안일 25개 완료 · 주특기 요리·주방',
    });
  });
});
