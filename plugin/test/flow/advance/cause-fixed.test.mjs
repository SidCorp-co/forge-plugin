/* A stale bug whose cause another branch fixed while its own deliverable was still owed had two
   records to choose from: one that dropped the work, and one that read as a reproduced defect
   (ISS-406). The write is exercised at the verb a run types, and the route off the page it posted;
   the half-written pages are built by the renderer and never by the write, so a read path that
   stopped running the shape's check would let one of them earn the rung. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("cause-fixed-");
const { render } = await import("../../../src/flow/record/page.mjs");
const { CHECKS, dispositionOf, nextOf, viewFrom } = await import("../../../src/flow/earned.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const issue = {
  documentId: "cause-uuid",
  issueId: "ISS-7",
  status: "confirmed",
  title: "the toggle does not clamp",
  description: "x",
};
const project = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [issue],
  comments: { "cause-uuid": [] },
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: project.issues, returned: 1, hasMore: false };
      if (args.action === "update") return Object.assign(issue, args.data);
      return issue;
    },
  },
};
const { tracker, env } = await trackerFor(project);
test.after(() => tracker.close());
for (const again of [1, 2]) assert.ok(again && await ranAsync(FORGE, ["claim", "ISS-7", "--unheld"], env));

const posts = () => project.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create");
const write = async (...extra) => {
  const before = posts().length;
  const run = await ranAsync(FORGE, ["record", "confirmation", "ISS-7", "--is", "the clamp is in",
    "--where", "src/toggle.mjs", ...extra], env);
  return { ...run, posted: posts().slice(before) };
};
const FIXED = ["--fixed", "the component clamps, measured at head"];
const SURVIVES = ["--survives", "the regression probe the rules ask for, judged by deleting the clamp"];

const BUILT = { sessionContext: { worklog: { branch: "iss-7-the-work" } } };
const pageOf = (...bodies) =>
  viewFrom("cause-uuid", { ...BUILT, ...issue }, bodies.map((body, at) => ({ createdAt: `2026-09-28T10:0${at}:00.000Z`, authorId: "agent", body })));
const confirmedOwes = (view) => CHECKS.confirmed(view, "ISS-7");

test("a cause-fixed confirmation naming both halves is written, and takes the lane to approved", async () => {
  const run = await write("--finding", "cause-fixed", ...FIXED, ...SURVIVES);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.posted.length, 1, "one comment went up");
  const body = run.posted[0].args.data?.body ?? run.posted[0].args.body;
  const view = pageOf(body);
  assert.deepEqual(confirmedOwes(view), [], "the posted page earns confirmed");
  assert.equal(dispositionOf(view), null, "a cause already fixed is no disposition");
  assert.equal(nextOf("confirmed", view), "approved");
});

test("a cause-fixed confirmation missing a half is refused at the write, naming the flag it lacks", async () => {
  for (const [given, lacking] of [[FIXED, "--survives"], [SURVIVES, "--fixed"]]) {
    const run = await write("--finding", "cause-fixed", ...given);
    assert.equal(run.status, 1, run.stdout);
    assert.equal(run.posted.length, 0, "nothing went up");
    assert.match(run.stderr, new RegExp(`record confirmation needs ${lacking} <`, "u"), run.stderr);
  }
});

test("a half given beside any other finding is refused rather than dropped", async () => {
  for (const [finding, given] of [["holds", FIXED], ["already-fixed", SURVIVES]]) {
    const run = await write("--finding", finding, ...given);
    assert.equal(run.status, 1, run.stdout);
    assert.equal(run.posted.length, 0, "nothing went up");
    assert.match(run.stderr, new RegExp(`no ${given[0]} beside --finding ${finding}`, "u"), run.stderr);
  }
});

test("a cause-fixed page missing either half earns no confirmed, and the six dispositions still drop", () => {
  const HALVES = { fixed: FIXED[1], survives: SURVIVES[1] };
  const on = (fields) => pageOf(render("confirmation", { where: ["src/toggle.mjs"], is: "the clamp is in", ...fields }));
  for (const flag of Object.keys(HALVES)) {
    const half = on({ finding: "cause-fixed", ...HALVES, [flag]: undefined });
    assert.equal(confirmedOwes(half).length, 1, `a page lacking --${flag} earns no confirmed`);
    assert.equal(dispositionOf(half), null, `and drops nothing either, lacking --${flag}`);
  }
  for (const finding of ["already-fixed", "duplicate", "intended", "obsolete", "premise-false", "superseded"]) {
    assert.equal(nextOf("confirmed", on({ finding })), "dropped", finding);
    assert.equal(dispositionOf(on({ finding })), finding, `${finding} is still the drop's reason`);
  }
});
