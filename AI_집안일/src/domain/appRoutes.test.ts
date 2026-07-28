import { describe, expect, it } from 'vitest';
import { APP_FEATURE_ROUTES, appFeatureTabFromPath } from './appRoutes';

describe('앱인토스 앱 내 기능 경로', () => {
  it.each([
    ['/', 'today'],
    [APP_FEATURE_ROUTES.today, 'today'],
    [`${APP_FEATURE_ROUTES.schedule}/`, 'schedule'],
    [APP_FEATURE_ROUTES.manage, 'manage'],
    [APP_FEATURE_ROUTES.report, 'report'],
    [APP_FEATURE_ROUTES.profile, 'profile'],
  ] as const)('%s 경로를 %s 탭으로 연결한다', (path, tab) => {
    expect(appFeatureTabFromPath(path)).toBe(tab);
  });

  it('알 수 없는 경로는 오늘 탭으로 안전하게 연결한다', () => {
    expect(appFeatureTabFromPath('/unknown')).toBe('today');
  });
});
