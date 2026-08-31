import * as tossSdk from "@apps-in-toss/web-framework";

type NativeBridge = typeof tossSdk & {
  closeView?: () => Promise<void>;
};

export interface WebViewAdapter {
  readonly runtime: "browser" | "toss";
  readonly usesNativeNavigation: boolean;
  closeView: () => Promise<void>;
  subscribeBack: (handler: () => void) => () => void;
}

function browserBack(): void {
  if (window.history.length > 1) window.history.back();
}

export const browserWebViewAdapter: WebViewAdapter = {
  runtime: "browser",
  usesNativeNavigation: false,
  closeView: async () => browserBack(),
  subscribeBack: () => () => undefined,
};

function isTossRuntime(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const globals = tossSdk.getAppsInTossGlobals();
    return Boolean(globals?.deploymentId || globals?.brandDisplayName);
  } catch {
    return false;
  }
}

const tossWebViewAdapter: WebViewAdapter = {
  runtime: "toss",
  usesNativeNavigation: true,
  closeView: async () => {
    const closeView = (tossSdk as NativeBridge).closeView;
    if (typeof closeView === "function") {
      try {
        await closeView();
        return;
      } catch {
        // Old Toss apps can reject the bridge call. Preserve an escape route.
      }
    }
    browserBack();
  },
  subscribeBack: (handler) => {
    try {
      return tossSdk.graniteEvent.addEventListener("backEvent", {
        onEvent: handler,
        onError: (error) => console.warn("[App in Toss] backEvent failed", error),
      });
    } catch {
      return () => undefined;
    }
  },
};

export function getWebViewAdapter(): WebViewAdapter {
  return isTossRuntime() ? tossWebViewAdapter : browserWebViewAdapter;
}
