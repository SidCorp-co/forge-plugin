/* A landing given `--wait M` on a tree whose landing still runs waits, in its own detached session, for
   that one to record its end and then runs, rather than refusing at once (ISS-2488). Every case
   stands on a scratch checkout; none starts a landing of this one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { BARE, ROOT, runIn, SCRIPT } from "../run-fixtures.mjs";
import { caller, ended, inGit, landingPid, LOCK, recordOf, remoted, running, sleepingGate, until }
  from "./landing-fixtures.mjs";
import { escaped } from "../../fixtures.mjs";

const WAITING = "forge-landing.waiting";

/* A first ship standing in its gate for `ms`, and a second caller of the same tree behind it. */
const behindShip = async (name, ms, argv, opts) => {
  const room = remoted(name, sleepingGate(ms));
  const first = caller(room.work, ["ship"]);
  const ahead = await landingPid(first.said);
  await until("the gate starting", () => existsSync(join(room.at, "gate-started")));
  const second = caller(room.work, argv, opts);
  const waiter = await landingPid(second.said);
  await until("the waiter saying it waits", () => /waiting behind the ship of this tree/u.test(second.said.out), 20_000);
  return { ...room, first, ahead, second, waiter };
};

const endAll = async (...ones) => {
  for (const { pid, exited } of ones) {
    ended(pid);
    await exited;
  }
};

const stepAt = (out) => out.split("\n").findIndex((line) => /^step 1\//u.test(line.trim()));

test("a land --wait behind a running ship waits for it, then runs and exits with its own code", async () => {
  const { at, work, first, ahead, second, waiter } = await behindShip("behind-land", 2500, ["land", "--wait", "1"]);
  try {
    const { out } = second.said;
    assert.ok(out.includes(`waiting behind the ship of this tree, pid ${ahead}`), out);
    assert.equal(stepAt(out), -1, `the waiter ran a step while the ship was running:\n${out}`);
    assert.equal(recordOf(work).pid, ahead, "the waiter wrote over the running landing's record");
    assert.equal(JSON.parse(readFileSync(inGit(work, LOCK), "utf8")).pid, ahead, "the lock does not name the running ship");
    assert.equal(JSON.parse(readFileSync(inGit(work, WAITING), "utf8")).pid, waiter, "the waiting file does not name the waiter");
    const { code } = await second.exited;
    assert.equal(code, 0, second.said.out + second.said.err);
    const lines = second.said.out.split("\n");
    const waited = lines.findIndex((line) => new RegExp(`waited \\d+ second\\(s\\) behind pid ${ahead}, whose ship (succeeded|failed)`, "u").test(line));
    assert.ok(waited >= 0, second.said.out);
    assert.ok(waited < stepAt(second.said.out), `the wait was not said before step 1:\n${second.said.out}`);
    assert.ok(existsSync(join(at, "gate-done")), "the waiter ran before the ship's gate ended");
    const mine = recordOf(work);
    assert.deepEqual([mine.pid, mine.waited.behind, mine.ended.code], [waiter, ahead, 0]);
    assert.ok(Number.isInteger(mine.waited.ended.code), JSON.stringify(mine));
    assert.ok(Date.parse(mine.since) >= Date.parse(mine.waited.ended.at), JSON.stringify(mine));
    assert.ok(!existsSync(inGit(work, WAITING)), "the waiting file outlived the wait");
  } finally {
    await endAll({ pid: ahead, exited: first.exited }, { pid: waiter, exited: second.exited });
  }
});

test("a landing whose --wait runs out behind a running landing is refused having run no step", async () => {
  const { work, first, ahead, second, waiter } = await behindShip("behind-deadline", 30_000, ["land", "--wait", "0.02"]);
  try {
    const { code } = await second.exited;
    assert.equal(code, 1, second.said.out + second.said.err);
    assert.equal(stepAt(second.said.out), -1, second.said.out);
    assert.ok(second.said.err.includes(`pid ${ahead}, and it is still running`), second.said.err);
    assert.ok(second.said.err.includes(`node ${join(work, SCRIPT)} wait --tree ${work}`), second.said.err);
    assert.equal(recordOf(work).pid, ahead, "the refused waiter wrote over the running landing's record");
    assert.ok(running(ahead), "the running ship did not outlive the refused waiter");
    assert.ok(!existsSync(inGit(work, WAITING)), "the refused waiter left its waiting file");
  } finally {
    await endAll({ pid: ahead, exited: first.exited }, { pid: waiter, exited: second.exited });
  }
});

for (const verb of ["ship", "land-ready"]) {
  test(`a ${verb} --wait behind a running ship waits for it and then runs`, async () => {
    const { work, first, ahead, second, waiter } = await behindShip(`behind-${verb}`, 2000, [verb, "--wait", "1"]);
    try {
      const { code } = await second.exited;
      assert.match(second.said.out, new RegExp(`waited .+ behind pid ${ahead}, whose ship (succeeded|failed).*; this ${verb} now holds the tree`, "u"),
        second.said.out + second.said.err);
      const mine = recordOf(work);
      assert.deepEqual([mine.pid, mine.verb, mine.waited.behind], [waiter, verb, ahead]);
      assert.equal(code, mine.ended.code, second.said.out + second.said.err);
    } finally {
      await endAll({ pid: ahead, exited: first.exited }, { pid: waiter, exited: second.exited });
    }
  });
}

test("a waiter whose caller is stopped mid-wait waits on and then lands", async () => {
  const { work, first, ahead, second, waiter } = await behindShip("behind-caller-killed", 2500, ["land", "--wait", "1"], { group: true });
  try {
    process.kill(-second.one.pid, "SIGKILL");
    await second.exited;
    assert.ok(running(waiter), "stopping the caller stopped the waiter");
    await until("the waiter landing", () => recordOf(work).pid === waiter && recordOf(work).ended, 60_000);
    assert.equal(recordOf(work).ended.code, 0, JSON.stringify(recordOf(work)));
  } finally {
    await endAll({ pid: ahead, exited: first.exited }, { pid: waiter, exited: Promise.resolve() });
  }
});

test("a third landing of a tree with a landing waiting is refused at once, naming the waiter", async () => {
  const { work, first, ahead, second, waiter } = await behindShip("behind-third", 30_000, ["land", "--wait", "1"]);
  try {
    for (const argv of [["land"], ["land", "--wait", "1"]]) {
      const third = runIn(work, argv, BARE);
      assert.equal(third.status, 1, third.stdout);
      assert.ok(!/runs as pid/u.test(third.stdout), third.stdout);
      assert.ok(third.stderr.includes(`already waiting behind its running landing, as pid ${waiter}`), third.stderr);
      assert.ok(third.stderr.includes(`wait --tree ${work}`), third.stderr);
    }
  } finally {
    await endAll({ pid: ahead, exited: first.exited }, { pid: waiter, exited: second.exited });
  }
});

test("a wait on a tree with a landing waiting answers with the waiter's end, not the landing ahead's", async () => {
  const { work, first, ahead, second, waiter } = await behindShip("behind-wait-verb", 2000, ["land", "--wait", "1"]);
  try {
    const waited = spawn(process.execPath, [join(work, SCRIPT), "wait", "--tree", work],
      { cwd: ROOT, env: BARE, stdio: ["ignore", "pipe", "pipe"] });
    let said = "";
    waited.stdout.on("data", (chunk) => { said += chunk; });
    const code = await new Promise((done) => waited.once("exit", done));
    assert.equal(code, 0, said);
    assert.match(said, new RegExp(`landing verdict: succeeded — the land of ${escaped(work)}, pid ${escaped(waiter)}`, "u"), said);
  } finally {
    await endAll({ pid: ahead, exited: first.exited }, { pid: waiter, exited: second.exited });
  }
});

test("a waiter whose landing ahead is gone having recorded no end is refused naming its output", async () => {
  const { work, first, ahead, second, waiter } = await behindShip("behind-gone", 30_000, ["land", "--wait", "1"]);
  try {
    const { out } = recordOf(work);
    /* The caller first, since a caller that sees its landing killed records the signal on its behalf. */
    first.one.kill("SIGKILL");
    await first.exited;
    process.kill(-ahead, "SIGKILL");
    const { code } = await second.exited;
    assert.equal(code, 1, second.said.out + second.said.err);
    assert.equal(stepAt(second.said.out), -1, second.said.out);
    assert.ok(second.said.err.includes(`pid ${ahead}, is gone having recorded no end`), second.said.err);
    assert.ok(second.said.err.includes(out), second.said.err);
  } finally {
    await endAll({ pid: ahead, exited: first.exited }, { pid: waiter, exited: second.exited });
    rmSync(inGit(work, LOCK), { force: true });
  }
});

test("-h says a second landing of a running tree waits given --wait and is refused without it", () => {
  const run = runIn(ROOT, ["-h"]);
  for (const said of ["unless the second is given --wait M", "up to M minutes for that one", "One waits at a time."]) {
    assert.ok(run.stdout.includes(said), `${said} is not in the usage:\n${run.stdout}`);
  }
});
