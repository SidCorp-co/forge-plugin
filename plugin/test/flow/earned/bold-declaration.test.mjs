/* A plan written in this repository's own house style bolds its labels, and a bold label closes its
   emphasis after the colon: the reader looking for the name, the colon and the value read that plan
   as declaring nothing, and `approved` told it so in a sentence that was false (ISS-312). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome, typedPlan } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("bold-declaration").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, viewFrom } = await import("../../../src/flow/earned.mjs");
const { planFlags } = await import("../../../src/flow/machine.mjs");

const DECIDED = [{ createdAt: "2026-09-25T10:00:00.000Z", authorId: "agent",
  body: render("decision", { decision: [], none: "none found" }) }];
const BUILT = { sessionContext: { worklog: { branch: "iss-3-the-work" } } };
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const owed = (plan) => CHECKS.approved(
  viewFrom("the-uuid", { ...BUILT, plan, acceptanceCriteria: CRITERIA }, DECIDED),
  "ISS-3",
);
const said = (plan) => owed(plan).map((item) => item.what);
const NEITHER = "the plan declares neither `Screen change: yes|no` nor `Schema coupling: yes|no`, and the "
  + "two decide what the ship steps owe";

test("a bold label closing after its colon declares what it says, for each of the four", () => {
  const bold = "- **Screen change:** no\n- **Schema coupling:** yes\n- **Deploy coupling:** no\n- **User-facing outcome:** yes";
  assert.deepEqual(planFlags(bold), { screen: "no", schema: "yes", deploy: "no", look: "yes" });
  assert.deepEqual(said(typedPlan({ Declarations: "- **Screen change:** no\n- **Schema coupling:** no" })), [],
    "so the plan the filing met earns approved");
});

test("emphasis closing before the colon, or around the value, is read the same way", () => {
  assert.equal(planFlags("**Schema coupling**: yes").schema, "yes");
  assert.equal(planFlags("_Screen change_: no").screen, "no");
  assert.equal(planFlags("Schema coupling: **yes**").schema, "yes");
  assert.deepEqual(planFlags("the schema coupling is untouched: no row moves"),
    { screen: null, schema: null, deploy: null, look: null }, "and prose naming the two is still not the two declared");
});

test("a bold declaration quoted inside a code span declares nothing", () => {
  assert.deepEqual(planFlags("This reads `**Screen change:** yes` and `**Schema coupling**: yes` off a plan."),
    { screen: null, schema: null, deploy: null, look: null });
  assert.equal(planFlags("- **Screen change:** `yes`").screen, null, "nor does a value quoted beside a bold label");
});

test("a plan declaring one of the two is told which line it lacks, and never that it declares neither", () => {
  const one = said(typedPlan({ Declarations: "- **Screen change:** no" }));
  assert.equal(one[0], "the plan declares `Screen change` but not `Schema coupling: yes|no`, and the two decide "
    + "what the ship steps owe");
  assert.ok(!one.includes(NEITHER));
  const other = owed(typedPlan({ Declarations: "Schema coupling: no" }));
  assert.equal(other[0].what, "the plan declares `Schema coupling` but not `Screen change: yes|no`, and the two "
    + "decide what the ship steps owe");
  assert.equal(other[0].command, "forge record plan ISS-3 <plan.md>, with that line in it");
});

/* AC-05-7-3: neither is still neither, and the sentence still quotes both lines. */
test("a plan declaring neither is refused by the sentence naming both", () => {
  const none = owed(typedPlan({ Declarations: "Nothing declared here." }));
  assert.equal(none[0].what, NEITHER);
  assert.equal(none[0].command, "forge record plan ISS-3 <plan.md>, with both lines in it");
});
