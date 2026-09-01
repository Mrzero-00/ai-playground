import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Coordinates } from '@/domain/pit';

export type PrototypePit = {
  id: string;
  title: string;
  waitDays: number;
  revealAt: string;
  attendanceRule: string;
  location: Coordinates;
  locationAccuracy: number | null;
};

export type PrototypeContribution = {
  photoUri: string;
  message: string;
};

type PitStoreValue = {
  pit: PrototypePit | null;
  contributions: Record<string, PrototypeContribution>;
  savePit: (pit: PrototypePit) => void;
  saveContribution: (pitId: string, contribution: PrototypeContribution) => void;
};

const PitStoreContext = createContext<PitStoreValue | null>(null);

export function PitStoreProvider({ children }: { children: ReactNode }) {
  const [pit, savePit] = useState<PrototypePit | null>(null);
  const [contributions, setContributions] = useState<Record<string, PrototypeContribution>>({});
  const value = useMemo(
    () => ({
      pit,
      contributions,
      savePit,
      saveContribution: (pitId: string, contribution: PrototypeContribution) => {
        setContributions((current) => ({ ...current, [pitId]: contribution }));
      },
    }),
    [pit, contributions],
  );

  return <PitStoreContext.Provider value={value}>{children}</PitStoreContext.Provider>;
}

export function usePitStore() {
  const value = useContext(PitStoreContext);
  if (!value) throw new Error('usePitStore must be used inside PitStoreProvider');
  return value;
}
