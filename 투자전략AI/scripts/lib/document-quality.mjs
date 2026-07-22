import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const PRIMARY_DOCUMENTS = [
  "docs/00_Vision.md",
  "docs/01_Architecture.md",
  "docs/02_Investment_Philosophy.md",
  "docs/03_LongTerm_Engine.md",
  "docs/04_Momentum_Engine.md",
  "docs/05_Portfolio_Engine.md",
  "docs/06_Learning_Engine.md",
  "docs/07_AI_Agents.md",
  "docs/08_Database.md",
  "docs/09_Scoring_System.md",
  "docs/10_Report_System.md",
  "docs/11_UI_UX.md",
  "docs/12_Roadmap.md",
  "docs/13_Codex_Implementation.md",
];

const PHILOSOPHY_PARTS = [
  "docs/02_Investment_Philosophy/02-1_Foundations_Objectives_and_Governance.md",
  "docs/02_Investment_Philosophy/02-2_LongTerm_Core_and_FutureCore.md",
  "docs/02_Investment_Philosophy/02-3_Momentum_and_Tactical_Investing.md",
  "docs/02_Investment_Philosophy/02-4_Capital_Allocation_Portfolio_and_Risk.md",
  "docs/02_Investment_Philosophy/02-5_Decision_Process_Psychology_Learning_and_Templates.md",
];

const REQUIRED_METADATA = ["문서 버전:", "작성일:", "최종 검토일:", "명세 상태:", "구현 준비도:"];
const FORBIDDEN_STALE_PHRASES = [
  "Architecture 승인 후 다음 순서로 상세화한다.",
  "다음 상세 설계 순서는 Architecture에서 정한 대로 진행한다.",
  "Implementation Manifest와 Verifier를 코드화한다.",
  "Long-term Engine 본체가 완료된 상태는 아니다.",
];

export async function verifyDocumentQuality({ root, contentOverrides = {} }) {
  const errors = [];
  const warnings = [];
  let checks = 0;
  const files = (await listMarkdownFiles(path.join(root, "docs"))).map((absolute) => path.relative(root, absolute));
  const cache = new Map();

  const content = async (relativePath) => {
    if (Object.hasOwn(contentOverrides, relativePath)) return contentOverrides[relativePath];
    if (!cache.has(relativePath)) cache.set(relativePath, await readFile(path.join(root, relativePath), "utf8"));
    return cache.get(relativePath);
  };

  for (const expected of [...PRIMARY_DOCUMENTS, ...PHILOSOPHY_PARTS, "docs/02_Investment_Philosophy/README.md"]) {
    check(files.includes(expected), `DOCUMENT_MISSING:${expected}`, errors);
    checks += 1;
  }

  for (const file of files) {
    const markdown = await content(file);
    const structure = inspectMarkdownStructure(markdown);
    check(structure.h1Count === 1, `H1_COUNT_INVALID:${file}:${structure.h1Count}`, errors);
    checks += 1;
    check(structure.headingJumps.length === 0, `HEADING_LEVEL_JUMP:${file}:${structure.headingJumps.join(",")}`, errors);
    checks += 1;
    check(structure.fenceClosed, `CODE_FENCE_UNCLOSED:${file}`, errors);
    checks += 1;

    for (const link of localMarkdownLinks(markdown)) {
      const target = safeLocalLinkTarget(root, file, link.target);
      if (!target) continue;
      try { await stat(target); }
      catch { errors.push(`LOCAL_LINK_BROKEN:${file}:${link.line}:${link.target}`); }
      checks += 1;
    }

    const placeholder = firstMatchOutsideFences(markdown, /\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b/i);
    check(!placeholder, `PLACEHOLDER_FOUND:${file}:${placeholder?.line ?? 0}`, errors);
    checks += 1;
  }

  for (const file of [...PRIMARY_DOCUMENTS, ...PHILOSOPHY_PARTS, "docs/02_Investment_Philosophy/README.md"]) {
    const markdown = await content(file);
    const metadataBlock = markdown.split("\n").slice(0, 25).join("\n");
    for (const field of REQUIRED_METADATA) {
      check(metadataBlock.includes(field), `METADATA_MISSING:${file}:${field}`, errors);
      checks += 1;
    }
  }

  const monolith = await content("docs/02_Investment_Philosophy.md");
  for (let index = 0; index < PHILOSOPHY_PARTS.length; index += 1) {
    const partNumber = index + 1;
    const split = await content(PHILOSOPHY_PARTS[index]);
    const monolithPart = extractPhilosophyPart(monolith, partNumber);
    check(monolithPart === normalizeSplitPart(split), `PHILOSOPHY_PART_DRIFT:02-${partNumber}`, errors);
    checks += 1;
  }

  const readme = Object.hasOwn(contentOverrides, "README.md") ? contentOverrides["README.md"] : await readFile(path.join(root, "README.md"), "utf8");
  for (const linked of ["docs/00_Vision.md", ...PRIMARY_DOCUMENTS.slice(1)]) {
    check(readme.includes(linked), `README_DOCUMENT_LINK_MISSING:${linked}`, errors);
    checks += 1;
  }

  const longTerm = await content("docs/03_LongTerm_Engine.md");
  check(longTerm.includes("R1 IMPLEMENTED") && longTerm.includes("R2+ TARGET"), "LONG_TERM_API_READINESS_MISSING", errors);
  checks += 1;
  const reports = await content("docs/10_Report_System.md");
  check(reports.includes("목록과 비교 — R2+ TARGET") && reports.includes("Delivery — R2+ TARGET"), "REPORT_API_READINESS_MISSING", errors);
  checks += 1;

  for (const phrase of FORBIDDEN_STALE_PHRASES) {
    const found = await findPhrase(files, content, phrase);
    check(!found, `STALE_DOCUMENT_TIMELINE:${found ?? "UNKNOWN"}:${phrase}`, errors);
    checks += 1;
  }

  const canonical = {
    status: errors.length === 0 ? "PASSED" : "FAILED",
    checks,
    errors: [...new Set(errors)].sort(),
    warnings: [...new Set(warnings)].sort(),
    files: files.length,
  };
  return { ...canonical, resultHash: createHash("sha256").update(JSON.stringify(canonical)).digest("hex") };
}

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".md") ? [absolute] : [];
  }));
  return nested.flat().sort();
}

function inspectMarkdownStructure(markdown) {
  const lines = markdown.split("\n");
  let inFence = false;
  let previousLevel = 0;
  let h1Count = 0;
  const headingJumps = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;
    const match = line.match(/^(#{1,6})\s+/);
    if (!match) continue;
    const level = match[1].length;
    if (level === 1) h1Count += 1;
    if (previousLevel > 0 && level > previousLevel + 1) headingJumps.push(index + 1);
    previousLevel = level;
  }
  return { h1Count, headingJumps, fenceClosed: !inFence };
}

function localMarkdownLinks(markdown) {
  const links = [];
  const expression = /!?(?:\[[^\]]*\])\(([^)]+)\)/g;
  for (const match of markdown.matchAll(expression)) {
    const target = match[1].trim().replace(/^<|>$/g, "").split(/\s+[\"']/)[0];
    if (!target || /^(?:https?:|mailto:|data:|#)/.test(target)) continue;
    links.push({ target, line: markdown.slice(0, match.index).split("\n").length });
  }
  return links;
}

function safeLocalLinkTarget(root, sourceFile, rawTarget) {
  let decoded;
  try { decoded = decodeURIComponent(rawTarget.split("#")[0]); }
  catch { return path.join(root, "__invalid_uri__"); }
  if (!decoded) return null;
  const target = path.resolve(root, path.dirname(sourceFile), decoded);
  const normalizedRoot = `${path.resolve(root)}${path.sep}`;
  return target.startsWith(normalizedRoot) ? target : path.join(root, "__outside_root__");
}

function firstMatchOutsideFences(markdown, expression) {
  let inFence = false;
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith("```")) { inFence = !inFence; continue; }
    if (!inFence && expression.test(lines[index])) return { line: index + 1, text: lines[index] };
  }
  return null;
}

function extractPhilosophyPart(monolith, partNumber) {
  const lines = monolith.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## 02-${partNumber}.`));
  const end = partNumber < 5
    ? lines.findIndex((line, index) => index > start && line.startsWith(`## 02-${partNumber + 1}.`))
    : lines.length;
  if (start < 0 || end < 0) return "";
  return normalizePart(lines.slice(start, end), true);
}

function normalizeSplitPart(split) {
  return normalizePart(split.split("\n"), false);
}

function normalizePart(lines, lowerHeadingLevel) {
  let inFence = false;
  const normalized = lines.map((line) => {
    if (line.startsWith("```")) { inFence = !inFence; return line; }
    if (lowerHeadingLevel && !inFence && line.startsWith("#")) return line.slice(1);
    return line;
  });
  while (normalized.length > 0 && (normalized.at(-1) === "" || normalized.at(-1) === "---")) normalized.pop();
  return normalized.join("\n");
}

async function findPhrase(files, content, phrase) {
  for (const file of files) {
    if ((await content(file)).includes(phrase)) return file;
  }
  return null;
}

function check(condition, code, errors) {
  if (!condition) errors.push(code);
}
