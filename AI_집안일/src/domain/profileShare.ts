import {
  getProfileLevel,
  profileTendencyByKey,
  profileTendencyKey,
  type ProfileTendency,
} from './profileInsights';

export const DEFAULT_PROFILE_SHARE_ORIGIN = 'https://jiptori.vercel.app';

export interface ProfileShareData {
  displayName: string;
  completedCount: number;
  tendency: ProfileTendency;
}

export interface ProfileShareMeta {
  title: string;
  description: string;
  ownerLabel: string;
  level: number;
  levelName: string;
}

export function normalizeProfileShareData(input: {
  displayName?: string | null;
  completedCount?: number | string | null;
  tendencyKey?: string | null;
}): ProfileShareData {
  const displayName = (input.displayName ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15) || '집토리 사용자';
  const parsedCount = typeof input.completedCount === 'number'
    ? input.completedCount
    : Number.parseInt(input.completedCount ?? '0', 10);
  const completedCount = Number.isFinite(parsedCount)
    ? Math.min(9999, Math.max(0, Math.floor(parsedCount)))
    : 0;

  return {
    displayName,
    completedCount,
    tendency: profileTendencyByKey(input.tendencyKey),
  };
}

export function profileShareMeta(data: ProfileShareData): ProfileShareMeta {
  const { level, levelName } = getProfileLevel(data.completedCount);
  const ownerLabel = data.displayName === '나' ? '나의' : `${data.displayName}님의`;
  return {
    title: `${ownerLabel} 살림 유형은 ${data.tendency.icon} ${data.tendency.name}`,
    description: `LV.${level} ${levelName} · 집안일 ${data.completedCount}개 완료${data.tendency.basis ? ` · 주특기 ${data.tendency.basis}` : ''}`,
    ownerLabel,
    level,
    levelName,
  };
}

export function profileShareSearchParams(data: ProfileShareData): URLSearchParams {
  return new URLSearchParams({
    n: data.displayName,
    c: String(data.completedCount),
    t: profileTendencyKey(data.tendency),
  });
}

export function profileShareDataFromSearchParams(params: URLSearchParams): ProfileShareData {
  return normalizeProfileShareData({
    displayName: params.get('n'),
    completedCount: params.get('c'),
    tendencyKey: params.get('t'),
  });
}

export function buildProfileShareUrls(baseUrl: string, data: ProfileShareData): {
  pageUrl: string;
  ogImageUrl: string;
} {
  const base = new URL(baseUrl);
  const query = profileShareSearchParams(data).toString();
  const page = new URL('/share/profile', base);
  const image = new URL('/api/profile-og', base);
  page.search = query;
  image.search = query;
  return { pageUrl: page.toString(), ogImageUrl: image.toString() };
}
