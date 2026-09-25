/* A project whose `redBatch` is `one-by-one` keeps the landing this repository had before ISS-2480: a
   red set is searched for nothing, every reading at it is void, and each branch lands alone against
   the base as it moves. Its own file because the project record is read once per process. */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  BASE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, PAIRED_GATE, context, forgetGateRuns,
  gateRuns, git, landingRan, marks, ready, redTogether, seeded, sha, tracker, world,
} from "./fixture.mjs";

const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

const landing = (documentId) => landingOf(context(documentId));
const holds = (work, rev, head) => git(work, "merge-base", "--is-ancestor", head, rev).status === 0;
const ONE_BY_ONE = { redBatch: "one-by-one" };

test("with redBatch one-by-one a combination the gate refuses lands one branch and refuses the other against the new base", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true, gate: PAIRED_GATE, project: ONE_BY_ONE });
  seeded({ landing: ready(head, base), next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }) });
  forgetGateRuns();
  redTogether();
  const said = await landingRan([KEY, NEXT_KEY], work);
  assert.match(said, /3 gate run\(s\) at most: one for the candidate, and one for each branch/u, said);
  assert.match(said, /this project's `redBatch` is `one-by-one` rather than `attribute-then-split`, so no subset is searched for/u, said);
  assert.deepEqual(gateRuns(), ["red", "green", "red"], `one for the candidate and one per branch:\n${said}`);
  const landed = sha(join(at, "origin.git"), `refs/heads/${BASE}`);
  assert.ok(holds(work, landed, head) && !holds(work, landed, next), said);
  assert.equal(landing(NEXT_UUID).pinned, landed, `the second was gated against the new base:\n${said}`);
  assert.equal(landing(NEXT_UUID).state, "head-owed", said);
  assert.equal(marks(NEXT_UUID).length, 0, said);
  assert.doesNotMatch(said, /red batch:/u, said);
});
