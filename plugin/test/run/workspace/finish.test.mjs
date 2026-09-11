/* `finish`'s half of `tools/run.mjs`: the one call that ends the workspace `start` made, what it
   refuses to remove and what it says it left. `start`'s own half is `start.test.mjs`'s. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BARE, git, OWN_SLUG, pushed, runIn } from "../run-fixtures.mjs";
import { tempRoom } from "../../fixtures.mjs";

const KEY = "ISS-88";
const HAS_PROC = existsSync(join("/proc", "self", "stat"));

const treeOf = (work) => join(dirname(work), `wt-${OWN_SLUG}-${KEY}`);

const idFile = (work) => join(work, ".git", "worktrees", `wt-${OWN_SLUG}-${KEY}`, "forge-run-id");

const scratchFile = (work) => join(dirname(idFile(work)), "forge-run-scratch");

const scratchOf = (work) => readFileSync(scratchFile(work), "utf8").trim();

const ledger = (work) => join(work, ".git", "gate-ledger");

/** A verdict record for that tree, written the way a gate writes one: one JSON line, appended. */
const verdictFor = async (work, tree) => {
  const { verdictPath } = await import("../../../../tools/gate-verdict.mjs");
  const at = verdictPath(tree);
  mkdirSync(dirname(at), { recursive: true });
  writeFileSync(at, `${JSON.stringify({ tree, pid: 1, verdict: "pass", code: 0 })}\n`);
  writeFileSync(join(ledger(work), "test"), "a step's own pass, which every worktree shares\n");
  return at;
};

/** A home with an install record naming a copy whose entry answers or refuses, so the stack line is
 *  about a copy this case owns rather than whatever the developer has installed. */
const homeWith = (name, exit) => {
  const home = tempRoom(`${name}-home-`);
  const copy = join(home, "copy");
  mkdirSync(join(copy, "src"), { recursive: true });
  writeFileSync(join(copy, "src", "cli.mjs"), `process.exit(${exit});\n`);
  mkdirSync(join(copy, ".claude-plugin"), { recursive: true });
  writeFileSync(join(copy, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "scratch", version: "9.9.9" }));
  const record = join(home, ".claude", "plugins", "installed_plugins.json");
  mkdirSync(dirname(record), { recursive: true });
  writeFileSync(record, JSON.stringify({ version: 2, plugins: { "scratch@market": [
    { scope: "user", installPath: copy, version: "9.9.9", lastUpdated: new Date().toISOString() },
  ] } }));
  return { ...BARE, HOME: home };
};

/* The ignore first, because `start` links the checkout's `node_modules` into the tree it makes: a
   project that did not ignore it would have every worktree read as holding uncommitted work, which
   is what this repository's own `.gitignore` settles and a scratch checkout has to say too. */
const started = (name, slug = "ends") => {
  const { at, work } = pushed(name);
  writeFileSync(join(work, ".gitignore"), "node_modules\n");
  git(work, "add", ".gitignore");
  git(work, "commit", "-m", "what a linked worktree borrows");
  git(work, "push", "origin", "HEAD:master");
  const run = runIn(work, ["start", KEY, slug], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  return { at, work, tree: treeOf(work), branch: `iss-88-${slug}`, run };
};

test("finish removes the scratch directory, the worktree, its branch and that tree's verdict record", async () => {
  const { work, tree, branch } = started("finish-whole");
  const scratch = scratchOf(work);
  writeFileSync(join(scratch, "gate.log"), "what this run logged\n");
  const neighbour = `${scratch}-neighbour`;
  mkdirSync(neighbour, { recursive: true });
  const verdict = await verdictFor(work, tree);

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.ok(!existsSync(scratch), `the scratch directory is still there:\n${run.stdout}`);
  assert.ok(!existsSync(tree), `the worktree is still there:\n${run.stdout}`);
  assert.ok(!existsSync(verdict), `the verdict record of a removed tree is still there:\n${run.stdout}`);
  assert.equal(git(work, "rev-parse", "--verify", "--quiet", branch).stdout.trim(), "",
    `${branch} is still a branch of this checkout:\n${run.stdout}${run.stderr}`);
  assert.ok(existsSync(neighbour), "a scratch directory sharing the prefix was removed with it");
  assert.ok(existsSync(join(ledger(work), "test")),
    "a per-step entry every worktree shares was removed with that tree's own");
  assert.match(run.stdout, /removed {2}.*wt-.*ISS-88/u, run.stdout);
});

test("finish never forces a branch delete: one git refuses is left, named, and said to have lost nothing", () => {
  const { work, tree, branch } = started("finish-unmerged");
  writeFileSync(join(tree, "landed.md"), "what this run landed\n");
  git(tree, "add", "landed.md");
  git(tree, "-c", "user.email=t@example.test", "-c", "user.name=Test", "commit", "-m", "the change");
  /* Pushed to the default branch, so the remote carries every commit and the preflight passes, while
     this checkout's own master stays behind it — which is what `git branch -d` refuses on. */
  git(tree, "push", "origin", "HEAD:master");
  git(tree, "fetch", "origin", "master");

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.ok(!existsSync(tree), `the worktree was kept for a branch that loses nothing:\n${run.stdout}`);
  assert.notEqual(git(work, "rev-parse", "--verify", "--quiet", branch).stdout.trim(), "",
    "a branch git refused to delete was deleted anyway");
  assert.match(run.stderr, new RegExp(`left {5}branch ${branch}`, "u"), run.stderr);
  assert.match(run.stderr, /nothing of it is lost/u, run.stderr);
  assert.doesNotMatch(run.stderr + run.stdout, /branch -D/u, "a forced delete is named as a way out");
});

test("finish leaves a worktree holding an uncommitted path, names it, keeps the scratch and exits non-zero", () => {
  const { work, tree } = started("finish-dirty");
  const scratch = scratchOf(work);
  writeFileSync(join(tree, "half-written.md"), "work no record cites\n");

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), "a tree with uncommitted work in it was removed");
  assert.ok(existsSync(scratch), `the scratch of a run still holding work was removed:\n${run.stdout}`);
  assert.match(run.stderr, /half-written\.md/u, run.stderr);
  assert.match(run.stderr, /clear it: git -C .*status --short/u, run.stderr);
});

test("finish leaves a worktree whose branch holds a commit the remote's default branch does not carry", () => {
  const { work, tree } = started("finish-ahead");
  writeFileSync(join(tree, "landed.md"), "a commit nothing else holds\n");
  git(tree, "add", "landed.md");
  git(tree, "-c", "user.email=t@example.test", "-c", "user.name=Test", "commit", "-m", "the change");

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), "a tree whose commits are nowhere else was removed");
  assert.match(run.stderr, /holds 1 commit\(s\) origin\/master does not carry/u, run.stderr);
  assert.match(run.stderr, /clear it: node .*run\.mjs ship/u, run.stderr);
});

/* Abbreviated, `origin/master` resolves a local branch of that name ahead of the remote-tracking
   ref, so a branch somebody made there would read as nothing ahead over commits the remote has never
   seen — a false green on the one reading that decides whether a commit may die here. */
test("finish reads the remote-tracking ref itself, so a local branch named for it cannot read as nothing ahead", () => {
  const { work, tree } = started("finish-shadowed");
  const scratch = scratchOf(work);
  writeFileSync(join(tree, "landed.md"), "a commit nothing else holds\n");
  git(tree, "add", "landed.md");
  git(tree, "-c", "user.email=t@example.test", "-c", "user.name=Test", "commit", "-m", "the change");
  git(work, "branch", "origin/master", git(tree, "rev-parse", "HEAD").stdout.trim());

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), "a tree whose commit is nowhere else was removed over a shadowing branch");
  assert.ok(existsSync(scratch), "the scratch went with it");
  assert.match(run.stderr, /holds 1 commit\(s\) origin\/master does not carry/u, run.stderr);
});

/* The branch's *name* comes from the remote's symbolic ref, which the same shadowing branch makes
   ambiguous: read short it answers `remotes/origin/master`, and the first `origin/` stripped off
   leaves `remotes/master`. This verb's own ref was already spelled out, so what that cost was a
   correct refusal naming a ref that resolves nowhere and a fetch command nobody could run (ISS-1127). */
test("finish names the branch the remote names, where a local branch of that name makes the short spelling longer", () => {
  const { work, tree } = started("finish-shadowed-name");
  git(work, "remote", "set-head", "origin", "master");
  writeFileSync(join(tree, "landed.md"), "a commit nothing else holds\n");
  git(tree, "add", "landed.md");
  git(tree, "-c", "user.email=t@example.test", "-c", "user.name=Test", "commit", "-m", "the change");
  git(work, "branch", "origin/master", git(tree, "rev-parse", "HEAD").stdout.trim());

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), "a tree whose commit is nowhere else was removed");
  assert.match(run.stderr, /holds 1 commit\(s\) origin\/master does not carry/u, run.stderr);
  assert.doesNotMatch(run.stderr, /remotes\/master/u,
    `the refusal names a branch nothing resolves:\n${run.stderr}`);
});

/* The minted basename and a relative parent, so the absolute guard is the only thing that rejects
   it: named `forge-run-<id>` alone the record would be refused by the basename check instead, and
   the case would pass with the guard taken out. */
test("finish derives no scratch path from a record that is not an absolute one", () => {
  const { work, tree } = started("finish-relative");
  const id = readFileSync(idFile(work), "utf8").trim();
  const planted = join(dirname(work), `forge-run-${id}`);
  mkdirSync(planted, { recursive: true });
  writeFileSync(scratchFile(work), `${join("..", `forge-run-${id}`)}\n`);

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.ok(existsSync(planted), "a path a relative record spelled was removed");
  assert.ok(!existsSync(tree), run.stdout);
  assert.match(run.stdout, /no run id this repository minted/u, run.stdout);
});

test("finish refuses where origin's default branch does not resolve, rather than reading it as nothing ahead", () => {
  const { work, tree } = started("finish-unfetched");
  git(work, "update-ref", "-d", "refs/remotes/origin/master");

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), "a tree nothing could prove was landed was removed");
  assert.match(run.stderr, /origin\/master resolves to nothing in that tree/u, run.stderr);
  assert.match(run.stderr, /clear it: git -C .* fetch origin master/u, run.stderr);
});

test("finish leaves the tree a gate of its own is still judging, and stops no process", { skip: !HAS_PROC }, async () => {
  const { work, tree } = started("finish-gating");
  mkdirSync(join(tree, "tools"), { recursive: true });
  writeFileSync(join(tree, "tools", "gates.mjs"), "setTimeout(() => {}, 600_000);\n");
  git(tree, "add", join("tools", "gates.mjs"));
  git(tree, "-c", "user.email=t@example.test", "-c", "user.name=Test", "commit", "-m", "a gate of this tree");
  git(tree, "push", "origin", "HEAD:master");
  git(tree, "fetch", "origin", "master");
  const gate = spawn(process.execPath, [join("tools", "gates.mjs")], { cwd: tree, stdio: "ignore" });
  await new Promise((ready) => setTimeout(ready, 300));

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), "a tree with a gate of its own still running was removed");
  assert.match(run.stderr, new RegExp(`pid ${gate.pid}`, "u"), run.stderr);
  assert.match(run.stderr, /clear it: node .*gates\.mjs --wait/u, run.stderr);
  assert.equal(gate.exitCode, null, "the gate this call reported was stopped by it");
  gate.kill();
});

test("finish called from inside the tree takes that run's scratch, leaves the tree and names the call from the checkout", () => {
  const { work, tree } = started("finish-inside");
  const scratch = scratchOf(work);

  const run = runIn(tree, ["finish", KEY], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.ok(!existsSync(scratch), `the scratch of the run making this call was kept:\n${run.stdout}`);
  assert.ok(existsSync(tree), "the directory this call was standing in was removed under it");
  assert.match(run.stdout, /which this call is standing in/u, run.stdout);
  assert.match(run.stdout, new RegExp(`node ${work}/tools/run\\.mjs finish ${KEY}`, "u"), run.stdout);
});

test("a finish after a successful one removes nothing and exits 0", () => {
  const { work, tree } = started("finish-twice");
  assert.equal(runIn(work, ["finish", KEY], BARE).status, 0);
  assert.ok(!existsSync(tree));

  const again = runIn(work, ["finish", KEY], BARE);
  assert.equal(again.status, 0, again.stderr + again.stdout);
  assert.match(again.stdout, /nothing is there, so this workspace is already ended/u, again.stdout);
  assert.match(again.stdout, /names neither a scratch directory nor a verdict record/u, again.stdout);
});

/* The prefix is not the ownership: what makes a path removable is that this repository minted the id
   in it, so an id somebody wrote by hand names nothing at all rather than naming what it spells. */
test("finish derives no scratch path from a run id this repository did not mint", () => {
  const { work, tree } = started("finish-forged");
  const planted = join(process.env.TMPDIR, "forge-run-not-minted");
  mkdirSync(planted, { recursive: true });
  writeFileSync(idFile(work), "../../not-minted\n");
  writeFileSync(scratchFile(work), `${planted}\n`);

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.ok(existsSync(planted), "a path a hand-written id spelled was removed");
  assert.ok(!existsSync(tree), "the worktree was kept over an unreadable id");
  assert.match(run.stdout, /no run id this repository minted/u, run.stdout);
});

/* `start` prints the directory it made as the run's own `TMPDIR`, so a run that does exactly what it
   was told is the run whose scratch a second derivation would miss — and it would miss it quietly,
   naming a path inside the scratch, calling that gone, and removing the tree over the top. */
test("finish removes the scratch start made even when the run exported it as its own temporary root", () => {
  const { work, tree } = started("finish-exported");
  const scratch = scratchOf(work);
  writeFileSync(join(scratch, "gate.log"), "what this run logged under the root it was handed\n");

  const run = runIn(work, ["finish", KEY], { ...BARE, TMPDIR: scratch });
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.ok(!existsSync(scratch), `the scratch start made outlived the run:\n${run.stdout}`);
  assert.ok(!existsSync(tree), run.stdout);
  assert.match(run.stdout, new RegExp(`removed {2}${scratch}, holding 1 entry`, "u"), run.stdout);
});

/* A lock is somebody saying not to remove this tree. Read in the preflight and not met at the
   removal, which would refuse after the scratch had already gone. */
test("finish leaves a worktree somebody has locked, names the lock and takes nothing of it", () => {
  const { work, tree } = started("finish-locked");
  const scratch = scratchOf(work);
  git(work, "worktree", "lock", tree, "--reason", "a reading is still open on it");

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(tree), "a locked worktree was removed");
  assert.ok(existsSync(scratch), `the scratch of a locked workspace was removed:\n${run.stdout}`);
  assert.match(run.stderr, /that worktree is locked/u, run.stderr);
  assert.match(run.stderr, new RegExp(`clear it: git -C ${work} worktree unlock ${tree}`, "u"), run.stderr);
});

test("finish refuses a directory at the derived path that is another repository's, and says whose", () => {
  const { at, work } = pushed("finish-theirs");
  const theirs = treeOf(work);
  mkdirSync(theirs, { recursive: true });
  git(theirs, "init", "-q", "-b", "master");
  git(theirs, "-c", "user.email=t@example.test", "-c", "user.name=Test", "commit", "-q", "--allow-empty", "-m", "theirs");

  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(existsSync(join(theirs, ".git")), "another repository's checkout was removed");
  assert.match(run.stderr, /is a checkout of its own and not a worktree of/u, run.stderr);
  assert.match(run.stderr, new RegExp(`git -C ${theirs} worktree list`, "u"), run.stderr);
  assert.ok(at, "the room the case ran in");
});

test("finish names the worktrees left on this checkout and whether the copy a session loads answered", () => {
  const { work } = started("finish-stack");
  const run = runIn(work, ["finish", KEY], homeWith("finish-stack", 0));
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.match(run.stdout, /trees {4}1 left on this checkout:/u, run.stdout);
  assert.match(run.stdout, new RegExp(`${work}.*\\[master\\]`, "u"), run.stdout);
  assert.match(run.stdout, /stack {4}the copy a session outside this checkout loads answered: 9\.9\.9/u, run.stdout);
});

/* A quiet stack is reported and refuses nothing: a cleanup that failed because something else is
   down has stopped the wrong thing, and the workspace it was asked to end is still ended. */
test("a copy that does not answer is said and leaves the exit code at 0", () => {
  const { work, tree } = started("finish-quiet");
  const run = runIn(work, ["finish", KEY], homeWith("finish-quiet", 1));
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.ok(!existsSync(tree), "the workspace was kept over a stack that did not answer");
  assert.match(run.stderr, /the copy a session outside this checkout loads did not answer: 9\.9\.9/u, run.stderr);
});

test("the top-level usage lists finish, and start names the call that ends what it made", () => {
  const { work, run } = started("finish-usage");
  const help = runIn(work, ["-h"], BARE);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /<start\|relink\|finish\|ship\|land\|land-ready\|review>/u, help.stdout);
  assert.match(help.stdout, /finish <ISS-nn> {9}end the workspace `start` made for that key/u, help.stdout);
  assert.match(run.stdout, new RegExp(`finish ${KEY}`, "u"),
    `start does not name the call that ends the workspace it just made:\n${run.stdout}`);
  const two = runIn(work, ["finish", KEY, "ISS-89"], BARE);
  assert.equal(two.status, 1, two.stdout);
  assert.match(two.stderr, /finish takes 1 bare word\(s\) and was given 2/u, two.stderr);
});

test("start makes the one directory this run's scratch belongs in, and names it as what a run exports", () => {
  const { work } = started("start-scratch");
  const scratch = scratchOf(work);
  assert.ok(existsSync(scratch), `${scratch} was not made`);
  assert.equal(readdirSync(scratch).length, 0, "the directory a run is handed is not empty");
  const run = runIn(work, ["start", "ISS-89"], BARE);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.match(run.stdout, /TMPDIR=.*forge-run-iss-89-[0-9a-f]{8} {2}XDG_CONFIG_HOME=/u, run.stdout);
});
