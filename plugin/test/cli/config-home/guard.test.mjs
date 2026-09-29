/* A `forge` call in a run's own worktree reads and writes that run's home whatever the shell exports,
   as a hook does there (ISS-2824). Spawned end to end, in a real linked worktree carrying the two
   records `run.mjs start` writes beside its git directory. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRecord, projectRoom, ranAsync, tempRoom } from "../../fixtures.mjs";
import { RUN_ID, SCRATCH, SCRATCH_AT, gitDirAt } from "../../../src/resolve/session/run-id.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const git = (cwd, ...argv) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...argv],
  { cwd, encoding: "utf8" });

/* A checkout, a worktree linked off it, and the run id and scratch record `start` would have written.
   Returns the tree, the home a hook reads there, and the file a run's brief borrows from. */
const worktree = (id) => {
  const at = tempRoom("config-home-guard-");
  const main = join(at, "main");
  mkdirSync(main);
  git(main, "init", "-q");
  git(main, "commit", "-q", "--allow-empty", "-m", "root");
  const tree = join(at, "wt");
  git(main, "worktree", "add", "-q", tree, "-b", `run-${id}`);
  const scratch = join(at, `${SCRATCH}${id}`);
  writeFileSync(join(gitDirAt(tree), RUN_ID), `${id}\n`);
  writeFileSync(join(gitDirAt(tree), SCRATCH_AT), scratch);
  const user = join(at, "user");
  mkdirSync(join(user, ".config", "forge"), { recursive: true });
  const machine = join(user, ".config", "forge", "config.json");
  writeFileSync(machine, `${JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "fixture-token" })}\n`);
  return { tree, home: join(scratch, "home"), user, machine };
};

const run = (cwd, argv, env) => spawnSync(FORGE, argv, {
  encoding: "utf8", cwd, env: { PATH: process.env.PATH, ...env },
});

const rowOf = (said, label) => said.split("\n").find((line) => new RegExp(`\\] ${label}\\s`, "u").test(line));

test("a shell exporting no home reads and writes the tree's run home, borrowing the machine's config", () => {
  const { tree, home, user, machine } = worktree("iss-2824-aaaa0001");
  const done = run(tree, ["doctor"], { HOME: user });
  /* The rows' wording is the module's own case; this one is about which paths the spawned call landed on. */
  assert.ok(rowOf(done.stdout, "config home")?.includes(`${home}  ← `), done.stdout);
  assert.ok(rowOf(done.stdout, "borrow")?.includes(`${machine}  ← `), done.stdout);
  assert.ok(rowOf(done.stdout, "token")?.includes(`← ${machine}`), "the credential is the borrow's");
  assert.ok(!existsSync(join(home, "forge", "config.json")), "and nothing was copied into the run's home");
});

test("a shell whose XDG_CONFIG_HOME disagrees with the tree's own is refused before any verb runs", () => {
  const { tree, home, user, machine } = worktree("iss-2824-aaaa0002");
  const asked = tempRoom("config-home-guard-asked-");
  const done = run(tree, ["issue", "ISS-1"], { HOME: user, XDG_CONFIG_HOME: asked });
  assert.equal(done.status, 1, done.stdout + done.stderr);
  assert.ok(done.stderr.includes(`XDG_CONFIG_HOME=${asked} names a different home`), done.stderr);
  assert.ok(done.stderr.includes(home), done.stderr);
  assert.ok(done.stderr.includes(`export XDG_CONFIG_HOME=${home} FORGE_BORROW_FROM=${machine}`), done.stderr);
  assert.ok(!existsSync(join(asked, "forge")), "nothing was written under the home the shell named");
  assert.ok(!existsSync(home), "nor under the tree's");
});

test("forge doctor keeps running on the same conflict and flags it instead of refusing", () => {
  const { tree, home, user } = worktree("iss-2824-aaaa0003");
  const asked = tempRoom("config-home-guard-asked-");
  const done = run(tree, ["doctor"], { HOME: user, XDG_CONFIG_HOME: asked });
  assert.match(rowOf(done.stdout, "config home"), /^\[ note \] config home\s+XDG_CONFIG_HOME=.* names a different home/u,
    done.stdout);
  assert.ok(done.stdout.includes(`export XDG_CONFIG_HOME=${home}`), done.stdout);
  assert.match(done.stdout, /\] project slug/u, "the report ran on past the row");
});

test("forge doctor refuses a write flag on a conflicted home and writes nothing to it", () => {
  const { tree, user } = worktree("iss-2824-aaaa0004");
  const asked = tempRoom("config-home-guard-asked-");
  const done = run(tree, ["doctor", "--hide", "stats"], { HOME: user, XDG_CONFIG_HOME: asked });
  assert.equal(done.status, 1, done.stdout + done.stderr);
  assert.match(done.stderr, /names a different home .* No configuration was read or written/su);
  assert.ok(!existsSync(join(asked, "forge", "config.json")), "the flag's write never landed");
  const modules = run(tree, ["doctor", "modules", "--add", "x"], { HOME: user, XDG_CONFIG_HOME: asked });
  assert.equal(modules.status, 1, modules.stdout + modules.stderr);
  assert.match(modules.stderr, /names a different home/u, "and a tracker write through the subject is refused alike");
});

const state = { issues: [], comments: {}, calls: [], answer: {}, memory: {} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const capabilitiesIn = (home) => JSON.parse(readFileSync(join(home, "forge", "config.json"), "utf8")).capabilities;

test("forge doctor on a conflicted home probes the tracker and records none of what answered", async () => {
  const { tree, user } = worktree("iss-2824-aaaa0005");
  const asked = tracker.env.XDG_CONFIG_HOME;
  projectRecord(tree, asked, { slug: "forge-plugin" });
  const done = await ranAsync(FORGE, ["doctor"], { ...tracker.env, HOME: user }, tree);
  assert.ok(state.calls.some((one) => one.name === "forge_knowledge"), `the probes ran: ${done.stdout}`);
  assert.equal(capabilitiesIn(asked), undefined, done.stdout);
  const room = tempRoom("config-home-guard-plain-");
  projectRoom(room, asked, { slug: "forge-plugin" });
  await ranAsync(FORGE, ["doctor"], { ...tracker.env, HOME: user }, room);
  assert.ok(capabilitiesIn(asked)?.["forge-plugin"], "the same report outside any run's tree does record them");
});

test("a call outside any run's worktree is the environment's own, unchanged", () => {
  const { user } = worktree("iss-2824-aaaa0006");
  const alone = tempRoom("config-home-guard-alone-");
  const asked = tempRoom("config-home-guard-asked-");
  const done = run(alone, ["doctor"], { HOME: user, XDG_CONFIG_HOME: asked });
  assert.ok(rowOf(done.stdout, "config home")?.includes(`${asked}  ← XDG_CONFIG_HOME;`), done.stdout);
  assert.equal(rowOf(done.stdout, "borrow"), undefined, "and says nothing of a borrow no run asked for");
});
