"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getWebViewAdapter } from "@/adapters/webview";

const subscribeRuntime = () => () => undefined;
const getServerRuntime = () => false;
const getClientRuntime = () => getWebViewAdapter().usesNativeNavigation;

interface AppHeaderProps {
  backHref?: string;
  backLabel?: string;
  trailing?: React.ReactNode;
}

export function AppHeader({ backHref, backLabel = "이전 화면", trailing }: AppHeaderProps) {
  const router = useRouter();
  const usesNativeNavigation = useSyncExternalStore(
    subscribeRuntime,
    getClientRuntime,
    getServerRuntime,
  );

  const handleBack = () => {
    if (backHref) router.push(backHref);
    else router.back();
  };

  if (usesNativeNavigation) return null;

  return (
    <header className="topbar">
      {backHref ? (
        <button className="icon-button" type="button" onClick={handleBack} aria-label={backLabel}>
          <span aria-hidden="true">←</span>
        </button>
      ) : (
        <Link className="topbar__brand" href="/" aria-label="냥BTI 홈">
          <span className="brand-mark" aria-hidden="true">
            <Image src="/characters/enfp.png" alt="" width={68} height={68} priority />
          </span>
          <span>냥BTI</span>
        </Link>
      )}
      {backHref ? (
        <Link className="topbar__brand topbar__brand--center" href="/" aria-label="냥BTI 홈">
          냥BTI
        </Link>
      ) : null}
      <div className="topbar__trailing">{trailing}</div>
    </header>
  );
}
