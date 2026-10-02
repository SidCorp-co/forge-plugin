/* Which branch `finish` ends: the one `start` recorded, wherever the tree's HEAD stands when finish
   runs. The rest of `finish` is `finish.test.mjs`'s. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BARE, OWN_SLUG, git, pushed, runIn } from "../run-fixtures.mjs";

const KEY = "ISS-88";
const BRANCH = "iss-88-ends";
const AUTHOR = ["-c", "user.email=t@example.test", "-c", "user.name=Test"];

const recordOf = (work) => join(work, ".git", "worktrees", `wt-${OWN_SLUG}-${KEY}`, "forge-run-branch");

const started = (name) => {
  const { work } = pushed(name);
  writeFileSync(join(work, ".gitignore"), "node_modules\n");
  git(work, "add", ".gitignore");
  git(work, "commit", "-m", "what a linked worktree borrows");
  git(work, "push", "origin", "HEAD:master");
  const run = runIn(work, ["start", KEY, "ends"], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  return { work, tree: join(dirname(work), `wt-${OWN_SLUG}-${KEY}`) };
};

const committed = (tree, file) => {
  writeFileSync(join(tree, file), "a commit nothing else holds\n");
  git(tree, "add", file);
  git(tree, ...AUTHOR, "commit", "-m", file);
};

const isBranch = (work, name) => git(work, "rev-parse", "--verify", "--quiet", `refs/heads/${name}`).stdout.trim() !== "";

const HEAD_AS_BRANCH = /branch HEAD|branch -d HEAD/u;

test("start records the branch it cut in the worktree's git directory", () => {
  const { work } = started("finish-branch-record");
  assert.equal(readFileSync(recordOf(work), "utf8").trim(), BRANCH);
});

test("a tree detached at a carried commit has the branch start cut removed, and HEAD is never named a branch", () => {
  const { work, tree } = started("finish-branch-detached");
  git(tree, "checkout", "--detach", "HEAD");
  const sha = git(tree, "rev-parse", "--short", "HEAD").stdout.trim();

  const run = runIn(work, ["finish", KEY], BARE);
  const said = run.stdout + run.stderr;
  assert.equal(run.status, 0, said);
  assert.ok(!existsSync(tree), said);
  assert.ok(!isBranch(work, BRANCH), `${BRANCH} was left standing:\n${said}`);
  assert.match(run.stdout, new RegExp(`removed {2}branch ${BRANCH}`, "u"), said);
  assert.match(run.stdout, new RegExp(`stands on a detached HEAD at ${sha}, not on the branch start cut, ${BRANCH}`, "u"), said);
  assert.doesNotMatch(said, HEAD_AS_BRANCH, said);
});

test("a tree switched to a second branch has the branch start cut removed and the second one left, named", () => {
  const { work, tree } = started("finish-branch-switched");
  git(tree, "switch", "-c", "second");

  const run = runIn(work, ["finish", KEY], BARE);
  const said = run.stdout + run.stderr;
  assert.equal(run.status, 0, said);
  assert.ok(!isBranch(work, BRANCH), `${BRANCH} was left standing:\n${said}`);
  assert.ok(isBranch(work, "second"), `the branch the tree was switched to was removed:\n${said}`);
  assert.match(run.stdout, /stands on branch second, not on the branch start cut, iss-88-ends, and second is left as it is/u, said);
  assert.doesNotMatch(said, /removed {2}branch second/u, said);
});

test("a tree detached at a commit origin's default branch lacks is left standing, its branch with it", () => {
  const { work, tree } = started("finish-branch-detached-ahead");
  git(tree, "checkout", "--detach", "HEAD");
  committed(tree, "detached.md");

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), "a tree whose detached commit is nowhere else was removed");
  assert.ok(isBranch(work, BRANCH), run.stderr);
  assert.match(run.stderr, /the tree's a detached HEAD at \w+ and branch iss-88-ends holds 1 commit\(s\) origin\/master does not carry/u, run.stderr);
  assert.match(run.stderr, /clear it: node .*run\.mjs ship/u, run.stderr);
});

test("a branch start cut holding a commit origin lacks refuses the tree, though HEAD stands detached at a carried one", () => {
  const { work, tree } = started("finish-branch-behind");
  committed(tree, "landed.md");
  git(tree, "checkout", "--detach", "HEAD~1");

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), "a tree whose branch holds a commit nowhere else was removed");
  assert.ok(isBranch(work, BRANCH), run.stderr);
  assert.match(run.stderr, /branch iss-88-ends holds 1 commit\(s\) origin\/master does not carry/u, run.stderr);
  assert.match(run.stderr, new RegExp(`clear it: git -C \\S+ switch ${BRANCH}$`, "mu"), run.stderr);
});

test("a tree switched to a second branch holding a commit origin lacks is left standing, both branches with it", () => {
  const { work, tree } = started("finish-branch-second-ahead");
  git(tree, "switch", "-c", "second");
  committed(tree, "second.md");

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), run.stderr);
  assert.ok(isBranch(work, BRANCH) && isBranch(work, "second"), run.stderr);
  assert.match(run.stderr, /branch second and branch iss-88-ends holds 1 commit\(s\)/u, run.stderr);
});

test("a tree whose git directory holds no record of its branch has no branch removed, and the route lists the key's", () => {
  const { work, tree } = started("finish-branch-unrecorded");
  rmSync(recordOf(work));

  const run = runIn(work, ["finish", KEY], BARE);
  const said = run.stdout + run.stderr;
  assert.equal(run.status, 0, said);
  assert.ok(!existsSync(tree), said);
  assert.ok(isBranch(work, BRANCH), `a branch no record named was removed:\n${said}`);
  assert.match(run.stdout, /left {5}no branch: .*git -C \S+ branch --list iss-88 'iss-88-\*'$/mu, said);
  assert.doesNotMatch(said, /branch -d/u, said);
});
