/* Which tree a release installs from, and what the shared checkout's state decides. The marketplace
   installs from one registered directory, so a release that had to move that checkout to the pushed
   head first was stopped after its own push by whatever any session left unpushed there (ISS-374).
   The other three readers of `tools/run.mjs` are `run-script.test.mjs` for the steps,
   `run-lock.test.mjs` for the span and `run-review.test.mjs` for the count. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { cached, claudeCalls, git, landIn, registeredAt, runIn, shipping, switched, worktreeRoom }
  from "./run-fixtures.mjs";

/* The follow is reached only from a tree that is not the checkout, so every fixture shipping from
   the scratch root early-returns past it (ISS-143). `pull.rebase` is set in the scratch repository
   rather than left to the developer's: off it, this case turns on a setting the test does not hold. */
test("the checkout follows to the pushed head over a dirty path, and the install reads it", () => {
  const room = worktreeRoom("follows", "ISS-143");
  git(room.work, "config", "pull.rebase", "true");
  landIn(room.work, join("docs", "another-run.md"), 1, "a fold another run keeps open");
  git(room.work, "push", "origin", "HEAD:master");
  git(room.tree, "rebase", "origin/master");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change this release ships");
  const theirs = join(room.work, "docs", "another-run.md");
  writeFileSync(theirs, "the fold, as that run has it now\n");

  const run = runIn(room.tree, ["ship"], room.env);
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.equal(git(room.work, "rev-parse", "HEAD").stdout.trim(), git(room.tree, "rev-parse", "HEAD").stdout.trim(),
    "the checkout was not offered the pushed head it could fast-forward to");
  assert.equal(readFileSync(theirs, "utf8"), "the fold, as that run has it now\n",
    "a dirty path the release does not move is another run's work, and losing it is worse than any stop");
  assert.match(run.stdout, /the checkout is the tree that shipped/u,
    `the install read a worktree over a checkout that had followed:\n${run.stdout}`);
  assert.equal(registeredAt(room.at), room.work,
    "the ordinary release moved the registration every session on this machine shares");
  assert.deepEqual(claudeCalls(room.at).filter((one) => one[2] === "add"), [],
    "a release whose checkout is the tree that shipped wrote a marketplace registration anyway");
});

/* A commit the checkout holds and the remote does not is what no fast-forward takes, and no route
   through it belongs to the run that meets it: it is another session's (ISS-374). So the install
   reads this tree instead and the release reaches its last step. */
test("a checkout that cannot follow does not stop the release, and the install reads the tree that shipped", () => {
  const room = worktreeRoom("installs-over-obstruction");
  landIn(room.work, join("docs", "local.md"), 1, "a commit the checkout has and the remote does not");
  const obstructed = git(room.work, "rev-parse", "HEAD").stdout.trim();
  shipping(room.tree, "2.0.0");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change this release ships");

  const run = runIn(room.tree, ["ship"], room.env);
  assert.match(run.stdout, /step 10\/10/u, `the release stopped short:\n${run.stdout}${run.stderr}`);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /cannot fast-forward to the pushed head and stays at/u,
    `the step named no head the checkout is left at:\n${run.stderr}`);
  assert.match(run.stderr, /a commit the checkout has and the remote does not/u,
    `the commit in the way is not named:\n${run.stderr}`);
  assert.match(run.stderr, /touching docs\/local\.md/u, `what the commit touches is not named:\n${run.stderr}`);
  assert.match(run.stderr, /Test, /u, `whose the commit is not named:\n${run.stderr}`);
  assert.match(run.stderr, /Leave every bit of that alone/u,
    `the step said what not to touch and not what the run does:\n${run.stderr}`);
  assert.equal(git(room.work, "rev-parse", "HEAD").stdout.trim(), obstructed,
    "the release moved the checkout off the commit another session left there");
  assert.equal(cached(room.at, "scratch-local", "scratch", "2.0.0", join("src", "one.mjs")),
    "the change\n".repeat(4), "the cache does not hold the shipping worktree's content at its own version");
  assert.equal(registeredAt(room.at), room.work, "the registration was left naming the worktree");
  assert.match(run.stdout, /the registration names .* again/u, run.stdout);
  /* The last step's own reading: 2.0.0 is this tree's manifest and 1.0.0 is the unfollowed
     checkout's, so a release that named the checkout's version would name the wrong one. */
  assert.match(run.stdout, /scratch 2\.0\.0 running/u,
    `the last step read the version off the shared checkout:\n${run.stdout}`);
});

/* Not a commit but an uncommitted path, which fast-forwards clean until the release moves that same
   path: the same report is owed and there is no commit in it to name. */
test("a fast-forward blocked by an uncommitted path alone names the path and the head", () => {
  const room = worktreeRoom("dirty-path-only");
  landIn(room.work, join("docs", "shared.md"), 1, "a document both trees hold");
  git(room.work, "push", "origin", "HEAD:master");
  git(room.tree, "rebase", "origin/master");
  landIn(room.tree, join("docs", "shared.md"), 3, "a document this release rewrites");
  writeFileSync(join(room.work, "docs", "shared.md"), "as that run has it now\n");

  const run = runIn(room.tree, ["ship"], room.env);
  assert.match(run.stdout, /step 10\/10/u, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /uncommitted: docs\/shared\.md/u,
    `the uncommitted path in the way is not named:\n${run.stderr}`);
  assert.match(run.stderr, /stays at/u, `the head the checkout is left at is not named:\n${run.stderr}`);
  assert.equal(readFileSync(join(room.work, "docs", "shared.md"), "utf8"), "as that run has it now\n");
});

test("an install that records a version below the tree's is refused with both numbers", () => {
  const room = worktreeRoom("install-took-nothing");
  landIn(room.work, join("docs", "local.md"), 1, "a commit the checkout has and the remote does not");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change");
  switched(room.at, "claude-installs-old", "0.0.1");

  const run = runIn(room.tree, ["ship"], room.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the cache does not hold this release/u, run.stderr);
  assert.match(run.stderr, /scratch 1\.0\.0 is what the tree that shipped carries/u, run.stderr);
  assert.match(run.stderr, /0\.0\.1 is the newest version the install record holds/u, run.stderr);
  assert.equal(registeredAt(room.at), room.work,
    "a refused install left the registration on the worktree it read");
  /* The route out is the step, which the runner names on every stop. By hand is the one route this
     refusal must not offer: it re-points what the step put back and installs under no lock. */
  assert.match(run.stderr, /take this step again rather than installing by hand/u, run.stderr);
  assert.match(run.stderr, /ship --from 9/u, `the resume that redoes the install is not named:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /marketplace add/u,
    `the refusal prescribes an unlocked re-point of the registration:\n${run.stderr}`);
});

test("an install command that fails still leaves the registration on the checkout", () => {
  const room = worktreeRoom("install-refused");
  landIn(room.work, join("docs", "local.md"), 1, "a commit the checkout has and the remote does not");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change");
  switched(room.at, "claude-update-refuses");

  const run = runIn(room.tree, ["ship"], room.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 9/u, run.stderr);
  assert.equal(registeredAt(room.at), room.work,
    "the release failed and left every session on this machine installing from a worktree");
});

test("a registration that cannot be put back is refused with the command that puts it back", () => {
  const room = worktreeRoom("restore-refused");
  landIn(room.work, join("docs", "local.md"), 1, "a commit the checkout has and the remote does not");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change");
  switched(room.at, "claude-refuses-add-of", room.work);

  const run = runIn(room.tree, ["ship"], room.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the registration could not be put back/u, run.stderr);
  assert.match(run.stderr, new RegExp(`claude plugin marketplace add ${room.work}`, "u"),
    `the one command that puts it back is not in the refusal:\n${run.stderr}`);
  assert.equal(registeredAt(room.at), room.tree, "the stub was told to refuse and the registration moved anyway");
});

/* A throw that is no `Stop` — `spawnSync` refuses a NUL in an argument before it forks — carried
   past the restore would leave every session on this machine installing from a worktree. */
test("an install that throws rather than exiting still leaves the registration on the checkout", () => {
  const room = worktreeRoom("install-threw");
  landIn(room.work, join("docs", "local.md"), 1, "a commit the checkout has and the remote does not");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change");
  const market = join(".claude-plugin", "marketplace.json");
  writeFileSync(join(room.tree, market), JSON.stringify({ name: `scratch${String.fromCharCode(0)}local` }));
  git(room.tree, "add", market);
  git(room.tree, "commit", "-m", "a marketplace name no argument list carries");

  const run = runIn(room.tree, ["ship"], room.env);
  assert.notEqual(run.status, 0, run.stdout);
  assert.equal(registeredAt(room.at), room.work,
    `a throw that is no Stop carried past the restore:\n${run.stdout}${run.stderr}`);
});

/* The reversed order the lock cannot reach: a release that pushed and failed its install, resumed
   after a later release has landed and installed. Installing this tree now would put its older copy
   in the cache while the branch carries the newer one (ISS-374). */
test("an install-only resume of a superseded release is refused before the registration moves", () => {
  const room = worktreeRoom("resume-superseded");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change");
  switched(room.at, "claude-update-refuses");
  assert.notEqual(runIn(room.tree, ["ship"], room.env).status, 0, "the install was meant to fail");
  rmSync(join(room.at, "claude-update-refuses"));
  /* A sibling worktree of the same checkout, whose push moves the remote-tracking ref both share. */
  const later = join(room.at, "wt-ISS-999");
  git(room.work, "worktree", "add", later, "-b", "iss-999");
  landIn(later, join("plugin", "src", "two.mjs"), 4, "a release that landed after this one pushed");
  assert.equal(runIn(later, ["ship"], room.env).status, 0, "the later release did not land");

  const run = runIn(room.tree, ["ship", "--from", "9"], room.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /this tree is not what origin\/master holds/u, run.stderr);
  assert.match(run.stderr, /ship --from 2/u, `no route out of a superseded resume:\n${run.stderr}`);
  assert.equal(registeredAt(room.at), room.work, "a refused resume moved the registration anyway");
});

/* The push the lock never reaches: another clone's, landed while this release sat between its own
   push and a failed install. This tree's tracking ref still names itself, so the remote is asked. */
test("an install-only resume is refused where another clone pushed, which no ref here has been told", () => {
  const room = worktreeRoom("resume-behind-a-clone");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change");
  switched(room.at, "claude-update-refuses");
  assert.notEqual(runIn(room.tree, ["ship"], room.env).status, 0, "the install was meant to fail");
  rmSync(join(room.at, "claude-update-refuses"));

  const other = join(room.at, "another-machine");
  git(room.at, "clone", "-q", join(room.at, "origin.git"), other);
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(other, "config", key, value);
  landIn(other, join("plugin", "src", "two.mjs"), 4, "a release from another machine");
  git(other, "push", "-q", "origin", "HEAD:master");
  assert.equal(git(room.tree, "rev-parse", "origin/master").stdout.trim(),
    git(room.tree, "rev-parse", "HEAD").stdout.trim(), "the tracking ref moved, so this case proves nothing");
  const asked = claudeCalls(room.at).length;

  const run = runIn(room.tree, ["ship", "--from", "9"], room.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /this tree is not what origin\/master holds/u, run.stderr);
  assert.equal(claudeCalls(room.at).length, asked, "the resume installed something before refusing");
  assert.equal(registeredAt(room.at), room.work, "a refused resume moved the registration anyway");
});

/* A remote that answers and names no branch answers empty, which is no failure and no comparison
   either: a deleted branch, an unreachable remote and an unreadable HEAD are the one refusal. */
test("an install-only resume is refused where the remote names no such branch at all", () => {
  const room = worktreeRoom("resume-branch-gone");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change");
  switched(room.at, "claude-update-refuses");
  assert.notEqual(runIn(room.tree, ["ship"], room.env).status, 0, "the install was meant to fail");
  rmSync(join(room.at, "claude-update-refuses"));
  git(join(room.at, "origin.git"), "update-ref", "-d", "refs/heads/master");
  const asked = claudeCalls(room.at).length;

  const run = runIn(room.tree, ["ship", "--from", "9"], room.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /could not be compared: origin named nothing for master/u, run.stderr);
  assert.equal(claudeCalls(room.at).length, asked, "the resume installed against a comparison it never made");
});

test("a registration that cannot be moved stops before anything is installed", () => {
  const room = worktreeRoom("point-refused");
  landIn(room.work, join("docs", "local.md"), 1, "a commit the checkout has and the remote does not");
  landIn(room.tree, join("plugin", "src", "one.mjs"), 4, "the change");
  switched(room.at, "claude-refuses-add-of", room.tree);

  const run = runIn(room.tree, ["ship"], room.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /Nothing has moved yet/u, run.stderr);
  assert.equal(registeredAt(room.at), room.work, "a refused move moved it");
  assert.deepEqual(claudeCalls(room.at).filter((one) => one[1] === "update"), [],
    "an install ran under a registration this run could not point");
});

