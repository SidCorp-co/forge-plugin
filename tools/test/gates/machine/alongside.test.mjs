/* A gate beside another gate of the same checkout runs its steps: only a landing runs the whole gate and the landing lock
   serializes those, so nothing here may decline a gate for want of a place or refuse it for a tree already being gated.
   Half on real gates held open in their step, half against a process table this case writes. */
import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";

import { gatesOf } from "../../../gates/machine.mjs";
import { verdictRuns } from "../../../gates/verdict.mjs";
import { HANGS_IN, heldGate, procTable, reachedTheStep, scratch, sibling, stopGate } from "../scratch.mjs";

/* Each later gate reaching the step the first is holding in is the proof: a decline or a refusal exits before any step. */
test("a gate started while another gate of the same checkout is running runs its steps, declining and refusing nothing", async () => {
  const { at, work } = scratch("alongside", null, null, { hanging: HANGS_IN });
  const gates = [heldGate(work, ["--full"])];
  try {
    await reachedTheStep(gates[0], "the gate held open never reached its hanging step");
    for (const [tree, what] of [[sibling(work), "another worktree of the checkout"], [work, "the tree already being gated"]]) {
      const later = heldGate(tree, ["--full"]);
      gates.push(later);
      const said = await reachedTheStep(later, `a gate of ${what} never reached its steps`);
      assert.match(said, new RegExp(`=== ${HANGS_IN} ===`, "u"), said);
      assert.doesNotMatch(said, /declined|refused to start/u, said);
    }
    assert.ok(gates.every((one) => one.exitCode === null), "a gate was ended by one started beside it");
    assert.equal(verdictRuns(work).filter((one) => one.verdict === null).length, 2, "both gates of the one tree wrote their start");
  } finally {
    for (const one of gates) await stopGate(one);
    rmSync(at, { recursive: true, force: true });
  }
});

const TREE = "/w/one";
const gate = (pid, cwd, argv) => ({ start: pid, pid, cwd, argv });

/* What `run.mjs finish` refuses a removal on: a process running that tree's own runner, and only that. */
test("the gates of a tree are the node processes running that tree's runner, and none other", () => {
  const at = procTable([
    gate(3001, TREE, ["/usr/bin/node", "tools/gates.mjs", "--full"]),
    gate(3002, "/", ["node", "/w/one/tools/gates.mjs"]),
    gate(3003, "/w/two", ["/usr/bin/node", "tools/gates.mjs"]),
    gate(3004, TREE, ["/usr/bin/node", "watcher.mjs", "tools/gates.mjs"]),
    gate(3005, TREE, ["/usr/bin/nodemon", "tools/gates.mjs"]),
    gate(3006, TREE, ["grep", "tools/gates.mjs"]),
    gate(3007, TREE, ["/usr/bin/node", "-e", "tools/gates.mjs"]),
  ]);
  try {
    assert.deepEqual(gatesOf(TREE, at).map((one) => one.pid).sort(), [3001, 3002]);
    assert.deepEqual(gatesOf("/w/three", at), [], "a tree nothing gates was handed another tree's gate");
    assert.deepEqual(gatesOf(TREE, "/no/such/proc"), [], "a table that cannot be read saw a gate");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
