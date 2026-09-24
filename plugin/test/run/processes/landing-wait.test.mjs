/* A run that backgrounded its landing waits on it in one call from any later turn, and the call
   exits on what the landing recorded rather than on a process (ISS-1352). Every case stands on a
   scratch checkout; none starts a landing of this one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { alive, BARE, pushed, ROOT, runIn, SCRIPT } from "../run-fixtures.mjs";
import { caller, ended, inGit, landingPid, LOCK, RECORD, recordOf, remoted, sleepingGate, until }
  from "./landing-fixtures.mjs";
import { heldMinutes } from "../../../src/host/call-ceiling.mjs";
import { escaped } from "../../fixtures.mjs";

/* From the checkout running the suite, so every answer below is one a caller standing in another
   directory gets for the tree it names. */
const waitOn = (work, ...more) => runIn(work, ["wait", "--tree", work, ...more], BARE, "..");

const waitLater = (work, ...more) => {
  const one = spawn(process.execPath, [join(work, SCRIPT), "wait", "--tree", work, ...more],
    { cwd: ROOT, env: BARE, stdio: ["ignore", "pipe", "pipe"] });
  const said = { out: "", err: "" };
  one.stdout.on("data", (chunk) => { said.out += chunk; });
  one.stderr.on("data", (chunk) => { said.err += chunk; });
  return { said, exited: new Promise((done) => one.once("exit", (code) => done(code))) };
};

const failingGate = (ms) => `node -e "require('fs').writeFileSync('../gate-started','');setTimeout(()=>process.exit(3),${ms})"`;

test("a landing that already ended is answered at once, from another directory, with its verb, pid and code", () => {
  const { work } = pushed("wait-ended");
  const landed = runIn(work, ["land"], BARE);
  assert.equal(landed.status, 0, landed.stderr);
  const { pid } = recordOf(work);
  const run = waitOn(work);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`^landing verdict: succeeded — the land of ${escaped(work)}, pid ${escaped(pid)}, ended .* ago and before this wait began`, "u"), run.stdout);
  assert.ok(!run.stderr.includes("watching"), `an ended landing was waited on:\n${run.stderr}`);

  writeFileSync(join(work, "untracked"), "dirty\n");
  assert.equal(runIn(work, ["ship"], BARE).status, 1);
  const failed = waitOn(work);
  assert.equal(failed.status, 1, failed.stdout);
  assert.match(failed.stderr, new RegExp(`landing verdict: failed, exiting 1 at step 1/\\d+ \\(.+\\) — the ship of ${escaped(work)}, pid ${escaped(recordOf(work).pid)}`, "u"), failed.stderr);
});

test("a landing still running is waited on in that call, which exits with the code it records", async () => {
  const { at, work } = remoted("wait-running", failingGate(1500));
  const { said, exited } = caller(work, ["ship"]);
  const pid = await landingPid(said);
  try {
    await until("the gate starting", () => existsSync(join(at, "gate-started")));
    const waited = waitLater(work);
    const code = await waited.exited;
    assert.equal(code, 1, waited.said.err);
    assert.match(waited.said.err, /^landing wait: watching — the landing of /u, waited.said.err);
    assert.match(waited.said.err, new RegExp(`landing verdict: failed, exiting 1 at step 5/10 \\(the gate\\) — the ship of ${escaped(work)}, pid ${escaped(pid)}, ended`, "u"), waited.said.err);
    assert.ok(!waited.said.err.includes("before this wait began"), waited.said.err);
  } finally {
    ended(pid);
    await exited;
  }
});

test("a landing gone having recorded no end is a failure with 76, and never a success", async () => {
  const { work } = pushed("wait-gone");
  const gone = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise((done) => gone.once("exit", done));
  writeFileSync(inGit(work, RECORD), JSON.stringify({ verb: "ship", tree: work, pid: gone.pid, start: null, since: new Date().toISOString() }));
  const run = waitOn(work);
  assert.equal(run.status, 76, run.stdout + run.stderr);
  assert.match(run.stderr, new RegExp(`landing verdict: failed — the ship of ${escaped(work)}, pid ${escaped(gone.pid)} is gone having recorded no end`, "u"), run.stderr);
});

test("a record whose pid now belongs to another process is told apart by its start and answered 76", () => {
  const { work } = pushed("wait-reused");
  const other = alive();
  try {
    writeFileSync(inGit(work, RECORD), JSON.stringify({ verb: "ship", tree: work, pid: other.pid, start: 1, since: new Date().toISOString() }));
    const run = waitOn(work, "1");
    assert.equal(run.status, 76, run.stdout + run.stderr);
    assert.match(run.stderr, new RegExp(`pid ${escaped(other.pid)} is gone having recorded no end`, "u"), run.stderr);
    assert.ok(!run.stderr.includes("watching"), `a reused pid was waited on as the landing:\n${run.stderr}`);
  } finally {
    other.kill();
  }
});

test("a landing ended by a signal is answered with the signal and its step, 76", async () => {
  const { at, work } = remoted("wait-signal", sleepingGate(30_000));
  const { said, exited } = caller(work, ["ship"]);
  const pid = await landingPid(said);
  try {
    await until("the gate starting", () => existsSync(join(at, "gate-started")));
    process.kill(pid, "SIGTERM");
    await exited;
    const run = waitOn(work);
    assert.equal(run.status, 76, run.stdout + run.stderr);
    assert.match(run.stderr, new RegExp(`the ship of ${escaped(work)}, pid ${escaped(pid)} was ended by SIGTERM during step 5/10 \\(the gate\\)`, "u"), run.stderr);
  } finally {
    ended(pid);
    rmSync(inGit(work, LOCK), { force: true });
  }
});

test("the wait's own deadline with the landing still running exits 77 and says it is still running", async () => {
  const { at, work } = remoted("wait-deadline", sleepingGate(30_000));
  const { said, exited } = caller(work, ["ship"]);
  const pid = await landingPid(said);
  try {
    await until("the gate starting", () => existsSync(join(at, "gate-started")));
    const waited = waitLater(work, "0.02");
    assert.equal(await waited.exited, 77, waited.said.err);
    assert.match(waited.said.err, new RegExp(`landing wait: deadline — the ship of ${escaped(work)}, pid ${escaped(pid)} has been running`, "u"), waited.said.err);
    assert.ok(waited.said.err.includes("It is still running"), waited.said.err);
    assert.ok(waited.said.err.includes(`wait --tree ${work}`), waited.said.err);
  } finally {
    ended(pid);
    await exited;
  }
});

test("a tree holding no landing record is answered 78 at once", () => {
  const { work } = pushed("wait-none");
  const run = waitOn(work);
  assert.equal(run.status, 78, run.stdout + run.stderr);
  assert.match(run.stderr, /^landing wait: no landing — .* holds no landing record/u, run.stderr);
  assert.ok(!run.stderr.includes("watching"), run.stderr);
});

test("more minutes than a call can hold are refused before the wait, naming the most", () => {
  const { work } = pushed("wait-ceiling");
  const run = waitOn(work, String(heldMinutes() + 1));
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.ok(run.stderr.includes(`${heldMinutes()} minute(s) is the most it may be given`), run.stderr);
  assert.ok(!run.stderr.includes("landing wait:"), `the refused wait waited:\n${run.stderr}`);
});

test("ship --wait keeps its own meaning, the wait behind another landing's lock", () => {
  const run = runIn(ROOT, ["ship", "-h"]);
  assert.ok(run.stdout.includes("--wait M     minutes to wait behind another landing on this checkout before refusing"), run.stdout);
  const help = runIn(ROOT, ["-h"]);
  assert.ok(help.stdout.includes("wait [--tree PATH] [M]"), help.stdout);
});
