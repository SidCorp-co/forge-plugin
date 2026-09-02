// Hands every code file a call wrote to the linter the project itself configured — its own copy
// where it has one, the vendored one where it does not. Owns the routes, never the rules;
// how/code-quality.md says why the split falls there.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { askedAlready, block, remaining, touched } from "../_hook.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDORED = join(HERE, "..", "vendor", "lint-edited-file.mjs");
const INSTALLED = "eslint-plugin-code-quality/claude-plugin/scripts/lint-edited-file.mjs";
const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP = /\/(node_modules|dist|\.next|coverage|\.git)\//;
const MAX_FILES = 5;
/* One budget for every file, and it is what the event's clock has left: five at 60 s each under a 90 s
   hook was a hook killed in silence, and a kill now takes every gate's answer with it. */
const FILE_MS = 60_000;
const SPARE_MS = 5_000;

function delegateFor(file) {
  let dir = dirname(file);
  while (dir && dir !== "/") {
    const cand = join(dir, "node_modules", INSTALLED);
    if (existsSync(cand)) return cand;
    dir = dirname(dir);
  }
  return VENDORED;
}

/* Reported once per content: two of seventeen blocks landed on a grep that named a file written a
   moment before, and said the same thing twice. The disk cannot tell a read from a write. */
const shaOf = (file) => {
  try {
    return createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 16);
  } catch {
    return "";
  }
};

/* The rules on the first line, so the log says what fired: seventeen entries said only which file. */
const RULE_AT_END = /^\d+:\d+\s.*\s([\w@/-]+)$/gmu;
const headed = (text) => {
  const rules = [...new Set([...text.matchAll(RULE_AT_END)].map((one) => one[1]))];
  const [first, ...rest] = text.split("\n");
  return rules.length ? [`${first} — ${rules.join(", ")}`, ...rest].join("\n") : text;
};

export const run = (ev) => {
  const files = touched(ev)
    .filter((f) => CODE.test(f) && !SKIP.test(f))
    .slice(0, MAX_FILES);
  const reasons = [];
  for (const file of files) {
    const left = remaining() - SPARE_MS;
    if (left < 1000) break;
    const before = shaOf(file);
    if (before && askedAlready(ev, `${file}@${before}`, "code-quality", { set: false })) continue;
    try {
      execFileSync("node", [delegateFor(file)], {
        input: JSON.stringify({ ...ev, tool_name: "Write", tool_input: { file_path: file } }),
        encoding: "utf8",
        timeout: Math.min(FILE_MS, left),
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      const text = String(err.stderr ?? "").trim();
      if (err.status !== 2 || !text) continue;
      reasons.push(headed(text));
      /* Stamped as it stands after the delegate, which may have formatted it. */
      const after = shaOf(file);
      if (after) askedAlready(ev, `${file}@${after}`, "code-quality");
    }
  }
  if (reasons.length) block(reasons.join("\n\n"));
};
