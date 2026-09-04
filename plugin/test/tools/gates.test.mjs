/* The runner, on a scratch checkout of its own: what it runs, what it skips, and the two trees it
   refuses to answer about. A gate aimed at the wrong tree does not fail, it certifies, and a step
   the scoping dropped by mistake reads exactly like a step that passed (ISS-117). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { STEPS, WHOLE_TREE_TESTS } from "../../../tools/gates/steps.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const RUNNER = join("tools", "gates.mjs");
const COPIED = [RUNNER, join("tools", "checkout.mjs"), join("tools", "gates", "steps.mjs"),
  join("tools", "gates", "scope.mjs"), join("tools", "gates", "ledger.mjs")];

/* One file per top-level entry the table claims, plus one under every path a step reads, so a
   scratch run scopes the way the real one does instead of widening on a path nothing owns. */
const PLACED = ["eslint.config.mjs", ".forge.json", "package-lock.json", "docs/one.md",
  "docs/requirements/one.md", "feedback/one.md", ".claude-plugin/one.json", "plugin/src/one.mjs",
  "plugin/scripts/one.mjs", "plugin/skills/one.md", "plugin/vi-natural/one.mjs",
  "plugin/hooks/vendor/one.mjs", "tools/check-vi-text.mjs", "tools/sync-skills.mjs",
  "packages/code-quality/claude-quality.mjs", "packages/code-quality/claude-plugin/skills/one.md"];

const write = (work, path, text) => {
  mkdirSync(join(work, dirname(path)), { recursive: true });
  writeFileSync(join(work, path), text);
};

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });

const run = (work, argv = [], cwd = work) =>
  spawnSync(process.execPath, [join(work, RUNNER), ...argv], { cwd, encoding: "utf8" });

const scripts = (failing) =>
  Object.fromEntries(STEPS.filter((step) => !step.tests)
    .map((step) => [step.label, failing === step.label ? "node -e \"process.exit(1)\"" : "node -e \"\""]));

/* Its own checkout, because the questions are about a tree: the branch a diff is taken against,
   and whether the tree is the shared one. Committed on master, then worked on a branch, so the
   merge-base is a real base and a change to it is a real diff. */
const scratch = (name, failing) => {
  const at = mkdtempSync(join(tmpdir(), `${name}-`));
  const work = join(at, "checkout");
  for (const one of COPIED) write(work, one, readFileSync(join(ROOT, one), "utf8"));
  for (const one of [...PLACED, ...WHOLE_TREE_TESTS, "plugin/test/tools/one.test.mjs"]) {
    write(work, one, one.endsWith(".test.mjs") ? `import test from "node:test";\ntest("${one}", () => {});\n` : `${one}\n`);
  }
  write(work, "package.json", JSON.stringify({ name: "scratch", version: "1.0.0", scripts: scripts(failing) }, null, 2));
  git(work, "init", "-b", "master");
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(work, "config", key, value);
  git(work, "add", "-A");
  git(work, "commit", "-m", "the tree");
  git(work, "checkout", "-b", "work");
  return { at, work };
};

const landed = (work, path, text) => {
  write(work, path, text);
  git(work, "add", "-A");
  git(work, "commit", "-m", `wrote ${path}`);
};

const ledgerFile = (work, label) => join(work, ".git", "gate-ledger", label.replace(/[^\w.-]+/gu, "-"));

test("-h names the two flags and what the record cannot see", () => {
  const said = run(ROOT.replace(/\/$/u, ""), ["-h"]).stdout;
  for (const one of ["--full", "--anyway", "node_modules", "merge-base", "tree judged"]) {
    assert.ok(said.includes(one), `${one} is not in the usage:\n${said}`);
  }
});

test("a docs-only change runs the steps that read docs and no others", () => {
  const { at, work } = scratch("scoped");
  try {
    landed(work, "docs/two.md", "a second document\n");
    const first = run(work);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /run {2}test:tree/u, first.stdout);
    assert.match(first.stdout, /skip check:dup\s+nothing it reads changed/u, first.stdout);
    assert.ok(!first.stdout.includes("=== check:dup ==="), `a step nothing reached was spent:\n${first.stdout}`);
    assert.match(first.stdout, new RegExp(`the tree judged: ${work}`, "u"), first.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a path no step claims widens the run, and says which path", () => {
  const { at, work } = scratch("stranger");
  try {
    landed(work, "newdir/one.mjs", "export const one = 1;\n");
    const said = run(work).stdout;
    assert.match(said, /the full gate — newdir\/one\.mjs belongs to no gate step/u, said);
    assert.match(said, /=== check:dup ===/u, said);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a change to what decides the scoping widens the run", () => {
  const { at, work } = scratch("derivation");
  try {
    landed(work, join("tools", "gates", "scope.mjs"), `${readFileSync(join(ROOT, "tools", "gates", "scope.mjs"), "utf8")}\n`);
    const said = run(work).stdout;
    assert.match(said, /the full gate — tools\/gates\/scope\.mjs decides what a run may skip/u, said);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a step whose inputs have not moved since it passed is skipped by digest, and one that moved is run", () => {
  const { at, work } = scratch("ledger");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    assert.equal(run(work).status, 0);
    const again = run(work);
    assert.match(again.stdout, /=== ledger: \d+ of \d+ step\(s\) green already ===/u, again.stdout);
    assert.match(again.stdout, /skip lint {19}digest [0-9a-f]{12}/u, again.stdout);
    assert.match(again.stdout, /All 0 gate step\(s\) passed/u, again.stdout);

    landed(work, "plugin/src/two.mjs", "export const two = 22;\n");
    const moved = run(work);
    assert.match(moved.stdout, /=== lint ===/u, moved.stdout);
    assert.equal(moved.status, 0, moved.stdout + moved.stderr);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a red step records nothing, and the failing verdict names the tree", () => {
  const { at, work } = scratch("red", "lint");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    const said = run(work);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`Gate failed: lint — the tree judged: ${work}`, "u"), said.stderr);
    assert.ok(!existsSync(ledgerFile(work, "lint")), "a step that failed was recorded as passed");
    assert.ok(!existsSync(ledgerFile(work, "test")), "a step the run never reached was recorded as passed");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("--full runs every step whatever the diff and the record say", () => {
  const { at, work } = scratch("full");
  try {
    landed(work, "docs/two.md", "a second document\n");
    assert.equal(run(work).status, 0);
    const said = run(work, ["--full"]);
    assert.ok(!said.stdout.includes("=== ledger:"), `--full read the record:\n${said.stdout}`);
    for (const step of STEPS) assert.ok(said.stdout.includes(`=== ${step.label} ===`), `${step.label} did not run`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* More than one session stands in the shared checkout, so its uncommitted paths may be another
   agent's. A worktree is the opposite case: its uncommitted work is the point of having one. */
test("the dirty shared checkout is refused, --anyway gates it and says so at both ends", () => {
  const { at, work } = scratch("dirty");
  try {
    landed(work, "docs/two.md", "a second document\n");
    write(work, "docs/three.md", "not committed\n");
    const refused = run(work);
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.stderr, /docs\/three\.md/u, refused.stderr);
    assert.match(refused.stderr, /node tools\/run\.mjs start <ISS-nn>/u, refused.stderr);

    const anyway = run(work, ["--anyway"]);
    assert.equal(anyway.status, 0, anyway.stdout + anyway.stderr);
    const banners = anyway.stdout.match(/asked for with --anyway/gu) ?? [];
    assert.equal(banners.length, 2, `the opt-in is named ${banners.length} time(s), not at both ends`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a worktree is never refused for its uncommitted paths", () => {
  const { at, work } = scratch("worktree");
  try {
    const tree = join(at, "wt");
    git(work, "worktree", "add", tree, "-b", "other");
    write(tree, "docs/three.md", "not committed\n");
    const said = spawnSync(process.execPath, [join(tree, RUNNER)], { cwd: tree, encoding: "utf8" });
    assert.equal(said.status, 0, said.stdout + said.stderr);
    assert.match(said.stdout, new RegExp(`the tree judged: ${tree}`, "u"), said.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("another tree's copy of the runner is refused rather than answered about that tree", () => {
  const { at, work } = scratch("cross");
  try {
    const tree = join(at, "wt");
    git(work, "worktree", "add", tree, "-b", "other");
    const said = run(work, [], tree);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, new RegExp(`standing in ${tree}`, "u"), said.stderr);
    assert.match(said.stderr, new RegExp(`node ${join(tree, RUNNER)}`, "u"), said.stderr);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
