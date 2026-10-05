/* The halves of a red set's search gated one after the other, whatever number of runs the project declares: a
   landing's gate is the one whole gate running, and two of them at once is two whole gates on one machine. */
import assert from "node:assert/strict";
import test from "node:test";

import { JUDGED_GATE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, context, judgedRuns, judging, landingRan, ready,
  seeded, tracker, world } from "../fixture.mjs";

const { landingOf } = await import("../../../../../plugin/src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

test("a red set of two ready branches no failing case attributes gates its halves one at a time, never two at once", async () => {
  /* Two runs declared: the number of runs a project lets work at once is no room for two gates. */
  const made = world({ base: "other", second: true, gate: JUDGED_GATE, project: { runs: 2 } });
  seeded({ landing: ready(made.head, made.base), next: ready(made.next, made.base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }) });
  judging([{ when: ["two"], step: "lint", says: "" }], { sleepMs: 1500 });
  const said = await landingRan([KEY, NEXT_KEY], made.work);
  const runs = judgedRuns();
  assert.deepEqual(runs.map((one) => one.present), [["one", "two"], ["one"], ["two"]], said);
  const [, low, high] = runs;
  assert.ok(low.ended <= high.started, `the halves ran at once: ${JSON.stringify(runs)}\n${said}`);
  assert.equal(landingOf(context(NEXT_UUID)).state, "head-owed", said);
});
