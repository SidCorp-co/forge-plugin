/* A delegated run stands in a worktree beside the checkout, and the host keys its transcripts on the
   checkout it was launched in, so a reading that slugged the worktree's own path found none and
   printed a profile of nothing (ISS-2094). The layout is written by hand, as git writes it, because
   a `git worktree add` is a process the gate's read audit spends every run. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { slugFor } from "../../../src/stats/corpus/corpus.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { FORGE, OTHER, transcript } from "../fixture-runs.mjs";

/* A main checkout and one linked worktree of it: the admin directory's `commondir` is how both git
   and the walk get from the worktree back to the repository. */
const checkoutWithWorktree = () => {
  const room = realpathSync(tempRoom("stats-worktree-"));
  const checkout = join(room, "checkout");
  const tree = join(room, "wt-checkout-ISS-1");
  const admin = join(checkout, ".git", "worktrees", "wt-checkout-ISS-1");
  mkdirSync(admin, { recursive: true });
  writeFileSync(join(checkout, ".git", "HEAD"), "ref: refs/heads/master\n");
  writeFileSync(join(admin, "HEAD"), "ref: refs/heads/iss-1\n");
  writeFileSync(join(admin, "commondir"), "../..\n");
  mkdirSync(tree);
  writeFileSync(join(tree, ".git"), `gitdir: ${admin}\n`);
  return { room, checkout, tree };
};

/* The runs as the host files them: under the slug of the directory the session was launched in. */
const runsFor = (room, directory) => {
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(directory), "session-one", "tasks");
  mkdirSync(tasks, { recursive: true });
  writeFileSync(join(tasks, "a0001.output"), `${transcript()}\n`);
  writeFileSync(join(tasks, "a0002.output"), `${OTHER}\n`);
};

const statsIn = (room, cwd, ...argv) => spawnSync(FORGE, ["stats", "runs", ...argv], {
  cwd,
  encoding: "utf8",
  env: { ...process.env, HOME: room, XDG_CONFIG_HOME: tempRoom("stats-home-"), TMPDIR: room },
});

test("a reading taken in a worktree reads the checkout it was cut from, and says it did", () => {
  const { room, checkout, tree } = checkoutWithWorktree();
  runsFor(room, checkout);

  const run = statsIn(room, tree);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^1 issue-flow run\(s\), 2026-09-01 00:00Z to 2026-09-01 00:41Z$/mu, run.stdout);
  assert.ok(run.stdout.includes(join(room, `claude-${process.getuid()}`, slugFor(checkout))),
    `the root read is the checkout's\n${run.stdout}`);
  assert.equal(run.stderr,
    `stats runs: reading the checkout ${checkout}, which the working directory ${tree} belongs to; `
    + "--checkout names another.\n");
});

test("under --json the resolution is said beside the document and never inside it", () => {
  const { room, checkout, tree } = checkoutWithWorktree();
  runsFor(room, checkout);

  const run = statsIn(room, tree, "--json");
  assert.equal(run.status, 0, run.stderr);
  const read = JSON.parse(run.stdout);
  assert.equal(read.project, checkout);
  assert.equal(read.runs, 1);
  assert.match(run.stderr, /^stats runs: reading the checkout /u, run.stderr);
});

test("a directory no checkout holds is read as itself, with nothing said about a resolution", () => {
  const room = realpathSync(tempRoom("stats-nowhere-"));
  const alone = join(room, "alone");
  mkdirSync(alone);
  runsFor(room, alone);

  const run = statsIn(room, alone);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^1 issue-flow run\(s\)/mu, run.stdout);
  assert.equal(run.stderr, "");
});

/* The ship reads the same layout to the same checkout, which is tools/test/checkout.test.mjs's case:
   both pinned to the one directory is how the two stay one answer without the plugin importing the ship. */
test("the stats reader's checkout is the one the worktree's commondir names", () => {
  const { room, checkout, tree } = checkoutWithWorktree();
  runsFor(room, checkout);

  assert.equal(JSON.parse(statsIn(room, tree, "--json").stdout).project, checkout);
});

/* The refusal's wording is `runs.test.mjs`'s to pin; what is this case's is that a worktree reaches
   the argument's refusal before any resolution, so nothing is resolved for an argument refused. */
test("a relative --checkout is still refused at the argument", () => {
  const { room, tree } = checkoutWithWorktree();
  const run = statsIn(room, tree, "--checkout", "../elsewhere");
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "");
  assert.ok(run.stderr.includes("`../elsewhere`"), run.stderr);
  assert.doesNotMatch(run.stderr, /reading the checkout/u, "no resolution is said for a refused argument");
});
