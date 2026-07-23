import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { verifyDocumentQuality } from "./document-quality.mjs";

const READINESS = ["R0", "R1", "R2", "R3", "R4", "R5", "R6"];
const EXPECTED_CAPABILITIES = [...Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")), "14"];

export async function verifyImplementationStatus({ root, manifestPath = "implementation/status.manifest.json", manifest: suppliedManifest }) {
  const errors = [];
  const warnings = [];
  const absoluteManifest = safePath(root, manifestPath, errors);
  let manifest = suppliedManifest;
  try {
    if (!manifest) {
      if (!absoluteManifest) throw new Error("manifest path is outside repository root");
      manifest = JSON.parse(await readFile(absoluteManifest, "utf8"));
    }
  }
  catch (error) { return result({ errors: [...errors, `MANIFEST_READ_FAILED:${error instanceof Error ? error.message : String(error)}`], warnings, manifest: null, checks: 0 }); }

  let checks = 0;
  check(manifest.schemaVersion === "1.0.0", "SCHEMA_VERSION_UNSUPPORTED", errors); checks += 1;
  check(manifest.autoTradingEnabled === false, "AUTO_TRADING_MUST_BE_DISABLED", errors); checks += 1;
  check(READINESS.includes(manifest.readiness), "READINESS_INVALID", errors); checks += 1;
  check(Number.isFinite(Date.parse(manifest.asOf)), "MANIFEST_AS_OF_INVALID", errors); checks += 1;

  const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
  const ids = capabilities.map((capability) => capability.id);
  check(new Set(ids).size === ids.length, "CAPABILITY_ID_DUPLICATE", errors); checks += 1;
  for (const expected of EXPECTED_CAPABILITIES) { check(ids.includes(expected), `CAPABILITY_MISSING:${expected}`, errors); checks += 1; }
  for (const id of ids) { if (!EXPECTED_CAPABILITIES.includes(id)) errors.push(`CAPABILITY_UNEXPECTED:${id}`); checks += 1; }

  for (const capability of capabilities) {
    const prefix = `CAPABILITY:${capability.id ?? "UNKNOWN"}`;
    check(typeof capability.name === "string" && capability.name.trim().length > 0, `${prefix}:NAME_REQUIRED`, errors); checks += 1;
    check(READINESS.includes(capability.readiness), `${prefix}:READINESS_INVALID`, errors); checks += 1;
    const paths = [capability.document, ...(capability.implementationPaths ?? []), ...(capability.testPaths ?? []), ...(capability.migration ? [capability.migration] : [])];
    for (const relativePath of paths) {
      const absolutePath = safePath(root, relativePath, errors);
      try {
        if (!absolutePath) throw new Error("path is outside repository root");
        await stat(absolutePath);
      }
      catch { errors.push(`${prefix}:PATH_MISSING:${relativePath}`); }
      checks += 1;
    }
    check(Array.isArray(capability.implementationPaths) && capability.implementationPaths.length > 0, `${prefix}:IMPLEMENTATION_REQUIRED`, errors); checks += 1;
    check(Array.isArray(capability.testPaths) && capability.testPaths.length > 0, `${prefix}:TEST_REQUIRED`, errors); checks += 1;
    check(Array.isArray(capability.openGateCodes) && new Set(capability.openGateCodes).size === capability.openGateCodes.length, `${prefix}:OPEN_GATES_INVALID`, errors); checks += 1;
    if (capability.readiness !== "R6") { check(capability.openGateCodes.length > 0, `${prefix}:OPEN_GATE_REQUIRED`, errors); checks += 1; }
    if (READINESS.indexOf(capability.readiness) >= READINESS.indexOf("R2")) {
      check(Array.isArray(capability.externalEvidenceRefs) && capability.externalEvidenceRefs.length > 0, `${prefix}:EXTERNAL_EVIDENCE_REQUIRED`, errors); checks += 1;
    }
  }

  const migrationDirectory = path.join(root, "supabase/migrations");
  let migrations = [];
  try { migrations = (await readdir(migrationDirectory)).filter((file) => /^\d{3}_.+\.sql$/.test(file)).sort(); }
  catch (error) { errors.push(`MIGRATION_DIRECTORY_READ_FAILED:${error instanceof Error ? error.message : String(error)}`); }
  const numbers = migrations.map((file) => Number(file.slice(0, 3)));
  check(new Set(numbers).size === numbers.length, "MIGRATION_NUMBER_DUPLICATE", errors); checks += 1;
  numbers.forEach((number, index) => { check(number === index + 1, `MIGRATION_SEQUENCE_GAP:${String(index + 1).padStart(3, "0")}`, errors); checks += 1; });
  const actualLatest = migrations.length > 0 ? `supabase/migrations/${migrations.at(-1)}` : undefined;
  check(manifest.latestMigration === actualLatest, `LATEST_MIGRATION_MISMATCH:${actualLatest ?? "NONE"}`, errors); checks += 1;

  const testSnapshot = manifest.testSnapshot ?? {};
  const actualTestCounts = {
    core: await countDeclaredTests(path.join(root, "packages/core/test"), errors),
    api: await countDeclaredTests(path.join(root, "apps/api/test"), errors),
    web: await countDeclaredTests(path.join(root, "apps/web/test"), errors),
    execution: await countDeclaredTests(path.join(root, "apps/execution/test"), errors),
    verifier: await countDeclaredTests(path.join(root, "scripts/test"), errors),
  };
  for (const [suite, actual] of Object.entries(actualTestCounts)) {
    check(Number.isInteger(testSnapshot[suite]) && testSnapshot[suite] >= 0, `TEST_SNAPSHOT_${suite.toUpperCase()}_INVALID`, errors); checks += 1;
    check(testSnapshot[suite] === actual, `TEST_SNAPSHOT_${suite.toUpperCase()}_MISMATCH:${actual}`, errors); checks += 1;
  }
  check(testSnapshot.total === Object.values(actualTestCounts).reduce((sum, count) => sum + count, 0), "TEST_SNAPSHOT_TOTAL_MISMATCH", errors); checks += 1;

  let readme = "";
  try { readme = await readFile(path.join(root, "README.md"), "utf8"); }
  catch (error) { errors.push(`README_READ_FAILED:${error instanceof Error ? error.message : String(error)}`); }
  for (const capability of capabilities) { check(readme.includes(capability.document), `README_DOCUMENT_LINK_MISSING:${capability.id}`, errors); checks += 1; }
  check(readme.includes("docs/13_Codex_Implementation.md"), "README_IMPLEMENTATION_STATUS_LINK_MISSING", errors); checks += 1;

  const requiredCommands = ["pnpm test", "pnpm typecheck", "pnpm build", "pnpm verify:docs", "pnpm verify:implementation"];
  for (const command of requiredCommands) { check(manifest.verificationCommands?.includes(command), `VERIFICATION_COMMAND_MISSING:${command}`, errors); checks += 1; }

  const documentQuality = await verifyDocumentQuality({ root });
  errors.push(...documentQuality.errors.map((error) => `DOCUMENT_QUALITY:${error}`));
  warnings.push(...documentQuality.warnings.map((warning) => `DOCUMENT_QUALITY:${warning}`));
  checks += documentQuality.checks;

  return result({ errors, warnings, manifest, checks, migrations, actualTestCounts, documentQuality });
}

function safePath(root, relativePath, errors) {
  if (typeof relativePath !== "string" || relativePath.trim().length === 0) {
    errors.push("PATH_INVALID");
    return null;
  }
  const resolved = path.resolve(root, relativePath);
  const normalizedRoot = `${path.resolve(root)}${path.sep}`;
  if (resolved !== path.resolve(root) && !resolved.startsWith(normalizedRoot)) {
    errors.push(`PATH_OUTSIDE_ROOT:${relativePath}`);
    return null;
  }
  return resolved;
}

async function countDeclaredTests(directory, errors) {
  try {
    const files = (await readdir(directory, { recursive: true })).filter((file) => /\.test\.(?:ts|mjs)$/.test(file));
    let count = 0;
    for (const file of files) {
      const content = await readFile(path.join(directory, file), "utf8");
      count += (content.match(/(?:^|\n)\s*test\s*\(/g) ?? []).length;
    }
    return count;
  } catch (error) {
    errors.push(`TEST_DIRECTORY_READ_FAILED:${directory}:${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

function check(condition, code, errors) { if (!condition) errors.push(code); }

function result({ errors, warnings, manifest, checks, migrations = [], actualTestCounts = {}, documentQuality }) {
  const canonical = {
    status: errors.length === 0 ? "PASSED" : "FAILED",
    checks,
    errors: [...new Set(errors)].sort(),
    warnings: [...new Set(warnings)].sort(),
    migrations,
    actualTestCounts,
    documentQuality: documentQuality ? { status: documentQuality.status, checks: documentQuality.checks, files: documentQuality.files, resultHash: documentQuality.resultHash } : undefined,
  };
  return { ...canonical, manifest, resultHash: createHash("sha256").update(JSON.stringify(canonical)).digest("hex") };
}
