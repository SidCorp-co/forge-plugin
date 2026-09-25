/* What a landing writes about each red set it meets: an opening record before the search spends a
   gate, and a resolution record saying how the set was resolved and what it spent, read back off the
   store rather than off what the landing printed (ISS-2490). */
import assert from "node:assert/strict";
import test from "node:test";

import {
  JUDGED_GATE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, THIRD_BRANCH, THIRD_KEY, THIRD_OWNED, judgedRuns, judging,
  landingRan, ready, seeded, tracker, world,
} from "../fixture.mjs";

const { BATCHES, marksOf } = await import("../../../../../plugin/src/stats/marks/marks.mjs");
const { resolutionOf } = await import("../../../../run/land-ready/gate.mjs");

test.after(() => tracker.close());

const three = () => {
  const made = world({ base: "other", second: true, third: true, gate: JUDGED_GATE });
  seeded({
    landing: ready(made.head, made.base),
    next: ready(made.next, made.base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }),
    last: ready(made.last, made.base, { branch: THIRD_BRANCH, files: [THIRD_OWNED] }),
  });
  return made;
};

/* The records this landing wrote, and the one set they make: every earlier test's are before `from`. */
const recorded = async (work) => {
  const from = marksOf(BATCHES).length;
  const said = await landingRan([KEY, NEXT_KEY, THIRD_KEY], work);
  const records = marksOf(BATCHES).slice(from);
  return { said, records, opened: records.find((one) => one.phase === "opened"),
    resolved: records.find((one) => one.phase === "resolved") };
};

const DUP_SAYS = "1.00  src/one.mjs\n        a sentence stated twice\n      src/untouched.mjs\n        a sentence stated twice";

test("a red set attributed by paths is opened before its search and resolved with the member handed back and the gates spent", async () => {
  const { work } = three();
  judging([{ when: ["one"], step: "check:dup", says: DUP_SAYS }]);
  const { said, records, opened, resolved } = await recorded(work);
  assert.deepEqual(records.map((one) => one.phase), ["opened", "resolved"], said);
  assert.equal(opened.strategy, "attribute-then-split", said);
  assert.deepEqual(opened.members, [KEY, NEXT_KEY, THIRD_KEY], said);
  assert.ok(Date.parse(opened.at) <= judgedRuns()[1].started, `opened before the search's first gate:\n${said}`);
  assert.equal(resolved.batch, opened.batch, said);
  assert.equal(resolved.outcome, "attributed", said);
  assert.deepEqual(resolved.back, [KEY], said);
  assert.deepEqual(resolved.alone, [], said);
  assert.equal(resolved.rounds, 0, said);
  assert.equal(resolved.gates, 2, said);
});

test("a red set the search halves is resolved as split with its rounds and the gates it spent", async () => {
  const { work } = three();
  const file = "plugin/test/pages.test.mjs";
  judging([{ when: ["three"], step: "test", cases: [{ file, name: "a case" }], reads: { [file]: null } }]);
  const { said, resolved } = await recorded(work);
  assert.equal(resolved.outcome, "split", said);
  assert.equal(resolved.rounds, 1, said);
  assert.equal(resolved.gates, 3, said);
  assert.deepEqual(resolved.back, [THIRD_KEY], said);
});

test("a search a declined gate place stopped is resolved as unread with the gates it spent", async () => {
  const { work } = three();
  judging([
    { when: ["one"], step: "check:dup", says: DUP_SAYS },
    { when: ["two", "three"], exact: true, status: 75 },
  ]);
  const { said, resolved } = await recorded(work);
  assert.equal(resolved.outcome, "unread", said);
  assert.equal(resolved.gates, 2, said);
});

const MEMBERS = [{ key: "ISS-1" }, { key: "ISS-2" }, { key: "ISS-3" }];

test("a search whose subset does not merge names every member as landed alone", () => {
  assert.deepEqual(resolutionOf({ unbuildable: "ISS-2 ISS-3", gates: 3 }, MEMBERS, false),
    { outcome: "one-by-one", gates: 3, alone: ["ISS-1", "ISS-2", "ISS-3"] });
});

test("a search whose members left move a path names every member as landed alone and none as handed back", () => {
  const found = { green: MEMBERS.slice(1), back: [{ members: [MEMBERS[0]] }], gates: 2, rounds: 0 };
  assert.deepEqual(resolutionOf(found, MEMBERS, true),
    { outcome: "attributed", gates: 2, rounds: 0, alone: ["ISS-1", "ISS-2", "ISS-3"] });
  assert.deepEqual(resolutionOf(found, MEMBERS, false), { outcome: "attributed", gates: 2, rounds: 0, back: ["ISS-1"] });
});
