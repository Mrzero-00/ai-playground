#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDocumentQuality } from "./lib/document-quality.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await verifyDocumentQuality({ root });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.status !== "PASSED") process.exitCode = 1;
