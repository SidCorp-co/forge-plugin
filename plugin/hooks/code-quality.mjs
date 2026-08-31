#!/usr/bin/env node
// Hands every code file a call wrote to the linter the project itself configured — its own copy
// where it has one, the vendored one where it does not. Owns the routes, never the rules;
// why/code-quality.md says why the split falls there.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readEvent, touched } from "./_hook.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDORED = join(HERE, "vendor", "lint-edited-file.mjs");
const INSTALLED = "eslint-plugin-code-quality/claude-plugin/scripts/lint-edited-file.mjs";
const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP = /\/(node_modules|dist|\.next|coverage|\.git)\//;
const MAX_FILES = 5;

function delegateFor(file) {
  let dir = dirname(file);
  while (dir && dir !== "/") {
    const cand = join(dir, "node_modules", INSTALLED);
    if (existsSync(cand)) return cand;
    dir = dirname(dir);
  }
  return VENDORED;
}

const ev = readEvent();
const files = touched(ev)
  .filter((f) => CODE.test(f) && !SKIP.test(f))
  .slice(0, MAX_FILES);

const reasons = [];
for (const file of files) {
  try {
    execFileSync("node", [delegateFor(file)], {
      input: JSON.stringify({ ...ev, tool_name: "Write", tool_input: { file_path: file } }),
      encoding: "utf8",
      timeout: 60_000,
      // Without this the child's stderr is ALSO inherited, so every finding prints twice.
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    // The delegate already speaks the hook protocol; translating it would invent a second one.
    const text = String(err.stderr ?? "").trim();
    if (err.status === 2 && text) reasons.push(text);
  }
}

if (reasons.length) {
  process.stderr.write(`${reasons.join("\n\n")}\n`);
  process.exit(2);
}
