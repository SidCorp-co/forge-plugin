/* A plan's declarations are read off one fields object by the rung, every status's waivers, the lane
   and the rung report, and parsed once for all of them; the `Lands no file` line is one predicate,
   so the ladder's waiver and the `developed` check cannot read it two ways; and a status where a
   rung's waiver stands beside a declaration's says which dropped what (ISS-3123, AC-05-1-9). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome, typedPlan } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("parsed-once").path;
const { FIX, declaredRows, landsNoFile, lightens, lighterRows, rungOf } = await import("../../../../src/ladder.mjs");
const { rungReport } = await import("../../../../src/ladder-report.mjs");
const { laneLines } = await import("../../../../src/guides/phases.mjs");
const { ORDER, rungFieldsOf, viewFrom } = await import("../../../../src/flow/earned.mjs");

const REQUIRED = "Screen change: no\nSchema coupling: no\nDeploy coupling: yes";
const plans = {
  declared: typedPlan({ Declarations: `${REQUIRED}\nLands no file: yes`, "The way back": "Unset and redeploy." }),
  "answered no": typedPlan({ Declarations: `${REQUIRED}\nLands no file: no`, "The way back": "Unset and redeploy." }),
  silent: typedPlan({ Declarations: REQUIRED, "The way back": "Unset and redeploy." }),
};

/* The plan behind a getter, so every read of the text is counted: a reader parsing it again reads it again. */
const counted = (plan) => {
  const fields = { moved: [], whole: true, complexity: "s", reads: 0 };
  Object.defineProperty(fields, "plan", { get() { fields.reads += 1; return plan; } });
  return fields;
};

test("one fields object's plan is read once, by whichever of the rung, the waivers, the lane and the report asks first", () => {
  for (const [how, plan] of Object.entries(plans)) {
    const fields = counted(plan);
    rungOf(fields);
    for (const status of ORDER) lighterRows(status, fields);
    assert.equal(lightens("in_progress", "baseline", fields), how === "declared");
    laneLines({ status: "open", fields });
    rungReport(fields, "ISS-3");
    declaredRows(fields);
    assert.equal(fields.reads, 1, `the plan ${how} was read ${fields.reads} times off one fields object`);
  }
  const first = counted(plans.declared);
  laneLines({ status: "open", fields: first });
  assert.equal(first.reads, 1, "the lane asking first parses it");
  rungOf(first);
  assert.equal(first.reads, 1, "and the rung asking after takes that parse");
});

test("lands no file is one answer, read alike by the ladder's waiver and by the developed check", () => {
  for (const [how, plan] of Object.entries(plans)) {
    const fields = rungFieldsOf(viewFrom("the-uuid", { plan, sessionContext: {} }, []));
    assert.equal(landsNoFile(fields), how === "declared", `the plan ${how}`);
    assert.equal(declaredRows(fields, "in_progress").length > 0, landsNoFile(fields),
      `and the waiver the ladder grants agrees with it, the plan ${how}`);
  }
});

test("a status where a rung's waiver stands beside a declaration's names each with what dropped it", () => {
  const table = [{ status: "in_progress", rungs: [FIX], kind: "branch", drops: "the branch", because: "a fix is small" }];
  const lane = (plan) => laneLines({ status: "open", fields: { plan, moved: [], whole: true, complexity: "s" }, table });
  assert.match(lane(plans.declared).join("\n"),
    /^ {2}in_progress +nothing owed: no branch at this rung, no baseline under this plan's declarations$/mu,
    "both sources dropped a payload here, so neither is said as the other's");
  assert.match(lane(plans.silent).join("\n"), /^ {2}in_progress +baseline; no branch at this rung$/mu,
    "and with the declaration absent the rung's own waiver is still the rung's");
});
