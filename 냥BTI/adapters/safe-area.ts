import { SafeAreaInsets } from "@apps-in-toss/web-framework";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

function validInsets(value: Insets): Insets {
  return Object.values(value).every((item) => Number.isFinite(item) && item >= 0)
    ? value
    : ZERO_INSETS;
}

export function getSafeAreaInsets(): Insets {
  if (typeof window === "undefined") return ZERO_INSETS;
  try {
    return validInsets(SafeAreaInsets.get());
  } catch {
    return ZERO_INSETS;
  }
}

export function subscribeSafeAreaInsets(listener: (insets: Insets) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  try {
    return SafeAreaInsets.subscribe({ onEvent: (value) => listener(validInsets(value)) });
  } catch {
    return () => undefined;
  }
}

export function applySafeAreaCssVariables(insets: Insets, root = document.documentElement): void {
  root.style.setProperty("--ait-safe-top", `${insets.top}px`);
  root.style.setProperty("--ait-safe-right", `${insets.right}px`);
  root.style.setProperty("--ait-safe-bottom", `${insets.bottom}px`);
  root.style.setProperty("--ait-safe-left", `${insets.left}px`);
}
