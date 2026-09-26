/* The report prints a correction under the record it names, and under that correction the payload
   it let a write replace, so the report reads as the record does (ISS-74). A correction naming
   nothing the report prints keeps its place in the counted list. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("report-corrections-");
const { render } = await import("../../../src/flow/record/page.mjs");
const { handleOf } = await import("../../../src/flow/machine.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const PLAN = "# The plan\n\nThe second reading.";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";

let clock = 0;
const row = (body, documentId = `comment-${clock + 1}`) =>
  ({ documentId, createdAt: `2026-09-26T11:${String((clock += 1)).padStart(2, "0")}:00.000Z`, authorDeviceId: "a-device", body });
const correction = (corrects, moved) => render("correction", { moved, why: "the code said otherwise", corrects });

const ISSUE = {
  documentId: "report-uuid", issueId: "ISS-7420", status: "testing", title: "a corrected record",
  description: "x", plan: PLAN, acceptanceCriteria: CRITERIA,
  releaseNotes: { section: "Fixed", userFacing: "the list sorts by name" },
};
const project = {
  config: { baseBranch: "master", releaseModel: "none", pipelineConfig: { autoProdDeploy: true } },
  issues: [ISSUE],
  comments: {
    "report-uuid": [
      row(render("decision", { decision: ["a reading | its assumption | its undo"], serves: "none stated" })),
      row(correction("plan", "the plan moved to its second reading"), "plan-correction-id"),
      row(render("superseded", { kind: "plan", by: handleOf("plan-correction-id"), attached: "plan-as-it-stood.md", was: "# The plan\n\nThe first reading." })),
      row(correction("criteria:2", "criterion 2 names the order")),
      row(correction("decision", "the reading was the other one")),
      row(render("verdict", { criterion: "1 — The first outcome.", verdict: "pass", commit: "43b811e", evidence: ["43b811e"] })),
      row(correction("verdict:1", "the verdict cited the wrong head")),
      row(correction("note", "the note names the order")),
      row(correction("issue:status", "the status set by hand")),
      row(render("correction", { moved: "an old correction", why: "written before the field" })),
    ],
  },
  answer: {
    forge_config: () => ({ config: project.config }),
    forge_issues: (args) => (args.action === "list" ? { issues: project.issues, returned: 1, hasMore: false } : ISSUE),
  },
};
const { tracker, env: ENV } = await trackerFor(project);
test.after(() => tracker.close());

const report = async () => {
  const run = await ranAsync(FORGE, ["resume", "ISS-7420", "--report"], ENV);
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};

/* What stands on the lines after a heading, up to the next line with nothing in front of it. */
const blockUnder = (out, heading) => {
  const lines = out.split("\n");
  const at = lines.findIndex((one) => one.startsWith(heading));
  assert.ok(at >= 0, `the report prints ${heading}:\n${out}`);
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((one) => one && !one.startsWith(" "));
  return rest.slice(0, end < 0 ? rest.length : end).join("\n");
};

test("a correction stands under the record it corrects, whichever record that is", async () => {
  const out = await report();
  assert.match(blockUnder(out, "Decision record"), /^ {2}Correction .*\n {4}What moved: the reading was the other one/mu);
  assert.match(blockUnder(out, "Verdict"), /^ {4}What moved: the verdict cited the wrong head/mu);
  assert.match(out, /^Release note {2}Fixed: the list sorts by name\n {2}Correction .*\n {4}What moved: the note names the order/mu);
  assert.match(out, /^1\. The first outcome\.\n2\. The second outcome\.\n {2}Correction .*\n {4}What moved: criterion 2 names the order/mu,
    "under the criteria, whose occasion names one of them");
  assert.match(out, /^The second reading\.\n {2}Correction .*\n {4}What moved: the plan moved to its second reading/mu);
});

test("the payload a correction let a write replace is printed under it, marked superseded", async () => {
  const out = await report();
  assert.match(out, /What it corrects: plan\n {4}Superseded payload {2}\([^)]+\), superseded under the correction above\n {6}Kind: plan\n/u);
  assert.match(out, / {6}As it stood: # The plan\n {8}\n {8}The first reading\./u, "the value whole, indented under it");
  assert.doesNotMatch(out, /^Superseded payload/mu, "and nowhere else");
});

test("the criteria are printed whole under a heading of their own", async () => {
  const out = await report();
  assert.match(out, /^Criteria\n1\. The first outcome\.\n2\. The second outcome\.$/mu);
});

test("a correction naming nothing the report prints stays in the counted list", async () => {
  const out = await report();
  assert.match(out, /^2 of the 7 Correction records, the rest beside what each corrects, oldest first\nCorrection .*\n {2}What moved: the status set by hand\n/mu);
  assert.match(out, /^ {2}What moved: an old correction$/mu, "one written before the field is among them");
});
