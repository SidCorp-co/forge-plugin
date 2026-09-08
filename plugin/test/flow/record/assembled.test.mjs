/* What a report is assembled out of, which is `page.mjs`'s `assemble` and not the verb beside it:
   the latest of each kind that can only be current, every one of a kind that repeats, the latest
   verdict per criterion, and what no verdict names. Split off record.test.mjs by ISS-11. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("assembled-");
const { assemble, render } = await import("../../../src/flow/record/page.mjs");
const { SHAPES, heldSaid } = await import("../../../src/flow/machine.mjs");

test("the report keeps the latest of each kind, the latest verdict per criterion, and names what is owed", () => {
  const at = (n) => `2026-09-02T10:0${n}:00.000Z`;
  const verdict = (n, verdict, when) => ({
    createdAt: at(when),
    body: render("verdict", { criterion: `${n} — text`, verdict, commit: "abc1234", evidence: ["run.txt"] }),
  });
  const comments = [
    { createdAt: at(1), body: render("confirmation", { where: ["x"], is: "old", finding: "holds" }) },
    { createdAt: at(3), body: render("confirmation", { where: ["x"], is: "new", finding: "holds" }) },
    verdict(1, "fail", 2),
    verdict(1, "pass", 4),
    verdict(2, "pass", 5),
    { createdAt: at(6), body: "just a comment" },
  ];
  const criteria = [{ number: 1, text: "a" }, { number: 2, text: "b" }, { number: 3, text: "c" }];
  const { latest, verdicts, owed } = assemble(comments, criteria);
  assert.equal(latest.confirmation.record.fields.is, "new");
  assert.equal(verdicts.get(1).record.fields.verdict, "pass", "the later verdict replaces");
  assert.deepEqual(owed, [3]);
});

/* The latest of a kind is right for a kind that can only be current, and wrong for one that
   repeats: four corrections were written and one was reported in the fourth dry run. */
test("every finding and every triage is on the report, not the latest of each", () => {
  const at = (n) => `2026-09-03T05:0${n}:00.000Z`;
  const found = (seen, when) => ({
    createdAt: at(when),
    body: render("finding", { expected: "sorted by name", seen, evidence: ["run.txt"], quoted: "cannot find it" }),
  });
  const ruled = (outcome, when) => ({
    createdAt: at(when),
    body: render("triage", { outcome, "would-have-caught": "a criterion naming the order" }),
  });
  const { latest, repeated } = assemble([found("sorted by id", 1), ruled("not-met", 2), found("still by id", 3), ruled("wrong-test", 4)], []);
  assert.deepEqual(repeated.finding.map((one) => one.record.fields.seen), ["sorted by id", "still by id"]);
  assert.deepEqual(repeated.triage.map((one) => one.record.fields.outcome), ["not-met", "wrong-test"]);
  assert.equal(latest.finding.record.fields.seen, "still by id", "and the latest of each is still there, for the brief");
  assert.equal(repeated.confirmation, undefined, "a kind that can only be current keeps no list");
  for (const kind of Object.keys(SHAPES)) {
    const repeats = ["correction", "finding", "gap", "park", "question", "routed", "triage"];
    assert.equal(Boolean(SHAPES[kind].repeats), repeats.includes(kind), `${kind} repeats or it does not`);
  }
});

/* ISS-673's QA judged two criteria against text four earlier corrections had moved, because the
   report showed the fifth alone: a retraction that hides the one before it defeats the kind. */
test("every correction, park and question is kept and counted, and a kind that can only be current keeps its latest", () => {
  const at = (n) => `2026-09-09T05:0${n}:00.000Z`;
  const said = (kind, fields, when) => ({ createdAt: at(when), body: render(kind, fields) });
  const { latest, repeated } = assemble([
    said("correction", { moved: "criterion 9", why: "it named the wrong file" }, 1),
    said("park", { kind: "paused", why: "the wave stopped", evidence: [] }, 2),
    said("baseline", { gate: "npm run check", result: "green", commit: "6c5b128", scope: "whole" }, 3),
    said("question", { reading: ["the flag", "the report"], to: "the author" }, 4),
    said("correction", { moved: "criterion 20", why: "it read as two outcomes" }, 5),
    said("question", { reading: ["one line", "one record"], to: "the author" }, 6),
    said("park", { kind: "crashed", why: "the shell died", evidence: [] }, 7),
    said("baseline", { gate: "npm run check -- --full", result: "green", commit: "a862409", scope: "whole" }, 8),
  ], []);
  const kept = (kind, field) => (repeated[kind] ?? []).map((one) => one.record.fields[field]);
  assert.deepEqual(kept("correction", "moved"), ["criterion 9", "criterion 20"], "oldest first");
  assert.deepEqual(kept("question", "to"), ["the author", "the author"]);
  assert.deepEqual(kept("park", "kind"), ["paused", "crashed"]);
  assert.equal(latest.park.record.fields.kind, "crashed", "and advance still reads the newest park, which is what it read before");
  assert.equal(latest.correction.record.fields.moved, "criterion 20", "as the brief's headline still reads the newest correction");
  assert.equal(repeated.baseline, undefined, "a kind a later one supersedes keeps no list");
  assert.equal(latest.baseline.record.fields.commit, "a862409", "and is read back as the later of the two");
  assert.equal(heldSaid("correction", repeated.correction.length), "2 Correction records", "the count above the records");
  assert.equal(heldSaid("gap", 1), null, "and nothing above a kind holding one, where the count is the line itself");
});
