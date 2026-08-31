import { defineConfig } from "@apps-in-toss/web-framework/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `[App in Toss] ${name} is required. Copy .env.example to .env.ait and provide the console-issued value.`,
    );
  }
  return value;
}

const primaryColor = process.env.AIT_PRIMARY_COLOR?.trim() || "#ff7a59";

if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
  throw new Error("[App in Toss] AIT_PRIMARY_COLOR must be a 6-digit hex color.");
}

export default defineConfig({
  appName: required("AIT_APP_NAME"),
  brand: {
    displayName: required("AIT_DISPLAY_NAME"),
    primaryColor,
    icon: required("AIT_ICON_URL"),
  },
  web: {
    host: "0.0.0.0",
    port: 3000,
    commands: {
      dev: "pnpm dev --hostname 0.0.0.0",
      build: "pnpm build:web",
    },
  },
  permissions: [],
  outdir: "out",
  webViewProps: {
    type: "partner",
    bounces: true,
    pullToRefreshEnabled: false,
    overScrollMode: "never",
    allowsBackForwardNavigationGestures: true,
  },
});
