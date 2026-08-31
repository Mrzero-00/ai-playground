"use client";

import { useEffect, useState } from "react";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";

export function useStoreHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        const persistApi = useNyangBtiStore.persist;
        if (persistApi && !persistApi.hasHydrated()) {
          await persistApi.rehydrate();
        }
      } catch (error) {
        console.warn("[냥BTI] 저장된 기록을 복원하지 못해 기본 상태로 시작합니다.", error);
      } finally {
        if (active) setHydrated(true);
      }
    };

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  return hydrated;
}
