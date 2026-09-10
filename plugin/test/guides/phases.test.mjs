import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CITED, PHASE, READ_OFF_THE_RECORD, dischargedBy, indexLines, laneLines, openingLines, phaseIndex,
  phaseNumber,
} from "../../src/guides/phases.mjs";
import { CHECKS, ORDER, viewFrom } from "../../src/flow/earned.mjs";
import { LIGHTER } from "../../src/ladder.mjs";
import { KINDS } from "../../src/flow/record/record-rows.mjs";
import { kindsHeld } from "../../src/flow/record/page.mjs";

const fieldsOf = (complexity, moved = []) =>
  ({ description: "a defect", plan: null, moved, whole: true, complexity });

/** Every kind an entry check cites, for a page that holds the whole record set. */
const EVERY_KIND = Object.values(CITED).flat();

const PLAN = "Screen change: no. Schema coupling: no.";

/** What a status's entry check asks of a record holding nothing but the complexity and the two readings
 *  the criteria field decides between, so a case asks the check rather than a table about it. */
const asked = (status, complexity = null) => [{ acceptanceCriteria: "1. The outcome." }, {}]
  .map((held) => CHECKS[status](
    viewFrom("the-uuid", { status, plan: PLAN, complexity, ...held }, []), "ISS-1",
  ))
  .map((one) => JSON.stringify(one))
  .join(" ");

/* The index invents nothing: every phase, citation and waiver is another table's row. */
test("every citation names the record the check into the next status refuses without", () => {
  /* Derived: a terminal check is `() => []`, so a new status sorts itself into one of the sets. */
  const terminal = Object.keys(CHECKS).filter((status) => CHECKS[status].length === 0);
  assert.deepEqual(terminal, ["closed", "dropped"], "the two ends of the ladder ask no payload");
  for (const status of Object.keys(CHECKS).filter((one) => !terminal.includes(one))) {
    assert.ok(CITED[status], `${status} has an entry check and no record named for it, so the phase `
      + "below it would print as discharged by nothing");
  }
  /* The values, not the presence: three were wrong and a presence check passed all three. Asked of a
     record holding criteria and one not, since absent criteria are what `approved` asks for. */
  for (const [status, kinds] of Object.entries(CITED)) {
    const said = asked(status);
    for (const kind of kinds) {
      assert.match(said, new RegExp(`\\b${kind}\\b`, "u"),
        `${status} is cited as earned by a ${kind} and its check asks for no such thing: ${said}`);
    }
  }
});

/* Every name the lane prints is a kind that verb writes, or a run reads a route it cannot walk. */
test("every payload the lane names is a record kind forge record writes", () => {
  for (const kind of Object.values(CITED).flat()) {
    assert.ok(KINDS.includes(kind), `the lane names a ${kind} and \`forge record\` has no such kind`);
  }
});

/* The waiver's own key. Matched to a payload by prose, a row would mark a status as owing nothing
   that `forge advance` refuses — the one thing the lane may not do (ISS-810). */
test("a row's kind is the payload its status stops being asked for at a rung below the top", () => {
  for (const row of LIGHTER) {
    const named = new RegExp(`\\b${row.kind}\\b`, "u");
    assert.match(asked(row.status, "m"), named,
      `${row.status} at the top rung asks for no ${row.kind}, so the row waives nothing`);
    assert.ok(!named.test(asked(row.status, "s")),
      `${row.status} still asks for a ${row.kind} at a fix, and the lane would say it is not owed`);
  }
});

/* The shift, and the bug: citing its own status names the evidence for the step before. */
test("a phase cites the record that carried it, not the one that reached its own status", () => {
  assert.equal(dischargedBy("open"), "confirmation", "Phase 1 is triage, and a confirmation ends it");
  assert.equal(dischargedBy("clarified"), "plan", "Phase 3 is planning, discharged by the plan");
  assert.equal(dischargedBy("in_progress"), "review", "and the review is what carries implementation");
  assert.equal(dischargedBy("closed"), null, "the last rung has none above it to answer to");
});

/* The cells the split restored: the work at a rung is what earns the rung above it, so the judging
   rung owes the note and the ship and the deploying rung owes the ship's tail, the close (ISS-1065). */
test("the judging rung owes 6 and 7 while the deploying rung owes the close", () => {
  assert.equal(PHASE.developed[0], "5 Prove", "the verdicts that earn the judging rung are Phase 5");
  assert.equal(PHASE.testing[0], "6, 7 Ship", "the note and the verification that earn the next");
  assert.equal(PHASE.awaiting_release[0], "7 Ship, the close");
  const index = phaseIndex({ status: "testing", fields: fieldsOf("m"), held: EVERY_KIND });
  assert.deepEqual(index.owed.map((one) => one.phase), ["6, 7 Ship", "7 Ship, the close"],
    "so a run at the judging rung is told both, in the order it walks them");
  assert.deepEqual(index.passed.map((one) => one.cites), ["confirmation", "decision", "plan", "baseline", "review", "verdict"],
    "and the verdict is what discharged the phase below it");
});

test("a status the flow table gives no numbered phase is not listed as owing one", () => {
  assert.ok(Number.isNaN(phaseNumber("closed")), "closed owes `none`, which is no phase number");
  assert.deepEqual(phaseIndex({ status: "closed", fields: fieldsOf("s"), held: EVERY_KIND }).owed, [],
    "so a closed issue owes no phase and the index says so by listing none");
});

test("the first phase owed at approved is Phase 4, and the phases before it are on the record", () => {
  const { first, passed } = phaseIndex({ status: "approved", fields: fieldsOf("m"), held: EVERY_KIND });
  assert.match(first, /^4 /u, "an approved issue implements next, and the index opens on that");
  assert.deepEqual(passed.map((one) => [one.phase, one.cites]), [
    ["1 Triage", "confirmation"],
    ["2 Clarify", "decision"],
    ["3 Plan", "plan"],
  ], "each passed phase names the record that ended it, so a run reads it instead of redoing it");
});

/* Two verbs print this and a run compares them, so a second composition of one line is the defect
   the renderer exists to prevent — and it reads exactly like a working one (ISS-804). */
test("the opening lists each phase behind with the record that discharged it, or nothing", () => {
  const lines = openingLines("approved", EVERY_KIND);
  assert.equal(lines[0], READ_OFF_THE_RECORD, "the line saying where to start leads it");
  assert.deepEqual(lines.slice(1), [
    "  passed: 1 Triage  —  confirmation",
    "  passed: 2 Clarify  —  decision",
    "  passed: 3 Plan  —  plan",
  ], "one line per phase, since a phase's own name carries commas and a joined list reads as more");
  assert.deepEqual(openingLines("open", []), [],
    "an issue nobody has opened yet earns no header over an empty list, on either verb");
  assert.deepEqual(openingLines("closed", EVERY_KIND), [], "and one owing no phase is not told where to start");
});

/* The status is a cache of the records with fewer slots than there are facts, and `advance --set`
   writes it with no entry check reading it, so a status alone claimed phases nothing earned. */
test("a phase is passed on the record that discharges it and not on where the status sits", () => {
  const behind = (held) => openingLines("approved", held).slice(1);
  assert.deepEqual(behind(["confirmation", "decision", "plan"]), [
    "  passed: 1 Triage  —  confirmation",
    "  passed: 2 Clarify  —  decision",
    "  passed: 3 Plan  —  plan",
  ], "a page holding all three names all three, which is what the status alone used to say");
  assert.deepEqual(behind(["confirmation"]), ["  passed: 1 Triage  —  confirmation"],
    "and a status set forward over a page holding one record claims that one phase and no other");
  assert.deepEqual(openingLines("approved", []), [],
    "a status nothing earned earns no opening: every phase behind it is still owed");
  assert.deepEqual(behind(["confirmation", "plan"]), [
    "  passed: 1 Triage  —  confirmation",
    "  passed: 3 Plan  —  plan",
  ], "and a gap in the middle is left as a gap rather than filled in from the status");
});

/* Rule 3 of the issue that asked for this: a reopen keeps the answer it gives today. It stands at
   `open` carrying the whole record set of the cycle before, and owes the triage of the finding. */
test("a full record set at open passes no phase and still owes the triage", () => {
  const index = phaseIndex({ status: "open", fields: fieldsOf("m"), held: EVERY_KIND });
  assert.deepEqual(index.passed, [], "no rung sits below open, so the record above it passes nothing");
  assert.match(index.first, /^1 Triage/u, "and the phase owed is the status's, which is the triage");
  assert.deepEqual(openingLines("open", EVERY_KIND), [],
    "so both verbs say at open what a claim there always said");
});

/* Off a real view and not a literal list, the join every case above skips: `forge record plan` writes a field and never a comment, so a set read off the page alone left Phase 3 never passed (ISS-1064). */
test("the plan and the criteria count as held, being fields of the issue rather than comments", () => {
  const body = { status: "developed", plan: PLAN, complexity: "m", acceptanceCriteria: "1. The outcome." };
  const said = (kind) => ({ body: `## X\n\n\`\`\`forge-record\n${kind}\n\`\`\`\n\nforge-record: ${kind.split(":")[0]} · contract 1`, createdAt: "2026-01-01" });
  const view = viewFrom("the-uuid", body, [
    said("where: a place\nis: a thing\nfinding: holds"),
  ]);
  const held = kindsHeld(view);
  assert.ok(held.includes("plan"), `the plan field is set and the held set is ${held.join(", ")}`);
  assert.ok(held.includes("criteria"), "and so is the criteria field, the other kind kept off the page");
  assert.deepEqual(kindsHeld(viewFrom("the-uuid", { status: "developed" }, [])), [],
    "while an issue holding neither field and no comment holds nothing");
});

/* The two halves answer different questions — the record what was written, the status where the
   issue stands — and a phase in both lists would contradict the line that heads the block. */
test("no phase is both named as passed and named as owed", () => {
  for (const status of ORDER) {
    const index = phaseIndex({ status, fields: fieldsOf("m"), held: EVERY_KIND });
    const owed = new Set(index.owed.map((one) => one.phase));
    for (const one of index.passed) {
      assert.ok(!owed.has(one.phase),
        `at ${status} the phase \`${one.phase}\` is listed as passed and as owed at once`);
    }
  }
});

/* The lane a run reads before it spends anything. Pinned whole at the rung the issue that asked for
   it names, because every one of these lines is what a run acts on: the payload it writes at each
   status, the one it is not asked for, and the two ways a status can owe nothing (ISS-810). */
test("the lane names what earns each status ahead, and what the rung drops on the way", () => {
  assert.deepEqual(laneLines({ status: "open", fields: fieldsOf("s") }), [
    "Lane at `fix` — every status from where it stands, and what earns it:",
    "  open             ← where it stands",
    "  confirmed        confirmation",
    "  clarified        nothing owed at this rung",
    "  approved         criteria; no plan at this rung",
    "  in_progress      baseline",
    "  developed        review, merged",
    "  testing          verdict",
    "  awaiting_release verification; no note at this rung",
    "  closed           nothing owed at any rung",
    "Each name is a record kind: `forge record <kind> -h`.",
  ], "a fix reads its whole route: what it writes, what it does not, and where it ends");
  const feature = laneLines({ status: "open", fields: fieldsOf("m") });
  assert.ok(!feature.some((one) => one.includes("at this rung")),
    "a feature is waived nothing, so no line of its lane names a payload as dropped");
  assert.deepEqual(feature.filter((one) => /clarified|approved|awaiting_release/u.test(one)), [
    "  clarified        decision",
    "  approved         plan, criteria",
    "  awaiting_release verification, note",
  ], "and each of the three rows a lighter rung touches asks for the whole of its payload");
  assert.deepEqual(laneLines({ status: "open", fields: fieldsOf("s", ["Size: fix -> feature"]) }), feature,
    "a correction that climbed a rung prints the feature lane, the field having claimed a fix");
});

/* The lane is what is ahead, so a status the ladder's path does not hold has none to read. */
test("a status off the linear path is told there is no lane, and is shown no rows", () => {
  const lines = laneLines({ status: "reopen", fields: fieldsOf("s") });
  assert.deepEqual(lines, ["Lane: `reopen` is off the ladder's linear path, so no lane is read from it."],
    "one line saying why, and not a lane read from a status the order does not hold");
});

test("neither verb that prints the opening composes a line of it", () => {
  for (const path of ["../../src/flow/claim.mjs", "../../src/flow/resume.mjs"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.ok(!source.includes("passed:"), `${path} renders an opening line of its own`);
  }
});

/* A waiver is on a transition: dropping the plan is not dropping the implementing, and an index
   reading it as the latter tells a run at the fix rung its work is done. */
test("a rung's waiver is printed against the status it is granted from, and waives no phase", () => {
  const owed = (complexity) => phaseIndex({ status: "clarified", fields: fieldsOf(complexity), held: EVERY_KIND }).owed;
  const waived = owed("s").filter((one) => one.waived);
  /* The status below the one dropping it: the plan's own phase, and for the note the phase `testing` owes, the deploying rung being entered from there and the note written in it (ISS-1065). */
  assert.deepEqual(waived.map((one) => one.phase), ["3 Plan", "6, 7 Ship"],
    "the plan is waived on the way into approved, the note on the way into the deploying rung");
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
    phaseIndex({ status: "clarified", fields: fieldsOf("s"), held: EVERY_KIND }));
  assert.equal(lines.filter((one) => one.startsWith("dropped")).length, 0,
    "no line calls a phase dropped, which is what told a fix its implementing was waived");
  assert.match(lines.find((one) => one.startsWith("owed") && one.includes("3 Plan")),
    /^owed\s+3 Plan\s+—\s+without the plan field/u, "the waiver rides the phase that pays it");
  assert.match(lines[0], /^issue-flow for ISS-9 — phase owed: 3 /u);
  assert.match(lines.at(-1), /forge guide issue-flow <phase>/u, "a reader is left with the next call");
});

/* `ORDER` is the path, not the table: a status beside it read as completion owes work silently. */
test("a status off the linear path owes its own phase and is not read as finished", () => {
  const index = phaseIndex({ status: "reopen", fields: fieldsOf("s"), held: EVERY_KIND });
  assert.match(index.first, /^1 Triage/u, "a reopen owes the triage of the person's finding");
  assert.equal(index.aside, "reopen", "and says it is off the path rather than implying a rung");
  assert.deepEqual(index.passed, [], "nothing is claimed passed on a path this status is not on");
  assert.deepEqual(index.owed.map((one) => one.waived), [null],
    "no rung waiver is read against a status the ladder's rows do not speak to");
  assert.match(indexLines("issue-flow", "ISS-9", index)[0], /off the ladder's linear path/u);
});

/* The seam: this holds the two tables' overlap to exactly what the case above covers. */
test("every status the flow table gives a phase is on the order or named as beside it", () => {
  const off = Object.keys(PHASE).filter((status) => Number.isFinite(phaseNumber(status)) && !ORDER.includes(status));
  assert.deepEqual(off, ["reopen"], "reopen alone sits outside the order, being a bounce not a rung");
  for (const status of off) {
    assert.equal(phaseIndex({ status, fields: fieldsOf("s"), held: EVERY_KIND }).aside, status, `${status} reads as finished`);
  }
});
