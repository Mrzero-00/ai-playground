import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api } from '@/lib/api';
import type { CapsuleSummary, Coordinates, LocationFix } from '@/shared/contracts';

/** A photo taken for a capsule that has not been sealed yet. Lives only in memory. */
export type DraftPhoto = { uri: string; base64: string; mimeType: 'image/jpeg' };

/** What the create screen collects from other screens (camera, map pin). */
export type Draft = {
  photo: DraftPhoto | null;
  pin: Coordinates | null;
  placeName: string;
};

const EMPTY_DRAFT: Draft = { photo: null, pin: null, placeName: '' };

type CapsuleStoreValue = {
  capsules: CapsuleSummary[];
  loading: boolean;
  serverOk: boolean;
  error: string | null;
  /** Server-adjusted clock, ticking once a second. */
  now: number;
  lastFix: LocationFix | null;
  setLastFix: (fix: LocationFix | null) => void;
  refresh: () => Promise<void>;
  syncClock: (serverNow: string) => void;
  /** Merge a capsule returned by a create or open response. */
  upsert: (capsule: CapsuleSummary) => void;
  draft: Draft;
  updateDraft: (changes: Partial<Draft>) => void;
  clearDraft: () => void;
};

const CapsuleStoreContext = createContext<CapsuleStoreValue | null>(null);

export function CapsuleStoreProvider({ children }: { children: ReactNode }) {
  const [capsules, setCapsules] = useState<CapsuleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverOk, setServerOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [tick, setTick] = useState(0);
  const [lastFix, setLastFix] = useState<LocationFix | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const inFlight = useRef<Promise<void> | null>(null);

  const syncClock = useCallback((serverNow: string) => setClockOffset(Date.parse(serverNow) - Date.now()), []);
  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    setLoading(true);
    inFlight.current = (async () => {
      try {
        const data = await api.list();
        setCapsules(data.capsules);
        syncClock(data.serverNow);
        setServerOk(true);
        setError(null);
      } catch (cause) {
        setServerOk(false);
        setError(cause instanceof Error ? cause.message : '구덩이를 불러오지 못했어요.');
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [syncClock]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts on mount; 0 would show every capsule as overdue
    setTick(Date.now());
    const timer = setInterval(() => setTick(Date.now()), 1000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') setTick(Date.now()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);

  // Stable identities: screens register these in effects, so a new function per
  // render would re-run cleanups (and wipe a draft that was just filled in).
  const upsert = useCallback((capsule: CapsuleSummary) => setCapsules((previous) => [capsule, ...previous.filter((item) => item.id !== capsule.id)]), []);
  const updateDraft = useCallback((changes: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...changes })), []);
  const clearDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);

  const value = useMemo<CapsuleStoreValue>(() => ({
    capsules, loading, serverOk, error, now: tick + clockOffset, lastFix, setLastFix, refresh, syncClock, upsert, draft, updateDraft, clearDraft,
  }), [capsules, loading, serverOk, error, tick, clockOffset, lastFix, refresh, syncClock, upsert, draft, updateDraft, clearDraft]);

  return <CapsuleStoreContext.Provider value={value}>{children}</CapsuleStoreContext.Provider>;
}

export function useCapsuleStore() {
  const value = useContext(CapsuleStoreContext);
  if (!value) throw new Error('useCapsuleStore must be used inside CapsuleStoreProvider');
  return value;
}
