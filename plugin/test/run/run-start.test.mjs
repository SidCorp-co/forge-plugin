/* `start`'s half of `tools/run.mjs`: the worktree it adds beside the checkout, the holder id it
   mints with it, and what it says about a path that is already taken. The other verbs are
   `run-script.test.mjs`'s and the review's are `run-review.test.mjs`'s, as that file's head says. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BARE, committed, git, runIn, scratch } from "./run-fixtures.mjs";
import { tempRoom } from "../fixtures.mjs";

const checkout = (name) => {
  const room = scratch(name);
  git(room.work, "init", "-b", "master");
  committed(room.work, "one");
  return room;
};

const theirRepo = (where) => {
  mkdirSync(where, { recursive: true });
  git(where, "init", "-b", "master");
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(where, "config", key, value);
  writeFileSync(join(where, "one.md"), "theirs\n");
  git(where, "add", "one.md");
  git(where, "commit", "-m", "theirs");
  return where;
};

test("start adds the worktree, links what the checkout installed, and names the wrapper to probe with", () => {
  const { work } = checkout("start");
  const run = runIn(work, ["start", "ISS-88", "one-line"]);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const tree = join(dirname(work), "wt-ISS-88");
  assert.ok(existsSync(tree), `${tree} was not made:\n${run.stdout}${run.stderr}`);
  assert.ok(existsSync(join(tree, "node_modules")), "the checkout's node_modules is not linked in");
  assert.ok(run.stdout.includes(join(tree, "plugin", "bin", "forge")),
    `the wrapper a probe must invoke is not named:\n${run.stdout}`);
  assert.equal(git(work, "rev-parse", "--abbrev-ref", "HEAD").stdout.trim(), "master", "the checkout stays where it was");

  const again = runIn(work, ["start", "ISS-88", "one-line"]);
  assert.equal(again.status, 1, again.stdout);
  assert.ok(again.stderr.includes(tree), `the refusal does not name the worktree already there:\n${again.stderr}`);
  assert.ok(again.stderr.includes("worktree remove"), again.stderr);
});

/* Every agent a session dispatches inherits that session's id, so a wave of runs writes under one
   lease holder and the lease refuses nothing between two of them (ISS-445). A worktree is what a
   run gets of its own, so the id is minted with it — and kept beside the worktree rather than in
   the account's config, which a wave would race. */
test("start mints a holder id for the worktree, keeps it beside it, and hands it back on the refusal", () => {
  const { work } = checkout("run-id");
  const home = tempRoom("run-id-home-");
  const env = { ...BARE, XDG_CONFIG_HOME: home };
  const run = runIn(work, ["start", "ISS-89"], env);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const id = /FORGE_SESSION_ID=([^\s,]+)/u.exec(run.stdout)?.[1];
  assert.ok(id, `no holder id was printed for the run to carry:\n${run.stdout}`);
  assert.match(id, /^iss-89-/u, "named for the issue it works, so two worktrees are two runs");
  const tree = join(dirname(work), "wt-ISS-89");
  const kept = join(work, ".git", "worktrees", "wt-ISS-89", "forge-run-id");
  assert.equal(readFileSync(kept, "utf8").trim(), id, `the id is not kept at ${kept}`);
  assert.ok(!existsSync(join(home, "forge", "session.json")),
    "and nowhere the account shares, which every run of a wave would race");

  const again = runIn(work, ["start", "ISS-89"], env);
  assert.equal(again.status, 1, again.stdout);
  assert.ok(again.stderr.includes(tree), again.stderr);
  assert.equal(/FORGE_SESSION_ID=([^\s,]+)/u.exec(again.stderr)?.[1], readFileSync(kept, "utf8").trim(),
    `the refusal reads the id back off the record rather than handing back what it just minted:\n${again.stderr}`);
});

/* The path is the issue key beside the checkout, so a project sharing this parent directory and the
   same key scheme owns a path this one derives (ISS-401). The remove offered for a tree of ours is
   refused for one of theirs, and an agent following it would aim at another project's live work. */
test("start on a path another repository's worktree holds names that repository and offers no remove", () => {
  const { at, work } = checkout("foreign-tree");
  const other = theirRepo(join(at, "other"));
  const tree = join(at, "wt-ISS-90");
  git(other, "worktree", "add", tree, "-b", "iss-90");
  /* Seeded, so the case proves the id of a run this checkout does not own is withheld, not absent. */
  writeFileSync(join(other, ".git", "worktrees", "wt-ISS-90", "forge-run-id"), "iss-90-theirs\n");

  const run = runIn(work, ["start", "ISS-90"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(other), `the refusal does not name whose tree it found:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /worktree remove/u,
    `a remove this checkout cannot make is offered for another project's tree:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /iss-90-theirs/u,
    `another project's run id is handed back as this key's lease holder:\n${run.stderr}`);
  assert.ok(existsSync(join(tree, "one.md")), "the other project's tree was touched");
});

/* `<checkout>/.git` is this repository's layout and not a foreign repository's, so the owner is the
   git directory's parent only where that directory is a `.git`: a bare repository backs worktrees
   too, and naming its parent would hand back a directory that is no repository at all. */
test("a worktree of a bare repository is named as that repository, not as the directory holding it", () => {
  const { at, work } = checkout("bare-owner");
  const bare = join(at, "theirs.git");
  git(at, "clone", "--bare", theirRepo(join(at, "other")), bare);
  const tree = join(at, "wt-ISS-92");
  git(bare, "worktree", "add", tree, "-b", "iss-92");

  const run = runIn(work, ["start", "ISS-92"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`a worktree of ${bare}`),
    `the bare repository backing the tree is not what the refusal names:\n${run.stderr}`);
});

test("start on a path that is no worktree at all says git answers no root for it, and offers no remove", () => {
  const { at, work } = checkout("stray-directory");
  const tree = join(at, "wt-ISS-91");
  mkdirSync(tree, { recursive: true });

  const run = runIn(work, ["start", "ISS-91"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`${tree} is already there and git answers no worktree root for it`),
    `a directory git registers as no tree is not reported as one:\n${run.stderr}`);
  assert.ok(run.stderr.includes(`git -C ${tree} status`),
    `the read that says which of the two it is, is not named:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /worktree remove/u,
    `a remove that reaches no registered tree is offered:\n${run.stderr}`);
});
