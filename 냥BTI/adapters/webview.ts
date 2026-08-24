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

/** TODO: @apps-in-toss/web-framework 도입 시 런타임 어댑터를 이 경계에 연결한다. */
export function getWebViewAdapter(): WebViewAdapter {
  return browserWebViewAdapter;
}
