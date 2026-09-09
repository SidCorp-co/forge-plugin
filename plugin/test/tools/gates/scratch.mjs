/* A checkout of the runner's own, per case: its questions are about a tree, never this repository's. */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { stampRoom } from "../../../src/hooks/stamps.mjs";
import { STEPS, WHOLE_TREE_TESTS } from "../../../../tools/gates/steps.mjs";
import { ranAsync, tempRoom } from "../../fixtures.mjs";

export const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "..");
export const RUNNER = join("tools", "gates.mjs");

const STATIC = [/\bfrom\s*["'](\.[^"']+)["']/gu, /\bimport\s+["'](\.[^"']+)["']/gu];

// Every module these roots statically reach, so no list has to be remembered into step.
export const reachedFrom = (roots) => {
  const seen = new Set();
  const walk = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    const full = resolve(ROOT, path);
    let text;
    try {
      text = readFileSync(full, "utf8");
    } catch {
      return;
    }
    for (const pattern of STATIC) {
      for (const [, one] of text.matchAll(pattern)) walk(relative(ROOT, resolve(dirname(full), one)));
    }
  };
  for (const one of roots) walk(one);
  return [...seen].sort();
};

// The runner, and the reporter `steps.mjs` names by path: a walk sees no runtime specifier.
export const RUNNER_ROOTS = [RUNNER, join("tools", "gates", "file-times.mjs")];

// `recurrence.mjs`'s own, and `project-config.mjs`, which every `write()` reaches the same way.
export const ROUTE_ROOTS = [
  join("plugin", "src", "tracker", "filing", "route.mjs"),
  join("plugin", "src", "tracker", "comments.mjs"),
  join("plugin", "src", "tracker", "issues.mjs"),
  join("plugin", "src", "tracker", "project-config.mjs"),
  join("plugin", "src", "resolve", "settings.mjs"),
  join("plugin", "src", "resolve", "flags.mjs"),
];

export const COPIED = reachedFrom(RUNNER_ROOTS);
export const STAMPED = basename(stampRoom());

/* One file per top-level entry the table claims, plus one under every path a step reads, so a
   scratch run scopes the way the real one does instead of widening on a path nothing owns. */
export const PLACED = ["eslint.config.mjs", ".forge.json", "package-lock.json", "docs/one.md",
  "docs/requirements/one.md", ".claude-plugin/one.json", "plugin/src/one.mjs",
  "plugin/scripts/one.mjs", "plugin/skills/one.md", "plugin/vi-natural/one.mjs",
  "plugin/hooks/vendor/one.mjs", "tools/check-vi-text.mjs", "tools/sync-skills.mjs",
  "packages/code-quality/claude-quality.mjs", "packages/code-quality/claude-plugin/skills/one.md"];

export const write = (work, path, text) => {
  mkdirSync(join(work, dirname(path)), { recursive: true });
  writeFileSync(join(work, path), text);
};

export const NAMED = WHOLE_TREE_TESTS.map((one) => one.endsWith(".test.mjs") ? one : join(one, "one.test.mjs"));

export const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });

/* Without the variable node's runner sets in every test process: a `node --test` spawned under it
   runs as a child of this suite and spends no file, so the scratch's test steps would pass empty. */
export const SHELL_ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "NODE_TEST_CONTEXT"));

export const run = (work, argv = [], cwd = work, env = {}) =>
  spawnSync(process.execPath, [join(work, RUNNER), ...argv],
    { cwd, encoding: "utf8", env: { ...SHELL_ENV, ...env } });

// Awaited: a case serving the tracker itself cannot also block in `spawnSync` and answer the gate.
export const ranGate = (work, argv = [], cwd = work, env = {}) =>
  ranAsync(process.execPath, [join(work, RUNNER), ...argv], { ...SHELL_ENV, ...env }, cwd);

/* A step writing the hook stamp room into whatever temporary directory it was handed, which is the
   shape a suite has when nothing points TMPDIR at a room of its own (ISS-361). */
export const LEAKS = "node -e \"const fs=require('node:fs'),os=require('node:os'),p=require('node:path');"
  + `const room=p.join(os.tmpdir(),'${STAMPED}');fs.mkdirSync(room,{recursive:true});`
  + "fs.writeFileSync(p.join(room,'learning-gate-planted'),'')\"";

const command = (label, failing, leaking) => {
  if (label === failing) return "node -e \"process.exit(1)\"";
  if (label === leaking) return LEAKS;
  return "node -e \"\"";
};

const scripts = (failing, leaking) =>
  Object.fromEntries(STEPS.filter((step) => !step.tests)
    .map((step) => [step.label, command(step.label, failing, leaking)]));

/* Committed on master, then worked on a branch, so the merge-base is real and a change to it diffs.
   `also` are roots beyond the runner's, `slug` the project a filing from inside would be aimed at. */
export const scratch = (name, failing, leaking, { also = [], slug = null } = {}) => {
  const at = tempRoom(`${name}-`);
  const work = join(at, "checkout");
  for (const one of [...COPIED, ...reachedFrom(also)]) {
    write(work, one, readFileSync(join(ROOT, one), "utf8"));
  }
  for (const one of [...PLACED, ...NAMED, "plugin/test/tools/one.test.mjs"]) {
    // In prose, never after its own path: that is how node reports a file that failed to load.
    write(work, one, one.endsWith(".test.mjs")
      ? `import test from "node:test";\ntest("the green case of ${one}", () => {});\n`
      : `${one}\n`);
  }
  if (slug) write(work, ".forge.json", JSON.stringify({ slug }));
  write(work, "package.json",
    JSON.stringify({ name: "scratch", version: "1.0.0", scripts: scripts(failing, leaking) }, null, 2));
  git(work, "init", "-b", "master");
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(work, "config", key, value);
  git(work, "add", "-A");
  git(work, "commit", "-m", "the tree");
  git(work, "checkout", "-b", "work");
  return { at, work };
};

export const landed = (work, path, text) => {
  write(work, path, text);
  git(work, "add", "-A");
  git(work, "commit", "-m", `wrote ${path}`);
};

export const entryDir = (work) => join(work, ".git", "gate-ledger");
export const ledgerFile = (work, label) => join(entryDir(work), label.replace(/[^\w.-]+/gu, "-"));
export const runsFile = (work) => join(entryDir(work), "runs");
export const runs = (work) => readFileSync(runsFile(work), "utf8").trim().split("\n");

// The step entries alone: the runs series, the per-file records and the attributions share the directory.
export const entryNames = (work) => readdirSync(entryDir(work))
  .filter((one) => one !== "runs" && !one.endsWith("-files") && !one.endsWith("-alone")).sort();

export const entries = (work) =>
  Object.fromEntries(entryNames(work).map((one) => [one, readFileSync(join(entryDir(work), one), "utf8")]));
