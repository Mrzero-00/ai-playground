import { Screen, graniteEvent } from "@apps-in-toss/web-framework";
import { isAppsInTossRuntime } from "@/lib/app-in-toss";

export interface WebViewAdapter {
  readonly runtime: "browser" | "toss";
  readonly usesNativeNavigation: boolean;
  closeView: () => void;
  subscribeBack: (handler: () => void) => () => void;
}

export const browserWebViewAdapter: WebViewAdapter = {
  runtime: "browser",
  usesNativeNavigation: false,
  closeView: () => window.history.back(),
  subscribeBack: () => () => undefined,
};

export const tossWebViewAdapter: WebViewAdapter = {
  runtime: "toss",
  usesNativeNavigation: true,
  closeView: () => {
    void Screen.close().catch((error) => {
      console.warn("App in Toss 화면을 닫지 못했습니다.", error);
    });
  },
  subscribeBack: (handler) =>
    graniteEvent.addEventListener("backEvent", {
      onEvent: handler,
      onError: (error) => console.warn("App in Toss 뒤로가기 이벤트 오류", error),
    }),
};

export function getWebViewAdapter(): WebViewAdapter {
  return isAppsInTossRuntime() ? tossWebViewAdapter : browserWebViewAdapter;
}
