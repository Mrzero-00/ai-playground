#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyImplementationStatus } from "./lib/implementation-status.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await verifyImplementationStatus({ root });
const { manifest: _manifest, ...summary } = result;
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (result.status !== "PASSED") process.exitCode = 1;
