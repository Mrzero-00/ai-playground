"use client";

import { useEffect, useMemo, useRef } from "react";
import { getAdAdapter } from "@/adapters/ads";
import type { AdPlacement } from "@/adapters/ads/types";

interface AdSlotProps {
  placement: AdPlacement;
}

export function AdSlot({ placement }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapter = useMemo(() => getAdAdapter(), []);
  const isSupported = adapter.isSupported();
  const showDevelopmentPlaceholder =
    process.env.NODE_ENV !== "production" && adapter.name === "development-placeholder";

  useEffect(() => {
    const container = containerRef.current;
    let cleanup: () => void = () => undefined;

    if (container && adapter.isSupported()) {
      void adapter.mountBanner(container, placement).then((unmount) => {
        cleanup = unmount;
      });
    }

    return () => cleanup();
  }, [adapter, placement]);

  if (!isSupported && !showDevelopmentPlaceholder) return null;

  return (
    <aside ref={containerRef} className="ad-slot" aria-label="광고 영역">
      {showDevelopmentPlaceholder ? (
        <>
          <span>AD</span>
          <p>App in Toss 광고 SDK 연결 예정 영역</p>
        </>
      ) : null}
    </aside>
  );
}
