"use client";

import { useEffect, type ReactNode } from "react";
import {
  applySafeAreaCssVariables,
  getSafeAreaInsets,
  subscribeSafeAreaInsets,
} from "@/adapters/safe-area";

export function TossRuntimeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const update = () => applySafeAreaCssVariables(getSafeAreaInsets());
    update();
    const unsubscribe = subscribeSafeAreaInsets(applySafeAreaCssVariables);
    return () => unsubscribe();
  }, []);

  return children;
}
