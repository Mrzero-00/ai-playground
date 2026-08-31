"use client";

declare global {
  interface Window {
    ReactNativeWebView?: unknown;
    __appsInTossConstants?: unknown;
  }
}

/** 일반 브라우저에서 SDK bridge 함수를 호출하지 않기 위한 런타임 경계. */
export function isAppsInTossRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    window.ReactNativeWebView != null &&
    window.__appsInTossConstants != null
  );
}
