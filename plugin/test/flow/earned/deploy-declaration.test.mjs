/* Which declarations a plan owes is read off the table that holds them: `approved` once asked for
   two of four by hand, so a plan leaving out its deploy coupling line passed and the way back that
   line may owe was never asked for (ISS-752). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome, typedPlan } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("deploy-declaration").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, viewFrom } = await import("../../../src/flow/earned.mjs");

const DECIDED = [{ createdAt: "2026-09-25T10:00:00.000Z", authorId: "agent",
  body: render("decision", { decision: [], none: "none found" }) }];
const BUILT = { sessionContext: { worklog: { branch: "iss-3-the-work" } } };
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const owed = (declarations) => CHECKS.approved(
  viewFrom("the-uuid", { ...BUILT, plan: typedPlan({ Declarations: declarations }), acceptanceCriteria: CRITERIA }, DECIDED),
  "ISS-3",
).map((item) => item.what);

test("a plan carrying every section and every declaration but the deploy one is refused approved", () => {
  const said = owed("Screen change: no\nSchema coupling: no\nUser-facing outcome: no");
  assert.equal(said.length, 1, `only the declaration is owed, the sections being all there: ${said.join(" | ")}`);
  assert.match(said[0], /^the plan does not declare `Deploy coupling: yes\|no`, which decides /u,
    "and the refusal names the line the plan lacks");
});

test("every missing line is named in one item, not the first", () => {
  const said = owed("User-facing outcome: no");
  assert.equal(said.length, 1);
  assert.match(said[0], /^the plan does not declare `Screen change: yes\|no`, `Schema coupling: yes\|no` or `Deploy coupling: yes\|no`, each deciding /u);
  assert.match(owed("Screen change: no")[0], /^the plan does not declare `Schema coupling: yes\|no` or `Deploy coupling: yes\|no`,/u);
});

test("the user-facing outcome is the one declaration a plan may leave out", () => {
  assert.deepEqual(owed("Screen change: no\nSchema coupling: no\nDeploy coupling: no"), []);
});
