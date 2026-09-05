/* Which linter answers for a file, and what it says about one; two gates ask, after a write and
   before a turn ends. Why the project's copy outranks the vendored one: hooks/how/code-quality.md. */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDORED = join(HERE, "..", "..", "hooks", "vendor", "lint-edited-file.mjs");
const PACKAGE = "eslint-plugin-code-quality";
const INSIDE = "claude-plugin/scripts/lint-edited-file.mjs";

export const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
export const SKIP = /\/(node_modules|dist|\.next|coverage|\.git)\//;
/* A ceiling, under what the event's clock has left: a hook killed takes every gate's answer with it. */
export const FILE_MS = 60_000;
export const MAX_FILES = 5;

export function delegateFor(file) {
  let dir = dirname(file);
  while (dir && dir !== "/") {
    const cand = join(dir, "node_modules", PACKAGE, INSIDE);
    if (existsSync(cand)) return cand;
    dir = dirname(dir);
  }
  return VENDORED;
}

const RULE_AT_END = /^\d+:\d+\s.*\s([\w@/-]+)$/gmu;
export const headed = (text) => {
  const rules = [...new Set([...text.matchAll(RULE_AT_END)].map((one) => one[1]))];
  const [first, ...rest] = text.split("\n");
  return rules.length ? [`${first} — ${rules.join(", ")}`, ...rest].join("\n") : text;
};

/** What the project's linter says about one file, or "" where it says nothing. `at` names which
 *  directory is the project: the delegate reads the session's before the event's, and neither is the
 *  file's once a run writes outside the directory it started in. Silent unless it exits 2. */
export const lintOne = (ev, file, ms, at = null) => {
  try {
    execFileSync("node", [delegateFor(file)], {
      input: JSON.stringify({ ...ev, ...(at ? { cwd: at } : {}), tool_name: "Write", tool_input: { file_path: file } }),
      encoding: "utf8",
      timeout: ms,
      env: { ...process.env, ...(at ? { CLAUDE_PROJECT_DIR: at } : {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return "";
  } catch (error) {
    const text = String(error.stderr ?? "").trim();
    return error.status === 2 && text ? headed(text) : "";
  }
};

/** Which of a call's files are worth asking about, in turn, with what the linter said about each: the selection and the budget walk two gates spend, each keeping its own stamping and its own message. `left` is the caller's clock, one gate's spare not being the other's; `skip` is its own stamp, asked after the budget so a file counted out is counted out for one reason; `at` names which directory is the project; `MAX_FILES` is where a call has written more than a gate can read inside one event, and the rest go unlinted rather than the event unanswered. */
export function* linting(ev, files, left, { skip = () => false, at = () => null } = {}) {
  for (const file of files.filter((one) => CODE.test(one) && !SKIP.test(one)).slice(0, MAX_FILES)) {
    const ms = left();
    if (ms < 1000) break;
    if (skip(file)) continue;
    yield { file, said: lintOne(ev, file, Math.min(FILE_MS, ms), at(file)) };
  }
}
