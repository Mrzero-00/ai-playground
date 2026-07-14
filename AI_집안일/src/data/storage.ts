import type { AppData, Home, LegacyAppData, LocalUser } from '../domain/types';

const STORAGE_KEY = 'ai-housework:data:v2';
const LEGACY_STORAGE_KEY = 'ai-housework:data:v1';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLocalUser(): LocalUser {
  return { id: makeId('user'), displayName: '나', createdAt: new Date().toISOString() };
}

export function createInitialAppData(): AppData {
  return {
    version: 2,
    user: createLocalUser(),
    homes: [],
    activeHomeId: null,
    notifications: { enabled: false, reminderHour: 9 },
  };
}

export const initialAppData = createInitialAppData();

function migrateLegacyData(legacy: Partial<LegacyAppData>): AppData {
  const data = createInitialAppData();
  const now = new Date().toISOString();
  const homeId = makeId('home');
  const memberId = makeId('member');
  const home: Home = {
    id: homeId,
    name: '우리 집',
    emoji: '🏠',
    inviteCode: makeInviteCode(),
    members: [{
      id: memberId,
      userId: data.user.id,
      displayName: data.user.displayName,
      role: 'owner',
      joinedAt: now,
    }],
    profile: legacy.profile ?? null,
    chores: legacy.chores ?? [],
    history: (legacy.history ?? []).map((entry) => ({
      ...entry,
      performedByUserId: data.user.id,
      performedByName: data.user.displayName,
    })),
    createdAt: now,
  };
  return {
    ...data,
    homes: [home],
    activeHomeId: homeId,
    notifications: legacy.notifications ?? data.notifications,
  };
}

export function makeInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...createInitialAppData(), ...JSON.parse(raw), version: 2 };

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = migrateLegacyData(JSON.parse(legacyRaw));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // 손상된 로컬 데이터는 빈 v2 데이터로 안전하게 시작한다.
  }
  return createInitialAppData();
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
