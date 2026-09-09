/* The record holds one entry per step and content. It held one per step, so two worktrees gating
   different trees erased each other's passes and the loss read as a tree that had moved (ISS-948). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ENTRIES_PER_STEP, recordPass, secondsFor } from "../../../../tools/gates/ledger.mjs";
import { STEPS } from "../../../../tools/gates/steps.mjs";
import { recordDir } from "../../../../tools/gates/timing.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { git, passesDir, passesFor, run, scratch, touchedEverywhere } from "./scratch.mjs";

const whole = new RegExp(`All ${STEPS.length} gate step\\(s\\) passed`, "u");

const digestOf = (nth) => nth.toString(16).padStart(12, "0");

// Every entry a second apart and every one of them in the past, so which is oldest is this case's answer and not the clock's.
const AGED = Math.floor(Date.now() / 1000) - 100000;

const started = (name) => {
  const at = tempRoom(name);
  git(at, "init", "-b", "master");
  return { at, dir: recordDir(at) };
};

test("two worktrees at two contents keep each other's passes, and the first spends nothing on its return", () => {
  const { at, work } = scratch("two-contents");
  const tree = join(at, "wt");
  try {
    touchedEverywhere(work, "the first content");
    const first = run(work);
    assert.match(first.stdout, whole, first.stdout + first.stderr);

    git(work, "worktree", "add", tree, "-b", "other");
    touchedEverywhere(tree, "the second content");
    const other = run(tree);
    assert.match(other.stdout, whole, `the second content read the first's passes as its own:\n${other.stdout}`);

    const again = run(work);
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.match(again.stdout, /All 0 gate step\(s\) passed/u,
      `the tree gated first came back to a record another run had taken:\n${again.stdout}`);
    for (const step of STEPS) {
      assert.equal(passesFor(work, step.label).length, 2, `${step.label} holds one entry for two contents: `
        + `${readdirSync(passesDir(work)).join(", ")}`);
    }
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("one step's entries are bounded, and a pass past the ceiling evicts its oldest", () => {
  const { at, dir } = started("ledger-bound-");
  try {
    for (let nth = 0; nth < ENTRIES_PER_STEP + 2; nth += 1) {
      recordPass(dir, { label: "lint", digest: digestOf(nth) }, nth);
      utimesSync(join(dir, "passes", `${digestOf(nth)}.lint`), AGED + nth, AGED + nth);
    }
    const held = readdirSync(join(dir, "passes"));
    assert.equal(held.length, ENTRIES_PER_STEP, `${ENTRIES_PER_STEP + 2} contents left ${held.length} entries`);
    for (const nth of [0, 1]) {
      assert.ok(!held.includes(`${digestOf(nth)}.lint`), `the oldest entry survived the ceiling: ${held.join(", ")}`);
    }
    for (const nth of [2, ENTRIES_PER_STEP + 1]) {
      assert.ok(held.includes(`${digestOf(nth)}.lint`), `an entry inside the ceiling was evicted: ${held.join(", ")}`);
    }
    assert.deepEqual(secondsFor(at, [{ label: "lint" }]).map((step) => step.seconds), [ENTRIES_PER_STEP + 1],
      "the seconds that order the run came from an entry that is not the newest");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* A carry writes a seconds-less entry for a pass from before the record kept seconds, and that entry
   can be the newest a step holds. The order answers from what this record has measured, so a step
   whose cost is known is not spent last for having passed again since. */
test("a step whose newest entry carries no seconds is ordered by the measurement an older one holds", () => {
  const { at, dir } = started("ledger-seconds-");
  try {
    recordPass(dir, { label: "lint", digest: digestOf(1) }, 30);
    utimesSync(join(dir, "passes", `${digestOf(1)}.lint`), AGED, AGED);
    recordPass(dir, { label: "lint", digest: digestOf(2) }, null);
    assert.deepEqual(secondsFor(at, [{ label: "lint" }]).map((step) => step.seconds), [30],
      "a step this record has measured was ordered as one it has never measured");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The whole remainder of an entry's name is its step, and a staging file carries its dot and its pid
   in front, so a label ending in a dot and a pid is answered for by its own writes and nothing else. */
test("a label and that label with a dotted suffix keep their own entries, and a file in the parent is none", () => {
  const { at, dir } = started("ledger-labels-");
  const dotted = `lint.${process.pid}`;
  const digest = "0123456789ab";
  try {
    recordPass(dir, { label: "lint", digest }, 5);
    recordPass(dir, { label: dotted, digest }, 7);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${digest}.lint`), `${digest} 999s lint\n`);

    assert.deepEqual(secondsFor(at, [{ label: "lint" }, { label: dotted }]).map((step) => step.seconds), [5, 7],
      "one of the two steps was answered for by the other's entry, or by the file beside the record");
    assert.deepEqual(readdirSync(join(dir, "passes")).sort(), [`${digest}.lint`, `${digest}.${dotted}`].sort(),
      "the passes directory holds something that is not one of the two entries");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
