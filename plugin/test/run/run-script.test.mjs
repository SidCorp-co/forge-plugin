/* The repository's own steps around a change lived in a prompt one session wrote, so sixteen runs
   obeyed a copy nobody could see go stale (ISS-79). Every rule below is a line that prompt carried,
   exercised on a scratch checkout rather than on this one. The `review` verb and the reading it
   counts towards are that script's other responsibility, and `run-review.test.mjs` holds them. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BARE, committed, GATE, git, lastStep, landIn, pushed, ROOT, runIn, scratch } from "./run-fixtures.mjs";

/* Step 7 is reached only from a tree that is not the checkout, so every fixture shipping from the
   scratch root early-returns past it (ISS-143). `pull.rebase` is set in the scratch repository
   rather than left to the developer's: off it, this case turns on a setting the test does not hold. */
test("step 7 follows to the pushed head over a dirty checkout, and stops where a fast-forward cannot", () => {
  const { at, work } = pushed("follows");
  git(work, "config", "pull.rebase", "true");
  landIn(work, join("docs", "another-run.md"), 1, "a fold another run keeps open");
  git(work, "push", "origin", "HEAD:master");
  const tree = join(at, "wt-ISS-143");
  git(work, "worktree", "add", tree, "-b", "iss-143");
  landIn(tree, join("plugin", "src", "one.mjs"), 4, "the change this release ships");
  const theirs = join(work, "docs", "another-run.md");
  writeFileSync(theirs, "the fold, as that run has it now\n");

  const run = runIn(tree, ["ship"], BARE);
  assert.match(run.stdout, /step 7\/10  the checkout follows/u, run.stdout);
  assert.match(run.stderr, /stopped at step 8 \(marketplace scratch-local\)/u,
    `step 7 stopped on a checkout it had only to fast-forward:\n${run.stdout}${run.stderr}`);
  assert.equal(git(work, "rev-parse", "HEAD").stdout.trim(), git(tree, "rev-parse", "HEAD").stdout.trim(),
    "the marketplace installs from the checkout's working tree, so it has to reach the pushed head");
  assert.equal(readFileSync(theirs, "utf8"), "the fold, as that run has it now\n",
    "a dirty path the release does not move is another run's work, and losing it is worse than the stop");

  /* A checkout holding a commit of its own is the case that genuinely cannot fast-forward, and the
     stop has to name a route: the two a run reaches for unaided are both worse than the failure. */
  landIn(work, join("docs", "local.md"), 1, "a commit the checkout has and the remote does not");
  landIn(tree, join("plugin", "src", "two.mjs"), 4, "another change");
  const stopped = runIn(tree, ["ship"], BARE);
  assert.match(stopped.stderr, /stopped at step 7 \(the checkout follows\)/u, stopped.stderr);
  assert.match(stopped.stderr, /status --short/u, `no read for the path in the way:\n${stopped.stderr}`);
  assert.match(stopped.stderr, /log --oneline origin\/master\.\.HEAD/u,
    `no read for the commits that are not upstream:\n${stopped.stderr}`);
  assert.match(stopped.stderr, /git stash/u, "the route a run must not take is named, being the one it reaches for");
});


/* The threshold and the mark are typed here rather than imported: nothing imports an entry point,
   and a second party that has to agree with the constants is what pins them to the help at all. */
test("-h names all three steps, the resume flag and the threshold it counts against", () => {
  const run = runIn(ROOT, ["-h"]);
  assert.equal(run.status, 0, run.stderr);
  for (const said of ["start <ISS-nn>", "ship [--from N]", "review [--done [ref]]", "--from N",
    "worktree", "restart", "refs/forge/reviewed", "500 changed line(s)", "npm run check",
    "The release count is printed beside it and decides nothing",
    "the sha the change landed as", "not the pushed head the push printed",
    "--done <the range's end>"]) {
    assert.ok(run.stdout.includes(said), `${said} is not in the usage:\n${run.stdout}`);
  }
  assert.ok(!run.stdout.includes("3 release(s)"), `a release count is no part of the trigger:\n${run.stdout}`);
});

test("start adds the worktree, links what the checkout installed, and names the wrapper to probe with", () => {
  const { work } = scratch("start");
  git(work, "init", "-b", "master");
  committed(work, "one");
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

/* A rebase drops a bump identical to one already upstream without a conflict, and the tree then
   names a version carrying none of the change with nothing red to say so. */
test("ship takes a version above the remote head, pushes, and stops at the first step it cannot take", () => {
  const { at, work } = scratch("ship");
  git(at, "init", "--bare", "origin.git");
  git(work, "init", "-b", "master");
  committed(work, "one");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "origin", "HEAD:master");
  writeFileSync(join(work, "one.txt"), "the change\n");
  git(work, "add", "one.txt");
  git(work, "commit", "-m", "the change");

  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, "the last two steps need `claude`, which this PATH does not carry");
  assert.equal(JSON.parse(readFileSync(join(work, "package.json"), "utf8")).version, "1.0.1",
    `1.0.0 was already upstream, so the release owed 1.0.1:\n${run.stdout}`);
  assert.equal(git(at, "-C", join(at, "origin.git"), "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "HEAD").stdout.trim(), "the push did not land the bump it made");
  assert.ok(run.stdout.includes("scratch gate ran"), `the gate step did not spend the tree's own gate:\n${run.stdout}`);
  assert.match(run.stderr, /stopped at step 8 \(marketplace scratch-local\)/u, run.stderr);
  assert.match(run.stderr, /Resume from there: node \S+ ship --from 8/u, run.stderr);
  assert.ok(!run.stdout.includes("Released."), "nothing may claim a release it did not finish");
});

/* A release ships what a gate has passed, never what a session remembers running (ISS-117). */
test("a red gate stops the ship before it bumps, pushes or installs anything", () => {
  const { at, work } = scratch("gated", "node -e \"process.exit(1)\"");
  git(at, "init", "--bare", "origin.git");
  git(work, "init", "-b", "master");
  committed(work, "one");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "origin", "HEAD:master");
  landIn(work, "one.txt", 1, "the change");

  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 4 \(the gate\)/u, run.stderr);
  assert.equal(JSON.parse(readFileSync(join(work, "package.json"), "utf8")).version, "1.0.0",
    "the version was raised past a gate that had not passed");
  assert.equal(git(join(at, "origin.git"), "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "HEAD~1").stdout.trim(), "the change was pushed past a red gate");

  /* The run that most needs a gate is the one that edited something to get past a failed step, so
     a resume aimed past the gate spends it first rather than pushing on the last run's word. */
  const resumed = runIn(work, ["ship", "--from", "6"], BARE);
  assert.match(resumed.stderr, /stopped at step 4 \(the gate\)/u, resumed.stderr);
  assert.equal(git(join(at, "origin.git"), "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "HEAD~1").stdout.trim(), "a resume past the gate pushed an ungated tree");
});

/* Every resume runs in a process that watched none of the steps before it, so a step reading what
   an earlier one held in memory is a step that cannot be resumed. Both were review findings. */
test("a resumed ship commits a bump left on disk, and never says nothing moved when it cannot tell", () => {
  const { at, work } = scratch("resume");
  git(at, "init", "--bare", "origin.git");
  git(work, "init", "-b", "master");
  committed(work, "one");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "origin", "HEAD:master");
  writeFileSync(join(work, "one.txt"), "the change\n");
  git(work, "add", "one.txt");
  git(work, "commit", "-m", "the change");
  runIn(work, ["ship"], BARE);

  const headVersion = () => JSON.parse(git(work, "show", "HEAD:package.json").stdout).version;
  writeFileSync(join(work, "package.json"),
    JSON.stringify({ name: "scratch", version: "1.0.2", scripts: { check: GATE } }, null, 2));
  runIn(work, ["ship", "--from", "5"], BARE);
  assert.equal(headVersion(), "1.0.2", "a version raised on disk and left uncommitted is committed by the resume");

  const told = runIn(work, ["ship", "--from", "10"], BARE);
  assert.match(told.stdout, /moved since [0-9a-f]{7}/u, told.stdout + told.stderr);
  rmSync(join(work, ".git", "forge-ship-from"));
  const blind = runIn(work, ["ship", "--from", "10"], BARE);
  assert.match(blind.stderr, /no forge-ship-from in this tree's git directory/u, blind.stderr);
  assert.doesNotMatch(blind.stdout, /moved since/u, "a run that cannot compare may not tell a session it is safe");
  assert.match(blind.stderr, /the sha this change landed as cannot be named/u,
    `the second reader of that head has to say what it cannot name too:\n${blind.stderr}`);
  assert.match(blind.stderr, /log --oneline --first-parent/u,
    `a run told the sha is unknown and given no read for it is a run that guesses:\n${blind.stderr}`);
  assert.doesNotMatch(blind.stdout, /the change landed as/u, "a sha nothing could be read from may not be named");
});

/* The rebase rewrites the commit the run reviewed and the bump lands above it, so a mark taking
   either end of what step 6 prints names a commit on no branch, or the release and not the change. */
test("the last step names the sha the change landed as, and it is neither the reviewed head nor the pushed one", () => {
  const { work } = pushed("landed");
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change this release ships (ISS-169)");
  const change = git(work, "rev-parse", "HEAD").stdout.trim();

  const run = lastStep(work);
  const head = git(work, "rev-parse", "origin/master").stdout.trim();
  assert.notEqual(head, change, "this fixture makes no version commit, so it proves nothing about telling them apart");
  assert.match(run.stdout, new RegExp(`the change landed as ${change.slice(0, 7)}, `
    + `and the push moved origin/master to ${head.slice(0, 7)}`, "u"),
    `the sha the change landed as is not named beside the head that was pushed:\n${run.stdout}`);

  /* A second release over an unchanged tree carries the bump and nothing else, and naming its sha
     would hand the mark the release rather than the change. */
  const again = lastStep(work);
  assert.match(again.stdout, /is the pushed head, and this release landed nothing but the version commit/u,
    `a release of nothing but its own bump named a sha as the change's:\n${again.stdout}`);
});

/* A mark takes one sha, so a change of several says which end; the range is the exclusive form,
   which is what shows exactly those commits and not the bump above them. */
test("a change of more than one commit prints the range and the end a mark takes", () => {
  const { work } = pushed("landed-range");
  const was = git(work, "rev-parse", "HEAD").stdout.trim();
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the first commit of the change (ISS-169)");
  const first = git(work, "rev-parse", "HEAD").stdout.trim();
  landIn(work, join("plugin", "src", "two.mjs"), 4, "the second commit of the change (ISS-169)");
  const tip = git(work, "rev-parse", "HEAD").stdout.trim();

  const run = lastStep(work);
  assert.match(run.stdout, new RegExp(`the change landed as 2 commits, ${was.slice(0, 7)}\\.\\.${tip.slice(0, 7)}; `
    + `a mark takes one sha, so take the last, ${tip.slice(0, 7)}`, "u"),
    `the range and the end a mark takes are not both named:\n${run.stdout}`);
  assert.deepEqual(
    git(work, "log", "--first-parent", "--format=%H", `${was}..${tip}`).stdout.trim().split("\n"),
    [tip, first],
    "the printed range has to show exactly the change's commits when it is pasted into git log");
});
