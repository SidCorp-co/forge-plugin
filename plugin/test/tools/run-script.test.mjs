/* The repository's own steps around a change lived in a prompt one session wrote, so sixteen runs
   obeyed a copy nobody could see go stale (ISS-79). Every rule below is a line that prompt carried,
   exercised on a scratch checkout rather than on this one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;
const SCRIPT = join("tools", "run.mjs");
/* npm and node without whatever else the developer has on PATH: the ship path's last two steps are
   `claude`, and a machine that has it would prove nothing about what a missing step does. */
const BARE = { ...process.env, PATH: `${dirname(realpathSync(process.execPath))}:/usr/bin:/bin` };

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
const runIn = (cwd, argv, env = process.env) =>
  spawnSync(process.execPath, [SCRIPT, ...argv], { cwd, encoding: "utf8", env });

/* The three files the script is: itself, the module it reads the install record through, and the
   git helpers it shares with the gate runner. `check` stands in for the repository's own gate,
   which ship spends by name — the real one needs a tree this scratch checkout is not. */
const GATE = "node -e \"console.log('scratch gate ran')\"";

const scratch = (name, gate = GATE) => {
  const at = tempRoom(`${name}-`);
  const work = join(at, "checkout");
  for (const one of [SCRIPT, join("tools", "checkout.mjs"), join("plugin", "src", "tools", "plugin-copy.mjs")]) {
    mkdirSync(join(work, dirname(one)), { recursive: true });
    cpSync(join(ROOT, one), join(work, one));
  }
  writeFileSync(join(work, "package.json"),
    JSON.stringify({ name: "scratch", version: "1.0.0", scripts: { check: gate } }, null, 2));
  mkdirSync(join(work, ".claude-plugin"), { recursive: true });
  writeFileSync(join(work, ".claude-plugin", "marketplace.json"), JSON.stringify({ name: "scratch-local" }));
  mkdirSync(join(work, "plugin", ".claude-plugin"), { recursive: true });
  writeFileSync(join(work, "plugin", ".claude-plugin", "plugin.json"), JSON.stringify({ name: "scratch", version: "1.0.0" }));
  mkdirSync(join(work, "node_modules"), { recursive: true });
  return { at, work };
};

const committed = (work, message) => {
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(work, "config", key, value);
  git(work, "add", "package.json", ".claude-plugin", "plugin", "tools");
  git(work, "commit", "-m", message);
};

/* A scratch checkout with a bare origin it has already pushed to, which is the state every step
   past the first reads: without it the fetch has nothing to name and the range is undefined. */
const pushed = (name) => {
  const { at, work } = scratch(name);
  git(at, "init", "--bare", "origin.git");
  git(work, "init", "-b", "master");
  committed(work, "one");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "origin", "HEAD:master");
  return { at, work };
};

const landIn = (work, path, lines, message) => {
  mkdirSync(join(work, dirname(path)), { recursive: true });
  writeFileSync(join(work, path), "the change\n".repeat(lines));
  git(work, "add", path);
  git(work, "commit", "-m", message);
};

/* Step 8 is `claude`, which BARE does not carry, so the release runs as far as it can and the last
   step is then reached in a process of its own — which is how a resume reaches it too. */
const lastStep = (work) => {
  runIn(work, ["ship"], BARE);
  return runIn(work, ["ship", "--from", "10"], BARE);
};

const ref = (work) => git(work, "rev-parse", "--verify", "--quiet", "refs/forge/reviewed").stdout.trim();

/* The threshold and the mark are typed here rather than imported: nothing imports an entry point,
   and a second party that has to agree with the constants is what pins them to the help at all. */
test("-h names all three steps, the resume flag and the threshold it counts against", () => {
  const run = runIn(ROOT, ["-h"]);
  assert.equal(run.status, 0, run.stderr);
  for (const said of ["start <ISS-nn>", "ship [--from N]", "review [--done [ref]]", "--from N",
    "worktree", "restart", "refs/forge/reviewed", "3 release(s)", "500 changed line(s)", "npm run check"]) {
    assert.ok(run.stdout.includes(said), `${said} is not in the usage:\n${run.stdout}`);
  }
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

/* A release ships what a gate has passed. Before ISS-117 nothing here gated at all: the head was
   pushed on the strength of whatever the session remembered running. */
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
});

/* Every delegated run reviews its own diff and stops, so what two runs each wrote is in no run's
   range. The count that spans them is the release step's, not anyone's judgement per issue. */
test("with no mark, the last step says it cannot count and plants nothing", () => {
  const { work } = pushed("unmarked");
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change");

  const run = lastStep(work);
  assert.match(run.stderr, /no refs\/forge\/reviewed in this repository/u, run.stderr);
  assert.match(run.stderr, /the release that introduced this rule/u, run.stderr);
  assert.doesNotMatch(run.stdout, /release\(s\)/u, "a run that cannot count may not report a count");
  assert.equal(ref(work), "", "the release step is not the mark's writer");

  const asked = runIn(work, ["review"], BARE);
  assert.equal(asked.status, 1, asked.stdout);
  assert.match(asked.stderr, /no refs\/forge\/reviewed/u, asked.stderr);
});

test("the third release since the mark is owed a reading, and the two before it are not", () => {
  const { work } = pushed("releases");
  const planted = runIn(work, ["review", "--done"], BARE);
  assert.match(planted.stdout, /refs\/forge\/reviewed planted at [0-9a-f]{7}/u, planted.stdout);
  assert.equal(ref(work), git(work, "rev-parse", "HEAD").stdout.trim());

  for (const nth of [1, 2]) {
    landIn(work, join("plugin", "hooks", `gate-${nth}.mjs`), 4, `the ${nth} change`);
    const under = lastStep(work);
    assert.match(under.stdout, new RegExp(`${nth} release\\(s\\), ${nth} file\\(s\\)`, "u"), under.stdout);
    assert.doesNotMatch(under.stdout, /a review of/u, `${nth} release(s) is short of the threshold`);
  }

  landIn(work, join("plugin", "bin", "one"), 4, "the third change");
  const owed = lastStep(work);
  assert.match(owed.stdout, /a review of [0-9a-f]{7}\.\.HEAD is owed: 3 release\(s\)/u, owed.stdout);
  assert.match(owed.stdout, /forge new - --title "review [0-9a-f]{7}\.\.HEAD"/u, owed.stdout);
  assert.match(owed.stdout, /start <that ISS-nn>/u, owed.stdout);
});

/* Both halves of the threshold have to fire on their own, or a repository that ships rarely and
   changes a lot is never read. Read through the verb rather than through a ship, so the release
   count stays at zero and the line half is the only thing that can be what fired. */
test("the five hundredth changed line is owed a reading, and only in the counted paths", () => {
  const { work } = pushed("lines");
  runIn(work, ["review", "--done"], BARE);

  landIn(work, join("docs", "long.md"), 600, "prose, which the one-home check reads");
  const outside = runIn(work, ["review"], BARE);
  assert.match(outside.stdout, /holds 0 release\(s\), 0 file\(s\), 0 changed line\(s\)/u, outside.stdout);
  assert.match(outside.stdout, /^Short of the 3 release\(s\) or 500 line\(s\)/mu, "docs/ is not a path this count reads");

  landIn(work, join("plugin", "src", "wide.mjs"), 499, "a module a run grew");
  const under = runIn(work, ["review"], BARE);
  assert.match(under.stdout, /holds 0 release\(s\), 1 file\(s\), 499 changed line\(s\)/u, under.stdout);
  assert.match(under.stdout, /^Short of the/mu, "499 is one line short, and the boundary is exact");

  landIn(work, join("plugin", "src", "wide.mjs"), 500, "the line that crosses it");
  const owed = runIn(work, ["review"], BARE);
  assert.match(owed.stdout, /holds 0 release\(s\), 1 file\(s\), 500 changed line\(s\)/u, owed.stdout);
  assert.match(owed.stdout, /^A review is owed:/mu, owed.stdout);
  assert.match(lastStep(work).stdout, /a review of [0-9a-f]{7}\.\.HEAD is owed: 1 release\(s\)/u,
    "the release step says it too, on a release count of its own bump alone");
});

test("a reading that finds nothing moves the mark in one line, and the count starts again there", () => {
  const { work } = pushed("moved");
  runIn(work, ["review", "--done"], BARE);
  landIn(work, join("plugin", "src", "wide.mjs"), 501, "a module a run grew");
  assert.match(lastStep(work).stdout, /a review of/u, "501 lines under plugin/src is past the threshold");

  const before = ref(work);
  const asked = runIn(work, ["review"], BARE);
  assert.match(asked.stdout, /[0-9a-f]{7}\.\.HEAD is the next review's, and holds 1 release\(s\)/u, asked.stdout);
  assert.match(asked.stdout, /git diff [0-9a-f]{40}\.\.HEAD -- plugin\/src plugin\/hooks plugin\/bin/u, asked.stdout);
  assert.equal(ref(work), before, "reading the range moves nothing");

  const done = runIn(work, ["review", "--done"], BARE);
  assert.match(done.stdout, /refs\/forge\/reviewed [0-9a-f]{7} -> [0-9a-f]{7}/u, done.stdout);
  assert.equal(ref(work), git(work, "rev-parse", "HEAD").stdout.trim());
  assert.doesNotMatch(lastStep(work).stdout, /a review of/u, "the range restarts at the mark it just moved");

  const nowhere = runIn(work, ["review", "--done", "no-such-ref"], BARE);
  assert.equal(nowhere.status, 1, nowhere.stdout);
  assert.match(nowhere.stderr, /`no-such-ref` is no commit in this tree/u, nowhere.stderr);
});

/* A mark moved back hands the next reading a range it has already been told was read — a codex
   finding on this change, alongside the shared ref two review worktrees both write. */
test("the mark only ever moves forward, and the refusal carries the way past a wrong one", () => {
  const { work } = pushed("forward");
  const first = git(work, "rev-parse", "HEAD").stdout.trim();
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change");
  runIn(work, ["review", "--done"], BARE);

  const back = runIn(work, ["review", "--done", first], BARE);
  assert.equal(back.status, 1, back.stdout);
  assert.match(back.stderr, /is not a descendant of the mark at [0-9a-f]{7}/u, back.stderr);
  assert.match(back.stderr, /git update-ref refs\/forge\/reviewed [0-9a-f]{7} [0-9a-f]{7}/u,
    "a refusal over a mark that is itself the mistake has to carry the way past it");
  assert.equal(ref(work), git(work, "rev-parse", "HEAD").stdout.trim(), "the refused write moved nothing");
});
