export type AppFeatureTab = 'today' | 'schedule' | 'manage' | 'report' | 'profile';

export const APP_FEATURE_ROUTES = {
  today: '/today',
  schedule: '/schedule',
  manage: '/chores',
  report: '/report',
  profile: '/profile',
} as const satisfies Record<AppFeatureTab, string>;

const tabByPath = new Map<string, AppFeatureTab>([
  ['/', 'today'],
  ...Object.entries(APP_FEATURE_ROUTES).map(([tab, path]) => [path, tab as AppFeatureTab] as const),
]);

export function appFeatureTabFromPath(pathname: string): AppFeatureTab {
  const normalized = `/${pathname}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  return tabByPath.get(normalized) ?? 'today';
}
