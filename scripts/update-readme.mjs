#!/usr/bin/env node
// 루트 README의 프로젝트 목록 섹션을 각 프로젝트 폴더의 README에서 자동 생성한다.
// 요약 문구는 각 README 상단의 `> 한줄설명` 블록인용구에서 추출한다.
// 사용법: node scripts/update-readme.mjs

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const README = join(ROOT, "README.md");

const IGNORE = new Set([".git", ".omc", ".claude", "node_modules", "scripts", ".vscode", ".idea"]);
const START = "<!-- PROJECTS:START (자동 생성 - 직접 수정하지 마세요) -->";
const END = "<!-- PROJECTS:END -->";

function extractDescription(readmePath) {
  const lines = readFileSync(readmePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith(">")) {
      const desc = line.replace(/^>+\s*/, "").trim();
      if (desc) return desc;
    }
  }
  return "(설명 없음 — README 상단에 `> 한줄설명` 을 추가하세요)";
}

const projects = readdirSync(ROOT)
  .filter((name) => !name.startsWith(".") && !IGNORE.has(name))
  .filter((name) => statSync(join(ROOT, name)).isDirectory())
  .filter((name) => existsSync(join(ROOT, name, "README.md")))
  .sort((a, b) => a.localeCompare(b, "ko"));

const list = projects
  .map((name, i) => {
    const desc = extractDescription(join(ROOT, name, "README.md"));
    return `${i + 1}. **${name}**\n   - ${desc}`;
  })
  .join("\n\n");

const block = `${START}\n\n${list || "_아직 등록된 프로젝트가 없습니다._"}\n\n${END}`;

let content;
if (existsSync(README)) {
  content = readFileSync(README, "utf8");
} else {
  content = `# AI Playground\n\n> AI를 활용한 프로젝트 모음\n\n## 프로젝트 목록\n\n${block}\n`;
}

if (content.includes(START) && content.includes(END)) {
  const re = new RegExp(
    `${START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
  );
  content = content.replace(re, block);
} else {
  content = content.trimEnd() + `\n\n## 프로젝트 목록\n\n${block}\n`;
}

writeFileSync(README, content, "utf8");
console.log(`✔ 루트 README 갱신 완료 — 프로젝트 ${projects.length}개`);
for (const p of projects) console.log(`  - ${p}`);
