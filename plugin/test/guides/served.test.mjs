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
const { CITED, phaseAtLanding, phaseForRecord, phasesOwed } = await import("../../src/guides/phases.mjs");
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

test("a record's phase is the one owed by the rung below the status its entry check cites", () => {
  for (const [earns, kinds] of Object.entries(CITED)) {
    const owed = phasesOwed(rungBelow(earns));
    for (const kind of kinds) {
      const answer = phaseForRecord(kind);
      if (owed.length === 1) {
        assert.equal(answer, owed[0],
          `a ${kind} earns ${earns}, so it ends the one phase ${rungBelow(earns)} owes`);
      } else {
        assert.equal(answer, null,
          `${rungBelow(earns)} owes ${owed.join(" and ")}, and which of its records ends it is not `
          + `something the citation table says, so a ${kind} answers nothing rather than the last`);
      }
    }
  }
});

/* The two the exclusion is for, named so a table that stopped abbreviating is a red rather than a
   silent change of answer: the review is Phase 4's last step and would otherwise read as 7. */
test("the review and the verification are the kinds that exclusion covers", () => {
  assert.equal(phaseForRecord("review"), null, "in_progress owes 4, 5 and 7");
  assert.equal(phaseForRecord("verification"), null, "tested owes 6 and 7");
  assert.equal(phaseForRecord("plan"), 3, "and clarified owes 3 alone");
  assert.equal(phaseForRecord("verdict"), 5, "as developed owes 5 alone");
});

test("the landing ends the last phase its own rung names, that row abbreviating two", () => {
  const owed = phasesOwed(rungBelow("released"));
  assert.ok(owed.length > 1, `the rung below released names several phases: ${owed.join(", ")}`);
  assert.equal(phaseAtLanding(), owed.at(-1), "and the landing is the end of them");
});

test("a served part is byte-identical to what the guide verb prints for the same phase", () => {
  asRun("a-run-writing-records");
  const plan = printed((say) => partForRecord("plan", say));
  assert.deepEqual(plan, [guideSays(3)], "the plan carries Phase 3 as `forge guide issue-flow 3` does");
  assert.ok(plan[0].length > 0, "and it is not the empty answer passing for identity");
  assert.deepEqual(printed((say) => partForRecord("verdict", say)), [guideSays(5)], "a verdict Phase 5");
  assert.deepEqual(printed((say) => partForLanding(say)), [guideSays(7)], "and the landing Phase 7");
});

test("a claim carries the phase its issue's status owes, and no two statuses answer alike", () => {
  asRun("a-run-taking-a-lease");
  assert.deepEqual(printed((say) => partForStatus("clarified", say)), [guideSays(3)], "clarified owes 3");
  assert.deepEqual(printed((say) => partForStatus("developed", say)), [guideSays(5)], "developed owes 5");
  assert.notEqual(guideSays(3), guideSays(5), "which are different parts, or the case proves nothing");
});

test("the second act of a kind in one session carries no part, and another phase still does", () => {
  const session = "one-run";
  assert.deepEqual(printed((say) => phasePart(3, say, session)), [guideSays(3)], "the first is the part");
  assert.deepEqual(printed((say) => phasePart(3, say, session)), [], "the second prints nothing at all");
  assert.deepEqual(printed((say) => phasePart(5, say, session)), [guideSays(5)], "a phase not yet served is owed");
});

/* The rule the ledger states and this surface has to keep: a text credited before it reached anyone
   is a delivery that went missing in silence. So a printer that throws credits nothing. */
test("the credit follows the delivery, so a part nobody received is still owed", () => {
  const session = "a-run-whose-printer-failed";
  assert.throws(() => phasePart(3, () => {
    throw new Error("stdout is gone");
  }, session), /stdout is gone/u);
  assert.equal(owedOf(session, surfaceFor(3), guideSays(3)).owed, true, "so the part is owed again");
  assert.deepEqual(printed((say) => phasePart(3, say, session)), [guideSays(3)], "and arrives whole");
});

/* The delta the ledger offers is the trap: two renderings of one phase share most of their lines,
   and the difference between them is not the method. */
test("a phase served twice under two renderings answers with the whole of the second", () => {
  const session = "a-run-whose-key-changed";
  const [first] = printed((say) => phasePart(7, say, session));
  userConfig().ship = "ready";
  const second = guideSays(7);
  assert.notEqual(first, second, "the key change moved the rendering, or the case proves nothing");
  assert.deepEqual(printed((say) => phasePart(7, say, session)), [second], "the whole of the new one");
  delete userConfig().ship;
});

test("each phase holds a surface of its own, so no two can answer each other's lines", () => {
  assert.notEqual(surfaceFor(3), surfaceFor(5), "one key per phase and not one for the method");
  const session = "surfaces-apart";
  printed((say) => phasePart(3, say, session));
  assert.equal(owedOf(session, surfaceFor(5), guideSays(5)).owed, true,
    "Phase 5 is owed to a session shown Phase 3, whatever lines the two share");
});

test("a phase this copy serves none of, and a run with no id", () => {
  assert.deepEqual(printed((say) => phasePart(99, say, "any-run")), [], "no part answers 99");
  assert.deepEqual(printed((say) => phasePart(Number.NaN, say, "any-run")), [],
    "nor does a status whose row names no phase");
  assert.deepEqual(printed((say) => phasePart(3, say, "")), [guideSays(3)],
    "and a run with no id cannot be credited, so it is told every time");
});

test.after(() => HOME.remove());
