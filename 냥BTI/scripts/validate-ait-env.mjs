const required = ["AIT_APP_NAME", "AIT_DISPLAY_NAME", "AIT_ICON_URL"];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(
    `[App in Toss] Missing required build values: ${missing.join(", ")}. ` +
      "Load them from your secure environment before running pnpm build:ait.",
  );
  process.exitCode = 1;
}

const adMode = process.env.NEXT_PUBLIC_TOSS_AD_MODE ?? "disabled";
if (!new Set(["disabled", "test", "production"]).has(adMode)) {
  console.error(
    "[App in Toss] NEXT_PUBLIC_TOSS_AD_MODE must be disabled, test, or production.",
  );
  process.exitCode = 1;
}

const adGroupId = process.env.NEXT_PUBLIC_TOSS_AD_GROUP_ID?.trim();

if ((adMode === "test" || adMode === "production") && !adGroupId) {
  console.error(
    "[App in Toss] NEXT_PUBLIC_TOSS_AD_GROUP_ID is required when ads are enabled.",
  );
  process.exitCode = 1;
}

if (adMode === "production" && adGroupId && !adGroupId.startsWith("ait.v2.live.")) {
  console.error(
    "[App in Toss] Production builds require a live ad group ID starting with ait.v2.live.",
  );
  process.exitCode = 1;
}
