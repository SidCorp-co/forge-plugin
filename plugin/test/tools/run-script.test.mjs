/* The repository's own steps around a change lived in a prompt one session wrote, so sixteen runs
   obeyed a copy nobody could see go stale (ISS-79). Every rule below is a line that prompt carried,
   exercised on a scratch checkout rather than on this one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = new URL("../../..", import.meta.url).pathname;
const SCRIPT = join("tools", "run.mjs");
/* npm and node without whatever else the developer has on PATH: the ship path's last two steps are
   `claude`, and a machine that has it would prove nothing about what a missing step does. */
const BARE = { ...process.env, PATH: `${dirname(realpathSync(process.execPath))}:/usr/bin:/bin` };

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
const runIn = (cwd, argv, env = process.env) =>
  spawnSync(process.execPath, [SCRIPT, ...argv], { cwd, encoding: "utf8", env });

/* The two files the script is: itself, and the one module it reads the install record through. */
const scratch = (name) => {
  const at = mkdtempSync(join(tmpdir(), `${name}-`));
  const work = join(at, "checkout");
  for (const one of [SCRIPT, join("plugin", "src", "tools", "plugin-copy.mjs")]) {
    mkdirSync(join(work, dirname(one)), { recursive: true });
    cpSync(join(ROOT, one), join(work, one));
  }
  writeFileSync(join(work, "package.json"), JSON.stringify({ name: "scratch", version: "1.0.0" }, null, 2));
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

test("-h names both steps and the resume flag, and touches nothing", () => {
  const run = runIn(ROOT, ["-h"]);
  assert.equal(run.status, 0, run.stderr);
  for (const said of ["start <ISS-nn>", "ship [--from N]", "--from N", "worktree", "restart"]) {
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
  assert.match(run.stderr, /stopped at step 7 \(marketplace scratch-local\)/u, run.stderr);
  assert.match(run.stderr, /Resume from there: node \S+ ship --from 7/u, run.stderr);
  assert.ok(!run.stdout.includes("Released."), "nothing may claim a release it did not finish");
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
  writeFileSync(join(work, "package.json"), JSON.stringify({ name: "scratch", version: "1.0.2" }, null, 2));
  runIn(work, ["ship", "--from", "4"], BARE);
  assert.equal(headVersion(), "1.0.2", "a version raised on disk and left uncommitted is committed by the resume");

  const told = runIn(work, ["ship", "--from", "9"], BARE);
  assert.match(told.stdout, /moved since [0-9a-f]{7}/u, told.stdout + told.stderr);
  rmSync(join(work, ".git", "forge-ship-from"));
  const blind = runIn(work, ["ship", "--from", "9"], BARE);
  assert.match(blind.stderr, /no forge-ship-from in this tree's git directory/u, blind.stderr);
  assert.doesNotMatch(blind.stdout, /moved since/u, "a run that cannot compare may not tell a session it is safe");
});
