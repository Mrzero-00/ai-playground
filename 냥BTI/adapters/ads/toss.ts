import { TossAds } from "@apps-in-toss/web-framework";
import type { AdAdapter, AdPlacement } from "./types";

type AdMode = "disabled" | "test" | "production";

let initialization: Promise<boolean> | undefined;

function adMode(): AdMode {
  const value = process.env.NEXT_PUBLIC_TOSS_AD_MODE;
  return value === "test" || value === "production" ? value : "disabled";
}

function adGroupId(): string | undefined {
  if (adMode() === "test" || adMode() === "production") {
    return process.env.NEXT_PUBLIC_TOSS_AD_GROUP_ID?.trim() || undefined;
  }
  return undefined;
}

function canUseBanner(): boolean {
  if (!adGroupId() || typeof window === "undefined") return false;
  try {
    return TossAds.initialize.isSupported() && TossAds.attachBanner.isSupported();
  } catch {
    return false;
  }
}

function initialize(): Promise<boolean> {
  if (!canUseBanner()) return Promise.resolve(false);
  if (initialization) return initialization;

  initialization = new Promise((resolve) => {
    try {
      TossAds.initialize({
        callbacks: {
          onInitialized: () => resolve(true),
          onInitializationFailed: (error) => {
            console.warn("[App in Toss] TossAds initialization failed", error);
            initialization = undefined;
            resolve(false);
          },
        },
      });
    } catch (error) {
      console.warn("[App in Toss] TossAds initialization failed", error);
      initialization = undefined;
      resolve(false);
    }
  });
  return initialization;
}

function collapse(container: HTMLElement): void {
  container.replaceChildren();
  container.hidden = true;
  container.style.removeProperty("min-height");
}

async function mountBanner(
  container: HTMLElement,
  placement: AdPlacement,
): Promise<() => void> {
  container.dataset.adPlacement = placement;
  const id = adGroupId();
  if (!id || !(await initialize())) {
    collapse(container);
    return () => undefined;
  }

  container.hidden = false;
  container.replaceChildren();
  container.style.width = "100%";

  try {
    const attached = TossAds.attachBanner(id, container, {
      theme: "light",
      tone: "blackAndWhite",
      variant: "card",
      callbacks: {
        onNoFill: () => collapse(container),
        onAdFailedToRender: (payload) => {
          console.warn("[App in Toss] banner render failed", payload);
          collapse(container);
        },
      },
    });
    return () => {
      attached.destroy();
      collapse(container);
    };
  } catch (error) {
    console.warn("[App in Toss] banner attach failed", error);
    collapse(container);
    return () => undefined;
  }
}

export const tossAdAdapter: AdAdapter = {
  name: "toss-ads",
  isSupported: canUseBanner,
  mountBanner,
};
