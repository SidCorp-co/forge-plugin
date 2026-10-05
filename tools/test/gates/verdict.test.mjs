/* The verdict record, on real gates of a scratch checkout of its own: what a landing reads its gate's answer off, so a run
   that ended is told apart from one that ended having decided nothing (ISS-1102). */
import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";

import { verdictRuns } from "../../gates/verdict.mjs";
import { STEPS } from "../../gates/steps.mjs";
import { run, scratch } from "./scratch.mjs";

const recordOf = (work) => verdictRuns(work).at(-1);

test("a green run writes the verdict and prints it as the last thing it says", () => {
  const { at, work } = scratch("verdict-green");
  try {
    const said = run(work, ["--full"]);
    assert.equal(said.status, 0, said.stdout + said.stderr);
    const last = said.stdout.trim().split("\n").at(-1);
    assert.match(last, new RegExp(`^gate verdict: pass — ${STEPS.length} of ${STEPS.length} step\\(s\\) in \\d+s`, "u"), last);
    assert.ok(last.endsWith(`the tree judged: ${work}`), `the terminal line does not name the tree:\n${last}`);
    assert.equal(recordOf(work).verdict, "pass");
    assert.equal(recordOf(work).code, 0);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a run whose step failed writes a failed verdict naming that step, with the code the gate exited on", () => {
  const failing = STEPS.find((step) => !step.tests).label;
  const { at, work } = scratch("verdict-red", failing);
  try {
    const said = run(work, ["--full"]);
    assert.equal(said.status, 1, said.stdout + said.stderr);
    const last = said.stdout.trim().split("\n").at(-1);
    assert.match(last, new RegExp(`^gate verdict: failed — at the step ${failing}`, "u"), last);
    assert.deepEqual([recordOf(work).verdict, recordOf(work).step, recordOf(work).code], ["failed", failing, 1]);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
