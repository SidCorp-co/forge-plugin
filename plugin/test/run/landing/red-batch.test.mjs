/* A set whose combined candidate the gate refuses, searched rather than landed one member at a time:
   the member the failing cases' paths name alone goes back and the rest land after one more gate, a
   set nothing names is halved, the members left land as one candidate on a tree a gate already read,
   and a gate place declined anywhere in it moves no checkpoint (ISS-2480). Each outcome is read off
   the checkpoints, the remote and the gates the fake one says it ran, never off the output alone. */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  BASE, JUDGED_GATE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, THIRD_BRANCH, THIRD_KEY,
  THIRD_OWNED, THIRD_UUID, context, git, judgedRuns, judging, landingRan, marks, ready, seeded, sha,
  tracker, world,
} from "./fixture.mjs";

const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

const landing = (documentId) => landingOf(context(documentId));
const remote = (at) => sha(join(at, "origin.git"), `refs/heads/${BASE}`);
const holds = (work, rev, head) => git(work, "merge-base", "--is-ancestor", head, rev).status === 0;

/** Three ready branches over three files, gated by the fake that says why it is red. */
const three = () => {
  const made = world({ base: "other", second: true, third: true, gate: JUDGED_GATE });
  seeded({
    landing: ready(made.head, made.base),
    next: ready(made.next, made.base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }),
    last: ready(made.last, made.base, { branch: THIRD_BRANCH, files: [THIRD_OWNED] }),
  });
  return made;
};

const gated = () => judgedRuns().map((one) => `${one.red ? "red" : "green"} ${one.present.join(",")}`);

const DUP_SAYS = "1.00  src/one.mjs\n        a sentence stated twice\n      src/untouched.mjs\n        a sentence stated twice";

test("a red set whose failing step names one member's path alone hands that member back and lands the rest after one gate", async () => {
  const { at, work, head, next, last } = three();
  judging([{ when: ["one"], step: "check:dup", says: DUP_SAYS }]);
  const said = await landingRan([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.deepEqual(gated(), ["red one,two,three", "green two,three"],
    `one gate for the set and one over the two left, none to find the member:\n${said}`);
  assert.equal(landing().state, "head-owed", said);
  assert.match(said, new RegExp(`${KEY} goes back to the run that built it: the step check:dup failed on `
    + "what it printed, naming src/one.mjs, src/untouched.mjs, and of this set only this change's own paths "
    + "are in the paths it printed", "u"), said);
  const landed = remote(at);
  assert.ok(holds(work, landed, next) && holds(work, landed, last), `the two left landed:\n${said}`);
  assert.ok(!holds(work, landed, head), `and the one handed back did not:\n${said}`);
  assert.equal(landing(NEXT_UUID).release, landing(THIRD_UUID).release, `as one release:\n${said}`);
  assert.equal(landing(NEXT_UUID).candidate, landing(THIRD_UUID).candidate, `on one candidate:\n${said}`);
  assert.equal(marks().length, 0, said);
  assert.match(said, /red batch: attributed by paths, 2 gate\(s\) spent, the candidate's among them/u, said);
});

test("a failing test case falls to the member whose path its file read in the red run", async () => {
  const { at, work, head, next, last } = three();
  const file = "plugin/test/pages.test.mjs";
  judging([{
    when: ["three"], step: "test", cases: [{ file, name: "a page reads within its ceiling" }],
    reads: { [file]: { paths: [file, THIRD_OWNED, "plugin/src/untouched.mjs"], dirs: [], trees: [], whole: [] } },
  }]);
  const said = await landingRan([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.deepEqual(gated(), ["red one,two,three", "green one,two"], said);
  assert.equal(landing(THIRD_UUID).state, "head-owed", said);
  assert.match(said, new RegExp(`${THIRD_KEY} goes back .*${file} {2}a page reads within its ceiling, and of this `
    + "set only this change's own paths are in what its file read in that run", "u"), said);
  const landed = remote(at);
  assert.ok(holds(work, landed, head) && holds(work, landed, next) && !holds(work, landed, last), said);
});

test("a case with no finished read record is attributed to nobody and the set is halved, the members left landing on the half already read", async () => {
  const { at, work, head, next, last } = three();
  const file = "plugin/test/pages.test.mjs";
  judging([{ when: ["three"], step: "test", cases: [{ file, name: "a case" }], reads: { [file]: null } }],
    { sleepMs: 300 });
  const said = await landingRan([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.deepEqual(gated(), ["red one,two,three", "green one,two", "red three"],
    `the halves, and no gate over the two left since their half was that tree:\n${said}`);
  assert.equal(landing(THIRD_UUID).state, "head-owed", said);
  assert.match(said, new RegExp(`${THIRD_KEY} goes back to the run that built it: gated alone as a candidate on `
    + "[0-9a-f]{7}, it is red at the step test", "u"), said);
  const landed = remote(at);
  assert.ok(holds(work, landed, head) && holds(work, landed, next) && !holds(work, landed, last), said);
  assert.match(said, /red batch: split, 1 round\(s\), 3 gate\(s\) spent/u, said);
  /* No `runs` declared here, so the two halves went one after the other. */
  const [, low, high] = judgedRuns();
  assert.ok(low.ended <= high.started, `the halves overlapped: ${JSON.stringify(judgedRuns())}`);
});

test("every candidate the search gates stands on the one pin the landing took", async () => {
  const { at, work } = three();
  const pinned = sha(work, BASE);
  judging([{ when: ["three"], step: "lint", says: "nothing a path names" }]);
  const said = await landingRan([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.equal([...said.matchAll(/is pinned at/gu)].length, 1, `one pin:\n${said}`);
  for (const one of [undefined, NEXT_UUID]) assert.equal(landing(one).pinned, pinned, said);
  assert.equal(judgedRuns().length, 3, said);
  for (const one of judgedRuns()) {
    assert.ok(one.below.includes(pinned), `the candidate over ${one.present} stands on the pin:\n${said}`);
  }
  assert.ok(holds(work, remote(at), pinned), `and so does what landed:\n${said}`);
});

test("a gate place declined over the members left after an attribution moves no checkpoint", async () => {
  const { at, work } = three();
  const before = remote(at);
  judging([
    { when: ["one"], step: "check:dup", says: DUP_SAYS },
    { when: ["two", "three"], exact: true, status: 75 },
  ]);
  const said = await landingRan([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.deepEqual(gated(), ["red one,two,three", "red two,three"], said);
  for (const one of [undefined, NEXT_UUID, THIRD_UUID]) {
    assert.equal(landing(one).state, "reconciled", `each checkpoint is still the landing's turn:\n${said}`);
  }
  assert.match(said, /none freed, so it ran no step: no branch of .* was judged and nothing was handed back/u, said);
  assert.doesNotMatch(said, /goes back to the run that built it/u, said);
  assert.equal(remote(at), before, said);
});

test("a gate place declined at a half after the other half came back red moves no checkpoint", async () => {
  const { work } = three();
  judging([
    { when: ["three"], exact: true, status: 75 },
    { when: ["one", "two"], step: "lint", says: "" },
  ]);
  const said = await landingRan([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.deepEqual(gated(), ["red one,two,three", "red one,two", "red three"], said);
  for (const one of [undefined, NEXT_UUID, THIRD_UUID]) assert.equal(landing(one).state, "reconciled", said);
  assert.doesNotMatch(said, /goes back to the run that built it/u, said);
});

test("the members left are gated once more where no gate of the search read their tree", async () => {
  const { at, work, head, next, last } = three();
  judging([{ when: ["one"], step: "check:dup", says: "1.00  src/one.mjs\n      two.md" }]);
  const said = await landingRan([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.deepEqual(gated(), ["red one,two,three", "red one", "green two", "green two,three"],
    `the two suspects halved, the cleared one read as green, and one gate over the two left:\n${said}`);
  assert.equal(landing().state, "head-owed", said);
  const landed = remote(at);
  assert.ok(!holds(work, landed, head) && holds(work, landed, next) && holds(work, landed, last), said);
  assert.match(said, /red batch: split, 1 round\(s\), 4 gate\(s\) spent/u, said);
});
