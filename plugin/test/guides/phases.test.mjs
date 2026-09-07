import assert from "node:assert/strict";
import test from "node:test";

import { CITED, dischargedBy, indexLines, phaseIndex, phaseNumber } from "../../src/guides/phases.mjs";
import { CHECKS, ORDER, PHASE, viewFrom } from "../../src/flow/earned.mjs";

const sized = (band) => ({ description: "a defect", plan: null, moved: [], whole: true, band });

/* The index invents nothing: every phase, citation and waiver is another table's row. */
test("every citation names the record the check into the next status refuses without", () => {
  /* Derived: a terminal check is `() => []`, so a new status sorts itself into one of the sets. */
  const terminal = Object.keys(CHECKS).filter((status) => CHECKS[status].length === 0);
  assert.deepEqual(terminal, ["closed", "dropped"], "the two ends of the ladder ask no payload");
  for (const status of Object.keys(CHECKS).filter((one) => !terminal.includes(one))) {
    assert.ok(CITED[status], `${status} has an entry check and no record named for it, so the phase `
      + "below it would print as discharged by nothing");
  }
  /* The value, not the presence: three were wrong and a presence check passed all three. */
  for (const [status, kind] of Object.entries(CITED)) {
    const issue = { status, acceptanceCriteria: "1. The outcome.", plan: "Screen change: no. Schema coupling: no." };
    const said = JSON.stringify(CHECKS[status](viewFrom("the-uuid", issue, []), "ISS-1"));
    assert.match(said, new RegExp(`\\b${kind}\\b`, "u"),
      `${status} is cited as discharged by a ${kind} and its check asks for no such thing: ${said}`);
  }
});

/* The shift, and the bug: citing its own status names the evidence for the step before. */
test("a phase cites the record that carried it, not the one that reached its own status", () => {
  assert.equal(dischargedBy("open"), "confirmation", "Phase 1 is triage, and a confirmation ends it");
  assert.equal(dischargedBy("clarified"), "plan", "Phase 3 is planning, discharged by the plan");
  assert.equal(dischargedBy("in_progress"), "review", "and the review is what carries implementation");
  assert.equal(dischargedBy("closed"), null, "the last rung has none above it to answer to");
});

test("a status the flow table gives no numbered phase is not listed as owing one", () => {
  assert.ok(Number.isNaN(phaseNumber("closed")), "closed owes `none`, which is no phase number");
  assert.deepEqual(phaseIndex({ status: "closed", size: sized("s") }).owed, [],
    "so a closed issue owes no phase and the index says so by listing none");
});

test("the first phase owed at approved is Phase 4, and the phases before it are on the record", () => {
  const { first, passed } = phaseIndex({ status: "approved", size: sized("m") });
  assert.match(first, /^4 /u, "an approved issue implements next, and the index opens on that");
  assert.deepEqual(passed.map((one) => [one.phase, one.cites]), [
    ["1 Triage", "confirmation"],
    ["2 Clarify", "decision"],
    ["3 Plan", "plan"],
  ], "each passed phase names the record that ended it, so a run reads it instead of redoing it");
});

/* A waiver is on a transition: dropping the plan is not dropping the implementing, and an index
   reading it as the latter tells a fix-tier run its work is done. */
test("a tier's waiver is printed against the phase that pays it, and waives no phase", () => {
  const owed = (band) => phaseIndex({ status: "clarified", size: sized(band) }).owed;
  const waived = owed("s").filter((one) => one.waived);
  assert.deepEqual(waived.map((one) => one.phase), ["3 Plan", "6, 7 Ship"],
    "the plan is waived on the way into approved, the note on the way into released");
  assert.ok(owed("s").every((one) => PHASE[one.status]),
    "and every phase is still owed: a waiver drops a record, never the work");
  assert.match(waived[0].waived.drops, /the plan field/u, "named by what it drops");
  assert.match(waived[0].waived.because, /a fix's criteria are the one check that fails without it/u,
    "and by the ladder's own words for why, so the cut cannot say what the ladder does not");
  assert.deepEqual(owed("m").filter((one) => one.waived), [],
    "where a feature is waived nothing and is shown no waiver at all");
});

test("the lines say a phase is owed without a record, never that the phase is dropped", () => {
  const lines = indexLines("issue-flow", "ISS-9",
    phaseIndex({ status: "clarified", size: sized("s") }));
  assert.equal(lines.filter((one) => one.startsWith("dropped")).length, 0,
    "no line calls a phase dropped, which is what told a fix its implementing was waived");
  assert.match(lines.find((one) => one.startsWith("owed") && one.includes("3 Plan")),
    /^owed\s+3 Plan\s+—\s+without the plan field/u, "the waiver rides the phase that pays it");
  assert.match(lines[0], /^issue-flow for ISS-9 — phase owed: 3 /u);
  assert.match(lines.at(-1), /forge guide issue-flow <phase>/u, "a reader is left with the next call");
});

/* `ORDER` is the path, not the table: a status beside it read as completion owes work silently. */
test("a status off the linear path owes its own phase and is not read as finished", () => {
  const index = phaseIndex({ status: "reopen", size: sized("s") });
  assert.match(index.first, /^1 Triage/u, "a reopen owes the triage of the person's finding");
  assert.equal(index.aside, "reopen", "and says it is off the path rather than implying a rung");
  assert.deepEqual(index.passed, [], "nothing is claimed passed on a path this status is not on");
  assert.deepEqual(index.owed.map((one) => one.waived), [null],
    "no tier waiver is read against a status the ladder's rows do not speak to");
  assert.match(indexLines("issue-flow", "ISS-9", index)[0], /off the ladder's linear path/u);
});

/* The seam: this holds the two tables' overlap to exactly what the case above covers. */
test("every status the flow table gives a phase is on the order or named as beside it", () => {
  const off = Object.keys(PHASE).filter((status) => Number.isFinite(phaseNumber(status)) && !ORDER.includes(status));
  assert.deepEqual(off, ["reopen"], "reopen alone sits outside the order, being a bounce not a rung");
  for (const status of off) {
    assert.equal(phaseIndex({ status, size: sized("s") }).aside, status, `${status} reads as finished`);
  }
});
