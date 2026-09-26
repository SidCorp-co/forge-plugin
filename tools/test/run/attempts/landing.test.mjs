/* What a landing writes about each attempt it makes and each gate it runs: an opening per member
   before the pass, a gate record per gate with its verdict and seconds, and an ending per member —
   landed with the candidate its gate read, or back with the one cause that stopped it — read back off
   the store rather than off what the landing printed (ISS-2425). */
import assert from "node:assert/strict";
import test from "node:test";

import {
  JUDGED_GATE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, PAIRED_GATE, THIRD_BRANCH, THIRD_KEY, THIRD_OWNED, UUID,
  OWNED, forgetGateRuns, judgedRuns, judging, landingRan, ready, redTogether, seeded, serverPushes, sha, state,
  tracker, world, BASE, issue,
} from "../landing/fixture.mjs";

const { ATTEMPTS, marksOf } = await import("../../../../plugin/src/stats/marks/marks.mjs");

test.after(() => tracker.close());

const beside = (next, base) => ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] });
const behind = (last, base, files = [THIRD_OWNED]) => ready(last, base, { branch: THIRD_BRANCH, files });

/* The records this landing wrote: every earlier case's are before `from`. */
const recorded = async (keys, work) => {
  const from = marksOf(ATTEMPTS).length;
  const said = await landingRan(keys, work);
  const records = marksOf(ATTEMPTS).slice(from);
  const of = (phase) => records.filter((one) => one.phase === phase);
  const endings = (key) => of("ended").filter((one) => one.issue === key);
  return { said, records, opened: of("opened"), gates: of("gate"), endings, ended: (key) => endings(key).at(-1) };
};

test("a branch the gate refuses alone ends its attempt with cause branch, after an opening and a red gate record", async () => {
  const { work, head, base } = world({ base: "other", gate: JUDGED_GATE });
  seeded({ landing: ready(head, base) });
  judging([{ when: ["one"], step: "test", cases: [{ file: "plugin/test/one.test.mjs", name: "a case" }] }]);
  const { said, records, opened, gates, ended } = await recorded([KEY], work);
  assert.deepEqual(records.map((one) => one.phase), ["opened", "gate", "ended"], said);
  assert.equal(opened[0].issue, KEY, said);
  assert.ok(Date.parse(opened[0].at) <= judgedRuns()[0].started, `opened before the gate ran:\n${said}`);
  assert.equal(gates[0].verdict, "red", said);
  assert.deepEqual(gates[0].members, [KEY], said);
  assert.ok(gates[0].seconds >= 3, `the seconds the gate's own record holds:\n${JSON.stringify(gates[0])}`);
  assert.deepEqual([ended(KEY).outcome, ended(KEY).cause], ["back", "branch"], said);
});

test("ISS-2425 1, 2, 14. a branch the gate passes is opened, gated green with its seconds and ended landed on the candidate its gate read", async () => {
  const { work, head, base } = world({ base: "other", gate: JUDGED_GATE });
  seeded({ landing: ready(head, base) });
  judging([]);
  const { said, records, gates, ended } = await recorded([KEY], work);
  assert.deepEqual(records.map((one) => one.phase), ["opened", "gate", "ended"], said);
  assert.deepEqual([gates[0].verdict, gates[0].candidate.length], ["green", 40], said);
  assert.ok(gates[0].seconds >= 3, JSON.stringify(gates[0]));
  assert.deepEqual([ended(KEY).outcome, ended(KEY).cause, ended(KEY).candidate], ["landed", null, gates[0].candidate], said);
});

const DUP_SAYS = "1.00  src/one.mjs\n        a sentence stated twice\n      src/untouched.mjs\n        a sentence stated twice";

test("ISS-2425 3. a member the search names alone ends with cause branch, and the siblings that go on without it end landed", async () => {
  const { work, head, next, last, base } = world({ base: "other", second: true, third: true, gate: JUDGED_GATE });
  seeded({ landing: ready(head, base), next: beside(next, base), last: behind(last, base) });
  judging([{ when: ["one"], step: "check:dup", says: DUP_SAYS }]);
  const { said, opened, gates, ended } = await recorded([KEY, NEXT_KEY, THIRD_KEY], work);
  assert.deepEqual(opened.map((one) => one.issue), [KEY, NEXT_KEY, THIRD_KEY], said);
  assert.deepEqual([ended(KEY).outcome, ended(KEY).cause], ["back", "branch"], said);
  for (const key of [NEXT_KEY, THIRD_KEY]) assert.equal(ended(key).outcome, "landed", said);
  assert.deepEqual(gates.map((one) => one.verdict), ["red", "green"], said);
  assert.equal(ended(NEXT_KEY).candidate, gates[1].candidate, `landed on the tree the green gate read:\n${said}`);
});

test("ISS-2425 4. a combination red together and green apart ends both attempts with cause combination", async () => {
  const { work, head, next, base } = world({ base: "other", second: true, gate: PAIRED_GATE });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  forgetGateRuns();
  redTogether();
  const { said, gates, ended } = await recorded([KEY, NEXT_KEY], work);
  for (const key of [KEY, NEXT_KEY]) assert.deepEqual([ended(key).outcome, ended(key).cause], ["back", "combination"], said);
  assert.deepEqual(gates.map((one) => [one.verdict, one.seconds]), [["red", null], ["green", null], ["green", null]],
    "a gate that wrote no record of its own has its verdict off its exit and no seconds");
});

test("ISS-2425 3. a member that conflicts with the pin ends with cause branch while the one beside it lands", async () => {
  const { work, head, next, base } = world({ base: "conflict", second: true });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  const { said, ended } = await recorded([KEY, NEXT_KEY], work);
  assert.deepEqual([ended(KEY).outcome, ended(KEY).cause], ["back", "branch"], said);
  assert.equal(ended(NEXT_KEY).outcome, "landed", said);
});

test("ISS-2425 5, 7. a member writing a sibling's paths leaves the set for cause combination, and alone meets the moved base", async () => {
  const { work, head, last, base } = world({ base: "other", shared: true });
  seeded({ landing: ready(head, base), last: behind(last, base, [OWNED]) });
  const { said, endings, ended } = await recorded([KEY, THIRD_KEY], work);
  assert.equal(ended(KEY).outcome, "landed", said);
  assert.deepEqual(endings(THIRD_KEY).map((one) => [one.outcome, one.cause]), [["back", "combination"], ["back", "moved-base"]],
    `left the set, then was handed back at builder-owed on its own:\n${said}`);
});

test("ISS-2425 7. a member the base moved is handed back at builder-owed for cause moved-base", async () => {
  const { work, head, next, base } = world({ base: "moved", second: true });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  const { said, ended } = await recorded([KEY, NEXT_KEY], work);
  assert.deepEqual([ended(KEY).outcome, ended(KEY).cause], ["back", "moved-base"], said);
  assert.equal(ended(NEXT_KEY).outcome, "landed", said);
});

test("ISS-2425 8. a push the base moved under ends that attempt for cause moved-base, and the rebuild is a second attempt that lands", async () => {
  const { at, work, head, base } = world({ base: "other" });
  const pinned = sha(work, BASE);
  seeded({ landing: ready(head, base, { state: "promoting", pinned, candidate: head, reconciled: head, intended: head, release: "1.0.1" }) });
  serverPushes(at, "1.0.5");
  const { said, opened, endings } = await recorded([KEY], work);
  assert.equal(opened.length, 2, said);
  assert.deepEqual(endings(KEY).map((one) => [one.outcome, one.cause]), [["back", "moved-base"], ["landed", null]], said);
});

test("ISS-2425 9. a declined gate place ends the attempt for cause declined, and its gate record holds no seconds", async () => {
  const { work, head, base } = world({ base: "other", gate: JUDGED_GATE });
  seeded({ landing: ready(head, base) });
  judging([{ when: ["one"], status: 75 }]);
  const { said, gates, ended } = await recorded([KEY], work);
  assert.deepEqual([ended(KEY).outcome, ended(KEY).cause], ["back", "declined"], said);
  assert.deepEqual([gates[0].verdict, gates[0].seconds], ["declined", null], said);
});

test("ISS-2425 10. a tracker refusal ends every attempt of the set for cause tracker", async () => {
  const { work, head, next, base } = world({ base: "other", second: true });
  seeded({ landing: ready(head, base), next: beside(next, base) });
  const kept = state.answer.forge_issues;
  state.answer.forge_issues = (args) => (args.action === "update" && args.documentId === UUID
    && args.data?.sessionContext?.landing?.state === "reconciled"
    ? { refused: "the tracker refused that reconciliation" }
    : kept(args));
  try {
    const { said, ended } = await recorded([KEY, NEXT_KEY], work);
    for (const key of [KEY, NEXT_KEY]) assert.deepEqual([ended(key).outcome, ended(key).cause], ["back", "tracker"], said);
  } finally {
    state.answer.forge_issues = kept;
  }
});

test("ISS-2425 12. a pass stopped for a reason outside the closed set ends its attempt handed back with no cause", async () => {
  const { work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base, { branch: "" }) });
  const { said, ended } = await recorded([KEY], work);
  assert.match(said, /names no branch/u, said);
  assert.deepEqual([ended(KEY).outcome, ended(KEY).cause], ["back", null], said);
});

test("ISS-2425 13. a pass resumed past a push that landed opens no second attempt", async () => {
  const { work, head, base } = world({ base: "other", gate: JUDGED_GATE });
  seeded({ landing: ready(head, base) });
  judging([]);
  const first = await recorded([KEY], work);
  assert.equal(first.ended(KEY).outcome, "landed", first.said);
  const { landing } = issue().sessionContext;
  issue().sessionContext = { ...issue().sessionContext, landing: { ...landing, state: "installed" }, lease: undefined };
  const again = await recorded([KEY], work);
  assert.deepEqual(again.opened, [], `the resume lands nothing a second time:\n${again.said}`);
});

test("ISS-2425 2, 13. a push the base took counts as landed though the save after it is refused, and its resume opens no second attempt", async () => {
  const { work, head, base } = world({ base: "other", gate: JUDGED_GATE });
  seeded({ landing: ready(head, base) });
  judging([]);
  const kept = state.answer.forge_issues;
  state.answer.forge_issues = (args) => (args.action === "update" && args.data?.sessionContext?.landing?.state === "promoted"
    ? { refused: "the tracker refused that save" }
    : kept(args));
  let first;
  try {
    first = await recorded([KEY], work);
  } finally {
    state.answer.forge_issues = kept;
  }
  assert.match(first.said, /the tracker refused that save/u, first.said);
  assert.deepEqual([first.ended(KEY).outcome, first.ended(KEY).candidate], ["landed", first.gates[0].candidate], first.said);
  const again = await recorded([KEY], work);
  assert.deepEqual(again.opened, [], `the resume at the push lands nothing a second time:\n${again.said}`);
});
