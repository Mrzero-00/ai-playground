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
    let cancelled = false;
    let cleanup: () => void = () => undefined;

    if (container && adapter.isSupported()) {
      void adapter.mountBanner(container, placement).then((unmount) => {
        if (cancelled) {
          unmount();
          return;
        }
        cleanup = unmount;
      });
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [adapter, placement]);

  if (!isSupported && !showDevelopmentPlaceholder) return null;

  return (
    <aside ref={containerRef} className="ad-slot" aria-label="광고 영역">
      {showDevelopmentPlaceholder ? (
        <>
          <span>AD</span>
          <p>App in Toss 배너 광고 테스트 영역</p>
        </>
      ) : null}
    </aside>
  );
}
