/* The review is the one record two voices write, and the one whose identifiers come from
   somewhere else: the reviewer numbers them, a consult scopes them, and the author disposes of
   them. Its own file because record.test.mjs reached its line limit on it. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("review-");
const { parse, render } = await import("../../../src/flow/record/page.mjs");
const { OUTCOMES, SHAPES } = await import("../../../src/flow/machine.mjs");
const { eachProblem } = await import("../../../src/flow/record/content.mjs");

/* The field's own rule, reached the way both the write and the read-back reach it. */
const judged = (values) => eachProblem(SHAPES.review.fields.find((one) => one.flag === "finding"), values);

test("a review names its reviewer, head and outcome, and each finding is an id with a verdict", () => {
  const body = render("review", { reviewer: "codex", commit: "ea7967f", outcome: "approved", finding: ["F1 accepted", "F2 rejected: a re-record reviews nothing new"] });
  assert.match(body, /^commit: ea7967f$/mu);
  assert.match(body, /^finding: F1 accepted\nfinding: F2 rejected: a re-record reviews nothing new$/mu);
  assert.equal(parse(body).kind, "review");
  assert.deepEqual(OUTCOMES, ["approved", "changes-requested"]);
  assert.equal(judged(["F1 accepted"]), null);
  assert.match(judged(["looks fine"]) ?? "", /takes `F1 accepted`/u);
  assert.match(judged(["F2 rejected"]) ?? "", /a reason after a rejected finding/u);
  assert.match(judged(["1 accepted"]) ?? "", /takes `F1 accepted`/u, "a bare number is a count, not an identifier");
});

/* Writing the review for ISS-1106 dropped nine findings of ten: five reads had each numbered from
   F1, and the record could hold one of them (ISS-1128). Three reads over one change is what the
   method asks for, so the collision is what following it produces. */
test("two reads' F1s are two rows of a review, and an accepted one says what changed", () => {
  const finding = [
    "8c1a15 F1 accepted: the criteria name the case's assertion, not its name",
    "b07591 F1 rejected: the clause it doubts is the one the case establishes",
    "G3 accepted",
  ];
  assert.equal(judged(finding), null);
  const body = render("review", { reviewer: "codex", commit: "ea7967f", outcome: "approved", finding });
  assert.deepEqual(parse(body).fields.finding, finding, "each row reads back as it was written");

  assert.equal(judged(["F1 accepted: what changed"]), null, "an acceptance carries its words");
  assert.match(judged(["G3 rejected"]) ?? "", /a reason after a rejected finding: `G3 rejected: why`/u,
    "and a rejection owes its own whatever the reviewer numbered it");
  assert.match(judged(["8c1a15 F1 maybe"]) ?? "", /8c1a15 F1 accepted: what changed/u,
    "the refusal names the qualified form rather than only the bare one");
  assert.match(judged(["1 accepted"]) ?? "", /takes `F1 accepted`/u,
    "and a number carrying no series is no identifier, whoever is numbering");
});
