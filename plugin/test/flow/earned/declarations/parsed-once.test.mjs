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
const { laneLines, laneOf } = await import("../../../../src/guides/phases.mjs");
const { CHECKS, ORDER, rungFieldsOf, viewFrom } = await import("../../../../src/flow/earned.mjs");
const { render } = await import("../../../../src/flow/record/page.mjs");
const { markNote } = await import("../../../../src/flow/record/merged.mjs");

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
    assert.equal(lightens("in_progress", "branch", fields), how === "declared");
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

/* A landing that wrote a path: the developed check refuses it as a no-file landing only where it read the declaration. */
const SERVED = "43b811e";
const landed = [
  { createdAt: "2026-10-02T10:01:00.000Z", authorId: "agent", body: `mark_merged target=base — ${markNote({ branch: "master",
    at: SERVED, reviewed: SERVED, judged: "nothing", moved: [], wrote: ["src/app.mjs"], ref: "ISS-3" })}` },
  { createdAt: "2026-10-02T10:02:00.000Z", authorId: "agent",
    body: render("review", { reviewer: "codex", commit: SERVED, outcome: "approved", finding: [] }) },
];

test("lands no file is one answer, read alike by the ladder's waiver and by the developed check", () => {
  for (const [how, plan] of Object.entries(plans)) {
    const view = viewFrom("the-uuid", { plan, sessionContext: {}, mergedAt: "2026-10-02T10:03:00.000Z" }, landed);
    const fields = rungFieldsOf(view);
    assert.equal(landsNoFile(fields), how === "declared", `the plan ${how}`);
    assert.equal(declaredRows(fields, "in_progress").length > 0, landsNoFile(fields),
      `and the waiver the ladder grants agrees with it, the plan ${how}`);
    const noFile = CHECKS.developed(view, "ISS-3").some((one) => /plan declares the change lands no file/u.test(one.what));
    assert.equal(noFile, landsNoFile(fields), `and the developed check takes the no-file record exactly where it does, the plan ${how}`);
  }
});

test("a status where a rung's waiver stands beside a declaration's names each with what dropped it", () => {
  /* `in_progress` is the one status a declaration drops anything at, and it earns no record kind, so the lane line says nothing of either drop: the row the line is read off is where the two sources stay apart. */
  const table = [{ status: "in_progress", rungs: [FIX], kind: "worklog", drops: "the worklog", because: "a fix is small" }];
  const row = (plan) => laneOf({ status: "open", fields: { plan, moved: [], whole: true, complexity: "s" }, table })
    .rows.find((one) => one.status === "in_progress");
  assert.deepEqual(row(plans.declared).by, [
    { said: "at this rung", kinds: ["worklog"] },
    { said: "under this plan's declarations", kinds: ["branch"] },
  ], "both sources dropped something here, so neither is said as the other's");
  assert.deepEqual(row(plans.silent).by, [{ said: "at this rung", kinds: ["worklog"] }],
    "and with the declaration absent the rung's own waiver is still the rung's");
});
