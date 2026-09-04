/* The runner, on a scratch checkout of its own: what it runs, what it skips, and the two trees it
   refuses to answer about. A gate aimed at the wrong tree does not fail, it certifies, and a step
   the scoping dropped by mistake reads exactly like a step that passed (ISS-117). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { STEPS, WHOLE_TREE_TESTS } from "../../../tools/gates/steps.mjs";
import { recordRun, runSays, runSeries } from "../../../tools/gates/timing.mjs";
import { tempRoom } from "../fixtures.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const RUNNER = join("tools", "gates.mjs");
const COPIED = [RUNNER, join("tools", "checkout.mjs"), join("tools", "gates", "steps.mjs"),
  join("tools", "gates", "scope.mjs"), join("tools", "gates", "ledger.mjs"),
  join("tools", "gates", "timing.mjs")];

/* One file per top-level entry the table claims, plus one under every path a step reads, so a
   scratch run scopes the way the real one does instead of widening on a path nothing owns. */
const PLACED = ["eslint.config.mjs", ".forge.json", "package-lock.json", "docs/one.md",
  "docs/requirements/one.md", ".claude-plugin/one.json", "plugin/src/one.mjs",
  "plugin/scripts/one.mjs", "plugin/skills/one.md", "plugin/vi-natural/one.mjs",
  "plugin/hooks/vendor/one.mjs", "tools/check-vi-text.mjs", "tools/sync-skills.mjs",
  "packages/code-quality/claude-quality.mjs", "packages/code-quality/claude-plugin/skills/one.md"];

const write = (work, path, text) => {
  mkdirSync(join(work, dirname(path)), { recursive: true });
  writeFileSync(join(work, path), text);
};

const NAMED = WHOLE_TREE_TESTS.map((one) => one.endsWith(".test.mjs") ? one : join(one, "one.test.mjs"));

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
  const at = tempRoom(`${name}-`);
  const work = join(at, "checkout");
  for (const one of COPIED) write(work, one, readFileSync(join(ROOT, one), "utf8"));
  for (const one of [...PLACED, ...NAMED, "plugin/test/tools/one.test.mjs"]) {
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
const runsFile = (work) => join(work, ".git", "gate-ledger", "runs");
const runs = (work) => readFileSync(runsFile(work), "utf8").trim().split("\n");

test("-h names the two flags and what the record cannot see", () => {
  const said = run(ROOT.replace(/\/$/u, ""), ["-h"]).stdout;
  for (const one of ["--full", "--anyway", "node_modules", "merge-base", "tree judged",
    "seconds that step took", "one line per green run"]) {
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

/* The suite executes files of this repository, so a mode alone decides a verdict: a digest over the
   bytes would schedule the step and then hand it the last pass's answer. */
test("a mode change alone is not a step the record calls green", () => {
  const { at, work } = scratch("mode");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    assert.equal(run(work).status, 0);
    chmodSync(join(work, "plugin/src/two.mjs"), 0o755);
    git(work, "add", "-A");
    git(work, "commit", "-m", "made it executable");
    const said = run(work);
    assert.match(said.stdout, /=== lint ===/u, said.stdout);
    assert.ok(!said.stdout.includes("skip lint "), `the record answered for a mode it never hashed:\n${said.stdout}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

// A digest reading a gitlink as absent holds one answer across every revision of the submodule.
test("a gitlink is refused rather than hashed as absent", () => {
  const { at, work } = scratch("gitlink");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    const sha = git(work, "rev-parse", "HEAD").stdout.trim();
    git(work, "update-index", "--add", "--cacheinfo", `160000,${sha},plugin/sub`);
    mkdirSync(join(work, "plugin", "sub"), { recursive: true });
    git(work, "commit", "-m", "the submodule");
    const said = run(work);
    assert.equal(said.status, 1, said.stdout);
    assert.match(said.stderr, /cannot read its own record: git reports \S+\/plugin\/sub as a file/u, said.stderr);
    assert.match(said.stderr, /--full/u, said.stderr);
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
    // A count is not the paths, and the run's reader is the one who has to recognise them as theirs.
    assert.match(anyway.stdout.split("=== scope:")[0], /asked for with --anyway\n {4}docs\/three\.md/u, anyway.stdout);
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

/* The gate measured the whole run and every step and the process took both with it, so the question
   "has this gate grown" had nothing to subtract and the first review of it would have had to plant
   its own baseline by hand (ISS-166). */
test("a pass records the seconds it took, the skip line says them, and an older entry still passes", () => {
  const { at, work } = scratch("seconds");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    assert.equal(run(work).status, 0);
    const entry = readFileSync(ledgerFile(work, "lint"), "utf8").trim();
    assert.match(entry, /^[0-9a-f]{12} \d+s lint$/u, `the pass carries no seconds: ${entry}`);

    const again = run(work);
    assert.match(again.stdout, /skip lint {19}digest [0-9a-f]{12}, \d+s when it passed/u, again.stdout);

    // The form written before seconds were kept: it names a pass, and reading it as a miss re-runs
    // every step in the repository the day the release lands.
    writeFileSync(ledgerFile(work, "lint"), `${entry.replace(/ \d+s /u, " ")}\n`);
    const older = run(work);
    assert.match(older.stdout, /skip lint {19}digest [0-9a-f]{12}, passing before this record kept seconds/u,
      `an entry without seconds read as a miss:\n${older.stdout}`);
    assert.ok(!older.stdout.includes("=== lint ==="), `the step ran anyway:\n${older.stdout}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a green run records its whole-run seconds and how many steps it spent; a red run records none", () => {
  const { at, work } = scratch("series");
  try {
    landed(work, "docs/two.md", "a second document\n");
    const scoped = run(work);
    assert.equal(scoped.status, 0, scoped.stdout + scoped.stderr);
    assert.equal(runs(work).length, 1, `one green run left ${runs(work).length} figure(s)`);
    assert.match(runs(work)[0], new RegExp(`^\\S+ \\d+s 3/${STEPS.length}$`, "u"), runs(work)[0]);
    assert.match(scoped.stdout, new RegExp(`recorded: \\d+s over 3 of ${STEPS.length} step\\(s\\)`, "u"), scoped.stdout);

    const whole = run(work, ["--full"]);
    assert.equal(whole.status, 0, whole.stdout + whole.stderr);
    assert.equal(runs(work).length, 2, "a --full run left no figure, and it is the comparable one");
    assert.match(runs(work)[1], new RegExp(`^\\S+ \\d+s ${STEPS.length}/${STEPS.length}$`, "u"), runs(work)[1]);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a run whose step failed leaves no figure", () => {
  const { at, work } = scratch("no-figure", "lint");
  try {
    landed(work, "plugin/src/two.mjs", "export const two = 2;\n");
    assert.equal(run(work).status, 1);
    assert.ok(!existsSync(runsFile(work)), "the seconds spent reaching a failure were recorded as a run");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The sentence, on a planted record rather than on real timings: every step of a scratch checkout
   is `node -e ""`, so a run there measures process startup and no comparison would be stable. */
const planted = (lines) => {
  const dir = join(tempRoom("said-"), "gate-ledger");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "runs"), lines.length === 0 ? "" : `${lines.join("\n")}\n`);
  return dir;
};

const FULL = "2026-01-01T00:00:00.000Z 80s 12/12";

test("a figure is compared only with a whole-gate figure, and what is comparable is always named", () => {
  assert.match(runSays(planted([])), /no run is recorded/u);
  assert.match(runSays(planted([])), /npm run check -- --full/u);

  /* The shape this repository actually produces: scoped ship-gate runs between the full ones. Read
     off the newest two *runs* the comparison would never subtract anything at all. */
  const apart = runSays(planted([FULL, "2026-01-02T00:00:00.000Z 9s 3/12", "2026-01-03T00:00:00.000Z 100s 12/12"]));
  assert.match(apart, /100s over 12 of 12 step\(s\) on 2026-01-03, 1\.25x the 80s before it/u,
    `two whole-gate figures with a scoped run between them were not subtracted:\n${apart}`);

  const scoped = runSays(planted([FULL, "2026-01-03T00:00:00.000Z 9s 3/12"]));
  assert.match(scoped, /^9s over 3 of 12 step\(s\) on 2026-01-03, which is scoped and measures less/u, scoped);
  assert.match(scoped, /the whole gate last took 80s over 12 of 12 step\(s\) on 2026-01-01, the only whole-gate figure recorded/u,
    `a scoped run that names no comparable figure leaves the reader to assume one:\n${scoped}`);

  const first = runSays(planted(["2026-01-04T00:00:00.000Z 9s 3/12"]));
  assert.match(first, /no run recorded spent the whole table; npm run check -- --full plants a figure/u, first);

  // A gate under a second is the scratch case, and a ratio over it is a division by zero.
  assert.match(runSays(planted(["2026-01-05T00:00:00.000Z 0s 12/12", "2026-01-06T00:00:00.000Z 3s 12/12"])),
    /3s more than the one before it, which took under a second, so there is no ratio/u);
});

// Only the newest two decide anything, so the file is a window and not a history to grow.
test("the record keeps the runs the question needs and drops the rest", () => {
  const dir = planted(Array.from({ length: 30 }, (one, nth) => `2026-01-01T00:00:0${nth % 10}.000Z ${nth}s 12/12`));
  recordRun(dir, { seconds: 7, ran: 12, total: 12 });
  const held = runSeries(dir);
  assert.equal(held.length, 20, `the record holds ${held.length} run(s)`);
  assert.equal(held.at(-1).seconds, 7);
  assert.equal(held.at(-2).seconds, 29, "the oldest went, not the newest");
});

/* Scoped runs are most of what a checkout spends, so a window dropping by age alone loses the
   figures a comparison reads within a day of the release that started keeping them — and loses the
   predecessor to the very run that needed one. */
test("the newest two whole-gate figures survive a window filled with scoped runs", () => {
  const scoped = Array.from({ length: 25 }, (one, nth) => `2026-02-0${(nth % 9) + 1}T00:00:00.000Z 9s 3/12`);
  const dir = planted([FULL, ...scoped]);
  recordRun(dir, { seconds: 9, ran: 3, total: 12 });
  assert.deepEqual(runSeries(dir)[0], { at: "2026-01-01T00:00:00.000Z", seconds: 80, ran: 12, total: 12 });
  assert.match(runSays(dir), /the whole gate last took 80s over 12 of 12 step\(s\)/u, runSays(dir));

  // The full run that follows them must not be the run that evicts its own predecessor.
  recordRun(dir, { seconds: 96, ran: 12, total: 12 });
  const held = runSeries(dir).filter((one) => one.ran === one.total);
  assert.equal(held.length, 2, `${held.length} whole-gate figure(s) survived, and a change needs two`);
  assert.match(runSays(dir), /96s over 12 of 12 step\(s\).*1\.20x the 80s before it/u, runSays(dir));
});
