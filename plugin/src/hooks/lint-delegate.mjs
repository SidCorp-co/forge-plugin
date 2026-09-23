/* Which linter answers for a file, and what it says about one; two gates ask, after a write and
   before a turn ends. Why the project's copy outranks the vendored one: hooks/how/code-quality.md. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDORED = join(HERE, "..", "..", "hooks", "vendor", "lint-edited-file.mjs");
const PACKAGE = "eslint-plugin-code-quality";
const INSIDE = "claude-plugin/scripts/lint-edited-file.mjs";

const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP = /\/(node_modules|dist|\.next|coverage|\.git)\//;
/* A ceiling, under what the event's clock has left: a hook killed takes every gate's answer with it. */
const FILE_MS = 60_000;
export const MAX_FILES = 5;
const CONFIGS = ["js", "mjs", "cjs", "ts", "mts", "cts"].map((one) => `eslint.config.${one}`);

function delegateFor(file) {
  let dir = dirname(file);
  while (dir && dir !== "/") {
    const cand = join(dir, "node_modules", PACKAGE, INSIDE);
    if (existsSync(cand)) return cand;
    dir = dirname(dir);
  }
  return VENDORED;
}

const optedOut = (dir) => {
  try {
    return JSON.parse(readFileSync(join(dir, "code-quality.json"), "utf8")).hook === false;
  } catch {
    return false;
  }
};

/** Whether the tree holding a file configures ESLint for it and has not opted out: a file left
 *  unlinted is news only where a linter would have spoken, a project that decided nothing being
 *  owed silence (AC-11-1-2). Read up to the directory holding `.git`, the tree's own edge. */
export function configuresLint(file) {
  let found = false;
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (optedOut(dir)) return false;
    found ||= CONFIGS.some((name) => existsSync(join(dir, name)));
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return found;
  }
}

const RULE_AT_END = /^\d+:\d+\s.*\s([\w@/-]+)$/gmu;
const headed = (text) => {
  const rules = [...new Set([...text.matchAll(RULE_AT_END)].map((one) => one[1]))];
  const [first, ...rest] = text.split("\n");
  return rules.length ? [`${first} — ${rules.join(", ")}`, ...rest].join("\n") : text;
};

/** What the project's linter says about one file: `said`, "" where it says nothing, and `unread`
 *  where it never answered in time. `at` names which directory is the project, as a candidate: a file
 *  outside it — a worktree beside the checkout — is the business of its own tree, which the delegate
 *  resolves (ISS-530). Silent unless it exits 2. */
const lintOne = (ev, file, ms, at = null) => {
  try {
    execFileSync("node", [delegateFor(file)], {
      input: JSON.stringify({ ...ev, ...(at ? { cwd: at } : {}), tool_name: "Write", tool_input: { file_path: file } }),
      encoding: "utf8",
      timeout: ms,
      env: { ...process.env, ...(at ? { CLAUDE_PROJECT_DIR: at } : {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { said: "" };
  } catch (error) {
    if (error.code === "ETIMEDOUT") return { said: "", unread: "timeout" };
    const text = String(error.stderr ?? "").trim();
    return { said: error.status === 2 && text ? headed(text) : "" };
  }
};

/** Which of a call's files are worth asking about, in turn, with what the linter said about each: the selection and the budget walk two gates spend, each keeping its own stamping and its own message. `left` is the caller's clock, one gate's spare not being the other's; `skip` is its own stamp, a file answered already at its content, asked first so it takes no place under the cap; `at` names which directory is the project. The first `MAX_FILES` by path are linted, being where a call has written more than a gate can read inside one event, and every file not linted comes back with `unread` saying why — the cap, the clock or the linter's own time limit — so a gate can name it rather than let it read as passed (ISS-38). */
export function* linting(ev, files, left, { skip = () => false, at = () => null } = {}) {
  let handed = 0;
  for (const file of [...new Set(files.filter((one) => CODE.test(one) && !SKIP.test(one)))].sort()) {
    if (skip(file)) continue;
    if (handed >= MAX_FILES) {
      yield { file, said: "", unread: "cap" };
      continue;
    }
    const ms = left();
    if (ms < 1000) {
      yield { file, said: "", unread: "clock" };
      continue;
    }
    handed += 1;
    yield { file, ...lintOne(ev, file, Math.min(FILE_MS, ms), at(file)) };
  }
}
