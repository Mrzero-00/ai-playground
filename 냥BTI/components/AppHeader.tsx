"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface AppHeaderProps {
  backHref?: string;
  backLabel?: string;
  trailing?: React.ReactNode;
}

export function AppHeader({ backHref, backLabel = "이전 화면", trailing }: AppHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) router.push(backHref);
    else router.back();
  };

  return (
    <header className="topbar">
      {backHref ? (
        <button className="icon-button" type="button" onClick={handleBack} aria-label={backLabel}>
          <span aria-hidden="true">←</span>
        </button>
      ) : (
        <Link className="topbar__brand" href="/" aria-label="냥BTI 홈">
          <span className="brand-mark" aria-hidden="true">猫</span>
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
