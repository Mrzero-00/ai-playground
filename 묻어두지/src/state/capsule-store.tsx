import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Capsule, CapsuleItem, PlantedLocation } from '@/domain/capsule';
import { FALLBACK_NAME, profile as profileStorage, type Profile } from '@/lib/profile';
import type { CreateCapsuleInput } from '@/shared/capsule-api';

import { BackendError, type CapsuleBackend, type ItemPatch, type NewItemInput } from './backend';

export type JoinResult = { ok: true; capsule: Capsule; already: boolean } | { ok: false; reason: 'not-found' | 'closed' | 'full' | 'other'; message: string };

type CapsuleStoreValue = {
  /** 내가 들어 있는 캡슐만. 초대 코드로 들어가기 전의 캡슐은 보이지 않는다. */
  capsules: Capsule[];
  loading: boolean;
  error: string | null;
  source: 'local' | 'remote';
  /** 기기에 저장된 내 이름·아바타 색. name 이 비어 있으면 아직 안 정한 것. */
  profile: Profile;
  saveProfile: (next: Profile) => Promise<void>;
  refresh: () => Promise<void>;
  getCapsule: (id: string) => Capsule | null;
  createCapsule: (input: CreateCapsuleInput) => Promise<Capsule>;
  /** 초대 코드로 친구 캡슐에 들어간다. 이미 들어 있으면 그 캡슐을 그대로 돌려준다. */
  joinCapsule: (code: string) => Promise<JoinResult>;
  addItem: (capsuleId: string, input: NewItemInput) => Promise<CapsuleItem>;
  updateItem: (capsuleId: string, itemId: string, patch: ItemPatch) => Promise<CapsuleItem>;
  removeItem: (capsuleId: string, itemId: string) => Promise<void>;
  /** 방장이 직접 닫는다. 여는 시각은 만들 때 정한 값을 쓴다. */
  sealCapsule: (capsuleId: string) => Promise<Capsule>;
  openCapsule: (capsuleId: string) => Promise<Capsule>;
  plantCapsule: (capsuleId: string, location: PlantedLocation) => Promise<Capsule>;
};

const CapsuleStoreContext = createContext<CapsuleStoreValue | null>(null);
const REMOTE_REFRESH_MS = 30_000;

export function describeError(cause: unknown) {
  if (cause instanceof BackendError) return cause.message;
  return cause instanceof Error ? cause.message : '잠시 문제가 생겼어요. 다시 시도해 주세요.';
}

/** 화면이 쓰는 캡슐 저장소. 백엔드(로컬·원격)가 돌려준 Capsule 을 그대로 상태에 반영한다. */
export function CapsuleStoreProvider({ children, backend }: { children: ReactNode; backend: CapsuleBackend }) {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({ name: '', tone: 'yellow' });

  const refresh = useCallback(async () => {
    try {
      const next = await backend.load();
      setCapsules(next);
      setError(null);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    // 저장된 프로필을 먼저 백엔드에 알린 뒤 캡슐을 불러온다(로컬 백엔드는 내 이름을 이걸로 바꾼다).
    const first = setTimeout(() => {
      void (async () => {
        const stored = await profileStorage.load();
        setProfile(stored);
        if (stored.name) await backend.setDisplayName(stored.name).catch(() => {});
        await refresh();
      })();
    }, 0);
    // 서버가 저절로 닫거나 열 수 있게 된 상태를 화면에 늦지 않게 반영한다.
    const timer = backend.source === 'remote' ? setInterval(() => void refresh(), REMOTE_REFRESH_MS) : null;
    return () => {
      clearTimeout(first);
      if (timer) clearInterval(timer);
    };
  }, [backend, refresh]);

  const value = useMemo<CapsuleStoreValue>(() => {
    const upsert = (capsule: Capsule) => {
      setCapsules((prev) => (prev.some((item) => item.id === capsule.id) ? prev.map((item) => (item.id === capsule.id ? capsule : item)) : [capsule, ...prev]));
      return capsule;
    };
    return {
      capsules,
      loading,
      error,
      source: backend.source,
      profile,
      saveProfile: async (next) => {
        const trimmed = { ...next, name: next.name.trim() };
        await profileStorage.save(trimmed);
        setProfile(trimmed);
        await backend.setDisplayName(trimmed.name || FALLBACK_NAME);
        await refresh();
      },
      refresh,
      getCapsule: (id) => capsules.find((capsule) => capsule.id === id) ?? null,
      createCapsule: async (input) => upsert(await backend.create(input)),
      joinCapsule: async (code) => {
        try {
          const { capsule, already } = await backend.join(code);
          upsert(capsule);
          return { ok: true, capsule, already };
        } catch (cause) {
          const codeOf = cause instanceof BackendError ? cause.code : 'NETWORK';
          const reason = codeOf === 'INVITE_NOT_FOUND' ? 'not-found' : codeOf === 'CAPSULE_CLOSED' ? 'closed' : codeOf === 'CAPSULE_FULL' ? 'full' : 'other';
          return { ok: false, reason, message: describeError(cause) };
        }
      },
      addItem: async (capsuleId, input) => {
        const { capsule, item } = await backend.addItem(capsuleId, input);
        upsert(capsule);
        return item;
      },
      updateItem: async (capsuleId, itemId, patch) => {
        const { capsule, item } = await backend.updateItem(capsuleId, itemId, patch);
        upsert(capsule);
        return item;
      },
      removeItem: async (capsuleId, itemId) => {
        upsert(await backend.removeItem(capsuleId, itemId));
      },
      sealCapsule: async (capsuleId) => upsert(await backend.seal(capsuleId)),
      openCapsule: async (capsuleId) => upsert(await backend.open(capsuleId)),
      plantCapsule: async (capsuleId, location) => upsert(await backend.plant(capsuleId, location)),
    };
  }, [backend, capsules, loading, error, profile, refresh]);

  return <CapsuleStoreContext.Provider value={value}>{children}</CapsuleStoreContext.Provider>;
}

export function useCapsuleStore() {
  const value = useContext(CapsuleStoreContext);
  if (!value) throw new Error('useCapsuleStore must be used inside CapsuleStoreProvider');
  return value;
}
