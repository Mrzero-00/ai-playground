import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyImplementationStatus } from "../lib/implementation-status.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("repository implementation manifest matches documents, code, tests and migrations", async () => {
  const result = await verifyImplementationStatus({ root });
  assert.equal(result.status, "PASSED", result.errors.join("\n"));
  assert.equal(result.manifest.capabilities.length, 12);
  assert.equal(result.migrations.length, 12);
  assert.equal(result.resultHash.length, 64);
});

test("automatic trading claim fails closed", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "implementation/status.manifest.json"), "utf8"));
  manifest.autoTradingEnabled = true;
  const result = await verifyImplementationStatus({ root, manifest });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.includes("AUTO_TRADING_MUST_BE_DISABLED"));
});

test("missing implementation evidence and unproven R2 claim fail closed", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "implementation/status.manifest.json"), "utf8"));
  manifest.capabilities[0].readiness = "R2";
  manifest.capabilities[0].externalEvidenceRefs = [];
  manifest.capabilities[0].implementationPaths = ["packages/core/src/does-not-exist.ts"];
  const result = await verifyImplementationStatus({ root, manifest });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.includes("CAPABILITY:01:EXTERNAL_EVIDENCE_REQUIRED"));
  assert.ok(result.errors.includes("CAPABILITY:01:PATH_MISSING:packages/core/src/does-not-exist.ts"));
});

test("incorrect latest migration and test totals are rejected", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "implementation/status.manifest.json"), "utf8"));
  manifest.latestMigration = "supabase/migrations/011_report_system_v1.sql";
  manifest.testSnapshot.core += 1;
  manifest.testSnapshot.total += 1;
  const result = await verifyImplementationStatus({ root, manifest });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.some((error) => error.startsWith("LATEST_MIGRATION_MISMATCH")));
  assert.ok(result.errors.some((error) => error.startsWith("TEST_SNAPSHOT_CORE_MISMATCH")));
  assert.ok(result.errors.includes("TEST_SNAPSHOT_TOTAL_MISMATCH"));
});

test("manifest paths outside the repository are rejected before read", async () => {
  const result = await verifyImplementationStatus({ root, manifestPath: "../../../../etc/passwd" });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.some((error) => error.startsWith("PATH_OUTSIDE_ROOT")));
  assert.ok(result.errors.some((error) => error.startsWith("MANIFEST_READ_FAILED")));
});
