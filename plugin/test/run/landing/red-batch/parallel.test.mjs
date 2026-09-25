/* The two halves of a split gated at once where the project's `runs` leaves two gate places free, and
   never past it: its own file because the project record is read once per process (ISS-2480). */
import assert from "node:assert/strict";
import test from "node:test";

import {
  JUDGED_GATE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, THIRD_BRANCH, THIRD_KEY, THIRD_OWNED, THIRD_UUID,
  context, judgedRuns, judging, landingRan, ready, seeded, tracker, world,
} from "../fixture.mjs";

const { landingOf } = await import("../../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

test("with two gate places free the halves of a split are gated at once", async () => {
  const made = world({ base: "other", second: true, third: true, gate: JUDGED_GATE, project: { runs: 2 } });
  seeded({
    landing: ready(made.head, made.base),
    next: ready(made.next, made.base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }),
    last: ready(made.last, made.base, { branch: THIRD_BRANCH, files: [THIRD_OWNED] }),
  });
  judging([{ when: ["three"], step: "lint", says: "" }], { sleepMs: 1500 });
  const said = await landingRan([KEY, NEXT_KEY, THIRD_KEY], made.work);
  const [, low, high] = judgedRuns();
  assert.deepEqual([low.present, high.present].sort(), [["one", "two"], ["three"]], said);
  assert.ok(low.started < high.ended && high.started < low.ended,
    `the halves ran one after the other: ${JSON.stringify(judgedRuns())}\n${said}`);
  assert.equal(landingOf(context(THIRD_UUID)).state, "head-owed", said);
});
