import { describe, expect, it } from 'vitest';
import { normalizeProfileShareData } from '../../src/domain/profileShare';
import { renderProfileShareHtml } from './profileShare';

describe('프로필 공유 HTML', () => {
  it('동적 OG와 트위터 메타 태그를 완성된 HTML로 제공한다', () => {
    const html = renderProfileShareHtml(normalizeProfileShareData({
      displayName: '지수',
      completedCount: 25,
      tendencyKey: 'kitchen',
    }), 'https://jiptori.vercel.app');

    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('/api/profile-og?');
    expect(html).toContain('우리 집 이모카세');
    expect(html).not.toContain('초대코드');
  });

  it('표시 이름을 HTML에 안전하게 출력한다', () => {
    const html = renderProfileShareHtml(normalizeProfileShareData({
      displayName: '<b>지수</b>',
      completedCount: 2,
      tendencyKey: 'starter',
    }), 'https://jiptori.vercel.app');

    expect(html).toContain('&lt;b&gt;지수&lt;/b&gt;');
    expect(html).not.toContain('<b>지수</b>');
  });
});
