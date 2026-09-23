/* The landing verbs run in a session of their own, so a caller stopped mid-gate — which is what an
   agent harness did to two ships on 2026-09-08 — stops nothing of the landing and strands no lock
   (ISS-742). Every case stands on a scratch checkout; none starts a landing of this one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { alive, BARE, committed, git, pushed, ROOT, runIn, SCRIPT, scratch } from "./run-fixtures.mjs";

const LOCK = "forge-ship-lock";
const RECORD = "forge-landing.json";
const MARK = "FORGE_LANDING_DETACHED";

/* The project's gate as a scratch checkout's `check`: it says it started, writes what it inherited of
   the mark, and holds the step for as long as a case needs a landing standing in its gate. */
const sleepingGate = (ms) => `node -e "const f=require('fs');f.writeFileSync('../gate-env',String(process.env.${MARK}));`
  + `f.writeFileSync('../gate-started','');setTimeout(()=>f.writeFileSync('../gate-done',''),${ms})"`;

const remoted = (name, gate) => {
  const room = scratch(name, gate);
  git(room.at, "init", "--bare", "origin.git");
  git(room.work, "init", "-b", "master");
  committed(room.work, "one");
  git(room.work, "remote", "add", "origin", join(room.at, "origin.git"));
  git(room.work, "push", "origin", "HEAD:master");
  return room;
};

const inGit = (work, name) => join(work, ".git", name);

const running = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

const until = async (what, done, ms = 60_000) => {
  const by = Date.now() + ms;
  while (!done()) {
    if (Date.now() > by) throw new Error(`${what} did not happen within ${ms}ms`);
    await sleep(50);
  }
};

/* A caller with pipes of its own, as a harness's shell is; `group` gives it a process group to be
   killed by, which is the whole of what a harness stopping a background shell reaches. */
const caller = (work, argv, { group = false } = {}) => {
  const one = spawn(process.execPath, [join(work, SCRIPT), ...argv],
    { cwd: work, env: BARE, detached: group, stdio: ["ignore", "pipe", "pipe"] });
  const said = { out: "", err: "" };
  one.stdout.on("data", (chunk) => { said.out += chunk; });
  one.stderr.on("data", (chunk) => { said.err += chunk; });
  const exited = new Promise((done) => one.once("exit", (code, signal) => done({ code, signal })));
  return { one, said, exited };
};

const landingPid = async (said) => {
  await until("the caller naming the landing's pid", () => /runs as pid \d+/u.test(said.out), 20_000);
  return Number(/runs as pid (\d+)/u.exec(said.out)[1]);
};

/* Whatever a case started is ended by the case, so a failed assertion leaves no scratch landing
   standing in a room nobody reads again. */
const ended = (pid) => {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    /* already gone */
  }
};

const recordOf = (work) => JSON.parse(readFileSync(inGit(work, RECORD), "utf8"));

test("a ship whose caller's process group is killed mid-gate still pushes and drops its lock", async () => {
  const { at, work } = remoted("detached-killed", sleepingGate(1500));
  const { one, said } = caller(work, ["ship"], { group: true });
  const pid = await landingPid(said);
  try {
    await until("the gate starting", () => existsSync(join(at, "gate-started")));
    assert.ok(existsSync(inGit(work, LOCK)), "the ship reached its gate without taking the lock");
    process.kill(-one.pid, "SIGKILL");
    await until("the landing ending", () => !running(pid));
    assert.ok(existsSync(join(at, "gate-done")), "the landing did not outlive its caller to finish the gate");
    assert.equal(git(join(at, "origin.git"), "rev-parse", "master").stdout.trim(),
      git(work, "rev-parse", "HEAD").stdout.trim(), "the remote does not hold the head the ship pushed");
    assert.ok(!existsSync(inGit(work, LOCK)), "the ship's lock outlived the ship");
  } finally {
    ended(pid);
  }
});

test("the landing stands in its tree running the interpreter, script, verb and arguments the caller typed", async () => {
  const { at, work } = remoted("detached-argv", sleepingGate(30_000));
  const { said, exited } = caller(work, ["ship", "--wait", "1"]);
  const pid = await landingPid(said);
  try {
    await until("the gate starting", () => existsSync(join(at, "gate-started")));
    assert.deepEqual(readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean),
      [process.execPath, join(work, SCRIPT), "ship", "--wait", "1"]);
    assert.equal(readlinkSync(`/proc/${pid}/cwd`), realpathSync(work));
    const session = Number(readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ")[3]);
    assert.equal(session, pid, "the landing is not the leader of a session of its own");
    assert.equal(readFileSync(join(at, "gate-env"), "utf8"), "undefined", "the gate inherited the detached mark");
  } finally {
    ended(pid);
    await exited;
  }
});

test("each landing verb names its pid, its output files and its record before its first step", () => {
  const { work } = pushed("detached-first-line");
  for (const verb of ["land", "land-ready", "ship"]) {
    const run = runIn(work, [verb], BARE);
    const first = run.stdout.split("\n").find((line) => line.trim());
    /* The first line the caller prints, so nothing a step says can come before it. */
    assert.match(first, new RegExp(`this ${verb} runs as pid \\d+ in a session of its own`, "u"), run.stdout);
    for (const name of [RECORD, `forge-landing-${run.pid}.out`, `forge-landing-${run.pid}.err`]) {
      assert.ok(first.includes(inGit(work, name)), `${name} is not named:\n${first}`);
    }
    assert.ok(first.includes("kill -- -"), first);
    assert.notEqual(Number(/runs as pid (\d+)/u.exec(first)[1]), run.pid, "the landing ran in the caller");
  }
});

test("an attached caller relays the landing's stdout and stderr each to its own and exits with its code", () => {
  /* Each said in two halves, so npm's echo of the command line carries neither whole. */
  const gate = "node -e \"console.log('gate says '+'out');console.error('gate says '+'err');process.exit(3)\"";
  const { work } = remoted("detached-relay", gate);
  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(recordOf(work).ended.code, 1);
  assert.ok(run.stdout.includes("gate says out"), run.stdout);
  assert.ok(!run.stdout.includes("gate says err"), run.stdout);
  assert.ok(run.stderr.includes("gate says err"), run.stderr);
  assert.match(run.stderr, /stopped at step 5 \(the gate\)/u, run.stderr);
});

/* Refused at its first step, the landing ends within its own start-up, which is the order in which a
   caller's record written after the spawn could land on top of the landing's end. */
test("a landing that ends at once keeps its end in the record", () => {
  const { work } = pushed("detached-at-once");
  writeFileSync(join(work, "untracked"), "dirty\n");
  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the tree is dirty/u, run.stderr);
  assert.equal(recordOf(work).ended?.code, 1, JSON.stringify(recordOf(work)));
});

test("a landing ended by a signal is said with the step, recorded, and leaves its lock naming it", async () => {
  const { at, work } = remoted("detached-signal", sleepingGate(30_000));
  const { said, exited } = caller(work, ["ship"]);
  const pid = await landingPid(said);
  try {
    await until("the gate starting", () => existsSync(join(at, "gate-started")));
    process.kill(pid, "SIGTERM");
    const { code } = await exited;
    assert.equal(code, 1, said.err);
    assert.match(said.err, new RegExp(`the landing, pid ${pid}, was ended by SIGTERM during step 5/10 \\(the gate\\)`, "u"), said.err);
    assert.deepEqual([recordOf(work).ended.signal, recordOf(work).ended.step], ["SIGTERM", "step 5/10 (the gate)"]);
    assert.equal(JSON.parse(readFileSync(inGit(work, LOCK), "utf8")).pid, pid, "the lock does not name the landing");
  } finally {
    ended(pid);
    rmSync(inGit(work, LOCK), { force: true });
  }
});

test("a second landing of a tree whose landing still runs is refused with the pid to wait on", async () => {
  const { at, work } = remoted("detached-busy", sleepingGate(30_000));
  const { said, exited } = caller(work, ["ship"]);
  const pid = await landingPid(said);
  try {
    await until("the gate starting", () => existsSync(join(at, "gate-started")));
    const second = runIn(work, ["land"], BARE);
    assert.equal(second.status, 1, second.stdout);
    assert.ok(!/step 1\//u.test(second.stdout), `the refused landing ran a step:\n${second.stdout}`);
    assert.ok(second.stderr.includes(`still running as pid ${pid}`), second.stderr);
    assert.ok(second.stderr.includes(recordOf(work).out), second.stderr);
    assert.ok(second.stderr.includes(`tail --pid=${pid} -f /dev/null`), second.stderr);
    assert.equal(recordOf(work).pid, pid, "the refused landing wrote over the running one's record");
  } finally {
    ended(pid);
    await exited;
  }
});

test("two callers of one tree started in the same instant launch one landing and refuse the other", async () => {
  const { at, work } = remoted("detached-race", sleepingGate(30_000));
  const both = [caller(work, ["ship"]), caller(work, ["ship"])];
  await Promise.all(both.map((one) => until("both callers answering",
    () => /runs as pid \d+/u.test(one.said.out) || one.one.exitCode !== null, 20_000)));
  const launched = both.filter((one) => /runs as pid \d+/u.test(one.said.out));
  try {
    assert.equal(launched.length, 1, both.map((one) => one.said.out + one.said.err).join("\n---\n"));
    const [other] = both.filter((one) => !launched.includes(one));
    assert.equal((await other.exited).code, 1, other.said.err);
    assert.match(other.said.err, /being started this moment|still running as pid/u, other.said.err);
    await until("the gate starting", () => existsSync(join(at, "gate-started")));
  } finally {
    for (const one of launched) ended(await landingPid(one.said));
    await Promise.all(both.map((one) => one.exited));
  }
});

test("a reservation a dead call left is refused with the command that clears it, and nothing launches", async () => {
  const { work } = pushed("detached-reserved");
  const gone = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise((done) => gone.once("exit", done));
  writeFileSync(inGit(work, "forge-landing.starting"), `${gone.pid}\n`);
  const run = runIn(work, ["land"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(!/runs as pid/u.test(run.stdout), run.stdout);
  assert.ok(run.stderr.includes(`rm ${inGit(work, "forge-landing.starting")}`), run.stderr);
});

/* A pid the kernel handed to a later process is not the landing the record names, which is what a
   landing SIGKILLed with its caller leaves: a record with no end and a pid somebody else may hold. */
test("a record whose pid now belongs to another process refuses no landing", async () => {
  const { work } = pushed("detached-reused");
  const other = alive();
  try {
    writeFileSync(inGit(work, RECORD), JSON.stringify({ verb: "ship", pid: other.pid, start: 1, since: "2026-09-06T06:00:00.000Z" }));
    const run = runIn(work, ["land"], BARE);
    assert.equal(run.status, 0, run.stderr);
    assert.ok(!run.stderr.includes("still running"), run.stderr);
  } finally {
    other.kill();
  }
});

test("-h says the landing verbs run detached, what stops one and where it is read", () => {
  const run = runIn(ROOT, ["-h"]);
  for (const said of ["run in a session of their own", "stops nothing of the landing",
    "`kill -- -<pid>` is what stops the landing", "forge-landing-<caller pid>.out", "forge-landing.json"]) {
    assert.ok(run.stdout.includes(said), `${said} is not in the usage:\n${run.stdout}`);
  }
});
