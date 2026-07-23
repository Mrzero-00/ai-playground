import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { verifyDocumentQuality } from "../lib/document-quality.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("repository documents pass metadata, structure, links, timeline and canonical checks", async () => {
  const result = await verifyDocumentQuality({ root });
  assert.equal(result.status, "PASSED", result.errors.join("\n"));
  assert.equal(result.files, 21);
  assert.equal(result.resultHash.length, 64);
});

test("a broken local document link fails closed", async () => {
  const original = await readFile(path.join(root, "docs/00_Vision.md"), "utf8");
  const result = await verifyDocumentQuality({ root, contentOverrides: { "docs/00_Vision.md": `${original}\n[broken](missing-document.md)\n` } });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.some((error) => error.startsWith("LOCAL_LINK_BROKEN:docs/00_Vision.md")));
});

test("a heading hierarchy regression is rejected", async () => {
  const original = await readFile(path.join(root, "docs/00_Vision.md"), "utf8");
  const result = await verifyDocumentQuality({ root, contentOverrides: { "docs/00_Vision.md": `${original}\n#### Invalid jump\n` } });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.some((error) => error.startsWith("HEADING_LEVEL_JUMP:docs/00_Vision.md")));
});

test("Investment Philosophy split-document drift is rejected", async () => {
  const part = "docs/02_Investment_Philosophy/02-2_LongTerm_Core_and_FutureCore.md";
  const original = await readFile(path.join(root, part), "utf8");
  const result = await verifyDocumentQuality({ root, contentOverrides: { [part]: original.replace("Long-term 전략의 목적", "Drifted title") } });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.includes("PHILOSOPHY_PART_DRIFT:02-2"));
});

test("stale document timelines are rejected", async () => {
  const original = await readFile(path.join(root, "docs/01_Architecture.md"), "utf8");
  const stale = `${original}\nArchitecture 승인 후 다음 순서로 상세화한다.\n`;
  const result = await verifyDocumentQuality({ root, contentOverrides: { "docs/01_Architecture.md": stale } });
  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.some((error) => error.startsWith("STALE_DOCUMENT_TIMELINE:docs/01_Architecture.md")));
});
