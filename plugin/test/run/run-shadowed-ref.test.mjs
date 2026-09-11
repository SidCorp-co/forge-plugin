/* What a local branch literally named `origin/master` does to a landing. Git resolves the
   abbreviated name against `refs/heads/` before `refs/remotes/`, so such a branch wins every
   revision a landing reads: a range comes back empty over commits the remote has never seen, which
   is what these reads treat as nothing in the way, and `--abbrev-ref` answers the longer
   `remotes/origin/master`, whose first `origin/` stripped off leaves `remotes/master` (ISS-1127).
   The other readers of `tools/run.mjs` are `run-script.test.mjs` for the steps, `run-install.test.mjs`
   for the install and `workspace/finish.test.mjs` for the verb that ends a workspace. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, GATE, git, landIn, pushed, runIn, worktreeRoom } from "./run-fixtures.mjs";
import { defaultBranch } from "../../../tools/checkout.mjs";
import { inTheWay } from "../../../tools/run/install.mjs";
import { mergeBaseDiff } from "../../../tools/gates/scope.mjs";

const SHADOW = "origin/master";
const HAND = "hand-made.md";
const BY_HAND = "a commit only the branch somebody made by hand carries";
const KEY = "ISS-1127";

const headOf = (tree) => git(tree, "rev-parse", "HEAD").stdout.trim();

const manifest = (at, version) => writeFileSync(join(at, "package.json"),
  JSON.stringify({ name: "scratch", version, type: "module", scripts: { check: GATE } }, null, 2));

/** The remote names its default branch, so `defaultBranch` reads the symbolic ref rather than
 *  falling back to the two guessed names, which no shadowing branch reaches. */
const named = (work) => git(work, "remote", "set-head", "origin", "master");

/** A branch of that name at a commit of its own, carrying a manifest version far above the remote's:
 *  which ref a read took is then visible in the version a release raises and in the files it holds. */
const divergent = (work, version = "9.9.9") => {
  git(work, "checkout", "-q", "-b", "by-hand");
  manifest(work, version);
  writeFileSync(join(work, HAND), "what nobody pushed\n");
  git(work, "add", "package.json", HAND);
  git(work, "commit", "-m", BY_HAND);
  const at = headOf(work);
  git(work, "branch", SHADOW, at);
  git(work, "checkout", "-q", "master");
  git(work, "branch", "-qD", "by-hand");
  return at;
};

const markOf = (tree) => {
  const at = join(git(tree, "rev-parse", "--absolute-git-dir").stdout.trim(), "forge-ship-from");
  return existsSync(at) ? readFileSync(at, "utf8").trim() : null;
};

/** A release from a worktree, with the remote one commit behind it and the shadowing branch on a
 *  commit neither of them holds — the four ship reads in one run. */
const shippedUnder = (name, shadow) => {
  const room = worktreeRoom(name, KEY);
  named(room.work);
  const pushedAt = headOf(room.work);
  const byHand = shadow ? divergent(room.work) : null;
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change this release ships");
  const run = runIn(room.tree, ["ship"], room.env);
  return { ...room, byHand, pushedAt, run };
};

const TOOLS = new URL("../../../tools/", import.meta.url).pathname;

/* One home, so a consumer that neither takes the export nor re-spells the prefix has no ref to read:
   the behavioural cases below prove each read takes it, and this is what closes the other way. */
test("the remote-tracking prefix is spelled in one file under tools, the one that exports the ref", () => {
  const spelled = readdirSync(TOOLS, { recursive: true, withFileTypes: true })
    .filter((one) => one.isFile() && one.name.endsWith(".mjs"))
    .map((one) => join(one.parentPath, one.name))
    .filter((at) => readFileSync(at, "utf8").includes("refs/remotes"))
    .map((at) => at.slice(TOOLS.length));

  assert.deepEqual(spelled, ["checkout.mjs"],
    `${spelled.filter((one) => one !== "checkout.mjs").join(", ")} spells the remote-tracking ref `
    + `prefix itself. Take \`remoteRef\` from tools/checkout.mjs instead: one home is what keeps a `
    + `read from drifting back to the abbreviated name a local branch wins.`);
});

test("the ship reads the remote-tracking ref itself, so a local branch named for it takes no step of a release", () => {
  const { at, byHand, pushedAt, run, tree, work } = shippedUnder("ship-shadowed", true);

  assert.match(run.stdout, /step 10\/10/u, `the release stopped short:\n${run.stdout}${run.stderr}`);
  assert.equal(markOf(tree), pushedAt,
    "the mark the release names the landed sha off is not the head the remote-tracking ref held");
  assert.ok(!existsSync(join(tree, HAND)),
    "the rebase replayed this change onto a branch somebody made by hand");
  assert.ok(!git(tree, "log", "--format=%s").stdout.includes(BY_HAND),
    `that branch's commit is in what this release pushed:\n${git(tree, "log", "--oneline").stdout}`);
  assert.match(run.stdout, /origin\/master carries 1\.0\.0; taking 1\.0\.1/u,
    `the version was raised off a manifest the remote does not carry:\n${run.stdout}`);
  assert.equal(headOf(work), headOf(tree),
    `the checkout was fast-forwarded to ${byHand === headOf(work) ? "the hand-made branch" : "neither head"}`);
  assert.ok(at, "the room has a path");
});

test("the ship with no such branch present reads the same four things and answers as it does today", () => {
  const { pushedAt, run, tree, work } = shippedUnder("ship-unshadowed", false);

  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.equal(markOf(tree), pushedAt, "the mark is not the head the remote held before the push");
  assert.match(run.stdout, /origin\/master carries 1\.0\.0; taking 1\.0\.1/u, run.stdout);
  assert.equal(headOf(work), headOf(tree), "the checkout was not offered the pushed head");
});

/* The reading behind the checkout-follows step, over the shape the defect was reported at: the
   shadowing branch is at the very head whose commits the remote has never seen, so the range the
   abbreviated name reads is empty and the step reports nothing in the way. */
test("the commits in the checkout's way are read against the remote-tracking ref, not a branch of that name", () => {
  const { work } = pushed("in-the-way-shadowed");
  named(work);
  landIn(work, join("docs", "local.md"), 1, "a commit the remote has never seen");
  git(work, "branch", SHADOW, headOf(work));

  const read = inTheWay(work, defaultBranch(work));
  assert.equal(read.commits.length, 1, `nothing was named as in the way:\n${read.commits.join("\n")}`);
  assert.match(read.commits[0], /a commit the remote has never seen/u, read.commits[0]);
  assert.match(read.commits[0], /touching docs\/local\.md/u, read.commits[0]);
});

test("the commits in the checkout's way with no such branch present are read as they are today", () => {
  const { work } = pushed("in-the-way-unshadowed");
  named(work);
  landIn(work, join("docs", "local.md"), 1, "a commit the remote has never seen");

  const read = inTheWay(work, defaultBranch(work));
  assert.equal(read.commits.length, 1, read.commits.join("\n"));
  assert.match(read.commits[0], /touching docs\/local\.md/u, read.commits[0]);
});

test("land replays onto the remote-tracking ref, so a branch of that name is no base for a landing", () => {
  const { work } = pushed("land-shadowed");
  named(work);
  const pushedAt = headOf(work);
  divergent(work);
  landIn(work, join("docs", "the-checkout.md"), 1, "what the checkout is landing");

  const run = runIn(work, ["land"], BARE);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.ok(!existsSync(join(work, HAND)), "the landing replayed onto a branch somebody made by hand");
  assert.equal(git(work, "rev-parse", "HEAD^").stdout.trim(), pushedAt,
    `the landed commit's parent is not the head the remote held:\n${git(work, "log", "--oneline").stdout}`);
});

test("the gate's scope reads the branch the remote names, so a branch of that name leaves it no error", () => {
  const { work } = pushed("scope-shadowed");
  named(work);
  const base = headOf(work);
  git(work, "checkout", "-q", "-b", "a-change");
  landIn(work, join("docs", "changed.md"), 1, "what this branch changed");
  git(work, "branch", SHADOW, headOf(work));

  const read = mergeBaseDiff(work);
  assert.equal(read.error, undefined, `the scope read answered with an error: ${read.error}`);
  assert.equal(read.branch, "master", `the branch compared against was ${read.branch}`);
  assert.equal(read.base, base, "the merge base is not the one HEAD shares with the local master branch");
  assert.deepEqual(read.changed, ["docs/changed.md"], read.changed);
});

test("the branch the remote names is read whole, so a local branch of that name is no part of it", () => {
  const { work } = pushed("default-branch-shadowed");
  named(work);
  git(work, "branch", SHADOW, headOf(work));

  assert.equal(defaultBranch(work), "master",
    "the name every landing step is handed is not the branch the remote names");
});

test("the branch the remote names with no such branch present is read as it is today", () => {
  const { work } = pushed("default-branch-unshadowed");
  named(work);

  assert.equal(defaultBranch(work), "master");
});

/* Through `gitOut` an unresolvable ref and an empty answer are one value, so the mark the release
   names its landed sha off was written as the string `null` and the run carried on. A remote with no
   fetch refspec is how a fetch succeeds and leaves the tracking ref where it was. */
test("a remote-tracking ref that resolves to no commit stops the fetch step and writes no mark", () => {
  const room = worktreeRoom("ship-unresolvable", KEY);
  git(room.work, "update-ref", "-d", "refs/remotes/origin/master");
  git(room.work, "config", "--unset", "remote.origin.fetch");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change this release ships");

  const run = runIn(room.tree, ["ship"], room.env);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /refs\/remotes\/origin\/master resolves to no commit/u, run.stderr);
  assert.equal(markOf(room.tree), null, `a mark was written over a ref that named nothing: ${markOf(room.tree)}`);
});
