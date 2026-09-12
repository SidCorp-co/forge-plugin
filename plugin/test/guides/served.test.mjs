/* The part that arrives with the verb that acts. Every rule below fails without the code behind it:
   before this, `phasesOf` had no caller but the `guide` verb, so a run read the method by choosing a
   part for itself and nothing said which part its act was in. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempHome } from "../fixtures.mjs";

const HOME = tempHome("served-part");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(
  join(HOME.path, "forge", "config.json"),
  JSON.stringify({ url: "https://stub.example/mcp", token: "t" }),
);
process.env.XDG_CONFIG_HOME = HOME.path;

const { SLUG, partForLanding, partForRecord, partForStatus, phasePart, surfaceFor } =
  await import("../../src/guides/served.mjs");
const { CITED, ENDS_PHASE, phaseAtLanding, phaseForRecord, phasesOwed } =
  await import("../../src/guides/phases.mjs");
const { localGuide } = await import("../../src/guides/guides.mjs");
const { ORDER } = await import("../../src/flow/earned.mjs");
const { userConfig } = await import("../../src/resolve/config.mjs");
const { owedOf } = await import("../../src/shown/ledger.mjs");

/** What `forge guide issue-flow <n>` prints, through the verb's own call and not a second reader. */
const guideSays = (phase) => localGuide(SLUG)({ part: String(phase) }).lines.join("\n");

const rungBelow = (status) => ORDER[ORDER.indexOf(status) - 1];

/* Every case reads what arrived through the printer the caller hands in, which is the delivery the
   credit follows: nothing here can assert on a return the callers do not print. */
const printed = (serve) => {
  const said = [];
  serve((part) => said.push(part));
  return said;
};

/* The verbs read the id off the environment as they do in a run, so a case wanting a session shown
   nothing takes one of its own: two cases under one id credit each other's deliveries. */
const asRun = (id) => {
  process.env.FORGE_SESSION_ID = id;
};

/* Which phase a kind ends, where the two flow tables can still work it out. The one phase the rung below the earning status owes, except that a rung naming several answers only for the kind that leads its row. */
const derivedFor = (earns, kind, kinds) => {
  const owed = phasesOwed(rungBelow(earns));
  const spans = phasesOwed(earns).length > 1;
  return owed.length === 1 && (!spans || kind === kinds[0]) ? owed[0] : null;
};

/* The declaration is the one runtime source and this is its checker, and which rows it reaches is asserted rather than counted in prose: a fold that gives a rung a second phase takes rows out of the derivation, and a case describing its own reach in a comment goes on claiming them (ISS-1066). */
test("every cited kind answers a phase, and one the flow tables can derive answers that one", () => {
  const derived = [];
  for (const [earns, kinds] of Object.entries(CITED)) {
    for (const kind of kinds) {
      const answer = phaseForRecord(kind);
      /* Named before it is served: a kind with no row answers null, and serving that says only that
         the guide refused a part called `null`. */
      assert.ok(Number.isInteger(answer),
        `a ${kind} is cited at ${earns} and the declared column gives it no phase at all`);
      assert.ok(guideSays(answer).length > 0,
        `a ${kind} answers ${answer}, which is no phase this copy serves a part for`);
      const owed = derivedFor(earns, kind, kinds);
      if (owed === null) continue;
      derived.push(kind);
      assert.equal(answer, owed, `a ${kind} earns ${earns}, so it ends the one phase ${rungBelow(earns)} owes`);
    }
  }
  assert.deepEqual(derived, ["confirmation", "baseline", "verdict"],
    "the rows this derivation still reaches: one leaving the set is a row this case stopped checking, and the pin below is what has to gain it");
  assert.deepEqual(Object.keys(ENDS_PHASE).sort(), Object.values(CITED).flat().sort(),
    "and the column holds a row for exactly the cited kinds, so neither a dead row nor a mistyped key sits in it unread");
});

/* Every row the case above skips, each by its own number: a wrong row here serves a part nobody could tell from the right one. */
test("the kinds the flow tables leave underivable are declared by number", () => {
  assert.equal(phaseForRecord("decision"), 2, "the reading is Phase 2's, on the rung that owes the clarifying and the planning both");
  assert.equal(phaseForRecord("plan"), 3, "the plan is Phase 3's, written at that same rung");
  assert.equal(phaseForRecord("criteria"), 3, "and the criteria beside it, in the phase the plan cites them from");
  assert.equal(phaseForRecord("review"), 4, "the review is Phase 4's last step, on a rung owing 4, 5 and 7");
  assert.equal(phaseForRecord("merged"), 7, "and the landing that earns the same rung is Phase 7's first step");
  assert.equal(phaseForRecord("verification"), 7, "the verification reads the change where it now runs");
  assert.equal(phaseForRecord("note"), 6, "and the note is drafted at 6, the rung it is written at spanning 6 and 7");
  assert.equal(phaseForRecord("verdict"), 5, "while developed owes 5 alone, which is the derivation's to answer");
});

/* Pinned by number rather than against the row it is read off, which would be the implementation spelled twice: the ship is Phase 7 and the close is its tail, so the rung the close is entered from owes 7 and the landing ends 7. A row moved to any other phase fails here. */
test("the landing ends the phase the rung the close is entered from names, which is the ship", () => {
  assert.deepEqual(phasesOwed("awaiting_release"), [7],
    "the deploying rung owes the ship alone, the judging rung below it owing the note as well");
  assert.equal(phaseAtLanding(), 7, "and the landing is a step of that phase");
  assert.deepEqual(phasesOwed("testing"), [6, 7],
    "while the rung that spans two is the judging one, so `.at(-1)` there picks rather than repeats");
});

/* One act, two readers: the ship's last step reads the landing off its rung, the mark's write reads the declared row, and moving one without the other tells a run two phases for one act. */
test("the landing and the merged mark it writes name one phase", () => {
  assert.equal(phaseForRecord("merged"), phaseAtLanding(),
    "the mark is what the landing writes, so the row and the rung answer alike or one of them is wrong");
});

test("a served part is byte-identical to what the guide verb prints for the same phase", () => {
  asRun("a-run-writing-records");
  const plan = printed((say) => partForRecord("plan", say));
  assert.deepEqual(plan, [guideSays(3)], "the plan carries Phase 3 as `forge guide issue-flow 3` does");
  assert.ok(plan[0].length > 0, "and it is not the empty answer passing for identity");
  assert.deepEqual(printed((say) => partForRecord("verdict", say)), [guideSays(5)], "a verdict Phase 5");
  assert.deepEqual(printed((say) => partForLanding(say)), [guideSays(7)], "and the landing Phase 7");
});

test("a rung naming several phases carries a part for each of its own kinds", () => {
  asRun("a-run-at-the-release-rung");
  assert.deepEqual(printed((say) => partForRecord("verification", say)), [guideSays(7)],
    "the verification carried nothing while the rung's index was what answered for it");
  assert.deepEqual(printed((say) => partForRecord("note", say)), [guideSays(6)],
    "and the note carried nothing either, on the same rung and for the same reason");
  assert.notEqual(guideSays(6), guideSays(7), "which are different parts, or the case proves nothing");
});

test("a claim carries the phase its issue's status owes, and no two statuses answer alike", () => {
  asRun("a-run-taking-a-lease");
  assert.deepEqual(printed((say) => partForStatus("confirmed", say)), [guideSays(2)],
    "the first phase of the two that rung owes is the one a claim there arrives with");
  assert.deepEqual(printed((say) => partForStatus("developed", say)), [guideSays(5)], "developed owes 5");
  assert.notEqual(guideSays(2), guideSays(5), "which are different parts, or the case proves nothing");
});

test("the second act of a kind in one session carries no part, and another phase still does", () => {
  const session = "one-run";
  assert.deepEqual(printed((say) => phasePart(3, say, { session })), [guideSays(3)], "the first is the part");
  assert.deepEqual(printed((say) => phasePart(3, say, { session })), [], "the second prints nothing at all");
  assert.deepEqual(printed((say) => phasePart(5, say, { session })), [guideSays(5)], "a phase not yet served is owed");
});

/* The rule the ledger states and this surface has to keep: a text credited before it reached anyone
   is a delivery that went missing in silence. So a printer that throws credits nothing. */
test("the credit follows the delivery, so a part nobody received is still owed", () => {
  const session = "a-run-whose-printer-failed";
  assert.throws(() => phasePart(3, () => {
    throw new Error("stdout is gone");
  }, { session }), /stdout is gone/u);
  assert.equal(owedOf(session, surfaceFor(3), guideSays(3)).owed, true, "so the part is owed again");
  assert.deepEqual(printed((say) => phasePart(3, say, { session })), [guideSays(3)], "and arrives whole");
});

/* The delta the ledger offers is the trap: two renderings of one phase share most of their lines,
   and the difference between them is not the method. */
test("a phase served twice under two renderings answers with the whole of the second", () => {
  const session = "a-run-whose-key-changed";
  const [first] = printed((say) => phasePart(7, say, { session }));
  userConfig().ship = "ready";
  const second = guideSays(7);
  assert.notEqual(first, second, "the key change moved the rendering, or the case proves nothing");
  assert.deepEqual(printed((say) => phasePart(7, say, { session })), [second], "the whole of the new one");
  delete userConfig().ship;
});

test("each phase holds a surface of its own, so no two can answer each other's lines", () => {
  assert.notEqual(surfaceFor(3), surfaceFor(5), "one key per phase and not one for the method");
  const session = "surfaces-apart";
  printed((say) => phasePart(3, say, { session }));
  assert.equal(owedOf(session, surfaceFor(5), guideSays(5)).owed, true,
    "Phase 5 is owed to a session shown Phase 3, whatever lines the two share");
});

test("a phase this copy serves none of, and a run with no id", () => {
  assert.deepEqual(printed((say) => phasePart(99, say, { session: "any-run" })), [], "no part answers 99");
  assert.deepEqual(printed((say) => phasePart(Number.NaN, say, { session: "any-run" })), [],
    "nor does a status whose row names no phase");
  assert.deepEqual(printed((say) => phasePart(3, say, { session: "" })), [guideSays(3)],
    "and a run with no id cannot be credited, so it is told every time");
});

test.after(() => HOME.remove());
