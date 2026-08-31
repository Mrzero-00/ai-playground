import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

await import("./validate-ait-env.mjs");
if (process.exitCode) process.exit(process.exitCode);

const packageJson = fileURLToPath(
  import.meta.resolve("@apps-in-toss/web-framework/package.json"),
);
const cli = join(dirname(packageJson), "ait.js");
const result = spawnSync(process.execPath, [cli, "build"], {
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
