"use client";

import { useEffect } from "react";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";

export function useStoreHydration(): boolean {
  const hasHydrated = useNyangBtiStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!useNyangBtiStore.persist.hasHydrated()) {
      void useNyangBtiStore.persist.rehydrate();
    } else {
      useNyangBtiStore.getState().setHasHydrated(true);
    }
  }, []);

  return hasHydrated;
}
