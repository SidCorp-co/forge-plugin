/* A rung that drops the plan still records its witnessed answer in the plan field, and every reader of
   that answer reads it whatever the rung, so `approved` judges it there as it does at the top: a set
   pointing at nothing is refused, and a well-formed one owes nothing more of the plan (ISS-2275). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome, typedPlan } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("declarations-only").path;
const { CHECKS, viewFrom } = await import("../../../../src/flow/earned.mjs");
const { PLAN_SECTIONS, WITNESSED } = await import("../../../../src/flow/machine.mjs");

const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const BUILT = { sessionContext: { worklog: { branch: "iss-3-the-work" } } };
const at = (complexity, plan) => viewFrom("the-uuid", { ...BUILT, complexity, plan, acceptanceCriteria: CRITERIA }, []);
const said = (complexity, plan) => CHECKS.approved(at(complexity, plan), "ISS-3").map((item) => item.what);
const only = (witnessed) => typedPlan(Object.fromEntries(PLAN_SECTIONS.map((one) => [one.name, one.name === WITNESSED ? witnessed : null])));

test("a rung dropping the plan refuses a held witnessed set citing a criterion the issue does not hold", () => {
  for (const complexity of ["s", "xs"]) {
    assert.deepEqual(said(complexity, only("criteria: 999")),
      ["`## Witnessed on screen` cites criterion 999, which this issue does not hold, so what a person is asked to witness resolves to nothing"],
      `${complexity}: the set pointing at nothing is the whole of what is owed`);
    assert.deepEqual(said(complexity, only("Nothing on a screen.")),
      ["`## Witnessed on screen` answers neither way, so nothing there says whether a person at the running product is owed a look"],
      `${complexity}: and a section answering neither way, which a plan edited on the tracker never met at the write`);
  }
});

test("a rung dropping the plan owes nothing of a held declarations-only plan answering well", () => {
  for (const complexity of ["s", "xs"]) {
    assert.deepEqual(said(complexity, only("criteria: 2")), [], `${complexity}: a cited criterion the issue holds`);
    assert.deepEqual(said(complexity, only("none — the change is what a refusal says.")), [], `${complexity}: a none with its reading`);
  }
  assert.deepEqual(at("s", only("criteria: 2")).witnessed, { cites: [2], none: false }, "and the judging view holds that answer");
});
