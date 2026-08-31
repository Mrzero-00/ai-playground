"use client";

import { useEffect } from "react";
import { SafeArea } from "@apps-in-toss/web-framework";
import { isAppsInTossRuntime } from "@/lib/app-in-toss";

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function applySafeArea(insets: Insets) {
  const root = document.documentElement;
  root.style.setProperty("--ait-safe-top", `${insets.top}px`);
  root.style.setProperty("--ait-safe-right", `${insets.right}px`);
  root.style.setProperty("--ait-safe-bottom", `${insets.bottom}px`);
  root.style.setProperty("--ait-safe-left", `${insets.left}px`);
}

export function AppRuntimeBridge() {
  useEffect(() => {
    if (!isAppsInTossRuntime()) return;

    document.documentElement.classList.add("ait-runtime");

    try {
      applySafeArea(SafeArea.get());
      const unsubscribe = SafeArea.subscribe({ onEvent: applySafeArea });

      return () => {
        unsubscribe();
        document.documentElement.classList.remove("ait-runtime");
      };
    } catch (error) {
      console.warn("App in Toss Safe Area 초기화에 실패했습니다.", error);
      return () => document.documentElement.classList.remove("ait-runtime");
    }
  }, []);

  return null;
}
