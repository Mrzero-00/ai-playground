import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
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
  const manifestPath = await temporaryManifest(manifest);
  const result = await verifyImplementationStatus({ root, manifestPath });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.includes("AUTO_TRADING_MUST_BE_DISABLED"));
});

test("missing implementation evidence and unproven R2 claim fail closed", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "implementation/status.manifest.json"), "utf8"));
  manifest.capabilities[0].readiness = "R2";
  manifest.capabilities[0].externalEvidenceRefs = [];
  manifest.capabilities[0].implementationPaths = ["packages/core/src/does-not-exist.ts"];
  const manifestPath = await temporaryManifest(manifest);
  const result = await verifyImplementationStatus({ root, manifestPath });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.includes("CAPABILITY:01:EXTERNAL_EVIDENCE_REQUIRED"));
  assert.ok(result.errors.includes("CAPABILITY:01:PATH_MISSING:packages/core/src/does-not-exist.ts"));
});

test("incorrect latest migration and test totals are rejected", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "implementation/status.manifest.json"), "utf8"));
  manifest.latestMigration = "supabase/migrations/011_report_system_v1.sql";
  manifest.testSnapshot.total += 1;
  const manifestPath = await temporaryManifest(manifest);
  const result = await verifyImplementationStatus({ root, manifestPath });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.some((error) => error.startsWith("LATEST_MIGRATION_MISMATCH")));
  assert.ok(result.errors.includes("TEST_SNAPSHOT_TOTAL_MISMATCH"));
});

async function temporaryManifest(value) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "investment-os-status-"));
  const absolutePath = path.join(directory, "manifest.json");
  await writeFile(absolutePath, JSON.stringify(value), "utf8");
  return path.relative(root, absolutePath);
}
