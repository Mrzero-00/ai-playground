import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "cat-mbti-00",
  brand: {
    primaryColor: "#FF765F",
  },
  permissions: [],
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
    withTitle: true,
    transparentBackground: false,
    theme: "light",
  },
  webView: {
    allowsBackForwardNavigationGestures: true,
    bounces: true,
    pullToRefreshEnabled: false,
    overScrollMode: "never",
  },
  webBundleDir: "out",
});
