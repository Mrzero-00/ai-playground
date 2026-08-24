"use client";

import { useEffect, useRef } from "react";
import { getAdAdapter } from "@/adapters/ads";
import type { AdPlacement } from "@/adapters/ads/types";

interface AdSlotProps {
  placement: AdPlacement;
}

export function AdSlot({ placement }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const adapter = getAdAdapter();
    const container = containerRef.current;
    let cleanup: () => void = () => undefined;

    if (container && adapter.isSupported()) {
      void adapter.mountBanner(container, placement).then((unmount) => {
        cleanup = unmount;
      });
    }

    return () => cleanup();
  }, [placement]);

  return (
    <aside ref={containerRef} className="ad-slot" aria-label="광고 영역">
      <span>AD</span>
      <p>App in Toss 광고 SDK 연결 예정 영역</p>
    </aside>
  );
}
