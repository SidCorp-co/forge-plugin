/* `standingIn` reads a tree by `cwd` alone: no command line is matched, so it is as ready for a
   detached ship as for a gate or any other job a turn left running. Every case spawns a real
   process, because a fake `/proc` would only prove this reads whatever it is handed (ISS-1358). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";
import { standingIn } from "../../../src/flow/lease/holder.mjs";

/* A process this suite owns, standing in a tree of its own — killed once every case that wants it
   alive has run, never before. */
const stood = (tree) => {
  const child = spawn("sleep", ["5"], { cwd: tree, detached: true, stdio: "ignore" });
  child.unref();
  return child.pid;
};

const gone = (pid) => {
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // already gone
  }
};

const settled = () => new Promise((r) => setTimeout(r, 150));

test("a process standing in the tree by its cwd is found, whatever it is running", async () => {
  const tree = tempRoom("standing-in-");
  const pid = stood(tree);
  try {
    await settled();
    const found = standingIn(tree);
    assert.ok(found, "the process table read");
    assert.ok(found.some((one) => one.pid === pid), `${pid} not among ${JSON.stringify(found)}`);
  } finally {
    gone(pid);
  }
});

test("a process standing outside the tree is not found", async () => {
  const tree = tempRoom("standing-in-");
  const elsewhere = tempRoom("standing-in-elsewhere-");
  const pid = stood(elsewhere);
  try {
    await settled();
    const found = standingIn(tree);
    assert.ok(found);
    assert.ok(!found.some((one) => one.pid === pid), "a process in a sibling tree was read as this tree's");
  } finally {
    gone(pid);
  }
});

test("a nested directory of the tree still counts as standing in it", async () => {
  const tree = tempRoom("standing-in-");
  const nested = join(tree, "nested");
  mkdirSync(nested);
  const pid = stood(nested);
  try {
    await settled();
    const found = standingIn(tree);
    assert.ok(found.some((one) => one.pid === pid), "a process below the tree's own root was missed");
  } finally {
    gone(pid);
  }
});

test("since narrows to what began at or after that moment", async () => {
  const tree = tempRoom("standing-in-");
  const pid = stood(tree);
  try {
    await settled();
    const future = Date.now() + 60_000;
    const excluded = standingIn(tree, future);
    assert.ok(!excluded.some((one) => one.pid === pid),
      "a process older than `since` was still read as begun after it");
    const past = Date.now() - 60_000;
    const included = standingIn(tree, past);
    assert.ok(included.some((one) => one.pid === pid), "a process begun after `since` was left out");
  } finally {
    gone(pid);
  }
});

test("this call's own chain is never read back as standing in its own tree", () => {
  const found = standingIn(process.cwd());
  assert.ok(found === null || !found.some((one) => one.pid === process.pid),
    "the calling process was read as standing in the tree it is reading");
});
