/* A change whose whole substance is configuration on a deployment lands no file in the repository,
   and the plan says so in a line of its own: `in_progress:build` then owes no branch, `in_progress:test` still takes
   the mark at the commit the deployment serves, and nothing after that reads the line at all. The
   line is the only thing that grants it, so an undeclared plan is refused as before however empty its
   change is (ISS-2384). */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome, typedPlan } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("lands-no-file").path;
const { render } = await import("../../../../src/flow/record/page.mjs");
const { CHECKS, deployedOwed, judgedOwed, viewFrom } = await import("../../../../src/flow/earned.mjs");
const { markNote } = await import("../../../../src/flow/record/merged.mjs");

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const SERVED = "43b811e";
const CRITERIA = "1. The staging application answers with the new settings.\n2. The old settings are gone.";
const REQUIRED = "Screen change: no\nSchema coupling: no\nDeploy coupling: yes";
const DECLARED = typedPlan({ Declarations: `${REQUIRED}\nLands no file: yes`, "The way back": "Unset the variables and redeploy." });
const ANSWERED_NO = typedPlan({ Declarations: `${REQUIRED}\nLands no file: no`, "The way back": "Unset the variables and redeploy." });
const SILENT = typedPlan({ Declarations: REQUIRED, "The way back": "Unset the variables and redeploy." });

let clock = 0;
const at = () => `2026-10-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ createdAt: at(), authorId: "agent", body });
const recorded = (kind, fields) => comment(render(kind, fields));
const mark = (wrote) => comment(`mark_merged target=base — ${markNote({ branch: "master", at: SERVED,
  reviewed: SERVED, judged: "nothing", moved: [], wrote, ref: "ISS-3" })}`);
const reviewed = () => recorded("review", { reviewer: "codex", commit: SERVED, outcome: "approved", finding: [] });
const view = (plan, comments = [], over = {}) =>
  viewFrom("the-uuid", { plan, acceptanceCriteria: CRITERIA, sessionContext: {}, ...over }, comments);
const owed = (status, one) => CHECKS[status](one, "ISS-3");
const said = (status, one) => owed(status, one).map((item) => item.what);

test("a plan declaring the change lands no file reaches in_progress:build with no branch", () => {
  assert.deepEqual(said("in_progress:build", view(DECLARED)), [], "the branch is not owed");
  const blocked = view(DECLARED, [], { relations: { blockedBy: [
    { kind: "blocks", otherDisplayId: "ISS-9", otherStatus: "open", gatesDispatch: true },
  ] } });
  assert.equal(said("in_progress:build", blocked).length, 1, "while an edge that orders the work still holds it back");
  assert.match(said("in_progress:build", blocked)[0], /ISS-9/u);
});

test("a plan leaving the line out or answering no owes the branch, however empty the change", () => {
  for (const [plan, how] of [[SILENT, "left out"], [ANSWERED_NO, "answered no"]]) {
    const bare = said("in_progress:build", view(plan));
    assert.equal(bare.length, 1, `the branch and nothing else is owed with the line ${how}: ${bare.join(" | ")}`);
    assert.match(bare[0], /worklog names no branch/u);
  }
});

test("the mark at the served commit, writing nothing, earns in_progress:test beside a review of that commit", () => {
  assert.deepEqual(said("in_progress:test", view(DECLARED, [mark([]), reviewed()], { mergedAt: at() })), []);
});

test("under the declaration a mark that wrote paths is refused, naming them and the plan write", () => {
  const wrote = owed("in_progress:test", view(DECLARED, [mark(["src/app.mjs", "config/env.json"]), reviewed()], { mergedAt: at() }));
  assert.equal(wrote.length, 1, `one disagreement is one refusal: ${wrote.map((one) => one.what).join(" | ")}`);
  assert.match(wrote[0].what, /plan declares the change lands no file/u);
  assert.match(wrote[0].what, /src\/app\.mjs, config\/env\.json/u, "the refusal names what the landing wrote");
  assert.match(wrote[0].command, /^forge record plan ISS-3 <plan\.md>, its `Lands no file` line answering no/u);
});

test("under the declaration the verdicts and the verification are owed exactly as without it", () => {
  const landed = (plan) => view(plan, [mark([]), reviewed()], { mergedAt: at() });
  const judging = (plan) => judgedOwed(landed(plan), "ISS-3").map((one) => one.what);
  assert.deepEqual(judging(DECLARED), judging(SILENT), "every criterion still owes its verdict");
  assert.ok(judging(DECLARED).length > 0, "and a criterion with none is refused");
  const deploying = (plan) => deployedOwed(landed(plan), "ISS-3").map((one) => one.what);
  assert.deepEqual(deploying(DECLARED), deploying(SILENT), "and the verification is owed as it always is");
  assert.ok(deploying(DECLARED).some((one) => /^no verification/u.test(one)));
});

/* The rehearsal a run reads before it builds: the rung report says the waiver is the plan's, read
   through the verb a run types. */
const issue = { documentId: "nofile-uuid", issueId: "ISS-3", status: "approved", complexity: "m",
  title: "thirteen settings on the staging application", description: "x", acceptanceCriteria: CRITERIA };
const project = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [issue],
  comments: { "nofile-uuid": [] },
  answer: { forge_issues: (args) => (args.action === "list" ? { issues: project.issues, returned: 1, hasMore: false } : issue) },
};
const { tracker, env } = await trackerFor(project);
test.after(() => tracker.close());

test("--owed under the declaration earns in_progress:build with no branch, and the rung report gives the waiver to the plan", async () => {
  issue.plan = DECLARED;
  const run = await ranAsync(FORGE, ["advance", "ISS-3", "--owed"], env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /in_progress:build is next and the record earns it/u, run.stdout);
  assert.match(run.stdout, /^ {2}at in_progress:build +not owed, by this plan's declaration: the branch the worklog would name$/mu,
    "the place and what it does not owe stand apart, however long the place's name");
  issue.plan = SILENT;
  const plain = await ranAsync(FORGE, ["advance", "ISS-3", "--owed"], env);
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stdout, /worklog names no branch/u, "without the line the branch is owed as before");
  assert.doesNotMatch(plain.stdout, /by this plan's declaration/u);
});
